import { expect, test } from '@playwright/test';
import { contrastRatio } from '../helpers/contrast';

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

        // WCAG AAA for normal text (1.4.6). The tokens are measured in
        // tests/unit/contrast.test.ts; this proves the browser resolved them
        // onto the control the reader actually sees.
        expect
          .soft(contrastRatio(colors.color, colors.background), `${id} (${scheme}) contrast`)
          .toBeGreaterThanOrEqual(7);
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

    // Still on screen, inside the pane, parked directly beneath the bar and the
    // search box — whose heights are measured, not assumed, so the expected
    // offset is read from the same variables the stylesheet uses.
    const box = (await title.boundingBox())!;
    const paneBox = (await pane.boundingBox())!;
    const offset = await pane.evaluate(
      (el) => parseFloat(el.style.getPropertyValue('--bar-h')) + parseFloat(el.style.getPropertyValue('--search-h'))
    );
    expect(offset).toBeGreaterThan(60);
    expect(Math.abs(box.y - (paneBox.y + offset))).toBeLessThan(2);
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
    expect(contrastRatio(colors.color, colors.background)).toBeGreaterThanOrEqual(7);
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

    // The divider stops at a real width, not a share of one: a quarter of a
    // 900px window is 225px, which cannot hold the bar's controls and runs the
    // text about four words to the line.
    const pane = (await page.getByTestId('pane-bible').boundingBox())!;
    expect.soft(pane.width, 'the Bible pane keeps a readable floor').toBeGreaterThanOrEqual(319);

    for (const id of ['book-select', 'chapter-select']) {
      const box = (await page.getByTestId(id).boundingBox())!;
      expect
        .soft(box.x + box.width, `${id} must not overflow the pane`)
        .toBeLessThanOrEqual(pane.x + pane.width + 1);
      // Present and clickable, not shrunk to nothing.
      expect.soft(box.width, `${id} must stay usable`).toBeGreaterThan(24);
    }

    // Nothing is dropped any more: the translation chip opens the library and
    // Marks opens the collections, so both must stay reachable however narrow
    // the pane gets. Only the Marks *word* goes, with its count standing in.
    for (const id of ['library-open', 'marks-open', 'settings-open', 'help-open', 'maximize-bible']) {
      const chip = page.getByTestId('pane-bible').getByTestId(id);
      await expect(chip).toBeVisible();
      const box = (await chip.boundingBox())!;
      expect
        .soft(box.x + box.width, `${id} must not overflow the pane`)
        .toBeLessThanOrEqual(pane.x + pane.width + 1);
    }

    // Still usable, not merely contained.
    await page.getByTestId('book-select').selectOption('genesis');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Genesis 1');
  });
});

test.describe('a narrow notes pane', () => {
  test.use({ viewport: { width: 1000, height: 800 } });

  test('keeps every action usable rather than squeezing them to slivers', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('note-new').click();

    // Drag the divider hard right, leaving the notes pane at its floor.
    const divider = page.getByTestId('divider');
    await divider.focus();
    for (let i = 0; i < 40; i++) await page.keyboard.press('ArrowRight');

    const pane = (await page.getByTestId('pane-notes').boundingBox())!;
    // The floor is the notes' as well as the Bible's: the divider's own width
    // comes out of the split, not out of the notes.
    expect.soft(pane.width, 'the notes pane keeps a readable floor').toBeGreaterThanOrEqual(319);
    for (const id of ['note-new', 'note-preview', 'canvas-open', 'note-export', 'note-delete', 'maximize-notes']) {
      const box = (await page.getByTestId(id).boundingBox())!;
      expect.soft(box.width, `${id} must stay usable`).toBeGreaterThan(30);
      expect
        .soft(box.x + box.width, `${id} must not overflow the pane`)
        .toBeLessThanOrEqual(pane.x + pane.width + 1);
    }

    // And the picker keeps enough width to read a note's name.
    const picker = (await page.getByTestId('note-select').boundingBox())!;
    expect.soft(picker.width, 'the note picker must not collapse').toBeGreaterThan(100);

    // Still usable, not merely present.
    await page.getByTestId('note-delete').click();
    await expect(page.getByTestId('note-delete')).toContainText('Sure?');
  });
});

