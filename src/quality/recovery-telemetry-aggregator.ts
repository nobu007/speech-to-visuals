/**
 * RecoveryTelemetryAggregator: Sliding-window telemetry for error recovery.
 *
 * Subscribes to the ErrorRecoveryEventBus and aggregates recovery statistics
 * over a configurable time window:
 *   - Success rate per stage and overall
 *   - Mean / P95 recovery time
 *   - Error type distribution
 *   - Degradation detection (>10% drop in success rate vs. previous window)
 *
 * Exposes a snapshot suitable for the REST API monitoring endpoint.
 */

import {
  errorRecoveryEventBus,
  type ErrorRecoveryEventType,
  type RecoveryAttemptEvent,
  type RecoverySuccessEvent,
  type RecoveryFailureEvent,
  type StageDegradedEvent,
  type CascadeDetectedEvent,
} from './error-recovery-event-bus';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Per-stage recovery statistics. */
export interface StageRecoveryStats {
  stage: string;
  attempts: number;
  successes: number;
  failures: number;
  successRate: number;
  meanRecoveryTimeMs: number;
  p95RecoveryTimeMs: number;
}

/** Error-type distribution bucket. */
export interface ErrorTypeDistribution {
  errorType: string;
  count: number;
  percentage: number;
}

/** Full telemetry snapshot for external consumption. */
export interface TelemetrySnapshot {
  /** ISO timestamp of this snapshot. */
  capturedAt: string;
  /** Sliding window size in milliseconds. */
  windowMs: number;
  /** Total events in the window. */
  totalEvents: number;
  /** Overall recovery success rate (0-1). */
  overallSuccessRate: number;
  /** Mean recovery time across all stages (ms). */
  meanRecoveryTimeMs: number;
  /** P95 recovery time across all stages (ms). */
  p95RecoveryTimeMs: number;
  /** Per-stage breakdown. */
  stages: StageRecoveryStats[];
  /** Active degradation alerts. */
  degradationAlerts: DegradationAlert[];
  /** Error type distribution. */
  errorTypeDistribution: ErrorTypeDistribution[];
  /** Whether success rate has degraded >10% vs. previous window. */
  degraded: boolean;
}

/** Degradation alert emitted when success rate drops >10%. */
export interface DegradationAlert {
  stage: string;
  previousRate: number;
  currentRate: number;
  dropPercent: number;
  detectedAt: string;
}

// ---------------------------------------------------------------------------
// Internal record types
// ---------------------------------------------------------------------------

interface RecoveryRecord {
  stage: string;
  strategyId: string;
  outcome: 'success' | 'failure';
  timeSpentMs: number;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_WINDOW_MS = 300_000; // 5 minutes
const DEGRADATION_THRESHOLD = 0.10; // 10%
const MAX_RECORDS = 5_000;

// ---------------------------------------------------------------------------
// RecoveryTelemetryAggregator
// ---------------------------------------------------------------------------

export class RecoveryTelemetryAggregator {
  private readonly windowMs: number;
  private readonly maxRecords: number;
  private readonly records: RecoveryRecord[] = [];
  private readonly stageDegradedEvents: StageDegradedEvent[] = [];
  private readonly cascadeEvents: CascadeDetectedEvent[] = [];
  private readonly unsubscribers: Array<() => void> = [];
  private previousWindowSuccessRate: number | null = null;
  private readonly activeAlerts: DegradationAlert[] = [];

  constructor(options?: { windowMs?: number; maxRecords?: number }) {
    this.windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS;
    this.maxRecords = options?.maxRecords ?? MAX_RECORDS;
    this.subscribe();
  }

  // ---- Public API ---------------------------------------------------------

