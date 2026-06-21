/**
 * RecoveryStrategyChain: Composable sequential fallback chains for error recovery.
 *
 * While EnhancedErrorRecovery selects a single best strategy per error,
 * this module layers multiple strategies into an ordered chain that tries
 * each in sequence until one succeeds (or all fail).
 *
 * Key capabilities:
 * - Per-stage strategy chains (e.g. transcription: retry → cache → minimal)
 * - Configurable stop-conditions (max time budget, confidence threshold)
 * - Chain effectiveness tracking (which chains actually resolve errors)
 * - Integration with ErrorRecoveryEventBus for real-time observability
 */

import { errorRecoveryEventBus } from './error-recovery-event-bus';
import { logger } from '@/utils/logger';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** A single step in a recovery chain. */
export interface ChainStep {
  /** Unique identifier for this strategy step. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Execute this recovery step. Return undefined to signal failure. */
  execute: () => Promise<ChainStepResult | undefined>;
  /** If true, skip this step when the chain's time budget is exhausted. */
  optional: boolean;
}

/** Outcome from a single chain step. */
export interface ChainStepResult {
  /** The recovered value. */
  result: unknown;
  /** Whether a degraded fallback was used. */
  fallbackUsed: boolean;
  /** Confidence in the recovered result (0–1). */
  confidence: number;
}

/** Configuration for executing a chain. */
export interface ChainConfig {
  /** Pipeline stage this chain is recovering. */
  stage: string;
  /** Maximum wall-clock time (ms) the entire chain may spend. Default 30 000. */
  timeBudgetMs: number;
  /** Stop trying further steps once a result with at least this confidence is achieved. Default 0. */
  minConfidence: number;
  /** Called between steps so callers can observe progress. */
  onStepComplete?: (stepId: string, success: boolean, elapsed: number) => void;
}

/** Detailed outcome of a chain execution. */
export interface ChainOutcome {
  /** Whether any step produced a successful result. */
  success: boolean;
  /** The result from the winning step (undefined on total failure). */
  result?: unknown;
  /** Step that produced the result. */
  winningStepId: string | null;
  /** Whether the result came from a degraded fallback. */
  fallbackUsed: boolean;
  /** Confidence of the winning result. */
  confidence: number;
  /** How many steps were attempted. */
  stepsAttempted: number;
  /** How many steps were skipped (optional + budget exceeded). */
  stepsSkipped: number;
  /** Per-step trace. */
  trace: ChainStepTrace[];
  /** Total time spent (ms). */
  totalDurationMs: number;
  /** Stage label. */
  stage: string;
}

/** Trace entry for a single step. */
export interface ChainStepTrace {
  stepId: string;
  stepName: string;
  attempted: boolean;
  success: boolean;
  durationMs: number;
  confidence: number;
  skipReason?: 'budget_exhausted' | 'optional_skipped';
}

/** Effectiveness stats for a named chain. */
export interface ChainStats {
  chainName: string;
  totalRuns: number;
  successes: number;
  avgStepsToSuccess: number;
  avgDurationMs: number;
  topWinningStep: string | null;
  lastRunAt: number | null;
}

// ---------------------------------------------------------------------------
// Pre-built chain definitions
// ---------------------------------------------------------------------------

/**
 * A named, ordered list of chain steps.  Consumers construct these via
 * `ChainBuilder` or manually and register them per stage.
 */
export interface StrategyChain {
  name: string;
  steps: ChainStep[];
}

// ---------------------------------------------------------------------------
// Chain builder — fluent API for constructing chains
// ---------------------------------------------------------------------------

/**
 * Fluent builder for constructing a `StrategyChain`.
 *
 * ```ts
 * const chain = ChainBuilder.start('transcription-recovery')
 *   .then('retry', 'Retry with backoff', async () => { ... })
 *   .thenOptional('cache', 'Cached result', async () => { ... })
 *   .then('minimal', 'Minimal viable output', async () => { ... })
 *   .build();
 * ```
 */
export class ChainBuilder {
  private readonly steps: ChainStep[] = [];
  private readonly chainName: string;

  private constructor(name: string) {
    this.chainName = name;
  }

  /** Start building a new chain with the given name. */
  static start(name: string): ChainBuilder {
    return new ChainBuilder(name);
  }

  /** Append a mandatory step. */
  then(id: string, name: string, execute: ChainStep['execute']): ChainBuilder {
    this.steps.push({ id, name, execute, optional: false });
    return this;
  }

  /** Append an optional step (skipped when time budget is exhausted). */
  thenOptional(id: string, name: string, execute: ChainStep['execute']): ChainBuilder {
    this.steps.push({ id, name, execute, optional: true });
    return this;
  }

  /** Build the immutable chain. */
  build(): StrategyChain {
    return { name: this.chainName, steps: [...this.steps] };
  }
}

