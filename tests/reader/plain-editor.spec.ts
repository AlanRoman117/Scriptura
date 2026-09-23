import { expect, test } from '@playwright/test';
import { storedBodies } from '../helpers/note';

/**
 * Plain text: the note as Markdown source in a textarea, chosen in Settings.
 * It is the fallback for a phone keyboard or a screen reader that copes badly
 * with the live editor, so switching must keep every word, and the choice
 * must survive a reload.
 */
test('Settings switches the note to plain text and back, keeping every word', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('note-new').click();

  const surface = page.getByTestId('notes-surface');
  // Live is the default.
  await expect(surface).toHaveAttribute('role', 'textbox');
  await surface.click();
  await page.keyboard.type('## Grace\nand **truth**');

  await page.getByTestId('settings-open').click();
  await page.getByTestId('pref-editor').selectOption('plain');
  await page.getByTestId('settings-close').click();

  await expect(surface).toHaveJSProperty('tagName', 'TEXTAREA');
  await expect(surface).toHaveValue('## Grace\nand **truth**');
  await surface.click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type('.');
  await expect(surface).toHaveValue('## Grace\nand **truth**.');

  // The choice is this device's, and stays.
  await expect.poll(() => storedBodies(page), { timeout: 10_000 }).toContain('## Grace\nand **truth**.');
  await page.reload();
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('notes-surface')).toHaveJSProperty('tagName', 'TEXTAREA');

  await page.getByTestId('settings-open').click();
  await page.getByTestId('pref-editor').selectOption('live');
  await page.getByTestId('settings-close').click();
  await expect(page.getByTestId('notes-surface')).toHaveJSProperty('value', '## Grace\nand **truth**.');
  await expect(page.locator('.live-line--h2')).toHaveCount(1);
});
