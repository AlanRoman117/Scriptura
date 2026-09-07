import { expect, test } from '@playwright/test';

/**
 * The dev server must actually work.
 *
 * Every other reader spec runs against a production build, because that is
 * where the service worker lives. That left a real hole: `vite build` runs the
 * @scriptura/* CommonJS output through Rollup's commonjs plugin, but the dev
 * server does not pre-bundle *linked* workspace dependencies by default. It
 * served `dist/bible.js` raw and the browser rejected it —
 *
 *   SyntaxError: The requested module '/@fs/.../packages/core/dist/bible.js'
 *   does not provide an export named 'createBible'
 *
 * — so the app was broken in exactly the mode a developer uses all day, while
 * every test passed. `optimizeDeps.include` in vite.config.ts is the fix; this
 * is the guard.
 */

test('the app boots in dev with no console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('chapter')).toContainText('In the beginning was the Word');

  expect(errors).toEqual([]);
});

test('the pure @scriptura subpaths resolve as ES modules in dev', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });

  // Book resolution comes from the server's createBible. If the CommonJS
  // interop were broken this would never render at all.
  await page.getByTestId('book-select').selectOption('1-samuel');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('1 Samuel 1');

  expect(errors.filter((e) => /does not provide an export/.test(e))).toEqual([]);
});
