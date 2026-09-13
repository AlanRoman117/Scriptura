import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { axeFor, describeViolations } from '../helpers/axe';
import { describeSmall, tooSmall } from '../helpers/targets';

/**
 * The phone gets the same gates as the desktop, in its own states.
 *
 * axe and the 44px measure run in every state a phone reaches differently —
 * the sheet half-open, the note being written with the tools showing, the
 * verse actions docked — plus two checks only a narrow screen can make:
 * reflow at 320 CSS px (1.4.10), and nothing lost when the reader's own
 * stylesheet widens the text spacing (1.4.12).
 */

async function open(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
}

const expandSheet = async (page: Page) => {
  await page.getByRole('button', { name: /expand notes/i }).tap();
  await expect(page.getByTestId('pane-notes')).toHaveAttribute('data-sheet', 'half');
};

const STATES: Record<string, (page: Page) => Promise<void>> = {
  reading: async () => {},
  'verse actions docked': async (page) => {
    await page.locator('.verse[data-verse="2"] .verse__text').tap();
    await expect(page.getByTestId('verse-actions')).toBeVisible();
  },
  'a quote confirmed on the grip': async (page) => {
    await page.locator('.verse[data-verse="2"] .verse__text').tap();
    await page.getByTestId('quote-2').tap();
    await expect(page.getByTestId('sheet-done')).toBeVisible();
  },
  'notes half open': async (page) => {
    await expandSheet(page);
  },
  'writing a note': async (page) => {
    await expandSheet(page);
    await page.getByTestId('note-new').tap();
    await page.getByTestId('notes-surface').tap();
    await expect(page.getByTestId('editor-tools')).toBeVisible();
  },
  marks: async (page) => {
    await page.getByTestId('marks-open').tap();
    await expect(page.getByTestId('marks-panel')).toBeVisible();
  },
  library: async (page) => {
    await page.getByTestId('library-open').tap();
    await expect(page.getByTestId('library-panel')).toBeVisible();
  },
  settings: async (page) => {
    await page.getByTestId('settings-open').tap();
    await expect(page.getByTestId('settings-panel')).toBeVisible();
  },
  help: async (page) => {
    await page.getByTestId('help-open').tap();
    await expect(page.getByTestId('help-panel')).toBeVisible();
  },
  board: async (page) => {
    for (const verse of [1, 3]) {
      await page.locator(`.verse[data-verse="${verse}"] .verse__text`).tap();
      await page.getByTestId(`canvas-${verse}`).tap();
    }
    await expandSheet(page);
    await page.getByTestId('canvas-open').tap();
    await expect(page.locator('.card')).toHaveCount(2);
  },
  results: async (page) => {
    await page.getByTestId('search-input').fill('love');
    await expect(page.getByTestId('search-count')).toHaveAttribute('data-query', 'love');
    await page.getByTestId('search-input').press('Enter');
    await expect(page.getByTestId('search-results')).toBeVisible();
  },
};

/** Horizontal overflow of the page and of every scrolling region, in px. */
const sidewaysOverflow = (page: Page) =>
  page.evaluate(() => {
    const out: string[] = [];
    const check = (el: Element, name: string) => {
      const over = el.scrollWidth - el.clientWidth;
      if (over > 1) out.push(`${name} overflows by ${over}px`);
    };
    check(document.documentElement, 'the page');
    for (const el of Array.from(document.querySelectorAll('.pane, .sheet__body, .search__panel'))) {
      if ((el as HTMLElement).checkVisibility()) check(el, `.${el.className.split(' ').join('.')}`);
    }
    return out;
  });

test.describe('the gates have teeth', () => {
  // A gate that cannot fail proves nothing. Plant each failure it exists to
  // catch and make sure it does.
  test.use({ viewport: { width: 320, height: 640 } });

  test('the viewport really is 320px, and a too-wide element is caught', async ({ page }) => {
    await open(page);
    expect(await page.evaluate(() => window.innerWidth)).toBe(320);
    expect(await sidewaysOverflow(page)).toEqual([]);
    await page.locator('.chapter__text').evaluate((el) => {
      const wide = document.createElement('div');
      wide.style.width = '900px';
      wide.textContent = 'planted';
      el.prepend(wide);
    });
    expect((await sidewaysOverflow(page)).length).toBeGreaterThan(0);
  });
});

