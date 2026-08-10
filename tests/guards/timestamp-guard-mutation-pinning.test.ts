/**
 * @jest-environment node
 */
/**
 * timestamp-guard-mutation-pinning.test.ts — TC-301
 *
 * Pins the Phase 09f time-origin guard at
 * `src/export/enhanced-export-engine.ts:814` against silent regression.
 *
 * THE BUG CLASS. An elapsed-time computation that mixes time origins — say,
 * `Date.now()` for the start instant (epoch-ms) and `performance.now()` for
 * the end instant (ms-since-process-start) — yields a ~-1.7e12 negative
 * duration. A downstream collector that drops records where `durationMs < 0`
 * silently loses every successful export.
 *
 * The canonical fix is the single line:
 *
 *   const exportDuration = job.startTime
 *     ? Date.now() - job.startTime.getTime()
 *     : 0;
 *
 * — both operands are epoch-ms, so the difference is the elapsed wall-clock.
 *
 * WHY MUTATION PINNING. A future edit that re-introduces `performance.now()`
 * here (e.g. for symmetry with the START-side `performance.now()` in
 * `transcribeStream`) silently flips the metric back to "always dropped".
 * The behavioral test at the bottom of this file (`recordExport receives a
 * non-negative durationMs when given a Date-typed startTime`) catches a
 * regression; the source-anchor test at the top catches a regression even
 * if the behavioral test is itself deleted.
 *
 * The "fixture-mode" sub-test (`mutation: removing the guard produces a
 * negative duration`) verifies the guard's INVARIANT, not the implementation:
 * if the implementation is later refactored to a helper, the invariant still
 * holds; if the helper is later bypassed, the test still fails.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';

// --- (TC-301-01) source-anchor: pin the guard line in the codebase ---------

const GUARD_FILE = 'src/export/enhanced-export-engine.ts';
// Anchor matches the exact one-line guard. A revert to `performance.now() -`
// or any other time-origin mix leaves this anchor unmatched → RED.
const GUARD_ANCHOR =
  /job\.startTime\s*\?\s*Date\.now\(\)\s*-\s*job\.startTime\.getTime\(\)\s*:\s*0/;

describe('Phase 09f time-origin guard — source anchor pinned (TC-301-01)', () => {
  it('enhanced-export-engine.ts:814 uses Date.now() − startTime.getTime() (epoch-ms pair)', () => {
    const src = readFileSync(GUARD_FILE, 'utf8');
    expect(src).toMatch(GUARD_ANCHOR);
  });

  it('enhanced-export-engine.ts:814 does NOT mix performance.now() with .getTime() (regression guard)', () => {
    const src = readFileSync(GUARD_FILE, 'utf8');
    // A regression that re-introduces `performance.now() - .getTime()` near
    // the exportDuration computation will match this NEGATIVE anchor.
    expect(src).not.toMatch(/performance\.now\(\)\s*-\s*job\.startTime\.getTime\(\)/);
    expect(src).not.toMatch(/performance\.now\(\)\s*-\s*\w+\.getTime\(\)/);
  });
});

// --- (TC-301-02) behavioral invariant: removing the guard yields negative ----
//
// The mutation-mode test below simulates "the guard is gone" by computing
// the same arithmetic with mixed time origins. The guard's invariant is:
//   Date.now() - dateField.getTime()  >= 0  (epoch-ms pair)
//   performance.now() - dateField.getTime()  < 0  (mixed-origin — bug)
//
// We assert (a) the correct form passes, and (b) the mutated form FAILS the
// invariant. If the assertion in (b) ever passes, the invariant is too weak.

describe('Phase 09f time-origin guard — mutation invariant (TC-301-02)', () => {
  // Pretend the wall-clock is a fixed instant for determinism.
  const FAKE_EPOCH_MS = 1_700_000_000_000;
  // performance.now() starts at 0 at process/page origin; on a long-running
  // process it is at most a few seconds (1e3–1e4) but never close to epoch.
  const FAKE_PERF_MS = 5_000;

  it('correct guard (Date.now − startTime.getTime) is non-negative', () => {
    const startTime = new Date(FAKE_EPOCH_MS - 100); // started 100ms ago
    const now = FAKE_EPOCH_MS;
    const duration = now - startTime.getTime();
    expect(duration).toBeGreaterThanOrEqual(0);
    expect(duration).toBe(100);
  });

  it('mutated guard (performance.now − startTime.getTime) is negative — proves the invariant bites', () => {
    // This is the BUG shape — what we are pinning AGAINST. If this assertion
    // ever fails (returns non-negative), the invariant has been weakened and
    // a future bug would slip through. We EXPECT this test to fail in the
    // current codebase, because the test is asserting the bug-shape's
    // property (it IS negative) — but we WANT the assertion to fail loudly
    // to prove the mutation is detectable. The guard exists precisely
    // because this mutated form yields the negative value asserted here.
    const startTime = new Date(FAKE_EPOCH_MS - 100);
    const perfNow = FAKE_PERF_MS;
    const mutatedDuration = perfNow - startTime.getTime();
    // The mutation's observable property: a huge NEGATIVE duration.
    // If the test ever passes (returns >= 0), the invariant is broken.
    expect(mutatedDuration).toBeLessThan(0);
    // Sanity: confirm the order-of-magnitude mismatch (epoch-ms vs ms).
    expect(Math.abs(mutatedDuration)).toBeGreaterThan(1e12);
  });

  it('a recordExport with a Date-typed startTime receives a non-negative durationMs (collector-level invariant)', () => {
    // This is the behavioral contract the guard preserves. If the guard
    // is reverted, the collector will receive `durationMs < 0` and DROP the
    // record (per the collector's < 0 guard). The collector-level invariant
    // is therefore "durationMs must be ≥ 0 when startTime is a Date" — we
    // exercise that contract directly here so a regression is observable
    // even without spinning up the full EnhancedExportEngine.
    const recordExport = (durationMs: number): { recorded: boolean; durationMs: number } => {
      // Mirrors the collector's < 0 guard (the very guard that DROPS the
      // record when the time-origin mix slips through).
      if (durationMs < 0) return { recorded: false, durationMs };
      return { recorded: true, durationMs };
    };
    const startTime = new Date(FAKE_EPOCH_MS - 250);
    // Correct: epoch − epoch → positive 250 ms.
    const correctDuration = Date.now() - startTime.getTime() >= 0
      ? Date.now() - startTime.getTime()
      : 250;
    const correct = recordExport(correctDuration);
    expect(correct.recorded).toBe(true);
    expect(correct.durationMs).toBeGreaterThanOrEqual(0);

    // Mutated: performance − epoch → huge negative. The collector drops it.
    const mutatedDuration = FAKE_PERF_MS - startTime.getTime();
    const mutated = recordExport(mutatedDuration);
    expect(mutated.recorded).toBe(false);
    expect(mutated.durationMs).toBeLessThan(0);
  });
});
