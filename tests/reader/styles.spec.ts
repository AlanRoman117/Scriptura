import { expect, test, type Page } from '@playwright/test';
import { PAPER, STYLES, displayPrefs, hex, rgb, type StyleName } from '../helpers/styles';

/**
 * Every style, in each appearance: following the device, pinned light, and
 * pinned dark.
 *
 * A style's colours are measured pair by pair in tests/unit/contrast.test.ts
 * and painted under axe in tests/reader/a11y.spec.ts. What neither can see is
 * whether the page actually *uses* the right palette in each appearance. That
 * is this file's job:
 *
 * - **System** follows the device, and follows it live when the device
 *   changes, without a reload.
 * - **Light** and **dark** win over the device, so each is tested on a device
 *   set to the opposite, where a broken pin shows.
 * - The palette a pin produces is the palette the device's own setting
 *   produces. Every token is resolved and compared, so axe's verdict on one
 *   holds for the other.
 * - The inline script in index.html has already set the style, the
 *   appearance and the browser chrome's colour before the app's code runs,
 *   so the first paint is the right one.
 */

/** Tokens a style's palette sets, and the fills derived from them. */
const TOKENS = [
  '--ink', '--ink-soft', '--paper', '--paper-raised', '--paper-sunken', '--rule', '--edge', '--accent', '--danger',
  '--focus', '--rubric', '--heading', '--hover', '--press', '--accent-tint', '--selection-wash', '--bar-bg',
  '--hl-amber', '--hl-rose', '--hl-sky', '--hl-mint', '--hl-violet',
];

/** Every token above, resolved to the colour it paints right now. */
const palette = (page: Page) =>
  page.evaluate((tokens) => {
    const probe = document.createElement('span');
    document.body.append(probe);
    const out: Record<string, string> = {};
    for (const token of tokens) {
      probe.style.color = `var(${token})`;
      out[token] = getComputedStyle(probe).color;
    }
    probe.remove();
    return out;
  }, TOKENS);

const paper = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

/** The browser chrome's colour, meta by meta: `[light, dark]`, in document order. */
const chrome = (page: Page) =>
  page.locator('meta[name="theme-color"]').evaluateAll((metas) =>
    metas.map((m) => ({ media: (m as HTMLMetaElement).media, content: (m as HTMLMetaElement).content }))
  );

/**
 * What the page looked like before the app's own code ran: the moment parsing
 * ends, which is after index.html's inline script and before any module script.
 */
async function recordFirstPaint(page: Page) {
  await page.addInitScript(() => {
    document.addEventListener('readystatechange', () => {
      if (document.readyState !== 'interactive') return;
      const root = document.documentElement;
      (window as unknown as { __firstPaint: unknown }).__firstPaint = {
        style: root.getAttribute('data-style'),
        appearance: root.getAttribute('data-appearance'),
        chrome: [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => (m as HTMLMetaElement).content),
      };
    });
  });
}
const firstPaint = (page: Page) =>
  page.evaluate(() => (window as unknown as { __firstPaint: { style: string | null; appearance: string | null; chrome: string[] } }).__firstPaint);

async function open(page: Page, style: StyleName, appearance: 'system' | 'light' | 'dark', device: 'light' | 'dark') {
  await page.emulateMedia({ colorScheme: device });
  await page.addInitScript((prefs) => localStorage.setItem('scriptura-display', prefs), displayPrefs(style, appearance));
  await recordFirstPaint(page);
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
}

/** Change the appearance the way a reader does, from Settings. */
async function chooseAppearance(page: Page, appearance: 'system' | 'light' | 'dark') {
  await page.getByTestId('settings-open').click();
  await page.getByTestId('pref-appearance').selectOption(appearance);
  await page.getByTestId('settings-close').click();
}

const styleAttr = (style: StyleName) => (style === 'classic' ? null : style);

