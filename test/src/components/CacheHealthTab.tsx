import React, { useCallback, useEffect, useState } from "react";
import {
  ShieldCheck,
  RefreshCw,
  Trash2,
  HardDrive,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Cpu,
} from "lucide-react";

/**
 * PWA Cache Health screen. Lets the admin:
 *   - see whether a service worker is registered + which version is active
 *   - list all caches the SW currently owns
 *   - force-clear caches + storage and reload
 *   - force the SW to skip waiting (so a pending update activates immediately)
 *
 * Useful when the deployed app appears stuck on an old build.
 */

type SwInfo = {
  version?: string;
  buildId?: string;
  caches?: string[];
  scope?: string;
};

type Status = "checking" | "ready" | "no-sw" | "unsupported";

const log = (...args: any[]) => console.log("[CacheHealth]", ...args);

async function askSwForVersion(): Promise<SwInfo | null> {
  if (!("serviceWorker" in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  const target = reg?.active || reg?.waiting || reg?.installing;
  if (!target) return null;
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    let settled = false;
    const finish = (info: SwInfo | null) => {
      if (settled) return;
      settled = true;
      resolve(info);
    };
    channel.port1.onmessage = (e) => finish(e.data || null);
    try {
      target.postMessage("get-version", [channel.port2]);
    } catch {
      finish(null);
    }
    setTimeout(() => finish(null), 1500);
  });
}

async function listCachesDirect(): Promise<string[]> {
  if (!("caches" in window)) return [];
  try {
    return await caches.keys();
  } catch {
    return [];
  }
}

