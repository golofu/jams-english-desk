// Cloudflare Worker: Google login, per-user data sync (D1), voice snapshots (R2), each user's own
// Gemini key, and the AI endpoints (worker/ai). Static files come from dist/ (wrangler `assets`).
import coach from './ai/coach.js';
import liveToken from './ai/live-token.js';
import { HttpError, json, type Caller } from './ai/common.js';

export interface Env {
  DB: D1Database;
  SNAPSHOTS: R2Bucket;
  APP_BASE_URL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  /** 32 random bytes, base64: encrypts stored Gemini keys at rest. */
  KEY_SECRET: string;
  /** Comma-separated emails that use the app's shared GEMINI_API_KEY instead of their own. */
  SPONSORED_EMAILS?: string;
  GEMINI_API_KEY?: string;
}

const SESSION_COOKIE = 'sid';
const STATE_COOKIE = 'oauth_state';
const SESSION_DAYS = 180;
const DATA_KEYS = ['profile', 'sessions', 'phrases', 'snapshots'];

// ---------- small helpers ----------
const enc = new TextEncoder();
const b64 = (bytes: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
const sha256 = async (s: string) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
const randomHex = (n = 32) => hex(crypto.getRandomValues(new Uint8Array(n)).buffer);

function cookie(req: Request, name: string): string | null {
  const m = (req.headers.get('cookie') || '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}
// The state cookie must survive the redirect back from Google, so Lax, not Strict.
const setCookie = (name: string, value: string, maxAge: number) =>
  `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
function redirect(to: string, cookies: string[] = []): Response {
  const h = new Headers({ location: to, 'cache-control': 'no-store' });
  for (const c of cookies) h.append('set-cookie', c);
  return new Response(null, { status: 302, headers: h });
}

// ---------- Gemini key at rest (AES-GCM with KEY_SECRET) ----------
async function aesKey(env: Env) {
  return crypto.subtle.importKey('raw', unb64(env.KEY_SECRET), 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function seal(env: Env, plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(env), enc.encode(plain));
  return `${b64(iv)}.${b64(ct)}`;
}
async function open(env: Env, sealed: string): Promise<string> {
  const [iv, ct] = sealed.split('.');
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, await aesKey(env), unb64(ct));
  return new TextDecoder().decode(pt);
}

/** A Gemini key works when it can list models (free, no quota spent). */
async function keyWorks(key: string): Promise<boolean> {
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', {
    headers: { 'x-goog-api-key': key },
    signal: AbortSignal.timeout(10_000),
  });
  return r.ok;
}

// ---------- users & sessions ----------
type User = { id: string; email: string; name: string; picture: string; sealed_key: string | null };

async function userFromRequest(req: Request, env: Env): Promise<User | null> {
  const token = cookie(req, SESSION_COOKIE);
  if (!token) return null;
  const row = await env.DB.prepare(
    `select u.id, u.email, u.name, u.picture, k.sealed_key
       from sessions s join users u on u.id = s.user_id
       left join user_keys k on k.user_id = u.id
      where s.token_hash = ?1 and s.expires_at > ?2`,
  )
    .bind(await sha256(token), Date.now())
    .first<User>();
  return row ?? null;
}

const sponsored = (env: Env, email: string) =>
  (env.SPONSORED_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());

async function callerOf(env: Env, u: User): Promise<Caller> {
  const geminiKey = sponsored(env, u.email) ? env.GEMINI_API_KEY || null : u.sealed_key ? await open(env, u.sealed_key) : null;
  return { userId: u.id, email: u.email, geminiKey };
}

// ---------- Google OAuth (authorization code flow) ----------
const redirectUri = (env: Env) => `${env.APP_BASE_URL}/auth/google/callback`;

function authStart(env: Env): Response {
  const state = randomHex(16);
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  u.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
  u.searchParams.set('redirect_uri', redirectUri(env));
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', 'openid email profile');
  u.searchParams.set('state', state);
  u.searchParams.set('prompt', 'select_account');
  return redirect(u.toString(), [setCookie(STATE_COOKIE, state, 600)]);
}

async function authCallback(req: Request, env: Env): Promise<Response> {
  const q = new URL(req.url).searchParams;
  const fail = (code: string) => redirect(`/?login_error=${code}`, [setCookie(STATE_COOKIE, '', 0)]);
  if (q.get('error')) return fail(q.get('error') === 'access_denied' ? 'cancelled' : 'google');
  const code = q.get('code');
  const state = q.get('state');
  if (!code || !state || state !== cookie(req, STATE_COOKIE)) return fail('state');

  const tok = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri(env),
      grant_type: 'authorization_code',
    }),
  });
  if (!tok.ok) return fail('exchange');
  const { access_token } = (await tok.json()) as { access_token?: string };
  if (!access_token) return fail('exchange');
  const info = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { authorization: `Bearer ${access_token}` } });
  if (!info.ok) return fail('userinfo');
  const me = (await info.json()) as { sub: string; email?: string; email_verified?: boolean; name?: string; picture?: string };
  if (!me.email || me.email_verified === false) return fail('email');

  const id = `g_${me.sub}`;
  const now = Date.now();
  await env.DB.prepare(
    `insert into users (id, email, name, picture, created_at, last_login_at) values (?1, ?2, ?3, ?4, ?5, ?5)
     on conflict (id) do update set email = excluded.email, name = excluded.name, picture = excluded.picture, last_login_at = excluded.last_login_at`,
  )
    .bind(id, me.email.toLowerCase(), me.name ?? '', me.picture ?? '', now)
    .run();
  const token = randomHex(32);
  const ttl = SESSION_DAYS * 86_400;
  await env.DB.prepare('insert into sessions (token_hash, user_id, created_at, expires_at) values (?1, ?2, ?3, ?4)')
    .bind(await sha256(token), id, now, now + ttl * 1000)
    .run();
  return redirect('/', [setCookie(SESSION_COOKIE, token, ttl), setCookie(STATE_COOKIE, '', 0)]);
}

async function logout(req: Request, env: Env): Promise<Response> {
  const token = cookie(req, SESSION_COOKIE);
  if (token) await env.DB.prepare('delete from sessions where token_hash = ?1').bind(await sha256(token)).run();
  const h = new Headers({ 'set-cookie': setCookie(SESSION_COOKIE, '', 0) });
  return new Response(null, { status: 204, headers: h });
}

// ---------- signed-in API ----------
async function userApi(req: Request, env: Env, path: string, u: User): Promise<Response> {
  const m = req.method;
  if (path === '/api/me' && m === 'GET') {
    const isSponsored = sponsored(env, u.email);
    return json({ id: u.id, email: u.email, name: u.name, picture: u.picture, hasKey: isSponsored ? !!env.GEMINI_API_KEY : !!u.sealed_key, sponsored: isSponsored });
  }

  // One JSON document per key (profile, sessions, phrases, snapshots). The client merges before
  // writing, and sends `base` (the version it read) so a stale tab can't overwrite another device.
  if (path === '/api/state' && m === 'GET') {
    const { results } = await env.DB.prepare('select key, value, updated_at from app_state where user_id = ?1').bind(u.id).all<{ key: string; value: string; updated_at: number }>();
    return json(Object.fromEntries(results.map((r) => [r.key, { value: JSON.parse(r.value), version: r.updated_at }])));
  }
  const sk = path.match(/^\/api\/state\/(\w+)$/);
  if (sk && DATA_KEYS.includes(sk[1])) {
    const key = sk[1];
    if (m === 'GET') {
      const r = await env.DB.prepare('select value, updated_at from app_state where user_id = ?1 and key = ?2').bind(u.id, key).first<{ value: string; updated_at: number }>();
      return json(r ? { value: JSON.parse(r.value), version: r.updated_at } : { value: null, version: 0 });
    }
    if (m === 'PUT') {
      const body = (await req.json().catch(() => null)) as { value?: unknown; base?: number } | null;
      if (!body || body.value === undefined) return json({ error: 'BAD_INPUT' }, 400);
      const text = JSON.stringify(body.value);
      if (text.length > 2_000_000) return json({ error: 'TOO_LARGE' }, 413);
      const version = Date.now();
      // Optimistic write: only when the row is still the version the client merged against.
      const r = await env.DB.prepare(
        `insert into app_state (user_id, key, value, updated_at) values (?1, ?2, ?3, ?4)
         on conflict (user_id, key) do update set value = excluded.value, updated_at = excluded.updated_at
         where app_state.updated_at = ?5`,
      )
        .bind(u.id, key, text, version, body.base ?? 0)
        .run();
      if (!r.meta.changes) {
        const cur = await env.DB.prepare('select value, updated_at from app_state where user_id = ?1 and key = ?2').bind(u.id, key).first<{ value: string; updated_at: number }>();
        return json({ error: 'CONFLICT', value: cur ? JSON.parse(cur.value) : null, version: cur?.updated_at ?? 0 }, 409);
      }
      return json({ version });
    }
  }

  if (path === '/api/key') {
    if (m === 'PUT') {
      const body = (await req.json().catch(() => null)) as { key?: string } | null;
      const key = body?.key?.trim() ?? '';
      if (!/^[A-Za-z0-9._-]{20,200}$/.test(key)) return json({ error: 'KEY_INVALID' }, 400);
      if (!(await keyWorks(key))) return json({ error: 'KEY_INVALID' }, 400);
      await env.DB.prepare('insert into user_keys (user_id, sealed_key, updated_at) values (?1, ?2, ?3) on conflict (user_id) do update set sealed_key = excluded.sealed_key, updated_at = excluded.updated_at')
        .bind(u.id, await seal(env, key), Date.now())
        .run();
      return json({ ok: true });
    }
    if (m === 'DELETE') {
      await env.DB.prepare('delete from user_keys where user_id = ?1').bind(u.id).run();
      return json({ ok: true });
    }
  }

  // Voice snapshots: one audio object per recording, under the user's own prefix.
  const sn = path.match(/^\/api\/snapshots\/([\w-]{1,80})$/);
  if (sn) {
    const objKey = `snap/${u.id}/${sn[1]}`;
    if (m === 'PUT') {
      const type = (req.headers.get('content-type') || '').split(';')[0];
      if (!['audio/webm', 'audio/mp4', 'audio/ogg'].includes(type)) return json({ error: 'BAD_AUDIO' }, 400);
      if (Number(req.headers.get('content-length') || 0) > 20 * 1024 * 1024) return json({ error: 'TOO_LARGE' }, 413);
      await env.SNAPSHOTS.put(objKey, req.body, { httpMetadata: { contentType: type } });
      return json({ ok: true });
    }
    if (m === 'GET') {
      const obj = await env.SNAPSHOTS.get(objKey);
      if (!obj) return json({ error: 'NOT_FOUND' }, 404);
      return new Response(obj.body, { headers: { 'content-type': obj.httpMetadata?.contentType || 'audio/webm', 'cache-control': 'private, max-age=86400' } });
    }
  }

  if (path === '/api/coach' && m === 'POST') return coach(req, await callerOf(env, u));
  if (path === '/api/live-token' && m === 'POST') return liveToken(req, await callerOf(env, u));
  return json({ error: 'NOT_FOUND' }, 404);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(req.url);
    try {
      if (pathname === '/auth/google/start') return authStart(env);
      if (pathname === '/auth/google/callback') return authCallback(req, env);
      if (pathname === '/auth/logout' && req.method === 'POST') return logout(req, env);
      if (pathname === '/health') return json({ ok: true });
      if (pathname.startsWith('/api/')) {
        const u = await userFromRequest(req, env);
        if (!u) return json({ error: 'LOGIN_REQUIRED' }, 401);
        return await userApi(req, env, pathname, u);
      }
      return json({ error: 'NOT_FOUND' }, 404);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: 'SERVER' }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
