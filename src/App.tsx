import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { AppProvider, useApp } from './state';
import { BRAND } from './brand';
import { Home } from './screens/Home';
import { Morning } from './screens/Morning';
import { Night } from './screens/Night';
import { Prep } from './screens/Prep';
import { Phrases } from './screens/Phrases';
import { Progress } from './screens/Progress';
import { Settings } from './screens/Settings';
import { Login } from './screens/Login';
import { Onboarding } from './screens/Onboarding';

type Tab = 'home' | 'phrases' | 'progress' | 'settings';
type Flow = 'morning' | 'night' | 'prep' | null;

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!supabase);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!ready) return <div className="splash">กำลังโหลด…</div>;
  if (supabase && !session) return <Login />;
  return (
    <AppProvider session={session}>
      <Shell />
    </AppProvider>
  );
}

function Shell() {
  const { data } = useApp();
  const [tab, setTab] = useState<Tab>('home');
  const [flow, setFlow] = useState<Flow>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab, flow]);

  // Android back gesture / browser back: leave the current practice instead of closing the app.
  useEffect(() => {
    if (!flow) return;
    history.pushState({ flow }, '');
    let popped = false;
    const onPop = () => {
      if (window.confirm('ออกจากการฝึกตอนนี้? ผลที่ยังไม่ได้ดูจะไม่ถูกบันทึก')) {
        popped = true;
        setFlow(null);
      } else history.pushState({ flow }, '');
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (!popped) history.back(); // normal exit: drop the entry we pushed
    };
  }, [flow]);

  if (!data.profile.onboarded) return <Onboarding />;

  const exit = () => setFlow(null);
  if (flow === 'morning') return <Morning onExit={exit} />;
  if (flow === 'night') return <Night onExit={exit} />;
  if (flow === 'prep') return <Prep onExit={exit} />;

  return (
    <div className="shell">
      <header className="topbar">
        <img src={BRAND.logo} alt={BRAND.company} className="logo" />
        <span className="app-name">English Desk</span>
      </header>
      <main>
        {tab === 'home' && <Home go={setFlow} />}
        {tab === 'phrases' && <Phrases />}
        {tab === 'progress' && <Progress />}
        {tab === 'settings' && <Settings />}
      </main>
      <nav className="tabbar">
        {(
          [
            ['home', '🏠', 'หน้าแรก'],
            ['phrases', '📚', 'ประโยคของฉัน'],
            ['progress', '📈', 'ความคืบหน้า'],
            ['settings', '⚙️', 'ตั้งค่า'],
          ] as const
        ).map(([id, icon, label]) => (
          <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            <span className="i">{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
