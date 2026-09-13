import { expect, test } from '@playwright/test';
import { PAGE_LEVEL_RULES, axeFor, describeViolations } from '../helpers/axe';
import type { Page } from '@playwright/test';

/**
 * Automated accessibility checks, one UI state per test.
 *
 * axe finds the mechanical failures — a control with no name, a missing
 * landmark, a contrast ratio it can compute — and nothing else. It cannot see
 * that focus went nowhere when a panel closed, or that a target is 17px; those
 * live in keyboard.spec.ts and targets.spec.ts. What axe *is* good for is
 * catching the regression nobody would think to test for, weeks later.
 *
 * States are added here in the commit that makes them pass, so this file is
 * never red on `develop`. A state that is not listed yet is a state that has
 * not been fixed yet — see docs/plans/reader-touch-and-aaa/README.md.
 */

async function open(page: import('@playwright/test').Page) {
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
}

test.describe('the AAA rules are actually in the run', () => {
  test('color-contrast-enhanced and identical-links-same-purpose are evaluated', async ({ page }) => {
    await open(page);
    // Disabled in axe's defaults; a tag-based run must still include them, or
    // every "AAA passes" claim this file makes is hollow. The union of every
    // result bucket is the set of rules that ran.
    const results = await axeFor(page).analyze();
    const ran = new Set(
      [...results.passes, ...results.violations, ...results.incomplete, ...results.inapplicable].map(
        (r) => r.id
      )
    );
    expect(ran.has('color-contrast-enhanced'), 'color-contrast-enhanced must run').toBe(true);
    expect(ran.has('identical-links-same-purpose'), 'identical-links-same-purpose must run').toBe(true);
    // Page-level rules are the other way a rule can quietly not run: a context
    // narrower than the whole document files them under inapplicable.
    const applied = new Set([...results.passes, ...results.violations, ...results.incomplete].map((r) => r.id));
    for (const rule of PAGE_LEVEL_RULES) expect(applied.has(rule), `${rule} must be evaluated`).toBe(true);
    // And the plumbing produces a report we can read.
    expect(Array.isArray(results.violations)).toBe(true);
    if (results.violations.length > 0) {
      // Not a failure yet — the states below become assertions as they are fixed.
      test.info().annotations.push({ type: 'axe', description: describeViolations(results) });
    }
  });
});

test.describe('status messages are announced (4.1.3)', () => {
  test('a search total, once the typing pauses', async ({ page }) => {
    await open(page);
    await page.getByTestId('search-input').fill('living water');
    await expect(page.getByTestId('search-count')).toHaveAttribute('data-query', 'living water');
    await expect(page.getByTestId('announcer')).toContainText(/\d+ match(es)? for “living water”/, { timeout: 3_000 });
  });

  test('a panel opening and closing', async ({ page }) => {
    await open(page);
    await page.getByTestId('marks-open').click();
    await expect(page.getByTestId('announcer')).toContainText('Marks opened');
    await page.getByTestId('marks-close').click();
    await expect(page.getByTestId('announcer')).toContainText('Marks closed');
  });

  test('a download that fails is an alert, and the row says so too', async ({ page, context }) => {
    await open(page);
    await context.setOffline(true);
    await page.getByTestId('library-open').click();
    await page.getByTestId('library-get-kjv').click();
    await expect(page.getByTestId('library-error-kjv')).toHaveAttribute('role', 'alert');
    await expect(page.getByTestId('announcer-alert')).toContainText(/connection/i);
  });

  test('a download in progress has a named progressbar', async ({ page }) => {
    await open(page);
    await page.getByTestId('library-open').click();
    await page.getByTestId('library-get-rv1909').click();
    // The bar is short-lived; a name on it is what a screen reader reads while it is there.
    const bar = page.getByTestId('library-progress-rv1909');
    if (await bar.count()) {
      await expect(bar).toHaveAttribute('aria-label', /Downloading/);
    }
    await expect(page.getByTestId('library-read-rv1909')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('announcer')).toContainText(/downloaded/);
  });
});


/**
 * Each UI state, checked in both colour schemes. A state is listed here in the
 * commit that makes it pass; `describeViolations` prints the first offending
 * node per rule so a failure reads without opening the report.
 */
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
  'a quote confirmed': async (page) => {
    await page.getByTestId('note-new').click();
    await page.getByTestId('verse-2').click();
    await page.getByTestId('quote-2').click();
    await expect(page.getByTestId('note-done')).toBeVisible();
  },
  'a quote confirmed, Bible maximized': async (page) => {
    await page.getByTestId('maximize-bible').click();
    await page.getByTestId('verse-2').click();
    await page.getByTestId('quote-2').click();
    await expect(page.getByTestId('layout-done')).toBeVisible();
  },
  marks: async (page) => {
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

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`no axe violations, ${scheme}`, () => {
    for (const [name, arrange] of Object.entries(STATES)) {
      test(name, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await open(page);
        await arrange(page);
        const results = await axeFor(page).analyze();
        expect(results.violations.length, describeViolations(results)).toBe(0);
      });
    }
  });
}
