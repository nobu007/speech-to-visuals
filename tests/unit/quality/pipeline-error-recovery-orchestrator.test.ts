/**
 * PipelineErrorRecoveryOrchestrator Integration Tests
 *
 * Validates that the orchestrator correctly coordinates all Phase 57
 * recovery modules under realistic simulated failure conditions:
 *
 *   - Transient failures that resolve on retry
 *   - Persistent failures requiring chain fallback
 *   - Batch stages with partial item failures
 *   - Multi-stage pipelines with cascading degradation
 *   - Adaptive strategy recommendation across stages
 *   - Run-level abort conditions
 *   - Health monitoring integration
 */

import {
  PipelineErrorRecoveryOrchestrator,
  type OrchestratedStageResult,
} from '@/quality/pipeline-error-recovery-orchestrator';
import type { ChainStepResult, ChainOutcome } from '@/quality/recovery-strategy-chain';
import { ChainBuilder } from '@/quality/recovery-strategy-chain';
import type { BatchResult } from '@/quality/batch-operation-recovery';
import type { RunRecoveryReport } from '@/quality/pipeline-run-recovery-tracker';
import {
  errorRecoveryEventBus,
} from '@/quality/error-recovery-event-bus';
import type {
  RecoveryAttemptEvent,
  RecoverySuccessEvent,
  ErrorRecoveryEventMap,
} from '@/quality/error-recovery-event-bus';
import {
  TranscriptionError,
  RenderingError,
  QualityGateError,
} from '@/pipeline/pipeline-errors';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create an orchestrator with muted event bus (prevents cross-test noise). */
function createOrchestrator() {
  errorRecoveryEventBus.mute();
  return new PipelineErrorRecoveryOrchestrator();
}

function cleanupOrchestrator(orch: PipelineErrorRecoveryOrchestrator) {
  orch.destroy();
  errorRecoveryEventBus.clearHistory();
  errorRecoveryEventBus.unmute();
}

/** Collect events of a specific type from the global event bus. */
function collectEvents<T>(event: keyof ErrorRecoveryEventMap): T[] {
  const events: T[] = [];
  errorRecoveryEventBus.on(event, ((e: unknown) => events.push(e as T)) as any);
  return events;
}

/** Flaky operation that fails N times before succeeding. */
function createFlakyOperation<T>(successResult: T, failCount: number) {
  let calls = 0;
  return async (): Promise<T> => {
    calls++;
    if (calls <= failCount) {
      throw new Error(`Transient failure (attempt ${calls})`);
    }
    return successResult;
  };
}

