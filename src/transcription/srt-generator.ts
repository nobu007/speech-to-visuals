import type { TranscriptionSegment } from './types';
import { TranscriptionError } from './types';

/**
 * Format a millisecond value as an SRT timestamp string (HH:MM:SS,mmm).
 *
 * - Hours are zero-padded to 2 digits (supports values >= 24h).
 * - Negative values are clamped to 0.
 */
export function formatTimestamp(ms: number): string {
  const clamped = Math.max(0, ms);

  const totalSeconds = Math.floor(clamped / 1000);
  const milliseconds = clamped % 1000;
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  const mmm = String(milliseconds).padStart(3, '0');

  return `${hh}:${mm}:${ss},${mmm}`;
}

/**
 * Validate a single TranscriptionSegment.
 *
 * @throws {Error} If start > end or text is empty/whitespace-only.
 */
function validateSegment(segment: TranscriptionSegment): void {
  if (segment.start > segment.end) {
    throw new TranscriptionError(
      `Invalid segment: start (${segment.start}) must not exceed end (${segment.end}).`,
    );
  }

  if (!segment.text || segment.text.trim().length === 0) {
    throw new TranscriptionError('Invalid segment: text must not be empty.');
  }
}

/**
 * Generate an SRT caption string from an array of TranscriptionSegments.
 *
 * Each segment is rendered as:
 * ```
 * <sequence number>
 * <start timestamp> --> <end timestamp>
 * <text>
 * <blank line>
 * ```
 *
 * - Sequence numbers start at 1 and increment sequentially.
 * - An empty input array returns an empty string.
 */
export function generateSrt(segments: TranscriptionSegment[]): string {
  if (segments.length === 0) {
    return '';
  }

  const blocks: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    validateSegment(segment);

    const index = i + 1;
    const startTs = formatTimestamp(segment.start);
    const endTs = formatTimestamp(segment.end);

    blocks.push(`${index}\n${startTs} --> ${endTs}\n${segment.text}`);
  }

  // Join blocks with a blank line and append a trailing newline
  return blocks.join('\n\n') + '\n';
}
