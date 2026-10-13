import { useEffect, useRef, useState } from 'react';
import type { Phrase } from '../data/curriculum';
import { SPEECH_RATE, recordClip, speak, stopSpeaking } from '../lib/audio';
import type { Speed } from '../lib/store';

const MAX_REC_MS = 8000;

/** Warm-up: hear a sentence, say it, hear yourself. No AI needed. */
export function Shadowing({ phrases, speed, onDone }: { phrases: Phrase[]; speed: Speed; onDone: () => void }) {
  const [i, setI] = useState(0);
  const [recording, setRecording] = useState(false);
  const [mine, setMine] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const rec = useRef<{ stop: () => Promise<Blob> } | null>(null);
  const autoStop = useRef(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  const p = phrases[i];
  const rate = SPEECH_RATE[speed];

  // Auto-play each new phrase (the first one was unlocked by the "เริ่มเลย" tap).
  useEffect(() => {
    setMine(null);
    if (p) void speak(p.en, { rate });
    return () => {
      stopSpeaking();
      void stopRec(false); // moving on / leaving must turn the mic off
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  async function stopRec(play: boolean) {
    clearTimeout(autoStop.current);
    const r = rec.current;
    rec.current = null;
    setRecording(false);
    if (!r) return;
    const blob = await r.stop();
    if (!play || !blob.size) return;
    const url = URL.createObjectURL(blob);
    setMine((old) => {
      if (old) URL.revokeObjectURL(old);
      return url;
    });
    audio.current = new Audio(url);
    void audio.current.play();
  }

  async function toggleRec() {
    setErr('');
    if (rec.current) return stopRec(true);
    try {
      stopSpeaking();
      rec.current = await recordClip();
      setRecording(true);
      autoStop.current = window.setTimeout(() => void stopRec(true), MAX_REC_MS);
    } catch {
      setErr('เปิดไมโครโฟนไม่ได้ กรุณาอนุญาตการใช้ไมค์');
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
        {recording ? '⏹️ หยุด แล้วฟังเสียงตัวเอง' : '🎙️ พูดตาม'}
      </button>
      {mine && !recording && (
        <div className="row center">
          <button className="btn small" onClick={() => audio.current?.play()}>▶️ เสียงแจม</button>
          <button className="btn small" onClick={() => speak(p.en, { rate })}>▶️ ต้นแบบ</button>
        </div>
      )}
      {err && <div className="alert">{err}</div>}
      <button className="btn ghost" onClick={() => (i + 1 < phrases.length ? setI(i + 1) : onDone())}>
        {i + 1 < phrases.length ? 'ประโยคถัดไป ›' : 'เสร็จ ไปคุยกับโค้ช ›'}
      </button>
    </div>
  );
}
