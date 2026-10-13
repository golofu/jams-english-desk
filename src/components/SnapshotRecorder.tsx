import { useEffect, useRef, useState } from 'react';
import { SNAPSHOT_PROMPTS } from '../data/curriculum';
import { recordClip } from '../lib/audio';
import { putClip } from '../lib/idb';
import { supabase } from '../lib/supabase';
import { dayStr, uid } from '../lib/store';
import { useWakeLock } from '../lib/wakelock';
import { useApp } from '../state';

const PER_PROMPT = 60;

/** Voice Snapshot: ~3 minutes, same three prompts every month, to hear the before/after. */
export function SnapshotRecorder({ onDone, onSkip }: { onDone: () => void; onSkip?: () => void }) {
  const { update, userId } = useApp();
  const [i, setI] = useState(-1);
  const [left, setLeft] = useState(PER_PROMPT);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const rec = useRef<{ stop: () => Promise<Blob> } | null>(null);
  const started = useRef(0);
  useWakeLock(i >= 0 && !saving);

  useEffect(() => {
    if (i < 0) return;
    setLeft(PER_PROMPT);
    const iv = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => clearInterval(iv);
  }, [i]);

  // Leaving the screen mid-recording must turn the mic off.
  useEffect(() => () => void rec.current?.stop(), []);

  async function start() {
    setErr('');
    try {
      rec.current = await recordClip();
      started.current = Date.now();
      setI(0);
    } catch {
      setErr('เปิดไมโครโฟนไม่ได้ กรุณาอนุญาตการใช้ไมค์');
    }
  }

  async function cancel() {
    await rec.current?.stop();
    rec.current = null;
    (onSkip ?? onDone)();
  }

  async function next() {
    if (i + 1 < SNAPSHOT_PROMPTS.length) return setI(i + 1);
    setSaving(true);
    try {
      const blob = await rec.current!.stop();
      rec.current = null;
      if (!blob.size) throw new Error('EMPTY');
      const id = uid();
      const seconds = Math.round((Date.now() - started.current) / 1000);
      let local = true;
      try {
        await putClip(id, blob);
      } catch {
        local = false; // private mode / storage full — the cloud copy may still work
      }
      let remotePath: string | undefined;
      if (supabase && userId) {
        const path = `${userId}/${id}.${blob.type.includes('mp4') ? 'm4a' : 'webm'}`;
        // The bucket allows "audio/webm", not Chrome's "audio/webm;codecs=opus".
        const { error } = await supabase.storage.from('snapshots').upload(path, blob, { contentType: blob.type.split(';')[0] });
        if (!error) remotePath = path;
      }
      if (!local && !remotePath) throw new Error('NOWHERE');
      update('snapshots', (s) => [{ id, date: dayStr(), seconds, remotePath }, ...s]);
      update('sessions', (s) => [{ id: uid(), date: dayStr(), kind: 'snapshot', level: 0, createdAt: Date.now() }, ...s]);
      onDone();
    } catch {
      setSaving(false);
      setI(-1);
      setErr('บันทึกเสียงไม่สำเร็จ (ไมค์อาจถูกตัดระหว่างอัด หรือที่เก็บข้อมูลเต็ม) ลองอัดใหม่อีกครั้งนะคะ');
    }
  }

  if (i < 0)
    return (
      <div className="snapshot">
        <h3>🎙️ Voice Snapshot</h3>
        <p>อัดเสียงพูดภาษาอังกฤษ 3 เรื่อง เรื่องละประมาณ 1 นาที พูดได้แค่ไหนก็แค่นั้น ไม่มีใครฟังนอกจากแจม</p>
        <p className="hint">ทุกสิ้นเดือนจะอัดเรื่องเดิมอีกครั้ง แล้วเปิดฟังเทียบว่าเก่งขึ้นแค่ไหน</p>
        {err && <div className="alert">{err}</div>}
        <button className="btn primary big" onClick={start}>เริ่มอัดเสียง</button>
        {onSkip && <button className="btn ghost" onClick={onSkip}>ไว้ทำทีหลัง</button>}
      </div>
    );

  const p = SNAPSHOT_PROMPTS[i];
  return (
    <div className="snapshot">
      <div className="step-count">เรื่องที่ {i + 1} / {SNAPSHOT_PROMPTS.length} · <span className="rec-dot" /> กำลังอัด</div>
      <div className="shadow-card">
        <div className="en big">{p.en}</div>
        <div className="th">{p.th}</div>
      </div>
      <div className={`timer big ${left === 0 ? 'low' : ''}`}>{left}s</div>
      <button className="btn primary big" onClick={next} disabled={saving}>
        {saving ? 'กำลังบันทึก…' : i + 1 < SNAPSHOT_PROMPTS.length ? 'เรื่องถัดไป ›' : 'เสร็จ บันทึกเสียง'}
      </button>
      {!saving && <button className="btn ghost" onClick={cancel}>ยกเลิก ไม่บันทึก</button>}
    </div>
  );
}
