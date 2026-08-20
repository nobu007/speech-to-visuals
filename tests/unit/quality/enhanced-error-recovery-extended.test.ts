/**
 * Extended tests for EnhancedErrorRecovery
 *
 * Covers:
 * - Recovery strategies for previously-uncovered stages (export, segmentation, animation)
 * - Error cascade detection across pipeline stages
 * - Error history analytics with trend analysis
 */

import { EnhancedErrorRecovery, globalErrorRecovery } from '@/quality/enhanced-error-recovery';

type ProcessingStage = 'transcription' | 'segmentation' | 'analysis' | 'diagram_detection' | 'layout_generation' | 'animation' | 'rendering' | 'export';

function makeContext(overrides: Partial<{ stage: ProcessingStage; retryCount: number; errorMessage: string }> = {}): Parameters<EnhancedErrorRecovery['recoverFromError']>[0] {
  return {
    stage: overrides.stage ?? 'analysis',
    component: 'test-component',
    input: {},
    error: new Error(overrides.errorMessage ?? 'test error'),
    timestamp: Date.now(),
    retryCount: overrides.retryCount ?? 0,
    userContext: { preferences: {}, sessionId: 'test-session', previousSuccesses: 0 },
  };
}

/**
 * Fail-loud accessor for the cascade/`trends.find(…)` captures: absence used
 * to surface as `x!.field` TypeError (or a bare `toBeDefined()` failure) —
 * the helper keeps the RED verdict with the missing label named.
 */
function requireDefined<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) {
    throw new Error(`${label} was not defined`);
  }
  return value;
}

describe('EnhancedErrorRecovery - Export stage recovery', () => {
  let recovery: EnhancedErrorRecovery;

  beforeEach(() => {
    recovery = new EnhancedErrorRecovery();
  });

  afterEach(() => {
    recovery.destroy();
  });

  it('should attempt simplified_export strategy for export stage', async () => {
    const context = makeContext({ stage: 'export' });
    const result = await recovery.recoverFromError(context);

    // The simplified_export strategy should be attempted and succeed
    expect(result).toBeDefined();
    // At minimum, a strategy should have been tried
    expect(['simplified_export', 'none']).toContain(result.strategy);
  });

  it('should return success when simplified_export resolves', async () => {
    const context = makeContext({ stage: 'export', errorMessage: 'Export format error' });
    const result = await recovery.recoverFromError(context);

    // simplified_export should succeed (it just returns a mock result)
    expect(result.success).toBe(true);
    expect(result.strategy).toBe('simplified_export');
    expect(result.fallbackUsed).toBe(true);
  });

  it('should record export stage recovery stats', async () => {
    const context = makeContext({ stage: 'export' });
    await recovery.recoverFromError(context);

    const stats = recovery.getRecoveryStats();
    const exportStats = stats.filter(s => s.stage === 'export');
    expect(exportStats.length).toBeGreaterThan(0);
  });
});

describe('EnhancedErrorRecovery - Segmentation stage recovery', () => {
  let recovery: EnhancedErrorRecovery;

  beforeEach(() => {
    recovery = new EnhancedErrorRecovery();
  });

  afterEach(() => {
    recovery.destroy();
  });

  it('should attempt re_segmentation strategy for segmentation stage', async () => {
    const context = makeContext({ stage: 'segmentation' });
    const result = await recovery.recoverFromError(context);

    expect(result).toBeDefined();
    expect(['re_segmentation', 'none']).toContain(result.strategy);
  });

  it('should return success when re_segmentation resolves', async () => {
    const context = makeContext({ stage: 'segmentation', errorMessage: 'Segmentation failed' });
    const result = await recovery.recoverFromError(context);

    expect(result.success).toBe(true);
    expect(result.strategy).toBe('re_segmentation');
  });

  it('should track segmentation recovery stats', async () => {
    const context = makeContext({ stage: 'segmentation' });
    await recovery.recoverFromError(context);

    const stats = recovery.getRecoveryStats();
    const segStats = stats.filter(s => s.stage === 'segmentation');
    expect(segStats.length).toBeGreaterThan(0);
  });
});

