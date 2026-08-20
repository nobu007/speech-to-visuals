/**
 * Phase 67 Integration Tests: Transcription Typed Errors → ErrorClassifier
 *
 * REQ-176: TranscriptionError and FileSizeExceededError from the transcription
 * module (src/transcription/types.ts) round-trip through the ErrorClassifier
 * with correct classification, severity, and recoverability.
 *
 * The transcription module uses its own TranscriptionError (plain Error subclass)
 * rather than PipelineError, so classification relies on the ErrorClassifier's
 * regex-based fallback. This test verifies:
 * - Messages that match regex rules get correct classification
 * - Messages that don't match get UNKNOWN (acceptable fallback)
 * - All errors produce valid ClassifiedError structures
 * - FileSizeExceededError always classifies as FILE_SIZE_EXCEEDED
 */

import { jest } from '@jest/globals';
import type { ClassifiedError } from '@/quality/error-classifier';

// ---------- Imports ----------

let ErrorClassifier: typeof import('@/quality/error-classifier').ErrorClassifier;
let TranscriptionError: typeof import('@/transcription/types').TranscriptionError;
let FileSizeExceededError: typeof import('@/transcription/types').FileSizeExceededError;

beforeAll(async () => {
  const ecMod = await import('@/quality/error-classifier');
  ErrorClassifier = ecMod.ErrorClassifier;

  const typesMod = await import('@/transcription/types');
  TranscriptionError = typesMod.TranscriptionError;
  FileSizeExceededError = typesMod.FileSizeExceededError;
});

// ---------- Helpers ----------

function classifyThrownError(error: Error): ClassifiedError {
  let classified: ClassifiedError | undefined;
  try {
    throw error;
  } catch (err) {
    if (err instanceof Error) {
      classified = classifier.classify(err);
    }
  }
  if (classified === undefined) {
    throw new Error('classifier did not classify the thrown error');
  }
  return classified;
}

let classifier: InstanceType<typeof ErrorClassifier>;

// ---------- REQ-176: Transcription Typed Errors → ErrorClassifier ----------

