import { useCallback, useEffect, useRef, useState } from 'react';
import type { Character } from '../data/characters';
import type { Phrase } from '../data/curriculum';
import { Avatar } from './Avatar';
import { Conversation, type ConvState, type Line } from '../lib/conversation';
import { apiErrorTh, coach } from '../lib/api';
import { SPEECH_RATE, speak, unlockSpeech } from '../lib/audio';
import { wrapUpCue } from '../lib/prompts';
import { addPhrases } from '../lib/store';
import { useWakeLock } from '../lib/wakelock';
import { useApp } from '../state';

export type CallResult = { lines: Line[]; helpCount: number; seconds: number; mode: 'live' | 'turn' };

type Props = {
  character: Character;
  displayName?: string;
  system: string;
  kicker: string; // small label above the title
  title: string;
  situationTh: string;
  keyPhrases?: Phrase[];
  tasks?: string[];
  seconds: number;
  onDone: (r: CallResult) => void;
  onCancel: () => void;
};

const STATE_TH: Record<ConvState, string> = {
  connecting: 'กำลังเชื่อมต่อ…',
  thinking: 'กำลังคิด…',
  speaking: 'กำลังพูด… ฟังให้จบก่อนนะ', // the mic is shut while the partner talks (echo guard)
  listening: 'ฟังอยู่ พูดได้เลย',
  ended: 'จบการสนทนา',
};
const GRACE_S = 25; // after time is up, give the partner a moment to wrap up, then finish

