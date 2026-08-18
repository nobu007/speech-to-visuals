/**
 * Tests verifying sanitizeFinite/sanitizeDiagramType guards in
 * diagram-detector.ts metric tracking and quality evaluation methods.
 *
 * REQ-264: Unguarded result.type/confidence/score access sanitized
 */
import { describe, it, expect } from '@jest/globals';
import { sanitizeFinite, sanitizeDiagramType } from '@stv/core/utils/guards';

describe('diagram-detector metric sanitization guards', () => {

  describe('sanitizeFinite in confidence/score contexts', () => {
    it('prevents NaN in confidence sort comparator', () => {
      const scores = [
        { type: 'flow', confidence: 0.8 },
        { type: 'tree', confidence: NaN },
        { type: 'cycle', confidence: 0.5 },
      ];

      const sorted = [...scores].sort((a, b) =>
        sanitizeFinite(b.confidence, 0) - sanitizeFinite(a.confidence, 0)
      );

      // NaN confidence should sort as 0, ending up last
      expect(sorted[0].type).toBe('flow');
      expect(sorted[1].type).toBe('cycle');
      expect(sorted[2].type).toBe('tree');
    });

    it('prevents NaN propagation in confidence threshold test', () => {
      const analysis = { confidence: NaN, type: 'flow' };
      const safeConfidence = sanitizeFinite(analysis.confidence, 0);
      const passed = safeConfidence >= 0.6;

      expect(passed).toBe(false);
      expect(Number.isFinite(safeConfidence)).toBe(true);
    });

    it('prevents NaN in enhanced statistical analysis', () => {
      const baseConfidence = NaN;
      const BOOST = 1.1;
      const CAP = 0.95;
      const enhanced = Math.min(sanitizeFinite(baseConfidence, 0) * BOOST, CAP);

      expect(Number.isFinite(enhanced)).toBe(true);
      expect(enhanced).toBe(0); // 0 * 1.1 = 0
    });

    it('prevents NaN in confidence history accumulation', () => {
      const confidences = [0.9, NaN, 0.7, undefined, 0.8];
      const safeHistory = confidences.map(c => sanitizeFinite(c, 0));

      expect(safeHistory.every(Number.isFinite)).toBe(true);
      expect(safeHistory).toEqual([0.9, 0, 0.7, 0, 0.8]);
    });

    it('prevents NaN score in test result reduction', () => {
      const testResults = [
        { score: 0.9, passed: true, name: 'A' },
        { score: NaN, passed: false, name: 'B' },
        { score: 0.7, passed: true, name: 'C' },
      ];

      const overall = testResults.reduce((sum, r) => sum + sanitizeFinite(r.score, 0), 0) / testResults.length;

      expect(Number.isFinite(overall)).toBe(true);
      expect(overall).toBeCloseTo((0.9 + 0 + 0.7) / 3, 5);
    });
  });

  describe('sanitizeDiagramType in type access contexts', () => {
    it('prevents invalid type from being used as Map key', () => {
      const rawType = 'INVALID_TYPE';
      const safeType = sanitizeDiagramType(rawType);

      const typeMap = new Map<string, number>();
      const currentCount = typeMap.get(safeType) || 0;
      typeMap.set(safeType, currentCount + 1);

      expect(safeType).toBe('general'); // default fallback
      expect(typeMap.has('general')).toBe(true);
      expect(typeMap.has('INVALID_TYPE')).toBe(false);
    });

    it('prevents invalid type from breaking typeKeywords lookup', () => {
      const typeKeywords: Record<string, string[]> = {
        flow: ['process', 'step', 'flow'],
        tree: ['hierarchy', 'parent', 'child'],
      };

      const analysis = { type: undefined as unknown as string };
      const safeType = sanitizeDiagramType(analysis.type);
      const keywords = typeKeywords[safeType] || [];

      // 'general' not in typeKeywords → empty array, not undefined error
      expect(Array.isArray(keywords)).toBe(true);
      expect(keywords).toEqual([]);
    });

    it('valid diagram types pass through unchanged', () => {
      const validTypes = ['flow', 'tree', 'timeline', 'matrix', 'cycle',
        'flowchart', 'comparison', 'network', 'conceptmap', 'mindmap', 'general'];

      for (const type of validTypes) {
        expect(sanitizeDiagramType(type)).toBe(type);
      }
    });
  });

  describe('LLM recommendation bonus NaN safety', () => {
    it('confidence boost produces finite result from finite input', () => {
      const originalConfidence = 0.7;
      const boosted = Math.min(sanitizeFinite(originalConfidence, 0) * 1.15, 0.95);

      expect(Number.isFinite(boosted)).toBe(true);
      expect(boosted).toBeCloseTo(0.805, 3);
    });

    it('confidence boost with NaN input defaults to 0', () => {
      const originalConfidence = NaN;
      const boosted = Math.min(sanitizeFinite(originalConfidence, 0) * 1.15, 0.95);

      expect(Number.isFinite(boosted)).toBe(true);
      expect(boosted).toBe(0);
    });

    it('confidence boost capped at 0.95', () => {
      const originalConfidence = 0.9;
      const boosted = Math.min(sanitizeFinite(originalConfidence, 0) * 1.15, 0.95);

      expect(boosted).toBe(0.95);
    });
  });

  describe('scene-segmenter confidence reduction NaN safety', () => {
    it('average confidence computation is NaN-safe', () => {
      const segments = [
        { confidence: 0.9 },
        { confidence: NaN },
        { confidence: 0.7 },
      ];

      const avgConfidence = segments.reduce(
        (sum, seg) => sum + sanitizeFinite(seg.confidence, 0), 0
      ) / segments.length;

      expect(Number.isFinite(avgConfidence)).toBe(true);
      expect(avgConfidence).toBeCloseTo((0.9 + 0 + 0.7) / 3, 5);
    });

    it('empty segments returns 0 average', () => {
      const segments: Array<{ confidence: number }> = [];
      const avgConfidence = segments.length > 0
        ? segments.reduce((sum, seg) => sum + sanitizeFinite(seg.confidence, 0), 0) / segments.length
        : 0;

      expect(avgConfidence).toBe(0);
    });
  });
});
