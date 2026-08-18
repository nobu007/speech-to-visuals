/**
 * REQ-179: StreamingTranscriber unit tests
 *
 * Validates streaming recognition, chunk processing, error recovery,
 * quality monitoring integration, and configuration management.
 */

import { jest } from '@jest/globals';

// Mock logger
jest.unstable_mockModule('@stv/core/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock StreamingQualityMonitor
jest.unstable_mockModule('@/transcription/streaming-quality-monitor', () => ({
  StreamingQualityMonitor: jest.fn().mockImplementation(() => ({
    evaluateChunk: jest.fn().mockReturnValue({ accepted: true, confidence: 0.8, chunkIndex: 0 }),
    onAlert: jest.fn(),
    getSummary: jest.fn().mockReturnValue({
      totalChunks: 0,
      acceptedChunks: 0,
      rejectedChunks: 0,
      averageConfidence: 0,
      alerts: [],
    }),
  })),
  DEFAULT_STREAMING_QUALITY_CONFIG: {
    minChunkConfidence: 0.7,
    maxAlerts: 50,
  },
}));

// Mock window.Audio for getAudioDuration
const mockAudioOnloadedmetadata = jest.fn();
const mockAudioOnerror = jest.fn();

class MockAudio {
  src = '';
  onloadedmetadata: (() => void) | null = null;
  onerror: (() => void) | null = null;
  duration = 10; // default 10 seconds

  constructor() {
    // Store callbacks for manual triggering
    Object.defineProperty(this, '_onloadedmetadata', { value: mockAudioOnloadedmetadata });
    Object.defineProperty(this, '_onerror', { value: mockAudioOnerror });
  }

  play() { return Promise.resolve(); }
}

const originalWindow = globalThis.window;
const originalAudio = globalThis.Audio;

beforeAll(() => {
  // No SpeechRecognition available — the 'in' check should not find it
  (globalThis as Record<string, unknown>).window = {};
  (globalThis as Record<string, unknown>).Audio = MockAudio;
});

afterAll(() => {
  (globalThis as Record<string, unknown>).window = originalWindow;
  (globalThis as Record<string, unknown>).Audio = originalAudio;
});

let StreamingTranscriber: typeof import('../../src/transcription/streaming-transcriber').StreamingTranscriber;

beforeAll(async () => {
  const mod = await import('../../src/transcription/streaming-transcriber');
  StreamingTranscriber = mod.StreamingTranscriber;
});

// ---------------------------------------------------------------------------
// Constructor & validation
// ---------------------------------------------------------------------------

describe('StreamingTranscriber', () => {
  describe('constructor parameter validation', () => {
    it('creates instance with default config', () => {
      const transcriber = new StreamingTranscriber();
      expect(transcriber).toBeDefined();
      expect(transcriber.isStreamingActive()).toBe(false);
    });

    it('creates instance with valid custom config', () => {
      const transcriber = new StreamingTranscriber({
        chunkSizeMs: 5000,
        overlapMs: 1000,
        minConfidence: 0.8,
        enableLiveUpdate: true,
      });
      expect(transcriber).toBeDefined();
    });

    it('throws TranscriptionError for chunkSizeMs <= 0', () => {
      expect(() => new StreamingTranscriber({ chunkSizeMs: 0 }))
        .toThrow('chunkSizeMs must be > 0 and <= 60000');
      expect(() => new StreamingTranscriber({ chunkSizeMs: -100 }))
        .toThrow('chunkSizeMs must be > 0 and <= 60000');
    });

    it('throws TranscriptionError for chunkSizeMs > 60000', () => {
      expect(() => new StreamingTranscriber({ chunkSizeMs: 70000 }))
        .toThrow('chunkSizeMs must be > 0 and <= 60000');
    });

    it('throws TranscriptionError for minConfidence < 0', () => {
      expect(() => new StreamingTranscriber({ minConfidence: -0.1 }))
        .toThrow('minConfidence must be between 0 and 1');
    });

    it('throws TranscriptionError for minConfidence > 1', () => {
      expect(() => new StreamingTranscriber({ minConfidence: 1.5 }))
        .toThrow('minConfidence must be between 0 and 1');
    });

    it('throws TranscriptionError for negative overlapMs', () => {
      expect(() => new StreamingTranscriber({ overlapMs: -100 }))
        .toThrow('overlapMs must be >= 0');
    });

    it('throws TranscriptionError for overlapMs >= chunkSizeMs', () => {
      expect(() => new StreamingTranscriber({ chunkSizeMs: 3000, overlapMs: 3000 }))
        .toThrow('overlapMs (3000) must be less than chunkSizeMs (3000)');
    });

    it('accepts overlapMs of 0', () => {
      const transcriber = new StreamingTranscriber({ overlapMs: 0 });
      expect(transcriber).toBeDefined();
    });

    it('accepts boundary values: chunkSizeMs=1, overlapMs=0, minConfidence=0', () => {
      const transcriber = new StreamingTranscriber({
        chunkSizeMs: 1,
        overlapMs: 0,
        minConfidence: 0,
      });
      expect(transcriber).toBeDefined();
    });

    it('accepts boundary values: chunkSizeMs=60000, minConfidence=1', () => {
      const transcriber = new StreamingTranscriber({
        chunkSizeMs: 60000,
        minConfidence: 1,
      });
      expect(transcriber).toBeDefined();
    });
  });

  describe('getConfig', () => {
    it('returns current config with defaults applied', () => {
      const transcriber = new StreamingTranscriber();
      const config = transcriber.getConfig();
      expect(config.chunkSizeMs).toBe(3000);
      expect(config.overlapMs).toBe(500);
      expect(config.minConfidence).toBe(0.7);
      expect(config.enableLiveUpdate).toBe(true);
    });

    it('returns a copy of config (not the internal reference)', () => {
      const transcriber = new StreamingTranscriber();
      const config1 = transcriber.getConfig();
      const config2 = transcriber.getConfig();
      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2);
    });
  });

  describe('updateConfig', () => {
    it('merges new config with existing config', () => {
      const transcriber = new StreamingTranscriber();
      transcriber.updateConfig({ minConfidence: 0.9 });
      expect(transcriber.getConfig().minConfidence).toBe(0.9);
      // Other defaults preserved
      expect(transcriber.getConfig().chunkSizeMs).toBe(3000);
    });
  });

  // ---------------------------------------------------------------------------
  // isStreamingActive
  // ---------------------------------------------------------------------------

  describe('isStreamingActive', () => {
    it('returns false initially', () => {
      const transcriber = new StreamingTranscriber();
      expect(transcriber.isStreamingActive()).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Quality monitoring API (REQ-091)
  // ---------------------------------------------------------------------------

  describe('quality monitoring', () => {
    it('getQualitySummary returns null when monitor not initialized', () => {
      const transcriber = new StreamingTranscriber({ enableQualityMonitoring: false });
      expect(transcriber.getQualitySummary()).toBeNull();
    });

    it('getQualityMonitor returns null when not initialized', () => {
      const transcriber = new StreamingTranscriber({ enableQualityMonitoring: false });
      expect(transcriber.getQualityMonitor()).toBeNull();
    });

    it('getQualityMonitor returns monitor when enabled', () => {
      const transcriber = new StreamingTranscriber();
      const monitor = transcriber.getQualityMonitor();
      expect(monitor).toBeDefined();
      expect(monitor).not.toBeNull();
    });

    it('getQualitySummary returns summary from monitor', () => {
      const transcriber = new StreamingTranscriber();
      const summary = transcriber.getQualitySummary();
      expect(summary).toBeDefined();
    });

    it('onQualityAlert delegates to monitor', () => {
      const transcriber = new StreamingTranscriber();
      const callback = jest.fn();
      // Should not throw
      transcriber.onQualityAlert(callback);
    });
  });

  // ---------------------------------------------------------------------------
  // Live transcription
  // ---------------------------------------------------------------------------

  describe('startLiveTranscription', () => {
    it('throws TranscriptionError when recognition is not available', async () => {
      const transcriber = new StreamingTranscriber();
      await expect(transcriber.startLiveTranscription())
        .rejects.toThrow('Speech recognition not supported');
    });
  });

  describe('stopLiveTranscription', () => {
    it('does nothing when not streaming', () => {
      const transcriber = new StreamingTranscriber();
      expect(() => transcriber.stopLiveTranscription()).not.toThrow();
    });
  });
});
