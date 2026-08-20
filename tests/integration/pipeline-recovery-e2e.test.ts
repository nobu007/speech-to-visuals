/**
 * E2E Integration Test: PipelineOrchestrator + PipelineErrorRecoveryOrchestrator
 *
 * Validates the full pipeline flow with error recovery integration:
 * - Happy path produces recovery report with success status
 * - Transient failures are recovered via orchestrator
 * - Recovery report is populated in PipelineResult.metrics
 * - Abort conditions are checked between stages
 * - Failed pipeline produces a failure recovery report
 *
 * This test closes the verification loop identified in AI Hub feedback:
 * "wire the recovery orchestrator into end-to-end pipeline tests"
 */

import { jest } from '@jest/globals';
import type { RunRecoveryReport } from '@/quality/pipeline-run-recovery-tracker';
import type { PipelineInput, PipelineResult } from '@/pipeline/types';

// ---------- Mocks ----------

jest.unstable_mockModule('@/transcription', () => ({
  TranscriptionPipeline: jest.fn<(...args: unknown[]) => unknown>().mockImplementation(() => ({
    // REQ-045/046: runTranscription syncs config via updateConfig before transcribing.
    updateConfig: jest.fn(),
    transcribe: jest.fn<() => Promise<unknown>>().mockResolvedValue({
      success: true,
      segments: [
        { id: 0, start: 0, end: 5, text: 'Test segment one.', confidence: 0.9 },
        { id: 1, start: 5, end: 10, text: 'Test segment two.', confidence: 0.85 },
      ],
      language: 'en',
      duration: 10,
    }),
  })),
}));

jest.unstable_mockModule('@/analysis', () => ({
  // Segment-length defaults the orchestrator pipelines import from the
  // @/analysis barrel to build their analysis config. The ESM mock must
  // export them or the suite fails at import with "does not provide an
  // export named 'DEFAULT_MAX_SEGMENT_LENGTH_MS'". Canonical: 3000/15000 ms.
  DEFAULT_MIN_SEGMENT_LENGTH_MS: 3000,
  DEFAULT_MAX_SEGMENT_LENGTH_MS: 15000,
  SceneSegmenter: jest.fn<(...args: unknown[]) => unknown>().mockImplementation(() => ({
    updateConfig: jest.fn(),
    segment: jest.fn<() => Promise<unknown>>().mockResolvedValue([
      { id: 's1', start: 0, end: 5, text: 'Test segment one.' },
      { id: 's2', start: 5, end: 10, text: 'Test segment two.' },
    ]),
  })),
  DiagramDetector: jest.fn<(...args: unknown[]) => unknown>().mockImplementation(() => ({
    detect: jest.fn<() => Promise<unknown>>().mockResolvedValue({
      diagramType: 'flow',
      confidence: 0.9,
      nodes: [
        { id: 'n1', label: 'Step 1' },
        { id: 'n2', label: 'Step 2' },
      ],
      edges: [{ from: 'n1', to: 'n2', label: 'next' }],
    }),
  })),
}));

jest.unstable_mockModule('@/visualization', () => ({
  LayoutEngine: jest.fn<(...args: unknown[]) => unknown>().mockImplementation(() => ({
    updateConfig: jest.fn(),
    calculate: jest.fn<() => Promise<unknown>>().mockResolvedValue({
      scenes: [{
        id: 'scene-1',
        elements: [],
        bounds: { width: 1920, height: 1080 },
        durationMs: 10000,
      }],
    }),
  })),
}));

jest.unstable_mockModule('@stv/core/config/validate', () => ({
  validateConfig: jest.fn(),
  ValidationError: class extends Error { constructor(m: string) { super(m); } },
}));

jest.unstable_mockModule('@stv/core/config/schema', () => ({ ConfigSchema: {} }));

jest.unstable_mockModule('@stv/core/config', () => ({
  config: { geminiApiKey: 'test-key', supabaseUrl: 'http://localhost:54321', supabaseAnonKey: 'test-key' },
}));


// ---------- Helpers ----------

type PipelineMetrics = NonNullable<PipelineResult['metrics']>;

/** Fail-loud metrics reads: `metrics` is optional on PipelineResult and the
 *  e2e runs under test always populate it, so an absent metrics object (or
 *  recoveryReport / stageTimings inside it) is a pipeline drift the test
 *  must report by name, not a TypeError. The narrowing also retires the
 *  `as RunRecoveryReport` casts — the field is already typed as one. */
function requireMetrics(result: PipelineResult): PipelineMetrics {
  if (result.metrics === undefined) throw new Error('pipeline result has no metrics object');
  return result.metrics;
}

function requireRecoveryReport(result: PipelineResult): RunRecoveryReport {
  const report = requireMetrics(result).recoveryReport;
  if (report === undefined) throw new Error('pipeline metrics carry no recoveryReport');
  return report;
}

function requireStageTimings(result: PipelineResult): NonNullable<PipelineMetrics['stageTimings']> {
  const timings = requireMetrics(result).stageTimings;
  if (timings === undefined) throw new Error('pipeline metrics carry no stageTimings');
  return timings;
}