export function CallView(p: Props) {
  const { data, update } = useApp();
  const prof = data.profile;
  const rate = SPEECH_RATE[prof.speed];
  const [phase, setPhase] = useState<'ready' | 'call'>('ready');
  const [lines, setLines] = useState<Line[]>([]);
  const [partial, setPartial] = useState('');
  const [th, setTh] = useState<Record<number, string>>({});
  const [state, setState] = useState<ConvState>('connecting');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [left, setLeft] = useState(p.seconds);
  const [holding, setHolding] = useState(false);
  const [help, setHelp] = useState<{ en: string; th: string; sayIt: string; heard: string } | null>(null);
  const [helpBusy, setHelpBusy] = useState(false);
  const [showPhrases, setShowPhrases] = useState(false);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState('');
  const conv = useRef<Conversation | null>(null);
  const started = useRef(0);
  const connected = useRef(false);
  const helpReq = useRef(0); // only the latest help request may show its card
  const subsFailedAt = useRef(0);
  const wrapped = useRef(false);
  const finished = useRef(false);
  const noticeTimer = useRef(0);
  const subRef = useRef<HTMLDivElement>(null);
  const props = useRef(p); // latest callbacks without re-creating timers every render
  props.current = p;
  useWakeLock(phase === 'call' && !error); // a locked screen would cut the mic mid-call

  const name = p.displayName ?? p.character.name;
  const jamSpoke = lines.some((l) => l.who === 'jam');

  function showNotice(t: string) {
    setNotice(t);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(''), 7000);
  }

  async function begin() {
    unlockSpeech(); // inside the tap, so later fallback speech is allowed on iOS
    setPhase('call');
    setError('');
    const c = new Conversation({
      system: p.system,
      voice: p.character.voice,
      gender: p.character.gender,
      speechRate: rate,
      onLine: (l) => setLines((ls) => (ls.some((x) => x.id === l.id) ? ls.map((x) => (x.id === l.id ? { ...l } : x)) : [...ls, { ...l }])),
      onPartial: setPartial,
      onState: (s) => {
        // Mic permission + connecting time must not eat Jam's 5- or 8-minute timer.
        if (s !== 'connecting' && !connected.current) {
          connected.current = true;
          started.current = Date.now();
        }
        setState(s);
      },
      onNotice: showNotice,
    });
    conv.current = c;
    started.current = Date.now();
    try {
      await c.start();
    } catch (e) {
      c.end();
      const name = (e as Error)?.name ?? '';
      const msg = (e as Error)?.message ?? '';
      setError(
        /NotReadable|Abort/i.test(name)
          ? 'ไมค์ถูกแอปอื่นใช้อยู่ (เช่น โทรศัพท์ LINE) ปิดแอปนั้นแล้วลองใหม่นะคะ'
          : /NotAllowed|NotFound|Security|Overconstrained/i.test(name)
            ? 'เปิดไมโครโฟนไม่ได้ กรุณาอนุญาตการใช้ไมค์ในเบราว์เซอร์'
            : /WORKLET_LOAD/.test(msg)
              ? 'เปิดระบบเสียงไม่ได้ ลองปิดแอปแล้วเปิดใหม่นะคะ'
              : apiErrorTh(e),
      );
    }
  }

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    const c = conv.current;
    c?.end();
    // Nothing said (or never connected): leave without logging or spending a review.
    if (!c || !c.lines.some((l) => l.who === 'jam')) return props.current.onCancel();
    props.current.onDone({ lines: c.lines, helpCount: c.helpCount, seconds: Math.round((Date.now() - started.current) / 1000), mode: c.mode });
  }, []);

  function leave() {
    if (jamSpoke && !window.confirm('ออกจากการฝึกตอนนี้? ผลการคุยรอบนี้จะไม่ถูกบันทึก')) return;
    finished.current = true;
    conv.current?.end();
    p.onCancel();
  }

  // Poll conversation state + countdown; wrap up near the end, finish after the grace period.
  useEffect(() => {
    if (phase !== 'call') return;
    const iv = setInterval(() => {
      const c = conv.current;
      if (!c || c.liveState() === 'ended') return;
      setState(c.liveState());
      const remain = p.seconds - Math.round((Date.now() - started.current) / 1000);
      setLeft(remain);
      if (remain <= 20 && !wrapped.current) {
        wrapped.current = true;
        c.cue(wrapUpCue());
      }
      if (remain <= -GRACE_S) finish();
    }, 250);
    return () => clearInterval(iv);
  }, [phase, p.seconds, finish]);

  useEffect(
    () => () => {
      clearTimeout(noticeTimer.current);
      conv.current?.end();
    },
    [],
  );

  // Thai subtitles for the partner's lines.
  useEffect(() => {
    if (prof.subtitles !== 'both') return;
    const todo = lines.filter((l) => l.who === 'ai' && !(l.id in th));
    if (!todo.length || Date.now() - subsFailedAt.current < 15_000) return;
    setTh((m) => ({ ...m, ...Object.fromEntries(todo.map((l) => [l.id, ''])) }));
    coach<{ th: string[] }>('translate', { lines: todo.map((l) => l.text) })
      .then((r) => setTh((m) => ({ ...m, ...Object.fromEntries(todo.map((l, i) => [l.id, r.th?.[i] ?? ''])) })))
      .catch(() => {
        // Forget these lines so they are retried (together) with the next new line.
        subsFailedAt.current = Date.now();
        setTh((m) => Object.fromEntries(Object.entries(m).filter(([id]) => !todo.some((l) => String(l.id) === id))));
      });
  }, [lines, prof.subtitles, th]);

  useEffect(() => {
    subRef.current?.scrollTo({ top: subRef.current.scrollHeight, behavior: 'smooth' });
  }, [lines, th, partial]);

  const context = `${p.title}. Last lines: ${lines.slice(-3).map((l) => `${l.who}: ${l.text}`).join(' | ')}`;

  async function releaseHelp() {
    if (!holding) return;
    setHolding(false);
    setHelpBusy(true);
    const req = ++helpReq.current;
    try {
      const r = await conv.current?.releaseHelp(context);
      if (req !== helpReq.current) return; // a newer press replaced this one
      if (r) setHelp(r);
      else showNotice('กดค้างไว้แล้วพูดไทย แล้วค่อยปล่อยนะคะ');
    } catch (e) {
      showNotice(apiErrorTh(e));
    } finally {
      setHelpBusy(false);
    }
  }

  async function sendTyped() {
    if (!typed.trim() || helpBusy) return;
    setHelpBusy(true);
    const req = ++helpReq.current;
    try {
      const r = await conv.current?.helpText(typed, context);
      if (req !== helpReq.current) return;
      setHelp(r ?? null);
      setTyped('');
      setTyping(false);
    } catch (e) {
      showNotice(apiErrorTh(e));
    } finally {
      setHelpBusy(false);
    }
  }

  // Stable identity: a new function each render would restart the avatar's animation loop (no blinking).
  const getLevel = useCallback(() => conv.current?.aiLevel() ?? 0, []);

  if (phase === 'ready') {
    return (
      <div className="call ready">
        <button className="link back" onClick={p.onCancel}>‹ กลับ</button>
        <div className="kicker">{p.kicker}</div>
        <h2>{p.title}</h2>
        <div className="avatar-wrap small">
          <Avatar character={p.character} label={name} style={prof.style} state="idle" size={170} />
        </div>
        <div className="who">
          <b>{name}</b> · {p.character.roleTh}
        </div>
        <p className="situation">{p.situationTh}</p>
        {p.keyPhrases?.length ? (
          <div className="card phrases-card">
            <div className="card-title">ประโยคที่ใช้ได้ (กดเพื่อฟัง)</div>
            {p.keyPhrases.map((k) => (
              <button key={k.en} className="phrase-row" onClick={() => speak(k.en, { rate })}>
                <span className="en">🔊 {k.en}</span>
                <span className="th">{k.th}</span>
              </button>
            ))}
          </div>
        ) : null}
        <button className="btn primary big" onClick={begin}>
          🎙️ เริ่มคุยกับ {name}
        </button>
        <p className="hint">พูดผิดได้เลย {prof.coachName} จะช่วยทวนประโยคที่ถูกให้ฟังเอง · ประมาณ {Math.round(p.seconds / 60)} นาที</p>
      </div>
    );
  }

  const timeUp = left <= 0;
  return (
    <div className="call live">
      <div className="call-top">
        <button className="link" onClick={leave} aria-label="ออกจากการฝึก">✕ ออก</button>
        <div className="call-head">
          <div className="kicker">{p.kicker}</div>
          <div className="call-title">{p.title}</div>
        </div>
        <div className={`timer ${left <= 30 ? 'low' : ''}`} aria-label="เวลาที่เหลือ">
          {!timeUp ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : 'หมดเวลา'}
        </div>
      </div>

      <div className={`avatar-wrap state-${state}`}>
        <Avatar character={p.character} label={name} style={prof.style} level={getLevel} state={state} size={230} />
      </div>
      <div className="state-pill" aria-live="polite">
        <span className={`dot ${state}`} /> {name} · {STATE_TH[state]}
        {conv.current?.mode === 'turn' && <span className="tag">โหมดสำรอง</span>}
      </div>

      {error && (
        <div className="alert" role="alert">
          {error}
          <button className="btn small" onClick={p.onCancel}>กลับ</button>
        </div>
      )}
      {notice && <div className="notice" role="status">{notice}</div>}

      {prof.subtitles !== 'off' && !error && (
        <div className="subs" ref={subRef} aria-live="polite">
          {lines.slice(-6).map((l) => (
            <div key={l.id} className={`sub ${l.who}`}>
              <div className="en">{l.text}</div>
              {l.who === 'ai' && prof.subtitles === 'both' && th[l.id] && <div className="th">{th[l.id]}</div>}
            </div>
          ))}
          {partial && (
            <div className="sub ai live-caption">
              <div className="en">{partial}</div>
            </div>
          )}
          {!lines.length && !partial && <div className="sub ai muted">รอสักครู่ {name} กำลังจะเริ่มพูด…</div>}
        </div>
      )}

      {help && (
        <div className="help-card">
          <div className="card-title">ลองพูดว่า</div>
          <div className="help-en">{help.en}</div>
          <div className="help-say">อ่านว่า: {help.sayIt}</div>
          <div className="help-th">{help.th}</div>
          <div className="row">
            <button className="btn small" onClick={() => speak(help.en, { rate: SPEECH_RATE.slow })}>🔊 ฟัง</button>
            <button
              className="btn small"
              onClick={() => {
                update('phrases', (ps) => addPhrases(ps, [help], p.title));
                setHelp(null);
              }}
            >
              ⭐ เก็บ
            </button>
            <button className="btn small ghost" onClick={() => setHelp(null)}>ปิด</button>
          </div>
        </div>
      )}

      {showPhrases && p.keyPhrases && (
        <div className="drawer">
          {p.tasks && (
            <div className="tasks">
              {p.tasks.map((t) => (
                <div key={t}>☐ {t}</div>
              ))}
            </div>
          )}
          {p.keyPhrases.map((k) => (
            <div key={k.en} className="phrase-row static">
              <span className="en">{k.en}</span>
              <span className="th">{k.th}</span>
            </div>
          ))}
        </div>
      )}

      {typing && (
        <div className="type-help">
          <input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="พิมพ์ภาษาไทยว่าอยากพูดอะไร" onKeyDown={(e) => e.key === 'Enter' && sendTyped()} />
          <button className="btn small primary" onClick={sendTyped} disabled={helpBusy}>ช่วยแปล</button>
        </div>
      )}

      {timeUp && !error && (
        <button className="btn primary big" onClick={finish}>
          {jamSpoke ? 'หมดเวลาแล้ว ดูผล ›' : 'หมดเวลาแล้ว กลับ ›'}
        </button>
      )}

      {!error && (
        <div className="controls">
          {p.keyPhrases && (
            <button className="ctl" onClick={() => setShowPhrases((s) => !s)} aria-pressed={showPhrases}>
              📋<span>ประโยคช่วย</span>
            </button>
          )}
          <button
            className={`ctl help ${holding ? 'holding' : ''}`}
            disabled={state === 'connecting'}
            aria-label="นึกไม่ออก กดค้างแล้วพูดภาษาไทย"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              setHolding(true);
              setHelp(null);
              helpReq.current++; // drop any answer still on its way
              conv.current?.holdHelp();
            }}
            onPointerUp={releaseHelp}
            onPointerCancel={releaseHelp}
            onContextMenu={(e) => e.preventDefault()}
          >
            {helpBusy ? '⏳' : holding ? '🔴' : '🆘'}
            <span>{holding ? 'พูดไทยได้เลย… ปล่อยเมื่อพูดจบ' : 'นึกไม่ออก? กดค้างพูดไทย'}</span>
          </button>
          <button className="ctl" onClick={() => setTyping((t) => !t)} aria-pressed={typing}>
            ⌨️<span>พิมพ์ไทย</span>
          </button>
          <button className="ctl end" onClick={finish}>
            ✓<span>{jamSpoke ? 'จบ ดูผล' : 'จบ'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
