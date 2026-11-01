import { outsideCatalog, storedEntry } from '../../apps/reader/src/lib/stored';
import type { CatalogEntry } from '../../apps/reader/src/lib/library';

/**
 * Rows for what a device holds and the catalog does not list. The reader's half
 * of a translation being withdrawn: tests/reader/withdrawn.spec.ts drives it.
 */
const entry = (id: string): CatalogEntry => ({ id, language: 'en', name: id.toUpperCase() }) as CatalogEntry;

describe('outsideCatalog', () => {
  test('names what is stored and not listed, and nothing else', () => {
    expect(outsideCatalog([entry('kjv'), entry('bsb')], ['kjv', 'cuvs', 'ostervald'])).toEqual(['cuvs', 'ostervald']);
    expect(outsideCatalog([entry('kjv'), entry('bsb')], ['kjv'])).toEqual([]);
  });

  test('with no catalog, everything stored is outside it', () => {
    expect(outsideCatalog([], ['kjv', 'cuvs'])).toEqual(['kjv', 'cuvs']);
  });
});

describe('storedEntry', () => {
  const stored = {
    id: 'cuvs',
    name: '新标点和合本',
    language: 'zh-Hans',
    license: 'public-domain',
    attribution: 'x',
    source_url: 'x',
    year: 1919,
    testament: 'both',
    book_count: 66,
    books: [{ whole: 'Bible' }],
  } as never;

  test('takes its name and language from the copy, and leaves the Bible behind', () => {
    const row = storedEntry('cuvs', stored, true);
    expect(row.name).toBe('新标点和合本');
    expect(row.language).toBe('zh-Hans');
    expect(row).not.toHaveProperty('books');
  });

  test('says it is no longer offered only when a catalog was read', () => {
    expect(storedEntry('cuvs', stored, true).storedOnly).toBe('no-longer-offered');
    expect(storedEntry('cuvs', stored, false).storedOnly).toBe('catalog-unavailable');
  });

  test.each([
    ['nothing could be read', undefined],
    ['the copy has no metadata', {}],
    ['its language is not a tag', { language: 'not a tag' }],
    ['its language is not a string', { language: 7 as never }],
  ])('a row can still be drawn, and so removed, when %s', (_label, copy) => {
    const row = storedEntry('cuvs', copy, true);
    expect(row.id).toBe('cuvs');
    expect(row.name).toBe('CUVS');
    expect(row.language).toBe('und');
    // What the library does with it: this throws on a malformed tag.
    expect(() => new Intl.DisplayNames(['en'], { type: 'language' }).of(row.language)).not.toThrow();
  });
});
