import { expect, test } from '@playwright/test';

/**
 * Display preferences (1.4.8, 2.3.3): chosen once, applied everywhere, kept
 * on this device.
 *
 * The assertions read computed styles and attributes on <html>, not the
 * settings controls — a select that shows "150%" proves nothing about the
 * text. Reloads prove persistence; the pre-paint script is what makes a
 * reload land on the chosen theme, so the reload assertions are its test too.
 */

async function open(page: import('@playwright/test').Page) {
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
}

const fontSize = (page: import('@playwright/test').Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

test.describe('text size', () => {
  test('scales the reading text and survives a reload', async ({ page }) => {
    await open(page);
    const before = await fontSize(page, '.chapter__text');

    await page.getByTestId('settings-open').click();
    await page.getByTestId('pref-text-size').selectOption('150');
    await expect(page.locator('html')).toHaveAttribute('style', /--text-scale:\s*1\.5/);
    await page.getByTestId('settings-close').click();

    const after = await fontSize(page, '.chapter__text');
    expect(Math.abs(after - before * 1.5)).toBeLessThan(1);

    await page.reload();
    await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
    expect(Math.abs((await fontSize(page, '.chapter__text')) - before * 1.5)).toBeLessThan(1);
  });
});

test.describe('spacing', () => {
  test('relaxed meets the 1.5× line and paragraph rule', async ({ page }) => {
    await open(page);
    await page.getByTestId('settings-open').click();
    await page.getByTestId('pref-spacing').selectOption('relaxed');
    await page.getByTestId('settings-close').click();

    const metrics = await page.locator('.verse').first().evaluate((el) => {
      const text = el.closest('.chapter__text') as HTMLElement;
      const s = getComputedStyle(text);
      const size = parseFloat(s.fontSize);
      return {
        leading: parseFloat(s.lineHeight) / size,
        gap: parseFloat(getComputedStyle(el).marginBottom),
        line: parseFloat(s.lineHeight),
      };
    });
    expect(metrics.leading).toBeGreaterThanOrEqual(1.5);
    // Paragraph spacing at least 1.5 × the line spacing.
    expect(metrics.gap).toBeGreaterThanOrEqual(metrics.line * 1.5 - 1);
  });
});

test.describe('colours', () => {
  test('a pinned theme overrides the device, and system follows it again', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await open(page);
    const paper = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(await paper()).toBe('rgb(250, 249, 247)');

    await page.getByTestId('settings-open').click();
    await page.getByTestId('pref-theme').selectOption('dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await paper()).toBe('rgb(23, 22, 20)');
    // The browser chrome follows.
    const metas = await page.locator('meta[name="theme-color"]').evaluateAll((m) =>
      m.map((el) => (el as HTMLMetaElement).content)
    );
    expect(metas).toEqual(['#171614', '#171614']);

    await page.reload();
    await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.getByTestId('settings-open').click();
    await page.getByTestId('pref-theme').selectOption('system');
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /./);
    expect(await paper()).toBe('rgb(250, 249, 247)');
  });

  test('high contrast and sepia are real themes', async ({ page }) => {
    await open(page);
    await page.getByTestId('settings-open').click();
    const paper = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await page.getByTestId('pref-theme').selectOption('hc-dark');
    expect(await paper()).toBe('rgb(0, 0, 0)');
    await page.getByTestId('pref-theme').selectOption('sepia');
    expect(await paper()).toBe('rgb(244, 236, 216)');
  });
});
