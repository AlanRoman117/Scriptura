import type { Bible } from '@scriptura/core/types';
import type { Block, Inline } from '../lib/markdown';
import { parseMarkdown } from '../lib/markdown';
import type { Board } from '../lib/canvas';
import type { Note } from '../lib/notes';
import { BoardThumbnail } from './BoardThumbnail';

interface MarkdownPreviewProps {
  source: string;
  bible: Bible | null;
  notes: Note[];
  boards: Board[];
  /** Put the caret back here in the editor — the click that returns to writing. */
  onEditAt: (offset: number) => void;
  onFollowLink: (target: string) => void;
  onOpenBoard: (id: string) => void;
  /** How a `[[…]]` link reads to a person, for the link's accessible name (2.4.9). */
  describeLink?: (inner: string) => string | null;
}

/**
 * Note headings sit two levels down: the chapter title is the page's h1 and
 * the notes pane is an h2, so a note's `#` is an h3 (2.4.10). The original
 * level is kept in `data-level` for the styling, which is the author's.
 */
const HEADING_OFFSET = 2;

/**
 * The note, rendered.
 *
 * Built from the parsed tree, never from an HTML string — a note is arbitrary
 * text and may have been drafted by an assistant, so nothing here reaches
 * `innerHTML` and there is no markup for it to inject.
 *
 * Clicking any block returns to the editor with the caret in that block, which
 * is what makes a single-pane preview usable: reading and fixing are the same
 * gesture rather than a mode you have to leave first.
 */
export function MarkdownPreview({
  source,
  bible,
  notes,
  boards,
  onEditAt,
  onFollowLink,
  onOpenBoard,
  describeLink,
}: MarkdownPreviewProps) {
  const blocks = parseMarkdown(source);

  if (blocks.length === 0) {
    return (
      <div className="preview preview--empty" data-testid="notes-preview" onClick={() => onEditAt(0)}>
        Nothing written yet.
      </div>
    );
  }

  return (
    <div className="preview" data-testid="notes-preview">
      {blocks.map((block, i) => (
        <div
          key={i}
          className="preview__block"
          onClick={(e) => {
            // A link or a board button handles its own click.
            if ((e.target as HTMLElement).closest('button')) return;
            onEditAt(block.offset);
          }}
        >
          {renderBlock(block, { bible, notes, boards, onFollowLink, onOpenBoard, describeLink })}
        </div>
      ))}
    </div>
  );
}

interface Ctx {
  bible: Bible | null;
  notes: Note[];
  boards: Board[];
  onFollowLink: (target: string) => void;
  onOpenBoard: (id: string) => void;
  describeLink?: (inner: string) => string | null;
}

function renderBlock(block: Block, ctx: Ctx) {
  switch (block.type) {
    case 'heading': {
      const Tag = `h${Math.min(6, block.level + HEADING_OFFSET)}` as 'h1';
      return (
        <Tag className="preview__heading" data-level={block.level}>
          {renderInline(block.children, ctx)}
        </Tag>
      );
    }
    case 'paragraph':
      return <p className="preview__p">{renderInline(block.children, ctx)}</p>;
    case 'quote':
      return <blockquote className="preview__quote">{renderInline(block.children, ctx)}</blockquote>;
    case 'list':
      return block.ordered ? (
        <ol className="preview__list">
          {block.items.map((item, i) => (
            <li key={i}>{renderInline(item, ctx)}</li>
          ))}
        </ol>
      ) : (
        <ul className="preview__list">
          {block.items.map((item, i) => (
            <li key={i}>{renderInline(item, ctx)}</li>
          ))}
        </ul>
      );
    case 'code':
      return (
        <pre className="preview__code">
          <code>{block.value}</code>
        </pre>
      );
    case 'rule':
      return <hr className="preview__rule" />;
    case 'board':
      return (
        <BoardThumbnail
          board={ctx.boards.find((b) => b.id === block.id)}
          bible={ctx.bible}
          notes={ctx.notes}
          onOpen={ctx.onOpenBoard}
        />
      );
  }
}

function renderInline(nodes: Inline[], ctx: Ctx) {
  return nodes.map((node, i) => {
    switch (node.type) {
      case 'text':
        return <span key={i}>{node.value}</span>;
      case 'strong':
        return <strong key={i}>{renderInline(node.children, ctx)}</strong>;
      case 'em':
        return <em key={i}>{renderInline(node.children, ctx)}</em>;
      case 'code':
        return (
          <code key={i} className="preview__inline-code">
            {node.value}
          </code>
        );
      case 'wikilink':
        return (
          <button
            key={i}
            type="button"
            className="preview__link"
            data-testid={`preview-link-${node.target.replace(/[^a-z0-9]+/gi, '-')}`}
            // "Go to Psalms 23:1 (KJV)" rather than the raw target (2.4.9).
            aria-label={ctx.describeLink?.(node.target) ? `Go to ${ctx.describeLink(node.target)}` : undefined}
            onClick={() => ctx.onFollowLink(node.target)}
          >
            {node.target}
          </button>
        );
    }
  });
}
