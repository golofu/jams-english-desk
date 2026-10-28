// Mic capture (16 kHz PCM), playback of Live API audio (24 kHz PCM) with a level
// meter for lip-sync, WAV encoding, and browser speech for offline phrases.

let ctx: AudioContext | null = null;
let worklet: Promise<void> | null = null;

/** One shared AudioContext; must first be called from a tap/click (iOS). */
export async function audioCtx(): Promise<AudioContext> {
  if (!ctx) {
    ctx = new AudioContext();
    // iOS reports 'interrupted' after calls/Siri; resume whenever we're allowed to.
    ctx.onstatechange = () => {
      if (ctx && ctx.state !== 'running' && ctx.state !== 'closed') ctx.resume().catch(() => undefined);
    };
  }
  // resume() can stay pending on iOS while another app holds the audio session: never hang on it.
  if (ctx.state !== 'running') await Promise.race([ctx.resume().catch(() => undefined), new Promise((r) => setTimeout(r, 3000))]);
  return ctx;
}

/** Speaker lag behind the audio clock, in ms (Bluetooth: hundreds). 0 where the browser doesn't say. */
export const outputLatencyMs = () => (ctx?.outputLatency ?? 0) * 1000;

/** Same speed setting → same speech rate on every screen. */
export const SPEECH_RATE = { slow: 0.78, normal: 0.92, fast: 1.08 } as const;

