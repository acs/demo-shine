// Where an image annotation's picture is kept, and the decoded copy it is drawn from.
//
// Two things, one module, because they are the two halves of the same fact. The
// **store** is an IndexedDB object store, `images`, in the clip's own database: a
// picture is megabytes and never changes, so it is written once, apart from the clip's
// small half — the same split a take gets, and for the same reason. The **cache** is
// the decoded `HTMLImageElement` for a picture, made once and drawn many times, so a
// frame is a `drawImage` and not a decode; it is let go with the session, exactly as the
// takes' object URLs are (`src/infra/takes.ts`).
//
// A picture that cannot be read is refused, and nothing is written: `put` decodes first.
// A picture that is not decoded yet draws nothing rather than throwing, so a frame
// between a reload and the decode is a frame without the image, not a broken one.

import { openClipDb } from './clip-store.js';
import type { ImageStorePort, StoredImage } from '../application/ports/ImageStorePort.js';

const STORE = 'images';

const decoded = new Map<string, HTMLImageElement>();
const objectUrls = new Map<string, string>();
const inFlight = new Set<Promise<unknown>>();

// Keep a promise visible to `ready()` while it runs, and stop an unhandled rejection
// from a caller that only cared about the outcome later.
function track<T>(work: Promise<T>): Promise<T> {
  inFlight.add(work);
  void work.catch(() => {}).finally(() => inFlight.delete(work));
  return work;
}

/** Decode a picture and hold it. Rejects when it cannot be read. */
async function remember(id: string, blob: Blob): Promise<void> {
  if (decoded.has(id)) return;
  const url = URL.createObjectURL(blob);
  const image = new Image();
  try {
    // The `load` event is what says the picture can be drawn. `decode()` is asked for
    // afterwards and not awaited: it lets the browser finish decoding off the critical
    // path, but it can also never settle, and a picture that loads is already drawable.
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('that picture could not be read'));
      image.src = url;
    });
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error instanceof Error ? error : new Error('that picture could not be read');
  }
  void image.decode?.().catch(() => {});
  objectUrls.set(id, url);
  decoded.set(id, image);
}

function writeDb(db: IDBDatabase, id: string, blob: Blob): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('the picture store refused'));
    tx.onabort = () => reject(tx.error ?? new Error('the picture store gave up'));
  });
}

function readAllDb(db: IDBDatabase): Promise<StoredImage[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const keys = store.getAllKeys();
    const values = store.getAll();
    tx.oncomplete = () => {
      const ks = keys.result as IDBValidKey[];
      const vs = values.result as Blob[];
      resolve(ks.map((k, i) => ({ id: String(k), blob: vs[i] })));
    };
    tx.onerror = () => reject(tx.error ?? new Error('the picture store refused'));
  });
}

export const images: ImageStorePort & {
  /** The decoded picture for drawing, or null when it is not there yet. */
  get(id: string): CanvasImageSource | null;
  /** Resolves when every picture asked for so far is decoded — the export awaits this. */
  ready(): Promise<void>;
  /** Read every kept picture back into the cache — a restore. */
  load(): Promise<void>;
  /** Let the pictures and the cache go with the clip. */
  clear(): Promise<void>;
} = {
  /** Write a picture once, under its id, and decode it for drawing. */
  put(id: string, blob: Blob): Promise<void> {
    return track((async () => {
      await remember(id, blob);                  // a bad picture is refused before anything is written
      await writeDb(await openClipDb(), id, blob);
    })());
  },

  /** Every kept picture, in the store. */
  async all(): Promise<StoredImage[]> {
    return readAllDb(await openClipDb());
  },

  /** The decoded picture for drawing, or null when it is not there yet. */
  get(id: string): CanvasImageSource | null {
    return decoded.get(id) ?? null;
  },

  /** Resolves when every picture asked for so far is decoded — the export awaits this. */
  async ready(): Promise<void> {
    await Promise.allSettled([...inFlight]);
  },

  /** Read every kept picture back into the cache — a restore. An unreadable one is left out. */
  load(): Promise<void> {
    return track((async () => {
      for (const { id, blob } of await readAllDb(await openClipDb())) {
        await remember(id, blob).catch(() => {});
      }
    })());
  },

  /** Let the pictures and the cache go with the clip. */
  async clear(): Promise<void> {
    for (const url of objectUrls.values()) URL.revokeObjectURL(url);
    objectUrls.clear();
    decoded.clear();
    try {
      const db = await openClipDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('the picture store refused'));
        tx.onabort = () => reject(tx.error ?? new Error('the picture store gave up'));
      });
    } catch {
      // Nothing to let go of, or no IndexedDB: the cache is already empty.
    }
  },
};
