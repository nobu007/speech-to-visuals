/**
 * PipelineRunRecoveryTracker: Per-run error recovery coordinator.
 *
 * While EnhancedErrorRecovery handles stage-level failures globally,
 * this tracker scopes recovery to a single pipeline execution, enabling:
 * - Cross-stage error accumulation and correlation
 * - Adaptive recovery decisions based on accumulated context
 * - Degradation level tracking across the run
 * - Per-run recovery report generation
 *
 * Usage:
 * ```ts
 * const tracker = new PipelineRunRecoveryTracker();
 * tracker.startRun('run-123');
 *
 * // After transcription stage completes with error recovery
 * tracker.recordStageOutcome('transcription', {
 *   attemptCount: 2,
 *   recoveryStrategy: 'intelligent_retry',
 *   fallbackUsed: false,
 *   degraded: false,
 *   durationMs: 3400,
 * });
 *
 * // Ask for recommendation before analysis stage
 * const rec = tracker.getRecommendedStrategy('analysis');
 * // → { maxRetries: 2, useFallback: false, skipQualityGates: false }
 *
 * const report = tracker.finalizeRun(true);
 * ```
 */

import { ErrorClassifier, type ClassifiedError, type ErrorType } from './error-classifier';
import { errorRecoveryEventBus } from './error-recovery-event-bus';
import { logger } from '@/utils/logger';
import { PipelineConfigError } from '@/pipeline/pipeline-errors';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Processing stages matching the pipeline flow. */
export type RecoveryStage =
  | 'transcription'
  | 'segmentation'
  | 'analysis'
  | 'diagram_detection'
  | 'layout_generation'
  | 'animation'
  | 'rendering'
  | 'export';

/** Run-level degradation level. */
export type DegradationLevel = 'nominal' | 'degraded' | 'critical';

/** Record of a single stage's recovery outcome within a run. */
export interface StageRecoveryRecord {
  attemptCount: number;
  recoveryStrategy?: string;
  fallbackUsed: boolean;
  degraded: boolean;
  durationMs: number;
  error?: Error;
  classifiedError?: ClassifiedError;
  timestamp: number;
}

/** Configuration for a pipeline run's recovery behavior. */
export interface RunRecoveryConfig {
  /** Max retries across all stages combined. Default 15. */
  maxTotalRetries: number;
  /** Number of degraded stages before escalating to critical. Default 3. */
  maxDegradedStages: number;
  /** Error types that trigger immediate abort. Default: FILE_FORMAT_INVALID. */
  abortOnErrorTypes: ErrorType[];
  /** Whether to adjust downstream strategies based on upstream failures. Default true. */
  enableAdaptiveStrategies: boolean;
  /** Stages that can be skipped under critical degradation. */
  skippableStages: RecoveryStage[];
}

/** Recommendation for the next stage's recovery behavior. */
export interface RecoveryRecommendation {
  /** Suggested max retries for this stage. */
  maxRetries: number;
  /** Whether to prefer fallback over retry. */
  preferFallback: boolean;
  /** Whether to skip optional quality gates. */
  skipQualityGates: boolean;
  /** Reasoning for the recommendation. */
  reason: string;
}

/** Complete recovery report for a finished pipeline run. */
export interface RunRecoveryReport {
  runId: string;
  startTime: number;
  endTime: number;
  totalDurationMs: number;
  degradationLevel: DegradationLevel;
  stages: Array<{ stage: RecoveryStage } & StageRecoveryRecord>;
  totalRetries: number;
  totalFallbacks: number;
  degradedStages: RecoveryStage[];
  crossStageCorrelations: string[];
  recommendation: string;
  success: boolean;
}

