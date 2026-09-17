import { foldText, normalizeBookKey, parseReference, slugFromFilename } from '@scriptura/core';

describe('slugFromFilename', () => {
  test('strips the numeric prefix and extension', () => {
    expect(slugFromFilename('43-john.json')).toBe('john');
    expect(slugFromFilename('01-genesis.json')).toBe('genesis');
  });

  test('keeps the number that is part of a book name', () => {
    expect(slugFromFilename('09-1-samuel.json')).toBe('1-samuel');
    expect(slugFromFilename('64-3-john.json')).toBe('3-john');
  });

  test('handles multi-word books', () => {
    expect(slugFromFilename('22-song-of-solomon.json')).toBe('song-of-solomon');
  });
});

describe('normalizeBookKey', () => {
  test('folds case', () => {
    expect(normalizeBookKey('John')).toBe('john');
    expect(normalizeBookKey('GENESIS')).toBe('genesis');
  });

  test('folds Latin diacritics so localized names meet their slug', () => {
    expect(normalizeBookKey('Génesis')).toBe('genesis');
    expect(normalizeBookKey('GENÈSE')).toBe('genese');
  });

  test('reconciles spacing conventions with slug hyphens', () => {
    expect(normalizeBookKey('1 Samuel')).toBe('1-samuel');
    expect(normalizeBookKey('1-samuel')).toBe('1-samuel');
    expect(normalizeBookKey('1_Samuel')).toBe('1-samuel');
    expect(normalizeBookKey('Song of Solomon')).toBe('song-of-solomon');
  });

  test('leaves Japanese intact', () => {
    // Regression guard. NFD decomposes the dakuten to a combining mark, so a
    // blanket \p{M} strip turns ガラテヤ into カラテヤ — a different word. Only
    // the Latin combining block may be stripped.
    expect(normalizeBookKey('ガラテヤ人への手紙')).toBe('ガラテヤ人への手紙');
    expect(normalizeBookKey('ガラテヤ人への手紙')).not.toBe('カラテヤ人への手紙');
    expect(normalizeBookKey('ヨハネによる福音書')).toBe('ヨハネによる福音書');
  });

  test('trims stray separators rather than emitting empty segments', () => {
    expect(normalizeBookKey('  John  ')).toBe('john');
    expect(normalizeBookKey('--john--')).toBe('john');
  });
});

describe('foldText', () => {
  test('folds case', () => {
    expect(foldText('For God So Loved')).toBe('for god so loved');
  });

  test('folds Latin diacritics', () => {
    expect(foldText('amó')).toBe('amo');
    expect(foldText('péché')).toBe('peche');
    expect(foldText('GÉNESIS')).toBe('genesis');
  });

  test('is symmetric — either spelling folds to the same key', () => {
    expect(foldText('amó')).toBe(foldText('amo'));
    expect(foldText('Père')).toBe(foldText('pere'));
  });

  test('preserves spacing and punctuation, unlike normalizeBookKey', () => {
    // Phrase and substring matching depend on this; the book-key variant
    // collapses separators, which would be wrong for prose.
    expect(foldText('In the beginning, God')).toBe('in the beginning, god');
    expect(normalizeBookKey('In the beginning, God')).toBe('in-the-beginning-god');
  });

  test('leaves Japanese intact', () => {
    // Same trap as normalizeBookKey: NFD decomposes the dakuten to a combining
    // mark, so a blanket \p{M} strip turns ガ into カ — a different word.
    expect(foldText('ガラテヤ人への手紙')).toBe('ガラテヤ人への手紙');
    expect(foldText('ガラテヤ')).not.toBe('カラテヤ');
    expect(foldText('それ神はその獨子を賜ふ')).toBe('それ神はその獨子を賜ふ');
  });

  test('handles empty and whitespace input', () => {
    expect(foldText('')).toBe('');
    expect(foldText('   ')).toBe('   ');
  });
});

describe('parseReference', () => {
  test('reads a chapter, a verse and a range', () => {
    expect(parseReference('John 3')).toEqual({ book: 'John', chapter: 3 });
    expect(parseReference('John 3:16')).toEqual({ book: 'John', chapter: 3, verse: 16 });
    expect(parseReference('John 3:16-18')).toEqual({ book: 'John', chapter: 3, verse: 16, endVerse: 18 });
    expect(parseReference('John 3:16 - 18')).toEqual({ book: 'John', chapter: 3, verse: 16, endVerse: 18 });
  });

  test('keeps the whole name, including numbers and spaces inside it', () => {
    expect(parseReference('1 Samuel 2:3')).toEqual({ book: '1 Samuel', chapter: 2, verse: 3 });
    expect(parseReference('  Song of Solomon   2:1  ')).toEqual({ book: 'Song of Solomon', chapter: 2, verse: 1 });
    // Localized names and slugs are resolved later, against a translation.
    expect(parseReference('ヨハネによる福音書 3:16')).toEqual({ book: 'ヨハネによる福音書', chapter: 3, verse: 16 });
    expect(parseReference('1-samuel 2')).toEqual({ book: '1-samuel', chapter: 2 });
  });

  test('takes the last number as the chapter, as it always did', () => {
    expect(parseReference('Genesis 1 2')).toEqual({ book: 'Genesis 1', chapter: 2 });
  });

  test('refuses what is not a reference', () => {
    for (const input of ['', '   ', 'John', '3:16', 'John3:16', '3', ':16']) {
      expect(parseReference(input)).toBeNull();
    }
  });

  test('leaves a name it cannot judge to the translation, as it always did', () => {
    // Whether "John chapter" is a book is not a question of grammar: only a
    // loaded translation knows its names, slugs and abbreviations.
    expect(parseReference('John chapter 3')).toEqual({ book: 'John chapter', chapter: 3 });
  });

  /**
   * The grammar used to be one expression where the name and the space before
   * the chapter could both match a space, so a long run of them was quadratic:
   * "a" and 50,000 spaces took 1.85s here, and `/compare?ref=` takes this
   * string straight from a query. It is now two steps, and the same input is
   * immediate.
   */
  test('fails immediately on a long run of spaces (js/polynomial-redos)', () => {
    const started = performance.now();
    expect(parseReference(`a${' '.repeat(50_000)}`)).toBeNull();
    expect(parseReference(`${'a '.repeat(20_000)}3:16`)).not.toBeNull();
    expect(performance.now() - started).toBeLessThan(100);
  });
});
