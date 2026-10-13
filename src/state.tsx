import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { DEFAULT_DATA, loadData, retrySync, saveKey, type AppData, type DataKey } from './lib/store';

type Ctx = {
  data: AppData;
  userId: string | null;
  email: string | null;
  update: <K extends DataKey>(key: K, fn: (prev: AppData[K]) => AppData[K]) => void;
  /** Latest data, including updates made earlier in the same handler. */
  get: () => AppData;
  signOut: () => Promise<void>;
};

const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp outside provider');
  return c;
};

/** Loads data for the signed-in user (or Local mode) and persists every change. */
export function AppProvider({ session, children }: { session: Session | null; children: ReactNode }) {
  const userId = session?.user.id ?? null;
  const [data, setData] = useState<AppData | null>(null);
  const dataRef = useRef<AppData>(DEFAULT_DATA);

  useEffect(() => {
    let alive = true;
    setData(null); // never show (or write) the previous account's data under a new user id
    loadData(userId).then((d) => {
      if (!alive) return;
      dataRef.current = d;
      setData(d);
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  const update = useCallback<Ctx['update']>(
    (key, fn) => {
      const next = { ...dataRef.current, [key]: fn(dataRef.current[key]) };
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
    await supabase?.auth.signOut();
  }, []);

  if (!data) return <div className="splash">กำลังโหลด…</div>;
  return (
    <AppCtx.Provider value={{ data, userId, email: session?.user.email ?? null, update, get: () => dataRef.current, signOut }}>{children}</AppCtx.Provider>
  );
}
