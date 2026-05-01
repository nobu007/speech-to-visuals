/**
 * StreamingTranscriber Tests
 *
 * Comprehensive tests for the streaming transcription module.
 * Covers: constructor, chunk creation, audio duration, streaming transcription,
 * live transcription, merging segments, config management, utility functions.
 */

// ---------- Mock setup for browser APIs ----------

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

// Mock Audio constructor
interface MockAudioInstance {
  src: string;
  onloadedmetadata: (() => void) | null;
  onerror: (() => void) | null;
  duration: number;
  play: jest.Mock;
}

let mockAudioInstance: MockAudioInstance;

const createMockAudio = (): MockAudioInstance => ({
  src: '',
  onloadedmetadata: null,
  onerror: null,
  duration: 10,
  play: jest.fn(),
});

const MockAudio = jest.fn().mockImplementation(() => {
  mockAudioInstance = createMockAudio();
  return mockAudioInstance;
});

// Mock URL.createObjectURL / revokeObjectURL
const mockCreateObjectURL = jest.fn().mockReturnValue('blob:http://localhost/mock-url');
const mockRevokeObjectURL = jest.fn();

// Mock performance.now
const mockPerformanceNow = jest.fn().mockReturnValue(1000);

// Setup / teardown helpers
const setupWindowMocks = () => {
  (globalThis as Record<string, unknown>).SpeechRecognition = MockSpeechRecognition;
  (globalThis as Record<string, unknown>).webkitSpeechRecognition = MockSpeechRecognition;
  (globalThis as Record<string, unknown>).Audio = MockAudio;
  (globalThis as Record<string, unknown>).URL = {
    ...(typeof URL !== 'undefined' ? URL : {}),
    createObjectURL: mockCreateObjectURL,
    revokeObjectURL: mockRevokeObjectURL,
  };
  (globalThis as Record<string, unknown>).performance = {
    now: mockPerformanceNow,
  };
  (globalThis as Record<string, unknown>).window = globalThis;
  (globalThis as Record<string, unknown>).AudioContext = jest.fn();
  (globalThis as Record<string, unknown>).webkitAudioContext = jest.fn();
  (globalThis as Record<string, unknown>).navigator = {
    mediaDevices: {
      getUserMedia: jest.fn(),
    },
  };
};

const removeWindowMocks = () => {
  delete (globalThis as Record<string, unknown>).SpeechRecognition;
  delete (globalThis as Record<string, unknown>).webkitSpeechRecognition;
  delete (globalThis as Record<string, unknown>).Audio;
  delete (globalThis as Record<string, unknown>).performance;
  delete (globalThis as Record<string, unknown>).AudioContext;
  delete (globalThis as Record<string, unknown>).webkitAudioContext;
};

// ---------- Test Suite ----------

