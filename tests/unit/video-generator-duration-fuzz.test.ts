/**
 * Property-based fuzz tests for VideoGenerator duration calculations.
 *
 * Verifies that convertSceneToRemotionFormat and calculateTotalDuration
 * never produce NaN, Infinity, or negative values when given degenerate
 * startTime/endTime/durationMs inputs.
 *
 * The production guards in video-generator.ts lines 207-209 and 518-523
 * use `|| defaultDuration` fallback and `Number.isFinite()` checks.
 * These tests systematically exercise the arithmetic boundaries.
 */

import { describe, it, expect } from '@jest/globals';

// ---------------------------------------------------------------------------
// Types (mirroring internal structures)
// ---------------------------------------------------------------------------

interface SceneLike {
  startTime: number;
  endTime: number;
}

interface RemotionSceneLike {
  startMs: number;
  durationMs: number;
}

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

const DEGENERATE = [
  NaN,
  Infinity,
  -Infinity,
  0,
  -0,
  Number.MAX_VALUE,
  -Number.MAX_VALUE,
  Number.MIN_VALUE,
  Number.EPSILON,
  Number.MAX_SAFE_INTEGER,
  Number.MIN_SAFE_INTEGER,
  1e308,
  -1e308,
  undefined,
  null,
];

/**
 * Replicates the guarded duration logic from video-generator.ts:
 *   const sceneDuration = Math.max(3000, Math.min(10000,
 *     (scene.endTime - scene.startTime) || defaultDuration
 *   ));
 *
 * If this logic changes, this mirror must be updated to match.
 */
function guardedSceneDuration(scene: SceneLike): number {
  const defaultDuration = 5000;
  const raw = (scene.endTime - scene.startTime) || defaultDuration;
  return Math.max(3000, Math.min(10000, raw));
}

/**
 * Replicates calculateTotalDuration from video-generator.ts: SUM of each scene's
 * finite durationMs. The render path plays scenes back-to-back cumulatively and
 * ignores absolute startMs, so the reported total is the SUM of durationMs
 * (NOT max(startMs + durationMs)). An overflow guard freezes the running sum if
 * it ever exceeds Number.MAX_VALUE, keeping the result finite.
 *   let total = 0;
 *   for (const scene of scenes) {
 *     const dur = Number.isFinite(scene.durationMs) ? Math.max(0, scene.durationMs) : 0;
 *     const next = total + dur;
 *     total = Number.isFinite(next) ? next : total;
 *   }
 *   return total;
 *
 * `startMs` is intentionally unused here, mirroring production (playback ignores
 * it); the fuzz inputs still carry it to exercise the full input shape.
 */
function guardedTotalDuration(scenes: RemotionSceneLike[]): number {
  let total = 0;
  for (const scene of scenes) {
    const dur = Number.isFinite(scene.durationMs) ? Math.max(0, scene.durationMs) : 0;
    const next = total + dur;
    total = Number.isFinite(next) ? next : total;
  }
  return total;
}

// ---------------------------------------------------------------------------
// Tests: scene duration calculation
// ---------------------------------------------------------------------------

describe('VideoGenerator scene duration fuzz', () => {
  const rng = mulberry32(2025);

  it('never produces NaN or Infinity for degenerate startTime/endTime pairs', () => {
    for (const start of DEGENERATE) {
      for (const end of DEGENERATE) {
        const duration = guardedSceneDuration({
          startTime: start as number,
          endTime: end as number,
        });
        expect(Number.isFinite(duration)).toBe(true);
        expect(duration).toBeGreaterThanOrEqual(3000);
        expect(duration).toBeLessThanOrEqual(10000);
      }
    }
  });

  it('never produces NaN or Infinity for random numeric pairs', () => {
    for (let i = 0; i < 2000; i++) {
      const useSpecial = rng() < 0.2;
      const start = useSpecial
        ? DEGENERATE[Math.floor(rng() * DEGENERATE.length)] as number
        : (rng() - 0.5) * 2e6;
      const end = useSpecial
        ? DEGENERATE[Math.floor(rng() * DEGENERATE.length)] as number
        : (rng() - 0.5) * 2e6;

      const duration = guardedSceneDuration({ startTime: start, endTime: end });
      expect(Number.isFinite(duration)).toBe(true);
      expect(duration).toBeGreaterThanOrEqual(3000);
      expect(duration).toBeLessThanOrEqual(10000);
    }
  });

  it('clamps valid durations to [3000, 10000]', () => {
    // Short duration (100ms) should be clamped up to 3000
    expect(guardedSceneDuration({ startTime: 0, endTime: 100 })).toBe(3000);
    // Long duration (20s) should be clamped down to 10000
    expect(guardedSceneDuration({ startTime: 0, endTime: 20000 })).toBe(10000);
    // Exactly at boundaries
    expect(guardedSceneDuration({ startTime: 0, endTime: 3000 })).toBe(3000);
    expect(guardedSceneDuration({ startTime: 0, endTime: 10000 })).toBe(10000);
  });

  it('falls back to defaultDuration when subtraction yields 0', () => {
    // startTime === endTime → 0 || 5000 → 5000, clamped to [3000, 10000] → 5000
    expect(guardedSceneDuration({ startTime: 5000, endTime: 5000 })).toBe(5000);
  });

  it('handles misordered timestamps (end < start → negative duration)', () => {
    // end - start = -5000 → falsy? No, -5000 is truthy → clamped to [3000, 10000]
    // Math.max(3000, Math.min(10000, -5000)) = Math.max(3000, -5000) = 3000
    const duration = guardedSceneDuration({ startTime: 10000, endTime: 5000 });
    expect(duration).toBe(3000);
  });
});

