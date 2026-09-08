import { getDataDir } from '@scriptura/core';
import { createApp } from './app.js';

const PORT = Number(process.env.PORT ?? 3000);

/**
 * Loopback by default.
 *
 * Binding every interface makes macOS raise its "accept incoming network
 * connections?" prompt for each new `node` binary, and a Deny — or a firewall
 * set to block by default — leaves Playwright's `webServer` health check
 * waiting on 127.0.0.1 until it times out 120 seconds later. That is the
 * classic "the tests just hang on my Mac" symptom, and it is also the wrong
 * default for a development server regardless of platform. Set HOST=0.0.0.0 to
 * expose it deliberately.
 */
const HOST = process.env.HOST ?? '127.0.0.1';

createApp().listen(PORT, HOST, () => {
  console.log(`Scriptura API running on http://${HOST}:${PORT}`);
  console.log(`Serving data from ${getDataDir()}`);
});
