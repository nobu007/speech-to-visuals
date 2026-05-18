/**
 * Unit tests for src/utils/audio-duration.ts
 * EDGE-103: Audio duration measurement and formatting utilities
 */

import { formatDuration } from '@/utils/audio-duration';
import { AUDIO_LIMITS } from '@/config/limits';

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

describe('AUDIO_LIMITS', () => {
  it('defines DURATION_WARNING_SECONDS as 3600 (1 hour)', () => {
    expect(AUDIO_LIMITS.DURATION_WARNING_SECONDS).toBe(3600);
  });

  it('defines MAX_FILE_SIZE_BYTES as 50MB', () => {
    expect(AUDIO_LIMITS.MAX_FILE_SIZE_BYTES).toBe(50 * 1024 * 1024);
  });
});
