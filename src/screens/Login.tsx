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
    return e ? `เข้าสู่ระบบไม่สำเร็จ: ${e.replace(/\+/g, ' ')}` : '';
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
