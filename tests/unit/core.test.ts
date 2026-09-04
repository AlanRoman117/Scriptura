import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Book, TranslationMeta } from '@scriptura/core';

const FIXTURES = join(__dirname, '..', 'fixtures');

describe('@scriptura/core types', () => {
  test('sample metadata conforms to TranslationMeta', () => {
    const raw = readFileSync(join(FIXTURES, 'sample-metadata.json'), 'utf-8');
    const meta: TranslationMeta = JSON.parse(raw);
    expect(meta.id).toBe('test');
    expect(meta.license).toBe('public-domain');
    expect(meta.book_count).toBe(66);
  });

  test('sample book conforms to Book type', () => {
    const raw = readFileSync(join(FIXTURES, 'sample-verse.json'), 'utf-8');
    const book: Book = JSON.parse(raw);
    expect(book.name).toBe('John');
    expect(book.chapters[0].verses[0].number).toBe(16);
    expect(book.chapters[0].verses[0].text).toContain('For God so loved');
  });
});
