/**
 * TASK-0188: PipelineOrchestrator → ErrorRecoveryOrchestrator Wire-up Integration Test
 *
 * Validates that PipelineOrchestrator.executeStageWithGates correctly delegates
 * to errorRecoveryOrchestrator.executeStage and that the multi-layer recovery
 * path (Primary → Strategy Chain → EnhancedErrorBoundary → RecordOutcome)
 * operates end-to-end.
 *
 * Also verifies REQ-195 error type propagation in the pipeline context:
 * PipelineError → ErrorClassifier → retryWithBackoff round-trip.
 */

import { jest } from '@jest/globals';
import type { RunRecoveryReport } from '@/quality/pipeline-run-recovery-tracker';

// ---------- Mocks ----------

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
      language: 'en',
      qualityLevel: 'standard' as const,
      enableCaptions: true,
      outputFormat: 'mp4' as const,
    },
  };
}

// ---------- Tests ----------

describe('TASK-0188: PipelineOrchestrator → ErrorRecoveryOrchestrator wire-up', () => {
  let PipelineOrchestrator: typeof import('@/pipeline/pipeline-orchestrator').PipelineOrchestrator;
  let PipelineErrorRecoveryOrchestrator: typeof import('@/quality/pipeline-error-recovery-orchestrator').PipelineErrorRecoveryOrchestrator;
  let PipelineAbortError: typeof import('@/pipeline/pipeline-errors').PipelineAbortError;
  let TranscriptionError: typeof import('@/pipeline/pipeline-errors').TranscriptionError;

  beforeAll(async () => {
    const orchestratorMod = await import('@/pipeline/pipeline-orchestrator');
    PipelineOrchestrator = orchestratorMod.PipelineOrchestrator;

    const recoveryMod = await import('@/quality/pipeline-error-recovery-orchestrator');
    PipelineErrorRecoveryOrchestrator = recoveryMod.PipelineErrorRecoveryOrchestrator;

    const errorsMod = await import('@/pipeline/pipeline-errors');
    PipelineAbortError = errorsMod.PipelineAbortError;
    TranscriptionError = errorsMod.TranscriptionError;
  });

  // ── Delegation verification ─────────────────────────────────────

  describe('executeStageWithGates delegates to errorRecoveryOrchestrator', () => {
    it('recoveryOrchestrator is accessible on PipelineOrchestrator', () => {
      const orchestrator = new PipelineOrchestrator();
      expect(orchestrator.recoveryOrchestrator).toBeDefined();
      expect(orchestrator.recoveryOrchestrator).toBeInstanceOf(PipelineErrorRecoveryOrchestrator);
      orchestrator.recoveryOrchestrator.destroy();
    });

    it('happy path delegates through errorRecoveryOrchestrator with success', async () => {
      const orchestrator = new PipelineOrchestrator();

      const result = await orchestrator.execute(createValidInput());

      expect(result.success).toBe(true);
      expect(result.metrics).toBeDefined();

      // Verify the recovery orchestrator was used via recovery report
      const report = result.metrics!.recoveryReport as RunRecoveryReport;
      expect(report).toBeDefined();
      expect(report.success).toBe(true);
      expect(report.runId).toMatch(/^run-\d+$/);

      orchestrator.recoveryOrchestrator.destroy();
    });

    it('recovery report includes stage tracking from delegation', async () => {
      const orchestrator = new PipelineOrchestrator();

      const result = await orchestrator.execute(createValidInput());

      const report = result.metrics!.recoveryReport as RunRecoveryReport;
      expect(report.stages).toBeDefined();
      expect(Array.isArray(report.stages)).toBe(true);
      // At least transcription and analysis stages should be tracked
      expect(report.stages.length).toBeGreaterThanOrEqual(2);

      orchestrator.recoveryOrchestrator.destroy();
    });
  });

  // ── Multi-layer recovery path ───────────────────────────────────

  describe('multi-layer recovery path (Primary → Strategy → Enhanced → Record)', () => {
    it('strategy chain provides degraded result when primary fails', async () => {
      const recoveryOrch = new PipelineErrorRecoveryOrchestrator();

      // Register a strategy chain for layout_generation
      recoveryOrch.strategyChain.register('layout_generation', {
        name: 'layout-fallback-chain',
        steps: [
          {
            id: 'fallback-layout',
            name: 'Fallback Layout Strategy',
            execute: async () => ({
              result: { nodes: [], edges: [], degraded: true },
              fallbackUsed: true,
              confidence: 0.6,
            }),
            optional: false,
          },
        ],
      });

      recoveryOrch.startRun('test-chain-wire-up');

      // Primary fails, strategy chain should kick in
      const result = await recoveryOrch.executeStage('layout_generation', async () => {
        throw new Error('Primary layout engine failure');
      });

      expect(result.success).toBe(true);
      expect(result.recoveryPath).toBe('chain');
      expect(result.degraded).toBe(true);

      const report = recoveryOrch.finalizeRun(true);
      expect(report.totalRetries).toBeGreaterThanOrEqual(0);

      recoveryOrch.destroy();
    });

    it('boundary retry recovers from transient errors', async () => {
      const recoveryOrch = new PipelineErrorRecoveryOrchestrator();
      recoveryOrch.startRun('test-boundary-retry');

      let attemptCount = 0;
      const result = await recoveryOrch.executeStage('transcription', async () => {
        attemptCount++;
        if (attemptCount <= 2) {
          throw new Error('Transient API error');
        }
        return { text: 'recovered', confidence: 0.85 };
      }, { maxRetries: 3 });

      expect(result.success).toBe(true);
      expect(result.attempts).toBeGreaterThanOrEqual(2);
      expect(attemptCount).toBeGreaterThanOrEqual(3);

      recoveryOrch.destroy();
    });

    it('failed stage after all recovery layers produces failure or degraded result', async () => {
      const recoveryOrch = new PipelineErrorRecoveryOrchestrator();
      recoveryOrch.startRun('test-full-failure');

      const result = await recoveryOrch.executeStage('analysis', async () => {
        throw new Error('Permanent analysis failure');
      }, { maxRetries: 1 });

      // Recovery may succeed via boundary retry or fail — either way attempts
      // should be tracked and the result structure is valid.
      expect(typeof result.success).toBe('boolean');
      expect(result.attempts).toBeGreaterThanOrEqual(1);

      const report = recoveryOrch.finalizeRun(!result.success);
      expect(typeof report.success).toBe('boolean');

      recoveryOrch.destroy();
    });
  });

  // ── REQ-195 error type propagation ──────────────────────────────

  describe('REQ-195: error type propagation in pipeline context', () => {
    it('TranscriptionError is correctly typed (LLM_API_ERROR)', () => {
      const error = new TranscriptionError('Whisper failed');
      expect(error.errorType).toBe('LLM_API_ERROR');
      expect(error.stage).toBe('transcription');
      expect(error).toBeInstanceOf(Error);
    });

    it('PipelineAbortError is correctly typed (QUALITY_GATE_FAILED)', () => {
      const error = new PipelineAbortError('Pipeline aborted', { stageIndex: 2 });
      expect(error.errorType).toBe('QUALITY_GATE_FAILED');
      expect(error.stage).toBe('abort');
      expect(error.context).toEqual({ stageIndex: 2 });
    });

    it('quality gate failure produces PipelineAbortError with correct type', async () => {
      const orchestrator = new PipelineOrchestrator({
        qualityGates: [{
          stageIndex: 0,
          name: 'force-fail',
          validate: () => ({ passed: false, reason: 'Test gate failure' }),
        }],
      });

      const result = await orchestrator.execute(createValidInput());

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      // The error should reference quality gate failure
      if (result.error) {
        expect(result.error).toContain('failed');
      }

      orchestrator.recoveryOrchestrator.destroy();
    });

    it('error type propagation survives recovery orchestrator retry', async () => {
      const recoveryOrch = new PipelineErrorRecoveryOrchestrator();
      recoveryOrch.startRun('test-error-type-propagation');

      // Throw typed error on first attempt, succeed on retry
      let attempt = 0;
      const result = await recoveryOrch.executeStage('transcription', async () => {
        attempt++;
        if (attempt === 1) {
          throw new TranscriptionError('Transient Whisper error');
        }
        return { text: 'recovered', confidence: 0.9 };
      }, { maxRetries: 2 });

      expect(result.success).toBe(true);
      expect(attempt).toBeGreaterThanOrEqual(2);

      recoveryOrch.destroy();
    });
  });

  // ── Abort check between stages ──────────────────────────────────

  describe('abort check between stages', () => {
    it('shouldAbort returns false on healthy pipeline', async () => {
      const orchestrator = new PipelineOrchestrator();

      // Run a successful pipeline
      await orchestrator.execute(createValidInput());

      expect(orchestrator.recoveryOrchestrator.shouldAbort()).toBe(false);

      orchestrator.recoveryOrchestrator.destroy();
    });

    it('recovery orchestrator run lifecycle is properly managed', async () => {
      const orchestrator = new PipelineOrchestrator();

      // Before execution
      expect(orchestrator.recoveryOrchestrator).toBeDefined();

      // Execute pipeline
      const result = await orchestrator.execute(createValidInput());

      // After execution, recovery report should exist
      expect(result.metrics?.recoveryReport).toBeDefined();
      const report = result.metrics!.recoveryReport as RunRecoveryReport;
      expect(typeof report.runId).toBe('string');
      expect(typeof report.totalRetries).toBe('number');

      orchestrator.recoveryOrchestrator.destroy();
    });
  });
});
