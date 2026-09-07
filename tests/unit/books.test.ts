import { foldText, normalizeBookKey, slugFromFilename } from '@scriptura/core';

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