describe('EnhancedErrorRecovery - Animation stage recovery', () => {
  let recovery: EnhancedErrorRecovery;

  beforeEach(() => {
    recovery = new EnhancedErrorRecovery();
  });

  afterEach(() => {
    recovery.destroy();
  });

  it('should have a strategy for the animation stage', async () => {
    const context = makeContext({ stage: 'animation' });
    const result = await recovery.recoverFromError(context);

    expect(result).toBeDefined();
    // skip_animation or degraded_quality_fallback should be tried
    expect(['skip_animation', 'degraded_quality_fallback', 'none']).toContain(result.strategy);
  });

  it('should succeed with skip_animation fallback', async () => {
    const context = makeContext({ stage: 'animation', errorMessage: 'Animation engine crash' });
    const result = await recovery.recoverFromError(context);

    // skip_animation should succeed for the animation stage
    expect(result.success).toBe(true);
  });

  it('should record animation recovery in stats', async () => {
    const context = makeContext({ stage: 'animation' });
    await recovery.recoverFromError(context);

    const stats = recovery.getRecoveryStats();
    const animStats = stats.filter(s => s.stage === 'animation');
    expect(animStats.length).toBeGreaterThan(0);
  });
});

describe('EnhancedErrorRecovery - Error Cascade Detection', () => {
  let recovery: EnhancedErrorRecovery;

  beforeEach(() => {
    recovery = new EnhancedErrorRecovery();
  });

  afterEach(() => {
    recovery.destroy();
  });

  it('should return empty cascade chains when no errors recorded', () => {
    const chains = recovery.detectErrorCascades();
    expect(chains).toEqual([]);
  });

  it('should return empty when only one error exists', () => {
    const context = makeContext({ stage: 'transcription' });
    recovery['recordError'](context);
    // Need to manually inject since recordError is private
    // but we can use recoverFromError which calls recordError
    const chains = recovery.detectErrorCascades();
    // Single error - no cascade possible
    expect(chains.length).toBe(0);
  });

  it('should detect cascade from upstream to downstream stage', () => {
    const now = Date.now();
    const baseContext = {
      component: 'pipeline',
      input: {},
      retryCount: 0,
      userContext: { preferences: {}, sessionId: 'cascade-test', previousSuccesses: 0 },
    };

    // Manually inject errors to simulate cascade
    recovery['errorHistory'].set('transcription', [
      { ...baseContext, stage: 'transcription', error: new Error('whisper timeout'), timestamp: now },
    ]);
    recovery['errorHistory'].set('analysis', [
      { ...baseContext, stage: 'analysis', error: new Error('no input from transcription'), timestamp: now + 1000 },
    ]);

    const chains = recovery.detectErrorCascades(5000);

    expect(chains.length).toBeGreaterThan(0);
    expect(chains[0].triggerStage).toBe('transcription');
    expect(chains[0].affectedStages).toContain('analysis');
  });

  it('should detect multi-stage cascade chains', () => {
    const now = Date.now();
    const baseContext = {
      component: 'pipeline',
      input: {},
      retryCount: 0,
      userContext: { preferences: {}, sessionId: 'cascade-test', previousSuccesses: 0 },
    };

    // Simulate: transcription fails → analysis fails → layout_generation fails
    recovery['errorHistory'].set('transcription', [
      { ...baseContext, stage: 'transcription', error: new Error('audio read error'), timestamp: now },
    ]);
    recovery['errorHistory'].set('analysis', [
      { ...baseContext, stage: 'analysis', error: new Error('no transcript'), timestamp: now + 1000 },
    ]);
    recovery['errorHistory'].set('layout_generation', [
      { ...baseContext, stage: 'layout_generation', error: new Error('no analysis result'), timestamp: now + 2000 },
    ]);

    const chains = recovery.detectErrorCascades(5000);

    expect(chains.length).toBeGreaterThan(0);
    const transChain = requireDefined(
      chains.find(c => c.triggerStage === 'transcription'),
      'transcription cascade chain',
    );
    expect(transChain.affectedStages).toContain('analysis');
    expect(transChain.affectedStages).toContain('layout_generation');
  });

  it('should NOT detect cascade when errors are outside time window', () => {
    const now = Date.now();
    const baseContext = {
      component: 'pipeline',
      input: {},
      retryCount: 0,
      userContext: { preferences: {}, sessionId: 'cascade-test', previousSuccesses: 0 },
    };

    recovery['errorHistory'].set('transcription', [
      { ...baseContext, stage: 'transcription', error: new Error('timeout'), timestamp: now - 10000 },
    ]);
    recovery['errorHistory'].set('analysis', [
      { ...baseContext, stage: 'analysis', error: new Error('fail'), timestamp: now },
    ]);

    // 5 second window — the errors are 10 seconds apart
    const chains = recovery.detectErrorCascades(5000);
    expect(chains.length).toBe(0);
  });

  it('should NOT detect cascade for upstream errors (wrong direction)', () => {
    const now = Date.now();
    const baseContext = {
      component: 'pipeline',
      input: {},
      retryCount: 0,
      userContext: { preferences: {}, sessionId: 'cascade-test', previousSuccesses: 0 },
    };

    // analysis fails first, then transcription fails — this is NOT a cascade
    // (transcription is upstream of analysis, so the direction is wrong)
    recovery['errorHistory'].set('analysis', [
      { ...baseContext, stage: 'analysis', error: new Error('analysis error'), timestamp: now },
    ]);
    recovery['errorHistory'].set('transcription', [
      { ...baseContext, stage: 'transcription', error: new Error('transcription error'), timestamp: now + 500 },
    ]);

    const chains = recovery.detectErrorCascades(5000);
    // Should find no cascade because transcription is upstream of analysis
    const wrongDirection = chains.find(c =>
      c.triggerStage === 'analysis' && c.affectedStages.includes('transcription')
    );
    expect(wrongDirection).toBeUndefined();
  });

  it('should count frequency of repeated cascade patterns', () => {
    const baseContext = {
      component: 'pipeline',
      input: {},
      retryCount: 0,
      userContext: { preferences: {}, sessionId: 'cascade-test', previousSuccesses: 0 },
    };

    // Two identical cascade patterns at different times
    const t1 = Date.now() - 20000;
    const t2 = Date.now() - 5000;

    for (const baseTime of [t1, t2]) {
      const transErrors = recovery['errorHistory'].get('transcription') || [];
      transErrors.push({ ...baseContext, stage: 'transcription', error: new Error('audio read error'), timestamp: baseTime });
      recovery['errorHistory'].set('transcription', transErrors);

      const analysisErrors = recovery['errorHistory'].get('analysis') || [];
      analysisErrors.push({ ...baseContext, stage: 'analysis', error: new Error('no transcript'), timestamp: baseTime + 1000 });
      recovery['errorHistory'].set('analysis', analysisErrors);
    }

    const chains = recovery.detectErrorCascades(5000);
    const pattern = requireDefined(
      chains.find(c =>
        c.triggerStage === 'transcription' && c.affectedStages.includes('analysis')
      ),
      'transcription→analysis cascade pattern',
    );
    expect(pattern.frequency).toBeGreaterThanOrEqual(2);
  });
});

