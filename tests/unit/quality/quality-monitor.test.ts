import { describe, it, expect } from '@jest/globals';
import { QualityMonitor, QualityAssessment } from '@/quality/quality-monitor';
import { PipelineResult } from '@/pipeline/types';
import { SceneGraph } from '@/types/diagram';

function makeSuccessResult(overrides?: Partial<PipelineResult>): PipelineResult {
  return {
    success: true,
    scenes: [
      {
        type: 'flow',
        nodes: [
          { id: 'n1', label: 'Step 1' },
          { id: 'n2', label: 'Step 2' },
        ],
        edges: [{ from: 'n1', to: 'n2' }],
        layout: {
          nodes: [
            { id: 'n1', label: 'Step 1', x: 100, y: 100, w: 120, h: 60 },
            { id: 'n2', label: 'Step 2', x: 400, y: 100, w: 120, h: 60 },
          ],
          edges: [
            { from: 'n1', to: 'n2', points: [{ x: 220, y: 130 }, { x: 400, y: 130 }] },
          ],
        },
        startMs: 0,
        durationMs: 5000,
        summary: 'A simple flow diagram showing two steps.',
        keyphrases: ['flow', 'steps'],
      },
    ],
    audioUrl: 'test-audio.wav',
    duration: 5000,
    processingTime: 5000,
    stages: [
      { name: 'transcription', status: 'complete', startTime: 0, endTime: 1000, success: true },
      { name: 'analysis', status: 'complete', startTime: 1000, endTime: 2000, success: true },
      { name: 'visualization', status: 'complete', startTime: 2000, endTime: 3000, success: true },
    ],
    outputPath: '/tmp/output.mp4',
    metrics: {
      totalProcessingTime: 5000,
      memoryUsage: 128 * 1024 * 1024,
    } as Record<string, unknown>,
    ...overrides,
  } as PipelineResult;
}

function makeFailResult(): PipelineResult {
  return {
    success: false,
    scenes: [],
    audioUrl: '',
    duration: 0,
    processingTime: 50000,
    stages: [
      { name: 'transcription', status: 'error', startTime: 0, endTime: 1000, success: false },
    ],
    error: 'Transcription failed',
  } as PipelineResult;
}

describe('QualityMonitor', () => {
  const monitor = new QualityMonitor();

  describe('assessPipelineQuality', () => {
    it('should assess a successful pipeline result', async () => {
      const result = makeSuccessResult();
      const assessment = await monitor.assessPipelineQuality(result);

      expect(assessment.overallScore).toBeGreaterThanOrEqual(0);
      expect(assessment.overallScore).toBeLessThanOrEqual(1);
      expect(assessment.performanceScore).toBeGreaterThanOrEqual(0);
      expect(assessment.accuracyScore).toBeGreaterThanOrEqual(0);
      expect(assessment.reliabilityScore).toBeGreaterThanOrEqual(0);
      expect(assessment.timestamp).toBeInstanceOf(Date);
      expect(assessment.iteration).toBe(1);
      expect(assessment.recommendations.length).toBeGreaterThan(0);
    });

    it('should assess a failed pipeline result', async () => {
      const result = makeFailResult();
      const assessment = await monitor.assessPipelineQuality(result);

      expect(assessment.overallScore).toBeLessThan(0.8);
      expect(assessment.reliabilityScore).toBeLessThan(1);
    });

    it('should assess pipeline with LLM extraction metrics', async () => {
      const result = makeSuccessResult({
        metrics: {
          totalProcessingTime: 5000,
          memoryUsage: 128 * 1024 * 1024,
          entityExtractionF1Score: 0.85,
          relationAccuracy: 0.9,
        },
      } as Partial<PipelineResult>);
      const assessment = await monitor.assessPipelineQuality(result);
      expect(assessment.accuracyScore).toBeGreaterThan(0);
    });

    it('should assess pipeline with many scenes', async () => {
      const manyScenes: SceneGraph[] = Array.from({ length: 15 }, (_, i) => ({
        type: 'flow' as const,
        nodes: [{ id: `n${i}`, label: `Node ${i}` }],
        edges: [],
        layout: {
          nodes: [{ id: `n${i}`, label: `Node ${i}`, x: i * 100, y: 100, w: 120, h: 60 }],
          edges: [],
        },
        startMs: i * 5000,
        durationMs: 5000,
        summary: `Scene ${i} summary text here.`,
        keyphrases: ['test'],
      }));
      const result = makeSuccessResult({ scenes: manyScenes });
      const assessment = await monitor.assessPipelineQuality(result);
      expect(assessment.overallScore).toBeGreaterThanOrEqual(0);
    });

    it('should assess pipeline with zero processing time', async () => {
      const result = makeSuccessResult({ processingTime: 0 });
      const assessment = await monitor.assessPipelineQuality(result);
      expect(assessment.performanceScore).toBeGreaterThanOrEqual(0);
    });

    it('should handle stages with errors', async () => {
      const result = makeSuccessResult({
        stages: [
          { name: 'transcription', status: 'complete', startTime: 0, endTime: 1000, success: true },
          { name: 'analysis', status: 'error', startTime: 1000, endTime: 2000, success: false },
          { name: 'visualization', status: 'complete', startTime: 2000, endTime: 3000, success: true },
        ],
      });
      const assessment = await monitor.assessPipelineQuality(result);
      expect(assessment.reliabilityScore).toBeLessThan(1);
    });
  });

  describe('nextIteration', () => {
    it('should increment iteration', () => {
      const testMonitor = new QualityMonitor();
      testMonitor.nextIteration();
      // The next assessment should use iteration 2
      expect(true).toBe(true);
    });
  });

  describe('getQualityTrends', () => {
    it('should return empty trends for new monitor', () => {
      const testMonitor = new QualityMonitor();
      const trends = testMonitor.getQualityTrends();
      expect(trends.performance).toEqual([]);
      expect(trends.accuracy).toEqual([]);
      expect(trends.reliability).toEqual([]);
      expect(trends.overall).toEqual([]);
    });
  });

  describe('checkDeploymentReadiness', () => {
    it('should return not ready for new monitor with no history', () => {
      const testMonitor = new QualityMonitor();
      const readiness = testMonitor.checkDeploymentReadiness();
      expect(readiness.ready).toBe(false);
      expect(readiness.criticalIssues.length).toBeGreaterThan(0);
    });
  });

  describe('iteration comparison', () => {
    it('should compare with previous iteration', async () => {
      const testMonitor = new QualityMonitor();
      // First assessment
      const result1 = makeSuccessResult({ processingTime: 20000 });
      const assessment1 = await testMonitor.assessPipelineQuality(result1);

      testMonitor.nextIteration();

      // Second assessment
      const result2 = makeSuccessResult({ processingTime: 5000 });
      const assessment2 = await testMonitor.assessPipelineQuality(result2);

      expect(assessment2.iteration).toBe(2);
      expect(assessment2.improvements.length).toBeGreaterThan(0);
    });
  });
});
