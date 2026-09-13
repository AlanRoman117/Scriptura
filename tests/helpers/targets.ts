import type { Page } from '@playwright/test';

/**
 * Target size, enhanced (2.5.5): the measurer shared by the desktop and touch
 * projects.
 *
 * Measured from the boxes the browser lays out, not from the stylesheet — a
 * `min-height` that a later rule overrides, a flex item squeezed by its
 * neighbours, a button whose padding was set in em on a small font: all pass
 * a code review and fail here. The exceptions the criterion allows are the
 * allowlist below, one reason each; nothing is added to it to make a run green.
 */

/** The criterion's own exceptions: inline in text, or the equivalent is elsewhere. */
export const TARGET_ALLOWLIST: Record<string, string> = {
  '.verse__num': 'inline in the text; the whole verse is the equivalent target',
  '.preview__link': 'a link inside prose',
  '.attribution a': 'a link inside a sentence',
  '.search__see-all': 'a link inside the count sentence; the results view is the equivalent',
  '.results__more': 'a link inside the footer sentence',
  '.embed__open': 'a link inside the caption sentence',
  '.skip': 'off-screen until focused; its box is measured when it is',
};

export interface SmallTarget {
  html: string;
  width: number;
  height: number;
}

const TARGETS =
  'a[href], button, input, select, textarea, summary, [role="button"], [role="link"], [role="checkbox"], [role="separator"][tabindex], [tabindex]:not([tabindex="-1"])';

/** Every visible pointer target smaller than 44 × 44, minus the allowlist. */
export function tooSmall(page: Page, allow: string[] = Object.keys(TARGET_ALLOWLIST)): Promise<SmallTarget[]> {
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

export const describeSmall = (small: SmallTarget[]): string =>
  small.map((s) => `${s.width}×${s.height} ${s.html}`).join('\n');
