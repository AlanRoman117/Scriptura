# Reader: touch, mobile, and WCAG 2.2 AAA

**Status:** in progress on branch `reader/touch-aaa` (started 2026-09-12).
**Owner:** the `reader-a11y-lead` agent (`.claude/agents/reader-a11y-lead.md`), reviewed by the repository owner.
**Rules for anyone working on this:** [`/AGENTS.md`](../../../AGENTS.md). **How work is handed out:** [`DELEGATION.md`](DELEGATION.md). **Conformance record:** [`wcag-2.2-aaa-matrix.md`](wcag-2.2-aaa-matrix.md). **Work packages:** [`briefs/`](briefs/).

`apps/reader` works well with a mouse and keyboard. On a phone or a touch screen much of it is hard or impossible to use, and against WCAG 2.2 it fails a number of Level A and AA criteria before AAA is even considered. This plan fixes both, in an order that keeps every commit green.

## Scope, decided

- **Conformance target:** WCAG 2.2 Level AAA for the application UI and for text the app itself authors (labels, help, errors, settings copy). Scripture and user-written notes are *content*: 3.1.5 Reading Level and 3.1.6 Pronunciation are documented exemptions for them (a 1611 translation is not going to read at lower-secondary level, and that is not a defect of the reader). Language of parts, contrast, spacing and reflow are still enforced on that content.
- **Touch target:** every function reachable with one finger on a 360–430px phone, including writing a note with the software keyboard up. Controls are 44×44 CSS px everywhere; 2.5.5 has no coarse-pointer exception, so there is no "compact" density mode.
- **Out of scope for automation:** real-device verification — iOS Safari's keyboard and fixed-position behaviour, VoiceOver, TalkBack, Windows High Contrast — cannot be done from CI or an agent sandbox. Those are open briefs for a person with devices (`briefs/9x-*`).

## What was wrong (audit of 2026-09-12)

### Touch and mobile, worst first

1. **Notes cannot be written on a phone with the keyboard up.** The textarea lives in a `position: fixed` bottom sheet (`styles.css` `.sheet`, `Layout.tsx` narrow branch). iOS does not move fixed elements with the visual viewport, so the keyboard covers the thing being typed into — and the formatting toolbar only exists while the textarea is focused, behind a 150 ms blur timer.
2. **`viewport-fit=cover` with no `env(safe-area-inset-*)` anywhere.** The sheet grip, the only bottom-zone control, renders under the home indicator.
3. **The canvas is not touch-operable.** Zoom is ctrl/⌘-wheel only; there is no pinch. Nothing sets `touch-action`, calls `setPointerCapture`, or listens for `pointercancel`, so a browser-interrupted touch drag strands the drag state and leaves `user-select: none` on the whole document.
4. **Targets are tiny.** Verse number ≈18×13 px, swatches 16.8 px, card colour dots 9.6 px, card resize grip 14 px, compare-quote ≈20×17 px, divider 11 px wide; the edge-delete control is an invisible 18 px circle drawn only on hover. There is no minimum size anywhere in the stylesheet.
5. **Search is unusable under a keyboard.** The dropdown exists only while the input is focused, is sized in `vh` of the large viewport, and Enter does nothing for a text query.
6. **The whole-verse tap target has no affordance on touch** (`(hover: none)` removes the only cue) and the text-selection guard was tuned for mouse drags.
7. **Phone widths fall between the breakpoints.** The 22 rem container query never fires at 360–430 px, while 48 px and 41.6 px of padding are reserved for a maximize button that narrow mode never renders.
8. One `(pointer: coarse)` rule and one `(hover: none)` rule in 965 lines of CSS; no tap-highlight handling; `vh`, `dvh` and `100%` all in use.
9. **No touch test coverage.** Playwright runs Desktop Chrome only; the narrow-screen spec is a mouse at 390×844.

### WCAG, worst first

