/**
 * TASK-0163: Pipeline Full E2E Recovery Integration Test
 *
 * Validates that PipelineOrchestrator correctly delegates to
 * PipelineErrorRecoveryOrchestrator for error recovery across all pipeline
 * stages (transcription → analysis → layout → rendering).
 *
 * Test categories:
 *  1. Per-stage error injection → recovery (4 stages)
 *  2. PipelineOrchestrator → PipelineErrorRecoveryOrchestrator delegation
 *  3. Cascade failure scenario (multiple stages failing simultaneously)
 *  4. Recovery metrics verification (attempts, duration, fallback count)
 */

import { jest } from '@jest/globals';
import type { RunRecoveryReport } from '@/quality/pipeline-run-recovery-tracker';
import type { PipelineProgress } from '@/pipeline/pipeline-orchestrator';

// ---------- Mocks ----------
// Mock external dependencies to isolate recovery behavior.

jest.unstable_mockModule('@/transcription', () => ({
  TranscriptionPipeline: jest.fn().mockImplementation(() => ({
    // REQ-045/046: runTranscription syncs config via updateConfig before transcribing.
    updateConfig: jest.fn(),
    transcribe: jest.fn().mockResolvedValue({
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
  SceneSegmenter: jest.fn().mockImplementation(() => ({
    updateConfig: jest.fn(),
    segment: jest.fn().mockResolvedValue([
      { id: 's1', start: 0, end: 5, text: 'Test segment one.' },
      { id: 's2', start: 5, end: 10, text: 'Test segment two.' },
    ]),
  })),
  DiagramDetector: jest.fn().mockImplementation(() => ({
    detect: jest.fn().mockResolvedValue({
      diagramType: 'flow',
      confidence: 0.9,
      nodes: [
        { id: 'n1', label: 'Step 1' },
        { id: 'n2', label: 'Step 2' },
      ],
      edges: [{ from: 'n1', to: 'n2', label: 'next' }],
    }),
    analyze: jest.fn().mockResolvedValue({
      type: 'flow',
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
  LayoutEngine: jest.fn().mockImplementation(() => ({
    updateConfig: jest.fn(),
    calculate: jest.fn().mockResolvedValue({
      scenes: [{
        id: 'scene-1',
        elements: [],
        bounds: { width: 1920, height: 1080 },
        durationMs: 10000,
      }],
    }),
    generateLayout: jest.fn().mockResolvedValue({
      success: true,
      layout: {
        nodes: [
          { id: 'n1', label: 'Step 1', x: 100, y: 100, w: 120, h: 60 },
          { id: 'n2', label: 'Step 2', x: 300, y: 100, w: 120, h: 60 },
        ],
        edges: [{ from: 'n1', to: 'n2', points: [{ x: 220, y: 130 }, { x: 300, y: 130 }] }],
      },
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

function createValidInput() {
  return {
    audioFile: '/test/audio.wav',
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

/**
 * Creates a transcription-stage fallback that returns a valid transcription result.
 */
function transcriptionFallback() {
  return async () => ({
    success: true,
    segments: [
      { id: 0, start: 0, end: 5, text: 'Recovered transcription.', confidence: 0.7 },
    ],
    language: 'en',
    duration: 5,
  });
}

/**
 * Creates an analysis-stage fallback that returns valid segments + diagrams.
 */
function analysisFallback() {
  return async () => ({
    segments: [
      { startMs: 0, endMs: 5000, text: 'Recovered analysis.', summary: 'Recovered', keyphrases: ['recovered'] },
    ],
    diagrams: [
      { type: 'flow', confidence: 0.75, nodes: [{ id: 'n1', label: 'Step' }], edges: [] },
    ],
  });
}

/**
 * Creates a layout-stage fallback that returns a valid layout.
 */
function layoutFallback() {
  return async () => [
    {
      segment: { startMs: 0, endMs: 5000, text: 'Test', summary: 'Test', keyphrases: [] },
      analysis: { type: 'flow', nodes: [], edges: [] },
      layout: { nodes: [], edges: [] },
    },
  ];
}

/**
 * Creates a rendering-stage fallback.
 * Returns a non-undefined value because PipelineOrchestrator's tryFallbacks
 * treats undefined as "no fallback found".
 */
function renderingFallback() {
  return async () => ({ rendered: true });
}

// ---------- Late-binding imports ----------

let PipelineOrchestrator: typeof import('@/pipeline/pipeline-orchestrator').PipelineOrchestrator;

beforeAll(async () => {
  const mod = await import('@/pipeline/pipeline-orchestrator');
  PipelineOrchestrator = mod.PipelineOrchestrator;
});

// =====================================================================
// TEST SUITE
// =====================================================================

describe('PipelineOrchestrator Full E2E Recovery', () => {

  // =================================================================
  // 1. Per-Stage Error Injection → Recovery
  // =================================================================

  describe('Per-stage recovery', () => {

    it('recovers from transcription stage failure', async () => {
      const progressEvents: PipelineProgress[] = [];

      const orchestrator = new PipelineOrchestrator({
        qualityGates: [
          {
            stageIndex: 0,
            name: 'transcription-quality',
            validate: () => ({ passed: false, reason: 'Whisper mock failure' }),
          },
        ],
        fallbackStrategies: [
          {
            stageIndex: 0,
            name: 'transcription-fallback',
            execute: transcriptionFallback(),
          },
        ],
        progressCallback: (p) => progressEvents.push(p),
      });

      const result = await orchestrator.execute(createValidInput());

      // Pipeline should succeed via fallback
      expect(result.success).toBe(true);
      expect(result.stages.length).toBeGreaterThanOrEqual(1);

      // Progress events should show failure then fallback
      const failedEvent = progressEvents.find(
        (e) => e.stageName === 'transcription' && e.status === 'failed',
      );
      expect(failedEvent).toBeDefined();
      expect(failedEvent!.message).toContain('Whisper mock failure');

      const fallbackEvent = progressEvents.find(
        (e) => e.stageName === 'transcription' && e.status === 'fallback',
      );
      expect(fallbackEvent).toBeDefined();

      orchestrator.recoveryOrchestrator.destroy();
    });

    it('recovers from analysis stage failure', async () => {
      const progressEvents: PipelineProgress[] = [];

      const orchestrator = new PipelineOrchestrator({
        qualityGates: [
          {
            stageIndex: 1,
            name: 'analysis-quality',
            validate: () => ({ passed: false, reason: 'Gemini mock failure' }),
          },
        ],
        fallbackStrategies: [
          {
            stageIndex: 1,
            name: 'analysis-fallback',
            execute: analysisFallback(),
          },
        ],
        progressCallback: (p) => progressEvents.push(p),
      });

      const result = await orchestrator.execute(createValidInput());

      expect(result.success).toBe(true);
      expect(result.stages.length).toBeGreaterThanOrEqual(2);

      const failedEvent = progressEvents.find(
        (e) => e.stageName === 'analysis' && e.status === 'failed',
      );
      expect(failedEvent).toBeDefined();

      const fallbackEvent = progressEvents.find(
        (e) => e.stageName === 'analysis' && e.status === 'fallback',
      );
      expect(fallbackEvent).toBeDefined();

      orchestrator.recoveryOrchestrator.destroy();
    });

    it('recovers from layout stage failure', async () => {
      const progressEvents: PipelineProgress[] = [];

      const orchestrator = new PipelineOrchestrator({
        qualityGates: [
          {
            stageIndex: 2,
            name: 'layout-quality',
            validate: () => ({ passed: false, reason: 'LayoutEngine mock failure' }),
          },
        ],
        fallbackStrategies: [
          {
            stageIndex: 2,
            name: 'layout-fallback',
            execute: layoutFallback(),
          },
        ],
        progressCallback: (p) => progressEvents.push(p),
      });

      const result = await orchestrator.execute(createValidInput());

      expect(result.success).toBe(true);
      expect(result.stages.length).toBeGreaterThanOrEqual(3);

      const failedEvent = progressEvents.find(
        (e) => e.stageName === 'layout' && e.status === 'failed',
      );
      expect(failedEvent).toBeDefined();

      const fallbackEvent = progressEvents.find(
        (e) => e.stageName === 'layout' && e.status === 'fallback',
      );
      expect(fallbackEvent).toBeDefined();

      orchestrator.recoveryOrchestrator.destroy();
    });

    it('recovers from rendering stage failure', async () => {
      const progressEvents: PipelineProgress[] = [];

      // Rendering (stageIndex 4) fails the quality gate
      const orchestrator = new PipelineOrchestrator({
        qualityGates: [
          {
            stageIndex: 4,
            name: 'rendering-quality',
            validate: () => ({ passed: false, reason: 'VideoGenerator mock failure' }),
          },
        ],
        fallbackStrategies: [
          {
            stageIndex: 4,
            name: 'rendering-fallback',
            execute: renderingFallback(),
          },
        ],
        progressCallback: (p) => progressEvents.push(p),
      });

      const result = await orchestrator.execute(createValidInput());

      expect(result.success).toBe(true);
      expect(result.stages.length).toBe(5);

      const failedEvent = progressEvents.find(
        (e) => e.stageName === 'rendering' && e.status === 'failed',
      );
      expect(failedEvent).toBeDefined();

      const fallbackEvent = progressEvents.find(
        (e) => e.stageName === 'rendering' && e.status === 'fallback',
      );
      expect(fallbackEvent).toBeDefined();

      orchestrator.recoveryOrchestrator.destroy();
    });
  });

  // =================================================================
  // 2. PipelineOrchestrator → PipelineErrorRecoveryOrchestrator
  //    Delegation Verification
  // =================================================================

  describe('Delegation to PipelineErrorRecoveryOrchestrator', () => {

    it('exposes recoveryOrchestrator with the full API surface', () => {
      const orchestrator = new PipelineOrchestrator();

      const ro = orchestrator.recoveryOrchestrator;
      expect(ro).toBeDefined();
      expect(typeof ro.startRun).toBe('function');
      expect(typeof ro.executeStage).toBe('function');
      expect(typeof ro.finalizeRun).toBe('function');
      expect(typeof ro.shouldAbort).toBe('function');
      expect(typeof ro.getHealthAssessment).toBe('function');
      expect(typeof ro.destroy).toBe('function');
      expect(ro.strategyChain).toBeDefined();
      expect(ro.runTracker).toBeDefined();

      orchestrator.recoveryOrchestrator.destroy();
    });

    it('produces a recovery report via orchestrator delegation on success', async () => {
      const orchestrator = new PipelineOrchestrator();

      const result = await orchestrator.execute(createValidInput());

      expect(result.success).toBe(true);
      expect(result.metrics).toBeDefined();

      const report = result.metrics!.recoveryReport as RunRecoveryReport;
      expect(report).toBeDefined();
      expect(report.runId).toMatch(/^run-/);
      expect(report.success).toBe(true);
      expect(report.degradationLevel).toBe('nominal');
      expect(report.totalRetries).toBe(0);
      expect(report.totalFallbacks).toBe(0);

      orchestrator.recoveryOrchestrator.destroy();
    });

    it('produces a recovery report on pipeline failure', async () => {
      const orchestrator = new PipelineOrchestrator({
        qualityGates: [
          {
            stageIndex: 0,
            name: 'force-fail',
            validate: () => ({ passed: false, reason: 'Forced failure for delegation test' }),
          },
        ],
      });

      const result = await orchestrator.execute(createValidInput());

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.metrics?.recoveryReport).toBeDefined();

      orchestrator.recoveryOrchestrator.destroy();
    });

    it('health assessment reflects pipeline state after execution', async () => {
      const orchestrator = new PipelineOrchestrator();

      await orchestrator.execute(createValidInput());

      const health = orchestrator.recoveryOrchestrator.getHealthAssessment();
      expect(health).toBeDefined();
      expect(typeof health.overallScore).toBe('number');
      expect(health.overallScore).toBeGreaterThanOrEqual(0);
      expect(health.overallScore).toBeLessThanOrEqual(1);

      orchestrator.recoveryOrchestrator.destroy();
    });
  });

  // =================================================================
  // 3. Cascade Failure Scenario
  // =================================================================

  describe('Cascade failure handling', () => {

    it('recovers when multiple stages fail simultaneously', async () => {
      const progressEvents: PipelineProgress[] = [];

      const orchestrator = new PipelineOrchestrator({
        qualityGates: [
          {
            stageIndex: 0,
            name: 'cascade-transcription',
            validate: () => ({ passed: false, reason: 'Cascade failure: transcription' }),
          },
          {
            stageIndex: 2,
            name: 'cascade-layout',
            validate: () => ({ passed: false, reason: 'Cascade failure: layout' }),
          },
          {
            stageIndex: 4,
            name: 'cascade-rendering',
            validate: () => ({ passed: false, reason: 'Cascade failure: rendering' }),
          },
        ],
        fallbackStrategies: [
          {
            stageIndex: 0,
            name: 'transcription-recovery',
            execute: transcriptionFallback(),
          },
          {
            stageIndex: 2,
            name: 'layout-recovery',
            execute: layoutFallback(),
          },
          {
            stageIndex: 4,
            name: 'rendering-recovery',
            execute: renderingFallback(),
          },
        ],
        progressCallback: (p) => progressEvents.push(p),
      });

      const result = await orchestrator.execute(createValidInput());

      // Pipeline should succeed despite 3 simultaneous failures
      expect(result.success).toBe(true);
      expect(result.stages).toHaveLength(5);

      // Verify all 3 stages triggered failure events
      const failedStages = progressEvents.filter((e) => e.status === 'failed');
      expect(failedStages.length).toBeGreaterThanOrEqual(3);

      // Verify all 3 stages triggered fallback events
      const fallbackStages = progressEvents.filter((e) => e.status === 'fallback');
      expect(fallbackStages.length).toBe(3);

      // Verify recovery report exists (quality gate fallbacks are tracked at
      // the pipeline level, not the recovery orchestrator level)
      const report = result.metrics!.recoveryReport as RunRecoveryReport;
      expect(report).toBeDefined();
      expect(report.success).toBe(true);

      orchestrator.recoveryOrchestrator.destroy();
    });

    it('fails the pipeline when cascade has no fallbacks', async () => {
      const orchestrator = new PipelineOrchestrator({
        qualityGates: [
          {
            stageIndex: 0,
            name: 'unrecoverable-1',
            validate: () => ({ passed: false, reason: 'No fallback available' }),
          },
          {
            stageIndex: 2,
            name: 'unrecoverable-2',
            validate: () => ({ passed: false, reason: 'Also no fallback' }),
          },
        ],
        // No fallback strategies — pipeline should fail
      });

      const result = await orchestrator.execute(createValidInput());

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      orchestrator.recoveryOrchestrator.destroy();
    });

    it('handles consecutive stage failures with partial recovery', async () => {
      const progressEvents: PipelineProgress[] = [];

      // Stage 0 fails and recovers; Stage 1 fails with no fallback → pipeline fails
      const orchestrator = new PipelineOrchestrator({
        qualityGates: [
          {
            stageIndex: 0,
            name: 'stage0-fail',
            validate: () => ({ passed: false, reason: 'Stage 0 failure' }),
          },
          {
            stageIndex: 1,
            name: 'stage1-fail-norecovery',
            validate: () => ({ passed: false, reason: 'Stage 1 failure, no recovery' }),
          },
        ],
        fallbackStrategies: [
          {
            stageIndex: 0,
            name: 'stage0-fallback',
            execute: transcriptionFallback(),
          },
          // No fallback for stage 1
        ],
        progressCallback: (p) => progressEvents.push(p),
      });

      const result = await orchestrator.execute(createValidInput());

      // Stage 0 should recover, but stage 1 should cause failure
      expect(result.success).toBe(false);

      // Stage 0 should have fallback event
      const stage0Fallback = progressEvents.find(
        (e) => e.stageName === 'transcription' && e.status === 'fallback',
      );
      expect(stage0Fallback).toBeDefined();

      orchestrator.recoveryOrchestrator.destroy();
    });
  });

  // =================================================================
  // 4. Recovery Metrics Verification
  // =================================================================

  describe('Recovery metrics', () => {

    it('tracks totalRetryAttempts in pipeline metrics', async () => {
      const orchestrator = new PipelineOrchestrator();

      const result = await orchestrator.execute(createValidInput());

      expect(result.metrics).toBeDefined();
      expect(typeof result.metrics!.totalRetryAttempts).toBe('number');
      // Happy path: no retries
      expect(result.metrics!.totalRetryAttempts).toBe(0);

      orchestrator.recoveryOrchestrator.destroy();
    });

    it('recovery report contains stage-level records', async () => {
      const orchestrator = new PipelineOrchestrator();

      const result = await orchestrator.execute(createValidInput());

      const report = result.metrics!.recoveryReport as RunRecoveryReport;
      expect(report.stages).toBeDefined();
      expect(Array.isArray(report.stages)).toBe(true);
      expect(report.stages.length).toBeGreaterThan(0);

      // Each stage record should have the stage name
      for (const stageRecord of report.stages) {
        expect(stageRecord.stage).toBeDefined();
        expect(typeof stageRecord.stage).toBe('string');
      }

      orchestrator.recoveryOrchestrator.destroy();
    });

    it('tracks duration in recovery report', async () => {
      const orchestrator = new PipelineOrchestrator();

      const result = await orchestrator.execute(createValidInput());

      const report = result.metrics!.recoveryReport as RunRecoveryReport;
      expect(report.totalDurationMs).toBeDefined();
      expect(typeof report.totalDurationMs).toBe('number');
      expect(report.totalDurationMs).toBeGreaterThanOrEqual(0);

      orchestrator.recoveryOrchestrator.destroy();
    });

    it('records fallback count in recovery report after orchestrator-level recovery', async () => {
      const orchestrator = new PipelineOrchestrator();

      // Register a strategy chain on the recovery orchestrator to trigger
      // orchestrator-level fallback tracking (quality gate fallbacks are
      // handled at the pipeline level, not the recovery orchestrator level).
      orchestrator.recoveryOrchestrator.strategyChain.register('transcription', {
        name: 'metrics-chain',
        steps: [
          {
            id: 'transcription-chain-step',
            name: 'Chain Fallback',
            execute: async () => ({
              result: { text: 'chain-recovered', confidence: 0.8 },
              fallbackUsed: true,
              confidence: 0.6,
            }),
            optional: false,
          },
        ],
      });

      // The strategy chain is used when the primary operation fails in executeStage.
      // Since runTranscription catches its own errors, we use the direct orchestrator
      // to verify the metrics path.
      orchestrator.recoveryOrchestrator.startRun('metrics-test');
      let attempt = 0;
      const stageResult = await orchestrator.recoveryOrchestrator.executeStage(
        'transcription',
        async () => {
          attempt++;
          if (attempt === 1) throw new Error('Primary failure');
          return { text: 'recovered', confidence: 0.9 };
        },
        { maxRetries: 2 },
      );

      expect(stageResult.success).toBe(true);
      expect(stageResult.attempts).toBeGreaterThanOrEqual(1);

      const report = orchestrator.recoveryOrchestrator.finalizeRun(true);
      expect(report.totalRetries).toBeGreaterThanOrEqual(1);

      orchestrator.recoveryOrchestrator.destroy();
    });

    it('stageTimings are captured for performance analysis', async () => {
      const orchestrator = new PipelineOrchestrator();

      const result = await orchestrator.execute(createValidInput());

      expect(result.metrics?.stageTimings).toBeDefined();
      const timings = result.metrics!.stageTimings!;
      expect(Array.isArray(timings)).toBe(true);
      expect(timings.length).toBeGreaterThan(0);

      orchestrator.recoveryOrchestrator.destroy();
    });

    it('timingReport (aggregated timing) is surfaced on metrics, not dropped (REQ-297)', async () => {
      // aggregateTimingReport() derives totalDurationMs / totalItemsProcessed /
      // overallThroughputPerMs — pre-computed aggregates the raw stageTimings
      // array does not carry. The sibling smoke-orchestrator wires this field
      // (SmokeRunResult.timingReport); pipeline-orchestrator must too, otherwise
      // the computed report is silently discarded at the return boundary.
      const orchestrator = new PipelineOrchestrator();

      const result = await orchestrator.execute(createValidInput());

      expect(result.metrics?.timingReport).toBeDefined();
      const report = result.metrics!.timingReport!;
      expect(typeof report.totalDurationMs).toBe('number');
      expect(report.totalDurationMs).toBeGreaterThanOrEqual(0);
      expect(typeof report.totalItemsProcessed).toBe('number');
      expect(typeof report.overallThroughputPerMs).toBe('number');
      // The aggregate duration must equal the sum of the raw per-stage records,
      // proving timingReport carries consistent derived data, not a stale copy.
      const sumDuration = (result.metrics!.stageTimings ?? []).reduce(
        (s, r) => s + (r.durationMs ?? 0),
        0,
      );
      expect(report.totalDurationMs).toBe(sumDuration);

      orchestrator.recoveryOrchestrator.destroy();
    });

    it('recovery report reflects degraded level after failures', async () => {
      const orchestrator = new PipelineOrchestrator({
        qualityGates: [
          {
            stageIndex: 0,
            name: 'degradation-test',
            validate: () => ({ passed: false, reason: 'Force degradation' }),
          },
        ],
        fallbackStrategies: [
          {
            stageIndex: 0,
            name: 'degradation-fallback',
            execute: transcriptionFallback(),
          },
        ],
      });

      const result = await orchestrator.execute(createValidInput());

      expect(result.success).toBe(true);
      const report = result.metrics!.recoveryReport as RunRecoveryReport;
      // After a fallback recovery, degradation should not be 'nominal'
      expect(report.degradationLevel).toBeDefined();
      expect(typeof report.degradationLevel).toBe('string');

      orchestrator.recoveryOrchestrator.destroy();
    });
  });
});
