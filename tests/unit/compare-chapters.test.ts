import { alignChapters, compareChapterOf } from '@scriptura/compare/chapters';
import { createBible } from '@scriptura/core/bible';
import type { LoadedBook, TranslationMeta } from '@scriptura/core/types';

/**
 * The pure half of chapter comparison — the half the reader runs in the
 * browser, so it is worth pinning here rather than only through HTTP.
 */

const meta = (id: string): TranslationMeta => ({
  id,
  name: id.toUpperCase(),
  language: 'en',
  license: 'public-domain',
  attribution: '',
  source_url: 'https://example.invalid',
  year: 1900,
  testament: 'both',
  book_count: 1,
});

/** Acts 8 as two translations disagree about it: one omits verse 37. */
const acts = (verses: number[], prefix: string): LoadedBook[] => [
  {
    number: 44,
    name: 'Acts',
    slug: 'acts',
    abbreviation: 'Act',
    testament: 'NT',
    chapters: [{ number: 8, verses: verses.map((n) => ({ number: n, text: `${prefix} ${n}` })) }],
  },
];

describe('compareChapterOf', () => {
  test('reads the same chapter out of each Bible, keeping verse numbers', () => {
    const rows = compareChapterOf(
      [
        createBible(meta('kjv'), acts([36, 37, 38], 'kjv')),
        createBible(meta('web'), acts([36, 38], 'web')),
      ],
      'acts',
      8
    );

    expect(rows.map((r) => r.translation)).toEqual(['kjv', 'web']);
    expect(rows[0].verses.map((v) => v.number)).toEqual([36, 37, 38]);
    expect(rows[1].verses.map((v) => v.number)).toEqual([36, 38]);
  });

  test('a chapter a translation does not have comes back empty, not missing', () => {
    const rows = compareChapterOf([createBible(meta('kjv'), acts([1], 'kjv'))], 'acts', 99);
    expect(rows).toHaveLength(1);
    expect(rows[0].verses).toEqual([]);
  });
});

describe('alignChapters', () => {
  test('aligns on the verse number, not the array index', () => {
    // The whole point. Acts 8:37 is absent from critical-text translations, so
    // index alignment would put kjv's 38 beside web's 38 one row too early and
    // every row after it would compare different verses.
    const rows = alignChapters(
      compareChapterOf(
        [
          createBible(meta('kjv'), acts([36, 37, 38], 'kjv')),
          createBible(meta('web'), acts([36, 38], 'web')),
        ],
        'acts',
        8
      )
    );

    expect(rows.map((r) => r.number)).toEqual([36, 37, 38]);
    expect(rows[1].cells).toEqual(['kjv 37', null]);
    expect(rows[2].cells).toEqual(['kjv 38', 'web 38']);
  });

  test('rows are ordered by verse number even when a translation starts later', () => {
    const rows = alignChapters(
      compareChapterOf(
        [
          createBible(meta('a'), acts([3, 1], 'a')),
          createBible(meta('b'), acts([2], 'b')),
        ],
        'acts',
        8
      )
    );
    expect(rows.map((r) => r.number)).toEqual([1, 2, 3]);
  });
});
