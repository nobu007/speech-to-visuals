/**
 * Property-based fuzz tests for render pipeline numeric guards.
 *
 * Systematically fuzzes durationInFrames, quality (CRF), fps, and
 * durationSeconds across degenerate and extreme ranges to verify
 * that buildRenderOptions() and estimateFileSize() never produce
 * NaN, Infinity, or out-of-range values.
 */

import { describe, it, expect } from '@jest/globals';
import {
  buildRenderOptions,
  estimateFileSize,
  type RenderConfig,
  type RenderParams,
} from '@/remotion/renderer';
import { calculateTotalFrames } from '@/remotion/Video';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function degenerateNumbers(): number[] {
  return [
    NaN,
    Infinity,
    -Infinity,
    Number.MAX_VALUE,
    -Number.MAX_VALUE,
    0,
    -0,
    Number.EPSILON,
    Number.MAX_SAFE_INTEGER,
    Number.MIN_SAFE_INTEGER,
    1e308,
    -1e308,
    1e-308,
    -1e-308,
    0.1,
    -0.1,
    1234.5678,
    -1234.5678,
  ];
}

const BASE_CONFIG: RenderConfig = {
  resolution: '1080p',
  fps: 30,
  codec: 'h264',
  includeAudio: false,
  quality: 23,
};

const BASE_PARAMS: RenderParams = {
  serveUrl: 'http://localhost:3000',
  compositionId: 'test-comp',
  durationInFrames: 300,
  outputLocation: '/tmp/out.mp4',
};

// ---------------------------------------------------------------------------
// buildRenderOptions fuzz
// ---------------------------------------------------------------------------

