import { expect, test } from '@playwright/test';

/**
 * Formatting a note with a finger.
 *
 * A tap on a tool must format the selection without first taking focus out of
 * the note — which, before the toolbar kept focus in its group, withdrew the
 * tools before the tap landed.
 */

async function open(page: import('@playwright/test').Page) {
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
}

test('a tapped tool formats the selection, and every tool is finger-sized', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: /expand notes/i }).tap();
  await page.getByTestId('note-new').tap();

  const surface = page.getByTestId('notes-surface');
  await surface.tap();
  await surface.fill('The prologue');
  await surface.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(0, el.value.length));

  const tools = page.getByTestId('editor-tools');
  await expect(tools).toBeVisible();
  for (const tool of await tools.locator('button').all()) {
    const box = (await tool.boundingBox())!;
    expect.soft(box.width, (await tool.getAttribute('data-testid')) ?? '').toBeGreaterThanOrEqual(44);
    expect.soft(box.height, (await tool.getAttribute('data-testid')) ?? '').toBeGreaterThanOrEqual(44);
  }

  await page.getByTestId('tool-h2').tap();
  await expect(surface).toHaveValue('## The prologue');
});
