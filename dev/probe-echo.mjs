// Dev probe: speakerphone echo against the real Live API.
// The partner's own voice is fed back into the "mic" (delayed, scaled — like a phone speaker
// leaking into its mic) through the app's mic gate, in real time. Prints whether Live cut the
// partner off and what it thought Jam said.
// usage: node dev/probe-echo.mjs <echoGain> [old|new] [noiseRms]   (GEMINI_API_KEY or APP_PASSCODE from .env.local)
//   SAY=answer.wav  a 16 kHz mono WAV Jam "says" after the first turn; SECONDS=30 to give it time.
// Each run opens one Live session on the free daily voice quota — keep runs few.
// 2026-10-21: old gate + echo ≥0.11 RMS → 4–5 cut-offs and the partner's words logged as Jam's;
// new gate → 0 cut-offs, answer heard in full (with 2 s end-of-turn silence).
import { readFileSync } from 'node:fs';
import { GoogleGenAI, Modality } from '@google/genai';
import { liveInputConfig, makeGate } from '../src/lib/echoGate.ts';

const [gain = '0.5', gateKind = 'old', noiseRms = '0.003'] = process.argv.slice(2);
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .map((l) => /^([A-Z_]+)="?(.*?)"?$/.exec(l))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);
// Vercel pulls secret values as empty: then mint a single-use token from the deployed app, like the browser does.
let apiKey = env.GEMINI_API_KEY, model = env.GEMINI_LIVE_MODEL || 'gemini-3.8-live';
if (!apiKey) {
  const r = await fetch(`${process.env.APP_URL || 'https://jams-english-desk.vercel.app'}/api/live-token`, {
    method: 'POST', body: '{}', headers: { 'content-type': 'application/json', 'x-app-passcode': env.APP_PASSCODE },
  });
  if (!r.ok) throw new Error(`live-token ${r.status} ${await r.text()}`);
  ({ token: apiKey, model } = await r.json());
}
const ai = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: 'v1alpha' } });

const RATE = 16000, CHUNK = 1600, ECHO_DELAY = 0.12; // s, speaker → room → mic
const echo = new Float32Array(RATE * 40); // what the mic hears from the speaker, by time since t0
let t0 = 0, playEnd = 0, started = false, interrupted = 0, out = '', jam = '', echoPeak = 0, turns = 0;
const now = () => (Date.now() - t0) / 1000;
const playing = () => now() < playEnd;
const old = gateKind === 'old';
// Optional: Jam answers (a 16 kHz mono WAV) 1.5 s after the partner's first turn ends.
const say = process.env.SAY ? new Int16Array(readFileSync(process.env.SAY).buffer.slice(44)) : null;
let answered = false, answerAt = null;
const gate = makeGate();

function onAudio(b64, rate) {
  const b = Buffer.from(b64, 'base64');
  const pcm = new Int16Array(b.buffer, b.byteOffset, b.length >> 1);
  const start = Math.max(now() + 0.03, playEnd); // same scheduling as PcmPlayer
  playEnd = start + pcm.length / rate;
  const off = Math.round((start + ECHO_DELAY) * RATE), step = rate / RATE;
  for (let i = 0; off + i < echo.length && i * step < pcm.length; i++) echo[off + i] += (pcm[Math.floor(i * step)] / 0x8000) * Number(gain);
}

const session = await ai.live.connect({
  model,
  config: {
    responseModalities: [Modality.AUDIO],
    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } } },
    systemInstruction:
      'You are Jimmy, a warm English coach for Jam, a Thai secretary. Start by greeting Jam warmly by name, say one sentence about the lovely morning, then ask how she slept. Speak slowly.',
    ...(old
      ? { inputAudioTranscription: {}, realtimeInputConfig: { automaticActivityDetection: { silenceDurationMs: 1200 } } }
      : liveInputConfig()),
    outputAudioTranscription: {},
  },
  callbacks: {
    onmessage: (m) => {
      const sc = m.serverContent;
      if (!sc) return;
      if (sc.outputTranscription?.text || sc.modelTurn?.parts?.length) started = true;
      if (sc.interrupted) {
        interrupted++;
        playEnd = now(); // PcmPlayer.clear(): queued audio is dropped
        echo.fill(0, Math.round((now() + ECHO_DELAY) * RATE));
      }
      if (sc.inputTranscription?.text) jam += sc.inputTranscription.text;
      if (sc.outputTranscription?.text) out += sc.outputTranscription.text;
      for (const p of sc.modelTurn?.parts ?? []) {
        const d = p.inlineData;
        if (d?.data && d.mimeType?.startsWith('audio/')) onAudio(d.data, Number(/rate=(\d+)/.exec(d.mimeType)?.[1] ?? 24000));
      }
      if (sc.turnComplete) {
        turns++;
        if (say && !answered) {
          answered = true;
          answerAt = +(Math.max(now(), playEnd) + 1.5).toFixed(1);
          const off = Math.round(answerAt * RATE);
          for (let i = 0; i < say.length && off + i < echo.length; i++) echo[off + i] += (say[i] / 0x8000) * Number(process.env.JAM_GAIN || 0.6);
        }
      }
    },
    onerror: (e) => console.log('error', e.message),
    onclose: (e) => e.code !== 1000 && console.log('closed', e.code, e.reason),
  },
});
t0 = Date.now();
session.sendRealtimeInput({ text: '(System: Jam has just joined the call. Do not reply to this note — start the conversation yourself now, exactly as your instructions describe.)' });

let n = 0;
// Timer ticks drift: catch up to the real clock, or late chunks would replay echo after the gate reopened.
const timer = setInterval(() => { while ((n + 1) * 0.1 <= now()) sendChunk(); }, 20);
function sendChunk() {
  const pcm = new Int16Array(CHUNK);
  let sum = 0;
  for (let i = 0; i < CHUNK; i++) {
    const s = Math.max(-1, Math.min(1, echo[n * CHUNK + i] + (Math.random() * 2 - 1) * Number(noiseRms) * 1.73));
    pcm[i] = s * 0x7fff;
    sum += s * s;
  }
  n++;
  const level = Math.sqrt(sum / CHUNK);
  if (playing()) echoPeak = Math.max(echoPeak, level);
  // The app's gate: silence until the partner starts, then (old) quiet input while it plays.
  let send = pcm;
  if (!started) send = new Int16Array(CHUNK);
  else if (old) { if (playing() && level < 0.05) send = new Int16Array(CHUNK); }
  else if (!gate(playing())) send = new Int16Array(CHUNK);
  session.sendRealtimeInput({ audio: { data: Buffer.from(send.buffer).toString('base64'), mimeType: 'audio/pcm;rate=16000' } });
}

await new Promise((r) => setTimeout(r, Number(process.env.SECONDS || 16) * 1000));
clearInterval(timer);
session.close();
console.log(JSON.stringify({ gate: gateKind, answerAtS: answerAt, gain: Number(gain), noiseRms: Number(noiseRms), echoPeakRms: +echoPeak.toFixed(3), interrupted, turns, partnerSaid: out.trim(), jamHeard: jam.trim() }));
process.exit(0);
