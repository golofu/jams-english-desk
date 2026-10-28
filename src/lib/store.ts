export type Speed = 'slow' | 'normal' | 'fast';
export type Subtitles = 'both' | 'en' | 'off';
export type AvatarStyle = 'pixar' | 'anime' | 'real';
export type Stars = { task: number; listening: number; fluency: number };

export type Profile = {
  /** How the coach addresses the learner (English letters work best for speech). */
  name: string;
  /** Job and workplace, in the learner's own words; the coach builds scenes around them. */
  job: string;
  company: string;
  coachName: string;
  subtitles: Subtitles;
  speed: Speed;
  style: AvatarStyle;
  morningTime: string;
  nightTime: string;
  onboarded: boolean;
  level: number;
  memory: string; // the coach's note from the last session
  memoryDate?: string; // day the memory was written, so Jimmy doesn't call last week "yesterday"
  updatedAt?: number; // newest edit wins for settings when two devices disagree
};

export type SessionLog = {
  id: string;
  date: string; // local YYYY-MM-DD
  kind: 'morning' | 'night' | 'prep' | 'snapshot';
  level: number;
  scenarioId?: string;
  scenarioTitle?: string;
  character?: string;
  stars?: Stars;
  minutes?: number;
  createdAt: number;
};

export type SavedPhrase = {
  id: string;
  en: string;
  th: string;
  source: string;
  addedAt: number;
  box: number; // Leitner box 0-4; higher = known better
  due: string; // YYYY-MM-DD
  touchedAt?: number; // last review/edit; the newer copy wins in a merge
  deleted?: boolean; // tombstone, so a delete on one device isn't undone by another
};

export type SnapshotMeta = { id: string; date: string; seconds: number; remotePath?: string };

export type AppData = {
  profile: Profile;
  sessions: SessionLog[];
  phrases: SavedPhrase[];
  snapshots: SnapshotMeta[];
};

export const DEFAULT_DATA: AppData = {
  profile: {
    name: '',
    job: '',
    company: '',
    coachName: 'Jimmy',
    subtitles: 'both',
    speed: 'slow',
    style: 'pixar',
    morningTime: '05:00',
    nightTime: '21:30',
    onboarded: false,
    level: 1,
    memory: '',
  },
  sessions: [],
  phrases: [],
  snapshots: [],
};

export type DataKey = keyof AppData;
const KEYS: DataKey[] = ['profile', 'sessions', 'phrases', 'snapshots'];
const ARRAYS: DataKey[] = ['sessions', 'phrases', 'snapshots'];

// Local copies are scoped per account so a second Google account never sees (or
// uploads) another learner's data. A dirty flag marks changes not yet synced.
const LS = (scope: string, k: string) => `jed:${scope}:${k}`;
const DIRTY = (scope: string, k: string) => `jed:${scope}:${k}:dirty`;
const LEGACY = (k: string) => `jed:${k}`; // pre-scoping builds

