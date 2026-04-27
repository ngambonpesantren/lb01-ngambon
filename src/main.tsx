import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

// Service worker: register in production only. In dev (Vite HMR) an SW will
// happily cache stale module URLs and produce phantom white screens.
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js', { updateViaCache: 'none' })
        .then((reg) => {
          // Auto-reload once when a new SW takes over so the user immediately
          // sees the freshly-deployed bundle instead of a cached one.
          let refreshed = false;
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshed) return;
            refreshed = true;
            window.location.reload();
          });
          // Periodically check for an updated SW so long-lived tabs don't get
          // stuck on an old build.
          setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
        })
        .catch((err) => console.log('SW registration failed:', err));
    });
  } else {
    // Dev mode: aggressively unregister any SW that was installed by an
    // earlier production build, so HMR / fresh modules always win.
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister().catch(() => {}));
    }).catch(() => {});
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
