import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Target size, enhanced (2.5.5): every pointer target is at least 44 × 44 CSS
 * px, in every state of the app.
 *
 * Measured from the boxes the browser lays out, not from the stylesheet — a
 * `min-height` that a later rule overrides, a flex item squeezed by its
 * neighbours, a button whose padding was set in em on a small font: all pass
 * a code review and fail here. The exceptions the criterion allows are the
 * allowlist below, one comment each; nothing is added to it to make a run
 * green.
 */

async function open(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
}

/** The criterion's own exceptions: inline in text, or the equivalent is elsewhere. */
const ALLOWLIST: Record<string, string> = {
  '.verse__num': 'inline in the text; the whole verse is the equivalent target',
  '.preview__link': 'a link inside prose',
  '.attribution a': 'a link inside a sentence',
  '.search__see-all': 'a link inside the count sentence; the results view is the equivalent',
  '.results__more': 'a link inside the footer sentence',
  '.embed__open': 'a link inside the caption sentence',
  '.skip': 'off-screen until focused; its box is measured when it is',
};

interface Small {
  html: string;
  width: number;
  height: number;
}

const TARGETS =
  'a[href], button, input, select, textarea, summary, [role="button"], [role="link"], [role="checkbox"], [role="separator"][tabindex], [tabindex]:not([tabindex="-1"])';

/** Every visible pointer target smaller than 44 × 44, minus the allowlist. */
function tooSmall(page: Page, allow: string[]): Promise<Small[]> {
  return page.evaluate(
    ({ selector, allow, min }) => {
      const out: { html: string; width: number; height: number }[] = [];
      for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
        if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
        if (el.closest('[inert], [aria-hidden="true"]')) continue;
        if (allow.some((s) => el.matches(s))) continue;
        // A checkbox's label is its target.
        const box = (
          el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')
            ? el.closest('label') ?? el
            : el
        ).getBoundingClientRect();
        if (box.width === 0 && box.height === 0) continue;
        if (box.width + 0.5 < min || box.height + 0.5 < min) {
          out.push({ html: el.outerHTML.slice(0, 120), width: Math.round(box.width), height: Math.round(box.height) });
        }
      }
      return out;
    },
    { selector: TARGETS, allow, min: 44 }
  );
}

const STATES: Record<string, (page: Page) => Promise<void>> = {
  reading: async () => {},
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
      const small = await tooSmall(page, Object.keys(ALLOWLIST));
      expect(small, small.map((s) => `${s.width}×${s.height} ${s.html}`).join('\n')).toEqual([]);
    });
  }
});
