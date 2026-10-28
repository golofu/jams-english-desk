import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { fetchMe, logout, type Me } from './lib/auth';
import { setLearner } from './lib/api';
import { DEFAULT_DATA, loadData, mergeKey, onRemoteMerge, retrySync, saveKey, type AppData, type DataKey } from './lib/store';

type Ctx = {
  data: AppData;
  me: Me;
  userId: string;
  email: string;
  update: <K extends DataKey>(key: K, fn: (prev: AppData[K]) => AppData[K]) => void;
  /** Latest data, including updates made earlier in the same handler. */
  get: () => AppData;
  signOut: () => Promise<void>;
  /** Re-read the account (after a Gemini key was saved or removed). */
  refreshMe: () => Promise<void>;
  /** The learner chose "later" on the Gemini key screen (this visit only). */
  keySkipped: boolean;
  skipKey: (saved: boolean) => void;
};

const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp outside provider');
  return c;
};

/** Loads data for the signed-in user and persists every change. */
export function AppProvider({ me, onMeChange, children }: { me: Me; onMeChange: (m: Me) => void; children: ReactNode }) {
  const userId = me.id;
  const [keySkipped, setKeySkipped] = useState(false);
  const [data, setData] = useState<AppData | null>(null);
  const [offlineFirstRun, setOfflineFirstRun] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const dataRef = useRef<AppData>(DEFAULT_DATA);

  useEffect(() => {
    let alive = true;
    setData(null); // never show (or write) the previous account's data under a new user id
    setOfflineFirstRun(false);
    loadData(userId).then(({ data: d, failed }) => {
      if (!alive) return;
      // A new device that can't reach the cloud would start onboarding with empty defaults:
      // wait for the real data instead of letting that blank copy be saved.
      if (failed && !d.profile.onboarded) return setOfflineFirstRun(true);
      dataRef.current = d;
      setData(d);
    });
    return () => {
      alive = false;
    };
  }, [userId, attempt]);

  // Fold changes from another device into what's on screen (merge, never replace).
  const absorb = useCallback((incoming: Partial<AppData>) => {
    const cur = dataRef.current;
    const next = { ...cur };
    for (const k of Object.keys(incoming) as DataKey[]) (next as Record<DataKey, unknown>)[k] = mergeKey(k, cur[k] as never, incoming[k] as never);
    dataRef.current = next;
    setData(next);
  }, []);
  useEffect(() => {
    onRemoteMerge((key, value) => absorb({ [key]: value } as Partial<AppData>));
  }, [absorb]);
  // A tab left open for hours (the iPad from last night) refreshes before the learner touches anything.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      loadData(userId).then(({ data: d, failed }) => !failed && absorb(d)).catch(() => undefined);
    };
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, [userId, absorb]);

  const update = useCallback<Ctx['update']>(
    (key, fn) => {
      let value = fn(dataRef.current[key]);
      if (key === 'profile') value = { ...(value as AppData['profile']), updatedAt: Date.now() } as typeof value;
      const next = { ...dataRef.current, [key]: value };
      dataRef.current = next;
      setData(next);
      void saveKey(userId, key, next[key]);
    },
    [userId],
  );

  // Re-send anything that failed to sync once we're back online / in front.
  useEffect(() => {
    const retry = () => document.visibilityState === 'visible' && retrySync();
    window.addEventListener('online', retry);
    document.addEventListener('visibilitychange', retry);
    return () => {
      window.removeEventListener('online', retry);
      document.removeEventListener('visibilitychange', retry);
    };
  }, []);

  const signOut = useCallback(async () => {
    await logout(); // this device only, not the learner's other devices
    location.href = '/';
  }, []);
  const refreshMe = useCallback(async () => {
    const m = await fetchMe().catch(() => null);
    if (m) onMeChange(m);
  }, [onMeChange]);
  const skipKey = useCallback(
    (saved: boolean) => {
      setKeySkipped(true);
      if (saved) void refreshMe();
    },
    [refreshMe],
  );
  // The coach prompts are built from who is practising.
  useEffect(() => {
    const p = data?.profile;
    if (p) setLearner({ name: p.name || me.name.split(' ')[0] || 'friend', job: p.job, company: p.company });
  }, [data?.profile, me.name]);

  // Deleted phrases stay as tombstones (for syncing) but are invisible to every screen.
  const view = useMemo(() => (data ? { ...data, phrases: data.phrases.filter((p) => !p.deleted) } : null), [data]);

  if (offlineFirstRun)
    return (
      <div className="splash center-col">
        <p>เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ข้อมูลการฝึกของคุณอยู่บนเซิร์ฟเวอร์ ต่ออินเทอร์เน็ตแล้วกดลองใหม่นะคะ</p>
        <button className="btn primary" onClick={() => setAttempt((n) => n + 1)}>ลองใหม่</button>
      </div>
    );
  if (!view) return <div className="splash">กำลังโหลด…</div>;
  return (
    <AppCtx.Provider value={{ data: view, me, userId, email: me.email, update, get: () => dataRef.current, signOut, refreshMe, keySkipped, skipKey }}>
      {children}
    </AppCtx.Provider>
  );
}
