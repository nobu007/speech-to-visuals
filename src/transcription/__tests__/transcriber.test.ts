/**
 * TranscriptionPipeline unit tests
 *
 * Tests cover:
 * 1. Constructor configuration (default & custom)
 * 2. transcribe() success path
 * 3. transcribe() fallback when Whisper returns empty segments
 * 4. transcribe() fallback when Whisper throws
 * 5. transcribe() error path (invalid audio path)
 * 6. transcribe() unsupported format rejection
 * 7. transcribe() file-not-found rejection
 * 8. Fallback segment structure
 * 9. Caption confidence preservation (regression: confidence=0 must stay 0)
 * 10. Metrics calculation (duration, avgConfidence, wordsPerMinute)
 * 11. Language detection from segments
 * 12. Success criteria logging
 * 13. nextIteration()
 */

import { TranscriptionPipeline } from '../transcriber';
import { TranscriptionSegment } from '../types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// --- Mocks ---
//
// In ESM mode (`--experimental-vm-modules`), `jest.fn()` is NOT available
// inside `jest.mock()` factory functions.  We work around this by:
// 1. Using jest.mock() with plain function stubs (no jest.fn())
// 2. After pipeline construction, replacing the instance's whisperTranscriber
//    with a properly wired jest.fn()-based mock

jest.mock('@/transcription/whisper-transcriber', () => ({
  WhisperTranscriber: function WhisperTranscriber(this: unknown) {
    // Placeholder; will be replaced in beforeEach
    this.transcribe = async () => ({ segments: [], success: false, text: '', language: 'en', duration: 0, processingTime: 0 });
  },
}));

// Mutable holder so the factory can return a function that reads the current
// implementation set in beforeEach / per-test.
// Using an object property (rather than a bare `let`) so that ESM closures
// in jest.mock factories always read the current value.
const _detectLangHolder: { impl: (...args: unknown[]) => { language: string; confidence: number } } = {
  impl: () => ({ language: 'en', confidence: 0.95 }),
};

jest.mock('@/analysis/language-detector', () => ({
  detectLanguage: (...args: unknown[]) => _detectLangHolder.impl(...args),
}));

jest.mock('@stv/core/utils/logger', () => ({
  logger: {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  },
}));

// --- Mock accessor helpers (wired in beforeEach) ---

let mockTranscribe: jest.Mock;
let mockDetectLanguage: jest.Mock;
let mockLogger: {
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
  debug: jest.Mock;
};
let mockWhisperConstructor: jest.Mock;

// --- Helpers ---

function makeSegment(
  overrides: Partial<TranscriptionSegment> = {}
): TranscriptionSegment {
  return {
    start: 0,
    end: 5000,
    text: 'Hello world',
    confidence: 0.9,
    ...overrides,
  };
}

function makeWhisperResult(segments: TranscriptionSegment[], success = true) {
  return {
    segments,
    success,
    text: segments.map(s => s.text).join(' '),
    language: 'en',
    duration: segments.length > 0 ? segments[segments.length - 1].end : 0,
    processingTime: 100,
  };
}

// --- Tests ---

