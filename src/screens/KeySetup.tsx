import { useState } from 'react';
import { ApiError, saveGeminiKey } from '../lib/api';

const KEY_URL = 'https://aistudio.google.com/apikey';

/**
 * Every account brings its own free Gemini key, so nobody shares (or exhausts) anyone's quota.
 * Shown once after onboarding, and again from Settings when the key is changed.
 */
export function KeySetup({ onDone, onSkip }: { onDone: () => void; onSkip?: () => void }) {
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    const k = key.trim();
    if (!k) return setErr('วางกุญแจที่คัดลอกมาในช่องก่อนนะคะ');
    setBusy(true);
    setErr('');
    try {
      await saveGeminiKey(k);
      onDone();
    } catch (e) {
      const code = e instanceof ApiError ? e.code : '';
      setErr(
        code === 'KEY_INVALID'
          ? 'Google บอกว่ากุญแจนี้ใช้ไม่ได้ ลองคัดลอกใหม่ทั้งบรรทัด หรือสร้างกุญแจใหม่ค่ะ'
          : code === 'LOGIN_REQUIRED'
            ? 'หลุดจากระบบ รีเฟรชหน้าแล้วเข้าสู่ระบบใหม่นะคะ'
            : 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้งค่ะ',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen onboard">
      <h2>🔑 กุญแจ AI ของคุณ (ฟรี 2 นาที)</h2>
      <p>
        แอปนี้ใช้ <b>Gemini ของ Google แบบฟรี</b> แต่ละคนต้องมีกุญแจของตัวเอง จะได้คุยกับโค้ชได้ทุกวันโดยไม่ต้องแย่งโควตากับใคร
      </p>
      <ol className="steps">
        <li>
          กดปุ่มนี้ (เปิดเว็บ Google AI Studio) แล้วเข้าสู่ระบบด้วยบัญชี Google
          <div>
            <a className="btn" href={KEY_URL} target="_blank" rel="noreferrer">เปิด Google AI Studio ↗</a>
          </div>
        </li>
        <li>
          กด <b>Create API key</b> › ถ้าถามโปรเจกต์ เลือก <b>Create project</b> แล้วกดสร้าง
        </li>
        <li>
          กด <b>Copy</b> กุญแจ แล้วกลับมาวางตรงนี้
        </li>
      </ol>
      <label className="field">
        วางกุญแจตรงนี้
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="AIza... หรือ AQ...."
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          inputMode="text"
        />
      </label>
      <button className="btn primary big" disabled={busy} onClick={save}>
        {busy ? 'กำลังตรวจกับ Google…' : 'บันทึกและเริ่มใช้งาน'}
      </button>
      {err && <div className="alert">{err}</div>}
      <p className="small">
        🔒 กุญแจถูกเข้ารหัสเก็บไว้ฝั่งเซิร์ฟเวอร์ ใช้เฉพาะตอนคุณกดคุยกับ AI เท่านั้น เปลี่ยนหรือลบได้ในหน้าตั้งค่า
        <br />⚠️ โควตาฟรีของ Google: คุยเสียงได้ราววันละ 20 ครั้ง รีเซ็ตประมาณบ่าย 2–3 โมง
      </p>
      {onSkip && (
        <button className="btn ghost" onClick={onSkip}>ไว้ก่อน (ฝึกแบบไม่มี AI ไปพลางได้)</button>
      )}
    </div>
  );
}
