import { supabase } from './supabase';

export type Speed = 'slow' | 'normal' | 'fast';
export type Subtitles = 'both' | 'en' | 'off';
export type AvatarStyle = 'pixar' | 'anime' | 'real';
export type Stars = { task: number; listening: number; fluency: number };

export type Profile = {
  coachName: string;
  subtitles: Subtitles;
  speed: Speed;
  style: AvatarStyle;
  morningTime: string;
  nightTime: string;
  onboarded: boolean;
  level: number;
  memory: string; // Jimmy's note from the last session
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
// uploads) Jam's data. 'local' = no Supabase. A dirty flag marks changes not yet synced.
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

/** Append-only lists (sessions, snapshots) merge by id, so two devices never erase each other. */
function unionById<T extends { id: string }>(a: T[], b: T[]): T[] {
  const seen = new Map<string, T>();
  for (const x of [...a, ...b]) if (!seen.has(x.id)) seen.set(x.id, x);
  return [...seen.values()];
}

/**
 * Loads every key. Local changes that never reached Supabase (offline, error) win
 * over the cloud copy and are re-sent; append-only lists are merged either way.
 */
export async function loadData(userId: string | null): Promise<AppData> {
  const scope = userId ?? 'local';
  const data: AppData = structuredClone(DEFAULT_DATA);
  const rec = data as Record<DataKey, unknown>;
  const legacy = !userId; // pre-scoping builds stored 'jed:<key>'
  for (const k of KEYS) {
    const v = sane(k, lsGet(LS(scope, k)) ?? (legacy ? lsGet(LEGACY(k)) : undefined));
    if (v !== undefined) rec[k] = v;
  }
  if (!supabase || !userId) return data;

  const { data: rows, error } = await supabase.from('app_state').select('key,value').eq('user_id', userId);
  if (error) return data; // offline: local copy is the best we have
  const remote = new Map((rows ?? []).map((r) => [r.key as DataKey, r.value]));
  const firstLogin = !remote.size && !KEYS.some((k) => lsGet(LS(scope, k)) !== undefined);
  for (const k of KEYS) {
    const r = sane(k, remote.get(k));
    const dirty = !!lsGet(DIRTY(scope, k));
    if (k === 'sessions' || k === 'snapshots') {
      if (r) rec[k] = unionById(rec[k] as { id: string }[], r as { id: string }[]);
    } else if (r && !dirty) rec[k] = r;
    lsSet(LS(scope, k), rec[k]);
    // Push when local is newer, the merge added items, or the account has no copy yet.
    if (dirty || !r || JSON.stringify(r) !== JSON.stringify(rec[k])) queueSync(userId, k, rec[k]);
  }
  if (firstLogin) {
    // First sign-in on this device with an empty account: bring Local-mode practice along.
    for (const k of KEYS) {
      const v = sane(k, lsGet(LS('local', k)) ?? lsGet(LEGACY(k)));
      if (v !== undefined) {
        rec[k] = v;
        lsSet(LS(scope, k), v);
        queueSync(userId, k, v);
      }
    }
  }
  return data;
}

// One request in flight per key, always sending the newest value (debounced), so
// rapid edits can't land out of order and a failed write stays dirty for retry.
const pending = new Map<string, { userId: string; key: DataKey; value: unknown }>();
const inflight = new Set<string>();
const timers = new Map<string, number>();
let onSyncChange: (unsynced: number) => void = () => undefined;
export const onSyncStatus = (fn: (unsynced: number) => void) => (onSyncChange = fn);

function queueSync(userId: string, key: DataKey, value: unknown) {
  const id = `${userId}:${key}`;
  pending.set(id, { userId, key, value });
  clearTimeout(timers.get(id));
  timers.set(id, window.setTimeout(() => void flush(id), 400));
  onSyncChange(pending.size);
}

async function flush(id: string) {
  const job = pending.get(id);
  if (!job || !supabase || inflight.has(id)) return;
  inflight.add(id);
  pending.delete(id);
  const { error } = await supabase
    .from('app_state')
    .upsert({ user_id: job.userId, key: job.key, value: job.value, updated_at: new Date().toISOString() });
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

export function saveKey<K extends DataKey>(userId: string | null, key: K, value: AppData[K]) {
  const scope = userId ?? 'local';
  lsSet(LS(scope, key), value);
  if (supabase && userId) {
    lsSet(DIRTY(scope, key), Date.now());
    queueSync(userId, key, value);
  }
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
 * ~70% of the level's scenarios — so Jam can't skip half the level in three mornings.
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
  return { ...p, box, due: addDays(dayStr(), knew ? BOX_DAYS[box] : 0) };
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
  const seen = new Set(existing.map((p) => phraseKey(p.en)));
  const fresh = items
    // AI output: skip anything malformed, and duplicates within the same batch.
    .filter((i) => {
      if (!i || typeof i.en !== 'string' || typeof i.th !== 'string' || !i.en.trim() || !i.th.trim()) return false; // blank Thai = blank quiz answer
      const k = phraseKey(i.en);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .map((i) => ({ id: uid(), en: i.en.trim(), th: i.th, source, addedAt: Date.now(), box: 0, due: dayStr() }));
  return [...fresh, ...existing];
}
