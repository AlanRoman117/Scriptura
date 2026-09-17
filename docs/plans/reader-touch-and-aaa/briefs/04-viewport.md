# Brief 04 — Viewport, safe area and the pointer-drag helper

| | |
|---|---|
| **ID** | `04-viewport` |
| **Size** | M |
| **Depends on** | none |
| **Status** | done (ea60bca) |
| **Criteria** | supports 1.4.10 Reflow, 2.5.7, 2.5.8/2.5.5; touch usability |

## Outcome

The app knows the size of the *visual* viewport — the part not under the software keyboard — and exposes it to CSS; nothing sits under a phone's notch or home indicator; every drag in the app (divider, sheet grip, canvas) goes through one helper that captures the pointer and recovers when the browser cancels a touch. Tapping does not flash grey boxes.

## Read first

- `apps/reader/index.html` — the viewport meta.
- `apps/reader/src/styles.css` lines 42–56 (root sizing, `body.dragging`), 85 (`.pane` overflow), 113–121 (sticky bar), 928–953 (the sheet).
- `apps/reader/src/components/Layout.tsx` lines 85–98 and 155–173 — the divider's pointer handling.
- `apps/reader/src/components/CanvasView.tsx` lines 111–155, 313–328, 389–400, 511–521 — pan, drag and resize; the window listeners that never see `pointercancel`.
- `apps/reader/vite.config.ts` lines 48–60 — the manifest.

## Rules that bite here

> "Dragging the background pans, and the check cannot be `e.target !== e.currentTarget`…" — CLAUDE.md → Apps (canvas). Keep the `closest('.card')` test.

> "The pane divider's floor is a width (`MIN_PANE = 320`), not a share." — CLAUDE.md → Apps. The helper changes how a drag is tracked, never the limits.

> "`canvas.spec.ts:168-176` expects an exact −200/−120 pan" — plan. No threshold, no inertia, no rounding in the helper.

## Current behaviour

No `touch-action`, `setPointerCapture` or `pointercancel` anywhere. `body.dragging` (`user-select: none`) is removed only on `pointerup`. `viewport-fit=cover` is set with no `env(safe-area-inset-*)`. Three different viewport units are in use.

## Required behaviour

1. `apps/reader/src/lib/viewport.ts` exports `useVisualViewport()`: on mount and on `visualViewport` `resize`/`scroll` (rAF-throttled), writes `--vvh` (`visualViewport.height` in px, falling back to `innerHeight`) and `--vv-top` (`visualViewport.offsetTop`) to `document.documentElement.style`. Mounted once, in `App`.
2. `usePointerDrag({ onStart, onMove, onEnd })` returns props to spread onto the gesture surface: `onPointerDown` calls `setPointerCapture` (in try/catch), records the pointer id, adds `body.dragging`; the same element's `onPointerMove`, `onPointerUp`, `onPointerCancel` and `onLostPointerCapture` drive `onMove`/`onEnd`; `onEnd` always removes `body.dragging`. Clients pass raw `clientX/clientY`; the helper adds nothing to them.
3. `index.html` viewport becomes `width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content`.
4. `styles.css`: `.reader__bar { padding-top: env(safe-area-inset-top) }` in narrow mode; `.sheet__grip { padding-bottom: calc(.5rem + env(safe-area-inset-bottom)) }`; `.canvas__bar` likewise on top; `html { -webkit-tap-highlight-color: transparent }` with an explicit `:active` background on `.verse`, buttons and chips; `button, select, [role=button] { touch-action: manipulation }`; `.divider, .sheet__grip, .canvas__frame, .card__grip, .card__resize { touch-action: none }`.
5. `vite.config.ts` manifest gains `orientation: 'any'` (1.3.4 stated explicitly).
6. `Layout.tsx` divider and `CanvasView.tsx` pan/drag/resize adopt `usePointerDrag`. Behaviour is otherwise identical; `tests/reader/canvas.spec.ts` and `tests/reader/reading.spec.ts` pass unchanged.

## Files you may touch

- `apps/reader/src/lib/viewport.ts` (new), `apps/reader/index.html`, `apps/reader/vite.config.ts`, `apps/reader/src/styles.css`, `apps/reader/src/components/Layout.tsx`, `apps/reader/src/components/CanvasView.tsx`, `apps/reader/src/App.tsx` (mount the hook).
- `tests/reader-touch/shell.spec.ts`.

## Tests to add or change

- `tests/reader-touch/shell.spec.ts` — `document.documentElement.style.getPropertyValue('--vvh')` is a px value equal to `innerHeight` at rest; no horizontal overflow at 412 px (`scrollWidth <= clientWidth` on `html` and on `.pane--bible`); with `page.addStyleTag` setting `--vvh: 400px`, the sheet at `half` is not taller than 400 px (T1 completes this).
- Existing: `tests/reader/canvas.spec.ts`, `tests/reader/reading.spec.ts`, `tests/reader/chrome.spec.ts` unchanged and green.

## Acceptance commands

```bash
mise exec node@24 -- npm run lint
mise exec node@24 -- npx playwright test --project=reader tests/reader/canvas.spec.ts tests/reader/reading.spec.ts tests/reader/chrome.spec.ts
mise exec node@24 -- npx playwright test --project=reader-touch tests/reader-touch/shell.spec.ts
```

## Reviewer checklist

- [ ] A touch drag on the canvas that is interrupted (simulate `pointercancel`) leaves `body.dragging` absent.
- [ ] Pan by exactly −200/−120 still measures exactly −200/−120.
