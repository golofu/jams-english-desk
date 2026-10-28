import { useEffect, useState } from 'react';
import { fetchMe, type Me } from './lib/auth';
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
import { KeySetup } from './screens/KeySetup';

type Tab = 'home' | 'phrases' | 'progress' | 'settings';
type Flow = 'morning' | 'night' | 'prep' | null;

export function App() {
  const [me, setMe] = useState<Me | null | undefined>(undefined); // undefined = still asking
  const [offline, setOffline] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setOffline(false);
    fetchMe()
      .then(setMe)
      .catch(() => setOffline(true));
  }, [attempt]);

  if (offline)
    return (
      <div className="splash center-col">
        <p>เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ต่ออินเทอร์เน็ตแล้วกดลองใหม่นะคะ</p>
        <button className="btn primary" onClick={() => setAttempt((n) => n + 1)}>ลองใหม่</button>
      </div>
    );
  if (me === undefined) return <div className="splash">กำลังโหลด…</div>;
  if (!me) return <Login />;
  return (
    <AppProvider me={me} onMeChange={setMe}>
      <Shell />
    </AppProvider>
  );
}

function Shell() {
  const { data, me, keySkipped, skipKey } = useApp();
  const [tab, setTab] = useState<Tab>('home');
  const [flow, setFlow] = useState<Flow>(null);
  // 0 = the day's Morning Talk; each extra lesson bumps it, so a fresh Morning picks the next scene.
  // Extra lessons stay on flow 'morning': changing flow re-runs the history effect below, whose
  // async history.back() would land after the new pushState and pop the "leave practice?" confirm.
  const [lessonRun, setLessonRun] = useState(0);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab, flow, lessonRun]);

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
  // Each account brings its own free Gemini key; without one the AI screens can't work.
  if (!me.hasKey && !keySkipped) return <KeySetup onDone={() => skipKey(true)} onSkip={() => skipKey(false)} />;

  const exit = () => {
    setFlow(null);
    setLessonRun(0);
  };
  const more = () => {
    setLessonRun((n) => n + 1);
    setFlow('morning');
  };
  const go = (r: 'morning' | 'more' | 'night' | 'prep') => (r === 'more' ? more() : setFlow(r));
  if (flow === 'morning') return <Morning key={lessonRun} extra={lessonRun > 0} onExit={exit} onMore={more} />;
  if (flow === 'night') return <Night onExit={exit} />;
  if (flow === 'prep') return <Prep onExit={exit} />;

  return (
    <div className="shell">
      <header className="topbar">
        <img src={BRAND.logo} alt={BRAND.appName} className="logo" />
        <span className="app-name">{BRAND.appName}</span>
      </header>
      <main>
        {tab === 'home' && <Home go={go} />}
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
