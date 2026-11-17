// Where a clip outlives the page: IndexedDB.
//
// A Bluesky sign-in leaves the page — the authorization server sends the browser
// away and back — and everything the page held in memory goes with it. The takes
// are the recording itself, the most valuable thing DemoShine has, so the clip is
// written down before that trip and read back on the way in.
//
// IndexedDB is the only store here that takes a Blob, which is what a take is;
// localStorage holds a string and a few megabytes at most. The record is the
// clip's own shape (`ClipSnapshot`), so nothing outside this module knows how it
// is kept — and the calls are serialized, because a save queued before a clear
// must not land after it.
//
// This is deliberately the browser boundary and nothing more: no rules live here,
// and a failure to write is reported to the caller rather than swallowed.

import type { Clip } from '../domain/clip/Clip.js';
import type { ClipSnapshot } from '../domain/clip/Clip.js';

const DB_NAME = 'demoshine';
const DB_VERSION = 1;
const STORE = 'clip';
const KEY = 'current';
const FORMAT = 1;

/** A clip as it is kept: what it is made of, and whether it had sound. */
export interface StoredClip {
  clip: ClipSnapshot;
  audio: boolean;
}

interface Record extends StoredClip {
  version: number;
}

// One transaction at a time, in the order the calls came: a save that was queued
// before a clear has to land before it, not after.
let queue: Promise<unknown> = Promise.resolve();

function serial<T>(op: () => Promise<T>): Promise<T> {
  const run = queue.then(op, op);
  queue = run.catch(() => {});
  return run;
}

/**
 * Write the clip down, and say when it is really on disk: the promise settles on
 * the transaction's completion, not the request's success, because the caller
 * may be about to leave the page.
 */
export function saveClip(clip: Clip, audio: boolean): Promise<void> {
  return serial(() => put({ version: FORMAT, clip: clip.snapshot(), audio }));
}

/** The clip that was written down, or null when there is none usable. */
export function loadClip(): Promise<StoredClip | null> {
  return serial(async () => {
    const record = await get();
    // A record from a format we do not know is not a clip we can use.
    if (!record || record.version !== FORMAT || !Array.isArray(record.clip?.takes)) return null;
    return record.clip.takes.length ? { clip: record.clip, audio: !!record.audio } : null;
  }).catch(() => null);
}

/** Nothing is kept any more. */
export function clearClip(): Promise<void> {
  return serial(() => remove()).catch(() => {});
}

// ── the IndexedDB calls ──────────────────────────────────────────────────────

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('this browser has no IndexedDB')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('could not open the clip store'));
  });
  return dbPromise;
}

async function put(record: Record): Promise<void> {
  const db = await openDb();
  await txDone(db.transaction(STORE, 'readwrite').objectStore(STORE).put(record, KEY));
}

async function get(): Promise<Record | undefined> {
  const db = await openDb();
  return await req<Record | undefined>(db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY));
}

async function remove(): Promise<void> {
  const db = await openDb();
  await txDone(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(KEY));
}

// A read stands in for its request; a write stands in for its transaction, so the
// bytes are handed over before it is said to have happened.
function req<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('the clip store refused'));
  });
}

function txDone(request: IDBRequest): Promise<void> {
  const tx = request.transaction;
  return new Promise((resolve, reject) => {
    if (!tx) { reject(new Error('the clip store had no transaction')); return; }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('the clip store refused'));
    tx.onabort = () => reject(tx.error ?? new Error('the clip store gave up'));
  });
}
