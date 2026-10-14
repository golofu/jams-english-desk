import { useEffect, useRef, useState } from 'react';
import type { Phrase } from '../data/curriculum';
import { SILENT_PEAK, SPEECH_RATE, recordClip, speak, stopSpeaking } from '../lib/audio';
import type { Speed } from '../lib/store';

const MAX_REC_MS = 8000;

type Rec = Awaited<ReturnType<typeof recordClip>>;

/** Warm-up: hear a sentence, say it, hear yourself. No AI needed. */
export function Shadowing({ phrases, speed, onDone }: { phrases: Phrase[]; speed: Speed; onDone: () => void }) {
  const [i, setI] = useState(0);
  const [recording, setRecording] = useState(false);
  const [mine, setMine] = useState<{ url: string; secs: number } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [err, setErr] = useState('');
  const [level, setLevel] = useState(0);
  const [secs, setSecs] = useState(0);
  const rec = useRef<Rec | null>(null);
  const recStart = useRef(0);
  const autoStop = useRef(0);
  const raf = useRef(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  const p = phrases[i];
  const rate = SPEECH_RATE[speed];

  // Auto-play each new phrase (the first one was unlocked by the "เริ่มเลย" tap).
  useEffect(() => {
    setMine(null);
    setErr('');
    if (p) void speak(p.en, { rate });
    return () => {
      stopSpeaking();
      audio.current?.pause();
      void stopRec(false); // moving on / leaving must turn the mic off
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  /** The <audio> is created inside the tap (iOS refuses play() that starts after async work). */
  function freshPlayer(): HTMLAudioElement {
    audio.current?.pause();
    const a = new Audio();
    a.onplay = () => setPlaying(true);
    a.onended = a.onpause = () => setPlaying(false);
    audio.current = a;
    return a;
  }

  function playMine(a = audio.current) {
    if (!a || !a.src) return;
    stopSpeaking();
    a.currentTime = 0;
    a.play().catch(() => setErr('เครื่องไม่ยอมเล่นเสียงเอง กดปุ่ม "ฟังเสียงตัวเอง" อีกครั้งนะคะ'));
  }

  async function stopRec(play: boolean) {
    clearTimeout(autoStop.current);
    cancelAnimationFrame(raf.current);
    const r = rec.current;
    rec.current = null;
    setRecording(false);
    setLevel(0);
    if (!r) return;
    const player = play ? freshPlayer() : null;
    const blob = await r.stop();
    if (!play || !player) return;
    if (!blob.size) {
      setErr('ไม่ได้เสียงเลย ลองกดพูดตามใหม่อีกครั้งนะคะ');
      return;
    }
    const url = URL.createObjectURL(blob);
    setMine((old) => {
      if (old) URL.revokeObjectURL(old.url);
      return { url, secs: Math.max(1, Math.round((Date.now() - recStart.current) / 1000)) };
    });
    player.src = url;
    if (r.peak() < SILENT_PEAK) {
      // Playing silence back teaches nothing: say what happened instead.
      setErr('ไมค์แทบไม่ได้ยินเสียงเลย พูดใกล้ไมค์ขึ้น หรือกด "‹ กลับ" แล้วเริ่มใหม่เพื่อเช็คไมค์');
      return;
    }
    playMine(player);
  }

  async function toggleRec() {
    setErr('');
    if (rec.current) return stopRec(true);
    try {
      stopSpeaking();
      audio.current?.pause();
      const r = await recordClip();
      rec.current = r;
      recStart.current = Date.now();
      setRecording(true);
      setSecs(0);
      const tick = () => {
        if (rec.current !== r) return;
        setLevel(r.level());
        setSecs(Math.floor((Date.now() - recStart.current) / 1000));
        raf.current = requestAnimationFrame(tick);
      };
      tick();
      autoStop.current = window.setTimeout(() => void stopRec(true), MAX_REC_MS);
    } catch {
      setErr('เปิดไมโครโฟนไม่ได้ กดอนุญาตให้เว็บใช้ไมค์ก่อนนะคะ');
    }
  }

  if (!p) return null;
  return (
    <div className="shadow">
      <div className="step-count">
        ประโยคที่ {i + 1} / {phrases.length}
      </div>
      <div className="shadow-card">
        <div className="en big">{p.en}</div>
        <div className="th">{p.th}</div>
      </div>
      <div className="row center">
        <button className="btn" onClick={() => speak(p.en, { rate })}>🔊 ฟังอีกครั้ง</button>
        <button className="btn" onClick={() => speak(p.en, { rate: 0.6 })}>🐢 ช้าๆ</button>
      </div>
      <button className={`btn big ${recording ? 'danger' : 'primary'}`} onClick={toggleRec}>
        {recording ? '⏹️ พูดจบแล้ว กดหยุด' : mine ? '🎙️ อัดใหม่' : '🎙️ กดแล้วพูดตาม'}
      </button>
      {recording ? (
        <div className="rec-status">
          <span className="rec-dot" /> กำลังอัดเสียง… {secs} / {MAX_REC_MS / 1000} วินาที
          <div className="meter">
            <div className="meter-fill" style={{ width: `${Math.round(level * 100)}%` }} />
          </div>
          <div className="rec-hint">แถบสีต้องขยับตอนพูด ถ้าไม่ขยับแปลว่าไมค์ไม่ได้ยิน</div>
        </div>
      ) : mine ? (
        <div className={`rec-done ${playing ? 'playing' : ''}`} role="status">
          {playing ? '🔈 กำลังเล่นเสียงแจม…' : `✓ อัดแล้ว ${mine.secs} วินาที`}
        </div>
      ) : (
        <div className="rec-hint">กดปุ่มส้ม พูดประโยคด้านบน แล้วกดหยุด จะได้ฟังเสียงตัวเองทันที</div>
      )}
      {mine && !recording && (
        <div className="row center">
          <button className="btn small" onClick={() => playMine()}>▶️ ฟังเสียงตัวเอง</button>
          <button className="btn small" onClick={() => { audio.current?.pause(); void speak(p.en, { rate }); }}>▶️ ฟังต้นแบบ</button>
        </div>
      )}
      {err && <div className="alert">{err}</div>}
      <button className="btn ghost" onClick={() => (i + 1 < phrases.length ? setI(i + 1) : onDone())}>
        {i + 1 < phrases.length ? 'ประโยคถัดไป ›' : 'เสร็จ ไปคุยกับโค้ช ›'}
      </button>
      {i === 0 && !mine && !recording && (
        <p className="hint">ขั้นนี้อัดด้วยไมค์ของเครื่อง ไว้ฟังเทียบกับต้นแบบเอง ไม่ส่งไปไหนและไม่มีคะแนน · ขั้นที่ 2 ถึงจะได้คุยกับ AI</p>
      )}
    </div>
  );
}
