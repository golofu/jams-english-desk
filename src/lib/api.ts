import { accessToken, supabase } from './supabase';

export class ApiError extends Error {
  constructor(public code: string, public status: number) {
    super(code);
  }
}

/** Thai message for any API failure, shown to Jam. */
export function apiErrorTh(e: unknown): string {
  const code = e instanceof ApiError ? e.code : '';
  switch (code) {
    case 'NO_GEMINI_KEY':
      return 'แอปยังตั้งค่า AI ไม่เสร็จ แจ้งผู้ดูแลแอปนะคะ';
    case 'AUTH_NOT_CONFIGURED':
      return 'แอปยังตั้งค่าการเข้าสู่ระบบไม่เสร็จ แจ้งผู้ดูแลแอปนะคะ';
    case 'BUSY':
      return 'ตอนนี้ AI ฟรีมีคนใช้เยอะ รอสักครู่แล้วลองใหม่นะคะ';
    case 'QUOTA':
      return 'AI ฟรีวันนี้ครบโควตาแล้ว (รีเซ็ตประมาณบ่าย 2–3 โมง) ระหว่างนี้ฝึก Night Review ได้นะคะ';
    case 'CONFIG_MISMATCH':
      return 'ตั้งค่าเซิร์ฟเวอร์กับแอปไม่ตรงกัน (ต้องใส่ VITE_SUPABASE_* แล้ว Redeploy) แจ้งผู้ดูแลแอปนะคะ';
    case 'PASSCODE_REQUIRED':
      return 'ต้องใส่รหัสเข้าแอปก่อนใช้ AI (ขอจากผู้ดูแลแอป)';
    case 'LOGIN_REQUIRED':
      return 'กรุณาเข้าสู่ระบบอีกครั้ง';
    case 'NOT_ALLOWED':
      return 'บัญชีนี้ไม่ได้รับอนุญาตให้ใช้แอป';
    default:
      return navigator.onLine ? 'มีปัญหาในการเชื่อมต่อ AI ลองใหม่อีกครั้งนะคะ' : 'ไม่มีอินเทอร์เน็ต';
  }
}

// App passcode (used until Supabase login is set up). Asked once, remembered on this device.
const PASS_KEY = 'jed:passcode';
let asking: Promise<string | null> | null = null;
function readPass(): string {
  try {
    return localStorage.getItem(PASS_KEY) || '';
  } catch {
    return '';
  }
}
function askPass(wrong: boolean): Promise<string | null> {
  // One prompt even when subtitles + review ask at the same moment.
  asking ??= Promise.resolve().then(() => {
    const p = window.prompt(wrong ? 'รหัสเข้าแอปไม่ถูกต้อง ลองอีกครั้งค่ะ' : 'ใส่รหัสเข้าแอป (ขอจากผู้ดูแลแอป)')?.trim() || null;
    try {
      if (p) localStorage.setItem(PASS_KEY, p);
      else localStorage.removeItem(PASS_KEY);
    } catch {
      /* private mode: ask again next time */
    }
    asking = null;
    return p;
  });
  return asking;
}

export async function api<T>(fn: 'coach' | 'live-token', body: object, retried = false): Promise<T> {
  const token = await accessToken();
  const pass = readPass();
  const res = await fetch(`/api/${fn}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(pass ? { 'x-app-passcode': pass } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && data.error === 'PASSCODE_REQUIRED' && !retried) {
    // Another call already got a new passcode while this one was in flight: just retry.
    if (readPass() && readPass() !== pass) return api<T>(fn, body, true);
    if (await askPass(!!pass)) return api<T>(fn, body, true);
  }
  // Server expects Supabase login but this build has no login screen (VITE_ vars missing / not redeployed).
  if (res.status === 401 && data.error === 'LOGIN_REQUIRED' && !token && !supabase) throw new ApiError('CONFIG_MISMATCH', 401);
  if (!res.ok) throw new ApiError(data.error || 'SERVER', res.status);
  return data as T;
}

export const coach = <T>(action: string, body: object) => api<T>('coach', { action, ...body });
