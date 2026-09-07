/**
 * The link format notes use, and how it round-trips.
 *
 * A link is stored as the **slug**, never the display name. A note written
 * while reading `rv1909` as `[[Juan 3:16]]` would not resolve after switching
 * to `kjv`; `[[john 3:16]]` resolves in every translation, and the reader can
 * render the localized name at display time.
 */
import { parseReference } from '@scriptura/core/books';
import type { Bible, LoadedBook } from '@scriptura/core/types';

export interface VerseRef {
  book_slug: string;
  chapter: number;
  verse?: number;
  endVerse?: number;
}

/** `[[john 3:16]]` / `[[john 3:16-18]]` / `[[psalms 119]]` */
export const WIKILINK = /\[\[([^\]]+)\]\]/g;

export function formatRef(ref: VerseRef): string {
  const verse =
    ref.verse === undefined
      ? ''
      : ref.endVerse !== undefined && ref.endVerse !== ref.verse
        ? `:${ref.verse}-${ref.endVerse}`
        : `:${ref.verse}`;
  return `${ref.book_slug} ${ref.chapter}${verse}`;
}

export const toWikiLink = (ref: VerseRef): string => `[[${formatRef(ref)}]]`;

/** Resolve a link's contents against a translation, or null if it is not one. */
export function resolveLink(bible: Bible, inner: string): (VerseRef & { book: LoadedBook }) | null {
  const parsed = parseReference(inner);
  if (!parsed) return null;
  const book = bible.book(parsed.book);
  if (!book) return null;
  return {
    book,
    book_slug: book.slug,
    chapter: parsed.chapter,
    verse: parsed.verse,
    endVerse: parsed.endVerse,
  };
}

/**
 * Quote a passage for insertion into a note.
 *
 * Markdown blockquote plus citation, and the attribution line when the licence
 * requires it — `vbl` is CC BY-SA 4.0, and a note that carries its text and is
 * later exported carries the obligation with it.
 */
export function quotePassage(
  bible: Bible,
  book: LoadedBook,
  chapter: number,
  verses: { number: number; text: string }[]
): string {
  const meta = bible.meta;
  const span =
    verses.length > 1
      ? `${verses[0].number}-${verses[verses.length - 1].number}`
      : `${verses[0].number}`;

  const body = verses.map((v) => `> ${v.text}`).join('\n>\n');
  const citation = `> — ${book.name} ${chapter}:${span} (${meta.id.toUpperCase()})`;
  const notice =
    meta.license !== 'public-domain' && meta.license !== 'cc0'
      ? `\n> ${meta.attribution}`
      : '';

  return `${body}\n${citation}${notice}\n\n${toWikiLink({
    book_slug: book.slug,
    chapter,
    verse: verses[0].number,
    endVerse: verses.length > 1 ? verses[verses.length - 1].number : undefined,
  })}\n`;
}

/**
 * The markdown heading a given offset sits under.
 *
 * Powers the sticky heading in the editor — the same idea as a code editor
 * keeping the enclosing function visible while you scroll inside it.
 */
export function headingAt(text: string, offset: number): string | null {
  let heading: string | null = null;
  let index = 0;
  for (const line of text.split('\n')) {
    if (index > offset) break;
    const match = /^(#{1,6})\s+(.*)$/.exec(line);
    if (match) heading = match[2].trim() || null;
    index += line.length + 1;
  }
  return heading;
}
