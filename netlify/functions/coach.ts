import { ThinkingLevel } from '@google/genai';
import { LITE_MODEL, TEXT_MODEL, HttpError, gemini, handle, json, requireUser, statusOf } from './_shared/common.js';
import { GROQ_MODELS, groqJson, hasGroq, transcribe } from './_shared/groq.js';

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
// Free tier is ~20 requests/day per model, so more models = more daily headroom.
// Order matters: subtitles (the most frequent call) get their own short list below so they
// can't use up the buckets the end-of-call review needs.
const FALLBACKS = ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.7-flash'];
const SUBTITLE_MODELS = [LITE_MODEL, 'gemini-3.7-flash'];
// Models differ on the lowest thinking level they accept (3.8-flash rejects MINIMAL with 400).
// Start at MINIMAL and remember per instance which models need LOW.
const needsLow = new Set<string>(['gemini-3.8-flash']);
const thinkingRejected = (e: unknown) => statusOf(e) === 400 && /thinking level/i.test((e as Error)?.message ?? '');
// Netlify cuts synchronous functions off at ~10 s; Vercel allows 30 s (vercel.json maxDuration).
const BUDGET_MS = process.env.VERCEL ? 25_000 : 9_000;

function retryable(e: unknown): boolean {
  const st = statusOf(e);
  // 400 too: a config one model rejects shouldn't sink the request when another model accepts it
  // (but generate() stops after two 400s — then it's the request itself that is bad).
  if (st !== undefined) return [400, 404, 429, 500, 502, 503, 504].includes(st);
  return e instanceof SyntaxError || (e instanceof Error && /abort|timeout/i.test(e.message));
}

const isDailyQuota = (e: unknown) => /PerDay/i.test((e as Error)?.message ?? '');

type Plan = {
  /** Gemini model, or an exact list (subtitles use their own short list). */
  gemini?: string | string[];
  /** Try Groq before Gemini: frequent / latency-sensitive jobs, where Gemini's ~20/day runs out. */
  groqFirst?: boolean;
  /** Language of Jam's attached speech, for Whisper when Groq handles it. */
  lang?: 'th' | 'en';
};
type Candidate = { provider: 'gemini' | 'groq'; model: string };
const exhaustedUntil = new Map<string, number>();