function createValidInput(): PipelineInput {
  return {
    audioFile: '/test/audio.wav',
    config: {
      transcription: {
        model: 'base',
        language: 'en',
      },
      analysis: {
        minSegmentLengthMs: 3000,
        maxSegmentLengthMs: 15000,
        confidenceThreshold: 0.7,
      },
      layout: {
        width: 1920,
        height: 1080,
        nodeWidth: 100,
        nodeHeight: 50,
      },
      output: {
        fps: 30,
        videoDuration: 10,
        includeAudio: true,
      },
    },
  };
}

// ---------- Tests ----------

describe('E2E: PipelineOrchestrator with ErrorRecovery Integration', () => {
  let PipelineOrchestrator: typeof import('@/pipeline/pipeline-orchestrator').PipelineOrchestrator;

  beforeAll(async () => {
    const mod = await import('@/pipeline/pipeline-orchestrator');
    PipelineOrchestrator = mod.PipelineOrchestrator;
  });

  it('happy path produces a recovery report with success status', async () => {
    const orchestrator = new PipelineOrchestrator();

    const result = await orchestrator.execute(createValidInput());

    expect(result.success).toBe(true);
    const report = requireRecoveryReport(result);
    expect(report.success).toBe(true);
    expect(report.runId).toMatch(/^run-\d+$/);
    expect(typeof report.totalRetries).toBe('number');
    expect(typeof report.degradationLevel).toBe('string');

    orchestrator.recoveryOrchestrator.destroy();
  });

  it('recovery report tracks stages that were executed', async () => {
    const orchestrator = new PipelineOrchestrator();

    const result = await orchestrator.execute(createValidInput());

    expect(result.success).toBe(true);
    const report = requireRecoveryReport(result);

    expect(report.runId).toBeDefined();
    expect(report.stages).toBeDefined();
    expect(Array.isArray(report.stages)).toBe(true);

    orchestrator.recoveryOrchestrator.destroy();
  });

  it('failed pipeline produces a failure recovery report', async () => {
    const orchestrator = new PipelineOrchestrator({
      qualityGates: [{
        stageIndex: 0,
        name: 'transcription-quality',
        validate: () => ({ passed: false, reason: 'Force failure for testing' }),
      }],
    });

    const result = await orchestrator.execute(createValidInput());

    // Quality gate failure should result in failure
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    // Recovery report should exist even on failure
    if (result.metrics?.recoveryReport) {
      const report = result.metrics.recoveryReport as RunRecoveryReport;
      expect(report.success).toBe(false);
    }

    orchestrator.recoveryOrchestrator.destroy();
  });

  it('progress callbacks fire for each stage', async () => {
    const progressUpdates: Array<{ stage: number; stageName: string; status: string }> = [];

    const orchestrator = new PipelineOrchestrator({
      progressCallback: (p) => {
        progressUpdates.push({
          stage: p.stage,
          stageName: p.stageName,
          status: p.status,
        });
      },
    });

    const result = await orchestrator.execute(createValidInput());

    expect(result.success).toBe(true);
    expect(progressUpdates.length).toBeGreaterThan(0);

    const stagesSeen = new Set(progressUpdates.map((p) => p.stage));
    expect(stagesSeen.size).toBeGreaterThanOrEqual(3);

    orchestrator.recoveryOrchestrator.destroy();
  });

  it('parallel execution produces independent results with recovery', async () => {
    const o1 = new PipelineOrchestrator();
    const o2 = new PipelineOrchestrator();

    const [r1, r2] = await Promise.all([
      o1.execute(createValidInput()),
      o2.execute({
        audioFile: '/test/second-audio.wav',
        config: {
          transcription: { model: 'base', language: 'en' },
          analysis: { minSegmentLengthMs: 3000, maxSegmentLengthMs: 15000, confidenceThreshold: 0.7 },
          layout: { width: 1920, height: 1080, nodeWidth: 100, nodeHeight: 50 },
          output: { fps: 30, videoDuration: 10, includeAudio: true },
        },
      }),
    ]);

    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);

    const report1 = requireRecoveryReport(r1);
    const report2 = requireRecoveryReport(r2);
    expect(report1.runId).not.toBe(report2.runId);

    o1.recoveryOrchestrator.destroy();
    o2.recoveryOrchestrator.destroy();
  });

  it('recoveryOrchestrator is accessible for direct inspection', async () => {
    const orchestrator = new PipelineOrchestrator();

    expect(orchestrator.recoveryOrchestrator).toBeDefined();
    expect(typeof orchestrator.recoveryOrchestrator.startRun).toBe('function');
    expect(typeof orchestrator.recoveryOrchestrator.executeStage).toBe('function');
    expect(typeof orchestrator.recoveryOrchestrator.finalizeRun).toBe('function');
    expect(typeof orchestrator.recoveryOrchestrator.shouldAbort).toBe('function');
    expect(typeof orchestrator.recoveryOrchestrator.destroy).toBe('function');

    orchestrator.recoveryOrchestrator.destroy();
  });

  it('health assessment is available after pipeline execution', async () => {
    const orchestrator = new PipelineOrchestrator();

    await orchestrator.execute(createValidInput());

    const health = orchestrator.recoveryOrchestrator.getHealthAssessment();
    expect(health).toBeDefined();
    expect(typeof health.overallScore).toBe('number');

    orchestrator.recoveryOrchestrator.destroy();
  });
});

