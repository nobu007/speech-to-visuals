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
const originalWindowSpeechRecognition = (globalThis as any).SpeechRecognition;
const originalWindowWebkitSpeechRecognition = (globalThis as any).webkitSpeechRecognition;

// ---------- Test Suite ----------

describe('BrowserTranscriber', () => {
  let BrowserTranscriber: typeof import('../browser-transcriber').BrowserTranscriber;

  const setSpeechRecognitionAPI = (api: any) => {
    (globalThis as any).SpeechRecognition = api;
    (globalThis as any).webkitSpeechRecognition = api;
  };

  const removeSpeechRecognitionAPI = () => {
    delete (globalThis as any).SpeechRecognition;
    delete (globalThis as any).webkitSpeechRecognition;
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
      (globalThis as any).SpeechRecognition = originalWindowSpeechRecognition;
    } else {
      delete (globalThis as any).SpeechRecognition;
    }
    if (originalWindowWebkitSpeechRecognition !== undefined) {
      (globalThis as any).webkitSpeechRecognition = originalWindowWebkitSpeechRecognition;
    } else {
      delete (globalThis as any).webkitSpeechRecognition;
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
        } as any,
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
});
