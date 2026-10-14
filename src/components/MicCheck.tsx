import { useEffect, useRef, useState } from 'react';
import { SILENT_PEAK, listMics, micMeter, preferredMic, setPreferredMic, type MicMeter } from '../lib/audio';

const WAIT_MS = 6000; // nothing heard for this long → show help

type Status = 'opening' | 'listening' | 'ok' | 'quiet' | 'denied' | 'busy';

/**
 * "Is the mic working?" before any practice that needs it: a live bar, a green tick the
 * moment real sound comes in (auto-continues), and plain Thai help + a mic picker if not.
 * Zoom-style — the one screen that turns "กดแล้วไม่มีเสียง" into something Jam can fix herself.
 */
export function MicCheck({ onPass, onSkip, autoContinue = true }: { onPass: () => void; onSkip?: () => void; autoContinue?: boolean }) {
  const [status, setStatus] = useState<Status>('opening');
  const [level, setLevel] = useState(0);
  const [mics, setMics] = useState<{ id: string; label: string }[]>([]);
  const [micId, setMicId] = useState(preferredMic());
  const [attempt, setAttempt] = useState(0);
  const meter = useRef<MicMeter | null>(null);
  const passed = useRef(false);

  useEffect(() => {
    let alive = true;
    let raf = 0;
    let quietTimer = 0;
    passed.current = false;
    setStatus('opening');
    setLevel(0);
    (async () => {
      try {
        const m = await micMeter();
        if (!alive) return m.stop();
        meter.current = m;
        setStatus('listening');
        // Device names only exist after permission: list them now, for the picker.
        listMics().then((l) => alive && setMics(l)).catch(() => undefined);
        quietTimer = window.setTimeout(() => alive && !passed.current && setStatus('quiet'), WAIT_MS);
        const tick = () => {
          if (!alive) return;
          const l = m.level();
          setLevel(l);
          if (!passed.current && m.peak() >= SILENT_PEAK) {
            passed.current = true;
            clearTimeout(quietTimer);
            setStatus('ok');
            if (autoContinue) window.setTimeout(() => alive && onPass(), 900); // let her see the tick
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch (e) {
        if (!alive) return;
        const name = (e as Error)?.name ?? '';
        setStatus(/NotReadable|Abort/i.test(name) ? 'busy' : 'denied');
      }
    })();
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      clearTimeout(quietTimer);
      meter.current?.stop();
      meter.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  function pickMic(id: string) {
    setPreferredMic(id);
    setMicId(id);
    setAttempt((n) => n + 1); // reopen with the chosen device
  }

  const retry = () => setAttempt((n) => n + 1);

  return (
    <div className="miccheck">
      <div className="kicker">ก่อนเริ่ม</div>
      <h3>เช็คไมค์ 3 วินาที</h3>
      <div className="shadow-card">
        <div className="en big">Hello, Jimmy!</div>
        <div className="th">พูดประโยคนี้ใส่ไมค์ ให้แถบด้านล่างขยับ</div>
      </div>
      <div className="meter big">
        <div className="meter-fill" style={{ width: `${Math.round(level * 100)}%` }} />
      </div>
      {status === 'opening' && <div className="rec-hint">กำลังเปิดไมค์… ถ้าเครื่องถาม กด "อนุญาต" นะคะ</div>}
      {status === 'listening' && (
        <div className="rec-status">
          <span className="rec-dot" /> ไมค์เปิดแล้ว พูดได้เลย
        </div>
      )}
      {status === 'ok' && (
        <div className="mic-ok" role="status">
          ✓ ไมค์ได้ยินแล้ว
          {!autoContinue && (
            <button className="btn primary" onClick={onPass}>ไปต่อ ›</button>
          )}
        </div>
      )}
      {status === 'quiet' && (
        <div className="alert column" role="alert">
          <b>ไมค์ยังไม่ได้ยินเสียงเลย</b>
          <ul className="bullets small">
            <li>พูดดังขึ้น ใกล้ไมค์ขึ้น</li>
            <li>ใช้คอม: เลือกไมค์ให้ถูกตัวด้านล่าง และเช็คว่าไม่ได้ปิดเสียง (mute)</li>
            <li>ใช้มือถือ: ปิดแอปอื่นที่ใช้ไมค์อยู่ (LINE, โทรศัพท์) แล้วลองใหม่</li>
          </ul>
        </div>
      )}
      {status === 'denied' && (
        <div className="alert column" role="alert">
          <b>เปิดไมค์ไม่ได้ เพราะยังไม่ได้อนุญาต</b>
          <div className="small">แตะไอคอนกุญแจ/ไมค์ข้างช่องที่อยู่เว็บ แล้วเลือก "อนุญาตไมโครโฟน" จากนั้นกดลองใหม่</div>
        </div>
      )}
      {status === 'busy' && (
        <div className="alert column" role="alert">
          <b>ไมค์ถูกแอปอื่นใช้อยู่</b>
          <div className="small">ปิดแอปที่ใช้ไมค์อยู่ (เช่น โทรศัพท์ LINE Zoom) แล้วกดลองใหม่</div>
        </div>
      )}
      {mics.length > 1 && (status === 'quiet' || status === 'listening') && (
        <label className="field">
          ไมค์ที่ใช้
          <select className="select" value={micId} onChange={(e) => pickMic(e.target.value)}>
            {!micId && <option value="">ค่าเริ่มต้นของเครื่อง</option>}
            {mics.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </label>
      )}
      {(status === 'quiet' || status === 'denied' || status === 'busy') && (
        <div className="row center">
          <button className="btn primary" onClick={retry}>ลองใหม่</button>
          {onSkip && <button className="btn ghost" onClick={onSkip}>ข้ามไปก่อน</button>}
        </div>
      )}
    </div>
  );
}
