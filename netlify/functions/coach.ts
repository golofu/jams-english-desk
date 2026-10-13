import { ThinkingLevel } from '@google/genai';
import { LITE_MODEL, TEXT_MODEL, HttpError, gemini, handle, json, requireUser, statusOf } from './_shared/common.js';

/**
 * Text-model helpers. One endpoint, `action` picks the job:
 *  help      – Jam is stuck: Thai (speech or text) -> one simple English line to say
 *  translate – English subtitle lines -> Thai
 *  evaluate  – role-play transcript -> stars + review cards
 *  prep      – "ซ้อมก่อนเจอจริง": Thai description of tomorrow -> custom scenario
 *  turn      – fallback conversation when the Live quota is out: audio in, text reply out
 */

type Audio = { data: string; mimeType: string };
type Line = { who: 'jam' | 'ai'; text: string };

const LEARNER = `The learner is Jam, a Thai executive secretary to the CEO of GoDigit. Her English is beginner level (about A1-A2) and she lacks confidence. Use short, simple, natural, polite workplace English. Thai must be natural everyday Thai.`;

const PRIVACY = `Never ask for or repeat real names of real clients, phone numbers or confidential business details; use generic placeholders.`;

// Free-tier models sometimes answer 503 "high demand" or 429, and preview models get
// retired (404); each model has its own quota, so step down the list instead of failing.
const FALLBACKS = ['gemini-3.5-flash-lite', 'gemini-3.8-flash'];
// Netlify cuts synchronous functions off at ~10 s; stop trying fallbacks before that.
const BUDGET_MS = 9_000;

function retryable(e: unknown): boolean {
  const st = statusOf(e);
  // 400 too: a config one model rejects shouldn't sink the request when another model accepts it.
  if (st !== undefined) return [400, 404, 429, 500, 502, 503, 504].includes(st);
  return e instanceof SyntaxError || (e instanceof Error && /abort|timeout/i.test(e.message));
}

async function generate(prompt: string, schema: object, audio?: Audio, model = TEXT_MODEL) {
  const ai = gemini();
  const parts: { text?: string; inlineData?: Audio }[] = [{ text: `${prompt}\n(Jam's name in Thai is "แจม".)` }];
  if (audio) parts.push({ inlineData: audio });
  const models = [model, ...FALLBACKS.filter((m) => m !== model)];
  const deadline = Date.now() + BUDGET_MS;
  let last: unknown;
  let sawQuota = false;
  for (const m of models) {
    const remaining = deadline - Date.now();
    if (remaining < 1_500) break;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), remaining);
    try {
      const res = await ai.models.generateContent({
        model: m,
        contents: [{ role: 'user', parts }],
        config: {
          responseMimeType: 'application/json',
          responseJsonSchema: schema,
          temperature: 0.4,
          maxOutputTokens: 2048,
          // Short structured answers don't need long reasoning, and it keeps us inside the time budget.
          // (thinkingLevel, not thinkingBudget: 0 — flash-lite rejects a zero budget with 400.)
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          abortSignal: ctl.signal,
        },
      });
      const text = res.text;
      if (!text) throw new SyntaxError('EMPTY');
      return JSON.parse(text);
    } catch (e) {
      last = e;
      if (statusOf(e) === 429) sawQuota = true;
      if (!retryable(e)) throw e;
      console.warn(`[coach] ${m} failed (${statusOf(e) ?? (e as Error).message}), trying next model`);
    } finally {
      clearTimeout(timer);
    }
  }
  if (sawQuota) throw new HttpError(429, 'QUOTA');
  if (last === undefined || statusOf(last) === undefined) throw new HttpError(503, 'BUSY');
  throw last;
}

// ---------- input limits: this endpoint must not become a free general-purpose LLM ----------
const cap = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : '');
const AUDIO_TYPES = ['audio/wav', 'audio/pcm;rate=16000'];
function lineList(v: unknown, max: number): Line[] {
  return (Array.isArray(v) ? v : []).slice(-max).map((l) => ({ who: l?.who === 'jam' ? 'jam' : 'ai', text: cap(l?.text, 500) }));
}

const str = { type: 'string' };
const phrase = { type: 'object', properties: { en: str, th: str }, required: ['en', 'th'] };

