import { useMemo } from 'react';
import type { Bible } from '@scriptura/core/types';
import { CARD_H, CARD_W, describeNode, type Board } from '../lib/canvas';
import type { Note } from '../lib/notes';

interface BoardThumbnailProps {
  board: Board | undefined;
  bible: Bible | null;
  notes: Note[];
  onOpen?: (id: string) => void;
}

/** How wide the drawing is allowed to be before it scales down. */
const WIDTH = 560;
const MAX_HEIGHT = 420;
/**
 * How far it may shrink before it scrolls instead.
 *
 * A genealogy from Adam to Jesus is a wide board, and squeezing one into 560px
 * gives illegible boxes rather than a diagram. Past this the drawing keeps its
 * size and the figure scrolls sideways.
 */
const MIN_SCALE = 0.45;
/** Label metrics, used to fit the title to the box it is drawn in. */
const LABEL_SIZE = 10;
const LABEL_PAD = 6;

/**
 * An embedded board, drawn where it was written.
 *
 * The same role a mermaid fence plays: the note keeps a plain-text reference,
 * and the reader sees the diagram. Deliberately not interactive — this is the
 * note's illustration, and editing belongs on the board itself, one click away.
 */
export function BoardThumbnail({ board, bible, notes, onOpen }: BoardThumbnailProps) {
  const layout = useMemo(() => {
    if (!board || board.nodes.length === 0) return null;

    const left = Math.min(...board.nodes.map((n) => n.x));
    const top = Math.min(...board.nodes.map((n) => n.y));
    const right = Math.max(...board.nodes.map((n) => n.x + (n.w ?? CARD_W)));
    const bottom = Math.max(...board.nodes.map((n) => n.y + (n.h ?? CARD_H)));

    const w = Math.max(right - left, 1);
    const h = Math.max(bottom - top, 1);
    // Scaled to fit rather than cropped: half a board is not a diagram.
    const scale = Math.max(MIN_SCALE, Math.min(1, WIDTH / w, MAX_HEIGHT / h));
    return { left, top, w, h, scale };
  }, [board]);

  if (!board) {
    return (
      <p className="embed embed--missing" data-testid="board-embed-missing">
        A board was embedded here, but it no longer exists.
      </p>
    );
  }

  // Unique per board: two embeds in one note would otherwise share an id, and
  // whichever `defs` lost the race would take the other's arrowheads with it.
  const arrow = `embed-arrow-${board.id}`;

  /**
   * The title, cut to what the box can actually hold.
   *
   * The card shrinks with the board and the label does not, so a fixed
   * character limit spills out of the box at any real scale — which is what
   * "Genesis 1:27" did. Measured against the drawn width instead, with a clip
   * behind it in case the font is wider than the estimate.
   */
  const fit = (title: string, drawnWidth: number): string => {
    const room = Math.max(0, drawnWidth - LABEL_PAD * 2);
    const max = Math.floor(room / (LABEL_SIZE * 0.56));
    if (max <= 1) return '';
    return title.length <= max ? title : `${title.slice(0, max - 1)}…`;
  };

  const centre = (id: string) => {
    const n = board.nodes.find((node) => node.id === id);
    if (!n || !layout) return null;
    return {
      x: (n.x - layout.left + (n.w ?? CARD_W) / 2) * layout.scale,
      y: (n.y - layout.top + (n.h ?? CARD_H) / 2) * layout.scale,
    };
  };

  return (
    <figure className="embed" data-testid={`board-embed-${board.id}`}>
      {layout ? (
        <div className="embed__scroll">
        <svg
          className="embed__canvas"
          viewBox={`0 0 ${layout.w * layout.scale} ${layout.h * layout.scale}`}
          width={layout.w * layout.scale}
          height={layout.h * layout.scale}
          role="img"
          aria-label={`Board: ${board.name}, ${board.nodes.length} cards`}
        >
          <defs>
            <marker id={arrow} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" />
            </marker>
          </defs>
          {board.edges.map((edge) => {
            const a = centre(edge.from);
            const b = centre(edge.to);
            if (!a || !b) return null;
            return <line key={edge.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} markerEnd={`url(#${arrow})`} />;
          })}
          {board.nodes.map((n) => {
            const { title } = describeNode(n, { bible, notes });
            const w = (n.w ?? CARD_W) * layout.scale;
            const h = (n.h ?? CARD_H) * layout.scale;
            const clip = `embed-clip-${board.id}-${n.id}`;
            return (
              <g key={n.id} transform={`translate(${(n.x - layout.left) * layout.scale}, ${(n.y - layout.top) * layout.scale})`}>
                <clipPath id={clip}>
                  <rect width={w} height={h} rx={6} />
                </clipPath>
                <rect width={w} height={h} rx={6} className="embed__card" data-color={n.color} />
                {/* Titles only. At this size the verse text would be a grey
                    smudge, and the shape of the argument is the point. */}
                <text
                  x={LABEL_PAD}
                  y={LABEL_SIZE + LABEL_PAD}
                  className="embed__label"
                  clipPath={`url(#${clip})`}
                >
                  {fit(title, w)}
                </text>
              </g>
            );
          })}
        </svg>
        </div>
      ) : (
        <p className="embed__empty">This board is empty.</p>
      )}

      <figcaption className="embed__caption">
        {board.name || 'Untitled board'}
        {onOpen && (
          <>
            {' · '}
            <button
              type="button"
              className="embed__open"
              data-testid={`board-embed-open-${board.id}`}
              onClick={() => onOpen(board.id)}
            >
              Open board
            </button>
          </>
        )}
      </figcaption>
    </figure>
  );
}
