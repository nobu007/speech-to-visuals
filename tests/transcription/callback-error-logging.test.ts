/**
 * Integration tests for transcription pipeline non-finite audio duration
 * handling and callback error logging observability.
 *
 * Verifies that:
 *   1. Non-finite audio duration (NaN, Infinity, -Infinity) is handled gracefully
 *   2. Negative duration is handled gracefully
 *   3. Failing callbacks produce warn-level log entries (via console.warn spy)
 *      for observability
 *   4. Transcription results remain correct despite callback failures
 */

import { jest } from '@jest/globals';

import type { TranscriptionSegment } from '../../src/transcription/types';

// --- Mock Audio ---
interface MockAudioInstance {
  src: string;
  onloadedmetadata: (() => void) | null;
  onerror: (() => void) | null;
  duration: number;
  play: jest.Mock;
}

let mockAudioInstance: MockAudioInstance;

const createMockAudio = (duration = 5): MockAudioInstance => ({
  src: '',
  onloadedmetadata: null,
  onerror: null,
  duration,
  play: jest.fn(),
});

const MockAudio = jest.fn().mockImplementation(() => {
  mockAudioInstance = createMockAudio(mockAudioDuration);
  return mockAudioInstance;
});

let mockAudioDuration = 5;

// Mock URL
const mockCreateObjectURL = jest.fn().mockReturnValue('blob:http://localhost/mock');
const mockRevokeObjectURL = jest.fn();

// Mock performance.now
const mockPerformanceNow = jest.fn().mockReturnValue(1000);

// Setup global mocks
const originalWindow = globalThis.window;
const originalAudio = globalThis.Audio;
const originalCreateObjectURL = globalThis.URL?.createObjectURL;
const originalRevokeObjectURL = globalThis.URL?.revokeObjectURL;

beforeAll(() => {
  (globalThis as Record<string, unknown>).window = {};
  (globalThis as Record<string, unknown>).Audio = MockAudio as unknown as typeof Audio;
  (globalThis as Record<string, unknown>).navigator = { ...(globalThis as Record<string, unknown>).navigator };
  globalThis.URL = {
    ...(globalThis.URL || {}),
    createObjectURL: mockCreateObjectURL as unknown as typeof URL.createObjectURL,
    revokeObjectURL: mockRevokeObjectURL as unknown as typeof URL.revokeObjectURL,
  } as unknown as typeof URL;
  globalThis.performance = {
    ...(globalThis.performance || {}),
    now: mockPerformanceNow as unknown as typeof performance.now,
  } as unknown as typeof performance;
});

afterAll(() => {
  (globalThis as Record<string, unknown>).window = originalWindow;
  (globalThis as Record<string, unknown>).Audio = originalAudio;
  if (originalCreateObjectURL) {
    globalThis.URL.createObjectURL = originalCreateObjectURL;
  }
  if (originalRevokeObjectURL) {
    globalThis.URL.revokeObjectURL = originalRevokeObjectURL;
  }
});

let StreamingTranscriber: typeof import('../../src/transcription/streaming-transcriber').StreamingTranscriber;

beforeAll(async () => {
  const mod = await import('../../src/transcription/streaming-transcriber');
  StreamingTranscriber = mod.StreamingTranscriber;
});