/** Snapshot of the current run state for monitoring. */
export interface RunStateSnapshot {
  runId: string;
  degradationLevel: DegradationLevel;
  completedStages: number;
  totalRetries: number;
  totalFallbacks: number;
  activeStage?: RecoveryStage;
  shouldAbort: boolean;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: Readonly<RunRecoveryConfig> = {
  maxTotalRetries: 15,
  maxDegradedStages: 3,
  abortOnErrorTypes: ['FILE_FORMAT_INVALID'],
  enableAdaptiveStrategies: true,
  skippableStages: ['animation', 'export'],
};

/**
 * Stages where upstream degradation should reduce downstream aggressiveness.
 * Ordered by pipeline position; each entry maps to stages that should be
 * more conservative if the key stage degraded.
 */
const UPSTREAM_SENSITIVITY: Record<RecoveryStage, { downstream: RecoveryStage[]; strategyReduction: number }> = {
  transcription:      { downstream: ['analysis', 'diagram_detection', 'layout_generation'], strategyReduction: 1 },
  segmentation:       { downstream: ['analysis', 'diagram_detection'], strategyReduction: 1 },
  analysis:           { downstream: ['layout_generation', 'rendering'], strategyReduction: 1 },
  diagram_detection:  { downstream: ['layout_generation'], strategyReduction: 1 },
  layout_generation:  { downstream: ['animation', 'rendering'], strategyReduction: 2 },
  animation:          { downstream: ['rendering', 'export'], strategyReduction: 1 },
  rendering:          { downstream: ['export'], strategyReduction: 1 },
  export:             { downstream: [], strategyReduction: 0 },
};

// ---------------------------------------------------------------------------
// PipelineRunRecoveryTracker
// ---------------------------------------------------------------------------

export class PipelineRunRecoveryTracker {
  private readonly classifier = new ErrorClassifier();
  private config: RunRecoveryConfig = { ...DEFAULT_CONFIG };

  // Per-run state
  private runId: string | null = null;
  private startTime = 0;
  private active = false;
  private activeStage: RecoveryStage | undefined;
  private readonly stageRecords = new Map<RecoveryStage, StageRecoveryRecord>();
  private totalRetries = 0;
  private totalFallbacks = 0;

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Start tracking a new pipeline run.
   * Throws if a run is already active — call `finalizeRun()` first.
   */
  startRun(runId: string, config?: Partial<RunRecoveryConfig>): void {
    if (this.active) {
      throw new PipelineConfigError('runId', `Cannot start run "${runId}": run "${this.runId}" is still active. Finalize it first.`);
    }
    this.runId = runId;
    this.startTime = Date.now();
    this.active = true;
    this.activeStage = undefined;
    this.stageRecords.clear();
    this.totalRetries = 0;
    this.totalFallbacks = 0;
    if (config) {
      this.config = { ...DEFAULT_CONFIG, ...config };
    } else {
      this.config = { ...DEFAULT_CONFIG };
    }

    logger.info(`[RunRecovery] Started tracking run ${runId}`);
  }

  /**
   * Set the currently executing stage.
   */
  setActiveStage(stage: RecoveryStage): void {
    this.assertActive();
    this.activeStage = stage;
  }

  /**
   * Record the outcome of a completed stage.
   */
  recordStageOutcome(stage: RecoveryStage, outcome: Omit<StageRecoveryRecord, 'timestamp'>): void {
    this.assertActive();

    const record: StageRecoveryRecord = {
      ...outcome,
      timestamp: Date.now(),
    };

    this.stageRecords.set(stage, record);
    this.totalRetries += Math.max(0, outcome.attemptCount - 1);
    if (outcome.fallbackUsed) this.totalFallbacks++;
    if (outcome.error) {
      record.classifiedError = this.classifier.classify(outcome.error, { stage });
    }

    // Check abort conditions
    if (record.classifiedError && this.config.abortOnErrorTypes.includes(record.classifiedError.type)) {
      logger.warn(
        `[RunRecovery] Run ${this.runId} hit abort-on type ` +
        `${record.classifiedError.type} at stage ${stage}`,
      );
    }

    logger.info(
      `[RunRecovery] Stage ${stage} completed for run ${this.runId}: ` +
      `attempts=${outcome.attemptCount} fallback=${outcome.fallbackUsed} ` +
      `degraded=${outcome.degraded} duration=${outcome.durationMs}ms`,
    );
  }

