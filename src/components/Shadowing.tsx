import { useEffect, useRef, useState } from 'react';
import type { Phrase } from '../data/curriculum';
import { SPEECH_RATE, recordClip, speak, stopSpeaking } from '../lib/audio';
import type { Speed } from '../lib/store';

const MAX_REC_MS = 8000;
const SILENT_PEAK = 0.04;

type Rec = Awaited<ReturnType<typeof recordClip>>;

/** Warm-up: hear a sentence, say it, hear yourself. No AI needed. */
export function Shadowing({ phrases, speed, onDone }: { phrases: Phrase[]; speed: Speed; onDone: () => void }) {
  const [i, setI] = useState(0);
  const [recording, setRecording] = useState(false);
  const [mine, setMine] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [level, setLevel] = useState(0);
  const [secs, setSecs] = useState(0);
  const rec = useRef<Rec | null>(null);
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
      void stopRec(false); // moving on / leaving must turn the mic off
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  function playMine() {
    setErr('');
    stopSpeaking();
    const a = audio.current;
    if (!a) return;
    a.currentTime = 0;
    a.play().catch(() => setErr('เครื่องไม่ยอมเล่นเสียงเอง กดปุ่ม ▶️ ฟังเสียงตัวเอง อีกครั้งนะคะ'));
  }

  async function stopRec(play: boolean) {
    clearTimeout(autoStop.current);
    cancelAnimationFrame(raf.current);
    const r = rec.current;
    rec.current = null;
    setRecording(false);
    setLevel(0);
    if (!r) return;
    const blob = await r.stop();
    if (!play) return;
    if (!blob.size) {
      setErr('ไม่ได้เสียงเลย ลองกดพูดตามใหม่อีกครั้งนะคะ');
      return;
    }
    const url = URL.createObjectURL(blob);
    setMine((old) => {
      if (old) URL.revokeObjectURL(old);
      return url;
    });
    audio.current = new Audio(url);
    if (r.peak() < SILENT_PEAK) {
      setErr('ไมค์แทบไม่ได้ยินเสียงเลย ลองพูดใกล้ไมค์ขึ้น หรือเช็คว่าเลือกไมค์ถูกตัว');
    }
    playMine();
  }

  async function toggleRec() {
    setErr('');
    if (rec.current) return stopRec(true);
    try {
      stopSpeaking();
      audio.current?.pause();
      const r = await recordClip();
      rec.current = r;
      setRecording(true);
      setSecs(0);
      const started = performance.now();
      const tick = () => {
        if (rec.current !== r) return;
        setLevel(r.level());
        setSecs(Math.floor((performance.now() - started) / 1000));
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
          <span className="rec-dot" /> กำลังอัดเสียง... {secs} / {MAX_REC_MS / 1000} วินาที
          <div className="meter">
            <div className="meter-fill" style={{ width: `${Math.round(level * 100)}%` }} />
          </div>
          <div className="rec-hint">แถบสีต้องขยับตอนพูด ถ้าไม่ขยับแปลว่าไมค์ไม่ได้ยิน</div>
        </div>
      ) : (
        !mine && <div className="rec-hint">กดปุ่มส้ม พูดประโยคด้านบน แล้วกดหยุด จะได้ฟังเสียงตัวเองทันที</div>
      )}
      {mine && !recording && (
        <div className="row center">
          <button className="btn small" onClick={playMine}>▶️ ฟังเสียงตัวเอง</button>
          <button className="btn small" onClick={() => speak(p.en, { rate })}>▶️ ฟังต้นแบบ</button>
        </div>
      )}
      {err && <div className="alert">{err}</div>}
      <button className="btn ghost" onClick={() => (i + 1 < phrases.length ? setI(i + 1) : onDone())}>
        {i + 1 < phrases.length ? 'ประโยคถัดไป ›' : 'เสร็จ ไปคุยกับโค้ช ›'}
      </button>
    </div>
  );
}
