import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
} from "firebase/firestore";

// Phase 3: Firebase init driven strictly by .env variables.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
};

// Database ID from env; NEVER fall back to the literal "(default)".
const DB_ID = process.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_DB_ID || "";

// Initialize app once (HMR-safe)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const auth = getAuth(app);

/**
 * Firestore with IndexedDB offline persistence.
 *
 * - On the browser we use `initializeFirestore` + `persistentLocalCache` with
 *   the multi-tab manager so multiple tabs share one cache (replaces the
 *   deprecated `enableMultiTabIndexedDbPersistence`).
 * - On the server (SSR) IndexedDB does not exist; we fall back to the
 *   default in-memory `getFirestore` so imports don't crash during build.
 * - Wrapped in try/catch: if the browser blocks IDB (e.g. private mode in
 *   older Safari) we degrade to the default in-memory Firestore.
 */
function createDb() {
  if (typeof window === "undefined") {
    return getFirestore(app, DB_ID);
  }
  try {
    return initializeFirestore(
      app,
      {
        experimentalForceLongPolling: true,
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      },
      DB_ID,
    );
  } catch {
    return getFirestore(app, DB_ID);
  }
}

const db = createDb();

export { app, auth, db };
