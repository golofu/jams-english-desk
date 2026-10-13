import { LIVE_MODEL, gemini, handle, json, requireUser } from './_shared/common.js';

// Mints a short-lived, single-use token so the browser can open a Live API
// WebSocket without ever seeing GEMINI_API_KEY.
export default handle(async (req) => {
  await requireUser(req);
  const ai = gemini('v1alpha');
  const now = Date.now();
  const token = await ai.authTokens.create({
    config: {
      uses: 1,
      expireTime: new Date(now + 20 * 60 * 1000).toISOString(),
      newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
      liveConnectConstraints: { model: LIVE_MODEL },
      // Lock only the model. Without this, the token locks the whole (empty) config and
      // the browser's systemInstruction/voice are silently ignored (verified 2026-10-13).
      lockAdditionalFields: [],
    },
  });
  return json({ token: token.name, model: LIVE_MODEL });
});