export function b64FromBytes(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function bytesFromB64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

// ---------- Mic ----------
export type Mic = {
  stop(): void;
  stream: MediaStream;
  /** Latest input loudness 0..1 */
  level(): number;
};

// Which microphone to use. A PC often has several (webcam, headset, "Default" that points at
// an unplugged one): whoever is practising picks once in the mic check and every recording uses it.
const MIC_KEY = 'jed:micId';
export function preferredMic(): string {
  try {
    return localStorage.getItem(MIC_KEY) || '';
  } catch {
    return '';
  }
}
export function setPreferredMic(id: string) {
  try {
    if (id) localStorage.setItem(MIC_KEY, id);
    else localStorage.removeItem(MIC_KEY);
  } catch {
    /* private mode */
  }
}
function micConstraints(extra: MediaTrackConstraints = {}): MediaStreamConstraints {
  const id = preferredMic();
  // `ideal`, not `exact`: a remembered headset that is unplugged today must not break the app.
  return { audio: { echoCancellation: true, noiseSuppression: true, ...(id ? { deviceId: { ideal: id } } : {}), ...extra } };
}
/** Microphones with names (names only appear after permission was granted once). */
export async function listMics(): Promise<{ id: string; label: string }[]> {
  const devs = await navigator.mediaDevices.enumerateDevices().catch(() => []);
  return devs.filter((d) => d.kind === 'audioinput').map((d, i) => ({ id: d.deviceId, label: d.label || `ไมค์ ${i + 1}` }));
}

/** 0..1 meter value from RMS, on a dB scale so quiet speech still shows (-60 dB → 0, 0 dB → 1). */
export const meterFromRms = (rms: number) => (rms <= 0 ? 0 : Math.max(0, Math.min(1, (20 * Math.log10(rms) + 60) / 60)));

export async function startMic(onChunk: (pcm: Int16Array) => void): Promise<Mic> {
  const ac = await audioCtx();
  const stream = await navigator.mediaDevices.getUserMedia(micConstraints({ autoGainControl: true, channelCount: 1 }));
  // Register once; a real load failure (404/CSP) must surface, not masquerade as a mic error.
  worklet ??= ac.audioWorklet.addModule('/pcm-worklet.js').catch((e) => {
    worklet = null;
    throw e;
  });
  try {
    await worklet;
  } catch (e) {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error(`WORKLET_LOAD ${e}`);
  }
  const src = ac.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(ac, 'pcm-recorder');
  let lvl = 0;
  node.port.onmessage = (e) => {
    lvl = meterFromRms(e.data.rms);
    onChunk(new Int16Array(e.data.pcm));
  };
  src.connect(node);
  // Worklet must reach the destination to run in some browsers; keep it silent.
  const mute = ac.createGain();
  mute.gain.value = 0;
  node.connect(mute).connect(ac.destination);
  return {
    stream,
    level: () => lvl,
    stop() {
      node.port.onmessage = null;
      node.port.postMessage('stop'); // lets process() return false so the node is freed
      src.disconnect();
      node.disconnect();
      mute.disconnect();
      stream.getTracks().forEach((t) => t.stop());
    },
  };
}

export function wavFromPcm16(chunks: Int16Array[], rate = 16000): Uint8Array {
  const len = chunks.reduce((a, c) => a + c.length, 0);
  const buf = new ArrayBuffer(44 + len * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + len * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, len * 2, true);
  let o = 44;
  for (const c of chunks) for (let i = 0; i < c.length; i++, o += 2) v.setInt16(o, c[i], true);
  return new Uint8Array(buf);
}

// ---------- Player for Live API audio ----------
export class PcmPlayer {
  private next = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private analyser: AnalyserNode;
  private data: Uint8Array<ArrayBuffer>;
  constructor(private ac: AudioContext) {
    this.analyser = ac.createAnalyser();
    this.analyser.fftSize = 512;
    this.data = new Uint8Array(this.analyser.fftSize);
    this.analyser.connect(ac.destination);
  }
  play(b64: string, rate = 24000) {
    const bytes = bytesFromB64(b64);
    const pcm = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength >> 1);
    const buf = this.ac.createBuffer(1, pcm.length, rate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 0x8000;
    const src = this.ac.createBufferSource();
    src.buffer = buf;
    src.connect(this.analyser);
    const t = Math.max(this.ac.currentTime + 0.03, this.next);
    src.start(t);
    this.next = t + buf.duration;
    this.sources.add(src);
    src.onended = () => this.sources.delete(src);
  }
  /** Barge-in: the learner started talking, drop queued audio. */
  clear() {
    this.sources.forEach((s) => {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    });
    this.sources.clear();
    this.next = 0;
  }
  get playing() {
    // A suspended/interrupted context never fires onended: don't report "speaking" forever.
    return this.sources.size > 0 && this.ac.state === 'running';
  }
  level(): number {
    if (!this.sources.size) return 0;
    this.analyser.getByteTimeDomainData(this.data);
    let sum = 0;
    for (let i = 0; i < this.data.length; i++) {
      const x = (this.data[i] - 128) / 128;
      sum += x * x;
    }
    return Math.min(1, Math.sqrt(sum / this.data.length) * 5);
  }
  close() {
    this.clear();
    this.analyser.disconnect();
  }
}

// ---------- Browser speech (phrases, fallback mode) ----------
let speakingLevel = 0;
export const browserSpeechLevel = () => speakingLevel;

// getVoices() is empty until 'voiceschanged' on Chrome Android / some iOS builds.
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  speechSynthesis.getVoices();
  speechSynthesis.addEventListener?.('voiceschanged', () => speechSynthesis.getVoices());
}

/** Call inside a tap: iOS only allows later (async) speech after one speak() from a gesture. */
export function unlockSpeech() {
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(' ');
  u.volume = 0;
  speechSynthesis.speak(u);
}

let current: SpeechSynthesisUtterance | null = null; // keep a ref: GC'd utterances never fire onend

function pickVoice(gender?: 'male' | 'female'): SpeechSynthesisVoice | undefined {
  const voices = speechSynthesis.getVoices().filter((v) => /^en[-_]US/i.test(v.lang));
  const pool = voices.length ? voices : speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang));
  const natural = pool.filter((v) => /natural|online|neural|premium|enhanced|google/i.test(v.name));
  const want = gender === 'male' ? /guy|male|david|mark|andrew|christopher|eric|aaron|fred|daniel/i : /aria|jenny|female|zira|samantha|michelle|ava|allison|susan/i;
  return natural.find((v) => want.test(v.name)) || pool.find((v) => want.test(v.name)) || natural[0] || pool[0];
}

