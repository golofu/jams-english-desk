# English Desk

แอปฝึกพูด-ฟังภาษาอังกฤษสำหรับที่ทำงาน ใช้ฟรี ใครก็ใช้ได้
Live: https://english-desk.golfinbox.workers.dev

- Login ด้วย Google
- ผู้ใช้ใส่ Gemini API key ฟรีของตัวเอง (Google AI Studio) หรือเป็นบัญชี sponsored ที่ใช้ key ของแอป
- โค้ชเสียง "Jimmy" ผ่าน Gemini Live, งานข้อความผ่าน Groq (key กลางของแอป)

## Stack

- Vite + React 19 + TypeScript (`src/`)
- Cloudflare Worker (`worker/`) ให้บริการ `/auth/*`, `/api/*`, `/health`; ไฟล์ static จาก `dist/`
- Cloudflare D1 (`migrations/`) เก็บ users, sessions, app_state, user_keys (key ถูก AES-GCM seal)
- Cloudflare R2 เก็บ Voice Snapshot

## Dev

```
npm install
cp .env.example .dev.vars   # กรอก APP_BASE_URL, KEY_SECRET, GOOGLE_CLIENT_ID/SECRET, GROQ_API_KEY
npm run db:migrate:local
npm run dev                 # vite :5174 + wrangler dev :8787
```

## Deploy

```
npm run db:migrate          # ครั้งแรก / เมื่อมี migration ใหม่
npx wrangler secret put KEY_SECRET GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET GROQ_API_KEY   # ทีละตัว
npm run deploy
```

Optional: `SPONSORED_EMAILS` (คั่นด้วย ,) + `GEMINI_API_KEY` สำหรับบัญชีที่ใช้ key ของแอป

## Dev probes

`dev/probe-long.mjs` จำลองสาย Live ยาว ๆ (ตรวจอาการโค้ชเงียบ), `dev/check-echo-gate.mjs` ตรวจ echo gate + end nudge
