# AGENTS.md — ground rules for any agent working in this repository

This file is for automated contributors — Claude, Grok, Antigravity, Codex, or a person pasting a brief into one of them. It is short on purpose. **`CLAUDE.md` is the authority**: it holds the reasoning and the traps that have already cost a bug. Where this file and `CLAUDE.md` differ, `CLAUDE.md` wins.

## What this is

Scriptura is an open-data Bible monorepo: freely-licensed translations in canonical JSON (`data/`), TypeScript packages that load, search, compare, validate and serve them (`packages/`), a REST API (`examples/node-server`), and a local-first reader PWA (`apps/reader`). Apache 2.0; each translation carries its own licence in its `metadata.json`.

## The eight commands

```bash
npm install                 # once
npm run build               # tsc --build (the packages emit ESM)
npm run lint                # also tsc --build — this *is* the type-check
npm test                    # jest, running as ESM
npm run test:contract       # HTTP contract tests (Playwright in API mode, no browser)
npm run test:reader         # the reader PWA in Chromium: projects reader, reader-dev, reader-touch
npm run dev:reader          # reader dev server on :5173
npm run dev:api             # REST API on :3000
```

Node 24 (`.nvmrc`); use `mise exec node@24 -- <command>` if your default differs. Python is `python3`, never `python`.

## Twelve rules

1. **Read `CLAUDE.md` before touching anything**, especially the section for the area you are changing. It overrides this file. *(CLAUDE.md, whole file)*
2. **Never modify `data/`.** The corpus is the product and its licences are verified by hand; `scripts/validate.py` fails the build on forbidden translations. *(CLAUDE.md → Critical Rules → License enforcement)*
3. **Never modify a canon definition** — `packages/validate/src/canon.ts`, `CANON` in `scripts/validate.py`, `CANONICAL_BOOKS` in `scripts/ingest.py`. Three copies, kept in step by `scripts/check-canon-sync.py`. *(Critical Rules → Canon sync)*
4. **No new dependencies, no TypeScript past 5.x, no lockfile regeneration** without the owner's approval. `ts-jest` breaks on TypeScript 7; the lockfile carries platform binaries and is regenerated on Linux only. *(Build & Development Commands)*
5. **In `apps/reader`, import only the pure subpaths** — `@scriptura/core/bible`, `@scriptura/core/types`, `@scriptura/search/matcher`, `@scriptura/compare/chapters`. The package barrels pull `node:fs` into the browser bundle, and `verbatimModuleSyntax` makes a missing `type` keyword a build error. *(Architecture → Apps)*
6. **Do not change response shapes in `packages/api/src/format.ts` or `scripts/build-static-api.mjs`.** They are one contract, enforced by a parity test. *(Architecture → Packages → @scriptura/api)*
7. **Tests select by `data-testid` and wait on content, not presence.** Never remove or rename an existing `data-testid`; new ones are kebab-case `area-noun`. A search surface lags its query by one render — wait for the attribute or text that proves the new state landed. Never assert `John 1` in a jump test; the reader opens there. *(Architecture → Apps)*
8. **Validate a translation `id` at the sink, never in the caller.** Anything that turns input into a path goes through `translationDir()` in `packages/core`. *(Architecture → Packages → @scriptura/core, security invariant)*
9. **Accessibility floor for any reader change**: controls are 44 × 44 CSS px; text is at least 7:1 against its background; every focusable element shows the focus ring (no `outline: none`); every control has an accessible name that contains its visible text; non-English scripture carries `lang`; meaning is never colour alone; animation and smooth scrolling respect reduced motion; Escape and outside-click go through the dismiss stack in `apps/reader/src/lib/focus.ts`, never a new `window.addEventListener('keydown')`. *(docs/plans/reader-touch-and-aaa/README.md)*
10. **Architecture changes go to both `docs/Architecture.md` and `scriptura-architecture-spec.md`.** Anything described but not built is labelled *planned* in its heading. *(Architecture → Docs)*
11. **Comments say why, not what.** Match the voice of the file you are in: the reason a rule exists, the bug it prevents, the number that was measured. *(everywhere in the tree)*
12. **Commits**: imperative subject, explanatory body at about 72 columns, the repository's trailers. Delegates work on `brief/NN-slug`; the lead works on `reader/touch-aaa`; nobody commits to `main` or `develop` directly. *(git log)*

## Definition of green

```bash
mise exec node@24 -- npm run lint && mise exec node@24 -- npm test
mise exec node@24 -- npm run test:contract
mise exec node@24 -- npm run test:reader
```

All three, from a clean checkout. `python3 scripts/validate.py --strict` must also stay at zero warnings, but nothing in a reader brief should touch what it checks.

## How work is handed out

The reader touch/AAA programme lives in `docs/plans/reader-touch-and-aaa/`. A unit of work is a **brief** (`briefs/NN-slug.md`): self-contained, with exact files to read, files you may touch, numbered required behaviour, tests to add, and copy-paste acceptance commands. Take exactly one brief; stay inside its file list; run its acceptance commands; hand back in the format it specifies — diff, command output tails, deviations, screenshots. If a brief is wrong, stop and report the gap rather than designing around it. The protocol and the reviewer's checklist are in `docs/plans/reader-touch-and-aaa/DELEGATION.md`; the lead who assigns and reviews is defined in `.claude/agents/reader-a11y-lead.md`.
