/**
 * @jest-environment node
 */
/**
 * scene-synchronizer-fps-finiteness-mutation-pinning.test.ts — TC-306
 *
 * Pins the FPS finiteness guard at `src/remotion/scene-synchronizer.ts`
 * (two symmetric sites: `msToFrame:81` and `frameToMs:94`, commit 629836c9,
 * iteration 10e) against silent regression.
 *
 * THE BUG CLASS. `msToFrame` / `frameToMs` convert between milliseconds and
 * frame numbers via `(ms / 1000) * fps` and `(frame / fps) * 1000`. Callers
 * pass `input.fps ?? DEFAULT_FPS`, which catches only `null`/`undefined` — a
 * non-finite `fps` (Infinity / NaN / -Infinity, e.g. from a tampered API
 * payload or a buggy LLM field) sails through and makes the frame product
 * Infinity / NaN, breaking the caption binary-search and poisoning every
 * downstream frame index. A bare `if (fps <= 0)` does NOT catch this: both
 * Infinity and NaN compare `false` to `<= 0`.
 *
 * The canonical guard is the single line, at BOTH sites:
 *
 *   if (!Number.isFinite(fps) || fps <= 0) fps = DEFAULT_FPS;
 *
 * This is the SAME bug class as TC-304 (audio file-size finiteness): a `<= 0`
 * numeric guard that silently admits Infinity/NaN.
 *
 * WHY MUTATION PINNING. The behavioral tests at
 * `src/remotion/__tests__/scene-synchronizer.test.ts:54-90` prove the guard
 * WORKS today for `msToFrame`. But (a) they import the function and assert on
 * output — a revert to `<= 0` that is co-edited into the test becomes
 * invisible; (b) they focus on `msToFrame`, leaving the SYMMETRIC `frameToMs`
 * site at line 94 under-witnessed; and (c) there is NO source anchor, so a
 * "cleanup" that drops the `!Number.isFinite` clause from one site but not the
 * other passes CI. Layer 1 pins BOTH sites in source text and asserts the
 * guard appears at least twice; Layer 2 witnesses both converters; Layer 3
 * proves the `<= 0`-only mutated form leaks Infinity, so a weakened guard
 * cannot pass.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { msToFrame, frameToMs, DEFAULT_FPS } from '@/remotion/scene-synchronizer';

const GUARD_FILE = 'src/remotion/scene-synchronizer.ts';

// --- (TC-306-01) source anchors: pin both finiteness branches ------------------

describe('scene-synchronizer FPS finiteness guard — source anchors pinned (TC-306-01)', () => {
  const src = (): string => readFileSync(GUARD_FILE, 'utf8');

  it('the guard reads !Number.isFinite(fps) || fps <= 0 (not <= 0 alone)', () => {
    // Dropping `!Number.isFinite(...)` (leaving only `fps <= 0`), or weakening
    // to `=== 0`, leaves this anchor unmatched → RED.
    expect(src()).toMatch(/!Number\.isFinite\(fps\) \|\| fps <= 0\) fps = DEFAULT_FPS/);
  });

  it('the guard is present at BOTH conversion sites (msToFrame AND frameToMs)', () => {
    // The two sites must stay in sync. A drift that drops the guard from one
    // converter (e.g. "frameToMs is only called with sanitized fps") drops the
    // match count below 2 → RED.
    const matches = src().match(/!Number\.isFinite\(fps\) \|\| fps <= 0\) fps = DEFAULT_FPS/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });

  it('no bare `if (fps <= 0) fps = DEFAULT_FPS` survives without the isFinite clause', () => {
    // Negative anchor: the old, weaker form `if (fps <= 0)` (admitting Infinity
    // / NaN) must NOT appear anywhere. If a future edit re-introduces it —
    // e.g. a second, weaker site, or a revert of one converter — this matches
    // → RED. The combined `!Number.isFinite(fps) || fps <= 0` form is anchored
    // positively above and does not match this pattern.
    expect(src()).not.toMatch(/if \(fps <= 0\) fps = DEFAULT_FPS/);
  });
});

// --- (TC-306-02) behavioral witness: both converters fall back on non-finite fps

describe('scene-synchronizer FPS finiteness guard — behavioral witness (TC-306-02)', () => {
  it('msToFrame falls back to DEFAULT_FPS for Infinity / NaN / -Infinity / 0 / negative fps', () => {
    const baseline = msToFrame(1000, DEFAULT_FPS); // 1000ms @ 30fps = 30
    for (const bad of [Infinity, NaN, -Infinity, 0, -5]) {
      expect(msToFrame(1000, bad)).toBe(baseline);
      expect(Number.isFinite(msToFrame(1000, bad))).toBe(true);
    }
  });

  it('frameToMs mirrors msToFrame — falls back to DEFAULT_FPS for non-finite fps', () => {
    // The SECOND site (line 94). Without its guard, frameToMs(30, Infinity)
    // = (30 / Infinity) * 1000 = 0 — silently wrong, and frameToMs(30, NaN)
    // = NaN. Both must instead equal the DEFAULT_FPS result.
    const baseline = frameToMs(30, DEFAULT_FPS); // 30 frames @ 30fps = 1000ms
    expect(baseline).toBe(1000);
    for (const bad of [Infinity, NaN, -Infinity, 0, -5]) {
      expect(frameToMs(30, bad)).toBe(baseline);
      expect(Number.isFinite(frameToMs(30, bad))).toBe(true);
    }
  });
});

// --- (TC-306-03) mutation witness: the <= 0-only form leaks Infinity -----------

describe('scene-synchronizer FPS finiteness guard — mutation witness (TC-306-03)', () => {
  it('a fps<=0-only check (the mutated form) leaks Infinity and NaN', () => {
    // This is the BUG shape — what the guard defends against. If this assertion
    // ever flips (a bare `<= 0` becomes sufficient to reject Infinity), the
    // `!Number.isFinite` clause is redundant and the guard can be simplified;
    // the test fails loudly so we notice.
    const correct = (fps: number): boolean => !Number.isFinite(fps) || fps <= 0;
    const mutated = (fps: number): boolean => fps <= 0;

    // Correct form: Infinity / NaN are rejected (→ fallback).
    expect(correct(Infinity)).toBe(true);
    expect(correct(NaN)).toBe(true);
    expect(correct(-Infinity)).toBe(true);

    // Mutated form: Infinity / NaN slip through (not rejected → poison arithmetic).
    expect(mutated(Infinity)).toBe(false); // Infinity <= 0 is false → NOT rejected
    expect(mutated(NaN)).toBe(false); // NaN <= 0 is false → NOT rejected

    // And the downstream arithmetic consequence: an unrejected Infinity fps
    // produces an Infinity frame number (the caption-search breaker).
    const msToFpsInf = (ms: number, fps: number): number => (ms / 1000) * fps;
    expect(Number.isFinite(msToFpsInf(1000, Infinity))).toBe(false);
  });
});
