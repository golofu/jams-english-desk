import { useMemo, useState } from 'react';
import { CHARACTERS } from '../data/characters';
import { JIMMY_TOPICS, LEVELS, SCENARIOS } from '../data/curriculum';
import { CallView, type CallResult } from '../components/CallView';
import { Review } from '../components/Review';
import { MicCheck } from '../components/MicCheck';
import { Avatar } from '../components/Avatar';
import { jimmyChatPrompt, rolePlayPrompt } from '../lib/prompts';
import { unlockSpeech } from '../lib/audio';
import { dayStr, localDayIndex, uid } from '../lib/store';
import { nextScenario, rolePlaysOn, scenarioVisits } from '../lib/plan';
import { useApp } from '../state';

/** "… (3 days ago)" unless it really was the last practice day. */
function memoryWithAge(memory: string, date?: string): string {
  if (!memory || !date) return memory;
  const days = Math.round((new Date(`${dayStr()}T12:00:00`).getTime() - new Date(`${date}T12:00:00`).getTime()) / 86_400_000);
  return days <= 1 || Number.isNaN(days) ? memory : `${memory} (that was ${days} days ago)`;
}

type Step = 'start' | 'miccheck' | 'chat' | 'roleplay' | 'review' | 'done';

/**
 * Morning Talk: mic check → chat with Jimmy → role-play → review (≈17 min). It's a speaking app: talk to the AI from the first minute.
 * `extra`: one more lesson after the first, any time of day — straight to the role-play, no second coach chat.
 * Jam sets her own pace (3 lessons today, 1 tomorrow); `onMore` starts the next one from the done screen.
 */
