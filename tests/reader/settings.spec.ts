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

/** Each style's paper, as the page paints it: rgb() of STYLE_PAPER in lib/prefs.ts. */
const PAPER = {
  classic: { light: 'rgb(250, 249, 247)', dark: 'rgb(23, 22, 20)' },
  contrast: { light: 'rgb(255, 255, 255)', dark: 'rgb(0, 0, 0)' },
  sepia: { light: 'rgb(244, 236, 216)', dark: 'rgb(30, 25, 18)' },
  vellum: { light: 'rgb(246, 239, 224)', dark: 'rgb(28, 22, 17)' },
  emerald: { light: 'rgb(243, 247, 244)', dark: 'rgb(13, 26, 21)' },
  slate: { light: 'rgb(244, 245, 247)', dark: 'rgb(22, 25, 29)' },
  nocturne: { light: 'rgb(245, 246, 250)', dark: 'rgb(15, 20, 36)' },
  ember: { light: 'rgb(251, 240, 226)', dark: 'rgb(0, 0, 0)' },
} as const;

const hex = (rgb: string) => '#' + rgb.match(/\d+/g)!.map((n) => Number(n).toString(16).padStart(2, '0')).join('');

test.describe('style and appearance', () => {
  const paper = (page: import('@playwright/test').Page) =>
    page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const metas = (page: import('@playwright/test').Page) =>
    page.locator('meta[name="theme-color"]').evaluateAll((m) => m.map((el) => (el as HTMLMetaElement).content));

  test('a pinned appearance overrides the device, and system follows it again', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await open(page);
    expect(await paper(page)).toBe(PAPER.classic.light);

    await page.getByTestId('settings-open').click();
    await page.getByTestId('pref-appearance').selectOption('dark');
    await expect(page.locator('html')).toHaveAttribute('data-appearance', 'dark');
    expect(await paper(page)).toBe(PAPER.classic.dark);
    // The browser chrome follows.
    expect(await metas(page)).toEqual([hex(PAPER.classic.dark), hex(PAPER.classic.dark)]);

    await page.reload();
    await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('html')).toHaveAttribute('data-appearance', 'dark');

    await page.getByTestId('settings-open').click();
    await page.getByTestId('pref-appearance').selectOption('system');
    await expect(page.locator('html')).not.toHaveAttribute('data-appearance', /./);
    expect(await paper(page)).toBe(PAPER.classic.light);
  });

  test('every style paints its own paper, light and dark, and survives a reload', async ({ page }) => {
    await open(page);
    await page.getByTestId('settings-open').click();
    for (const [style, papers] of Object.entries(PAPER)) {
      await page.getByTestId('pref-style').selectOption(style);
      // Classic is the absent attribute.
      if (style === 'classic') await expect(page.locator('html')).not.toHaveAttribute('data-style', /./);
      else await expect(page.locator('html')).toHaveAttribute('data-style', style);
      for (const appearance of ['light', 'dark'] as const) {
        await page.getByTestId('pref-appearance').selectOption(appearance);
        expect(await paper(page), `${style} ${appearance}`).toBe(papers[appearance]);
      }
    }
    await page.getByTestId('pref-style').selectOption('sepia');
    await page.reload();
    await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
    expect(await paper(page)).toBe(PAPER.sepia.dark);
  });

  test('a theme stored before styles existed still applies', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('scriptura-display', JSON.stringify({ theme: 'hc-dark' })));
    await open(page);
    await expect(page.locator('html')).toHaveAttribute('data-style', 'contrast');
    await expect(page.locator('html')).toHaveAttribute('data-appearance', 'dark');
    expect(await paper(page)).toBe(PAPER.contrast.dark);
    await page.getByTestId('settings-open').click();
    await expect(page.getByTestId('pref-style')).toHaveValue('contrast');
    await expect(page.getByTestId('pref-appearance')).toHaveValue('dark');
  });
});
