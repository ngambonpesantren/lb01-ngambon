import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

// ---------------------------------------------------------------------------
// White-screen guard
// ---------------------------------------------------------------------------
// Two failure modes we have to defend against in production:
//   1. The bundle was built WITHOUT the Supabase env vars (publish happened
//      before Cloud was enabled). `createClient()` then throws synchronously
//      at module-eval time with `supabaseUrl is required` — before React
//      can mount, before our ErrorBoundary catches anything → white screen.
//   2. The PWA service worker is serving an OLD `index.html` that references
//      a now-deleted JS bundle, or an old JS bundle that has bad env baked
//      in. Even after redeploy, the user is stuck.
//
// We handle both before ever importing App (which transitively imports the
// Supabase client). If env is missing OR App import fails, we render an HTML
// recovery screen and offer to wipe the SW + caches.
// ---------------------------------------------------------------------------

const ROOT_EL = () => document.getElementById('root');

function renderRecovery(title: string, body: string, detail?: string) {
  const root = ROOT_EL();
  if (!root) return;
  root.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;padding:24px;background:#f8fafc;">
      <div style="max-width:480px;width:100%;background:#fff;border:1px solid #e2e8f0;border-radius:24px;box-shadow:0 10px 30px -10px rgba(0,0,0,.15);padding:32px;text-align:center;">
          <div style="width:48px;height:48px;border-radius:9999px;background:#fef2f2;color:#ef4444;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-weight:900;font-size:24px;">!</div>
        <h1 style="font-size:20px;font-weight:900;color:#0f172a;margin:0 0 8px;">${title}</h1>
        <p style="font-size:14px;color:#64748b;margin:0 0 16px;">${body}</p>
        ${detail ? `<code style="display:block;text-align:left;background:#f1f5f9;padding:12px;border-radius:12px;font-size:12px;color:#0f172a;word-break:break-all;max-height:120px;overflow:auto;">${detail}</code>` : ''}
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:20px;">
          <button id="lv-recover" style="width:100%;padding:12px 16px;border-radius:12px;background:#2563eb;color:#fff;font-weight:800;border:0;cursor:pointer;font-size:14px;">Clear cache & reload</button>
          <button id="lv-reload" style="width:100%;padding:12px 16px;border-radius:12px;background:#f1f5f9;color:#0f172a;font-weight:800;border:0;cursor:pointer;font-size:14px;">Reload</button>
        </div>
        </div>
    </div>`;
  document.getElementById('lv-recover')?.addEventListener('click', hardReset);
  document.getElementById('lv-reload')?.addEventListener('click', () => location.reload());
}

async function hardReset() {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      // Tell each SW to drop its caches first, then unregister it entirely so
      // the next page load goes straight to the network for a fresh bundle.
      regs.forEach((r) => r.active?.postMessage('clear-caches'));
      await new Promise((r) => setTimeout(r, 200));
      await Promise.all(regs.map((r) => r.unregister().catch(() => {})));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* ignore */
  }
  // Cache-busting reload so even the HTML cache is bypassed.
  const url = new URL(location.href);
  url.searchParams.set('_r', Date.now().toString());
  location.replace(url.toString());
}

// 1. Env-var preflight — runs before any module that touches Supabase.
const missingEnv: string[] = [];
if (!import.meta.env.VITE_SUPABASE_URL) missingEnv.push('VITE_SUPABASE_URL');
if (!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) missingEnv.push('VITE_SUPABASE_PUBLISHABLE_KEY');
if (missingEnv.length) {
  renderRecovery(
    'Backend not configured',
    'The app was built without the required backend configuration. Clear the cached version and reload to pick up the latest build.',
    'Missing: ' + missingEnv.join(', '),
  );
  throw new Error('Missing required env vars: ' + missingEnv.join(', '));
}

// 2. Catch any synchronous throw from chunks loaded after this point —
// notably `supabaseUrl is required` from a stale cached bundle.
window.addEventListener('error', (e) => {
  const msg = String(e?.message || '');
  if (
    msg.includes('supabaseUrl is required') ||
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes("Importing a module script failed")
  ) {
    renderRecovery(
      'Stale app version detected',
      'A cached version of the app is out of date. Clear the cache to load the latest build.',
      msg,
    );
  }
});
window.addEventListener('unhandledrejection', (e) => {
  const msg = String((e?.reason && (e.reason.message || e.reason)) || '');
  if (
    msg.includes('supabaseUrl is required') ||
    msg.includes('Failed to fetch dynamically imported module')
  ) {
    renderRecovery(
      'Stale app version detected',
      'A cached version of the app is out of date. Clear the cache to load the latest build.',
      msg,
    );
  }
});

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

// 3. Dynamically import App AFTER the env guard. If the import (or the module
// evaluation, which transitively constructs the Supabase client) throws, we
// render the recovery screen instead of leaving the user with a blank page.
(async () => {
  try {
    const { default: App } = await import('./App.tsx');
    createRoot(ROOT_EL()!).render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>,
    );
  } catch (err: any) {
    console.error('Failed to boot app:', err);
    renderRecovery(
      'Could not start the app',
      'The app failed to initialize. This is usually caused by a stale cached version. Clear the cache and reload.',
      err?.message || String(err),
    );
  }
})();