describe('EnhancedErrorRecovery - Error Analytics', () => {
  let recovery: EnhancedErrorRecovery;

  beforeEach(() => {
    recovery = new EnhancedErrorRecovery();
  });

  afterEach(() => {
    recovery.destroy();
  });

  it('should return valid analytics with no errors', () => {
    const analytics = recovery.getErrorAnalytics();

    expect(analytics.totalErrors).toBe(0);
    expect(analytics.cascadeChains).toEqual([]);
    expect(analytics.hotStages).toEqual([]);
    expect(analytics.recoverySuccessRate).toBe(1); // No failures = 100%
    expect(analytics.trends.length).toBe(8); // 8 stages
    expect(analytics.timeRange).toBeDefined();
  });

  it('should count errors by stage correctly', () => {
    const baseContext = {
      component: 'test',
      input: {},
      retryCount: 0,
      userContext: { preferences: {}, sessionId: 'test', previousSuccesses: 0 },
    };

    recovery['errorHistory'].set('transcription', [
      { ...baseContext, stage: 'transcription', error: new Error('e1'), timestamp: Date.now() },
      { ...baseContext, stage: 'transcription', error: new Error('e2'), timestamp: Date.now() + 1000 },
    ]);
    recovery['errorHistory'].set('rendering', [
      { ...baseContext, stage: 'rendering', error: new Error('e3'), timestamp: Date.now() },
    ]);

    const analytics = recovery.getErrorAnalytics();

    expect(analytics.totalErrors).toBe(3);
    expect(analytics.errorsByStage['transcription']).toBe(2);
    expect(analytics.errorsByStage['rendering']).toBe(1);
    expect(analytics.errorsByStage['analysis']).toBe(0);
  });

  it('should identify hot stages', () => {
    const baseContext = {
      component: 'test',
      input: {},
      retryCount: 0,
      userContext: { preferences: {}, sessionId: 'test', previousSuccesses: 0 },
    };
    const now = Date.now();

    // Put 10 errors in one stage, 0-1 in others → transcription is "hot"
    const transErrors = [];
    for (let i = 0; i < 10; i++) {
      transErrors.push({ ...baseContext, stage: 'transcription' as const, error: new Error(`err-${i}`), timestamp: now + i * 1000 });
    }
    recovery['errorHistory'].set('transcription', transErrors);

    const analytics = recovery.getErrorAnalytics();
    expect(analytics.hotStages).toContain('transcription');
  });

  it('should calculate trend direction correctly', () => {
    const baseContext = {
      component: 'test',
      input: {},
      retryCount: 0,
      userContext: { preferences: {}, sessionId: 'test', previousSuccesses: 0 },
    };

    // Errors becoming more frequent over time → increasing trend
    const now = Date.now();
    const errors = [];
    // First 4 errors spread over 40s (low density)
    for (let i = 0; i < 4; i++) {
      errors.push({ ...baseContext, stage: 'analysis' as const, error: new Error(`e-${i}`), timestamp: now - 40000 + i * 10000 });
    }
    // Last 4 errors within 2s (high density)
    for (let i = 0; i < 4; i++) {
      errors.push({ ...baseContext, stage: 'analysis' as const, error: new Error(`e-${i + 4}`), timestamp: now - 2000 + i * 500 });
    }
    recovery['errorHistory'].set('analysis', errors);

    const analytics = recovery.getErrorAnalytics();
    const analysisTrend = requireDefined(
      analytics.trends.find(t => t.stage === 'analysis'),
      'analysis trend',
    );
    expect(analysisTrend.trend).toBe('increasing');
    expect(analysisTrend.errorCount).toBe(8);
  });

  it('should calculate decreasing trend', () => {
    const baseContext = {
      component: 'test',
      input: {},
      retryCount: 0,
      userContext: { preferences: {}, sessionId: 'test', previousSuccesses: 0 },
    };

    const now = Date.now();
    const errors = [];
    // First 4 errors packed together (high density)
    for (let i = 0; i < 4; i++) {
      errors.push({ ...baseContext, stage: 'rendering' as const, error: new Error(`e-${i}`), timestamp: now - 5000 + i * 100 });
    }
    // Last 4 errors spread out (low density)
    for (let i = 0; i < 4; i++) {
      errors.push({ ...baseContext, stage: 'rendering' as const, error: new Error(`e-${i + 4}`), timestamp: now - 4000 + i * 5000 });
    }
    recovery['errorHistory'].set('rendering', errors);

    const analytics = recovery.getErrorAnalytics();
    const renderTrend = requireDefined(
      analytics.trends.find(t => t.stage === 'rendering'),
      'rendering trend',
    );
    expect(renderTrend.trend).toBe('decreasing');
  });

  it('should report stable trend for uniform error distribution', () => {
    const baseContext = {
      component: 'test',
      input: {},
      retryCount: 0,
      userContext: { preferences: {}, sessionId: 'test', previousSuccesses: 0 },
    };

    const now = Date.now();
    const errors = [];
    // Uniformly spaced errors → stable
    for (let i = 0; i < 6; i++) {
      errors.push({ ...baseContext, stage: 'export' as const, error: new Error(`e-${i}`), timestamp: now - 60000 + i * 10000 });
    }
    recovery['errorHistory'].set('export', errors);

    const analytics = recovery.getErrorAnalytics();
    const exportTrend = requireDefined(
      analytics.trends.find(t => t.stage === 'export'),
      'export trend',
    );
    expect(exportTrend.trend).toBe('stable');
  });

  it('should report top error types per stage', () => {
    const baseContext = {
      component: 'test',
      input: {},
      retryCount: 0,
      userContext: { preferences: {}, sessionId: 'test', previousSuccesses: 0 },
    };
    const now = Date.now();

    const errors = [
      { ...baseContext, stage: 'transcription' as const, error: Object.assign(new Error('a'), { name: 'TimeoutError' }), timestamp: now },
      { ...baseContext, stage: 'transcription' as const, error: Object.assign(new Error('b'), { name: 'TimeoutError' }), timestamp: now + 1000 },
      { ...baseContext, stage: 'transcription' as const, error: Object.assign(new Error('c'), { name: 'NetworkError' }), timestamp: now + 2000 },
    ];
    recovery['errorHistory'].set('transcription', errors);

    const analytics = recovery.getErrorAnalytics();
    const transTrend = requireDefined(
      analytics.trends.find(t => t.stage === 'transcription'),
      'transcription trend',
    );
    expect(transTrend.topErrorTypes[0]).toBe('TimeoutError');
  });

  it('should compute recovery success rate from strategy stats', async () => {
    // Recover from an error to populate strategy effectiveness
    const context = makeContext({ stage: 'analysis' });
    await recovery.recoverFromError(context);

    const analytics = recovery.getErrorAnalytics();
    // Should have some recovery stats
    expect(typeof analytics.recoverySuccessRate).toBe('number');
    expect(analytics.recoverySuccessRate).toBeGreaterThanOrEqual(0);
    expect(analytics.recoverySuccessRate).toBeLessThanOrEqual(1);
  });

  it('should include cascade chains in analytics', () => {
    const baseContext = {
      component: 'pipeline',
      input: {},
      retryCount: 0,
      userContext: { preferences: {}, sessionId: 'test', previousSuccesses: 0 },
    };
    const now = Date.now();

    recovery['errorHistory'].set('transcription', [
      { ...baseContext, stage: 'transcription', error: new Error('fail'), timestamp: now },
    ]);
    recovery['errorHistory'].set('segmentation', [
      { ...baseContext, stage: 'segmentation', error: new Error('cascade'), timestamp: now + 500 },
    ]);

    const analytics = recovery.getErrorAnalytics();
    expect(analytics.cascadeChains.length).toBeGreaterThan(0);
    expect(analytics.cascadeChains[0].triggerStage).toBe('transcription');
  });

  it('should provide correct timeRange', () => {
    const baseContext = {
      component: 'test',
      input: {},
      retryCount: 0,
      userContext: { preferences: {}, sessionId: 'test', previousSuccesses: 0 },
    };

    const earliest = Date.now() - 100000;
    const latest = Date.now();

    recovery['errorHistory'].set('transcription', [
      { ...baseContext, stage: 'transcription', error: new Error('early'), timestamp: earliest },
    ]);
    recovery['errorHistory'].set('export', [
      { ...baseContext, stage: 'export', error: new Error('late'), timestamp: latest },
    ]);

    const analytics = recovery.getErrorAnalytics();
    expect(analytics.timeRange.start).toBe(earliest);
    expect(analytics.timeRange.end).toBe(latest);
  });

  it('should include all 8 stages in trends', () => {
    const analytics = recovery.getErrorAnalytics();
    const stageNames = analytics.trends.map(t => t.stage);
    expect(stageNames).toEqual([
      'transcription', 'segmentation', 'analysis', 'diagram_detection',
      'layout_generation', 'animation', 'rendering', 'export'
    ]);
  });
});

