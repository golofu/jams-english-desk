import { useState } from 'react';
import { CHARACTERS } from '../data/characters';
import { Avatar } from '../components/Avatar';
import { MicCheck } from '../components/MicCheck';
import { SPEECH_RATE, speak } from '../lib/audio';
import { supabase } from '../lib/supabase';
import type { AvatarStyle, Profile } from '../lib/store';
import { useApp } from '../state';
import { BRAND } from '../brand';

const STYLES: { id: AvatarStyle; th: string }[] = [
  { id: 'pixar', th: 'การ์ตูน Pixar' },
  { id: 'anime', th: 'อนิเมะ' },
  { id: 'real', th: 'เกือบเหมือนคน' },
];

export function Settings() {
  const { data, update, email, signOut } = useApp();
  const p = data.profile;
  const set = (patch: Partial<Profile>) => update('profile', (x) => ({ ...x, ...patch }));
  const [micTest, setMicTest] = useState(false);

  return (
    <div className="screen">
      <h2>ตั้งค่า</h2>

      <div className="card">
        <div className="card-title">ไมโครโฟน</div>
        {micTest ? (
          <MicCheck autoContinue={false} onPass={() => setMicTest(false)} onSkip={() => setMicTest(false)} />
        ) : (
          <>
            <p className="small">ถ้ากดอัดแล้วไม่มีเสียง หรือ AI ไม่ได้ยิน ลองเช็คไมค์ตรงนี้ (เลือกไมค์ได้ถ้าเครื่องมีหลายตัว)</p>
            <button className="btn" onClick={() => setMicTest(true)}>🎙️ ทดสอบไมค์</button>
          </>
        )}
      </div>

      <div className="card">
        <div className="card-title">หน้าตาตัวละคร</div>
        <div className="style-pick">
          {STYLES.map((s) => (
            <button key={s.id} className={`style-opt ${p.style === s.id ? 'on' : ''}`} onClick={() => set({ style: s.id })}>
              <Avatar character={CHARACTERS.jimmy} style={s.id} size={84} />
              <span>{s.th}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title">โค้ช</div>
        <label className="field">
          ชื่อโค้ช
          <input value={p.coachName} onChange={(e) => set({ coachName: e.target.value })} onBlur={() => !p.coachName.trim() && set({ coachName: 'Jimmy' })} />
        </label>
        <div className="field">
          ความเร็วในการพูด
          <Seg value={p.speed} onChange={(v) => { set({ speed: v }); void speak('This is how fast I will speak.', { rate: SPEECH_RATE[v] }); }} options={[['slow', 'ช้า'], ['normal', 'ปกติ'], ['fast', 'เร็ว']]} />
        </div>
        <div className="field">
          ซับไตเติล
          <Seg value={p.subtitles} onChange={(v) => set({ subtitles: v })} options={[['both', 'อังกฤษ+ไทย'], ['en', 'อังกฤษ'], ['off', 'ปิด']]} />
        </div>
      </div>

      <div className="card">
        <div className="card-title">เวลาฝึก</div>
        <label className="field">
          ☀️ Morning Talk
          <input type="time" value={p.morningTime} onChange={(e) => set({ morningTime: e.target.value })} />
        </label>
        <label className="field">
          🌙 Night Review (ก่อนนอน)
          <input type="time" value={p.nightTime} onChange={(e) => set({ nightTime: e.target.value })} />
        </label>
        <p className="small">การแจ้งเตือนบนมือถือจะมาเร็วๆ นี้ ตอนนี้แอปใช้เวลานี้จัดหน้าแรกให้</p>
      </div>

      <div className="card">
        <div className="card-title">บัญชีและข้อมูล</div>
        <p className="small">{supabase ? `เข้าสู่ระบบด้วย ${email}` : 'โหมด Local: ข้อมูลเก็บไว้ในเครื่องนี้เท่านั้น'}</p>
        <p className="small">🔒 ความคืบหน้าทั้งหมดแจมเห็นคนเดียว ไม่มีใครดูได้</p>
        <p className="small">⚠️ ใช้ AI ฟรีของ Google ซึ่งอาจนำบทสนทนาไปใช้พัฒนา อย่าพูดหรือพิมพ์ข้อมูลจริงหรือข้อมูลลับของลูกค้าหรือบริษัท</p>
        {supabase && <button className="btn" onClick={signOut}>ออกจากระบบ</button>}
      </div>
      <p className="small center">{BRAND.appName} · {BRAND.company}</p>
    </div>
  );
}

function Seg<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="seg">
      {options.map(([v, l]) => (
        <button key={v} type="button" className={value === v ? 'on' : ''} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}