function lsGet(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined; // private mode, corrupt JSON
  }
}
function lsSet(key: string, v: unknown) {
  try {
    if (v === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* quota / private mode */
  }
}

/** Never let a malformed stored value crash startup. */
function sane<K extends DataKey>(k: K, v: unknown): AppData[K] | undefined {
  if (v === undefined || v === null) return undefined;
  if (ARRAYS.includes(k)) return (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object' && 'id' in x) : undefined) as AppData[K] | undefined;
  return (typeof v === 'object' && !Array.isArray(v) ? { ...DEFAULT_DATA.profile, ...(v as object) } : undefined) as AppData[K] | undefined;
}

function byId<T extends { id: string }>(a: T[], b: T[], pick: (x: T, y: T) => T): T[] {
  const m = new Map<string, T>();
  for (const x of a) m.set(x.id, x);
  for (const y of b) {
    const x = m.get(y.id);
    m.set(y.id, x ? pick(x, y) : y);
  }
  return [...m.values()];
}
const touched = (p: SavedPhrase) => p.touchedAt ?? p.addedAt;

// ---------- cloud copy (Worker /api/state, one JSON document per key) ----------
type Remote = { value: unknown; version: number };
async function remoteGet(key: DataKey): Promise<Remote> {
  const r = await fetch(`/api/state/${key}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`state ${r.status}`);
  return (await r.json()) as Remote;
}
async function remoteGetAll(): Promise<Record<string, Remote>> {
  const r = await fetch('/api/state', { cache: 'no-store' });
  if (!r.ok) throw new Error(`state ${r.status}`);
  return (await r.json()) as Record<string, Remote>;
}
/** Writes only if the cloud row is still `base`; otherwise returns the newer cloud copy. */
async function remotePut(key: DataKey, value: unknown, base: number): Promise<{ ok: true; version: number } | { ok: false; current: Remote }> {
  const r = await fetch(`/api/state/${key}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ value, base }) });
  if (r.status === 409) {
    const cur = (await r.json()) as Remote;
    return { ok: false, current: cur };
  }
  if (!r.ok) throw new Error(`state ${r.status}`);
  return { ok: true, version: ((await r.json()) as { version: number }).version };
}

/**
 * Two devices' copies of one key → one copy that loses nothing: lists merge item by item
 * (a review, a star or a delete on either side survives), the level never goes down, and
 * the newest settings edit wins. Used on load, on focus, and before every cloud write.
 */
