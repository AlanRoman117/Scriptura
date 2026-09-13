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

/**
 * Rules switched off while the structural work in the semantics brief lands.
 * Each entry is a debt, not a decision: remove it in the commit that fixes
 * the underlying structure, and never add one to make a red run green.
 */
export const RULES_PENDING_SEMANTICS: string[] = [];

export function axeFor(page: Page, disable: string[] = RULES_PENDING_SEMANTICS) {
  const builder = new AxeBuilder({ page })
    .withTags(AXE_TAGS)
    .include('#root')
    .options({
      rules: {
        'color-contrast-enhanced': { enabled: true },
        'identical-links-same-purpose': { enabled: true },
      },
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
