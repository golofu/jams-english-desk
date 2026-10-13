import { useMemo, useState } from 'react';
import { CHARACTERS } from '../data/characters';
import { JIMMY_TOPICS, LEVELS, SCENARIOS } from '../data/curriculum';
import { CallView, type CallResult } from '../components/CallView';
import { Review } from '../components/Review';
import { Shadowing } from '../components/Shadowing';
import { Avatar } from '../components/Avatar';
import { jimmyChatPrompt, rolePlayPrompt } from '../lib/prompts';
import { unlockSpeech } from '../lib/audio';
import { dayStr, uid } from '../lib/store';
import { useApp } from '../state';

type Step = 'start' | 'warmup' | 'chat' | 'roleplay' | 'review' | 'done';

const dayNumber = () => Math.floor(Date.now() / 86_400_000);

/** Morning Talk: warm-up → chat with Jimmy → role-play → review (≈20 min). */
export function Morning({ onExit, scenarioId }: { onExit: () => void; scenarioId?: string }) {
  const { data, update } = useApp();
  const prof = data.profile;
  const [step, setStep] = useState<Step>('start');
  const [busy, setBusy] = useState(false);
  const [call, setCall] = useState<CallResult | null>(null);

  const plan = useMemo(() => {
    const pool = SCENARIOS.filter((s) => s.level === prof.level);
    const done = data.sessions.filter((s) => s.kind === 'morning' && s.level === prof.level && s.stars).length;
    const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? pool[done % pool.length];
    // Mixed cast: the same scene may bring a different partner each time.
    const charId = scenario.characters[(dayNumber() + done) % scenario.characters.length];
    const topic = JIMMY_TOPICS[dayNumber() % JIMMY_TOPICS.length];
    const due = data.phrases.filter((p) => p.due <= dayStr()).slice(0, 3);
    const warm = due.length >= 3 ? due : [...due, ...scenario.keyPhrases].slice(0, 3);
    return { scenario, character: CHARACTERS[charId], topic, warm };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prof.level, scenarioId]);

  const jimmy = CHARACTERS.jimmy;
  const level = LEVELS[prof.level - 1];

  function logBusyDay() {
    update('sessions', (s) => [{ id: uid(), date: dayStr(), kind: 'morning', level: prof.level, minutes: 8, createdAt: Date.now() }, ...s]);
    setStep('done');
  }

  if (step === 'start')
    return (
      <div className="screen morning">
        <button className="link back" onClick={onExit}>‹ กลับ</button>
        <div className="kicker">☀️ Morning Talk · ระดับ {prof.level} {level.nameEn}</div>
        <h2>อรุณสวัสดิ์ แจม!</h2>
        <div className="plan">
          <PlanRow n="1" t="Warm-up พูดตาม" m="3 นาที" />
          <PlanRow n="2" t={`คุยกับ ${prof.coachName}: ${plan.topic.th}`} m="5 นาที" />
          <PlanRow n="3" t={`Role-play: ${plan.scenario.titleTh} กับ ${plan.character.name}`} m="8 นาที" dim={busy} />
          <PlanRow n="4" t="ดูผล + เก็บประโยค" m="4 นาที" dim={busy} />
        </div>
        <label className="toggle">
          <input type="checkbox" checked={busy} onChange={(e) => setBusy(e.target.checked)} />
          วันนี้ยุ่ง ทำแค่ข้อ 1–2 (8 นาที) ยังนับวันต่อเนื่อง
        </label>
        <button
          className="btn primary big"
          onClick={() => {
            unlockSpeech(); // iOS: allow the warm-up to auto-play after this tap
            setStep('warmup');
          }}
        >
          เริ่มเลย
        </button>
      </div>
    );

  if (step === 'warmup')
    return (
      <div className="screen">
        <div className="kicker">ขั้นที่ 1 · Warm-up</div>
        <h3>ฟังแล้วพูดตาม</h3>
        <Shadowing phrases={plan.warm} speed={prof.speed} onDone={() => setStep('chat')} />
      </div>
    );

  if (step === 'chat')
    return (
      // Distinct keys: both steps render CallView at the same spot, and without them React
      // reuses the finished Jimmy call for the role-play (no new session, stale transcript).
      <CallView
        key="chat"
        character={jimmy}
        displayName={prof.coachName}
        kicker="ขั้นที่ 2 · คุยกับโค้ช"
        title={plan.topic.en}
        situationTh={`คุยเล่นกับ ${prof.coachName} เรื่อง "${plan.topic.th}" ตอบสั้นๆ ก็ได้ ไม่ต้องกลัวผิด`}
        system={jimmyChatPrompt({ coachName: prof.coachName, speed: prof.speed, topic: plan.topic.en, memory: prof.memory, level: prof.level })}
        seconds={300}
        onCancel={onExit}
        onDone={() => (busy ? logBusyDay() : setStep('roleplay'))}
      />
    );

  if (step === 'roleplay')
    return (
      <CallView
        key="roleplay"
        character={plan.character}
        kicker={`ขั้นที่ 3 · Role-play ระดับ ${prof.level}`}
        title={`${plan.scenario.titleTh} · ${plan.scenario.titleEn}`}
        situationTh={plan.scenario.situationTh}
        keyPhrases={plan.scenario.keyPhrases}
        tasks={plan.scenario.tasks}
        system={rolePlayPrompt({ scenario: plan.scenario, character: plan.character.id, speed: prof.speed })}
        seconds={480}
        onCancel={onExit}
        onDone={(r) => {
          setCall(r);
          setStep('review');
        }}
      />
    );

  if (step === 'review' && call)
    return (
      <div className="screen">
        <div className="kicker">ขั้นที่ 4 · ดูผล</div>
        <Review scenario={plan.scenario} call={call} kind="morning" character={plan.character.id} onNext={() => setStep('done')} nextLabel="เสร็จแล้ว ›" />
      </div>
    );

  return (
    <div className="screen center-col">
      <Avatar character={jimmy} style={prof.style} size={170} />
      <h2>เก่งมาก แจม! 🎉</h2>
      <p>Morning Talk วันนี้เสร็จแล้ว คืนนี้ก่อนนอนมาฟังทบทวนอีก 10 นาทีนะ</p>
      <button className="btn primary big" onClick={onExit}>กลับหน้าแรก</button>
    </div>
  );
}

function PlanRow({ n, t, m, dim }: { n: string; t: string; m: string; dim?: boolean }) {
  return (
    <div className={`plan-row ${dim ? 'dim' : ''}`}>
      <span className="n">{n}</span>
      <span className="t">{t}</span>
      <span className="m">{m}</span>
    </div>
  );
}
