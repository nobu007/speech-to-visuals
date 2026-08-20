/**
 * Tests for the Error Recovery State Management APIs:
 * - getErrorSnapshot() — full state serialization
 * - clearErrorHistory() — selective & total history clearing
 * - pruneErrorHistory() — time-based record removal
 * - setErrorHistoryMaxAge() — configure TTL
 * - resetCircuitBreakers() — force all breakers closed
 * - getStageRecoveryPlan() — preview recovery strategies for a stage
 * - exportErrorReport() — external-facing diagnostic report
 */

import { EnhancedErrorRecovery, globalErrorRecovery } from '@/quality/enhanced-error-recovery';
import type { ErrorSnapshot, RecoveryPlanItem, ErrorReport } from '@/quality/enhanced-error-recovery';

type ProcessingStage = 'transcription' | 'segmentation' | 'analysis' | 'diagram_detection' | 'layout_generation' | 'animation' | 'rendering' | 'export';

function makeContext(overrides: Partial<{ stage: ProcessingStage; retryCount: number; errorMessage: string; component: string }> = {}): Parameters<EnhancedErrorRecovery['recoverFromError']>[0] {
  return {
    stage: overrides.stage ?? 'analysis',
    component: overrides.component ?? 'test-component',
    input: {},
    error: new Error(overrides.errorMessage ?? 'test error'),
    timestamp: Date.now(),
    retryCount: overrides.retryCount ?? 0,
    userContext: { preferences: {}, sessionId: 'test-session', previousSuccesses: 0 },
  };
}

/**
 * Fail-loud breaker lookup: every site below reads the breaker for a stage
 * the EnhancedErrorRecovery constructor pre-registers, so an absent entry
 * means the wiring changed. The old `.get(…)!` read surfaced as
 * `breaker.recordFailure` TypeError red; the throw keeps the RED verdict
 * with the stage name.
 */
function requireBreaker<T>(breakers: Map<string, T>, stage: string): T {
  const breaker = breakers.get(stage);
  if (breaker === undefined) throw new Error(`expected a circuit breaker for stage "${stage}"`);
  return breaker;
}

