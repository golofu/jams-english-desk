// Dev probe: every coach action (text input) against the dev server or production. Usage: PASS=... node dev/probe-coach.mjs [baseUrl]
const base = process.argv[2] || 'http://localhost:5174';
const headers = { 'content-type': 'application/json', ...(process.env.PASS ? { 'x-app-passcode': process.env.PASS } : {}) };
const post = async (body) => {
  const t = Date.now();
  const r = await fetch(`${base}/api/coach`, { method: 'POST', headers, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  console.log(`${body.action.padEnd(9)} ${r.status} ${Date.now() - t}ms`, JSON.stringify(j).slice(0, 220));
};
await post({ action: 'translate', lines: ['Good morning! Please have a seat.', 'Would you like some coffee?'] });
await post({ action: 'help', text: 'คุณต้องการดื่มกาแฟไหมคะ', context: 'Welcoming a visitor' });
await post({ action: 'turn', system: 'You are Sarah, a visitor at the GoDigit office reception.', history: [], text: 'Hello, welcome to GoDigit.' });
await post({ action: 'evaluate', scenario: { titleEn: 'Welcoming a visitor', goalEn: 'Greet and offer a drink', tasks: ['Greet', 'Offer a drink'] }, transcript: [{ who: 'ai', text: 'Hi, I have a meeting with the CEO.' }, { who: 'jam', text: 'Welcome. Please sit. You want coffee?' }, { who: 'ai', text: 'Yes please.' }, { who: 'jam', text: 'OK wait a moment please.' }], jamTurns: 2, helpCount: 0 });
await post({ action: 'prep', text: 'พรุ่งนี้มีลูกค้าญี่ปุ่นมาพบ CEO ตอนสิบโมง' });
