import { useMemo, useSyncExternalStore } from 'react';
import type { Bible } from '@scriptura/core/types';
import { BoundedCache } from '../lib/bounded-cache';
import { cardSize, describeNode, type Board } from '../lib/canvas';
import type { Note } from '../lib/notes';
import { useI18n } from '../i18n';

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
 * Measure a label the way it will actually be drawn.
 *
 * A character-count estimate is not portable — the same system font stack
 * resolves to different faces on different machines, and a factor tuned on one
 * of them overflowed by 2px on CI. Canvas `measureText` is close, but it and
 * SVG disagree by about a pixel on the same string, which is another margin to
 * guess at. So the measurement is taken from an offscreen `<text>` carrying the
 * very class the real labels use: same engine, same font, same metrics, nothing
 * left to estimate.
 */
let ruler: SVGTextElement | null | undefined;

function getRuler(): SVGTextElement | null {
  if (ruler === undefined) {
    if (typeof document === 'undefined') {
      ruler = null;
    } else {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden');
      ruler = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      ruler.setAttribute('class', 'embed__label');
      svg.appendChild(ruler);
      document.body.appendChild(svg);
      watchFont();
    }
  }
  return ruler;
}

/**
 * Widths already measured, by string, under one font.
 *
 * Each measurement forces a layout of the page, and a thumbnail fitted every
 * label on every render, hidden or not: 12,062 forced layouts in a 60-move drag
 * on a 500-card board with a 200-card embed in a hidden note, and 17ms of layout
 * per keystroke beside one. Remembering them took those to 62 and 1ms. That is
 * also why a hidden thumbnail is drawn as usual and not skipped: it costs lookups
 * now, and nothing has to notice it being revealed. Only the string's width is
 * kept. The room in the box is compared afresh by `fit`, so a board that rescales
 * cannot read a stale answer.
 *
 * Bounded because a note's title is a new string on each keystroke and the tab
 * can stay open for weeks. Held at 100,000 strings, about 10MB at worst, because
 * a card's title is remembered at every length tried while cutting it: 48 each
 * for a long title, so 500 such cards need 24,000 at once, and a limit below what
 * one drawing needs would miss on every string and cost what this is here to save.
 */
const widths = new BoundedCache<number>(100_000);

/**
 * Everything on the ruler that can move a glyph. Text size, line spacing and the
 * style's reading face do not reach a label today (`.embed__label` is 10px of
 * `--sans`), and are here anyway: a card clipped by a stale width is worse than
 * measuring again after a rare change in Settings, and this way a later change
 * to that rule cannot go stale either.
 */
const FONT_PROPERTIES = [
  'font-family', 'font-size', 'font-style', 'font-weight', 'font-stretch', 'font-variant',
  'font-kerning', 'font-feature-settings', 'font-variation-settings', 'font-size-adjust',
  'font-synthesis', 'font-optical-sizing', 'letter-spacing', 'word-spacing', 'text-transform',
  'text-rendering', '--sans', '--serif', '--text-scale', '--reading-leading',
];

/**
 * The font the widths in `widths` belong to.
 *
 * Read from the ruler's computed style, not from the preferences, so a rule this
 * file has never heard of counts too: a reader's text-spacing override (1.4.12)
 * sets `letter-spacing` with `*`. A style read and no layout. `lang` is the root's
 * because it picks the stack (`:lang(ja)`) and the glyphs of a shared character,
 * and is not itself a computed property. The pixel ratio is here because browser
 * zoom can round a glyph's advance differently.
 */
function fontKey(el: SVGTextElement): string {
  const style = getComputedStyle(el);
  const root = document.documentElement;
  return [
    ...FONT_PROPERTIES.map((name) => style.getPropertyValue(name)),
    root.lang,
    root.getAttribute('data-style'),
    window.devicePixelRatio,
  ].join('|');
}

let measuredUnder: string | undefined;
/** Moves when what was measured no longer holds, so a thumbnail draws again. */
let fontVersion = 0;
const fontListeners = new Set<() => void>();

function forgetWidths(): void {
  widths.clear();
  fontVersion += 1;
  // Not told directly: this can run while a thumbnail renders.
  queueMicrotask(() => {
    for (const listener of fontListeners) listener();
  });
}

/**
 * Compare the font with the one measured under. Called on every render, which
 * keeps the guarantee the uncached code had: whatever the page looks like when a
 * thumbnail draws is what it measures. Moves nothing unless the font did, so a
 * keystroke leaves nothing queued (the fast-typing rule, CLAUDE.md).
 */
