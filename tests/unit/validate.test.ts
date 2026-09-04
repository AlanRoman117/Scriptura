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
