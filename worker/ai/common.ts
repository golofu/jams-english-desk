import { GoogleGenAI } from '@google/genai';

export const LIVE_MODEL = process.env.GEMINI_LIVE_MODEL || 'gemini-3.8-live';
export const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-3.6-flash';
// Subtitles are the most frequent call; a lite model has its own free quota bucket.
export const LITE_MODEL = process.env.GEMINI_LITE_MODEL || 'gemini-3.5-flash-lite';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

/**
 * Who is asking, and which Gemini key pays for it. Every signed-in user brings their own free
 * key (user_keys); the emails in SPONSORED_EMAILS use the app's shared GEMINI_API_KEY instead.
 */
export type Caller = { userId: string; email: string; geminiKey: string | null };

/** Learner details the client sends with every AI job (kept short; the server owns the frame). */
export type Learner = { name: string; job: string; company: string };
export function learnerOf(b: Record<string, unknown> | null | undefined): Learner {
  const cap = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
  const l = (b?.learner ?? {}) as Record<string, unknown>;
  return { name: cap(l.name, 40) || 'the learner', job: cap(l.job, 80), company: cap(l.company, 80) };
}

export function gemini(caller: Caller, apiVersion?: string): GoogleGenAI {
  if (!caller.geminiKey) throw new HttpError(403, 'NEED_KEY');
  return new GoogleGenAI({ apiKey: caller.geminiKey, httpOptions: { timeout: 30_000, ...(apiVersion ? { apiVersion } : {}) } });
}

/** HTTP status of an SDK/Gemini error, if any. */
export function statusOf(e: unknown): number | undefined {
  const s = (e as { status?: unknown })?.status;
  return typeof s === 'number' ? s : undefined;
}

export function handle(fn: (req: Request, caller: Caller) => Promise<Response>) {
  return async (req: Request, caller: Caller): Promise<Response> => {
    try {
      if (req.method !== 'POST') return json({ error: 'METHOD' }, 405);
      const len = Number(req.headers.get('content-length') || 0);
      if (len > 4_000_000) return json({ error: 'TOO_LARGE' }, 413);
      return await fn(req, caller);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      if (statusOf(e) === 429) return json({ error: 'QUOTA' }, 429);
      console.error(e); // details stay in the server log
      return json({ error: 'SERVER' }, 500);
    }
  };
}
