import { useState } from 'react';
import { speak } from '../lib/audio';
import { useApp } from '../state';

export function Phrases() {
  const { data, update } = useApp();
  const [q, setQ] = useState('');
  const list = data.phrases.filter((p) => !q || `${p.en} ${p.th}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="screen">
      <h2>ประโยคของฉัน</h2>
      <p className="small">ประโยคจากการฝึกทุกครั้งจะเก็บไว้ที่นี่ และกลับมาให้ทบทวนตอน Night Review</p>
      <input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหา…" />
      {!list.length && <div className="empty">ยังไม่มีประโยค เริ่ม Morning Talk แล้วประโยคจะถูกเก็บให้อัตโนมัติ</div>}
      {list.map((p) => (
        <div key={p.id} className="phrase-item">
          <button className="phrase-row" onClick={() => speak(p.en, { rate: 0.85 })}>
            <span className="en">🔊 {p.en}</span>
            <span className="th">{p.th}</span>
          </button>
          <div className="meta">
            <span title="ระดับความจำ">{'●'.repeat(p.box + 1)}{'○'.repeat(4 - p.box)}</span>
            <span>{p.source}</span>
            <button className="link" onClick={() => update('phrases', (ps) => ps.filter((x) => x.id !== p.id))}>ลบ</button>
          </div>
        </div>
      ))}
    </div>
  );
}
