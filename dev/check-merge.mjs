// Dev check: two devices' copies merge without losing anything (store.mergeKey).
import { createServer } from 'vite';
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', configFile: false, logLevel: 'silent' });
const { mergeKey, addPhrases } = await vite.ssrLoadModule('/src/lib/store.ts');
let fails = 0;
const ok = (label, cond) => { console.log(cond ? 'PASS' : 'FAIL', label); if (!cond) fails++; };
const ph = (id, extra = {}) => ({ id, en: id, th: 'ไทย', source: 's', addedAt: 1, box: 0, due: '2026-10-13', ...extra });

// Phone added a phrase this morning; stale iPad still has yesterday's list.
let m = mergeKey('phrases', [ph('old')], [ph('old'), ph('new', { addedAt: 5 })]);
ok('stale device keeps the other device\'s new phrase', m.some((p) => p.id === 'new'));
// iPad reviewed "old" (newer touchedAt) while the phone has the untouched copy.
m = mergeKey('phrases', [ph('old', { box: 2, touchedAt: 9 })], [ph('old')]);
ok('newer review wins', m[0].box === 2);
m = mergeKey('phrases', [ph('old')], [ph('old', { box: 2, touchedAt: 9 })]);
ok('newer review wins (other order)', m[0].box === 2);
// Deleted on one device: stays deleted after merge.
m = mergeKey('phrases', [ph('x', { deleted: true, touchedAt: 9 })], [ph('x')]);
ok('delete survives', m[0].deleted === true);
// Level-up on phone, settings change on stale iPad afterwards.
const base = { coachName: 'Jimmy', subtitles: 'both', speed: 'slow', style: 'pixar', morningTime: '05:00', nightTime: '21:30', onboarded: true, memory: '' };
const p = mergeKey('profile', { ...base, level: 2, updatedAt: 5, memory: 'phone' }, { ...base, level: 1, speed: 'fast', updatedAt: 9 });
ok('level never goes down', p.level === 2);
ok('newest setting wins', p.speed === 'fast');
// Fresh device defaults (onboarded false, level 1, old timestamp) never reset the cloud.
const p2 = mergeKey('profile', { ...base, onboarded: false, level: 1 }, { ...base, level: 2, updatedAt: 5 });
ok('fresh-device defaults do not reset level/onboarding', p2.level === 2 && p2.onboarded);
// Stars attached later on one device are kept.
const s = mergeKey('sessions', [{ id: 'a', date: 'd', kind: 'morning', level: 1, createdAt: 1 }], [{ id: 'a', date: 'd', kind: 'morning', level: 1, createdAt: 1, stars: { task: 3, listening: 2, fluency: 2 } }]);
ok('stars kept', s[0].stars?.task === 3);
const s2 = mergeKey('sessions', [{ id: 'a', date: 'd', kind: 'morning', level: 1, createdAt: 1, stars: { task: 3, listening: 2, fluency: 2 } }], [{ id: 'a', date: 'd', kind: 'morning', level: 1, createdAt: 1 }]);
ok('stars kept (other order)', s2[0].stars?.task === 3);
// Re-saving a deleted phrase brings it back.
const r = addPhrases([ph('x', { en: 'Hello there.', deleted: true })], [{ en: 'hello there', th: 'สวัสดี' }], 's');
ok('re-saved deleted phrase is live again', r.filter((p) => !p.deleted).length === 1 && !r.some((p) => p.deleted));
ok('blank Thai rejected', addPhrases([], [{ en: 'Hi', th: ' ' }], 's').length === 0);
ok('curly quote duplicate rejected', addPhrases([ph('i', { en: "I'd like a table." })], [{ en: 'I’d like a table', th: 'ก' }], 's').length === 1);
await vite.close();
process.exit(fails ? 1 : 0);
