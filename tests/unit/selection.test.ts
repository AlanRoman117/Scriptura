import {
  extendTo,
  fillSpan,
  formatRuns,
  formatVerses,
  groupMarkAction,
  groupMarkNews,
  hasGaps,
  planGroupMark,
  swatchState,
  toRuns,
  toggleVerse,
  type VerseSelection,
  type GroupMarks,
} from '../../apps/reader/src/lib/selection';
import { describeNode, type BoardNode } from '../../apps/reader/src/lib/canvas';
import type { HighlightColor } from '../../apps/reader/src/lib/notes';
import type { Bible } from '@scriptura/core/bible';

/**
 * Selecting several verses: what a press does, and what a group is called.
 *
 * BiblePane only feeds presses to these, so the rules are stated here, where
 * they need no browser.
 */

/** A chapter of 20 verses, and one that omits a verse as a critical text does. */
const CHAPTER = Array.from({ length: 20 }, (_, i) => i + 1);
const ACTS_8 = [...Array.from({ length: 36 }, (_, i) => i + 1), 38, 39, 40];

const pressed = (verses: number[], order = CHAPTER, viaNumber = false): VerseSelection | null =>
  verses.reduce<VerseSelection | null>((sel, v) => toggleVerse(sel, v, order, viaNumber), null);

describe('a press adds a verse; a second press removes it', () => {
  test('the first verse pressed opens the selection and hosts the row', () => {
    expect(toggleVerse(null, 3, CHAPTER)).toEqual({ verses: [3], host: 3 });
  });

  test('verses are kept in the chapter\'s order, whatever order they were pressed in', () => {
    expect(pressed([5, 3, 4])?.verses).toEqual([3, 4, 5]);
    expect(pressed([14, 1])?.verses).toEqual([1, 14]);
  });

  test('pressing a selected verse takes it out, and the last one out closes the selection', () => {
    expect(pressed([3, 4, 3])).toEqual({ verses: [4], host: 4 });
    expect(pressed([3, 3])).toBeNull();
  });

  test('a verse the chapter does not have changes nothing', () => {
    const before = pressed([3]);
    expect(toggleVerse(before, 99, CHAPTER)).toBe(before);
    expect(toggleVerse(null, 99, CHAPTER)).toBeNull();
  });
});

/*
 * The row of actions hangs under the host. It must not move when a verse is
 * added by pressing its text: the page would reflow under the pointer.
 */
describe('where the row hangs', () => {
  test('it stays under the first verse while others are added by their text', () => {
    expect(pressed([3, 5, 9, 1])?.host).toBe(3);
  });

  test('a press on a verse number brings it there: focus goes into the row from that number', () => {
    const sel = toggleVerse(pressed([3]), 7, CHAPTER, true);
    expect(sel).toEqual({ verses: [3, 7], host: 7 });
  });

  test('when its verse is removed it moves to the nearest left, the next below for preference', () => {
    // Host 5 removed: 9 is the next below.
    expect(toggleVerse({ verses: [3, 5, 9], host: 5 }, 5, CHAPTER)).toEqual({ verses: [3, 9], host: 9 });
    // Host 9 removed, nothing below: the last one left above.
    expect(toggleVerse({ verses: [3, 5, 9], host: 9 }, 9, CHAPTER)).toEqual({ verses: [3, 5], host: 5 });
  });

  test('removing some other verse leaves it where it is', () => {
    expect(toggleVerse({ verses: [3, 5, 9], host: 5 }, 9, CHAPTER, true)).toEqual({ verses: [3, 5], host: 5 });
  });
});

describe('runs of adjacent verses', () => {
  test('one verse, one range, and separate verses', () => {
    expect(toRuns([3], CHAPTER)).toEqual([[3, 3]]);
    expect(toRuns([3, 4, 5], CHAPTER)).toEqual([[3, 5]]);
    expect(toRuns([1, 14], CHAPTER)).toEqual([[1, 1], [14, 14]]);
    expect(toRuns([1, 2, 3, 14, 16, 17], CHAPTER)).toEqual([[1, 3], [14, 14], [16, 17]]);
  });

  test('are in the chapter\'s order whatever order they are given in', () => {
    expect(toRuns([17, 1, 16, 2], CHAPTER)).toEqual([[1, 2], [16, 17]]);
  });

  // Acts 8:37 is not in a critical text: 36 and 38 are neighbours there.
  test('adjacency is the chapter\'s, not arithmetic', () => {
    expect(toRuns([35, 36, 38], ACTS_8)).toEqual([[35, 38]]);
    expect(hasGaps([36, 38], ACTS_8)).toBe(false);
    expect(hasGaps([36, 38], Array.from({ length: 40 }, (_, i) => i + 1))).toBe(true);
  });

  test('nothing selected is no runs', () => {
    expect(toRuns([], CHAPTER)).toEqual([]);
    expect(hasGaps([], CHAPTER)).toBe(false);
  });
});

