import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

// Fail loud (not white-screen) if the production bundle was built without the
// Supabase env vars. Surface a friendly message instead of silently creating
// a broken client that crashes on the first DB call.
const missingEnv: string[] = [];
if (!import.meta.env.VITE_SUPABASE_URL) missingEnv.push('VITE_SUPABASE_URL');
if (!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) missingEnv.push('VITE_SUPABASE_PUBLISHABLE_KEY');
if (missingEnv.length) {
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;padding:24px;background:#f8fafc;">
        <div style="max-width:480px;background:#fff;border:1px solid #e2e8f0;border-radius:24px;box-shadow:0 10px 30px -10px rgba(0,0,0,.15);padding:32px;text-align:center;">
          <div style="width:48px;height:48px;border-radius:9999px;background:#fef2f2;color:#ef4444;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-weight:900;font-size:24px;">!</div>
          <h1 style="font-size:20px;font-weight:900;color:#0f172a;margin:0 0 8px;">Backend not configured</h1>
          <p style="font-size:14px;color:#64748b;margin:0 0 16px;">Missing environment variable(s):</p>
          <code style="display:block;background:#f1f5f9;padding:12px;border-radius:12px;font-size:13px;color:#0f172a;word-break:break-all;">${missingEnv.join(', ')}</code>
          <p style="font-size:12px;color:#94a3b8;margin-top:16px;">Rebuild the app with these set, or check the deployment configuration.</p>
        </div>
      </div>`;
  }
  throw new Error('Missing required env vars: ' + missingEnv.join(', '));
}

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
