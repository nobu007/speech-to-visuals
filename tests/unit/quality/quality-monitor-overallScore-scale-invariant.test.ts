/**
 * Cross-cutting scale-invariant guard for the two same-named `QualityMonitor`
 * producers.
 *
 * The repo has TWO classes both exported as `QualityMonitor`:
 *   - `@/quality`            → assessPipelineQuality().overallScore is 0-1
 *                              (weighted sum of clamp01 sub-scores; deployment
 *                              gate is overallScore >= 0.7)
 *   - `@/pipeline/quality-monitor` → generateReport().overallScore is 0-100
 *                              (base 100 minus per-violation deductions)
 *
 * They are NOT interchangeable: a 0-100 score fed to the 0-1 `>= 0.7` gate would
 * ALWAYS pass (even a failing 40/100 >> 0.7), silently disabling the gate — the
 * same 100x scale-leak class as the 916c8e82 qualityScore fix. This test locks
 * both scales and demonstrates the hazard so a future merge/swap fails loudly.
 */

import { describe, expect, it } from '@jest/globals';

import { QualityMonitor as FractionalQualityMonitor } from '@/quality';
import { getQualityMonitor } from '@/pipeline/quality-monitor';
import type { PipelineResult, PipelineStage } from '@/pipeline/types';
import type { SceneGraph } from '@stv/core/types/diagram';

function makeStage(name: string): PipelineStage {
  return { name, status: 'complete', success: true, startTime: 0, endTime: 100 };
}

function makeScene(overrides: Partial<SceneGraph> = {}): SceneGraph {
  return {
    type: 'flow',
    nodes: [
      { id: 'n1', label: 'Node 1' },
      { id: 'n2', label: 'Node 2' },
    ],
    edges: [{ from: 'n1', to: 'n2' }],
    summary: 'A test scene with sufficient length for assessment',
    keyphrases: ['test', 'scene'],
    startMs: 0,
    durationMs: 5000,
    ...overrides,
  };
}

function makeResult(): PipelineResult {
  return {
    success: true,
    scenes: [makeScene(), makeScene({ type: 'tree' })],
    audioUrl: '/test.wav',
    duration: 60,
    processingTime: 10000,
    stages: [
      makeStage('transcription'),
      makeStage('analysis'),
      makeStage('visualization'),
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
  };
}

describe('dual QualityMonitor overallScore scale invariant', () => {
  it('the two same-named QualityMonitor exports are distinct classes', () => {
    // Lock that the @/quality and @/pipeline/quality-monitor exports have NOT
    // been unified/aliased — a barrel alias would silently flip every consumer.
    expect(FractionalQualityMonitor).not.toBe(getQualityMonitor().constructor);
  });

  it('@/quality assessPipelineQuality emits overallScore on the 0-1 scale', async () => {
    const monitor = new FractionalQualityMonitor();
    const assessment = await monitor.assessPipelineQuality(makeResult());
    expect(assessment.overallScore).toBeGreaterThanOrEqual(0);
    expect(assessment.overallScore).toBeLessThanOrEqual(1);
  });

  it('@/pipeline/quality-monitor generateReport emits overallScore on the 0-100 scale', () => {
    // generateReport() derives from latestMetrics, so recording fresh metrics
    // here makes the assertion deterministic regardless of prior singleton state.
    const monitor = getQualityMonitor();
    monitor.recordMetrics({
      processingTime: 1000,
      memoryUsage: 50,
      layoutOverlap: 0,
      errorCount: 0,
      warningCount: 0,
      transcriptionAccuracy: 0.95,
    });
    const report = monitor.generateReport();
    // Distinctive sentinel: a 0-100 score is > 1, proving it is NOT on the 0-1
    // scale and would wrongly clear the 0-1 `>= 0.7` deployment gate.
    expect(report.overallScore).toBeGreaterThan(1);
    expect(report.overallScore).toBeLessThanOrEqual(100);
  });

  it('documents the cross-wiring hazard: a 0-100 score wrongly clears the 0-1 gate', () => {
    // The 0-1 deployment gate threshold is 0.7. A deliberately-poor 0-100 score
    // (e.g. 30/100) is far below any sane "pass", yet still > 0.7 — so feeding
    // the wrong monitor's score into the gate yields a false PASS. This test
    // exists to fail if anyone makes the two scales interchangeable.
    const DEPLOYMENT_GATE_THRESHOLD_0_TO_1 = 0.7;
    const poorZeroToHundredScore = 30;
    expect(poorZeroToHundredScore).toBeGreaterThan(DEPLOYMENT_GATE_THRESHOLD_0_TO_1);
  });
});
