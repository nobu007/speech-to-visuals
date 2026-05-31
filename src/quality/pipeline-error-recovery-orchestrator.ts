/**
 * PipelineErrorRecoveryOrchestrator: Top-level coordinator that wires all
 * Phase 57 error recovery modules into a unified pipeline run flow.
 *
 * Instead of manually coordinating RecoveryStrategyChain, BatchOperationRecovery,
 * PipelineRunRecoveryTracker, ErrorRecoveryMonitor, and ErrorRecoveryEventBus,
 * the orchestrator provides a single `executeStage()` method that:
 *
 *  1. Checks the run tracker for adaptive strategy recommendations
 *  2. Uses the strategy chain for sequential fallback
 *  3. Falls back to EnhancedErrorRecovery's stage boundary
 *  4. Records outcomes in the run tracker
 *  5. Emits lifecycle events for observability
 *
 * Usage:
 * ```ts
 * const orchestrator = new PipelineErrorRecoveryOrchestrator();
 * orchestrator.startRun('run-001');
 *
 * const result = await orchestrator.executeStage('transcription', async () => {
 *   return await transcribe(audioBuffer);
 * });
 *
 * orchestrator.finalizeRun(result.success);
 * ```
 */

import { EnhancedErrorRecovery } from './enhanced-error-recovery';
import { RecoveryStrategyChain, type ChainOutcome, type ChainConfig } from './recovery-strategy-chain';
import { BatchOperationRecovery, type BatchResult, type ItemProcessor, type FallbackProvider } from './batch-operation-recovery';
import { PipelineRunRecoveryTracker, type RecoveryStage, type RunRecoveryReport, type RecoveryRecommendation, type RunRecoveryConfig } from './pipeline-run-recovery-tracker';
import { ErrorRecoveryHealthTracker, type HealthAssessment } from './error-recovery-health-tracker';
import { ErrorRecoveryMonitor } from './error-recovery-monitor';
import { errorRecoveryEventBus } from './error-recovery-event-bus';
import { logger } from '@/utils/logger';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Result of a single stage execution through the orchestrator. */
export interface OrchestratedStageResult<T> {
  /** Whether the stage produced a usable result (possibly degraded). */
  success: boolean;
  /** The stage output, or undefined on total failure. */
  result?: T;
  /** Whether a fallback/degraded path was used. */
  degraded: boolean;
  /** Which recovery path was used. */
  recoveryPath: 'primary' | 'chain' | 'boundary' | 'none';
  /** Number of attempts (primary + retries). */
  attempts: number;
  /** Wall-clock time spent on this stage (ms). */
  durationMs: number;
  /** The strategy chain outcome, if the chain was used. */
  chainOutcome?: ChainOutcome;
}

/** Configuration for the orchestrator. */
export interface OrchestratorConfig {
  /** Per-stage strategy chain configurations. */
  chainConfigs?: Record<string, ChainConfig & { stage: string }>;
  /** Run-level recovery config passed to PipelineRunRecoveryTracker. */
  runConfig?: Partial<RunRecoveryConfig>;
  /** Whether to use the strategy chain before falling back to boundary. Default true. */
  useChainFirst: boolean;
  /** Maximum time budget per stage (ms). Default 30 000. */
  stageTimeBudgetMs: number;
}

const DEFAULT_ORCHESTRATOR_CONFIG: Readonly<Omit<OrchestratorConfig, 'chainConfigs' | 'runConfig'>> = {
  useChainFirst: true,
  stageTimeBudgetMs: 30_000,
};

// ---------------------------------------------------------------------------
// PipelineErrorRecoveryOrchestrator
// ---------------------------------------------------------------------------

export class PipelineErrorRecoveryOrchestrator {
  private readonly recovery: EnhancedErrorRecovery;
  private readonly chain: RecoveryStrategyChain;
  private readonly batch: BatchOperationRecovery;
  private readonly tracker: PipelineRunRecoveryTracker;
  private readonly healthTracker: ErrorRecoveryHealthTracker;
  private readonly monitor: ErrorRecoveryMonitor;
  private readonly config: OrchestratorConfig;

