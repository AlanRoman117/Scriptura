/**
 * Protestant canon: 66 books with expected chapter counts.
 * Used by the validator to verify translation completeness.
 *
 * One of three canon definitions that must agree — the others are `CANON` in
 * `scripts/validate.py` and `CANONICAL_BOOKS` in `scripts/ingest.py`.
 * `scripts/check-canon-sync.py` cross-checks all three against the committed
 * data on every CI run, so drift fails the build rather than going unnoticed.
 *
 * There is deliberately **no `abbreviation` field**. It was here, unused by the
 * validator, and wrong for 45 of the 66 books (it carried OSIS-style `Exod`,
 * `1Sam`, `1Kgs` while the data uses `Exo`, `1Sa`, `1Ki`). Abbreviations belong
 * to `ingest.py`, which writes them, and to each book's JSON, which carries
 * them; a third copy here only had to drift. Do not add it back.
 */
export const CANON = [
  { number: 1, name: 'Genesis', testament: 'OT', chapters: 50 },
  { number: 2, name: 'Exodus', testament: 'OT', chapters: 40 },
  { number: 3, name: 'Leviticus', testament: 'OT', chapters: 27 },
  { number: 4, name: 'Numbers', testament: 'OT', chapters: 36 },
  { number: 5, name: 'Deuteronomy', testament: 'OT', chapters: 34 },
  { number: 6, name: 'Joshua', testament: 'OT', chapters: 24 },
  { number: 7, name: 'Judges', testament: 'OT', chapters: 21 },
  { number: 8, name: 'Ruth', testament: 'OT', chapters: 4 },
  { number: 9, name: '1 Samuel', testament: 'OT', chapters: 31 },
  { number: 10, name: '2 Samuel', testament: 'OT', chapters: 24 },
  { number: 11, name: '1 Kings', testament: 'OT', chapters: 22 },
  { number: 12, name: '2 Kings', testament: 'OT', chapters: 25 },
  { number: 13, name: '1 Chronicles', testament: 'OT', chapters: 29 },
  { number: 14, name: '2 Chronicles', testament: 'OT', chapters: 36 },
  { number: 15, name: 'Ezra', testament: 'OT', chapters: 10 },
  { number: 16, name: 'Nehemiah', testament: 'OT', chapters: 13 },
  { number: 17, name: 'Esther', testament: 'OT', chapters: 10 },
  { number: 18, name: 'Job', testament: 'OT', chapters: 42 },
  { number: 19, name: 'Psalms', testament: 'OT', chapters: 150 },
  { number: 20, name: 'Proverbs', testament: 'OT', chapters: 31 },
  { number: 21, name: 'Ecclesiastes', testament: 'OT', chapters: 12 },
  { number: 22, name: 'Song of Solomon', testament: 'OT', chapters: 8 },
  { number: 23, name: 'Isaiah', testament: 'OT', chapters: 66 },
  { number: 24, name: 'Jeremiah', testament: 'OT', chapters: 52 },
  { number: 25, name: 'Lamentations', testament: 'OT', chapters: 5 },
  { number: 26, name: 'Ezekiel', testament: 'OT', chapters: 48 },
  { number: 27, name: 'Daniel', testament: 'OT', chapters: 12 },
  { number: 28, name: 'Hosea', testament: 'OT', chapters: 14 },
  { number: 29, name: 'Joel', testament: 'OT', chapters: 3 },
  { number: 30, name: 'Amos', testament: 'OT', chapters: 9 },
  { number: 31, name: 'Obadiah', testament: 'OT', chapters: 1 },
  { number: 32, name: 'Jonah', testament: 'OT', chapters: 4 },
  { number: 33, name: 'Micah', testament: 'OT', chapters: 7 },
  { number: 34, name: 'Nahum', testament: 'OT', chapters: 3 },
  { number: 35, name: 'Habakkuk', testament: 'OT', chapters: 3 },
  { number: 36, name: 'Zephaniah', testament: 'OT', chapters: 3 },
  { number: 37, name: 'Haggai', testament: 'OT', chapters: 2 },
  { number: 38, name: 'Zechariah', testament: 'OT', chapters: 14 },
  { number: 39, name: 'Malachi', testament: 'OT', chapters: 4 },
  { number: 40, name: 'Matthew', testament: 'NT', chapters: 28 },
  { number: 41, name: 'Mark', testament: 'NT', chapters: 16 },
  { number: 42, name: 'Luke', testament: 'NT', chapters: 24 },
  { number: 43, name: 'John', testament: 'NT', chapters: 21 },
  { number: 44, name: 'Acts', testament: 'NT', chapters: 28 },
  { number: 45, name: 'Romans', testament: 'NT', chapters: 16 },
  { number: 46, name: '1 Corinthians', testament: 'NT', chapters: 16 },
  { number: 47, name: '2 Corinthians', testament: 'NT', chapters: 13 },
  { number: 48, name: 'Galatians', testament: 'NT', chapters: 6 },
  { number: 49, name: 'Ephesians', testament: 'NT', chapters: 6 },
  { number: 50, name: 'Philippians', testament: 'NT', chapters: 4 },
  { number: 51, name: 'Colossians', testament: 'NT', chapters: 4 },
  { number: 52, name: '1 Thessalonians', testament: 'NT', chapters: 5 },
  { number: 53, name: '2 Thessalonians', testament: 'NT', chapters: 3 },
  { number: 54, name: '1 Timothy', testament: 'NT', chapters: 6 },
  { number: 55, name: '2 Timothy', testament: 'NT', chapters: 4 },
  { number: 56, name: 'Titus', testament: 'NT', chapters: 3 },
  { number: 57, name: 'Philemon', testament: 'NT', chapters: 1 },
  { number: 58, name: 'Hebrews', testament: 'NT', chapters: 13 },
  { number: 59, name: 'James', testament: 'NT', chapters: 5 },
  { number: 60, name: '1 Peter', testament: 'NT', chapters: 5 },
  { number: 61, name: '2 Peter', testament: 'NT', chapters: 3 },
  { number: 62, name: '1 John', testament: 'NT', chapters: 5 },
  { number: 63, name: '2 John', testament: 'NT', chapters: 1 },
  { number: 64, name: '3 John', testament: 'NT', chapters: 1 },
  { number: 65, name: 'Jude', testament: 'NT', chapters: 1 },
  { number: 66, name: 'Revelation', testament: 'NT', chapters: 22 },
] as const;
