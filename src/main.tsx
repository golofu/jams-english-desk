import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { Gallery } from './Gallery';
import { BRAND } from './brand';
import './styles.css';

// Brand tokens → CSS variables, so swapping GoDigit colors is one file.
const root = document.documentElement.style;
root.setProperty('--brand', BRAND.colors.primary);
root.setProperty('--brand-ink', BRAND.colors.primaryInk);
root.setProperty('--accent', BRAND.colors.accent);
root.setProperty('--accent-end', BRAND.colors.accentEnd);
root.setProperty('--deep', BRAND.colors.deep);

// An open tab that outlived a deploy asks for chunks that no longer exist: reload once.
window.addEventListener('vite:preloadError', () => {
  if (!sessionStorage.getItem('jed:reloaded')) {
    sessionStorage.setItem('jed:reloaded', '1');
    location.reload();
  }
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('/sw.js').catch(() => undefined);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {import.meta.env.DEV && location.search.includes('gallery') ? <Gallery /> : <App />}
  </StrictMode>,
);