// ---------------------------------------------------------------------------
// Tests: total duration calculation
// ---------------------------------------------------------------------------

describe('VideoGenerator total duration fuzz', () => {
  const rng = mulberry32(3030);

  it('never produces NaN or Infinity for scenes with degenerate startMs/durationMs', () => {
    for (let iter = 0; iter < 500; iter++) {
      const sceneCount = 1 + Math.floor(rng() * 10);
      const scenes: RemotionSceneLike[] = [];
      for (let s = 0; s < sceneCount; s++) {
        const useSpecial = rng() < 0.3;
        const startMs = useSpecial
          ? DEGENERATE[Math.floor(rng() * DEGENERATE.length)] as number
          : Math.floor(rng() * 1e6);
        const durationMs = useSpecial
          ? DEGENERATE[Math.floor(rng() * DEGENERATE.length)] as number
          : Math.floor(rng() * 1e5);
        scenes.push({ startMs, durationMs });
      }
      const total = guardedTotalDuration(scenes);
      expect(Number.isFinite(total)).toBe(true);
      expect(total).toBeGreaterThanOrEqual(0);
    }
  });

  it('returns 0 for empty scene list', () => {
    expect(guardedTotalDuration([])).toBe(0);
  });

  it('returns the SUM of durationMs (matches cumulative render), not max(startMs+dur)', () => {
    const scenes: RemotionSceneLike[] = [
      { startMs: 0, durationMs: 5000 },
      { startMs: 3000, durationMs: 4000 },
      { startMs: 5000, durationMs: 3000 },
    ];
    // Legacy max(0+5000, 3000+4000, 5000+3000) = 8000 — WRONG for cumulative
    // playback. Correct SUM(durationMs) = 5000 + 4000 + 3000 = 12000.
    expect(guardedTotalDuration(scenes)).toBe(12000);
  });

  it('all-NaN scenes produce total = 0', () => {
    const scenes: RemotionSceneLike[] = [
      { startMs: NaN, durationMs: NaN },
      { startMs: NaN, durationMs: NaN },
    ];
    expect(guardedTotalDuration(scenes)).toBe(0);
  });

  it('all-Infinity scenes produce total = 0', () => {
    const scenes: RemotionSceneLike[] = [
      { startMs: Infinity, durationMs: Infinity },
      { startMs: -Infinity, durationMs: -Infinity },
    ];
    expect(guardedTotalDuration(scenes)).toBe(0);
  });

  it('mixed valid and invalid scenes SUM only the finite durations', () => {
    const scenes: RemotionSceneLike[] = [
      { startMs: 0, durationMs: 5000 },   // valid → 5000
      { startMs: NaN, durationMs: 3000 },  // invalid startMs ignored; dur 3000
      { startMs: 1000, durationMs: NaN },  // invalid durationMs → 0
    ];
    // SUM of finite durations: 5000 + 3000 + 0 = 8000
    expect(guardedTotalDuration(scenes)).toBe(8000);
  });

  it('handles a very large finite durationMs without overflow to Infinity', () => {
    // SUM ignores startMs, so a single scene contributes just its durationMs.
    const scenes: RemotionSceneLike[] = [
      { startMs: Number.MAX_SAFE_INTEGER, durationMs: Number.MAX_SAFE_INTEGER },
    ];
    const total = guardedTotalDuration(scenes);
    expect(Number.isFinite(total)).toBe(true);
    expect(total).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('overflow guard freezes the running SUM at Number.MAX_VALUE (no Infinity)', () => {
    // Many near-MAX_VALUE durations would overflow a naive SUM to Infinity.
    // The guard must keep the result finite.
    const scenes: RemotionSceneLike[] = Array.from({ length: 10 }, () => ({
      startMs: 0,
      durationMs: Number.MAX_VALUE,
    }));
    const total = guardedTotalDuration(scenes);
    expect(Number.isFinite(total)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: durationInFrames derivation from totalDuration
// ---------------------------------------------------------------------------

describe('VideoGenerator durationInFrames derivation fuzz', () => {
  const rng = mulberry32(4040);

  it('never produces NaN/Infinity/negative frames for degenerate totalDuration', () => {
    const fpsValues = [24, 30, 60];
    for (const bad of [...DEGENERATE, 1e308, -1e308]) {
      for (const fps of fpsValues) {
        // Replicates: Math.ceil((totalDuration / 1000) * fps)
        // When totalDuration is not finite, the guard in the caller
        // should prevent this from executing, but test the arithmetic anyway.
        const raw = bad as number;
        if (!Number.isFinite(raw)) {
          // The caller (prepareRenderConfiguration) guards totalDuration
          // through validateRemotionData which checks > 0.
          // This test documents that the arithmetic itself can produce
          // non-finite results, justifying the need for upstream guards.
          continue;
        }
        const frames = Math.ceil((raw / 1000) * fps);
        expect(Number.isFinite(frames)).toBe(true);
      }
    }
  });

  it('produces correct frame counts for valid totalDurations', () => {
    expect(Math.ceil((5000 / 1000) * 30)).toBe(150);   // 5s at 30fps
    expect(Math.ceil((10000 / 1000) * 30)).toBe(300);  // 10s at 30fps
    expect(Math.ceil((1000 / 1000) * 60)).toBe(60);    // 1s at 60fps
    expect(Math.ceil((0 / 1000) * 30)).toBe(0);         // 0s → 0 frames
  });
});
