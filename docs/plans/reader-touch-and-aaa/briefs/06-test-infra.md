# Brief 06 — Test infrastructure: axe, the touch project, shared helpers

| | |
|---|---|
| **ID** | `06-test-infra` |
| **Size** | S |
| **Depends on** | none |
| **Status** | done (f4ef575) — scaffolds for `targets.spec.ts` and `keyboard.spec.ts` follow in briefs 16 and 02 |
| **Criteria** | enables every other brief's gate |

## Outcome

Three things exist and run in CI: axe-core at AAA tags through `@axe-core/playwright` (pinned 4.13.0), a `reader-touch` Playwright project using Chromium's Pixel 7 descriptor, and shared helpers for contrast arithmetic and axe configuration. The gates the other briefs add (`a11y`, `targets`, `keyboard`, `motion`, `settings`, the touch specs) have somewhere to live.

## Read first

- `playwright.config.ts` (whole) — the projects and the three web servers.
- `jest.config.ts` lines 27–37 — the ignore patterns that keep jest away from Playwright specs.
- `tests/helpers/axe.ts`, `tests/helpers/contrast.ts`, `tests/reader/a11y.spec.ts`, `tests/reader-touch/shell.spec.ts` — what this brief created.
- `.github/workflows/ci.yml` lines 96–126 — the `reader` job; `npm run test:reader` is all it calls.

## Rules that bite here

> "`npm ci` requires `package-lock.json` to be committed and current — that is the most likely way to break this workflow." — CLAUDE.md → CI

> "Regenerate `package-lock.json` on Linux, never on macOS." — CLAUDE.md → Platforms

> "Playwright runs in API mode — the `request` fixture needs no browser, so `npx playwright install` is never run [for the contract job]." — CLAUDE.md → Tests. The touch project must not require a second browser; Pixel 7 is Chromium.

## Required behaviour (what landed)

1. `@axe-core/playwright` `4.13.0`, exact, in root `devDependencies`; lockfile regenerated on Linux.
2. `playwright.config.ts` has a `reader-touch` project: `devices['Pixel 7']`, `testDir: './tests/reader-touch'`, the reader's `baseURL`. `test:reader` runs `reader`, `reader-touch`, `reader-dev`. The `html` reporter fills `playwright-report/` under CI so the artifact upload is no longer empty.
3. `tests/helpers/contrast.ts` (`channels`, `luminance`, `contrastRatio`, thresholds) and `tests/helpers/axe.ts` (`axeFor`, `describeViolations`, `AXE_TAGS`, `RULES_PENDING_SEMANTICS`).
4. `tests/reader/a11y.spec.ts` self-checks that `color-contrast-enhanced` and `identical-links-same-purpose` ran. States are added by the briefs that make them pass.
5. `tests/reader-touch/shell.spec.ts` proves the emulation: narrow layout, `(pointer: coarse)`, `(hover: none)`, a real `.tap()`.
6. `jest.config.ts` ignores `tests/reader-touch/` and `tests/helpers/`.

## Still open in this brief

- `tests/reader/targets.spec.ts` scaffold: the enumerator (`a[href], button, input, select, textarea, summary, [role=button], [role=link], [role=checkbox], [role=separator][tabindex], [tabindex]:not([tabindex="-1"])`, visible via `checkVisibility()`, not in `[inert]`/`[aria-hidden=true]`, measured as `closest('label') ?? el` for checkboxes and radios), the allowlist with one comment per entry, and a per-state runner. Added in brief 16 with the first passing state.
- `tests/reader/keyboard.spec.ts` scaffold: a focus-visible sweep (Tab through the reading state; each focused element's computed `outlineStyle` is not `none` and `outlineWidth` ≥ 2 px). Added in brief 02.

## Acceptance commands

```bash
mise exec node@24 -- npm run lint && mise exec node@24 -- npm test
mise exec node@24 -- npx playwright test --project=reader --project=reader-touch tests/reader-touch/shell.spec.ts tests/reader/a11y.spec.ts tests/reader/chrome.spec.ts
```
