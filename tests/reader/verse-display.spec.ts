import { expect, test, type Page } from '@playwright/test';

/**
 * Two ways of showing a chapter, and only showing: the verses run together as
 * one text, and the verse numbers hidden. Asked for to read scripture closer
 * to how it was first written, before it was divided and numbered.
 *
 * What must not change is what a press does. Every verse is still its own
 * element and its own target, so a press on a sentence in the middle of a line
 * picks the verse that sentence belongs to, and a hidden number is still the
 * keyboard's way in.
 */

type Layout = { verseLines?: boolean; verseNumbers?: boolean };

async function open(page: Page, layout?: Layout) {
  // Stored before every load, so only when a test asks: a reload would put it back.
  if (layout) await page.addInitScript((prefs) => localStorage.setItem('scriptura-display', prefs), JSON.stringify(layout));
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
}

const verse = (page: Page, n: number) => page.locator(`.verse[data-verse="${n}"]`);

/** A verse's line boxes, top to bottom. */
const lines = (page: Page, n: number) =>
  verse(page, n).evaluate((el) => [...el.getClientRects()].map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height })));

test.describe('by default', () => {
  test('each verse starts a line of its own, and every number shows', async ({ page }) => {
    await open(page);
    const [one, two] = [await lines(page, 1), await lines(page, 2)];
    expect(two[0].x).toBeCloseTo(one[0].x, 0);
    expect(two[0].y).toBeGreaterThan(one.at(-1)!.y + one.at(-1)!.height);
    expect((await page.getByTestId('verse-2').boundingBox())!.width).toBeGreaterThan(4);
  });
});

test.describe('as running text', () => {
  test('a verse carries on from the line the one before it ends on', async ({ page }) => {
    await open(page, { verseLines: false });
    await expect(page.locator('html')).toHaveAttribute('data-verse-flow', 'run-in');
    const one = await lines(page, 1);
    const two = await lines(page, 2);
    expect(two[0].y).toBeCloseTo(one.at(-1)!.y, 0);
    expect(two[0].x).toBeGreaterThan(one[0].x);
  });

  test('copied, two verses read as prose: a space between them, and no number', async ({ page }) => {
    await open(page, { verseLines: false });
    const [first, second] = await Promise.all([1, 2].map((n) => verse(page, n).locator('.verse__text').textContent()));
    const copied = await page.evaluate(() => {
      const range = document.createRange();
      range.setStartBefore(document.querySelector('.verse[data-verse="1"] .verse__text')!);
      range.setEndAfter(document.querySelector('.verse[data-verse="2"] .verse__text')!);
      const selection = getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      return selection.toString();
    });
    expect(copied).toBe(`${first} ${second}`);
  });

  test('a marked verse keeps its rule, on every line it runs across', async ({ page }) => {
    await open(page, { verseLines: false });
    await verse(page, 1).locator('.verse__text').click();
    await page.getByTestId('swatch-amber').click();
    await expect(verse(page, 1)).toHaveAttribute('data-highlight', 'amber');
    const style = await verse(page, 1).evaluate((el) => {
      const s = getComputedStyle(el);
      return { width: s.borderBottomWidth, colour: s.borderBottomColor, clone: s.boxDecorationBreak, left: s.borderLeftWidth };
    });
    expect(style).toMatchObject({ width: '3px', clone: 'clone', left: '0px' });
    const strong = await page.evaluate(() => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--hl-amber-strong)';
      document.body.append(probe);
      const colour = getComputedStyle(probe).color;
      probe.remove();
      return colour;
    });
    expect(style.colour).toBe(strong);
  });
});