export function mergeKey<K extends DataKey>(k: K, a: AppData[K], b: AppData[K]): AppData[K] {
  if (k === 'sessions') {
    return byId(a as SessionLog[], b as SessionLog[], (x, y) => ({ ...x, ...y, stars: y.stars ?? x.stars }))
      .sort((x, y) => y.createdAt - x.createdAt) as AppData[K];
  }
  if (k === 'snapshots') {
    return byId(a as SnapshotMeta[], b as SnapshotMeta[], (x, y) => ({ ...x, ...y, remotePath: y.remotePath ?? x.remotePath })) as AppData[K];
  }
  if (k === 'phrases') {
    return byId(a as SavedPhrase[], b as SavedPhrase[], (x, y) => (touched(y) >= touched(x) ? y : x))
      .sort((x, y) => y.addedAt - x.addedAt) as AppData[K];
  }
  const x = a as Profile;
  const y = b as Profile;
  const newer = (y.updatedAt ?? 0) >= (x.updatedAt ?? 0) ? y : x;
  return { ...newer, level: Math.max(x.level, y.level), onboarded: x.onboarded || y.onboarded } as AppData[K];
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Loads every key: local copy merged with the cloud copy, and anything the cloud is missing
 * is pushed. `failed` = the cloud couldn't be reached (offline).
 */
export async function loadData(userId: string): Promise<{ data: AppData; failed: boolean }> {
  const scope = userId;
  const data: AppData = structuredClone(DEFAULT_DATA);
  const rec = data as Record<DataKey, unknown>;
  const hadLocal = KEYS.some((k) => lsGet(LS(scope, k)) !== undefined);
  for (const k of KEYS) {
    const v = sane(k, lsGet(LS(scope, k)));
    if (v !== undefined) rec[k] = v;
  }

  let remote: Record<string, Remote>;
  try {
    remote = await remoteGetAll();
  } catch {
    return { data, failed: true }; // offline: local copy is the best we have
  }
  if (!Object.keys(remote).length && !hadLocal) {
    // First sign-in on this device with an empty account: bring earlier local-only practice along
    // (the passcode-era build kept everything under 'local' / unscoped keys).
    for (const k of KEYS) {
      const v = sane(k, lsGet(LS('local', k)) ?? lsGet(LEGACY(k)));
      if (v !== undefined) rec[k] = v;
    }
  }
  for (const k of KEYS) {
    const r = sane(k, remote[k]?.value);
    versions.set(`${userId}:${k}`, remote[k]?.version ?? 0);
    if (r) rec[k] = mergeKey(k, rec[k] as never, r as never);
    lsSet(LS(scope, k), rec[k]);
    if (!r || !same(r, rec[k])) queueSync(userId, k, rec[k]);
  }
  return { data, failed: false };
}

// One request in flight per key, always sending the newest value (debounced), so
// rapid edits can't land out of order and a failed write stays dirty for retry.
const pending = new Map<string, { userId: string; key: DataKey; value: unknown }>();
const versions = new Map<string, number>(); // cloud version this device last merged against, per key
const inflight = new Set<string>();
const timers = new Map<string, number>();
let onSyncChange: (unsynced: number) => void = () => undefined;
export const onSyncStatus = (fn: (unsynced: number) => void) => (onSyncChange = fn);
// The cloud had changes this device didn't (another device wrote meanwhile): tell the app.
let onMerged: (key: DataKey, value: unknown) => void = () => undefined;
export const onRemoteMerge = (fn: (key: DataKey, value: unknown) => void) => (onMerged = fn);

function queueSync(userId: string, key: DataKey, value: unknown) {
  const id = `${userId}:${key}`;
  pending.set(id, { userId, key, value });
  clearTimeout(timers.get(id));
  timers.set(id, window.setTimeout(() => void flush(id), 400));
  onSyncChange(pending.size);
}

async function flush(id: string) {
  const job = pending.get(id);
  if (!job || inflight.has(id)) return;
  inflight.add(id);
  pending.delete(id);
  // Merge-then-write with a version check: a stale tab must never replace what another device saved.
  let value = job.value;
  let error: unknown = null;
  try {
    let base = versions.get(id);
    if (base === undefined) base = (await remoteGet(job.key)).version;
    for (let attempt = 0; attempt < 3; attempt++) {
      const w = await remotePut(job.key, value, base);
      if (w.ok) {
        versions.set(id, w.version);
        break;
      }
      // Another device wrote meanwhile: fold its copy in and try again against the new version.
      const r = sane(job.key, w.current.value);
      if (r) value = mergeKey(job.key, value as never, r as never);
      base = w.current.version;
      if (r && same(r, value)) {
        versions.set(id, base);
        break; // the cloud already has everything we know
      }
      if (attempt === 2) error = new Error('CONFLICT');
    }
    if (!error && !same(value, job.value)) {
      lsSet(LS(job.userId, job.key), value);
      onMerged(job.key, value);
    }
  } catch (e) {
    error = e;
  }
  inflight.delete(id);
  if (error) {
    if (!pending.has(id)) pending.set(id, job); // keep for retry; dirty flag stays
  } else if (!pending.has(id)) lsSet(DIRTY(job.userId, job.key), undefined);
  if (pending.has(id) && !error) void flush(id); // a newer value arrived meanwhile
  onSyncChange(pending.size);
}

/** Retry anything unsynced (called on reconnect / tab focus). */
export function retrySync() {
  for (const id of pending.keys()) void flush(id);
}

export function saveKey<K extends DataKey>(userId: string, key: K, value: AppData[K]) {
  lsSet(LS(userId, key), value);
  lsSet(DIRTY(userId, key), Date.now());
  queueSync(userId, key, value);
}

// ---------- date helpers ----------
export function dayStr(d = new Date()): string {
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
export function addDays(s: string, n: number): string {
  const d = new Date(`${s}T12:00:00`);
  d.setDate(d.getDate() + n);
  return dayStr(d);
}
const isWeekend = (s: string) => [0, 6].includes(new Date(`${s}T12:00:00`).getDay());

/** Consecutive practice days; a weekend without practice doesn't break it, today not done yet doesn't either. */
export function streak(sessions: SessionLog[]): number {
  const days = new Set(sessions.filter((s) => s.kind !== 'snapshot').map((s) => s.date));
  let d = dayStr();
  if (!days.has(d)) d = addDays(d, -1);
  let n = 0;
  for (let i = 0; i < 400; i++) {
    if (days.has(d)) n++;
    else if (!isWeekend(d)) break;
    d = addDays(d, -1);
  }
  return n;
}

/** Local calendar-day index (Thailand is UTC+7: a UTC index would flip at 07:00). */
export const localDayIndex = (d = dayStr()) => Math.round(new Date(`${d}T12:00:00Z`).getTime() / 86_400_000);

export const LEVEL_UP_DAYS = 3;
export const LEVEL_UP_COVERAGE = 0.7; // share of the level's scenarios that must be passed
export const passedStars = (s?: Stars) => !!s && s.task >= 2 && s.listening >= 2 && s.fluency >= 2;

export type LevelStatus = { days: number; scenarios: number; needScenarios: number; ready: boolean };

/**
 * Level-up needs both: passes (≥2★ in every area) on 3 different days, AND passes in
 * ~70% of the level's scenarios — so the learner can't skip half the level in three mornings.
 */
export function levelStatus(sessions: SessionLog[], level: number, totalScenarios: number): LevelStatus {
  const passes = sessions.filter((s) => s.kind === 'morning' && s.level === level && passedStars(s.stars));
  const days = new Set(passes.map((s) => s.date)).size;
  const scenarios = new Set(passes.map((s) => s.scenarioId)).size;
  const needScenarios = Math.ceil(totalScenarios * LEVEL_UP_COVERAGE);
  return { days, scenarios, needScenarios, ready: days >= LEVEL_UP_DAYS && scenarios >= needScenarios };
}

export function uid(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ---------- Leitner review for saved phrases ----------
const BOX_DAYS = [0, 1, 3, 7, 14];
export function reviewPhrase(p: SavedPhrase, knew: boolean): SavedPhrase {
  const box = knew ? Math.min(4, p.box + 1) : 0;
  return { ...p, box, due: addDays(dayStr(), knew ? BOX_DAYS[box] : 0), touchedAt: Date.now() };
}

/** "Nice to meet you." and "nice to meet you" are the same phrase. */
export const phraseKey = (en: string) =>
  en
    .trim()
    .toLowerCase()
    .replace(/[’‘]/g, "'") // the AI writes curly quotes, the curriculum straight ones
    .replace(/[“”]/g, '"')
    .replace(/[.!?,;:]+$/g, '')
    .replace(/\s+/g, ' ');

/** Oldest-due first, so phrases that have waited longest come back before new ones. */
export const byDue = (a: SavedPhrase, b: SavedPhrase) => a.due.localeCompare(b.due) || a.addedAt - b.addedAt;

export function addPhrases(existing: SavedPhrase[], items: { en: string; th: string }[], source: string): SavedPhrase[] {
  const seen = new Set(existing.filter((p) => !p.deleted).map((p) => phraseKey(p.en)));
  // Saving a phrase that was deleted earlier brings it back as new (and drops the tombstone).
  const revived = new Set(items.filter((i) => i && typeof i.en === 'string').map((i) => phraseKey(i.en)));
  const fresh = items
    // AI output: skip anything malformed, and duplicates within the same batch.
    .filter((i) => {
      if (!i || typeof i.en !== 'string' || typeof i.th !== 'string' || !i.en.trim() || !i.th.trim()) return false; // blank Thai = blank quiz answer
      const k = phraseKey(i.en);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .map((i) => ({ id: uid(), en: i.en.trim(), th: i.th, source, addedAt: Date.now(), touchedAt: Date.now(), box: 0, due: dayStr() }));
  const keep = fresh.length ? existing.filter((p) => !(p.deleted && revived.has(phraseKey(p.en)) && fresh.some((f) => phraseKey(f.en) === phraseKey(p.en)))) : existing;
  return [...fresh, ...keep];
}

/** The learner's name for screens and greetings ("คุณ" until onboarding has asked). */
export const learnerName = (p: Profile) => p.name.trim() || 'คุณ';
