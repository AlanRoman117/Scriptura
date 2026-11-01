import { expect, open, test } from './fixture';

/**
 * The licence words on the published site, where every translation comes from
 * the static tree rather than the live API: the same metadata, by the other road.
 */

test('the King James notice shows, and reads plainly', async ({ page, site }) => {
  await open(page, site);
  await expect(page.getByTestId('translation-footer')).toContainText('Public domain outside the UK;');
  await expect(page.getByTestId('translation-footer').locator('a')).toHaveCount(0);
});

test('a licensed Bible downloaded from the static tree links to its licence', async ({ page, site }) => {
  await open(page, site);
  await page.getByTestId('library-open').click();
  await expect(page.getByTestId('library-blivre')).toContainText('CC BY 3.0 Brasil');
  await page.getByTestId('library-get-vbl').click();
  await expect(page.getByTestId('library-read-vbl')).toBeVisible({ timeout: 60_000 });
  await page.getByTestId('library-read-vbl').click();
  await expect(page.getByTestId('attribution').getByRole('link', { name: /licence/ })).toHaveAttribute(
    'href',
    'https://creativecommons.org/licenses/by-sa/4.0/'
  );
});
