/**
 * IndexedDB, hand-rolled and deliberately small.
 *
 * This is the source of truth for everything the user owns. Stage 2 adds the
 * notes and highlights stores; Stage 1 needs only the translation cache and the
 * durability plumbing, because getting persistence wrong is the one failure the
 * product exists to prevent.
 */

const DB_NAME = 'scriptura';
// Bumped when a store is added. The upgrade handler creates only what is
// missing, so it serves both a fresh install and an existing one.
const DB_VERSION = 3;

/** Downloaded translations, keyed by id. */
export const TRANSLATIONS = 'translations';
/** Small key/value settings — last-read location, export timestamps. */
export const SETTINGS = 'settings';
/** Markdown notes the user has written. The thing that must never be lost. */
export const NOTES = 'notes';
/** Verse highlights, anchored to {book_slug, chapter, verse}. */
export const HIGHLIGHTS = 'highlights';
/** Canvas boards — the spatial map of verses and notes, and its layout. */
export const BOARDS = 'boards';

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      // Separate stores on purpose: a corrupt or oversized translation must not
      // take the user's settings — later, their notes — down with it.
      if (!db.objectStoreNames.contains(TRANSLATIONS)) db.createObjectStore(TRANSLATIONS);
      if (!db.objectStoreNames.contains(SETTINGS)) db.createObjectStore(SETTINGS);
      if (!db.objectStoreNames.contains(NOTES)) db.createObjectStore(NOTES);
      if (!db.objectStoreNames.contains(HIGHLIGHTS)) db.createObjectStore(HIGHLIGHTS);
      if (!db.objectStoreNames.contains(BOARDS)) db.createObjectStore(BOARDS);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('IndexedDB upgrade blocked by another tab'));
  });
  return dbPromise;
}

function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const request = fn(tx.objectStore(store));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        tx.onabort = () => reject(tx.error);
      })
  );
}

export const get = <T>(store: string, key: string): Promise<T | undefined> =>
  run<T | undefined>(store, 'readonly', (s) => s.get(key) as IDBRequest<T | undefined>);

export const put = (store: string, key: string, value: unknown): Promise<IDBValidKey> =>
  run<IDBValidKey>(store, 'readwrite', (s) => s.put(value, key));

export const del = (store: string, key: string): Promise<undefined> =>
  run<undefined>(store, 'readwrite', (s) => s.delete(key) as IDBRequest<undefined>);

export const keys = (store: string): Promise<IDBValidKey[]> =>
  run<IDBValidKey[]>(store, 'readonly', (s) => s.getAllKeys());

export const all = <T>(store: string): Promise<T[]> =>
  run<T[]>(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>);

/**
 * Read a store without letting its failure spread.
 *
 * Stores are read independently on purpose: a translation that fails to parse
 * must not take the user's notes down with it. Returns the fallback and reports
 * rather than throwing, because a reader that renders nothing because one store
 * is damaged is worse than one that renders what it still has.
 */
export async function readSafely<T>(
  store: string,
  fallback: T,
  onFailure?: (store: string, error: unknown) => void
): Promise<T> {
  try {
    return await all<T extends (infer U)[] ? U : never>(store) as T;
  } catch (error) {
    onFailure?.(store, error);
    return fallback;
  }
}

/**
 * Write, reporting failure **once**.
 *
 * A quota failure repeats on every keystroke. Warning each time buries the app
 * in toasts and trains the user to dismiss the one message that matters, so the
 * first failure per store is reported and the rest are counted silently until
 * a write succeeds again.
 */
const failedStores = new Set<string>();

export async function writeSafely(
  store: string,
  key: string,
  value: unknown,
  onFirstFailure?: (store: string, error: unknown) => void
): Promise<boolean> {
  try {
    await put(store, key, value);
    failedStores.delete(store);
    return true;
  } catch (error) {
    if (!failedStores.has(store)) {
      failedStores.add(store);
      onFirstFailure?.(store, error);
    }
    return false;
  }
}

/** Test seam: forget which stores have already reported a failure. */
export function resetWriteFailures(): void {
  failedStores.clear();
}

/**
 * Ask the browser not to evict this origin's storage.
 *
 * This is the whole product promise and it is only a *request*: the browser may
 * refuse, and "clear site data" wipes everything regardless. Callers must show
 * the real answer rather than assume success — an app that silently believes it
 * is durable is exactly how users lose work.
 */
export async function requestPersistence(): Promise<'persisted' | 'denied' | 'unsupported'> {
  if (!navigator.storage?.persist) return 'unsupported';
  if (await navigator.storage.persisted()) return 'persisted';
  return (await navigator.storage.persist()) ? 'persisted' : 'denied';
}

/** Bytes used and available, when the browser will say. */
export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usage, quota };
}
