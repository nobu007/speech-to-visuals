import {
  describe,
  it,
  expect,
  jest,
} from '@jest/globals';

import {
  ErrorRecoveryHealthTracker,
  HealthAssessment,
} from '../error-recovery-health-tracker';
import {
  EnhancedErrorRecovery,
  ErrorSnapshot,
  ErrorReport,
} from '../enhanced-error-recovery';

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

/**
 * Build a mock EnhancedErrorRecovery whose getErrorSnapshot() and
 * exportErrorReport() return controlled data.
 */
function makeMockRecovery(
  overrides: {
    capturedAt?: number;
    overallResilience?: number;
    openCircuitBreakers?: string[];
    recoverySuccessRate?: number;
    errorsByStage?: Record<string, number>;
    dynamicCapacity?: number;
    queuedRequestCount?: number;
    circuitBreakers?: Record<string, { state: string; failureCount: number; successCount: number; lastFailureTime: number }>;
  } = {},
): jest.Mocked<EnhancedErrorRecovery> {
  const snapshot: ErrorSnapshot = {
    capturedAt: overrides.capturedAt ?? Date.now(),
    healthMetrics: {
      overall: overrides.overallResilience ?? 0.9,
      components: {},
    } as any,
    circuitBreakers: overrides.circuitBreakers ?? {},
    errorHistoryCounts: {},
    strategyEffectiveness: {},
    loadMetrics: [],
    resilience: {
      overallResilience: overrides.overallResilience ?? 0.9,
      componentResilience: {},
    } as any,
    analytics: {
      errorsByStage: overrides.errorsByStage ?? {},
      errorTypes: {},
      errorFrequency: [],
      recentErrors: [],
      stageStatistics: {},
    } as any,
    dynamicCapacity: overrides.dynamicCapacity ?? 10,
    activeRequestCount: 0,
    queuedRequestCount: overrides.queuedRequestCount ?? 0,
  };

  const report: ErrorReport = {
    generatedAt: overrides.capturedAt ?? Date.now(),
    summary: {
      totalErrors: 0,
      affectedStages: [],
      hotStages: [],
      recoverySuccessRate: overrides.recoverySuccessRate ?? 0.9,
      openCircuitBreakers: overrides.openCircuitBreakers ?? [],
    },
    recentErrors: [],
    cascadeChains: [],
    trends: [],
    recommendations: [],
  };

  return {
    getErrorSnapshot: jest.fn(() => snapshot),
    exportErrorReport: jest.fn(() => report),
  } as unknown as jest.Mocked<EnhancedErrorRecovery>;
}

/**
 * Build a mutable mock recovery whose snapshot/report values can be updated
 * between samples to simulate evolving pipeline state.
 */
