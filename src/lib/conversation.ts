import type { LiveConnectConfig, LiveServerMessage, Session } from '@google/genai';
import { liveInputConfig, makeGate } from './echoGate';
import { markVoiceQuota } from './usage';
import { api, ApiError, coach } from './api';
import { PcmPlayer, audioCtx, b64FromBytes, browserSpeechLevel, outputLatencyMs, speak, startMic, stopSpeaking, wavFromPcm16, type Mic } from './audio';

export type Line = { id: number; who: 'jam' | 'ai'; text: string };
export type ConvState = 'connecting' | 'listening' | 'speaking' | 'thinking' | 'ended';
export type Mode = 'live' | 'turn';

type Opts = {
  system: string;
  voice: string;
  gender: 'male' | 'female';
  speechRate: number;
  /** New line, or an existing line (same id) whose text grew. */
  onLine: (l: Line) => void;
  /** The partner's words so far in the current turn (live captions). */
  onPartial: (text: string) => void;
  onState: (s: ConvState) => void;
  onNotice: (th: string) => void;
};

const KICKOFF = '(System: Jam has just joined the call. Do not reply to this note — start the conversation yourself now, exactly as your instructions describe.)';
const CONNECT_TIMEOUT_MS = 10_000;
const MAX_UTTER_CHUNKS = 150; // 15 s of 100 ms chunks — keeps fallback uploads small
// The partner always speaks first. Until it does, Live must not hear the room: continuous sound
// (TV, chatter, Jam already talking) holds Live's turn open and the greeting never comes.
const OPENING_GATE_MS = 8_000;
function rms(pcm: Int16Array): number {
  let sum = 0;
  for (let i = 0; i < pcm.length; i++) sum += (pcm[i] / 0x8000) ** 2;
  return Math.sqrt(sum / pcm.length);
}
const FATAL = ['NO_GEMINI_KEY', 'LOGIN_REQUIRED', 'NOT_ALLOWED', 'AUTH_NOT_CONFIGURED', 'PASSCODE_REQUIRED'];

/**
 * A spoken conversation with one character. Uses the Gemini Live API; if that
 * is unavailable (free quota out, network) it falls back to "turn" mode:
 * a simple client-side VAD records each utterance, the text model replies,
 * and the browser voice speaks it.
 */
export class Conversation {
  mode: Mode = 'live';
  lines: Line[] = [];
  helpCount = 0;
  private session: Session | null = null;
  private player: PcmPlayer | null = null;
  private mic: Mic | null = null;
  private jamBuf = '';
  private aiBuf = '';
  private turnJamLine: Line | null = null; // Jam's line that the current AI turn answers
  private seq = 0;
  private holding = false;
  private helpChunks: Int16Array[] = [];
  private ended = false;
  private state: ConvState = 'connecting';
  private pendingCue = '';
  private openingUntil = 0; // mic sends silence until the partner starts talking, or this time
  // Half-duplex: the mic is shut while anything plays from the speaker (the partner, or the
  // 🔊 phrase/help buttons and the backup voice, which use browser speech) and just after.
  private echoGate = makeGate(outputLatencyMs);
  private speakerBusy() {
    return !!this.player?.playing || ('speechSynthesis' in window && speechSynthesis.speaking);
  }
  // turn-mode VAD
  private utter: Int16Array[] = [];
  private loudRun = 0;
  private voiced = false;
  private silent = 0;
  private busy = false;

  constructor(private o: Opts) {}

  /** Throws only for problems Jam must fix herself (setup, login, mic permission). */
  async start() {
    this.setState('connecting');
    const ac = await audioCtx();
    if (this.ended) return; // Jam left before the mic prompt: don't turn the mic on
    this.player = new PcmPlayer(ac);
    // Mic first: the permission prompt comes before the AI talks, and on iOS the
    // audio session is play-and-record from the start.
    this.mic = await startMic((pcm) => this.onMic(pcm));
    if (this.ended) return this.cleanup();
    document.addEventListener('visibilitychange', this.onVisible);
    try {
      await this.startLive();
    } catch (e) {
      if (e instanceof ApiError && FATAL.includes(e.code)) throw e;
      if (this.ended) return this.cleanup();
      console.warn('Live failed, using turn mode', e);
      await this.startTurnMode(false);
    }
  }

