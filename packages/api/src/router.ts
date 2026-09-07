import { listTranslations, loadTranslation } from '@scriptura/core';
import type { Bible, LoadedBook } from '@scriptura/core';
import { search } from '@scriptura/search';
import { compareChapter, compareVerse } from '@scriptura/compare';
import {
  formatBook,
  formatChapter,
  formatTranslation,
  formatVerse,
  sampleSlugs,
} from './format.js';

export interface ScripturaRequest {
  path: string;
  query: Record<string, string>;
}

export interface ScripturaResponse {
  status: number;
  body: unknown;
}

/** Handlers receive the captured path groups, so they don't re-run the regex. */
type RouteHandler = (
  params: string[],
  req: ScripturaRequest
) => Promise<ScripturaResponse>;

function ok(body: unknown): ScripturaResponse {
  return { status: 200, body };
}

function notFound(error: string, extra?: Record<string, unknown>): ScripturaResponse {
  return { status: 404, body: { error, ...extra } };
}

function badRequest(error: string): ScripturaResponse {
  return { status: 400, body: { error } };
}

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

/** Parse a query-string integer, or null if it is present but unusable. */
function parseBounded(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number
): number | null {
  if (raw === undefined || raw === '') return fallback;
  if (!/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return value >= min && value <= max ? value : null;
}

/**
 * Load a translation, or produce the 404 for a bad id.
 *
 * Returned as a tagged union so callers can distinguish "no such translation"
 * from "no such book in it" — the old code caught both in one `try` and
 * reported every failure as a missing translation.
 */
async function withTranslation(
  id: string
): Promise<{ bible: Bible } | { error: ScripturaResponse }> {
  try {
    return { bible: await loadTranslation(id) };
  } catch {
    return { error: notFound(`Translation "${id}" not found`) };
  }
}

/** Resolve a book, or produce a 404 that shows what valid slugs look like. */
function withBook(
  bible: Bible,
  id: string,
  bookRef: string
): { book: LoadedBook } | { error: ScripturaResponse } {
  const book = bible.book(bookRef);
  if (book) return { book };
  return {
    error: notFound(`Book "${bookRef}" not found in translation "${id}"`, {
      hint: 'Use the English slug from the book filename; it is the same in every translation.',
      valid_examples: sampleSlugs(bible.slugs()),
    }),
  };
}

/** Split the comma-separated `translations` param, capped to keep one request sane. */
const MAX_COMPARE_TRANSLATIONS = 10;

function parseTranslationList(raw: string): string[] | null {
  const ids = raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0 || ids.length > MAX_COMPARE_TRANSLATIONS) return null;
  return ids;
}

