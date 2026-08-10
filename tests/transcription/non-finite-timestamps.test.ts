/**
 * Regression tests for non-finite timestamp and confidence value handling
 * in SRT generation, Whisper transcription, and streaming transcription.
 *
 * Verifies that NaN, Infinity, and -Infinity in timestamp/confidence fields
 * produce safe fallbacks rather than corrupting output or crashing.
 */

import { formatTimestamp, generateSrt } from '../../src/transcription/srt-generator';
import { TranscriptionError } from '../../src/transcription/types';

describe('Non-finite timestamp guards', () => {
  // -------------------------------------------------------------------------
  // srt-generator.ts: formatTimestamp
  // -------------------------------------------------------------------------

  describe('formatTimestamp', () => {
    test('should return safe fallback for NaN', () => {
      expect(formatTimestamp(NaN)).toBe('00:00:00,000');
    });

    test('should return safe fallback for Infinity', () => {
      expect(formatTimestamp(Infinity)).toBe('00:00:00,000');
    });

    test('should return safe fallback for -Infinity', () => {
      expect(formatTimestamp(-Infinity)).toBe('00:00:00,000');
    });

    test('should clamp negative finite values to 0', () => {
      expect(formatTimestamp(-500)).toBe('00:00:00,000');
    });

    test('should format valid timestamps correctly', () => {
      expect(formatTimestamp(0)).toBe('00:00:00,000');
      expect(formatTimestamp(1500)).toBe('00:00:01,500');
      expect(formatTimestamp(3661500)).toBe('01:01:01,500');
    });
  });

  // -------------------------------------------------------------------------
  // srt-generator.ts: generateSrt / validateSegment
  // -------------------------------------------------------------------------

  describe('generateSrt with non-finite timestamps', () => {
    test('should throw TranscriptionError for NaN start', () => {
      expect(() =>
        generateSrt([
          { start: NaN, end: 1000, text: 'test' } as never],
        ),
      ).toThrow(TranscriptionError);
    });

    test('should throw TranscriptionError for Infinity end', () => {
      expect(() =>
        generateSrt([
          { start: 0, end: Infinity, text: 'test' } as never],
        ),
      ).toThrow(TranscriptionError);
    });

    test('should throw TranscriptionError for -Infinity start', () => {
      expect(() =>
        generateSrt([
          { start: -Infinity, end: 1000, text: 'test' } as never],
        ),
      ).toThrow(TranscriptionError);
    });

    test('should handle normal segments without error', () => {
      const srt = generateSrt([
        { start: 0, end: 1000, text: 'hello' },
        { start: 1000, end: 2000, text: 'world' },
      ] as never);
      expect(srt).toContain('hello');
      expect(srt).toContain('world');
    });
  });

  // -------------------------------------------------------------------------
  // whisper-transcriber.ts: generateSrt (delegates to the shared
  // srt-generator.formatTimestamp — the canonical ms→"HH:MM:SS,mmm" formatter)
  // -------------------------------------------------------------------------

  describe('WhisperTranscriber.generateSrt non-finite + negative guard', () => {
    let WhisperTranscriber: typeof import('../../src/transcription/whisper-transcriber').WhisperTranscriber;

    beforeAll(async () => {
      ({ WhisperTranscriber } = await import('../../src/transcription/whisper-transcriber'));
    });

    test('should produce safe timestamp for NaN start/end', () => {
      const t = new WhisperTranscriber();
      const srt = t.generateSrt([
        { start: NaN, end: Infinity, text: 'broken' } as never,
      ]);
      // Non-finite values should produce '00:00:00,000' not 'NaN:NaN:NaN,NaN'
      expect(srt).not.toContain('NaN');
    });

    // Regression: the canonical srt-generator.formatTimestamp clamps negative
    // finite timestamps to '00:00:00,000' (test('should clamp negative finite
    // values to 0') above). WhisperTranscriber previously kept a private,
    // drifted copy of the SRT formatter that lacked that clamp, so a negative
    // start/end emitted sign-bearing garbage such as '-1:-1:-1,-500'. The two
    // formatters must agree: negative finite values clamp to 0 here too.
    test('should clamp negative finite start/end to 0 (parity with srt-generator)', () => {
      const t = new WhisperTranscriber();
      const srt = t.generateSrt([
        { start: -500, end: 1500, text: 'rewound' } as never,
      ]);
      expect(srt).toContain('00:00:00,000 --> 00:00:01,500');
      // The timestamp line must match the strict HH:MM:SS,mmm form with no
      // leading sign (a negative would render as e.g. "-1:-1:-1,-500").
      expect(srt).toMatch(
        /^\d+\n\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}\nrewound$/,
      );
    });
  });

  // -------------------------------------------------------------------------
  // whisper-transcriber.ts: validateAndEnhanceSegments confidence guard
  // -------------------------------------------------------------------------

  describe('WhisperTranscriber validateAndEnhanceSegments NaN confidence', () => {
    let WhisperTranscriber: typeof import('../../src/transcription/whisper-transcriber').WhisperTranscriber;

    beforeAll(async () => {
      ({ WhisperTranscriber } = await import('../../src/transcription/whisper-transcriber'));
    });

    test('should coerce NaN confidence to 0.8 minimum', async () => {
      const t = new WhisperTranscriber();
      // Access private method via any cast for testing
      const result = await (t as any).validateAndEnhanceSegments([
        { id: 0, start: 0, end: 1000, text: 'test', confidence: NaN },
      ]);
      expect(result).toHaveLength(1);
      expect(Number.isFinite(result[0].confidence)).toBe(true);
      expect(result[0].confidence).toBeGreaterThanOrEqual(0.8);
    });

    test('should coerce Infinity confidence to finite value', async () => {
      const t = new WhisperTranscriber();
      const result = await (t as any).validateAndEnhanceSegments([
        { id: 0, start: 0, end: 1000, text: 'test', confidence: Infinity },
      ]);
      expect(result).toHaveLength(1);
      expect(Number.isFinite(result[0].confidence)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // whisper-transcriber.ts: calculateDuration non-finite guard
  // -------------------------------------------------------------------------

  describe('WhisperTranscriber calculateDuration non-finite guard', () => {
    let WhisperTranscriber: typeof import('../../src/transcription/whisper-transcriber').WhisperTranscriber;

    beforeAll(async () => {
      ({ WhisperTranscriber } = await import('../../src/transcription/whisper-transcriber'));
    });

    test('should return 0 when last segment end is NaN', () => {
      const t = new WhisperTranscriber();
      const result = (t as any).calculateDuration([
        { start: 0, end: 1000 },
        { start: 1000, end: NaN },
      ]);
      expect(result).toBe(0);
    });

    test('should return 0 when last segment end is Infinity', () => {
      const t = new WhisperTranscriber();
      const result = (t as any).calculateDuration([
        { start: 0, end: 1000 },
        { start: 1000, end: Infinity },
      ]);
      expect(result).toBe(0);
    });

    test('should return valid duration for finite values', () => {
      const t = new WhisperTranscriber();
      const result = (t as any).calculateDuration([
        { start: 0, end: 1000 },
        { start: 1000, end: 5000 },
      ]);
      expect(result).toBe(5000);
    });
  });
});
