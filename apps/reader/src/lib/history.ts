/**
 * Undo and redo for the live note editor.
 *
 * The live editor redraws the lines it styles, and a browser's own undo stack
 * does not survive its DOM being rewritten underneath it — Ctrl+Z would undo
 * the redraw, or nothing, rather than the typing. So the editor keeps its own
 * history of the text and the selection.
 *
 * It aims to feel like the native one: a run of typing is one step, broken at
 * the start of each new word, and a run of deleting is one step. A paste, a
 * formatting button or a quote from the Bible is always a step of its own, and
 * so is anything that follows moving the caret elsewhere.
 *
 * Kept free of React and the DOM, so jest can test it.
 */

export interface Snapshot {
  text: string;
  start: number;
  end: number;
}

/** What kind of change is being recorded — only typing and deleting coalesce. */
export type ChangeKind = 'type' | 'delete' | 'other';

/** How many steps are kept. Older ones are dropped first. */
export const HISTORY_LIMIT = 200;

const endsWithSpace = (s: string) => /\s$/.test(s);

export class History {
  private done: Snapshot[] = [];
  private undone: Snapshot[] = [];
  /** The state the last recorded change left, and what kind of change it was. */
  private last: { after: Snapshot; kind: ChangeKind; spaced: boolean } | null = null;

  /**
   * Records a change from `before` to `after`. Consecutive typing or deleting
   * at the caret the last change left behind joins the step already open.
   */
  record(before: Snapshot, after: Snapshot, kind: ChangeKind): void {
    if (before.text === after.text) return;
    const last = this.last;
    const inserted = kind === 'type' ? after.text.slice(before.start, after.end) : '';
    const continues =
      last !== null &&
      kind !== 'other' &&
      last.kind === kind &&
      last.after.text === before.text &&
      last.after.start === before.start &&
      last.after.end === before.end &&
      // A new word after a space starts a new step, as native undo does.
      !(kind === 'type' && last.spaced && !endsWithSpace(inserted));

    if (!continues) {
      this.done.push(before);
      if (this.done.length > HISTORY_LIMIT) this.done.shift();
    }
    this.undone = [];
    this.last = { after, kind, spaced: kind === 'type' && endsWithSpace(inserted) };
  }

  /** The state to return to, given the current one, or null at the start. */
  undo(current: Snapshot): Snapshot | null {
    const previous = this.done.pop();
    if (!previous) return null;
    this.undone.push(current);
    this.last = null;
    return previous;
  }

  /** The state to go forward to, or null when nothing was undone. */
  redo(current: Snapshot): Snapshot | null {
    const next = this.undone.pop();
    if (!next) return null;
    this.done.push(current);
    this.last = null;
    return next;
  }

  /** Forget everything — another note has been opened. */
  clear(): void {
    this.done = [];
    this.undone = [];
    this.last = null;
  }

  get canUndo(): boolean {
    return this.done.length > 0;
  }

  get canRedo(): boolean {
    return this.undone.length > 0;
  }
}
