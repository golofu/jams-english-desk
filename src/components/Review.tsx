import { useEffect, useRef, useState } from 'react';
import { CHARACTERS } from '../data/characters';
import { LEVELS, type Scenario } from '../data/curriculum';
import { Avatar } from './Avatar';
import { apiErrorTh, coach } from '../lib/api';
import { speak } from '../lib/audio';
import { addPhrases, dayStr, levelStatus, passedStars, uid, type SessionLog, type Stars } from '../lib/store';
import { SCENARIOS } from '../data/curriculum';
import { useApp } from '../state';
import type { CallResult } from './CallView';

type Eval = {
  stars: Stars;
  good: { en: string; th: string }[];
  better: { said: string; better: string; th: string; why: string }[];
  words: { en: string; th: string }[];
  noteTh: string;
  noteEn: string;
  memory: string;
};

const clamp = (n: number) => Math.max(1, Math.min(3, Math.round(n || 1)));

/** Jimmy's after-call review: stars, wins, better sentences, new words. Saves everything. */
export function Review({ scenario, call, kind, character, onNext, nextLabel }: {
  scenario: Scenario;
  call: CallResult;
  kind: SessionLog['kind'];
  character: string;
  onNext: () => void;
  nextLabel: string;
}) {
  const { data, update, get } = useApp();
  const prof = data.profile;
  const [ev, setEv] = useState<Eval | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const logId = useRef<string | null>(null);
  const startDay = useRef(dayStr(new Date(Date.now() - call.seconds * 1000))); // the day the call started (23:55 stays tonight)

  // Log the session the moment the call ends: 20 minutes of practice must count for
  // the streak even if the free AI review fails. Stars are attached when they arrive.
  useEffect(() => {
    if (logId.current) return;
    const id = uid();
    logId.current = id;
    const log: SessionLog = {
      id, date: startDay.current, kind, level: get().profile.level, scenarioId: scenario.id, scenarioTitle: scenario.titleTh,
      character, minutes: Math.max(1, Math.round(call.seconds / 60)), createdAt: Date.now(),
    };
    update('sessions', (s) => [log, ...s]);
    // Even if the AI review fails, Jimmy should know what she practised (a good review overwrites this).
    update('profile', (p) => ({ ...p, memory: `She practiced the role-play "${scenario.titleEn}".`, memoryDate: startDay.current }));
    void evaluate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function evaluate() {
    setBusy(true);
    setError('');
    const jamTurns = call.lines.filter((l) => l.who === 'jam').length;
    try {
      const r = await coach<Eval>('evaluate', {
        scenario,
        transcript: call.lines.map((l) => ({ who: l.who, text: l.text })),
        helpCount: call.helpCount,
        jamTurns,
        coachName: get().profile.coachName,
      });
      const stars = { task: clamp(r.stars?.task), listening: clamp(r.stars?.listening), fluency: clamp(r.stars?.fluency) };
      // Too short to judge fairly → never count it toward level-up.
      if (jamTurns < 2) stars.task = stars.listening = stars.fluency = 1;
      const result: Eval = {
        ...r,
        stars,
        good: Array.isArray(r.good) ? r.good : [],
        better: Array.isArray(r.better) ? r.better : [],
        words: Array.isArray(r.words) ? r.words : [],
      };
      setEv(result);

      update('sessions', (s) => s.map((x) => (x.id === logId.current ? { ...x, stars } : x)));
      update('phrases', (ps) =>
        // A few per session: Night reviews ~6 a day, more would bury older phrases forever.
        addPhrases(ps, [...result.better.slice(0, 2).map((b) => ({ en: b.better, th: b.th })), ...result.words.slice(0, 3)], scenario.titleTh),
      );
      const level = get().profile.level;
      const nextLvl = LEVELS.find((l) => l.n === level + 1);
      const total = SCENARIOS.filter((s) => s.level === level).length;
      // Level up only on a passing session, once days + scenario coverage are both met.
      const reached = kind === 'morning' && passedStars(stars) && levelStatus(get().sessions, level, total).ready && !!nextLvl?.available;
      update('profile', (p) => ({ ...p, memory: result.memory || p.memory, memoryDate: startDay.current, level: reached ? level + 1 : p.level }));
      if (reached && nextLvl) setLevelUp(nextLvl.n);
    } catch (e) {
      setError(apiErrorTh(e));
    } finally {
      setBusy(false);
    }
  }

  const jimmy = CHARACTERS.jimmy;
  const rows: { key: keyof Stars; th: string }[] = [
    { key: 'task', th: 'ทำงานสำเร็จ' },
    { key: 'listening', th: 'ฟังเข้าใจ' },
    { key: 'fluency', th: 'พูดลื่น' },
  ];

  return (
    <div className="review">
      <div className="review-head">
        <Avatar character={jimmy} style={prof.style} state={ev ? 'idle' : 'thinking'} size={120} />
        <div className="bubble">
          {!ev && !error && <>{prof.coachName} กำลังดูผลการคุยของคุณ…</>}
          {error && (
            <>
              <div>{error}</div>
              <div className="small">ไม่เป็นไร การฝึกรอบนี้ถูกนับแล้ว ✓</div>
            </>
          )}
          {ev && (
            <>
              <div>{ev.noteTh}</div>
              <div className="en-note">“{ev.noteEn}”</div>
            </>
          )}
        </div>
      </div>

      {levelUp && (
        <div className="levelup">
          🎉 ยินดีด้วย! ขึ้น <b>ระดับ {levelUp}: {LEVELS[levelUp - 1].nameEn}</b> แล้ว
        </div>
      )}

      {ev && (
        <>
          <div className="card stars-card">
            {call.lines.filter((l) => l.who === 'jam').length < 2 && (
              <div className="small">รอบนี้คุณพูดแค่ครั้งเดียว ลองโต้ตอบอย่างน้อย 2–3 ครั้ง จะได้ดาวตามจริงนะคะ</div>
            )}
            {rows.map((r) => (
              <div key={r.key} className="star-row">
                <span>{r.th}</span>
                <span className="stars">{'★'.repeat(ev.stars[r.key])}<span className="off">{'★'.repeat(3 - ev.stars[r.key])}</span></span>
              </div>
            ))}
          </div>

          {ev.good.length > 0 && (
            <div className="card">
              <div className="card-title">👍 คุณพูดได้ดี</div>
              {ev.good.map((g, i) => (
                <div key={i} className="good-row">
                  <div className="en">“{g.en}”</div>
                  <div className="th">{g.th}</div>
                </div>
              ))}
            </div>
          )}

          {ev.better.length > 0 && (
            <div className="card">
              <div className="card-title">✨ พูดแบบนี้จะเป็นธรรมชาติขึ้น</div>
              {ev.better.map((b, i) => (
                <div key={i} className="better-row">
                  <div className="said">คุณพูด: {b.said}</div>
                  <button className="phrase-row" onClick={() => speak(b.better, { rate: 0.85 })}>
                    <span className="en">🔊 {b.better}</span>
                    <span className="th">{b.th} · <i>{b.why}</i></span>
                  </button>
                </div>
              ))}
            </div>
          )}

          {ev.words.length > 0 && (
            <div className="card">
              <div className="card-title">📚 คำศัพท์ใหม่ (3 คำแรกเก็บเข้าคลังแล้ว แตะ ⭐ เพื่อเก็บเพิ่ม)</div>
              <div className="chips">
                {ev.words.map((w, i) => (
                  <span key={i} className="chip-pair">
                    <button className="chip" onClick={() => speak(w.en, { rate: 0.85 })}>
                      {w.en} <small>{w.th}</small>
                    </button>
                    {i >= 3 && (
                      <button className="chip" aria-label="เก็บเข้าคลัง" onClick={() => update('phrases', (ps) => addPhrases(ps, [w], scenario.titleTh))}>⭐</button>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {error && (
        <button className="btn" onClick={evaluate} disabled={busy}>
          🔄 ให้ {prof.coachName} ดูผลอีกครั้ง
        </button>
      )}
      {/* Never block the way forward: the session is already logged, and a stalled review must not trap the learner. */}
      <button className="btn primary big" onClick={onNext}>
        {nextLabel}
      </button>
    </div>
  );
}
