import { expect, test } from '@playwright/test';

/**
 * Seeing *all* the matches.
 *
 * The dropdown answers "take me to a verse". It showed the first forty of a
 * count it gave no way to walk, so "973 matches" was a number you could read
 * and not act on.
 */

async function open(page: import('@playwright/test').Page) {
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
}

async function searchFor(page: import('@playwright/test').Page, q: string) {
  await page.getByTestId('search-input').fill(q);
  // For *this* query — the element is visible throughout, showing the previous
  // answer, so visibility alone is not a signal that the count has caught up.
  await expect(page.getByTestId('search-count')).toHaveAttribute('data-query', q);
}

test.describe('all the matches', () => {
  test('the dropdown offers a way out of its own page', async ({ page }) => {
    await open(page);
    await searchFor(page, 'love');

    const count = page.getByTestId('search-count');
    await expect(count).toContainText('showing 40');
    await page.getByTestId('search-see-all').click();

    // The total in the view is the true total, not the page.
    const total = Number(await page.getByTestId('results-total').textContent());
    expect(total).toBeGreaterThan(40);
    await expect(page.getByTestId('search-results')).toContainText(`for “love”`);
  });

  test('the list grows on request rather than rendering thousands of rows', async ({ page }) => {
    await open(page);
    await searchFor(page, 'love');
    await page.getByTestId('search-see-all').click();

    const rows = page.getByTestId('results-list').locator('.results__item');
    await expect(rows).toHaveCount(100);

    await page.getByTestId('results-more').click();
    await expect(rows).toHaveCount(200);
  });

  test('a per-book breakdown answers the counting question, and filters', async ({ page }) => {
    await open(page);
    await searchFor(page, 'Jesus');
    await page.getByTestId('search-see-all').click();

    // "How often, and where" — the reason someone asks for a count at all.
    const books = page.getByTestId('results-books').locator('.results__book');
    await expect(books.first()).toContainText('All books');
    await expect(page.getByTestId('results-book-matthew')).toBeVisible();

    const total = Number(await page.getByTestId('results-total').textContent());
    const inMatthew = Number(
      await page.getByTestId('results-book-matthew').locator('.results__book-count').textContent()
    );
    expect(inMatthew).toBeGreaterThan(0);
    expect(inMatthew).toBeLessThan(total);

    // The counts sum to the total: the breakdown is the whole result set.
    const counts = await books.locator('.results__book-count').allTextContents();
    const summed = counts.slice(1).reduce((n, c) => n + Number(c), 0);
    expect(summed).toBe(total);

    await page.getByTestId('results-book-matthew').click();
    await expect(page.getByTestId('search-results')).toContainText(`of ${inMatthew} in Matthew`);
  });

  test('a result opens its verse, or goes into the note', async ({ page }) => {
    await open(page);
    await page.getByTestId('note-new').click();
    // A broad query, then narrowed by book — which is how you reach a verse
    // thousands of matches deep. ("living water" fits in the dropdown, so it
    // never offers See all, and rightly: there is nothing more to show.)
    await searchFor(page, 'water');
    await page.getByTestId('search-see-all').click();
    await page.getByTestId('results-book-jeremiah').click();

    await page.getByTestId('results-insert-jeremiah-2-13').click();
    await expect(page.getByTestId('notes-surface')).toContainText('living water');

    await page.getByTestId('results-go-jeremiah-2-13').click();
    await expect(page.getByTestId('chapter-title')).toContainText('Jeremiah 2');
    await expect(page.locator('.verse[data-verse="13"]')).toBeInViewport();
  });
});

test.describe('precision', () => {
  /**
   * The reason ranking exists. Searching a Spanish translation for Titus
   * returned `apetito` alongside him, because every match looked alike.
   */
  /** Install a Spanish translation and read it, so `Tito` means Titus. */
  async function readSpanish(page: import('@playwright/test').Page) {
    await page.getByTestId('library-open').click();
    await page.getByTestId('library-get-rv1909').click();
    await expect(page.getByTestId('library-read-rv1909')).toBeVisible({ timeout: 60_000 });
    await page.getByTestId('library-read-rv1909').click();
    // Wait for the text itself to change, not just the click: searching before
    // the swap lands measures the English translation and reads 1, not 17.
    await expect(page.getByTestId('chapter-title')).toContainText('Juan');
  }

  test('a name outranks the words that merely contain it', async ({ page }) => {
    await open(page);
    await readSpanish(page);
    await searchFor(page, 'Tito');

    // Seventeen matches all fit the dropdown, so this is where a reader
    // searching a name actually sees the result — `see all` is not offered.
    const texts = page.getByTestId('search-panel').locator('.search__result-text');
    await expect(texts.first()).not.toContainText('apetito');
    await expect(page.getByTestId('search-divider')).toBeVisible();

    // Every Titus verse precedes every coincidence.
    const all = await texts.allTextContents();
    const lastPerson = all.map((t) => /apetito|empr/i.test(t)).lastIndexOf(false);
    const firstNoise = all.map((t) => /apetito|empr/i.test(t)).indexOf(true);
    expect(firstNoise).toBeGreaterThan(-1);
    expect(lastPerson).toBeLessThan(firstNoise);
  });

  test('whole words only drops them entirely', async ({ page }) => {
    await open(page);
    await readSpanish(page);
    await searchFor(page, 'Tito');

    const count = async () =>
      Number((await page.getByTestId('search-count').textContent())!.match(/^(\d+)/)![1]);
    const loose = await count();

    await page.getByTestId('search-whole-word').check();
    await expect.poll(count).toBeLessThan(loose);
    await expect(page.getByTestId('search-panel')).not.toContainText('apetito');
    await expect(page.getByTestId('search-divider')).toHaveCount(0);
  });

  test('but a stem still finds its inflections by default', async ({ page }) => {
    // Whole-word costs 49% of `love` in the KJV, so it must stay opt-in.
    await open(page);
    await searchFor(page, 'love');
    await page.getByTestId('search-see-all').click();
    await expect(page.getByTestId('results-list')).toContainText(/loveth|loved/);
  });

  test('the toggle is reachable from the dropdown too', async ({ page }) => {
    await open(page);
    await searchFor(page, 'love');
    const before = Number((await page.getByTestId('search-count').textContent())!.match(/^(\d+)/)![1]);
    await page.getByTestId('search-whole-word').check();
    await expect
      .poll(async () =>
        Number((await page.getByTestId('search-count').textContent())!.match(/^(\d+)/)![1])
      )
      .toBeLessThan(before);
  });
});
