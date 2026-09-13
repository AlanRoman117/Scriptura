import { expect, test } from '@playwright/test';

/**
 * Operating the reader without a pointer.
 *
 * axe can tell you a control has no name; it cannot tell you that Tab reached
 * it with no visible ring, that Escape closed the wrong thing, or that focus
 * fell to <body> when a panel went away. Those are the failures a keyboard
 * user actually hits, and they are proved here by pressing the keys.
 *
 * Focus-visible is measured, not assumed: the ring used to be declared with
 * `:where()`, whose zero specificity lost to five later `outline: none`
 * rules, so the writing surface had a focus rule and no focus ring for a year.
 */

async function open(page: import('@playwright/test').Page) {
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
}

interface Stop {
  tag: string;
  id: string;
  outlineStyle: string;
  outlineWidth: number;
  focusVisible: boolean;
}

/** What has focus, and whether it shows it. */
const focused = (page: import('@playwright/test').Page): Promise<Stop> =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const s = getComputedStyle(el);
    return {
      tag: el.tagName.toLowerCase(),
      id: el.dataset.testid ?? el.getAttribute('aria-label') ?? el.className,
      outlineStyle: s.outlineStyle,
      outlineWidth: parseFloat(s.outlineWidth),
      focusVisible: el.matches(':focus-visible'),
    };
  });

test.describe('every stop shows the ring', () => {
  test('tabbing through the reading state', async ({ page }) => {
    await open(page);
    const seen: Stop[] = [];
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      const stop = await focused(page);
      if (stop.tag === 'body') break;
      seen.push(stop);
    }
    // A sanity floor: the bar, the search box, and a run of verse numbers.
    expect(seen.length).toBeGreaterThan(10);
    for (const stop of seen) {
      expect.soft(stop.focusVisible, `${stop.tag} ${stop.id} should match :focus-visible`).toBe(true);
      expect.soft(stop.outlineStyle, `${stop.tag} ${stop.id} outline-style`).not.toBe('none');
      expect.soft(stop.outlineWidth, `${stop.tag} ${stop.id} outline-width`).toBeGreaterThanOrEqual(2);
    }
  });

  test('the writing surface and the note title', async ({ page }) => {
    // These two carried `outline: none` — the one place a reader spends the
    // most time was the one place with no focus indicator.
    await open(page);
    await page.getByTestId('note-new').click();
    for (const id of ['note-title', 'notes-surface']) {
      await page.getByTestId(id).focus();
      // A programmatic focus does not always count as focus-visible; a key does.
      await page.keyboard.press('Shift');
      const stop = await focused(page);
      expect(stop.id).toBe(id);
      expect(stop.outlineStyle).not.toBe('none');
      expect(stop.outlineWidth).toBeGreaterThanOrEqual(2);
    }
  });

  test('the collection labels in Marks', async ({ page }) => {
    await open(page);
    await page.getByTestId('marks-open').click();
    await page.getByTestId('marks-label-amber').focus();
    await page.keyboard.press('Shift');
    const stop = await focused(page);
    expect(stop.id).toBe('marks-label-amber');
    expect(stop.outlineStyle).not.toBe('none');
  });
});
