/**
 * ErrorRecoveryMonitor: Runtime health monitor for the error recovery system.
 *
 * Bridges the individually-tested modules into a cohesive runtime service:
 *   - ErrorRecoveryHealthTracker → periodic sampling & rolling scores
 *   - ErrorRecoveryEventBus     → typed lifecycle events for WebSocket / alerts
 *   - EnhancedErrorRecovery     → the underlying recovery engine
 *
 * Start alongside the API server (or PipelineOrchestrator) and call `stop()`
 * on shutdown.  The monitor emits degradation alerts, capacity adjustments,
 * and cascade warnings through the event bus so that downstream consumers
 * (WebSocket handler, monitoring dashboard, logging pipeline) can react in
 * real time.
 *
 * Usage:
 * ```ts
 * const monitor = new ErrorRecoveryMonitor(globalErrorRecovery);
 * monitor.start();   // begins periodic sampling
 * // ... server runs ...
 * monitor.stop();    // cleanup on shutdown
 * ```
 */

import { EnhancedErrorRecovery } from './enhanced-error-recovery';
import { ErrorRecoveryHealthTracker, type HealthAssessment } from './error-recovery-health-tracker';
import { errorRecoveryEventBus } from './error-recovery-event-bus';
import { logger } from '@stv/core/utils/logger';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Configuration for the monitor. */
export interface MonitorConfig {
  /** Sampling interval in milliseconds (default: 5000). */
  intervalMs: number;
  /** Number of consecutive degraded samples before emitting an alert (default: 2). */
  degradedAlertThreshold: number;
  /** Overall health score below which the system is considered "degraded" (default: 0.4). */
  degradedScoreThreshold: number;
  /** Whether to auto-start on construction (default: false). */
  autoStart: boolean;
  /** Window size passed to HealthTracker (default: 20). */
  trackerWindowSize: number;
}

/** Health status snapshot exposed to consumers (e.g. REST API, WebSocket). */
export interface MonitorHealthStatus {
  /** Whether the monitor is currently running. */
  running: boolean;
  /** ISO timestamp of the last sample. */
  lastSampledAt: string | null;
  /** Latest health assessment from the tracker. */
  assessment: HealthAssessment | null;
  /** Number of samples taken since start / last reset. */
  totalSamples: number;
  /** Count of consecutive degraded samples. */
  consecutiveDegraded: number;
  /** Current alert level. */
  alertLevel: 'none' | 'warning' | 'critical';
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: Readonly<Omit<MonitorConfig, never>> = {
  intervalMs: 5000,
  degradedAlertThreshold: 2,
  degradedScoreThreshold: 0.4,
  autoStart: false,
  trackerWindowSize: 20,
};

// ---------------------------------------------------------------------------
// ErrorRecoveryMonitor
// ---------------------------------------------------------------------------

/**
 * Periodically samples the error recovery system, computes rolling health
 * scores, and emits typed events when degradation or cascade patterns are
 * detected.
 */
export class ErrorRecoveryMonitor {
  private readonly recovery: EnhancedErrorRecovery;
  private readonly tracker: ErrorRecoveryHealthTracker;
  private readonly config: MonitorConfig;

  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private totalSamples = 0;
  private consecutiveDegraded = 0;
  private latestAssessment: HealthAssessment | null = null;
  private previousDegradedStages: Set<string> = new Set();

  constructor(recovery: EnhancedErrorRecovery, config?: Partial<MonitorConfig>) {
    this.recovery = recovery;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.tracker = new ErrorRecoveryHealthTracker(recovery, {
      windowSize: this.config.trackerWindowSize,
      degradationThreshold: this.config.degradedScoreThreshold,
    });

    if (this.config.autoStart) {
      this.start();
    }
  }

  // ---- Lifecycle ----------------------------------------------------------

  /**
   * Start periodic health sampling.  No-op if already running.
   */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.timer = setInterval(() => {
      try {
        this.sample();
      } catch (err) {
        logger.error('[ErrorRecoveryMonitor] Health sampling tick failed:', err);
      }
    }, this.config.intervalMs);
    // Take the first sample immediately so callers don't have to wait.
    try {
      this.sample();
    } catch (err) {
      logger.error('[ErrorRecoveryMonitor] Initial health sample failed:', err);
    }
    logger.info(`[ErrorRecoveryMonitor] Started — interval=${this.config.intervalMs}ms`);
  }