  /**
   * Take a telemetry snapshot right now.
   */
  getSnapshot(): TelemetrySnapshot {
    this.prune();

    const now = Date.now();
    const successRecords = this.records.filter((r) => r.outcome === 'success');
    const failureRecords = this.records.filter((r) => r.outcome === 'failure');
    const totalAttempts = this.records.length;
    const totalSuccesses = successRecords.length;

    // Overall success rate
    const overallSuccessRate = totalAttempts > 0 ? totalSuccesses / totalAttempts : 1;

    // Recovery times
    const recoveryTimes = successRecords.map((r) => r.timeSpentMs).sort((a, b) => a - b);
    const meanRecoveryTimeMs = recoveryTimes.length > 0
      ? recoveryTimes.reduce((a, b) => a + b, 0) / recoveryTimes.length
      : 0;
    const p95Index = Math.ceil(recoveryTimes.length * 0.95) - 1;
    const p95RecoveryTimeMs = recoveryTimes.length > 0
      ? recoveryTimes[Math.max(0, p95Index)]
      : 0;

    // Per-stage stats
    const stageMap = new Map<string, { attempts: number; successes: number; times: number[] }>();
    for (const rec of this.records) {
      let entry = stageMap.get(rec.stage);
      if (!entry) {
        entry = { attempts: 0, successes: 0, times: [] };
        stageMap.set(rec.stage, entry);
      }
      entry.attempts++;
      if (rec.outcome === 'success') {
        entry.successes++;
        entry.times.push(rec.timeSpentMs);
      }
    }

    const stages: StageRecoveryStats[] = [];
    for (const [stage, data] of stageMap) {
      const sorted = data.times.sort((a, b) => a - b);
      const mean = sorted.length > 0 ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0;
      const p95Idx = Math.ceil(sorted.length * 0.95) - 1;
      stages.push({
        stage,
        attempts: data.attempts,
        successes: data.successes,
        failures: data.attempts - data.successes,
        successRate: data.attempts > 0 ? data.successes / data.attempts : 1,
        meanRecoveryTimeMs: mean,
        p95RecoveryTimeMs: sorted.length > 0 ? sorted[Math.max(0, p95Idx)] : 0,
      });
    }

    // Error type distribution (by strategyId as proxy)
    const typeCounts = new Map<string, number>();
    for (const rec of this.records) {
      typeCounts.set(rec.strategyId, (typeCounts.get(rec.strategyId) ?? 0) + 1);
    }
    const errorTypeDistribution: ErrorTypeDistribution[] = [];
    for (const [errorType, count] of typeCounts) {
      errorTypeDistribution.push({
        errorType,
        count,
        percentage: totalAttempts > 0 ? count / totalAttempts : 0,
      });
    }
    errorTypeDistribution.sort((a, b) => b.count - a.count);

    // Degradation detection
    const degraded = this.detectDegradation(overallSuccessRate);

    return {
      capturedAt: new Date(now).toISOString(),
      windowMs: this.windowMs,
      totalEvents: totalAttempts,
      overallSuccessRate,
      meanRecoveryTimeMs,
      p95RecoveryTimeMs,
      stages,
      degradationAlerts: [...this.activeAlerts],
      errorTypeDistribution,
      degraded,
    };
  }

  /**
   * Return the sliding window size in ms.
   */
  getWindowMs(): number {
    return this.windowMs;
  }

  /**
   * Reset all accumulated telemetry.
   */
  reset(): void {
    this.records.length = 0;
    this.stageDegradedEvents.length = 0;
    this.cascadeEvents.length = 0;
    this.activeAlerts.length = 0;
    this.previousWindowSuccessRate = null;
  }

  /**
   * Unsubscribe from the event bus. Call on shutdown.
   */
  destroy(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers.length = 0;
  }

  // ---- Private -----------------------------------------------------------

  private subscribe(): void {
    const on = <E extends ErrorRecoveryEventType>(
      event: E,
      handler: (payload: unknown) => void,
    ) => {
      const unsub = errorRecoveryEventBus.on(event, handler as never);
      this.unsubscribers.push(unsub);
    };

    on('recovery:attempt', (payload) => {
      const evt = payload as RecoveryAttemptEvent;
      // Attempt events are recorded only as context; outcome comes from success/failure
    });

    on('recovery:success', (payload) => {
      const evt = payload as RecoverySuccessEvent;
      this.addRecord({
        stage: evt.stage,
        strategyId: evt.strategyId,
        outcome: 'success',
        timeSpentMs: evt.timeSpentMs,
        timestamp: evt.timestamp,
      });
    });

    on('recovery:failure', (payload) => {
      const evt = payload as RecoveryFailureEvent;
      this.addRecord({
        stage: evt.stage,
        strategyId: evt.strategyId,
        outcome: 'failure',
        timeSpentMs: evt.timeSpentMs,
        timestamp: evt.timestamp,
      });
    });

    on('stage:degraded', (payload) => {
      const evt = payload as StageDegradedEvent;
      this.stageDegradedEvents.push(evt);
      if (this.stageDegradedEvents.length > 100) {
        this.stageDegradedEvents.shift();
      }
    });

    on('cascade:detected', (payload) => {
      const evt = payload as CascadeDetectedEvent;
      this.cascadeEvents.push(evt);
      if (this.cascadeEvents.length > 50) {
        this.cascadeEvents.shift();
      }
    });
  }

  private addRecord(record: RecoveryRecord): void {
    this.records.push(record);
    if (this.records.length > this.maxRecords) {
      this.prune();
      // If still too large after pruning, drop oldest
      while (this.records.length > this.maxRecords) {
        this.records.shift();
      }
    }
  }

  private prune(): void {
    const cutoff = Date.now() - this.windowMs;
    while (this.records.length > 0 && this.records[0].timestamp < cutoff) {
      this.records.shift();
    }
  }

  private detectDegradation(currentRate: number): boolean {
    if (this.previousWindowSuccessRate === null) {
      this.previousWindowSuccessRate = currentRate;
      return false;
    }

    const drop = this.previousWindowSuccessRate - currentRate;
    const isDegraded = drop > DEGRADATION_THRESHOLD;

    // Update for next comparison — only update on significant activity
    if (this.records.length >= 5) {
      this.previousWindowSuccessRate = currentRate;
    }

    return isDegraded;
  }
}

// Singleton for convenience
export const recoveryTelemetryAggregator = new RecoveryTelemetryAggregator();
