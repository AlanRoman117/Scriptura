import express from 'express';
import type { Express, Request, Response } from 'express';
import { createRouter } from '@scriptura/api';

/** Methods a read-only scripture API answers. */
const ALLOWED_METHODS = ['GET', 'HEAD', 'OPTIONS'] as const;
const ALLOW_HEADER = ALLOWED_METHODS.join(', ');

/**
 * Express types `req.query` values as `string | string[] | ParsedQs`, so the
 * router's `Record<string, string>` is a lie unless we actually flatten it.
 * Repeated params (`?q=a&q=b`) collapse to the last value; anything nested is
 * dropped rather than stringified into "[object Object]".
 */
function flattenQuery(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value === 'string') {
      out[key] = value;
    } else if (Array.isArray(value)) {
      const last = value[value.length - 1];
      if (typeof last === 'string') out[key] = last;
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
      console.error(`${req.method} ${req.path} failed:`, err);
      res.setHeader('Cache-Control', 'no-store');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return app;
}