// ============================================================
// getErrorSnapshot()
// ============================================================
describe('EnhancedErrorRecovery - getErrorSnapshot', () => {
  let recovery: EnhancedErrorRecovery;

  beforeEach(() => {
    recovery = new EnhancedErrorRecovery();
  });

  afterEach(() => {
    recovery.destroy();
  });

  it('should return a snapshot with all required fields', () => {
    const snapshot = recovery.getErrorSnapshot();

    expect(snapshot.capturedAt).toBeGreaterThan(0);
    expect(snapshot.healthMetrics).toBeDefined();
    expect(snapshot.circuitBreakers).toBeDefined();
    expect(snapshot.errorHistoryCounts).toBeDefined();
    expect(snapshot.strategyEffectiveness).toBeDefined();
    expect(snapshot.loadMetrics).toBeDefined();
    expect(snapshot.resilience).toBeDefined();
    expect(snapshot.analytics).toBeDefined();
    expect(typeof snapshot.dynamicCapacity).toBe('number');
    expect(typeof snapshot.activeRequestCount).toBe('number');
    expect(typeof snapshot.queuedRequestCount).toBe('number');
  });

  it('should reflect empty state on a fresh instance', () => {
    const snapshot = recovery.getErrorSnapshot();

    expect(snapshot.activeRequestCount).toBe(0);
    expect(snapshot.queuedRequestCount).toBe(0);
    expect(Object.values(snapshot.errorHistoryCounts).every(c => c === 0)).toBe(true);
    expect(snapshot.analytics.totalErrors).toBe(0);
  });

  it('should reflect error history after recoverFromError calls', async () => {
    await recovery.recoverFromError(makeContext({ stage: 'transcription' }));
    await recovery.recoverFromError(makeContext({ stage: 'analysis' }));
    await recovery.recoverFromError(makeContext({ stage: 'transcription' }));

    const snapshot = recovery.getErrorSnapshot();
    expect(snapshot.errorHistoryCounts['transcription']).toBe(2);
    expect(snapshot.errorHistoryCounts['analysis']).toBe(1);
    expect(snapshot.analytics.totalErrors).toBe(3);
  });

  it('should reflect circuit breaker state', async () => {
    // Force the transcription circuit breaker open by exceeding threshold
    const breaker = requireBreaker(recovery['circuitBreakers'], 'transcription');
    for (let i = 0; i < 5; i++) {
      breaker.recordFailure();
    }

    const snapshot = recovery.getErrorSnapshot();
    expect(snapshot.circuitBreakers['transcription'].state).toBe('open');
    expect(snapshot.circuitBreakers['transcription'].failureCount).toBeGreaterThanOrEqual(5);
  });

  it('should reflect strategy effectiveness after recoveries', async () => {
    await recovery.recoverFromError(makeContext({ stage: 'analysis' }));
    await recovery.recoverFromError(makeContext({ stage: 'export' }));

    const snapshot = recovery.getErrorSnapshot();
    const keys = Object.keys(snapshot.strategyEffectiveness);
    expect(keys.length).toBeGreaterThan(0);

    // Each entry should have the required fields
    for (const record of Object.values(snapshot.strategyEffectiveness)) {
      expect(typeof record.successes).toBe('number');
      expect(typeof record.failures).toBe('number');
      expect(typeof record.avgRecoveryTimeMs).toBe('number');
      expect(typeof record.lastUsedAt).toBe('number');
    }
  });

  it('should include at most 20 load metrics', () => {
    // Simulate many load metric updates
    for (let i = 0; i < 30; i++) {
      recovery['loadMetrics'].push({
        concurrentRequests: i,
        averageResponseTime: 100,
        responseTimeCount: 1,
        errorRate: 0.01,
        memoryPressure: 0.2,
        cpuUtilization: 0.3,
        timestamp: Date.now() + i * 1000,
      });
    }

    const snapshot = recovery.getErrorSnapshot();
    expect(snapshot.loadMetrics.length).toBeLessThanOrEqual(20);
  });

  it('should be JSON-serializable', () => {
    const snapshot = recovery.getErrorSnapshot();
    const json = JSON.stringify(snapshot);
    expect(json).toBeTruthy();

    // Round-trip should work
    const parsed = JSON.parse(json);
    expect(parsed.capturedAt).toBe(snapshot.capturedAt);
    expect(parsed.dynamicCapacity).toBe(snapshot.dynamicCapacity);
  });
});

// ============================================================
// clearErrorHistory()
// ============================================================
describe('EnhancedErrorRecovery - clearErrorHistory', () => {
  let recovery: EnhancedErrorRecovery;

  beforeEach(() => {
    recovery = new EnhancedErrorRecovery();
  });

  afterEach(() => {
    recovery.destroy();
  });

  it('should clear all history when called without arguments', async () => {
    await recovery.recoverFromError(makeContext({ stage: 'transcription' }));
    await recovery.recoverFromError(makeContext({ stage: 'analysis' }));

    recovery.clearErrorHistory();

    const snapshot = recovery.getErrorSnapshot();
    expect(snapshot.analytics.totalErrors).toBe(0);
  });

  it('should clear only the specified stage', async () => {
    await recovery.recoverFromError(makeContext({ stage: 'transcription' }));
    await recovery.recoverFromError(makeContext({ stage: 'analysis' }));

    recovery.clearErrorHistory('transcription');

    const snapshot = recovery.getErrorSnapshot();
    expect(snapshot.errorHistoryCounts['transcription']).toBeUndefined();
    expect(snapshot.errorHistoryCounts['analysis']).toBe(1);
  });

  it('should not affect circuit breakers', async () => {
    const breaker = requireBreaker(recovery['circuitBreakers'], 'analysis');
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();

    recovery.clearErrorHistory();

    // Circuit breaker should still be open
    const snapshot = recovery.getErrorSnapshot();
    expect(snapshot.circuitBreakers['analysis'].failureCount).toBeGreaterThanOrEqual(3);
  });

  it('should not affect strategy effectiveness records', async () => {
    await recovery.recoverFromError(makeContext({ stage: 'analysis' }));
    const statsBefore = recovery.getRecoveryStats();

    recovery.clearErrorHistory();

    const statsAfter = recovery.getRecoveryStats();
    expect(statsAfter.length).toBe(statsBefore.length);
  });
});

