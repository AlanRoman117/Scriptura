# Brief 92 — Screen-reader pass: VoiceOver, TalkBack, NVDA

| | |
|---|---|
| **ID** | `92-screen-readers` |
| **Size** | M (two to three hours across three readers) |
| **Depends on** | `21-semantics`, `03-focus`, `05-announcer`, `12-verse-actions`, `14-canvas` |
| **Status** | open — needs a person; cannot be automated |
| **Criteria** | 1.3.1, 2.4.3, 4.1.2, 4.1.3 — as experienced, not as computed |

## Outcome

Every state of the reader has been walked with a screen reader, and what is announced matches what the matrix claims.

## Script (repeat per reader: NVDA + Firefox or Chrome on Windows; VoiceOver + Safari on macOS and iOS; TalkBack + Chrome on Android)

1. **Load.** The title is announced as `John 1 · BSB · Scriptura`. The first Tab reaches "Skip to scripture".
2. **Landmarks.** Landmark navigation lists: navigation "Passage", main, complementary "Notes" (or region "Notes" on a phone).
3. **Headings.** Heading navigation lists exactly one level-1 heading: "John 1". Open Marks: the level-1 heading is "Marks"; each colour group is a level-2 heading with its label.
4. **Verse actions.** Focus verse 1's number: announced as "Mark John 1:1, button, collapsed". Enter: focus lands on "Mark as Amber (amber), toggle button, not pressed"; Right arrow moves through the collection swatches; Escape returns to "Mark John 1:1".
5. **Search.** Type `Tito` in the search box: within a second the reader announces "17 matches for Tito" (or the current count). Down arrow moves into the suggestions; each suggestion is announced with reference and text; Escape returns to the box.
6. **Library.** Download KJV: progress is announced at 25 %, 50 %, 75 % and "KJV downloaded". Read it: "Reading King James Version" is announced; the title changes.
7. **Language.** Read RV1909: the verses are read in a Spanish voice (Spanish synthesizer engaged automatically).
8. **Notes.** New note; type; "Saved" is announced once after a pause, not on every keystroke. Shift+Tab reaches the formatting toolbar, announced as a toolbar; arrows move between tools with names ("Bold", "Heading 2").
9. **Delete.** Delete: announced "Press again to confirm, or Escape to cancel"; Escape: the button reads "Delete" again.
10. **Proposal (Chromium with the mock, or via Settings → assistant test hook if one exists).** The dialog announces its title and the "nothing has been saved" lede first; Tab stays inside; Escape returns focus to where it was.
11. **Canvas.** Open Boards: level-1 heading "Board: …"; Tab reaches a card announced by its label; arrows move it (announce the card's new position if the reader supports it); the Connections list reads each connection and its Remove button.

## Hand-back

Per reader, per step: pass, or the exact announcement heard and what was expected. File one issue per failure against the brief that owns the surface. Update the matrix rows 1.3.1, 2.4.3, 4.1.2, 4.1.3 with "verified with X" notes.
