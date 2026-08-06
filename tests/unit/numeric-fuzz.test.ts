/**
 * Property-based fuzz tests for numeric guards across pipeline modules.
 *
 * These tests systematically fuzz numeric inputs to verify that NaN,
 * Infinity, negative values, and extreme magnitudes cannot propagate
 * through the pipeline's timing, segmentation, and guard utilities.
 */

import { describe, it, expect } from '@jest/globals';
import {
  sanitizeFinite,
  clampFinite,
  safeToLocaleString,
} from '@/utils/guards';
import {
  createTimingRecord,
  aggregateTimingReport,
  type StageTimingRecord,
} from '@/pipeline/stage-timing-metrics';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Deterministic PRNG (mulberry32) for reproducible fuzz runs. */
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

/** Generate a battery of degenerate numeric values. */
function degenerateNumbers(): number[] {
  return [
    NaN,
    Infinity,
    -Infinity,
    Number.MAX_VALUE,
    Number.MIN_VALUE,
    -Number.MAX_VALUE,
    0,
    -0,
    Number.EPSILON,
    Number.MAX_SAFE_INTEGER,
    Number.MIN_SAFE_INTEGER,
    -(2 ** 53),
    2 ** 53,
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

/** Generate random numeric triples (startTime, endTime, items) including edge cases. */
function fuzzTimingTriples(
  rng: () => number,
  count: number,
): Array<[number, number, number]> {
  const specials = degenerateNumbers();
  const triples: Array<[number, number, number]> = [];

  for (let i = 0; i < count; i++) {
    // 30% chance to use a degenerate value
    const useSpecial = rng() < 0.3;
    const pick = () =>
      useSpecial
        ? specials[Math.floor(rng() * specials.length)]
        : Math.floor(rng() * 1e6) - 5e5; // range -500K..500K
    triples.push([pick(), pick(), pick()]);
  }
  return triples;
}

// ---------------------------------------------------------------------------
// sanitizeFinite property tests
// ---------------------------------------------------------------------------

describe('sanitizeFinite fuzz', () => {
  const rng = mulberry32(42);

  it('never returns NaN or Infinity for any numeric input', () => {
    for (const v of degenerateNumbers()) {
      const result = sanitizeFinite(v);
      expect(Number.isFinite(result)).toBe(true);
    }
  });

  it('never returns NaN or Infinity for random numeric inputs', () => {
    for (let i = 0; i < 1000; i++) {
      const v = rng() * 2e308 - 1e308;
      const result = sanitizeFinite(v);
      expect(Number.isFinite(result)).toBe(true);
    }
  });

  it('returns defaultValue for NaN/Infinity/undefined/null', () => {
    expect(sanitizeFinite(NaN, 42)).toBe(42);
    expect(sanitizeFinite(Infinity, 42)).toBe(42);
    expect(sanitizeFinite(-Infinity, 42)).toBe(42);
    expect(sanitizeFinite(undefined, 42)).toBe(42);
    expect(sanitizeFinite(null, 42)).toBe(42);
    expect(sanitizeFinite('abc', 42)).toBe(42);
  });

  it('preserves finite values exactly', () => {
    for (let i = 0; i < 500; i++) {
      const v = rng() * 1000;
      expect(sanitizeFinite(v)).toBe(v);
    }
  });
});

// ---------------------------------------------------------------------------
// clampFinite property tests
// ---------------------------------------------------------------------------

describe('clampFinite fuzz', () => {
  const rng = mulberry32(99);

  it('always returns a value in [min, max] for finite inputs', () => {
    for (let i = 0; i < 1000; i++) {
      const min = rng() * 100;
      const max = min + rng() * 100;
      const v = (rng() - 0.5) * 1e6;
      const result = clampFinite(v, min, max);
      expect(result).toBeGreaterThanOrEqual(min);
      expect(result).toBeLessThanOrEqual(max);
      expect(Number.isFinite(result)).toBe(true);
    }
  });

  it('clamps NaN to min', () => {
    for (let i = 0; i < 100; i++) {
      const min = rng() * 100;
      const max = min + rng() * 100;
      expect(clampFinite(NaN, min, max)).toBe(min);
    }
  });

  it('clamps Infinity to max and -Infinity to min', () => {
    for (let i = 0; i < 100; i++) {
      const min = rng() * 100;
      const max = min + rng() * 100;
      expect(clampFinite(Infinity, min, max)).toBe(max);
      expect(clampFinite(-Infinity, min, max)).toBe(min);
    }
  });
});

// ---------------------------------------------------------------------------
// safeToLocaleString property tests
// ---------------------------------------------------------------------------

describe('safeToLocaleString fuzz', () => {
  it('always returns a string, never throws', () => {
    const inputs: unknown[] = [NaN, Infinity, -Infinity, undefined, null, 'abc', {}, [], 0, -0, 12345.678];
    for (const v of inputs) {
      expect(typeof safeToLocaleString(v)).toBe('string');
    }
  });
});

// ---------------------------------------------------------------------------
// createTimingRecord fuzz
// ---------------------------------------------------------------------------

describe('createTimingRecord fuzz', () => {
  const rng = mulberry32(77);

  it('never produces negative durationMs', () => {
    const triples = fuzzTimingTriples(rng, 500);
    for (const [start, end, items] of triples) {
      const record = createTimingRecord('test', start, end, items);
      expect(record.durationMs).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(record.durationMs)).toBe(true);
    }
  });

  it('never produces NaN or Infinity in any field', () => {
    const triples = fuzzTimingTriples(rng, 500);
    for (const [start, end, items] of triples) {
      const record = createTimingRecord('test', start, end, items);
      expect(Number.isFinite(record.durationMs)).toBe(true);
      expect(Number.isFinite(record.throughputPerMs)).toBe(true);
      expect(Number.isFinite(record.itemsProcessed)).toBe(true);
    }
  });

  it('throughputPerMs is 0 when durationMs is 0', () => {
    // Use identical start/end to get durationMs = 0
    for (let i = 0; i < 100; i++) {
      const t = rng() * 1e6;
      const record = createTimingRecord('test', t, t, 100);
      expect(record.durationMs).toBe(0);
      expect(record.throughputPerMs).toBe(0);
    }
  });

  it('throughputPerMs is non-negative and finite for valid inputs', () => {
    for (let i = 0; i < 500; i++) {
      const start = rng() * 1000;
      const end = start + rng() * 10000; // always after start
      const items = Math.floor(rng() * 1000);
      const record = createTimingRecord('test', start, end, items);
      expect(record.throughputPerMs).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(record.throughputPerMs)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// aggregateTimingReport fuzz
// ---------------------------------------------------------------------------

describe('aggregateTimingReport fuzz', () => {
  const rng = mulberry32(123);

  it('never produces NaN/Infinity in totals even with degenerate stage records', () => {
    // Build records with potentially bad data
    for (let iter = 0; iter < 200; iter++) {
      const stageCount = 1 + Math.floor(rng() * 10);
      const stages: StageTimingRecord[] = [];
      for (let s = 0; s < stageCount; s++) {
        const start = rng() * 10000;
        const end = start + rng() * 5000;
        stages.push({
          stageName: `stage-${s}`,
          startTime: start,
          endTime: end,
          durationMs: end - start,
          itemsProcessed: Math.floor(rng() * 100),
          throughputPerMs: 0,
          retryAttempts: Math.floor(rng() * 3),
        });
      }
      // Inject a degenerate record
      if (rng() < 0.5) {
        const idx = Math.floor(rng() * stages.length);
        const degenerate = degenerateNumbers()[Math.floor(rng() * 10)];
        stages[idx].durationMs = degenerate;
        stages[idx].itemsProcessed = degenerate;
      }

      const report = aggregateTimingReport(stages);
      expect(Number.isFinite(report.totalDurationMs)).toBe(true);
      expect(Number.isFinite(report.totalItemsProcessed)).toBe(true);
      expect(Number.isFinite(report.overallThroughputPerMs)).toBe(true);
      expect(report.totalDurationMs).toBeGreaterThanOrEqual(0);
      expect(report.overallThroughputPerMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('handles empty stage list', () => {
    const report = aggregateTimingReport([]);
    expect(report.totalDurationMs).toBe(0);
    expect(report.totalItemsProcessed).toBe(0);
    expect(report.overallThroughputPerMs).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Misordered timestamp pair property
// ---------------------------------------------------------------------------

describe('misordered timestamp property', () => {
  const rng = mulberry32(555);

  it('durationMs is 0 (never negative) when end < start', () => {
    for (let i = 0; i < 500; i++) {
      const start = 5000 + rng() * 5000; // 5000..10000
      const end = rng() * 5000; // 0..5000 (always < start)
      const record = createTimingRecord('test', start, end, 10);
      expect(record.durationMs).toBe(0);
      expect(record.throughputPerMs).toBe(0);
    }
  });

  it('durationMs is correct when end > start', () => {
    for (let i = 0; i < 500; i++) {
      const start = rng() * 1000;
      const end = start + 100 + rng() * 9000; // always > start + 100
      const items = 1 + Math.floor(rng() * 100);
      const record = createTimingRecord('test', start, end, items);
      expect(record.durationMs).toBeCloseTo(end - start, 5);
      const expectedThroughput = items / (end - start);
      expect(record.throughputPerMs).toBeCloseTo(expectedThroughput, 5);
    }
  });
});
