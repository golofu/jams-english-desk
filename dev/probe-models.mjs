// Dev probe: which free text models answer right now, and how fast. Never prints the key.
import { readFileSync } from 'node:fs';
import { GoogleGenAI } from '@google/genai';
const key = /GEMINI_API_KEY=(.*)/.exec(readFileSync('.env.local', 'utf8'))[1].trim();
const ai = new GoogleGenAI({ apiKey: key, httpOptions: { timeout: 30000 } });
for (const model of process.argv.slice(2)) {
  const t = Date.now();
  try {
    const r = await ai.models.generateContent({ model, contents: 'Reply with the single word: ok' });
    console.log(model, 'OK', Date.now() - t, 'ms', JSON.stringify(r.text?.trim()));
  } catch (e) {
    console.log(model, 'FAIL', Date.now() - t, 'ms', String(e.message).slice(0, 120));
  }
}