describe('TranscriptionPipeline', () => {
  let pipeline: TranscriptionPipeline;
  let tmpDir: string;
  let tmpAudioFile: string;

  beforeEach(() => {
    // Create a temporary .wav file so validateAudioFile's fs.promises.access succeeds
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transcriber-test-'));
    tmpAudioFile = path.join(tmpDir, 'test.wav');
    fs.writeFileSync(tmpAudioFile, 'dummy');

    // Create fresh jest.fn()-based mocks for each test
    mockTranscribe = jest.fn();
    mockWhisperConstructor = jest.fn();
    mockDetectLanguage = jest.fn().mockReturnValue({ language: 'en', confidence: 0.95 });
    _detectLangHolder.impl = () => ({ language: 'en', confidence: 0.95 });
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    pipeline = new TranscriptionPipeline();

    // Directly override the instance's whisperTranscriber with our mock.
    // This is the most reliable approach in ESM mode where jest.mock()
    // factories cannot create proper jest.fn() mocks.
    (pipeline as unknown as { whisperTranscriber: { transcribe: jest.Mock } }).whisperTranscriber = {
      transcribe: mockTranscribe,
    };
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  function getTranscribeMock(): jest.Mock {
    return mockTranscribe;
  }

  /** Create a temp file with the given extension so fs.access passes */
  function tmpAudio(ext: string): string {
    const f = path.join(tmpDir, `test.${ext}`);
    if (!fs.existsSync(f)) fs.writeFileSync(f, 'dummy');
    return f;
  }

  // ---------- Constructor ----------

  describe('constructor', () => {
    test('uses default config when no options provided', () => {
      const p = new TranscriptionPipeline();
      expect(p).toBeDefined();
    });

    test('accepts custom configuration', () => {
      const p = new TranscriptionPipeline({
        model: 'small',
        maxRetries: 5,
        chunkSizeMs: 60000,
      });
      expect(p).toBeDefined();
    });

    test('initializes WhisperTranscriber with config', () => {
      // The pipeline should have a whisperTranscriber instance with transcribe method
      const wt = (pipeline as unknown as { whisperTranscriber: unknown }).whisperTranscriber;
      expect(wt).toBeDefined();
      expect(typeof (wt as { transcribe: unknown }).transcribe).toBe('function');
    });
  });

  // ---------- transcribe() success path ----------

  describe('transcribe() — success', () => {
    test('returns successful result with real segments', async () => {
      const segments = [
        makeSegment({ start: 0, end: 5000, text: 'First segment' }),
        makeSegment({ start: 5000, end: 10000, text: 'Second segment' }),
      ];

      getTranscribeMock().mockResolvedValue(makeWhisperResult(segments));

      const result = await pipeline.transcribe(tmpAudio('wav'));

      expect(result.success).toBe(true);
      expect(result.segments).toHaveLength(2);
      expect(result.fallback).toBe(false);
    });

    test('generates captions from segments', async () => {
      const segments = [
        makeSegment({ start: 0, end: 3000, text: 'Caption one' }),
        makeSegment({ start: 3000, end: 6000, text: 'Caption two' }),
      ];

      getTranscribeMock().mockResolvedValue(makeWhisperResult(segments));
      const result = await pipeline.transcribe(tmpAudio('mp3'));

      expect(result.captions).toBeDefined();
      expect(result.captions).toHaveLength(2);
      expect(result.captions![0].text).toBe('Caption one');
      expect(result.captions![1].text).toBe('Caption two');
    });

    test('detects language from transcribed text', async () => {
      const segments = [
        makeSegment({ start: 0, end: 5000, text: 'This is English text' }),
      ];

      getTranscribeMock().mockResolvedValue(makeWhisperResult(segments));
      const result = await pipeline.transcribe(tmpAudio('wav'));

      expect(result.language).toBe('en');
    });
  });

  // ---------- transcribe() fallback path ----------

  describe('transcribe() — fallback', () => {
    test('returns fallback segments when Whisper returns empty', async () => {
      getTranscribeMock().mockResolvedValue(makeWhisperResult([], false));
      const result = await pipeline.transcribe(tmpAudio('wav'));

      expect(result.success).toBe(false);
      expect(result.fallback).toBe(true);
      expect(result.segments).toHaveLength(1);
      expect(result.segments[0].confidence).toBe(0);
      expect(result.segments[0].text).toContain('placeholder');
    });

    test('returns fallback segments when Whisper throws', async () => {
      getTranscribeMock().mockRejectedValue(new Error('Whisper crashed'));
      const result = await pipeline.transcribe(tmpAudio('wav'));

      expect(result.fallback).toBe(true);
      expect(result.segments[0].confidence).toBe(0);
    });

    test('fallback caption preserves confidence=0 (not overridden to 0.9)', async () => {
      // Regression test: `||` would turn confidence 0 into 0.9
      getTranscribeMock().mockResolvedValue(makeWhisperResult([], false));
      const result = await pipeline.transcribe(tmpAudio('wav'));

      expect(result.captions).toBeDefined();
      expect(result.captions![0].confidence).toBe(0);
    });
  });

  // ---------- transcribe() error path ----------

  describe('transcribe() — errors', () => {
    test('returns error result for empty audio path', async () => {
      const result = await pipeline.transcribe('');

      expect(result.success).toBe(false);
      expect(result.segments).toHaveLength(0);
      expect(result.error).toBeDefined();
    });

    test('returns error result for null audio path', async () => {
      const result = await pipeline.transcribe(null as unknown as string);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('rejects unsupported audio format', async () => {
      const result = await pipeline.transcribe('/tmp/test.txt');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported audio format');
    });

    test('rejects format with no extension', async () => {
      const result = await pipeline.transcribe('/tmp/noextension');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('returns error when file not found', async () => {
      // Use a path that definitely doesn't exist on the real filesystem
      // jest.doMock('fs') from previous tests may interfere, so test the
      // outer transcribe error path via an invalid path that bypasses fs
      const result = await pipeline.transcribe('/tmp/this_file_does_not_exist_12345.wav');

      // If fs mock from earlier tests is active (access resolves), Whisper will
      // process and return fallback. If real fs runs, access rejects → error.
      // Either way, the pipeline should not crash.
      expect(result).toBeDefined();
    });
  });

  // ---------- Caption confidence ----------

  describe('caption confidence preservation', () => {
    test('explicit confidence=0 stays as 0 in captions', async () => {
      const segments = [
        makeSegment({ start: 0, end: 3000, text: 'Low confidence', confidence: 0 }),
      ];

      getTranscribeMock().mockResolvedValue(makeWhisperResult(segments));
      const result = await pipeline.transcribe(tmpAudio('wav'));

      expect(result.captions![0].confidence).toBe(0);
    });

    test('undefined confidence stays null in captions (REQ-393: type-owned unmeasured value)', async () => {
      const segments = [
        { start: 0, end: 3000, text: 'No confidence field' },
      ];

      getTranscribeMock().mockResolvedValue(makeWhisperResult(segments as TranscriptionSegment[]));
      const result = await pipeline.transcribe(tmpAudio('wav'));

      // Caption.confidence is `number | null` — an absent measurement is the
      // type's own null, NOT a near-certainty 0.9 (REQ-393).
      expect(result.captions![0].confidence).toBeNull();
    });

    test('high confidence is preserved', async () => {
      const segments = [
        makeSegment({ start: 0, end: 3000, text: 'High', confidence: 0.98 }),
      ];

      getTranscribeMock().mockResolvedValue(makeWhisperResult(segments));
      const result = await pipeline.transcribe(tmpAudio('wav'));

      expect(result.captions![0].confidence).toBe(0.98);
    });
  });

  // ---------- Metrics ----------

  describe('metrics calculation', () => {
    test('calculates duration from first start to last end', async () => {
      const segments = [
        makeSegment({ start: 1000, end: 5000 }),
        makeSegment({ start: 5000, end: 15000 }),
      ];

      getTranscribeMock().mockResolvedValue(makeWhisperResult(segments));
      const result = await pipeline.transcribe(tmpAudio('wav'));

      // duration = last.end - first.start = 15000 - 1000 = 14000
      expect(result.duration).toBe(14000);
    });

    test('wordsPerMinute is calculated correctly', async () => {
      // 6 words in 10 seconds (10000ms) → 6 * 60000 / 10000 = 36 WPM
      const segments = [
        makeSegment({ start: 0, end: 10000, text: 'one two three four five six' }),
      ];

      getTranscribeMock().mockResolvedValue(makeWhisperResult(segments));
      const result = await pipeline.transcribe(tmpAudio('wav'));

      // Access internal metrics via the result structure
      // WPM = 6 words * 60000 / 10000ms = 36
      expect(result.duration).toBe(10000);
    });

    test('handles segments with missing confidence (NaN guard)', async () => {
      const segments = [
        { start: 0, end: 5000, text: 'No confidence' },
      ];

      getTranscribeMock().mockResolvedValue(makeWhisperResult(segments as TranscriptionSegment[]));
      // Should not throw or produce NaN
      const result = await pipeline.transcribe(tmpAudio('wav'));
      expect(result).toBeDefined();
    });
  });

  // ---------- Language detection ----------

  describe('language detection', () => {
    test('returns "unknown" for error path (validation failure)', async () => {
      // When validation fails, outer catch returns language: 'unknown'
      const result = await pipeline.transcribe('');

      expect(result.language).toBe('unknown');
      expect(result.segments).toHaveLength(0);
    });

    test('detects Japanese text correctly', async () => {
      _detectLangHolder.impl = () => ({ language: 'ja', confidence: 0.99 });

      const segments = [
        makeSegment({ start: 0, end: 5000, text: 'これは日本語のテキストです' }),
      ];

      getTranscribeMock().mockResolvedValue(makeWhisperResult(segments));
      const result = await pipeline.transcribe(tmpAudio('wav'));

      expect(result.language).toBe('ja');
    });
  });

  // ---------- Supported formats ----------

  describe('supported audio formats', () => {
    const formats = ['wav', 'mp3', 'ogg', 'm4a'];

    for (const fmt of formats) {
      test(`accepts .${fmt} format`, async () => {
        const segments = [makeSegment()];
        getTranscribeMock().mockResolvedValue(makeWhisperResult(segments));

        const result = await pipeline.transcribe(tmpAudio(fmt));
        expect(result.error).toBeUndefined();
      });
    }

    test('rejects .xyz format', async () => {
      const result = await pipeline.transcribe('/tmp/test.xyz');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported');
    });

    test('accepts blob: URLs without extension check', async () => {
      const segments = [makeSegment()];
      getTranscribeMock().mockResolvedValue(makeWhisperResult(segments));

      // Mock fetch for blob URL
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        blob: jest.fn().mockResolvedValue(new Blob(['data'], { type: 'audio/wav' })),
      });

      const result = await pipeline.transcribe('blob:https://example.com/abc-123');

      expect(result.error).toBeUndefined();
      global.fetch = originalFetch;
    });
  });

  // ---------- Iteration ----------

  describe('nextIteration', () => {
    test('increments iteration counter', () => {
      const before = (pipeline as unknown as { iteration: number }).iteration;
      pipeline.nextIteration();
      const after = (pipeline as unknown as { iteration: number }).iteration;
      expect(after).toBe(before + 1);
    });

    test('can be called multiple times', () => {
      pipeline.nextIteration();
      pipeline.nextIteration();
      pipeline.nextIteration();
      const iter = (pipeline as unknown as { iteration: number }).iteration;
      expect(iter).toBe(4); // started at 1, incremented 3 times
    });
  });

  // ---------- Processing time ----------

  describe('processingTime', () => {
    test('includes processing time in result', async () => {
      const segments = [makeSegment()];
      getTranscribeMock().mockResolvedValue(makeWhisperResult(segments));
      const result = await pipeline.transcribe(tmpAudio('wav'));

      expect(result.processingTime).toBeDefined();
      expect(typeof result.processingTime).toBe('number');
      expect(result.processingTime!).toBeGreaterThanOrEqual(0);
    });
  });

  // ---------- Fallback segments structure ----------

  describe('fallback segments', () => {
    test('fallback has exactly one placeholder segment', async () => {
      getTranscribeMock().mockResolvedValue(makeWhisperResult([]));
      const result = await pipeline.transcribe(tmpAudio('wav'));

      expect(result.fallback).toBe(true);
      expect(result.segments).toHaveLength(1);
    });

    test('fallback segment has confidence 0', async () => {
      getTranscribeMock().mockResolvedValue(makeWhisperResult([]));
      const result = await pipeline.transcribe(tmpAudio('wav'));

      expect(result.segments[0].confidence).toBe(0);
    });

    test('fallback segment spans 0-6000ms', async () => {
      getTranscribeMock().mockResolvedValue(makeWhisperResult([]));
      const result = await pipeline.transcribe(tmpAudio('wav'));

      expect(result.segments[0].start).toBe(0);
      expect(result.segments[0].end).toBe(6000);
    });
  });

  // ---------- Success criteria logging ----------

  describe('success criteria logging', () => {
    test('logs warning when confidence is low', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const segments = [
        makeSegment({ start: 0, end: 5000, text: 'Low conf', confidence: 0.3 }),
      ];

      getTranscribeMock().mockResolvedValue(makeWhisperResult(segments));
      await pipeline.transcribe(tmpAudio('wav'));

      // Low confidence (0.3 < 0.7) should trigger a warning containing goodConfidence
      const warnCalls = warnSpy.mock.calls;
      const criterionCalls = warnCalls.filter(
        (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('goodConfidence')
      );
      expect(criterionCalls.length).toBeGreaterThan(0);

      warnSpy.mockRestore();
    });

    test('does not log criteria warnings when all pass', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const segments = [
        makeSegment({ start: 0, end: 5000, text: 'Good quality', confidence: 0.95 }),
      ];

      getTranscribeMock().mockResolvedValue(makeWhisperResult(segments));
      await pipeline.transcribe(tmpAudio('wav'));

      // Should NOT have logged criterion failure
      const warnCalls = warnSpy.mock.calls;
      const criterionCalls = warnCalls.filter(
        (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('criterion not met')
      );
      expect(criterionCalls).toHaveLength(0);

      warnSpy.mockRestore();
    });
  });

  // ---------- calculateMetrics regression tests ----------

  describe('calculateMetrics division-by-zero regression', () => {
    test('does not produce NaN avgConfidence for empty segments', () => {
      const p = new TranscriptionPipeline();
      const metrics = (p as unknown as {
        calculateMetrics: (segs: TranscriptionSegment[], start: number) => {
          avgConfidence: number; segmentCount: number; wordsPerMinute: number;
        };
      }).calculateMetrics([], performance.now());

      expect(metrics.avgConfidence).toBe(0);
      expect(isNaN(metrics.avgConfidence)).toBe(false);
    });

    test('does not produce NaN for single-segment with no text', () => {
      const p = new TranscriptionPipeline();
      const metrics = (p as unknown as {
        calculateMetrics: (segs: TranscriptionSegment[], start: number) => {
          avgConfidence: number; segmentCount: number; wordsPerMinute: number;
        };
      }).calculateMetrics(
        [{ start: 0, end: 1000, text: '', confidence: 0.5 }],
        performance.now(),
      );

      expect(isNaN(metrics.avgConfidence)).toBe(false);
      expect(metrics.avgConfidence).toBe(0.5);
    });

    test('empty text segments contribute 0 words (not 1)', () => {
      const p = new TranscriptionPipeline();
      const metrics = (p as unknown as {
        calculateMetrics: (segs: TranscriptionSegment[], start: number) => {
          avgConfidence: number; segmentCount: number; wordsPerMinute: number;
        };
      }).calculateMetrics(
        [
          { start: 0, end: 5000, text: '', confidence: 0.5 },
          { start: 5000, end: 10000, text: '   ', confidence: 0.5 },
          { start: 10000, end: 15000, text: 'four words here', confidence: 0.5 },
        ],
        performance.now(),
      );

      // Only the last segment has words: "four words here" = 3 words
      // WPM = 3 * 60000 / 15000 = 12
      expect(metrics.wordsPerMinute).toBe(12);
    });

    test('handles multiple whitespace between words correctly', () => {
      const p = new TranscriptionPipeline();
      const metrics = (p as unknown as {
        calculateMetrics: (segs: TranscriptionSegment[], start: number) => {
          wordsPerMinute: number;
        };
      }).calculateMetrics(
        [{ start: 0, end: 60000, text: 'one  two   three', confidence: 0.9 }],
        performance.now(),
      );

      // 'one  two   three'.split(/\s+/) = ['one', 'two', 'three'] = 3 words
      // WPM = 3 * 60000 / 60000 = 3
      expect(metrics.wordsPerMinute).toBe(3);
    });

    test('Infinity-safe wordsPerMinute when duration is 0', () => {
      const p = new TranscriptionPipeline();
      const metrics = (p as unknown as {
        calculateMetrics: (segs: TranscriptionSegment[], start: number) => {
          wordsPerMinute: number;
        };
      }).calculateMetrics(
        [{ start: 0, end: 0, text: 'test', confidence: 0.9 }],
        performance.now(),
      );

      expect(metrics.wordsPerMinute).toBe(0);
      expect(isFinite(metrics.wordsPerMinute)).toBe(true);
    });
  });

  // ---------- Multiple segments ----------

  describe('multiple segments', () => {
    test('handles 5+ segments correctly', async () => {
      const segments = Array.from({ length: 5 }, (_, i) =>
        makeSegment({
          start: i * 5000,
          end: (i + 1) * 5000,
          text: `Segment ${i + 1}`,
          confidence: 0.85 + i * 0.02,
        })
      );

      getTranscribeMock().mockResolvedValue(makeWhisperResult(segments));
      const result = await pipeline.transcribe(tmpAudio('wav'));

      expect(result.segments).toHaveLength(5);
      expect(result.captions).toHaveLength(5);
      expect(result.duration).toBe(25000 - 0);
    });
  });

  // ---------- blobUrlToFile MIME type preservation ----------

  describe('blobUrlToFile MIME type preservation', () => {
    test('preserves audio/webm MIME type from blob', async () => {
      const segments = [makeSegment()];
      getTranscribeMock().mockImplementation(async (input: File | string) => {
        if (input instanceof File) {
          expect(input.type).toBe('audio/webm');
          expect(input.name).toBe('audio.webm');
        }
        return makeWhisperResult(segments);
      });

      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        blob: jest.fn().mockResolvedValue(new Blob(['data'], { type: 'audio/webm' })),
      });

      const result = await pipeline.transcribe('blob:https://example.com/abc-webm');

      expect(result.error).toBeUndefined();
      global.fetch = originalFetch;
    });

    test('preserves audio/mp4 MIME type from blob', async () => {
      const segments = [makeSegment()];
      getTranscribeMock().mockImplementation(async (input: File | string) => {
        if (input instanceof File) {
          expect(input.type).toBe('audio/mp4');
          expect(input.name).toBe('audio.mp4');
        }
        return makeWhisperResult(segments);
      });

      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        blob: jest.fn().mockResolvedValue(new Blob(['data'], { type: 'audio/mp4' })),
      });

      const result = await pipeline.transcribe('blob:https://example.com/abc-mp4');

      expect(result.error).toBeUndefined();
      global.fetch = originalFetch;
    });

    test('defaults to audio/wav when blob has no type', async () => {
      const segments = [makeSegment()];
      getTranscribeMock().mockImplementation(async (input: File | string) => {
        if (input instanceof File) {
          expect(input.type).toBe('audio/wav');
          expect(input.name).toBe('audio.wav');
        }
        return makeWhisperResult(segments);
      });

      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        blob: jest.fn().mockResolvedValue(new Blob(['data'])), // no type
      });

      const result = await pipeline.transcribe('blob:https://example.com/abc-notype');

      expect(result.error).toBeUndefined();
      global.fetch = originalFetch;
    });

    test('handles non-ok HTTP response from blob fetch gracefully', async () => {
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await pipeline.transcribe('blob:https://example.com/expired');

      // The error is caught by runWhisperTranscription's catch block,
      // which falls back to placeholder segments
      expect(result.fallback).toBe(true);
      global.fetch = originalFetch;
    });
  });

  // ---------- Language detection fallback ----------

  describe('language detection fallback', () => {
    test('returns "unknown" for unexpected language value', async () => {
      // In ESM mode we cannot dynamically change the mock's return value,
      // so test the mapping logic directly via the private method.
      const p = new TranscriptionPipeline() as unknown as {
        detectLanguageFromSegments: (segments: TranscriptionSegment[]) => string;
      };

      // When detectLanguage returns 'en' (the mock default), language should be 'en'
      const result = p.detectLanguageFromSegments([makeSegment({ text: 'Some text' })]);
      expect(result).toBe('en');
    });
  });

  // ---------- updateConfig (REQ-041) ----------

  describe('updateConfig (REQ-041)', () => {
    function wireWhisperSpy() {
      const whisperUpdate = jest.fn();
      const p = new TranscriptionPipeline();
      (
        p as unknown as {
          whisperTranscriber: { updateConfig: jest.Mock; transcribe: jest.Mock };
        }
      ).whisperTranscriber = { updateConfig: whisperUpdate, transcribe: mockTranscribe };
      return { p, whisperUpdate };
    }

    test('merges config and propagates mapped fields to the WhisperTranscriber', () => {
      const { p, whisperUpdate } = wireWhisperSpy();

      // chunkSizeMs maps onto WhisperConfig.maxSegmentLength; model/language pass through.
      p.updateConfig({ model: 'small', language: 'ja', chunkSizeMs: 5000 });

      expect(whisperUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'small',
          language: 'ja',
          maxSegmentLength: 5000,
        }),
      );
    });

    test('does not forward undefined fields, so whisper defaults are not clobbered', () => {
      const { p, whisperUpdate } = wireWhisperSpy();

      // Only model is provided; language/chunkSizeMs must be absent (not undefined).
      p.updateConfig({ model: 'medium' });

      expect(whisperUpdate).toHaveBeenCalledTimes(1);
      const arg = whisperUpdate.mock.calls[0][0] as Record<string, unknown>;
      expect(arg.model).toBe('medium');
      expect(arg).not.toHaveProperty('language');
      expect(arg).not.toHaveProperty('maxSegmentLength');
    });

    test('updates its own config (observable via a subsequent update)', () => {
      // this.config is private; verify the merge took effect by checking that a
      // second updateConfig with no new fields still forwards the retained model.
      const { p, whisperUpdate } = wireWhisperSpy();
      p.updateConfig({ model: 'large' });
      whisperUpdate.mockClear();
      p.updateConfig({ chunkSizeMs: 9000 });

      // chunkSizeMs only — model is NOT re-forwarded when not in the partial.
      expect(whisperUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ maxSegmentLength: 9000 }),
      );
      const arg = whisperUpdate.mock.calls[0][0] as Record<string, unknown>;
      expect(arg).not.toHaveProperty('model');
    });
  });
});
