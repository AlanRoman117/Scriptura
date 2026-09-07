import type { LineStyle } from '../lib/mdedit';

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
 * `onMouseDown` is prevented on every control — a button that steals focus
 * collapses the selection it was about to format.
 */
export function EditorToolbar({ onHeading, onWrap, onLineStyle, onLink }: EditorToolbarProps) {
  const hold = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div className="tools" data-testid="editor-tools" role="toolbar" aria-label="Formatting">
      {[1, 2, 3].map((level) => (
        <button
          key={level}
          type="button"
          className="tools__button"
          data-testid={`tool-h${level}`}
          title={`Heading ${level}`}
          aria-label={`Heading ${level}`}
          onMouseDown={hold}
          onClick={() => onHeading(level)}
        >
          H{level}
        </button>
      ))}
      <span className="tools__rule" aria-hidden="true" />
      <button type="button" className="tools__button tools__button--bold" data-testid="tool-bold" title="Bold" aria-label="Bold" onMouseDown={hold} onClick={() => onWrap('**')}>
        B
      </button>
      <button type="button" className="tools__button tools__button--italic" data-testid="tool-italic" title="Italic" aria-label="Italic" onMouseDown={hold} onClick={() => onWrap('*')}>
        I
      </button>
      <button type="button" className="tools__button tools__button--code" data-testid="tool-code" title="Code" aria-label="Code" onMouseDown={hold} onClick={() => onWrap('`')}>
        {'</>'}
      </button>
      <span className="tools__rule" aria-hidden="true" />
      <button type="button" className="tools__button" data-testid="tool-bullet" title="Bulleted list" aria-label="Bulleted list" onMouseDown={hold} onClick={() => onLineStyle('bullet')}>
        ••
      </button>
      <button type="button" className="tools__button" data-testid="tool-number" title="Numbered list" aria-label="Numbered list" onMouseDown={hold} onClick={() => onLineStyle('number')}>
        1.
      </button>
      <button type="button" className="tools__button" data-testid="tool-quote" title="Quote" aria-label="Quote" onMouseDown={hold} onClick={() => onLineStyle('quote')}>
        ❝
      </button>
      <span className="tools__rule" aria-hidden="true" />
      <button type="button" className="tools__button" data-testid="tool-link" title="Link to a passage" aria-label="Link to a passage" onMouseDown={hold} onClick={onLink}>
        [[ ]]
      </button>
    </div>
  );
}
