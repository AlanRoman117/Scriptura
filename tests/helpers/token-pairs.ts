/**
 * The colour pairs the reader draws, measured by tests/unit/contrast.test.ts
 * (and summarised per style in the review gallery). Kept to the pairs that
 * exist: a colour that is never text on a surface is not held to 7:1 on it.
 */

export const HIGHLIGHTS = ['amber', 'rose', 'sky', 'mint', 'violet'];

/** What a palette must choose for itself; everything else may be derived. */
export const PALETTE = ['--ink', '--ink-soft', '--paper', '--paper-raised', '--rule', '--edge', '--accent', '--danger', '--focus'];

/** Text on a surface, as [foreground, background]: 7:1 (1.4.6). */
export const TEXT: [string, string][] = [
  // Text on the three papers.
  ...['--ink', '--ink-soft', '--accent', '--danger', '--rubric', '--heading'].flatMap((fg) =>
    ['--paper', '--paper-raised'].map((bg): [string, string] => [fg, bg])
  ),
  ['--ink', '--paper-sunken'],
  ['--ink-soft', '--paper-sunken'],
  // Ink on every fill: rows under the pointer, pressed and selected controls,
  // count pills, the verse being acted on, the sticky bars, and each tint.
  ...['--hover', '--press', '--accent-tint', '--accent-wash', '--accent-pill', '--selection-wash', '--bar-bg', '--bar-bg-raised'].map(
    (bg): [string, string] => ['--ink', bg]
  ),
  ...HIGHLIGHTS.map((h): [string, string] => ['--ink', `--hl-${h}`]),
  // A quiet control's label, under the pointer or pressed, and on a bar.
  ['--ink-soft', '--hover'],
  ['--ink-soft', '--press'],
  ['--ink-soft', '--bar-bg'],
  // A result's reference on its hovered row; a link in a previewed note.
  ['--accent', '--hover'],
  ['--accent', '--accent-tint'],
  // A verse number on a hovered verse. On the verse being acted on, as on a
  // highlighted one, the number turns to ink.
  ['--rubric', '--hover'],
  // The delete button's words on its fill.
  ['--paper', '--danger'],
];

/** A boundary, ring, rule or glyph against what surrounds it: 3:1 (1.4.11). */
export const NON_TEXT: [string, string][] = [
  // Control boundaries and focus rings on every paper, sunken bars included.
  ...['--edge', '--focus'].flatMap((fg) =>
    ['--paper', '--paper-raised', '--paper-sunken'].map((bg): [string, string] => [fg, bg])
  ),
  // A collection's rule beside a verse, and its colour on a card's edge.
  ...HIGHLIGHTS.flatMap((h) => ['--paper', '--paper-raised'].map((bg): [string, string] => [`--hl-${h}-strong`, bg])),
  // The pane divider is a bar in the rule colour holding a grip, two buttons
  // and, when focused, a ring. --edge is too faint on it in the light theme,
  // so the grip and the buttons' borders there are --ink-soft; hovering or
  // focusing turns the grip --accent.
  ['--ink-soft', '--rule'],
  ['--focus', '--rule'],
  ['--accent', '--rule'],
  // A focused verse number inside the verse being acted on.
  ['--focus', '--selection-wash'],
  // The glyph on each swatch, when Settings asks for one.
  ...HIGHLIGHTS.map((h): [string, string] => ['--sw-glyph', `--sw-${h}`]),
];
