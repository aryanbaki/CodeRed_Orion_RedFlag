/** Whole-document limits: reject oversized inputs rather than silently truncate. */
export const MAX_POLICY_CHARACTERS = 250_000;
export const MAX_POLICY_DOWNLOAD_BYTES = 2_000_000;
/** Unicode word boundaries also count scripts without whitespace separators. */
export function policyWordCount(text: string): number {
  const segments = new Intl.Segmenter(undefined, {granularity: 'word'}).segment(text);
  let count = 0;
  for (const segment of segments) if (segment.isWordLike) count++;
  return count;
}