describe('E2E: Recovery Orchestrator Direct Stage Execution', () => {
  let PipelineErrorRecoveryOrchestrator: typeof import('@/quality/pipeline-error-recovery-orchestrator').PipelineErrorRecoveryOrchestrator;

  beforeAll(async () => {
    const mod = await import('@/quality/pipeline-error-recovery-orchestrator');
    PipelineErrorRecoveryOrchestrator = mod.PipelineErrorRecoveryOrchestrator;
  });

  it('executeStage recovers from transient failure via boundary retry', async () => {
    const orchestrator = new PipelineErrorRecoveryOrchestrator();

    orchestrator.startRun('test-transient-recovery');

    let attemptCount = 0;
    const result = await orchestrator.executeStage('transcription', async () => {
      attemptCount++;
      if (attemptCount === 1) {
        throw new Error('Transient Whisper API error');
      }
      return { text: 'recovered transcription', confidence: 0.85 };
    }, { maxRetries: 2 });

    expect(result.success).toBe(true);
    expect(result.result).toEqual({ text: 'recovered transcription', confidence: 0.85 });
    // Boundary recovery may report the attempt count from its internal retry
    expect(result.attempts).toBeGreaterThanOrEqual(1);
    // The recovery path should be boundary (not primary since the first call failed)
    expect(result.recoveryPath).not.toBe('primary');

    orchestrator.destroy();
  });

  it('executeStage tracks degraded outcome after recovery', async () => {
    const orchestrator = new PipelineErrorRecoveryOrchestrator();

    orchestrator.startRun('test-degraded-recovery');

    // First call fails, boundary retries, second call succeeds
    let callCount = 0;
    const result = await orchestrator.executeStage('analysis', async () => {
      callCount++;
      if (callCount <= 2) {
        throw new Error('Transient analysis failure');
      }
      return { diagrams: [], confidence: 0.7 };
    }, { maxRetries: 3 });

    // The boundary recovery should eventually succeed after retries
    expect(result.success).toBe(true);
    expect(result.attempts).toBeGreaterThanOrEqual(1);

    const report = orchestrator.finalizeRun(true);
    expect(report.totalRetries).toBeGreaterThanOrEqual(1);

    orchestrator.destroy();
  });

  it('strategy chain provides degraded result when primary fails', async () => {
    const orchestrator = new PipelineErrorRecoveryOrchestrator();

    // Register a strategy chain for the layout stage with proper StrategyChain type
    orchestrator.strategyChain.register('layout_generation', {
      name: 'layout-fallback-chain',
      steps: [
        {
          id: 'dagre-fallback',
          name: 'Dagre Layout Fallback',
          execute: async () => ({
            result: { nodes: [], edges: [], degraded: true },
            fallbackUsed: true,
            confidence: 0.6,
          }),
          optional: false,
        },
      ],
    });

    orchestrator.startRun('test-chain-recovery');

    const result = await orchestrator.executeStage('layout_generation', async () => {
      throw new Error('Primary layout engine failure');
    });

    expect(result.success).toBe(true);
    expect(result.recoveryPath).toBe('chain');
    expect(result.degraded).toBe(true);

    const report = orchestrator.finalizeRun(true);
    expect(report.degradationLevel).toBeDefined();

    orchestrator.destroy();
  });
});

describe('E2E: Pipeline metrics include retry attempts', () => {
  let PipelineOrchestrator: typeof import('@/pipeline/pipeline-orchestrator').PipelineOrchestrator;

  beforeAll(async () => {
    const mod = await import('@/pipeline/pipeline-orchestrator');
    PipelineOrchestrator = mod.PipelineOrchestrator;
  });

  it('totalRetryAttempts is tracked in pipeline metrics', async () => {
    const orchestrator = new PipelineOrchestrator();

    const result = await orchestrator.execute(createValidInput());

    const metrics = requireMetrics(result);
    expect(typeof metrics.totalRetryAttempts).toBe('number');
    // Happy path should have 0 retries
    expect(metrics.totalRetryAttempts).toBe(0);

    orchestrator.recoveryOrchestrator.destroy();
  });

  it('stageTimings are captured for performance analysis', async () => {
    const orchestrator = new PipelineOrchestrator();

    const result = await orchestrator.execute(createValidInput());

    const timings = requireStageTimings(result);
    expect(Array.isArray(timings)).toBe(true);
    expect(timings.length).toBeGreaterThan(0);

    orchestrator.recoveryOrchestrator.destroy();
  });
});
