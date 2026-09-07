import { defineConfig, devices } from '@playwright/test';

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
const READER_PORT = Number(process.env.SCRIPTURA_READER_PORT ?? 4173);
const READER_DEV_PORT = Number(process.env.SCRIPTURA_READER_DEV_PORT ?? 5174);

export default defineConfig({
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],

  projects: [
    {
      // HTTP contract against the API. No browser is used or installed.
      name: 'contract',
      testDir: './tests/contract',
      use: {
        baseURL: `http://127.0.0.1:${PORT}`,
        extraHTTPHeaders: { Accept: 'application/json' },
      },
    },
    {
      // The reader PWA, in a real browser. Runs against the *built* app: the
      // service worker and precache manifest only exist in a production build,
      // and offline reading is the promise being tested.
      name: 'reader',
      testDir: './tests/reader',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: `http://127.0.0.1:${READER_PORT}`,
      },
    },
    {
      // The dev server, which resolves modules completely differently from the
      // production build — Vite pre-bundles dependencies there and does not
      // here. Shipping a reader that only works when built is not shipping a
      // reader; this project is small on purpose and only asserts that it boots
      // clean.
      name: 'reader-dev',
      testDir: './tests/reader-dev',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: `http://127.0.0.1:${READER_DEV_PORT}`,
      },
    },
  ],

  webServer: [
    {
      // The compiled server, not tsx — the contract we ship is the built one.
      command: 'npm run build && node examples/node-server/dist/index.js',
      url: `http://127.0.0.1:${PORT}/`,
      env: { PORT: String(PORT) },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: `npm run build --workspace @scriptura/reader && npm run preview --workspace @scriptura/reader -- --port ${READER_PORT} --strictPort --host 127.0.0.1`,
      url: `http://127.0.0.1:${READER_PORT}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: `npm run dev --workspace @scriptura/reader -- --port ${READER_DEV_PORT} --strictPort --host 127.0.0.1`,
      url: `http://127.0.0.1:${READER_DEV_PORT}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