export function Morning({ onExit, onMore, scenarioId, extra }: { onExit: () => void; onMore?: () => void; scenarioId?: string; extra?: boolean }) {
  const { data, update } = useApp();
  const prof = data.profile;
  const [step, setStep] = useState<Step>('start');
  const [busy, setBusy] = useState(false);
  const [call, setCall] = useState<CallResult | null>(null);

  const plan = useMemo(() => {
    // Never undefined here: Review only levels up into a level that is available (has scenes).
    const scenario = (SCENARIOS.find((s) => s.id === scenarioId) ?? nextScenario(data.sessions, prof.level))!;
    // Mixed cast: rotate partners per visit of this scene (a day-based index froze on weekdays).
    const charId = scenario.characters[scenarioVisits(data.sessions, scenario.id) % scenario.characters.length];
    const today = localDayIndex();
    const isMonday = new Date(`${dayStr()}T12:00:00`).getDay() === 1;
    // Monday always opens with the weekend topic; other days rotate through the rest.
    const topics = JIMMY_TOPICS.filter((t) => !t.monday);
    const topic = (isMonday && JIMMY_TOPICS.find((t) => t.monday)) || topics[today % topics.length];
    return { scenario, character: CHARACTERS[charId], topic };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prof.level, scenarioId]); // fixed for this visit; the next lesson is a fresh mount (keyed in App)

  const jimmy = CHARACTERS.jimmy;
  const level = LEVELS[prof.level - 1];
  const [chatLogged, setChatLogged] = useState(false);

  /** The coach chat is real practice: it counts for the streak even if the role-play fails. */
  function logChat(minutes: number) {
    if (chatLogged) return;
    setChatLogged(true);
    update('sessions', (s) => [{ id: uid(), date: startDay, kind: 'morning', level: prof.level, minutes, createdAt: Date.now() }, ...s]);
  }
  const [startDay] = useState(() => dayStr()); // a session that runs past midnight stays on the day it began

  if (step === 'start' && extra)
    return (
      <div className="screen morning">
        <button className="link back" onClick={onExit}>‹ กลับ</button>
        <div className="kicker">➕ ฝึกบทต่อไป · ระดับ {prof.level} {level.nameEn}</div>
        <h2>อีกบทนะ แจม!</h2>
        <div className="plan">
          <PlanRow n="1" t={`Role-play: ${plan.scenario.titleTh} กับ ${plan.character.name}`} m="8 นาที" />
          <PlanRow n="2" t="ดูผล + เก็บประโยค" m="4 นาที" />
        </div>
        <button
          className="btn primary big"
          onClick={() => {
            unlockSpeech(); // iOS: allow later speech after this tap
            setStep('miccheck');
          }}
        >
          เริ่มเลย
        </button>
      </div>
    );

  if (step === 'start')
    return (
      <div className="screen morning">
        <button className="link back" onClick={onExit}>‹ กลับ</button>
        <div className="kicker">☀️ Morning Talk · ระดับ {prof.level} {level.nameEn}</div>
        <h2>อรุณสวัสดิ์ แจม!</h2>
        <div className="plan">
          <PlanRow n="1" t={`คุยกับ ${prof.coachName}: ${plan.topic.th}`} m="5 นาที" />
          <PlanRow n="2" t={`Role-play: ${plan.scenario.titleTh} กับ ${plan.character.name}`} m="8 นาที" dim={busy} />
          <PlanRow n="3" t="ดูผล + เก็บประโยค" m="4 นาที" dim={busy} />
        </div>
        <label className="toggle">
          <input type="checkbox" checked={busy} onChange={(e) => setBusy(e.target.checked)} />
          วันนี้ยุ่ง คุยกับโค้ชอย่างเดียว (5 นาที) ยังนับวันต่อเนื่อง
        </label>
        <button
          className="btn primary big"
          onClick={() => {
            unlockSpeech(); // iOS: allow later speech after this tap
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
        <MicCheck onPass={() => setStep(extra ? 'roleplay' : 'chat')} onSkip={() => setStep(extra ? 'roleplay' : 'chat')} />
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
        kicker="ขั้นที่ 1 · คุยกับโค้ช"
        title={plan.topic.en}
        situationTh={`คุยเล่นกับ ${prof.coachName} เรื่อง "${plan.topic.th}" ตอบสั้นๆ ก็ได้ ไม่ต้องกลัวผิด`}
        system={jimmyChatPrompt({ coachName: prof.coachName, speed: prof.speed, topic: plan.topic.en, memory: memoryWithAge(prof.memory, prof.memoryDate), level: prof.level })}
        seconds={300}
        // Shy or offline in the chat: she can still go on to the role-play. On a busy day the chat
        // is the whole session, so nothing was practised: back home, no "well done" screen.
        onCancel={() => (busy ? onExit() : setStep('roleplay'))}
        onDone={(r) => {
          logChat(Math.max(1, Math.round(r.seconds / 60)));
          setStep(busy ? 'done' : 'roleplay');
        }}
      />
    );

  if (step === 'roleplay')
    return (
      <CallView
        key="roleplay"
        character={plan.character}
        kicker={`ขั้นที่ 2 · Role-play ระดับ ${prof.level}`}
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
        <div className="kicker">ขั้นที่ 3 · ดูผล</div>
        <Review scenario={plan.scenario} call={call} kind="morning" character={plan.character.id} onNext={() => setStep('done')} nextLabel="เสร็จแล้ว ›" />
      </div>
    );

  const lessons = rolePlaysOn(data.sessions, startDay);
  return (
    <div className="screen center-col">
      <Avatar character={jimmy} style={prof.style} size={170} />
      <h2>เก่งมาก แจม! 🎉</h2>
      <p>
        {lessons > 1 ? `วันนี้ฝึกไปแล้ว ${lessons} บท` : 'Morning Talk วันนี้เสร็จแล้ว'} ยังไหวก็ไปบทต่อไปได้เลย
        ถ้าพอแค่นี้ คืนนี้ก่อนนอนมาฟังทบทวนอีก 10 นาทีนะ
      </p>
      {onMore && (
        <button className="btn primary big" onClick={onMore}>➕ ฝึกบทต่อไป</button>
      )}
      <button className={onMore ? 'btn' : 'btn primary big'} onClick={onExit}>พอแค่นี้ กลับหน้าแรก</button>
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
