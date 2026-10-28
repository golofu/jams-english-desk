// Speakerphone echo guard for the Live call (kept free of app imports so dev/probe-echo.mjs can run it).
//
// On a phone speaker the partner's own voice leaks back into the mic. Echo cancellation misses
// WebAudio output on some phones, and auto-gain lifts the leak to speaking level, so a loudness
// threshold can't tell it from the learner. Live then hears "someone talking": it cuts the partner off
// after a word or two and transcribes its own voice as the learner's line, often in a random language.
// So the call is half-duplex: while the partner talks, and for a short tail after (the speaker
// lags the audio clock and the room rings on), Live gets silence.

/** Speaker output lag + room tail after the last scheduled sample. */
export const ECHO_TAIL_MS = 700;

/**
 * Returns `(soundPlaying) => send?` per mic chunk; false means send silence instead.
 * `extraTailMs`: the speaker's own lag (AudioContext.outputLatency — large on Bluetooth).
 */
export function makeGate(extraTailMs: () => number = () => 0, now: () => number = () => Date.now()) {
  let quietSince: number | null = null;
  return (playing: boolean): boolean => {
    if (playing) {
      quietSince = null;
      return false;
    }
    quietSince ??= now();
    return now() - quietSince >= ECHO_TAIL_MS + extraTailMs();
  };
}

/** Quiet after the learner's last sound before the app ends their turn itself (Live's own wait is 2 s). */
export const END_NUDGE_MS = 3500;

/**
 * Live sometimes transcribes the learner's whole answer yet never decides they have finished: the partner
 * stays silent for minutes (dev/probe-long.mjs, 2026-10-28: 4 of 11 answers stalled 110–140 s).
 * Telling Live her audio stream ended makes it answer at once (same probe: 43 answers, 0 stalls).
 * `due()` is true once, END_NUDGE_MS after her last sound, if Live heard words and has not replied.
 */
export function makeEndNudge(now: () => number = () => Date.now()) {
  let lastSound = 0;
  let waiting = false;
  return {
    /** A loud mic chunk that reached Live (noise alone never triggers a nudge). */
    sound() {
      lastSound = now();
    },
    /** Live transcribed some of the learner's words. */
    words() {
      lastSound = now();
      waiting = true;
    },
    /** The partner started replying, or the turn ended. */
    answered() {
      waiting = false;
    },
    due(): boolean {
      if (!waiting || now() - lastSound < END_NUDGE_MS) return false;
      waiting = false;
      return true;
    },
  };
}

/**
 * Live input settings: transcription told to expect English or Thai, not guess a language.
 * Start-of-speech sensitivity stays at the default: LOW clipped a soft-spoken "I slept…" to
 * "Very well…", and default stayed quiet in steady room noise (dev/probe-echo.mjs, 2026-10-21).
 */
export function liveInputConfig(): { inputAudioTranscription: object; realtimeInputConfig: object } {
  return {
    inputAudioTranscription: { languageCodes: ['en-US', 'th-TH'] },
    realtimeInputConfig: {
      automaticActivityDetection: {
        // Beginners pause mid-sentence. The partner can't be interrupted (half-duplex), so a reply
        // that starts in a pause would mute the rest of her sentence: wait 2 s (1.2 s cut her off).
        silenceDurationMs: 2000,
      },
    },
  };
}