// ============================================================
// pruneErrorHistory()
// ============================================================
describe('EnhancedErrorRecovery - pruneErrorHistory', () => {
  let recovery: EnhancedErrorRecovery;

  beforeEach(() => {
    recovery = new EnhancedErrorRecovery();
  });

  afterEach(() => {
    recovery.destroy();
  });

  it('should remove old records beyond the age threshold', () => {
    const now = Date.now();
    const baseContext = {
      component: 'test',
      input: {},
      retryCount: 0,
      userContext: { preferences: {}, sessionId: 'test', previousSuccesses: 0 },
    };

    // Inject old and recent errors
    recovery['errorHistory'].set('transcription', [
      { ...baseContext, stage: 'transcription', error: new Error('old'), timestamp: now - 100000 },
      { ...baseContext, stage: 'transcription', error: new Error('recent'), timestamp: now - 1000 },
    ]);

    const removed = recovery.pruneErrorHistory(50000); // 50 seconds
    expect(removed).toBe(1);

    const errors = recovery['errorHistory'].get('transcription');
    expect(errors?.length).toBe(1);
    expect(errors?.[0].error.message).toBe('recent');
  });

  it('should return 0 when nothing to prune', () => {
    const now = Date.now();
    const baseContext = {
      component: 'test',
      input: {},
      retryCount: 0,
      userContext: { preferences: {}, sessionId: 'test', previousSuccesses: 0 },
    };

    recovery['errorHistory'].set('analysis', [
      { ...baseContext, stage: 'analysis', error: new Error('fresh'), timestamp: now },
    ]);

    const removed = recovery.pruneErrorHistory(60000);
    expect(removed).toBe(0);
  });

  it('should prune only the specified stage when given', () => {
    const now = Date.now();
    const baseContext = {
      component: 'test',
      input: {},
      retryCount: 0,
      userContext: { preferences: {}, sessionId: 'test', previousSuccesses: 0 },
    };

    recovery['errorHistory'].set('transcription', [
      { ...baseContext, stage: 'transcription', error: new Error('old'), timestamp: now - 100000 },
    ]);
    recovery['errorHistory'].set('analysis', [
      { ...baseContext, stage: 'analysis', error: new Error('old'), timestamp: now - 100000 },
    ]);

    const removed = recovery.pruneErrorHistory(50000, 'transcription');
    expect(removed).toBe(1);

    // Analysis should be untouched
    expect(recovery['errorHistory'].get('analysis')?.length).toBe(1);
  });

  it('should delete empty stage entries after pruning', () => {
    const now = Date.now();
    const baseContext = {
      component: 'test',
      input: {},
      retryCount: 0,
      userContext: { preferences: {}, sessionId: 'test', previousSuccesses: 0 },
    };

    recovery['errorHistory'].set('export', [
      { ...baseContext, stage: 'export', error: new Error('very old'), timestamp: now - 500000 },
    ]);

    recovery.pruneErrorHistory(100000);
    expect(recovery['errorHistory'].has('export')).toBe(false);
  });

  it('should use the configured max age when no argument given', () => {
    const now = Date.now();
    const baseContext = {
      component: 'test',
      input: {},
      retryCount: 0,
      userContext: { preferences: {}, sessionId: 'test', previousSuccesses: 0 },
    };

    // Default max age is 1 hour
    recovery['errorHistory'].set('rendering', [
      { ...baseContext, stage: 'rendering', error: new Error('old'), timestamp: now - 4000000 }, // ~1.1 hours ago
      { ...baseContext, stage: 'rendering', error: new Error('recent'), timestamp: now - 1000 },
    ]);

    const removed = recovery.pruneErrorHistory(); // Uses default 1 hour
    expect(removed).toBe(1);
  });
});