  /**
   * Get the current degradation level for the run.
   */
  getDegradationLevel(): DegradationLevel {
    this.assertActive();

    const degradedCount = this.getDegradedStages().length;
    const retryBudget = this.config.maxTotalRetries - this.totalRetries;

    if (
      degradedCount >= this.config.maxDegradedStages ||
      retryBudget <= 0 ||
      this.hasAbortTypeError()
    ) {
      return 'critical';
    }

    if (degradedCount > 0 || this.totalFallbacks > 0 || retryBudget < this.config.maxTotalRetries * 0.3) {
      return 'degraded';
    }

    return 'nominal';
  }

  /**
   * Whether the run should abort based on accumulated state.
   */
  shouldAbort(): boolean {
    if (!this.active) return false;

    // Abort if we hit a fatal error type
    if (this.hasAbortTypeError()) return true;

    // Abort if we exhausted the retry budget
    if (this.totalRetries >= this.config.maxTotalRetries) return true;

    // Abort if too many stages degraded
    if (this.getDegradedStages().length >= this.config.maxDegradedStages) return true;

    return false;
  }

  /**
   * Get a recommended recovery strategy for the next stage based on
   * accumulated context from previous stages.
   */
  getRecommendedStrategy(nextStage: RecoveryStage): RecoveryRecommendation {
    this.assertActive();

    const degradation = this.getDegradationLevel();
    const retryBudget = this.config.maxTotalRetries - this.totalRetries;

    // Base recommendation from degradation level
    let maxRetries = 3;
    let preferFallback = false;
    let skipQualityGates = false;
    let reason = 'Nominal operation — standard retry policy.';

    if (degradation === 'critical') {
      maxRetries = Math.min(1, retryBudget);
      preferFallback = true;
      skipQualityGates = true;
      reason = 'Critical degradation — minimize retries, prefer fallbacks, skip optional gates.';
    } else if (degradation === 'degraded') {
      maxRetries = Math.min(2, retryBudget);
      preferFallback = this.totalFallbacks > 1;
      skipQualityGates = false;
      reason = 'Degraded run — reduced retries based on accumulated context.';
    }

    // Adjust based on upstream sensitivity
    if (this.config.enableAdaptiveStrategies) {
      for (const [upstreamStage, sensitivity] of Object.entries(UPSTREAM_SENSITIVITY)) {
        const record = this.stageRecords.get(upstreamStage as RecoveryStage);
        if (record?.degraded && sensitivity.downstream.includes(nextStage)) {
          maxRetries = Math.max(0, maxRetries - sensitivity.strategyReduction);
          reason += ` Reduced retries due to degraded upstream stage "${upstreamStage}".`;
        }
      }
    }

    // Under critical, check if stage is skippable
    if (degradation === 'critical' && this.config.skippableStages.includes(nextStage)) {
      reason += ` Stage "${nextStage}" is skippable under critical conditions.`;
    }

    // Budget cap
    maxRetries = Math.max(0, Math.min(maxRetries, retryBudget));

    return { maxRetries, preferFallback, skipQualityGates, reason };
  }

  /**
   * Finalize the run and generate a recovery report.
   */
  finalizeRun(success: boolean): RunRecoveryReport {
    this.assertActive();

    const endTime = Date.now();
    const degradation = this.getDegradationLevel();
    const degradedStages = this.getDegradedStages();
    const correlations = this.detectCrossStageCorrelations();

    const report: RunRecoveryReport = {
      runId: this.runId!,
      startTime: this.startTime,
      endTime,
      totalDurationMs: endTime - this.startTime,
      degradationLevel: degradation,
      stages: Array.from(this.stageRecords.entries()).map(([stage, rec]) => ({
        stage,
        ...rec,
      })),
      totalRetries: this.totalRetries,
      totalFallbacks: this.totalFallbacks,
      degradedStages,
      crossStageCorrelations: correlations,
      recommendation: this.generateRecommendation(degradation, degradedStages, correlations),
      success,
    };

    // Reset state — clear all run-scoped fields so getCurrentState()
    // returns a clean snapshot between runs (not stale data).
    this.active = false;
    this.activeStage = undefined;
    this.runId = null;
    this.stageRecords.clear();
    this.totalRetries = 0;
    this.totalFallbacks = 0;

    logger.info(
      `[RunRecovery] Finalized run ${report.runId}: ` +
      `success=${success} degradation=${degradation} ` +
      `retries=${this.totalRetries} fallbacks=${this.totalFallbacks} ` +
      `duration=${report.totalDurationMs}ms`,
    );

    return report;
  }