describe('REQ-176: Transcription typed errors → ErrorClassifier regression', () => {
  beforeEach(() => {
    classifier = new ErrorClassifier();
  });

  // --- TranscriptionError: messages that match regex rules ---

  it('TranscriptionError "corrupted or not valid" classifies as FILE_FORMAT_INVALID', () => {
    const error = new TranscriptionError('Audio file appears to be corrupted or is not a valid audio format');
    const classified = classifier.classify(error);

    expect(classified.type).toBe('FILE_FORMAT_INVALID');
    expect(classified.severity).toBe('medium');
    expect(classified.recoverable).toBe(true);
    expect(classified.originalError).toBe(error);
  });

  it('TranscriptionError "Unsupported audio format" classifies as FILE_FORMAT_INVALID', () => {
    const error = new TranscriptionError('Unsupported audio format: .bmp. Supported formats: mp3, wav, ogg, m4a');
    const classified = classifier.classify(error);

    expect(classified.type).toBe('FILE_FORMAT_INVALID');
  });

  it('TranscriptionError "Unsupported audio input format" classifies as FILE_FORMAT_INVALID', () => {
    const error = new TranscriptionError('Unsupported audio input format');
    const classified = classifier.classify(error);

    expect(classified.type).toBe('FILE_FORMAT_INVALID');
  });

  it('TranscriptionError "Streaming transcription failed: Network error" classifies as NETWORK_ERROR', () => {
    const error = new TranscriptionError('Streaming transcription failed: Network error');
    const classified = classifier.classify(error);

    expect(classified.type).toBe('NETWORK_ERROR');
    expect(classified.severity).toBe('high');
    expect(classified.recoverable).toBe(true);
  });

  // --- TranscriptionError: messages that don't match regex rules (UNKNOWN fallback) ---

  it('TranscriptionError "Speech recognition not supported" classifies as UNKNOWN (no regex match)', () => {
    const error = new TranscriptionError('Speech recognition not supported in this browser');
    const classified = classifier.classify(error);

    expect(classified.type).toBe('UNKNOWN');
    expect(classified.recoverable).toBe(false);
    // Verify structure is still valid
    expect(classified.severity).toBeDefined();
    expect(classified.suggestedAction).toBeDefined();
    expect(classified.originalError).toBe(error);
  });

  it('TranscriptionError "Invalid audio path" classifies as UNKNOWN', () => {
    const error = new TranscriptionError('Invalid audio path provided');
    const classified = classifier.classify(error);

    expect(classified.type).toBe('UNKNOWN');
  });

  it('TranscriptionError "Audio file not found" classifies as UNKNOWN', () => {
    const error = new TranscriptionError('Audio file not found or not readable: /tmp/test.wav');
    const classified = classifier.classify(error);

    expect(classified.type).toBe('UNKNOWN');
  });

  it('TranscriptionError "Audio buffer is empty" classifies as UNKNOWN', () => {
    const error = new TranscriptionError('Audio buffer is empty (0 bytes)');
    const classified = classifier.classify(error);

    expect(classified.type).toBe('UNKNOWN');
  });

  it('TranscriptionError "Audio file is too small" classifies as UNKNOWN', () => {
    const error = new TranscriptionError('Audio file is too small to be a valid audio file (corrupted)');
    const classified = classifier.classify(error);

    expect(classified.type).toBe('UNKNOWN');
  });

  it('TranscriptionError "SRT generation requires" classifies as UNKNOWN', () => {
    const error = new TranscriptionError('SRT generation requires at least 2 segments.');
    const classified = classifier.classify(error);

    expect(classified.type).toBe('UNKNOWN');
  });

  // --- FileSizeExceededError: always classifies correctly ---

  it('FileSizeExceededError classifies as FILE_SIZE_EXCEEDED', () => {
    const error = new FileSizeExceededError(
      'File size (60000000 bytes) exceeds maximum allowed size (52428800 bytes)',
      60_000_000,
      52_428_800,
    );
    const classified = classifier.classify(error);

    expect(classified.type).toBe('FILE_SIZE_EXCEEDED');
    expect(classified.severity).toBe('medium');
    expect(classified.recoverable).toBe(true);
    expect(classified.originalError).toBe(error);
  });

  it('FileSizeExceededError for buffer size classifies as FILE_SIZE_EXCEEDED', () => {
    const error = new FileSizeExceededError(
      'File size (100000000 bytes) exceeds maximum allowed size (52428800 bytes)',
      100_000_000,
      52_428_800,
    );
    const classified = classifier.classify(error);

    expect(classified.type).toBe('FILE_SIZE_EXCEEDED');
  });

  it('FileSizeExceededError round-trip: throw → catch → classify', () => {
    const error = new FileSizeExceededError(
      'File size exceeds maximum allowed size',
      99_999_999,
      52_428_800,
    );
    const classified = classifyThrownError(error);

    expect(classified.type).toBe('FILE_SIZE_EXCEEDED');
    expect(classified.suggestedAction).toBeDefined();
    const originalErr = classified.originalError as InstanceType<typeof FileSizeExceededError>;
    expect(originalErr.fileSize).toBe(99_999_999);
    expect(originalErr.maxSize).toBe(52_428_800);
  });

  // --- Cross-cutting: all errors produce valid ClassifiedError ---

  it('all transcription errors produce valid ClassifiedError structure', () => {
    const errors = [
      new TranscriptionError('Speech recognition not supported in this browser'),
      new TranscriptionError('Invalid audio path provided'),
      new TranscriptionError('Audio file not found or not readable: /tmp/test.wav'),
      new TranscriptionError('SRT generation requires at least 2 segments.'),
      new TranscriptionError('Audio file appears to be corrupted or is not a valid audio format'),
      new TranscriptionError('Unsupported audio format: .bmp'),
      new TranscriptionError('Unsupported audio input format'),
      new TranscriptionError('Streaming transcription failed: Network error'),
      new FileSizeExceededError('File size exceeds maximum', 60_000_000, 52_428_800),
    ];

    for (const error of errors) {
      const classified = classifier.classify(error);
      expect(classified.type).toBeDefined();
      expect(classified.severity).toBeDefined();
      expect(classified.recoverable).toBeDefined();
      expect(classified.suggestedAction).toBeDefined();
      expect(classified.originalError).toBe(error);
    }
  });

  it('regex-matchable errors classify correctly', () => {
    // These messages are known to match regex rules
    const testCases = [
      { error: new TranscriptionError('Audio file appears to be corrupted or is not a valid audio format'), expectedType: 'FILE_FORMAT_INVALID' },
      { error: new TranscriptionError('Unsupported audio format: .bmp'), expectedType: 'FILE_FORMAT_INVALID' },
      { error: new TranscriptionError('Unsupported audio input format'), expectedType: 'FILE_FORMAT_INVALID' },
      { error: new TranscriptionError('Streaming transcription failed: Network error'), expectedType: 'NETWORK_ERROR' },
      { error: new FileSizeExceededError('File size exceeds maximum', 60_000_000, 52_428_800), expectedType: 'FILE_SIZE_EXCEEDED' },
    ] as const;

    for (const { error, expectedType } of testCases) {
      const classified = classifier.classify(error);
      expect(classified.type).toBe(expectedType);
    }
  });

  it('batch classification handles mixed transcription errors correctly', () => {
    const errors = [
      new FileSizeExceededError('File too large', 100_000_000, 52_428_800),
      new TranscriptionError('Streaming transcription failed: Network error'),
      new TranscriptionError('Audio file appears to be corrupted or is not a valid audio format'),
    ];

    const classified = classifier.classifyBatch(errors);

    expect(classified).toHaveLength(3);
    expect(classified[0].type).toBe('FILE_SIZE_EXCEEDED');
    expect(classified[1].type).toBe('NETWORK_ERROR');
    expect(classified[2].type).toBe('FILE_FORMAT_INVALID');
  });

  it('updates classification statistics after transcription errors', () => {
    classifier.classify(new TranscriptionError('Audio file appears to be corrupted or is not a valid audio format'));
    classifier.classify(new FileSizeExceededError('Too large', 80_000_000, 52_428_800));
    classifier.classify(new TranscriptionError('Streaming transcription failed: Network error'));

    const stats = classifier.getStatistics();

    expect(stats.total).toBe(3);
    expect(stats.byType['FILE_FORMAT_INVALID']).toBe(1);
    expect(stats.byType['FILE_SIZE_EXCEEDED']).toBe(1);
    expect(stats.byType['NETWORK_ERROR']).toBe(1);
  });
});