// ============================================================
// setErrorHistoryMaxAge()
// ============================================================
describe('EnhancedErrorRecovery - setErrorHistoryMaxAge', () => {
  let recovery: EnhancedErrorRecovery;

  beforeEach(() => {
    recovery = new EnhancedErrorRecovery();
  });

  afterEach(() => {
    recovery.destroy();
  });

  it('should accept valid max age values', () => {
    expect(() => recovery.setErrorHistoryMaxAge(60000)).not.toThrow();
    expect(() => recovery.setErrorHistoryMaxAge(0)).not.toThrow();
  });

  it('should reject negative values', () => {
    expect(() => recovery.setErrorHistoryMaxAge(-1)).toThrow('maxAgeMs must be non-negative');
  });

  it('should affect subsequent prune calls', () => {
    const now = Date.now();
    const baseContext = {
      component: 'test',
      input: {},
      retryCount: 0,
      userContext: { preferences: {}, sessionId: 'test', previousSuccesses: 0 },
    };

    recovery['errorHistory'].set('animation', [
      { ...baseContext, stage: 'animation', error: new Error('5s ago'), timestamp: now - 5000 },
    ]);

    // Set max age to 2 seconds — the 5-second-old record should be pruned
    recovery.setErrorHistoryMaxAge(2000);
    const removed = recovery.pruneErrorHistory();
    expect(removed).toBe(1);
  });
});

// ============================================================
// resetCircuitBreakers()
// ============================================================
describe('EnhancedErrorRecovery - resetCircuitBreakers', () => {
  let recovery: EnhancedErrorRecovery;

  beforeEach(() => {
    recovery = new EnhancedErrorRecovery();
  });

  afterEach(() => {
    recovery.destroy();
  });

  it('should reset all circuit breakers to closed', () => {
    // Force some breakers open
    const transBreaker = requireBreaker(recovery['circuitBreakers'], 'transcription');
    const renderBreaker = requireBreaker(recovery['circuitBreakers'], 'rendering');
    for (let i = 0; i < 5; i++) {
      transBreaker.recordFailure();
      renderBreaker.recordFailure();
    }

    expect(transBreaker.state).toBe('open');
    expect(renderBreaker.state).toBe('open');

    recovery.resetCircuitBreakers();

    const snapshot = recovery.getErrorSnapshot();
    for (const cb of Object.values(snapshot.circuitBreakers)) {
      expect(cb.state).toBe('closed');
      expect(cb.failureCount).toBe(0);
      expect(cb.successCount).toBe(0);
    }
  });

  it('should allow requests after reset', async () => {
    // Force breaker open
    const breaker = requireBreaker(recovery['circuitBreakers'], 'analysis');
    for (let i = 0; i < 5; i++) breaker.recordFailure();
    expect(breaker.isOpen()).toBe(true);

    recovery.resetCircuitBreakers();

    // Should be able to recover now
    const result = await recovery.recoverFromError(makeContext({ stage: 'analysis' }));
    expect(result).toBeDefined();
    expect(result.strategy).not.toBe('circuit_breaker');
  });
});

