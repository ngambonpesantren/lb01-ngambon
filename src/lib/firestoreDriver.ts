// Firestore driver for the Multi-Backend DB Management module.
// Implements the same surface (select / insert / upsert / update / delete /
// listTables / test) that dbConnections.ts exposes for Supabase, but mapped
// onto the NoSQL document model:
//   - "table"  -> Firestore collection name
//   - "row"    -> Firestore document
//   - "id"     -> document id
//
// The Firebase Web SDK is initialized client-side with a *publishable* config
// object (apiKey, projectId, etc. — these are not secrets in Firebase's
// security model; access is gated by Firestore Security Rules on the server).
// Each connection gets its own named FirebaseApp so multiple Firestore
// projects can coexist with the Supabase ones.

import {
  initializeApp,
  getApp,
  getApps,
  deleteApp,
  type FirebaseApp,
  type FirebaseOptions,
} from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  limit as fsLimit,
  type Firestore,
} from "firebase/firestore";

export type FirebaseConfig = FirebaseOptions & {
  apiKey: string;
  projectId: string;
  authDomain?: string;
  appId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
};

/** Default collections the app expects (mirrors APP_TABLES). */
export const FIREBASE_APP_COLLECTIONS = [
  "students",
  "master_goals",
  "categories",
  "activity_logs",
  "page_views",
  "settings",
  "app_events",
];

const appCache = new Map<string, FirebaseApp>();
const dbCache = new Map<string, Firestore>();

/** Parse a Firebase config blob from JSON or `key=value` lines. */
export function parseFirebaseConfig(input: string): FirebaseConfig {
  const trimmed = (input || "").trim();
  if (!trimmed) throw new Error("Empty Firebase config");

  // Try JSON first.
  if (trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed);
    if (!parsed.apiKey || !parsed.projectId) {
      throw new Error("Firebase config missing apiKey or projectId");
    }
    return parsed as FirebaseConfig;
  }

  // Fallback: parse `key: "value"` or `key=value` lines.
  const out: any = {};
  trimmed.split(/\r?\n/).forEach((line) => {
    const m = line.match(/([a-zA-Z_]+)\s*[:=]\s*['"]?([^'",]+)['"]?/);
    if (m) out[m[1]] = m[2].trim();
  });
  if (!out.apiKey || !out.projectId) {
    throw new Error("Firebase config missing apiKey or projectId");
  }
  return out as FirebaseConfig;
}

/** Initialize (or reuse) a FirebaseApp + Firestore instance for a connection. */
export function connectFirestore(connId: string, config: FirebaseConfig): Firestore {
  if (dbCache.has(connId)) return dbCache.get(connId)!;

  let app: FirebaseApp;
  try {
    app = getApp(connId);
  } catch {
    app = initializeApp(config, connId);
  }
  appCache.set(connId, app);
  const db = getFirestore(app);
  dbCache.set(connId, db);
  return db;
}

export function disposeFirestore(connId: string) {
  const app = appCache.get(connId);
  if (app) {
    deleteApp(app).catch(() => {});
  }
  appCache.delete(connId);
  dbCache.delete(connId);
}

/** Cheap connectivity check: try reading 1 doc from any known collection. */
export async function testFirestore(
  connId: string,
  config: FirebaseConfig,
  expectedCollections: string[] = FIREBASE_APP_COLLECTIONS,
): Promise<{ ok: boolean; error?: string; missingTables: string[] }> {
  try {
    const db = connectFirestore(connId, config);
    const probe = expectedCollections[0] || "students";
    await getDocs(query(collection(db, probe), fsLimit(1)));
    // Firestore is schemaless: a missing collection simply returns 0 docs,
    // it is not an error. So we report nothing missing on a successful read.
    return { ok: true, missingTables: [] };
  } catch (e: any) {
    return {
      ok: false,
      error: String(e?.message || e),
      missingTables: expectedCollections,
    };
  }
}

/** Treat the canonical app collections as "tables". */
export async function listFirestoreTables(): Promise<string[]> {
  // The Web SDK cannot enumerate collections (admin-only API), so we expose
  // the curated list. Custom collection names can still be typed in the UI.
  return [...FIREBASE_APP_COLLECTIONS];
}

function snapshotToRow(snap: any): any {
  const data = snap.data() || {};
  return { id: snap.id, ...data };
}

export async function fsSelect(
  connId: string,
  config: FirebaseConfig,
  table: string,
  max = 1000,
): Promise<any[]> {
  const db = connectFirestore(connId, config);
  const snaps = await getDocs(query(collection(db, table), fsLimit(max)));
  return snaps.docs.map(snapshotToRow);
}

export async function fsInsert(
  connId: string,
  config: FirebaseConfig,
  table: string,
  rows: any[],
  opts?: { upsert?: boolean },
): Promise<any[]> {
  if (!rows.length) return [];
  const db = connectFirestore(connId, config);
  const out: any[] = [];
  for (const row of rows) {
    const { id, ...rest } = row || {};
    if (id) {
      // Use deterministic id; setDoc with merge=true acts as upsert.
      await setDoc(doc(db, table, String(id)), rest, {
        merge: !!opts?.upsert,
      });
      out.push({ id, ...rest });
    } else {
      const ref = await addDoc(collection(db, table), rest);
      out.push({ id: ref.id, ...rest });
    }
  }
  return out;
}

export async function fsUpdate(
  connId: string,
  config: FirebaseConfig,
  table: string,
  id: string,
  patch: Record<string, any>,
): Promise<any> {
  const db = connectFirestore(connId, config);
  const ref = doc(db, table, String(id));
  // Firestore updateDoc fails if the doc doesn't exist; setDoc(merge) is safer.
  await setDoc(ref, patch, { merge: true });
  const snap = await getDoc(ref);
  return snap.exists() ? snapshotToRow(snap) : { id, ...patch };
}

export async function fsDeleteById(
  connId: string,
  config: FirebaseConfig,
  table: string,
  id: string,
): Promise<void> {
  const db = connectFirestore(connId, config);
  await deleteDoc(doc(db, table, String(id)));
}

export async function fsDeleteAll(
  connId: string,
  config: FirebaseConfig,
  table: string,
): Promise<void> {
  const db = connectFirestore(connId, config);
  const snaps = await getDocs(collection(db, table));
  await Promise.all(snaps.docs.map((d) => deleteDoc(d.ref)));
}