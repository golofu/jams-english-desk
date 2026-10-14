import { coach } from './api';

// Gemini's free quota resets at midnight Pacific time (14:00–15:00 in Thailand).
const pacificDay = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
const VOICE_KEY = 'jed:voiceQuotaDay';

/** The real-voice call (Gemini Live) ran out of free quota: remember it until the reset. */
export function markVoiceQuota() {
  try {
    localStorage.setItem(VOICE_KEY, pacificDay());
  } catch {
    /* private mode */
  }
}

export function voiceQuotaOut(): boolean {
  try {
    return localStorage.getItem(VOICE_KEY) === pacificDay();
  } catch {
    return false;
  }
}

export type TextQuota = { remaining: number; limit: number } | null;
const CACHE_KEY = 'jed:textQuota';

/** Free text-AI requests left today. Cached 10 minutes: each check spends a couple of requests. */
export async function textQuota(): Promise<TextQuota> {
  try {
    const c = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
    if (c && Date.now() - c.at < 10 * 60_000) return c.text;
  } catch {
    /* ignore */
  }
  const { text } = await coach<{ text: TextQuota }>('usage', {});
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), text }));
  } catch {
    /* ignore */
  }
  return text;
}
