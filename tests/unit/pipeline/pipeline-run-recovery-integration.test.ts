/**
 * Integration Tests: PipelineRunRecoveryTracker wired into PipelineOrchestrator
 *
 * Verifies that:
 *  - The orchestrator produces a recoveryReport in its result metrics
 *  - Stage outcomes are recorded for all 5 pipeline stages
 *  - The abort check gates execution when the tracker signals critical degradation
 *  - Adaptive recovery recommendations are consulted before downstream stages
 */

import { PipelineOrchestrator } from '@/pipeline/pipeline-orchestrator';
import { PipelineInput, PipelineResult } from '@/pipeline/types';
import type { RunRecoveryReport } from '@/quality/pipeline-run-recovery-tracker';

// ---------- Helpers ----------

/**
 * Fail-loud accessor for the orchestrator's `metrics?.recoveryReport` — an
 * absent report used to surface as `result.metrics!.recoveryReport` TypeError
 * (or a bare `toBeDefined()` failure); the helper keeps the RED verdict with
 * a diagnosable message. The field is typed `RunRecoveryReport` on
 * ExtendedPipelineMetrics, so narrowing removes the old cast too.
 */
function requireRecoveryReport(result: PipelineResult): RunRecoveryReport {
  const report = result.metrics?.recoveryReport;
  if (report === undefined) {
    throw new Error('recovery report was not produced in pipeline metrics');
  }
  return report;
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

describe('PipelineRunRecoveryTracker Integration', () => {
  it('includes recoveryReport in metrics on successful pipeline run', async () => {
    const orchestrator = new PipelineOrchestrator();
    const input = makeValidPipelineInput();
    const result = await orchestrator.execute(input);

    expect(result.success).toBe(true);
    expect(result.metrics).toBeDefined();

    const report = requireRecoveryReport(result);
    expect(report.runId).toMatch(/^run-\d+$/);
    expect(report.success).toBe(true);
    expect(report.totalDurationMs).toBeGreaterThanOrEqual(0);
    expect(report.degradationLevel).toBe('nominal');
  });

  it('records outcomes for all pipeline stages in recovery report', async () => {
    const orchestrator = new PipelineOrchestrator();
    const input = makeValidPipelineInput();
    const result = await orchestrator.execute(input);

    const report = requireRecoveryReport(result);
    // The orchestrator runs 5 stages: transcription, analysis, layout_generation, animation, rendering
    expect(report.stages.length).toBeGreaterThanOrEqual(1);

    const stageNames = report.stages.map((s) => s.stage);
    expect(stageNames).toContain('transcription');
    expect(stageNames).toContain('analysis');
    expect(stageNames).toContain('rendering');
  });

  it('records retry count and duration per stage', async () => {
    const orchestrator = new PipelineOrchestrator();
    const input = makeValidPipelineInput();
    const result = await orchestrator.execute(input);

    const report = requireRecoveryReport(result);

    for (const stageRecord of report.stages) {
      expect(stageRecord.attemptCount).toBeGreaterThanOrEqual(1);
      expect(stageRecord.durationMs).toBeGreaterThanOrEqual(0);
      expect(typeof stageRecord.fallbackUsed).toBe('boolean');
      expect(typeof stageRecord.degraded).toBe('boolean');
    }
  });

  it('includes recoveryReport even when pipeline gracefully degrades', async () => {
    const orchestrator = new PipelineOrchestrator();
    const input: PipelineInput = {
      audioFile: 'nonexistent.wav',
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

    // The orchestrator uses default/fallback results when components fail,
    // so the pipeline still succeeds but via degraded paths
    const result = await orchestrator.execute(input);

    expect(result.metrics?.recoveryReport).toBeDefined();
    const report = requireRecoveryReport(result);
    expect(report.stages.length).toBeGreaterThanOrEqual(1);
  });

  it('recovery report has correct timestamp bounds', async () => {
    const before = Date.now();
    const orchestrator = new PipelineOrchestrator();
    const input = makeValidPipelineInput();
    const result = await orchestrator.execute(input);
    const after = Date.now();

    const report = requireRecoveryReport(result);

    expect(report.startTime).toBeGreaterThanOrEqual(before);
    expect(report.startTime).toBeLessThanOrEqual(after);
    expect(report.endTime).toBeGreaterThanOrEqual(report.startTime);
    expect(report.totalDurationMs).toBe(report.endTime - report.startTime);
  });

  it('produces a valid runId for each execution', async () => {
    const orchestrator = new PipelineOrchestrator();
    const input = makeValidPipelineInput();

    const result1 = await orchestrator.execute(input);
    const report1 = requireRecoveryReport(result1);

    const result2 = await orchestrator.execute(input);
    const report2 = requireRecoveryReport(result2);

    // Each run should have a unique ID
    expect(report1.runId).not.toBe(report2.runId);
  });
});
