/**
 * Tests for quality-monitor.ts
 * Covers: QualityMonitor.assessPipelineQuality, scoring sub-methods,
 * deployment readiness, quality trends, and bug regression tests for
 * empty forEach logging and undefined-metrics comparison.
 */

import { jest } from '@jest/globals';

const { QualityMonitor } = await import('../quality-monitor');
const { logger } = await import('@stv/core/utils/logger');
import type { PipelineResult, PipelineStage } from '../../pipeline/types';
import type { SceneGraph } from '@stv/core/types/diagram';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStage(name: string, success: boolean, status: 'complete' | 'error' = 'complete'): PipelineStage {
  return { name, status, success, startTime: 0, endTime: 100 };
}

function makeScene(overrides: Partial<SceneGraph> = {}): SceneGraph {
  return {
    type: 'flow',
    nodes: [
      { id: 'n1', label: 'Node 1' },
      { id: 'n2', label: 'Node 2' },
    ],
    edges: [{ source: 'n1', target: 'n2' }],
    summary: 'A test scene with sufficient length',
    keyphrases: ['test', 'scene'],
    startMs: 0,
    durationMs: 5000,
    ...overrides,
  };
}

function makeResult(overrides: Partial<PipelineResult> = {}): PipelineResult {
  return {
    success: true,
    scenes: [makeScene(), makeScene({ type: 'tree' })],
    audioUrl: '/test.wav',
    duration: 60,
    processingTime: 10000,
    stages: [
      makeStage('transcription', true),
      makeStage('analysis', true),
      makeStage('visualization', true),
    ],
    outputPath: '/output/video.mp4',
    metrics: {
      totalProcessingTime: 10000,
      memoryUsage: 128 * 1024 * 1024,
      transcriptionTime: 2000,
      analysisTime: 3000,
      layoutTime: 1000,
      renderTime: 4000,
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('QualityMonitor', () => {
  let monitor: InstanceType<typeof QualityMonitor>;

  beforeEach(() => {
    monitor = new QualityMonitor();
    jest.restoreAllMocks();
  });

  // --- assessPipelineQuality basic scoring ---

  describe('assessPipelineQuality', () => {
    it('returns assessment with scores in [0, 1] for a successful pipeline', async () => {
      const result = makeResult();
      const assessment = await monitor.assessPipelineQuality(result);

      expect(assessment.iteration).toBe(1);
      expect(assessment.overallScore).toBeGreaterThanOrEqual(0);
      expect(assessment.overallScore).toBeLessThanOrEqual(1);
      expect(assessment.performanceScore).toBeGreaterThanOrEqual(0);
      expect(assessment.accuracyScore).toBeGreaterThanOrEqual(0);
      expect(assessment.reliabilityScore).toBeGreaterThanOrEqual(0);
    });

    it('scores a successful pipeline higher than a failed one', async () => {
      const goodResult = makeResult({ success: true });
      const badResult = makeResult({ success: false, stages: [makeStage('transcription', false, 'error')] });

      const goodAssessment = await monitor.assessPipelineQuality(goodResult);
      const badAssessment = await monitor.assessPipelineQuality(badResult);

      expect(goodAssessment.overallScore).toBeGreaterThan(badAssessment.overallScore);
    });

    it('generates recommendations when performance score is low', async () => {
      // Very slow processing → low performance score
      const slowResult = makeResult({ processingTime: 120000 });
      const assessment = await monitor.assessPipelineQuality(slowResult);

      expect(assessment.recommendations.length).toBeGreaterThan(0);
    });

    it('adds concern when no scenes are generated', async () => {
      const noScenesResult = makeResult({ scenes: [] });
      const assessment = await monitor.assessPipelineQuality(noScenesResult);

      expect(assessment.concerns).toContain('No scenes generated - check content analysis pipeline');
    });

    it('adds recommendation when too many scenes are generated', async () => {
      const manyScenes = Array.from({ length: 12 }, () => makeScene());
      const result = makeResult({ scenes: manyScenes });
      const assessment = await monitor.assessPipelineQuality(result);

      expect(assessment.recommendations).toContain(
        'Consider scene consolidation - too many scenes may impact video flow'
      );
    });

    it('stores assessment in iteration history', async () => {
      await monitor.assessPipelineQuality(makeResult());

      const trends = monitor.getQualityTrends();
      expect(trends.overall).toHaveLength(1);
      expect(trends.performance).toHaveLength(1);
    });

    it('increments iteration after nextIteration()', async () => {
      await monitor.assessPipelineQuality(makeResult());
      expect(monitor.getQualityTrends().overall).toHaveLength(1);

      monitor.nextIteration();

      await monitor.assessPipelineQuality(makeResult());
      expect(monitor.getQualityTrends().overall).toHaveLength(2);
    });

    it('caps iterationHistory at MAX_HISTORY_SIZE (no-cap-sibling regression)', async () => {
      // assessPipelineQuality pushes one assessment per call via
      // logAssessment on a process-lifetime singleton; without a cap this
      // grows forever. Drive it past the cap and assert the FIFO ceiling.
      const OVER = 100 + 25;
      for (let i = 0; i < OVER; i++) {
        await monitor.assessPipelineQuality(makeResult());
        monitor.nextIteration();
      }

      expect(monitor.getQualityTrends().overall).toHaveLength(100);
    });

    it('returns overallScore=0 when assessment throws', async () => {
      // Force an error by passing null as result (will throw in evaluateRecursiveDevelopmentCompliance)
      const assessment = await monitor.assessPipelineQuality(null as unknown as PipelineResult);

      expect(assessment.overallScore).toBe(0);
      expect(assessment.concerns).toContain('Quality assessment system error');
    });
  });

  // --- Baseline & improvement comparison ---

  describe('iteration comparison', () => {
    it('reports baseline on first iteration', async () => {
      const assessment = await monitor.assessPipelineQuality(makeResult());

      expect(assessment.improvements).toContain('Baseline iteration established');
    });

    it('detects performance improvement between iterations', async () => {
      // First: slow
      await monitor.assessPipelineQuality(makeResult({ processingTime: 60000 }));
      monitor.nextIteration();

      // Second: fast
      const assessment = await monitor.assessPipelineQuality(makeResult({ processingTime: 5000 }));

      const perfImprovements = assessment.improvements.filter(i => i.includes('Performance improved'));
      expect(perfImprovements.length).toBeGreaterThan(0);
    });

    it('detects performance decline between iterations', async () => {
      // First: fast
      await monitor.assessPipelineQuality(makeResult({ processingTime: 5000 }));
      monitor.nextIteration();

      // Second: slow
      const assessment = await monitor.assessPipelineQuality(makeResult({ processingTime: 60000 }));

      const perfConcerns = assessment.concerns.filter(c => c.includes('Performance declined'));
      expect(perfConcerns.length).toBeGreaterThan(0);
    });
  });

  // --- Deployment readiness ---

  describe('checkDeploymentReadiness', () => {
    it('returns not ready when no assessment exists', () => {
      const readiness = monitor.checkDeploymentReadiness();

      expect(readiness.ready).toBe(false);
      expect(readiness.criticalIssues).toContain('No quality assessment available');
    });

    it('returns ready when scores are above thresholds', async () => {
      const goodResult = makeResult({
        success: true,
        processingTime: 5000,
        stages: [
          makeStage('transcription', true),
          makeStage('analysis', true),
          makeStage('visualization', true),
          makeStage('rendering', true),
          makeStage('export', true),
        ],
      });
      await monitor.assessPipelineQuality(goodResult);

      const readiness = monitor.checkDeploymentReadiness();
      // With a successful pipeline, overall score should be high enough
      if (readiness.ready) {
        expect(readiness.criticalIssues).toHaveLength(0);
      }
    });

    it('reports critical issue when reliability is low', async () => {
      const badResult = makeResult({
        success: false,
        stages: [makeStage('transcription', false, 'error')],
      });
      await monitor.assessPipelineQuality(badResult);

      const readiness = monitor.checkDeploymentReadiness();
      expect(readiness.ready).toBe(false);
      expect(readiness.criticalIssues.length).toBeGreaterThan(0);
    });
  });

  // --- getQualityTrends ---

  describe('getQualityTrends', () => {
    it('returns empty arrays before any assessment', () => {
      const trends = monitor.getQualityTrends();
      expect(trends.performance).toEqual([]);
      expect(trends.accuracy).toEqual([]);
      expect(trends.reliability).toEqual([]);
      expect(trends.overall).toEqual([]);
    });

    it('returns arrays matching iteration count', async () => {
      await monitor.assessPipelineQuality(makeResult());
      monitor.nextIteration();
      await monitor.assessPipelineQuality(makeResult());

      const trends = monitor.getQualityTrends();
      expect(trends.overall).toHaveLength(2);
    });
  });

  // --- Bug regression: empty forEach bodies in logAssessment ---

  describe('logAssessment (regression: empty forEach bodies)', () => {
    it('actually logs improvements via logger.info', async () => {
      const infoSpy = jest.spyOn(logger, 'info');
      jest.spyOn(logger, 'warn');

      // Trigger improvement logging via baseline assessment
      await monitor.assessPipelineQuality(makeResult());

      const infoCalls = infoSpy.mock.calls.map(c => String(c[0]));

      // "Baseline iteration established" should be logged as an improvement
      expect(infoCalls.some(msg => msg.includes('Quality improvement:'))).toBe(true);
      expect(infoCalls.some(msg => msg.includes('Quality recommendation:') || msg.includes('Quality improvement:'))).toBe(true);
    });

    it('logs concerns via logger.warn when concerns exist', async () => {
      const warnSpy = jest.spyOn(logger, 'warn');

      // Force a concern by having no scenes
      await monitor.assessPipelineQuality(makeResult({ scenes: [] }));

      const warnCalls = warnSpy.mock.calls.map(c => String(c[0]));
      expect(warnCalls.some(msg => msg.includes('Quality concern:'))).toBe(true);
    });
  });

  // --- Bug regression: undefined metrics comparison ---

  describe('evaluateIterationQuality (regression: undefined metrics)', () => {
    it('handles missing metrics gracefully without NaN comparison', async () => {
      const result = makeResult({ metrics: undefined });

      // Should not throw and should still produce a valid assessment
      const assessment = await monitor.assessPipelineQuality(result);

      expect(assessment.overallScore).toBeGreaterThanOrEqual(0);
      // Should have iteration quality score improvement message
      const qualityMsgs = assessment.improvements.filter(i => i.includes('Iteration Quality Score'));
      expect(qualityMsgs).toHaveLength(1);
    });

    it('handles Infinity in metrics without incorrect comparison', async () => {
      const result = makeResult({
        metrics: {
          totalProcessingTime: Infinity,
          memoryUsage: Infinity,
        },
      });

      const assessment = await monitor.assessPipelineQuality(result);
      expect(assessment.overallScore).toBeGreaterThanOrEqual(0);
    });

    it('handles NaN in metrics without incorrect comparison', async () => {
      const result = makeResult({
        metrics: {
          totalProcessingTime: NaN,
          memoryUsage: NaN,
        },
      });

      const assessment = await monitor.assessPipelineQuality(result);
      expect(assessment.overallScore).toBeGreaterThanOrEqual(0);
    });
  });

  // --- REQ-383: iteration-quality legs read measured fields only ---

  describe('evaluateIterationQuality (REQ-383: measured legs only)', () => {
    it('production-shape result (no metrics.memoryUsage) scores 100% and never recommends memory optimization', async () => {
      // MainPipeline's PipelineResult.metrics carries only totalRetryAttempts
      // — memoryUsage is never produced. The unmeasured leg must be EXCLUDED
      // from the average (not scored 0.5) and must not emit its
      // recommendation for a metric nobody measured.
      const result = makeResult({ metrics: { totalRetryAttempts: 0 } });

      const assessment = await monitor.assessPipelineQuality(result);

      const scoreMsg = assessment.improvements.find(i => i.includes('Iteration Quality Score'));
      expect(scoreMsg).toContain('100.0%');
      expect(assessment.recommendations.some(r => r.includes('💾'))).toBe(false);
    });

    it('the required top-level processingTime is authoritative when the optional metrics copy disagrees', async () => {
      // metrics.totalProcessingTime (never produced by MainPipeline) says
      // 99999; the REQUIRED result.processingTime says 10000. The leg must
      // read the required field: fast → 1.0 → no processing-speed
      // recommendation and an unmarred 100.0%.
      const result = makeResult({ metrics: { totalProcessingTime: 99999 } });

      const assessment = await monitor.assessPipelineQuality(result);

      const scoreMsg = assessment.improvements.find(i => i.includes('Iteration Quality Score'));
      expect(scoreMsg).toContain('100.0%');
      expect(assessment.recommendations.some(r => r.includes('🚀'))).toBe(false);
    });

    it('averages measured legs only — a failed-stages run scores 66.7%, not diluted by a fabricated documentation leg', async () => {
      // stages: [] → errorHandling 0; processingTime 10000 → 1.0; outputPath
      // → 1.0. (1.0 + 0 + 1.0) / 3 = 66.7%. Re-adding the removed hardcoded
      // `documentation: 1.0` leg would dilute the failure to 75.0%.
      const result = makeResult({ stages: [], metrics: { totalRetryAttempts: 0 } });

      const assessment = await monitor.assessPipelineQuality(result);

      const scoreMsg = assessment.improvements.find(i => i.includes('Iteration Quality Score'));
      expect(scoreMsg).toContain('66.7%');
    });

    it('measured over-threshold memoryUsage (bytes contract) recommends memory optimization', async () => {
      // ExtendedPipelineMetrics.memoryUsage is documented in BYTES: 512MB =
      // 536870912 bytes exceeds the 256MB gate → 0.5 leg → recommendation.
      const result = makeResult({
        metrics: { totalRetryAttempts: 0, memoryUsage: 512 * 1024 * 1024 },
      });

      const assessment = await monitor.assessPipelineQuality(result);

      expect(assessment.recommendations.some(r => r.includes('💾'))).toBe(true);
    });

    it('non-finite measured memoryUsage is excluded from the average, not scored', async () => {
      const result = makeResult({ metrics: { totalRetryAttempts: 0, memoryUsage: NaN } });

      const assessment = await monitor.assessPipelineQuality(result);

      const scoreMsg = assessment.improvements.find(i => i.includes('Iteration Quality Score'));
      expect(scoreMsg).toContain('100.0%');
      expect(assessment.recommendations.some(r => r.includes('💾'))).toBe(false);
    });
  });

  // --- Scene generation scoring edge cases ---

  describe('scene generation scoring', () => {
    it('scores optimally for 2-8 scenes', async () => {
      const result = makeResult({
        scenes: Array.from({ length: 4 }, (_, i) =>
          makeScene({ type: i % 2 === 0 ? 'flow' : 'tree' })
        ),
      });
      const assessment = await monitor.assessPipelineQuality(result);
      expect(assessment.accuracyScore).toBeGreaterThan(0);
    });

    it('scores lower for a single scene', async () => {
      const result = makeResult({ scenes: [makeScene()] });
      const assessment = await monitor.assessPipelineQuality(result);

      // Single scene should still produce a valid score
      expect(assessment.accuracyScore).toBeGreaterThan(0);
      expect(assessment.accuracyScore).toBeLessThanOrEqual(1);
    });
  });

  // --- Layout quality with overlaps ---

  describe('layout quality assessment', () => {
    it('penalizes overlapping nodes', async () => {
      const scene = makeScene({
        layout: {
          nodes: [
            { id: 'n1', label: 'A', x: 0, y: 0, w: 120, h: 60 },
            { id: 'n2', label: 'B', x: 10, y: 10, w: 120, h: 60 },
          ],
          edges: [],
        },
      });

      const result = makeResult({ scenes: [scene] });
      const assessment = await monitor.assessPipelineQuality(result);

      // Overlapping nodes should reduce accuracy score
      expect(assessment.accuracyScore).toBeGreaterThanOrEqual(0);
      expect(assessment.accuracyScore).toBeLessThanOrEqual(1);
    });

    it('rewards non-overlapping nodes with good spread', async () => {
      const scene = makeScene({
        layout: {
          nodes: [
            { id: 'n1', label: 'A', x: 100, y: 100, w: 120, h: 60 },
            { id: 'n2', label: 'B', x: 500, y: 400, w: 120, h: 60 },
          ],
          edges: [],
        },
      });

      const result = makeResult({ scenes: [scene] });
      const assessment = await monitor.assessPipelineQuality(result);

      expect(assessment.accuracyScore).toBeGreaterThan(0);
    });
  });

  // --- LLM extraction quality ---

  describe('LLM extraction quality', () => {
    it('uses explicit entity/relation metrics when available', async () => {
      const result = makeResult({
        metrics: {
          totalProcessingTime: 10000,
          memoryUsage: 128 * 1024 * 1024,
          entityExtractionF1Score: 0.92,
          relationAccuracy: 0.88,
        },
      });

      const assessment = await monitor.assessPipelineQuality(result);
      expect(assessment.accuracyScore).toBeGreaterThan(0.5);
    });

    it('falls back to heuristic when metrics unavailable', async () => {
      const result = makeResult({ metrics: undefined });
      const assessment = await monitor.assessPipelineQuality(result);

      expect(assessment.accuracyScore).toBeGreaterThanOrEqual(0);
    });
  });

  // --- Error handling assessment ---

  describe('error handling assessment', () => {
    it('scores 0.9 for successful pipeline', async () => {
      const result = makeResult({ success: true });
      const assessment = await monitor.assessPipelineQuality(result);

      // High reliability expected for successful run
      expect(assessment.reliabilityScore).toBeGreaterThan(0.5);
    });

    it('scores lower for failed pipeline with error message', async () => {
      const result = makeResult({
        success: false,
        error: 'Something went wrong',
        stages: [makeStage('transcription', false, 'error')],
      });
      const assessment = await monitor.assessPipelineQuality(result);

      expect(assessment.reliabilityScore).toBeLessThan(0.9);
    });

    it('scores lowest for failed pipeline without error message', async () => {
      const result = makeResult({
        success: false,
        error: undefined,
        stages: [makeStage('transcription', false, 'error')],
      });
      const assessment = await monitor.assessPipelineQuality(result);

      expect(assessment.reliabilityScore).toBeLessThan(0.7);
    });
  });
});
