/**
 * SRT (SubRip Text) Format Parser
 * Parses SRT caption files, converts timestamps to milliseconds and frame numbers,
 * and validates SRT format integrity.
 */

import { DEFAULT_FPS } from './scene-synchronizer';

/**
 * Custom error for SRT parsing failures
 */
export class SrtParseError extends Error {
  constructor(message: string, public readonly line?: number) {
    super(message);
    this.name = 'SrtParseError';
  }
}

/**
 * Parsed SRT caption with both time and frame representations
 */
export interface SrtCaption {
  /** SRT sequence index (1-based) */
  index: number;
  /** Start time in milliseconds */
  startMs: number;
  /** End time in milliseconds */
  endMs: number;
  /** Caption text (may contain newlines for multi-line) */
  text: string;
  /** Start frame number (rounded) */
  startFrame: number;
  /** End frame number (rounded) */
  endFrame: number;
}

/**
 * Convert an SRT timestamp string (HH:MM:SS,mmm) to milliseconds.
 *
 * @param timestamp - Timestamp in HH:MM:SS,mmm format
 * @returns Time in milliseconds
 * @throws {SrtParseError} If the timestamp format is invalid
 */
export function parseTimestamp(timestamp: string): number {
  const trimmed = timestamp.trim();

  // Validate format: HH:MM:SS,mmm
  const pattern = /^(\d{2}):(\d{2}):(\d{2}),(\d{3})$/;
  const match = trimmed.match(pattern);

  if (!match) {
    throw new SrtParseError(
      `Invalid SRT timestamp format: "${timestamp}". Expected HH:MM:SS,mmm`
    );
  }

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = parseInt(match[3], 10);
  const milliseconds = parseInt(match[4], 10);

  return hours * 3600000 + minutes * 60000 + seconds * 1000 + milliseconds;
}

/**
 * Convert milliseconds to frame number at a given FPS.
 *
 * @param ms - Time in milliseconds
 * @param fps - Frames per second
 * @returns Frame number (rounded to nearest integer)
 */
function msToFrame(ms: number, fps: number): number {
  return Math.round((ms / 1000) * Math.max(fps, 1));
}

/**
 * Parse an SRT content string into an array of SrtCaption objects.
 *
 * @param content - Raw SRT file content
 * @param fps - Frames per second for frame number mapping (default: 30)
 * @returns Array of parsed captions
 * @throws {SrtParseError} If the SRT content is malformed
 */
export function parseSrt(content: string, fps: number = DEFAULT_FPS): SrtCaption[] {
  const normalizedContent = content.replace(/\r\n/g, '\n').trim();

  if (normalizedContent.length === 0) {
    return [];
  }

  // Split into blocks separated by blank lines
  const blocks = normalizedContent.split(/\n\n+/).filter((block) => block.trim().length > 0);

  const captions: SrtCaption[] = [];

  for (const block of blocks) {
    const lines = block.trim().split('\n');

    // A valid SRT block must have at least 3 lines: index, timestamp, text
    if (lines.length < 3) {
      throw new SrtParseError(
        `Invalid SRT block: expected at least 3 lines (index, timestamp, text), got ${lines.length} lines`
      );
    }

    // Parse index (1-based sequence number)
    const indexLine = lines[0].trim();
    const index = parseInt(indexLine, 10);
    if (isNaN(index)) {
      throw new SrtParseError(`Invalid SRT index: "${indexLine}" is not a number`);
    }

    // Parse timestamp line: HH:MM:SS,mmm --> HH:MM:SS,mmm
    const timestampLine = lines[1].trim();
    const arrowParts = timestampLine.split('-->');
    if (arrowParts.length !== 2) {
      throw new SrtParseError(
        `Invalid SRT timestamp line: missing "-->" separator in "${timestampLine}"`
      );
    }

    const startMs = parseTimestamp(arrowParts[0].trim());
    const endMs = parseTimestamp(arrowParts[1].trim());

    // Validate time range
    if (endMs < startMs) {
      throw new SrtParseError(
        `Invalid SRT time range: end time (${endMs}ms) is before start time (${startMs}ms)`
      );
    }

    // Remaining lines are the caption text (may be multi-line)
    const text = lines.slice(2).join('\n').trim();

    if (text.length === 0) {
      throw new SrtParseError(`Invalid SRT block: caption text is empty for index ${index}`);
    }

    captions.push({
      index,
      startMs,
      endMs,
      text,
      startFrame: msToFrame(startMs, fps),
      endFrame: msToFrame(endMs, fps),
    });
  }

  return captions;
}
