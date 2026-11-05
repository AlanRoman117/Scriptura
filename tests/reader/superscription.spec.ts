import { expect, test, type Page } from '@playwright/test';
import { axeFor, describeViolations } from '../helpers/axe';

/**
 * A Psalm's title (`superscription` on the chapter), as the reader shows it.
 *
 * In English Bibles the title stands before verse 1 unnumbered. Here it is
 * scripture — in the reading face, in the Bible's language — and not a verse:
 * it has no number, takes no press, joins no selection, and in running text it
 * stays a block above verse 1. The bundled KJV has no titles, so these read the
 * World English Bible, downloaded from the API the suite starts.
 */

const TITLE = 'A Psalm by David, when he fled from Absalom his son.';

async function open(page: Page, prefs?: Record<string, boolean>) {
  if (prefs) await page.addInitScript((p) => localStorage.setItem('scriptura-display', p), JSON.stringify(prefs));
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
}

async function install(page: Page, id: string) {
  await page.getByTestId('library-open').click();
  await page.getByTestId(`library-get-${id}`).click();
  await expect(page.getByTestId(`library-read-${id}`)).toBeVisible({ timeout: 60_000 });
}

async function readPsalm(page: Page, chapter: number) {
  await install(page, 'web');
  await page.getByTestId('library-read-web').click();
  await expect(page.getByTestId('chapter-translation')).toHaveText('World English Bible');
  await page.getByTestId('book-select').selectOption('psalms');
  await page.getByTestId('chapter-select').selectOption(String(chapter));
  await expect(page.getByTestId('chapter-title')).toContainText(`Psalms ${chapter}`);
}

const box = async (page: Page, selector: string) => (await page.locator(selector).first().boundingBox())!;

test('stands before verse 1, in the Bible’s language, quieter than the verses', async ({ page }) => {
  await open(page);
  await readPsalm(page, 3);
  const title = page.getByTestId('chapter-superscription');
  await expect(title).toHaveText(TITLE);
  await expect(title).toHaveAttribute('lang', 'en');

  // Above verse 1, and inside the chapter's text.
  const [t, v1] = [await box(page, '[data-testid="chapter-superscription"]'), await box(page, '.verse[data-verse="1"]')];
  expect(t.y + t.height).toBeLessThanOrEqual(v1.y + 1);
  await expect(page.locator('.chapter__text [data-testid="chapter-superscription"]')).toHaveCount(1);

  // Quieter: smaller and softer than a verse, in the same face.
  const style = await page.evaluate(() => {
    const read = (el: Element) => {
      const s = getComputedStyle(el);
      return { size: parseFloat(s.fontSize), color: s.color, family: s.fontFamily, style: s.fontStyle };
    };
    return {
      title: read(document.querySelector('[data-testid="chapter-superscription"]')!),
      verse: read(document.querySelector('.verse[data-verse="1"] .verse__text')!),
    };
  });
  expect(style.title.size).toBeLessThan(style.verse.size);
  expect(style.title.color).not.toBe(style.verse.color);
  expect(style.title.family).toBe(style.verse.family);
  expect(style.title.style).toBe('italic');
});

test('is not a verse: no number, no press, not counted, and verse 1 is the verse alone', async ({ page }) => {
  await open(page);
  await readPsalm(page, 3);
  const title = page.getByTestId('chapter-superscription');
  expect(await title.evaluate((el) => el.classList.contains('verse') || el.hasAttribute('data-verse'))).toBe(false);
  await expect(title.locator('button')).toHaveCount(0);
  await expect(page.locator('.verse')).toHaveCount(8);
  await expect(page.locator('.verse[data-verse="1"] .verse__text')).toHaveText(/^LORD, how my adversaries/);
  await expect(page.locator('.verse[data-verse="1"]')).not.toContainText('Absalom');

  // A press on the title opens nothing and selects nothing.
  await title.click();
  await expect(page.getByTestId('verse-actions')).toHaveCount(0);
  await expect(page.locator('.verse[data-open]')).toHaveCount(0);

  // The first verse is still the first Tab stop among the verses.
  await page.getByTestId('verse-1').focus();
  await expect(page.getByRole('button', { name: 'Select Psalms 3:1', exact: true })).toBeFocused();
});

