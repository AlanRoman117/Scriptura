/**
 * Several verses, selected to be acted on as one.
 *
 * A reader pressed a verse and its actions opened; pressing another moved
 * them, so a passage went into a note one verse and one reference at a time.
 * Now a press adds a verse to the selection and pressing it again takes it
 * out, and the one row of actions applies to everything selected: a passage
 * is quoted as one block under one reference.
 *
 * The selection is any verses of the open chapter, not only a sequence —
 * "press again to remove" has no meaning in the middle of a range that must
 * stay whole, and John 1:1 and 1:14 are quoted together often enough. What a
 * note needs is the *runs* of adjacent verses: one citation lists them
 * ("John 1:1, 14-16") and each becomes one link, because the reference
 * grammar shared with the API (`parseReference`) has ranges and no lists, and
 * a grammar three consumers share is not widened for one of them.
 *
 * Everything here is arithmetic on verse numbers, free of the DOM and of
 * React, so jest states it exactly.
 */
import type { HighlightColor } from './notes';

export interface VerseSelection {
  /** The selected verses, in the chapter's order. Never empty. */
  verses: number[];
  /**
   * The verse the row of actions hangs under.
   *
   * The first verse pressed, and it stays there while verses are added by
   * pressing their text, so nothing moves under the pointer as a group grows.
   * Adding from a verse *number* — the keyboard's path — brings the row to
   * that verse, since focus goes into the row from there.
   */
  host: number;
}

/**
 * The verses of a chapter, in order. Adjacency is a matter of this list, not
 * of arithmetic: a critical-text translation omits verses (Acts 8:37), and 36
 * and 38 are then neighbours.
 */
export type ChapterOrder = readonly number[];

const inOrder = (verses: Iterable<number>, order: ChapterOrder): number[] => {
  const wanted = new Set(verses);
  return order.filter((n) => wanted.has(n));
};

/**
 * Press a verse: add it, or take it out if it is there.
 *
 * `viaNumber` is a press on the verse's number rather than its text. Returns
 * null when the last verse leaves.
 */
export function toggleVerse(
  selection: VerseSelection | null,
  verse: number,
  order: ChapterOrder,
  viaNumber = false
): VerseSelection | null {
  if (!order.includes(verse)) return selection;
  if (!selection) return { verses: [verse], host: verse };

  if (selection.verses.includes(verse)) {
    const verses = selection.verses.filter((n) => n !== verse);
    if (verses.length === 0) return null;
    if (selection.host !== verse) return { verses, host: selection.host };
    // The row's verse has gone: it moves to the nearest one left, the next
    // below for preference, so it stays about where it was.
    const at = order.indexOf(verse);
    const below = verses.find((n) => order.indexOf(n) > at);
    return { verses, host: below ?? verses[verses.length - 1] };
  }

  return {
    verses: inOrder([...selection.verses, verse], order),
    host: viaNumber ? verse : selection.host,
  };
}

/** Runs of adjacent verses, each as `[first, last]`, in the chapter's order. */
export function toRuns(verses: readonly number[], order: ChapterOrder): [number, number][] {
  const runs: [number, number][] = [];
  let previous = -2;
  for (const verse of inOrder(verses, order)) {
    const at = order.indexOf(verse);
    if (runs.length > 0 && at === previous + 1) runs[runs.length - 1][1] = verse;
    else runs.push([verse, verse]);
    previous = at;
  }
  return runs;
}

/** Whether the selection skips verses: more than one run. */
export const hasGaps = (verses: readonly number[], order: ChapterOrder): boolean => toRuns(verses, order).length > 1;

/**
 * Every verse from the first selected to the last.
 *
 * The way to a long range without a press per verse, and without a drag or a
 * modifier key (2.5.1, 2.5.7): press the first, press the last, press the
 * button that does this. Shift+click is the same act in one step, so there is
 * one meaning for both and no separate anchor to remember.
 */
export function fillSpan(selection: VerseSelection, order: ChapterOrder): VerseSelection {
  const chosen = inOrder(selection.verses, order);
  if (chosen.length === 0) return selection;
  const from = order.indexOf(chosen[0]);
  const to = order.indexOf(chosen[chosen.length - 1]);
  return { verses: order.slice(from, to + 1), host: selection.host };
}

/** Shift+click: the verse joins, and everything between it and the rest. */
export function extendTo(
  selection: VerseSelection | null,
  verse: number,
  order: ChapterOrder,
  viaNumber = false
): VerseSelection | null {
  if (!order.includes(verse)) return selection;
  if (!selection) return { verses: [verse], host: verse };
  return fillSpan(
    { verses: inOrder([...selection.verses, verse], order), host: viaNumber ? verse : selection.host },
    order
  );
}

