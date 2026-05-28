/**
 * REQ-177: BrowserTranscriber Unit Tests
 *
 * Tests core functionality of browser-transcriber.ts:
 * - Web Speech API integration
 * - Real-time recognition (start/stop/pause/resume)
 * - Browser compatibility detection
 * - Callback registration and invocation
 * - Error handling
 */

import { jest } from '@jest/globals';
import type { TranscriptionState, BrowserCompatibility, TranscriptionError as TranscriptionErrorInfo } from '@/transcription/browser-transcriber';

// ---------- Mock setup ----------

let mockRecognitionInstance: {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: ((ev: Event) => void) | null;
  onresult: ((ev: unknown) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  onend: ((ev: Event) => void) | null;
  start: jest.Mock;
  stop: jest.Mock;
  abort: jest.Mock;
};

const createMockRecognition = () => {
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
  return mockRecognitionInstance;
};

let BrowserTranscriber: typeof import('@/transcription/browser-transcriber').BrowserTranscriber;
let TranscriptionErrorClass: typeof import('@/transcription/types').TranscriptionError;

// ---------- Tests ----------

describe('REQ-177: BrowserTranscriber', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete (globalThis as Record<string, unknown>).SpeechRecognition;
    delete (globalThis as Record<string, unknown>).webkitSpeechRecognition;
  });

  // ---- Constructor & initialization ----

  describe('constructor', () => {
    it('should initialize with SpeechRecognition API when available', async () => {
      const MockSR = jest.fn(createMockRecognition);
      (globalThis as Record<string, unknown>).SpeechRecognition = MockSR;

      const mod = await import('@/transcription/browser-transcriber');
      BrowserTranscriber = mod.BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      expect(MockSR).toHaveBeenCalled();
      expect(transcriber.isSupported()).toBe(true);
    });

    it('should fall back when SpeechRecognition API is not available', async () => {
      // No SpeechRecognition on globalThis
      const mod = await import('@/transcription/browser-transcriber');
      // Need to re-import to get fresh module state
      const transcriber = new mod.BrowserTranscriber();

      expect(transcriber.isSupported()).toBe(false);
    });

    it('should configure recognition with continuous and interimResults', async () => {
      const MockSR = jest.fn(createMockRecognition);
      (globalThis as Record<string, unknown>).SpeechRecognition = MockSR;

      const mod = await import('@/transcription/browser-transcriber');
      const transcriber = new mod.BrowserTranscriber();

      expect(mockRecognitionInstance.continuous).toBe(true);
      expect(mockRecognitionInstance.interimResults).toBe(true);
      expect(mockRecognitionInstance.maxAlternatives).toBe(1);
      expect(mockRecognitionInstance.lang).toBe('en-US');
    });
  });

  // ---- State management ----

  describe('getState', () => {
    it('should return idle initially', async () => {
      (globalThis as Record<string, unknown>).SpeechRecognition = jest.fn(createMockRecognition);
      const mod = await import('@/transcription/browser-transcriber');
      const transcriber = new mod.BrowserTranscriber();

      expect(transcriber.getState()).toBe('idle');
    });
  });

  // ---- start/stop/pause/resume ----

  describe('start', () => {
    it('should throw TranscriptionError when recognition not available', async () => {
      // No SpeechRecognition
      const mod = await import('@/transcription/browser-transcriber');
      const transcriber = new mod.BrowserTranscriber();

      expect(() => transcriber.start()).toThrow('Speech recognition not supported');
    });

    it('should set state to listening and call recognition.start()', async () => {
      const MockSR = jest.fn(createMockRecognition);
      (globalThis as Record<string, unknown>).SpeechRecognition = MockSR;

      const mod = await import('@/transcription/browser-transcriber');
      const transcriber = new mod.BrowserTranscriber();
      transcriber.start();

      expect(transcriber.getState()).toBe('listening');
      expect(mockRecognitionInstance.start).toHaveBeenCalled();
    });

    it('should not restart if already listening', async () => {
      const MockSR = jest.fn(createMockRecognition);
      (globalThis as Record<string, unknown>).SpeechRecognition = MockSR;

      const mod = await import('@/transcription/browser-transcriber');
      const transcriber = new mod.BrowserTranscriber();
      transcriber.start();
      mockRecognitionInstance.start.mockClear();

      transcriber.start(); // Already listening
      expect(mockRecognitionInstance.start).not.toHaveBeenCalled();
    });

    it('should handle recognition.start() error gracefully', async () => {
      const MockSR = jest.fn(() => {
        const rec = createMockRecognition();
        rec.start = jest.fn(() => { throw new Error('Already started'); });
        return rec;
      });
      (globalThis as Record<string, unknown>).SpeechRecognition = MockSR;

      const mod = await import('@/transcription/browser-transcriber');
      const transcriber = new mod.BrowserTranscriber();

      // Should not throw even if recognition.start() throws
      expect(() => transcriber.start()).not.toThrow();
      expect(transcriber.getState()).toBe('listening');
    });
  });

  describe('stop', () => {
    it('should set state to idle and call recognition.stop()', async () => {
      const MockSR = jest.fn(createMockRecognition);
      (globalThis as Record<string, unknown>).SpeechRecognition = MockSR;

      const mod = await import('@/transcription/browser-transcriber');
      const transcriber = new mod.BrowserTranscriber();
      transcriber.start();
      transcriber.stop();

      expect(transcriber.getState()).toBe('idle');
      expect(mockRecognitionInstance.stop).toHaveBeenCalled();
    });

    it('should do nothing when recognition is null', async () => {
      const mod = await import('@/transcription/browser-transcriber');
      const transcriber = new mod.BrowserTranscriber();

      expect(() => transcriber.stop()).not.toThrow();
    });
  });

  describe('pause', () => {
    it('should set state to paused when listening', async () => {
      const MockSR = jest.fn(createMockRecognition);
      (globalThis as Record<string, unknown>).SpeechRecognition = MockSR;

      const mod = await import('@/transcription/browser-transcriber');
      const transcriber = new mod.BrowserTranscriber();
      transcriber.start();
      transcriber.pause();

      expect(transcriber.getState()).toBe('paused');
      expect(mockRecognitionInstance.stop).toHaveBeenCalled();
    });

    it('should not change state when not listening', async () => {
      const MockSR = jest.fn(createMockRecognition);
      (globalThis as Record<string, unknown>).SpeechRecognition = MockSR;

      const mod = await import('@/transcription/browser-transcriber');
      const transcriber = new mod.BrowserTranscriber();

      transcriber.pause();
      expect(transcriber.getState()).toBe('idle');
    });
  });

  describe('resume', () => {
    it('should set state to listening when paused', async () => {
      const MockSR = jest.fn(createMockRecognition);
      (globalThis as Record<string, unknown>).SpeechRecognition = MockSR;

      const mod = await import('@/transcription/browser-transcriber');
      const transcriber = new mod.BrowserTranscriber();
      transcriber.start();
      transcriber.pause();
      transcriber.resume();

      expect(transcriber.getState()).toBe('listening');
      expect(mockRecognitionInstance.start).toHaveBeenCalled();
    });

    it('should not change state when not paused', async () => {
      const MockSR = jest.fn(createMockRecognition);
      (globalThis as Record<string, unknown>).SpeechRecognition = MockSR;

      const mod = await import('@/transcription/browser-transcriber');
      const transcriber = new mod.BrowserTranscriber();

      transcriber.resume();
      expect(transcriber.getState()).toBe('idle');
    });
  });

  // ---- Callbacks ----

  describe('onInterimResult', () => {
    it('should register and invoke interim result callback', async () => {
      const MockSR = jest.fn(createMockRecognition);
      (globalThis as Record<string, unknown>).SpeechRecognition = MockSR;

      const mod = await import('@/transcription/browser-transcriber');
      const transcriber = new mod.BrowserTranscriber();
      const callback = jest.fn();
      transcriber.onInterimResult(callback);

      // Simulate recognition result event
      const resultEvent = {
        resultIndex: 0,
        results: [{
          isFinal: false,
          length: 1,
          0: { transcript: 'hello', confidence: 0.9 },
        }] as unknown as SpeechRecognitionResultList,
      };

      if (mockRecognitionInstance.onresult) {
        mockRecognitionInstance.onresult(resultEvent);
      }

      expect(callback).toHaveBeenCalledWith('hello');
    });
  });

  describe('onFinalResult', () => {
    it('should register and invoke final result callback with trimmed text', async () => {
      const MockSR = jest.fn(createMockRecognition);
      (globalThis as Record<string, unknown>).SpeechRecognition = MockSR;

      const mod = await import('@/transcription/browser-transcriber');
      const transcriber = new mod.BrowserTranscriber();
      const callback = jest.fn();
      transcriber.onFinalResult(callback);

      // Simulate final recognition result
      const resultEvent = {
        resultIndex: 0,
        results: [{
          isFinal: true,
          length: 1,
          0: { transcript: '  hello world  ', confidence: 0.95 },
        }] as unknown as SpeechRecognitionResultList,
      };

      if (mockRecognitionInstance.onresult) {
        mockRecognitionInstance.onresult(resultEvent);
      }

      expect(callback).toHaveBeenCalledWith('hello world');
    });

    it('should not invoke callback for empty final result', async () => {
      const MockSR = jest.fn(createMockRecognition);
      (globalThis as Record<string, unknown>).SpeechRecognition = MockSR;

      const mod = await import('@/transcription/browser-transcriber');
      const transcriber = new mod.BrowserTranscriber();
      const callback = jest.fn();
      transcriber.onFinalResult(callback);

      const resultEvent = {
        resultIndex: 0,
        results: [{
          isFinal: true,
          length: 1,
          0: { transcript: '   ', confidence: 0.5 },
        }] as unknown as SpeechRecognitionResultList,
      };

      if (mockRecognitionInstance.onresult) {
        mockRecognitionInstance.onresult(resultEvent);
      }

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('onError', () => {
    it('should register and invoke error callback', async () => {
      const MockSR = jest.fn(createMockRecognition);
      (globalThis as Record<string, unknown>).SpeechRecognition = MockSR;

      const mod = await import('@/transcription/browser-transcriber');
      const transcriber = new mod.BrowserTranscriber();
      const callback = jest.fn();
      transcriber.onError(callback);

      // Simulate error event
      const errorEvent = {
        error: 'network',
        message: 'Network error occurred',
      };

      if (mockRecognitionInstance.onerror) {
        mockRecognitionInstance.onerror(errorEvent);
      }

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'network',
          message: expect.stringContaining('Network'),
        }),
      );
    });

    it('should set state to error on fatal errors (not-allowed)', async () => {
      const MockSR = jest.fn(createMockRecognition);
      (globalThis as Record<string, unknown>).SpeechRecognition = MockSR;

      const mod = await import('@/transcription/browser-transcriber');
      const transcriber = new mod.BrowserTranscriber();
      transcriber.start(); // Set to listening

      const errorEvent = {
        error: 'not-allowed',
        message: 'Permission denied',
      };

      if (mockRecognitionInstance.onerror) {
        mockRecognitionInstance.onerror(errorEvent);
      }

      expect(transcriber.getState()).toBe('error');
    });

    it('should set state to error on fatal errors (audio-capture)', async () => {
      const MockSR = jest.fn(createMockRecognition);
      (globalThis as Record<string, unknown>).SpeechRecognition = MockSR;

      const mod = await import('@/transcription/browser-transcriber');
      const transcriber = new mod.BrowserTranscriber();
      transcriber.start();

      const errorEvent = {
        error: 'audio-capture',
        message: 'No microphone',
      };

      if (mockRecognitionInstance.onerror) {
        mockRecognitionInstance.onerror(errorEvent);
      }

      expect(transcriber.getState()).toBe('error');
    });

    it('should not set state to error on non-fatal errors', async () => {
      const MockSR = jest.fn(createMockRecognition);
      (globalThis as Record<string, unknown>).SpeechRecognition = MockSR;

      const mod = await import('@/transcription/browser-transcriber');
      const transcriber = new mod.BrowserTranscriber();
      transcriber.start();

      const errorEvent = {
        error: 'no-speech',
        message: 'No speech detected',
      };

      if (mockRecognitionInstance.onerror) {
        mockRecognitionInstance.onerror(errorEvent);
      }

      expect(transcriber.getState()).toBe('listening');
    });
  });

  // ---- Browser compatibility ----

  describe('isSupported', () => {
    it('should return true when SpeechRecognition is available', async () => {
      (globalThis as Record<string, unknown>).SpeechRecognition = jest.fn(createMockRecognition);

      const mod = await import('@/transcription/browser-transcriber');
      const transcriber = new mod.BrowserTranscriber();

      expect(transcriber.isSupported()).toBe(true);
    });

    it('should return false when SpeechRecognition is not available', async () => {
      const mod = await import('@/transcription/browser-transcriber');
      const transcriber = new mod.BrowserTranscriber();

      expect(transcriber.isSupported()).toBe(false);
    });
  });

  describe('getBrowserCompatibility', () => {
    it('should return compatibility info with supported flag', async () => {
      (globalThis as Record<string, unknown>).SpeechRecognition = jest.fn(createMockRecognition);

      const mod = await import('@/transcription/browser-transcriber');
      const transcriber = new mod.BrowserTranscriber();
      const compat = transcriber.getBrowserCompatibility();

      expect(compat.supported).toBe(true);
      expect(typeof compat.browserName).toBe('string');
    });
  });

  describe('getSupportedFeatures', () => {
    it('should return all features enabled when supported', async () => {
      (globalThis as Record<string, unknown>).SpeechRecognition = jest.fn(createMockRecognition);

      const mod = await import('@/transcription/browser-transcriber');
      const transcriber = new mod.BrowserTranscriber();
      const features = transcriber.getSupportedFeatures();

      expect(features.webSpeechAPI).toBe(true);
      expect(features.fileTranscription).toBe(true);
      expect(features.realtimeTranscription).toBe(true);
    });

    it('should return all features disabled when not supported', async () => {
      const mod = await import('@/transcription/browser-transcriber');
      const transcriber = new mod.BrowserTranscriber();
      const features = transcriber.getSupportedFeatures();

      expect(features.webSpeechAPI).toBe(false);
      expect(features.fileTranscription).toBe(false);
      expect(features.realtimeTranscription).toBe(false);
    });
  });

  // ---- Auto-restart on end ----

  describe('auto-restart', () => {
    it('should auto-restart recognition on end when still listening', async () => {
      const MockSR = jest.fn(createMockRecognition);
      (globalThis as Record<string, unknown>).SpeechRecognition = MockSR;

      const mod = await import('@/transcription/browser-transcriber');
      const transcriber = new mod.BrowserTranscriber();
      transcriber.start();
      mockRecognitionInstance.start.mockClear();

      // Simulate onend event while listening
      if (mockRecognitionInstance.onend) {
        mockRecognitionInstance.onend(new Event('end'));
      }

      expect(mockRecognitionInstance.start).toHaveBeenCalled();
    });

    it('should not restart when not in listening state', async () => {
      const MockSR = jest.fn(createMockRecognition);
      (globalThis as Record<string, unknown>).SpeechRecognition = MockSR;

      const mod = await import('@/transcription/browser-transcriber');
      const transcriber = new mod.BrowserTranscriber();
      // State is idle, not listening

      if (mockRecognitionInstance.onend) {
        mockRecognitionInstance.onend(new Event('end'));
      }

      expect(mockRecognitionInstance.start).not.toHaveBeenCalled();
    });
  });
});
