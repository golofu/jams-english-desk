// Side-by-side: the same coach jobs answered by Gemini only vs Groq only.
// Usage: GEMINI_API_KEY=... GROQ_API_KEY=... node dev/compare-providers.mjs <gemini|groq> <out.json>
import { writeFileSync } from 'node:fs';
import { createServer } from 'vite';
const [provider, out] = process.argv.slice(2);
process.env.COACH_PROVIDERS = provider;
process.env.ALLOW_OPEN_DEV = '1';
process.env.VERCEL = '1'; // production time budget (25 s)
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', configFile: false, logLevel: 'silent' });
const { default: coach } = await vite.ssrLoadModule('/netlify/functions/coach.ts');
const sc = { titleEn: 'Welcoming a visitor', goalEn: 'Greet the visitor, offer a drink, tell the CEO', tasks: ['Greet the visitor', 'Offer a drink', 'Say the CEO is coming'] };
const T = (pairs) => pairs.map(([who, text]) => ({ who, text }));
const cases = [
  ['translate', { lines: ["I'm afraid Mr. Somchai is in a meeting right now.", 'Could you let him know I called?', 'No problem, take your time.'] }],
  ['translate', { lines: ["Let's push the meeting to Thursday afternoon.", "I'll send you the agenda by end of day."] }],
  ['help', { text: 'ขอโทษค่ะ ซีอีโอติดประชุมอยู่ รบกวนรอสักครู่ได้ไหมคะ', context: 'Welcoming a visitor' }],
  ['help', { text: 'อยากถามว่าจะรับเป็นกาแฟร้อนหรือเย็นดีคะ', context: 'Offering a drink' }],
  ['help', { text: 'ช่วยสะกดชื่อให้หน่อยได้ไหมคะ', context: 'Taking a phone message' }],
  ['evaluate', { label: 'weak', scenario: sc, jamTurns: 3, helpCount: 4, transcript: T([['ai', "Hi, I'm Sarah. I have a 10 o'clock with your CEO."], ['jam', 'Yes.'], ['ai', 'Should I wait here?'], ['jam', 'Wait... sit.'], ['ai', 'Thank you. Is he coming soon?'], ['jam', 'Coffee?']]) }],
  ['evaluate', { label: 'medium', scenario: sc, jamTurns: 3, helpCount: 1, transcript: T([['ai', "Hi, I'm Sarah. I have a 10 o'clock with your CEO."], ['jam', 'Welcome. Please sit down.'], ['ai', 'Thank you.'], ['jam', 'You want coffee or tea?'], ['ai', 'Tea, please. Is he coming soon?'], ['jam', 'Yes, he come in five minute.']]) }],
  ['evaluate', { label: 'strong', scenario: sc, jamTurns: 3, helpCount: 0, transcript: T([['ai', "Hi, I'm Sarah. I have a 10 o'clock with your CEO."], ['jam', 'Good morning, Ms. Sarah. Welcome to GoDigit. Please have a seat.'], ['ai', 'Thank you.'], ['jam', 'Would you like some coffee or tea?'], ['ai', 'Tea, please. Is he coming soon?'], ['jam', "Yes, he'll be with you in about five minutes. I'll let him know you're here."]]) }],
  ['prep', { text: 'พรุ่งนี้ต้องโทรจองโรงแรมที่สิงคโปร์ให้ซีอีโอ 2 คืน' }],
  ['turn', { system: 'You are Ms. Tanaka, a polite Japanese client calling GoDigit to speak with the CEO.', history: [], text: 'Good morning, GoDigit, this is Jam speaking.' }],
  ['turn', { system: 'You are Ben, a hotel receptionist in Singapore.', history: T([['ai', 'Good afternoon, Marina Hotel, Ben speaking.']]), text: 'Hello. I want book room two night for my boss.' }],
];
const results = [];
for (const [action, body] of cases) {
  let r, j, ms, tries = 0;
  do {
    if (tries) await new Promise((res) => setTimeout(res, 20_000));
    const t = Date.now();
    r = await coach(new Request('http://x/api/coach', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, ...body }) }));
    ms = Date.now() - t;
    j = await r.json();
  } while (provider === 'gemini' && j.error === 'BUSY' && ++tries < 4);
  console.log(provider, action, body.label ?? '', r.status, `${ms}ms`, j.error ?? 'ok');
  results.push({ action, label: body.label, input: body.text ?? body.lines ?? body.transcript?.length, status: r.status, ms, out: j });
}
writeFileSync(out, JSON.stringify(results, null, 1));
await vite.close();