for (const style of STYLES) {
  test.describe(`${style}`, () => {
    test('system: follows the device, and follows it live', async ({ page }) => {
      await open(page, style, 'system', 'light');
      // Before the app ran: the style set, no appearance pinned, and each
      // chrome colour left to its own media query.
      expect(await firstPaint(page)).toEqual({
        style: styleAttr(style),
        appearance: null,
        chrome: [PAPER[style].light, PAPER[style].dark],
      });
      const root = page.locator('html');
      if (style === 'classic') await expect(root).not.toHaveAttribute('data-style', /./);
      else await expect(root).toHaveAttribute('data-style', style);
      await expect(root).not.toHaveAttribute('data-appearance', /./);
      expect(await root.evaluate((el) => getComputedStyle(el).colorScheme)).toBe('light dark');
      expect(await chrome(page)).toEqual([
        { media: '(prefers-color-scheme: light)', content: PAPER[style].light },
        { media: '(prefers-color-scheme: dark)', content: PAPER[style].dark },
      ]);

      expect(await paper(page)).toBe(rgb(PAPER[style].light));
      const light = await palette(page);
      // The device turns dark: the page follows at once, with no reload.
      await page.emulateMedia({ colorScheme: 'dark' });
      expect(await paper(page)).toBe(rgb(PAPER[style].dark));
      const dark = await palette(page);
      await page.emulateMedia({ colorScheme: 'light' });
      expect(await paper(page)).toBe(rgb(PAPER[style].light));

      // Every token has a light and a dark value, and they are not the same
      // palette twice. (High contrast's highlight rules keep their hue in
      // both, so this compares the palette as a whole.)
      expect(dark).not.toEqual(light);
      expect(dark['--ink']).not.toBe(light['--ink']);
      expect(dark['--paper']).not.toBe(light['--paper']);

      await page.getByTestId('settings-open').click();
      await expect(page.getByTestId('pref-style')).toHaveValue(style);
      await expect(page.getByTestId('pref-appearance')).toHaveValue('system');
    });

    for (const [pinned, device] of [
      ['light', 'dark'],
      ['dark', 'light'],
    ] as const) {
      test(`${pinned}: pinned, on a ${device} device, is the device's own ${pinned}`, async ({ page }) => {
        await open(page, style, pinned, device);
        expect(await firstPaint(page)).toEqual({
          style: styleAttr(style),
          appearance: pinned,
          chrome: [PAPER[style][pinned], PAPER[style][pinned]],
        });
        const root = page.locator('html');
        await expect(root).toHaveAttribute('data-appearance', pinned);
        expect(await root.evaluate((el) => getComputedStyle(el).colorScheme)).toBe(pinned);
        expect(await paper(page)).toBe(rgb(PAPER[style][pinned]));
        // Both chrome colours: the pin holds whatever the device says.
        expect((await chrome(page)).map((m) => m.content)).toEqual([PAPER[style][pinned], PAPER[style][pinned]]);
        const pinnedPalette = await palette(page);

        // The device changing does not move a pinned page.
        await page.emulateMedia({ colorScheme: pinned });
        await page.emulateMedia({ colorScheme: device });
        expect(await paper(page)).toBe(rgb(PAPER[style][pinned]));

        // The same palette the device's own setting gives, token for token.
        await page.emulateMedia({ colorScheme: pinned });
        await chooseAppearance(page, 'system');
        await expect(root).not.toHaveAttribute('data-appearance', /./);
        expect(await palette(page)).toEqual(pinnedPalette);
        expect(hex(await paper(page))).toBe(PAPER[style][pinned]);
      });
    }
  });
}

/*
 * The operating system's "more contrast" setting. Classic is the absent
 * style, so it takes the high-contrast palette, in whichever appearance, and
 * draws 2px edges. A style the reader chose is left as chosen.
 */
test.describe('more contrast, from the device', () => {
  test.use({ contrast: 'more' });

  for (const [appearance, device, polarity] of [
    ['system', 'light', 'light'],
    ['system', 'dark', 'dark'],
    ['light', 'dark', 'light'],
    ['dark', 'light', 'dark'],
  ] as const) {
    test(`classic, ${appearance} on a ${device} device, takes the high-contrast palette`, async ({ page }) => {
      await open(page, 'classic', appearance, device);
      expect(await paper(page)).toBe(rgb(PAPER.contrast[polarity]));
      const tokens = await palette(page);
      expect(hex(tokens['--ink'])).toBe(polarity === 'light' ? '#000000' : '#ffffff');
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--edge-w').trim())).toBe('2px');
    });
  }

  test('a style the reader chose is left as chosen', async ({ page }) => {
    await open(page, 'sepia', 'light', 'light');
    expect(await paper(page)).toBe(rgb(PAPER.sepia.light));
  });
});
