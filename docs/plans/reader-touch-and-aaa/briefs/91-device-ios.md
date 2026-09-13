# Brief 91 — Real-device check: iOS Safari and Android Chrome

| | |
|---|---|
| **ID** | `91-device-ios` |
| **Size** | S per device (an hour with the app deployed or served over the LAN) |
| **Depends on** | `11-sheet`, `13-search`, `14-canvas`, `04-viewport` |
| **Status** | open — needs a person with devices; cannot be automated |
| **Criteria** | 1.4.10, 2.4.11/2.4.12, 2.5.5; the touch promises this programme makes |

## Outcome

The behaviours Playwright cannot emulate are confirmed on hardware, and every deviation is filed as a bug against the brief that owns it.

## How to run the app on a phone

```bash
npm run dev:api &                                   # :3000
npm run dev --workspace @scriptura/reader -- --host  # prints a LAN URL on :5173
```
Open the LAN URL on the phone (same Wi-Fi). For standalone-mode checks, Add to Home Screen first.

## Checklist — iOS Safari (iPhone with a home indicator)

- [ ] Open notes at `half`; tap into the note body. The keyboard opens **and the caret stays visible above it**; typing appears; the toolbar is visible above the text.
- [ ] Drag the sheet grip up and down; it follows the finger and snaps. A quick tap on the grip cycles.
- [ ] In standalone mode the grip is fully above the home indicator; the reading bar is below the status area; in landscape nothing hides under the notch.
- [ ] Search: type `living water`, press the keyboard's Go/Search. The full results view opens; results are tappable.
- [ ] Tap a verse: the action bar appears above the sheet; every button is comfortably tappable; a tap outside closes it. Long-press a word to select text; the action bar does not open.
- [ ] Canvas: one finger pans; two fingers zoom about the fingers; drag a card by its header; the resize corner works; a card's Move/Size popover moves it without dragging.
- [ ] Rotate the phone with the sheet open; nothing is clipped.

## Checklist — Android Chrome (Pixel or similar)

- [ ] Same keyboard test: with the keyboard up the sheet shrinks (the viewport meta asks for it) and the caret is visible.
- [ ] Pinch zoom on the canvas does not zoom the page (the frame has `touch-action: none`).
- [ ] Pull-to-refresh does not trigger while dragging the sheet.
- [ ] TalkBack on: swipe through the reading state; the passage nav, the chapter heading, the verse numbers ("Mark John 1:1"), the sheet grip ("Expand notes") are announced in order.

## Hand-back

A table of checks × devices with pass/fail and screenshots of failures; one issue per failure naming the brief. Update the matrix's manual-check rows.
