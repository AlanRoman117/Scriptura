/**
 * What the app needs of the note editor, whichever one is showing.
 *
 * The note can be written in the live editor or in a plain textarea (Settings
 * → Note editor), and the toolbar, quoting from the Bible and the effects
 * that put the caret back all talk to it through this: the small part of a
 * textarea they ever used, plus whether it has focus.
 */
export interface NoteSurface {
  readonly value: string;
  readonly selectionStart: number;
  readonly selectionEnd: number;
  setSelectionRange(start: number, end: number): void;
  focus(): void;
  /** Whether the reader is writing in it right now. */
  isFocused(): boolean;
  /** The element itself, for focus handling and tests. */
  element(): HTMLElement | null;
}

/** A textarea, as a `NoteSurface`. */
export function textareaSurface(el: HTMLTextAreaElement): NoteSurface {
  return {
    get value() {
      return el.value;
    },
    get selectionStart() {
      return el.selectionStart;
    },
    get selectionEnd() {
      return el.selectionEnd;
    },
    setSelectionRange: (start, end) => el.setSelectionRange(start, end),
    focus: () => el.focus(),
    isFocused: () => document.activeElement === el,
    element: () => el,
  };
}
