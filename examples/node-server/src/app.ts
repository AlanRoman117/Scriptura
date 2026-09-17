import express from 'express';
import type { Express, Request, Response } from 'express';
import { createRouter } from '@scriptura/api';

/**
 * Anything from a request that is written to a log, made safe to print.
 *
 * Line breaks first and by name: a newline in a request path would otherwise
 * write a log line of its own, one that looks as trustworthy as ours
 * (CodeQL js/log-injection). The rest of the control and format characters go
 * too, and the result is cut short.
 */
const sanitize = (value: string): string =>
  value.replace(/[\r\n]/g, ' ').replace(/[\p{Cc}\p{Cf}]/gu, ' ').slice(0, 200);

/** Methods a read-only scripture API answers. */
const ALLOWED_METHODS = ['GET', 'HEAD', 'OPTIONS'] as const;
const ALLOW_HEADER = ALLOWED_METHODS.join(', ');

/**
 * Every query parameter the API defines (packages/api/src/router.ts).
 *
 * ⚠️ **The names in a query string are the client's**, and a name is what
 * this adapter writes a property under: `?__proto__[x]=1` written to a plain
 * object reaches every object in the process (CodeQL
 * js/remote-property-injection). Express's parser drops those particular
 * names, but the adapter should not depend on that, and the router reads
 * nothing else anyway. A route that takes a new parameter adds it here.
 */
const QUERY_PARAMS = [
  'q',
  'translation',
  'translations',
  'limit',
  'offset',
  'mode',
  'match_case',
  'ref',
  'book',
  'chapter',
] as const;

/**
 * Express types `req.query` values as `string | string[] | ParsedQs`, so the
 * router's `Record<string, string>` is a lie unless we actually flatten it.
 * Repeated params (`?q=a&q=b`) collapse to the last value; anything nested is
 * dropped rather than stringified into "[object Object]".
 */
function flattenQuery(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of QUERY_PARAMS) {
    const value = req.query[name];
    if (typeof value === 'string') {
      out[name] = value;
    } else if (Array.isArray(value)) {
      const last = value[value.length - 1];
      if (typeof last === 'string') out[name] = last;
    }
  }
  return out;
}

/**
 * Build the Express app without binding a port.
 *
 * Separated from `index.ts` so tests can import and drive it. Calling
 * `app.listen()` at module scope — as this file used to — makes the server
 * impossible to test over HTTP, which is how the query-decoding path traversal
 * went unnoticed: `createRouter` was correct, the adapter around it was not.
 */
export function createApp(): Express {
  const app = express();

  // Pretty-print by default; a real deployment sets NODE_ENV=production and gets
  // compact bodies. Makes `curl` output readable while developing.
  app.set('json spaces', process.env.NODE_ENV === 'production' ? 0 : 2);

  // Express advertises itself by default; there is no reason to.
  app.disable('x-powered-by');

  app.use((req: Request, res: Response, next) => {
    // CORS. The corpus is public-domain scripture served read-only, so `*` is
    // the honest answer — and it matches the CloudFront Response Headers Policy
    // the deployment design specifies, so dev and prod agree. Set before the
    // method check so error responses carry it too; a browser cannot read a 405
    // or a 404 body without it.
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', ALLOW_HEADER);
    res.setHeader('Vary', 'Origin');

    // Preflight: answer it here rather than letting it fall through to the
    // router, which would return a 200 with a JSON body and no CORS headers.
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Max-Age', '86400');
      res.status(204).end();
      return;
    }

    // Nothing here is writable. Without this, `POST /translations/kjv` returned
    // 200 and the chapter data — harmless in effect, but not a claim worth
    // defending for an API that says it is read-only.
    if (!(ALLOWED_METHODS as readonly string[]).includes(req.method)) {
      res.setHeader('Allow', ALLOW_HEADER);
      res.status(405).json({ error: `Method ${req.method} not allowed`, allow: ALLOWED_METHODS });
      return;
    }

    next();
  });

  // `app.use` rather than `app.get('*')`: the bare '*' pattern throws at startup
  // under express 5 / path-to-regexp v8.
  app.use(async (req, res) => {
    try {
      const result = await createRouter({ path: req.path, query: flattenQuery(req) });

      // Scripture text does not change between deploys, so successful responses
      // are cacheable. Errors are not — a 404 today may be a 200 once a
      // translation is ingested.
      res.setHeader(
        'Cache-Control',
        result.status === 200 ? 'public, max-age=3600' : 'no-store'
      );
      res.status(result.status).json(result.body);
    } catch (err) {
      // Without this an unexpected throw inside a handler leaves the socket open
      // until the client times out.
      // The method and path are the client's: they go in as arguments, not as
      // the format itself, and control characters are stripped. A "%s" in a
      // request path must not consume the error, and a newline must not write
      // a line of its own (CodeQL js/tainted-format-string, js/log-injection).
      console.error('%s %s failed:', sanitize(req.method), sanitize(req.path), err);
      res.setHeader('Cache-Control', 'no-store');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return app;
}
