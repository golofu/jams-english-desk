import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { Gallery } from './Gallery';
import { BRAND } from './brand';
import './styles.css';

// Brand tokens → CSS variables, so swapping the brand colors is one file.
const root = document.documentElement.style;
root.setProperty('--brand', BRAND.colors.primary);
root.setProperty('--brand-ink', BRAND.colors.primaryInk);
root.setProperty('--accent', BRAND.colors.accent);
root.setProperty('--accent-end', BRAND.colors.accentEnd);
root.setProperty('--deep', BRAND.colors.deep);

// An open tab that outlived a deploy asks for chunks that no longer exist: reload once.
window.addEventListener('vite:preloadError', () => {
  // At most once a minute, so a genuinely missing file can't cause a reload loop.
  const last = Number(sessionStorage.getItem('jed:reloaded') || 0);
  if (Date.now() - last > 60_000) {
    sessionStorage.setItem('jed:reloaded', String(Date.now()));
    location.reload();
  }
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  // The first visit loads its JS/CSS before the service worker controls the page, so hand the
  // worker this build's files: the next launch then works offline (otherwise a white screen).
  navigator.serviceWorker.ready
    .then((reg) => {
      const assets = performance
        .getEntriesByType('resource')
        .map((r) => new URL(r.name).pathname)
        .filter((p) => p.startsWith('/assets/'));
      reg.active?.postMessage({ type: 'cache-assets', assets });
    })
    .catch(() => undefined);
}
// Ask the browser not to evict the learner's progress and voice recordings when storage runs low.
navigator.storage?.persist?.().catch(() => undefined);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {import.meta.env.DEV && location.search.includes('gallery') ? <Gallery /> : <App />}
  </StrictMode>,
);
