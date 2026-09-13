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
 * The spec asks for a surface that is collapsed by default with the tools
 * appearing when they are wanted, so this rides in and out with focus rather
 * than sitting permanently above the writing. Every button *toggles*: a
 * toolbar that can only add syntax strands the reader it exists for, who has
 * no idea how to take it back out.
 *
 * It is what `role="toolbar"` promises (4.1.2): one Tab stop — Shift+Tab from
 * the note lands on it — with the arrow keys, Home and End between tools. It
 * used to be eleven Tab stops that vanished before Tab could reach them.
 *
 * `mousedown` is prevented once, on the bar. For a pointer, pressing a tool
 * must not move focus out of the note: that would hide the selection being
 * formatted, and in Safari — which does not focus a button on click — it would
 * blur the note and withdraw the tools before the click arrived. The keyboard
 * path does not go through mousedown at all: a tool takes focus, the note keeps
 * its selection range while blurred, and the edit puts focus back in the note.
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
