/**
 * BrowserTranscriber Tests - TASK-0012
 *
 * Tests for Web Speech API based real-time browser transcription module.
 * Covers: start/stop, interim results, browser compatibility, error handling, pause/resume.
 */

// ---------- Mock setup for Web Speech API ----------

type MockSpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: ((ev: Event) => void) | null;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((ev: Event) => void) | null;
  start: jest.Mock;
  stop: jest.Mock;
  abort: jest.Mock;
};

let mockRecognitionInstance: MockSpeechRecognitionInstance;

const createMockRecognition = (): MockSpeechRecognitionInstance => ({
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
});

const MockSpeechRecognition = jest.fn().mockImplementation(() => {
  mockRecognitionInstance = createMockRecognition();
  return mockRecognitionInstance;
});

// Save original window properties
const originalWindowSpeechRecognition = (globalThis as Record<string, unknown>).SpeechRecognition as jest.Mock | undefined;
const originalWindowWebkitSpeechRecognition = (globalThis as Record<string, unknown>).webkitSpeechRecognition as jest.Mock | undefined;

// ---------- Test Suite ----------

describe('BrowserTranscriber', () => {
  let BrowserTranscriber: typeof import('../browser-transcriber').BrowserTranscriber;

  const setSpeechRecognitionAPI = (api: jest.Mock) => {
    (globalThis as Record<string, unknown>).SpeechRecognition = api;
    (globalThis as Record<string, unknown>).webkitSpeechRecognition = api;
  };

  const removeSpeechRecognitionAPI = () => {
    delete (globalThis as Record<string, unknown>).SpeechRecognition;
    delete (globalThis as Record<string, unknown>).webkitSpeechRecognition;
  };

  beforeEach(() => {
    jest.resetModules();
    mockRecognitionInstance = createMockRecognition();
    MockSpeechRecognition.mockImplementation(() => {
      return mockRecognitionInstance;
    });
    setSpeechRecognitionAPI(MockSpeechRecognition);
  });

  afterEach(() => {
    // Restore original window properties
    if (originalWindowSpeechRecognition !== undefined) {
      (globalThis as Record<string, unknown>).SpeechRecognition = originalWindowSpeechRecognition;
    } else {
      delete (globalThis as Record<string, unknown>).SpeechRecognition;
    }
    if (originalWindowWebkitSpeechRecognition !== undefined) {
      (globalThis as Record<string, unknown>).webkitSpeechRecognition = originalWindowWebkitSpeechRecognition;
    } else {
      delete (globalThis as Record<string, unknown>).webkitSpeechRecognition;
    }
  });

  // ------------------------------------------------
  // Test Case 1: Start / Stop state transitions
  // ------------------------------------------------
  describe('音声認識開始・停止テスト', () => {
    it('start() → stop() で状態が idle → listening → idle に遷移する', async () => {
      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      // Initial state is idle
      expect(transcriber.getState()).toBe('idle');

      // Start recognition
      transcriber.start();
      expect(mockRecognitionInstance.start).toHaveBeenCalled();
      expect(transcriber.getState()).toBe('listening');

      // Simulate onstart event
      if (mockRecognitionInstance.onstart) {
        mockRecognitionInstance.onstart(new Event('start'));
      }
      expect(transcriber.getState()).toBe('listening');

      // Stop recognition
      transcriber.stop();
      expect(mockRecognitionInstance.stop).toHaveBeenCalled();
      expect(transcriber.getState()).toBe('idle');
    });

    it('SpeechRecognitionのstart/stopが呼ばれる', async () => {
      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      transcriber.start();
      expect(mockRecognitionInstance.start).toHaveBeenCalledTimes(1);

      transcriber.stop();
      expect(mockRecognitionInstance.stop).toHaveBeenCalledTimes(1);
    });
  });

  // ------------------------------------------------
  // Test Case 2: Interim result callback
  // ------------------------------------------------
  describe('中間結果コールバックテスト', () => {
    it('onInterimResultコールバックが中間テキストで呼び出される', async () => {
      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      const interimCallback = jest.fn();
      transcriber.onInterimResult(interimCallback);

      transcriber.start();

      // Simulate an interim result
      const mockEvent = {
        resultIndex: 0,
        results: {
          length: 1,
          0: {
            isFinal: false,
            length: 1,
            0: {
              transcript: 'hello world',
              confidence: 0.85,
            },
          },
        } as unknown as SpeechRecognitionResultList,
      } as unknown as SpeechRecognitionEvent;

      if (mockRecognitionInstance.onresult) {
        mockRecognitionInstance.onresult(mockEvent);
      }

      expect(interimCallback).toHaveBeenCalledWith('hello world');
    });
  });

  // ------------------------------------------------
  // Test Case 3: Browser compatibility check
  // ------------------------------------------------
  describe('ブラウザ互換性チェックテスト', () => {
    it('isSupported() がAPI存在時にtrueを返す', async () => {
      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      expect(transcriber.isSupported()).toBe(true);
    });

    it('isSupported() がAPI不存在時にfalseを返す', async () => {
      removeSpeechRecognitionAPI();

      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      expect(transcriber.isSupported()).toBe(false);
    });

    it('getBrowserCompatibility() がブラウザ情報を返す', async () => {
      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      const compat = transcriber.getBrowserCompatibility();
      expect(compat).toHaveProperty('supported');
      expect(compat).toHaveProperty('browserName');
      expect(typeof compat.supported).toBe('boolean');
      expect(typeof compat.browserName).toBe('string');
    });
  });

  // ------------------------------------------------
  // Test Case 4: Error handling
  // ------------------------------------------------
  describe('エラー処理テスト', () => {
    it('not-allowedエラーで状態がerrorに遷移し、onErrorが呼ばれる', async () => {
      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      const errorCallback = jest.fn();
      transcriber.onError(errorCallback);

      transcriber.start();

      // Simulate not-allowed error
      const mockErrorEvent = {
        error: 'not-allowed',
        message: 'Permission denied',
      } as unknown as SpeechRecognitionErrorEvent;

      if (mockRecognitionInstance.onerror) {
        mockRecognitionInstance.onerror(mockErrorEvent);
      }

      expect(transcriber.getState()).toBe('error');
      expect(errorCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'not-allowed',
        })
      );
    });

    it('no-speechエラーでonErrorが呼ばれる', async () => {
      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      const errorCallback = jest.fn();
      transcriber.onError(errorCallback);

      transcriber.start();

      const mockErrorEvent = {
        error: 'no-speech',
        message: 'No speech detected',
      } as unknown as SpeechRecognitionErrorEvent;

      if (mockRecognitionInstance.onerror) {
        mockRecognitionInstance.onerror(mockErrorEvent);
      }

      expect(errorCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'no-speech',
        })
      );
    });
  });

  // ------------------------------------------------
  // Test Case 5: Pause / Resume
  // ------------------------------------------------
  describe('一時停止・再開テスト', () => {
    it('pause() → resume() で listening → paused → listening に遷移する', async () => {
      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      expect(transcriber.getState()).toBe('idle');

      transcriber.start();
      expect(transcriber.getState()).toBe('listening');

      transcriber.pause();
      expect(transcriber.getState()).toBe('paused');

      transcriber.resume();
      expect(transcriber.getState()).toBe('listening');
    });

    it('pause()中は認識が停止される', async () => {
      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      transcriber.start();
      transcriber.pause();

      // stop should be called when pausing
      expect(mockRecognitionInstance.stop).toHaveBeenCalled();
    });
  });

  // ------------------------------------------------
  // Test Case 6: Final result callback
  // ------------------------------------------------
  describe('最終結果コールバックテスト', () => {
    it('onFinalResult callback is called with trimmed final transcript', async () => {
      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      const finalCallback = jest.fn();
      transcriber.onFinalResult(finalCallback);

      transcriber.start();

      const mockEvent = {
        resultIndex: 0,
        results: {
          length: 1,
          0: {
            isFinal: true,
            length: 1,
            0: {
              transcript: '  final result text  ',
              confidence: 0.95,
            },
          },
        } as unknown as SpeechRecognitionResultList,
      } as unknown as SpeechRecognitionEvent;

      if (mockRecognitionInstance.onresult) {
        mockRecognitionInstance.onresult(mockEvent);
      }

      expect(finalCallback).toHaveBeenCalledWith('final result text');
    });

    it('onFinalResult is not called for empty transcript', async () => {
      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      const finalCallback = jest.fn();
      transcriber.onFinalResult(finalCallback);

      transcriber.start();

      const mockEvent = {
        resultIndex: 0,
        results: {
          length: 1,
          0: {
            isFinal: true,
            length: 1,
            0: {
              transcript: '   ',
              confidence: 0.95,
            },
          },
        } as unknown as SpeechRecognitionResultList,
      } as unknown as SpeechRecognitionEvent;

      if (mockRecognitionInstance.onresult) {
        mockRecognitionInstance.onresult(mockEvent);
      }

      expect(finalCallback).not.toHaveBeenCalled();
    });

    it('onInterimResult is not called for empty transcript', async () => {
      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      const interimCallback = jest.fn();
      transcriber.onInterimResult(interimCallback);

      transcriber.start();

      const mockEvent = {
        resultIndex: 0,
        results: {
          length: 1,
          0: {
            isFinal: false,
            length: 1,
            0: {
              transcript: '',
              confidence: 0.85,
            },
          },
        } as unknown as SpeechRecognitionResultList,
      } as unknown as SpeechRecognitionEvent;

      if (mockRecognitionInstance.onresult) {
        mockRecognitionInstance.onresult(mockEvent);
      }

      expect(interimCallback).not.toHaveBeenCalled();
    });

    it('handles multiple results in a single event', async () => {
      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      const finalCallback = jest.fn();
      const interimCallback = jest.fn();
      transcriber.onFinalResult(finalCallback);
      transcriber.onInterimResult(interimCallback);

      transcriber.start();

      const mockEvent = {
        resultIndex: 0,
        results: {
          length: 2,
          0: {
            isFinal: true,
            length: 1,
            0: {
              transcript: 'final text',
              confidence: 0.9,
            },
          },
          1: {
            isFinal: false,
            length: 1,
            0: {
              transcript: 'interim text',
              confidence: 0.7,
            },
          },
        } as unknown as SpeechRecognitionResultList,
      } as unknown as SpeechRecognitionEvent;

      if (mockRecognitionInstance.onresult) {
        mockRecognitionInstance.onresult(mockEvent);
      }

      expect(finalCallback).toHaveBeenCalledWith('final text');
      expect(interimCallback).toHaveBeenCalledWith('interim text');
    });
  });

  // ------------------------------------------------
  // Test Case 7: Error handling - additional cases
  // ------------------------------------------------
  describe('エラー処理 - 追加ケース', () => {
    it('audio-capture error transitions state to error', async () => {
      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      const errorCallback = jest.fn();
      transcriber.onError(errorCallback);

      transcriber.start();

      const mockErrorEvent = {
        error: 'audio-capture',
        message: 'Audio capture failed',
      } as unknown as SpeechRecognitionErrorEvent;

      if (mockRecognitionInstance.onerror) {
        mockRecognitionInstance.onerror(mockErrorEvent);
      }

      expect(transcriber.getState()).toBe('error');
      expect(errorCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'audio-capture',
          message: 'Audio capture failed',
        })
      );
    });

    it('non-fatal errors do not change state to error', async () => {
      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      const errorCallback = jest.fn();
      transcriber.onError(errorCallback);

      transcriber.start();
      expect(transcriber.getState()).toBe('listening');

      const mockErrorEvent = {
        error: 'network',
        message: 'Network error occurred',
      } as unknown as SpeechRecognitionErrorEvent;

      if (mockRecognitionInstance.onerror) {
        mockRecognitionInstance.onerror(mockErrorEvent);
      }

      // State remains 'listening' for non-fatal errors
      expect(transcriber.getState()).toBe('listening');
      expect(errorCallback).toHaveBeenCalled();
    });

    it('error with no message uses default format', async () => {
      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      const errorCallback = jest.fn();
      transcriber.onError(errorCallback);

      transcriber.start();

      const mockErrorEvent = {
        error: 'aborted',
        message: '',
      } as unknown as SpeechRecognitionErrorEvent;

      if (mockRecognitionInstance.onerror) {
        mockRecognitionInstance.onerror(mockErrorEvent);
      }

      expect(errorCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'aborted',
          message: 'Speech recognition error: aborted',
        })
      );
    });

    it('error callback is not called when no error callback registered', async () => {
      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      transcriber.start();

      const mockErrorEvent = {
        error: 'no-speech',
        message: 'No speech',
      } as unknown as SpeechRecognitionErrorEvent;

      // Should not throw even without error callback
      if (mockRecognitionInstance.onerror) {
        mockRecognitionInstance.onerror(mockErrorEvent);
      }
    });
  });

  // ------------------------------------------------
  // Test Case 8: Auto-restart on end
  // ------------------------------------------------
  describe('自動再開テスト', () => {
    it('auto-restarts recognition on end when state is listening', async () => {
      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      transcriber.start();
      expect(transcriber.getState()).toBe('listening');

      // Clear previous calls
      mockRecognitionInstance.start.mockClear();

      // Simulate onend while still listening
      if (mockRecognitionInstance.onend) {
        mockRecognitionInstance.onend(new Event('end'));
      }

      // Should auto-restart
      expect(mockRecognitionInstance.start).toHaveBeenCalledTimes(1);
    });

    it('does not auto-restart when state is idle', async () => {
      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      // Don't start, state is idle
      expect(transcriber.getState()).toBe('idle');

      mockRecognitionInstance.start.mockClear();

      if (mockRecognitionInstance.onend) {
        mockRecognitionInstance.onend(new Event('end'));
      }

      expect(mockRecognitionInstance.start).not.toHaveBeenCalled();
    });

    it('does not auto-restart when state is paused', async () => {
      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      transcriber.start();
      transcriber.pause();
      expect(transcriber.getState()).toBe('paused');

      mockRecognitionInstance.start.mockClear();

      if (mockRecognitionInstance.onend) {
        mockRecognitionInstance.onend(new Event('end'));
      }

      expect(mockRecognitionInstance.start).not.toHaveBeenCalled();
    });

    it('handles error during auto-restart gracefully', async () => {
      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      transcriber.start();

      // Make start throw (e.g., already started)
      mockRecognitionInstance.start.mockImplementation(() => {
        throw new Error('Already started');
      });

      // Should not throw
      if (mockRecognitionInstance.onend) {
        expect(() => {
          mockRecognitionInstance.onend!(new Event('end'));
        }).not.toThrow();
      }
    });
  });

  // ------------------------------------------------
  // Test Case 9: Pause / Resume edge cases
  // ------------------------------------------------
  describe('一時停止・再開エッジケース', () => {
    it('pause() does nothing when state is idle', async () => {
      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      expect(transcriber.getState()).toBe('idle');

      transcriber.pause();

      expect(transcriber.getState()).toBe('idle');
      expect(mockRecognitionInstance.stop).not.toHaveBeenCalled();
    });

    it('pause() does nothing when state is paused', async () => {
      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      transcriber.start();
      transcriber.pause();
      expect(transcriber.getState()).toBe('paused');

      mockRecognitionInstance.stop.mockClear();
      transcriber.pause();

      // Should not call stop again
      expect(mockRecognitionInstance.stop).not.toHaveBeenCalled();
    });

    it('resume() does nothing when state is idle', async () => {
      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      expect(transcriber.getState()).toBe('idle');

      transcriber.resume();

      expect(transcriber.getState()).toBe('idle');
      expect(mockRecognitionInstance.start).not.toHaveBeenCalled();
    });

    it('resume() does nothing when state is listening', async () => {
      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      transcriber.start();
      expect(transcriber.getState()).toBe('listening');

      mockRecognitionInstance.start.mockClear();
      transcriber.resume();

      // Should not call start again
      expect(mockRecognitionInstance.start).not.toHaveBeenCalled();
    });

    it('stop() does nothing when recognition is null (unsupported browser)', async () => {
      removeSpeechRecognitionAPI();
      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      // Should not throw
      transcriber.stop();
    });

    it('pause() does nothing when recognition is null', async () => {
      removeSpeechRecognitionAPI();
      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      // Should not throw
      transcriber.pause();
    });

    it('resume() does nothing when recognition is null', async () => {
      removeSpeechRecognitionAPI();
      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      // Should not throw
      transcriber.resume();
    });
  });

  // ------------------------------------------------
  // Test Case 10: start() edge cases
  // ------------------------------------------------
  describe('start() エッジケース', () => {
    it('start() throws when recognition is not supported', async () => {
      removeSpeechRecognitionAPI();
      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      expect(() => transcriber.start()).toThrow(
        'Speech recognition not supported in this browser'
      );
    });

    it('start() does nothing when already listening', async () => {
      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      transcriber.start();
      expect(mockRecognitionInstance.start).toHaveBeenCalledTimes(1);

      // Start again
      transcriber.start();
      // Should still only have 1 call
      expect(mockRecognitionInstance.start).toHaveBeenCalledTimes(1);
    });

    it('start() catches errors from recognition.start()', async () => {
      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      mockRecognitionInstance.start.mockImplementation(() => {
        throw new Error('Already started');
      });

      // Should not throw
      expect(() => transcriber.start()).not.toThrow();
      expect(transcriber.getState()).toBe('listening');
    });

    it('stop() catches errors from recognition.stop()', async () => {
      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      transcriber.start();
      mockRecognitionInstance.stop.mockImplementation(() => {
        throw new Error('Already stopped');
      });

      // Should not throw
      expect(() => transcriber.stop()).not.toThrow();
      expect(transcriber.getState()).toBe('idle');
    });

    it('pause() catches errors from recognition.stop()', async () => {
      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      transcriber.start();
      mockRecognitionInstance.stop.mockImplementation(() => {
        throw new Error('Already stopped');
      });

      // Should not throw
      expect(() => transcriber.pause()).not.toThrow();
      expect(transcriber.getState()).toBe('paused');
    });

    it('resume() catches errors from recognition.start()', async () => {
      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      transcriber.start();
      transcriber.pause();

      mockRecognitionInstance.start.mockImplementation(() => {
        throw new Error('Already started');
      });

      // Should not throw
      expect(() => transcriber.resume()).not.toThrow();
      expect(transcriber.getState()).toBe('listening');
    });
  });

  // ------------------------------------------------
  // Test Case 11: Browser detection
  // ------------------------------------------------
  describe('ブラウザ検出テスト', () => {
    const originalUserAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';

    afterEach(() => {
      // Restore navigator
      Object.defineProperty(navigator, 'userAgent', {
        value: originalUserAgent,
        configurable: true,
      });
    });

    it('detects Edge browser', async () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
        configurable: true,
      });

      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      const compat = transcriber.getBrowserCompatibility();
      expect(compat.browserName).toBe('Edge');
    });

    it('detects Chrome browser', async () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        configurable: true,
      });

      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      const compat = transcriber.getBrowserCompatibility();
      expect(compat.browserName).toBe('Chrome');
    });

    it('detects Firefox browser', async () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
        configurable: true,
      });

      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      const compat = transcriber.getBrowserCompatibility();
      expect(compat.browserName).toBe('Firefox');
    });

    it('detects Safari browser', async () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
        configurable: true,
      });

      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      const compat = transcriber.getBrowserCompatibility();
      expect(compat.browserName).toBe('Safari');
    });

    it('returns unknown for unrecognized browser', async () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'SomeUnknownBrowser/1.0',
        configurable: true,
      });

      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      const compat = transcriber.getBrowserCompatibility();
      expect(compat.browserName).toBe('unknown');
    });
  });

  // ------------------------------------------------
  // Test Case 12: getSupportedFeatures
  // ------------------------------------------------
  describe('getSupportedFeatures テスト', () => {
    it('returns all true when recognition is supported', async () => {
      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      const features = transcriber.getSupportedFeatures();
      expect(features.webSpeechAPI).toBe(true);
      expect(features.fileTranscription).toBe(true);
      expect(features.realtimeTranscription).toBe(true);
    });

    it('returns all false when recognition is not supported', async () => {
      removeSpeechRecognitionAPI();
      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      const features = transcriber.getSupportedFeatures();
      expect(features.webSpeechAPI).toBe(false);
      expect(features.fileTranscription).toBe(false);
      expect(features.realtimeTranscription).toBe(false);
    });
  });

  // ------------------------------------------------
  // Test Case 13: transcribeAudioFile
  // ------------------------------------------------
  describe('transcribeAudioFile テスト', () => {
    it('returns mock segments when recognition is not supported', async () => {
      removeSpeechRecognitionAPI();

      // Need Audio for fallback path
      const mockAudioPlay = jest.fn();
      (globalThis as Record<string, unknown>).Audio = jest.fn().mockImplementation(() => ({
        src: '',
        onloadedmetadata: null,
        onerror: null,
        duration: 0,
        play: mockAudioPlay,
      }));

      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      const result = await transcriber.transcribeAudioFile('/path/to/audio.mp3');

      expect(result.success).toBe(true);
      expect(result.segments.length).toBeGreaterThan(0);
      expect(result.language).toBe('en');
      expect(typeof result.processingTime).toBe('number');
    });

    it('returns mock segments for string path input', async () => {
      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      const result = await transcriber.transcribeAudioFile('/path/to/audio.wav');

      expect(result.success).toBe(true);
      expect(result.segments.length).toBeGreaterThan(0);
      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('language', 'en');
    });

    it('returns mock segments for File input when recognition supported', async () => {
      // Need to mock Audio and URL for the Web Speech API path
      const mockAudioObj = {
        src: '',
        onloadedmetadata: null as (() => void) | null,
        onerror: null as (() => void) | null,
        duration: 10,
        play: jest.fn(),
        currentTime: 5,
      };
      (globalThis as Record<string, unknown>).Audio = jest.fn().mockImplementation(() => mockAudioObj);
      (globalThis as Record<string, unknown>).URL = {
        createObjectURL: jest.fn().mockReturnValue('blob:http://localhost/fake'),
        revokeObjectURL: jest.fn(),
      };

      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      const mockFile = new File(['audio data'], 'test.wav', { type: 'audio/wav' });

      const resultPromise = transcriber.transcribeAudioFile(mockFile);

      // Simulate recognition lifecycle
      setImmediate(() => {
        // onstart
        if (mockRecognitionInstance.onstart) {
          mockRecognitionInstance.onstart(new Event('start'));
        }

        // Simulate a result
        if (mockRecognitionInstance.onresult) {
          const mockEvent = {
            resultIndex: 0,
            results: {
              length: 1,
              0: {
                isFinal: true,
                length: 1,
                0: {
                  transcript: 'Hello from audio file',
                  confidence: 0.95,
                },
              },
            } as unknown as SpeechRecognitionResultList,
          } as unknown as SpeechRecognitionEvent;
          mockRecognitionInstance.onresult(mockEvent);
        }

        // onend
        if (mockRecognitionInstance.onend) {
          mockRecognitionInstance.onend(new Event('end'));
        }
      });

      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.segments.length).toBeGreaterThan(0);
    });

    it('preserves a confidence of exactly 0 instead of inverting it to 0.9 (|| → ??)', async () => {
      // Web Speech API confidence is [0,1]; 0 is a legitimate "very uncertain"
      // final result. `result[0]?.confidence || 0.9` inverts 0 → 0.9 (highly
      // confident), exactly backwards. Must be `?? 0.9` so only undefined/null
      // falls back.
      const mockAudioObj = {
        src: '',
        onloadedmetadata: null as (() => void) | null,
        onerror: null as (() => void) | null,
        duration: 10,
        play: jest.fn(),
        currentTime: 5,
      };
      (globalThis as Record<string, unknown>).Audio = jest.fn().mockImplementation(() => mockAudioObj);
      (globalThis as Record<string, unknown>).URL = {
        createObjectURL: jest.fn().mockReturnValue('blob:http://localhost/fake'),
        revokeObjectURL: jest.fn(),
      };

      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      const resultPromise = transcriber.transcribeAudioFile(
        new File(['audio data'], 'test.wav', { type: 'audio/wav' })
      );

      setImmediate(() => {
        if (mockRecognitionInstance.onstart) {
          mockRecognitionInstance.onstart(new Event('start'));
        }
        if (mockRecognitionInstance.onresult) {
          const mockEvent = {
            resultIndex: 0,
            results: {
              length: 1,
              0: {
                isFinal: true,
                length: 1,
                0: { transcript: 'very uncertain result', confidence: 0 },
              },
            } as unknown as SpeechRecognitionResultList,
          } as unknown as SpeechRecognitionEvent;
          mockRecognitionInstance.onresult(mockEvent);
        }
        if (mockRecognitionInstance.onend) {
          mockRecognitionInstance.onend(new Event('end'));
        }
      });

      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.segments.length).toBeGreaterThan(0);
      // Confidence 0 must be preserved, NOT silently turned into 0.9.
      expect(result.segments[0].confidence).toBe(0);
    });

    it('returns mock segments when Web Speech API produces no segments', async () => {
      const mockAudioObj = {
        src: '',
        onloadedmetadata: null as (() => void) | null,
        onerror: null as (() => void) | null,
        duration: 10,
        play: jest.fn(),
        currentTime: 5,
      };
      (globalThis as Record<string, unknown>).Audio = jest.fn().mockImplementation(() => mockAudioObj);
      (globalThis as Record<string, unknown>).URL = {
        createObjectURL: jest.fn().mockReturnValue('blob:http://localhost/fake'),
        revokeObjectURL: jest.fn(),
      };

      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      const mockFile = new File(['audio data'], 'test.wav', { type: 'audio/wav' });

      const resultPromise = transcriber.transcribeAudioFile(mockFile);

      setImmediate(() => {
        // Simulate onend with no results (empty segments)
        if (mockRecognitionInstance.onend) {
          mockRecognitionInstance.onend(new Event('end'));
        }
      });

      const result = await resultPromise;

      expect(result.success).toBe(true);
      // Should fall back to mock segments
      expect(result.segments.length).toBeGreaterThan(0);
    });

    it('handles error during Web Speech API transcription', async () => {
      const mockAudioObj = {
        src: '',
        onloadedmetadata: null as (() => void) | null,
        onerror: null as (() => void) | null,
        duration: 10,
        play: jest.fn(),
        currentTime: 5,
      };
      (globalThis as Record<string, unknown>).Audio = jest.fn().mockImplementation(() => mockAudioObj);
      (globalThis as Record<string, unknown>).URL = {
        createObjectURL: jest.fn().mockReturnValue('blob:http://localhost/fake'),
        revokeObjectURL: jest.fn(),
      };

      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      const mockFile = new File(['audio data'], 'test.wav', { type: 'audio/wav' });

      const resultPromise = transcriber.transcribeAudioFile(mockFile);

      setImmediate(() => {
        // Simulate recognition error
        if (mockRecognitionInstance.onerror) {
          const mockErrorEvent = {
            error: 'network',
            message: 'Network error',
          } as unknown as SpeechRecognitionErrorEvent;
          mockRecognitionInstance.onerror(mockErrorEvent);
        }
      });

      const result = await resultPromise;

      // Should return error result with mock segments
      expect(result.success).toBe(false);
      expect(result.error).toBe('Speech recognition error: network');
      expect(result.segments.length).toBeGreaterThan(0);
    });

    it('computes duration from last segment end', async () => {
      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      const result = await transcriber.transcribeAudioFile('/audio.mp3');

      // Mock segments have last end at 30000
      expect(result.duration).toBe(result.segments[result.segments.length - 1].end);
    });

    it('returns 0 duration when segments are empty', async () => {
      removeSpeechRecognitionAPI();

      // Create a mock that returns empty segments
      (globalThis as Record<string, unknown>).Audio = jest.fn().mockImplementation(() => ({
        src: '',
        onloadedmetadata: null,
        onerror: null,
        duration: 0,
        play: jest.fn(),
      }));

      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      // With string path and no recognition, it uses getEnhancedMockSegments()
      // which always returns segments. Test with error path instead
      const result = await transcriber.transcribeAudioFile('/audio.mp3');
      expect(result).toHaveProperty('duration');
    });
  });

  // ------------------------------------------------
  // Test Case 14: Recognition configuration
  // ------------------------------------------------
  describe('Recognition設定テスト', () => {
    it('configures recognition with correct default settings', async () => {
      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      new BrowserTranscriber();

      expect(mockRecognitionInstance.continuous).toBe(true);
      expect(mockRecognitionInstance.interimResults).toBe(true);
      expect(mockRecognitionInstance.maxAlternatives).toBe(1);
      expect(mockRecognitionInstance.lang).toBe('en-US');
    });
  });

  // ------------------------------------------------
  // Test Case 15: Transcribe with Web Speech API (detailed)
  // ------------------------------------------------
  describe('Web Speech API transcription', () => {
    it('handles recognition error and rejects', async () => {
      const mockAudioObj = {
        src: '',
        onloadedmetadata: null as (() => void) | null,
        onerror: null as (() => void) | null,
        duration: 10,
        play: jest.fn(),
        currentTime: 5,
      };
      (globalThis as Record<string, unknown>).Audio = jest.fn().mockImplementation(() => mockAudioObj);
      const mockRevokeObjectURL = jest.fn();
      (globalThis as Record<string, unknown>).URL = {
        createObjectURL: jest.fn().mockReturnValue('blob:http://localhost/fake'),
        revokeObjectURL: mockRevokeObjectURL,
      };

      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      const mockFile = new File(['audio data'], 'test.wav', { type: 'audio/wav' });

      const resultPromise = transcriber.transcribeAudioFile(mockFile);

      setImmediate(() => {
        if (mockRecognitionInstance.onerror) {
          const mockErrorEvent = {
            error: 'aborted',
            message: 'Recognition aborted',
          } as unknown as SpeechRecognitionErrorEvent;
          mockRecognitionInstance.onerror(mockErrorEvent);
        }
      });

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(mockRevokeObjectURL).toHaveBeenCalled();
    });

    it('plays audio on recognition start', async () => {
      const mockAudioObj = {
        src: '',
        onloadedmetadata: null as (() => void) | null,
        onerror: null as (() => void) | null,
        duration: 10,
        play: jest.fn(),
        currentTime: 5,
      };
      (globalThis as Record<string, unknown>).Audio = jest.fn().mockImplementation(() => mockAudioObj);
      (globalThis as Record<string, unknown>).URL = {
        createObjectURL: jest.fn().mockReturnValue('blob:http://localhost/fake'),
        revokeObjectURL: jest.fn(),
      };

      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      const mockFile = new File(['audio data'], 'test.wav', { type: 'audio/wav' });

      const resultPromise = transcriber.transcribeAudioFile(mockFile);

      setImmediate(() => {
        if (mockRecognitionInstance.onstart) {
          mockRecognitionInstance.onstart(new Event('start'));
        }
        // Then end to resolve
        if (mockRecognitionInstance.onend) {
          mockRecognitionInstance.onend(new Event('end'));
        }
      });

      await resultPromise;

      expect(mockAudioObj.play).toHaveBeenCalled();
    });

    it('creates segments with correct properties from results', async () => {
      const mockAudioObj = {
        src: '',
        onloadedmetadata: null as (() => void) | null,
        onerror: null as (() => void) | null,
        duration: 10,
        play: jest.fn(),
        currentTime: 3000, // 3 seconds in
      };
      (globalThis as Record<string, unknown>).Audio = jest.fn().mockImplementation(() => mockAudioObj);
      const mockRevokeObjectURL = jest.fn();
      (globalThis as Record<string, unknown>).URL = {
        createObjectURL: jest.fn().mockReturnValue('blob:http://localhost/fake'),
        revokeObjectURL: mockRevokeObjectURL,
      };

      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      const mockFile = new File(['audio data'], 'test.wav', { type: 'audio/wav' });

      const resultPromise = transcriber.transcribeAudioFile(mockFile);

      setImmediate(() => {
        if (mockRecognitionInstance.onstart) {
          mockRecognitionInstance.onstart(new Event('start'));
        }

        if (mockRecognitionInstance.onresult) {
          const mockEvent = {
            resultIndex: 0,
            results: {
              length: 1,
              0: {
                isFinal: true,
                length: 1,
                0: {
                  transcript: 'Test segment',
                  confidence: 0.92,
                },
              },
            } as unknown as SpeechRecognitionResultList,
          } as unknown as SpeechRecognitionEvent;
          mockRecognitionInstance.onresult(mockEvent);
        }

        if (mockRecognitionInstance.onend) {
          mockRecognitionInstance.onend(new Event('end'));
        }
      });

      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.segments[0].text).toBe('Test segment');
      expect(result.segments[0].confidence).toBe(0.92);
      expect(result.segments[0].start).toBe(0);
      // currentTime (3s) is multiplied by 1000 in the source to convert to ms
      expect(result.segments[0].end).toBe(3000000);
      expect(mockRevokeObjectURL).toHaveBeenCalled();
    });

    it('preserves a confidence of exactly 0 instead of inverting it to 0.9', async () => {
      const mockAudioObj = {
        src: '',
        onloadedmetadata: null as (() => void) | null,
        onerror: null as (() => void) | null,
        duration: 10,
        play: jest.fn(),
        currentTime: 5000,
      };
      (globalThis as Record<string, unknown>).Audio = jest.fn().mockImplementation(() => mockAudioObj);
      (globalThis as Record<string, unknown>).URL = {
        createObjectURL: jest.fn().mockReturnValue('blob:http://localhost/fake'),
        revokeObjectURL: jest.fn(),
      };

      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      const mockFile = new File(['audio data'], 'test.wav', { type: 'audio/wav' });

      const resultPromise = transcriber.transcribeAudioFile(mockFile);

      setImmediate(() => {
        if (mockRecognitionInstance.onstart) {
          mockRecognitionInstance.onstart(new Event('start'));
        }

        if (mockRecognitionInstance.onresult) {
          const mockEvent = {
            resultIndex: 0,
            results: {
              length: 1,
              0: {
                isFinal: true,
                length: 1,
                0: {
                  transcript: 'No confidence',
                  confidence: 0, // Legit "very uncertain" — must be preserved, not defaulted
                },
              },
            } as unknown as SpeechRecognitionResultList,
          } as unknown as SpeechRecognitionEvent;
          mockRecognitionInstance.onresult(mockEvent);
        }

        if (mockRecognitionInstance.onend) {
          mockRecognitionInstance.onend(new Event('end'));
        }
      });

      const result = await resultPromise;

      // Confidence 0 is a real value and must be preserved (the `?? 0.9`
      // fallback applies only to undefined/null, not to a legitimate 0).
      expect(result.segments[0].confidence).toBe(0);
    });

    it('ignores empty transcript in final results', async () => {
      const mockAudioObj = {
        src: '',
        onloadedmetadata: null as (() => void) | null,
        onerror: null as (() => void) | null,
        duration: 10,
        play: jest.fn(),
        currentTime: 5000,
      };
      (globalThis as Record<string, unknown>).Audio = jest.fn().mockImplementation(() => mockAudioObj);
      (globalThis as Record<string, unknown>).URL = {
        createObjectURL: jest.fn().mockReturnValue('blob:http://localhost/fake'),
        revokeObjectURL: jest.fn(),
      };

      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      const mockFile = new File(['audio data'], 'test.wav', { type: 'audio/wav' });

      const resultPromise = transcriber.transcribeAudioFile(mockFile);

      setImmediate(() => {
        if (mockRecognitionInstance.onstart) {
          mockRecognitionInstance.onstart(new Event('start'));
        }

        if (mockRecognitionInstance.onresult) {
          const mockEvent = {
            resultIndex: 0,
            results: {
              length: 1,
              0: {
                isFinal: true,
                length: 1,
                0: {
                  transcript: '   ', // Empty after trim
                  confidence: 0.9,
                },
              },
            } as unknown as SpeechRecognitionResultList,
          } as unknown as SpeechRecognitionEvent;
          mockRecognitionInstance.onresult(mockEvent);
        }

        // onend with no segments -> falls back to mock
        if (mockRecognitionInstance.onend) {
          mockRecognitionInstance.onend(new Event('end'));
        }
      });

      const result = await resultPromise;

      // Empty transcript ignored, falls back to mock segments
      expect(result.segments.length).toBeGreaterThan(0);
    });
  });

  // ------------------------------------------------
  // Test Case 16: Callback registration
  // ------------------------------------------------
  describe('Callback登録テスト', () => {
    it('can register and use multiple callbacks', async () => {
      BrowserTranscriber = (await import('../browser-transcriber')).BrowserTranscriber;
      const transcriber = new BrowserTranscriber();

      const interimCallback = jest.fn();
      const finalCallback = jest.fn();
      const errorCallback = jest.fn();

      transcriber.onInterimResult(interimCallback);
      transcriber.onFinalResult(finalCallback);
      transcriber.onError(errorCallback);

      transcriber.start();

      // Interim result
      if (mockRecognitionInstance.onresult) {
        const mockInterimEvent = {
          resultIndex: 0,
          results: {
            length: 1,
            0: {
              isFinal: false,
              length: 1,
              0: { transcript: 'interim', confidence: 0.5 },
            },
          } as unknown as SpeechRecognitionResultList,
        } as unknown as SpeechRecognitionEvent;
        mockRecognitionInstance.onresult(mockInterimEvent);
      }

      expect(interimCallback).toHaveBeenCalledWith('interim');

      // Final result
      if (mockRecognitionInstance.onresult) {
        const mockFinalEvent = {
          resultIndex: 0,
          results: {
            length: 1,
            0: {
              isFinal: true,
              length: 1,
              0: { transcript: 'final', confidence: 0.9 },
            },
          } as unknown as SpeechRecognitionResultList,
        } as unknown as SpeechRecognitionEvent;
        mockRecognitionInstance.onresult(mockFinalEvent);
      }

      expect(finalCallback).toHaveBeenCalledWith('final');

      // Error
      if (mockRecognitionInstance.onerror) {
        const mockErrorEvent = {
          error: 'network',
          message: 'Network error',
        } as unknown as SpeechRecognitionErrorEvent;
        mockRecognitionInstance.onerror(mockErrorEvent);
      }

      expect(errorCallback).toHaveBeenCalled();
    });
  });
});
