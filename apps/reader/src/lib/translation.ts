/**
 * Getting a usable `Bible` in front of the reader, offline-first.
 *
 * The shape stored here is exactly the API's `/translations/:id/full.json`, and
 * the `Bible` is built with the *server's* `createBible` — so book resolution
 * (slug, localized name, abbreviation, canonical number) and search folding
 * behave identically online and off. Reimplementing either in the browser would
 * silently drift; that is why `@scriptura/core` grew subpath exports.
 *
 * Import only the pure subpaths. `@scriptura/core` proper reaches for node:fs.
 */
import { createBible } from '@scriptura/core/bible';
import type { Bible, LoadedBook, TranslationMeta } from '@scriptura/core/types';
import { get, put, TRANSLATIONS } from './db';

/** `full.json`: translation metadata plus every book, chapter and verse. */
export interface FullTranslation extends TranslationMeta {
  books: LoadedBook[];
}

/** The translation bundled with the app for immediate offline use. */
export const DEFAULT_TRANSLATION = 'bsb';

/** Where the bundled copy lives; other translations come from the API. */
const BUNDLED_URL = `${import.meta.env.BASE_URL}bible/${DEFAULT_TRANSLATION}.json`;

export type LoadStage = 'cache' | 'download' | 'ready';

/**
 * Load a translation, preferring the local copy.
 *
 * IndexedDB first so a repeat visit never touches the network, then the bundled
 * file. `onStage` exists because the first run is a multi-megabyte download and
 * a blank screen is indistinguishable from a broken app.
 */
export async function loadTranslation(
  id: string = DEFAULT_TRANSLATION,
  onStage?: (stage: LoadStage) => void
): Promise<Bible> {
  const cached = await get<FullTranslation>(TRANSLATIONS, id).catch(() => undefined);
  if (cached) {
    onStage?.('cache');
    return toBible(cached);
  }

  onStage?.('download');
  const response = await fetch(id === DEFAULT_TRANSLATION ? BUNDLED_URL : `/api/translations/${id}/full.json`);
  if (!response.ok) throw new Error(`Could not load translation "${id}" (${response.status})`);
  const full = (await response.json()) as FullTranslation;

  // A failed write is not fatal to *this* session — the app works from memory —
  // so surface it rather than refusing to render.
  await put(TRANSLATIONS, id, full).catch((err) => {
    console.warn(`Could not cache "${id}" for offline use:`, err);
  });

  onStage?.('ready');
  return toBible(full);
}

function toBible(full: FullTranslation): Bible {
  const { books, ...meta } = full;
  return createBible(meta as TranslationMeta, books);
}

/**
 * Whether the licence obliges us to show attribution beside the text.
 *
 * `vbl` is CC BY-SA 4.0 — the one non-public-domain translation — and the
 * licence requires the notice where the material appears, not in an About page.
 * Derived from the licence rather than hardcoded to `vbl` so a future
 * translation inherits the behaviour automatically.
 */
export function requiresAttribution(meta: TranslationMeta): boolean {
  return meta.license !== 'public-domain' && meta.license !== 'cc0';
}
