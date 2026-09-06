import express from 'express';
import type { Request } from 'express';
import { createRouter } from '@scriptura/api';
import { getDataDir } from '@scriptura/core';

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

// Pretty-print by default; a real deployment sets NODE_ENV=production and gets
// compact bodies. Makes `curl` output readable while developing.
app.set('json spaces', process.env.NODE_ENV === 'production' ? 0 : 2);

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

// `app.use` rather than `app.get('*')`: the bare '*' pattern throws at startup
// under express 5 / path-to-regexp v8.
app.use(async (req, res) => {
  try {
    const result = await createRouter({ path: req.path, query: flattenQuery(req) });
    res.status(result.status).json(result.body);
  } catch (err) {
    // Without this an unexpected throw inside a handler leaves the socket open
    // until the client times out.
    console.error(`${req.method} ${req.path} failed:`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Scriptura API running on http://localhost:${PORT}`);
  console.log(`Serving data from ${getDataDir()}`);
});