1. **Keyboard-inoperable functions** (2.1.1, 2.1.3): preview click-to-edit blocks are `<div onClick>`; canvas pan, card drag, resize, connect-target and edge-delete are pointer-only with the edge layer `aria-hidden`; the search dropdown and editor toolbar self-destruct on blur behind mouse-only `onMouseDown` guards. No drag has a single-pointer alternative (2.5.7).
2. **Focus** (2.4.3, 2.4.7, 2.4.11–13): the focus-ring rule omits `input` and, at zero specificity, loses to five `outline: none` declarations — the main writing textarea has no visible focus. The proposal dialog declares `aria-modal` with no containment, initial focus or return. Panels have no Escape and drop focus to `<body>` on close. Sticky bars obscure focused verse numbers.
3. **Structure** (1.3.1, 2.4.1, 2.4.6, 2.4.10): no skip link; the only `<h1>` is `hidden` whenever a panel is open; canvas view has no `<main>` and no heading; note headings render as raw `h1..h6`; the five Marks collections have no headings; disclosures are marked `aria-pressed`; `role=toolbar` without arrow keys.
4. **Colour** (1.4.1, 1.4.3, 1.4.6, 1.4.11): `--accent #8a6d1f` is 4.65:1 as text and 3.56–4.0:1 over highlight tints (fails AA); `--rule` at 1.24:1 is every control border; `#b3261e` is 2.77:1 in dark mode; highlight collections are conveyed by hue alone; no `prefers-contrast` or `forced-colors` handling.
5. **Language** (3.1.2): six of eleven translations are Spanish, French or Japanese and none of their text carries `lang`.
6. **Status** (4.1.3): only the note-save footer is a live region; search counts, downloads, errors and panel changes are silent; the progressbar is unnamed.
7. **Motion** (2.3.3): reduced-motion disables transitions but not the verse-flash animation or smooth scrolling.
8. **Visual presentation** (1.4.8): no user control of colours, size or spacing; measure ≈80 ch; verse spacing under 1.5× leading.
9. **Error prevention** (3.3.4, 3.3.6): removing a card, edge, mark or translation is unconfirmed and irreversible; the two-step "Sure?" mutates the button's name silently; nothing can be undone.
10. **Names and help** (4.1.2, 2.4.2, 2.4.9, 3.3.5): glyph-only buttons, a translation chip named by its bare ID, a "source" link, a static page title, `title` as the sole affordance in about twenty places, no help of any kind, and a board thumbnail whose cards and edges have no text alternative.

### Measured colour facts

Computed with the WCAG relative-luminance formula, not estimated. Light `--ink-soft` already passes (7.25:1 on paper). Replacements: light `--accent #5f4a0e` (8.07 on paper, 8.49 on white, but only 6.9 over the amber tint — so **verse numbers on highlighted verses use `--ink`**); `--danger #9a1f18` light (7.73) and `#f2b8b5` dark (10.59); dark `--ink-soft #b3ada5` (7.49 on raised); a new `--edge` control boundary ≈`#867f77` light (3.75) / ≈`#7a746c` dark (3.91). The amber, sky and mint swatch hues are 1.86, 2.93 and 2.48:1 against white — colour alone cannot identify them, which is why highlights gain a marker. `tests/unit/contrast.test.ts` is the arbiter, not this paragraph.

## Architecture decisions

