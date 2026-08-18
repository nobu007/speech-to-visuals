/**
 * enhanced-error-recovery timestamp min/max — wave-5 safeMax/safeMin
 * migration oracle (specs/finite-safe-aggregation, sweep-20260815.md sites
 * 1452 and 1899-1900).
 *
 * Legacy expressions (replicated below):
 *   1452  lastOccurrence = similarErrors.length > 0
 *           ? Math.max(...similarErrors.map(e => e.timestamp)) : 0
 *   1899  timeRange.start = Math.min(...allErrors.map(e => e.timestamp))
 *   1900  timeRange.end   = Math.max(...allErrors.map(e => e.timestamp))
 *
 * behavior change (non-finite timestamp only): a poisoned timestamp is
 * EXCLUDED instead of collapsing the max (or BOTH range bounds) to NaN.
 * Finite timestamps — including realistic Date.now()-scale values — are
 * identical; the spreads are gone (EDGE-102).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { safeMax, safeMin } from '@stv/core/lib/metrics-utils';
import { createLayoutRng } from '@/visualization/layout-rng';

const recoverySource = readFileSync(
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../src/quality/enhanced-error-recovery.ts',
  ),
  'utf8',
);

/** Legacy site-1452 expression, replicated. */
const legacyLastOccurrence = (timestamps: number[]): number =>
  timestamps.length > 0 ? Math.max(...timestamps) : 0;

/** Legacy site-1899/1900 expressions, replicated (now = fallback). */
const legacyRange = (timestamps: number[], now: number): { start: number; end: number } =>
  timestamps.length > 0
    ? {
        start: Math.min(...timestamps),
        end: Math.max(...timestamps),
      }
    : { start: now, end: now };

describe('site 1452: lastOccurrence — safeMax(timestamps)', () => {
  test('finite timestamps: identical to the legacy spread ternary (200 seeded cases)', () => {
    const rng = createLayoutRng('error-recovery|site1452');
    for (let i = 0; i < 200; i++) {
      const timestamps = Array.from({ length: Math.floor(rng() * 20) }, () =>
        // Date.now()-scale values (≈1.7e12) plus small ones.
        rng() < 0.5 ? Math.floor(rng() * 1.8e12) : Math.floor(rng() * 1000),
      );
      expect(Object.is(safeMax(timestamps), legacyLastOccurrence(timestamps))).toBe(true);
    }
    // empty → 0, exactly as the legacy ternary's else branch.
    expect(safeMax([])).toBe(legacyLastOccurrence([]));
  });

  test('NaN timestamp: excluded (was NaN lastOccurrence)', () => {
    // behavior change: legacy max over [100, NaN, 300] was NaN.
    expect(safeMax([100, NaN, 300])).toBe(300);
  });
});

describe('sites 1899-1900: recovery timeRange — safeMin/safeMax', () => {
  const NOW = 1_770_000_000_000;

  test('finite timestamps: bounds identical to the legacy spreads (200 seeded cases)', () => {
    const rng = createLayoutRng('error-recovery|site1899');
    for (let i = 0; i < 200; i++) {
      const timestamps = Array.from({ length: 1 + Math.floor(rng() * 20) }, () =>
        NOW + Math.floor(rng() * 3_600_000),
      );
      const legacy = legacyRange(timestamps, NOW);
      expect(Object.is(safeMin(timestamps, NOW), legacy.start)).toBe(true);
      expect(Object.is(safeMax(timestamps, NOW), legacy.end)).toBe(true);
    }
  });

  test('non-finite timestamp: only the poisoned sample drops, bounds stay finite', () => {
    // behavior change: legacy produced { start: NaN, end: NaN } here.
    const poisoned = [NOW + 100, NaN, NOW + 5000, Infinity];
    expect(safeMin(poisoned, NOW)).toBe(NOW + 100);
    expect(safeMax(poisoned, NOW)).toBe(NOW + 5000);
  });

  test('all-poisoned array: fallback now (was {NaN, NaN})', () => {
    expect(safeMin([NaN], NOW)).toBe(NOW);
    expect(safeMax([NaN], NOW)).toBe(NOW);
  });
});

describe('source anchor: timestamp spreads are gone from enhanced-error-recovery.ts', () => {
  test('Math.min/max(...errors.map(e => e.timestamp)) no longer appears', () => {
    expect(recoverySource).not.toMatch(/Math\.max\(\.\.\.similarErrors\.map\(e => e\.timestamp\)\)/);
    expect(recoverySource).not.toMatch(/Math\.min\(\.\.\.allErrors\.map\(e => e\.timestamp\)\)/);
    expect(recoverySource).not.toMatch(/Math\.max\(\.\.\.allErrors\.map\(e => e\.timestamp\)\)/);
    expect(recoverySource).toMatch(/safeMax\(similarErrors\.map\(e => e\.timestamp\)\)/);
    expect(recoverySource).toMatch(/safeMin\(allErrors\.map\(e => e\.timestamp\), now\)/);
  });
});
