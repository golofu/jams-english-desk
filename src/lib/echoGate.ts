// Speakerphone echo guard for the Live call (kept free of app imports so dev/probe-echo.mjs can run it).
//
// On a phone speaker the partner's own voice leaks back into the mic. Echo cancellation misses
// WebAudio output on some phones, and auto-gain lifts the leak to speaking level, so a loudness
// threshold can't tell it from Jam. Live then hears "someone talking": it cuts the partner off
// after a word or two and transcribes its own voice as Jam's line, often in a random language.
// So the call is half-duplex: while the partner talks, and for a short tail after (the speaker
// lags the audio clock and the room rings on), Live gets silence.

/** Speaker output lag + room tail after the last scheduled sample. */
export const ECHO_TAIL_MS = 700;

/** Returns `(partnerPlaying) => send?` per mic chunk; false means send silence instead. */
export function makeGate(now: () => number = () => Date.now()) {
  let quietSince = 0;
  return (playing: boolean): boolean => {
    if (playing) {
      quietSince = 0;
      return false;
    }
    if (!quietSince) quietSince = now();
    return now() - quietSince >= ECHO_TAIL_MS;
  };
}

/**
 * Live input settings: less trigger-happy speech detection (a cough, a chair or a TV blip must
 * not count as Jam's turn) and transcription told to expect English or Thai, not guess a language.
 */
export function liveInputConfig(): { inputAudioTranscription: object; realtimeInputConfig: object } {
  return {
    inputAudioTranscription: { languageCodes: ['en-US', 'th-TH'] },
    realtimeInputConfig: {
      automaticActivityDetection: {
        // Beginners pause mid-sentence. The partner can't be interrupted (half-duplex), so a reply
        // that starts in a pause would mute the rest of her sentence: wait 2 s (1.2 s cut her off).
        silenceDurationMs: 2000,
        startOfSpeechSensitivity: 'START_SENSITIVITY_LOW',
        prefixPaddingMs: 300,
      },
    },
  };
}