test.describe('the divider, and each pane\'s own controls', () => {
  // From a manual review: the divider was an 11px line with two 44px buttons
  // hanging over both panes, each maximize button stood apart from the rest of
  // its pane's buttons, and the settings gear sat left of centre.

  test('the divider is a bar that holds its two buttons', async ({ page }) => {
    await open(page);
    const bar = page.getByTestId('divider-col');
    const col = (await bar.boundingBox())!;
    for (const id of ['divider-narrower', 'divider-wider']) {
      const button = (await page.getByTestId(id).boundingBox())!;
      expect.soft(col.width, `the bar is wider than ${id}`).toBeGreaterThan(button.width);
      expect.soft(button.x, `${id} starts inside the bar`).toBeGreaterThanOrEqual(col.x);
      expect.soft(button.x + button.width, `${id} ends inside the bar`).toBeLessThanOrEqual(col.x + col.width);
    }
    // Neither pane runs under it…
    const bible = (await page.getByTestId('pane-bible').boundingBox())!;
    const notes = (await page.getByTestId('pane-notes').boundingBox())!;
    expect(bible.x + bible.width).toBeLessThanOrEqual(col.x + 0.5);
    expect(notes.x).toBeGreaterThanOrEqual(col.x + col.width - 0.5);
    // …and it is a bar, with a colour of its own, not a line.
    expect(await bar.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
  });

  test('dragging the bar keeps it under the pointer', async ({ page }) => {
    await open(page);
    const before = (await page.getByTestId('divider-col').boundingBox())!;
    const grip = (await page.getByTestId('divider').boundingBox())!;
    // Taken hold of 10px in: placing the bar's edge at the pointer, as the
    // 11px line could get away with, jumps a 52px bar by that much.
    const x = grip.x + 10;
    const y = grip.y + grip.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 60, y, { steps: 6 });
    await page.mouse.up();
    const after = (await page.getByTestId('divider-col').boundingBox())!;
    expect(Math.abs(after.x - (before.x - 60))).toBeLessThanOrEqual(2);
  });

  test('each maximize button comes last in its pane\'s bar, in line with the rest', async ({ page }) => {
    await open(page);
    await page.getByTestId('note-new').click();
    for (const [before, id] of [
      ['help-open', 'maximize-bible'],
      ['note-delete', 'maximize-notes'],
    ] as const) {
      const prev = (await page.getByTestId(before).boundingBox())!;
      const self = (await page.getByTestId(id).boundingBox())!;
      expect.soft(Math.abs(self.y - prev.y), `${id} shares a row with ${before}`).toBeLessThanOrEqual(1);
      expect.soft(self.height, `${id} is as tall as ${before}`).toBe(prev.height);
      expect.soft(self.x, `${id} is drawn after ${before}`).toBeGreaterThan(prev.x + prev.width);
      // And it is reached where it is drawn. It used to be the first stop in
      // the Bible pane, ahead of the book, while drawn after Help.
      await page.getByTestId(before).focus();
      await page.keyboard.press('Tab');
      await expect(page.getByTestId(id)).toBeFocused();
    }
    // Both bars' first rows, and the divider's first button, sit level.
    const tops = await Promise.all(
      ['book-select', 'divider-narrower', 'note-select'].map(async (id) => (await page.getByTestId(id).boundingBox())!.y)
    );
    expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(1);
  });

  test('an icon button draws its icon in the middle', async ({ page }) => {
    await open(page);
    for (const id of ['settings-open', 'help-open', 'maximize-bible', 'maximize-notes', 'divider-narrower', 'divider-wider']) {
      const offset = await page.getByTestId(id).evaluate((el) => {
        const glyph =
          el.querySelector('[aria-hidden="true"]') ??
          [...el.childNodes].find((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim());
        const range = document.createRange();
        range.selectNodeContents(glyph!);
        const g = range.getBoundingClientRect();
        const b = el.getBoundingClientRect();
        return { dx: g.x + g.width / 2 - (b.x + b.width / 2), dy: g.y + g.height / 2 - (b.y + b.height / 2) };
      });
      // The glyph's box, not its ink. How a font draws inside its box is the
      // font's business; a box packed to one side of a 44px button is the
      // layout's, and that is what put the gear 5px and the "?" 10px off.
      expect.soft(Math.abs(offset.dx), `${id} is centred across`).toBeLessThanOrEqual(1);
      expect.soft(Math.abs(offset.dy), `${id} is centred down`).toBeLessThanOrEqual(1.5);
    }
  });

  test('the notes bar wraps whole buttons rather than squeezing one past its label', async ({ page }) => {
    await open(page);
    await page.getByTestId('note-new').click();
    const check = async (when: string) => {
      const found = await page.locator('.notes__bar').evaluate((bar) => {
        const controls = [...bar.querySelectorAll<HTMLElement>('button, select')];
        const squeezed = controls
          .filter((c) => c.scrollWidth > c.clientWidth + 1)
          .map((c) => c.dataset.testid ?? c.className);
        // A row holding only the maximize button is a row it was left on.
        const maximize = bar.querySelector<HTMLElement>('[data-testid="maximize-notes"]')!;
        const top = Math.round(maximize.getBoundingClientRect().top);
        const alone = controls.filter((c) => Math.round(c.getBoundingClientRect().top) === top).length === 1;
        return { squeezed, alone };
      });
      expect.soft(found, when).toEqual({ squeezed: [], alone: false });
    };
    for (const width of [1280, 1240, 1100, 1000, 900]) {
      await page.setViewportSize({ width, height: 720 });
      await check(`at ${width}px`);
    }
    // Armed, Delete grows a Cancel beside it.
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.getByTestId('note-delete').click();
    await expect(page.getByTestId('note-delete')).toContainText('Sure?');
    await check('with Delete armed');
  });
});