const routes: Array<{ pattern: RegExp; handler: RouteHandler }> = [
  {
    // A browsable index. Without it `/` answers "Route not found", which is a
    // poor first impression when someone opens the server in a browser.
    pattern: /^\/$/,
    handler: async () => {
      const translations = await listTranslations();
      return ok({
        name: 'Scriptura API',
        translations: translations.length,
        endpoints: {
          translations: '/translations',
          translation: '/translations/{id}',
          book: '/translations/{id}/{book}',
          chapter: '/translations/{id}/{book}/{chapter}',
          verse: '/translations/{id}/{book}/{chapter}/{verse}',
          search: '/search?q={query}&translation={id}&limit=100&offset=0',
          compare: '/compare?ref={Book Chapter:Verse}&translations={id,id}',
          compare_chapter: '/compare/chapter?book={slug}&chapter={n}&translations={id,id}',
        },
        book_addressing:
          'The {book} segment is the English slug from the book filename (john, 1-samuel) ' +
          'and is the same in every translation. Localized name, abbreviation and ' +
          'canonical book number also resolve.',
        examples: [
          '/translations/kjv/john/3/16',
          '/translations/bungo/john/3/16',
          '/translations/rv1909/1-samuel/1/1',
          '/search?q=love&translation=kjv&limit=5',
          '/compare?ref=John+3:16&translations=kjv,rv1909,bungo',
          '/compare/chapter?book=john&chapter=3&translations=kjv,rv1909',
        ],
        docs: 'https://github.com/AlanRoman117/Scriptura/blob/main/docs/API.md',
      });
    },
  },
  {
    pattern: /^\/translations$/,
    handler: async () => ok(await listTranslations()),
  },
  {
    pattern: /^\/translations\/([^/]+)$/,
    handler: async ([id]) => {
      const loaded = await withTranslation(id);
      if ('error' in loaded) return loaded.error;
      return ok(formatTranslation(loaded.bible.meta, loaded.bible.books));
    },
  },
  {
    pattern: /^\/translations\/([^/]+)\/([^/]+)$/,
    handler: async ([id, bookRef]) => {
      const loaded = await withTranslation(id);
      if ('error' in loaded) return loaded.error;
      const found = withBook(loaded.bible, id, bookRef);
      if ('error' in found) return found.error;
      return ok(formatBook(id, found.book));
    },
  },
  {
    pattern: /^\/translations\/([^/]+)\/([^/]+)\/(\d+)$/,
    handler: async ([id, bookRef, chapterStr]) => {
      const loaded = await withTranslation(id);
      if ('error' in loaded) return loaded.error;
      const found = withBook(loaded.bible, id, bookRef);
      if ('error' in found) return found.error;

      const chapterNum = parseInt(chapterStr, 10);
      const chapter = found.book.chapters.find((c) => c.number === chapterNum);
      if (!chapter) {
        return notFound(`Chapter ${chapterNum} not found in ${found.book.name}`, {
          valid_range: [1, found.book.chapters.length],
        });
      }
      return ok(formatChapter(id, found.book, chapter));
    },
  },
  {
    pattern: /^\/translations\/([^/]+)\/([^/]+)\/(\d+)\/(\d+)$/,
    handler: async ([id, bookRef, chapterStr, verseStr]) => {
      const loaded = await withTranslation(id);
      if ('error' in loaded) return loaded.error;
      const found = withBook(loaded.bible, id, bookRef);
      if ('error' in found) return found.error;

      const chapterNum = parseInt(chapterStr, 10);
      const chapter = found.book.chapters.find((c) => c.number === chapterNum);
      if (!chapter) {
        return notFound(`Chapter ${chapterNum} not found in ${found.book.name}`, {
          valid_range: [1, found.book.chapters.length],
        });
      }

      const verseNum = parseInt(verseStr, 10);
      const verse = chapter.verses.find((v) => v.number === verseNum);
      if (!verse) {
        // Gaps are legitimate: critical-text translations omit verses such as
        // Acts 8:37, so a missing number is not necessarily out of range.
        return notFound(
          `Verse ${verseNum} not found in ${found.book.name} ${chapterNum}`
        );
      }
      return ok(formatVerse(id, found.book, chapter, verse));
    },
  },
  {
    pattern: /^\/search$/,
    handler: async (_params, req) => {
      const { q, translation } = req.query;
      if (!q || !translation) {
        return badRequest('Missing required query params: q, translation');
      }

      // Paginated because it has to be: "the" matches ~28,000 KJV verses, which
      // is a ~4MB body from a single unpaginated GET.
      const limit = parseBounded(req.query.limit, DEFAULT_LIMIT, 1, MAX_LIMIT);
      const offset = parseBounded(req.query.offset, 0, 0, Number.MAX_SAFE_INTEGER);
      if (limit === null) return badRequest(`"limit" must be an integer between 1 and ${MAX_LIMIT}`);
      if (offset === null) return badRequest('"offset" must be a non-negative integer');

      const loaded = await withTranslation(translation);
      if ('error' in loaded) return loaded.error;

      const all = await search(translation, q);
      return ok({
        query: q,
        translation,
        total: all.length,
        limit,
        offset,
        results: all.slice(offset, offset + limit),
      });
    },
  },
  {
    pattern: /^\/compare$/,
    handler: async (_params, req) => {
      const { ref, translations } = req.query;
      if (!ref || !translations) {
        return badRequest('Missing required query params: ref, translations');
      }
      const ids = parseTranslationList(translations);
      if (!ids) {
        return badRequest(
          `"translations" must list 1-${MAX_COMPARE_TRANSLATIONS} comma-separated ids`
        );
      }
      try {
        return ok({ reference: ref, results: await compareVerse(ref, ids) });
      } catch (err) {
        // compareVerse throws on a malformed reference — that's the caller's
        // mistake, so report 400 rather than letting it surface as a 500.
        return badRequest(err instanceof Error ? err.message : String(err));
      }
    },
  },
  {
    // Side-by-side chapter reading: the study-Bible view the roadmap calls the
    // v2 flagship. `compareChapter` has existed in @scriptura/compare all along
    // with no HTTP route, so the feature was library-only and unreachable.
    pattern: /^\/compare\/chapter$/,
    handler: async (_params, req) => {
      const { book, chapter, translations } = req.query;
      if (!book || !chapter || !translations) {
        return badRequest('Missing required query params: book, chapter, translations');
      }
      if (!/^\d+$/.test(chapter)) {
        return badRequest('"chapter" must be a positive integer');
      }
      const ids = parseTranslationList(translations);
      if (!ids) {
        return badRequest(
          `"translations" must list 1-${MAX_COMPARE_TRANSLATIONS} comma-separated ids`
        );
      }
      const chapterNum = parseInt(chapter, 10);
      const results = await compareChapter(book, chapterNum, ids);
      if (results.every((r) => r.verses.length === 0)) {
        return notFound(`No translation had ${book} ${chapterNum}`);
      }
      return ok({ book, chapter: chapterNum, results });
    },
  },
];

/**
 * Framework-agnostic router. Match a request against defined routes.
 * Integrate with Express, Fastify, or any other framework by adapting
 * the request/response to ScripturaRequest/ScripturaResponse.
 */
export async function createRouter(req: ScripturaRequest): Promise<ScripturaResponse> {
  for (const route of routes) {
    const match = req.path.match(route.pattern);
    if (match) return route.handler(match.slice(1), req);
  }
  return notFound('Route not found');
}
