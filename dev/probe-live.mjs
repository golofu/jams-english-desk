// Dev probe: same flow as the browser — ephemeral token from /api/live-token, then a Live session.
import { GoogleGenAI, Modality } from '@google/genai';
const { token, model } = await (await fetch('http://localhost:5174/api/live-token', { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } })).json();
const ai = new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion: 'v1alpha' } });
let audioBytes = 0, out = '', firstAudio = 0, done;
const finished = new Promise((r) => (done = r));
const t0 = Date.now();
const session = await ai.live.connect({
  model,
  config: {
    responseModalities: [Modality.AUDIO],
    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } } },
    systemInstruction: 'You are Jimmy, a warm 50-year-old English coach for Jam, a Thai secretary. Speak slowly, 1-2 short sentences. Start by greeting Jam warmly by name (good morning, early bird!), then ask: How did you sleep?',
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    realtimeInputConfig: { automaticActivityDetection: { silenceDurationMs: 1200 } },
  },
  callbacks: {
    onmessage: (m) => {
      const sc = m.serverContent;
      for (const p of sc?.modelTurn?.parts ?? []) if (p.inlineData?.data) { audioBytes += p.inlineData.data.length * 0.75; firstAudio ||= Date.now() - t0; var mime = p.inlineData.mimeType; globalThis.mime = mime; }
      if (sc?.outputTranscription?.text) out += sc.outputTranscription.text;
      if (sc?.turnComplete) done();
    },
    onerror: (e) => console.log('error', e.message),
    onclose: (e) => { console.log('closed', e.code, e.reason); done(); },
  },
});
session.sendRealtimeInput({ text: '(System: Jam has just joined the call. Do not reply to this note — start the conversation yourself now, exactly as your instructions describe.)' });
await Promise.race([finished, new Promise((r) => setTimeout(r, 20000))]);
session.close();
console.log({ model, firstAudioMs: firstAudio, audioKB: Math.round(audioBytes / 1024), mime: globalThis.mime, transcript: out.trim() });
