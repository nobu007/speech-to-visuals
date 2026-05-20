/**
 * Unit tests for src/utils/audio-duration.ts
 * EDGE-103: Audio duration measurement and formatting utilities
 * REQ-141: getAudioDuration with browser API mock
 */

import { formatDuration, getAudioDuration } from '@/utils/audio-duration';
import { AUDIO_LIMITS } from '@/config/limits';

// Mock browser Audio element for getAudioDuration tests
const mockAudioInstance = {
  addEventListener: jest.fn(),
  preload: '',
  src: '',
};

beforeEach(() => {
  // Reset mock state
  mockAudioInstance.addEventListener.mockReset();
  mockAudioInstance.preload = '';
  mockAudioInstance.src = '';

  // Mock global URL.createObjectURL / revokeObjectURL
  jest.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
  jest.spyOn(URL, 'revokeObjectURL').mockImplementation();
});

afterEach(() => {
  jest.restoreAllMocks();
});

// Capture the Audio constructor so tests can trigger events
let capturedListeners: Record<string, Array<(...args: unknown[]) => void>> = {};

jest.mock('@/utils/audio-duration', () => {
  const originalModule = jest.requireActual('@/utils/audio-duration');
  return {
    ...originalModule,
  };
});

// Mock the global Audio constructor
const OriginalAudio = global.Audio;

beforeAll(() => {
  (globalThis as typeof globalThis & { Audio?: unknown }).Audio = jest.fn(() => {
    capturedListeners = {};
    mockAudioInstance.addEventListener = jest.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (!capturedListeners[event]) capturedListeners[event] = [];
      capturedListeners[event].push(handler);
    });
    return mockAudioInstance;
  });
});

afterAll(() => {
  (globalThis as typeof globalThis & { Audio?: unknown }).Audio = OriginalAudio;
});

describe('formatDuration', () => {
  it('formats seconds only', () => {
    expect(formatDuration(30)).toBe('30秒');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(90)).toBe('1分30秒');
  });

  it('formats minutes without seconds', () => {
    expect(formatDuration(120)).toBe('2分');
  });

  it('formats hours and minutes', () => {
    expect(formatDuration(3720)).toBe('1時間2分');
  });

  it('formats hours only', () => {
    expect(formatDuration(3600)).toBe('1時間');
  });

  it('formats hours, minutes and seconds', () => {
    expect(formatDuration(3785)).toBe('1時間3分5秒');
  });

  it('returns "不明" for Infinity', () => {
    expect(formatDuration(Infinity)).toBe('不明');
  });

  it('returns "不明" for negative values', () => {
    expect(formatDuration(-1)).toBe('不明');
  });

  it('returns "不明" for NaN', () => {
    expect(formatDuration(NaN)).toBe('不明');
  });
});

describe('getAudioDuration', () => {
  it('resolves with duration on loadedmetadata', async () => {
    const file = new File(['audio-data'], 'test.mp3', { type: 'audio/mp3' });

    // Set up the duration to be returned
    Object.defineProperty(mockAudioInstance, 'duration', {
      value: 180,
      writable: true,
      configurable: true,
    });

    const promise = getAudioDuration(file);

    // Simulate the loadedmetadata event
    expect(capturedListeners['loadedmetadata']).toBeDefined();
    capturedListeners['loadedmetadata'][0]();

    await expect(promise).resolves.toBe(180);
    expect(mockAudioInstance.preload).toBe('metadata');
  });

  it('rejects with error on audio load failure', async () => {
    const file = new File(['bad-data'], 'bad.mp3', { type: 'audio/mp3' });

    const promise = getAudioDuration(file);

    // Simulate the error event
    expect(capturedListeners['error']).toBeDefined();
    capturedListeners['error'][0]();

    await expect(promise).rejects.toThrow('Failed to load audio metadata for bad.mp3');
  });

  it('sets preload to metadata to avoid full download', async () => {
    const file = new File(['audio'], 'test.wav', { type: 'audio/wav' });

    Object.defineProperty(mockAudioInstance, 'duration', {
      value: 60,
      writable: true,
      configurable: true,
    });

    const promise = getAudioDuration(file);
    capturedListeners['loadedmetadata'][0]();
    await promise;

    expect(mockAudioInstance.preload).toBe('metadata');
  });

  it('revokes the object URL after metadata loads', async () => {
    const file = new File(['audio'], 'test.ogg', { type: 'audio/ogg' });

    Object.defineProperty(mockAudioInstance, 'duration', {
      value: 30,
      writable: true,
      configurable: true,
    });

    const promise = getAudioDuration(file);
    capturedListeners['loadedmetadata'][0]();
    await promise;

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
  });

  it('revokes the object URL on error too', async () => {
    const file = new File(['bad'], 'bad.m4a', { type: 'audio/m4a' });

    const promise = getAudioDuration(file);
    capturedListeners['error'][0]();

    try { await promise; } catch { /* expected */ }

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
  });
});

describe('AUDIO_LIMITS', () => {
  it('defines DURATION_WARNING_SECONDS as 3600 (1 hour)', () => {
    expect(AUDIO_LIMITS.DURATION_WARNING_SECONDS).toBe(3600);
  });

  it('defines MAX_FILE_SIZE_BYTES as 50MB', () => {
    expect(AUDIO_LIMITS.MAX_FILE_SIZE_BYTES).toBe(50 * 1024 * 1024);
  });
});