  // ---------------- Live mode ----------------
  private liveRetried = false;
  private async startLive(recap = '') {
    // Load the SDK while the token is minted; the token must be used within 60 s.
    const [{ GoogleGenAI, Modality }, { token, model }] = await Promise.all([
      import('@google/genai'),
      api<{ token: string; model: string }>('live-token', {}),
    ]);
    if (this.ended) return;
    const ai = new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion: 'v1alpha' } });
    let ready = false;
    let failEarly: (e: Error) => void = () => undefined;
    const early = new Promise<never>((_, reject) => (failEarly = reject));
    // connect() never settles if the server rejects the session during setup
    // (e.g. token reuse → close 1011), so race it against early close + timeout.
    const timer = setTimeout(() => failEarly(new Error('LIVE_TIMEOUT')), CONNECT_TIMEOUT_MS);
    const connecting = ai.live.connect({
      model,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: this.o.voice } } },
        systemInstruction: recap ? `${this.o.system}\n${recap}` : this.o.system,
        outputAudioTranscription: {},
        // English/Thai transcription hints + calmer speech detection (see echoGate.ts).
        ...(liveInputConfig() as Pick<LiveConnectConfig, 'inputAudioTranscription' | 'realtimeInputConfig'>),
      },
      callbacks: {
        onmessage: (m) => this.onLiveMessage(m),
        onerror: (e) => console.warn('live error', e),
        onclose: (e) => {
          if (/quota|exhaust/i.test(e.reason || '')) markVoiceQuota();
          if (!ready) return failEarly(new Error(`LIVE_CLOSED ${e.code} ${e.reason}`));
          this.session = null;
          if (this.ended) return;
          console.warn('live closed', e.code, e.reason);
          // A network blip or server time limit: reconnect once with a recap, keeping Jimmy's real voice.
          if (!this.liveRetried && !/quota|exhaust/i.test(e.reason || '')) {
            this.liveRetried = true;
            this.player?.clear();
            this.flushJam();
            this.flushAi();
            const history = this.lines
              .slice(-12)
              .map((l) => `${l.who === 'jam' ? 'JAM' : 'YOU'}: ${l.text}`)
              .join('\n');
            const recap = `(The call dropped and reconnected. The conversation so far:\n${history}\nContinue naturally from there; do not greet her again.)`;
            this.startLive(recap).catch(() => {
              if (this.ended) return;
              this.o.onNotice('การเชื่อมต่อหลุด สลับเป็นโหมดสำรองให้แล้ว คุยต่อได้เลยค่ะ');
              this.startTurnMode(true).catch(() => this.o.onNotice('เชื่อมต่อ AI ไม่ได้ กด "จบ" แล้วลองใหม่ภายหลังนะคะ'));
            });
            return;
          }
          // Quota or a second drop: carry on in turn mode.
          this.o.onNotice('การเชื่อมต่อหลุด สลับเป็นโหมดสำรองให้แล้ว คุยต่อได้เลยค่ะ');
          this.startTurnMode(true).catch(() => this.o.onNotice('เชื่อมต่อ AI ไม่ได้ กด "จบ" แล้วลองใหม่ภายหลังนะคะ'));
        },
      },
    });
    try {
      const session = await Promise.race([connecting, early]);
      ready = true;
      if (this.ended) return session.close();
      this.session = session;
    } catch (e) {
      connecting.then((s) => s.close()).catch(() => undefined);
      throw e;
    } finally {
      clearTimeout(timer);
    }
    this.mode = 'live';
    if (recap) this.setState('listening');
    else {
      this.openingUntil = Date.now() + OPENING_GATE_MS;
      this.session.sendRealtimeInput({ text: KICKOFF });
      this.setState('thinking');
    }
  }

  private onLiveMessage(m: LiveServerMessage) {
    if (this.ended) return;
    const sc = m.serverContent;
    if (!sc) return;
    if (sc.outputTranscription?.text || sc.modelTurn?.parts?.length) this.openingUntil = 0; // the partner has started
    if (sc.interrupted) {
      this.player?.clear();
      this.flushAi(); // what was said before Jam cut in stays before her words
    }
    if (sc.inputTranscription?.text) {
      if (this.aiBuf) this.flushAi();
      this.jamBuf += sc.inputTranscription.text;
    }
    // While Jam holds "นึกไม่ออก" the partner's audio is dropped, so drop its words too:
    // the transcript (and the review/stars) must only contain what she actually heard.
    if (sc.outputTranscription?.text && !this.holding) {
      if (this.jamBuf) {
        this.flushJam();
        this.turnJamLine = this.lines[this.lines.length - 1] ?? null;
      }
      this.aiBuf += sc.outputTranscription.text;
      this.o.onPartial(this.aiBuf);
    }
    for (const p of sc.modelTurn?.parts ?? []) {
      const d = p.inlineData;
      // While Jam holds "นึกไม่ออก" the partner stays quiet (and out of her Thai recording).
      if (d?.data && d.mimeType?.startsWith('audio/') && !this.holding) {
        const rate = Number(/rate=(\d+)/.exec(d.mimeType)?.[1] ?? 24000);
        this.player?.play(d.data, rate);
      }
    }
    if (sc.turnComplete) {
      this.flushAi();
      // Late transcription of Jam's words belongs to the line this turn answered.
      const late = this.jamBuf.trim();
      this.jamBuf = '';
      if (late && this.turnJamLine) {
        this.turnJamLine.text = `${this.turnJamLine.text} ${late}`;
        this.o.onLine(this.turnJamLine);
      } else if (late) this.push('jam', late);
      this.turnJamLine = null;
    }
  }

  private flushJam() {
    const t = this.jamBuf.trim();
    this.jamBuf = '';
    if (t) this.push('jam', t);
  }
  private flushAi() {
    const t = this.aiBuf.trim();
    this.aiBuf = '';
    this.o.onPartial('');
    if (t) this.push('ai', t);
  }
  private push(who: 'jam' | 'ai', text: string) {
    const l = { id: ++this.seq, who, text };
    this.lines.push(l);
    this.o.onLine(l);
  }

  // ---------------- Turn (fallback) mode ----------------
  private async startTurnMode(resume: boolean) {
    if (this.ended) return;
    this.mode = 'turn';
    this.player?.clear();
    this.flushJam();
    this.flushAi();
    if (!resume || !this.lines.length) {
      const ok = await this.turn(undefined);
      // Could not even get the first line: the backup is down too — say so plainly.
      if (!ok && !this.ended && !this.lines.length) throw new ApiError(this.lastError || 'SERVER', 0);
    } else this.setState('listening');
  }

  private lastError = '';
  private async turn(wav: Uint8Array | undefined): Promise<boolean> {
    if (this.ended) return false;
    this.busy = true;
    this.setState('thinking');
    const system = this.pendingCue ? `${this.o.system}\n${this.pendingCue}` : this.o.system;
    this.pendingCue = '';
    try {
      const r = await coach<{ heard: string; reply: string }>('turn', {
        system,
        history: this.lines.map((l) => ({ who: l.who, text: l.text })),
        audio: wav ? { data: b64FromBytes(wav), mimeType: 'audio/wav' } : undefined,
      });
      if (this.ended) return false;
      if (wav && r.heard?.trim()) this.push('jam', r.heard.trim());
      if (r.reply?.trim()) {
        this.push('ai', r.reply.trim());
        if (!this.holding) {
          this.setState('speaking');
          await speak(r.reply, { rate: this.o.speechRate, gender: this.o.gender });
          // speak() may resolve early (engine quirks); keep the mic closed until the voice is
          // really done, or the fallback would record its own voice as Jam's turn.
          for (let t = 0; t < 60 && !this.ended && 'speechSynthesis' in window && speechSynthesis.speaking; t++) {
            await new Promise((res) => setTimeout(res, 250));
          }
        }
      }
      return true;
    } catch (e) {
      this.lastError = e instanceof ApiError ? e.code : 'SERVER';
      if (this.lines.length) {
        this.o.onNotice(
          this.lastError === 'QUOTA'
            ? 'AI ฟรีวันนี้เต็มแล้ว (รีเซ็ตประมาณบ่าย 2–3 โมง) ฝึก Night Review ไปก่อนได้นะคะ'
            : navigator.onLine
              ? 'AI ตอบไม่ทัน ลองพูดอีกครั้งค่ะ'
              : 'ไม่มีอินเทอร์เน็ต ลองเชื่อมต่อใหม่ค่ะ',
        );
      }
      return false;
    } finally {
      this.busy = false;
      if (!this.ended) this.setState('listening');
    }
  }

  // ---------------- Mic routing ----------------
  private onMic(pcm: Int16Array) {
    if (this.ended) return;
    if (this.holding) {
      this.helpChunks.push(pcm);
      return;
    }
    if (this.mode === 'live') {
      // Speakerphone echo would make Live cut the partner off and hear him as Jam (echoGate.ts):
      // while the speaker plays, and just after, silence is sent to keep the stream steady.
      let out = pcm;
      const open = this.echoGate(this.speakerBusy());
      if (Date.now() < this.openingUntil || !open) out = new Int16Array(pcm.length);
      this.session?.sendRealtimeInput({
        audio: { data: b64FromBytes(new Uint8Array(out.buffer)), mimeType: 'audio/pcm;rate=16000' },
      });
      return;
    }
    if (this.state === 'connecting') return;
    // Turn mode: ignore mic while thinking/speaking, and while the speaker (or its echo) is still going.
    const open = this.echoGate(this.speakerBusy());
    if (this.busy || !open) return;
    const loud = rms(pcm) > 0.02;
    this.loudRun = loud ? this.loudRun + 1 : 0;
    if (!this.voiced) {
      // Keep ~0.3 s of pre-roll; speech starts after 3 consecutive loud chunks.
      this.utter = [...this.utter.slice(-2), pcm];
      if (this.loudRun >= 3) {
        this.voiced = true;
        this.silent = 0;
      }
      return;
    }
    this.utter.push(pcm);
    this.silent = loud ? 0 : this.silent + 1;
    // ≥1.2 s of quiet ends the utterance; a 15 s cap keeps noisy rooms from growing it forever.
    if (this.silent >= 12 || this.utter.length >= MAX_UTTER_CHUNKS) {
      const wav = wavFromPcm16(this.utter);
      this.utter = [];
      this.voiced = false;
      this.loudRun = this.silent = 0;
      void this.turn(wav);
    }
  }

  /** "นึกไม่ออก" — hold: Jam speaks Thai, which is NOT sent to the character. */
  holdHelp() {
    this.holding = true;
    this.helpChunks = [];
    this.player?.clear();
    stopSpeaking();
    this.resetVad();
    // No audioStreamEnd here: it makes Live answer the half sentence right away (an answer
    // Jam would never hear). With no audio frames the server simply waits for more.
  }
  private resetVad() {
    this.utter = [];
    this.voiced = false;
    this.loudRun = this.silent = 0;
  }
  async releaseHelp(context: string): Promise<{ en: string; th: string; sayIt: string; heard: string } | null> {
    this.holding = false;
    this.resetVad();
    const chunks = this.helpChunks.slice(0, 300); // ≤30 s
    this.helpChunks = [];
    if (chunks.length < 5) return null; // < 0.5 s: accidental tap
    this.helpCount++;
    const wav = wavFromPcm16(chunks);
    return coach('help', { audio: { data: b64FromBytes(wav), mimeType: 'audio/wav' }, context });
  }
  async helpText(text: string, context: string) {
    this.helpCount++;
    return coach<{ en: string; th: string; sayIt: string; heard: string }>('help', { text, context });
  }

  /** Coach-side nudge, e.g. "time to wrap up". */
  cue(text: string) {
    if (this.mode === 'live') this.session?.sendRealtimeInput({ text });
    else this.pendingCue = text; // applied to the next fallback reply
  }

  aiLevel(): number {
    return this.mode === 'live' ? (this.player?.level() ?? 0) : browserSpeechLevel();
  }
  micLevel(): number {
    return this.mic?.level() ?? 0;
  }
  /** Derived each frame so the avatar reacts instantly. */
  liveState(): ConvState {
    if (this.ended) return 'ended';
    if (this.mode === 'live') {
      if (this.player?.playing) return 'speaking';
      if (this.state === 'connecting') return 'connecting';
      return this.state === 'thinking' && !this.lines.length ? 'thinking' : 'listening';
    }
    return this.state;
  }

  end() {
    if (this.ended) return;
    this.ended = true;
    this.flushAi();
    this.flushJam();
    this.cleanup();
    this.setState('ended');
  }

  /** Back from LINE / a phone call / a locked screen: iOS may have frozen the audio or killed the mic. */
  private onVisible = async () => {
    if (document.hidden || this.ended) return;
    this.player?.clear();
    const ac = await audioCtx();
    if (this.ended) return;
    if (ac.state !== 'running') {
      this.o.onNotice('แตะหน้าจอ 1 ครั้งเพื่อคุยต่อค่ะ');
      document.addEventListener('pointerdown', () => void audioCtx(), { once: true });
    }
    if (this.mic?.stream.getAudioTracks().every((t) => t.readyState === 'ended')) {
      this.mic.stop();
      try {
        this.mic = await startMic((pcm) => this.onMic(pcm));
        if (this.ended) this.cleanup();
      } catch {
        this.o.onNotice('ไมค์หยุดทำงาน กด "จบ" แล้วเริ่มใหม่นะคะ');
      }
    }
  };

  private cleanup() {
    document.removeEventListener('visibilitychange', this.onVisible);
    this.mic?.stop();
    this.mic = null;
    this.session?.close();
    this.session = null;
    this.player?.close();
    this.player = null;
    stopSpeaking();
  }

  private setState(s: ConvState) {
    this.state = s;
    this.o.onState(s);
  }
}
