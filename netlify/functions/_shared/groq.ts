// Groq: a second free AI provider for the text jobs. Its free tier allows ~1,000 requests
// a day per model (Gemini's free text models: ~20), and Whisper turns Jam's speech into
// text so the text models can work with it. OpenAI-compatible REST, so no extra package.
const BASE = 'https://api.groq.com/openai/v1';
export const GROQ_MODELS = (process.env.GROQ_MODELS || 'openai/gpt-oss-120b,openai/gpt-oss-20b').split(',').map((m) => m.trim()).filter(Boolean);
const WHISPER = process.env.GROQ_WHISPER_MODEL || 'whisper-large-v3';

export const hasGroq = () => !!process.env.GROQ_API_KEY;

/** Error with an HTTP status, so the caller's retry/quota logic treats both providers alike. */
class GroqError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call(path: string, init: RequestInit, signal: AbortSignal): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    signal,
    headers: { authorization: `Bearer ${process.env.GROQ_API_KEY}`, ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) {
    // Groq's 429 body says which limit was hit (requests/tokens per minute or per day).
    const perDay = /per day|RPD|TPD|ASD/i.test(text);
    throw new GroqError(res.status, `groq ${res.status}${res.status === 429 ? (perDay ? ' PerDay' : ' PerMinute') : ''}: ${text.slice(0, 200)}`);
  }
  return JSON.parse(text);
}

/** Speech → text. lang: 'th' for Jam's Thai (help, prep), 'en' for her English turns. */
export async function transcribe(wavB64: string, lang: 'th' | 'en', signal: AbortSignal): Promise<string> {
  const form = new FormData();
  form.append('file', new Blob([Buffer.from(wavB64, 'base64')], { type: 'audio/wav' }), 'speech.wav');
  form.append('model', WHISPER);
  form.append('language', lang);
  form.append('response_format', 'json');
  form.append('temperature', '0');
  const r = await call('/audio/transcriptions', { method: 'POST', body: form }, signal);
  return String(r?.text ?? '').trim();
}

/** One structured (JSON-schema) answer from a Groq chat model. */
export async function groqJson(model: string, prompt: string, schema: object, signal: AbortSignal): Promise<unknown> {
  const r = await call(
    '/chat/completions',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        // Best-effort schema (strict mode would need additionalProperties:false everywhere).
        response_format: { type: 'json_schema', json_schema: { name: 'answer', strict: false, schema } },
        temperature: 0.4,
        max_completion_tokens: 6000,
        // gpt-oss reasons before answering; short structured jobs don't need much of it.
        ...(model.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low' } : {}),
      }),
    },
    signal,
  );
  const text = r?.choices?.[0]?.message?.content;
  if (!text) throw new SyntaxError('EMPTY');
  return JSON.parse(text);
}
