# Brief 31 — Service-worker updates on request, not by surprise

| | |
|---|---|
| **ID** | `31-sw-prompt` |
| **Size** | S |
| **Depends on** | `05-announcer`, `28-confirm-undo` (optional) |
| **Status** | done (cb88aa0) |
| **Criteria** | 2.2.4 Interruptions, 3.2.5 Change on Request (already met; this hardens it), data durability |

## Outcome

When a new build is available, the reader is told and chooses when to reload. The pending autosave is flushed first, so a reload never loses the last 600 ms of typing.

## Read first

- `apps/reader/vite.config.ts` lines 37–62 — `registerType: 'autoUpdate'`, `devOptions`.
- `apps/reader/dist/registerSW.js` (after a build) — today it only calls `register()`; `sw.js` does `skipWaiting()` + `clientsClaim()`, so the new worker takes the page mid-edit.
- `apps/reader/src/App.tsx` lines 77–78 and 324–351 — `AUTOSAVE_MS` and the debounced save that a reload could cut off.
- `tests/reader/offline.spec.ts` — the offline promise that must stay green.

## Required behaviour

1. `registerType: 'prompt'`; use `virtual:pwa-register/react`'s `useRegisterSW` in a small `UpdateNotice` component: when `needRefresh`, show a non-modal notice (`data-testid="update-notice"`, `role="status"`) with "A new version is ready" and two 44 px buttons: "Reload" and "Later". "Later" hides it until the next visit; "Reload" flushes the pending note save (`saveTimer` → immediate `saveNote`) then calls `updateServiceWorker(true)`.
2. The notice is announced once (polite) and never re-appears in the same session after "Later".
3. `offline.spec.ts` unchanged and green; ~~a new test in it: with a stubbed `needRefresh`, the notice appears and "Later" dismisses it.~~ *As built:* the update is real, not stubbed. Playwright's routing never sees the browser's check for a newer worker, and changing the built `sw.js` on the shared preview server would hand every parallel test an update, so the suite serves `apps/reader/dist` from its own server on its own origin and changes only what that server says `sw.js` is. That test found a real bug: the plugin reloads only when a worker controlled the page when the app registered, so on a first visit Reload switched workers and did nothing; `UpdateNotice` now reloads on `controllerchange` itself.
4. Found while wiring the flush: the autosave debounce was one timer for all notes, so an edit in a second note within 600ms cancelled the first note's pending save. Pending saves are now kept per note, flushed together by the timer, by Reload, and when the page is hidden.

## Files you may touch

- `apps/reader/vite.config.ts`, `apps/reader/src/components/UpdateNotice.tsx` (new), `apps/reader/src/App.tsx`, `apps/reader/src/styles.css`, `apps/reader/src/vite-env.d.ts` (type reference for the virtual module).
- `tests/reader/offline.spec.ts`.

## Acceptance commands

```bash
mise exec node@24 -- npm run lint
mise exec node@24 -- npx playwright test --project=reader tests/reader/offline.spec.ts tests/reader/notes.spec.ts
```
