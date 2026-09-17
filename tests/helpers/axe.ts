import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

/**
 * axe-core, configured once for the reader.
 *
 * Tags rather than a rule list: this is the whole of WCAG 2.0/2.1/2.2 at A,
 * AA and AAA plus axe's own best practices. The two AAA-tagged rules
 * (`color-contrast-enhanced`, `identical-links-same-purpose`) are *disabled*
 * in axe's defaults. A tag-based run does include them, but they are enabled
 * explicitly here as well, and `tests/reader/a11y.spec.ts` has a self-check
 * that they really ran.
 *
 * ⚠️ No `resultTypes: ['violations']`. It sounds like a harmless speed-up, and
 * on axe 4.13.0 it silently drops those two rules from every result bucket —
 * the self-check went red with the rules apparently never having run.
 * Measured, not inferred: 92 rules reported without the option, 88 with it.
 *
 * ⚠️ No `.include('#root')` either. axe runs its page-level rules only when
 * the context is the whole document; scoped to the app's root element, it
 * files them under *inapplicable* and says nothing. That skipped ten rules in
 * every state — six of them WCAG A or AA: `bypass` (2.4.1), `document-title`
 * (2.4.2), `html-has-lang` and `html-lang-valid` (3.1.1), `meta-viewport`
 * (1.4.4) and `aria-hidden-body` — plus `region`, which is how a status bar
 * placed between the two panes, outside both landmarks, went unnoticed. The
 * self-check in a11y.spec.ts now asserts the page-level rules ran as well.
 *
 * axe reports contrast over `color-mix()` and blurred surfaces as *incomplete*,
 * never as a violation, so the contrast gate lives in
 * `tests/unit/contrast.test.ts` and axe is the backstop, not the arbiter.
 */
export const AXE_TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag2aaa',
  'wcag21a',
  'wcag21aa',
  'wcag22aa',
  'best-practice',
];

/** Rules that only run over the whole document. The self-check asserts they did. */
export const PAGE_LEVEL_RULES = ['bypass', 'document-title', 'html-has-lang', 'region'];

/**
 * What axe's `region` rule accepts as holding content outside a landmark.
 *
 * Its default, plus the pane divider. `region` already exempts a button, so the
 * two nudge buttons beside the divider pass; the divider is the same kind of
 * control — a focusable window splitter, `role="separator"` — but is not
 * exempt, and it belongs between the Scripture and Notes landmarks, not inside
 * either. Treating separators as containers exempts only that: a separator
 * that is not focusable has no content for the rule to find.
 */
const REGION_MATCHER = 'dialog, [role=dialog], [role=alertdialog], svg, [role=separator]';

/**
 * Rules switched off while the structural work in the semantics brief lands.
 * Each entry is a debt, not a decision: remove it in the commit that fixes
 * the underlying structure, and never add one to make a red run green.
 */
export const RULES_PENDING_SEMANTICS: string[] = [];

export function axeFor(page: Page, disable: string[] = RULES_PENDING_SEMANTICS) {
  const builder = new AxeBuilder({ page })
    .withTags(AXE_TAGS)
    .options({
      rules: {
        'color-contrast-enhanced': { enabled: true },
        'identical-links-same-purpose': { enabled: true },
      },
      checks: { region: { options: { regionMatcher: REGION_MATCHER } } },
    });
  return disable.length ? builder.disableRules(disable) : builder;
}

/** One line per violation, with the first offending node, so a failure reads without the report. */
export function describeViolations(results: Awaited<ReturnType<AxeBuilder['analyze']>>): string {
  return results.violations
    .map((v) => {
      const node = v.nodes[0];
      const target = node ? node.target.join(' ') : '?';
      return `${v.id} [${v.impact}] ${v.help}\n    at ${target}\n    ${v.helpUrl}`;
    })
    .join('\n');
}
