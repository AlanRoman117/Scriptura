import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { describeSmall, tooSmall } from '../helpers/targets';

/**
 * Target size, enhanced (2.5.5): every pointer target is at least 44 × 44 CSS
 * px, in every state of the app on a desktop. The measurer and its allowlist
 * live in tests/helpers/targets.ts, shared with the touch project.
 */

async function open(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
}

const STATES: Record<string, (page: Page) => Promise<void>> = {
  reading: async () => {},
  'formatting tools': async (page) => {
    await page.getByTestId('note-new').click();
    await page.getByTestId('notes-surface').click();
    await expect(page.getByTestId('editor-tools')).toBeVisible();
  },
  'verse actions': async (page) => {
    await page.getByTestId('verse-2').click();
    await expect(page.getByTestId('verse-actions')).toBeVisible();
  },
  'reading with a note open': async (page) => {
    await page.getByTestId('note-new').click();
    await expect(page.getByTestId('notes-surface')).toBeVisible();
  },
  'note preview': async (page) => {
    await page.getByTestId('note-new').click();
    await page.getByTestId('notes-surface').fill('# Opening\n\nText.\n\n> quote');
    await page.getByTestId('note-preview').click();
    await expect(page.getByTestId('notes-preview')).toBeVisible();
  },
  marks: async (page) => {
    await page.getByTestId('verse-1').click();
    await page.getByTestId('swatch-amber').click();
    await page.getByTestId('marks-open').click();
    await expect(page.getByTestId('marks-panel')).toBeVisible();
  },
  library: async (page) => {
    await page.getByTestId('library-open').click();
    await expect(page.getByTestId('library-panel')).toBeVisible();
  },
  settings: async (page) => {
    await page.getByTestId('settings-open').click();
    await expect(page.getByTestId('settings-panel')).toBeVisible();
  },
  help: async (page) => {
    await page.getByTestId('help-open').click();
    await expect(page.getByTestId('help-panel')).toBeVisible();
  },
  comparison: async (page) => {
    await page.getByTestId('library-open').click();
    await page.getByTestId('library-get-rv1909').click();
    await expect(page.getByTestId('library-read-rv1909')).toBeVisible({ timeout: 60_000 });
    await page.getByTestId('library-compare-rv1909').click();
    await expect(page.getByTestId('compare')).toBeVisible();
  },
  board: async (page) => {
    for (const verse of [1, 3]) {
      await page.getByTestId(`verse-${verse}`).click();
      await page.getByTestId(`canvas-${verse}`).click();
    }
    await page.getByTestId('canvas-open').click();
    await expect(page.locator('.card')).toHaveCount(2);
  },
  results: async (page) => {
    await page.getByTestId('search-input').fill('love');
    await expect(page.getByTestId('search-count')).toHaveAttribute('data-query', 'love');
    await page.getByTestId('search-see-all').click();
    await expect(page.getByTestId('search-results')).toBeVisible();
  },
};

test.describe('every pointer target is 44 × 44 or larger', () => {
  for (const [name, arrange] of Object.entries(STATES)) {
    test(name, async ({ page }) => {
      await open(page);
      await arrange(page);
      const small = await tooSmall(page);
      expect(small, describeSmall(small)).toEqual([]);
    });
  }
});
