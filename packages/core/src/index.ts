export type {
  Bible,
  Book,
  Chapter,
  License,
  LoadedBook,
  SearchResult,
  Testament,
  TranslationMeta,
  TranslationVerse,
  Verse,
} from './types.js';

export { foldText, normalizeBookKey, parseReference, slugFromFilename } from './books.js';
export type { ParsedReference } from './books.js';

export { buildIndex, createBible } from './bible.js';

export {
  clearCache,
  getDataDir,
  listTranslations,
  loadMetadata,
  loadTranslation,
  setDataDir,
} from './loader.js';