test.describe('axe, on a phone', () => {
  for (const [name, arrange] of Object.entries(STATES)) {
    test(name, async ({ page }) => {
      await open(page);
      await arrange(page);
      const results = await axeFor(page).analyze();
      expect(results.violations.length, describeViolations(results)).toBe(0);
    });
  }
});

test.describe('every pointer target is 44 × 44 or larger, on a phone', () => {
  for (const [name, arrange] of Object.entries(STATES)) {
    test(name, async ({ page }) => {
      await open(page);
      await arrange(page);
      const small = await tooSmall(page);
      expect(small, describeSmall(small)).toEqual([]);
    });
  }
});

test.describe('reflow at 320 CSS px (1.4.10)', () => {
  // 320px is 1280px at 400% zoom — the width the criterion names.
  test.use({ viewport: { width: 320, height: 640 } });

  for (const [name, arrange] of Object.entries(STATES)) {
    test(name, async ({ page }) => {
      await open(page);
      await arrange(page);
      expect(await sidewaysOverflow(page)).toEqual([]);
    });
  }
});

test.describe('text spacing (1.4.12)', () => {
  /**
   * The criterion's own numbers, applied the way a reader's stylesheet or a
   * bookmarklet would: line height 1.5, paragraph spacing 2, letter spacing
   * 0.12 and word spacing 0.16 — all times the font size, and all important.
   */
  const SPACING = `
    * { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }
    p, li, dd, blockquote { margin-bottom: 2em !important; }
  `;

  /**
   * Text cut off by its own box: an element that clips (overflow hidden or
   * clip) whose content is now larger than it. Truncation that is part of the
   * design and whose full text is one action away is listed with its reason.
   */
  const TRUNCATES_BY_DESIGN = [
    '.search__result-text', // two-line preview; the result opens the whole verse
    '.marks__ref-text', // two-line preview; the mark opens the whole verse
    '.notes__heading', // one-line reminder of the heading the caret is under
    '.reader__select', // native select; its options list shows the full name
    '.notes__select', // native select; its options list shows the full title
  ];

  const clipped = (page: Page) =>
    page.evaluate((exempt) => {
      const out: string[] = [];
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
        if (!el.checkVisibility()) continue;
        if (exempt.some((s) => el.matches(s))) continue;
        const style = getComputedStyle(el);
        const clips = /hidden|clip/.test(style.overflowX + style.overflowY);
        if (!clips || !el.textContent?.trim()) continue;
        if (el.matches('.visually-hidden, .pane, .sheet, .sheet__body, .canvas__frame, html, body, #root')) continue;
        const over = Math.max(el.scrollWidth - el.clientWidth, el.scrollHeight - el.clientHeight);
        if (over > 2) out.push(`${el.tagName.toLowerCase()}.${el.className} clips ${over}px: ${el.textContent.trim().slice(0, 40)}`);
      }
      return out;
    }, TRUNCATES_BY_DESIGN);

  test('a box that clips its text is caught', async ({ page }) => {
    await open(page);
    expect(await clipped(page)).toEqual([]);
    await page.locator('.chapter__text').evaluate((el) => {
      const box = document.createElement('p');
      box.style.cssText = 'height: 1em; overflow: hidden;';
      box.textContent = 'A planted paragraph with far more text than one em of height can show.';
      el.prepend(box);
    });
    expect((await clipped(page)).length).toBeGreaterThan(0);
  });

  for (const [name, arrange] of Object.entries(STATES)) {
    test(name, async ({ page }) => {
      await open(page);
      await arrange(page);
      await page.addStyleTag({ content: SPACING });
      expect(await sidewaysOverflow(page)).toEqual([]);
      expect(await clipped(page)).toEqual([]);
    });
  }
});
