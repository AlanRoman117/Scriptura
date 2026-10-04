/**
 * The link format notes use, and how it round-trips.
 *
 * Two things are being recorded, and they are not the same thing:
 *
 * 1. **Which passage** — always the slug, never a display name. A note written
 *    while reading `rv1909` as `[[Juan 3:16]]` would not resolve after
 *    switching to `kjv`; `[[john 3:16]]` resolves in every translation, and the
 *    reader renders the localized name at display time.
 * 2. **Which translation it was taken from**, when it was taken from one. Two
 *    quotes of Genesis 1:4 — one KJV, one VBL — produced two identical
 *    `[[genesis 1:4]]` links, so the note said which version each quote came
 *    from in its citation line and then threw that away in the link beneath it.
 *    The suffix `@kjv` keeps it.
 *
 * The qualifier is **optional on both sides**: `[[genesis 1:4]]` still parses
 * and still means the passage, so notes written before this keep working, and a
 * link that is genuinely about a passage rather than a rendering can stay
 * unqualified. `@` is safe as the separator — book slugs are `[a-z0-9-]`, and
 * no localized book name contains one.
 */
import { parseReference } from '@scriptura/core/books';
import type { Bible, LoadedBook } from '@scriptura/core/types';
import { formatRuns, toRuns } from './selection';

export interface VerseRef {
  book_slug: string;
  chapter: number;
  verse?: number;
  endVerse?: number;
  /** The translation the passage was taken from, when it was quoted from one. */
  translation?: string;
}

/** `[[john 3:16]]` / `[[john 3:16-18@kjv]]` / `[[psalms 119]]` */
export const WIKILINK = /\[\[([^\]]+)\]\]/g;

export function formatRef(ref: VerseRef): string {
  const verse =
    ref.verse === undefined
      ? ''
      : ref.endVerse !== undefined && ref.endVerse !== ref.verse
        ? `:${ref.verse}-${ref.endVerse}`
        : `:${ref.verse}`;
  const from = ref.translation ? `@${ref.translation}` : '';
  return `${ref.book_slug} ${ref.chapter}${verse}${from}`;
}

export const toWikiLink = (ref: VerseRef): string => `[[${formatRef(ref)}]]`;

/**
 * The links for several verses of one chapter: one per run of adjacent verses,
 * on one line. `[[john 1:1@bsb]] [[john 1:14@bsb]]`.
 *
 * A list in one link (`[[john 1:1,14]]`) would need the reference grammar to
 * grow, and that grammar is shared with the API and the search box. A link
 * per run needs nothing new: each is a range the grammar already has, and
 * each is followable from the cursor.
 */
export const toWikiLinks = (
  ref: Pick<VerseRef, 'book_slug' | 'chapter' | 'translation'>,
  runs: readonly (readonly [number, number])[]
): string =>
  runs
    .map(([first, last]) => toWikiLink({ ...ref, verse: first, endVerse: last === first ? undefined : last }))
    .join(' ');

/** Split a link's contents into the reference and its optional translation. */
export function splitQualifier(inner: string): { reference: string; translation?: string } {
  const at = inner.lastIndexOf('@');
  if (at === -1) return { reference: inner.trim() };
  const translation = inner.slice(at + 1).trim().toLowerCase();
  // An empty or space-bearing tail is not an id — treat the whole thing as a
  // reference rather than silently dropping half of it.
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(translation)) return { reference: inner.trim() };
  return { reference: inner.slice(0, at).trim(), translation };
}

/** Resolve a link's contents against a translation, or null if it is not one. */
export function resolveLink(bible: Bible, inner: string): (VerseRef & { book: LoadedBook }) | null {
  const { reference, translation } = splitQualifier(inner);
  const parsed = parseReference(reference);
  if (!parsed) return null;
  // Resolved against whatever is open: the slug is language-independent, so a
  // link written in Spanish resolves here even when its own translation is not
  // the one being read — or is not downloaded at all.
  const book = bible.book(parsed.book);
  if (!book) return null;
  return {
    book,
    book_slug: book.slug,
    chapter: parsed.chapter,
    verse: parsed.verse,
    endVerse: parsed.endVerse,
    translation,
  };
}

/**
 * The `[[…]]` link the cursor is sitting inside, if any.
 *
 * What makes a link followable from a plain textarea: there is nothing to
 * click, so the cursor's position is the selection.
 */
export function linkAt(text: string, offset: number): string | null {
  for (const match of text.matchAll(WIKILINK)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (offset >= start && offset <= end) return match[1];
  }
  return null;
}

/**
 * Quote a passage for insertion into a note.
 *
 * Markdown blockquote plus citation, and the attribution line when the licence
 * requires it — `vbl` is CC BY-SA 4.0, and a note that carries its text and is
 * later exported carries the obligation with it.
 *
 * Several verses are one block under one citation. They need not be a
 * sequence: the citation lists the runs ("John 1:1, 14-16") and there is a
 * link per run. With more than one verse each starts with its number in
 * bold, so a block reads as the passage it is and a skipped stretch shows as
 * a jump in the numbers. One verse is written as it always was.
 */
export function quotePassage(
  bible: Bible,
  book: LoadedBook,
  chapter: number,
  verses: { number: number; text: string }[]
): string {
  const meta = bible.meta;
  // The chapter's own order decides what is adjacent: a translation that
  // omits a verse still gives one run across the gap.
  const order = book.chapters.find((c) => c.number === chapter)?.verses.map((v) => v.number) ?? [];
  const at = (n: number) => (order.includes(n) ? order.indexOf(n) : Number.MAX_SAFE_INTEGER);
  const quoted = [...verses].sort((a, b) => at(a.number) - at(b.number) || a.number - b.number);
  const runs = toRuns(
    quoted.map((v) => v.number),
    order.length > 0 ? order : quoted.map((v) => v.number)
  );

  const many = quoted.length > 1;
  const body = quoted.map((v) => `> ${many ? `**${v.number}** ` : ''}${v.text}`).join('\n>\n');
  const citation = `> — ${book.name} ${chapter}:${formatRuns(runs)} (${meta.id.toUpperCase()})`;
  const notice =
    meta.license !== 'public-domain' && meta.license !== 'cc0'
      ? `\n> ${meta.attribution}`
      : '';

  // The citation says which version this text is; the links have to agree, or
  // two quotes of one verse from two translations are indistinguishable.
  return `${body}\n${citation}${notice}\n\n${toWikiLinks(
    { book_slug: book.slug, chapter, translation: meta.id },
    runs
  )}\n`;
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
