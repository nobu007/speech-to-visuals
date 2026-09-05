/**
 * StreamingTranscriber Tests
 *
 * Comprehensive tests for the streaming transcription module.
 * Covers: constructor, chunk creation, audio duration, streaming transcription,
 * live transcription, merging segments, config management, utility functions.
 */

// ---------- Mock setup for browser APIs ----------

// Module-scoped jest (not the global bridge from setupJestGlobals.ts):
// relative-specifier unstable_mockModule resolves against the CALLING file,
// and the bridged global attributes the call to the setup file instead.
import { jest } from '@jest/globals';
import type { TranscriptionSegment, TranscriptionResult } from '../types';
// Type-only import from the engine module (NOT a local restatement): the
// mockImplementation hooks below are annotated with the engine's own
// interface, so the hook names here have a single source instead of a
// drifting local copy. `import type` is erased at runtime — it does not
// bypass the unstable_mockModule wiring below. NOTE: drift detection in CI
// stays BEHAVIORAL, not compile-time — this file lives under
// src/**/__tests__/**, which both tsc configs exclude, and ts-jest runs
// transpile-only (isolatedModules), so a renamed engine hook is caught by
// the onError/partial-final legs going RED when the hook stops firing,
// not by the compiler.
import type { WebSpeechFileHooks } from '../web-speech-file-transcription';
import { fireAudioMetadata, fireAudioError } from './audio-mock-helpers';

// TASK-0319 routing legs mock the two delegation targets so the ROUTING is
// under test, not the engines (their own contracts are pinned in
// web-speech-file-transcription.test.ts and whisper-transcriber.test.ts).
// ESM: jest.mock is a no-op — unstable_mockModule + the dynamic import in
// loadModule() wire these into the SUT's import graph.
const mockTranscribeFileWithWebSpeech = jest.fn();
jest.unstable_mockModule('../web-speech-file-transcription', () => ({
  transcribeFileWithWebSpeech: mockTranscribeFileWithWebSpeech,
}));

