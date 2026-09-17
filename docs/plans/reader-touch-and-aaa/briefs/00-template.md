# Brief NN — Title

| | |
|---|---|
| **ID** | `NN-slug` |
| **Size** | S (about an hour) · M (half a day) · L (a day) |
| **Depends on** | brief IDs that must be `done` first, or "none" |
| **Status** | open · assigned (who) · in review · done (commit) |
| **Criteria** | the WCAG success criteria this closes or advances, e.g. 2.5.5, 4.1.2 |

## Outcome

One paragraph: what is true when this brief is done, stated as behaviour a test can observe. Name the success criteria.

## Read first

At most six exact paths with line ranges, each with one line on why it matters here. Never "read CLAUDE.md" — quote what matters in the next section.

- `apps/reader/src/…` lines a–b — why

## Rules that bite here

Three to five rules a delegate could plausibly break in this brief, quoted from `CLAUDE.md` or `/AGENTS.md` with their anchor.

> "…" — CLAUDE.md → Architecture → Apps

## Current behaviour

What the code does today, with `file:line` references. Facts, not judgement.

## Required behaviour

Numbered; each item testable.

1. …

## Files you may touch

- `apps/reader/src/…`

## Files you must not touch

Everything not listed above. Call out the tempting ones.

## Tests to add or change

- `tests/reader/….spec.ts` — test names and what each asserts; `data-testid` values that must survive unchanged.

## Acceptance commands

```bash
mise exec node@24 -- npm run lint
mise exec node@24 -- npm test
mise exec node@24 -- npx playwright test --project=reader tests/reader/<spec>.spec.ts
```

## Hand-back format

1. The diff (`git format-patch reader/touch-aaa..brief/NN-slug`) or the branch name.
2. Each acceptance command as run, with the last 20 lines of output.
3. Deviations from this brief, each with a reason.
4. Screenshots, light and dark, for any visual change.
5. New `data-testid` values.

## Reviewer checklist

The checklist in `DELEGATION.md`, plus:

- [ ] anything specific to this brief
