/**
 * Canonical pipeline quality score — single-source lock (REQ-300).
 *
 * Background: the 0–100 quality formula was duplicated verbatim in
 * SimplePipeline.calculateQualityScore and BatchProcessingAPI.calculateQualityScore.
 * Both now delegate to `calculatePipelineQualityScore` (src/pipeline/quality-score.ts).
 *
 * These tests pin the canonical weighting with distinctive sentinel values so any
 * future re-divergence (someone re-inlining a stale copy in either caller) shows up
 * as a component-score failure here. They also lock the falsy-guard fix: a
 * legitimate processingTime of 0 must earn the full 20 performance points rather
 * than being dropped.
 */
import { calculatePipelineQualityScore } from '../quality-score';

describe('calculatePipelineQualityScore (single source, 0-100)', () => {
  it('returns 0 for empty input', () => {
    expect(calculatePipelineQualityScore({})).toBe(0);
  });

  describe('transcript component (max 30)', () => {
    it('scales linearly up to 100 chars', () => {
      // 50 chars → 0.5 * 30 = 15
      expect(calculatePipelineQualityScore({ transcript: 'x'.repeat(50) })).toBe(15);
    });

    it('caps at 30 for >= 100 chars', () => {
      expect(calculatePipelineQualityScore({ transcript: 'x'.repeat(150) })).toBe(30);
      expect(calculatePipelineQualityScore({ transcript: 'x'.repeat(1000) })).toBe(30);
    });
  });

  describe('scene-confidence component (max 30)', () => {
    it('uses the average confidence (0-1) scaled to 30', () => {
      // single scene 0.5 → 15
      expect(calculatePipelineQualityScore({ scenes: [{ confidence: 0.5 }] })).toBe(15);
    });

    it('averages across multiple scenes', () => {
      // (0.4 + 0.8) / 2 = 0.6 → 18 (toBeCloseTo: IEEE-754 gives 18.000000000000004,
      // identical to the old inline formula — this locks the canonical arithmetic).
      expect(
        calculatePipelineQualityScore({ scenes: [{ confidence: 0.4 }, { confidence: 0.8 }] }),
      ).toBeCloseTo(18, 10);
    });

    it('treats missing confidence as 0', () => {
      // [undefined, 0.9] → avg 0.45 → 13.5
      expect(
        calculatePipelineQualityScore({ scenes: [{}, { confidence: 0.9 }] }),
      ).toBe(13.5);
    });
  });

  describe('performance component (max 20)', () => {
    it('penalizes 1 point per second of processing', () => {
      // 5000 ms → 20 - 5 = 15
      expect(calculatePipelineQualityScore({ processingTime: 5000 })).toBe(15);
    });

    it('floors at 0 for very slow processing', () => {
      expect(calculatePipelineQualityScore({ processingTime: 30_000 })).toBe(0);
    });

    it('earns the full 20 for a legitimate 0 ms (no falsy-guard drop)', () => {
      // The old BatchProcessingAPI copy used `if (result.processingTime)` which
      // skipped on 0 (falsy). The single source must treat 0 as instant → 20.
      expect(calculatePipelineQualityScore({ processingTime: 0 })).toBe(20);
    });

    it('skips the component entirely when processingTime is omitted', () => {
      expect(calculatePipelineQualityScore({})).toBe(0);
    });
  });

  describe('video-generation bonus (flat 20)', () => {
    it('adds 20 when a videoUrl is present', () => {
      expect(calculatePipelineQualityScore({ videoUrl: '/out/x.mp4' })).toBe(20);
    });
  });

  describe('combined + cap', () => {
    it('sums all four components (distinctive sentinel 80)', () => {
      // transcript 150 → 30, scene 0.5 → 15, perf 5000 → 15, video → 20  = 80
      expect(
        calculatePipelineQualityScore({
          transcript: 'x'.repeat(150),
          scenes: [{ confidence: 0.5 }],
          processingTime: 5000,
          videoUrl: '/out/x.mp4',
        }),
      ).toBe(80);
    });

    it('caps the total at 100', () => {
      // 30 + 30 + 20 + 20 = 100 (every component maxed)
      expect(
        calculatePipelineQualityScore({
          transcript: 'x'.repeat(200),
          scenes: [{ confidence: 1 }],
          processingTime: 0,
          videoUrl: '/out/x.mp4',
        }),
      ).toBe(100);
    });
  });
});