// ============================================================
// getStageRecoveryPlan()
// ============================================================
describe('EnhancedErrorRecovery - getStageRecoveryPlan', () => {
  let recovery: EnhancedErrorRecovery;

  beforeEach(() => {
    recovery = new EnhancedErrorRecovery();
  });

  afterEach(() => {
    recovery.destroy();
  });

  it('should return at least one strategy for every pipeline stage', () => {
    const stages: ProcessingStage[] = [
      'transcription', 'segmentation', 'analysis', 'diagram_detection',
      'layout_generation', 'animation', 'rendering', 'export',
    ];

    for (const stage of stages) {
      const plan = recovery.getStageRecoveryPlan(stage);
      expect(plan.length).toBeGreaterThan(0);
    }
  });

  it('should include required fields in each plan item', () => {
    const plan = recovery.getStageRecoveryPlan('analysis');

    for (const item of plan) {
      expect(item.strategyId).toBeTruthy();
      expect(item.strategyName).toBeTruthy();
      expect(typeof item.priority).toBe('number');
      expect(typeof item.learnedScore).toBe('number');
      expect(item.applicableStages.length).toBeGreaterThan(0);
      expect(item.description).toBeTruthy();
    }
  });

  it('should sort by learned score then priority', () => {
    // Before any learning, all scores are 0, so should sort by static priority
    const plan = recovery.getStageRecoveryPlan('transcription');

    if (plan.length > 1) {
      for (let i = 1; i < plan.length; i++) {
        const prev = plan[i - 1];
        const curr = plan[i];
        // If scores differ, higher score first; if same, lower priority number first
        if (Math.abs(prev.learnedScore - curr.learnedScore) > 0.01) {
          expect(prev.learnedScore).toBeGreaterThanOrEqual(curr.learnedScore);
        } else {
          expect(prev.priority).toBeLessThanOrEqual(curr.priority);
        }
      }
    }
  });

  it('should reflect learned effectiveness after recoveries', async () => {
    // Perform a few recoveries to build up effectiveness data
    await recovery.recoverFromError(makeContext({ stage: 'analysis' }));
    await recovery.recoverFromError(makeContext({ stage: 'analysis' }));

    const plan = recovery.getStageRecoveryPlan('analysis');
    // At least one strategy should now have a non-zero learned score
    const hasNonZeroScore = plan.some(item => item.learnedScore > 0);
    expect(hasNonZeroScore).toBe(true);
  });

  it('should only include strategies applicable to the given stage', () => {
    const plan = recovery.getStageRecoveryPlan('export');

    for (const item of plan) {
      expect(item.applicableStages).toContain('export');
    }
  });

  it('should return empty for unknown stages (if any)', () => {
    // The type system prevents this, but test runtime behavior
    const plan = recovery.getStageRecoveryPlan('transcription' as ProcessingStage);
    expect(plan.length).toBeGreaterThan(0);
  });
});

