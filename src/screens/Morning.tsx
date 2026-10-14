import { useMemo, useState } from 'react';
import { CHARACTERS } from '../data/characters';
import { JIMMY_TOPICS, LEVELS, SCENARIOS } from '../data/curriculum';
import { CallView, type CallResult } from '../components/CallView';
import { Review } from '../components/Review';
import { Shadowing } from '../components/Shadowing';
import { MicCheck } from '../components/MicCheck';
import { Avatar } from '../components/Avatar';
import { jimmyChatPrompt, rolePlayPrompt } from '../lib/prompts';
import { unlockSpeech } from '../lib/audio';
import { byDue, dayStr, localDayIndex, passedStars, uid } from '../lib/store';
import { useApp } from '../state';

/** "… (3 days ago)" unless it really was the last practice day. */
function memoryWithAge(memory: string, date?: string): string {
  if (!memory || !date) return memory;
  const days = Math.round((new Date(`${dayStr()}T12:00:00`).getTime() - new Date(`${date}T12:00:00`).getTime()) / 86_400_000);
  return days <= 1 || Number.isNaN(days) ? memory : `${memory} (that was ${days} days ago)`;
}

type Step = 'start' | 'miccheck' | 'warmup' | 'chat' | 'roleplay' | 'review' | 'done';

/** Morning Talk: warm-up → chat with Jimmy → role-play → review (≈20 min). */
export function Morning({ onExit, scenarioId }: { onExit: () => void; scenarioId?: string }) {
  const { data, update } = useApp();
  const prof = data.profile;
  const [step, setStep] = useState<Step>('start');
  const [busy, setBusy] = useState(false);
  const [call, setCall] = useState<CallResult | null>(null);

  const plan = useMemo(() => {
    const pool = SCENARIOS.filter((s) => s.level === prof.level);
    // Visits = role-plays actually held (stars or not), so a failed AI review never
    // freezes the rotation on the same scene.
    const visits = (id: string) => data.sessions.filter((s) => s.kind === 'morning' && s.scenarioId === id).length;
    const passedIds = new Set(data.sessions.filter((s) => s.kind === 'morning' && passedStars(s.stars)).map((s) => s.scenarioId));
    // Next scene: not yet passed first, then least practised, in curriculum order.
    const scenario =
      SCENARIOS.find((s) => s.id === scenarioId) ??
      [...pool].sort((a, b) => Number(passedIds.has(a.id)) - Number(passedIds.has(b.id)) || visits(a.id) - visits(b.id))[0];
    // Mixed cast: rotate partners per visit of this scene (a day-based index froze on weekdays).
    const charId = scenario.characters[visits(scenario.id) % scenario.characters.length];
    const today = localDayIndex();
    const isMonday = new Date(`${dayStr()}T12:00:00`).getDay() === 1;
    // Monday always opens with the weekend topic; other days rotate through the rest.
    const topics = JIMMY_TOPICS.filter((t) => !t.monday);
    const topic = (isMonday && JIMMY_TOPICS.find((t) => t.monday)) || topics[today % topics.length];
    // Warm-up primes today's role-play (2 key phrases) + the phrase that has waited longest.
    const due = data.phrases.filter((p) => p.due <= dayStr()).sort(byDue)[0];
    const warm = due ? [...scenario.keyPhrases.slice(0, 2), due] : scenario.keyPhrases.slice(0, 3);
    return { scenario, character: CHARACTERS[charId], topic, warm };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prof.level, scenarioId]);

  const jimmy = CHARACTERS.jimmy;
  const level = LEVELS[prof.level - 1];
  const [chatLogged, setChatLogged] = useState(false);

  /** Warm-up + coach chat is real practice: it counts for the streak even if the role-play fails. */
  function logChat(minutes: number) {
    if (chatLogged) return;
    setChatLogged(true);
    update('sessions', (s) => [{ id: uid(), date: startDay, kind: 'morning', level: prof.level, minutes, createdAt: Date.now() }, ...s]);
  }
  const [startDay] = useState(() => dayStr()); // a session that runs past midnight stays on the day it began

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
            setStep('miccheck');
          }}
        >
          เริ่มเลย
        </button>
      </div>
    );

  // Every step from here on needs the mic; a 3-second check beats finding out mid-call.
  if (step === 'miccheck')
    return (
      <div className="screen">
        <button className="link back" onClick={onExit}>‹ กลับ</button>
        <MicCheck onPass={() => setStep('warmup')} onSkip={() => setStep('warmup')} />
      </div>
    );

  if (step === 'warmup')
    return (
      <div className="screen">
        <button className="link back" onClick={onExit}>‹ กลับ</button>
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
        system={jimmyChatPrompt({ coachName: prof.coachName, speed: prof.speed, topic: plan.topic.en, memory: memoryWithAge(prof.memory, prof.memoryDate), level: prof.level })}
        seconds={300}
        // Shy or offline in the chat: the warm-up still counts, and she can go on to the role-play.
        onCancel={() => {
          logChat(3);
          setStep(busy ? 'done' : 'roleplay');
        }}
        onDone={(r) => {
          logChat(3 + Math.max(1, Math.round(r.seconds / 60)));
          setStep(busy ? 'done' : 'roleplay');
        }}
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
        // The chat already counted; end on the done screen rather than dumping her at home.
        onCancel={() => (chatLogged ? setStep('done') : onExit())}
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
