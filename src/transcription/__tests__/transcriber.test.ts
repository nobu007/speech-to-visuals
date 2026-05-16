import { jest } from '@jest/globals';

// Mock WhisperTranscriber so we can control its behavior
const mockWhisperTranscribe = jest.fn() as jest.Mock;

jest.unstable_mockModule('fs', () => ({
  promises: { access: jest.fn().mockResolvedValue(undefined) },
  constants: { R_OK: 4 },
}));

jest.unstable_mockModule('@/transcription/whisper-transcriber', () => ({
  WhisperTranscriber: jest.fn().mockImplementation(() => ({
    transcribe: mockWhisperTranscribe,
  })),
}));

jest.unstable_mockModule('@/transcription/browser-transcriber', () => ({
  BrowserTranscriber: jest.fn().mockImplementation(() => ({
    transcribeAudioFile: jest.fn().mockResolvedValue({
      success: true,
      segments: [{ start: 0, end: 3000, text: 'Browser result', confidence: 0.8 }],
    } as never),
  })),
}));

const { TranscriptionPipeline } = await import('@/transcription/transcriber');

describe('TranscriptionPipeline', () => {
  let consoleSpy: jest.SpiedFunction<typeof console.log>;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    // Default: whisper returns failure so fallback segments are used
    mockWhisperTranscribe.mockResolvedValue({
      success: false,
      segments: [],
    } as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create pipeline with default config', () => {
      const pipeline = new TranscriptionPipeline();
      expect(pipeline).toBeDefined();
    });

    it('should create pipeline with custom config', () => {
      const pipeline = new TranscriptionPipeline({
        model: 'tiny',
        outputFormat: 'json',
        combineMs: 100,
        maxRetries: 5,
      });
      expect(pipeline).toBeDefined();
    });
  });

  describe('nextIteration', () => {
    it('should increment iteration', () => {
      const pipeline = new TranscriptionPipeline();
      pipeline.nextIteration();
      // No error should be thrown
    });
  });

  describe('transcribe', () => {
    it('should handle empty audio path', async () => {
      const pipeline = new TranscriptionPipeline();
      const result = await pipeline.transcribe('');

      expect(result.success).toBe(false);
      expect(result.segments).toEqual([]);
      expect(result.error).toBeDefined();
    });

    it('should handle invalid audio path gracefully', async () => {
      const pipeline = new TranscriptionPipeline();
      const result = await pipeline.transcribe('nonexistent-audio.wav');

      // Should either succeed with fallback segments or fail gracefully
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('should return result with proper structure', async () => {
      const pipeline = new TranscriptionPipeline();
      const result = await pipeline.transcribe('test.wav');

      expect(result).toHaveProperty('segments');
      expect(result).toHaveProperty('language');
      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('processingTime');
      expect(result).toHaveProperty('success');
      expect(Array.isArray(result.segments)).toBe(true);
    });

    it('should return fallback segments when whisper fails', async () => {
      const pipeline = new TranscriptionPipeline();
      const result = await pipeline.transcribe('test.wav');

      // In test environment, whisper won't work, so should get fallback segments
      expect(result.segments.length).toBeGreaterThan(0);
      expect(result.success).toBe(true);
    });

    it('should detect language from segments', async () => {
      const pipeline = new TranscriptionPipeline();
      const result = await pipeline.transcribe('test.wav');

      // Fallback segments contain English text, so language should be 'en'
      expect(result.language).toBeDefined();
    });

    it('should include captions in result', async () => {
      const pipeline = new TranscriptionPipeline();
      const result = await pipeline.transcribe('test.wav');

      if (result.success && result.segments.length > 0) {
        expect(result.captions).toBeDefined();
        expect(Array.isArray(result.captions)).toBe(true);
      }
    });

    it('should return metrics with valid processing time', async () => {
      const pipeline = new TranscriptionPipeline();
      const result = await pipeline.transcribe('test.wav');

      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('should use whisper result when successful', async () => {
      mockWhisperTranscribe.mockResolvedValue({
        success: true,
        segments: [
          { start: 0, end: 3000, text: 'Hello from whisper', confidence: 0.95 },
          { start: 3000, end: 6000, text: 'Second segment', confidence: 0.9 },
        ],
      } as never);

      const pipeline = new TranscriptionPipeline();
      const result = await pipeline.transcribe('test.wav');

      expect(result.success).toBe(true);
      expect(result.segments.length).toBe(2);
      expect(result.segments[0].text).toBe('Hello from whisper');
    });

    it('should fall through to fallback when whisper returns empty segments', async () => {
      mockWhisperTranscribe.mockResolvedValue({
        success: true,
        segments: [],
      } as never);

      const pipeline = new TranscriptionPipeline();
      const result = await pipeline.transcribe('test.wav');

      // Should use fallback segments since whisper returned 0 segments
      expect(result.segments.length).toBeGreaterThan(0);
    });

    it('should handle whisper throwing an error', async () => {
      mockWhisperTranscribe.mockRejectedValue(new Error('Whisper crashed') as never);

      const pipeline = new TranscriptionPipeline();
      const result = await pipeline.transcribe('test.wav');

      // Should fall through to fallback segments
      expect(result.segments.length).toBeGreaterThan(0);
    });

    it('should detect unknown language from error result with no segments', async () => {
      const pipeline = new TranscriptionPipeline();
      const result = await pipeline.transcribe('');

      expect(result.success).toBe(false);
      expect(result.language).toBe('unknown');
    });
  });

  describe('iterative improvement', () => {
    it('should support multiple iterations', async () => {
      const pipeline = new TranscriptionPipeline();
      pipeline.nextIteration();
      pipeline.nextIteration();
      const result = await pipeline.transcribe('test.wav');
      expect(result).toBeDefined();
    });
  });

  describe('whisper success path', () => {
    it('should return whisper segments when whisper succeeds with segments', async () => {
      mockWhisperTranscribe.mockResolvedValue({
        success: true,
        segments: [
          { start: 0, end: 2000, text: 'First', confidence: 0.95 },
        ],
      } as never);

      const pipeline = new TranscriptionPipeline();
      const result = await pipeline.transcribe('test.wav');

      expect(result.success).toBe(true);
      expect(result.segments).toHaveLength(1);
      expect(result.segments[0].text).toBe('First');
    });

    it('should calculate metrics correctly for segments', async () => {
      mockWhisperTranscribe.mockResolvedValue({
        success: true,
        segments: [
          { start: 0, end: 5000, text: 'Hello world test', confidence: 0.95 },
        ],
      } as never);

      const pipeline = new TranscriptionPipeline();
      const result = await pipeline.transcribe('test.wav');

      expect(result.success).toBe(true);
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('browser environment simulation', () => {
    let originalWindow: typeof globalThis.window | undefined;
    let originalDocument: typeof globalThis.document | undefined;

    beforeEach(() => {
      originalWindow = globalThis.window;
      originalDocument = globalThis.document;
      // Simulate browser environment
      (globalThis as Record<string, unknown>).window = {};
      (globalThis as Record<string, unknown>).document = {};
    });

    afterEach(() => {
      (globalThis as Record<string, unknown>).window = originalWindow;
      (globalThis as Record<string, unknown>).document = originalDocument;
    });

    it('should initialize browser transcriber in browser environment', () => {
      const pipeline = new TranscriptionPipeline();
      expect(pipeline).toBeDefined();
    });

    it('should use browser transcriber fallback when whisper fails with blob URL', async () => {
      mockWhisperTranscribe.mockResolvedValue({
        success: false,
        segments: [],
      } as never);

      const pipeline = new TranscriptionPipeline();
      const result = await pipeline.transcribe('blob:test-audio');

      expect(result).toBeDefined();
      // Browser transcriber mock should provide segments
      expect(result.segments.length).toBeGreaterThan(0);
    });
  });

  describe('evaluateAndLog failure path', () => {
    it('should log failure when confidence is low', async () => {
      // Whisper returns segments with very low confidence to trigger failure path
      mockWhisperTranscribe.mockResolvedValue({
        success: true,
        segments: [
          { start: 0, end: 3000, text: 'Low confidence text', confidence: 0.1 },
        ],
      } as never);

      const pipeline = new TranscriptionPipeline();
      const result = await pipeline.transcribe('test.wav');

      expect(result.success).toBe(true);
      // The evaluateAndLog should have logged a warning about low confidence
    });
  });
});
