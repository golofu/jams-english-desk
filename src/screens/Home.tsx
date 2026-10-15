import { CHARACTERS } from '../data/characters';
import { LEVELS, SCENARIOS } from '../data/curriculum';
import { Avatar } from '../components/Avatar';
import { UsageCard } from '../components/UsageCard';
import { dayStr, levelStatus, streak } from '../lib/store';
import { nextScenario, rolePlaysOn } from '../lib/plan';
import { useApp } from '../state';

export type Go = (r: 'morning' | 'more' | 'night' | 'prep') => void;

function greeting(h: number) {
  if (h < 11) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function Home({ go }: { go: Go }) {
  const { data } = useApp();
  const prof = data.profile;
  const today = dayStr();
  const didMorning = data.sessions.some((s) => s.date === today && s.kind === 'morning');
  const didNight = data.sessions.some((s) => s.date === today && s.kind === 'night');
  const s = streak(data.sessions);
  const lessonsToday = rolePlaysOn(data.sessions, today);
  const next = nextScenario(data.sessions, prof.level);
  const level = LEVELS[prof.level - 1];
  const st = levelStatus(data.sessions, prof.level, SCENARIOS.filter((x) => x.level === prof.level).length);
  const hour = new Date().getHours();
  const nightFirst = hour >= 17 && didMorning;
  // Level 3+ ships later: don't leave Jam staring at "3/3" with nothing happening.
  const maxed = st.ready && !LEVELS[prof.level]?.available;

  const morning = (
    <button key="m" className={`task-card morning ${didMorning ? 'done' : ''}`} onClick={() => go('morning')}>
      <div className="tc-icon">☀️</div>
      <div className="tc-body">
        <div className="tc-title">Morning Talk</div>
        <div className="tc-sub">{prof.morningTime} · พูด 17 นาที</div>
      </div>
      <div className="tc-go">{didMorning ? '✓ เสร็จแล้ว' : 'เริ่ม ›'}</div>
    </button>
  );
  const night = (
    <button key="n" className={`task-card night ${didNight ? 'done' : ''}`} onClick={() => go('night')}>
      <div className="tc-icon">🌙</div>
      <div className="tc-body">
        <div className="tc-title">Night Review</div>
        <div className="tc-sub">{prof.nightTime} · ฟัง 10 นาที ไม่ต้องพูด</div>
      </div>
      <div className="tc-go">{didNight ? '✓ เสร็จแล้ว' : 'เริ่ม ›'}</div>
    </button>
  );

  // No daily cap: once the morning is done, the next lesson is always one tap away.
  const more = didMorning && (
    <button key="x" className="task-card more" onClick={() => go('more')}>
      <div className="tc-icon">➕</div>
      <div className="tc-body">
        <div className="tc-title">ฝึกบทต่อไป</div>
        <div className="tc-sub">
          {next.titleTh} · 12 นาที{lessonsToday > 0 ? ` · วันนี้ฝึกแล้ว ${lessonsToday} บท` : ''}
        </div>
      </div>
      <div className="tc-go">เริ่ม ›</div>
    </button>
  );

  return (
    <div className="screen home">
      <div className="hero">
        <Avatar character={CHARACTERS.jimmy} style={prof.style} size={120} />
        <div className="bubble">
          <b>{greeting(hour)}, Jam!</b>
          <div>
            {didMorning && didNight
              ? 'วันนี้ครบทั้ง 2 รอบแล้ว เก่งมาก!'
              : didMorning
                ? 'เช้านี้ทำได้ดีมาก คืนนี้มาทบทวนกันนะ'
                : `${prof.coachName} รออยู่ มาฝึกพูดกัน`}
          </div>
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <b>🔥 {s}</b>
          <span>วันต่อเนื่อง</span>
        </div>
        <div className="stat">
          <b>ระดับ {prof.level}</b>
          <span>{level.nameEn}</span>
        </div>
        <div className="stat">
          {maxed ? (
            <>
              <b>✓</b>
              <span>ระดับ {prof.level + 1} มาเร็วๆ นี้</span>
            </>
          ) : (
            <>
              <b>{Math.min(st.scenarios, st.needScenarios)}/{st.needScenarios}</b>
              <span>บทที่ผ่านในระดับนี้</span>
            </>
          )}
        </div>
      </div>

      <h3 className="section">วันนี้</h3>
      {nightFirst ? [night, morning, more] : [morning, more, night]}

      <button className="task-card prep" onClick={() => go('prep')}>
        <div className="tc-icon">🎯</div>
        <div className="tc-body">
          <div className="tc-title">ซ้อมก่อนเจอจริง</div>
          <div className="tc-sub">เล่าเป็นภาษาไทยว่าจะเจออะไร แล้วซ้อมกับตัวละคร</div>
        </div>
        <div className="tc-go">›</div>
      </button>
      <UsageCard />
      <p className="privacy-note">⚠️ AI ฟรีอาจนำบทสนทนาไปใช้พัฒนา อย่าพูดหรือพิมพ์ข้อมูลจริงหรือข้อมูลลับของลูกค้าและบริษัท</p>
    </div>
  );
}