// ---------------------------------------------------------------------------
// RecoveryStrategyChain — executor + stats
// ---------------------------------------------------------------------------

/**
 * Executes `StrategyChain` instances and tracks effectiveness.
 *
 * Usage:
 * ```ts
 * const executor = new RecoveryStrategyChain();
 * executor.register('transcription', myTranscriptionChain);
 *
 * const outcome = await executor.execute('transcription', {
 *   stage: 'transcription',
 *   timeBudgetMs: 15_000,
 * });
 * ```
 */
export class RecoveryStrategyChain {
  private readonly chains = new Map<string, StrategyChain>();
  private readonly stats = new Map<string, {
    totalRuns: number;
    successes: number;
    totalStepsToSuccess: number;
    totalDurationMs: number;
    winningSteps: Map<string, number>;
    lastRunAt: number;
  }>();

  // -----------------------------------------------------------------------
  // Registration
  // -----------------------------------------------------------------------

  /** Register (or replace) a chain for the given stage. */
  register(stage: string, chain: StrategyChain): void {
    this.chains.set(stage, chain);
    logger.info(`[RecoveryChain] Registered chain "${chain.name}" for stage "${stage}" (${chain.steps.length} steps)`);
  }

  /** Remove a chain registration. */
  unregister(stage: string): boolean {
    return this.chains.delete(stage);
  }

  /** Get the chain registered for a stage, if any. */
  getChain(stage: string): StrategyChain | undefined {
    return this.chains.get(stage);
  }

  // -----------------------------------------------------------------------
  // Execution
  // -----------------------------------------------------------------------

  /**
   * Execute the chain registered for `stage`.
   *
   * Steps are tried in order.  Execution stops when:
   * - A step returns a successful result that meets `minConfidence`
   * - The time budget is exhausted (optional steps are skipped)
   * - All steps have been tried
   */
  async execute(stage: string, config: Partial<ChainConfig> & { stage: string }): Promise<ChainOutcome> {
    const chain = this.chains.get(stage);
    if (!chain) {
      return this.emptyOutcome(stage, 'no_chain_registered');
    }

    const fullConfig: ChainConfig = {
      timeBudgetMs: 30_000,
      minConfidence: 0,
      ...config,
    };

    const deadline = Date.now() + fullConfig.timeBudgetMs;
    const trace: ChainStepTrace[] = [];
    let stepsAttempted = 0;
    let stepsSkipped = 0;
    const chainStart = Date.now();

    for (const step of chain.steps) {
      const remaining = deadline - Date.now();

      // Skip optional steps when budget is low
      if (step.optional && remaining < 500) {
        trace.push({
          stepId: step.id,
          stepName: step.name,
          attempted: false,
          success: false,
          durationMs: 0,
          confidence: 0,
          skipReason: 'budget_exhausted',
        });
        stepsSkipped++;
        continue;
      }

      // Hard stop when budget is completely exhausted
      if (remaining <= 0) {
        trace.push({
          stepId: step.id,
          stepName: step.name,
          attempted: false,
          success: false,
          durationMs: 0,
          confidence: 0,
          skipReason: remaining <= 0 ? 'budget_exhausted' : 'optional_skipped',
        });
        stepsSkipped++;
        continue;
      }

      // Attempt this step
      stepsAttempted++;
      const stepStart = Date.now();

      errorRecoveryEventBus.emit('recovery:attempt', {
        stage,
        strategyId: step.id,
        strategyName: step.name,
        attemptNumber: stepsAttempted,
        timestamp: Date.now(),
      });

      try {
        const stepResult = await step.execute();
        const stepDuration = Date.now() - stepStart;

        if (stepResult !== undefined) {
          trace.push({
            stepId: step.id,
            stepName: step.name,
            attempted: true,
            success: true,
            durationMs: stepDuration,
            confidence: stepResult.confidence,
          });

          // Notify success
          eventRecoverySuccessNotification(stage, step.id, stepDuration, stepResult.fallbackUsed);

          // Check confidence threshold
          if (stepResult.confidence >= fullConfig.minConfidence) {
            const totalDuration = Date.now() - chainStart;
            this.recordStats(chain.name, true, stepsAttempted, totalDuration, step.id);

            fullConfig.onStepComplete?.(step.id, true, stepDuration);

            return {
              success: true,
              result: stepResult.result,
              winningStepId: step.id,
              fallbackUsed: stepResult.fallbackUsed,
              confidence: stepResult.confidence,
              stepsAttempted,
              stepsSkipped,
              trace,
              totalDurationMs: totalDuration,
              stage,
            };
          }
          // Confidence below threshold — continue to next step
        } else {
          trace.push({
            stepId: step.id,
            stepName: step.name,
            attempted: true,
            success: false,
            durationMs: stepDuration,
            confidence: 0,
          });

          eventRecoveryFailureNotification(stage, step.id, stepDuration);
          fullConfig.onStepComplete?.(step.id, false, stepDuration);
        }
      } catch (err) {
        const stepDuration = Date.now() - stepStart;
        const message = err instanceof Error ? err.message : String(err);

        trace.push({
          stepId: step.id,
          stepName: step.name,
          attempted: true,
          success: false,
          durationMs: stepDuration,
          confidence: 0,
        });

        logger.warn(`[RecoveryChain] Step "${step.id}" threw in stage "${stage}": ${message}`);
        eventRecoveryFailureNotification(stage, step.id, stepDuration);
        fullConfig.onStepComplete?.(step.id, false, stepDuration);
      }
    }

    // All steps exhausted without meeting confidence threshold
    const totalDuration = Date.now() - chainStart;
    this.recordStats(chain.name, false, stepsAttempted, totalDuration, null);

    return {
      success: false,
      winningStepId: null,
      fallbackUsed: false,
      confidence: 0,
      stepsAttempted,
      stepsSkipped,
      trace,
      totalDurationMs: totalDuration,
      stage,
    };
  }