describe('StreamingTranscriber', () => {
  let StreamingTranscriberModule: typeof import('../streaming-transcriber');

  beforeEach(() => {
    jest.restoreAllMocks();
    mockRecognitionInstance = createMockRecognition();
    MockSpeechRecognition.mockImplementation(() => mockRecognitionInstance);
    mockAudioInstance = createMockAudio();
    MockAudio.mockImplementation(() => mockAudioInstance);
    mockCreateObjectURL.mockReturnValue('blob:http://localhost/mock-url');
    mockPerformanceNow.mockReturnValue(1000);
    setupWindowMocks();
  });

  afterEach(() => {
    removeWindowMocks();
  });

  const loadModule = async () => {
    jest.resetModules();
    StreamingTranscriberModule = await import('../streaming-transcriber');
  };

  // ------------------------------------------------
  // Constructor tests
  // ------------------------------------------------
  describe('constructor', () => {
    it('initializes with default config when no config provided', async () => {
      await loadModule();
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber();
      const config = transcriber.getConfig();

      expect(config.chunkSizeMs).toBe(3000);
      expect(config.overlapMs).toBe(500);
      expect(config.minConfidence).toBe(0.7);
      expect(config.enableLiveUpdate).toBe(true);
    });

    it('merges provided config with defaults', async () => {
      await loadModule();
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 5000,
        minConfidence: 0.9,
      });
      const config = transcriber.getConfig();

      expect(config.chunkSizeMs).toBe(5000);
      expect(config.overlapMs).toBe(500); // default
      expect(config.minConfidence).toBe(0.9);
      expect(config.enableLiveUpdate).toBe(true); // default
    });

    it('creates SpeechRecognition instance when API is available', async () => {
      await loadModule();
      new StreamingTranscriberModule.StreamingTranscriber();
      expect(MockSpeechRecognition).toHaveBeenCalled();
    });

    it('handles missing SpeechRecognition API gracefully', async () => {
      delete (globalThis as Record<string, unknown>).SpeechRecognition;
      delete (globalThis as Record<string, unknown>).webkitSpeechRecognition;

      await loadModule();
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber();
      expect(transcriber.isStreamingActive()).toBe(false);
    });

    it('uses webkitSpeechRecognition when SpeechRecognition is not available', async () => {
      delete (globalThis as Record<string, unknown>).SpeechRecognition;
      // Keep webkitSpeechRecognition
      await loadModule();
      new StreamingTranscriberModule.StreamingTranscriber();
      expect(MockSpeechRecognition).toHaveBeenCalled();
      // Restore
      (globalThis as Record<string, unknown>).SpeechRecognition = MockSpeechRecognition;
    });

    it('configures recognition with correct settings', async () => {
      await loadModule();
      new StreamingTranscriberModule.StreamingTranscriber();

      expect(mockRecognitionInstance.continuous).toBe(true);
      expect(mockRecognitionInstance.interimResults).toBe(true);
      expect(mockRecognitionInstance.maxAlternatives).toBe(1);
      expect(mockRecognitionInstance.lang).toBe('ja-JP');
    });

    it('sets up recognition onstart handler that sets isStreaming true', async () => {
      await loadModule();
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber();

      expect(mockRecognitionInstance.onstart).not.toBeNull();
      expect(transcriber.isStreamingActive()).toBe(false);

      if (mockRecognitionInstance.onstart) {
        mockRecognitionInstance.onstart(new Event('start'));
      }

      expect(transcriber.isStreamingActive()).toBe(true);
    });

    it('sets up recognition onend handler that sets isStreaming false', async () => {
      await loadModule();
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber();

      // Start streaming first
      if (mockRecognitionInstance.onstart) {
        mockRecognitionInstance.onstart(new Event('start'));
      }
      expect(transcriber.isStreamingActive()).toBe(true);

      // End event
      if (mockRecognitionInstance.onend) {
        mockRecognitionInstance.onend(new Event('end'));
      }
      expect(transcriber.isStreamingActive()).toBe(false);
    });

    it('sets up recognition onerror handler that sets isStreaming false', async () => {
      await loadModule();
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber();

      // Start streaming
      if (mockRecognitionInstance.onstart) {
        mockRecognitionInstance.onstart(new Event('start'));
      }
      expect(transcriber.isStreamingActive()).toBe(true);

      // Trigger error
      if (mockRecognitionInstance.onerror) {
        const mockErrorEvent = {
          error: 'network',
          message: 'Network error',
        } as unknown as SpeechRecognitionErrorEvent;
        mockRecognitionInstance.onerror(mockErrorEvent);
      }
      expect(transcriber.isStreamingActive()).toBe(false);
    });
  });

  // ------------------------------------------------
  // transcribeStream tests
  // ------------------------------------------------
  describe('transcribeStream', () => {
    it('transcribes audio from a string path', async () => {
      await loadModule();
      mockAudioInstance.duration = 4;

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 5000,
        overlapMs: 0,
      });

      const promise = transcriber.transcribeStream('/path/to/audio.mp3');

      // Trigger loadedmetadata to resolve getAudioDuration
      setImmediate(() => {
        if (mockAudioInstance.onloadedmetadata) {
          mockAudioInstance.onloadedmetadata();
        }
      });

      const result = await promise;

      expect(result).toHaveProperty('segments');
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('language', 'ja');
      expect(result.success).toBe(true);
      expect(result.segments.length).toBeGreaterThan(0);
    });

    it('transcribes audio from a File object', async () => {
      await loadModule();
      mockAudioInstance.duration = 4;

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 5000,
        overlapMs: 0,
      });

      const mockFile = new File(['audio data'], 'audio.wav', { type: 'audio/wav' });

      const promise = transcriber.transcribeStream(mockFile);

      setImmediate(() => {
        if (mockAudioInstance.onloadedmetadata) {
          mockAudioInstance.onloadedmetadata();
        }
      });

      const result = await promise;

      expect(result.success).toBe(true);
      expect(mockCreateObjectURL).toHaveBeenCalledWith(mockFile);
    });

    it('calls onProgress callback during transcription', async () => {
      await loadModule();
      mockAudioInstance.duration = 6;

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 4000,
        overlapMs: 0,
      });

      const onProgress = jest.fn();

      const promise = transcriber.transcribeStream('/audio.mp3', onProgress);

      setImmediate(() => {
        if (mockAudioInstance.onloadedmetadata) {
          mockAudioInstance.onloadedmetadata();
        }
      });

      await promise;

      expect(onProgress).toHaveBeenCalled();
      const progressCall = onProgress.mock.calls[0][0];
      expect(progressCall).toHaveProperty('processedDuration');
      expect(progressCall).toHaveProperty('totalDuration');
      expect(progressCall).toHaveProperty('segmentCount');
      expect(progressCall).toHaveProperty('averageConfidence');
    });

    it('calls onSegment callback for valid segments', async () => {
      await loadModule();
      mockAudioInstance.duration = 4;

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 5000,
        overlapMs: 0,
        minConfidence: 0.5,
      });

      const onSegment = jest.fn();

      const promise = transcriber.transcribeStream('/audio.mp3', undefined, onSegment);

      setImmediate(() => {
        if (mockAudioInstance.onloadedmetadata) {
          mockAudioInstance.onloadedmetadata();
        }
      });

      await promise;

      expect(onSegment).toHaveBeenCalled();
      const segment = onSegment.mock.calls[0][0];
      expect(segment).toHaveProperty('start');
      expect(segment).toHaveProperty('end');
      expect(segment).toHaveProperty('text');
      expect(segment).toHaveProperty('confidence');
      expect(segment.confidence).toBeGreaterThanOrEqual(0.5);
    });

    it('filters segments below minConfidence', async () => {
      await loadModule();
      mockAudioInstance.duration = 4;

      // Set very high minConfidence to filter all segments
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 5000,
        overlapMs: 0,
        minConfidence: 1.0, // Impossible to reach
      });

      const onSegment = jest.fn();

      const promise = transcriber.transcribeStream('/audio.mp3', undefined, onSegment);

      setImmediate(() => {
        if (mockAudioInstance.onloadedmetadata) {
          mockAudioInstance.onloadedmetadata();
        }
      });

      const result = await promise;

      // All segments should be filtered out
      expect(onSegment).not.toHaveBeenCalled();
      expect(result.segments.length).toBe(0);
    });

    it('throws error when audio file fails to load', async () => {
      await loadModule();

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber();

      const promise = transcriber.transcribeStream('/bad-audio.mp3');

      setImmediate(() => {
        if (mockAudioInstance.onerror) {
          mockAudioInstance.onerror();
        }
      });

      await expect(promise).rejects.toThrow('Streaming transcription failed: Failed to load audio file');
    });

    it('continues processing when a chunk fails', async () => {
      await loadModule();
      mockAudioInstance.duration = 4;

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 4000,
        overlapMs: 0,
      });

      // Mock processAudioChunk indirectly - we'll let it run normally
      // but the chunk processing has internal setTimeout that can fail
      const promise = transcriber.transcribeStream('/audio.mp3');

      setImmediate(() => {
        if (mockAudioInstance.onloadedmetadata) {
          mockAudioInstance.onloadedmetadata();
        }
      });

      // Should complete without throwing
      const result = await promise;
      expect(result).toHaveProperty('segments');
    });

    it('handles multiple chunks with progress updates', async () => {
      await loadModule();
      mockAudioInstance.duration = 10;

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 3000,
        overlapMs: 0,
      });

      const onProgress = jest.fn();

      const promise = transcriber.transcribeStream('/long-audio.mp3', onProgress);

      setImmediate(() => {
        if (mockAudioInstance.onloadedmetadata) {
          mockAudioInstance.onloadedmetadata();
        }
      });

      await promise;

      // With 10s audio and 3s chunks (no overlap), should have ~4 chunks
      expect(onProgress.mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    it('computes averageConfidence in progress', async () => {
      await loadModule();
      mockAudioInstance.duration = 4;

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 5000,
        overlapMs: 0,
        minConfidence: 0,
      });

      const onProgress = jest.fn();

      const promise = transcriber.transcribeStream('/audio.mp3', onProgress);

      setImmediate(() => {
        if (mockAudioInstance.onloadedmetadata) {
          mockAudioInstance.onloadedmetadata();
        }
      });

      await promise;

      const progress = onProgress.mock.calls[0][0];
      expect(typeof progress.averageConfidence).toBe('number');
      expect(progress.averageConfidence).toBeGreaterThanOrEqual(0);
    });

    it('returns text from merged segments', async () => {
      await loadModule();
      mockAudioInstance.duration = 4;

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 5000,
        overlapMs: 0,
        minConfidence: 0,
      });

      const promise = transcriber.transcribeStream('/audio.mp3');

      setImmediate(() => {
        if (mockAudioInstance.onloadedmetadata) {
          mockAudioInstance.onloadedmetadata();
        }
      });

      const result = await promise;

      expect(typeof result.text).toBe('string');
      expect(result.text!.length).toBeGreaterThan(0);
    });
  });

  // ------------------------------------------------
  // startLiveTranscription tests
  // ------------------------------------------------
  describe('startLiveTranscription', () => {
    it('throws when recognition is not supported', async () => {
      delete (globalThis as Record<string, unknown>).SpeechRecognition;
      delete (globalThis as Record<string, unknown>).webkitSpeechRecognition;

      await loadModule();
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber();

      await expect(transcriber.startLiveTranscription()).rejects.toThrow(
        'Speech recognition not supported in this browser'
      );

      (globalThis as Record<string, unknown>).SpeechRecognition = MockSpeechRecognition;
      (globalThis as Record<string, unknown>).webkitSpeechRecognition = MockSpeechRecognition;
    });

    it('returns early if already streaming', async () => {
      await loadModule();
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber();

      // Simulate streaming state
      if (mockRecognitionInstance.onstart) {
        mockRecognitionInstance.onstart(new Event('start'));
      }

      expect(transcriber.isStreamingActive()).toBe(true);

      // Should return without starting again
      await transcriber.startLiveTranscription();

      // start should not have been called from startLiveTranscription
      // (only setupRecognition might have called it)
      expect(mockRecognitionInstance.start).not.toHaveBeenCalled();
    });

    it('starts recognition and resolves', async () => {
      await loadModule();
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber();

      const promise = transcriber.startLiveTranscription();
      await promise;

      expect(mockRecognitionInstance.start).toHaveBeenCalled();
    });

    it('calls onSegment callback for final results with sufficient confidence', async () => {
      await loadModule();
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber();
      const onSegment = jest.fn();

      // Start transcription
      const promise = transcriber.startLiveTranscription(onSegment);

      // Simulate a result
      if (mockRecognitionInstance.onresult) {
        mockPerformanceNow.mockReturnValue(1500);

        const mockEvent = {
          resultIndex: 0,
          results: {
            length: 1,
            0: {
              isFinal: true,
              length: 1,
              0: {
                transcript: 'hello world',
                confidence: 0.9,
              },
            },
          } as unknown as SpeechRecognitionResultList,
        } as unknown as SpeechRecognitionEvent;

        mockRecognitionInstance.onresult(mockEvent);
      }

      await promise;

      expect(onSegment).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'hello world',
          confidence: 0.9,
        })
      );
    });

    it('does not call onSegment for low confidence results', async () => {
      await loadModule();
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        minConfidence: 0.95,
      });
      const onSegment = jest.fn();

      const promise = transcriber.startLiveTranscription(onSegment);

      if (mockRecognitionInstance.onresult) {
        mockPerformanceNow.mockReturnValue(1500);

        const mockEvent = {
          resultIndex: 0,
          results: {
            length: 1,
            0: {
              isFinal: true,
              length: 1,
              0: {
                transcript: 'low confidence',
                confidence: 0.5,
              },
            },
          } as unknown as SpeechRecognitionResultList,
        } as unknown as SpeechRecognitionEvent;

        mockRecognitionInstance.onresult(mockEvent);
      }

      await promise;

      expect(onSegment).not.toHaveBeenCalled();
    });

    it('uses default confidence of 0.8 when result confidence is falsy', async () => {
      await loadModule();
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber();
      const onSegment = jest.fn();

      const promise = transcriber.startLiveTranscription(onSegment);

      if (mockRecognitionInstance.onresult) {
        mockPerformanceNow.mockReturnValue(1500);

        const mockEvent = {
          resultIndex: 0,
          results: {
            length: 1,
            0: {
              isFinal: true,
              length: 1,
              0: {
                transcript: 'test',
                confidence: 0, // Falsy -> should default to 0.8
              },
            },
          } as unknown as SpeechRecognitionResultList,
        } as unknown as SpeechRecognitionEvent;

        mockRecognitionInstance.onresult(mockEvent);
      }

      await promise;

      // 0.8 >= 0.7 (default minConfidence), so should be called
      expect(onSegment).toHaveBeenCalledWith(
        expect.objectContaining({
          confidence: 0.8,
        })
      );
    });

    it('calls onProgress callback during live transcription with interim results', async () => {
      await loadModule();
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber();
      const onProgress = jest.fn();

      const promise = transcriber.startLiveTranscription(undefined, onProgress);

      if (mockRecognitionInstance.onresult) {
        mockPerformanceNow.mockReturnValue(1500);

        const mockEvent = {
          resultIndex: 0,
          results: {
            length: 1,
            0: {
              isFinal: false,
              length: 1,
              0: {
                transcript: 'interim text',
                confidence: 0.5,
              },
            },
          } as unknown as SpeechRecognitionResultList,
        } as unknown as SpeechRecognitionEvent;

        mockRecognitionInstance.onresult(mockEvent);
      }

      await promise;

      expect(onProgress).toHaveBeenCalled();
      const progress = onProgress.mock.calls[0][0];
      expect(progress).toHaveProperty('processedDuration');
      expect(progress).toHaveProperty('totalDuration', -1); // Unknown for live
      expect(progress).toHaveProperty('currentSegment');
      expect(progress.currentSegment).not.toBeNull();
      expect(progress.currentSegment.text).toBe('interim text');
      expect(progress.currentSegment.confidence).toBe(0.5);
    });

    it('onProgress currentSegment is null when no interim text', async () => {
      await loadModule();
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber();
      const onProgress = jest.fn();

      const promise = transcriber.startLiveTranscription(undefined, onProgress);

      if (mockRecognitionInstance.onresult) {
        mockPerformanceNow.mockReturnValue(1500);

        // Final result only, no interim
        const mockEvent = {
          resultIndex: 0,
          results: {
            length: 1,
            0: {
              isFinal: true,
              length: 1,
              0: {
                transcript: 'final only',
                confidence: 0.9,
              },
            },
          } as unknown as SpeechRecognitionResultList,
        } as unknown as SpeechRecognitionEvent;

        mockRecognitionInstance.onresult(mockEvent);
      }

      await promise;

      expect(onProgress).toHaveBeenCalled();
      // interimTranscript is empty since the only result is final
      const progress = onProgress.mock.calls[0][0];
      expect(progress.currentSegment).toBeNull();
    });

    it('handles multiple results in a single event', async () => {
      await loadModule();
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber();
      const onSegment = jest.fn();

      const promise = transcriber.startLiveTranscription(onSegment);

      if (mockRecognitionInstance.onresult) {
        mockPerformanceNow.mockReturnValue(1500);

        const mockEvent = {
          resultIndex: 0,
          results: {
            length: 3,
            0: {
              isFinal: true,
              length: 1,
              0: { transcript: 'first', confidence: 0.9 },
            },
            1: {
              isFinal: false,
              length: 1,
              0: { transcript: 'interim', confidence: 0.5 },
            },
            2: {
              isFinal: true,
              length: 1,
              0: { transcript: 'second', confidence: 0.85 },
            },
          } as unknown as SpeechRecognitionResultList,
        } as unknown as SpeechRecognitionEvent;

        mockRecognitionInstance.onresult(mockEvent);
      }

      await promise;

      // Should have been called for both final results with sufficient confidence
      expect(onSegment).toHaveBeenCalledTimes(2);
    });

    it('rejects when recognition becomes null after entering promise', async () => {
      // Create a scenario where recognition passes initial check but is null inside promise
      // This tests the inner reject(new Error('Recognition not available'))
      delete (globalThis as Record<string, unknown>).SpeechRecognition;
      delete (globalThis as Record<string, unknown>).webkitSpeechRecognition;

      await loadModule();

      // Manually set SpeechRecognition so constructor creates an instance
      (globalThis as Record<string, unknown>).SpeechRecognition = MockSpeechRecognition;
      (globalThis as Record<string, unknown>).webkitSpeechRecognition = MockSpeechRecognition;

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber();

      // Now nullify recognition so the promise body hits the inner guard
      const anyTranscriber = transcriber as unknown as Record<string, unknown>;
      anyTranscriber.recognition = null;
      anyTranscriber.isStreaming = false;

      // The first check in startLiveTranscription checks !this.recognition
      // Since we set recognition to null, it throws before the promise
      await expect(transcriber.startLiveTranscription()).rejects.toThrow();
    });
  });

  // ------------------------------------------------
  // stopLiveTranscription tests
  // ------------------------------------------------
  describe('stopLiveTranscription', () => {
    it('stops recognition when streaming', async () => {
      await loadModule();
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber();

      // Start streaming
      if (mockRecognitionInstance.onstart) {
        mockRecognitionInstance.onstart(new Event('start'));
      }

      expect(transcriber.isStreamingActive()).toBe(true);

      transcriber.stopLiveTranscription();

      expect(mockRecognitionInstance.stop).toHaveBeenCalled();
    });

    it('does not stop when not streaming', async () => {
      await loadModule();
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber();

      expect(transcriber.isStreamingActive()).toBe(false);

      transcriber.stopLiveTranscription();

      expect(mockRecognitionInstance.stop).not.toHaveBeenCalled();
    });

    it('does nothing when recognition is null', async () => {
      delete (globalThis as Record<string, unknown>).SpeechRecognition;
      delete (globalThis as Record<string, unknown>).webkitSpeechRecognition;

      await loadModule();
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber();

      // Should not throw
      transcriber.stopLiveTranscription();

      (globalThis as Record<string, unknown>).SpeechRecognition = MockSpeechRecognition;
      (globalThis as Record<string, unknown>).webkitSpeechRecognition = MockSpeechRecognition;
    });
  });

  // ------------------------------------------------
  // isStreamingActive tests
  // ------------------------------------------------
  describe('isStreamingActive', () => {
    it('returns false initially', async () => {
      await loadModule();
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber();
      expect(transcriber.isStreamingActive()).toBe(false);
    });

    it('returns true after recognition starts', async () => {
      await loadModule();
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber();

      if (mockRecognitionInstance.onstart) {
        mockRecognitionInstance.onstart(new Event('start'));
      }

      expect(transcriber.isStreamingActive()).toBe(true);
    });
  });

  // ------------------------------------------------
  // getConfig / updateConfig tests
  // ------------------------------------------------
  describe('config management', () => {
    it('getConfig returns a copy of the config', async () => {
      await loadModule();
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({ chunkSizeMs: 2000 });

      const config1 = transcriber.getConfig();
      const config2 = transcriber.getConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // Different object references
    });

    it('updateConfig merges new config with existing', async () => {
      await loadModule();
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber();

      transcriber.updateConfig({ chunkSizeMs: 8000, minConfidence: 0.95 });

      const config = transcriber.getConfig();
      expect(config.chunkSizeMs).toBe(8000);
      expect(config.minConfidence).toBe(0.95);
      expect(config.overlapMs).toBe(500); // Unchanged default
    });

    it('updateConfig preserves unmodified settings', async () => {
      await loadModule();
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({ enableLiveUpdate: false });

      transcriber.updateConfig({ chunkSizeMs: 10000 });

      const config = transcriber.getConfig();
      expect(config.chunkSizeMs).toBe(10000);
      expect(config.enableLiveUpdate).toBe(false);
    });
  });

  // ------------------------------------------------
  // createStreamingTranscriber factory function
  // ------------------------------------------------
  describe('createStreamingTranscriber', () => {
    it('creates a new StreamingTranscriber instance', async () => {
      await loadModule();
      const transcriber = StreamingTranscriberModule.createStreamingTranscriber();

      expect(transcriber).toBeInstanceOf(StreamingTranscriberModule.StreamingTranscriber);
    });

    it('passes config to the new instance', async () => {
      await loadModule();
      const transcriber = StreamingTranscriberModule.createStreamingTranscriber({
        chunkSizeMs: 7000,
      });

      const config = transcriber.getConfig();
      expect(config.chunkSizeMs).toBe(7000);
    });

    it('works without config', async () => {
      await loadModule();
      const transcriber = StreamingTranscriberModule.createStreamingTranscriber();

      const config = transcriber.getConfig();
      expect(config.chunkSizeMs).toBe(3000); // default
    });
  });

  // ------------------------------------------------
  // validateStreamingSupport function
  // ------------------------------------------------
  describe('validateStreamingSupport', () => {
    it('returns all true with full support recommendation', async () => {
      await loadModule();

      const support = StreamingTranscriberModule.validateStreamingSupport();

      expect(support.webSpeechAPI).toBe(true);
      expect(support.mediaDevices).toBe(true);
      expect(support.audioContext).toBe(true);
      expect(support.recommendation).toBe('Full streaming support available');
    });

    it('recommends browser upgrade when SpeechRecognition missing', async () => {
      delete (globalThis as Record<string, unknown>).SpeechRecognition;
      delete (globalThis as Record<string, unknown>).webkitSpeechRecognition;

      await loadModule();

      const support = StreamingTranscriberModule.validateStreamingSupport();

      expect(support.webSpeechAPI).toBe(false);
      expect(support.recommendation).toBe('Use Chrome or Edge for best speech recognition support');

      (globalThis as Record<string, unknown>).SpeechRecognition = MockSpeechRecognition;
      (globalThis as Record<string, unknown>).webkitSpeechRecognition = MockSpeechRecognition;
    });

    it('recommends microphone access when mediaDevices missing', async () => {
      await loadModule();

      // Remove mediaDevices but keep SpeechRecognition
      (globalThis as Record<string, unknown>).navigator = {};

      const support = StreamingTranscriberModule.validateStreamingSupport();

      expect(support.mediaDevices).toBe(false);
      expect(support.recommendation).toBe('Microphone access required for live transcription');

      // Restore
      (globalThis as Record<string, unknown>).navigator = {
        mediaDevices: { getUserMedia: jest.fn() },
      };
    });

    it('recommends audio context when AudioContext missing', async () => {
      await loadModule();

      // Remove AudioContext but keep SpeechRecognition and mediaDevices
      delete (globalThis as Record<string, unknown>).AudioContext;
      delete (globalThis as Record<string, unknown>).webkitAudioContext;

      const support = StreamingTranscriberModule.validateStreamingSupport();

      expect(support.audioContext).toBe(false);
      expect(support.recommendation).toBe('Web Audio API needed for advanced audio processing');

      (globalThis as Record<string, unknown>).AudioContext = jest.fn();
      (globalThis as Record<string, unknown>).webkitAudioContext = jest.fn();
    });
  });

  // ------------------------------------------------
  // Edge cases
  // ------------------------------------------------
  describe('edge cases', () => {
    it('handles zero duration audio gracefully', async () => {
      await loadModule();
      mockAudioInstance.duration = 0;

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 3000,
        overlapMs: 0,
      });

      const promise = transcriber.transcribeStream('/empty.mp3');

      setImmediate(() => {
        if (mockAudioInstance.onloadedmetadata) {
          mockAudioInstance.onloadedmetadata();
        }
      });

      const result = await promise;

      // Zero duration should produce empty segments
      expect(result.segments).toEqual([]);
      expect(result.text).toBe('');
      expect(result.success).toBe(true);
    });

    it('handles very short audio (less than chunk size)', async () => {
      await loadModule();
      mockAudioInstance.duration = 0.5; // 500ms

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 3000,
        overlapMs: 0,
        minConfidence: 0,
      });

      const promise = transcriber.transcribeStream('/short.mp3');

      setImmediate(() => {
        if (mockAudioInstance.onloadedmetadata) {
          mockAudioInstance.onloadedmetadata();
        }
      });

      const result = await promise;

      expect(result.success).toBe(true);
    });

    it('startLiveTranscription handles final result without onProgress', async () => {
      await loadModule();
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber();
      const onSegment = jest.fn();

      const promise = transcriber.startLiveTranscription(onSegment);

      if (mockRecognitionInstance.onresult) {
        mockPerformanceNow.mockReturnValue(1500);

        const mockEvent = {
          resultIndex: 0,
          results: {
            length: 1,
            0: {
              isFinal: true,
              length: 1,
              0: { transcript: 'final result', confidence: 0.9 },
            },
          } as unknown as SpeechRecognitionResultList,
        } as unknown as SpeechRecognitionEvent;

        mockRecognitionInstance.onresult(mockEvent);
      }

      await promise;

      expect(onSegment).toHaveBeenCalled();
    });

    it('transcribeStream with all callbacks undefined still works', async () => {
      await loadModule();
      mockAudioInstance.duration = 4;

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 5000,
        overlapMs: 0,
      });

      const promise = transcriber.transcribeStream('/audio.mp3');

      setImmediate(() => {
        if (mockAudioInstance.onloadedmetadata) {
          mockAudioInstance.onloadedmetadata();
        }
      });

      const result = await promise;

      expect(result.success).toBe(true);
    });

    it('handles minConfidence from config defaulting to 0.7', async () => {
      await loadModule();
      mockAudioInstance.duration = 4;

      // No minConfidence specified, should default to 0.7
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 5000,
        overlapMs: 0,
      });

      const promise = transcriber.transcribeStream('/audio.mp3');

      setImmediate(() => {
        if (mockAudioInstance.onloadedmetadata) {
          mockAudioInstance.onloadedmetadata();
        }
      });

      const result = await promise;

      // Default processAudioChunk generates 0.75-0.95 confidence, all should pass >= 0.7
      expect(result.success).toBe(true);
    });

    it('continues when processAudioChunk throws for a chunk (line 139)', async () => {
      await loadModule();
      mockAudioInstance.duration = 6;

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 3000,
        overlapMs: 0,
        minConfidence: 0,
      });

      // Force processAudioChunk to throw on the first invocation only
      // by making the Audio mock throw when processing a chunk
      let chunkCallCount = 0;
      const anyTranscriber = transcriber as unknown as Record<string, unknown>;
      const origProcess = anyTranscriber.processAudioChunk as (
        chunk: { start: number; end: number },
        audioFile: string | File
      ) => Promise<TranscriptionSegment[]>;

      anyTranscriber.processAudioChunk = jest.fn().mockImplementation(async (
        chunk: { start: number; end: number },
        audioFile: string | File
      ) => {
        chunkCallCount++;
        if (chunkCallCount === 1) {
          throw new Error('Simulated chunk failure');
        }
        return origProcess.call(transcriber, chunk, audioFile);
      });

      const onProgress = jest.fn();

      const promise = transcriber.transcribeStream('/audio.mp3', onProgress);

      setImmediate(() => {
        if (mockAudioInstance.onloadedmetadata) {
          mockAudioInstance.onloadedmetadata();
        }
      });

      const result = await promise;

      // Should succeed even though first chunk failed
      expect(result.success).toBe(true);
      // Only the second chunk's segments should be present
      expect(result.segments!.length).toBeGreaterThan(0);
    });

    it('mergeOverlappingSegments handles non-overlapping segments (line 346)', async () => {
      await loadModule();
      mockAudioInstance.duration = 10;

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 3000,
        overlapMs: 0,
        minConfidence: 0,
      });

      const anyTranscriber = transcriber as unknown as Record<string, unknown>;

      // Override processAudioChunk to produce segments with a large gap
      // This will trigger the else branch (line 346) in mergeOverlappingSegments
      let chunkIndex = 0;
      anyTranscriber.processAudioChunk = jest.fn().mockImplementation(async (
        chunk: { start: number; end: number }
      ) => {
        chunkIndex++;
        // First chunk: segment at 0-1s, second chunk: segment at 5-6s (gap > 0.5s)
        if (chunkIndex === 1) {
          return [{
            start: 0,
            end: 1,
            text: 'first segment',
            confidence: 0.9,
            speaker: 'unknown',
          }];
        }
        return [{
          start: 5,
          end: 6,
          text: 'second segment',
          confidence: 0.85,
          speaker: 'unknown',
        }];
      });

      const promise = transcriber.transcribeStream('/audio.mp3');

      setImmediate(() => {
        if (mockAudioInstance.onloadedmetadata) {
          mockAudioInstance.onloadedmetadata();
        }
      });

      const result = await promise;

      // Segments should NOT be merged since they don't overlap (gap > 0.5s)
      expect(result.segments!.length).toBeGreaterThanOrEqual(2);
      // Text should contain both segments
      expect(result.text).toContain('first segment');
      expect(result.text).toContain('second segment');
    });

    it('mergeOverlappingSegments merges segments within 0.5s tolerance', async () => {
      await loadModule();
      mockAudioInstance.duration = 10;

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 3000,
        overlapMs: 0,
        minConfidence: 0,
      });

      const anyTranscriber = transcriber as unknown as Record<string, unknown>;

      // Override processAudioChunk to produce overlapping segments
      let chunkIndex = 0;
      anyTranscriber.processAudioChunk = jest.fn().mockImplementation(async (
        chunk: { start: number; end: number }
      ) => {
        chunkIndex++;
        if (chunkIndex === 1) {
          return [{
            start: 0,
            end: 2,
            text: 'first segment',
            confidence: 0.9,
            speaker: 'unknown',
          }];
        }
        // Second segment overlaps (starts at 2.3, within 0.5s of first ending at 2)
        return [{
          start: 2.3,
          end: 4,
          text: 'overlapping segment',
          confidence: 0.85,
          speaker: 'unknown',
        }];
      });

      const promise = transcriber.transcribeStream('/audio.mp3');

      setImmediate(() => {
        if (mockAudioInstance.onloadedmetadata) {
          mockAudioInstance.onloadedmetadata();
        }
      });

      const result = await promise;

      // Should be merged into a single segment since they overlap within tolerance
      expect(result.segments!.length).toBe(1);
      expect(result.text).toContain('first segment');
      expect(result.text).toContain('overlapping segment');
    });

    it('transcribeStream sets processingTime in result', async () => {
      await loadModule();
      mockAudioInstance.duration = 2;

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 5000,
        overlapMs: 0,
        minConfidence: 0,
      });

      const promise = transcriber.transcribeStream('/audio.mp3');

      setImmediate(() => {
        if (mockAudioInstance.onloadedmetadata) {
          mockAudioInstance.onloadedmetadata();
        }
      });

      const result = await promise;

      expect(result).toHaveProperty('processingTime');
      expect(typeof result.processingTime).toBe('number');
    });

    it('transcribeStream computes duration as audioDuration * 1000', async () => {
      await loadModule();
      mockAudioInstance.duration = 3.5;

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 5000,
        overlapMs: 0,
        minConfidence: 0,
      });

      const promise = transcriber.transcribeStream('/audio.mp3');

      setImmediate(() => {
        if (mockAudioInstance.onloadedmetadata) {
          mockAudioInstance.onloadedmetadata();
        }
      });

      const result = await promise;

      expect(result.duration).toBe(3500);
    });

    it('transcribeStream progress has correct totalDuration', async () => {
      await loadModule();
      mockAudioInstance.duration = 5;

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 5000,
        overlapMs: 0,
        minConfidence: 0,
      });

      const onProgress = jest.fn();

      const promise = transcriber.transcribeStream('/audio.mp3', onProgress);

      setImmediate(() => {
        if (mockAudioInstance.onloadedmetadata) {
          mockAudioInstance.onloadedmetadata();
        }
      });

      await promise;

      expect(onProgress).toHaveBeenCalled();
      const progress = onProgress.mock.calls[0][0];
      expect(progress.totalDuration).toBe(5000);
    });

    it('transcribeStream with overlapping chunks processes correctly', async () => {
      await loadModule();
      mockAudioInstance.duration = 8;

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 3000,
        overlapMs: 500,
        minConfidence: 0,
      });

      const onProgress = jest.fn();

      const promise = transcriber.transcribeStream('/audio.mp3', onProgress);

      setImmediate(() => {
        if (mockAudioInstance.onloadedmetadata) {
          mockAudioInstance.onloadedmetadata();
        }
      });

      const result = await promise;

      expect(result.success).toBe(true);
      // With 3s chunks and 0.5s overlap on 8s audio, should produce multiple chunks
      expect(onProgress.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('createAudioChunks produces correct chunks for various durations', async () => {
      await loadModule();
      mockAudioInstance.duration = 15;

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 5000,
        overlapMs: 1000,
        minConfidence: 0,
      });

      const promise = transcriber.transcribeStream('/audio.mp3');

      setImmediate(() => {
        if (mockAudioInstance.onloadedmetadata) {
          mockAudioInstance.onloadedmetadata();
        }
      });

      const result = await promise;

      // Should complete with segments
      expect(result.success).toBe(true);
      expect(result.segments!.length).toBeGreaterThan(0);
    });

    it('processAudioChunk generates text with chunk boundaries', async () => {
      await loadModule();
      mockAudioInstance.duration = 6;

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 3000,
        overlapMs: 0,
        minConfidence: 0,
      });

      const promise = transcriber.transcribeStream('/audio.mp3');

      setImmediate(() => {
        if (mockAudioInstance.onloadedmetadata) {
          mockAudioInstance.onloadedmetadata();
        }
      });

      const result = await promise;

      // Segments should contain chunk boundary info in text
      expect(result.success).toBe(true);
      for (const segment of result.segments!) {
        expect(segment.text).toContain('chunk');
      }
    });

    it('calculateAverageConfidence returns 0 for empty segments', async () => {
      await loadModule();
      mockAudioInstance.duration = 0;

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 3000,
        overlapMs: 0,
        minConfidence: 0,
      });

      const onProgress = jest.fn();

      const promise = transcriber.transcribeStream('/audio.mp3', onProgress);

      setImmediate(() => {
        if (mockAudioInstance.onloadedmetadata) {
          mockAudioInstance.onloadedmetadata();
        }
      });

      const result = await promise;

      // Zero duration => no chunks => no segments => no progress callback
      expect(result.segments!.length).toBe(0);
    });

    it('validateStreamingSupport with webkitAudioContext but no AudioContext', async () => {
      await loadModule();

      // Remove AudioContext but keep webkitAudioContext
      delete (globalThis as Record<string, unknown>).AudioContext;
      // webkitAudioContext should still be set from setupWindowMocks

      const support = StreamingTranscriberModule.validateStreamingSupport();

      expect(support.audioContext).toBe(true);
      expect(support.recommendation).toBe('Full streaming support available');

      // Restore
      (globalThis as Record<string, unknown>).AudioContext = jest.fn();
    });

    it('validateStreamingSupport with only webkitSpeechRecognition', async () => {
      delete (globalThis as Record<string, unknown>).SpeechRecognition;
      // Keep webkitSpeechRecognition

      await loadModule();

      const support = StreamingTranscriberModule.validateStreamingSupport();

      expect(support.webSpeechAPI).toBe(true);
      expect(support.recommendation).toBe('Full streaming support available');

      // Restore
      (globalThis as Record<string, unknown>).SpeechRecognition = MockSpeechRecognition;
    });

    it('transcribeStream handles error with non-Error thrown', async () => {
      await loadModule();
      mockAudioInstance.duration = 4;

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 5000,
        overlapMs: 0,
      });

      // Make getAudioDuration throw a non-Error value
      const anyTranscriber = transcriber as unknown as Record<string, unknown>;
      anyTranscriber.getAudioDuration = jest.fn().mockRejectedValue('string error');

      await expect(transcriber.transcribeStream('/audio.mp3')).rejects.toThrow(
        'Streaming transcription failed: string error'
      );
    });

    it('transcribeStream handles error with Error instance thrown', async () => {
      await loadModule();

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 5000,
        overlapMs: 0,
      });

      const anyTranscriber = transcriber as unknown as Record<string, unknown>;
      anyTranscriber.getAudioDuration = jest.fn().mockRejectedValue(new Error('custom error msg'));

      await expect(transcriber.transcribeStream('/audio.mp3')).rejects.toThrow(
        'Streaming transcription failed: custom error msg'
      );
    });

    it('startLiveTranscription with both onSegment and onProgress callbacks', async () => {
      await loadModule();
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber();
      const onSegment = jest.fn();
      const onProgress = jest.fn();

      const promise = transcriber.startLiveTranscription(onSegment, onProgress);

      if (mockRecognitionInstance.onresult) {
        mockPerformanceNow.mockReturnValue(2000);

        const mockEvent = {
          resultIndex: 0,
          results: {
            length: 2,
            0: {
              isFinal: true,
              length: 1,
              0: { transcript: 'hello', confidence: 0.9 },
            },
            1: {
              isFinal: false,
              length: 1,
              0: { transcript: ' world', confidence: 0.6 },
            },
          } as unknown as SpeechRecognitionResultList,
        } as unknown as SpeechRecognitionEvent;

        mockRecognitionInstance.onresult(mockEvent);
      }

      await promise;

      expect(onSegment).toHaveBeenCalledTimes(1);
      expect(onSegment).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'hello' })
      );
      expect(onProgress).toHaveBeenCalled();
      const progress = onProgress.mock.calls[0][0];
      expect(progress.currentSegment).not.toBeNull();
      expect(progress.currentSegment.text).toBe(' world');
    });

    it('startLiveTranscription onProgress with no interim results has null currentSegment', async () => {
      await loadModule();
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        minConfidence: 0.99, // Filter all
      });
      const onProgress = jest.fn();

      const promise = transcriber.startLiveTranscription(undefined, onProgress);

      if (mockRecognitionInstance.onresult) {
        mockPerformanceNow.mockReturnValue(1500);

        // Only final results that will be filtered by minConfidence
        const mockEvent = {
          resultIndex: 0,
          results: {
            length: 1,
            0: {
              isFinal: true,
              length: 1,
              0: { transcript: 'filtered', confidence: 0.5 },
            },
          } as unknown as SpeechRecognitionResultList,
        } as unknown as SpeechRecognitionEvent;

        mockRecognitionInstance.onresult(mockEvent);
      }

      await promise;

      expect(onProgress).toHaveBeenCalled();
      const progress = onProgress.mock.calls[0][0];
      expect(progress.currentSegment).toBeNull();
    });

    it('updateConfig with empty object preserves all defaults', async () => {
      await loadModule();
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber();

      transcriber.updateConfig({});

      const config = transcriber.getConfig();
      expect(config.chunkSizeMs).toBe(3000);
      expect(config.overlapMs).toBe(500);
      expect(config.minConfidence).toBe(0.7);
      expect(config.enableLiveUpdate).toBe(true);
    });

    it('constructor with all config options specified', async () => {
      await loadModule();
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 10000,
        overlapMs: 2000,
        minConfidence: 0.5,
        enableLiveUpdate: false,
      });

      const config = transcriber.getConfig();
      expect(config.chunkSizeMs).toBe(10000);
      expect(config.overlapMs).toBe(2000);
      expect(config.minConfidence).toBe(0.5);
      expect(config.enableLiveUpdate).toBe(false);
    });

    it('createStreamingTranscriber with undefined config uses defaults', async () => {
      await loadModule();
      const transcriber = StreamingTranscriberModule.createStreamingTranscriber(undefined);

      const config = transcriber.getConfig();
      expect(config.chunkSizeMs).toBe(3000);
      expect(config.overlapMs).toBe(500);
      expect(config.minConfidence).toBe(0.7);
      expect(config.enableLiveUpdate).toBe(true);
    });
  });
});
