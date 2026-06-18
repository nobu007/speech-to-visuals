/**
 * TASK-0045: Error Recovery Health Tracker
 *
 * Monitors the EnhancedErrorRecovery system's health over time by computing
 * rolling health scores per pipeline stage and detecting degradation patterns.
 * Designed for integration with the pipeline monitoring dashboard and
 * proactive alerting before cascading failures occur.
 */

import {
  EnhancedErrorRecovery,
  ErrorReport,
  ErrorSnapshot,
} from './enhanced-error-recovery';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single health sample taken from the error recovery system. */
export interface HealthSample {
  timestamp: number;
  overallResilience: number;
  openCircuitBreakers: string[];
  recoverySuccessRate: number;
  errorsByStage: Record<string, number>;
  dynamicCapacity: number;
  queuedRequestCount: number;
}

/** Per-stage rolling health score computed from recent samples. */
export interface StageHealthScore {
  stage: string;
  score: number;           // 0-1, where 1 = perfectly healthy
  trend: 'improving' | 'stable' | 'degrading';
  sampleCount: number;
  lastErrorCount: number;
}

/** Complete health assessment output. */
export interface HealthAssessment {
  sampledAt: number;
  overallScore: number;
  stageScores: StageHealthScore[];
  degradedStages: string[];
  recommendations: string[];
  sampleWindowSize: number;
}

/** Configuration for the health tracker. */
export interface HealthTrackerConfig {
  /** How many samples to keep for rolling computations (default: 20). */
  windowSize: number;
  /** Score threshold below which a stage is considered "degraded" (default: 0.5). */
  degradationThreshold: number;
  /** Minimum number of samples required before emitting a trend (default: 3). */
  minTrendSamples: number;
}

const DEFAULT_CONFIG: HealthTrackerConfig = {
  windowSize: 20,
  degradationThreshold: 0.5,
  minTrendSamples: 3,
};

// ---------------------------------------------------------------------------
// ErrorRecoveryHealthTracker
// ---------------------------------------------------------------------------

/**
 * Tracks the health of an `EnhancedErrorRecovery` instance over time by
 * periodically sampling its snapshot and computing rolling metrics.
 *
 * Usage:
 *   const tracker = new ErrorRecoveryHealthTracker(recovery);
 *   const assessment = tracker.sample();
 *   if (assessment.degradedStages.length > 0) { ... }
 */
export class ErrorRecoveryHealthTracker {
  private readonly recovery: EnhancedErrorRecovery;
  private readonly config: HealthTrackerConfig;
  private readonly samples: HealthSample[] = [];