describe('Transcription non-finite audio duration handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAudioDuration = 5;
  });

  it('handles NaN audio duration gracefully', async () => {
    mockAudioDuration = NaN;
    const transcriber = new StreamingTranscriber({ chunkSizeMs: 2000, overlapMs: 0 });

    const promise = transcriber.transcribeStream('corrupt.wav');
    // Trigger audio metadata loaded
    await new Promise(resolve => setTimeout(resolve, 10));
    if (mockAudioInstance?.onloadedmetadata) {
      mockAudioInstance.onloadedmetadata();
    }

    const result = await promise;

    expect(result.success).toBe(true);
    expect(result.segments).toHaveLength(0);
  });

  it('handles Infinity audio duration gracefully', async () => {
    mockAudioDuration = Infinity;
    const transcriber = new StreamingTranscriber({ chunkSizeMs: 2000, overlapMs: 0 });

    const promise = transcriber.transcribeStream('infinite.wav');
    await new Promise(resolve => setTimeout(resolve, 10));
    if (mockAudioInstance?.onloadedmetadata) {
      mockAudioInstance.onloadedmetadata();
    }

    const result = await promise;

    expect(result.success).toBe(true);
    expect(result.segments).toHaveLength(0);
  });

  it('handles negative audio duration gracefully', async () => {
    mockAudioDuration = -5;
    const transcriber = new StreamingTranscriber({ chunkSizeMs: 2000, overlapMs: 0 });

    const promise = transcriber.transcribeStream('negative.wav');
    await new Promise(resolve => setTimeout(resolve, 10));
    if (mockAudioInstance?.onloadedmetadata) {
      mockAudioInstance.onloadedmetadata();
    }

    const result = await promise;

    expect(result.success).toBe(true);
    expect(result.segments).toHaveLength(0);
  });

  it('handles zero audio duration gracefully', async () => {
    mockAudioDuration = 0;
    const transcriber = new StreamingTranscriber({ chunkSizeMs: 2000, overlapMs: 0 });

    const promise = transcriber.transcribeStream('empty.wav');
    await new Promise(resolve => setTimeout(resolve, 10));
    if (mockAudioInstance?.onloadedmetadata) {
      mockAudioInstance.onloadedmetadata();
    }

    const result = await promise;

    expect(result.success).toBe(true);
    expect(result.segments).toHaveLength(0);
  });
});

describe('Transcription callback error logging observability', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAudioDuration = 5;
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('logs onProgress callback errors via console.warn for observability', async () => {
    const transcriber = new StreamingTranscriber({ chunkSizeMs: 2000, overlapMs: 0 });
    const throwingProgress = jest.fn(() => { throw new Error('Progress boom'); });

    const promise = transcriber.transcribeStream('test.wav', throwingProgress);
    await new Promise(resolve => setTimeout(resolve, 10));
    if (mockAudioInstance?.onloadedmetadata) {
      mockAudioInstance.onloadedmetadata();
    }

    const result = await promise;

    expect(result.success).toBe(true);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('onProgress callback error'),
      expect.any(Error),
    );
  });

  it('logs onSegment callback errors via console.warn for observability', async () => {
    const transcriber = new StreamingTranscriber({ chunkSizeMs: 2000, overlapMs: 0 });
    const throwingSegment = jest.fn(() => { throw new Error('Segment boom'); });

    const promise = transcriber.transcribeStream('test.wav', undefined, throwingSegment);
    await new Promise(resolve => setTimeout(resolve, 10));
    if (mockAudioInstance?.onloadedmetadata) {
      mockAudioInstance.onloadedmetadata();
    }

    const result = await promise;

    expect(result.success).toBe(true);
    expect(result.segments.length).toBeGreaterThan(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('onSegment callback error'),
      expect.any(Error),
    );
  });

  it('logs both callback types when both throw', async () => {
    const transcriber = new StreamingTranscriber({ chunkSizeMs: 2000, overlapMs: 0 });

    const promise = transcriber.transcribeStream(
      'test.wav',
      () => { throw new Error('P'); },
      () => { throw new Error('S'); },
    );
    await new Promise(resolve => setTimeout(resolve, 10));
    if (mockAudioInstance?.onloadedmetadata) {
      mockAudioInstance.onloadedmetadata();
    }

    const result = await promise;

    expect(result.success).toBe(true);

    const warnCalls = warnSpy.mock.calls;
    const progressErrors = warnCalls.filter(c => c[0]?.includes?.('onProgress'));
    const segmentErrors = warnCalls.filter(c => c[0]?.includes?.('onSegment'));
    expect(progressErrors.length).toBeGreaterThan(0);
    expect(segmentErrors.length).toBeGreaterThan(0);
  });

  it('produces valid segments despite callback failures', async () => {
    const transcriber = new StreamingTranscriber({ chunkSizeMs: 2000, overlapMs: 0 });

    const promise = transcriber.transcribeStream(
      'test.wav',
      () => { throw new Error('fail'); },
      () => { throw new Error('fail'); },
    );
    await new Promise(resolve => setTimeout(resolve, 10));
    if (mockAudioInstance?.onloadedmetadata) {
      mockAudioInstance.onloadedmetadata();
    }

    const result = await promise;

    expect(result.success).toBe(true);
    for (const seg of result.segments) {
      expect(Number.isFinite(seg.start)).toBe(true);
      expect(Number.isFinite(seg.end)).toBe(true);
      expect(seg.start).toBeGreaterThanOrEqual(0);
    }
  });
});