type Body = Record<string, any>;
const actions: Record<string, (b: Body, audio?: Audio) => Promise<unknown>> = {
  async help(b, audio) {
    return generate(
      `${LEARNER}
Jam is in the middle of an English role-play and got stuck. She expressed what she wants to say in Thai (${audio ? 'see the attached audio' : `text: "${cap(b.text, 400)}"`}).
Conversation context: ${cap(b.context, 1500) || 'general workplace conversation'}.
Give ONE short English sentence (max 14 words) she can say right now, its Thai meaning, a Thai pronunciation guide written in Thai script for the tricky words, and heard = what you understood she said (Thai).`,
      {
        type: 'object',
        properties: { en: str, th: str, sayIt: str, heard: str },
        required: ['en', 'th', 'sayIt', 'heard'],
      },
      audio,
    );
  },

  async translate(b) {
    const items = (Array.isArray(b.lines) ? b.lines : []).slice(0, 20).map((l: unknown) => cap(l, 600));
    if (!items.length) return { th: [] };
    return generate(
      `Translate each English line into natural, easy Thai for a beginner learner. Keep the same order and count.\n${JSON.stringify(items)}`,
      { type: 'object', properties: { th: { type: 'array', items: str } }, required: ['th'] },
      undefined,
      LITE_MODEL,
    );
  },

  async evaluate(b) {
    const transcript = lineList(b.transcript, 80).map((l) => `${l.who === 'jam' ? 'JAM' : 'PARTNER'}: ${l.text}`).join('\n');
    const sc = b.scenario ?? {};
    const scenario = { title: cap(sc.titleEn, 200), goal: cap(sc.goalEn, 500), tasks: (Array.isArray(sc.tasks) ? sc.tasks : []).slice(0, 6).map((t: unknown) => cap(t, 200)) };
    return generate(
      `${LEARNER}
You are Jimmy, Jam's warm 50-year-old coach. Review this role-play kindly. Be encouraging: beginners quit when they feel judged.
Scenario: ${JSON.stringify(scenario)}
She pressed the "I'm stuck" (Thai help) button ${Number(b.helpCount) || 0} times.
Transcript (speech-to-text, may contain recognition errors — be lenient about spelling):
${transcript || '(empty)'}

Give 1-3 stars for each:
- task: did she complete the scenario tasks?
- listening: did she understand and answer what was asked?
- fluency: could she keep talking (few help presses, not one-word answers)?
If the transcript is nearly empty give 1 star each and an encouraging note.
good: up to 3 things she said well (quote her words, Thai praise).
better: up to 3 of her sentences rewritten more naturally (said = her words, better = improved, th = Thai meaning, why = short Thai reason).
words: 5 useful words/phrases from this scenario with Thai meaning.
noteTh: 1-2 warm sentences from Jimmy in Thai. noteEn: one short simple English sentence from Jimmy.
memory: one English sentence summarizing what she practiced and what to work on next (Jimmy will read this tomorrow).`,
      {
        type: 'object',
        properties: {
          stars: {
            type: 'object',
            properties: { task: { type: 'integer' }, listening: { type: 'integer' }, fluency: { type: 'integer' } },
            required: ['task', 'listening', 'fluency'],
          },
          good: { type: 'array', items: { type: 'object', properties: { en: str, th: str }, required: ['en', 'th'] } },
          better: {
            type: 'array',
            items: { type: 'object', properties: { said: str, better: str, th: str, why: str }, required: ['said', 'better', 'th', 'why'] },
          },
          words: { type: 'array', items: phrase },
          noteTh: str,
          noteEn: str,
          memory: str,
        },
        required: ['stars', 'good', 'better', 'words', 'noteTh', 'noteEn', 'memory'],
      },
    );
  },

  async prep(b, audio) {
    return generate(
      `${LEARNER}
Jam described (in Thai) a real situation she will face soon at work: ${audio ? 'see the attached audio' : `"${cap(b.text, 800)}"`}.
${PRIVACY}
Design a short practice role-play for it. If the description is not a workplace situation, design a polite small-talk scene instead.
character: pick the best partner id: "sarah" (a visitor/guest, friendly), "tanaka" (Japanese client, polite), "ben" (hotel/airline/restaurant staff).
partnerRole: who the partner is in this scene (English, one line). opening: the partner's first line (simple English).
keyPhrases: exactly 5 sentences Jam will need, simple English + Thai.
tasks: 2-4 short English checklist items for Jam to accomplish.`,
      {
        type: 'object',
        properties: {
          titleTh: str,
          titleEn: str,
          situationTh: str,
          goalEn: str,
          character: { type: 'string', enum: ['sarah', 'tanaka', 'ben'] },
          partnerRole: str,
          opening: str,
          tasks: { type: 'array', items: str },
          keyPhrases: { type: 'array', items: phrase },
        },
        required: ['titleTh', 'titleEn', 'situationTh', 'goalEn', 'character', 'partnerRole', 'opening', 'tasks', 'keyPhrases'],
      },
      audio,
    );
  },

  async turn(b, audio) {
    const history = lineList(b.history, 16).map((l) => `${l.who === 'jam' ? 'JAM' : 'YOU'}: ${l.text}`).join('\n');
    // The client describes the scene, but the server owns the frame around it.
    return generate(
      `You are a spoken role-play partner in an English-practice app for a beginner learner (Jam).
Only ever take part in the workplace / small-talk scene below. If asked for anything else (essays, code, poems, facts, translations of documents, etc.), stay in character and gently steer back to the scene.
--- Scene (from the app) ---
${cap(b.system, 4000)}
--- End scene ---

Conversation so far:
${history || '(start of conversation — you speak first)'}

${audio ? "Jam's new turn is the attached audio. Transcribe it as heard, then reply." : b.text ? `Jam says: "${cap(b.text, 400)}"` : 'Start the conversation.'}
Reply in character with 1-2 short spoken sentences.`,
      { type: 'object', properties: { heard: str, reply: str }, required: ['heard', 'reply'] },
      audio,
    );
  },
};

export default handle(async (req) => {
  await requireUser(req);
  const body = await req.json().catch(() => null);
  if (!body || typeof body.action !== 'string' || !Object.hasOwn(actions, body.action)) return json({ error: 'BAD_ACTION' }, 400);
  let audio: Audio | undefined;
  if (body.audio) {
    const { data, mimeType } = body.audio;
    if (typeof data !== 'string' || !AUDIO_TYPES.includes(mimeType)) return json({ error: 'BAD_AUDIO' }, 400);
    if (data.length > 2_800_000) return json({ error: 'AUDIO_TOO_LARGE' }, 413); // ≈ 60 s of 16 kHz WAV
    audio = { data, mimeType };
  }
  return json(await actions[body.action](body, audio));
});
