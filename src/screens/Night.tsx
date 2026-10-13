import { useEffect, useMemo, useState } from 'react';
import { CHARACTERS } from '../data/characters';
import { SCENARIOS } from '../data/curriculum';
import { Avatar } from '../components/Avatar';
import { SPEECH_RATE, speak, stopSpeaking } from '../lib/audio';
import { dayStr, reviewPhrase, uid, type SavedPhrase } from '../lib/store';
import { useApp } from '../state';

type Item = { id?: string; en: string; th: string };

/** Unbiased Fisher–Yates shuffle. */
function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
const uniqBy = <T,>(a: T[], key: (x: T) => string) => {
  const seen = new Set<string>();
  return a.filter((x) => {
    const k = key(x).trim().toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};
const QUIZ_N = 6;

/** Night Review: quiet listening + tap quiz. No speaking (others may be asleep). */
export function Night({ onExit }: { onExit: () => void }) {
  const { data, update } = useApp();
  const prof = data.profile;
  const [step, setStep] = useState<'start' | 'listen' | 'quiz' | 'done'>('start');
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);

  const { items, quiz } = useMemo(() => {
    const today = dayStr();
    const fresh = data.phrases.filter((p) => dayStr(new Date(p.addedAt)) === today);
    const due = data.phrases.filter((p) => p.due <= today && !fresh.includes(p));
    // Half today's new phrases, half due reviews, so old ones aren't starved on busy days.
    const picked = [...fresh.slice(0, 4), ...due.slice(0, 4), ...fresh.slice(4), ...due.slice(4)];
    const fallback = SCENARIOS.filter((s) => s.level <= prof.level).flatMap((s) => s.keyPhrases);
    let items: Item[] = uniqBy(picked, (p) => p.en).slice(0, QUIZ_N);
    if (items.length < 4) items = uniqBy([...items, ...shuffle(fallback)], (p) => p.en).slice(0, QUIZ_N);
    // Every listened item is quizzed (so its review is recorded); options are distinct Thai texts.
    const pool = uniqBy([...data.phrases, ...fallback], (p) => p.th);
    const quiz = shuffle(items).map((it) => {
      const wrong = shuffle(pool.filter((p) => p.th.trim() !== it.th.trim())).slice(0, 3).map((p) => p.th);
      return { it, options: shuffle([it.th, ...wrong]) };
    });
    return { items, quiz };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rate = SPEECH_RATE[prof.speed];

  // Bedtime: dark page edges and status bar, not the orange daytime theme.
  useEffect(() => {
    const meta = document.querySelector('meta[name=theme-color]');
    const prev = meta?.getAttribute('content');
    document.body.style.background = '#1e1b4b';
    meta?.setAttribute('content', '#1e1b4b');
    return () => {
      document.body.style.background = '';
      if (prev) meta?.setAttribute('content', prev);
    };
  }, []);

  function answer(opt: string) {
    if (picked) return;
    const q = quiz[i];
    const ok = opt === q.it.th;
    setPicked(opt);
    if (ok) setScore((s) => s + 1);
    if (q.it.id) update('phrases', (ps) => ps.map((p: SavedPhrase) => (p.id === q.it.id ? reviewPhrase(p, ok) : p)));
  }

  function nextQ() {
    setPicked(null);
    if (i + 1 < quiz.length) {
      setI(i + 1);
      void speak(quiz[i + 1].it.en, { rate });
    } else {
      update('sessions', (s) => [{ id: uid(), date: dayStr(), kind: 'night', level: prof.level, minutes: 10, createdAt: Date.now() }, ...s]);
      setStep('done');
    }
  }

  const jimmy = CHARACTERS.jimmy;

  if (step === 'start')
    return (
      <div className="screen night-screen">
        <button className="link back" onClick={onExit}>‹ กลับ</button>
        <div className="kicker">🌙 Night Review · 10 นาที</div>
        <h2>ทบทวนก่อนนอน</h2>
        <p>ไม่ต้องพูดออกเสียง ใส่หูฟังแล้วฟังสบายๆ ได้เลย</p>
        <div className="plan">
          <div className="plan-row"><span className="n">1</span><span className="t">ฟังประโยคที่ฝึกวันนี้ {items.length} ประโยค</span><span className="m">5 นาที</span></div>
          <div className="plan-row"><span className="n">2</span><span className="t">ฟังแล้วแตะคำแปลที่ถูก {quiz.length} ข้อ</span><span className="m">5 นาที</span></div>
        </div>
        <button className="btn primary big" onClick={() => { setStep('listen'); void speak(items[0].en, { rate }); }}>เริ่มฟัง</button>
      </div>
    );

  if (step === 'listen') {
    const it = items[i];
    return (
      <div className="screen night-screen">
        <div className="step-count">ฟังทบทวน {i + 1} / {items.length}</div>
        <div className="shadow-card">
          <div className="en big">{it.en}</div>
          <div className="th">{it.th}</div>
        </div>
        <div className="row center">
          <button className="btn" onClick={() => speak(it.en, { rate })}>🔊 ฟังอีกครั้ง</button>
          <button className="btn" onClick={() => speak(it.en, { rate: 0.6 })}>🐢 ช้าๆ</button>
        </div>
        <button
          className="btn primary big"
          onClick={() => {
            stopSpeaking();
            if (i + 1 < items.length) {
              setI(i + 1);
              void speak(items[i + 1].en, { rate });
            } else {
              setI(0);
              setStep('quiz');
              void speak(quiz[0].it.en, { rate });
            }
          }}
        >
          {i + 1 < items.length ? 'ถัดไป ›' : 'ไปทำควิซ ›'}
        </button>
      </div>
    );
  }

  if (step === 'quiz') {
    const q = quiz[i];
    return (
      <div className="screen night-screen">
        <div className="step-count">ควิซ {i + 1} / {quiz.length}</div>
        <button className="listen-big" onClick={() => speak(q.it.en, { rate })}>🔊<span>แตะเพื่อฟังอีกครั้ง</span></button>
        {picked && <div className="reveal">{q.it.en}</div>}
        <div className="options">
          {q.options.map((o) => (
            <button key={o} className={`option ${picked ? (o === q.it.th ? 'right' : o === picked ? 'wrong' : '') : ''}`} onClick={() => answer(o)}>
              {o}
            </button>
          ))}
        </div>
        {picked && <button className="btn primary big" onClick={nextQ}>{i + 1 < quiz.length ? 'ข้อต่อไป ›' : 'ดูผล ›'}</button>}
      </div>
    );
  }

  return (
    <div className="screen night-screen center-col">
      <Avatar character={jimmy} style={prof.style} size={160} />
      <h2>ได้ {score} / {quiz.length} ข้อ</h2>
      <p>{score >= quiz.length - 1 ? 'เยี่ยมมาก! ' : 'ไม่เป็นไร ประโยคที่ผิดจะกลับมาให้ทบทวนอีก '}Good night, Jam. See you at 5 a.m. 🌙</p>
      <button className="btn primary big" onClick={onExit}>ราตรีสวัสดิ์</button>
    </div>
  );
}
