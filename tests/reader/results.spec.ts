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
  await expect(page.getByTestId('search-count')).toBeVisible();
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
