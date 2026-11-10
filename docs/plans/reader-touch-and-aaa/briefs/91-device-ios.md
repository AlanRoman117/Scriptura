# Brief 91 — Real-device check: iOS Safari and Android Chrome

| | |
|---|---|
| **ID** | `91-device-ios` |
| **Size** | S per device (an hour with the app deployed or served over the LAN) |
| **Depends on** | `11-sheet`, `13-search`, `14-canvas`, `04-viewport` |
| **Status** | assigned (owner) |
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
- [ ] The docked action bar is `position: fixed` inside `.reader`, a size container (`container-type: inline-size`). Chromium 153 keeps it viewport-relative; confirm Safari does too (an engine that applies layout containment to size containers would pin the bar inside the reading column instead).
- [ ] Canvas: one finger pans; two fingers zoom about the fingers; drag a card by its header; the resize corner works; a card's Move/Size popover moves it without dragging.
- [ ] Rotate the phone with the sheet open; nothing is clipped.
- [ ] **Several verses** (`lib/selection.ts`). Tap three verses: each shows an outline and a filled number, and the one docked bar says "3 verses · John 1:…". Tap one again to take it out. With two apart selected, the bar's **Select** button takes in everything between. Quote: the grip says "✓ Quoted John 1:2-4" and the note has one block with one reference.
- [ ] Scrolling the chapter with a finger does not lose a group; a tap outside a verse still closes a single one. With a group selected, open the notes to full height: the bar is out of sight, not showing its last buttons over the top of the sheet, and it is back when the sheet folds.
- [ ] **VoiceOver:** each verse number is read as "Select John 1:2, button", selected or not; double-tap adds it and the bar's name says what it now holds. Say whether "selected" is spoken for a pressed number, whether the group's summary is read when the selection changes by touch, and what is said for a swatch whose collection holds only some of the selected verses (`aria-pressed="mixed"`: NVDA and JAWS say "partially pressed"; VoiceOver and TalkBack are not known).
- [ ] **Menus that recede** (`lib/recede.ts`; ideally on an iPhone SE, upright and on its side). Reading a chapter, the bar and the search box slide away as you scroll on and return when you scroll back a little. Momentum scrolling does not make them flicker, and the bounce at the end of a chapter does not bring them back by itself. The button at the end of the chapter title shows and hides them.
- [ ] The same in a long note, with the sheet full: the picker row and the Notes/Canvas tabs go as you scroll on, and **the line under your finger does not jump** when they go or come back.
- [ ] **A note read, then typed into** (fixed after preview.17, where it went wrong more often than not). In a long note under a heading, with the sheet full and no keyboard, scroll on until the picker row and the tabs go (the button beside the title shows a down chevron). Then tap into the note and type. With the keyboard up, the note's box starts below the tools (the line naming the heading you are under is put aside while the keyboard is up), ends inside the sheet, and "Saved" sits under the box, not inside it. Try it again after hiding the menus with the button instead of a scroll, and once in Plain text (Settings → Note editor). Then scroll the note back to the top: the menus return and nothing jumps.
- [ ] **More room to type, above the keyboard** (after preview.17, where the note had about 88px). Upright, in a note with a heading and a title, tap into the note so the keyboard comes up. On the title row, beside the menus button (a chevron), is a second button showing "Aa". Tap it: the formatting tools go, the note grows into their row, and the keyboard stays up with the caret where it was. Say whether "Aa" reads as "formatting" and is never mistaken for the menus button. Tap into the title and back, and dismiss the keyboard and bring it back: the tools stay folded until "Aa" is tapped again; with the keyboard down (a tall sheet) they always show and "Aa" is not there. Reload: the choice is kept. While you type in the note, the title is smaller and the gap above it is gone; a long title still shows every word, over two or three lines. Tap into the title: it is back to full size while you edit it. The thin line under the tools naming the heading you are under is not there while the keyboard is up, and is back with the keyboard down. With the tools folded, the note should be about twice the height it was in preview.17 (88px then; Chromium at this size goes from 114 to 214, so expect roughly 180). With VoiceOver, the button is read as "Hide the formatting tools, button, expanded" and then "Show the formatting tools, button, collapsed".
- [ ] On a board: panning, dragging a card or pinching sends the bar and the tabs away, and the card stays under the finger. The zoom buttons stay beside the board's name.
- [ ] A tap straight after a pan on the board: Chromium swallows a tap that lands while the drag before it is still flinging. Note whether Safari does.
- [ ] **VoiceOver with the menus receded.** Swipe back to the reading bar's controls, to a note's picker and to the Notes/Canvas tabs: each is announced and double-tap activates it, though it is not drawn (they are unpinned or clipped, never removed). Say what VoiceOver's cursor shows for a clipped control.
- [ ] In Safari, not installed: the page itself never scrolls (only the pane does), so Safari's own toolbars never shrink. Note how much of the screen scripture has there, upright and on its side, against the installed app.
- [ ] Delete a note, and remove a card on a board: the confirmation sits in the middle of the visible screen, both buttons are comfortably tappable, a tap outside the box cancels, and nothing behind it responds while it is open.

## Checklist — Android Chrome (Pixel or similar)

- [ ] Same keyboard test: with the keyboard up the sheet shrinks (the viewport meta asks for it) and the caret is visible.
- [ ] Pinch zoom on the canvas does not zoom the page (the frame has `touch-action: none`).
- [ ] Pull-to-refresh does not trigger while dragging the sheet.
- [ ] TalkBack on: swipe through the reading state; the passage nav, the chapter heading, the verse numbers ("Mark John 1:1"), the sheet grip ("Expand notes") are announced in order.

## Hand-back

A table of checks × devices with pass/fail and screenshots of failures; one issue per failure naming the brief. Update the matrix's manual-check rows.