export function CacheHealthTab() {
  const [status, setStatus] = useState<Status>("checking");
  const [info, setInfo] = useState<SwInfo | null>(null);
  const [cacheKeys, setCacheKeys] = useState<string[]>([]);
  const [hasWaiting, setHasWaiting] = useState(false);
  const [busy, setBusy] = useState<null | "clearing" | "skipping" | "refreshing">(null);
  const [lastAction, setLastAction] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus("checking");
    if (!("serviceWorker" in navigator)) {
      setStatus("unsupported");
      return;
    }
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) {
      setStatus("no-sw");
      const keys = await listCachesDirect();
      setCacheKeys(keys);
      return;
    }
    setHasWaiting(Boolean(reg.waiting));
    const swInfo = await askSwForVersion();
    if (swInfo) {
      log("active SW", swInfo);
      setInfo(swInfo);
      setCacheKeys(swInfo.caches || (await listCachesDirect()));
    } else {
      setInfo(null);
      setCacheKeys(await listCachesDirect());
    }
    setStatus("ready");
  }, []);

  useEffect(() => {
    refresh();
    if (!("serviceWorker" in navigator)) return;
    const onChange = () => refresh();
    navigator.serviceWorker.addEventListener("controllerchange", onChange);
    return () =>
      navigator.serviceWorker.removeEventListener("controllerchange", onChange);
  }, [refresh]);

  const handleClearAndReload = async () => {
    if (!confirm("This will clear all cached assets and reload the app. Continue?")) return;
    setBusy("clearing");
    setLastAction(null);
    try {
      // Tell the SW to drop its caches first (it owns them).
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        reg?.active?.postMessage("clear-caches");
        await new Promise((r) => setTimeout(r, 200));
      }
      // Then drop everything we can see directly.
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      // Best-effort storage clear (won't touch IndexedDB / localStorage to
      // avoid wiping user-saved DB connections; admins can do that manually).
      log("caches cleared, reloading…");
      setLastAction("Cleared caches. Reloading…");
      // tiny pause so the user sees the toast
      setTimeout(() => window.location.reload(), 350);
    } catch (e: any) {
      setBusy(null);
      setLastAction("Failed to clear: " + (e?.message || e));
    }
  };

  const handleSkipWaiting = async () => {
    setBusy("skipping");
    setLastAction(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const waiting = reg?.waiting;
      if (!waiting) {
        setLastAction("No waiting SW to activate.");
        setBusy(null);
        return;
      }
      waiting.postMessage("skip-waiting");
      setLastAction("Activating new service worker — page will reload.");
      // controllerchange handler in main.tsx will reload automatically
    } catch (e: any) {
      setLastAction("Failed: " + (e?.message || e));
      setBusy(null);
    }
  };

  const handleUnregister = async () => {
    if (!confirm("Unregister the service worker? The app will reload without offline support.")) return;
    setBusy("clearing");
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      setTimeout(() => window.location.reload(), 350);
    } catch (e: any) {
      setLastAction("Failed: " + (e?.message || e));
      setBusy(null);
    }
  };

  const handleHardRefresh = async () => {
    setBusy("refreshing");
    await refresh();
    setBusy(null);
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6">
      <header className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-black text-text-main">
            Cache Health
          </h2>
          <p className="text-sm text-text-muted font-medium">
            Inspect the service worker, force-clear caches, and confirm new
            builds have been applied.
          </p>
        </div>
      </header>

      <StatusCard
        status={status}
        info={info}
        cacheKeys={cacheKeys}
        hasWaiting={hasWaiting}
      />

      <div className="rounded-2xl border border-base-200 bg-base-100 p-4 space-y-3">
        <h3 className="font-black text-text-main text-sm">Actions</h3>
        <div className="grid sm:grid-cols-2 gap-2">
          <button
            onClick={handleClearAndReload}
            disabled={busy !== null}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 disabled:opacity-60 active:scale-95 transition-all"
          >
            {busy === "clearing" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            Clear caches & reload
          </button>
          <button
            onClick={handleSkipWaiting}
            disabled={busy !== null || !hasWaiting}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-50 active:scale-95 transition-all"
            title={hasWaiting ? "Activate the pending update" : "No update waiting"}
          >
            {busy === "skipping" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            Activate pending update
          </button>
          <button
            onClick={handleHardRefresh}
            disabled={busy !== null}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-base-200 text-text-main font-bold hover:bg-base-200/80 disabled:opacity-60 active:scale-95 transition-all"
          >
            {busy === "refreshing" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Re-check status
          </button>
          <button
            onClick={handleUnregister}
            disabled={busy !== null || status !== "ready"}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-700 disabled:opacity-60 active:scale-95 transition-all"
          >
            <AlertTriangle className="w-4 h-4" />
            Unregister service worker
          </button>
        </div>
        {lastAction && (
          <p className="text-xs font-bold text-text-muted">{lastAction}</p>
        )}
      </div>

      <div className="rounded-2xl border border-base-200 bg-base-100 p-4">
        <h3 className="font-black text-text-main text-sm mb-2 flex items-center gap-2">
          <HardDrive className="w-4 h-4" /> Cache buckets
        </h3>
        {cacheKeys.length === 0 ? (
          <p className="text-xs text-text-muted">No caches stored.</p>
        ) : (
          <ul className="text-xs font-mono space-y-1">
            {cacheKeys.map((k) => (
              <li
                key={k}
                className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-base-200/40"
              >
                <span className="truncate">{k}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatusCard({
  status,
  info,
  cacheKeys,
  hasWaiting,
}: {
  status: Status;
  info: SwInfo | null;
  cacheKeys: string[];
  hasWaiting: boolean;
}) {
  if (status === "checking") {
    return (
      <div className="rounded-2xl border border-base-200 bg-base-100 p-4 flex items-center gap-3">
        <Loader2 className="w-4 h-4 animate-spin text-text-muted" />
        <span className="text-sm text-text-muted font-bold">Checking…</span>
      </div>
    );
  }
  if (status === "unsupported") {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 font-bold">
        This browser does not support service workers — the app runs without
        offline caching.
      </div>
    );
  }
  if (status === "no-sw") {
    return (
      <div className="rounded-2xl border border-base-200 bg-base-100 p-4 text-sm text-text-main">
        <div className="flex items-center gap-2 mb-1">
          <Cpu className="w-4 h-4 text-text-muted" />
          <span className="font-black">No service worker registered.</span>
        </div>
        <p className="text-xs text-text-muted">
          The app is running directly from the network. {cacheKeys.length} stale
          cache(s) found and can be cleared below.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
      <div className="flex items-center gap-2 mb-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-700" />
        <span className="font-black text-emerald-900">
          Service worker active
        </span>
        {hasWaiting && (
          <span className="ml-auto text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
            update waiting
          </span>
        )}
      </div>
      <dl className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs">
        <dt className="text-text-muted font-bold">Version</dt>
        <dd className="col-span-2 font-mono text-text-main truncate">
          {info?.version || "unknown"}
        </dd>
        <dt className="text-text-muted font-bold">Build</dt>
        <dd className="col-span-2 font-mono text-text-main truncate">
          {info?.buildId || "—"}
        </dd>
        <dt className="text-text-muted font-bold">Scope</dt>
        <dd className="col-span-2 font-mono text-text-main truncate">
          {info?.scope || "—"}
        </dd>
        <dt className="text-text-muted font-bold">Caches</dt>
        <dd className="col-span-2 font-mono text-text-main">
          {cacheKeys.length}
        </dd>
      </dl>
    </div>
  );
}

export default CacheHealthTab;