/**
 * Runs as they are written after a chapter number: "3", "3-5", "1, 14-16".
 *
 * An ASCII hyphen, as the link format and the search box use, so one run
 * copied out of a citation ("John 1:14-16") still parses in the search box.
 * A list of runs does not: the reference grammar has ranges and no lists.
 */
export const formatRuns = (runs: readonly (readonly [number, number])[]): string =>
  runs.map(([first, last]) => (first === last ? `${first}` : `${first}-${last}`)).join(', ');

/** "3-5" for a selection, by way of its runs. */
export const formatVerses = (verses: readonly number[], order: ChapterOrder): string =>
  formatRuns(toRuns(verses, order));

/* ── A colour, on several verses ─────────────────────────────────────────── */

/** Whether every selected verse is in a collection, some are, or none. */
export type SwatchState = 'all' | 'some' | 'none';

/** `colours` is each selected verse's collection, or undefined for an unmarked verse. */
export function swatchState(colours: readonly (HighlightColor | undefined)[], colour: HighlightColor): SwatchState {
  const marked = colours.filter((c) => c === colour).length;
  if (marked === 0) return 'none';
  return marked === colours.length ? 'all' : 'some';
}

/**
 * What a press on a swatch does to a group: marks every verse, unless every
 * one is already in that collection, in which case it clears them.
 *
 * ⚠️ Not a toggle per verse. Toggling each would clear the verses already in
 * the colour while marking the rest, and a press meant to bring a passage
 * into a collection would knock holes in it.
 */
export const groupMarkAction = (
  colours: readonly (HighlightColor | undefined)[],
  colour: HighlightColor
): 'mark' | 'clear' => (swatchState(colours, colour) === 'all' ? 'clear' : 'mark');

/**
 * What a group's colour presses have done and not yet undone, so that the
 * same press again puts every verse back exactly as it was.
 *
 * Marking a group moves a verse already in another collection into the new
 * one, as marking one verse always has. Without this, "press it again"
 * cleared the lot, and a verse that had been in Rose was then in nothing: the
 * second press took off more than the first had put on.
 */
export interface GroupMarks<T extends { color: HighlightColor }> {
  /** The verses, by highlight id. */
  ids: string[];
  /** Each press not yet undone: its colour, and what each verse held before it. */
  steps: { color: HighlightColor; before: (T | undefined)[] }[];
  /** The collection each verse is in now, as the last press left it. */
  after: (HighlightColor | undefined)[];
}

const sameList = <T,>(a: readonly T[], b: readonly T[]): boolean =>
  a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * What a press on a swatch does to these verses, given what the presses
 * before it did:
 *
 * - `undo`: the colour just pressed, pressed again with nothing changed in
 *   between. Every verse goes back to what it held before (`before`).
 * - `mark` or `clear` otherwise, as `groupMarkAction` says.
 *
 * `now` is what each verse holds. The history is trusted only while it
 * describes these verses as they are: a mark changed anywhere else in
 * between — the Marks panel, an assistant's proposal — and there is nothing
 * safe to go back to, so the press starts afresh.
 */
export function planGroupMark<T extends { color: HighlightColor }>(
  ids: readonly string[],
  now: readonly (T | undefined)[],
  colour: HighlightColor,
  history: GroupMarks<T> | null
): { action: 'mark' | 'clear' | 'undo'; before: (T | undefined)[] | null; steps: GroupMarks<T>['steps'] } {
  const colours = now.map((h) => h?.color);
  const steps = history && sameList(history.ids, ids) && sameList(history.after, colours) ? history.steps : [];
  const last = steps[steps.length - 1];
  if (last && last.color === colour) return { action: 'undo', before: last.before, steps: steps.slice(0, -1) };
  return { action: groupMarkAction(colours, colour), before: null, steps: [...steps, { color: colour, before: [...now] }] };
}

/**
 * What a group's colour press did, to be told: how many verses are in the
 * collection now, or how many left it. Null when nothing changed — every
 * write failed.
 */
export function groupMarkNews<T extends { color: HighlightColor }>(
  now: readonly (T | undefined)[],
  final: readonly (T | undefined)[],
  colour: HighlightColor
): { kind: 'marked' | 'cleared'; count: number } | null {
  const isIn = (h: T | undefined) => h?.color === colour;
  const joined = final.filter((h, i) => isIn(h) && !isIn(now[i])).length;
  const left = final.filter((h, i) => !isIn(h) && isIn(now[i])).length;
  if (joined > 0) return { kind: 'marked', count: final.filter(isIn).length };
  return left > 0 ? { kind: 'cleared', count: left } : null;
}
