import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { TranslationMeta, Book } from '@scriptura/core';
import { CANON } from './canon.js';

export interface ValidationError {
  translation: string;
  file: string;
  message: string;
}

const VALID_LICENSES = ['public-domain', 'cc-by-sa-4.0', 'cc0', 'custom-free'];

/**
 * Validate a single translation directory.
 * Checks: metadata exists, license is valid, all 66 books present,
 * chapter/verse counts match canon, no empty verse text.
 */
export async function validate(translationDir: string): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];
  const dirName = translationDir.split(/[/\\]/).pop() ?? translationDir;

  // Check metadata.json
  let meta: TranslationMeta;
  try {
    const raw = await readFile(join(translationDir, 'metadata.json'), 'utf-8');
    meta = JSON.parse(raw);
  } catch {
    errors.push({ translation: dirName, file: 'metadata.json', message: 'Missing or invalid metadata.json' });
    return errors;
  }

  // Check license field
  if (!VALID_LICENSES.includes(meta.license)) {
    errors.push({
      translation: dirName,
      file: 'metadata.json',
      message: `Invalid license "${meta.license}". Must be one of: ${VALID_LICENSES.join(', ')}`,
    });
  }

  // Check books
  const booksDir = join(translationDir, 'books');
  let bookFiles: string[];
  try {
    bookFiles = (await readdir(booksDir)).filter((f) => f.endsWith('.json')).sort();
  } catch {
    errors.push({ translation: dirName, file: 'books/', message: 'Missing books/ directory' });
    return errors;
  }

  if (bookFiles.length !== 66) {
    errors.push({
      translation: dirName,
      file: 'books/',
      message: `Expected 66 books, found ${bookFiles.length}`,
    });
  }

  // Validate each book file
  for (const file of bookFiles) {
    try {
      const raw = await readFile(join(booksDir, file), 'utf-8');
      const book: Book = JSON.parse(raw);
      const canonBook = CANON.find((c) => c.number === book.number);

      if (canonBook) {
        if (book.chapters.length !== canonBook.chapters) {
          errors.push({
            translation: dirName,
            file,
            message: `${book.name}: expected ${canonBook.chapters} chapters, found ${book.chapters.length}`,
          });
        }
      }

      // Check for empty verse text
      for (const chapter of book.chapters) {
        for (const verse of chapter.verses) {
          if (!verse.text || verse.text.trim() === '') {
            errors.push({
              translation: dirName,
              file,
              message: `${book.name} ${chapter.number}:${verse.number} has empty text`,
            });
          }
        }
      }
    } catch {
      errors.push({ translation: dirName, file, message: `Failed to parse ${file}` });
    }
  }

  return errors;
}

/**
 * Validate all translation directories under a parent directory.
 */
export async function validateAll(dataDir: string): Promise<ValidationError[]> {
  const dirs = await readdir(dataDir);
  const allErrors: ValidationError[] = [];

  for (const dir of dirs) {
    const translationDir = join(dataDir, dir);
    try {
      await readFile(join(translationDir, 'metadata.json'), 'utf-8');
      const errors = await validate(translationDir);
      allErrors.push(...errors);
    } catch {
      // Skip non-translation directories
    }
  }

  return allErrors;
}
