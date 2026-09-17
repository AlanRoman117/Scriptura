import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';

/**
 * A folder served over HTTP the way a static host serves it.
 *
 * Two suites need one. The offline update tests serve the built app from an
 * origin of their own, because Playwright's routing never sees the browser's
 * check for a newer worker, and change what `sw.js` says there. The `site`
 * project serves the published site under the path GitHub Pages gives it.
 *
 * Content types come from the extension, as they do on Pages. A path ending
 * in `/` is its `index.html`, and the prefix without its slash is redirected
 * to it. A missing file is a plain 404 on a static host. A single-page app
 * server can instead answer with `index.html` (`fallback: 'index'`).
 */
export const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
};

export interface StaticServerOptions {
  /** The folder served. */
  root: string;
  /** The path it is served under, with slashes at both ends: `/` or `/Scriptura/`. */
  prefix?: string;
  /** What a path with no file gets: a 404, or the app's `index.html`. */
  fallback?: 'not-found' | 'index';
  /** Paths that stay a 404 even with `fallback: 'index'`. */
  alwaysMissing?: (path: string) => boolean;
  /** `Cache-Control` on every response. GitHub Pages sends `max-age=600`. */
  cacheControl?: string;
  /** Changes a file's body before it is sent, by its path under the prefix. */
  transform?: (path: string, body: Buffer) => Buffer | string;
}

export interface StaticServer {
  /** `http://127.0.0.1:<port>`, with no trailing slash. */
  origin: string;
  close: () => Promise<void>;
}

export async function serveStatic(options: StaticServerOptions): Promise<StaticServer> {
  const root = resolve(options.root);
  const prefix = options.prefix ?? '/';
  const cacheControl = options.cacheControl ?? 'no-cache';

  const server = createServer(async (req, res) => {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
    if (prefix !== '/' && url === prefix.slice(0, -1)) {
      res.writeHead(301, { location: prefix }).end();
      return;
    }
    if (!url.startsWith(prefix)) {
      res.writeHead(404, { 'content-type': CONTENT_TYPES['.txt'] }).end('Not found');
      return;
    }
    const path = `/${url.slice(prefix.length)}`;
    const file = resolve(root, `.${path.endsWith('/') ? `${path}index.html` : path}`);
    const send = (body: Buffer | string, type: string) => {
      res.writeHead(200, { 'content-type': type, 'cache-control': cacheControl });
      res.end(body);
    };
    try {
      if (file !== root && !file.startsWith(root + sep)) throw new Error('outside the root');
      // Read straight away rather than asking about the file first: a
      // directory or a missing file throws, and the catch answers as the host
      // would. (Checking and then reading is also a race, which CodeQL flags.)
      const body = await readFile(file);
      send(options.transform ? options.transform(path, body) : body, CONTENT_TYPES[extname(file)] ?? 'application/octet-stream');
    } catch {
      if (options.fallback === 'index' && !options.alwaysMissing?.(path)) {
        send(await readFile(join(root, 'index.html')), CONTENT_TYPES['.html']);
        return;
      }
      res.writeHead(404, { 'content-type': CONTENT_TYPES['.txt'], 'cache-control': cacheControl }).end('Not found');
    }
  });

  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  return {
    origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    close: () => new Promise<void>((done) => server.close(() => done())),
  };
}
