/**
 * diagram-detector aggregation sites — wave-3 safeMax/safeMean migration
 * oracle (specs/finite-safe-aggregation, sweep-20260815.md sites 436/1344).
 *
 * Site 436 (`maxPossibleScore` normalization): legacy
 * `patternScores.length > 0 ? Math.max(...patternScores) : 1` →
 * `safeMax(patternScores, 1)`. Same fallback (1), same value for finite
 * scores, and the spread is gone (EDGE-102).
 *
 * Site 1344 (`testDetectionQuality` overallScore): legacy
 * `length > 0 ? reduce((sum,r) => sum + r.score, 0) / length : 0` →
 * `safeMean(testResults.map(r => r.score))`. behavior change (D2): a
 * non-finite LLM-derived score is EXCLUDED instead of making overallScore
 * NaN — the old NaN silently failed every TEST_QUALITY_THRESHOLD comparison.
 *
 * The sites sit deep inside the analyzer's Gemini-coupled flow, so the
 * equivalence is pinned against exact replicas of the two legacy expressions
 * plus a source anchor (import.meta.url-relative — cwd-relative reads flake
 * under --maxWorkers>1, TC-302/313) proving the file itself migrated.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { safeMax, safeMean } from '@stv/core/lib/metrics-utils';
import { createLayoutRng } from '@/visualization/layout-rng';

const detectorSource = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src/analysis/diagram-detector.ts'),
  'utf8',
);

/** Legacy site-436 expression, replicated. */
const legacyMaxPossible = (scores: number[]): number =>
  scores.length > 0 ? Math.max(...scores) : 1;

/** Legacy site-1344 expression, replicated. */
const legacyOverallScore = (results: Array<{ score: number }>): number =>
  results.length > 0
    ? results.reduce((sum, result) => sum + result.score, 0) / results.length
    : 0;

describe('site 436: maxPossibleScore — safeMax(patternScores, 1)', () => {
  test('finite pattern scores: identical to the legacy spread ternary', () => {
    const rng = createLayoutRng('diagram-detector|site436');
    for (let i = 0; i < 200; i++) {
      const scores = Array.from({ length: 1 + Math.floor(rng() * 12) }, () =>
        Math.floor(rng() * 100),
      );
      expect(Object.is(safeMax(scores, 1), legacyMaxPossible(scores))).toBe(true);
    }
  });

  test('empty pattern set: fallback is 1 (not 0) — preserved', () => {
    expect(safeMax([], 1)).toBe(1);
    expect(safeMax([], 1)).toBe(legacyMaxPossible([]));
  });
});

describe('site 1344: testDetectionQuality overallScore — safeMean', () => {
  test('finite test scores: identical to the legacy reduce mean', () => {
    const rng = createLayoutRng('diagram-detector|site1344');
    for (let i = 0; i < 200; i++) {
      const results = Array.from({ length: 1 + Math.floor(rng() * 8) }, () => ({
        score: rng(),
      }));
      expect(
        Object.is(safeMean(results.map((r) => r.score)), legacyOverallScore(results)),
      ).toBe(true);
    }
    expect(safeMean([])).toBe(legacyOverallScore([]));
  });

  test('NaN score: excluded (was NaN → gate silently failed)', () => {
    // behavior change: legacy overallScore over [0.9, NaN, 0.6] was NaN;
    // exclusion mean is 0.75 > TEST_QUALITY_THRESHOLD (0.75) → gate fires.
    expect(safeMean([0.9, NaN, 0.6].map((s) => s))).toBeCloseTo(0.75, 15);
  });
});

describe('source anchor: the legacy shapes are gone from diagram-detector.ts', () => {
  test('site 436 spread ternary and site 1344 reduce mean no longer appear', () => {
    expect(detectorSource).not.toMatch(/Math\.max\(\.\.\.patternScores\)/);
    expect(detectorSource).not.toMatch(
      /reduce\(\(sum, result\) => sum \+ result\.score, 0\) \/ testResults\.length/,
    );
    expect(detectorSource).toMatch(/safeMax\(patternScores, 1\)/);
    expect(detectorSource).toMatch(/safeMean\(testResults\.map\(\(result\) => result\.score\)\)/);
  });
});
