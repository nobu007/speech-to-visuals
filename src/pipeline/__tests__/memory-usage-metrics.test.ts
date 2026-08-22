import { describe, it, expect } from '@jest/globals';
import { peakHeapUsedBytes } from '../memory-usage-metrics';

/**
 * REQ-387: pure core of the ExtendedPipelineMetrics.memoryUsage (bytes)
 * producer. REQ-383/386 read the field measured-only; this combiner decides
 * what "measured" means at the value level:
 *
 *   - no positive finite sample anywhere → null (field omitted → legs
 *     exclude themselves),
 *   - 0 is NOT a measurement (stv-core returns heapUsed 0 when the runtime
 *     has no memory API — publishing 0 would score "0 bytes = excellent"
 *     in REQ-386's rubric),
 *   - the value is the PEAK across samples + live reading, in bytes verbatim
 *     (ExtendedPipelineMetrics documents bytes; the MB conversion belongs to
 *     the consumer).
 *
 * Pure over its inputs so the unmeasured branch — impossible to hit against
 * a real Node backend that always reports a positive heap — is testable
 * without module mocks.
 */
describe('peakHeapUsedBytes (REQ-387: measured-only peak in bytes)', () => {
  it('returns null when no samples exist and the live reading is null (unmeasured runtime)', () => {
    expect(peakHeapUsedBytes([], null)).toBeNull();
  });

  it('returns null when every reading is 0 — the no-memory-API fallback is not a measurement', () => {
    // stv-core getMemoryUsage() returns { heapUsed: 0 } when no memory API
    // exists. Publishing that 0 would hand REQ-386 a finite "0 bytes =
    // excellent" always-pass — the fabricated-leg door the measured-only
    // contract closed.
    expect(peakHeapUsedBytes([0, 0], 0)).toBeNull();
  });

  it('returns the peak across snapshots when it exceeds the live reading', () => {
    // 512MB snapshot dominates a small live reading: the peak is what the run
    // USED, not where it ended.
    const peak = peakHeapUsedBytes(
      [50 * 1024 * 1024, 512 * 1024 * 1024, 10 * 1024 * 1024],
      64 * 1024 * 1024,
    );
    expect(peak).toBe(512 * 1024 * 1024);
  });

  it('includes the live reading when it exceeds every snapshot', () => {
    const peak = peakHeapUsedBytes([1024, 2048], 4096);
    expect(peak).toBe(4096);
  });

  it('uses the sole positive snapshot when the live reading is null', () => {
    // The REQ-358 boundary reports null for an unmeasured backend field; a
    // previously recorded snapshot is still a valid measurement.
    expect(peakHeapUsedBytes([8192], null)).toBe(8192);
  });

  it.each([
    ['NaN', Number.NaN],
    ['negative', -1024],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])('skips a %s snapshot instead of poisoning the peak', (_label, poison) => {
    // A poisoned sample must neither null the result (losing real readings)
    // nor win Math.max (NaN propagates; Infinity fabricates an unbounded
    // peak that can only ever score 0).
    expect(peakHeapUsedBytes([4096, poison], 1024)).toBe(4096);
  });

  it('returns null when a poisoned live reading is the only input', () => {
    expect(peakHeapUsedBytes([], Number.NaN)).toBeNull();
    expect(peakHeapUsedBytes([], Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('returns bytes verbatim — no MB conversion (unit contract of ExtendedPipelineMetrics.memoryUsage)', () => {
    // 268435456 bytes = 256MB. If the producer ever divided by 1024*1024 (the
    // sibling QualityMetrics contract is MB), REQ-386's own bytes→MB division
    // would see 256 "bytes" = 0.0002MB → constant "excellent" score — the
    // hardcoded-128MB masking defect reborn as a unit bug.
    expect(peakHeapUsedBytes([268435456], null)).toBe(268435456);
  });
});
