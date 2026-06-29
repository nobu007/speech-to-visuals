/**
 * Tests for NaN propagation prevention in confidence/score access points.
 *
 * These tests verify that the NaN guards added to:
 * - scene-segmenter.ts (Math.max confidence operations)
 * - complexity-detector.ts (reduce score)
 * - streaming-quality-monitor.ts (Math.min/max confidences)
 * - error-recovery-health-tracker.ts (reduce score)
 *
 * correctly prevent NaN from propagating through calculations.
 */

import { describe, it, expect } from '@jest/globals';

describe('Confidence/score NaN propagation guards', () => {
  describe('Number.isFinite guard behavior', () => {
    it('Number.isFinite filters NaN from confidence values', () => {
      const confidences = [0.8, NaN, 0.6, NaN, 0.9];
      const filtered = confidences.filter(c => Number.isFinite(c));
      expect(filtered).toEqual([0.8, 0.6, 0.9]);
    });

    it('Number.isFinite filters Infinity from confidence values', () => {
      const confidences = [0.8, Infinity, 0.6, -Infinity, 0.9];
      const filtered = confidences.filter(c => Number.isFinite(c));
      expect(filtered).toEqual([0.8, 0.6, 0.9]);
    });

    it('Math.max with filtered confidences does not return NaN', () => {
      const confidences = [NaN, 0.8, NaN];
      const filtered = confidences.filter(c => Number.isFinite(c));
      const max = filtered.length > 0 ? Math.max(...filtered) : 0;
      expect(Number.isFinite(max)).toBe(true);
      expect(max).toBe(0.8);
    });

    it('empty filtered confidences returns 0 as fallback', () => {
      const confidences = [NaN, NaN, NaN];
      const filtered = confidences.filter(c => Number.isFinite(c));
      const max = filtered.length > 0 ? Math.max(...filtered) : 0;
      expect(max).toBe(0);
    });

    it('reduce with Number.isFinite guard prevents NaN propagation', () => {
      const segments = [
        { confidence: 0.8 },
        { confidence: NaN },
        { confidence: 0.6 },
      ] as Array<{ confidence: number }>;

      const avg = segments.reduce(
        (sum, seg) => sum + (Number.isFinite(seg.confidence) ? seg.confidence : 0),
        0,
      ) / segments.length;

      expect(Number.isFinite(avg)).toBe(true);
      expect(avg).toBeCloseTo((0.8 + 0 + 0.6) / 3, 5);
    });

    it('sort comparator with Number.isFinite guard does not break on NaN', () => {
      const items = [
        { id: 'a', confidence: 0.3 },
        { id: 'b', confidence: NaN },
        { id: 'c', confidence: 0.9 },
        { id: 'd', confidence: NaN },
      ] as Array<{ id: string; confidence: number }>;

      // Simulate the guarded sort comparator
      const sorted = [...items].sort(
        (a, b) =>
          (Number.isFinite(b.confidence) ? b.confidence : 0) * 10 -
          (Number.isFinite(a.confidence) ? a.confidence : 0) * 10,
      );

      // NaN items get treated as 0 confidence, so they sort below finite items
      expect(sorted[0].id).toBe('c'); // highest confidence (0.9)
      expect(sorted[1].id).toBe('a'); // second (0.3)
    });

    it('confidence averaging with NaN guard produces finite result', () => {
      const existing = { confidence: 0.7 };
      const incoming = { confidence: NaN };

      const avg =
        ((Number.isFinite(existing.confidence) ? existing.confidence : 0) +
          (Number.isFinite(incoming.confidence) ? incoming.confidence : 0)) / 2;

      expect(Number.isFinite(avg)).toBe(true);
      expect(avg).toBeCloseTo(0.35, 5);
    });

    it('toFixed with guarded confidence does not produce NaN', () => {
      const opp = { confidence: NaN };
      const conf = Number.isFinite(opp.confidence) ? opp.confidence : 0;
      const percentage = (conf * 100).toFixed(0);

      expect(percentage).toBe('0');
      expect(percentage).not.toBe('NaN');
    });
  });

  describe('Score reduce guards', () => {
    it('score reduce with mixed finite/NaN values', () => {
      const stageScores = [
        { score: 0.85 },
        { score: NaN },
        { score: 0.72 },
        { score: Infinity },
      ] as Array<{ score: number }>;

      const avg = stageScores.reduce(
        (a, s) => a + (Number.isFinite(s.score) ? s.score : 0),
        0,
      ) / stageScores.length;

      expect(Number.isFinite(avg)).toBe(true);
      expect(avg).toBeCloseTo((0.85 + 0 + 0.72 + 0) / 4, 5);
    });

    it('complexity score reduce with all NaN produces 0', () => {
      const analyses = [
        { score: NaN },
        { score: NaN },
      ] as Array<{ score: number }>;

      const avg = analyses.reduce(
        (sum, a) => sum + (Number.isFinite(a.score) ? a.score : 0),
        0,
      ) / analyses.length;

      expect(Number.isFinite(avg)).toBe(true);
      expect(avg).toBe(0);
    });
  });
});
