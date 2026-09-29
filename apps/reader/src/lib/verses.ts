/**
 * What goes between two verses when a chapter is read as running text.
 *
 * A verse is its own element, and with each on a line of its own nothing is
 * needed. Run together, English would read "the beginning.And the earth", so
 * each verse's text is followed by a real space — a text node, kept when the
 * passage is copied, where CSS generated content would not be. Japanese and
 * Chinese put no space between sentences, and a gap there reads as a mistake.
 * With each verse on its own line the trailing space collapses to nothing.
 */
const NO_SPACE = new Set(['ja', 'zh']);

export function verseSeparator(language: string): string {
  return NO_SPACE.has(language.split('-')[0].toLowerCase()) ? '' : ' ';
}
