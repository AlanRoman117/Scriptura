import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Language of parts (3.1.2): where the interface's language ends and a
 * Bible's begins.
 *
 * A screen reader switches voice at every `lang`. The interface is in one
 * language and the Bible open beside it may be in another, so the boundary
 * has to fall exactly around the scripture text. Put `lang` on a container
 * that also holds a button, and that button's name is spoken with the wrong
 * phonemes; leave it off the verse, and the verse is. Both halves are
 * checked here, in every state where scripture sits next to controls:
 *
 * - every control, and everything with a name, is in the page's language;
 * - every piece of scripture is in its translation's language.
 */

/** Which translation each scripture element belongs to, and what language that is. */
const TRANSLATION_LANGUAGE: Record<string, string> = { bsb: 'en', rv1909: 'es' };

async function boundaryProblems(page: Page, reading: string): Promise<string[]> {
  return page.evaluate(
    ({ reading, languages }) => {
      const problems: string[] = [];
      const pageLang = document.documentElement.getAttribute('lang');
      const langOf = (el: Element) => el.closest('[lang]')?.getAttribute('lang');
      const name = (el: Element) =>
        (el.getAttribute('data-testid') ?? el.className ?? el.tagName).toString().slice(0, 60);

      const controls = document.querySelectorAll(
        'a[href], button, input, select, textarea, summary, [tabindex], [role], [aria-label]'
      );
      for (const el of Array.from(controls)) {
        if (el === document.documentElement) continue;
        if (el.closest('[hidden], [inert]')) continue;
        const lang = langOf(el);
        if (lang !== pageLang) problems.push(`control ${name(el)} is in ${lang}, not ${pageLang}`);
      }

      // Scripture, with the translation each piece comes from.
      const pieces: [Element, string][] = [];
      for (const el of Array.from(document.querySelectorAll('.verse__text, .marks__ref-text, .results__ref-text, .search__result-text, .card__body > span')))
        pieces.push([el, reading]);
      for (const quote of Array.from(document.querySelectorAll('[data-testid^="compare-quote-"]'))) {
        const id = quote.getAttribute('data-testid')!.split('-')[2];
        const text = quote.parentElement?.querySelector('.compare__text');
        if (text) pieces.push([text, id]);
      }
      for (const [el, id] of pieces) {
        if (!el.textContent?.trim()) continue;
        const lang = langOf(el);
        if (lang !== languages[id]) problems.push(`scripture ${name(el)} from ${id} is in ${lang}, not ${languages[id]}`);
      }
      if (pieces.length === 0) problems.push('no scripture found to check');
      return problems;
    },
    { reading, languages: TRANSLATION_LANGUAGE }
  );
}

async function open(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
}

async function installSpanish(page: Page) {
  await page.getByTestId('library-open').click();
  await page.getByTestId('library-get-rv1909').click();
  await expect(page.getByTestId('library-read-rv1909')).toBeVisible({ timeout: 60_000 });
}

test.describe('an English Bible under a Japanese interface', () => {
  test.use({ locale: 'ja-JP' });

  test('reading, with the verse actions open', async ({ page }) => {
    await open(page);
    await page.getByTestId('verse-2').click();
    await expect(page.getByTestId('verse-actions')).toBeVisible();
    expect(await boundaryProblems(page, 'bsb')).toEqual([]);
  });

  test('search suggestions and every result', async ({ page }) => {
    await open(page);
    await page.getByTestId('search-input').fill('light');
    await expect(page.getByTestId('search-count')).toHaveAttribute('data-query', 'light');
    expect(await boundaryProblems(page, 'bsb')).toEqual([]);
    await page.getByTestId('search-input').press('Enter');
    await expect(page.getByTestId('search-results')).toBeVisible();
    expect(await boundaryProblems(page, 'bsb')).toEqual([]);
  });

  test('marks and the board', async ({ page }) => {
    await open(page);
    await page.getByTestId('verse-1').click();
    await page.getByTestId('swatch-amber').click();
    await page.getByTestId('marks-open').click();
    expect(await boundaryProblems(page, 'bsb')).toEqual([]);
    await page.getByTestId('marks-close').click();

    await page.getByTestId('verse-3').click();
    await page.getByTestId('canvas-3').click();
    await page.getByTestId('canvas-open').click();
    await expect(page.locator('.card')).toHaveCount(1);
    expect(await boundaryProblems(page, 'bsb')).toEqual([]);
  });

  test('the gate catches lang on a container that holds controls', async ({ page }) => {
    await open(page);
    expect(await boundaryProblems(page, 'bsb')).toEqual([]);
    // The bug this replaced: the chapter carried the Bible's lang, and so did
    // every verse number inside it.
    await page.locator('.chapter__text').evaluate((el) => el.setAttribute('lang', 'en'));
    const problems = await boundaryProblems(page, 'bsb');
    expect(problems.some((p) => p.includes('verse-1') && p.includes('is in en'))).toBe(true);
  });

  test('and catches scripture that lost its lang', async ({ page }) => {
    await open(page);
    await page.locator('.verse__text').first().evaluate((el) => el.removeAttribute('lang'));
    const problems = await boundaryProblems(page, 'bsb');
    expect(problems.some((p) => p.startsWith('scripture'))).toBe(true);
  });
});

test.describe('a Spanish Bible beside an English one, under an English interface', () => {
  test('the comparison, as a table and as a list', async ({ page }) => {
    await open(page);
    await installSpanish(page);
    await page.getByTestId('library-compare-rv1909').click();
    await expect(page.getByTestId('compare')).toHaveAttribute('data-layout', 'table');
    expect(await boundaryProblems(page, 'bsb')).toEqual([]);

    await page.setViewportSize({ width: 500, height: 800 });
    await expect(page.getByTestId('compare')).toHaveAttribute('data-layout', 'stack');
    expect(await boundaryProblems(page, 'bsb')).toEqual([]);
  });

  test('reading the Spanish Bible itself', async ({ page }) => {
    await open(page);
    await installSpanish(page);
    await page.getByTestId('library-read-rv1909').click();
    await expect(page.getByTestId('chapter-title')).toContainText('Juan 1');
    await page.getByTestId('verse-2').click();
    expect(await boundaryProblems(page, 'rv1909')).toEqual([]);
  });
});
