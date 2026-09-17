import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { join } from 'node:path';
import { serveStatic } from '../helpers/static-server';

/** The path GitHub Pages serves this repository under. */
const LOCAL_BASE = '/Scriptura/';

/**
 * `site` is the published site's address, ending in a slash.
 *
 * With SITE_URL set it is the live site. Otherwise it is the folder `npm run
 * build:site` assembled, served the way Pages serves it: under the path, with
 * `max-age=600` on every file and a plain 404 for anything missing.
 */
export const test = base.extend<object, { site: string }>({
  site: [
    async ({}, use, workerInfo) => {
      const live = process.env.SITE_URL;
      if (live) {
        await use(live.endsWith('/') ? live : `${live}/`);
        return;
      }
      const server = await serveStatic({
        // Resolved from the project's test directory: Playwright specs compile
        // as CommonJS here, so there is no import.meta.
        root: join(workerInfo.project.testDir, '..', '..', 'site'),
        prefix: LOCAL_BASE,
        cacheControl: 'max-age=600',
      });
      await use(`${server.origin}${LOCAL_BASE}`);
      await server.close();
    },
    { scope: 'worker' },
  ],
});

export { expect };

/** Open the site and wait for the chapter. */
export async function open(page: Page, site: string): Promise<void> {
  await page.goto(site);
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
}

/**
 * Every request that failed or was answered with an error, from now on.
 *
 * A static host has only the files it was given, so a request for anything
 * else is a path the app should not have asked for.
 */
export function failures(page: Page): string[] {
  const seen: string[] = [];
  page.on('requestfailed', (r) => {
    // A download cut short by going offline on purpose is not the site's fault.
    if (r.failure()?.errorText !== 'net::ERR_INTERNET_DISCONNECTED') seen.push(`${r.url()} — ${r.failure()?.errorText}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400) seen.push(`${r.url()} — ${r.status()}`);
  });
  return seen;
}