const mockWhisperTranscribe = jest.fn();
jest.unstable_mockModule('../whisper-transcriber', () => ({
  whisperTranscriber: { transcribe: mockWhisperTranscribe },
}));

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
    // restoreAllMocks does not clear plain jest.fn() call history — the
    // routing mocks (module-level, shared across every test in this file)
    // must start each test clean or `not.toHaveBeenCalled()` legs leak.
    mockTranscribeFileWithWebSpeech.mockReset();
    mockWhisperTranscribe.mockReset();
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

    // --- Parameter validation tests ---

    it('throws TranscriptionError when chunkSizeMs is zero', async () => {
      await loadModule();
      expect(() => new StreamingTranscriberModule.StreamingTranscriber({ chunkSizeMs: 0 }))
        .toThrow('chunkSizeMs');
    });

    it('throws TranscriptionError when chunkSizeMs is negative', async () => {
      await loadModule();
      expect(() => new StreamingTranscriberModule.StreamingTranscriber({ chunkSizeMs: -100 }))
        .toThrow('chunkSizeMs');
    });

    it('throws TranscriptionError when chunkSizeMs exceeds 60000', async () => {
      await loadModule();
      expect(() => new StreamingTranscriberModule.StreamingTranscriber({ chunkSizeMs: 70000 }))
        .toThrow('chunkSizeMs');
    });

    it('throws TranscriptionError when overlapMs is negative', async () => {
      await loadModule();
      expect(() => new StreamingTranscriberModule.StreamingTranscriber({ overlapMs: -10 }))
        .toThrow('overlapMs');
    });

    it('throws TranscriptionError when overlapMs >= chunkSizeMs', async () => {
      await loadModule();
      expect(() => new StreamingTranscriberModule.StreamingTranscriber({ chunkSizeMs: 3000, overlapMs: 3000 }))
        .toThrow('overlapMs');
    });

    it('throws TranscriptionError when minConfidence is negative', async () => {
      await loadModule();
      expect(() => new StreamingTranscriberModule.StreamingTranscriber({ minConfidence: -0.1 }))
        .toThrow('minConfidence');
    });

    it('throws TranscriptionError when minConfidence exceeds 1', async () => {
      await loadModule();
      expect(() => new StreamingTranscriberModule.StreamingTranscriber({ minConfidence: 1.5 }))
        .toThrow('minConfidence');
    });

    it('accepts valid config at boundary values', async () => {
      await loadModule();
      // chunkSizeMs = 1 (min), overlapMs = 0 (min), minConfidence = 0 (min)
      const transcriber1 = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 1,
        overlapMs: 0,
        minConfidence: 0,
      });
      expect(transcriber1.getConfig().chunkSizeMs).toBe(1);

      // chunkSizeMs = 60000 (max), minConfidence = 1 (max)
      const transcriber2 = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 60000,
        overlapMs: 59999,
        minConfidence: 1,
      });
      expect(transcriber2.getConfig().chunkSizeMs).toBe(60000);
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
      fireAudioMetadata(mockAudioInstance);

      const result = await promise;

      expect(result).toHaveProperty('segments');
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('duration');
      // Round 22: language is content-derived — this path's chunk-mock text
      // is English, so 'en'. The old pin was on the removed hardcoded 'ja'.
      expect(result).toHaveProperty('language', 'en');
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

      fireAudioMetadata(mockAudioInstance);

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

      fireAudioMetadata(mockAudioInstance);

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

      fireAudioMetadata(mockAudioInstance);

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

      fireAudioMetadata(mockAudioInstance);

      const result = await promise;

      // All segments should be filtered out
      expect(onSegment).not.toHaveBeenCalled();
      expect(result.segments.length).toBe(0);
    });

    it('resolves with a disclosed empty placeholder when audio fails to load (TASK-0319)', async () => {
      await loadModule();

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber();

      const promise = transcriber.transcribeStream('/bad-audio.mp3');

      fireAudioError(mockAudioInstance);

      // A duration-probe failure no longer rejects the run: no ASR ran, so
      // the honest outcome is the disclosed placeholder with an empty
      // segment plan (dataflow.md error flow), never a thrown error.
      const result = await promise;
      expect(result.success).toBe(true);
      expect(result.placeholder).toBe(true);
      expect(result.segments).toEqual([]);
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

      fireAudioMetadata(mockAudioInstance);

      // Should complete without throwing
      const result = await promise;
      expect(result).toHaveProperty('segments');
    });

    it('emits exactly one completion progress event regardless of chunk count (TASK-0319 SD3)', async () => {
      await loadModule();
      mockAudioInstance.duration = 10;

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 3000,
        overlapMs: 0,
      });

      const onProgress = jest.fn();

      const promise = transcriber.transcribeStream('/long-audio.mp3', onProgress);

      fireAudioMetadata(mockAudioInstance);

      await promise;

      // 10s audio / 3s chunks (~4 chunks) still yields ONE completion event
      // on the placeholder path — per-chunk stagger was synthetic progress,
      // never a real measurement (SD3).
      expect(onProgress).toHaveBeenCalledTimes(1);
      const progress = onProgress.mock.calls[0][0];
      expect(progress.totalDuration).toBe(10000);
      expect(progress.segmentCount).toBeGreaterThan(0);
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

      fireAudioMetadata(mockAudioInstance);

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

      fireAudioMetadata(mockAudioInstance);

      const result = await promise;

      expect(typeof result.text).toBe('string');
      expect(result.text!.length).toBeGreaterThan(0);
    });
  });

  // ------------------------------------------------
  // transcribeStream environment routing (TASK-0319 / TC-408-01・TC-408-03)
  //
  // REQ-424: transcribeStream routes by environment instead of simulating a
  // chunk loop everywhere:
  //   経路1 browser + File + Web Speech constructors → shared file engine
  //          (transcribeFileWithWebSpeech), real per-final events only
  //   経路2 Node → whisperTranscriber.transcribe delegation; the whisper
  //          gate being closed (placeholder: true) falls through to 経路3
  //   経路3 no ASR available → disclosed placeholder (fixed sentences,
  //          PLACEHOLDER_CHUNK_CONFIDENCE, result.placeholder === true)
  // ------------------------------------------------
  describe('transcribeStream routing (TASK-0319)', () => {
    // Disclosure-content pin (TC-408-03 leg form), single definition: a
    // placeholder outcome is honest only if every segment is a streaming-side
    // fixed sentence carrying the disclosed PLACEHOLDER_CHUNK_CONFIDENCE —
    // a bare "segments exist" claim could hide a non-placeholder fake run.
    // The five placeholder legs below share this helper instead of
    // restating the for-loop, so the fixed-sentence prefix and the
    // confidence source have exactly one home in this file (breaking the
    // fixed sentence in src/ turns all five legs RED — mutation-verified).
    // If this ever outgrows this describe block, extract it under tests/
    // (type-checked include) — src/**/__tests__ files are never
    // type-checked (AGENTS.md テスト規約).
    const assertPlaceholderDisclosure = (result: TranscriptionResult) => {
      expect(result.segments!.length).toBeGreaterThan(0);
      for (const segment of result.segments!) {
        expect(segment.confidence).toBe(StreamingTranscriberModule.PLACEHOLDER_CHUNK_CONFIDENCE);
        expect(segment.text).toContain('Processed segment');
      }
    };

    it('browser File run delegates to the shared Web Speech engine and forwards per-final events (TC-408-01 a)', async () => {
      await loadModule();
      mockAudioInstance.duration = 10;

      const seg1: TranscriptionSegment = { id: 0, start: 0, end: 2100, text: 'first utterance', confidence: 0.9 };
      const seg2: TranscriptionSegment = { id: 1, start: 2100, end: 4200, text: 'second utterance', confidence: 0.85 };
      mockTranscribeFileWithWebSpeech.mockImplementation(
        async (_file: File, hooks?: WebSpeechFileHooks) => {
          hooks?.onFinalSegment?.(seg1);
          hooks?.onFinalSegment?.(seg2);
          return [seg1, seg2];
        },
      );

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber();
      const file = new File(['audio'], 'audio.wav', { type: 'audio/wav' });
      const onProgress = jest.fn();
      const onSegment = jest.fn();

      const promise = transcriber.transcribeStream(file, onProgress, onSegment);
      fireAudioMetadata(mockAudioInstance);
      const result = await promise;

      // Delegation goes to the SINGLE-SOURCE engine (TASK-0318)
      expect(mockTranscribeFileWithWebSpeech).toHaveBeenCalledTimes(1);
      expect(mockTranscribeFileWithWebSpeech).toHaveBeenCalledWith(
        file,
        expect.objectContaining({ onFinalSegment: expect.any(Function) }),
      );

      // Real events only: one onSegment + one onProgress PER final result —
      // no synthetic chunk stagger (SD3)
      expect(onSegment).toHaveBeenCalledTimes(2);
      expect(onSegment).toHaveBeenNthCalledWith(1, seg1);
      expect(onSegment).toHaveBeenNthCalledWith(2, seg2);
      expect(onProgress).toHaveBeenCalledTimes(2);

      // Engine utterances are adopted as-is (adjacent utterances NOT merged
      // away) and the run discloses placeholder: false — real ASR ran
      expect(result.placeholder).toBe(false);
      expect(result.success).toBe(true);
      expect(result.segments).toEqual([seg1, seg2]);
    });

    it('Node run delegates to whisperTranscriber.transcribe, adopts non-placeholder segments, and emits exactly one completion onProgress (TC-408-01 b)', async () => {
      await loadModule();
      // Node env for this leg only: the outer beforeEach installs the
      // browser globals; removing window makes typeof window === 'undefined'.
      delete (globalThis as Record<string, unknown>).window;

      const whisperSegments: TranscriptionSegment[] = [
        { id: 0, start: 0, end: 4000, text: 'measured one' },
        { id: 1, start: 4000, end: 9000, text: 'measured two' },
      ];
      mockWhisperTranscribe.mockResolvedValue({
        segments: whisperSegments,
        text: 'measured one measured two',
        language: 'en',
        duration: 9000,
        success: true,
        placeholder: false,
      });

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber();
      const onProgress = jest.fn();
      const onSegment = jest.fn();

      const result = await transcriber.transcribeStream('/srv/audio.wav', onProgress, onSegment);

      expect(mockWhisperTranscribe).toHaveBeenCalledTimes(1);
      expect(mockWhisperTranscribe).toHaveBeenCalledWith('/srv/audio.wav');

      // Whisper's measured segments adopted as-is (confidence undefined —
      // the whisper.cpp no-confidence contract)
      expect(result.placeholder).toBe(false);
      expect(result.success).toBe(true);
      expect(result.segments).toEqual(whisperSegments);

      // Single-shot inference → completion progress EXACTLY once, and no
      // per-segment onSegment (there were no incremental events)
      expect(onProgress).toHaveBeenCalledTimes(1);
      expect(onProgress.mock.calls[0][0].segmentCount).toBe(2);
      expect(onSegment).not.toHaveBeenCalled();
    });

    it('Node run falls through to the disclosure placeholder when the whisper gate is closed (TC-408-01 c・TC-408-03)', async () => {
      await loadModule();
      delete (globalThis as Record<string, unknown>).window;

      // Gate closed: whisper discloses placeholder: true with its OWN fixed
      // sentences — streaming must NOT adopt them (no double carry-in) and
      // must emit its own disclosed placeholder instead.
      mockWhisperTranscribe.mockResolvedValue({
        segments: [
          { id: 0, start: 0, end: 10000, text: 'whisper-side fixed sentence', confidence: 0.95 },
        ],
        text: 'whisper-side fixed sentence',
        language: 'en',
        duration: 30000,
        success: true,
        placeholder: true,
      });

      // 経路3 chunk-count disclosure needs an audio duration (the Audio
      // global survives the window deletion above)
      mockAudioInstance.duration = 6;

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 3000,
        overlapMs: 0,
        minConfidence: 0,
      });

      const promise = transcriber.transcribeStream('/srv/audio.wav');
      fireAudioMetadata(mockAudioInstance);
      const result = await promise;

      expect(mockWhisperTranscribe).toHaveBeenCalledTimes(1);
      // TC-408-03 result flag: no ASR ran → placeholder: true, never a bare
      // success: true dressed up as a measurement
      expect(result.placeholder).toBe(true);
      expect(result.success).toBe(true);
      // Streaming-side fixed sentences (NOT whisper's), all carrying the
      // disclosed PLACEHOLDER_CHUNK_CONFIDENCE
      assertPlaceholderDisclosure(result);
      expect(result.segments!.every((s) => s.text !== 'whisper-side fixed sentence')).toBe(true);
    });

    it('Node run falls through to the disclosure placeholder when whisper throws (dataflow error flow)', async () => {
      await loadModule();
      delete (globalThis as Record<string, unknown>).window;

      // An inference exception (undecodable input / missing file) is a
      // gate-closed outcome, not a rejected transcription — the same
      // fail-closed shape as the whisper-side placeholder disclosure above.
      mockWhisperTranscribe.mockRejectedValue(new Error('undecodable audio'));

      mockAudioInstance.duration = 4;
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 4000,
        overlapMs: 0,
        minConfidence: 0,
      });

      const promise = transcriber.transcribeStream('/srv/bad.wav');
      fireAudioMetadata(mockAudioInstance);
      const result = await promise;

      expect(mockWhisperTranscribe).toHaveBeenCalledTimes(1);
      expect(result.placeholder).toBe(true);
      expect(result.success).toBe(true);
      // Same disclosure-content pin as the TC-408-03 leg above (helper), so
      // THIS describe verifies the fallback content on its own — never a
      // bare "some segments" claim that could hide a non-placeholder fake run.
      assertPlaceholderDisclosure(result);
    });

    it('browser run without Web Speech constructors routes to the disclosure placeholder (TC-408-01 c)', async () => {
      await loadModule();
      // window stays (browser) but the recognition constructors are absent
      delete (globalThis as Record<string, unknown>).SpeechRecognition;
      delete (globalThis as Record<string, unknown>).webkitSpeechRecognition;

      mockAudioInstance.duration = 4;
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 4000,
        overlapMs: 0,
        minConfidence: 0,
      });
      const file = new File(['audio'], 'audio.wav', { type: 'audio/wav' });

      const promise = transcriber.transcribeStream(file);
      fireAudioMetadata(mockAudioInstance);
      const result = await promise;

      expect(result.placeholder).toBe(true);
      // Same disclosure-content pin as every other placeholder leg here
      assertPlaceholderDisclosure(result);
      expect(mockTranscribeFileWithWebSpeech).not.toHaveBeenCalled();
    });

    it('engine rejection (API vanished at call time) falls back to the disclosure placeholder', async () => {
      await loadModule();
      mockTranscribeFileWithWebSpeech.mockRejectedValue(new Error('Speech recognition not available'));
      mockAudioInstance.duration = 4;

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 4000,
        overlapMs: 0,
        minConfidence: 0,
      });
      const file = new File(['audio'], 'audio.wav', { type: 'audio/wav' });

      const promise = transcriber.transcribeStream(file);
      fireAudioMetadata(mockAudioInstance);
      const result = await promise;

      // Failure to RUN an engine is a disclosure-placeholder outcome, not a
      // rejected transcription (dataflow.md error flow)
      expect(result.placeholder).toBe(true);
      expect(result.success).toBe(true);
      // Same disclosure-content pin as every other placeholder leg here
      assertPlaceholderDisclosure(result);
    });

    // Engine-contract legs: the TASK-0318 engine never throws its error
    // state — it reports through hooks.onError and resolves (see
    // WebSpeechFileHooks, web-speech-file-transcription.ts:31-40). These
    // legs pin how transcribeStream turns each error shape into an outcome.
    // The hooks type is the engine's own WebSpeechFileHooks import (top of
    // file) — single-sourced hook names. If the engine renames a hook at
    // runtime, the mock's `hooks?.onError?.(...)` no-ops, the 0-finals leg
    // below stops seeing the error, and it goes RED (verified by mutation).
    // Note the typed mock now accepts every engine hook (onend etc.), but a
    // clean-onend `[]` and an onError-then-`[]` resolve identically at the
    // boundary — that indistinguishability is exactly why the engine carries
    // onError at all, and why the 0-finals leg fires it explicitly instead
    // of relying on an empty return.

    it('engine onError with zero finals falls back to the disclosure placeholder', async () => {
      await loadModule();
      mockTranscribeFileWithWebSpeech.mockImplementation(
        async (_file: File, hooks?: WebSpeechFileHooks) => {
          hooks?.onError?.('no-speech');
          return [];
        },
      );

      mockAudioInstance.duration = 4;
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 4000,
        overlapMs: 0,
        minConfidence: 0,
      });
      const file = new File(['audio'], 'audio.wav', { type: 'audio/wav' });

      const promise = transcriber.transcribeStream(file);
      fireAudioMetadata(mockAudioInstance);
      const result = await promise;

      // 0-final error run: no ASR utterance exists, so the honest outcome is
      // the disclosed placeholder (dataflow.md error flow)
      expect(mockTranscribeFileWithWebSpeech).toHaveBeenCalledTimes(1);
      expect(result.placeholder).toBe(true);
      expect(result.success).toBe(true);
      // Disclosure-content pin (TC-408-03 leg form, helper): the placeholder
      // legs in this describe stand alone — fixed sentence + disclosed
      // confidence, not just "segments exist"
      assertPlaceholderDisclosure(result);
    });

    it('engine onError after partial finals keeps the measured run (placeholder stays false)', async () => {
      await loadModule();
      const seg1: TranscriptionSegment = { id: 0, start: 0, end: 2100, text: 'before the drop', confidence: 0.9 };
      mockTranscribeFileWithWebSpeech.mockImplementation(
        async (_file: File, hooks?: WebSpeechFileHooks) => {
          hooks?.onFinalSegment?.(seg1);
          hooks?.onError?.('network');
          return [seg1];
        },
      );

      mockAudioInstance.duration = 4;
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber();
      const file = new File(['audio'], 'audio.wav', { type: 'audio/wav' });

      const promise = transcriber.transcribeStream(file);
      fireAudioMetadata(mockAudioInstance);
      const result = await promise;

      // Real utterances WERE measured before the error — the run stays a
      // real run; error-with-finals must not masquerade as gate-closed
      expect(result.placeholder).toBe(false);
      expect(result.success).toBe(true);
      expect(result.segments).toEqual([seg1]);
    });

    it('a duration-probe failure does not block the engine run (probe failure = warn + 0)', async () => {
      await loadModule();
      const seg1: TranscriptionSegment = { id: 0, start: 0, end: 1500, text: 'only utterance', confidence: 0.9 };
      mockTranscribeFileWithWebSpeech.mockImplementation(
        async (_file: File, hooks?: WebSpeechFileHooks) => {
          hooks?.onFinalSegment?.(seg1);
          return [seg1];
        },
      );

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber();
      const file = new File(['audio'], 'audio.wav', { type: 'audio/wav' });
      const onProgress = jest.fn();

      const promise = transcriber.transcribeStream(file, onProgress);
      fireAudioError(mockAudioInstance);
      const result = await promise;

      // The probe feeds progress denominators only; its failure never blocks
      // routing (streaming-transcriber.ts:169-171) — the engine still runs
      // and the run is real, with the unknown duration disclosed as 0
      expect(mockTranscribeFileWithWebSpeech).toHaveBeenCalledTimes(1);
      expect(result.placeholder).toBe(false);
      expect(result.duration).toBe(0);
      expect(onProgress).toHaveBeenCalledTimes(1);
      expect(onProgress.mock.calls[0][0].totalDuration).toBe(0);
    });

    it('a throwing onSegment callback does not break the engine run (per-final guard)', async () => {
      await loadModule();
      const seg1: TranscriptionSegment = { id: 0, start: 0, end: 2100, text: 'first utterance', confidence: 0.9 };
      const seg2: TranscriptionSegment = { id: 1, start: 2100, end: 4200, text: 'second utterance', confidence: 0.85 };
      mockTranscribeFileWithWebSpeech.mockImplementation(
        async (_file: File, hooks?: WebSpeechFileHooks) => {
          hooks?.onFinalSegment?.(seg1);
          hooks?.onFinalSegment?.(seg2);
          return [seg1, seg2];
        },
      );

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber();
      const file = new File(['audio'], 'audio.wav', { type: 'audio/wav' });
      const onProgress = jest.fn();
      const onSegment = jest.fn().mockImplementationOnce(() => {
        throw new Error('UI render boom');
      });

      const promise = transcriber.transcribeStream(file, onProgress, onSegment);
      fireAudioMetadata(mockAudioInstance);
      const result = await promise;

      // One failing consumer callback is logged and swallowed: the second
      // final still forwards and the result keeps every engine utterance
      expect(onSegment).toHaveBeenCalledTimes(2);
      expect(onProgress).toHaveBeenCalledTimes(2);
      expect(result.placeholder).toBe(false);
      expect(result.segments).toEqual([seg1, seg2]);
    });

    it('probes audio duration at most once per run (経路1→経路3 fallback reuses the memoized probe)', async () => {
      await loadModule();
      mockTranscribeFileWithWebSpeech.mockRejectedValue(new Error('engine gone at call time'));
      mockAudioInstance.duration = 4;

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 4000,
        overlapMs: 0,
        minConfidence: 0,
      });
      const file = new File(['audio'], 'audio.wav', { type: 'audio/wav' });

      // Plain jest.fn() history survives restoreAllMocks (see the
      // beforeEach note) — start this leg's probe count at zero explicitly.
      MockAudio.mockClear();

      const promise = transcriber.transcribeStream(file);
      fireAudioMetadata(mockAudioInstance);
      const result = await promise;

      expect(result.placeholder).toBe(true);
      // 経路1 already probed; the 経路3 fallback must REUSE that probe
      // instead of constructing a second Audio element ("at most once per
      // run", streaming-transcriber.ts:167-171)
      expect(MockAudio).toHaveBeenCalledTimes(1);
    });

    it('Node: constructor and validateStreamingSupport work without window (SD6)', async () => {
      await loadModule();
      delete (globalThis as Record<string, unknown>).window;
      delete (globalThis as Record<string, unknown>).SpeechRecognition;
      delete (globalThis as Record<string, unknown>).webkitSpeechRecognition;

      expect(
        () => new StreamingTranscriberModule.StreamingTranscriber({ chunkSizeMs: 2000, overlapMs: 0 }),
      ).not.toThrow();

      const support = StreamingTranscriberModule.validateStreamingSupport();
      expect(support.webSpeechAPI).toBe(false);
      expect(typeof support.recommendation).toBe('string');
    });
  });

  // TASK-0320 / TC-408-04 (AC-D6-4): "unmeasured" (confidence === undefined,
  // whisper.cpp rows) and a LOW MEASUREMENT (numeric below threshold) are
  // distinct. The minConfidence filter must pass unmeasured segments and
  // compare only numeric values, and StreamingQualityMonitor.evaluateChunk
  // must run on measured chunks only — 経路2 (whisper, all-unmeasured) and
  // 経路3 (disclosed placeholder) never feed it, so their summaries report
  // zero evaluated chunks instead of a fabricated 0-reject count.
  describe('transcribeStream confidence semantics (TASK-0320 / TC-408-04)', () => {
    // The real (unmocked) session monitor is the observation point here —
    // only the routing targets (engine / whisper) are mocked at module level.
    const spyEvaluateChunk = (transcriber: InstanceType<typeof StreamingTranscriberModule.StreamingTranscriber>) => {
      const monitor = transcriber.getQualityMonitor();
      if (!monitor) throw new Error('quality monitor not initialized');
      return jest.spyOn(monitor, 'evaluateChunk');
    };

    const assertZeroEvaluatedSummary = (transcriber: InstanceType<typeof StreamingTranscriberModule.StreamingTranscriber>) => {
      const summary = transcriber.getQualitySummary();
      if (!summary) throw new Error('quality summary missing');
      // 「評価対象 chunk なし」shape: no fabricated 0-rejects, no accepted
      expect(summary.totalChunks).toBe(0);
      expect(summary.acceptedChunks).toBe(0);
      expect(summary.rejectedChunks).toBe(0);
    };

    it('経路2: unmeasured (undefined) segments pass the minConfidence filter while a low measurement is rejected', async () => {
      await loadModule();
      delete (globalThis as Record<string, unknown>).window;

      // Mixed delegation output: whisper.cpp's no-confidence contract makes
      // undefined the common case; a numeric below threshold is a real LOW
      // READING that the filter must still reject.
      const unmeasured = { id: 0, start: 0, end: 4000, text: 'whisper row (no confidence)' };
      const low = { id: 1, start: 4000, end: 6000, text: 'low measurement', confidence: 0.3 };
      const good = { id: 2, start: 6000, end: 9000, text: 'good measurement', confidence: 0.9 };
      mockWhisperTranscribe.mockResolvedValue({
        segments: [unmeasured, low, good],
        text: 'mixed',
        language: 'en',
        duration: 9000,
        success: true,
        placeholder: false,
      });

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({ minConfidence: 0.7 });
      const result = await transcriber.transcribeStream('/srv/audio.wav');

      expect(result.placeholder).toBe(false);
      // Unmeasured ≠ low: undefined passes, 0.3 is rejected, 0.9 passes
      expect(result.segments).toEqual([unmeasured, good]);
    });

    it('経路2: evaluateChunk is never called and the summary reports zero evaluated chunks', async () => {
      await loadModule();
      delete (globalThis as Record<string, unknown>).window;

      mockWhisperTranscribe.mockResolvedValue({
        segments: [
          { id: 0, start: 0, end: 4000, text: 'measured one' },
          { id: 1, start: 4000, end: 9000, text: 'measured two' },
        ],
        text: 'measured one measured two',
        language: 'en',
        duration: 9000,
        success: true,
        placeholder: false,
      });

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber();
      const evaluateSpy = spyEvaluateChunk(transcriber);
      const result = await transcriber.transcribeStream('/srv/audio.wav');

      expect(evaluateSpy).not.toHaveBeenCalled();
      assertZeroEvaluatedSummary(transcriber);
      // The result still carries the zero-count summary shape
      expect(result.qualitySummary?.totalChunks).toBe(0);
      expect(result.qualitySummary?.rejectedChunks).toBe(0);
    });

    it('経路1: evaluateChunk runs once per numeric-confidence final utterance (utterance = chunk)', async () => {
      await loadModule();
      mockAudioInstance.duration = 10;

      const seg1: TranscriptionSegment = { id: 0, start: 0, end: 2100, text: 'first utterance', confidence: 0.9 };
      const seg2: TranscriptionSegment = { id: 1, start: 2100, end: 4200, text: 'second utterance', confidence: 0.85 };
      mockTranscribeFileWithWebSpeech.mockImplementation(
        async (_file: File, hooks?: WebSpeechFileHooks) => {
          hooks?.onFinalSegment?.(seg1);
          hooks?.onFinalSegment?.(seg2);
          return [seg1, seg2];
        },
      );

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber();
      const evaluateSpy = spyEvaluateChunk(transcriber);
      const file = new File(['audio'], 'audio.wav', { type: 'audio/wav' });

      const promise = transcriber.transcribeStream(file);
      fireAudioMetadata(mockAudioInstance);
      const result = await promise;

      // Measured utterances only, progressive (during the run), in order —
      // index = utterance ordinal, value = the utterance's own confidence
      expect(evaluateSpy).toHaveBeenCalledTimes(2);
      expect(evaluateSpy).toHaveBeenNthCalledWith(1, 0, 0.9);
      expect(evaluateSpy).toHaveBeenNthCalledWith(2, 1, 0.85);

      const summary = transcriber.getQualitySummary();
      expect(summary?.totalChunks).toBe(2);
      expect(result.qualitySummary?.totalChunks).toBe(2);
    });

    it('経路1: a low numeric measurement is filtered from the result but still recorded by the monitor', async () => {
      await loadModule();
      mockAudioInstance.duration = 10;

      const good: TranscriptionSegment = { id: 0, start: 0, end: 2100, text: 'clear utterance', confidence: 0.95 };
      const low: TranscriptionSegment = { id: 1, start: 2100, end: 4200, text: 'mumbled utterance', confidence: 0.3 };
      mockTranscribeFileWithWebSpeech.mockImplementation(
        async (_file: File, hooks?: WebSpeechFileHooks) => {
          hooks?.onFinalSegment?.(good);
          hooks?.onFinalSegment?.(low);
          return [good, low];
        },
      );

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({ minConfidence: 0.7 });
      const evaluateSpy = spyEvaluateChunk(transcriber);
      const file = new File(['audio'], 'audio.wav', { type: 'audio/wav' });

      const promise = transcriber.transcribeStream(file);
      fireAudioMetadata(mockAudioInstance);
      const result = await promise;

      // Filter shapes the OUTPUT (numeric-only comparison); the monitor still
      // records both real readings — a rejected measurement is a measurement
      expect(result.segments).toEqual([good]);
      expect(evaluateSpy).toHaveBeenCalledTimes(2);
      expect(transcriber.getQualitySummary()?.rejectedChunks).toBe(1);
    });

    it('経路1: a throwing evaluateChunk never destroys the measured run (monitor failure ≠ lost transcription)', async () => {
      await loadModule();
      mockAudioInstance.duration = 10;

      const seg1: TranscriptionSegment = { id: 0, start: 0, end: 2100, text: 'first utterance', confidence: 0.9 };
      const seg2: TranscriptionSegment = { id: 1, start: 2100, end: 4200, text: 'second utterance', confidence: 0.85 };
      mockTranscribeFileWithWebSpeech.mockImplementation(
        async (_file: File, hooks?: WebSpeechFileHooks) => {
          hooks?.onFinalSegment?.(seg1);
          hooks?.onFinalSegment?.(seg2);
          return [seg1, seg2];
        },
      );

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber();
      const monitor = transcriber.getQualityMonitor();
      if (!monitor) throw new Error('quality monitor not initialized');
      const throwing = jest.spyOn(monitor, 'evaluateChunk').mockImplementation(() => {
        throw new Error('Simulated quality monitor failure');
      });

      const file = new File(['audio'], 'audio.wav', { type: 'audio/wav' });
      const promise = transcriber.transcribeStream(file);
      fireAudioMetadata(mockAudioInstance);
      const result = await promise;

      // Segments survive the monitor failure; the run completes
      expect(throwing).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.placeholder).toBe(false);
      expect(result.segments).toEqual([seg1, seg2]);
    });

    it('経路3: evaluateChunk is never called and the summary reports zero evaluated chunks', async () => {
      await loadModule();
      // window stays (browser) but the recognition constructors are absent → 経路3
      delete (globalThis as Record<string, unknown>).SpeechRecognition;
      delete (globalThis as Record<string, unknown>).webkitSpeechRecognition;

      mockAudioInstance.duration = 4;
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 4000,
        overlapMs: 0,
        minConfidence: 0,
      });
      const evaluateSpy = spyEvaluateChunk(transcriber);

      const file = new File(['audio'], 'audio.wav', { type: 'audio/wav' });
      const promise = transcriber.transcribeStream(file);
      fireAudioMetadata(mockAudioInstance);
      const result = await promise;

      // A placeholder run is not a measurement: nothing may be evaluated and
      // the summary must show the zero-count shape (no fabricated 0-rejects)
      expect(result.placeholder).toBe(true);
      expect(evaluateSpy).not.toHaveBeenCalled();
      assertZeroEvaluatedSummary(transcriber);
      expect(result.qualitySummary?.totalChunks).toBe(0);
      expect(result.qualitySummary?.rejectedChunks).toBe(0);
    });

    it('経路3: the disclosed placeholder confidence (0.75) stays a NUMBER under the filter — compared, not exempt (REQ-391 f)', async () => {
      await loadModule();
      delete (globalThis as Record<string, unknown>).SpeechRecognition;
      delete (globalThis as Record<string, unknown>).webkitSpeechRecognition;

      mockAudioInstance.duration = 4;
      // 0.9 threshold: every disclosed 0.75 placeholder segment is a numeric
      // below it and is filtered — placeholder segments get no exemption
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 4000,
        overlapMs: 0,
        minConfidence: 0.9,
      });

      const file = new File(['audio'], 'audio.wav', { type: 'audio/wav' });
      const promise = transcriber.transcribeStream(file);
      fireAudioMetadata(mockAudioInstance);
      const result = await promise;

      expect(result.placeholder).toBe(true);
      expect(result.segments).toEqual([]);
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

    it('falls back to the named placeholder confidence when result confidence is falsy (REQ-393)', async () => {
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
                confidence: 0, // Falsy -> disclosed placeholder stand-in (REQ-393)
              },
            },
          } as unknown as SpeechRecognitionResultList,
        } as unknown as SpeechRecognitionEvent;

        mockRecognitionInstance.onresult(mockEvent);
      }

      await promise;

      // PLACEHOLDER_CHUNK_CONFIDENCE (0.75) >= 0.7 (default minConfidence), so
      // the disclosed placeholder stand-in (REQ-391/393) passes the gate — the
      // former anonymous 0.8 was a fabricated confidence.
      expect(onSegment).toHaveBeenCalledWith(
        expect.objectContaining({
          confidence: 0.75,
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
  // destroy() tests
  // ------------------------------------------------
  describe('destroy', () => {
    it('nullifies recognition and clears state', async () => {
      await loadModule();
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber();

      // Simulate streaming state
      if (mockRecognitionInstance.onstart) {
        mockRecognitionInstance.onstart(new Event('start'));
      }
      expect(transcriber.isStreamingActive()).toBe(true);

      transcriber.destroy();

      expect(transcriber.isStreamingActive()).toBe(false);
      // Internal recognition should be null
      const internal = transcriber as unknown as Record<string, unknown>;
      expect(internal.recognition).toBeNull();
    });

    it('calls stopLiveTranscription when destroying active streaming', async () => {
      await loadModule();
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber();

      if (mockRecognitionInstance.onstart) {
        mockRecognitionInstance.onstart(new Event('start'));
      }

      transcriber.destroy();

      expect(mockRecognitionInstance.stop).toHaveBeenCalled();
    });

    it('nullifies all recognition event handlers', async () => {
      await loadModule();
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber();

      expect(mockRecognitionInstance.onstart).not.toBeNull();
      expect(mockRecognitionInstance.onend).not.toBeNull();
      expect(mockRecognitionInstance.onerror).not.toBeNull();

      transcriber.destroy();

      expect(mockRecognitionInstance.onstart).toBeNull();
      expect(mockRecognitionInstance.onend).toBeNull();
      expect(mockRecognitionInstance.onerror).toBeNull();
      expect(mockRecognitionInstance.onresult).toBeNull();
    });

    it('is safe to call when recognition is null (no API)', async () => {
      delete (globalThis as Record<string, unknown>).SpeechRecognition;
      delete (globalThis as Record<string, unknown>).webkitSpeechRecognition;

      await loadModule();
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber();

      expect(() => transcriber.destroy()).not.toThrow();

      (globalThis as Record<string, unknown>).SpeechRecognition = MockSpeechRecognition;
      (globalThis as Record<string, unknown>).webkitSpeechRecognition = MockSpeechRecognition;
    });
  });

  // ------------------------------------------------
  // startLiveTranscription segment storage tests
  // ------------------------------------------------
  describe('startLiveTranscription segment storage', () => {
    it('stores accepted segments in internal segments array', async () => {
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
              0: { transcript: 'stored segment', confidence: 0.9 },
            },
          } as unknown as SpeechRecognitionResultList,
        } as unknown as SpeechRecognitionEvent;

        mockRecognitionInstance.onresult(mockEvent);
      }

      await promise;

      // The segment should be stored internally
      const internal = transcriber as unknown as { segments: unknown[] };
      expect(internal.segments.length).toBe(1);
      expect((internal.segments[0] as { text: string }).text).toBe('stored segment');
    });

    it('segmentCount in progress reflects stored segments', async () => {
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
              isFinal: true,
              length: 1,
              0: { transcript: 'count test', confidence: 0.9 },
            },
          } as unknown as SpeechRecognitionResultList,
        } as unknown as SpeechRecognitionEvent;

        mockRecognitionInstance.onresult(mockEvent);
      }

      await promise;

      expect(onProgress).toHaveBeenCalled();
      const progress = onProgress.mock.calls[0][0];
      // Before the fix, segmentCount was always 0 because segments were never stored
      expect(progress.segmentCount).toBe(1);
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
  // updateConfig input validation
  // Regression: updateConfig previously applied new values WITHOUT validating,
  // so an overlapMs >= chunkSizeMs (or chunkSizeMs <= 0) made createAudioChunks
  // advance by a non-positive step and loop forever. Mirrors constructor guards.
  // ------------------------------------------------
  describe('updateConfig — input validation', () => {
    it('throws when overlapMs >= chunkSizeMs (would infinite-loop createAudioChunks)', async () => {
      await loadModule();
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({ chunkSizeMs: 3000 });
      expect(() => transcriber.updateConfig({ chunkSizeMs: 100, overlapMs: 500 })).toThrow('overlapMs');
    });

    it('throws when overlapMs alone exceeds current chunkSizeMs', async () => {
      await loadModule();
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({ chunkSizeMs: 3000 });
      expect(() => transcriber.updateConfig({ overlapMs: 3000 })).toThrow('overlapMs');
    });

    it('throws when chunkSizeMs is lowered below existing overlapMs', async () => {
      await loadModule();
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({ chunkSizeMs: 5000, overlapMs: 500 });
      expect(() => transcriber.updateConfig({ chunkSizeMs: 100 })).toThrow('overlapMs');
    });

    it('throws when chunkSizeMs is non-positive', async () => {
      await loadModule();
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber();
      expect(() => transcriber.updateConfig({ chunkSizeMs: 0 })).toThrow('chunkSizeMs');
      expect(() => transcriber.updateConfig({ chunkSizeMs: -1 })).toThrow('chunkSizeMs');
    });

    it('throws when chunkSizeMs exceeds 60000', async () => {
      await loadModule();
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber();
      expect(() => transcriber.updateConfig({ chunkSizeMs: 70000 })).toThrow('chunkSizeMs');
    });

    it('throws when minConfidence is out of [0,1]', async () => {
      await loadModule();
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber();
      expect(() => transcriber.updateConfig({ minConfidence: -0.1 })).toThrow('minConfidence');
      expect(() => transcriber.updateConfig({ minConfidence: 1.5 })).toThrow('minConfidence');
    });

    it('rejects invalid config without mutating the existing config', async () => {
      await loadModule();
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({ chunkSizeMs: 3000, overlapMs: 500 });
      expect(() => transcriber.updateConfig({ chunkSizeMs: 100, overlapMs: 500 })).toThrow();
      const config = transcriber.getConfig();
      expect(config.chunkSizeMs).toBe(3000);
      expect(config.overlapMs).toBe(500);
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

      fireAudioMetadata(mockAudioInstance);

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

      fireAudioMetadata(mockAudioInstance);

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

      fireAudioMetadata(mockAudioInstance);

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

      fireAudioMetadata(mockAudioInstance);

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

      fireAudioMetadata(mockAudioInstance);

      const result = await promise;

      // Should succeed even though first chunk failed
      expect(result.success).toBe(true);
      // Only the second chunk's segments should be present
      expect(result.segments!.length).toBeGreaterThan(0);
    });

    it('survives multiple consecutive chunk failures and still completes', async () => {
      await loadModule();
      mockAudioInstance.duration = 10;

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 3000,
        overlapMs: 0,
        minConfidence: 0,
      });

      const anyTranscriber = transcriber as unknown as Record<string, unknown>;
      const origProcess = anyTranscriber.processAudioChunk as (
        chunk: { start: number; end: number },
        audioFile: string | File
      ) => Promise<TranscriptionSegment[]>;

      let chunkCallCount = 0;
      anyTranscriber.processAudioChunk = jest.fn().mockImplementation(async (
        chunk: { start: number; end: number },
        audioFile: string | File
      ) => {
        chunkCallCount++;
        // Fail first two chunks, succeed the rest
        if (chunkCallCount <= 2) {
          throw new Error(`Simulated chunk-${chunkCallCount - 1} failure`);
        }
        return origProcess.call(transcriber, chunk, audioFile);
      });

      const promise = transcriber.transcribeStream('/audio.mp3');

      fireAudioMetadata(mockAudioInstance);

      const result = await promise;

      // All 4 chunks were attempted (failures did not break the loop)
      expect(chunkCallCount).toBeGreaterThanOrEqual(3);
      // Session completed
      expect(result.success).toBe(true);
      // Segments from surviving chunks are present
      expect(result.segments!.length).toBeGreaterThan(0);
    });

    it('fires onProgress for chunks after a failed chunk', async () => {
      await loadModule();
      mockAudioInstance.duration = 10;

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 3000,
        overlapMs: 0,
        minConfidence: 0,
      });

      const anyTranscriber = transcriber as unknown as Record<string, unknown>;
      const origProcess = anyTranscriber.processAudioChunk as (
        chunk: { start: number; end: number },
        audioFile: string | File
      ) => Promise<TranscriptionSegment[]>;

      let chunkCallCount = 0;
      anyTranscriber.processAudioChunk = jest.fn().mockImplementation(async (
        chunk: { start: number; end: number },
        audioFile: string | File
      ) => {
        chunkCallCount++;
        if (chunkCallCount === 1) throw new Error('chunk-0 failure');
        return origProcess.call(transcriber, chunk, audioFile);
      });

      const onProgress = jest.fn();

      const promise = transcriber.transcribeStream('/audio.mp3', onProgress);

      fireAudioMetadata(mockAudioInstance);

      await promise;

      // Progress fired for subsequent (successful) chunks, not the failed one
      expect(onProgress).toHaveBeenCalled();
      // The last progress call should show accumulated segments
      const lastProgress = onProgress.mock.calls[onProgress.mock.calls.length - 1][0];
      expect(lastProgress.segmentCount).toBeGreaterThan(0);
    });

    it('quality monitor alert callback error does not crash quality monitoring', async () => {
      await loadModule();
      mockAudioInstance.duration = 6;

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 2000,
        overlapMs: 0,
        minConfidence: 0,
      });

      // Register a throwing alert callback — should be caught internally
      const throwingCallback = jest.fn().mockImplementation(() => {
        throw new Error('alert callback boom');
      });
      transcriber.onQualityAlert(throwingCallback);

      // Also register a normal callback to verify monitoring continues
      const normalCallback = jest.fn();
      transcriber.onQualityAlert(normalCallback);

      const promise = transcriber.transcribeStream('/audio.mp3');

      fireAudioMetadata(mockAudioInstance);

      const result = await promise;

      // Transcription completed successfully despite callback errors
      expect(result.success).toBe(true);
      // Quality summary is still available
      expect(result.qualitySummary).toBeDefined();
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
        // Segments are MILLISECONDS. First chunk: 0-1000ms, second chunk:
        // 5000-6000ms (gap 4000ms > 500ms tolerance → must NOT merge).
        if (chunkIndex === 1) {
          return [{
            start: 0,
            end: 1000,
            text: 'first segment',
            confidence: 0.9,
            speaker: 'unknown',
          }];
        }
        return [{
          start: 5000,
          end: 6000,
          text: 'second segment',
          confidence: 0.85,
          speaker: 'unknown',
        }];
      });

      const promise = transcriber.transcribeStream('/audio.mp3');

      fireAudioMetadata(mockAudioInstance);

      const result = await promise;

      // Segments should NOT be merged since they don't overlap (gap > 500ms tolerance)
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
            end: 2000,
            text: 'first segment',
            confidence: 0.9,
            speaker: 'unknown',
          }];
        }
        // Segments are MILLISECONDS. Second segment starts at 2300ms, within the
        // 500ms tolerance of the first ending at 2000ms → must merge.
        return [{
          start: 2300,
          end: 4000,
          text: 'overlapping segment',
          confidence: 0.85,
          speaker: 'unknown',
        }];
      });

      const promise = transcriber.transcribeStream('/audio.mp3');

      fireAudioMetadata(mockAudioInstance);

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

      fireAudioMetadata(mockAudioInstance);

      const result = await promise;

      expect(result).toHaveProperty('processingTime');
      expect(typeof result.processingTime).toBe('number');
      // processingTime must be a reasonable elapsed duration, not the result
      // of Date.now() - performance.now() which yields a huge epoch-like value
      expect(result.processingTime).toBeLessThan(1_000_000);
    });

    it('transcribeStream computes processingTime as elapsed wall-clock time', async () => {
      await loadModule();
      mockAudioInstance.duration = 2;

      // Simulate elapsed time: performance.now() returns 5000 at start,
      // then 8500 after chunk processing completes
      let perfNowValue = 5000;
      mockPerformanceNow.mockImplementation(() => perfNowValue);
      // Advance the clock after the promise starts
      const advancePerf = () => { perfNowValue = 8500; };

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
        advancePerf();
      });

      const result = await promise;

      // processingTime should be the delta (8500 - 5000 = 3500),
      // NOT Date.now() - performance.now() which would be ~1.7 trillion
      expect(result.processingTime).toBe(3500);
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

      fireAudioMetadata(mockAudioInstance);

      const result = await promise;

      expect(result.duration).toBe(3500);
    });

    it('emits segment start/end in milliseconds, consistent with result.duration', async () => {
      // Contract (whisper/browser/transcriber/srt all agree):
      // TranscriptionSegment.start/end are MILLISECONDS. streaming-transcriber
      // previously emitted SECONDS, so within ONE TranscriptionResult the
      // segments were seconds while `duration` was milliseconds (audioDuration*1000)
      // — a 1000x internal inconsistency, and 1000x off from every other producer.
      await loadModule();
      mockAudioInstance.duration = 5;

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 5000,
        overlapMs: 0,
        minConfidence: 0,
      });

      const promise = transcriber.transcribeStream('/audio.mp3');
      fireAudioMetadata(mockAudioInstance);

      const result = await promise;

      const segs = result.segments!;
      expect(segs.length).toBeGreaterThan(0);
      const last = segs[segs.length - 1];

      // Final segment of a 5s clip ends near 5000ms, NOT 5 (seconds).
      expect(last.end).toBeGreaterThan(1000);
      // Same unit as result.duration (both ms): final segment end ≈ full duration.
      expect(Math.abs(last.end - result.duration)).toBeLessThan(50);
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

      fireAudioMetadata(mockAudioInstance);

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

      fireAudioMetadata(mockAudioInstance);

      const result = await promise;

      expect(result.success).toBe(true);
      // With 3s chunks and 0.5s overlap on 8s audio the chunk plan has
      // multiple chunks (their overlapping placeholder segments merge into
      // one) — but progress is ONE completion event (TASK-0319)
      expect(result.segments!.length).toBeGreaterThanOrEqual(1);
      expect(onProgress).toHaveBeenCalledTimes(1);
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

      fireAudioMetadata(mockAudioInstance);

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

      fireAudioMetadata(mockAudioInstance);

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

      fireAudioMetadata(mockAudioInstance);

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

    it('transcribeStream contains a non-Error duration-probe rejection (TASK-0319)', async () => {
      await loadModule();
      mockAudioInstance.duration = 4;

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 5000,
        overlapMs: 0,
      });

      // Make getAudioDuration reject with a non-Error value — the probe
      // catch contains any thrown shape; the run discloses placeholder.
      const anyTranscriber = transcriber as unknown as Record<string, unknown>;
      anyTranscriber.getAudioDuration = jest.fn().mockRejectedValue('string error');

      const result = await transcriber.transcribeStream('/audio.mp3');

      expect(result.success).toBe(true);
      expect(result.placeholder).toBe(true);
      expect(result.segments).toEqual([]);
    });

    it('transcribeStream contains an Error-instance duration-probe rejection (TASK-0319)', async () => {
      await loadModule();

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 5000,
        overlapMs: 0,
      });

      const anyTranscriber = transcriber as unknown as Record<string, unknown>;
      anyTranscriber.getAudioDuration = jest.fn().mockRejectedValue(new Error('custom error msg'));

      const result = await transcriber.transcribeStream('/audio.mp3');

      expect(result.success).toBe(true);
      expect(result.placeholder).toBe(true);
      expect(result.segments).toEqual([]);
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

    // --- Chunk loop error resilience: callback throws & non-Error throws ---

    it('onProgress callback throwing does not crash the transcription session', async () => {
      await loadModule();
      mockAudioInstance.duration = 10;

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 3000,
        overlapMs: 0,
        minConfidence: 0,
      });

      // The (single) completion progress call throws
      let progressCallCount = 0;
      const onProgress = jest.fn().mockImplementation(() => {
        progressCallCount++;
        throw new Error('onProgress boom');
      });

      const promise = transcriber.transcribeStream('/audio.mp3', onProgress);

      fireAudioMetadata(mockAudioInstance);

      const result = await promise;

      // Session completed despite the completion onProgress throwing — the
      // per-callback guard contained it (TASK-0319: one completion event,
      // so one throw)
      expect(result.success).toBe(true);
      expect(progressCallCount).toBe(1);
      expect(result.segments!.length).toBeGreaterThan(0);
    });

    it('onSegment callback throwing does not crash the transcription session', async () => {
      await loadModule();
      mockAudioInstance.duration = 6;

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 3000,
        overlapMs: 0,
        minConfidence: 0,
      });

      // onSegment throws on first call, then succeeds
      let segmentCallCount = 0;
      const onSegment = jest.fn().mockImplementation(() => {
        segmentCallCount++;
        if (segmentCallCount === 1) throw new Error('onSegment boom');
      });

      const promise = transcriber.transcribeStream('/audio.mp3', undefined, onSegment);

      fireAudioMetadata(mockAudioInstance);

      const result = await promise;

      // Session completed despite onSegment throwing
      expect(result.success).toBe(true);
      // Multiple segment callbacks were attempted (the throw didn't break the loop)
      expect(segmentCallCount).toBeGreaterThanOrEqual(2);
    });

    it('processAudioChunk throwing a non-Error string does not crash the session', async () => {
      await loadModule();
      mockAudioInstance.duration = 6;

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 3000,
        overlapMs: 0,
        minConfidence: 0,
      });

      const anyTranscriber = transcriber as unknown as Record<string, unknown>;
      const origProcess = anyTranscriber.processAudioChunk as (
        chunk: { start: number; end: number },
        audioFile: string | File
      ) => Promise<TranscriptionSegment[]>;

      let chunkCallCount = 0;
      anyTranscriber.processAudioChunk = jest.fn().mockImplementation(async (
        chunk: { start: number; end: number },
        audioFile: string | File
      ) => {
        chunkCallCount++;
        if (chunkCallCount === 1) {
          throw 'non-Error string throw';  
        }
        return origProcess.call(transcriber, chunk, audioFile);
      });

      const promise = transcriber.transcribeStream('/audio.mp3');

      fireAudioMetadata(mockAudioInstance);

      const result = await promise;

      // The non-Error throw was caught and the session completed
      expect(result.success).toBe(true);
      expect(result.segments!.length).toBeGreaterThan(0);
    });

    // --- Quality monitor error resilience (TASK-0320: evaluation now runs
    // per measured utterance on the 経路1 engine route — 経路3 no longer
    // evaluates anything, so these legs drive the engine route) ---

    it('qualityMonitor.evaluateChunk() throwing on one utterance does not crash the session', async () => {
      await loadModule();
      mockAudioInstance.duration = 10;

      const finals: TranscriptionSegment[] = [0, 1, 2, 3].map(i => ({
        id: i, start: i * 2000, end: (i + 1) * 2000,
        text: `utterance ${i + 1}`, confidence: 0.8,
      }));
      mockTranscribeFileWithWebSpeech.mockImplementation(
        async (_file: File, hooks?: WebSpeechFileHooks) => {
          for (const segment of finals) hooks?.onFinalSegment?.(segment);
          return finals;
        },
      );

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        minConfidence: 0,
      });

      // Make evaluateChunk throw on the second call — this exercises the
      // per-utterance try/catch in the onFinalSegment forwarding
      const qualityMonitor = transcriber.getQualityMonitor();
      expect(qualityMonitor).not.toBeNull();
      const origEval = qualityMonitor!.evaluateChunk.bind(qualityMonitor);
      let evalCallCount = 0;
      qualityMonitor!.evaluateChunk = jest.fn().mockImplementation(
        (idx: number, conf: number) => {
          evalCallCount++;
          if (evalCallCount === 2) throw new Error('evaluateChunk boom');
          return origEval(idx, conf);
        },
      );

      const file = new File(['audio'], 'audio.wav', { type: 'audio/wav' });
      const promise = transcriber.transcribeStream(file);

      fireAudioMetadata(mockAudioInstance);

      const result = await promise;

      // Session completed despite evaluateChunk throwing on utterance 2
      expect(result.success).toBe(true);
      // evaluateChunk was called for every utterance — the throw was caught
      // and the remaining utterances were still evaluated
      expect(evalCallCount).toBeGreaterThanOrEqual(3);
      // Segments from all finals are present
      expect(result.segments!.length).toBeGreaterThan(0);
      // Quality summary is still available
      expect(result.qualitySummary).toBeDefined();
    });

    it('qualityMonitor.evaluateChunk() throwing on every chunk still completes', async () => {
      await loadModule();
      mockAudioInstance.duration = 6;

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 3000,
        overlapMs: 0,
        minConfidence: 0,
      });

      // evaluateChunk always throws
      const qualityMonitor = transcriber.getQualityMonitor();
      qualityMonitor!.evaluateChunk = jest.fn().mockImplementation(() => {
        throw new Error('evaluateChunk always boom');
      });

      const promise = transcriber.transcribeStream('/audio.mp3');

      fireAudioMetadata(mockAudioInstance);

      const result = await promise;

      // Session completed even though quality monitoring failed on every chunk
      expect(result.success).toBe(true);
      // Audio segments are still returned (quality monitoring failure doesn't
      // prevent the core transcription pipeline from producing results)
      expect(result.segments!.length).toBeGreaterThan(0);
      // Quality summary still returned (getSummary handles empty records)
      expect(result.qualitySummary).toBeDefined();
    });

    it('quality summary reflects only successfully-evaluated utterances after partial evaluateChunk failures', async () => {
      await loadModule();
      mockAudioInstance.duration = 10;

      const finals: TranscriptionSegment[] = [0, 1, 2, 3].map(i => ({
        id: i, start: i * 2000, end: (i + 1) * 2000,
        text: `utterance ${i + 1}`, confidence: 0.8,
      }));
      mockTranscribeFileWithWebSpeech.mockImplementation(
        async (_file: File, hooks?: WebSpeechFileHooks) => {
          for (const segment of finals) hooks?.onFinalSegment?.(segment);
          return finals;
        },
      );

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        minConfidence: 0,
      });

      // evaluateChunk throws on utterance index 1 only
      const qualityMonitor = transcriber.getQualityMonitor();
      const origEval = qualityMonitor!.evaluateChunk.bind(qualityMonitor);
      let evalCallCount = 0;
      qualityMonitor!.evaluateChunk = jest.fn().mockImplementation(
        (idx: number, conf: number) => {
          evalCallCount++;
          if (evalCallCount === 2) throw new Error('evaluateChunk boom on utterance 1');
          return origEval(idx, conf);
        },
      );

      const file = new File(['audio'], 'audio.wav', { type: 'audio/wav' });
      const promise = transcriber.transcribeStream(file);

      fireAudioMetadata(mockAudioInstance);

      const result = await promise;

      expect(result.success).toBe(true);
      // 4 finals → evaluateChunk called 4 times (the throw was caught, the
      // remaining utterances were still evaluated)
      expect(evalCallCount).toBeGreaterThanOrEqual(3);
      // Quality summary recorded 3 utterances (4 minus the 1 that threw
      // before storing the record)
      const summary = result.qualitySummary!;
      expect(summary.totalChunks).toBe(evalCallCount - 1);
      // The remaining utterances' quality data is valid
      expect(summary.averageConfidence).toBeGreaterThan(0);
    });

    it('error thrown inside chunk-processing try/catch does not propagate to crash the transcription session', async () => {
      // Asserts that the inner try/catch (streaming-transcriber.ts:155–200)
      // catches errors thrown during chunk processing and prevents them from
      // reaching the outer try/catch (lines 143–221) which would reject the
      // promise with a TranscriptionError.
      await loadModule();
      mockAudioInstance.duration = 9; // 3 chunks of 3s each

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 3000,
        overlapMs: 0,
        minConfidence: 0,
      });

      // Spy on console.warn — the inner catch calls logger.warn which
      // delegates to console.warn.  If the outer catch fired instead it
      // would call logger.error (console.error), not warn.
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Make chunk 2 (i=1) throw — exercises the inner try/catch
      const anyTranscriber = transcriber as unknown as Record<string, unknown>;
      const origProcess = anyTranscriber.processAudioChunk as (
        chunk: { start: number; end: number },
        audioFile: string | File
      ) => Promise<TranscriptionSegment[]>;
      let chunkCallCount = 0;
      anyTranscriber.processAudioChunk = jest.fn().mockImplementation(async (
        chunk: { start: number; end: number },
        audioFile: string | File,
      ) => {
        chunkCallCount++;
        if (chunkCallCount === 2) {
          throw new Error('inner-catch crash test');
        }
        return origProcess.call(transcriber, chunk, audioFile);
      });

      const onProgress = jest.fn();

      const promise = transcriber.transcribeStream('/audio.mp3', onProgress);

      fireAudioMetadata(mockAudioInstance);

      // KEY: the promise must RESOLVE, not reject.
      // Without the inner try/catch the error would propagate to the outer
      // catch which wraps it in TranscriptionError and rejects.
      const result = await promise;

      // 1. Inner catch was triggered (logger.warn → console.warn)
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Chunk 2 processing failed'),
        expect.any(Error),
      );

      // 2. Outer catch was NOT triggered (no logger.error about "Streaming transcription failed")
      expect(errorSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Streaming transcription failed'),
        expect.anything(),
      );

      // 3. All chunks were attempted — loop continued past the error
      // (at least 3 chunks for ~9–10s audio at 3s chunkSize)
      expect(chunkCallCount).toBeGreaterThanOrEqual(3);

      // 4. The single completion progress event still fired (TASK-0319:
      // progress is no longer per-chunk, so the count is exactly 1)
      expect(onProgress.mock.calls.length).toBe(1);

      // 5. Session succeeded with segments from non-failed chunks
      expect(result.success).toBe(true);
      expect(result.segments!.length).toBeGreaterThan(0);

      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('all chunks failing still returns a successful result with empty segments', async () => {
      await loadModule();
      mockAudioInstance.duration = 9;

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 3000,
        overlapMs: 0,
        minConfidence: 0,
      });

      // Every chunk fails
      const anyTranscriber = transcriber as unknown as Record<string, unknown>;
      anyTranscriber.processAudioChunk = jest.fn().mockImplementation(async () => {
        throw new Error('permanent failure');
      });

      const promise = transcriber.transcribeStream('/audio.mp3');

      fireAudioMetadata(mockAudioInstance);

      const result = await promise;

      // Session still completes (no unhandled crash)
      expect(result.success).toBe(true);
      // No segments since all chunks failed
      expect(result.segments).toEqual([]);
      expect(result.text).toBe('');
    });

    // --- Live transcription callback error resilience ---
    // Asserts that try/catch around onSegment/onProgress in the onresult
    // handler prevents callback errors from crashing the recognition session.

    it('onSegment callback throwing in live transcription does not crash the onresult handler', async () => {
      await loadModule();
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber();
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      let segmentCallCount = 0;
      const onSegment = jest.fn().mockImplementation(() => {
        segmentCallCount++;
        if (segmentCallCount === 1) throw new Error('live onSegment boom');
      });

      const promise = transcriber.startLiveTranscription(onSegment);

      // Fire two final results in a single event — the first triggers the
      // throwing callback, the second verifies the handler survived.
      if (mockRecognitionInstance.onresult) {
        mockPerformanceNow.mockReturnValue(1500);

        const mockEvent = {
          resultIndex: 0,
          results: {
            length: 2,
            0: {
              isFinal: true,
              length: 1,
              0: { transcript: 'first', confidence: 0.9 },
            },
            1: {
              isFinal: true,
              length: 1,
              0: { transcript: 'second', confidence: 0.85 },
            },
          } as unknown as SpeechRecognitionResultList,
        } as unknown as SpeechRecognitionEvent;

        mockRecognitionInstance.onresult(mockEvent);
      }

      await promise;

      // Both callbacks were invoked — the throw on the first did not prevent
      // the loop from processing the second result.
      expect(segmentCallCount).toBe(2);
      // The try/catch logged a warning (did not propagate)
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('onSegment callback error'),
        expect.any(Error),
      );
      warnSpy.mockRestore();
    });

    it('onProgress callback throwing in live transcription does not crash the onresult handler', async () => {
      await loadModule();
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber();
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      let progressCallCount = 0;
      const onProgress = jest.fn().mockImplementation(() => {
        progressCallCount++;
        throw new Error('live onProgress boom');
      });

      const promise = transcriber.startLiveTranscription(undefined, onProgress);

      // Fire a result — onProgress throws but the handler should survive.
      if (mockRecognitionInstance.onresult) {
        mockPerformanceNow.mockReturnValue(1500);

        const mockEvent = {
          resultIndex: 0,
          results: {
            length: 1,
            0: {
              isFinal: true,
              length: 1,
              0: { transcript: 'test', confidence: 0.9 },
            },
          } as unknown as SpeechRecognitionResultList,
        } as unknown as SpeechRecognitionEvent;

        // This should NOT throw — the try/catch should swallow the error
        expect(() => {
          mockRecognitionInstance.onresult!(mockEvent);
        }).not.toThrow();
      }

      await promise;

      expect(progressCallCount).toBe(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('onProgress callback error'),
        expect.any(Error),
      );
      warnSpy.mockRestore();
    });

    it('segmentStartTime still updates after onSegment throws in live transcription', async () => {
      await loadModule();
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber();
      jest.spyOn(console, 'warn').mockImplementation(() => {});

      const onSegment = jest.fn().mockImplementation(() => {
        throw new Error('live onSegment boom');
      });

      const promise = transcriber.startLiveTranscription(onSegment);

      // Fire a final result — onSegment throws, but segmentStartTime must
      // still be updated so the next segment has a correct start time.
      if (mockRecognitionInstance.onresult) {
        mockPerformanceNow.mockReturnValue(2000);

        const mockEvent = {
          resultIndex: 0,
          results: {
            length: 1,
            0: {
              isFinal: true,
              length: 1,
              0: { transcript: 'test', confidence: 0.9 },
            },
          } as unknown as SpeechRecognitionResultList,
        } as unknown as SpeechRecognitionEvent;

        mockRecognitionInstance.onresult(mockEvent);

        // After the first result, performance.now() was called for
        // segmentStartTime update (line 276).  Fire a second result and
        // verify the promise resolves without error.
        mockPerformanceNow.mockReturnValue(3000);
        const mockEvent2 = {
          resultIndex: 1,
          results: {
            length: 2,
            0: {
              isFinal: true,
              length: 1,
              0: { transcript: 'first', confidence: 0.9 },
            },
            1: {
              isFinal: true,
              length: 1,
              0: { transcript: 'second', confidence: 0.85 },
            },
          } as unknown as SpeechRecognitionResultList,
        } as unknown as SpeechRecognitionEvent;

        expect(() => {
          mockRecognitionInstance.onresult!(mockEvent2);
        }).not.toThrow();
      }

      await promise;

      // onSegment was called twice (both results were processed)
      expect(onSegment).toHaveBeenCalledTimes(2);
    });

    it('calculateAverageConfidence throwing during completion progress is contained (TASK-0319)', async () => {
      await loadModule();
      mockAudioInstance.duration = 6;

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 3000,
        overlapMs: 0,
        minConfidence: 0,
      });

      jest.spyOn(console, 'warn').mockImplementation(() => {});

      // Override calculateAverageConfidence to throw — the completion
      // progress event builds its averageConfidence through it
      const anyTranscriber = transcriber as unknown as Record<string, unknown>;
      let calcCallCount = 0;
      anyTranscriber.calculateAverageConfidence = jest.fn().mockImplementation(() => {
        calcCallCount++;
        throw new Error('calculateAverageConfidence boom');
      });

      const onProgress = jest.fn();

      const promise = transcriber.transcribeStream('/audio.mp3', onProgress);

      fireAudioMetadata(mockAudioInstance);

      const result = await promise;

      // The throw was contained by the completion-progress guard — session
      // completed (TASK-0319: one completion event, so one calc call)
      expect(result.success).toBe(true);
      expect(calcCallCount).toBe(1);
      // The throwing calc meant the progress event never fired
      expect(onProgress).not.toHaveBeenCalled();
      expect(result.segments!.length).toBeGreaterThan(0);
    });

    // --- transcribeStream callback isolation ---
    // The chunk loop's inner try/catch catches errors, but without
    // per-callback try/catch a throwing onProgress prevents onSegment
    // from firing for the same chunk (and vice-versa).

    it('onProgress throwing in transcribeStream does not prevent onSegment for the same chunk', async () => {
      await loadModule();
      mockAudioInstance.duration = 6; // 2 chunks

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 3000,
        overlapMs: 0,
        minConfidence: 0,
      });

      jest.spyOn(console, 'warn').mockImplementation(() => {});

      const onProgress = jest.fn().mockImplementation(() => {
        throw new Error('onProgress boom');
      });
      const onSegment = jest.fn();

      const promise = transcriber.transcribeStream('/audio.mp3', onProgress, onSegment);

      fireAudioMetadata(mockAudioInstance);

      const result = await promise;

      // Session completed despite onProgress throwing
      expect(result.success).toBe(true);
      // onSegment was still called for segments in the same chunk
      expect(onSegment).toHaveBeenCalled();
    });

    it('onSegment throwing on one segment does not prevent subsequent segments in the same chunk', async () => {
      await loadModule();
      // Single 6-second chunk → processAudioChunk produces 3 segments
      mockAudioInstance.duration = 6;

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 6000,
        overlapMs: 0,
        minConfidence: 0,
      });

      jest.spyOn(console, 'warn').mockImplementation(() => {});

      let segmentCallCount = 0;
      const onSegment = jest.fn().mockImplementation(() => {
        segmentCallCount++;
        if (segmentCallCount === 1) throw new Error('onSegment boom on first');
      });

      const promise = transcriber.transcribeStream('/audio.mp3', undefined, onSegment);

      fireAudioMetadata(mockAudioInstance);

      const result = await promise;

      // Session completed
      expect(result.success).toBe(true);
      // All segments in the single chunk were attempted — the throw on
      // segment 1 did not prevent remaining segments from being delivered.
      // Without per-segment try/catch the forEach would abort after the
      // first throw, giving segmentCallCount === 1.
      expect(segmentCallCount).toBeGreaterThanOrEqual(3);
    });
  });

  // ------------------------------------------------
  // Falsy-guard on legit-zero config values
  // Regression: `config.x || default` falls back to the default when x is a
  // legitimate 0, silently ignoring an explicit user value. Validation already
  // ALLOWS minConfidence=0 and overlapMs=0, so 0 is a valid intent ("accept
  // all segments" / "no chunk overlap") that must be honored. Must use nullish
  // coalescing (`??`) so only undefined/null trigger the fallback.
  // ------------------------------------------------
  describe('falsy-guard on legit-zero config values', () => {
    it('minConfidence=0 keeps sub-0.7 chunk segments (|| would fall back to 0.7)', async () => {
      await loadModule();
      mockAudioInstance.duration = 6;

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 6000,
        overlapMs: 0,
        minConfidence: 0, // explicit "accept all"
      });

      const anyTranscriber = transcriber as unknown as Record<string, unknown>;
      anyTranscriber.processAudioChunk = jest.fn().mockResolvedValue([
        { start: 0, end: 1000, text: 'uncertain', confidence: 0.4, speaker: 'unknown' },
      ] as never);

      const promise = transcriber.transcribeStream('/audio.mp3');
      fireAudioMetadata(mockAudioInstance);

      const result = await promise;

      // minConfidence=0 means accept all; a 0.4-confidence segment must survive.
      // Buggy `this.config.minConfidence || 0.7` → 0 || 0.7 = 0.7 → 0.4 dropped.
      expect(result.segments!.length).toBe(1);
      expect(result.segments![0].confidence).toBe(0.4);
    });

    it('minConfidence=0 keeps sub-0.7 live segments (|| would fall back to 0.7)', async () => {
      await loadModule();
      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        minConfidence: 0, // explicit "accept all"
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
              0: { transcript: 'uncertain', confidence: 0.5 },
            },
          } as unknown as SpeechRecognitionResultList,
        } as unknown as SpeechRecognitionEvent;
        mockRecognitionInstance.onresult(mockEvent);
      }

      await promise;

      // minConfidence=0 → 0.5 must be accepted. Buggy `|| 0.7` drops it.
      expect(onSegment).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'uncertain' })
      );
    });

    it('overlapMs=0 produces non-overlapping chunks (|| would fall back to 500ms)', async () => {
      await loadModule();
      mockAudioInstance.duration = 10;

      const transcriber = new StreamingTranscriberModule.StreamingTranscriber({
        chunkSizeMs: 3000,
        overlapMs: 0, // explicit "no overlap"
        minConfidence: 0,
      });

      const anyTranscriber = transcriber as unknown as Record<string, unknown>;
      const origProcess = anyTranscriber.processAudioChunk as (
        chunk: { start: number; end: number },
        audioFile: string | File
      ) => Promise<TranscriptionSegment[]>;
      const capturedChunks: Array<{ start: number; end: number }> = [];
      anyTranscriber.processAudioChunk = jest.fn().mockImplementation(async (chunk) => {
        capturedChunks.push(chunk);
        return origProcess.call(transcriber, chunk);
      });

      const promise = transcriber.transcribeStream('/audio.mp3');
      fireAudioMetadata(mockAudioInstance);

      await promise;

      expect(capturedChunks.length).toBeGreaterThanOrEqual(2);
      // With overlapMs=0 each chunk must start where the previous ended (no
      // overlap). Buggy `this.config.overlapMs || 500` → 0 || 500 = 500ms gap
      // step, producing 0.5s of overlap between consecutive chunks.
      for (let i = 1; i < capturedChunks.length; i++) {
        expect(capturedChunks[i].start).toBeGreaterThanOrEqual(
          capturedChunks[i - 1].end - 1e-6
        );
      }
    });
  });
});
