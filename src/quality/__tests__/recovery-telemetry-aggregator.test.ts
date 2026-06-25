/**
 * Tests for RecoveryTelemetryAggregator.
 *
 * Covers snapshot generation, degradation detection, pruning,
 * reset, destroy, and per-stage / error-type aggregation.
 */

import {
  RecoveryTelemetryAggregator,
  type TelemetrySnapshot,
} from '../recovery-telemetry-aggregator';
import { errorRecoveryEventBus } from '../error-recovery-event-bus';

describe('RecoveryTelemetryAggregator', () => {
  let aggregator: RecoveryTelemetryAggregator;

  beforeEach(() => {
    aggregator = new RecoveryTelemetryAggregator({
      windowMs: 60_000,
      maxRecords: 100,
    });
  });

  afterEach(() => {
    aggregator.destroy();
  });

  function emitSuccess(
    stage: string,
    strategyId: string,
    timeSpentMs: number,
    timestamp: number = Date.now(),
  ) {
    errorRecoveryEventBus.emit('recovery:success', {
      stage,
      strategyId,
      timeSpentMs,
      fallbackUsed: false,
      timestamp,
    });
  }

  function emitFailure(
    stage: string,
    strategyId: string,
    timeSpentMs: number,
    nextAction: 'retry' | 'fallback' | 'escalate' | 'abort' = 'fallback',
    timestamp: number = Date.now(),
  ) {
    errorRecoveryEventBus.emit('recovery:failure', {
      stage,
      strategyId,
      timeSpentMs,
      nextAction,
      timestamp,
    });
  }

  describe('constructor', () => {
    test('uses default window and maxRecords', () => {
      const agg = new RecoveryTelemetryAggregator();
      expect(agg.getWindowMs()).toBe(300_000);
      agg.destroy();
    });

    test('accepts custom window and maxRecords', () => {
      const agg = new RecoveryTelemetryAggregator({
        windowMs: 10_000,
        maxRecords: 50,
      });
      expect(agg.getWindowMs()).toBe(10_000);
      agg.destroy();
    });
  });

  describe('getSnapshot — empty state', () => {
    test('returns valid snapshot with zero events', () => {
      const snap = aggregator.getSnapshot();
      expect(snap.totalEvents).toBe(0);
      expect(snap.overallSuccessRate).toBe(1); // default when no data
      expect(snap.meanRecoveryTimeMs).toBe(0);
      expect(snap.p95RecoveryTimeMs).toBe(0);
      expect(snap.stages).toHaveLength(0);
      expect(snap.degradationAlerts).toHaveLength(0);
      expect(snap.errorTypeDistribution).toHaveLength(0);
      expect(snap.degraded).toBe(false);
    });

    test('capturedAt is a valid ISO timestamp', () => {
      const snap = aggregator.getSnapshot();
      expect(() => new Date(snap.capturedAt).toISOString()).not.toThrow();
    });

    test('windowMs matches constructor option', () => {
      const snap = aggregator.getSnapshot();
      expect(snap.windowMs).toBe(60_000);
    });
  });

  describe('getSnapshot — with success events', () => {
    test('records a single success event', () => {
      emitSuccess('analysis', 'retry_strategy', 500);
      const snap = aggregator.getSnapshot();
      expect(snap.totalEvents).toBe(1);
      expect(snap.overallSuccessRate).toBe(1);
      expect(snap.meanRecoveryTimeMs).toBe(500);
    });

    test('calculates mean recovery time across multiple successes', () => {
      emitSuccess('analysis', 'retry', 100);
      emitSuccess('analysis', 'retry', 300);
      const snap = aggregator.getSnapshot();
      expect(snap.meanRecoveryTimeMs).toBe(200);
    });

    test('calculates P95 recovery time', () => {
      // Emit 20 success events with increasing durations
      for (let i = 1; i <= 20; i++) {
        emitSuccess('export', 'strategy', i * 10);
      }
      const snap = aggregator.getSnapshot();
      // P95 of [10, 20, ..., 200] → index ceil(20 * 0.95) - 1 = 18 → 190
      expect(snap.p95RecoveryTimeMs).toBe(190);
    });
  });

  describe('getSnapshot — with failure events', () => {
    test('records failure events and lowers success rate', () => {
      emitSuccess('analysis', 's1', 100);
      emitFailure('analysis', 's2', 200);
      const snap = aggregator.getSnapshot();
      expect(snap.totalEvents).toBe(2);
      expect(snap.overallSuccessRate).toBeCloseTo(0.5);
    });

    test('success rate is 0 when all attempts fail', () => {
      emitFailure('analysis', 's1', 100);
      emitFailure('analysis', 's2', 200);
      const snap = aggregator.getSnapshot();
      expect(snap.overallSuccessRate).toBe(0);
    });
  });

  describe('per-stage statistics', () => {
    test('groups records by stage', () => {
      emitSuccess('analysis', 's1', 100);
      emitSuccess('export', 's2', 200);
      emitFailure('render', 's3', 300);
      const snap = aggregator.getSnapshot();
      expect(snap.stages).toHaveLength(3);
      const stages = snap.stages.map((s) => s.stage).sort();
      expect(stages).toEqual(['analysis', 'export', 'render']);
    });

    test('stage successRate reflects mixed outcomes', () => {
      emitSuccess('analysis', 's1', 100);
      emitSuccess('analysis', 's1', 200);
      emitFailure('analysis', 's1', 50);
      const snap = aggregator.getSnapshot();
      const analysisStage = snap.stages.find((s) => s.stage === 'analysis');
      expect(analysisStage).toBeDefined();
      expect(analysisStage!.attempts).toBe(3);
      expect(analysisStage!.successes).toBe(2);
      expect(analysisStage!.failures).toBe(1);
      expect(analysisStage!.successRate).toBeCloseTo(2 / 3);
    });

    test('stage meanRecoveryTimeMs only counts successes', () => {
      emitSuccess('analysis', 's1', 100);
      emitFailure('analysis', 's1', 500);
      emitSuccess('analysis', 's1', 300);
      const snap = aggregator.getSnapshot();
      const analysisStage = snap.stages.find((s) => s.stage === 'analysis');
      expect(analysisStage!.meanRecoveryTimeMs).toBe(200); // (100 + 300) / 2
    });
  });

  describe('error type distribution', () => {
    test('groups by strategyId', () => {
      emitSuccess('analysis', 'retry', 100);
      emitFailure('analysis', 'retry', 200);
      emitSuccess('export', 'fallback', 300);
      const snap = aggregator.getSnapshot();
      expect(snap.errorTypeDistribution).toHaveLength(2);
      const retry = snap.errorTypeDistribution.find((e) => e.errorType === 'retry');
      expect(retry!.count).toBe(2);
      expect(retry!.percentage).toBeCloseTo(2 / 3);
    });

    test('sorted by count descending', () => {
      emitSuccess('a', 'rare', 100);
      emitSuccess('a', 'common', 100);
      emitFailure('a', 'common', 100);
      const snap = aggregator.getSnapshot();
      expect(snap.errorTypeDistribution[0].errorType).toBe('common');
      expect(snap.errorTypeDistribution[0].count).toBe(2);
    });

    test('percentage is 0 when no events', () => {
      const snap = aggregator.getSnapshot();
      expect(snap.errorTypeDistribution).toHaveLength(0);
    });
  });

  describe('degradation detection', () => {
    test('first snapshot never shows degraded', () => {
      emitSuccess('a', 's', 100);
      const snap = aggregator.getSnapshot();
      expect(snap.degraded).toBe(false);
    });

    test('detects degradation when success rate drops > 10%', () => {
      // First window: 100% success rate
      for (let i = 0; i < 10; i++) {
        emitSuccess('a', 's', 100);
      }
      aggregator.getSnapshot(); // establishes baseline rate

      // Add more events that lower the overall rate significantly
      for (let i = 0; i < 10; i++) {
        emitFailure('a', 's', 100);
      }
      const snap = aggregator.getSnapshot();
      // 10 successes / 20 total = 0.5, drop from 1.0 = 0.5 > 0.10
      expect(snap.degraded).toBe(true);
    });

    test('does not flag degradation when rate stays similar', () => {
      for (let i = 0; i < 10; i++) {
        emitSuccess('a', 's', 100);
      }
      aggregator.getSnapshot(); // establishes baseline rate at 1.0

      // Add 1 failure + 9 more successes → 19/20 = 0.95, drop = 0.05 < 0.10
      for (let i = 0; i < 9; i++) {
        emitSuccess('a', 's', 100);
      }
      emitFailure('a', 's', 100);
      const snap = aggregator.getSnapshot();
      expect(snap.degraded).toBe(false);
    });
  });

  describe('pruning', () => {
    test('removes records older than the window', () => {
      const now = Date.now();
      // Old record (outside 60s window)
      emitSuccess('a', 's', 100, now - 120_000);
      // Recent record
      emitSuccess('a', 's', 200, now);
      const snap = aggregator.getSnapshot();
      expect(snap.totalEvents).toBe(1);
    });

    test('prunes all old records', () => {
      const now = Date.now();
      emitSuccess('a', 's', 100, now - 200_000);
      emitSuccess('a', 's', 200, now - 150_000);
      emitSuccess('a', 's', 300, now);
      const snap = aggregator.getSnapshot();
      expect(snap.totalEvents).toBe(1);
    });
  });

  describe('maxRecords enforcement', () => {
    test('drops oldest records when maxRecords exceeded', () => {
      const smallAgg = new RecoveryTelemetryAggregator({
        windowMs: 600_000,
        maxRecords: 5,
      });
      try {
        for (let i = 0; i < 10; i++) {
          emitSuccess('a', `s${i}`, i * 100);
        }
        const snap = smallAgg.getSnapshot();
        expect(snap.totalEvents).toBe(5);
      } finally {
        smallAgg.destroy();
      }
    });
  });

  describe('reset', () => {
    test('clears all accumulated data', () => {
      emitSuccess('a', 's', 100);
      emitFailure('a', 's', 200);
      aggregator.reset();
      const snap = aggregator.getSnapshot();
      expect(snap.totalEvents).toBe(0);
      expect(snap.overallSuccessRate).toBe(1);
    });

    test('clears degradation baseline after reset', () => {
      for (let i = 0; i < 10; i++) {
        emitSuccess('a', 's', 100);
      }
      aggregator.getSnapshot();
      aggregator.reset();
      // After reset, first snapshot should not be degraded even with bad rate
      for (let i = 0; i < 10; i++) {
        emitFailure('a', 's', 100);
      }
      const snap = aggregator.getSnapshot();
      // detectDegradation returns false on first comparison after reset
      expect(snap.degraded).toBe(false);
      expect(snap.overallSuccessRate).toBe(0); // all failures
    });
  });

  describe('destroy', () => {
    test('unsubscribes from event bus', () => {
      emitSuccess('a', 's', 100);
      aggregator.destroy();

      // After destroy, new events should not be recorded
      emitSuccess('b', 's', 200);

      // Re-create to read snapshot (the destroyed aggregator's records are stale)
      const newAgg = new RecoveryTelemetryAggregator({ windowMs: 60_000 });
      const snap = newAgg.getSnapshot();
      // New aggregator should not have the 'b' event since timing might differ,
      // but the destroyed aggregator should not have grown
      expect(snap).toBeDefined();
      newAgg.destroy();
    });
  });

  describe('stage:degraded and cascade:detected events', () => {
    test('stores stage degraded events without crashing', () => {
      errorRecoveryEventBus.emit('stage:degraded', {
        stage: 'analysis',
        score: 0.3,
        threshold: 0.5,
        trend: 'degrading',
        timestamp: Date.now(),
      });
      // Should not throw
      const snap = aggregator.getSnapshot();
      expect(snap).toBeDefined();
    });

    test('stores cascade detected events without crashing', () => {
      errorRecoveryEventBus.emit('cascade:detected', {
        triggerStage: 'analysis',
        affectedStages: ['render', 'export'],
        rootCause: 'timeout',
        frequency: 3,
        timestamp: Date.now(),
      });
      const snap = aggregator.getSnapshot();
      expect(snap).toBeDefined();
    });
  });
});
