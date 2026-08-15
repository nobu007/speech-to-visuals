/**
 * Round 25 single-source guard: quality-gate threshold BARS at consumer sites.
 *
 * Round 7 single-sourced the quality-gate threshold DEFAULTS
 * (src/framework/quality-thresholds.ts) and banned the `KEY: VALUE`
 * declaration shape — but guards go stale by SHAPE. The comparison sites
 * kept re-freezing the same bars as bare literals:
 *
 *   - src/pipeline/improvement-detector.ts — reads QualityMonitor metrics
 *     (the very monitor whose canonical table delegates to
 *     quality-thresholds) yet re-froze FIVE bars: `processingTime > 30000`,
 *     `memoryUsage > 512`, `edgeCompleteness < 0.7`,
 *     `relationshipAccuracy < 0.85`, `layoutOverlap > 0`, plus the
 *     evidence-string / targetValue echoes of 30000/512/85%.
 *   - src/quality/adaptive-quality-gates.ts — `threshold: 0.85` for the
 *     transcription-accuracy gate.
 *   - src/framework/recursive-custom-instructions.ts:310 —
 *     `testResults.transcription?.accuracy < 0.85` (the constant was already
 *     imported; the line just never used it).
 *   - src/pipeline/main-pipeline.ts:274/281 — `minAccuracy: 0.85` /
 *     `minAccuracy: 0.75` stage gates (transcription accuracy / scene
 *     segmentation F1).
 *   - src/framework/continuous-learner.ts:863 — `processingTime > 30000`
 *     anomaly bar.
 *
 * This file pins (a) the canonical values (numeric delta vs the historic
 * literals — zero), (b) consumer delegation at exact bar boundaries
 * (behavioral equivalence oracle), and (c) source anchors that every
 * migrated site references the canonical identifiers. The discovery sweep
 * ("no src file re-freezes the bar in comparison shape") lives in
 * tests/guards/frozen-literal-rules.ts, rule
 * 'quality-gate threshold bars single-sourced in quality-thresholds (round 25)'.
 */

import { describe, it, expect } from '@jest/globals';
import { readSource } from '@tests/guards/freeze-guard';
import {
  DEFAULT_TRANSCRIPTION_ACCURACY_THRESHOLD,
  DEFAULT_SCENE_SEGMENTATION_F1_THRESHOLD,
  DEFAULT_RELATION_ACCURACY_THRESHOLD,
  DEFAULT_LAYOUT_OVERLAP_THRESHOLD,
  DEFAULT_EDGE_COMPLETENESS_THRESHOLD,
  DEFAULT_RENDER_TIME_THRESHOLD_MS,
  DEFAULT_MEMORY_USAGE_THRESHOLD_MB,
  DEFAULT_MEMORY_USAGE_THRESHOLD_BYTES,
} from '@/framework/quality-thresholds';
import { ImprovementDetector } from '@/pipeline/improvement-detector';
import type {
  QualityMetrics,
  QualityReport,
} from '@/pipeline/quality-monitor';

// ---------------------------------------------------------------------------
// Mock QualityMonitor (same shape as tests/pipeline/improvement-detector.test.ts)
// ---------------------------------------------------------------------------

function makeMetrics(overrides: Partial<QualityMetrics> = {}): QualityMetrics {
  return {
    timestamp: new Date(),
    phase: 'test',
    iteration: 1,
    processingTime: 5000,
    memoryUsage: 256,
    layoutOverlap: 0,
    errorCount: 0,
    warningCount: 0,
    fallbackTriggered: false,
    ...overrides,
  };
}

function createMockMonitor(metrics: QualityMetrics) {
  return {
    getLatestMetrics: jest.fn().mockReturnValue(metrics),
    generateReport: jest.fn().mockReturnValue({
      overallScore: 90,
      status: 'good',
      metrics,
      thresholds: {},
      violations: [],
      recommendations: [],
      improvementPotential: 10,
    } as unknown as QualityReport),
    compareToBaseline: jest.fn().mockReturnValue({
      improved: [],
      regressed: [],
      stable: [],
    }),
  };
}

/** Opportunities for one area under the given metrics. */
function areas(metrics: Partial<QualityMetrics>): string[] {
  const monitor = createMockMonitor(makeMetrics(metrics));
  const detector = new ImprovementDetector(monitor as never);
  return detector.generateReport().opportunities.map(o => o.area);
}

