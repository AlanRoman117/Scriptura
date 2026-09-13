# Brief 02 — AAA colour tokens and the focus ring

| | |
|---|---|
| **ID** | `02-tokens` |
| **Size** | M |
| **Depends on** | none |
| **Status** | open |
| **Criteria** | 1.4.6 Contrast (Enhanced), 1.4.3, 1.4.11 Non-text Contrast, 2.4.7 Focus Visible, 2.4.13 Focus Appearance (AAA), 2.4.11/2.4.12 Focus Not Obscured |

## Outcome

Every piece of text in the reader is at least 7:1 against what it sits on, in every theme; every control boundary, focus ring and swatch ring is at least 3:1; every focusable element shows the same 2 px ring; and a focused element is never hidden under a sticky bar. A jest test reads the token blocks straight out of the stylesheet and fails the build if any pair drops below the threshold.

## Read first

- `apps/reader/src/styles.css` lines 9–40 (the two token sets), 64–68 (the focus rule and why it loses), 269–336 (highlight tints, swatches), 360, 558, 576, 894, 901 (the five `outline: none`), 113–121 and 188–195 and 214 (sticky bars).
- `tests/helpers/contrast.ts` — the arithmetic to reuse.
- `tests/reader/chrome.spec.ts` lines 30–55 — the existing 4.5:1 dropdown check; it moves to 7.
- `docs/plans/reader-touch-and-aaa/README.md` → "Measured colour facts" — the starting values.

## Rules that bite here

> "`normalizeBookKey` strips only the Latin combining block … There is a regression test; do not 'simplify' it." — CLAUDE.md. Same spirit here: the measured numbers in the README are the reason for each value; do not round a colour to something prettier without re-measuring.

> "Carry measured numbers, not adjectives — change the behaviour and the tables need re-measuring, not just rewording." — CLAUDE.md → Docs

> "Comments say why, not what." — AGENTS.md rule 11

## Current behaviour

Light `--accent #8a6d1f` is 4.65:1 on paper and is used as text in seven places, including 12 px verse numbers that fall to 3.56–4.0:1 over highlight tints. `--rule #e5e1da` (1.24:1) is the border of every input, select, chip and card. `#b3261e` is hardcoded in seven rules and is 2.77:1 in dark mode except for `.library__error`. Dark `--ink-soft #a8a29a` is 6.59:1 on `--paper-raised`. The focus rule uses `:where()` (zero specificity), omits `input`, and is overridden by five `outline: none` declarations. There is no `prefers-contrast` or `forced-colors` handling.

## Required behaviour

1. Token blocks are delimited so a test can find them: `/* @tokens light */ :root { … } /* @tokens end */`, and likewise `dark`, `hc-light`, `hc-dark`, `sepia`. The `dark` block applies both under `@media (prefers-color-scheme: dark)` when `[data-theme]` is absent and under `:root[data-theme="dark"]`; `hc-*` and `sepia` apply under their `[data-theme]` only, and `hc-light`/`hc-dark` additionally under `@media (prefers-contrast: more)` when no theme is set.
2. Each block defines: `--ink`, `--ink-soft`, `--paper`, `--paper-raised`, `--rule` (decorative separators only), `--edge` (control boundaries, ≥ 3:1 against both `--paper` and `--paper-raised`), `--accent`, `--danger`, `--focus`, and the five highlight tints `--hl-amber … --hl-violet` as *opaque* colours (no `color-mix` in the token, so the test can measure them).
3. Starting values, to be confirmed by the test: light `--accent #5f4a0e`, `--danger #9a1f18`, `--edge #867f77`; dark `--ink-soft #b3ada5`, `--danger #f2b8b5`, `--edge #7a746c`; hc-light `#000/#fff` family; hc-dark `#fff/#000` family; sepia paper `#f4ecd8` with an ink-soft dark enough for 7:1.
4. Every `#b3261e` becomes `var(--danger)`; every control border becomes `var(--edge)`; `.sheet__handle` uses `--edge`; `.swatch` gets a 2 px ring in `--edge`.
5. Verse numbers over a highlighted verse use `var(--ink)`: `.verse[data-highlight] .verse__num { color: var(--ink) }`.
6. `--control-h: 44px` and `--focus-ring: 2px solid var(--focus)` are defined once in `:root`.
7. The focus rule becomes `a:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible, summary:focus-visible, [tabindex]:focus-visible, [contenteditable]:focus-visible { outline: var(--focus-ring); outline-offset: 2px }` (no `:where`). Text fields that sit flush use `outline-offset: -2px`. The five `outline: none` declarations are deleted.
8. `.pane { scroll-padding-top: calc(var(--bar-h) + var(--search-h, 0px) + 0.5rem); scroll-padding-bottom: calc(var(--sheet-h, 0px) + 0.5rem) }` and `.verse { scroll-margin-block: 0.5rem }`. (`--bar-h` and `--search-h` become measured in brief 16; until then the constants stand.)
9. `@media (forced-colors: active)`: controls get `border: 1px solid CanvasText`; highlighted verses keep a `border-left: 3px solid Highlight`; swatches and card dots use `forced-color-adjust: none`; the focus ring uses `outline-color: Highlight`.

## Files you may touch

- `apps/reader/src/styles.css`; `tests/unit/contrast.test.ts` (new); `tests/reader/chrome.spec.ts` (threshold only).

## Files you must not touch

Any component. This brief is CSS and its test.

## Tests to add or change

- `tests/unit/contrast.test.ts` — parse every `/* @tokens X */ … /* @tokens end */` block into a map; for each theme assert `--ink` and `--ink-soft` ≥ 7:1 on `--paper` and on `--paper-raised`; `--accent` and `--danger` ≥ 7:1 on both; `--ink` ≥ 7:1 on each `--hl-*` tint; `--edge` and `--focus` ≥ 3:1 on both papers; `--focus` ≥ 3:1 against `--edge` (ring against a bordered control). Fail with the pair and the ratio.
- `tests/reader/chrome.spec.ts` — the dropdown threshold moves from 4.5 to 7.

## Acceptance commands

```bash
mise exec node@24 -- npm run lint
mise exec node@24 -- npm test
mise exec node@24 -- npx playwright test --project=reader tests/reader/chrome.spec.ts tests/reader/notes.spec.ts
```

## Reviewer checklist

- [ ] `grep -c "outline: none" apps/reader/src/styles.css` is 0.
- [ ] `grep -c "#b3261e" apps/reader/src/styles.css` is 0.
- [ ] Hue is preserved (the palette darkens or lightens; it does not change colour).
- [ ] Light and dark screenshots attached; the highlight tints still read as five distinct colours.
