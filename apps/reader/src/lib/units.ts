/**
 * Sizes and progress, in the units a person reads.
 *
 * Kept free of `import.meta` and of anything browser-only so it can be tested
 * directly. The interesting cases here — a gzipped response whose
 * `Content-Length` is smaller than the bytes that actually arrive, an unknown
 * total — are precisely the ones a happy-path download over localhost never
 * produces, so testing them through the browser would prove nothing.
 */

/**
 * A download's completion, as a percentage that cannot lie.
 *
 * Clamped at both ends because the denominator is an estimate: `Content-Length`
 * is the *compressed* size when the response is gzipped while the body yields
 * decompressed bytes, so an unclamped ratio sails past 100% — and a progress
 * bar reading 180% is worse than no progress bar. An unknown total reports 0
 * rather than NaN or a fabricated number.
 */
export function downloadPercent(received: number, total: number): number {
  if (!(total > 0)) return 0;
  return Math.min(100, Math.max(0, (received / total) * 100));
}

/** Bytes, rounded to something worth reading. */
export function formatBytes(bytes: number): string {
  if (!bytes) return '—';
  const mb = bytes / 1048576;
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`;
}
