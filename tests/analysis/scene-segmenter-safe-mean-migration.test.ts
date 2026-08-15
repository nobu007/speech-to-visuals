/**
 * scene-segmenter duration mean — wave-4 safeMean migration oracle
 * (specs/finite-safe-aggregation, sweep-20260815.md site 792:
 * `testSegmentLengthDistribution`).
 *
 * Legacy expression (replicated below):
 *   segments.reduce((sum, seg) => sum + (seg.endMs - seg.startMs), 0)
 *     / segments.length
 *
 * behavior change (D2, non-finite boundary only): a segment whose
 * endMs/startMs difference is non-finite (Whisper-origin timestamps crossing
 * an unguarded boundary) is EXCLUDED from the mean instead of making
 * avgLength NaN — the old NaN silently failed BOTH
 * `avgLength >= TEST_SEGMENT_LENGTH_MIN_MS` and `avgLength <= …_MAX_MS`
 * comparisons. Finite inputs are bitwise-identical.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { safeMean } from '@/lib/metrics-utils';
import { createLayoutRng } from '@/visualization/layout-rng';

const segmenterSource = readFileSync(
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../src/analysis/scene-segmenter.ts',
  ),
  'utf8',
);

interface Seg {
  endMs: number;
  startMs: number;
}

/** Legacy site-792 expression, replicated. */
const legacyAvgLength = (segments: Seg[]): number =>
  segments.reduce((sum, seg) => sum + (seg.endMs - seg.startMs), 0) / segments.length;

const migratedAvgLength = (segments: Seg[]): number =>
  safeMean(segments.map((seg) => seg.endMs - seg.startMs));

describe('site 792: testSegmentLengthDistribution avgLength', () => {
  test('finite timestamps: bitwise-identical to the legacy reduce mean (200 seeded cases)', () => {
    const rng = createLayoutRng('scene-segmenter|site792');
    for (let i = 0; i < 200; i++) {
      const segments: Seg[] = Array.from({ length: 1 + Math.floor(rng() * 16) }, () => {
        const start = Math.floor(rng() * 60_000);
        return { startMs: start, endMs: start + Math.floor(rng() * 30_000) };
      });
      expect(Object.is(migratedAvgLength(segments), legacyAvgLength(segments))).toBe(true);
    }
  });

  test('non-finite duration: excluded, mean stays finite (was NaN)', () => {
    // behavior change: legacy over these three was NaN → both range gates
    // silently failed. Exclusion mean = mean(5000, 7000) = 6000 (ms).
    const poisoned: Seg[] = [
      { startMs: 0, endMs: 5000 },
      { startMs: NaN, endMs: 10000 },
      { startMs: 0, endMs: 7000 },
    ];
    expect(migratedAvgLength(poisoned)).toBe(6000);
    expect(Number.isFinite(migratedAvgLength(poisoned))).toBe(true);
  });

  test('empty segment list is still guarded by the caller early-return (site shape)', () => {
    // The method returns score 0 before reaching the mean when segments is
    // empty; safeMean's own 0 fallback is defense-in-depth below that.
    expect(migratedAvgLength([])).toBe(0);
  });
});

describe('source anchor: legacy duration-mean shape is gone from scene-segmenter.ts', () => {
  test('unguarded endMs-startMs reduce mean no longer appears', () => {
    expect(segmenterSource).not.toMatch(
      /sum \+ \(seg\.endMs - seg\.startMs\), 0\) \/ segments\.length/,
    );
    expect(segmenterSource).toMatch(
      /safeMean\(segments\.map\(\(seg\) => seg\.endMs - seg\.startMs\)\)/,
    );
  });
});