**A. Preferences** — `apps/reader/src/lib/prefs.ts` plus a short inline script in `index.html`. Device-scoped display preferences in `localStorage` (`scriptura-display`), like the assistant flag in `lib/webmcp.ts`: they describe this device, so they are neither exported nor mirrored. Shape: `theme` (system / light / dark / hc-light / hc-dark / sepia), `textSize` (100–200 %), `spacing` (normal / relaxed / loose presets; *relaxed* meets 1.4.8's 1.5× line and paragraph rule), `measure` (narrow / normal / wide, in `ch`, never above 70), `motion` (system / reduce), `markers` (non-colour glyphs on highlights). `system` renders as an *absent* attribute so the `prefers-*` media queries stay the defaults. The inline script applies `data-theme`, `data-motion`, `data-markers` and both `theme-color` metas before first paint; a jest test asserts it and the module agree.

**B. Tokens** — per-theme token blocks in `styles.css` between `/* @tokens */` markers so a test can parse them. New `--edge` (≥3:1 control boundary; `--rule` stays for decorative separators), `--danger`, `--control-h: 44px`, `--focus-ring`; dark-theme highlight tints; `forced-colors` and `prefers-contrast: more` blocks. The focus selector covers every focusable element at real specificity and the `outline: none` rules go. `--bar-h` and `--search-h` are **measured** with a `ResizeObserver` because 44 px controls and text-size preferences change them; sticky offsets and scroll padding derive from those.

**C. Focus** — `apps/reader/src/lib/focus.ts`: `useReturnFocus`, a single **dismiss stack** (`useDismissable`) with one document listener that closes only the topmost surface on Escape or outside-click, and `useRovingTabIndex` for verse actions, the formatting toolbar and the results book filter. The proposal preview becomes a native `<dialog>` opened with `showModal()`.

**D. Viewport** — `apps/reader/src/lib/viewport.ts`: `useVisualViewport()` writes `--vvh` and `--vv-top`; `index.html` gains `interactive-widget=resizes-content`; the sheet is anchored from the visual viewport; safe-area padding on every edge-hugging surface; a `usePointerDrag` helper with pointer capture and `pointercancel` handling for the divider, the sheet grip and the canvas.

**E. Announcer** — `apps/reader/src/lib/announce.ts` mounted in `main.tsx` (above App's early boot returns): one polite and one assertive live region for search totals, download progress and errors, panel changes, translation switches, board-save failures and undo.

**F. Tests** — `@axe-core/playwright` pinned exactly; a `reader-touch` Playwright project on the Pixel 7 descriptor (Chromium, `hasTouch`, `isMobile`); jest gates for contrast, preferences and gesture maths; Playwright gates for axe (AAA tags, with a self-check that the AAA rules ran), 44 px targets, keyboard traversal, reduced motion, reflow at 320 px and injected text spacing. Touch drags use CDP touch events; the software keyboard is simulated by setting `--vvh`.

**G. Delegation** — this directory, `/AGENTS.md`, and `.claude/agents/reader-a11y-lead.md`. See `DELEGATION.md`.

## Work packages and status

Status: `open` · `assigned (who)` · `in review` · `done (commit)` · `blocked (why)`.

| ID | Package | Brief | Status |
|---|---|---|---|
| F1 | Display and accessibility preferences | `briefs/01-prefs.md` | open |
| F2 | AAA colour tokens and focus ring | `briefs/02-tokens.md` | open |
| F3 | Focus utilities and native dialog | `briefs/03-focus.md` | open |
| F4 | Viewport, safe area and pointer helper | `briefs/04-viewport.md` | open |
| F5 | Live-region announcer | `briefs/05-announcer.md` | open |
| F6 | Test infrastructure (axe, touch project, helpers) | `briefs/06-test-infra.md` | done (f4ef575); `targets`/`keyboard` scaffolds land with briefs 16 and 02 |
| T1 | Draggable, keyboard-aware notes sheet | `briefs/11-sheet.md` | open |
| T2 | Verse actions at 44 px, docked on narrow | `briefs/12-verse-actions.md` | open |
| T3 | Search as a form; results reachable under a keyboard | `briefs/13-search.md` | open |
| T4 | Canvas: touch, pinch, keyboard, connections list, undo | `briefs/14-canvas.md` | open |
| T5 | Divider hit area and single-pointer alternative | `briefs/15-divider.md` | open |
| T6 | 44 px controls everywhere; hover reveals; preview edit buttons | `briefs/16-chrome.md` | open |
| T7 | Stacked comparison on narrow panes | `briefs/17-compare-narrow.md` | open |
| T8 | Editor toolbar reachable by keyboard and touch | `briefs/18-editor.md` | open |
| W1 | Landmarks, headings, names, `lang`, page title | `briefs/21-semantics.md` | open |
| W2 | Highlight markers and non-colour meaning | `briefs/22-colour-meaning.md` | open |
| W3 | Visual presentation controls (1.4.8) | part of `briefs/01-prefs.md` | open |
| W4 | Motion gated on preference (2.3.3) | part of `briefs/01-prefs.md` | open |
| W5 | Focus visible and not obscured | part of `briefs/02-tokens.md` | open |
| W7 | Help panel, glossary, abbreviations, accessibility statement | `briefs/27-help.md` | open |
| W8 | Confirm and undo for destructive actions | `briefs/28-confirm-undo.md` | open |
| W9 | Status messages wired | part of `briefs/05-announcer.md` | open |
| W11 | Service-worker update prompt (recommended) | `briefs/31-sw-prompt.md` | open |
| D | Docs: matrix, Architecture (both copies), README, CLAUDE.md, contributing | `briefs/40-docs.md` | open |
| X1 | Real-device verification: iOS Safari keyboard and sheet | `briefs/91-device-ios.md` | open — needs a person with a device |
| X2 | Screen-reader pass: VoiceOver, TalkBack, NVDA | `briefs/92-screen-readers.md` | open — needs a person |
| X3 | Windows High Contrast and forced-colors check | `briefs/93-forced-colors.md` | open — needs a person |
| X4 | PNG icons: `apple-touch-icon` and maskable | `briefs/94-icons.md` | open |

## Order of work

Branch `reader/touch-aaa`. "Green" for a commit means `npm run lint && npm test` on Node 24 plus the Playwright specs the commit touched; the full `npm run test:reader` runs at every checkpoint marked **F**. Tests grow with the fixes they need, so no commit lands a failing gate.

- **Phase 0 — scaffolding.** This directory, `AGENTS.md`, the lead agent; then `@axe-core/playwright`, the `reader-touch` project and shared test helpers (**F**); then the briefs.
- **Phase 1 — foundations.** F2 tokens with the contrast test; W5 focus selector and scroll padding; F1 preferences with W3 and W4; F4 viewport; F3 focus utilities; F5 announcer. **F**
- **Phase 2 — semantics and chrome.** W1 in full and the first axe states; T6 and T5 with the targets test; W8 confirm and undo; W7 help. **F**
- **Phase 3 — search, verse actions, editor, dialog.** T3, T2, T8, the native `<dialog>`. **F**
- **Phase 4 — narrow and touch.** T1 sheet, T7 stacked compare, the touch project's axe/targets/reflow/spacing states. **F**
- **Phase 5 — canvas.** Pointer capture and cancellation; pinch; keyboard model and single-pointer controls; edge chip, connections list, undo, heading. **F**
- **Phase 6 — close-out.** W11, the matrix, both architecture documents, README, contributing, CLAUDE.md; full suite; merge to `develop` without squashing.

**Fallback.** Phases 0–3 alone merge as a coherent release: every panel, search, the editor and the dialog fixed, AA met throughout, AAA on everything but the sheet and canvas. Phases 4–5 then exist as briefs the lead hands out. Canvas is never started first.

## Verification

- Per commit: `mise exec node@24 -- npm run lint && npm test` and the touched Playwright specs.
- Per checkpoint: `npm run test:contract && npm run test:reader` (projects `reader`, `reader-dev`, `reader-touch`).
- Gates added by this plan: `tests/unit/{contrast,prefs,geometry}.test.ts`; `tests/reader/{a11y,targets,keyboard,motion,settings}.spec.ts`; `tests/reader-touch/{shell,sheet,search,compare,canvas}.spec.ts`.
- Manual, on a workstation: `npm run dev:reader` in Chromium's device mode at 412 px — write a note with `--vvh` reduced, drag the sheet, use the verse actions, pan and zoom a board, search and jump; eyeball light and dark once.
- Manual, on devices: briefs 91–93.

## Known limitations to state in the accessibility statement

- Scripture text is presented as published; reading level and pronunciation (3.1.5, 3.1.6) are properties of the translations, not of the reader. The help panel explains this.
- User notes are the user's own words; the same exemption applies.
- Board diagrams are drawn as SVG; their text alternative is the "Connections" list and the board's Markdown export, not a description embedded in the picture.
- Behaviour with the iOS software keyboard is verified by hand, not by CI.
