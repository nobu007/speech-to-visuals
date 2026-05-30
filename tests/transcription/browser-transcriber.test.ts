/**
 * REQ-177: BrowserTranscriber unit tests
 *
 * Validates Web Speech API integration, real-time recognition lifecycle
 * (start/stop/pause/resume), browser compatibility detection, and
 * file-based transcription with fallback.
 */

import { jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// Mock SpeechRecognition on globalThis before module import
// ---------------------------------------------------------------------------

let mockRecognitionInstance: {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: ((ev: Event) => void) | null;
  onresult: ((ev: { resultIndex: number; results: Array<{ isFinal: boolean; length: number; 0: { transcript: string; confidence: number } }> }) => void) | null;
  onerror: ((ev: { error: string; message: string }) => void) | null;
  onend: ((ev: Event) => void) | null;
  start: jest.Mock;
  stop: jest.Mock;
  abort: jest.Mock;
};

// Mock logger
jest.unstable_mockModule('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

let BrowserTranscriber: typeof import('../../src/transcription/browser-transcriber').BrowserTranscriber;
let gt: Record<string, unknown>;

beforeAll(async () => {
  gt = globalThis as Record<string, unknown>;

  // Set up mock SpeechRecognition before importing the module
  mockRecognitionInstance = {
    continuous: false,
    interimResults: false,
    lang: '',
    maxAlternatives: 1,
    onstart: null,
    onresult: null,
    onerror: null,
    onend: null,
    start: jest.fn(),
    stop: jest.fn(),
    abort: jest.fn(),
  };

  gt.SpeechRecognition = jest.fn(() => mockRecognitionInstance);

  const mod = await import('../../src/transcription/browser-transcriber');
  BrowserTranscriber = mod.BrowserTranscriber;
});

afterAll(() => {
  delete gt.SpeechRecognition;
});

beforeEach(() => {
  // Reset mock state before each test
  mockRecognitionInstance.start.mockReset();
  mockRecognitionInstance.stop.mockReset();
  mockRecognitionInstance.onstart = null;
  mockRecognitionInstance.onresult = null;
  mockRecognitionInstance.onerror = null;
  mockRecognitionInstance.onend = null;
});

// ---------------------------------------------------------------------------
// Constructor & initialization
// ---------------------------------------------------------------------------

describe('BrowserTranscriber', () => {
  describe('constructor and initialization', () => {
    it('initializes with Web Speech API when available', () => {
      const transcriber = new BrowserTranscriber();
      expect(transcriber.isSupported()).toBe(true);
    });

    it('configures recognition with continuous and interimResults', () => {
      new BrowserTranscriber();
      expect(mockRecognitionInstance.continuous).toBe(true);
      expect(mockRecognitionInstance.interimResults).toBe(true);
    });

    it('sets language to en-US by default', () => {
      new BrowserTranscriber();
      expect(mockRecognitionInstance.lang).toBe('en-US');
    });

    it('initial state is idle', () => {
      const transcriber = new BrowserTranscriber();
      expect(transcriber.getState()).toBe('idle');
    });
  });

  describe('start()', () => {
    it('starts recognition and transitions to listening state', () => {
      const transcriber = new BrowserTranscriber();
      transcriber.start();
      expect(mockRecognitionInstance.start).toHaveBeenCalled();
      expect(transcriber.getState()).toBe('listening');
    });

    it('throws TranscriptionError when recognition is not supported', () => {
      // Temporarily remove SpeechRecognition
      const saved = gt.SpeechRecognition;
      delete gt.SpeechRecognition;

      // Create a new instance without SpeechRecognition
      const unsupportedTranscriber = new (require('../../src/transcription/browser-transcriber').BrowserTranscriber)();
      expect(() => unsupportedTranscriber.start()).toThrow('Speech recognition not supported');

      gt.SpeechRecognition = saved;
    });

    it('does nothing if already listening', () => {
      const transcriber = new BrowserTranscriber();
      transcriber.start();
      mockRecognitionInstance.start.mockClear();
      transcriber.start(); // second call
      expect(mockRecognitionInstance.start).not.toHaveBeenCalled();
    });
  });

  describe('stop()', () => {
    it('stops recognition and returns to idle', () => {
      const transcriber = new BrowserTranscriber();
      transcriber.start();
      transcriber.stop();
      expect(mockRecognitionInstance.stop).toHaveBeenCalled();
      expect(transcriber.getState()).toBe('idle');
    });
  });

  describe('pause()', () => {
    it('pauses from listening state', () => {
      const transcriber = new BrowserTranscriber();
      transcriber.start();
      transcriber.pause();
      expect(transcriber.getState()).toBe('paused');
      expect(mockRecognitionInstance.stop).toHaveBeenCalled();
    });

    it('does nothing when not in listening state', () => {
      const transcriber = new BrowserTranscriber();
      transcriber.pause();
      expect(transcriber.getState()).toBe('idle');
    });
  });

  describe('resume()', () => {
    it('resumes from paused state', () => {
      const transcriber = new BrowserTranscriber();
      transcriber.start();
      transcriber.pause();
      mockRecognitionInstance.start.mockClear();
      transcriber.resume();
      expect(transcriber.getState()).toBe('listening');
      expect(mockRecognitionInstance.start).toHaveBeenCalled();
    });

    it('does nothing when not in paused state', () => {
      const transcriber = new BrowserTranscriber();
      transcriber.resume();
      expect(transcriber.getState()).toBe('idle');
    });
  });

  // ---------------------------------------------------------------------------
  // Callbacks
  // ---------------------------------------------------------------------------

  describe('onInterimResult', () => {
    it('fires callback for interim results', () => {
      const transcriber = new BrowserTranscriber();
      const callback = jest.fn();
      transcriber.onInterimResult(callback);

      const event = {
        resultIndex: 0,
        results: [{
          isFinal: false,
          length: 1,
          0: { transcript: 'hello', confidence: 0.5 },
        }],
      };
      mockRecognitionInstance.onresult!(event as never);
      expect(callback).toHaveBeenCalledWith('hello');
    });
  });

  describe('onFinalResult', () => {
    it('fires callback for final results with non-empty text', () => {
      const transcriber = new BrowserTranscriber();
      const callback = jest.fn();
      transcriber.onFinalResult(callback);

      const event = {
        resultIndex: 0,
        results: [{
          isFinal: true,
          length: 1,
          0: { transcript: '  hello world  ', confidence: 0.9 },
        }],
      };
      mockRecognitionInstance.onresult!(event as never);
      expect(callback).toHaveBeenCalledWith('hello world');
    });

    it('does not fire callback for empty final results', () => {
      const transcriber = new BrowserTranscriber();
      const callback = jest.fn();
      transcriber.onFinalResult(callback);

      const event = {
        resultIndex: 0,
        results: [{
          isFinal: true,
          length: 1,
          0: { transcript: '   ', confidence: 0.9 },
        }],
      };
      mockRecognitionInstance.onresult!(event as never);
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('onError', () => {
    it('fires callback on recognition error', () => {
      const transcriber = new BrowserTranscriber();
      const callback = jest.fn();
      transcriber.onError(callback);

      mockRecognitionInstance.onerror!({ error: 'network', message: 'Network error' });
      expect(callback).toHaveBeenCalledWith({
        error: 'network',
        message: 'Network error',
      });
    });

    it('sets state to error for not-allowed errors', () => {
      const transcriber = new BrowserTranscriber();
      transcriber.start();

      mockRecognitionInstance.onerror!({ error: 'not-allowed', message: 'Permission denied' });
      expect(transcriber.getState()).toBe('error');
    });

    it('sets state to error for audio-capture errors', () => {
      const transcriber = new BrowserTranscriber();
      transcriber.start();

      mockRecognitionInstance.onerror!({ error: 'audio-capture', message: 'No microphone' });
      expect(transcriber.getState()).toBe('error');
    });
  });

  describe('auto-restart on end', () => {
    it('restarts recognition when ending in listening state', () => {
      const transcriber = new BrowserTranscriber();
      transcriber.start();
      mockRecognitionInstance.start.mockClear();

      mockRecognitionInstance.onend!(new Event('end'));
      expect(mockRecognitionInstance.start).toHaveBeenCalled();
    });

    it('does not restart when not in listening state', () => {
      const transcriber = new BrowserTranscriber();
      transcriber.start();
      transcriber.stop();
      mockRecognitionInstance.start.mockClear();

      mockRecognitionInstance.onend!(new Event('end'));
      expect(mockRecognitionInstance.start).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Browser compatibility
  // ---------------------------------------------------------------------------

  describe('getBrowserCompatibility', () => {
    it('returns supported=true when API is available', () => {
      const transcriber = new BrowserTranscriber();
      const compat = transcriber.getBrowserCompatibility();
      expect(compat.supported).toBe(true);
    });

    it('detects Chrome browser', () => {
      const originalUserAgent = navigator.userAgent;
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 Chrome/120.0',
        configurable: true,
      });
      const transcriber = new BrowserTranscriber();
      const compat = transcriber.getBrowserCompatibility();
      expect(compat.browserName).toBe('Chrome');
      Object.defineProperty(navigator, 'userAgent', {
        value: originalUserAgent,
        configurable: true,
      });
    });
  });

  describe('getSupportedFeatures', () => {
    it('returns all features enabled when supported', () => {
      const transcriber = new BrowserTranscriber();
      const features = transcriber.getSupportedFeatures();
      expect(features.webSpeechAPI).toBe(true);
      expect(features.fileTranscription).toBe(true);
      expect(features.realtimeTranscription).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // File-based transcription (legacy)
  // ---------------------------------------------------------------------------

  describe('transcribeAudioFile', () => {
    it('returns fallback segments for string path input', async () => {
      const transcriber = new BrowserTranscriber();
      const result = await transcriber.transcribeAudioFile('test.wav');
      expect(result.segments.length).toBeGreaterThan(0);
      expect(result.language).toBe('en');
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('returns result with success=true for fallback path', async () => {
      const transcriber = new BrowserTranscriber();
      const result = await transcriber.transcribeAudioFile('test.wav');
      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThan(0);
    });
  });
});
