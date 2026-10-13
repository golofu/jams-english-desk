import { createHash, timingSafeEqual } from 'node:crypto';
import { GoogleGenAI } from '@google/genai';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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

export function gemini(apiVersion?: string): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new HttpError(503, 'NO_GEMINI_KEY');
  return new GoogleGenAI({ apiKey, httpOptions: { timeout: 30_000, ...(apiVersion ? { apiVersion } : {}) } });
}

const digest = (s: string) => createHash('sha256').update(s).digest();
const samePass = (a: string, b: string) => !!a && timingSafeEqual(digest(a), digest(b));

let sb: SupabaseClient | null = null;
function supabaseServer(url: string, anon: string) {
  // One client per function instance; no session storage on the server.
  sb ??= createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  return sb;
}

/**
 * Closed by default: only the signed-in ALLOWED_EMAIL may spend the free Gemini quota.
 * Without Supabase the endpoints work only in local dev (vite sets ALLOW_OPEN_DEV=1),
 * so a Netlify deploy that forgot to configure login can't be used by strangers.
 */
export async function requireUser(req: Request): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) {
    if (process.env.ALLOW_OPEN_DEV === '1') return;
    // Free middle ground before Supabase is set up: a shared app passcode.
    const passcode = process.env.APP_PASSCODE?.trim();
    if (passcode) {
      if (passcode.length < 16) throw new HttpError(503, 'AUTH_NOT_CONFIGURED'); // README: 16+ random chars
      if (samePass(req.headers.get('x-app-passcode')?.trim() ?? '', passcode)) return;
      // Slow down guessing; with a long random passcode this makes brute force pointless.
      if (req.headers.get('x-app-passcode')) await new Promise((r) => setTimeout(r, 1500));
      throw new HttpError(401, 'PASSCODE_REQUIRED');
    }
    throw new HttpError(503, 'AUTH_NOT_CONFIGURED');
  }
  const allowed = (process.env.ALLOWED_EMAIL || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!allowed.length) throw new HttpError(503, 'AUTH_NOT_CONFIGURED'); // Google sign-up is open to anyone

  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'LOGIN_REQUIRED');
  const { data, error } = await supabaseServer(url, anon).auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'LOGIN_REQUIRED');
  // Only a verified Google identity counts: an unconfirmed email/password sign-up could claim Jam's address.
  if (!data.user.email_confirmed_at || data.user.app_metadata?.provider !== 'google') throw new HttpError(403, 'NOT_ALLOWED');
  if (!allowed.includes((data.user.email || '').toLowerCase())) throw new HttpError(403, 'NOT_ALLOWED');
}

/** HTTP status of an SDK/Gemini error, if any. */
export function statusOf(e: unknown): number | undefined {
  const s = (e as { status?: unknown })?.status;
  return typeof s === 'number' ? s : undefined;
}

export function handle(fn: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    try {
      if (req.method !== 'POST') return json({ error: 'METHOD' }, 405);
      const len = Number(req.headers.get('content-length') || 0);
      if (len > 4_000_000) return json({ error: 'TOO_LARGE' }, 413);
      return await fn(req);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      if (statusOf(e) === 429) return json({ error: 'QUOTA' }, 429);
      console.error(e); // details stay in the server log
      return json({ error: 'SERVER' }, 500);
    }
  };
}