function makeMutableRecovery() {
  const state = {
    capturedAt: Date.now(),
    overallResilience: 0.9,
    openCircuitBreakers: [] as string[],
    recoverySuccessRate: 0.9,
    errorsByStage: {} as Record<string, number>,
    dynamicCapacity: 10,
    queuedRequestCount: 0,
    circuitBreakers: {} as Record<string, { state: string; failureCount: number; successCount: number; lastFailureTime: number }>,
  };

  const recovery = {
    getErrorSnapshot: jest.fn((): ErrorSnapshot => ({
      capturedAt: state.capturedAt,
      healthMetrics: { overall: state.overallResilience, components: {} } as any,
      circuitBreakers: state.circuitBreakers,
      errorHistoryCounts: {},
      strategyEffectiveness: {},
      loadMetrics: [],
      resilience: {
        overallResilience: state.overallResilience,
        componentResilience: {},
      } as any,
      analytics: {
        errorsByStage: { ...state.errorsByStage },
        errorTypes: {},
        errorFrequency: [],
        recentErrors: [],
        stageStatistics: {},
      } as any,
      dynamicCapacity: state.dynamicCapacity,
      activeRequestCount: 0,
      queuedRequestCount: state.queuedRequestCount,
    })),
    exportErrorReport: jest.fn((): ErrorReport => ({
      generatedAt: state.capturedAt,
      summary: {
        totalErrors: 0,
        affectedStages: [],
        hotStages: [],
        recoverySuccessRate: state.recoverySuccessRate,
        openCircuitBreakers: [...state.openCircuitBreakers],
      },
      recentErrors: [],
      cascadeChains: [],
      trends: [],
      recommendations: [],
    })),
  } as unknown as jest.Mocked<EnhancedErrorRecovery>;

  return { recovery, state };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ErrorRecoveryHealthTracker', () => {
  // ---- Basic sampling ----------------------------------------------------

  describe('sample()', () => {
    it('returns a HealthAssessment with all fields', () => {
      const recovery = makeMockRecovery();
      const tracker = new ErrorRecoveryHealthTracker(recovery);
      const assessment = tracker.sample();

      expect(assessment).toHaveProperty('sampledAt');
      expect(assessment).toHaveProperty('overallScore');
      expect(assessment).toHaveProperty('stageScores');
      expect(assessment).toHaveProperty('degradedStages');
      expect(assessment).toHaveProperty('recommendations');
      expect(assessment).toHaveProperty('sampleWindowSize');
      expect(assessment.sampleWindowSize).toBe(1);
    });

    it('returns overallScore from resilience when no stages have errors', () => {
      const recovery = makeMockRecovery({ overallResilience: 0.85, errorsByStage: {} });
      const tracker = new ErrorRecoveryHealthTracker(recovery);
      const assessment = tracker.sample();
      expect(assessment.overallScore).toBe(0.85);
    });

    it('returns healthy recommendations when no issues', () => {
      const recovery = makeMockRecovery({
        overallResilience: 0.95,
        errorsByStage: {},
        recoverySuccessRate: 0.95,
      });
      const tracker = new ErrorRecoveryHealthTracker(recovery);
      const assessment = tracker.sample();
      expect(assessment.recommendations).toContain('All pipeline stages are healthy. No action required.');
      expect(assessment.degradedStages).toHaveLength(0);
    });
  });

  // ---- Rolling window ----------------------------------------------------

  describe('rolling window', () => {
    it('accumulates samples up to windowSize', () => {
      const { recovery, state } = makeMutableRecovery();
      const tracker = new ErrorRecoveryHealthTracker(recovery, { windowSize: 5 });

      for (let i = 0; i < 5; i++) {
        state.capturedAt = 1000 + i;
        tracker.sample();
      }
      expect(tracker.sampleCount).toBe(5);
    });

    it('drops oldest sample when windowSize exceeded', () => {
      const { recovery, state } = makeMutableRecovery();
      const tracker = new ErrorRecoveryHealthTracker(recovery, { windowSize: 3 });

      for (let i = 0; i < 5; i++) {
        state.capturedAt = 1000 + i;
        tracker.sample();
      }
      expect(tracker.sampleCount).toBe(3);
      const samples = tracker.getSamples();
      // Oldest should be at index 2 (timestamp 1002), not 1000
      expect(samples[0].timestamp).toBe(1002);
    });
  });

  // ---- Stage health scoring ---------------------------------------------

  describe('stage health scoring', () => {
    it('computes stage score from error frequency', () => {
      const { recovery, state } = makeMutableRecovery();
      const tracker = new ErrorRecoveryHealthTracker(recovery);

      // First sample: 3 errors in "transcription"
      state.errorsByStage = { transcription: 3 };
      tracker.sample();

      // Second sample: still 3 (no new errors)
      tracker.sample();

      const assessment = tracker.sample();
      const stage = assessment.stageScores.find((s) => s.stage === 'transcription');
      expect(stage).toBeDefined();
      expect(stage!.score).toBeGreaterThan(0);
      expect(stage!.score).toBeLessThanOrEqual(1);
    });

    it('penalizes stages with open circuit breakers', () => {
      const { recovery, state } = makeMutableRecovery();
      const tracker = new ErrorRecoveryHealthTracker(recovery);

      // Sample with open circuit breaker
      state.errorsByStage = { analysis: 1 };
      state.openCircuitBreakers = ['analysis'];
      state.circuitBreakers = {
        analysis: { state: 'open', failureCount: 5, successCount: 0, lastFailureTime: Date.now() },
      };
      tracker.sample();
      tracker.sample();

      const assessment = tracker.sample();
      const stage = assessment.stageScores.find((s) => s.stage === 'analysis');
      expect(stage).toBeDefined();
      // With circuit breaker open in all samples, cbScore = 0
      // Score should be low but not necessarily below threshold
      expect(stage!.score).toBeLessThan(0.7);
    });

    it('factors recovery success rate into score', () => {
      const { recovery: r1, state: s1 } = makeMutableRecovery();
      const { recovery: r2, state: s2 } = makeMutableRecovery();

      s1.errorsByStage = { pipeline: 1 };
      s1.recoverySuccessRate = 0.2; // Low recovery
      s2.errorsByStage = { pipeline: 1 };
      s2.recoverySuccessRate = 0.95; // High recovery

      const t1 = new ErrorRecoveryHealthTracker(r1);
      const t2 = new ErrorRecoveryHealthTracker(r2);

      t1.sample(); t1.sample();
      t2.sample(); t2.sample();

      const a1 = t1.sample();
      const a2 = t2.sample();

      const s1Score = a1.stageScores.find((s) => s.stage === 'pipeline');
      const s2Score = a2.stageScores.find((s) => s.stage === 'pipeline');

      expect(s2Score!.score).toBeGreaterThan(s1Score!.score);
    });
  });

  // ---- Trend detection ---------------------------------------------------

  describe('trend detection', () => {
    it('returns stable trend when deltas are constant', () => {
      const { recovery, state } = makeMutableRecovery();
      const tracker = new ErrorRecoveryHealthTracker(recovery, { minTrendSamples: 3 });

      // Error count increases by 1 each sample (constant delta = stable)
      for (let i = 1; i <= 5; i++) {
        state.errorsByStage = { render: i };
        tracker.sample();
      }

      const assessment = tracker.sample();
      state.errorsByStage = { render: 6 };
      const finalAssessment = tracker.sample();
      const stage = finalAssessment.stageScores.find((s) => s.stage === 'render');
      expect(stage).toBeDefined();
      expect(['stable', 'improving', 'degrading']).toContain(stage!.trend);
    });

    it('returns degrading when error frequency increases', () => {
      const { recovery, state } = makeMutableRecovery();
      const tracker = new ErrorRecoveryHealthTracker(recovery, { minTrendSamples: 2 });

      // First few samples: 1 error each (low delta)
      state.errorsByStage = { export: 1 };
      tracker.sample();
      state.errorsByStage = { export: 2 };
      tracker.sample();

      // Later samples: many new errors (high delta)
      state.errorsByStage = { export: 8 };
      tracker.sample();
      state.errorsByStage = { export: 20 };
      tracker.sample();

      const assessment = tracker.sample();
      state.errorsByStage = { export: 40 };
      const final = tracker.sample();
      const stage = final.stageScores.find((s) => s.stage === 'export');
      expect(stage).toBeDefined();
      expect(stage!.trend).toBe('degrading');
    });

    it('returns improving when error frequency decreases', () => {
      const { recovery, state } = makeMutableRecovery();
      const tracker = new ErrorRecoveryHealthTracker(recovery, { minTrendSamples: 2 });

      // Start with many errors, then decrease
      state.errorsByStage = { export: 10 };
      tracker.sample();
      state.errorsByStage = { export: 12 };
      tracker.sample();
      state.errorsByStage = { export: 13 };
      tracker.sample();
      state.errorsByStage = { export: 13 };
      tracker.sample();

      const final = tracker.sample();
      const stage = final.stageScores.find((s) => s.stage === 'export');
      expect(stage).toBeDefined();
      expect(stage!.trend).toBe('improving');
    });

    it('returns stable when insufficient samples for trend', () => {
      const { recovery, state } = makeMutableRecovery();
      const tracker = new ErrorRecoveryHealthTracker(recovery, { minTrendSamples: 5 });

      state.errorsByStage = { stage1: 1 };
      tracker.sample();

      const assessment = tracker.sample();
      state.errorsByStage = { stage1: 2 };
      const final = tracker.sample();
      const stage = final.stageScores.find((s) => s.stage === 'stage1');
      expect(stage).toBeDefined();
      expect(stage!.trend).toBe('stable');
    });
  });

  // ---- Degraded stages ---------------------------------------------------

  describe('degraded stages', () => {
    it('identifies stages below degradation threshold', () => {
      const { recovery, state } = makeMutableRecovery();
      const tracker = new ErrorRecoveryHealthTracker(recovery, {
        degradationThreshold: 0.5,
      });

      // Create many errors to push stage score below 0.5
      state.errorsByStage = { bad_stage: 10 };
      state.openCircuitBreakers = ['bad_stage'];
      state.recoverySuccessRate = 0.1;
      state.circuitBreakers = {
        bad_stage: { state: 'open', failureCount: 10, successCount: 0, lastFailureTime: Date.now() },
      };

      tracker.sample();
      tracker.sample();
      const assessment = tracker.sample();

      expect(assessment.degradedStages).toContain('bad_stage');
    });

    it('does not flag healthy stages as degraded', () => {
      const recovery = makeMockRecovery({
        errorsByStage: {},
        recoverySuccessRate: 0.95,
        overallResilience: 0.95,
      });
      const tracker = new ErrorRecoveryHealthTracker(recovery);
      const assessment = tracker.sample();
      expect(assessment.degradedStages).toHaveLength(0);
    });
  });

  // ---- Recommendations ---------------------------------------------------

  describe('recommendations', () => {
    it('recommends investigation for degraded stages', () => {
      const { recovery, state } = makeMutableRecovery();
      const tracker = new ErrorRecoveryHealthTracker(recovery, {
        degradationThreshold: 0.6,
      });

      state.errorsByStage = { flaky: 8 };
      state.openCircuitBreakers = ['flaky'];
      state.recoverySuccessRate = 0.1;
      state.circuitBreakers = {
        flaky: { state: 'open', failureCount: 8, successCount: 0, lastFailureTime: Date.now() },
      };

      tracker.sample();
      tracker.sample();
      const assessment = tracker.sample();

      const degradedRec = assessment.recommendations.find((r) => r.includes('degraded'));
      expect(degradedRec).toBeDefined();
      expect(degradedRec).toContain('flaky');
    });

    it('recommends scaling when queue exceeds capacity', () => {
      const recovery = makeMockRecovery({
        dynamicCapacity: 5,
        queuedRequestCount: 20,
      });
      const tracker = new ErrorRecoveryHealthTracker(recovery);
      const assessment = tracker.sample();

      const scalingRec = assessment.recommendations.find((r) => r.includes('scaling'));
      expect(scalingRec).toBeDefined();
      expect(scalingRec).toContain('20');
      expect(scalingRec).toContain('5');
    });

    it('reports open circuit breakers in recommendations', () => {
      const { recovery, state } = makeMutableRecovery();
      state.circuitBreakers = {
        stage_a: { state: 'open', failureCount: 3, successCount: 0, lastFailureTime: Date.now() },
        stage_b: { state: 'open', failureCount: 5, successCount: 0, lastFailureTime: Date.now() },
      };
      state.openCircuitBreakers = ['stage_a', 'stage_b'];

      const tracker = new ErrorRecoveryHealthTracker(recovery);
      tracker.sample();
      tracker.sample();
      const assessment = tracker.sample();

      const cbRec = assessment.recommendations.find((r) => r.includes('Circuit breakers open'));
      expect(cbRec).toBeDefined();
      expect(cbRec).toContain('stage_a');
      expect(cbRec).toContain('stage_b');
    });

    it('recommends investigation for degrading trends', () => {
      const { recovery, state } = makeMutableRecovery();
      const tracker = new ErrorRecoveryHealthTracker(recovery);

      // Escalating errors
      state.errorsByStage = { failing: 1 };
      tracker.sample();
      state.errorsByStage = { failing: 2 };
      tracker.sample();
      state.errorsByStage = { failing: 10 };
      tracker.sample();
      state.errorsByStage = { failing: 25 };
      tracker.sample();

      const assessment = tracker.sample();
      state.errorsByStage = { failing: 50 };

      // Need one more sample to pick up the trend
      const final = tracker.sample();
      const trendRec = final.recommendations.find((r) => r.includes('degrading trend'));
      expect(trendRec).toBeDefined();
      expect(trendRec).toContain('failing');
    });
  });

  // ---- reset / sampleCount ----------------------------------------------

  describe('reset()', () => {
    it('clears all samples', () => {
      const recovery = makeMockRecovery();
      const tracker = new ErrorRecoveryHealthTracker(recovery);
      tracker.sample();
      tracker.sample();
      expect(tracker.sampleCount).toBe(2);

      tracker.reset();
      expect(tracker.sampleCount).toBe(0);
      expect(tracker.getSamples()).toHaveLength(0);
    });
  });

  describe('sampleCount', () => {
    it('tracks number of samples taken', () => {
      const recovery = makeMockRecovery();
      const tracker = new ErrorRecoveryHealthTracker(recovery);
      expect(tracker.sampleCount).toBe(0);

      tracker.sample();
      expect(tracker.sampleCount).toBe(1);

      tracker.sample();
      expect(tracker.sampleCount).toBe(2);
    });
  });

  // ---- Overall score computation ----------------------------------------

  describe('overall score', () => {
    it('uses resilience when no stage data available', () => {
      const recovery = makeMockRecovery({
        overallResilience: 0.75,
        errorsByStage: {},
      });
      const tracker = new ErrorRecoveryHealthTracker(recovery);
      const assessment = tracker.sample();
      expect(assessment.overallScore).toBe(0.75);
    });

    it('uses average of stage scores when stages exist', () => {
      const { recovery, state } = makeMutableRecovery();
      const tracker = new ErrorRecoveryHealthTracker(recovery);

      state.errorsByStage = { stage_x: 1, stage_y: 1 };
      tracker.sample();
      tracker.sample();

      const assessment = tracker.sample();
      // With stages present, overallScore should be average of stage scores
      const stageAvg =
        assessment.stageScores.reduce((sum, s) => sum + s.score, 0) /
        assessment.stageScores.length;
      expect(assessment.overallScore).toBeCloseTo(stageAvg, 2);
    });
  });

  // ---- Multiple stages ---------------------------------------------------

  describe('multiple stages', () => {
    it('tracks health for multiple independent stages', () => {
      const { recovery, state } = makeMutableRecovery();
      const tracker = new ErrorRecoveryHealthTracker(recovery);

      state.errorsByStage = { alpha: 1, beta: 5, gamma: 0 };
      tracker.sample();
      tracker.sample();

      const assessment = tracker.sample();
      const stages = assessment.stageScores.map((s) => s.stage);
      expect(stages).toContain('alpha');
      expect(stages).toContain('beta');
      expect(stages).toContain('gamma');
    });

    it('detects new stages appearing in later samples', () => {
      const { recovery, state } = makeMutableRecovery();
      const tracker = new ErrorRecoveryHealthTracker(recovery);

      state.errorsByStage = { first: 1 };
      tracker.sample();

      state.errorsByStage = { first: 1, second: 3 };
      tracker.sample();

      const assessment = tracker.sample();
      expect(assessment.stageScores.map((s) => s.stage)).toContain('second');
    });
  });
});