describe('buildRenderOptions fuzz', () => {
  const rng = mulberry32(2024);

  it('durationInFrames is always a positive finite integer >= 1', () => {
    const values = degenerateNumbers();
    for (const v of values) {
      const opts = buildRenderOptions(BASE_CONFIG, {
        ...BASE_PARAMS,
        durationInFrames: v,
      });
      const dur = (opts.composition as Record<string, unknown>).durationInFrames as number;
      expect(Number.isFinite(dur)).toBe(true);
      expect(Number.isInteger(dur)).toBe(true);
      expect(dur).toBeGreaterThanOrEqual(1);
    }
  });

  it('durationInFrames handles undefined/null without crash', () => {
    const opts1 = buildRenderOptions(BASE_CONFIG, {
      ...BASE_PARAMS,
      durationInFrames: undefined as unknown as number,
    });
    const dur1 = (opts1.composition as Record<string, unknown>).durationInFrames as number;
    expect(dur1).toBeGreaterThanOrEqual(1);

    const opts2 = buildRenderOptions(BASE_CONFIG, {
      ...BASE_PARAMS,
      durationInFrames: null as unknown as number,
    });
    const dur2 = (opts2.composition as Record<string, unknown>).durationInFrames as number;
    expect(dur2).toBeGreaterThanOrEqual(1);
  });

  it('quality (CRF) is always clamped to [1, 100]', () => {
    const values = [...degenerateNumbers(), 0, -50, 200, 5000, -5000];
    for (const v of values) {
      const opts = buildRenderOptions(
        { ...BASE_CONFIG, quality: v },
        BASE_PARAMS,
      );
      const crf = opts.crf as number;
      expect(crf).toBeGreaterThanOrEqual(1);
      expect(crf).toBeLessThanOrEqual(100);
      expect(Number.isFinite(crf)).toBe(true);
    }
  });

  it('quality is an integer', () => {
    for (let i = 0; i < 200; i++) {
      const v = (rng() - 0.5) * 200;
      const opts = buildRenderOptions(
        { ...BASE_CONFIG, quality: v },
        BASE_PARAMS,
      );
      const crf = opts.crf as number;
      expect(Number.isInteger(crf)).toBe(true);
    }
  });

  it('random durationInFrames values always produce valid output', () => {
    for (let i = 0; i < 500; i++) {
      const v = (rng() - 0.5) * 1e8;
      const opts = buildRenderOptions(BASE_CONFIG, {
        ...BASE_PARAMS,
        durationInFrames: v,
      });
      const dur = (opts.composition as Record<string, unknown>).durationInFrames as number;
      expect(Number.isFinite(dur)).toBe(true);
      expect(dur).toBeGreaterThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// estimateFileSize fuzz
// ---------------------------------------------------------------------------

describe('estimateFileSize fuzz', () => {
  const rng = mulberry32(88);

  it('never returns NaN or Infinity for degenerate durationSeconds', () => {
    for (const v of degenerateNumbers()) {
      const size = estimateFileSize(BASE_CONFIG, v);
      expect(Number.isFinite(size)).toBe(true);
      expect(size).toBeGreaterThanOrEqual(0);
    }
  });

  it('never returns NaN or Infinity for random durationSeconds', () => {
    for (let i = 0; i < 500; i++) {
      const v = rng() * 1e6 - 5e5;
      const size = estimateFileSize(BASE_CONFIG, v);
      expect(Number.isFinite(size)).toBe(true);
      expect(size).toBeGreaterThanOrEqual(0);
    }
  });

  it('returns 0 for NaN/Infinity durationSeconds', () => {
    expect(estimateFileSize(BASE_CONFIG, NaN)).toBe(0);
    expect(estimateFileSize(BASE_CONFIG, Infinity)).toBe(0);
    expect(estimateFileSize(BASE_CONFIG, -Infinity)).toBe(0);
  });

  it('returns 0 for negative durationSeconds', () => {
    for (let i = 0; i < 100; i++) {
      const v = -(rng() * 10000 + 1);
      expect(estimateFileSize(BASE_CONFIG, v)).toBe(0);
    }
  });

  it('returns larger size for longer durations (monotonic)', () => {
    const codecs: RenderConfig['codec'][] = ['h264', 'h265', 'vp9'];
    const resolutions: RenderConfig['resolution'][] = ['720p', '1080p', '4k'];
    for (const codec of codecs) {
      for (const res of resolutions) {
        const cfg: RenderConfig = { ...BASE_CONFIG, codec, resolution: res };
        const size10 = estimateFileSize(cfg, 10);
        const size60 = estimateFileSize(cfg, 60);
        expect(size60).toBeGreaterThan(size10);
      }
    }
  });

  it('handles degenerate quality values without crash', () => {
    for (const v of degenerateNumbers()) {
      const cfg: RenderConfig = { ...BASE_CONFIG, quality: v };
      const size = estimateFileSize(cfg, 60);
      expect(Number.isFinite(size)).toBe(true);
      expect(size).toBeGreaterThanOrEqual(0);
    }
  });
});

// ---------------------------------------------------------------------------
// calculateTotalFrames fuzz
// ---------------------------------------------------------------------------

describe('calculateTotalFrames fuzz', () => {
  const rng = mulberry32(314);

  it('returns positive finite integer for empty/degenerate scene arrays', () => {
    expect(calculateTotalFrames([])).toBeGreaterThanOrEqual(1);
    expect(Number.isFinite(calculateTotalFrames([]))).toBe(true);
  });

  it('returns positive finite for degenerate fps values', () => {
    for (const fps of degenerateNumbers()) {
      const result = calculateTotalFrames([], fps);
      expect(Number.isFinite(result)).toBe(true);
      expect(result).toBeGreaterThanOrEqual(1);
    }
  });

  it('handles scenes with all degenerate durationMs', () => {
    for (let iter = 0; iter < 200; iter++) {
      const sceneCount = 1 + Math.floor(rng() * 5);
      const scenes = Array.from({ length: sceneCount }, () => {
        const idx = Math.floor(rng() * degenerateNumbers().length);
        return { durationMs: degenerateNumbers()[idx] } as never;
      });
      const result = calculateTotalFrames(scenes, 30);
      expect(Number.isFinite(result)).toBe(true);
      expect(result).toBeGreaterThanOrEqual(0);
    }
  });
});
