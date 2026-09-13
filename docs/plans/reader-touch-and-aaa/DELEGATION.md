# Delegation protocol

Who does what on the reader touch/AAA programme, and how work moves between them.

## Roles

- **Owner** — the repository owner. Approves anything that changes dependencies, architecture or scope; merges to `develop`; performs or arranges the manual device checks (briefs 91–93).
- **Lead** — Claude Opus, running as the `reader-a11y-lead` subagent (`.claude/agents/reader-a11y-lead.md`). Owns the status table in `README.md`, the matrix and the briefs; picks the next brief; sharpens it; hands it out; reviews what comes back; integrates it.
- **Delegates** — Grok, Antigravity, or any other agent or person given a brief. A delegate executes exactly one brief at a time, on a branch named after it, and returns a patch with the acceptance commands run.

## What is delegated, and what is not

Delegate — mechanical, fully specified, testable work:

- CSS sweeps against an explicit list of selectors (44 px floors, hover variants, token substitutions).
- Adding names, roles, `lang` and `aria-*` from an explicit checklist of components.
- Writing Playwright specs to a stated list of assertions and `data-testid` values.
- Documentation formatting, matrix rows with evidence links, brief boilerplate.
- Generating assets from an existing source (PNG icons from the SVGs).

Never delegate:

- Anything under `data/`, `scripts/ingest.py`, `scripts/validate.py`, `packages/validate/src/canon.ts` — the canon and the licence gate.
- `packages/api/src/format.ts` or `scripts/build-static-api.mjs` — the static/dynamic contract.
- Dependency changes, TypeScript upgrades, `package-lock.json`.
- Architecture: new modules, storage tiers, the dismiss stack, the preference schema, the announcer. The lead builds these and writes them down before any brief depends on them.
- Security-relevant code: `translationDir()` in `packages/core`, the WebMCP tools in `apps/reader/src/lib/webmcp.ts`.
- Anything a brief does not explicitly allow.

## Lifecycle of a brief

1. **Open.** Written by the lead from `README.md` using `briefs/00-template.md`. Every section filled; "Read first" lists exact paths with line ranges; acceptance commands are copy-paste.
2. **Assigned.** The lead records `assigned (grok)` or `assigned (antigravity)` in the status table and gives the delegate three things: the brief, `/AGENTS.md`, and a fresh checkout of `reader/touch-aaa` on branch `brief/NN-slug`. Nothing else — a delegate that needs more context than the brief provides is a sign the brief is not ready.
3. **In progress.** The delegate works only inside "Files you may touch". If the brief is wrong or incomplete, the delegate stops and reports the gap instead of improvising a design.
4. **Returned.** In the format the brief specifies: the diff or branch, each acceptance command with the last 20 lines of its output, deviations from the brief with reasons, screenshots (light and dark) for visual changes, and any new `data-testid` values.
5. **In review.** The lead runs the checklist below on a clean checkout. A failed review goes back naming the failing item, not asking for a rewrite.
6. **Done.** The lead integrates onto `reader/touch-aaa`, runs the checkpoint suite, commits with the repository's trailers plus a `Co-Authored-By` line for the delegate's tool, updates the matrix rows the brief names, and records `done (commit)` in the status table.

## Review checklist

The lead runs every item; none is skipped for a small diff.

- [ ] Acceptance commands pass on Node 24 from a clean checkout, output shown.
- [ ] `git diff --stat` touches only files the brief allows; no new dependencies; `package-lock.json` unchanged.
- [ ] No `data-testid` removed or renamed; new ones are kebab-case `area-noun`.
- [ ] Every new control has an accessible name containing its visible text, a visible focus ring, and a 44 × 44 CSS px box — or is on the allowlist in `tests/reader/targets.spec.ts` with a stated reason.
- [ ] No `outline: none`; no `title` as the sole name; no colour-only meaning; no new `window.addEventListener('keydown')` (the dismiss stack in `apps/reader/src/lib/focus.ts` owns Escape and outside-click); no `setTimeout`-driven removal of UI.
- [ ] Non-English scripture containers carry `lang`.
- [ ] Any new animation or smooth scroll respects reduced motion.
- [ ] Existing tests untouched unless the brief names them; changed assertions are explained in the hand-back.
- [ ] Comments explain why, in the voice of the file; nothing restates the code.
- [ ] The matrix rows the brief names are updated with evidence.

## Hand-out message

> Brief `NN-slug` from `docs/plans/reader-touch-and-aaa/briefs/`. Read `/AGENTS.md` first, then the brief's "Read first" list — nothing else. Work on branch `brief/NN-slug` from `reader/touch-aaa`. Touch only the files the brief allows. Run the acceptance commands before handing back and paste the output tails. If the brief is wrong, stop and say where.

## Commit and merge conventions for this programme

Commits on `reader/touch-aaa` follow the repository's style: an imperative subject (two clauses joined by `;` when that reads better), an explanatory body wrapped at about 72 columns saying what was wrong and why it stayed hidden, an optional `N jest, M Playwright.` line, and the `Co-Authored-By` / `Claude-Session` trailers used throughout the history. `reader/touch-aaa` merges to `develop` without squashing: the commit boundaries are the review record.
