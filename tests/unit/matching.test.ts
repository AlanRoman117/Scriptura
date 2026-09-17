import {
  hasWordBoundaries,
  matchScore,
  SCORE_INSIDE_WORD,
  SCORE_NONE,
  SCORE_WHOLE_WORD,
  SCORE_WORD_START,
} from '@scriptura/search/matcher';
import { foldDiacritics, foldText } from '@scriptura/core/books';

/**
 * Match quality — the arithmetic behind ranking.
 *
 * The case that prompted it: searching `Tito` in Spanish returned `apetito`
 * alongside Titus. Substring matching is still right, because the KJV writes
 * `loveth`; what was missing was any way to say that one of those is a better
 * match than the other.
 */

describe('matchScore', () => {
  test('a whole word outranks an inflection, which outranks a coincidence', () => {
    expect(matchScore('a tito, verdadero hijo', 'tito')).toBe(SCORE_WHOLE_WORD);
    expect(matchScore('si tienes gran apetito', 'tito')).toBe(SCORE_INSIDE_WORD);
    expect(matchScore('he that loveth not', 'love')).toBe(SCORE_WORD_START);
    expect(matchScore('nothing here', 'tito')).toBe(SCORE_NONE);
  });

  test('the best occurrence wins, not the first', () => {
    // The good match is the one the reader is looking for; a verse holding both
    // should not be demoted by whichever happened to come first.
    expect(matchScore('gran apetito, y tito', 'tito')).toBe(SCORE_WHOLE_WORD);
    expect(matchScore('tito, y gran apetito', 'tito')).toBe(SCORE_WHOLE_WORD);
  });

  test('punctuation and quotes are boundaries, so citations still match', () => {
    for (const text of ['"tito"', '(tito)', 'tito,', '— tito', 'tito.']) {
      expect(matchScore(text, 'tito')).toBe(SCORE_WHOLE_WORD);
    }
  });

  test('digits count as word characters, so 1tito is not a whole word', () => {
    expect(matchScore('x1tito', 'tito')).toBe(SCORE_INSIDE_WORD);
  });

  test('an empty needle scores nothing rather than matching everything', () => {
    expect(matchScore('anything at all', '')).toBe(SCORE_NONE);
  });
});

describe('scripts without word separators', () => {
  /**
   * ⚠️ The load-bearing case. Japanese is written without spaces, so treating
   * its characters as word-forming makes every match an interior one — whole-
   * word matching took 神 from 3,945 verses to 3. Every Japanese match must
   * score as a whole word so that word mode returns exactly what substring
   * mode does.
   */
  test('a Japanese query has no boundaries to match on', () => {
    expect(hasWordBoundaries('神')).toBe(false);
    expect(hasWordBoundaries('イエス')).toBe(false);
    expect(hasWordBoundaries('ヨハネ')).toBe(false);
  });

  test('Latin, Greek and Cyrillic queries do', () => {
    expect(hasWordBoundaries('Tito')).toBe(true);
    expect(hasWordBoundaries('amó')).toBe(true);
    expect(hasWordBoundaries('θεός')).toBe(true);
  });

  test('a query of only punctuation has none either', () => {
    expect(hasWordBoundaries('—')).toBe(false);
    expect(hasWordBoundaries('   ')).toBe(false);
  });

  test('every Japanese match scores as a whole word, wherever it sits', () => {
    // Mid-run, at the start, at the end: all equal, so ranking cannot reorder
    // a Japanese result set into an arbitrary shape.
    for (const text of ['かくてその子をイエスと名づけたり', 'イエス言ひ給ふ', '我らの主イエス']) {
      expect(matchScore(text, 'イエス')).toBe(SCORE_WHOLE_WORD);
    }
  });

  test('a mixed query is still scored by its Latin part', () => {
    expect(hasWordBoundaries('イエスX')).toBe(true);
  });
});

describe('folding stays split but equivalent', () => {
  test('foldText is diacritic folding plus lowercasing, unchanged', () => {
    for (const sample of ['Génesis', 'AMÓ', 'péché', 'In the beginning, God', '', '  ']) {
      expect(foldText(sample)).toBe(foldDiacritics(sample).toLowerCase());
    }
  });

  test('foldDiacritics keeps case, which is what case-sensitive search needs', () => {
    expect(foldDiacritics('Amó')).toBe('Amo');
    expect(foldDiacritics('GÉNESIS')).toBe('GENESIS');
  });

  test('and still does not touch the Japanese dakuten', () => {
    expect(foldDiacritics('ガラテヤ')).toBe('ガラテヤ');
  });
});
