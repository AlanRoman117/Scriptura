import { useRef } from 'react';
import type { LineStyle } from '../lib/mdedit';
import { useRovingTabIndex } from '../lib/focus';

interface EditorToolbarProps {
  onHeading: (level: number) => void;
  onWrap: (marker: string) => void;
  onLineStyle: (style: LineStyle) => void;
  onLink: () => void;
}

/**
 * Formatting for people who do not write Markdown.
 *
 * Always shown above a note being written. It used to ride in and out with
 * focus, which hid it from anyone who had not yet clicked into the note and
 * made it appear and vanish as focus moved; tools that are reliably there are
 * tools people find and trust. Every button *toggles*: a toolbar that can only
 * add syntax strands the reader it exists for, who has no idea how to take it
 * back out.
 *
 * It is what `role="toolbar"` promises (4.1.2): one Tab stop — Shift+Tab from
 * the note lands on it — with the arrow keys, Home and End between tools. It
 * used to be eleven Tab stops that vanished before Tab could reach them.
 *
 * `mousedown` is prevented once, on the bar. For a pointer, pressing a tool
 * must not move focus out of the note, which would hide the selection being
 * formatted and leave the caret behind. The keyboard path does not go through
 * mousedown at all: a tool takes focus, the note keeps its selection range
 * while blurred, and the edit puts focus back in the note.
 */
export function EditorToolbar({ onHeading, onWrap, onLineStyle, onLink }: EditorToolbarProps) {
  const bar = useRef<HTMLDivElement>(null);
  useRovingTabIndex(bar, { orientation: 'horizontal' });

  return (
    <div
      className="tools"
      data-testid="editor-tools"
      role="toolbar"
      aria-label="Formatting"
      aria-controls="notes-surface"
      ref={bar}
      onMouseDown={(e) => e.preventDefault()}
    >
      {[1, 2, 3].map((level) => (
        <button
          key={level}
          type="button"
          className="tools__button"
          data-testid={`tool-h${level}`}
          aria-label={`Heading ${level}`}
          onClick={() => onHeading(level)}
        >
          H{level}
        </button>
      ))}
      <span className="tools__rule" aria-hidden="true" />
      <button type="button" className="tools__button tools__button--bold" data-testid="tool-bold" aria-label="Bold" onClick={() => onWrap('**')}>
        B
      </button>
      <button type="button" className="tools__button tools__button--italic" data-testid="tool-italic" aria-label="Italic" onClick={() => onWrap('*')}>
        I
      </button>
      <button type="button" className="tools__button tools__button--code" data-testid="tool-code" aria-label="Code" onClick={() => onWrap('`')}>
        {'</>'}
      </button>
      <span className="tools__rule" aria-hidden="true" />
      <button type="button" className="tools__button" data-testid="tool-bullet" aria-label="Bulleted list" onClick={() => onLineStyle('bullet')}>
        ••
      </button>
      <button type="button" className="tools__button" data-testid="tool-number" aria-label="Numbered list" onClick={() => onLineStyle('number')}>
        1.
      </button>
      <button type="button" className="tools__button" data-testid="tool-quote" aria-label="Quote" onClick={() => onLineStyle('quote')}>
        ❝
      </button>
      <span className="tools__rule" aria-hidden="true" />
      <button type="button" className="tools__button" data-testid="tool-link" aria-label="Link to a passage" onClick={onLink}>
        [[ ]]
      </button>
    </div>
  );
}
