import { useState } from 'react';
import { LEVELS, SCENARIOS } from '../data/curriculum';
import { SnapshotRecorder } from '../components/SnapshotRecorder';
import { getClip } from '../lib/idb';
import { LEVEL_UP_DAYS, dayStr, levelStatus, streak, type SnapshotMeta } from '../lib/store';
import { useApp } from '../state';

export function Progress() {
  const { data } = useApp();
  const [recording, setRecording] = useState(false);
  const [msg, setMsg] = useState('');
  const prof = data.profile;
  const s = streak(data.sessions);
  const totalMin = data.sessions.reduce((a, x) => a + (x.minutes ?? 0), 0);
  const thisMonth = dayStr().slice(0, 7);
  const recordedThisMonth = data.snapshots.some((x) => x.date.startsWith(thisMonth));

  async function play(snap: SnapshotMeta) {
    setMsg('');
    // Create the player inside the tap: iOS blocks play() that starts after async work otherwise.
    const audio = new Audio();
    try {
      let blob = await getClip(snap.id);
      if (!blob && snap.remotePath) {
        // Older rows stored "<userId>/<file>" (Supabase era); the Worker keys by file name only.
        const r = await fetch(`/api/snapshots/${snap.remotePath.split('/').pop()}`).catch(() => null);
        if (r?.ok) blob = await r.blob();
      }
      if (!blob) return setMsg('ไม่พบไฟล์เสียงในเครื่องนี้');
      const url = URL.createObjectURL(blob);
      audio.onended = () => URL.revokeObjectURL(url);
      audio.src = url;
      await audio.play();
    } catch {
      setMsg('เปิดเสียงไม่ได้ ลองแตะอีกครั้งนะคะ');
    }
  }

  if (recording)
    return (
      <div className="screen">
        <SnapshotRecorder onDone={() => setRecording(false)} onSkip={() => setRecording(false)} />
      </div>
    );

  return (
    <div className="screen">
      <h2>ความคืบหน้า</h2>
      <div className="stats">
        <div className="stat"><b>🔥 {s}</b><span>วันต่อเนื่อง</span></div>
        <div className="stat"><b>{totalMin}</b><span>นาทีที่ฝึก</span></div>
        <div className="stat"><b>{data.phrases.length}</b><span>ประโยคในคลัง</span></div>
      </div>

      <div className="card">
        <div className="card-title">ระดับ</div>
        {LEVELS.map((l) => {
          const done = l.n < prof.level;
          const cur = l.n === prof.level;
          const st = levelStatus(data.sessions, l.n, SCENARIOS.filter((x) => x.level === l.n).length);
          const days = Math.min(st.days, LEVEL_UP_DAYS);
          const scen = Math.min(st.scenarios, st.needScenarios);
          // Average of both requirements, capped (the old bar ran past 100%).
          const pct = Math.round(((days / LEVEL_UP_DAYS + scen / st.needScenarios) / 2) * 100);
          return (
            <div key={l.n} className={`level-row ${cur ? 'cur' : ''} ${!l.available ? 'locked' : ''}`}>
              <span className="badge">{done ? '✓' : l.available ? l.n : '🔒'}</span>
              <div>
                <b>{l.nameEn}</b> · {l.nameTh}
                <div className="small">{l.available ? l.goalTh : 'เร็วๆ นี้'}</div>
                {cur && <div className="bar"><i style={{ width: `${pct}%` }} /></div>}
                {cur && (
                  <div className="small">
                    ผ่าน (≥2 ดาวทุกด้าน) {scen}/{st.needScenarios} บท · {days}/{LEVEL_UP_DAYS} วัน
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="card-title">🎙️ Voice Snapshot ก่อน–หลัง</div>
        {!data.snapshots.length && <p className="small">ยังไม่มีเสียงที่อัดไว้</p>}
        {data.snapshots.map((x, idx) => (
          <div key={x.id} className="snap-row">
            <span>
              {x.date} {idx === data.snapshots.length - 1 ? '(ครั้งแรก)' : ''}
            </span>
            <button className="btn small" onClick={() => play(x)}>▶️ ฟัง</button>
          </div>
        ))}
        {msg && <div className="small">{msg}</div>}
        <button className="btn" onClick={() => setRecording(true)}>
          {recordedThisMonth ? 'อัดใหม่อีกครั้ง' : '🎙️ อัด Snapshot ประจำเดือนนี้'}
        </button>
      </div>

      <div className="card">
        <div className="card-title">ประวัติล่าสุด</div>
        {data.sessions.filter((x) => x.kind !== 'snapshot').slice(0, 12).map((x) => (
          <div key={x.id} className="hist-row">
            <span>{x.date.slice(5)}</span>
            <span className="t">{x.kind === 'night' ? '🌙 Night Review' : x.kind === 'prep' ? `🎯 ${x.scenarioTitle}` : `☀️ ${x.scenarioTitle ?? 'คุยกับโค้ช'}`}</span>
            <span className="stars">{x.stars ? '★'.repeat(Math.min(x.stars.task, x.stars.listening, x.stars.fluency)) : ''}</span>
          </div>
        ))}
        {!data.sessions.length && <p className="small">เริ่ม Morning Talk ครั้งแรกได้ที่หน้าแรก</p>}
      </div>
    </div>
  );
}