  // -----------------------------------------------------------------------
  // Statistics
  // -----------------------------------------------------------------------

  /** Get effectiveness stats for a registered chain. */
  getStats(chainName: string): ChainStats | null {
    const raw = this.stats.get(chainName);
    if (!raw) return null;

    let topWinningStep: string | null = null;
    let topCount = 0;
    for (const [stepId, count] of raw.winningSteps) {
      if (count > topCount) {
        topCount = count;
        topWinningStep = stepId;
      }
    }

    return {
      chainName,
      totalRuns: raw.totalRuns,
      successes: raw.successes,
      avgStepsToSuccess: raw.successes > 0 ? raw.totalStepsToSuccess / raw.successes : 0,
      avgDurationMs: raw.totalRuns > 0 ? raw.totalDurationMs / raw.totalRuns : 0,
      topWinningStep,
      lastRunAt: raw.lastRunAt,
    };
  }

  /** Get stats for all chains. */
  getAllStats(): ChainStats[] {
    const result: ChainStats[] = [];
    for (const key of this.stats.keys()) {
      const s = this.getStats(key);
      if (s) result.push(s);
    }
    return result;
  }

  // -----------------------------------------------------------------------
  // Internals
  // -----------------------------------------------------------------------

  private emptyOutcome(stage: string, reason: string): ChainOutcome {
    logger.warn(`[RecoveryChain] No chain registered for stage "${stage}" (${reason})`);
    return {
      success: false,
      winningStepId: null,
      fallbackUsed: false,
      confidence: 0,
      stepsAttempted: 0,
      stepsSkipped: 0,
      trace: [],
      totalDurationMs: 0,
      stage,
    };
  }

  private recordStats(
    chainName: string,
    success: boolean,
    stepsAttempted: number,
    durationMs: number,
    winningStep: string | null,
  ): void {
    let raw = this.stats.get(chainName);
    if (!raw) {
      raw = {
        totalRuns: 0,
        successes: 0,
        totalStepsToSuccess: 0,
        totalDurationMs: 0,
        winningSteps: new Map(),
        lastRunAt: 0,
      };
      this.stats.set(chainName, raw);
    }

    raw.totalRuns++;
    raw.totalDurationMs += durationMs;
    raw.lastRunAt = Date.now();

    if (success) {
      raw.successes++;
      raw.totalStepsToSuccess += stepsAttempted;
      if (winningStep) {
        raw.winningSteps.set(winningStep, (raw.winningSteps.get(winningStep) ?? 0) + 1);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Event helpers (keep event-bus calls in one place)
// ---------------------------------------------------------------------------

function eventRecoverySuccessNotification(
  stage: string,
  stepId: string,
  timeSpentMs: number,
  fallbackUsed: boolean,
): void {
  try {
    errorRecoveryEventBus.emit('recovery:success', {
      stage,
      strategyId: stepId,
      timeSpentMs,
      fallbackUsed,
      timestamp: Date.now(),
    });
  } catch (err) {
    logger.error('[RecoveryStrategyChain] Failed to emit recovery:success event', err);
  }
}

function eventRecoveryFailureNotification(
  stage: string,
  stepId: string,
  timeSpentMs: number,
): void {
  try {
    errorRecoveryEventBus.emit('recovery:failure', {
      stage,
      strategyId: stepId,
      timeSpentMs,
      nextAction: 'fallback',
      timestamp: Date.now(),
    });
  } catch (err) {
    logger.error('[RecoveryStrategyChain] Failed to emit recovery:failure event', err);
  }
}

// ---------------------------------------------------------------------------
// Singleton (optional convenience)
// ---------------------------------------------------------------------------

/** Global instance for cross-module use. */
export const globalRecoveryChain = new RecoveryStrategyChain();
