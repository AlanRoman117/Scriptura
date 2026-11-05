/** Accepted license values for translation metadata. */
export type License = 'public-domain' | 'cc-by-3.0-br' | 'cc-by-4.0' | 'cc-by-sa-4.0' | 'cc0' | 'custom-free';

/** Testament identifier. */
export type Testament = 'OT' | 'NT';

/** Metadata for a Bible translation (stored in metadata.json). */
export interface TranslationMeta {
  id: string;
  name: string;
  language: string;
  license: License;
  attribution: string;
  /**
   * The language `attribution` is written in, when it is not the Bible's own:
   * a screen reader takes its voice from this (3.1.2).
   */
  attribution_lang?: string;
  /**
   * The licence itself, for a licence that asks for its address to travel with
   * the work (CC BY-SA 4.0 §3(a)(1)(C), CC BY 3.0 Brasil §4(a)).
   */
  license_url?: string;
  /**
   * One line, in English, saying where `license` does not hold. It states a
   * fact about rights and never grants anything, so it is shown as plain text.
   */
  rights_notice?: string;
  source_url: string;
  year: number;
  testament: 'both' | Testament;
  book_count: number;
}

/** A single verse. */
export interface Verse {
  number: number;
  text: string;
}

/** A chapter containing verses. */
export interface Chapter {
  number: number;
  /**
   * The chapter's title, where the source has one: a Psalm's superscription
   * ("A Psalm of David, when he fled from Absalom his son."). In English Bibles
   * it stands before verse 1 unnumbered, so it is the chapter's and not verse
   * 1's: putting it into the verse would change quoting, search and links.
   * Absent, never empty, where the source has none (the KJV's source has no
   * titles; Segond and Reina-Valera number the title as verse 1, so it is
   * already verse text there).
   */
  superscription?: string;
  verses: Verse[];
}

/** A book of the Bible. */
export interface Book {
  number: number;
  name: string;
  abbreviation: string;
  testament: Testament;
  chapters: Chapter[];
}

/**
 * A book as loaded from disk, with its URL slug attached.
 *
 * The slug lives in the filename (`43-john.json`), not inside the JSON, so it
 * only exists once a book has been loaded. `Book` therefore stays an exact
 * description of the on-disk file and this extends it for the in-memory model.
 */
export interface LoadedBook extends Book {
  slug: string;
}

/** A loaded Bible translation with accessor methods. */
export interface Bible {
  meta: TranslationMeta;
  books: LoadedBook[];
  verse(book: string, chapter: number, verse: number): Verse | undefined;
  chapter(book: string, chapter: number): Chapter | undefined;
  /** Resolve by slug, abbreviation, or localized name — see `findBook`. */
  book(name: string): LoadedBook | undefined;
  /** Every book slug in canonical order; used to suggest valid values on a 404. */
  slugs(): string[];
}

/** Search result from a full-text query. */
export interface SearchResult {
  ref: string;
  book: string;
  /** Language-independent slug for the book, usable directly in a URL path. */
  book_slug: string;
  chapter: number;
  verse: number;
  text: string;
  score: number;
}

/** A verse from a specific translation, used in comparisons. */
export interface TranslationVerse {
  translation: string;
  text: string;
  /** Verse number, when comparing a whole chapter. */
  number?: number;
  /**
   * Whether the verse was actually found.
   *
   * Without this, a verse a translation genuinely omits (critical texts drop
   * Acts 8:37, for instance) is indistinguishable from a lookup that failed —
   * both surface as an empty string.
   */
  found: boolean;
  /** The reference as this translation names it, e.g. `Juan 3:16`. */
  reference?: string;
  /** Set when this translation could not be read at all. */
  error?: string;
}
