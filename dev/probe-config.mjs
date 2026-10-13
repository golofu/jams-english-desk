// Dev probe: which generation-config knob makes a model return 400?
import { readFileSync } from 'node:fs';
import { GoogleGenAI } from '@google/genai';
const key = /GEMINI_API_KEY=(.*)/.exec(readFileSync('.env.local', 'utf8'))[1].trim();
const ai = new GoogleGenAI({ apiKey: key });
const schema = { type: 'object', properties: { th: { type: 'array', items: { type: 'string' } } }, required: ['th'] };
const base = { responseMimeType: 'application/json', responseJsonSchema: schema, temperature: 0.4 };
const variants = {
  base,
  maxTokens: { ...base, maxOutputTokens: 2048 },
  budget0: { ...base, thinkingConfig: { thinkingBudget: 0 } },
  levelMinimal: { ...base, thinkingConfig: { thinkingLevel: 'MINIMAL' } },
};
for (const model of ['gemini-3.5-flash-lite', 'gemini-3.6-flash']) {
  for (const [name, config] of Object.entries(variants)) {
    try {
      const r = await ai.models.generateContent({ model, contents: 'Translate to Thai: ["Good morning"]', config });
      console.log(model, name, 'OK', r.text?.slice(0, 40));
    } catch (e) {
      console.log(model, name, 'FAIL', e.status, String(e.message).slice(0, 90));
    }
  }
}