describe('as written after a chapter number', () => {
  test('a verse, a range, a list', () => {
    expect(formatRuns([[3, 3]])).toBe('3');
    expect(formatRuns([[3, 5]])).toBe('3-5');
    expect(formatRuns([[1, 1], [14, 16]])).toBe('1, 14-16');
    expect(formatVerses([16, 1, 14, 15], CHAPTER)).toBe('1, 14-16');
  });

  // The hyphen the link format and the search box use, so a citation pasted
  // into the search box still parses.
  test('with an ASCII hyphen', () => {
    expect(formatRuns([[3, 5]])).not.toMatch(/[–—]/);
  });
});

describe('filling the span', () => {
  test('first to last, with everything between', () => {
    expect(fillSpan({ verses: [3, 9], host: 3 }, CHAPTER)).toEqual({ verses: [3, 4, 5, 6, 7, 8, 9], host: 3 });
  });

  test('over a verse the translation omits', () => {
    expect(fillSpan({ verses: [35, 39], host: 35 }, ACTS_8).verses).toEqual([35, 36, 38, 39]);
  });

  test('a whole range is left as it is', () => {
    const whole = { verses: [3, 4, 5], host: 4 };
    expect(fillSpan(whole, CHAPTER)).toEqual(whole);
  });

  test('Shift+click adds the verse and fills to it, upwards or downwards', () => {
    expect(extendTo({ verses: [5], host: 5 }, 8, CHAPTER)).toEqual({ verses: [5, 6, 7, 8], host: 5 });
    expect(extendTo({ verses: [5], host: 5 }, 2, CHAPTER)).toEqual({ verses: [2, 3, 4, 5], host: 5 });
    // With nothing selected it is an ordinary first press.
    expect(extendTo(null, 8, CHAPTER)).toEqual({ verses: [8], host: 8 });
    // From a number, the row follows.
    expect(extendTo({ verses: [5], host: 5 }, 8, CHAPTER, true)?.host).toBe(8);
  });
});

describe('a colour on several verses', () => {
  test('a swatch says whether all, some or none are in its collection', () => {
    expect(swatchState(['amber', 'amber'], 'amber')).toBe('all');
    expect(swatchState(['amber', undefined, 'rose'], 'amber')).toBe('some');
    expect(swatchState([undefined, 'rose'], 'amber')).toBe('none');
    expect(swatchState(['amber'], 'amber')).toBe('all');
  });

  // A toggle per verse would clear the two already amber while marking the third.
  test('marks them all unless they all are, and only then clears', () => {
    expect(groupMarkAction(['amber', 'amber', undefined], 'amber')).toBe('mark');
    expect(groupMarkAction([undefined, 'rose'], 'amber')).toBe('mark');
    expect(groupMarkAction(['amber', 'amber'], 'amber')).toBe('clear');
  });
});

/*
 * The colour just pressed, pressed again, puts each verse back as it was.
 * Marking moves a verse out of the collection it was in; clearing afterwards
 * left it in none, so the press meant to undo took the older mark with it.
 */