test('is absent where the source has none', async ({ page }) => {
  await open(page);
  // The bundled King James: its source carries no titles.
  await page.getByTestId('book-select').selectOption('psalms');
  await page.getByTestId('chapter-select').selectOption('3');
  await expect(page.getByTestId('chapter-title')).toContainText('Psalms 3');
  await expect(page.getByTestId('chapter-superscription')).toHaveCount(0);
  // A Psalm the World English Bible gives no title.
  await readPsalm(page, 1);
  await expect(page.getByTestId('chapter-superscription')).toHaveCount(0);
  // Psalm 119's Hebrew letters are headings, not a title.
  await page.getByTestId('chapter-select').selectOption('119');
  await expect(page.getByTestId('chapter-title')).toContainText('Psalms 119');
  await expect(page.getByTestId('chapter-superscription')).toHaveCount(0);
  await expect(page.locator('.verse[data-verse="8"]')).not.toContainText('BETH');
});

test('as running text without numbers, it stays a block above verse 1', async ({ page }) => {
  await open(page, { verseLines: false, verseNumbers: false });
  await expect(page.locator('html')).toHaveAttribute('data-verse-flow', 'run-in');
  await readPsalm(page, 3);
  const title = page.getByTestId('chapter-superscription');
  await expect(title).toHaveText(TITLE);
  expect(await title.evaluate((el) => getComputedStyle(el).display)).toBe('block');
  const [t, v1] = [await box(page, '[data-testid="chapter-superscription"]'), await box(page, '.verse[data-verse="1"]')];
  expect(t.y + t.height).toBeLessThanOrEqual(v1.y + 1);
  // Verses 1 and 2 still run on together after it.
  const [a, b] = [await box(page, '.verse[data-verse="1"]'), await box(page, '.verse[data-verse="2"]')];
  expect(b.y).toBeLessThan(a.y + a.height);
  // Copied with verse 1, the title is its own line, not run into the verse.
  const copied = await page.evaluate(() => {
    const range = document.createRange();
    range.setStartBefore(document.querySelector('[data-testid="chapter-superscription"]')!);
    range.setEndAfter(document.querySelector('.verse[data-verse="1"] .verse__text')!);
    const selection = getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    return selection.toString();
  });
  expect(copied.startsWith(`${TITLE}\n`)).toBe(true);
});

for (const [state, media] of [
  ['light', { colorScheme: 'light' }],
  ['dark', { colorScheme: 'dark' }],
  ['forced colours', { forcedColors: 'active' }],
] as const) {
  test(`is readable and passes axe in ${state}`, async ({ page }) => {
    await page.emulateMedia(media);
    await open(page);
    await readPsalm(page, 3);
    const title = page.getByTestId('chapter-superscription');
    await expect(title).toBeVisible();
    await expect(title).toBeInViewport();
    const results = await axeFor(page).analyze();
    expect(results.violations, describeViolations(results)).toEqual([]);
  });
}

test('in a comparison, sits above the rows under its own column, and a Bible without one stays empty there', async ({ page }) => {
  await open(page);
  await install(page, 'web');
  await page.getByTestId('library-compare-web').click();
  const compare = page.getByTestId('compare');
  await expect(compare).toHaveAttribute('data-layout', 'table');
  // John 1 has no title in either Bible: nothing is drawn.
  await expect(page.getByTestId('compare-superscriptions')).toHaveCount(0);

  await page.getByTestId('book-select').selectOption('psalms');
  await page.getByTestId('chapter-select').selectOption('3');
  const row = page.getByTestId('compare-superscriptions');
  await expect(row).toBeVisible();
  // The King James first, then the World English Bible: the title under the second.
  const cells = row.locator('td.compare__cell');
  await expect(cells).toHaveCount(2);
  await expect(cells.nth(0)).toHaveText('');
  await expect(cells.nth(1)).toHaveText(TITLE);
  await expect(cells.nth(1).locator('.compare__text')).toHaveAttribute('lang', 'en');
  // Not a verse row: no number, no quote button, and the verse rows are the verses.
  await expect(row).not.toHaveAttribute('data-verse', /.*/);
  await expect(row.locator('button')).toHaveCount(0);
  await expect(compare.locator('tbody tr[data-verse]')).toHaveCount(8);
  const [r, first] = [(await row.boundingBox())!, (await compare.locator('tbody tr[data-verse="1"]').boundingBox())!];
  expect(r.y + r.height).toBeLessThanOrEqual(first.y + 1);
  // The verse rows carry no title text.
  await expect(compare.locator('tbody tr[data-verse="1"]')).not.toContainText('Absalom');
});
