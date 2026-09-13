import { expect, test } from '@playwright/test';
import { axeFor, describeViolations } from '../helpers/axe';

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
    // And the plumbing produces a report we can read.
    expect(Array.isArray(results.violations)).toBe(true);
    if (results.violations.length > 0) {
      // Not a failure yet — the states below become assertions as they are fixed.
      test.info().annotations.push({ type: 'axe', description: describeViolations(results) });
    }
  });
});