  constructor(recovery: EnhancedErrorRecovery, config?: Partial<HealthTrackerConfig>) {
    this.recovery = recovery;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ---- Public API ---------------------------------------------------------

  /**
   * Take a sample from the error recovery system and return a full health
   * assessment.  Call this periodically (e.g., every N seconds) or after
   * significant pipeline events.
   */
  sample(): HealthAssessment {
    const snapshot = this.recovery.getErrorSnapshot();
    const report = this.recovery.exportErrorReport();

    const sample = this.sampleFromSnapshot(snapshot, report);
    this.pushSample(sample);

    const stageScores = this.computeStageScores();
    const overallScore = this.computeOverallScore(stageScores);
    const degradedStages = stageScores
      .filter((s) => s.score < this.config.degradationThreshold)
      .map((s) => s.stage);
    const recommendations = this.generateRecommendations(stageScores, snapshot);

    return {
      sampledAt: sample.timestamp,
      overallScore,
      stageScores,
      degradedStages,
      recommendations,
      sampleWindowSize: this.samples.length,
    };
  }

  /** Return the raw sample history (most recent last). */
  getSamples(): readonly HealthSample[] {
    return this.samples;
  }

  /** Reset all collected samples. */
  reset(): void {
    this.samples.length = 0;
  }

  /** Get the current number of stored samples. */
  get sampleCount(): number {
    return this.samples.length;
  }

  // ---- Private helpers ----------------------------------------------------

  private sampleFromSnapshot(
    snapshot: ErrorSnapshot,
    report: ErrorReport,
  ): HealthSample {
    return {
      timestamp: snapshot.capturedAt,
      overallResilience: snapshot.resilience.overallResilience,
      openCircuitBreakers: report.summary.openCircuitBreakers,
      recoverySuccessRate: report.summary.recoverySuccessRate,
      errorsByStage: { ...snapshot.analytics.errorsByStage },
      dynamicCapacity: snapshot.dynamicCapacity,
      queuedRequestCount: snapshot.queuedRequestCount,
    };
  }

  private pushSample(sample: HealthSample): void {
    this.samples.push(sample);
    if (this.samples.length > this.config.windowSize) {
      this.samples.shift();
    }
  }

  /**
   * Compute a rolling health score per pipeline stage.
   *
   * The score for each stage is derived from:
   *   - error frequency (delta between samples: new errors per interval)
   *   - circuit breaker state  (open = penalty)
   *   - recovery success rate  (higher = better)
   *
   * Scores are normalized to 0-1.
   */
  private computeStageScores(): StageHealthScore[] {
    // Collect all stage names seen across all samples
    const stageSet = new Set<string>();
    for (const s of this.samples) {
      for (const stage of Object.keys(s.errorsByStage)) {
        stageSet.add(stage);
      }
      for (const stage of s.openCircuitBreakers) {
        stageSet.add(stage);
      }
    }

    return Array.from(stageSet).map((stage) => {
      const cumulativeCounts = this.samples.map(
        (s) => s.errorsByStage[stage] ?? 0,
      );

      // Convert cumulative counts to per-interval deltas (new errors since last sample)
      const deltas: number[] = [];
      for (let i = 1; i < cumulativeCounts.length; i++) {
        deltas.push(Math.max(0, cumulativeCounts[i] - cumulativeCounts[i - 1]));
      }
      // First sample: use its raw count as initial delta
      if (deltas.length === 0 && cumulativeCounts.length > 0) {
        deltas.push(cumulativeCounts[0]);
      }

      const lastErrorCount = cumulativeCounts[cumulativeCounts.length - 1] ?? 0;

      // --- sub-scores ---
      // 1) Error frequency: avg new errors per interval → 0 = 1.0, 5+ = 0.0
      const avgDelta =
        deltas.length > 0
          ? deltas.reduce((a, b) => a + b, 0) / deltas.length
          : 0;
      const errorScore = Math.max(0, 1 - avgDelta / 5);

      // 2) Circuit breaker: proportion of samples where breaker was NOT open
      const openCount = this.samples.filter((s) =>
        s.openCircuitBreakers.includes(stage),
      ).length;
      const cbScore = 1 - openCount / this.samples.length;

      // 3) Recovery success rate (global, since per-stage is not available)
      const avgRecovery =
        this.samples.reduce((a, s) => a + s.recoverySuccessRate, 0) /
        this.samples.length;
      const recoveryScore = avgRecovery;

      const score = errorScore * 0.4 + cbScore * 0.3 + recoveryScore * 0.3;

      // Trend: compare first half avg to second half avg of per-interval deltas
      const trend = this.computeTrend(deltas);

      return {
        stage,
        score: Math.round(score * 1000) / 1000,
        trend,
        sampleCount: this.samples.length,
        lastErrorCount,
      };
    });
  }

  private computeTrend(
    deltas: number[],
  ): 'improving' | 'stable' | 'degrading' {
    if (deltas.length < Math.max(this.config.minTrendSamples, 2)) return 'stable';

    const half = Math.max(Math.floor(deltas.length / 2), 1);
    const firstHalf = deltas.slice(0, half);
    const secondHalf = deltas.slice(half);

    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond =
      secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const delta = avgSecond - avgFirst;
    if (delta > 0.5) return 'degrading';
    if (delta < -0.5) return 'improving';
    return 'stable';
  }

  private computeOverallScore(stageScores: StageHealthScore[]): number {
    if (stageScores.length === 0) {
      // No stage data → use resilience directly from latest sample
      const latest = this.samples[this.samples.length - 1];
      return latest?.overallResilience ?? 1;
    }

    const avg = stageScores.reduce((a, s) => a + s.score, 0) / stageScores.length;
    return Math.round(avg * 1000) / 1000;
  }

  private generateRecommendations(
    stageScores: StageHealthScore[],
    snapshot: ErrorSnapshot,
  ): string[] {
    const recommendations: string[] = [];

    for (const s of stageScores) {
      if (s.score < this.config.degradationThreshold) {
        recommendations.push(
          `Stage "${s.stage}" is degraded (score: ${s.score.toFixed(2)}). ` +
            `Consider investigating recent errors or increasing retry limits.`,
        );
      }

      if (s.trend === 'degrading') {
        recommendations.push(
          `Stage "${s.stage}" shows a degrading trend. ` +
            `Error frequency is increasing — pre-emptive investigation recommended.`,
        );
      }
    }

    if (snapshot.queuedRequestCount > snapshot.dynamicCapacity) {
      recommendations.push(
        `Request queue (${snapshot.queuedRequestCount}) exceeds dynamic capacity ` +
          `(${snapshot.dynamicCapacity}). Consider scaling or reducing load.`,
      );
    }

    const openBreakers = Object.entries(snapshot.circuitBreakers)
      .filter(([, cb]) => cb.state === 'open')
      .map(([stage]) => stage);

    if (openBreakers.length > 0) {
      recommendations.push(
        `Circuit breakers open for: ${openBreakers.join(', ')}. ` +
          `These stages are blocking requests until recovery timeout elapses.`,
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('All pipeline stages are healthy. No action required.');
    }

    return recommendations;
  }
}
