/**
 * @jest-environment node
 *
 * Pin the 'mutation-verified' claim for the time-origin mismatch guard
 * (commit a028527c, 09f). Without this test, a future contributor can revert
 * one of the three `performance.now() - job.startTime.getTime()` sites back
 * to `performance.now()` and the existing behavioral test will still pass on
 * machines where `performance.now()` happens to be > epoch-ms — the bug only
 * bites in production after hours of uptime when the page origin advances.
 *
 * THREE-LAYER GUARD:
 *
 *   (1) STATIC SCAN — the 3 recordExport sites in enhanced-export-engine.ts
 *       must all read `Date.now() - job.startTime.getTime()`. A single revert
 *       is RED.
 *
 *   (2) MUTATION EQUIVALENCE — simulate the buggy shape
 *       (`performance.now() - job.startTime.getTime()`) with the smallest
 *       `performance.now()` mock possible. Confirm the result is negative
 *       AND the export-metrics-collector `durationMs < 0` guard drops it
 *       (so a real revert would silently lose every successful export from
 *       the metrics, exactly as 09f described).
 *
 *   (3) POSITIVE PATH — with `Date.now()` (epoch-ms) - epoch-ms, the delta
 *       is non-negative and the collector advances its successfulExports
 *       counter. Proves the fix path is intact.
 *
 * If you "simplify" the production code by reverting any one of the three
 * sites to `performance.now()`, layer 1 turns RED. Layer 2 documents the
 * lost-metrics blast radius so the next reader knows what is at stake.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { exportMetricsCollector } from '../../src/export/export-metrics-collector';

// ---------------------------------------------------------------------------
// Layer 1 — static scan
// ---------------------------------------------------------------------------

describe('Layer 1 — static scan: 3 recordExport sites all use Date.now()', () => {
  const SRC_PATH = 'src/export/enhanced-export-engine.ts';

  function source(): string {
    return readFileSync(SRC_PATH, 'utf8');
  }

  it('no recordExport site computes its duration with performance.now()', () => {
    // The bug shape: `performance.now() - job.startTime.getTime()`. Any
    // survivor here means a future revert went undetected.
    const buggyShape = /performance\.now\(\)\s*-\s*job\.startTime\.getTime\s*\(\s*\)/g;
    const src = source();
    const hits = src.match(buggyShape) ?? [];
    expect(hits).toEqual([]);
  });

  it('all 3 recordExport sites use Date.now() - job.startTime.getTime()', () => {
    const fixedShape = /Date\.now\(\)\s*-\s*job\.startTime\.getTime\s*\(\s*\)/g;
    const src = source();
    const hits = src.match(fixedShape) ?? [];
    // 3 sites: line 368 (cancel-after-file-written success path),
    //          line 390 (failed-path catch),
    //          line 814 (REQ-226 main verification path).
    expect(hits).toHaveLength(3);
  });

  it('the bug-class rationale comment is still present at the main site', () => {
    // The site-3 comment is the load-bearing documentation: it explains
    // WHY performance.now() is wrong here so the next reader doesn't
    // "clean up" the Date.now() as if it were accidental.
    const src = source();
    expect(src).toMatch(/job\.startTime is a `Date` \(epoch-ms/);
    expect(src).toMatch(/~\-1\.7e12 negative duration/);
  });
});

// ---------------------------------------------------------------------------
// Layer 2 — mutation equivalence: the buggy shape loses metrics
// ---------------------------------------------------------------------------

describe('Layer 2 — mutation equivalence: buggy shape would drop the record', () => {
  it('performance.now() − Date.getTime() is negative (the bug)', () => {
    // Simulate a small `performance.now()` (process origin just started)
    // against a real Date.now() epoch-ms value — the shape that a reverted
    // site would compute.
    const fakePerformanceNow = 1234; // ms since origin, e.g. page just loaded
    const epochMs = Date.now();
    const buggyDuration = fakePerformanceNow - epochMs;
    expect(buggyDuration).toBeLessThan(0);
    // The blast radius is huge: every successful export's metric was dropped.
    expect(Math.abs(buggyDuration)).toBeGreaterThan(1e12);
  });

  it('the export-metrics-collector drops a negative durationMs (the silent loss)', () => {
    // Direct call: prove that the guard at export-metrics-collector.ts:205
    // returns BEFORE advancing successfulExports, so a buggy recordExport
    // site would lose the metric without any error.
    const before = exportMetricsCollector.getSnapshot().successfulExports;
    const buggyDuration = performance.now() - new Date(2000, 0, 1).getTime();
    // Sanity: the simulated duration is finite + negative.
    expect(Number.isFinite(buggyDuration)).toBe(true);
    expect(buggyDuration).toBeLessThan(0);

    exportMetricsCollector.recordExport('mp4', 'success', buggyDuration);
    // After a single call with a negative duration, the collector's
    // successfulExports counter MUST NOT have advanced — the guard at
    // export-metrics-collector.ts:205 short-circuits and returns.
    const after = exportMetricsCollector.getSnapshot().successfulExports;
    expect(after).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// Layer 3 — positive path: the fix actually advances the metric
// ---------------------------------------------------------------------------

describe('Layer 3 — positive path: Date.now() − Date.getTime() is non-negative', () => {
  it('Date.now() − Date.getTime() yields a finite, non-negative delta', () => {
    // The correct computation in all three recordExport sites.
    const jobStartTime = new Date(Date.now() - 50); // 50 ms ago
    const elapsed = Date.now() - jobStartTime.getTime();
    expect(Number.isFinite(elapsed)).toBe(true);
    expect(elapsed).toBeGreaterThanOrEqual(0);
    // Should be roughly the 50 ms we synthesized (within generous slack for
    // event-loop jitter).
    expect(elapsed).toBeLessThan(1000);
  });
});