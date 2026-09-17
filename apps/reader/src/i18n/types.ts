/** Shapes shared by every catalog, where inference alone would be too loose. */
import type { HighlightColor } from '../lib/notes';

/** A paragraph or a bulleted list in a help section; text uses the markup in rich.tsx. */
export type HelpBlock = { p: string } | { ul: string[] };

export interface HelpSection {
  /** Stable, not shown: tests and styles can address a section by it. */
  id: string;
  heading: string;
  blocks: HelpBlock[];
}

/** What the reader's book names look like in the open translation, for examples that must resolve. */
export interface BookExample {
  /** John, in the open translation: "John", "Juan", "Jean", "ヨハネ傳福音書". */
  john: string;
  /** Its abbreviation there: "Jhn", "Jua". */
  abbr: string;
}

export type ColourNames = Record<HighlightColor, string>;

/** What a removal took, for the board's undo. */
export type Removed = { kind: 'card' | 'connection'; label: string };
