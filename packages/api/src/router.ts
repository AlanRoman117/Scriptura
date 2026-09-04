import { loadTranslation, listTranslations } from '@scriptura/core';
import type { TranslationMeta, Verse } from '@scriptura/core';
import { search } from '@scriptura/search';

export interface ScripturaRequest {
  path: string;
  query: Record<string, string>;
}

export interface ScripturaResponse {
  status: number;
  body: unknown;
}

type RouteHandler = (req: ScripturaRequest) => Promise<ScripturaResponse>;

function ok(body: unknown): ScripturaResponse {
  return { status: 200, body };
}

function notFound(message: string): ScripturaResponse {
  return { status: 404, body: { error: message } };
}

function badRequest(message: string): ScripturaResponse {
  return { status: 400, body: { error: message } };
}

const routes: Array<{ pattern: RegExp; handler: RouteHandler }> = [
  {
    pattern: /^\/translations$/,
    handler: async () => {
      const translations = await listTranslations();
      return ok(translations);
    },
  },
  {
    pattern: /^\/translations\/([^/]+)$/,
    handler: async (req) => {
      const id = req.path.match(/^\/translations\/([^/]+)$/)![1];
      try {
        const bible = await loadTranslation(id);
        return ok(bible.meta);
      } catch {
        return notFound(`Translation "${id}" not found`);
      }
    },
  },
  {
    pattern: /^\/translations\/([^/]+)\/([^/]+)\/(\d+)$/,
    handler: async (req) => {
      const match = req.path.match(/^\/translations\/([^/]+)\/([^/]+)\/(\d+)$/)!;
      const [, id, bookName, chapterStr] = match;
      try {
        const bible = await loadTranslation(id);
        const chapter = bible.chapter(bookName, parseInt(chapterStr, 10));
        if (!chapter) return notFound('Chapter not found');
        return ok(chapter);
      } catch {
        return notFound(`Translation "${id}" not found`);
      }
    },
  },
  {
    pattern: /^\/translations\/([^/]+)\/([^/]+)\/(\d+)\/(\d+)$/,
    handler: async (req) => {
      const match = req.path.match(/^\/translations\/([^/]+)\/([^/]+)\/(\d+)\/(\d+)$/)!;
      const [, id, bookName, chapterStr, verseStr] = match;
      try {
        const bible = await loadTranslation(id);
        const verse = bible.verse(bookName, parseInt(chapterStr, 10), parseInt(verseStr, 10));
        if (!verse) return notFound('Verse not found');
        return ok(verse);
      } catch {
        return notFound(`Translation "${id}" not found`);
      }
    },
  },
  {
    pattern: /^\/search$/,
    handler: async (req) => {
      const { q, translation } = req.query;
      if (!q || !translation) return badRequest('Missing required query params: q, translation');
      const results = await search(translation, q);
      return ok(results);
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
    if (route.pattern.test(req.path)) {
      return route.handler(req);
    }
  }
  return notFound('Route not found');
}
