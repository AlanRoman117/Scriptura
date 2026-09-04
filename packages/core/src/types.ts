/** Accepted license values for translation metadata. */
export type License = 'public-domain' | 'cc-by-sa-4.0' | 'cc0' | 'custom-free';

/** Testament identifier. */
export type Testament = 'OT' | 'NT';

/** Metadata for a Bible translation (stored in metadata.json). */
export interface TranslationMeta {
  id: string;
  name: string;
  language: string;
  license: License;
  attribution: string;
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

/** A loaded Bible translation with accessor methods. */
export interface Bible {
  meta: TranslationMeta;
  books: Book[];
  verse(book: string, chapter: number, verse: number): Verse | undefined;
  chapter(book: string, chapter: number): Chapter | undefined;
  book(name: string): Book | undefined;
}

/** Search result from a full-text query. */
export interface SearchResult {
  ref: string;
  book: string;
  chapter: number;
  verse: number;
  text: string;
  score: number;
}

/** A verse from a specific translation, used in comparisons. */
export interface TranslationVerse {
  translation: string;
  text: string;
}