export function speak(text: string, opts: { rate?: number; gender?: 'male' | 'female' } = {}): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) return resolve();
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = opts.rate ?? 0.9;
    const v = pickVoice(opts.gender);
    if (v) u.voice = v;
    // No real audio tap on speechSynthesis — simulate mouth movement per word.
    let timer = 0;
    // Some engines never fire onend; never let a caller wait forever.
    const words = text.trim().split(/\s+/).length;
    const safety = window.setTimeout(() => done(), ((words * 0.5) / (u.rate || 1) + 4) * 1000);
    u.onstart = () => {
      timer = window.setInterval(() => (speakingLevel = 0.25 + Math.random() * 0.6), 110);
    };
    const done = () => {
      clearTimeout(safety);
      clearInterval(timer);
      current = null;
      speakingLevel = 0;
      resolve();
    };
    u.onend = done;
    u.onerror = done;
    current = u;
    speechSynthesis.speak(current);
  });
}
export const stopSpeaking = () => {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  speakingLevel = 0;
};

// ---------- Mic meter (mic check) and simple recorder (shadowing / snapshots) ----------
export type MicMeter = {
  stream: MediaStream;
  /** Current mic loudness 0..1 (for a live meter). */
  level: () => number;
  /** Loudest level heard so far: near 0 means the mic picked up nothing. */
  peak: () => number;
  stop: () => void;
};

/** Opens the mic and measures loudness only (no recording). Caller must stop() it. */
export async function micMeter(): Promise<MicMeter> {
  const stream = await navigator.mediaDevices.getUserMedia(micConstraints());
  let maxLevel = 0;
  let ctx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctx();
    void ctx.resume();
    analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(analyser);
  } catch {
    analyser = null; // meter is a nicety; recording still works without it
  }
  const buf = new Uint8Array(512);
  const level = () => {
    if (!analyser) return 0;
    analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) sum += ((v - 128) / 128) ** 2;
    const l = meterFromRms(Math.sqrt(sum / buf.length));
    maxLevel = Math.max(maxLevel, l);
    return l;
  };
  return {
    stream,
    level,
    peak: () => (analyser ? maxLevel : 1),
    stop: () => {
      stream.getTracks().forEach((t) => t.stop());
      void ctx?.close().catch(() => undefined);
    },
  };
}

/** Below this peak (about -42 dB) the take is treated as silence: wrong mic, muted, or far away. */
export const SILENT_PEAK = 0.3;

export async function recordClip(): Promise<{
  stop: () => Promise<Blob>;
  stream: MediaStream;
  level: () => number;
  peak: () => number;
}> {
  const meter = await micMeter();
  const { stream } = meter;
  const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported(t));
  const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
  const parts: Blob[] = [];
  const blob = () => new Blob(parts, { type: rec.mimeType || type || 'audio/webm' });
  rec.ondataavailable = (e) => e.data.size && parts.push(e.data);

  // Listen from the start: if the mic dies mid-recording (iOS lock, phone call) the
  // recorder stops on its own, and a later stop() must still resolve with what we have.
  const stopped = new Promise<Blob>((resolve) => {
    rec.onstop = () => {
      meter.stop();
      resolve(blob());
    };
  });
  rec.start(250);
  return {
    stream,
    level: meter.level,
    peak: meter.peak,
    stop: () => {
      if (rec.state !== 'inactive') {
        try {
          rec.stop();
        } catch {
          /* already stopping */
        }
      }
      // Belt and braces: never hang the caller.
      return Promise.race([stopped, new Promise<Blob>((r) => setTimeout(() => r(blob()), 2000))]);
    },
  };
}