  /**
   * Stop periodic health sampling.  No-op if not running.
   */
  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    logger.info('[ErrorRecoveryMonitor] Stopped');
  }

  /**
   * Take a single health sample right now, outside the periodic cadence.
   * Useful after a known error event when waiting for the next interval
   * would delay the response.
   */
  sampleNow(): HealthAssessment {
    return this.sample();
  }

  // ---- Query API ---------------------------------------------------------

  /**
   * Return the current health status for external consumers.
   */
  getHealthStatus(): MonitorHealthStatus {
    return {
      running: this.running,
      lastSampledAt: this.latestAssessment
        ? new Date(this.latestAssessment.sampledAt).toISOString()
        : null,
      assessment: this.latestAssessment,
      totalSamples: this.totalSamples,
      consecutiveDegraded: this.consecutiveDegraded,
      alertLevel: this.computeAlertLevel(),
    };
  }

  /**
   * Return the underlying HealthTracker for advanced queries.
   */
  getTracker(): ErrorRecoveryHealthTracker {
    return this.tracker;
  }

  /**
   * Reset all accumulated state (samples, counters). Does NOT stop the monitor.
   */
  reset(): void {
    this.tracker.reset();
    this.totalSamples = 0;
    this.consecutiveDegraded = 0;
    this.latestAssessment = null;
    this.previousDegradedStages.clear();
  }

  // ---- Private -----------------------------------------------------------

  private sample(): HealthAssessment {
    const assessment = this.tracker.sample();
    this.latestAssessment = assessment;
    this.totalSamples++;

    // Degradation tracking
    const isDegraded = assessment.overallScore < this.config.degradedScoreThreshold;
    if (isDegraded) {
      this.consecutiveDegraded++;
    } else {
      this.consecutiveDegraded = 0;
    }

    // Emit stage-level degradation events for newly degraded stages
    this.emitStageDegradationEvents(assessment);

    // Emit alert if threshold is breached
    if (this.consecutiveDegraded >= this.config.degradedAlertThreshold) {
      const alertLevel = assessment.overallScore < 0.2 ? 'critical' : 'warning';
      if (alertLevel === 'critical') {
        logger.error(
          `[ErrorRecoveryMonitor] CRITICAL: overall=${assessment.overallScore.toFixed(2)} ` +
          `degraded=${assessment.degradedStages.join(',')}`,
        );
      } else {
        logger.warn(
          `[ErrorRecoveryMonitor] WARNING: overall=${assessment.overallScore.toFixed(2)} ` +
          `consecutive_degraded=${this.consecutiveDegraded}`,
        );
      }
    }

    // Cascade detection — emit if new cascade patterns found in analytics
    this.checkCascadePatterns(assessment);

    return assessment;
  }

  private emitStageDegradationEvents(assessment: HealthAssessment): void {
    const currentDegraded = new Set(assessment.degradedStages);

    // Emit for newly degraded stages (not in previous set)
    for (const stage of currentDegraded) {
      if (!this.previousDegradedStages.has(stage)) {
        const score = assessment.stageScores.find((s) => s.stage === stage);
        errorRecoveryEventBus.emit('stage:degraded', {
          stage,
          score: score?.score ?? 0,
          threshold: this.config.degradedScoreThreshold,
          trend: score?.trend ?? 'stable',
          timestamp: Date.now(),
        });
        logger.warn(
          `[ErrorRecoveryMonitor] Stage "${stage}" degraded — score=${score?.score.toFixed(2)}`,
        );
      }
    }

    this.previousDegradedStages = currentDegraded;
  }

  private checkCascadePatterns(_assessment: HealthAssessment): void {
    const analytics = this.recovery.getErrorAnalytics();
    const cascadeChains = analytics.cascadeChains.filter(
      (c) => Date.now() - c.lastOccurrence < this.config.intervalMs * 3,
    );

    for (const chain of cascadeChains) {
      errorRecoveryEventBus.emit('cascade:detected', {
        triggerStage: chain.triggerStage,
        affectedStages: chain.affectedStages,
        rootCause: chain.rootCause,
        frequency: chain.frequency,
        timestamp: Date.now(),
      });
    }
  }

  private computeAlertLevel(): 'none' | 'warning' | 'critical' {
    if (!this.latestAssessment) return 'none';
    if (this.consecutiveDegraded >= this.config.degradedAlertThreshold) {
      return this.latestAssessment.overallScore < 0.2 ? 'critical' : 'warning';
    }
    return 'none';
  }
}