describe('EnhancedErrorRecovery - Full pipeline stage coverage', () => {
  let recovery: EnhancedErrorRecovery;

  beforeEach(() => {
    recovery = new EnhancedErrorRecovery();
  });

  afterEach(() => {
    recovery.destroy();
  });

  const allStages: ProcessingStage[] = [
    'transcription', 'segmentation', 'analysis', 'diagram_detection',
    'layout_generation', 'animation', 'rendering', 'export'
  ];

  it.each(allStages)('should have at least one recovery strategy for stage "%s"', async (stage) => {
    const context = makeContext({ stage });
    const result = await recovery.recoverFromError(context);

    // Every stage should now have at least one strategy attempted
    // (previously export and segmentation would always fail with strategy 'none')
    expect(result).toBeDefined();
    // The strategy should NOT be 'none' — there should be an applicable strategy
    expect(result.strategy).not.toBe('none');
  });

  it('should have no stage with zero applicable strategies', () => {
    const strategies = recovery['recoveryStrategies'];
    for (const stage of allStages) {
      const applicable = strategies.filter((s: { applicableStages: ProcessingStage[] }) =>
        s.applicableStages.includes(stage)
      );
      expect(applicable.length).toBeGreaterThan(0);
    }
  });
});

// Clean up the module-level singleton
afterAll(() => {
  globalErrorRecovery.destroy();
});
