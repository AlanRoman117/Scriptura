/**
 * The translation library: what exists, what is downloaded, and what it costs.
 *
 * Eleven translations is about 65MB of raw JSON, so this is not a "fetch them
 * all on install" feature. Everything here is per-translation and reversible:
 * download one, read it offline forever, delete it when the space is worth more
 * than the text.
 */
import type { TranslationMeta } from '@scriptura/core/types';
import { SETTINGS, TRANSLATIONS, del, get, keys, put } from './db';
import { API_BASE, DEFAULT_TRANSLATION, type FullTranslation } from './api';

export { downloadPercent, formatBytes } from './units';

/** Where the bundled catalogue lives — the floor when there is no network. */
const CATALOG_URL = `${import.meta.env.BASE_URL}bible/catalog.json`;

export interface CatalogEntry extends TranslationMeta {
  /**
   * Roughly what the download weighs, from the build.
   *
   * Named "approx" because it is: the raw size of the source book files, which
   * is a few percent off the `full.json` actually transferred. Precise enough
   * to answer "do I want this on mobile data?", which is the only question it
   * is asked.
   */
  approxBytes?: number;
}

interface CatalogFile {
  translations: TranslationMeta[];
  approx_bytes?: Record<string, number>;
}

/**
 * Every translation the project publishes.
 *
 * The bundled catalogue answers first so the library renders instantly and
 * works offline; a live `/translations` is merged over it when one is reachable,
 * which is how a translation added after this build becomes visible.
 */
export async function loadCatalog(): Promise<CatalogEntry[]> {
  const bundled = await fetch(CATALOG_URL)
    .then((r) => (r.ok ? (r.json() as Promise<CatalogFile>) : null))
    .catch(() => null);

  const sizes = bundled?.approx_bytes ?? {};
  const merged = new Map<string, CatalogEntry>();
  for (const t of bundled?.translations ?? []) {
    merged.set(t.id, { ...t, approxBytes: sizes[t.id] });
  }

  const live = await fetch(`${API_BASE}/translations`)
    .then((r) => (r.ok ? (r.json() as Promise<TranslationMeta[]>) : null))
    .catch(() => null);

  for (const t of live ?? []) {
    merged.set(t.id, { ...merged.get(t.id), ...t, approxBytes: sizes[t.id] });
  }

  return [...merged.values()];
}

/** The ids currently held in IndexedDB, readable with the network off. */
export const installedIds = (): Promise<string[]> =>
  keys(TRANSLATIONS)
    .then((k) => k.map(String))
    .catch(() => []);

export type Progress = (received: number, total: number) => void;

/**
 * Download one translation into IndexedDB, reporting progress.
 *
 * ⚠️ `Content-Length` is the **compressed** length when the response is gzipped,
 * while `response.body` yields decompressed bytes — using it as the denominator
 * sends progress sailing past 100%. The build-time approximate size is the right
 * scale for decompressed bytes, so it wins when known; the header is the
 * fallback, and the ratio is clamped either way.
 */
export async function downloadTranslation(
  id: string,
  onProgress?: Progress,
  approxBytes?: number
): Promise<FullTranslation> {
  const response = await fetch(`${API_BASE}/translations/${id}/full.json`);
  if (!response.ok) {
    throw new Error(`Could not download "${id}" (${response.status})`);
  }

  const header = Number(response.headers.get('content-length')) || 0;
  const total = approxBytes || header;
  const reader = response.body?.getReader();

  let text: string;
  if (!reader) {
    // No streaming body (a test shim, an old browser): still correct, just
    // without intermediate progress.
    text = await response.text();
    onProgress?.(text.length, total || text.length);
  } else {
    const chunks: Uint8Array[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      onProgress?.(received, Math.max(total, received));
    }
    text = new TextDecoder().decode(concat(chunks, received));
  }

  const full = JSON.parse(text) as FullTranslation;
  await put(TRANSLATIONS, id, full);
  return full;
}

function concat(chunks: Uint8Array[], length: number): Uint8Array {
  const out = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

/**
 * Delete a translation's text.
 *
 * The bundled default is refused: it is the app's floor, and removing it leaves
 * a reader with nothing to read the moment the network is gone — which is the
 * one state this app exists to survive. Notes and highlights are untouched
 * regardless, since both are anchored to the passage, not to a translation.
 */
export async function removeTranslation(id: string): Promise<boolean> {
  if (id === DEFAULT_TRANSLATION) return false;
  await del(TRANSLATIONS, id).catch(() => undefined);
  return true;
}

/** Whether a translation's text is already local. */
export const isInstalled = (id: string): Promise<boolean> =>
  get<FullTranslation>(TRANSLATIONS, id)
    .then((t) => t !== undefined)
    .catch(() => false);

/* ── Reading preferences ────────────────────────────────────────────────── */

const PREFS = 'reading';

export interface ReadingPrefs {
  /** The translation being read. */
  active?: string;
  /** Translations shown beside it, in the order they were added. */
  compareWith?: string[];
}

export const loadPrefs = (): Promise<ReadingPrefs> =>
  get<ReadingPrefs>(SETTINGS, PREFS)
    .then((p) => p ?? {})
    .catch(() => ({}));

export const savePrefs = (prefs: ReadingPrefs): Promise<unknown> =>
  put(SETTINGS, PREFS, prefs).catch(() => undefined);

/**
 * How many translations may sit beside the one being read.
 *
 * Four columns is already past what a pane this width renders legibly, and each
 * one is a whole translation held in memory.
 */
export const MAX_COMPARE = 3;