async function generate(prompt: string, schema: object, audio?: Audio, plan: Plan = {}) {
  const fullPrompt = `${prompt}\n(Jam's name in Thai is "แจม".)`;
  const g = plan.gemini ?? TEXT_MODEL;
  const geminiList: Candidate[] = (Array.isArray(g) ? g : [g, ...FALLBACKS.filter((m) => m !== g)]).map((model) => ({ provider: 'gemini', model }));
  const groqList: Candidate[] = hasGroq() ? GROQ_MODELS.map((model) => ({ provider: 'groq', model })) : [];
  // Gemini-first jobs still reach Groq quickly: two Gemini tries, then Groq, then the rest.
  // Models that said "daily quota used up" are skipped for an hour (per warm instance).
  const live = (c: Candidate) => (exhaustedUntil.get(`${c.provider}:${c.model}`) ?? 0) < Date.now();
  const gem = geminiList.filter(live);
  const grq = groqList.filter(live);
  const models = plan.groqFirst ? [...grq, ...gem] : [...gem.slice(0, 2), ...grq, ...gem.slice(2)];
  const deadline = Date.now() + BUDGET_MS;
  let sawQuota = false;
  let sawRate = false;
  let bad400 = 0;
  let groqOff = false; // bad key, or Whisper unavailable for this request
  let transcript: string | undefined;
  for (let i = 0; i < models.length; i++) {
    const { provider, model: m } = models[i];
    if (provider === 'groq' && groqOff) continue;
    const remaining = deadline - Date.now();
    if (remaining < 1_500) break;
    const ctl = new AbortController();
    // Don't let one slow model eat the whole budget: leave room for a fallback attempt.
    const isLast = i === models.length - 1;
    const timer = setTimeout(() => ctl.abort(), isLast ? remaining : Math.max(4_000, remaining * 0.6));
    try {
      if (provider === 'groq') {
        let p = fullPrompt;
        if (audio) {
          // Groq's text models can't hear: Whisper writes down what Jam said first (once per request).
          transcript ??= await transcribe(audio.data, plan.lang ?? 'en', ctl.signal);
          p += `\n[The attached audio, as ${plan.lang === 'th' ? 'Thai' : 'English'} speech-to-text (may contain recognition errors): "${transcript}"]`;
        }
        return await groqJson(m, p, schema, ctl.signal);
      }
      const parts: { text?: string; inlineData?: Audio }[] = [{ text: fullPrompt }];
      if (audio) parts.push({ inlineData: audio });
      const res = await gemini().models.generateContent({
        model: m,
        contents: [{ role: 'user', parts }],
        config: {
          responseMimeType: 'application/json',
          responseJsonSchema: schema,
          temperature: 0.4,
          maxOutputTokens: 8192, // the Thai review card is long, and thinking tokens count too
          // Short structured answers don't need long reasoning, and it keeps us inside the time budget.
          // (thinkingLevel, not thinkingBudget: 0 — flash-lite rejects a zero budget with 400.)
          thinkingConfig: { thinkingLevel: needsLow.has(m) ? ThinkingLevel.LOW : ThinkingLevel.MINIMAL },
          abortSignal: ctl.signal,
        },
      });
      const text = res.text;
      if (!text) throw new SyntaxError('EMPTY');
      return JSON.parse(text);
    } catch (e) {
      if (provider === 'gemini' && thinkingRejected(e) && !needsLow.has(m)) {
        needsLow.add(m);
        i--; // same model again with LOW
        continue;
      }
      const st = statusOf(e);
      if (st === 429) (isDailyQuota(e) ? (sawQuota = true) : (sawRate = true));
      if (st === 429 && isDailyQuota(e)) exhaustedUntil.set(`${provider}:${m}`, Date.now() + 60 * 60_000);
      if (provider === 'groq') {
        // A broken Groq setup must never block Gemini: just skip to the next provider.
        if (st === 401 || st === 403 || (audio && transcript === undefined)) groqOff = true;
      } else {
        if (st === 401 || st === 403) {
          if (groqList.length && !groqOff) continue; // Groq can still answer
          throw new HttpError(503, 'GEMINI_KEY_INVALID');
        }
        if (st === 400 && ++bad400 >= 2) throw new HttpError(400, 'BAD_INPUT');
        if (!retryable(e)) throw e;
      }
      console.warn(`[coach] ${provider}:${m} failed (${st ?? (e as Error).message}), trying next model`);
    } finally {
      clearTimeout(timer);
    }
  }
  if (sawRate && !sawQuota) throw new HttpError(429, 'RATE'); // per-minute limit: a short wait is enough
  if (sawQuota || !models.length) throw new HttpError(429, 'QUOTA');
  // Every error that got here was retryable (busy, timeout, rejected config): report "busy", not a crash.
  throw new HttpError(503, 'BUSY');
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
      { groqFirst: true, lang: 'th' }, // mid-conversation: speed matters, and it's used often
    );
  },

  async translate(b) {
    const items = (Array.isArray(b.lines) ? b.lines : []).slice(0, 20).map((l: unknown) => cap(l, 600));
    if (!items.length) return { th: [] };
    return generate(
      `Translate each English line into natural, easy Thai for a beginner learner. Keep the same order and count.\n${JSON.stringify(items)}`,
      { type: 'object', properties: { th: { type: 'array', items: str } }, required: ['th'] },
      undefined,
      { gemini: SUBTITLE_MODELS, groqFirst: true }, // the most frequent call by far
    );
  },

  async evaluate(b) {
    const transcript = lineList(b.transcript, 80).map((l) => `${l.who === 'jam' ? 'JAM' : 'PARTNER'}: ${l.text}`).join('\n');
    const sc = b.scenario ?? {};
    const scenario = { title: cap(sc.titleEn, 200), goal: cap(sc.goalEn, 500), tasks: (Array.isArray(sc.tasks) ? sc.tasks : []).slice(0, 6).map((t: unknown) => cap(t, 200)) };
    return generate(
      `${LEARNER}
You are ${cap(b.coachName, 40) || 'Jimmy'}, Jam's warm 50-year-old coach. Review this role-play kindly in your WORDS (beginners quit when they feel judged), but score HONESTLY — the stars decide when she moves up a level.
Scenario: ${JSON.stringify(scenario)}
She spoke ${Number(b.jamTurns) || 0} times and pressed the "I'm stuck" (Thai help) button ${Number(b.helpCount) || 0} times.
Transcript (speech-to-text, may contain recognition errors — be lenient about spelling):
${transcript || '(empty)'}

Give 1-3 stars for each, using these anchors:
- task: 3 = all tasks clearly done; 2 = at least half the tasks done; 1 = fewer.
- listening: 3 = answered every question on topic; 2 = mostly on topic, needed a repeat or two; 1 = often off topic or no answer.
- fluency: 3 = full sentences, ≤1 help press; 2 = short sentences or 2-3 help presses; 1 = mostly single words or 4+ help presses.
If she spoke fewer than 2 times, give 1 star each, and make noteTh/noteEn gently encourage her to answer more next time (do not praise the result).
good: up to 3 things she said well (quote her words, Thai praise).
better: up to 3 of her sentences rewritten more naturally (said = her words, better = improved, th = Thai meaning, why = short Thai reason).
words: 5 useful words/phrases from this scenario with Thai meaning.
noteTh: 1-2 warm sentences from you (the coach) in Thai. noteEn: one short simple English sentence from you.
memory: one English sentence summarizing what she practiced and what to work on next (you will read this tomorrow).`,
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
      { lang: 'th' }, // rare and quality matters: Gemini first, Groq as backup
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
      { groqFirst: true, lang: 'en' }, // backup voice chat: one call per sentence
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