test.describe('without verse numbers', () => {
  test('each number is out of sight, and still a named button', async ({ page }) => {
    await open(page, { verseNumbers: false });
    await expect(page.locator('html')).toHaveAttribute('data-verse-numbers', 'hidden');
    expect((await page.getByTestId('verse-2').boundingBox())!.width).toBeLessThanOrEqual(1);
    // In the accessibility tree by name: a screen reader still hears each verse begin.
    await expect(page.getByRole('button', { name: 'Select John 1:2', exact: true })).toHaveCount(1);
  });

  test('from the keyboard, a number shows while it has focus, and still opens the verse', async ({ page }) => {
    await open(page, { verseNumbers: false });
    await page.getByTestId('verse-1').focus();
    await page.keyboard.press('Tab');
    const number = page.getByTestId('verse-2');
    await expect(number).toBeFocused();
    expect((await number.boundingBox())!.width).toBeGreaterThan(4);
    expect(await number.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');

    await page.keyboard.press('Enter');
    await expect(page.getByTestId('verse-actions')).toBeVisible();
    // The verse being acted on names itself.
    expect((await number.boundingBox())!.width).toBeGreaterThan(4);
    await page.keyboard.press('Escape');
    await expect(number).toBeFocused();
    expect((await number.boundingBox())!.width).toBeGreaterThan(4);
  });
});

test.describe('running text without numbers', () => {
  test('a press on a sentence in the middle of a line opens that verse', async ({ page }) => {
    await open(page, { verseLines: false, verseNumbers: false });
    // Verse 3 begins partway along the line verse 2 ends on.
    const two = await lines(page, 2);
    const three = await lines(page, 3);
    expect(three[0].y).toBeCloseTo(two.at(-1)!.y, 0);
    const start = three[0];
    await page.mouse.click(start.x + start.width / 2, start.y + start.height / 2);

    await expect(verse(page, 3)).toHaveAttribute('data-open', 'true');
    await expect(page.locator('.verse[data-open]')).toHaveCount(1);
    await page.getByTestId('swatch-rose').click();
    await expect(verse(page, 3)).toHaveAttribute('data-highlight', 'rose');
    await expect(page.locator('.verse[data-highlight]')).toHaveCount(1);
  });

  test('chosen in Settings, set before the first paint, and kept', async ({ page }) => {
    await open(page);
    await page.getByTestId('settings-open').click();
    await expect(page.getByTestId('pref-verse-lines')).toBeChecked();
    await expect(page.getByTestId('pref-verse-numbers')).toBeChecked();
    await page.getByTestId('pref-verse-lines').uncheck();
    await page.getByTestId('pref-verse-numbers').uncheck();
    await page.getByTestId('settings-close').click();

    // What index.html's inline script had set before any module ran.
    await page.addInitScript(() => {
      document.addEventListener('readystatechange', () => {
        if (document.readyState !== 'interactive') return;
        const root = document.documentElement;
        (window as unknown as { __firstPaint: unknown }).__firstPaint = [
          root.getAttribute('data-verse-flow'),
          root.getAttribute('data-verse-numbers'),
        ];
      });
    });
    await page.reload();
    await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
    expect(await page.evaluate(() => (window as unknown as { __firstPaint: unknown }).__firstPaint)).toEqual(['run-in', 'hidden']);
    await page.getByTestId('settings-open').click();
    await expect(page.getByTestId('pref-verse-lines')).not.toBeChecked();
    await expect(page.getByTestId('pref-verse-numbers')).not.toBeChecked();
  });

  test('a comparison keeps its rows and its numbers: they are how it lines verses up', async ({ page }) => {
    await open(page, { verseLines: false, verseNumbers: false });
    await page.getByTestId('library-open').click();
    await page.getByTestId('library-get-rv1909').click();
    await page.getByTestId('library-compare-rv1909').click({ timeout: 60_000 });
    const rows = page.getByTestId('compare').locator('tbody tr');
    await expect(rows.first()).toBeVisible();
    const [a, b] = [await rows.nth(0).boundingBox(), await rows.nth(1).boundingBox()];
    expect(b!.y).toBeGreaterThanOrEqual(a!.y + a!.height - 1);
    await expect(rows.nth(1)).toContainText('2');
  });

  test('Japanese runs its verses together with no space between them', async ({ page }) => {
    await open(page, { verseLines: false });
    // English: a space after each verse.
    expect(await verse(page, 1).evaluate((el) => el.textContent!.endsWith(' '))).toBe(true);
    await page.getByTestId('library-open').click();
    await page.getByTestId('library-get-bungo').click();
    await page.getByTestId('library-read-bungo').click({ timeout: 60_000 });
    await expect(verse(page, 1).locator('.verse__text')).toHaveAttribute('lang', 'ja');
    expect(await verse(page, 1).evaluate((el) => el.textContent!.endsWith(' '))).toBe(false);
  });
});