describe('quality-gate threshold bars single source (round 25)', () => {
  describe('canonical values equal the historic literals (numeric delta: 0)', () => {
    it('pins every migrated bar to its pre-round-25 value', () => {
      expect(DEFAULT_TRANSCRIPTION_ACCURACY_THRESHOLD).toBe(0.85);
      expect(DEFAULT_SCENE_SEGMENTATION_F1_THRESHOLD).toBe(0.75);
      expect(DEFAULT_RELATION_ACCURACY_THRESHOLD).toBe(0.85);
      expect(DEFAULT_LAYOUT_OVERLAP_THRESHOLD).toBe(0);
      expect(DEFAULT_EDGE_COMPLETENESS_THRESHOLD).toBe(0.7);
      expect(DEFAULT_RENDER_TIME_THRESHOLD_MS).toBe(30000);
      expect(DEFAULT_MEMORY_USAGE_THRESHOLD_MB).toBe(512);
      expect(DEFAULT_MEMORY_USAGE_THRESHOLD_BYTES).toBe(512 * 1024 * 1024);
    });
  });

  describe('delegated comparisons equal the old literals at exact bar boundaries', () => {
    it('processingTime: AT the render-time bar is clean, +1ms trips it', () => {
      expect(areas({ processingTime: DEFAULT_RENDER_TIME_THRESHOLD_MS }))
        .not.toContain('Processing Speed');
      expect(areas({ processingTime: DEFAULT_RENDER_TIME_THRESHOLD_MS + 1 }))
        .toContain('Processing Speed');
    });

    it('memoryUsage: AT the memory bar is clean, +1MB trips it', () => {
      expect(areas({ memoryUsage: DEFAULT_MEMORY_USAGE_THRESHOLD_MB }))
        .not.toContain('Memory Optimization');
      expect(areas({ memoryUsage: DEFAULT_MEMORY_USAGE_THRESHOLD_MB + 1 }))
        .toContain('Memory Optimization');
    });

    it('edgeCompleteness: AT the bar is clean, ε below trips it', () => {
      expect(areas({ edgeCompleteness: DEFAULT_EDGE_COMPLETENESS_THRESHOLD }))
        .not.toContain('Relationship Extraction');
      expect(areas({ edgeCompleteness: DEFAULT_EDGE_COMPLETENESS_THRESHOLD - 1e-9 }))
        .toContain('Relationship Extraction');
    });

    it('relationshipAccuracy: AT the bar is clean, ε below trips it', () => {
      expect(areas({ relationshipAccuracy: DEFAULT_RELATION_ACCURACY_THRESHOLD }))
        .not.toContain('Relationship Accuracy');
      expect(areas({ relationshipAccuracy: DEFAULT_RELATION_ACCURACY_THRESHOLD - 1e-9 }))
        .toContain('Relationship Accuracy');
    });

    it('layoutOverlap: AT the disable sentinel is clean, 1 overlap is critical', () => {
      expect(areas({ layoutOverlap: DEFAULT_LAYOUT_OVERLAP_THRESHOLD }))
        .not.toContain('Layout Quality');
      expect(areas({ layoutOverlap: 1 })).toContain('Layout Quality');
    });
  });

  describe('source anchors: every migrated site references the canonical identifiers', () => {
    it('improvement-detector delegates all five bars (and their echoes)', () => {
      const src = readSource('src/pipeline/improvement-detector.ts');
      expect(src).toContain('DEFAULT_RENDER_TIME_THRESHOLD_MS');
      expect(src).toContain('DEFAULT_MEMORY_USAGE_THRESHOLD_MB');
      expect(src).toContain('DEFAULT_EDGE_COMPLETENESS_THRESHOLD');
      expect(src).toContain('DEFAULT_RELATION_ACCURACY_THRESHOLD');
      expect(src).toContain('DEFAULT_LAYOUT_OVERLAP_THRESHOLD');
      // …and no longer re-freezes the bars as literals.
      expect(src).not.toMatch(/processingTime\s*>\s*30000\b/);
      expect(src).not.toMatch(/memoryUsage\s*>\s*512\b/);
      expect(src).not.toMatch(/edgeCompleteness\s*<\s*0\.7\b/);
      expect(src).not.toMatch(/relationshipAccuracy\s*<\s*0\.85\b/);
      expect(src).not.toMatch(/layoutOverlap\s*>\s*0\b/);
      expect(src).not.toMatch(/targetValue:\s*512\b/);
      expect(src).not.toMatch(/Target: <30000ms/);
      expect(src).not.toMatch(/Target: <512MB/);
      expect(src).not.toMatch(/Target: >85%/);
    });

    it('adaptive-quality-gates derives the transcription gate from the constant', () => {
      const src = readSource('src/quality/adaptive-quality-gates.ts');
      expect(src).toContain('DEFAULT_TRANSCRIPTION_ACCURACY_THRESHOLD');
      expect(src).not.toMatch(/threshold:\s*0\.85\b/);
    });

    it('recursive-custom-instructions uses its imported transcription constant', () => {
      const src = readSource('src/framework/recursive-custom-instructions.ts');
      expect(src).toMatch(/accuracy\s*<\s*DEFAULT_TRANSCRIPTION_ACCURACY_THRESHOLD/);
      expect(src).not.toMatch(/accuracy\s*<\s*0\.85\b/);
    });

    it('main-pipeline stage gates use the accuracy/F1 constants', () => {
      const src = readSource('src/pipeline/main-pipeline.ts');
      expect(src).toMatch(/minAccuracy:\s*DEFAULT_TRANSCRIPTION_ACCURACY_THRESHOLD/);
      expect(src).toMatch(/minAccuracy:\s*DEFAULT_SCENE_SEGMENTATION_F1_THRESHOLD/);
      expect(src).not.toMatch(/minAccuracy:\s*0\.85\b/);
      expect(src).not.toMatch(/minAccuracy:\s*0\.75\b/);
    });

    it('continuous-learner anomaly bar uses the render-time constant', () => {
      const src = readSource('src/framework/continuous-learner.ts');
      expect(src).toMatch(/processingTime\s*>\s*DEFAULT_RENDER_TIME_THRESHOLD_MS/);
      expect(src).not.toMatch(/processingTime\s*>\s*30000\b/);
    });
  });
});
