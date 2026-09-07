/**
 * Notes and highlights — the user's own work.
 *
 * This is the data the product exists to protect, so every operation here is
 * written to survive the browser being unhelpful: a store that fails to read
 * must not take the others with it, and a write that fails must say so once
 * rather than silently or endlessly.
 */
import {
  HIGHLIGHTS,
  NOTES,
  SETTINGS,
  del,
  get,
  put,
  readSafely,
  writeSafely,
} from './db';

export interface Note {
  id: string;
  title: string;
  body: string;
  created: number;
  updated: number;
}

/**
 * Five colours, and therefore five collections.
 *
 * A colour is not just a shade on the page: each one is a running list of the
 * verses marked with it, so highlighting in yellow for one study subject and
 * red for another gives two collections to walk rather than two colours to go
 * hunting for. The colours are the storage; `MarksPanel` is the reading of it.
 */
export const HIGHLIGHT_COLORS = ['amber', 'rose', 'sky', 'mint', 'violet'] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

/**
 * A highlight, anchored to the passage — not to the translation it was made in.
 *
 * `book_slug` is language-independent, so John 3:16 marked while reading
 * `rv1909` is the same mark in `kjv`; storing "Juan" would not be. The
 * translation is kept as provenance but is deliberately **not** part of the
 * key: a study collection that emptied itself when you changed translation
 * would not be a collection. (It was part of the key until colours became
 * collections, which is when that stopped being survivable.)
 */
export interface Highlight {
  id: string;
  translation: string;
  book_slug: string;
  chapter: number;
  verse: number;
  color: HighlightColor;
  created: number;
}

export type HighlightAnchor = Omit<Highlight, 'id' | 'color' | 'created'>;

export const highlightId = (h: Pick<Highlight, 'book_slug' | 'chapter' | 'verse'>) =>
  `${h.book_slug}:${h.chapter}:${h.verse}`;

/**
 * A colour's name, when the reader has given it one.
 *
 * "Amber" is a shade; "Covenant promises" is a subject. The colour stays the
 * visual anchor and the label is what makes the list worth returning to, so it
 * is optional and falls back to the colour name.
 */
export type ColorLabels = Partial<Record<HighlightColor, string>>;

const COLOR_LABELS = 'colorLabels';

export const loadColorLabels = (): Promise<ColorLabels> =>
  get<ColorLabels>(SETTINGS, COLOR_LABELS)
    .then((v) => v ?? {})
    .catch(() => ({}));

export const saveColorLabels = (labels: ColorLabels): Promise<unknown> =>
  put(SETTINGS, COLOR_LABELS, labels).catch(() => undefined);

/** The label to show for a colour, falling back to the colour's own name. */
export const colorLabel = (color: HighlightColor, labels: ColorLabels): string =>
  labels[color]?.trim() || color.charAt(0).toUpperCase() + color.slice(1);

type Reporter = (store: string, error: unknown) => void;

/* ── Notes ──────────────────────────────────────────────────────────────── */

export const listNotes = (onFailure?: Reporter): Promise<Note[]> =>
  readSafely<Note[]>(NOTES, [], onFailure).then((notes) =>
    [...notes].sort((a, b) => b.updated - a.updated)
  );

export const saveNote = (note: Note, onFirstFailure?: Reporter): Promise<boolean> =>
  writeSafely(NOTES, note.id, note, onFirstFailure);

export const deleteNote = (id: string): Promise<unknown> => del(NOTES, id).catch(() => undefined);

export function newNote(title = 'Untitled'): Note {
  const now = Date.now();
  return { id: crypto.randomUUID(), title, body: '', created: now, updated: now };
}

/* ── Highlights ─────────────────────────────────────────────────────────── */

export const listHighlights = (onFailure?: Reporter): Promise<Highlight[]> =>
  readSafely<Highlight[]>(HIGHLIGHTS, [], onFailure).then(migrateHighlights);

/**
 * Re-key highlights written under the old `translation:book:chapter:verse` id.
 *
 * Runs on read and rewrites in place, so a reader who marked verses before
 * colours became collections keeps every one of them. Two translations that
 * marked the same passage collapse to the older mark — it is the same verse,
 * and the first time it was noticed is the more useful date.
 */
function migrateHighlights(stored: Highlight[]): Promise<Highlight[]> {
  const stale = stored.filter((h) => h.id !== highlightId(h));
  if (stale.length === 0) return Promise.resolve(stored);

  const merged = new Map<string, Highlight>();
  for (const h of stored) {
    const id = highlightId(h);
    const existing = merged.get(id);
    if (!existing || h.created < existing.created) merged.set(id, { ...h, id });
  }

  const writes = [
    ...stale.map((h) => del(HIGHLIGHTS, h.id).catch(() => undefined)),
    ...[...merged.values()].map((h) => writeSafely(HIGHLIGHTS, h.id, h)),
  ];
  return Promise.all(writes).then(() => [...merged.values()]);
}

export function toggleHighlight(
  anchor: HighlightAnchor,
  color: HighlightColor,
  existing: Highlight[],
  onFirstFailure?: Reporter
): Promise<Highlight[]> {
  const id = highlightId(anchor);
  const current = existing.find((h) => h.id === id);

  // Same colour again clears it; a different colour recolours in place.
  if (current && current.color === color) {
    return deleteHighlight(id).then(() => existing.filter((h) => h.id !== id));
  }

  const next: Highlight = { ...anchor, id, color, created: current?.created ?? Date.now() };
  return writeSafely(HIGHLIGHTS, id, next, onFirstFailure).then((ok) =>
    ok ? [...existing.filter((h) => h.id !== id), next] : existing
  );
}

export const deleteHighlight = (id: string): Promise<unknown> =>
  del(HIGHLIGHTS, id).catch(() => undefined);

/* ── Export bookkeeping ─────────────────────────────────────────────────── */

const LAST_EXPORT = 'lastExport';
/** Long enough not to nag, short enough that a loss is not months of work. */
const STALE_AFTER_MS = 14 * 24 * 60 * 60 * 1000;

export const markExported = (): Promise<unknown> =>
  put(SETTINGS, LAST_EXPORT, Date.now()).catch(() => undefined);

export async function exportIsStale(hasNotes: boolean): Promise<boolean> {
  if (!hasNotes) return false;
  const last = await get<number>(SETTINGS, LAST_EXPORT).catch(() => undefined);
  return last === undefined || Date.now() - last > STALE_AFTER_MS;
}
