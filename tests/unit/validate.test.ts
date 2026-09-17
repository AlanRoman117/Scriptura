import { CANON } from '../../packages/validate/src/canon';

describe('@scriptura/validate canon', () => {
  test('canon has exactly 66 books', () => {
    expect(CANON).toHaveLength(66);
  });

  test('canon book numbers are sequential 1-66', () => {
    CANON.forEach((book, i) => {
      expect(book.number).toBe(i + 1);
    });
  });

  test('OT has 39 books, NT has 27 books', () => {
    const ot = CANON.filter((b) => b.testament === 'OT');
    const nt = CANON.filter((b) => b.testament === 'NT');
    expect(ot).toHaveLength(39);
    expect(nt).toHaveLength(27);
  });

  test('all books have positive chapter counts', () => {
    CANON.forEach((book) => {
      expect(book.chapters).toBeGreaterThan(0);
    });
  });
});

describe('CANON has no abbreviation field', () => {
  test('abbreviations are not duplicated here', () => {
    // They were, and were wrong for 45 of the 66 books — OSIS-style `Exod`,
    // `1Sam`, `1Kgs` where the data has `Exo`, `1Sa`, `1Ki`. Nothing read the
    // field, so nothing noticed. Abbreviations belong to scripts/ingest.py,
    // which writes them, and to each book's JSON, which carries them.
    // scripts/check-canon-sync.py verifies those two agree.
    for (const book of CANON) {
      expect(book).not.toHaveProperty('abbreviation');
    }
  });
});
