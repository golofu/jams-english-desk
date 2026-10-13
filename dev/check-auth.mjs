// Dev check: requireUser() is closed by default outside local dev.
import { createServer } from 'vite';
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', configFile: false, logLevel: 'silent' });
const { requireUser } = await vite.ssrLoadModule('/netlify/functions/_shared/common.ts');
const KEYS = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'ALLOW_OPEN_DEV', 'ALLOWED_EMAIL', 'APP_PASSCODE'];
async function run(label, env, headers = {}) {
  KEYS.forEach((k) => delete process.env[k]);
  Object.assign(process.env, env);
  try { await requireUser(new Request('http://x', { method: 'POST', headers })); console.log(label, '→ allowed'); }
  catch (e) { console.log(label, '→', e.status, e.message); }
}
await run('nothing configured', {});
await run('dev flag', { ALLOW_OPEN_DEV: '1' });
const P = 'abcdefghjk234567xyz'; // 16+ chars, like a real passcode
await run('passcode too short', { APP_PASSCODE: 'abc' }, { 'x-app-passcode': 'abc' });
await run('passcode, none sent', { APP_PASSCODE: P });
await run('passcode, wrong', { APP_PASSCODE: P }, { 'x-app-passcode': 'nope' });
await run('passcode, right', { APP_PASSCODE: P }, { 'x-app-passcode': P });
await run('passcode, env has trailing newline', { APP_PASSCODE: `${P}
` }, { 'x-app-passcode': P });
await run('supabase, empty allowlist', { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'k' });
await run('supabase, allowlist, no token', { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'k', ALLOWED_EMAIL: 'jam@example.com' });
await vite.close();
