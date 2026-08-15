/**
 * finite-safe aggregation helpers — spec + fuzz equivalence oracle (wave 1).
 *
 * Single-source spec for `safeSum` / `safeMean` / `safeMax` / `safeMin`
 * (specs/finite-safe-aggregation, REQ-001..005, architecture D1/D3/D6):
 *
 * 1. Spec matrix: 5 input classes × 4 functions — the return value is ALWAYS
 *    finite; empty / all-non-finite inputs return the fallback (default 0).
 * 2. Fuzz equivalence: for FINITE-only inputs the helper must be bitwise
 *    (`Object.is`, -0 included) equal to the legacy inline form (replicated
 *    below) — the migration promise of REQ-004. RNG is the seeded
 *    `createLayoutRng` (mulberry32); `Math.random` is banned (REQ-005, and the
 *    frozen-literal sweep bans it in src/visualization anyway).
 * 3. Non-finite contamination: the helper equals the legacy form applied to
 *    the FINITE SUBSET (exclusion semantics, D2), while the legacy form over
 *    the full array is either non-finite or coincidentally equal.
 * 4. Spread blowout regression (EDGE-102): `Math.max(...arr)` throws
 *    RangeError at 2e5 elements; `safeMax` returns a finite value.
 */

import {
  safeSum,
  safeMean,
  safeMax,
  safeMin,
} from '@/lib/metrics-utils';
import { createLayoutRng } from '@/visualization/layout-rng';

// ---------------------------------------------------------------------------
// Legacy inline forms (test-internal replicas — the migration equivalence
// baseline). These are the shapes the ~125 unguarded sites use today.
// ---------------------------------------------------------------------------

const legacySum = (a: number[]): number => a.reduce((x, y) => x + y, 0);
const legacyMean = (a: number[]): number => a.reduce((x, y) => x + y, 0) / a.length;
const legacyMax = (a: number[]): number => Math.max(...a);
const legacyMin = (a: number[]): number => Math.min(...a);

const FINITE_ONLY = [3.5, -2, 0, 1e-7, -0, 9007199254740991];
const NAN_MIXED = [3.5, NaN, -2, 0];
const INF_MIXED = [-Infinity, 3.5, Infinity, -2];
const EMPTY: number[] = [];
const ALL_NON_FINITE = [NaN, Infinity, -Infinity];

describe.each([
  ['safeSum', safeSum, legacySum],
  ['safeMean', safeMean, legacyMean],
  ['safeMax', safeMax, legacyMax],
  ['safeMin', safeMin, legacyMin],
] as const)('%s spec matrix (REQ-001/002/101)', (name, fn, legacy) => {
  // Finite-only input: identical to the legacy form (also asserted by the
  // fuzz oracle below; pinned here for the -0 case explicitly).
  test('finite-only input returns a finite aggregate', () => {
    const out = fn(FINITE_ONLY);
    expect(Number.isFinite(out)).toBe(true);
    expect(Object.is(out, legacy(FINITE_ONLY))).toBe(true);
  });

  test('NaN-contaminated input returns a finite aggregate', () => {
    expect(Number.isFinite(fn(NAN_MIXED))).toBe(true);
  });

  test('±Infinity-contaminated input returns a finite aggregate', () => {
    expect(Number.isFinite(fn(INF_MIXED))).toBe(true);
  });

  test('empty input returns the fallback 0', () => {
    expect(fn(EMPTY)).toBe(0);
  });

  test('all-non-finite input returns the fallback 0', () => {
    expect(fn(ALL_NON_FINITE)).toBe(0);
  });

  test('custom fallback is honored when no finite element exists', () => {
    expect(fn(EMPTY, -1)).toBe(-1);
    expect(fn(ALL_NON_FINITE, -1)).toBe(-1);
  });
});

describe('exclusion semantics (D2)', () => {
  test('mean divides by the FINITE-element count, not the array length', () => {
    // 100 / 200 / NaN → exclusion mean = 150; zero-substitution mean = 100.
    expect(safeMean([100, 200, NaN])).toBe(150);
  });

  test('max/min exclude non-finite elements instead of propagating them', () => {
    expect(safeMax([NaN, 5, 7])).toBe(7);
    expect(safeMax([-Infinity, 5, 7])).toBe(7);
    expect(safeMin([NaN, 5, 7])).toBe(5);
    expect(safeMin([Infinity, 5, 7])).toBe(5);
  });
});

describe('fuzz equivalence oracle (REQ-004/005, architecture D6-3)', () => {
  // Seed pinned — a changed seed changes the case set, which is fine, but the
  // seed STRING is part of the reproducibility contract.
  const rng = createLayoutRng('finite-safe-aggregation|wave1');
  const NON_FINITE = [NaN, Infinity, -Infinity] as const;

  const drawValue = (): number => {
    const r = rng();
    if (r < 0.1) return Math.floor(rng() * 20) - 10; // small ints
    if (r < 0.2) return -(rng()); // negatives incl. drawn 0
    if (r < 0.25) return -0; // -0 must survive bitwise comparison
    if (r < 0.3) return rng() * 1e18; // large magnitudes
    return rng() * 1000; // generic doubles
  };

  const drawArray = (): number[] => {
    const len = 1 + Math.floor(rng() * 32);
    return Array.from({ length: len }, drawValue);
  };

  test.each(['safeSum', 'safeMean', 'safeMax', 'safeMin'] as const)(
    '%s: finite-only inputs are bitwise-equal to the legacy inline form (300 cases)',
    (name) => {
      const fn = { safeSum, safeMean, safeMax, safeMin }[name];
      const legacy = { safeSum: legacySum, safeMean: legacyMean, safeMax: legacyMax, safeMin: legacyMin }[name];
      for (let i = 0; i < 300; i++) {
        const values = drawArray();
        const expected = legacy(values);
        expect(Number.isFinite(expected)).toBe(true); // sanity: input class
        expect(Object.is(fn(values), expected)).toBe(true);
      }
    },
  );

  test.each(['safeSum', 'safeMean', 'safeMax', 'safeMin'] as const)(
    '%s: non-finite contamination → helper equals legacy over the finite subset (300 cases)',
    (name) => {
      const fn = { safeSum, safeMean, safeMax, safeMin }[name];
      const legacy = { safeSum: legacySum, safeMean: legacyMean, safeMax: legacyMax, safeMin: legacyMin }[name];
      for (let i = 0; i < 300; i++) {
        const values = drawArray().map((v) =>
          rng() < 0.3 ? NON_FINITE[Math.floor(rng() * 3)] : v,
        );
        const finiteSubset = values.filter(Number.isFinite);
        expect(Number.isFinite(fn(values))).toBe(true);
        if (finiteSubset.length === 0) {
          expect(fn(values)).toBe(0); // all excluded → fallback
        } else {
          expect(Object.is(fn(values), legacy(finiteSubset))).toBe(true);
        }
      }
    },
  );
});

describe('spread blowout regression (EDGE-102, architecture D3)', () => {
  const BIG = Array.from({ length: 200_000 }, (_, i) => (i % 1000) - 500);

  test('legacy Math.max(...arr) throws RangeError at 2e5 elements', () => {
    expect(() => legacyMax(BIG)).toThrow(RangeError);
  });

  test('safeMax returns a finite value on the same array', () => {
    const out = safeMax(BIG);
    expect(Number.isFinite(out)).toBe(true);
    expect(out).toBe(499);
  });
});
