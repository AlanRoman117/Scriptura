import { defineConfig } from '@playwright/test';

/**
 * HTTP contract tests.
 *
 * API mode only — no browsers are installed or needed; the `request` fixture
 * speaks HTTP directly. When a front-end arrives this same config gains a
 * `projects` entry with a browser and the specs below stay as they are.
 *
 * Division of labour with jest (see CLAUDE.md): jest owns anything provable
 * in-process, Playwright owns anything that needs a real socket — status lines,
 * headers, CORS, HTTP methods, actual JSON serialisation. The rule of thumb is
 * "does the assertion need a real socket?"
 */
const PORT = Number(process.env.SCRIPTURA_TEST_PORT ?? 3333);

export default defineConfig({
  testDir: './tests/contract',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],

  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    extraHTTPHeaders: { Accept: 'application/json' },
  },

  webServer: {
    // The compiled server, not tsx — the contract we ship is the built one.
    command: 'npm run build && node examples/node-server/dist/index.js',
    url: `http://127.0.0.1:${PORT}/`,
    env: { PORT: String(PORT) },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
