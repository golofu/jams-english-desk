// Dev probe: a long Live call, same settings and mic gate as the app, in real time.
// Jam answers every partner turn (WAVs cycled) 1.5 s after the partner's voice ends; a little of
// the partner's voice leaks back like a phone speaker. Logs, per answer, whether Live heard it,
// plus goAway / close / token usage, to find where a long call stops hearing Jam.
// NUDGE=1 turns on the app's end-of-turn nudge (echoGate.ts makeEndNudge).
// 2026-10-28, 600 s: without → 11 answers, 4 stalled 110–140 s; with → 43 answers, 0 stalls.
// usage: [NUDGE=1] SECONDS=600 node dev/probe-long.mjs <dir with jam*.wav>   (GEMINI_API_KEY or APP_PASSCODE from .env.local)
// One run = one Live session (or more, if it reconnects) on the free daily voice quota.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { GoogleGenAI, Modality } from '@google/genai';
import { liveInputConfig, makeEndNudge, makeGate } from '../src/lib/echoGate.ts';

const dir = process.argv[2];
const wavs = readdirSync(dir).filter((f) => /^jam\d+\.wav$/.test(f)).sort().map((f) => new Int16Array(readFileSync(join(dir, f)).buffer.slice(44)));
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .map((l) => /^([A-Z_]+)="?(.*?)"?$/.exec(l))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);
const SECONDS = Number(process.env.SECONDS || 600);
const CONFIG = process.env.CONFIG || 'app'; // app | fixed
async function token() {
  if (env.GEMINI_API_KEY) return { apiKey: env.GEMINI_API_KEY, model: env.GEMINI_LIVE_MODEL || 'gemini-3.8-live' };
  const r = await fetch(`${process.env.APP_URL || 'https://jams-english-desk.vercel.app'}/api/live-token`, {
    method: 'POST', body: '{}', headers: { 'content-type': 'application/json', 'x-app-passcode': env.APP_PASSCODE },
  });
  if (!r.ok) throw new Error(`live-token ${r.status} ${await r.text()}`);
  const j = await r.json();
  return { apiKey: j.token, model: j.model };
}

const RATE = 16000, CHUNK = 1600, ECHO_DELAY = 0.12, ECHO_GAIN = 0.1, JAM_GAIN = 0.6;
const mic = new Float32Array(RATE * (SECONDS + 30));
let t0 = 0, playEnd = 0, started = false, n = 0, session = null, handle = null;
const now = () => (Date.now() - t0) / 1000;
const log = (...a) => console.log(`[${now().toFixed(1).padStart(6)}s]`, ...a);
const gate = makeGate();
const nudge = makeEndNudge(); // NUDGE=1: the app's end-of-turn nudge
let answers = [], cur = null, out = '', wavIdx = 0;

function onAudio(b64, rate) {
  const b = Buffer.from(b64, 'base64');
  const pcm = new Int16Array(b.buffer, b.byteOffset, b.length >> 1);
  const start = Math.max(now() + 0.03, playEnd);
  playEnd = start + pcm.length / rate;
  const off = Math.round((start + ECHO_DELAY) * RATE), step = rate / RATE;
  for (let i = 0; off + i < mic.length && i * step < pcm.length; i++) mic[off + i] += (pcm[Math.floor(i * step)] / 0x8000) * ECHO_GAIN;
}

