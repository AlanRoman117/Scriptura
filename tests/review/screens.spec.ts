import { devices, expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { join } from 'node:path';

/**
 * Screenshots for the translation reviewers — not a test.
 *
 * Every main screen, in every interface language, on a desktop and on a
 * phone, written to review-screenshots/<language>/<device>-<screen>.png.
 * A reviewer who does not run the app reads the words in place, where length
 * and line breaks matter as much as the words. `npm run review:screens`.
 */

const LOCALES = ['en-US', 'es-MX', 'fr-FR', 'ja-JP'] as const;

type Shot = (page: Page, save: (name: string, target?: 'page' | string) => Promise<void>) => Promise<void>;

const open = async (page: Page) => {
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
};

const SCREENS: Record<string, Shot> = {
  'reading-and-offer': async (page, save) => save('reading'),
  'verse-actions': async (page, save) => {
    await page.getByTestId('verse-2').click();
    await save('verse-actions');
  },
  'writing-and-quote': async (page, save) => {
    await page.getByTestId('note-new').click();
    await page.getByTestId('verse-1').click();
    await page.getByTestId('quote-1').click();
    await expect(page.getByTestId('note-done')).toBeVisible();
    await save('writing-a-note');
    await page.getByTestId('note-delete').click();
    await save('delete-armed');
  },
  preview: async (page, save) => {
    await page.getByTestId('note-new').click();
    await page.getByTestId('notes-surface').fill('# Heading\n\nA paragraph with **bold** text.\n\n- a list item');
    await page.getByTestId('note-preview').click();
    await save('note-preview');
  },
  search: async (page, save) => {
    await page.getByTestId('search-input').fill('light');
    await expect(page.getByTestId('search-count')).toHaveAttribute('data-query', 'light');
    await save('search-suggestions');
    await page.getByTestId('search-input').press('Enter');
    await expect(page.getByTestId('search-results')).toBeVisible();
    await save('search-results');
  },
  marks: async (page, save) => {
    await page.getByTestId('verse-1').click();
    await page.getByTestId('swatch-amber').click();
    await page.getByTestId('marks-open').click();
    await save('marks');
  },
  library: async (page, save) => {
    await page.getByTestId('library-open').click();
    await save('library', '[data-testid="library-panel"]');
  },
  settings: async (page, save) => {
    await page.getByTestId('settings-open').click();
    await save('settings', '[data-testid="settings-panel"]');
  },
  help: async (page, save) => {
    await page.getByTestId('help-open').click();
    await save('help', '[data-testid="help-panel"]');
  },
  board: async (page, save) => {
    for (const verse of [1, 3]) {
      await page.getByTestId(`verse-${verse}`).click();
      await page.getByTestId(`canvas-${verse}`).click();
    }
    await page.getByTestId('note-new').click();
    await page.getByTestId('canvas-open').click();
    await expect(page.locator('.card')).toHaveCount(2);
    await page.getByTestId('board-connections').click();
    await save('board');
  },
};

const DEVICES = {
  desktop: { viewport: { width: 1280, height: 800 } },
  // The phone's own settings, without the browser type a describe cannot change.
  phone: (({ defaultBrowserType: _browser, ...phone }) => phone)(devices['Pixel 7']),
};

for (const locale of LOCALES) {
  for (const [device, settings] of Object.entries(DEVICES)) {
    test.describe(`${locale} ${device}`, () => {
      test.use({ ...settings, locale });

      for (const [name, shoot] of Object.entries(SCREENS)) {
        test(name, async ({ page }, testInfo) => {
          const folder = join(testInfo.project.testDir, '..', '..', 'review-screenshots', locale);
          const save = async (screen: string, target: 'page' | string = 'page') => {
            await page.waitForTimeout(150);
            const path = join(folder, `${device}-${screen}.png`);
            if (target === 'page') await page.screenshot({ path, fullPage: false });
            else await page.locator(target).screenshot({ path });
          };
          await open(page);
          if (device === 'phone' && !['reading-and-offer', 'verse-actions', 'search', 'library', 'settings', 'help', 'marks'].includes(name)) {
            // On a phone the note and the board are reached through the sheet.
            await page.getByTestId('sheet-grip').click();
          }
          await shoot(page, save);
        });
      }
    });
  }
}
