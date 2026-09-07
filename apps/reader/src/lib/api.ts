/**
 * What the reader knows about the JSON API, and nothing else.
 *
 * Split out so `library.ts` (downloading) and `translation.ts` (reading) can
 * both use it without importing each other. They did, briefly, in a cycle
 * papered over with a dynamic import — which Rollup rightly pointed out bought
 * nothing, since both modules end up in the same chunk anyway.
 */
import type { LoadedBook, TranslationMeta } from '@scriptura/core/types';

/** `full.json`: translation metadata plus every book, chapter and verse. */
export interface FullTranslation extends TranslationMeta {
  books: LoadedBook[];
}

/** The translation bundled with the app for immediate offline use. */
export const DEFAULT_TRANSLATION = 'bsb';

/**
 * Where the JSON API lives.
 *
 * A path by default, so a same-origin deployment (or the dev/preview proxy)
 * needs no configuration; `VITE_SCRIPTURA_API` points it at a CDN instead.
 * `/translations/:id/full.json` resolves against the static tree and against a
 * live server alike — the router accepts the `.json` for exactly this reason.
 */
export const API_BASE: string = import.meta.env.VITE_SCRIPTURA_API ?? '/api';
