import { useState } from 'react';
import { CHARACTERS } from '../data/characters';
import { Avatar } from '../components/Avatar';
import { LOGIN_URL, inLineBrowser, openOutsideLine } from '../lib/auth';
import { BRAND } from '../brand';

const ERRORS: Record<string, string> = {
  cancelled: 'ยกเลิกการเข้าสู่ระบบแล้ว กดปุ่มด้านล่างเพื่อลองใหม่ค่ะ',
  email: 'บัญชี Google นี้ยังไม่ได้ยืนยันอีเมล ลองบัญชีอื่นนะคะ',
};

export function Login() {
  // The Worker reports a failed Google login in the URL (/?login_error=...): show it in plain Thai.
  const [err] = useState(() => {
    const e = new URLSearchParams(location.search).get('login_error');
    if (e) {
      console.warn('login error', e);
      history.replaceState(null, '', '/');
    }
    return e ? ERRORS[e] || 'เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง ถ้ายังไม่ได้ แจ้งผู้ดูแลแอปนะคะ' : '';
  });
  const line = inLineBrowser();
  return (
    <div className="screen login center-col">
      <img src={BRAND.logo} alt={BRAND.appName} className="logo big" />
      <Avatar character={CHARACTERS.jimmy} style="pixar" size={190} />
      <h1>{BRAND.appName}</h1>
      <p>ฝึกพูดและฟังภาษาอังกฤษสำหรับใช้ในที่ทำงาน กับโค้ช Jimmy วันละไม่กี่นาที</p>
      {line ? (
        <>
          <p className="small">Google ไม่ให้เข้าสู่ระบบจากในแอป LINE กดปุ่มเพื่อเปิดใน Chrome หรือ Safari ก่อนนะคะ</p>
          <button className="btn primary big" onClick={openOutsideLine}>เปิดในเบราว์เซอร์</button>
        </>
      ) : (
        <a className="btn primary big" href={LOGIN_URL}>เข้าสู่ระบบด้วย Google</a>
      )}
      <p className="small">ฟรี ใช้ AI ฟรีของ Google ด้วยกุญแจของคุณเอง (มีขั้นตอนสอนหลังเข้าสู่ระบบ)</p>
      {err && <div className="alert">{err}</div>}
      <p className="small center"><a className="link" href="/help" target="_blank" rel="noreferrer">📖 วิธีใช้</a></p>
    </div>
  );
}
