# Brief 40 — Documentation close-out

| | |
|---|---|
| **ID** | `40-docs` |
| **Size** | M |
| **Depends on** | every code brief it documents (run last, or per phase) |
| **Status** | done (close-out commit) |
| **Criteria** | none directly; records conformance |

## Outcome

Someone arriving at the repository learns from the front door that the reader exists and what it promises; the architecture document (both copies) describes the reader's accessibility and touch architecture; `CLAUDE.md` carries the new traps; contributing explains how to test the reader and what an accessible change must include; the matrix is complete with evidence for every row.

## Read first

- `docs/Architecture.md` §2 (the tree omits `apps/`), §9 (roadmap table); `scriptura-architecture-spec.md` — the same sections, ~6 lines offset.
- `README.md` → Repository structure (omits `apps/`), Project status row for the reader, Roadmap table.
- `CLAUDE.md` → Architecture → Apps (all of it) and Tests (the projects table), plus the test counts at the top and in the Tests section.
- `docs/contributing.md` — silent on the reader and on Playwright.

## Rules that bite here

> "Any architectural change must be written to both." — CLAUDE.md → Docs
> "Keep them labelled planned until the code lands." — CLAUDE.md → Docs
> "All three carry the measured numbers rather than adjectives." — CLAUDE.md → Docs

## Required behaviour

1. Architecture (both copies): §2 tree gains `apps/reader/`, `docs/plans/`, `AGENTS.md`, `.claude/agents/`; a new `### Reader: accessibility and touch` subsection after the search section describing A–G from the plan (prefs, tokens, focus stack, viewport, announcer, tests, delegation) in the document's voice; §9 gains rows for the reader stages and this programme, marked ✅ where done and *planned* where not.
2. `README.md`: the structure tree gains `apps/reader/` with one line; the status row for the reader mentions touch and WCAG 2.2 AAA with a link to the matrix; the roadmap table gains the row.
3. `CLAUDE.md`: Apps section notes for prefs (localStorage + inline script + `system` absent), the dismiss stack (never a window keydown), the announcer (mounted in `main.tsx`), `--control-h` (44 px, no compact mode, inline exemption for the verse number), measured `--bar-h`/`--search-h`, the touch project and CDP touch events, the targets rule and its allowlist, and every ⚠️ trap learned on the way; the Tests table gains `reader-touch`; the test counts at the top and in Tests are updated to the measured numbers.
4. `docs/contributing.md`: a "Testing the reader" subsection (the three projects, `npx playwright install chromium`, how to run one spec) and an "Accessible changes" checklist mirroring AGENTS.md rule 9.
5. The matrix: every row's status and evidence final; 🔧 rows resolved; manual checks left 🧪 with the brief named.

## Acceptance commands

```bash
diff <(sed -n '/## 2. Monorepo layout/,/## 3./p' docs/Architecture.md) <(sed -n '/## 2. Monorepo layout/,/## 3./p' scriptura-architecture-spec.md)   # identical sections
mise exec node@24 -- npm test   # count for the docs
mise exec node@24 -- npx playwright test --list | tail -1   # count for the docs
```
