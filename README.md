# Jam's English Desk

เว็บแอปฝึกฟังและพูดภาษาอังกฤษสำหรับงานเลขา CEO ที่ GoDigit มี Jimmy เป็นโค้ช — สเปกเต็มอยู่ใน [SPEC.md](SPEC.md)
**ค่าใช้จ่าย 0 บาท** (Gemini API ฟรี + Netlify ฟรี + Supabase ฟรี)

## รันในเครื่อง (ทดสอบ)

1. ขอ **Gemini API key ฟรี** ที่ https://aistudio.google.com/apikey (ล็อกอินด้วยบัญชี Google แล้วกด Create API key)
2. คัดลอก `.env.example` เป็น `.env.local` แล้ววาง key ในบรรทัด `GEMINI_API_KEY=`
3. รันคำสั่ง:
   ```bash
   npm install
   npm run dev
   ```
4. เปิด http://localhost:5174 (ถ้ายังไม่ได้ตั้งค่า Supabase จะเป็น **โหมด Local** ข้อมูลเก็บไว้ในเบราว์เซอร์)

## ขึ้นเว็บจริงบน Vercel (ฟรี)

1. Vercel → Project → Settings → Environment Variables ใส่:
   | ชื่อ | ค่า |
   |---|---|
   | `GEMINI_API_KEY` | key ฟรีจาก AI Studio (เบราว์เซอร์มองไม่เห็น) |
   | `APP_PASSCODE` | รหัสเข้าแอปที่ตั้งเอง แจมใส่ครั้งเดียวต่อเครื่อง (ใช้จนกว่าจะตั้ง Supabase) |
2. Deployments → Redeploy เพื่อให้ค่าใหม่มีผล
3. ถ้าต้องการล็อกอิน Google + ซิงก์ทุกเครื่อง ทำขั้นตอน Supabase ด้านล่าง แล้วใส่ตัวแปรชุดเดียวกับ Netlify ใน Vercel

> โค้ดฝั่งเซิร์ฟเวอร์ชุดเดียวกันใช้ได้ทั้งสองที่: `api/*.ts` (Vercel) เรียกไฟล์ใน `netlify/functions/`

## ขึ้นเว็บจริงบน Netlify (ฟรี)

1. **Supabase** (ไว้ล็อกอินด้วย Google และซิงก์ข้อมูลทุกเครื่อง)
   - สร้างโปรเจกต์ฟรีที่ https://supabase.com → SQL Editor → วางไฟล์ [supabase/schema.sql](supabase/schema.sql) แล้วกด Run
   - Authentication → Providers → เปิด **Google** (ต้องสร้าง OAuth Client ใน Google Cloud Console ตามที่ Supabase แนะนำ)
   - Authentication → URL Configuration → ใส่ลิงก์ Netlify ใน Site URL และ Redirect URLs
2. **Netlify**: New site → Import จากโฟลเดอร์หรือ Git (`netlify.toml` ตั้งค่า build ไว้แล้ว) → Site settings → Environment variables:
   | ชื่อ | ค่า |
   |---|---|
   | `GEMINI_API_KEY` | key จากขั้นที่ 1 (ใส่เฉพาะฝั่งเซิร์ฟเวอร์ เบราว์เซอร์มองไม่เห็น) |
   | `ALLOWED_EMAIL` | **ต้องใส่** อีเมล Google ของแจม ถ้าเว้นว่าง แอปจะปิดการใช้ AI ทั้งหมด (กันคนอื่นมาใช้โควตาฟรี) |
   | `SUPABASE_URL`, `SUPABASE_ANON_KEY` | จาก Supabase → Project Settings → API |
   | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | ค่าเดียวกับบรรทัดบน |
3. เปิดลิงก์บนมือถือ → Share → **Add to Home Screen** จะได้ไอคอนเหมือนแอป

> 🔒 ถ้าขึ้น Netlify โดยยังไม่ตั้ง Supabase + `ALLOWED_EMAIL` แอปจะ **ปิด AI ไว้ก่อน** (ขึ้นข้อความ "ยังตั้งค่าการเข้าสู่ระบบไม่เสร็จ") ส่วนตอนรันในเครื่องด้วย `npm run dev` ใช้ได้เลยโดยไม่ต้องล็อกอิน

## โลโก้และสี GoDigit
- โลโก้อยู่ที่ `public/brand/logo.png` (และ `logo-white.png` สำหรับพื้นเข้ม) สีดึงจากโลโก้ไว้ใน [src/brand.ts](src/brand.ts) แก้ที่ไฟล์เดียว สีทั้งแอปจะเปลี่ยนตาม

## โครงสร้าง
- `netlify/functions/live-token.ts` — ออก token ชั่วคราวให้เบราว์เซอร์คุยกับ Gemini Live (`gemini-3.8-live`) โดยไม่เห็น API key
- `netlify/functions/coach.ts` — งานข้อความ (`gemini-3.6-flash` + สำรอง 3.5-flash-lite, 3.8-flash): ช่วยแปลตอนนึกไม่ออก, ซับไทย, ให้ดาวและการ์ดสรุป, สร้างบทซ้อมก่อนเจอจริง, โหมดสำรอง
- `src/lib/conversation.ts` — การคุยด้วยเสียง: Live API และ **โหมดสำรอง** อัตโนมัติเมื่อโควตาฟรีหมด
- `src/components/Avatar.tsx` — หน้าตัวละครวาดด้วย SVG ขยับปากตามเสียง มี 3 สไตล์ (Pixar / อนิเมะ / เกือบเหมือนคน)
- `src/data/curriculum.ts` — บทเรียนระดับ 1–2 (14 สถานการณ์) · `src/data/characters.ts` — ตัวละครและเสียง
- เปิด `/?gallery` ตอน dev เพื่อดูตัวละครทุกสไตล์

## เครื่องมือทดสอบ (dev/)
- `node dev/probe-live.mjs` — ทดสอบ Live API ผ่าน token ของแอป (ต้องรัน `npm run dev` ไว้)
- `node dev/probe-models.mjs <model...>` — เช็กว่าโมเดลฟรีตัวไหนตอบได้ตอนนี้
- `node dev/probe-config.mjs` — เช็กค่า config ที่แต่ละโมเดลรับได้
- `node dev/check-auth.mjs` — ยืนยันว่า API ปิดไว้เป็นค่าเริ่มต้นเมื่อไม่ได้ตั้งค่าล็อกอิน
- `dev/fake-mic.js` — ไมค์จำลอง (เสียงเงียบ) สำหรับทดสอบในเบราว์เซอร์ที่ปิดไมค์