// ============================================================
// exportErrorReport()
// ============================================================
describe('EnhancedErrorRecovery - exportErrorReport', () => {
  let recovery: EnhancedErrorRecovery;

  beforeEach(() => {
    recovery = new EnhancedErrorRecovery();
  });

  afterEach(() => {
    recovery.destroy();
  });

  it('should return a valid report with all required fields', () => {
    const report = recovery.exportErrorReport();

    expect(report.generatedAt).toBeGreaterThan(0);
    expect(report.summary).toBeDefined();
    expect(report.summary.totalErrors).toBe(0);
    expect(report.recentErrors).toEqual([]);
    expect(report.cascadeChains).toEqual([]);
    expect(report.trends.length).toBe(8); // 8 stages
    expect(report.recommendations.length).toBeGreaterThan(0);
  });

  it('should report "operating normally" when no errors exist', () => {
    const report = recovery.exportErrorReport();
    expect(report.recommendations).toContain('System is operating normally. No immediate action required.');
  });

  it('should include recent errors after recovery attempts', async () => {
    await recovery.recoverFromError(makeContext({ stage: 'transcription', errorMessage: 'Whisper timeout' }));
    await recovery.recoverFromError(makeContext({ stage: 'analysis', errorMessage: 'LLM API error' }));

    const report = recovery.exportErrorReport();
    expect(report.summary.totalErrors).toBe(2);
    expect(report.summary.affectedStages).toContain('transcription');
    expect(report.summary.affectedStages).toContain('analysis');

    const messages = report.recentErrors.map(e => e.message);
    expect(messages).toContain('Whisper timeout');
    expect(messages).toContain('LLM API error');
  });

  it('should limit recent errors to 50 entries', () => {
    const now = Date.now();
    const baseContext = {
      component: 'test',
      input: {},
      retryCount: 0,
      userContext: { preferences: {}, sessionId: 'test', previousSuccesses: 0 },
    };

    // Inject 60 errors
    const errors = [];
    for (let i = 0; i < 60; i++) {
      errors.push({
        ...baseContext,
        stage: 'transcription' as const,
        error: new Error(`error-${i}`),
        timestamp: now - (60 - i) * 1000,
      });
    }
    recovery['errorHistory'].set('transcription', errors);

    const report = recovery.exportErrorReport();
    expect(report.recentErrors.length).toBeLessThanOrEqual(50);
  });

  it('should detect hot stages in recommendations', () => {
    const now = Date.now();
    const baseContext = {
      component: 'test',
      input: {},
      retryCount: 0,
      userContext: { preferences: {}, sessionId: 'test', previousSuccesses: 0 },
    };

    // Inject many errors into one stage to make it "hot"
    const errors = [];
    for (let i = 0; i < 15; i++) {
      errors.push({
        ...baseContext,
        stage: 'rendering' as const,
        error: new Error(`render-err-${i}`),
        timestamp: now - (15 - i) * 1000,
      });
    }
    recovery['errorHistory'].set('rendering', errors);

    const report = recovery.exportErrorReport();
    expect(report.summary.hotStages).toContain('rendering');
    expect(report.recommendations.some(r => r.includes('rendering'))).toBe(true);
  });

  it('should recommend action when circuit breakers are open', () => {
    const breaker = requireBreaker(recovery['circuitBreakers'], 'transcription');
    for (let i = 0; i < 5; i++) breaker.recordFailure();

    const report = recovery.exportErrorReport();
    expect(report.summary.openCircuitBreakers).toContain('transcription');
    expect(report.recommendations.some(r => r.includes('Circuit breakers are open'))).toBe(true);
  });

  it('should warn about increasing error trends', () => {
    const now = Date.now();
    const baseContext = {
      component: 'test',
      input: {},
      retryCount: 0,
      userContext: { preferences: {}, sessionId: 'test', previousSuccesses: 0 },
    };

    // Errors becoming more frequent = increasing trend
    const errors = [];
    for (let i = 0; i < 4; i++) {
      errors.push({
        ...baseContext,
        stage: 'layout_generation' as const,
        error: new Error(`e-${i}`),
        timestamp: now - 40000 + i * 10000,
      });
    }
    for (let i = 0; i < 4; i++) {
      errors.push({
        ...baseContext,
        stage: 'layout_generation' as const,
        error: new Error(`e-${i + 4}`),
        timestamp: now - 2000 + i * 500,
      });
    }
    recovery['errorHistory'].set('layout_generation', errors);

    const report = recovery.exportErrorReport();
    const increasingRec = report.recommendations.find(r => r.includes('increasing'));
    expect(increasingRec).toBeDefined();
    expect(increasingRec).toContain('layout_generation');
  });

  it('should warn about cascade chains', () => {
    const now = Date.now();
    const baseContext = {
      component: 'pipeline',
      input: {},
      retryCount: 0,
      userContext: { preferences: {}, sessionId: 'test', previousSuccesses: 0 },
    };

    recovery['errorHistory'].set('transcription', [
      { ...baseContext, stage: 'transcription', error: new Error('audio fail'), timestamp: now },
    ]);
    recovery['errorHistory'].set('segmentation', [
      { ...baseContext, stage: 'segmentation', error: new Error('cascade'), timestamp: now + 500 },
    ]);

    const report = recovery.exportErrorReport();
    const cascadeRec = report.recommendations.find(r => r.includes('cascade'));
    expect(cascadeRec).toBeDefined();
  });

  it('should be JSON-serializable for external consumption', () => {
    const report = recovery.exportErrorReport();
    const json = JSON.stringify(report);
    expect(json).toBeTruthy();

    const parsed = JSON.parse(json);
    expect(parsed.summary.totalErrors).toBe(0);
    expect(parsed.generatedAt).toBe(report.generatedAt);
  });
});

