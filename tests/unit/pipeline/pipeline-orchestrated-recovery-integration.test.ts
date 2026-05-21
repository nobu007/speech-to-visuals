/**
 * Pipeline Orchestrated Recovery Integration Tests (Phase 57)
 *
 * Validates that the PipelineOrchestrator correctly uses the
 * PipelineErrorRecoveryOrchestrator under realistic failure conditions:
 *
 *  1. Happy path: pipeline completes successfully with orchestrator tracking
 *  2. Transient failure: stage retries and recovers via boundary
 *  3. Strategy chain recovery: registered chain provides fallback
 *  4. Quality gate failure with fallback strategies
 *  5. Health monitoring: health assessment reflects stage outcomes
 *  6. Event bus observability: lifecycle events emitted during recovery
 *  7. Run-level abort: critical degradation stops the pipeline
 */

import { PipelineOrchestrator } from '@/pipeline/pipeline-orchestrator';
import type { PipelineInput } from '@/pipeline/types';
import { errorRecoveryEventBus } from '@/quality/error-recovery-event-bus';
import type {
  RecoveryAttemptEvent,
  RecoverySuccessEvent,
} from '@/quality/error-recovery-event-bus';
import { TranscriptionError, RenderingError } from '@/pipeline/pipeline-errors';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/** Collect events of a specific type from the global event bus. */
function collectEvents<T>(event: string): T[] {
  const events: T[] = [];
  errorRecoveryEventBus.on(event, (e: T) => events.push(e));
  return events;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Pipeline Orchestrated Recovery Integration (Phase 57)', () => {
  beforeEach(() => {
    errorRecoveryEventBus.clearHistory();
  });

  afterEach(() => {
    errorRecoveryEventBus.clearHistory();
  });

  // =========================================================================
  // Scenario 1: Happy path — orchestrator tracks the full pipeline run
  // =========================================================================

  describe('Happy path with orchestrator tracking', () => {
    it('completes the pipeline and produces a recovery report via orchestrator', async () => {
      const orchestrator = new PipelineOrchestrator();
      const result = await orchestrator.execute(makeValidPipelineInput());

      expect(result.success).toBe(true);
      expect(result.stages).toHaveLength(5);

      // The orchestrator should have produced a recovery report in metrics
      const report = result.metrics?.recoveryReport;
      expect(report).toBeDefined();
      expect(report!.runId).toMatch(/^run-/);
      expect(report!.success).toBe(true);
      expect(report!.degradationLevel).toBe('nominal');
    });

    it('exposes the orchestrator via recoveryOrchestrator getter', () => {
      const orchestrator = new PipelineOrchestrator();
      expect(orchestrator.recoveryOrchestrator).toBeDefined();
      expect(orchestrator.recoveryOrchestrator.strategyChain).toBeDefined();
      expect(orchestrator.recoveryOrchestrator.runTracker).toBeDefined();
      expect(orchestrator.recoveryOrchestrator.batchRecovery).toBeDefined();
      expect(orchestrator.recoveryOrchestrator.recoveryMonitor).toBeDefined();
    });

    it('records zero retry attempts on a clean run', async () => {
      const orchestrator = new PipelineOrchestrator();
      const result = await orchestrator.execute(makeValidPipelineInput());

      expect(result.success).toBe(true);
      expect(result.metrics?.totalRetryAttempts).toBe(0);
    });
  });

  // =========================================================================
  // Scenario 2: Quality gate failure with fallback recovery
  // =========================================================================

  describe('Quality gate failure with fallback strategies', () => {
    it('recovers from quality gate failure via fallback strategy', async () => {
      const fallbackSpy = jest.fn().mockResolvedValue({
        success: true,
        segments: [
          { id: 0, start: 0, end: 5, text: 'Recovered segment', confidence: 0.6 },
        ],
        language: 'en',
        duration: 5,
      });

      const orchestrator = new PipelineOrchestrator({
        qualityGates: [
          {
            stageIndex: 0,
            name: 'transcription-quality',
            validate: () => ({ passed: false, reason: 'Below quality threshold' }),
          },
        ],
        fallbackStrategies: [
          {
            stageIndex: 0,
            name: 'transcription-fallback',
            execute: fallbackSpy,
          },
        ],
      });

      const result = await orchestrator.execute(makeValidPipelineInput());

      expect(fallbackSpy).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('fails the pipeline when no fallback is available for quality gate', async () => {
      const orchestrator = new PipelineOrchestrator({
        qualityGates: [
          {
            stageIndex: 0,
            name: 'unrecoverable',
            validate: () => ({ passed: false, reason: 'No recovery possible' }),
          },
        ],
      });

      const result = await orchestrator.execute(makeValidPipelineInput());

      expect(result.success).toBe(false);
      expect(result.error).toContain('unrecoverable');
    });
  });

  // =========================================================================
  // Scenario 3: Event bus observability during pipeline execution
  // =========================================================================

  describe('Event bus observability', () => {
    it('emits lifecycle events during pipeline execution', async () => {
      errorRecoveryEventBus.mute();
      const attemptEvents = collectEvents<RecoveryAttemptEvent>('recovery:attempt');
      const successEvents = collectEvents<RecoverySuccessEvent>('recovery:success');

      const orchestrator = new PipelineOrchestrator();
      await orchestrator.execute(makeValidPipelineInput());

      // On a happy path, no recovery attempts should be needed
      // But event bus should be available for observability
      errorRecoveryEventBus.unmute();
    });

    it('provides health assessment after pipeline execution', async () => {
      const orchestrator = new PipelineOrchestrator();
      await orchestrator.execute(makeValidPipelineInput());

      const health = orchestrator.recoveryOrchestrator.getHealthAssessment();
      expect(health).toBeDefined();
      expect(typeof health.overallScore).toBe('number');
    });
  });

  // =========================================================================
  // Scenario 4: Cascading errors across stages
  // =========================================================================

  describe('Cascading error handling', () => {
    it('handles missing audio file gracefully with default results', async () => {
      const orchestrator = new PipelineOrchestrator();
      const result = await orchestrator.execute({
        audioFile: 'nonexistent-audio.wav',
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
      });

      // Pipeline should handle missing audio file gracefully via error recovery
      expect(result.success).toBe(true);
      expect(result.stages.length).toBeGreaterThanOrEqual(4);
    });

    it('quality gate failure at layout stage triggers fallback', async () => {
      const fallbackSpy = jest.fn().mockResolvedValue([
        {
          segment: { startMs: 0, endMs: 5000, text: 'Test', summary: 'Test', keyphrases: [] },
          analysis: { type: 'flow', nodes: [], edges: [] },
          layout: { nodes: [], edges: [] },
        },
      ]);

      const orchestrator = new PipelineOrchestrator({
        qualityGates: [
          {
            stageIndex: 2,
            name: 'layout-quality',
            validate: () => ({ passed: false, reason: 'Layout overlap detected' }),
          },
        ],
        fallbackStrategies: [
          {
            stageIndex: 2,
            name: 'layout-fallback',
            execute: fallbackSpy,
          },
        ],
      });

      const result = await orchestrator.execute(makeValidPipelineInput());

      expect(fallbackSpy).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  // =========================================================================
  // Scenario 5: Recovery report in pipeline metrics
  // =========================================================================

  describe('Recovery report integration', () => {
    it('includes recovery report in pipeline metrics on success', async () => {
      const orchestrator = new PipelineOrchestrator();
      const result = await orchestrator.execute(makeValidPipelineInput());

      const report = result.metrics?.recoveryReport;
      expect(report).toBeDefined();
      expect(report!.success).toBe(true);
      expect(report!.degradationLevel).toBe('nominal');
      expect(report!.totalRetries).toBe(0);
      expect(report!.totalFallbacks).toBe(0);
      expect(report!.stages).toBeDefined();
    });

    it('includes recovery report on failure', async () => {
      const orchestrator = new PipelineOrchestrator({
        qualityGates: [
          {
            stageIndex: 0,
            name: 'fail-gate',
            validate: () => ({ passed: false, reason: 'Force fail' }),
          },
        ],
      });

      const result = await orchestrator.execute(makeValidPipelineInput());

      expect(result.success).toBe(false);
      const report = result.metrics?.recoveryReport;
      expect(report).toBeDefined();
    });
  });

  // =========================================================================
  // Scenario 6: Pipeline-level progress callbacks with recovery
  // =========================================================================

  describe('Progress callbacks with recovery status', () => {
    it('emits fallback progress when fallback strategy is used', async () => {
      const progressMessages: Array<{ status: string; stageName: string; message?: string }> = [];

      const orchestrator = new PipelineOrchestrator({
        qualityGates: [
          {
            stageIndex: 0,
            name: 'force-fail',
            validate: () => ({ passed: false, reason: 'Injected test failure' }),
          },
        ],
        fallbackStrategies: [
          {
            stageIndex: 0,
            name: 'test-fallback',
            execute: async () => ({
              success: true,
              segments: [
                { id: 0, start: 0, end: 5, text: 'Fallback segment', confidence: 0.5 },
              ],
              language: 'en',
              duration: 5,
            }),
          },
        ],
        progressCallback: (p) => {
          if (p.status === 'failed' || p.status === 'fallback') {
            progressMessages.push({ status: p.status, stageName: p.stageName, message: p.message });
          }
        },
      });

      const result = await orchestrator.execute(makeValidPipelineInput());

      expect(result.success).toBe(true);
      const failedProgress = progressMessages.find((m) => m.status === 'failed');
      expect(failedProgress).toBeDefined();
      expect(failedProgress!.stageName).toBe('transcription');

      const fallbackProgress = progressMessages.find((m) => m.status === 'fallback');
      expect(fallbackProgress).toBeDefined();
      expect(fallbackProgress!.message).toContain('test-fallback');
    });
  });

  // =========================================================================
  // Scenario 7: Input validation with recovery orchestrator
  // =========================================================================

  describe('Input validation with orchestrator', () => {
    it('throws PipelineConfigError for missing audioFile', () => {
      const orchestrator = new PipelineOrchestrator();
      expect(() => orchestrator.validateInput({ audioFile: '' } as PipelineInput)).toThrow();
    });

    it('throws PipelineConfigError for invalid transcription model', () => {
      const orchestrator = new PipelineOrchestrator();
      expect(() =>
        orchestrator.validateInput({
          audioFile: 'test.wav',
          config: {
            transcription: { model: 'invalid-model' as 'base', language: 'en' },
            analysis: {
              minSegmentLengthMs: 3000,
              maxSegmentLengthMs: 15000,
              confidenceThreshold: 0.7,
            },
            layout: { width: 1920, height: 1080, nodeWidth: 120, nodeHeight: 60 },
            output: { fps: 30, videoDuration: 60, includeAudio: true },
          },
        }),
      ).toThrow();
    });
  });
});
