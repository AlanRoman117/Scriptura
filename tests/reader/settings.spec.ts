import { expect, test } from '@playwright/test';
import { PAPER, rgb, styleTile, type StyleName } from '../helpers/styles';

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

test.describe('style and appearance', () => {
  const paper = (page: import('@playwright/test').Page) =>
    page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const metas = (page: import('@playwright/test').Page) =>
    page.locator('meta[name="theme-color"]').evaluateAll((m) => m.map((el) => (el as HTMLMetaElement).content));

  test('a pinned appearance overrides the device, and system follows it again', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await open(page);
    expect(await paper(page)).toBe(rgb(PAPER.classic.light));

    await page.getByTestId('settings-open').click();
    await page.getByTestId('pref-appearance').selectOption('dark');
    await expect(page.locator('html')).toHaveAttribute('data-appearance', 'dark');
    expect(await paper(page)).toBe(rgb(PAPER.classic.dark));
    // The browser chrome follows.
    expect(await metas(page)).toEqual([PAPER.classic.dark, PAPER.classic.dark]);

    await page.reload();
    await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('html')).toHaveAttribute('data-appearance', 'dark');

    await page.getByTestId('settings-open').click();
    await page.getByTestId('pref-appearance').selectOption('system');
    await expect(page.locator('html')).not.toHaveAttribute('data-appearance', /./);
    expect(await paper(page)).toBe(rgb(PAPER.classic.light));
  });

  test('every style paints its own paper, light and dark, and survives a reload', async ({ page }) => {
    await open(page);
    await page.getByTestId('settings-open').click();
    for (const [style, papers] of Object.entries(PAPER)) {
      await styleTile(page, style as StyleName).click();
      // Classic is the absent attribute.
      if (style === 'classic') await expect(page.locator('html')).not.toHaveAttribute('data-style', /./);
      else await expect(page.locator('html')).toHaveAttribute('data-style', style);
      for (const appearance of ['light', 'dark'] as const) {
        await page.getByTestId('pref-appearance').selectOption(appearance);
        expect(await paper(page), `${style} ${appearance}`).toBe(rgb(papers[appearance]));
      }
    }
    await styleTile(page, 'sepia').click();
    await page.reload();
    await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
    expect(await paper(page)).toBe(rgb(PAPER.sepia.dark));
  });

  test('a theme stored before styles existed still applies', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('scriptura-display', JSON.stringify({ theme: 'hc-dark' })));
    await open(page);
    await expect(page.locator('html')).toHaveAttribute('data-style', 'contrast');
    await expect(page.locator('html')).toHaveAttribute('data-appearance', 'dark');
    expect(await paper(page)).toBe(rgb(PAPER.contrast.dark));
    await page.getByTestId('settings-open').click();
    await expect(page.getByTestId('pref-style-contrast')).toBeChecked();
    await expect(page.getByTestId('pref-appearance')).toHaveValue('dark');
  });
});

/*
 * Style is chosen from tiles, each drawn in its own style, so the choice
 * shows what it gives. Native radios underneath: one group name, arrow keys,
 * and a checked state a screen reader can say.
 */
test.describe('the style tiles', () => {
  test("each tile is drawn in its own style, in the page's light or dark", async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await open(page);
      await page.getByTestId('settings-open').click();
      for (const [style, papers] of Object.entries(PAPER)) {
        const tile = page.locator(`.style-tile[data-style-preview="${style}"]`);
        expect(await tile.evaluate((el) => getComputedStyle(el).backgroundColor), `${style}, ${scheme}`).toBe(rgb(papers[scheme]));
      }
    }
  });

  test('a group with a name, reached as one stop, moved through with the arrows', async ({ page }) => {
    await open(page);
    await page.getByTestId('settings-open').click();
    await expect(page.getByRole('radiogroup', { name: 'Style' }).or(page.getByRole('group', { name: 'Style' }))).toHaveCount(1);
    const classic = page.getByTestId('pref-style-classic');
    await expect(classic).toBeChecked();
    await classic.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('pref-style-contrast')).toBeChecked();
    // The focused tile shows the ring, since the radio itself is hidden.
    await expect(styleTile(page, 'contrast')).toHaveCSS('outline-style', 'solid');
    await expect(page.locator('html')).toHaveAttribute('data-style', 'contrast');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('html')).toHaveAttribute('data-style', 'sepia');
    // The chosen tile is marked by more than colour: a check and a heavier edge.
    const check = page.locator('.style-tile[data-style-preview="sepia"] .style-tile__check');
    await expect(check).toBeVisible();
    await expect(page.locator('.style-tile[data-style-preview="classic"] .style-tile__check')).toBeHidden();
  });

  test('a tile takes its own corners and faces inside another style', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('scriptura-display', JSON.stringify({ style: 'vellum' })));
    await open(page);
    await page.getByTestId('settings-open').click();
    const radius = (style: string) =>
      page.locator(`.style-tile[data-style-preview="${style}"]`).evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
    const tracking = (style: string) =>
      page.locator(`.style-tile[data-style-preview="${style}"] .style-tile__name`).evaluate((el) => getComputedStyle(el).fontVariantCaps);
    // Classic drawn inside a Vellum page is Classic: no small capitals.
    expect(await tracking('vellum')).toBe('small-caps');
    expect(await tracking('classic')).toBe('normal');
    expect(await radius('classic')).not.toBe(await radius('emerald'));
  });
});