  constructor(config?: Partial<OrchestratorConfig>) {
    this.config = { ...DEFAULT_ORCHESTRATOR_CONFIG, ...config };

    this.recovery = new EnhancedErrorRecovery();
    this.chain = new RecoveryStrategyChain();
    this.batch = new BatchOperationRecovery();
    this.tracker = new PipelineRunRecoveryTracker();
    this.healthTracker = new ErrorRecoveryHealthTracker(this.recovery);
    this.monitor = new ErrorRecoveryMonitor(this.recovery, {
      intervalMs: 60_000,
      autoStart: false,
    });
  }

  // -----------------------------------------------------------------------
  // Accessors
  // -----------------------------------------------------------------------

  /** The underlying RecoveryStrategyChain — register chains via this. */
  get strategyChain(): RecoveryStrategyChain {
    return this.chain;
  }

  /** The underlying PipelineRunRecoveryTracker. */
  get runTracker(): PipelineRunRecoveryTracker {
    return this.tracker;
  }

  /** The underlying BatchOperationRecovery. */
  get batchRecovery(): BatchOperationRecovery {
    return this.batch;
  }

  /** The underlying ErrorRecoveryMonitor. */
  get recoveryMonitor(): ErrorRecoveryMonitor {
    return this.monitor;
  }

  /** The underlying EnhancedErrorRecovery instance. */
  get enhancedRecovery(): EnhancedErrorRecovery {
    return this.recovery;
  }

  // -----------------------------------------------------------------------
  // Run lifecycle
  // -----------------------------------------------------------------------

  /**
   * Start a new pipeline run. Must be called before `executeStage()`.
   */
  startRun(runId: string, runConfig?: Partial<RunRecoveryConfig>): void {
    this.tracker.startRun(runId, runConfig ?? this.config.runConfig);
    logger.info(`[Orchestrator] Started pipeline run "${runId}"`);
  }

  /**
   * Execute a single pipeline stage with full multi-layer recovery.
   *
   * Recovery path:
   *  1. Try primary operation directly
   *  2. If chain registered for this stage → try chain recovery
   *  3. If chain fails or not registered → try EnhancedErrorRecovery boundary
   *  4. Record outcome in run tracker
   */
  async executeStage<T>(
    stage: RecoveryStage,
    operation: () => Promise<T>,
    options?: {
      maxRetries?: number;
      fallback?: () => Promise<T>;
    },
  ): Promise<OrchestratedStageResult<T>> {
    const startTime = performance.now();
    this.tracker.setActiveStage(stage);

    // Get adaptive recommendation from run tracker
    const recommendation = this.getRecommendation(stage);

    // Phase 1: Try primary operation directly
    try {
      const result = await operation();
      const durationMs = performance.now() - startTime;

      this.tracker.recordStageOutcome(stage, {
        attemptCount: 1,
        fallbackUsed: false,
        degraded: false,
        durationMs,
      });

      return {
        success: true,
        result,
        degraded: false,
        recoveryPath: 'primary',
        attempts: 1,
        durationMs,
      };
    } catch (primaryError) {
      // Primary failed — enter recovery
      logger.warn(`[Orchestrator] Primary stage "${stage}" failed, entering recovery`, { error: String(primaryError) });
    }

    // Phase 2: Strategy chain recovery (if registered)
    if (this.config.useChainFirst && this.chain.getChain(stage)) {
      const chainOutcome = await this.chain.execute(stage, {
        stage,
        timeBudgetMs: this.config.stageTimeBudgetMs,
      });

      if (chainOutcome.success && chainOutcome.result !== undefined) {
        const durationMs = performance.now() - startTime;

        this.tracker.recordStageOutcome(stage, {
          attemptCount: chainOutcome.stepsAttempted + 1, // +1 for the initial attempt
          recoveryStrategy: chainOutcome.winningStepId ?? undefined,
          fallbackUsed: chainOutcome.fallbackUsed,
          degraded: chainOutcome.fallbackUsed || chainOutcome.confidence < 0.7,
          durationMs,
        });

        return {
          success: true,
          result: chainOutcome.result as T,
          degraded: chainOutcome.fallbackUsed || chainOutcome.confidence < 0.7,
          recoveryPath: 'chain',
          attempts: chainOutcome.stepsAttempted + 1,
          durationMs,
          chainOutcome,
        };
      }
    }

    // Phase 3: EnhancedErrorRecovery stage boundary
    const maxRetries = options?.maxRetries ?? recommendation.maxRetries;
    const boundaryResult = await this.recovery.createStageErrorBoundary(
      stage,
      operation,
      {
        maxRetries,
        fallback: options?.fallback,
      },
    );

    const durationMs = performance.now() - startTime;
    const degraded = boundaryResult.recoveryAttempted || !boundaryResult.success;

    this.tracker.recordStageOutcome(stage, {
      attemptCount: boundaryResult.attempts,
      recoveryStrategy: boundaryResult.recoveryStrategy,
      fallbackUsed: boundaryResult.recoveryAttempted,
      degraded,
      durationMs,
    });

    return {
      success: boundaryResult.success,
      result: boundaryResult.result as T | undefined,
      degraded,
      recoveryPath: boundaryResult.success ? 'boundary' : 'none',
      attempts: boundaryResult.attempts,
      durationMs,
    };
  }