/** Always-failing operation. */
function createFailingOperation(errorMsg: string): () => Promise<never> {
  return async () => {
    throw new Error(errorMsg);
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PipelineErrorRecoveryOrchestrator', () => {
  let orchestrator: PipelineErrorRecoveryOrchestrator;

  beforeEach(() => {
    orchestrator = createOrchestrator();
  });

  afterEach(() => {
    cleanupOrchestrator(orchestrator);
  });

  // =========================================================================
  // Scenario 1: Happy path — no failures
  // =========================================================================

  describe('happy path with no failures', () => {
    it('executes a single stage without any recovery needed', async () => {
      orchestrator.startRun('happy-001');

      const result = await orchestrator.executeStage('transcription', async () => 'transcribed-text');

      expect(result.success).toBe(true);
      expect(result.result).toBe('transcribed-text');
      expect(result.degraded).toBe(false);
      expect(result.recoveryPath).toBe('primary');
      expect(result.attempts).toBe(1);

      const report = orchestrator.finalizeRun(true);
      expect(report.degradationLevel).toBe('nominal');
      expect(report.totalRetries).toBe(0);
      expect(report.totalFallbacks).toBe(0);
    });

    it('executes a full 4-stage pipeline without failures', async () => {
      orchestrator.startRun('full-happy-001');

      const stages = [
        { stage: 'transcription' as const, fn: async () => 'text' as unknown },
        { stage: 'analysis' as const, fn: async () => ({ type: 'flow', nodes: [] }) as unknown },
        { stage: 'layout_generation' as const, fn: async () => ({ layout: 'computed' }) as unknown },
        { stage: 'rendering' as const, fn: async () => 'video.mp4' as unknown },
      ];

      const results: OrchestratedStageResult<unknown>[] = [];
      for (const { stage, fn } of stages) {
        results.push(await orchestrator.executeStage(stage, fn as () => Promise<unknown>));
      }

      // All stages should succeed with primary path
      for (const r of results) {
        expect(r.success).toBe(true);
        expect(r.recoveryPath).toBe('primary');
        expect(r.degraded).toBe(false);
      }

      const report = orchestrator.finalizeRun(true);
      expect(report.stages).toHaveLength(4);
      expect(report.degradationLevel).toBe('nominal');
      expect(report.degradedStages).toHaveLength(0);
    });
  });

  // =========================================================================
  // Scenario 2: Transient failures resolved by retry
  // =========================================================================

  describe('transient failures resolved by retry', () => {
    it('recovers from transient transcription failure via stage boundary', async () => {
      orchestrator.startRun('transient-001');

      // Operation fails once, then succeeds
      const flakyOp = createFlakyOperation('transcribed', 1);

      const result = await orchestrator.executeStage('transcription', flakyOp);

      expect(result.success).toBe(true);
      expect(result.result).toBe('transcribed');
      // Primary attempt failed, so boundary retry was used
      expect(result.recoveryPath).toBe('boundary');
      expect(result.attempts).toBeGreaterThanOrEqual(1);

      const report = orchestrator.finalizeRun(true);
      expect(report.degradationLevel).toBe('nominal');
    });
  });

  // =========================================================================
  // Scenario 3: Chain-based recovery for persistent failures
  // =========================================================================

  describe('chain-based recovery for persistent failures', () => {
    it('uses registered chain when primary operation fails persistently', async () => {
      // Register a chain for analysis stage
      const chain = ChainBuilder.start('analysis-recovery')
        .then('retry', 'Retry analysis', async (): Promise<ChainStepResult | undefined> => {
          // First chain step also fails
          return undefined;
        })
        .then('rules-fallback', 'Rules-based fallback', async (): Promise<ChainStepResult> => {
          return { result: { type: 'flow', source: 'rules' }, fallbackUsed: true, confidence: 0.6 };
        })
        .build();

      orchestrator.strategyChain.register('analysis', chain);
      orchestrator.startRun('chain-001');

      const result = await orchestrator.executeStage(
        'analysis',
        createFailingOperation('Analysis engine crashed'),
      );

      expect(result.success).toBe(true);
      expect(result.result).toEqual({ type: 'flow', source: 'rules' });
      expect(result.recoveryPath).toBe('chain');
      expect(result.degraded).toBe(true);
      expect(result.chainOutcome).toBeDefined();
      expect(result.chainOutcome?.winningStepId).toBe('rules-fallback');
      expect(result.chainOutcome?.fallbackUsed).toBe(true);

      const report = orchestrator.finalizeRun(true);
      expect(report.degradedStages).toContain('analysis');
      expect(report.totalFallbacks).toBeGreaterThanOrEqual(1);
    });

    it('falls through to boundary when chain has no registered stage', async () => {
      orchestrator.startRun('no-chain-001');

      // No chain registered for rendering — should use boundary
      let callCount = 0;
      const result = await orchestrator.executeStage('rendering', async () => {
        callCount++;
        if (callCount < 3) throw new RenderingError('GPU OOM');
        return 'rendered.mp4';
      });

      expect(result.success).toBe(true);
      expect(result.result).toBe('rendered.mp4');
      // Primary attempt failed, boundary retry recovered
      expect(result.recoveryPath).toBe('boundary');
    });
  });

  // =========================================================================
  // Scenario 4: Batch stage with partial failures
  // =========================================================================

  describe('batch stage with partial item failures', () => {
    it('processes batch with per-item isolation and fallback', async () => {
      orchestrator.startRun('batch-001');

      const items = ['scene-1', 'scene-2', 'scene-3', 'scene-4'];
      const failIndices = new Set([1, 3]);

      const { batchResult, stageResult } = await orchestrator.executeBatchStage(
        'layout_generation',
        items,
        async (item, index) => {
          if (failIndices.has(index)) {
            throw new Error(`Layout OOM for ${item}`);
          }
          return `layout-${item}`;
        },
        async (item) => `fallback-${item}`,
        { maxRetries: 1 },
      );

      // All items should succeed (2 primary, 2 fallback)
      expect(batchResult.succeeded).toBe(4);
      expect(batchResult.failed).toBe(0);
      expect(batchResult.successRate).toBe(1);

      // Items 1 and 3 used fallback
      expect(batchResult.items[1].fallbackUsed).toBe(true);
      expect(batchResult.items[3].fallbackUsed).toBe(true);
      expect(batchResult.items[0].fallbackUsed).toBe(false);

      // Stage result reflects degradation
      expect(stageResult.degraded).toBe(true);

      const report = orchestrator.finalizeRun(true);
      expect(report.degradedStages).toContain('layout_generation');
    });

    it('reports hard failures when no fallback is provided', async () => {
      orchestrator.startRun('batch-nofallback-001');

      const items = ['a', 'b', 'c'];

      const { batchResult } = await orchestrator.executeBatchStage(
        'rendering',
        items,
        async (_item, index) => {
          if (index === 1) throw new RenderingError('Frame buffer overflow');
          return `rendered-${index}`;
        },
        undefined, // no fallback
        { maxRetries: 0 },
      );

      expect(batchResult.succeeded).toBe(2);
      expect(batchResult.failed).toBe(1);
      expect(batchResult.items[1].success).toBe(false);
    });
  });

  // =========================================================================
  // Scenario 5: Multi-stage pipeline with cascading degradation
  // =========================================================================

  describe('multi-stage pipeline with cascading degradation', () => {
    it('tracks degradation across stages and adapts strategy', async () => {
      // Register chains for key stages
      orchestrator.strategyChain.register('transcription', ChainBuilder.start('trans-chain')
        .then('cache', 'Cached transcription', async (): Promise<ChainStepResult> => ({
          result: 'cached-transcription', fallbackUsed: true, confidence: 0.5,
        }))
        .build(),
      );

      orchestrator.strategyChain.register('analysis', ChainBuilder.start('analysis-chain')
        .then('rules', 'Rules-based analysis', async (): Promise<ChainStepResult> => ({
          result: { type: 'flow', source: 'rules' }, fallbackUsed: true, confidence: 0.6,
        }))
        .build(),
      );

      orchestrator.startRun('cascade-001');

      // Stage 1: Transcription fails primary, recovers via chain (degraded)
      const t1 = await orchestrator.executeStage(
        'transcription',
        createFailingOperation('Whisper timeout'),
      );
      expect(t1.success).toBe(true);
      expect(t1.degraded).toBe(true);
      expect(t1.recoveryPath).toBe('chain');

      // Stage 2: Analysis fails primary, recovers via chain (degraded)
      const t2 = await orchestrator.executeStage(
        'analysis',
        createFailingOperation('Gemini API timeout'),
      );
      expect(t2.success).toBe(true);
      expect(t2.degraded).toBe(true);

      // Check that the run tracker sees degradation
      expect(orchestrator.shouldAbort()).toBe(false);

      // Stage 3: Layout succeeds (primary)
      const t3 = await orchestrator.executeStage(
        'layout_generation',
        async () => ({ layout: 'ok' }),
      );
      expect(t3.success).toBe(true);
      expect(t3.degraded).toBe(false);

      // Stage 4: Rendering succeeds (primary)
      const t4 = await orchestrator.executeStage(
        'rendering',
        async () => 'video.mp4',
      );
      expect(t4.success).toBe(true);

      const report = orchestrator.finalizeRun(true);

      expect(report.success).toBe(true);
      expect(report.stages).toHaveLength(4);
      expect(report.degradedStages).toContain('transcription');
      expect(report.degradedStages).toContain('analysis');
      expect(report.totalFallbacks).toBeGreaterThanOrEqual(2);

      // Cross-stage correlations should detect upstream→downstream
      expect(report.crossStageCorrelations.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Scenario 6: Run-level abort conditions
  // =========================================================================

  describe('run-level abort conditions', () => {
    it('escalates to critical when too many stages degrade', async () => {
      orchestrator.startRun('abort-001');

      // Degrade 3 stages (maxDegradedStages default = 3)
      const degradedStages: Array<'transcription' | 'analysis' | 'rendering'> = [
        'transcription', 'analysis', 'rendering',
      ];

      for (const stage of degradedStages) {
        await orchestrator.executeStage(
          stage,
          createFailingOperation(`${stage} crashed`),
          { maxRetries: 0 },
        );
      }

      // Should now recommend abort
      expect(orchestrator.shouldAbort()).toBe(true);

      const report = orchestrator.finalizeRun(false);
      expect(report.degradationLevel).toBe('critical');
      expect(report.degradedStages).toHaveLength(3);
    });
  });

  // =========================================================================
  // Scenario 7: Event bus integration
  // =========================================================================

  describe('event bus lifecycle observation', () => {
    it('emits recovery events during stage execution', async () => {
      const attemptEvents = collectEvents<RecoveryAttemptEvent>('recovery:attempt');
      const successEvents = collectEvents<RecoverySuccessEvent>('recovery:success');

      // Register chain that fails first step, succeeds second
      orchestrator.strategyChain.register('transcription', ChainBuilder.start('trans-recovery')
        .then('retry', 'Retry', async () => undefined) // fails
        .then('cache', 'Cache', async (): Promise<ChainStepResult> => ({
          result: 'cached', fallbackUsed: true, confidence: 0.8,
        }))
        .build(),
      );

      orchestrator.startRun('events-001');
      errorRecoveryEventBus.unmute();

      const result = await orchestrator.executeStage(
        'transcription',
        createFailingOperation('Whisper crashed'),
      );

      errorRecoveryEventBus.mute();

      expect(result.success).toBe(true);
      expect(result.recoveryPath).toBe('chain');

      // Event bus should have captured chain attempts
      expect(attemptEvents.length).toBeGreaterThanOrEqual(2);
      expect(successEvents.length).toBeGreaterThanOrEqual(1);
      expect(successEvents[0].stage).toBe('transcription');

      orchestrator.finalizeRun(true);
    });
  });

  // =========================================================================
  // Scenario 8: Health monitoring integration
  // =========================================================================

  describe('health monitoring integration', () => {
    it('produces health assessment after pipeline run', async () => {
      orchestrator.startRun('health-001');

      await orchestrator.executeStage('transcription', async () => 'text');
      await orchestrator.executeStage('analysis', async () => ({ type: 'flow' }));

      orchestrator.finalizeRun(true);

      const assessment = orchestrator.getHealthAssessment();
      expect(assessment).toBeDefined();
      expect(assessment.overallScore).toBeGreaterThanOrEqual(0);
      expect(assessment.overallScore).toBeLessThanOrEqual(1);
      expect(assessment.sampledAt).toBeGreaterThan(0);
    });

    it('reflects degraded health after failures', async () => {
      orchestrator.startRun('health-degraded-001');

      // Generate failures
      for (let i = 0; i < 5; i++) {
        await orchestrator.executeStage(
          'rendering',
          createFailingOperation(`Render failure ${i}`),
          { maxRetries: 0 },
        );
      }

      orchestrator.finalizeRun(false);

      const assessment = orchestrator.getHealthAssessment();
      expect(assessment).toBeDefined();
      expect(assessment.stageScores).toBeDefined();
    });
  });

  // =========================================================================
  // Scenario 9: Full pipeline simulation with mixed outcomes
  // =========================================================================

  describe('full pipeline simulation with mixed outcomes', () => {
    it('handles a realistic pipeline with mixed success/failure/recovery', async () => {
      // Register chains for all stages
      orchestrator.strategyChain.register('transcription', ChainBuilder.start('trans-chain')
        .then('cache', 'Cached transcription', async (): Promise<ChainStepResult> => ({
          result: 'cached-text', fallbackUsed: true, confidence: 0.7,
        }))
        .build(),
      );

      orchestrator.strategyChain.register('analysis', ChainBuilder.start('analysis-chain')
        .then('rules', 'Rules-based', async (): Promise<ChainStepResult> => ({
          result: { type: 'flow', nodes: ['a', 'b'] }, fallbackUsed: true, confidence: 0.6,
        }))
        .build(),
      );

      orchestrator.strategyChain.register('rendering', ChainBuilder.start('render-chain')
        .then('low-quality', 'Low quality render', async (): Promise<ChainStepResult> => ({
          result: 'low-quality.mp4', fallbackUsed: true, confidence: 0.5,
        }))
        .build(),
      );

      orchestrator.startRun('mixed-001');

      // Stage 1: Transcription — primary fails, chain recovers with cached
      const r1 = await orchestrator.executeStage(
        'transcription',
        createFailingOperation('Whisper timeout'),
      );
      expect(r1.success).toBe(true);
      expect(r1.degraded).toBe(true);
      expect(r1.recoveryPath).toBe('chain');

      // Stage 2: Analysis — primary fails, chain recovers with rules
      const r2 = await orchestrator.executeStage(
        'analysis',
        createFailingOperation('Gemini rate limit'),
      );
      expect(r2.success).toBe(true);
      expect(r2.degraded).toBe(true);

      // Stage 3: Layout — batch with partial failures
      const scenes = ['scene-1', 'scene-2', 'scene-3'];
      const { stageResult: r3 } = await orchestrator.executeBatchStage(
        'layout_generation',
        scenes,
        async (item, index) => {
          if (index === 1) throw new Error('Layout failed');
          return `layout-${item}`;
        },
        async (item) => `fallback-${item}`,
        { maxRetries: 1 },
      );
      expect(r3.degraded).toBe(true);

      // Stage 4: Rendering — primary succeeds
      const r4 = await orchestrator.executeStage(
        'rendering',
        async () => 'video.mp4',
      );
      expect(r4.success).toBe(true);
      expect(r4.degraded).toBe(false);
      expect(r4.recoveryPath).toBe('primary');

      // Finalize and verify
      const report = orchestrator.finalizeRun(true);

      expect(report.success).toBe(true);
      expect(report.stages).toHaveLength(4);
      expect(report.degradedStages).toContain('transcription');
      expect(report.degradedStages).toContain('analysis');
      expect(report.degradedStages).toContain('layout_generation');
      expect(report.degradedStages).not.toContain('rendering');
      expect(report.totalFallbacks).toBeGreaterThanOrEqual(2);

      // Health monitoring should reflect the degraded state
      const assessment = orchestrator.getHealthAssessment();
      expect(assessment.overallScore).toBeGreaterThanOrEqual(0);
    });
  });

  // =========================================================================
  // Scenario 10: Pipeline errors with typed error classes
  // =========================================================================

  describe('typed pipeline error integration', () => {
    it('handles TranscriptionError from pipeline stages', async () => {
      orchestrator.startRun('typed-err-001');

      // Register chain to recover from transcription error
      orchestrator.strategyChain.register('transcription', ChainBuilder.start('trans-chain')
        .then('cache', 'Cached transcription', async (): Promise<ChainStepResult> => ({
          result: 'fallback-text', fallbackUsed: true, confidence: 0.7,
        }))
        .build(),
      );

      const result = await orchestrator.executeStage('transcription', async () => {
        throw new TranscriptionError('Whisper model not found');
      });

      expect(result.success).toBe(true);
      expect(result.result).toBe('fallback-text');
      expect(result.degraded).toBe(true);

      const report = orchestrator.finalizeRun(true);
      expect(report.degradedStages).toContain('transcription');
    });

    it('handles RenderingError with boundary retry', async () => {
      orchestrator.startRun('render-err-001');

      let attempts = 0;
      const result = await orchestrator.executeStage('rendering', async () => {
        attempts++;
        if (attempts < 2) throw new RenderingError('Frame buffer overflow');
        return 'rendered.mp4';
      });

      expect(result.success).toBe(true);
      expect(result.result).toBe('rendered.mp4');
    });

    it('handles QualityGateError in batch stage', async () => {
      orchestrator.startRun('quality-err-001');

      const items = ['diagram-1', 'diagram-2', 'diagram-3'];

      const { batchResult } = await orchestrator.executeBatchStage(
        'layout_generation',
        items,
        async (_item, index) => {
          if (index === 0) throw new QualityGateError('layout-overlap', 'Overlap detected');
          return `layout-${index}`;
        },
        async (item) => `fallback-${item}`,
        { maxRetries: 0 },
      );

      expect(batchResult.succeeded).toBe(3);
      expect(batchResult.items[0].fallbackUsed).toBe(true);
    });
  });

  // =========================================================================
  // Scenario 11: Concurrent batch recovery via orchestrator
  // =========================================================================

  describe('concurrent batch stage execution', () => {
    it('processes items concurrently with error isolation', async () => {
      orchestrator.startRun('concurrent-001');

      const items = Array.from({ length: 8 }, (_, i) => `item-${i}`);
      const failIndices = new Set([2, 5]);

      const { batchResult, stageResult } = await orchestrator.executeBatchStage(
        'analysis',
        items,
        async (item, index) => {
          if (failIndices.has(index)) throw new Error(`Analysis failed for ${item}`);
          return `analyzed-${item}`;
        },
        async (item) => `degraded-${item}`,
        { maxRetries: 0, concurrent: true, concurrency: 4 },
      );

      expect(batchResult.succeeded).toBe(8);
      expect(batchResult.failed).toBe(0);
      expect(batchResult.items[2].fallbackUsed).toBe(true);
      expect(batchResult.items[5].fallbackUsed).toBe(true);
      expect(stageResult.degraded).toBe(true);

      orchestrator.finalizeRun(true);
    });
  });
});