  /**
   * Get a snapshot of the current run state for monitoring.
   */
  getCurrentState(): RunStateSnapshot {
    return {
      runId: this.runId ?? '',
      degradationLevel: this.active ? this.getDegradationLevel() : 'nominal',
      completedStages: this.stageRecords.size,
      totalRetries: this.totalRetries,
      totalFallbacks: this.totalFallbacks,
      activeStage: this.activeStage,
      shouldAbort: this.shouldAbort(),
    };
  }

  /**
   * Whether a run is currently being tracked.
   */
  get isActive(): boolean {
    return this.active;
  }

  /**
   * Get the current run ID (or null if no run is active).
   */
  get currentRunId(): string | null {
    return this.runId;
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private assertActive(): void {
    if (!this.active) {
      throw new PipelineConfigError('activeRun', 'No active run. Call startRun() first.');
    }
  }

  private getDegradedStages(): RecoveryStage[] {
    const degraded: RecoveryStage[] = [];
    for (const [stage, record] of this.stageRecords) {
      if (record.degraded) degraded.push(stage);
    }
    return degraded;
  }

  private hasAbortTypeError(): boolean {
    for (const record of this.stageRecords.values()) {
      if (
        record.classifiedError &&
        this.config.abortOnErrorTypes.includes(record.classifiedError.type)
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Detect correlations between stage failures — e.g. transcription issues
   * leading to analysis degradation — based on timing and error patterns.
   */
  private detectCrossStageCorrelations(): string[] {
    const correlations: string[] = [];
    const stages = Array.from(this.stageRecords.entries());

    for (let i = 0; i < stages.length; i++) {
      const [stageA, recordA] = stages[i];
      if (!recordA.degraded) continue;

      for (let j = i + 1; j < stages.length; j++) {
        const [stageB, recordB] = stages[j];
        if (!recordB.degraded) continue;

        // Check if stage B's error type matches a known downstream effect
        const sensitivity = UPSTREAM_SENSITIVITY[stageA];
        if (sensitivity && sensitivity.downstream.includes(stageB)) {
          correlations.push(
            `Degraded "${stageA}" likely contributed to degraded "${stageB}" ` +
            `(time gap: ${recordB.timestamp - recordA.timestamp}ms)`,
          );
        }
      }

      // Same error type across multiple stages suggests a systemic issue
      if (recordA.classifiedError) {
        const errorType = recordA.classifiedError.type;
        const sameTypeStages = stages.filter(
          ([, r]) => r.classifiedError?.type === errorType,
        );
        if (sameTypeStages.length > 1) {
          const stageNames = sameTypeStages.map(([s]) => s).join(', ');
          correlations.push(
            `Error type "${recordA.classifiedError.type}" recurred across stages: ${stageNames}`,
          );
        }
      }
    }

    // Deduplicate
    return [...new Set(correlations)];
  }

  private generateRecommendation(
    degradation: DegradationLevel,
    degradedStages: RecoveryStage[],
    correlations: string[],
  ): string {
    if (degradation === 'nominal') {
      return 'Pipeline completed nominally. No recovery actions needed.';
    }

    const parts: string[] = [];

    if (degradedStages.length > 0) {
      parts.push(`Degraded stages: ${degradedStages.join(', ')}.`);
    }

    if (correlations.length > 0) {
      parts.push(`Cross-stage issues detected: ${correlations.length} correlation(s).`);
    }

    if (this.totalFallbacks > 0) {
      parts.push(`${this.totalFallbacks} fallback(s) used — review output quality.`);
    }

    if (this.totalRetries > this.config.maxTotalRetries * 0.7) {
      parts.push('High retry usage — investigate root cause of transient failures.');
    }

    if (degradation === 'critical') {
      parts.push('Run reached critical degradation. Consider investigating systemic issues.');
    }

    return parts.join(' ');
  }
}
