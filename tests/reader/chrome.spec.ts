import { expect, test } from '@playwright/test';

/**
 * The reading bar — contrast, and what happens when the pane gets small.
 *
 * Both were reported from real use: the dropdowns were hard to read, and
 * dragging the divider left pushed the controls out of the pane.
 */

async function open(page: import('@playwright/test').Page) {
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
}

/** Relative luminance per WCAG, from an `rgb(...)` string. */
function luminance(rgb: string): number {
  const [r, g, b] = (rgb.match(/\d+(\.\d+)?/g) ?? ['0', '0', '0']).slice(0, 3).map(Number);
  const channel = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test.describe('contrast', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`the book and chapter dropdowns are readable in ${scheme} mode`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await open(page);

      for (const id of ['book-select', 'chapter-select']) {
        const colors = await page.getByTestId(id).evaluate((el) => {
          const s = getComputedStyle(el);
          return { color: s.color, background: s.backgroundColor };
        });

        // A transparent background is the bug: the browser then paints the open
        // dropdown from an unresolved colour.
        expect
          .soft(colors.background, `${id} (${scheme}) must not be transparent`)
          .not.toMatch(/rgba\(0,\s*0,\s*0,\s*0\)|transparent/);

        // WCAG AA for normal text.
        expect
          .soft(contrastRatio(colors.color, colors.background), `${id} (${scheme}) contrast`)
          .toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});

test.describe('keeping your place', () => {
  test('the chapter title stays visible while scrolling, like sticky scroll', async ({ page }) => {
    await open(page);
    await page.getByTestId('book-select').selectOption('psalms');
    await page.getByTestId('chapter-select').selectOption('119');

    const pane = page.getByTestId('pane-bible');
    const title = page.getByTestId('chapter-title');
    await expect(title).toContainText('Psalms 119');

    await pane.evaluate((el) => el.scrollTo(0, 4000));
    await expect.poll(() => title.getAttribute('data-stuck')).toBe('true');

    // Still on screen, inside the pane, below the bar — not scrolled away.
    const box = (await title.boundingBox())!;
    const paneBox = (await pane.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(paneBox.y - 1);
    expect(box.y).toBeLessThan(paneBox.y + 120);
    await expect(title).toContainText('Psalms 119');
  });

  test('the title is not pinned when there is nothing to scroll past', async ({ page }) => {
    await open(page);
    // Short chapter: the heading should sit normally, with no divider.
    await page.getByTestId('book-select').selectOption('3-john');
    await expect(page.getByTestId('chapter-title')).toHaveAttribute('data-stuck', 'false');
  });
});

test.describe('the notes dropdown', () => {
  test('is readable once there is more than one note', async ({ page }) => {
    await open(page);
    for (const title of ['First note', 'Second note']) {
      await page.getByTestId('note-new').click();
      await page.getByTestId('note-title').fill(title);
    }
    const colors = await page.getByTestId('note-select').evaluate((el) => {
      const s = getComputedStyle(el);
      return { color: s.color, background: s.backgroundColor };
    });
    expect(colors.background).not.toMatch(/rgba\(0,\s*0,\s*0,\s*0\)|transparent/);
    expect(contrastRatio(colors.color, colors.background)).toBeGreaterThanOrEqual(4.5);
  });
});

test.describe('a narrow Bible pane', () => {
  // Just above the 850px sheet breakpoint, so the split layout is still in
  // play and 25% of it is genuinely tight — at 1280px the minimum pane is
  // roomy enough that the overflow never reproduces.
  test.use({ viewport: { width: 900, height: 800 } });

  test('keeps its controls inside the pane', async ({ page }) => {
    await open(page);

    // Drag the divider hard left, to the minimum split.
    const divider = page.getByTestId('divider');
    await divider.focus();
    for (let i = 0; i < 40; i++) await page.keyboard.press('ArrowLeft');

    const pane = (await page.getByTestId('pane-bible').boundingBox())!;
    for (const id of ['book-select', 'chapter-select']) {
      const box = (await page.getByTestId(id).boundingBox())!;
      expect
        .soft(box.x + box.width, `${id} must not overflow the pane`)
        .toBeLessThanOrEqual(pane.x + pane.width + 1);
      // Present and clickable, not shrunk to nothing.
      expect.soft(box.width, `${id} must stay usable`).toBeGreaterThan(24);
    }

    // The translation badge is the first thing dropped, so the selects keep room.
    await expect(page.getByTestId('pane-bible').locator('.reader__translation')).toBeHidden();

    // Still usable, not merely contained.
    await page.getByTestId('book-select').selectOption('genesis');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Genesis 1');
  });
});
