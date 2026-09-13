# Contributing to Scriptura

Thank you for your interest in contributing! This guide covers how to add translations, improve packages, and submit changes.

## Adding a new translation

This is the most impactful way to contribute. Every translation must meet these requirements:

1. **Verified license** — The translation must be public domain, CC BY-SA 4.0, CC0, or another explicitly open license. No exceptions.
2. **Primary source link** — Your PR must include a link to the authoritative source confirming the license status.
3. **Canonical format** — Data must follow the schema in `data/schemas/` (see below).
4. **Validation passes** — Run `python3 scripts/validate.py` and ensure zero errors before submitting.

### Translation data format

```
data/{translation-id}/
├── metadata.json       # See data/schemas/metadata.schema.json
└── books/
    ├── 01-genesis.json # See data/schemas/book.schema.json
    ├── 02-exodus.json
    └── ...             # All 66 books, zero-padded
```

### Forbidden translations

These will **never** be accepted, regardless of how they are packaged:

- **Reina Valera 1960 (RV1960)** — Copyrighted by Sociedades Bíblicas Unidas, renewed 1988
- **口語訳聖書 / Kougo (1954/55)** — US copyright until 2049–2050 (URAA restoration). Japan Bible Society now calls its copyright expired, which is true in Japan and irrelevant in the US — see [`translations-status.md`](translations-status.md#the-kougo-trap) before arguing otherwise. Scanned collections often bundle Kougo with the permissible 文語訳; that does not make the bundle usable.

## Improving TypeScript packages

- All code under `packages/` must maintain strict TypeScript (no implicit `any`)
- Run `npm run lint` to type-check before submitting (that is `tsc --build`; plain `tsc --noEmit` fails with TS6310 because the packages are composite project references)
- Add tests in `tests/unit/` or `tests/integration/` as appropriate
- Run `npm test` to confirm all tests pass

## Changing the reader (`apps/reader`)

The reader is tested in a real browser, not only by jest.

```bash
npx playwright install chromium          # once
npm run test:reader                      # desktop, emulated phone, and dev server projects
npx playwright test --project=reader tests/reader/notes.spec.ts   # one spec
npx playwright test --project=reader-touch                         # just the phone
```

`reader` is Desktop Chrome against a production build; `reader-touch` is the same build under Chromium's Pixel 7 emulation, with touch events and no hover; `reader-dev` checks the dev server boots. Select elements by `data-testid`, never rename an existing one, and wait for the content that proves a change landed rather than for an element to be visible — see *Architecture → Apps* in `CLAUDE.md` for why.

### Accessible changes

The reader is held to WCAG 2.2 Level AAA for its interface. The record is [`docs/plans/reader-touch-and-aaa/wcag-2.2-aaa-matrix.md`](plans/reader-touch-and-aaa/wcag-2.2-aaa-matrix.md); a PR that changes what a row says updates that row. Before opening one:

- [ ] Every new control is at least 44 × 44 CSS px (`min-height`/`min-width: var(--control-h)`) — `tests/reader/targets.spec.ts` measures it.
- [ ] Its accessible name contains its visible text; a glyph-only button has an `aria-label`; `title` is never the only name.
- [ ] It shows the focus ring — no `outline: none` anywhere (a test forbids it).
- [ ] Text uses the colour tokens; a new colour pair is added to `tests/unit/contrast.test.ts` and clears 7:1 (3:1 for boundaries).
- [ ] Nothing is conveyed by colour alone, and nothing appears only on hover.
- [ ] It works from the keyboard, and anything dragged can also be done with a single press.
- [ ] Escape and outside presses go through `useDismissable` in `src/lib/focus.ts`; focus returns to where it was when a surface closes.
- [ ] Scripture in another language carries `lang`.
- [ ] Animation and smooth scrolling stop under reduced motion.
- [ ] Changes that happen without moving focus are announced with `announce()`.
- [ ] `npm run test:reader` passes, including the axe states in `tests/reader/a11y.spec.ts` and `tests/reader-touch/gates.spec.ts`.

## Submitting a PR

1. Fork the repo and create a feature branch
2. Make your changes (Node 24 — see `.nvmrc`)
3. Run `npm run lint`, `npm test`, and `python3 scripts/validate.py --strict` — and `npm run test:reader` if you touched the reader
4. Open a PR with a clear description of what you changed and why

> CI runs all three on every PR. `validate.py --strict` is stricter than CI
> (which tolerates warnings) — the data currently passes it with zero errors and
> zero warnings, so keep it that way.