function checkFont(): void {
  const el = getRuler();
  if (!el) return;
  const key = fontKey(el);
  if (key === measuredUnder) return;
  measuredUnder = key;
  forgetWidths();
}

/**
 * Draw again when the font changes with nothing else to cause a render. Lives as
 * long as the ruler. `loadingdone` is a signal of its own because a late face
 * changes every width and no computed value: the family is the same words.
 */
function watchFont(): void {
  document.fonts?.addEventListener('loadingdone', forgetWidths);
  new MutationObserver(checkFont).observe(document.documentElement, { attributes: true });
  window.addEventListener('resize', checkFont);
}

function subscribeFont(listener: () => void): () => void {
  fontListeners.add(listener);
  return () => {
    fontListeners.delete(listener);
  };
}

const readFontVersion = (): number => fontVersion;

function measure(text: string): number {
  const el = getRuler();
  if (!el) {
    // No DOM to measure with: guess wide rather than narrow, since a title cut
    // a character early reads fine and one that spills does not.
    return text.length * LABEL_SIZE * 0.62;
  }
  const known = widths.get(text);
  if (known !== undefined) return known;
  el.textContent = text;
  const width = el.getComputedTextLength();
  widths.set(text, width);
  return width;
}

export function BoardThumbnail({ board, bible, notes, onOpen }: BoardThumbnailProps) {
  const { t } = useI18n();
  // Before the version is read, so a change seen here is not drawn twice.
  checkFont();
  useSyncExternalStore(subscribeFont, readFontVersion, readFontVersion);
  const layout = useMemo(() => {
    if (!board || board.nodes.length === 0) return null;

    const left = Math.min(...board.nodes.map((n) => n.x));
    const top = Math.min(...board.nodes.map((n) => n.y));
    const right = Math.max(...board.nodes.map((n) => n.x + cardSize(n).w));
    const bottom = Math.max(...board.nodes.map((n) => n.y + cardSize(n).h));

    const w = Math.max(right - left, 1);
    const h = Math.max(bottom - top, 1);
    // Scaled to fit rather than cropped: half a board is not a diagram.
    const scale = Math.max(MIN_SCALE, Math.min(1, WIDTH / w, MAX_HEIGHT / h));
    return { left, top, w, h, scale };
  }, [board]);

  if (!board) {
    return (
      <p className="embed embed--missing" data-testid="board-embed-missing">
        {t.embed.missing}
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
   * "Genesis 1:27" did. Trimmed against a real measurement of the drawn text,
   * with a clip behind it as a last guarantee.
   */
  const fit = (title: string, drawnWidth: number): string => {
    const room = Math.max(0, drawnWidth - LABEL_PAD * 2);
    if (room <= 0) return '';
    if (measure(title) <= room) return title;

    let cut = title.length - 1;
    while (cut > 0 && measure(`${title.slice(0, cut)}…`) > room) cut -= 1;
    return cut > 0 ? `${title.slice(0, cut)}…` : '';
  };

  const centre = (id: string) => {
    const n = board.nodes.find((node) => node.id === id);
    if (!n || !layout) return null;
    return {
      x: (n.x - layout.left + cardSize(n).w / 2) * layout.scale,
      y: (n.y - layout.top + cardSize(n).h / 2) * layout.scale,
    };
  };

  return (
    <figure className="embed" data-testid={`board-embed-${board.id}`}>
      {layout ? (
        // Focusable, because a wide board scrolls sideways here and a
        // scrolling region the keyboard cannot reach cannot be read (2.1.1).
        <div className="embed__scroll" tabIndex={0} role="group" aria-label={t.embed.scrolls(board.name || t.common.untitledBoard)}>
        <svg
          className="embed__canvas"
          viewBox={`0 0 ${layout.w * layout.scale} ${layout.h * layout.scale}`}
          width={layout.w * layout.scale}
          height={layout.h * layout.scale}
          role="img"
          aria-label={t.embed.picture(board.name, board.nodes.length)}
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
            const { title } = describeNode(n, { bible, notes }, t.cards);
            const w = cardSize(n).w * layout.scale;
            const h = cardSize(n).h * layout.scale;
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
        <p className="embed__empty">{t.embed.empty}</p>
      )}

      <figcaption className="embed__caption">
        {board.name || t.common.untitledBoard}
        {onOpen && (
          <>
            {' · '}
            <button
              type="button"
              className="embed__open"
              data-testid={`board-embed-open-${board.id}`}
              onClick={() => onOpen(board.id)}
            >
              {t.embed.open}
            </button>
          </>
        )}
      </figcaption>
    </figure>
  );
}
