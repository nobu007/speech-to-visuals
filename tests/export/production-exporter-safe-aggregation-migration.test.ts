/**
 * production-exporter T3 sites — wave-6 safeSum/safeMean migration oracle
 * (specs/finite-safe-aggregation, sweep-20260815.md sites 687 and 780).
 *
 * Site 687 (`estimateFileSize` totalDuration): legacy
 *   scenes.reduce((sum, s) => sum + Math.max(0, s.durationMs || 0), 0) / 1000
 *   → safeSum(scenes.map(...)) / 1000
 * This is a SUM converted ms→s, deliberately NOT safeMean. Every element is
 * already finite (`Math.max(0, || 0)` guard), so output is identical for all
 * inputs; the migration exists to move the aggregation to the single source.
 *
 * Site 780 (`averageProcessingTime`): legacy
 *   completed.length > 0
 *     ? completed.reduce((sum, j) => sum + (j.endTime! - j.startTime!), 0)
 *       / completed.length
 *     : 0
 *   → safeMean(completed.map(j => j.endTime! - j.startTime!))
 * behavior change (non-finite timestamp pair only): the poisoned job is
 * excluded instead of making the average NaN.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { safeSum, safeMean } from '@stv/core/lib/metrics-utils';
import { createLayoutRng } from '@/visualization/layout-rng';

const exporterSource = readFileSync(
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../src/export/production-exporter.ts',
  ),
  'utf8',
);

interface Scene {
  durationMs: number;
}

/** Legacy site-687 expression, replicated. */
const legacyTotalDurationSec = (scenes: Scene[]): number =>
  scenes.reduce((sum, scene) => sum + Math.max(0, scene.durationMs || 0), 0) / 1000;

const migratedTotalDurationSec = (scenes: Scene[]): number =>
  safeSum(scenes.map((scene) => Math.max(0, scene.durationMs || 0))) / 1000;

interface Job {
  startTime: number;
  endTime: number;
}

/** Legacy site-780 expression, replicated. */
const legacyAverageProcessingTime = (jobs: Job[]): number =>
  jobs.length > 0
    ? jobs.reduce((sum, job) => sum + (job.endTime - job.startTime), 0) / jobs.length
    : 0;

const migratedAverageProcessingTime = (jobs: Job[]): number =>
  safeMean(jobs.map((job) => job.endTime - job.startTime));

describe('site 687: estimateFileSize totalDuration — safeSum (SUM, not mean)', () => {
  test('finite durations: identical to the legacy reduce sum (200 seeded cases)', () => {
    const rng = createLayoutRng('production-exporter|site687');
    for (let i = 0; i < 200; i++) {
      const scenes: Scene[] = Array.from({ length: Math.floor(rng() * 12) }, () => ({
        durationMs: Math.floor(rng() * 20_000),
      }));
      expect(
        Object.is(migratedTotalDurationSec(scenes), legacyTotalDurationSec(scenes)),
      ).toBe(true);
    }
    // empty scene list → 0s, exactly as the legacy sum.
    expect(migratedTotalDurationSec([])).toBe(legacyTotalDurationSec([]));
  });

  test('negative/garbage durationMs still clamps to 0 per scene (guard preserved)', () => {
    expect(migratedTotalDurationSec([{ durationMs: -500 }])).toBe(0);
    expect(migratedTotalDurationSec([{ durationMs: 0 }])).toBe(0);
  });
});

describe('site 780: averageProcessingTime — safeMean', () => {
  test('finite job times: identical to the legacy reduce mean (200 seeded cases)', () => {
    const rng = createLayoutRng('production-exporter|site780');
    for (let i = 0; i < 200; i++) {
      const jobs: Job[] = Array.from({ length: 1 + Math.floor(rng() * 15) }, () => {
        const start = Math.floor(rng() * 1.8e12);
        return { startTime: start, endTime: start + Math.floor(rng() * 120_000) };
      });
      expect(
        Object.is(
          migratedAverageProcessingTime(jobs),
          legacyAverageProcessingTime(jobs),
        ),
      ).toBe(true);
    }
    expect(migratedAverageProcessingTime([])).toBe(legacyAverageProcessingTime([]));
  });

  test('non-finite timestamp pair: excluded (was NaN average)', () => {
    // behavior change: legacy mean over these three was NaN.
    const poisoned: Job[] = [
      { startTime: 0, endTime: 10_000 },
      { startTime: NaN, endTime: 50_000 },
      { startTime: 0, endTime: 20_000 },
    ];
    expect(migratedAverageProcessingTime(poisoned)).toBe(15_000);
  });
});

describe('source anchor: legacy shapes are gone from production-exporter.ts', () => {
  test('durationMs reduce-sum and endTime/startTime reduce-mean no longer appear', () => {
    expect(exporterSource).not.toMatch(
      /sum \+ Math\.max\(0, scene\.durationMs \|\| 0\), 0\) \/ 1000/,
    );
    expect(exporterSource).not.toMatch(
      /sum \+ \(job\.endTime! - job\.startTime!\), 0\) \/ completed\.length/,
    );
    expect(exporterSource).toMatch(
      /safeSum\(scenes\.map\(\(scene\) => Math\.max\(0, scene\.durationMs \|\| 0\)\)\) \/ 1000/,
    );
    expect(exporterSource).toMatch(
      /safeMean\(completed\.map\(\(job\) => job\.endTime! - job\.startTime!\)\)/,
    );
  });
});
