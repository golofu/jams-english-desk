import { useEffect, useRef, useState } from 'react';
import { CHARACTERS, type CharacterId } from '../data/characters';
import type { Scenario } from '../data/curriculum';
import { CallView, type CallResult } from '../components/CallView';
import { Review } from '../components/Review';
import { apiErrorTh, coach } from '../lib/api';
import { SPEECH_RATE, b64FromBytes, speak, startMic, wavFromPcm16, type Mic } from '../lib/audio';
import { rolePlayPrompt } from '../lib/prompts';
import { useApp } from '../state';

type Prepped = Omit<Scenario, 'id' | 'level' | 'characters'> & { character: CharacterId };

/** "ซ้อมก่อนเจอจริง": describe tomorrow in Thai → custom phrases → rehearse it now. */
export function Prep({ onExit }: { onExit: () => void }) {
  const { data } = useApp();
  const prof = data.profile;
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [plan, setPlan] = useState<Prepped | null>(null);
  const [step, setStep] = useState<'ask' | 'phrases' | 'call' | 'review'>('ask');
  const [call, setCall] = useState<CallResult | null>(null);
  const [rec, setRec] = useState(false);
  const mic = useRef<Mic | null>(null);
  const chunks = useRef<Int16Array[]>([]);

  async function make(body: object) {
    setBusy(true);
    setErr('');
    try {
      setPlan(await coach<Prepped>('prep', body));
      setStep('phrases');
    } catch (e) {
      setErr(apiErrorTh(e));
    } finally {
      setBusy(false);
    }
  }

  const held = useRef(false);
  async function holdStart() {
    held.current = true;
    try {
      chunks.current = [];
      const m = await startMic((c) => chunks.current.push(c));
      // Finger lifted while the mic was opening (e.g. permission prompt): close it right away.
      if (!held.current) return m.stop();
      mic.current?.stop();
      mic.current = m;
      setRec(true);
    } catch {
      setErr('เปิดไมโครโฟนไม่ได้ ลองพิมพ์แทนได้ค่ะ');
    }
  }
  function holdEnd() {
    held.current = false;
    if (!mic.current) return;
    mic.current.stop();
    mic.current = null;
    setRec(false);
    if (chunks.current.length < 8) return setErr('พูดนานกว่านี้หน่อย กดค้างไว้ระหว่างพูดนะคะ');
    void make({ audio: { data: b64FromBytes(wavFromPcm16(chunks.current.slice(0, 600))), mimeType: 'audio/wav' } });
  }
  // Leaving the screen while holding must not leave the mic on.
  useEffect(() => () => mic.current?.stop(), []);

  const scenario: Scenario | null = plan
    ? { ...plan, id: 'prep', level: prof.level, characters: [plan.character] }
    : null;

  if (step === 'call' && plan && scenario)
    return (
      <CallView
        character={CHARACTERS[plan.character]}
        kicker="ซ้อมก่อนเจอจริง"
        title={plan.titleTh}
        situationTh={plan.situationTh}
        keyPhrases={plan.keyPhrases}
        tasks={plan.tasks}
        system={rolePlayPrompt({ learner: prof, scenario, character: plan.character, speed: prof.speed })}
        seconds={420}
        onCancel={() => setStep('phrases')}
        onDone={(r) => {
          setCall(r);
          setStep('review');
        }}
      />
    );

  if (step === 'review' && call && scenario && plan)
    return (
      <div className="screen">
        <Review scenario={scenario} call={call} kind="prep" character={plan.character} onNext={onExit} nextLabel="พร้อมเจอของจริงแล้ว ›" />
      </div>
    );

  if (step === 'phrases' && plan)
    return (
      <div className="screen">
        <button className="link back" onClick={() => setStep('ask')}>‹ แก้เรื่อง</button>
        <div className="kicker">ซ้อมก่อนเจอจริง</div>
        <h2>{plan.titleTh}</h2>
        <p className="situation">{plan.situationTh}</p>
        <div className="card phrases-card">
          <div className="card-title">{prof.coachName}: 5 ประโยคที่ต้องใช้ (กดเพื่อฟัง)</div>
          {plan.keyPhrases.map((k) => (
            <button key={k.en} className="phrase-row" onClick={() => speak(k.en, { rate: SPEECH_RATE[prof.speed] })}>
              <span className="en">🔊 {k.en}</span>
              <span className="th">{k.th}</span>
            </button>
          ))}
        </div>
        <button className="btn primary big" onClick={() => setStep('call')}>
          🎙️ ซ้อมกับ {CHARACTERS[plan.character].name}
        </button>
      </div>
    );

  return (
    <div className="screen">
      <button className="link back" onClick={onExit}>‹ กลับ</button>
      <div className="kicker">🎯 ซ้อมก่อนเจอจริง</div>
      <h2>พรุ่งนี้คุณจะเจออะไร?</h2>
      <p>เล่าเป็นภาษาไทยได้เลย เช่น “พรุ่งนี้ต้องโทรเลื่อนนัดลูกค้าญี่ปุ่น เพราะ CEO ติดธุระ”</p>
      <div className="warn">⚠️ อย่าใส่ชื่อจริงหรือข้อมูลลับของลูกค้า ใช้คำกลางๆ เช่น “ลูกค้าญี่ปุ่น” แทน</div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="พิมพ์เรื่องที่จะเจอ…" />
      <button className="btn primary big" disabled={busy || !text.trim()} onClick={() => make({ text })}>
        {busy ? `${prof.coachName} กำลังเตรียมบทให้…` : 'ให้โค้ชเตรียมบทซ้อม'}
      </button>
      <div className="or">หรือ</div>
      <button
        className={`btn big hold ${rec ? 'danger' : ''}`}
        disabled={busy}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          void holdStart();
        }}
        onPointerUp={holdEnd}
        onPointerCancel={holdEnd}
        onContextMenu={(e) => e.preventDefault()}
      >
        {rec ? '🔴 กำลังฟัง… ปล่อยเมื่อพูดจบ' : '🎙️ กดค้างแล้วเล่าเป็นภาษาไทย'}
      </button>
      {err && <div className="alert">{err}</div>}
    </div>
  );
}
