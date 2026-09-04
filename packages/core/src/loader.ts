import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Bible, Book, Chapter, TranslationMeta, Verse } from './types.js';

const DATA_DIR = join(__dirname, '..', '..', '..', 'data');

function findBook(books: Book[], name: string): Book | undefined {
  const lower = name.toLowerCase();
  return books.find(
    (b) =>
      b.name.toLowerCase() === lower ||
      b.abbreviation.toLowerCase() === lower
  );
}

function createBible(meta: TranslationMeta, books: Book[]): Bible {
  return {
    meta,
    books,
    verse(bookName: string, chapterNum: number, verseNum: number): Verse | undefined {
      const book = findBook(books, bookName);
      const chapter = book?.chapters.find((c) => c.number === chapterNum);
      return chapter?.verses.find((v) => v.number === verseNum);
    },
    chapter(bookName: string, chapterNum: number): Chapter | undefined {
      const book = findBook(books, bookName);
      return book?.chapters.find((c) => c.number === chapterNum);
    },
    book(name: string): Book | undefined {
      return findBook(books, name);
    },
  };
}

/**
 * Load a Bible translation by its ID (e.g. "kjv", "rv1909").
 * Reads the translation's metadata.json and all book files from data/{id}/.
 */
export async function loadTranslation(id: string): Promise<Bible> {
  const translationDir = join(DATA_DIR, id);

  const metaRaw = await readFile(join(translationDir, 'metadata.json'), 'utf-8');
  const meta: TranslationMeta = JSON.parse(metaRaw);

  const booksDir = join(translationDir, 'books');
  const files = await readdir(booksDir);
  const bookFiles = files.filter((f) => f.endsWith('.json')).sort();

  const books: Book[] = await Promise.all(
    bookFiles.map(async (file) => {
      const raw = await readFile(join(booksDir, file), 'utf-8');
      return JSON.parse(raw) as Book;
    })
  );

  return createBible(meta, books);
}

/**
 * List metadata for all available translations in the data/ directory.
 */
export async function listTranslations(): Promise<TranslationMeta[]> {
  const dirs = await readdir(DATA_DIR);
  const translations: TranslationMeta[] = [];

  for (const dir of dirs) {
    try {
      const raw = await readFile(join(DATA_DIR, dir, 'metadata.json'), 'utf-8');
      translations.push(JSON.parse(raw));
    } catch {
      // Skip directories without metadata.json
    }
  }

  return translations;
}