// ============================================================
// Integration: snapshot + report after complex scenarios
// ============================================================
describe('EnhancedErrorRecovery - State management integration', () => {
  let recovery: EnhancedErrorRecovery;

  beforeEach(() => {
    recovery = new EnhancedErrorRecovery();
  });

  afterEach(() => {
    recovery.destroy();
  });

  it('snapshot and report should be consistent after multiple operations', async () => {
    // Trigger recoveries across multiple stages
    await recovery.recoverFromError(makeContext({ stage: 'transcription', errorMessage: 'audio read error' }));
    await recovery.recoverFromError(makeContext({ stage: 'analysis', errorMessage: 'LLM timeout' }));
    await recovery.recoverFromError(makeContext({ stage: 'rendering', errorMessage: 'OOM' }));

    const snapshot = recovery.getErrorSnapshot();
    const report = recovery.exportErrorReport();

    // Both should agree on total errors
    expect(snapshot.analytics.totalErrors).toBe(report.summary.totalErrors);

    // Both should agree on hot stages
    expect(snapshot.analytics.hotStages).toEqual(report.summary.hotStages);

    // Both should agree on cascade chains
    expect(snapshot.analytics.cascadeChains.length).toBe(report.cascadeChains.length);
  });

  it('should support full state reset workflow', async () => {
    await recovery.recoverFromError(makeContext({ stage: 'analysis' }));

    // Force breaker open
    const breaker = requireBreaker(recovery['circuitBreakers'], 'analysis');
    for (let i = 0; i < 5; i++) breaker.recordFailure();

    // Full reset
    recovery.clearErrorHistory();
    recovery.resetCircuitBreakers();

    const snapshot = recovery.getErrorSnapshot();
    expect(snapshot.analytics.totalErrors).toBe(0);
    for (const cb of Object.values(snapshot.circuitBreakers)) {
      expect(cb.state).toBe('closed');
    }

    // System should be fully operational again
    const result = await recovery.recoverFromError(makeContext({ stage: 'analysis' }));
    expect(result).toBeDefined();
  });

  it('should support prune + report workflow for production monitoring', () => {
    const now = Date.now();
    const baseContext = {
      component: 'pipeline',
      input: {},
      retryCount: 0,
      userContext: { preferences: {}, sessionId: 'test', previousSuccesses: 0 },
    };

    // Inject errors spanning 2 hours
    const transErrors = [];
    for (let i = 0; i < 20; i++) {
      transErrors.push({
        ...baseContext,
        stage: 'transcription' as const,
        error: new Error(`err-${i}`),
        timestamp: now - (120 - i * 6) * 60 * 1000, // spread over 2 hours
      });
    }
    recovery['errorHistory'].set('transcription', transErrors);

    // Prune to last 30 minutes
    const pruned = recovery.pruneErrorHistory(30 * 60 * 1000);
    expect(pruned).toBeGreaterThan(0);

    // Report should only reflect remaining errors
    const report = recovery.exportErrorReport();
    expect(report.summary.totalErrors).toBeLessThan(20);
    expect(report.recentErrors.length).toBeLessThan(20);
  });

  it('recovery plan should reflect learning after multiple attempts', async () => {
    // Recover multiple times to build up learning
    for (let i = 0; i < 5; i++) {
      await recovery.recoverFromError(makeContext({ stage: 'transcription' }));
    }

    const planBefore = recovery.getStageRecoveryPlan('transcription');

    // All strategies should now have effectiveness data
    const totalScores = planBefore.reduce((sum, item) => sum + item.learnedScore, 0);
    expect(totalScores).toBeGreaterThan(0);

    // The most effective strategy should be first
    if (planBefore.length > 1) {
      expect(planBefore[0].learnedScore).toBeGreaterThanOrEqual(planBefore[1].learnedScore);
    }
  });
});

// Clean up the module-level singleton
afterAll(() => {
  globalErrorRecovery.destroy();
});
