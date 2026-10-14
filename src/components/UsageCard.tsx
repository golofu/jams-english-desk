import { useEffect, useState } from 'react';
import { canCallQuietly } from '../lib/api';
import { textQuota, voiceQuotaOut, type TextQuota } from '../lib/usage';

/** "How much free AI is left today", on the home screen. */
export function UsageCard() {
  const [text, setText] = useState<TextQuota | 'loading' | 'error'>('loading');
  const voiceOut = voiceQuotaOut();

  useEffect(() => {
    if (!canCallQuietly()) return setText('error');
    let alive = true;
    textQuota()
      .then((t) => alive && setText(t))
      .catch(() => alive && setText('error'));
    return () => {
      alive = false;
    };
  }, []);

  const textLine =
    text === 'loading'
      ? 'กำลังเช็ค…'
      : text === 'error' || !text
        ? 'เช็คไม่ได้ตอนนี้'
        : `เหลือ ${text.remaining.toLocaleString()} จาก ${text.limit.toLocaleString()} ครั้ง`;
  const low = typeof text === 'object' && text && text.remaining < text.limit * 0.1;

  return (
    <div className="usage-card">
      <div className="usage-title">AI ฟรีที่เหลือวันนี้</div>
      <div className="usage-row">
        <span>คุยด้วยเสียง</span>
        <b className={voiceOut ? 'warn' : 'ok'}>{voiceOut ? 'หมดแล้ว ใช้โหมดสำรองแทน' : 'ใช้ได้'}</b>
      </div>
      <div className="usage-row">
        <span>คำแปล ตัวช่วย ตรวจผล</span>
        <b className={low ? 'warn' : 'ok'}>{textLine}</b>
      </div>
      <div className="usage-note">คุยด้วยเสียงได้ใหม่ทุกวันประมาณบ่าย 2–3 โมง ส่วนคำแปลค่อยๆ เพิ่มคืนมาเองตลอดวัน</div>
    </div>
  );
}
