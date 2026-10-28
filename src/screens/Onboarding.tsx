import { useState } from 'react';
import { CHARACTERS } from '../data/characters';
import { Avatar } from '../components/Avatar';
import { SnapshotRecorder } from '../components/SnapshotRecorder';
import { speak } from '../lib/audio';
import { useApp } from '../state';

export function Onboarding() {
  const { data, update, me } = useApp();
  const [step, setStep] = useState(0);
  const finish = () => update('profile', (p) => ({ ...p, onboarded: true }));
  const jimmy = CHARACTERS.jimmy;
  const style = data.profile.style;
  const p = data.profile;
  const set = (patch: Partial<typeof p>) => update('profile', (x) => ({ ...x, ...patch }));
  const [name, setName] = useState(p.name || me.name.split(' ')[0] || '');
  const [job, setJob] = useState(p.job);
  const [company, setCompany] = useState(p.company);
  const greetName = name.trim() || 'there';

  if (step === 0)
    return (
      <div className="screen onboard center-col">
        <Avatar character={jimmy} style={style} size={200} />
        <h2>สวัสดีค่ะ 👋</h2>
        <p>
          นี่คือ <b>Jimmy</b> โค้ชภาษาอังกฤษส่วนตัวของคุณ อดีตผู้บริหารบริษัทข้ามชาติ จะช่วยฝึกพูดและฟังภาษาอังกฤษสำหรับใช้ในที่ทำงาน
        </p>
        <button className="btn" onClick={() => speak(`Hi ${greetName}! I'm Jimmy. Nice to meet you. Let's practice English together, step by step.`, { rate: 0.85, gender: 'male' })}>
          🔊 ฟัง Jimmy ทักทาย
        </button>
        <button className="btn primary big" onClick={() => setStep(1)}>ถัดไป ›</button>
      </div>
    );

  if (step === 1)
    return (
      <div className="screen onboard">
        <h2>ขอรู้จักกันหน่อย</h2>
        <p className="small">โค้ชจะเรียกชื่อนี้ และตั้งฉากฝึกให้ตรงกับงานของคุณ แก้ทีหลังได้ในตั้งค่า</p>
        <label className="field">
          ชื่อเล่น (ภาษาอังกฤษ)
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น Golf" autoFocus />
        </label>
        <label className="field">
          ตำแหน่งงาน
          <input value={job} onChange={(e) => setJob(e.target.value)} placeholder="เช่น เลขา CEO, HR, ฝ่ายขาย" />
        </label>
        <label className="field">
          บริษัท (ใส่หรือไม่ก็ได้)
          <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="ชื่อบริษัท" />
        </label>
        <button
          className="btn primary big"
          disabled={!name.trim()}
          onClick={() => {
            set({ name: name.trim(), job: job.trim(), company: company.trim() });
            setStep(2);
          }}
        >
          ถัดไป ›
        </button>
      </div>
    );

  if (step === 2)
    return (
      <div className="screen onboard">
        <h2>ฝึกวันละ 2 รอบ</h2>
        <div className="task-card morning static">
          <div className="tc-icon">☀️</div>
          <div className="tc-body">
            <div className="tc-title">Morning Talk · 05:00</div>
            <div className="tc-sub">พูดจริงจัง 17 นาที: คุยกับ Jimmy → Role-play → ดูผล</div>
          </div>
        </div>
        <div className="task-card night static">
          <div className="tc-icon">🌙</div>
          <div className="tc-body">
            <div className="tc-title">Night Review · ก่อนนอน</div>
            <div className="tc-sub">ฟังเบาๆ 10 นาที ทบทวนประโยคที่ฝึกวันนี้ ไม่ต้องพูด</div>
          </div>
        </div>
        <ul className="bullets">
          <li>พูดผิดได้เลย Jimmy จะช่วยทวนประโยคที่ถูกให้ฟังเอง</li>
          <li>นึกไม่ออก <b>กดค้างแล้วพูดไทย</b> จะได้ประโยคอังกฤษให้พูดตาม</li>
          <li>ฝึกเสร็จได้ดาว ⭐ ครบแล้วขึ้นระดับถัดไป เหมือนเล่นเกม</li>
        </ul>
        <button className="btn primary big" onClick={() => setStep(3)}>ถัดไป ›</button>
      </div>
    );

  if (step === 3)
    return (
      <div className="screen onboard">
        <h2>🔒 เรื่องข้อมูล</h2>
        <div className="card">
          <p>✅ ความคืบหน้าและเสียงที่อัด <b>คุณเห็นคนเดียว</b> หัวหน้าหรือ HR ดูไม่ได้</p>
          <p>
            ⚠️ แอปใช้ <b>AI ฟรีของ Google</b> ซึ่งอาจนำบทสนทนาไปใช้พัฒนา จึง <b>ห้ามพูดหรือพิมพ์ข้อมูลจริงหรือข้อมูลลับ</b> ของลูกค้าหรือบริษัท
            ให้ใช้ชื่อสมมติหรือคำกลางๆ เช่น “ลูกค้าญี่ปุ่น”
          </p>
          <p>🎙️ แอปต้องใช้ไมโครโฟน กด “อนุญาต” เมื่อเบราว์เซอร์ถาม</p>
        </div>
        <button className="btn primary big" onClick={() => setStep(4)}>เข้าใจแล้ว ›</button>
      </div>
    );

  return (
    <div className="screen onboard">
      <SnapshotRecorder onDone={finish} onSkip={finish} />
    </div>
  );
}