function onMessage(m) {
  if (m.goAway) log('GOAWAY timeLeft', m.goAway.timeLeft);
  if (m.sessionResumptionUpdate?.newHandle) handle = m.sessionResumptionUpdate.newHandle;
  if (m.usageMetadata?.totalTokenCount) lastTokens = m.usageMetadata.totalTokenCount;
  const sc = m.serverContent;
  if (!sc) return;
  if (sc.outputTranscription?.text || sc.modelTurn?.parts?.length) started = true;
  if (sc.outputTranscription?.text || sc.modelTurn?.parts?.length || sc.turnComplete) nudge.answered();
  if (sc.inputTranscription?.text) nudge.words();
  if (sc.interrupted) log('INTERRUPTED');
  if (sc.inputTranscription?.text && cur) {
    if (!cur.heard) log(`answer #${cur.i} first words heard (answer ends ${(cur.at + cur.len).toFixed(1)}s)`);
    cur.heard += sc.inputTranscription.text;
  }
  if ((sc.outputTranscription?.text || sc.modelTurn?.parts?.length) && !out && cur) {
    cur.replied = true;
    log(`partner starts replying to #${cur.i}`);
  }
  if (sc.outputTranscription?.text) out += sc.outputTranscription.text;
  for (const p of sc.modelTurn?.parts ?? []) {
    const d = p.inlineData;
    if (d?.data && d.mimeType?.startsWith('audio/')) onAudio(d.data, Number(/rate=(\d+)/.exec(d.mimeType)?.[1] ?? 24000));
  }
  if (sc.turnComplete) {
    if (cur) {
      log(`answer #${cur.i} heard=${JSON.stringify(cur.heard.trim())}`);
      cur = null;
    }
    log(`partner (tokens ${lastTokens}): ${out.trim()}`);
    out = '';
    // Jam answers 1.5 s after the voice ends.
    const at = Math.max(now(), playEnd) + 1.5;
    const say = wavs[wavIdx++ % wavs.length];
    const off = Math.round(at * RATE);
    for (let i = 0; i < say.length && off + i < mic.length; i++) mic[off + i] += (say[i] / 0x8000) * JAM_GAIN;
    cur = { i: answers.length, at, heard: '', len: say.length / RATE };
    answers.push(cur);
    // No reply within 20 s of her answer ending = Live did not take it.
    const mine = cur;
    setTimeout(() => {
      if (cur === mine && !mine.replied) {
        log(`answer #${mine.i} NO REPLY after 20 s, heard=${JSON.stringify(mine.heard.trim())}`);
        mine.stuck = true;
      }
    }, (at - now() + mine.len + 20) * 1000);
  }
}
let lastTokens = 0;

async function connect(resume) {
  const { apiKey, model } = await token();
  const ai = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: 'v1alpha' } });
  const extra = CONFIG === 'fixed' ? { contextWindowCompression: { slidingWindow: {} }, sessionResumption: resume ? { handle } : {} } : {};
  session = await ai.live.connect({
    model,
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } } },
      systemInstruction:
        'You are Jimmy, a warm English coach for Jam, a Thai secretary with beginner English. Speak ONLY English, clearly. Keep every turn to 1-2 short sentences and always end with a simple question about her work day. Start by greeting Jam.',
      outputAudioTranscription: {},
      ...liveInputConfig(),
      ...extra,
    },
    callbacks: {
      onmessage: onMessage,
      onerror: (e) => log('ERROR', e.message),
      onclose: (e) => {
        log('CLOSED', e.code, e.reason);
        session = null;
        if (CONFIG === 'fixed' && now() < SECONDS) connect(true).then(() => log('RESUMED')).catch((x) => log('RESUME FAILED', x.message));
      },
    },
  });
}

await connect(false);
t0 = Date.now();
session.sendRealtimeInput({ text: '(System: Jam has just joined the call. Do not reply to this note — start the conversation yourself now, exactly as your instructions describe.)' });
const timer = setInterval(() => {
  while ((n + 1) * 0.1 <= now()) {
    const pcm = new Int16Array(CHUNK);
    for (let i = 0; i < CHUNK; i++) {
      const s = Math.max(-1, Math.min(1, mic[n * CHUNK + i] + (Math.random() * 2 - 1) * 0.003 * 1.73));
      pcm[i] = s * 0x7fff;
    }
    n++;
    const playing = now() < playEnd;
    const open = started && gate(playing);
    const send = open ? pcm : new Int16Array(CHUNK);
    if (open) {
      let sum = 0;
      for (let i = 0; i < CHUNK; i++) sum += (pcm[i] / 0x8000) ** 2;
      if (Math.sqrt(sum / CHUNK) > 0.02) nudge.sound();
    }
    session?.sendRealtimeInput({ audio: { data: Buffer.from(send.buffer).toString('base64'), mimeType: 'audio/pcm;rate=16000' } });
    if (process.env.NUDGE && nudge.due()) {
      log(`answer #${cur?.i} nudge: audioStreamEnd`);
      session?.sendRealtimeInput({ audioStreamEnd: true });
    }
  }
}, 20);

await new Promise((r) => setTimeout(r, SECONDS * 1000));
clearInterval(timer);
const s = session;
session = null;
s?.close();
const ok = answers.filter((a) => a.heard.trim()).length;
console.log(JSON.stringify({ config: CONFIG, nudge: !!process.env.NUDGE, seconds: SECONDS, answers: answers.length, heard: ok, stuck: answers.filter((a) => a.stuck).map((a) => a.i), tokens: lastTokens }));
process.exit(0);
