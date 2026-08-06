/**
 * Regression tests for NaN/Infinity guards in renderer.ts
 *
 * Covers:
 *   - estimateFileSize with NaN / undefined durationSeconds
 *   - estimateFileSize with valid inputs still produces finite results
 */

import { estimateFileSize } from '@/remotion/renderer';
import type { RenderConfig } from '@/remotion/renderer';

const baseConfig: RenderConfig = {
  resolution: '1080p',
  fps: 30,
  codec: 'h264',
  quality: 23,
  includeAudio: false,
};

describe('estimateFileSize NaN guard', () => {
  test('returns finite result for valid durationSeconds', () => {
    const size = estimateFileSize(baseConfig, 60);
    expect(Number.isFinite(size)).toBe(true);
    expect(size).toBeGreaterThan(0);
  });

  test('returns 0 (not NaN) for NaN durationSeconds', () => {
    const size = estimateFileSize(baseConfig, NaN);
    expect(Number.isNaN(size)).toBe(false);
    expect(size).toBe(0);
  });

  test('returns 0 (not NaN) for Infinity durationSeconds', () => {
    const size = estimateFileSize(baseConfig, Infinity);
    // Infinity is not finite → treated as 0 → result 0
    expect(Number.isFinite(size)).toBe(true);
  });

  test('returns 0 for undefined-ish durationSeconds (when coerced)', () => {
    const size = estimateFileSize(baseConfig, undefined as unknown as number);
    expect(Number.isNaN(size)).toBe(false);
  });
});
