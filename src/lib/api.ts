export class ApiError extends Error {
  constructor(public code: string, public status: number) {
    super(code);
  }
}

/** Thai message for any API failure, shown to the learner. */
export function apiErrorTh(e: unknown): string {
  const code = e instanceof ApiError ? e.code : '';
  switch (code) {
    case 'NEED_KEY':
      return 'ยังไม่ได้ใส่กุญแจ AI (Gemini key) ไปที่ตั้งค่า › กุญแจ AI ก่อนนะคะ';
    case 'KEY_INVALID':
    case 'GEMINI_KEY_INVALID':
      return 'กุญแจ AI ใช้ไม่ได้แล้ว ลองสร้างกุญแจใหม่ที่ aistudio.google.com แล้วใส่ในตั้งค่านะคะ';
    case 'BUSY':
      return 'ตอนนี้ AI ฟรีมีคนใช้เยอะ รอสักครู่แล้วลองใหม่นะคะ';
    case 'RATE':
      return 'ใช้ AI ถี่ไปนิด รอประมาณ 1 นาทีแล้วลองใหม่นะคะ';
    case 'BAD_INPUT':
      return 'AI ไม่เข้าใจข้อมูลรอบนี้ ลองพูดหรือพิมพ์ใหม่อีกครั้งนะคะ';
    case 'QUOTA':
      return 'AI ฟรีวันนี้ครบโควตาแล้ว (รีเซ็ตประมาณบ่าย 2–3 โมง) ระหว่างนี้ฝึก Night Review ได้นะคะ';
    case 'LOGIN_REQUIRED':
      return 'กรุณาเข้าสู่ระบบอีกครั้ง';
    default:
      return navigator.onLine ? 'มีปัญหาในการเชื่อมต่อ AI ลองใหม่อีกครั้งนะคะ' : 'ไม่มีอินเทอร์เน็ต';
  }
}

/** Learner details sent with every coach call (the server builds the prompt frame from them). */
export type Learner = { name: string; job: string; company: string };
let learner: Learner = { name: '', job: '', company: '' };
export const setLearner = (l: Learner) => (learner = l);

/** True when a call can go out without any prompt (for background checks). */
export const canCallQuietly = () => true;

export async function api<T>(fn: 'coach' | 'live-token', body: object): Promise<T> {
  // A stalled mobile connection must not leave a screen spinning forever.
  const timeoutMs = fn === 'live-token' ? 15_000 : 35_000;
  let res: Response;
  try {
    res = await fetch(`/api/${fn}`, {
      signal: AbortSignal.timeout?.(timeoutMs),
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    if ((e as Error)?.name === 'TimeoutError' || (e as Error)?.name === 'AbortError') throw new ApiError('BUSY', 0);
    throw e;
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(data.error || 'SERVER', res.status);
  return data as T;
}

export const coach = <T>(action: string, body: object) => api<T>('coach', { action, learner, ...body });

/** Settings › กุญแจ AI: the server checks the key with Google before keeping it. */
export async function saveGeminiKey(key: string): Promise<void> {
  const r = await fetch('/api/key', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key }) });
  if (!r.ok) throw new ApiError(((await r.json().catch(() => ({}))) as { error?: string }).error || 'SERVER', r.status);
}
export async function removeGeminiKey(): Promise<void> {
  await fetch('/api/key', { method: 'DELETE' });
}
