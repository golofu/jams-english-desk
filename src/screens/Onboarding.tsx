import { useState } from 'react';
import { CHARACTERS } from '../data/characters';
import { Avatar } from '../components/Avatar';
import { SnapshotRecorder } from '../components/SnapshotRecorder';
import { speak } from '../lib/audio';
import { useApp } from '../state';
import { BRAND } from '../brand';

export function Onboarding() {
  const { data, update } = useApp();
  const [step, setStep] = useState(0);
  const finish = () => update('profile', (p) => ({ ...p, onboarded: true }));
  const jimmy = CHARACTERS.jimmy;
  const style = data.profile.style;

  if (step === 0)
    return (
      <div className="screen onboard center-col">
        <img src={BRAND.logo} alt={BRAND.company} className="logo big" />
        <Avatar character={jimmy} style={style} size={200} />
        <h2>สวัสดีค่ะ แจม 👋</h2>
        <p>
          นี่คือ <b>Jimmy</b> โค้ชภาษาอังกฤษส่วนตัวของแจม อดีตผู้บริหารบริษัทข้ามชาติ จะช่วยฝึกพูดและฟังสำหรับงานเลขา CEO ที่ {BRAND.company}
        </p>
        <button className="btn" onClick={() => speak("Hi Jam! I'm Jimmy. Nice to meet you. Let's practice English together, step by step.", { rate: 0.85, gender: 'male' })}>
          🔊 ฟัง Jimmy ทักทาย
        </button>
        <button className="btn primary big" onClick={() => setStep(1)}>ถัดไป ›</button>
      </div>
    );

  if (step === 1)
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
        <button className="btn primary big" onClick={() => setStep(2)}>ถัดไป ›</button>
      </div>
    );

  if (step === 2)
    return (
      <div className="screen onboard">
        <h2>🔒 เรื่องข้อมูล</h2>
        <div className="card">
          <p>✅ ความคืบหน้าและเสียงที่อัด <b>แจมเห็นคนเดียว</b> CEO หรือ HR ดูไม่ได้</p>
          <p>
            ⚠️ แอปใช้ <b>AI ฟรีของ Google</b> ซึ่งอาจนำบทสนทนาไปใช้พัฒนา จึง <b>ห้ามพูดหรือพิมพ์ข้อมูลจริงหรือข้อมูลลับ</b> ของลูกค้าหรือบริษัท
            ให้ใช้ชื่อสมมติหรือคำกลางๆ เช่น “ลูกค้าญี่ปุ่น”
          </p>
          <p>🎙️ แอปต้องใช้ไมโครโฟน กด “อนุญาต” เมื่อเบราว์เซอร์ถาม</p>
        </div>
        <button className="btn primary big" onClick={() => setStep(3)}>เข้าใจแล้ว ›</button>
      </div>
    );

  return (
    <div className="screen onboard">
      <SnapshotRecorder onDone={finish} onSkip={finish} />
    </div>
  );
}