  /**
   * Execute a batch stage with per-item error isolation.
   *
   * Each item is processed independently; failures are isolated and
   * fallbacks applied per-item. The overall stage outcome reflects
   * aggregate success.
   */
  async executeBatchStage<Input, Output>(
    stage: RecoveryStage,
    items: Input[],
    processor: ItemProcessor<Input, Output>,
    fallback: FallbackProvider<Input, Output> | undefined,
    config?: { maxRetries?: number; concurrent?: boolean; concurrency?: number },
  ): Promise<{ batchResult: BatchResult<Output>; stageResult: OrchestratedStageResult<BatchResult<Output>> }> {
    const startTime = performance.now();
    this.tracker.setActiveStage(stage);

    const recommendation = this.getRecommendation(stage);

    const batchResult = await this.batch.process(items, processor, fallback, {
      stage,
      maxRetries: config?.maxRetries ?? recommendation.maxRetries,
      concurrent: config?.concurrent ?? false,
      concurrency: config?.concurrency ?? 4,
    });

    const durationMs = performance.now() - startTime;
    const hasFallbacks = batchResult.items.some((item) => item.fallbackUsed);
    const degraded = hasFallbacks || batchResult.successRate < 1;

    this.tracker.recordStageOutcome(stage, {
      attemptCount: batchResult.items.reduce((sum, item) => sum + item.attempts, 0),
      fallbackUsed: hasFallbacks,
      degraded,
      durationMs,
    });

    const stageResult: OrchestratedStageResult<BatchResult<Output>> = {
      success: batchResult.failed === 0,
      result: batchResult,
      degraded,
      recoveryPath: batchResult.failed === 0 && !hasFallbacks ? 'primary' : 'chain',
      attempts: batchResult.items.reduce((sum, item) => sum + item.attempts, 0),
      durationMs,
    };

    return { batchResult, stageResult };
  }

  /**
   * Finalize the current pipeline run and generate a report.
   */
  finalizeRun(success: boolean): RunRecoveryReport {
    const report = this.tracker.finalizeRun(success);

    // Take a final health sample
    this.monitor.sampleNow();

    logger.info(
      `[Orchestrator] Finalized run "${report.runId}": success=${success} ` +
      `degradation=${report.degradationLevel} retries=${report.totalRetries} ` +
      `fallbacks=${report.totalFallbacks}`,
    );

    return report;
  }

  /**
   * Get current health assessment.
   */
  getHealthAssessment(): HealthAssessment {
    return this.monitor.sampleNow();
  }

  /**
   * Check whether the current run should be aborted.
   */
  shouldAbort(): boolean {
    return this.tracker.shouldAbort();
  }

  /**
   * Clean up all resources (timers, etc).
   */
  destroy(): void {
    this.monitor.stop();
    this.recovery.destroy();
    errorRecoveryEventBus.clearHistory();
  }

  // -----------------------------------------------------------------------
  // Internals
  // -----------------------------------------------------------------------

  private getRecommendation(stage: RecoveryStage): RecoveryRecommendation {
    try {
      return this.tracker.getRecommendedStrategy(stage);
    } catch {
      // No active run — return defaults
      return {
        maxRetries: 3,
        preferFallback: false,
        skipQualityGates: false,
        reason: 'No active run — using default strategy.',
      };
    }
  }
}
