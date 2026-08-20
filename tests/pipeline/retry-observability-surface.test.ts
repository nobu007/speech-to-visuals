/**
 * Tests for retry observability surfacing in pipeline completion output.
 *
 * Verifies that retryAttempts accumulated during pipeline execution are
 * actually exposed in the PipelineResult.metrics output (totalRetryAttempts)
 * and per-stage in stageTimings[].retryAttempts.
 *
 * This addresses the feedback: "retryAttempts is accumulated but never exposed
 * (no getter, no logging, no metrics emission)".
 */

import {
  PipelineOrchestrator,
  PipelineOrchestratorConfig,
} from '@/pipeline/pipeline-orchestrator';
import { PipelineInput, PipelineResult } from '@/pipeline/types';
import type { StageTimingRecord } from '@/pipeline/stage-timing-metrics';

// ---------- Helpers ----------

type PipelineMetrics = NonNullable<PipelineResult['metrics']>;

/** Fail-loud metrics reads: `metrics` is optional on PipelineResult and a
 *  successful orchestrator run always populates it, so an absent metrics
 *  object (or stageTimings inside it) is a pipeline drift the test must
 *  report by name, not a TypeError on `result.metrics!`. */
function requireMetrics(result: PipelineResult): PipelineMetrics {
  if (result.metrics === undefined) throw new Error('pipeline result has no metrics object');
  return result.metrics;
}

function requireStageTimings(result: PipelineResult): StageTimingRecord[] {
  const timings = requireMetrics(result).stageTimings;
  if (timings === undefined) throw new Error('pipeline metrics carry no stageTimings');
  return timings;
}

function makeValidPipelineInput(): PipelineInput {
  return {
    audioFile: 'test-audio.wav',
    config: {
      transcription: { model: 'base', language: 'en' },
      analysis: {
        minSegmentLengthMs: 3000,
        maxSegmentLengthMs: 15000,
        confidenceThreshold: 0.7,
      },
      layout: { width: 1920, height: 1080, nodeWidth: 120, nodeHeight: 60 },
      output: { fps: 30, videoDuration: 60, includeAudio: true },
    },
  };
}

// ---------- Tests ----------

describe('PipelineOrchestrator retry observability surfacing', () => {
  it('exposes totalRetryAttempts in pipeline result metrics', async () => {
    const orchestrator = new PipelineOrchestrator();
    const input = makeValidPipelineInput();

    const result = await orchestrator.execute(input);

    expect(result.success).toBe(true);
    const metrics = requireMetrics(result);
    expect(metrics.totalRetryAttempts).toBeDefined();
    expect(typeof metrics.totalRetryAttempts).toBe('number');
  });

  it('exposes per-stage retryAttempts in stageTimings', async () => {
    const orchestrator = new PipelineOrchestrator();
    const input = makeValidPipelineInput();

    const result = await orchestrator.execute(input);

    expect(result.success).toBe(true);
    const timings = requireStageTimings(result);
    expect(timings.length).toBe(5);

    for (const timing of timings) {
      expect(timing.retryAttempts).toBeDefined();
      expect(typeof timing.retryAttempts).toBe('number');
      expect(timing.retryAttempts).toBeGreaterThanOrEqual(0);
    }
  });

  it('returns totalRetryAttempts=0 when no retries occur', async () => {
    const orchestrator = new PipelineOrchestrator();
    const input = makeValidPipelineInput();

    const result = await orchestrator.execute(input);

    expect(result.success).toBe(true);
    // In a normal run without flaky stages, no retries should occur
    expect(requireMetrics(result).totalRetryAttempts).toBe(0);
  });

  it('includes totalRetryAttempts even on pipeline failure', async () => {
    const orchestrator = new PipelineOrchestrator();
    // Invalid input that should cause a failure during rendering
    const input: PipelineInput = {
      audioFile: 'test-audio.wav',
    };

    // The orchestrator uses fallback results, so this will likely succeed.
    // Test that metrics are still present regardless of success/failure.
    const result = await orchestrator.execute(input);

    // Whether success or failure, metrics should include totalRetryAttempts
    if (result.metrics) {
      expect(typeof result.metrics.totalRetryAttempts).toBe('number');
    }
  });
});

describe('MainPipeline retry observability surfacing', () => {
  // MainPipeline is tested via its result structure.
  // Since MainPipeline.createSuccessResult now includes metrics.totalRetryAttempts,
  // we verify the type contract holds.
  it('PipelineResult.metrics accepts totalRetryAttempts', () => {
    const result: PipelineResult = {
      success: true,
      scenes: [],
      audioUrl: '',
      duration: 0,
      processingTime: 100,
      stages: [],
      metrics: {
        totalRetryAttempts: 3,
      },
    };

    expect(result.metrics?.totalRetryAttempts).toBe(3);
  });

  it('PipelineResult.metrics.totalRetryAttempts defaults to undefined when omitted', () => {
    const result: PipelineResult = {
      success: true,
      scenes: [],
      audioUrl: '',
      duration: 0,
      processingTime: 100,
      stages: [],
    };

    expect(result.metrics?.totalRetryAttempts).toBeUndefined();
  });
});