describe('the same colour again undoes the press', () => {
  type Mark = { color: HighlightColor; created: number };
  const IDS = ['john:1:3', 'john:1:4', 'john:1:5'];
  const rose: Mark = { color: 'rose', created: 1 };
  const amber = (created = 9): Mark => ({ color: 'amber', created });
  const colours = (marks: readonly (Mark | undefined)[]) => marks.map((m) => m?.color);
  /** Carry a plan out, as lib/notes.ts does with the store. */
  const press = (
    now: (Mark | undefined)[],
    colour: HighlightColor,
    history: GroupMarks<Mark> | null
  ): { now: (Mark | undefined)[]; history: GroupMarks<Mark>; action: string } => {
    const plan = planGroupMark(IDS, now, colour, history);
    const next =
      plan.before ?? (plan.action === 'clear' ? now.map(() => undefined) : now.map((m) => ({ color: colour, created: m?.created ?? 9 })));
    return { now: next, history: { ids: IDS, steps: plan.steps, after: colours(next) }, action: plan.action };
  };

  test('a first press marks, and the same press again restores what each verse held', () => {
    const start = [rose, undefined, undefined];
    const marked = press(start, 'amber', null);
    expect(marked.action).toBe('mark');
    expect(colours(marked.now)).toEqual(['amber', 'amber', 'amber']);

    const undone = press(marked.now, 'amber', marked.history);
    expect(undone.action).toBe('undo');
    // The very records: verse 3 is in Rose again, with the date it was marked.
    expect(undone.now).toEqual(start);
    // And the press after that marks again: it is a toggle between the two.
    expect(press(undone.now, 'amber', undone.history).action).toBe('mark');
  });

  test('clearing is undone the same way, and gives the marks back whole', () => {
    const start = [amber(1), amber(2), amber(3)];
    const cleared = press(start, 'amber', null);
    expect(cleared.action).toBe('clear');
    const back = press(cleared.now, 'amber', cleared.history);
    expect(back.action).toBe('undo');
    expect(back.now).toEqual(start);
  });

  test('each press again undoes its own, back through another colour', () => {
    const start = [rose, undefined, undefined];
    const a = press(start, 'amber', null);
    const b = press(a.now, 'sky', a.history);
    expect(colours(b.now)).toEqual(['sky', 'sky', 'sky']);
    const c = press(b.now, 'sky', b.history);
    expect(c.action).toBe('undo');
    expect(colours(c.now)).toEqual(['amber', 'amber', 'amber']);
    const d = press(c.now, 'amber', c.history);
    expect(d.action).toBe('undo');
    expect(d.now).toEqual(start);
  });

  test('a mark changed anywhere else in between leaves nothing to go back to', () => {
    const marked = press([rose, undefined, undefined], 'amber', null);
    // The Marks panel took verse 4 out, and something put it back.
    const elsewhere = [marked.now[0], undefined, marked.now[2]];
    expect(planGroupMark(IDS, elsewhere, 'amber', marked.history).action).toBe('mark');
    // Other verses are another group.
    expect(planGroupMark(['john:1:3', 'john:1:4'], marked.now.slice(0, 2), 'amber', marked.history).action).toBe('clear');
    // And with no history, all amber is cleared.
    expect(planGroupMark(IDS, marked.now, 'amber', null).action).toBe('clear');
  });

  test('what is told is how many are in the collection now, or how many left it', () => {
    const none = [undefined, undefined, undefined];
    const all = [amber(), amber(), amber()];
    expect(groupMarkNews([rose, undefined, amber()], all, 'amber')).toEqual({ kind: 'marked', count: 3 });
    expect(groupMarkNews(all, none, 'amber')).toEqual({ kind: 'cleared', count: 3 });
    // An undo that leaves one verse in the collection it was already in.
    expect(groupMarkNews(all, [amber(), undefined, rose], 'amber')).toEqual({ kind: 'cleared', count: 2 });
    // A write that failed for one verse: two are in, and two is what is said.
    expect(groupMarkNews(none, [amber(), amber(), undefined], 'amber')).toEqual({ kind: 'marked', count: 2 });
    // Nothing went through: nothing is said.
    expect(groupMarkNews(none, none, 'amber')).toBeNull();
  });
});

/*
 * A passage on the board is one card holding a range. It holds the anchor,
 * not the text, and is read out of whichever translation is open — which may
 * leave a verse out.
 */
describe('a card that holds a range', () => {
  const bibleWith = (numbers: number[]) =>
    ({
      book: (slug: string) =>
        slug === 'acts'
          ? { name: 'Acts', chapters: [{ number: 8, verses: numbers.map((n) => ({ number: n, text: `verse ${n}` })) }] }
          : undefined,
    }) as unknown as Bible;
  const card = (verse: number, endVerse?: number): BoardNode =>
    ({ id: 'c', kind: 'verse', x: 0, y: 0, book_slug: 'acts', chapter: 8, verse, endVerse }) as BoardNode;
  const notes: never[] = [];

  test('reads as the passage, each verse under its number; one verse is its text alone', () => {
    const bible = bibleWith([35, 36, 37, 38, 39]);
    expect(describeNode(card(36, 38), { bible, notes })).toEqual({
      title: 'Acts 8:36-38',
      body: '36 verse 36\n37 verse 37\n38 verse 38',
    });
    expect(describeNode(card(36), { bible, notes })).toEqual({ title: 'Acts 8:36', body: 'verse 36' });
  });

  // Acts 8:37-38 from a translation that has verse 37, read in one that omits
  // it. Found by where its ends sit, the card said the whole passage was missing.
  test('made in one translation and read in another that omits a verse, it shows what is there', () => {
    const critical = bibleWith([35, 36, 38, 39]);
    expect(describeNode(card(37, 38), { bible: critical, notes }).body).toBe('verse 38');
    expect(describeNode(card(36, 37), { bible: critical, notes }).body).toBe('verse 36');
    expect(describeNode(card(36, 38), { bible: critical, notes }).body).toBe('36 verse 36\n38 verse 38');
    expect(describeNode(card(37), { bible: critical, notes }).body).toBe('Not in this translation.');
  });
});
