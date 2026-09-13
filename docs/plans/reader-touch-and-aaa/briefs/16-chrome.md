# Brief 16 — 44 px controls everywhere; hover reveals; preview edit buttons

| | |
|---|---|
| **ID** | `16-chrome` |
| **Size** | M (mechanical; a good first brief for a delegate) |
| **Depends on** | `02-tokens` (`--control-h`, `--edge`) |
| **Status** | open |
| **Criteria** | 2.5.5 Target Size (Enhanced), 2.5.8, 1.4.13 Content on Hover or Focus, 2.1.1 (preview edit), 1.4.11 |

## Outcome

Every button, chip, select, checkbox label and text link that is not inline in prose measures at least 44 × 44 CSS px, in every state of the app, on desktop and on the touch project. Nothing that matters appears only on hover. The rendered-note preview offers a real, focusable "Edit here" control on every block. The sticky bar heights are measured, not assumed, so the taller controls do not push the chapter title under the bar.

## Read first

- `apps/reader/src/styles.css` — every rule listed under "Required behaviour"; also 26 (`--bar-h`), 189 and 265 (sticky offsets that assume it), 843–849 (`.compare__quote` opacity reveal), 637–638 (`.preview__block:hover`).
- `apps/reader/src/components/BiblePane.tsx` lines 83–97 (the sticky detection reads the computed `top`, so measured values keep working) and 101–169 (the bar).
- `apps/reader/src/components/MarkdownPreview.tsx` lines 41–65 — the empty state `<div onClick>` and the per-block `<div onClick>`.
- `tests/reader/editor.spec.ts` lines 75–98 — the click-a-block-to-edit contract that must stay green.

## Rules that bite here

> "An `@container` block adds no specificity. The narrow-notes rules must come after the base ones…" — CLAUDE.md → Apps. Put the `min-height` rules in the base blocks, not in a container query.

> "Never assert on the 'Saved' label in tests." — CLAUDE.md → Apps (if you touch notes tests).

> "Never remove or rename an existing `data-testid`." — AGENTS.md rule 7.

## Required behaviour

1. Apply `min-height: var(--control-h)` (and `min-width: var(--control-h)` where the control is icon-only) to: `.pane__maximize`, `.reader__select`, `.reader__chip`, `.reader__chip--icon`, `.search__input`, `.search__jump`, `.search__ref`, `.search__insert`, `.search__see-all`, `.search__option`, `.marks__close`, `.marks__label`, `.marks__ref`, `.marks__remove`, `.notes__link`, `.settings__close`, `.settings__action`, `.settings__toggle`, `.proposal__action`, `.canvas__select`, `.canvas__action`, `.canvas__zoom button`, `.card__action`, `.tools__button`, `.results__close`, `.results__book`, `.results__ref`, `.results__insert`, `.results__more`, `.library__close`, `.library__action`, `.notes__select`, `.notes__action`, `.notes__title`, `.durability__action`, `.durability__dismiss`, `.sheet__grip`, `.compare__drop`, `.compare__quote`, `.embed__open`. Text links inside prose (`.preview__link`, `.attribution a`) are exempt (inline) and stay as they are.
2. Checkboxes: `.search__option`, `.settings__toggle` and `.proposal__item label` get `min-height: var(--control-h)` and `display: inline-flex; align-items: center` — the label is the target.
3. `--bar-h` and `--search-h` are measured: one `ResizeObserver` in `BiblePane` writes `--bar-h` from `.reader__bar`'s `offsetHeight` and `--search-h` from `.search`'s, onto `.reader`. `styles.css` sticky offsets (`.chapter__title { top }`, `.search { top }`, `.reader:has(.search) .chapter__title { top }`) use those variables; the `2.9rem` constant goes.
4. Hover reveals: `.compare__quote` is always visible at reduced emphasis (`opacity: .7`, `1` on hover/focus); `.marks__label` always shows its `--edge` border; `.canvas__edge-cut` is handled in brief 14; `.preview__block:hover` stays as a hint but is no longer the only affordance (next item).
5. `MarkdownPreview`: each block wrapper gains a `<button className="preview__edit" aria-label="Edit here" data-testid="preview-edit-{i}">` positioned at the block's top-right, visible on hover and `:focus-within`, always visible under `(hover: none)`, 44 × 44; clicking it calls `onEditAt(block.offset)`. The block's own click stays (pointer users). The empty preview becomes `<button className="preview preview--empty">`.
6. Under `(hover: none)` nothing depends on `:hover`: audit every `:hover` rule that reveals or moves content and give it an always-on equivalent.

## Files you may touch

- `apps/reader/src/styles.css`, `apps/reader/src/components/BiblePane.tsx` (the observer only), `apps/reader/src/components/MarkdownPreview.tsx`.
- `tests/reader/targets.spec.ts` (new), `tests/reader/editor.spec.ts` (additions).

## Tests to add or change

- `tests/reader/targets.spec.ts` — a `targets(page)` helper: query `a[href], button, input, select, textarea, summary, [role=button], [role=link], [role=checkbox], [role=separator][tabindex], [tabindex]:not([tabindex="-1"])`; keep elements passing `checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })`, not inside `[inert]` or `[aria-hidden="true"]`, with a non-empty `getClientRects()`; for `input[type=checkbox|radio]` measure `closest('label') ?? el`; assert width ≥ 44 and height ≥ 44 unless the element matches the allowlist (`.verse__num` — inline in text; `.preview__link`, `.attribution a`, `.search__see-all`, `.results__more`, `.embed__open` — inline text links); report `outerHTML.slice(0, 120)` for each failure. One test per state: reading; verse actions open; marks; library; settings; results; compare (after installing rv1909); preview mode; canvas with two cards; proposal open. Light only.
- `tests/reader/editor.spec.ts` — Tab to `preview-edit-2` (the blockquote block) and press Enter → editor with caret in that block; existing click test green.

## Acceptance commands

```bash
mise exec node@24 -- npm run lint
mise exec node@24 -- npx playwright test --project=reader tests/reader/targets.spec.ts tests/reader/editor.spec.ts tests/reader/chrome.spec.ts tests/reader/reading.spec.ts
mise exec node@24 -- npx playwright test --project=reader-touch
```

## Reviewer checklist

- [ ] `targets.spec.ts` passes in every listed state on both projects.
- [ ] The chapter title still parks directly under the bar after the bar grows (sticky test in `chrome.spec.ts`).
- [ ] No new `:hover`-only affordance.
