import { useState } from 'react';
import { CHARACTERS } from '../data/characters';
import { Avatar } from '../components/Avatar';
import { supabase } from '../lib/supabase';
import { BRAND } from '../brand';

export function Login() {
  // Google/Supabase report failures (e.g. access_denied) in the redirect URL — show them.
  const [err, setErr] = useState(() => {
    const q = new URLSearchParams(location.hash.slice(1) || location.search);
    const e = q.get('error_description') || q.get('error');
    if (e) console.warn('login error', e); // details for the admin; Jam gets plain Thai
    return !e ? '' : /access_denied/i.test(e) ? 'ยกเลิกการเข้าสู่ระบบแล้ว กดปุ่มด้านล่างเพื่อลองใหม่ค่ะ' : 'เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง ถ้ายังไม่ได้ แจ้งผู้ดูแลแอปนะคะ';
  });
  async function login() {
    const { error } = await supabase!.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    if (error) setErr('เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง');
  }
  return (
    <div className="screen login center-col">
      <img src={BRAND.logo} alt={BRAND.company} className="logo big" />
      <Avatar character={CHARACTERS.jimmy} style="pixar" size={190} />
      <h1>{BRAND.appName}</h1>
      <p>ฝึกพูดและฟังภาษาอังกฤษสำหรับงานเลขา CEO กับ Jimmy</p>
      <button className="btn primary big" onClick={login}>เข้าสู่ระบบด้วย Google</button>
      {err && <div className="alert">{err}</div>}
    </div>
  );
}
