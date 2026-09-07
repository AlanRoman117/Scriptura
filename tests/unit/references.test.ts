import { headingAt, formatRef, toWikiLink } from '../../apps/reader/src/lib/references';
import { parseQuery } from '../../apps/reader/src/lib/search';

/**
 * The pure halves of Stage 3: the link format and the query grammar.
 * Both are worth pinning here rather than only through the browser.
 */

describe('link format', () => {
  test('stores the slug, never a display name', () => {
    // A note written in rv1909 as [[Juan 3:16]] would not resolve in kjv.
    expect(toWikiLink({ book_slug: 'john', chapter: 3, verse: 16 })).toBe('[[john 3:16]]');
    expect(toWikiLink({ book_slug: '1-samuel', chapter: 1, verse: 1 })).toBe('[[1-samuel 1:1]]');
  });

  test('renders ranges and chapter-only references', () => {
    expect(formatRef({ book_slug: 'romans', chapter: 8, verse: 28, endVerse: 39 }))
      .toBe('romans 8:28-39');
    expect(formatRef({ book_slug: 'psalms', chapter: 119 })).toBe('psalms 119');
    // A one-verse "range" is not written as a range.
    expect(formatRef({ book_slug: 'john', chapter: 3, verse: 16, endVerse: 16 }))
      .toBe('john 3:16');
  });
});

describe('headingAt', () => {
  const note = '# Opening\n\nprose\n\n## On the Word\n\nmore\n';

  test('finds the heading the offset sits under', () => {
    expect(headingAt(note, 12)).toBe('Opening');
    expect(headingAt(note, note.length - 2)).toBe('On the Word');
  });

  test('is null before any heading, and for a note with none', () => {
    expect(headingAt('no headings here', 5)).toBeNull();
    expect(headingAt('intro text\n\n# Later', 3)).toBeNull();
  });
});

describe('query grammar', () => {
  test('bare words are all required', () => {
    expect(parseQuery('living water')).toEqual({
      required: ['living', 'water'],
      excluded: [],
      phrases: [],
    });
  });

  test('quotes make a phrase, and a leading dash excludes', () => {
    expect(parseQuery('"living water" -well')).toEqual({
      required: ['living water'],
      excluded: ['well'],
      phrases: ['living water'],
    });
  });

  test('an empty query asks for nothing', () => {
    expect(parseQuery('   ').required).toEqual([]);
  });
});
