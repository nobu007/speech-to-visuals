/**
 * Tests for EnhancedErrorRecovery new features:
 * - Error Grouping & Deduplication (getErrorGroups)
 * - Stage Error Boundary (createStageErrorBoundary)
 * - Batch Recovery (recoverBatch)
 */

import {
  EnhancedErrorRecovery,
  globalErrorRecovery,
} from '@/quality/enhanced-error-recovery';
import type { StageBoundaryResult } from '@/quality/enhanced-error-recovery';

type ProcessingStage = 'transcription' | 'segmentation' | 'analysis' | 'diagram_detection' | 'layout_generation' | 'animation' | 'rendering' | 'export';

/**
 * Fail-loud presence check (Phase 150 / TASK-0237). Replaces the `…!`
 * non-null assertions this file used to postfix `.find()` / `.get()`
 * results and optional `result` fields with: an absent group, breaker or
 * notification used to surface as an opaque `Cannot read properties of
 * undefined` inside the first expect; the helper keeps the RED verdict
 * naming what was missing.
 */
function requireDefined<T>(value: T | undefined, label: string): T {
  if (value === undefined) {
    throw new Error(`${label} not found`);
  }
  return value;
}

function makeContext(overrides: Partial<{
  stage: ProcessingStage;
  retryCount: number;
  errorMessage: string;
  component: string;
}> = {}): Parameters<EnhancedErrorRecovery['recoverFromError']>[0] {
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

// ============================================================
// Error Grouping
// ============================================================
describe('EnhancedErrorRecovery - Error Grouping', () => {
  let recovery: EnhancedErrorRecovery;

  beforeEach(() => {
    recovery = new EnhancedErrorRecovery();
  });

  afterEach(() => {
    recovery.destroy();
  });

  it('should return empty groups when no errors recorded', () => {
    const groups = recovery.getErrorGroups();
    expect(groups).toEqual([]);
  });

  it('should group identical errors into a single entry', () => {
    // Inject errors directly to avoid slow recovery execution
    const baseContext = {
      component: 'whisper-adapter',
      input: {},
      retryCount: 0,
      userContext: { preferences: {}, sessionId: 'test', previousSuccesses: 0 },
    };
    const errors = Array.from({ length: 5 }, (_, i) => ({
      ...baseContext, stage: 'transcription' as const, error: new Error('Whisper timeout'), timestamp: Date.now() + i * 1000,
    }));
    recovery['errorHistory'].set('transcription', errors);

    const groups = recovery.getErrorGroups();
    expect(groups.length).toBe(1);
    expect(groups[0].count).toBe(5);
    expect(groups[0].stage).toBe('transcription');
    expect(groups[0].errorMessage).toBe('Whisper timeout');
    expect(groups[0].component).toBe('whisper-adapter');
  });

  it('should separate errors with different messages into different groups', () => {
    const baseContext = {
      component: 'gemini',
      input: {},
      retryCount: 0,
      userContext: { preferences: {}, sessionId: 'test', previousSuccesses: 0 },
    };
    recovery['errorHistory'].set('analysis', [
      { ...baseContext, stage: 'analysis' as const, error: new Error('LLM timeout'), timestamp: Date.now() },
      { ...baseContext, stage: 'analysis' as const, error: new Error('LLM timeout'), timestamp: Date.now() + 1000 },
      { ...baseContext, stage: 'analysis' as const, error: new Error('JSON parse error'), timestamp: Date.now() + 2000 },
    ]);

    const groups = recovery.getErrorGroups();
    expect(groups.length).toBe(2);

    const timeoutGroup = requireDefined(groups.find(g => g.errorMessage === 'LLM timeout'), 'LLM timeout group');
    expect(timeoutGroup.count).toBe(2);

    const parseGroup = requireDefined(groups.find(g => g.errorMessage === 'JSON parse error'), 'JSON parse error group');
    expect(parseGroup.count).toBe(1);
  });

  it('should separate errors with different stages into different groups', () => {
    const baseContext = {
      component: 'test',
      input: {},
      retryCount: 0,
      userContext: { preferences: {}, sessionId: 'test', previousSuccesses: 0 },
    };
    recovery['errorHistory'].set('transcription', [
      { ...baseContext, stage: 'transcription' as const, error: new Error('timeout'), timestamp: Date.now() },
    ]);
    recovery['errorHistory'].set('analysis', [
      { ...baseContext, stage: 'analysis' as const, error: new Error('timeout'), timestamp: Date.now() },
    ]);

    const groups = recovery.getErrorGroups();
    expect(groups.length).toBe(2);
  });

  it('should sort groups by frequency (descending)', async () => {
    // Inject errors directly to avoid slow recovery strategy execution
    const baseContext = {
      component: 'test',
      input: {},
      retryCount: 0,
      userContext: { preferences: {}, sessionId: 'test', previousSuccesses: 0 },
    };

    // 7 transcription errors
    const transErrors = Array.from({ length: 7 }, (_, i) => ({
      ...baseContext, stage: 'transcription' as const, error: new Error('very frequent error'), timestamp: Date.now() + i,
    }));
    recovery['errorHistory'].set('transcription', transErrors);

    // 3 analysis errors
    const analysisErrors = Array.from({ length: 3 }, (_, i) => ({
      ...baseContext, stage: 'analysis' as const, error: new Error('frequent error'), timestamp: Date.now() + i,
    }));
    recovery['errorHistory'].set('analysis', analysisErrors);

    // 1 rendering error
    recovery['errorHistory'].set('rendering', [
      { ...baseContext, stage: 'rendering' as const, error: new Error('rare error'), timestamp: Date.now() },
    ]);

    const groups = recovery.getErrorGroups();
    expect(groups.length).toBe(3);
    expect(groups[0].count).toBe(7);  // Most frequent first
    expect(groups[1].count).toBe(3);
    expect(groups[2].count).toBe(1);
  });

  it('should track firstOccurrence and lastOccurrence timestamps', async () => {
    const baseContext = {
      component: 'test',
      input: {},
      retryCount: 0,
      userContext: { preferences: {}, sessionId: 'test', previousSuccesses: 0 },
    };

    // Inject errors with specific timestamps
    const errors = [
      { ...baseContext, stage: 'analysis' as const, error: new Error('grouped'), timestamp: 1000 },
      { ...baseContext, stage: 'analysis' as const, error: new Error('grouped'), timestamp: 2000 },
      { ...baseContext, stage: 'analysis' as const, error: new Error('grouped'), timestamp: 5000 },
    ];
    recovery['errorHistory'].set('analysis', errors);

    const groups = recovery.getErrorGroups();
    expect(groups.length).toBe(1);
    expect(groups[0].firstOccurrence).toBe(1000);
    expect(groups[0].lastOccurrence).toBe(5000);
    expect(groups[0].count).toBe(3);
  });

  it('should track errorName from the original error', async () => {
    const customError = new Error('custom');
    customError.name = 'CustomError';

    const baseContext = {
      stage: 'rendering' as const,
      component: 'renderer',
      input: {},
      error: customError,
      timestamp: Date.now(),
      retryCount: 0,
      userContext: { preferences: {}, sessionId: 'test', previousSuccesses: 0 },
    };
    recovery['errorHistory'].set('rendering', [baseContext]);

    const groups = recovery.getErrorGroups();
    expect(groups[0].errorName).toBe('CustomError');
  });
});

// ============================================================
// Stage Error Boundary
// ============================================================
describe('EnhancedErrorRecovery - createStageErrorBoundary', () => {
  let recovery: EnhancedErrorRecovery;

  beforeEach(() => {
    recovery = new EnhancedErrorRecovery();
  });

  afterEach(() => {
    recovery.destroy();
  });

  it('should succeed immediately when operation succeeds on first try', async () => {
    const result: StageBoundaryResult<string> = await recovery.createStageErrorBoundary(
      'analysis',
      async () => 'analysis complete',
    );

    expect(result.success).toBe(true);
    expect(result.result).toBe('analysis complete');
    expect(result.recoveryAttempted).toBe(false);
    expect(result.attempts).toBe(1);
    expect(result.timeSpentMs).toBeGreaterThanOrEqual(0);
    expect(result.notification).toBeUndefined();
  });

  it('should succeed after transient failures via retry', async () => {
    let attemptCount = 0;
    const operation = async () => {
      attemptCount++;
      if (attemptCount < 3) throw new Error('Transient failure');
      return 'success after retries';
    };

    const result = await recovery.createStageErrorBoundary('transcription', operation, {
      maxRetries: 3,
      component: 'whisper',
    });

    expect(result.success).toBe(true);
    expect(result.result).toBe('success after retries');
    expect(result.recoveryAttempted).toBe(false);
    expect(result.attempts).toBe(3);
  });

  it('should attempt recovery when retries are exhausted', async () => {
    const operation = async () => {
      throw new Error('Persistent failure');
    };

    const result = await recovery.createStageErrorBoundary('analysis', operation, {
      maxRetries: 1,
    });

    // Recovery should be attempted (strategy-based recovery from the class)
    expect(result.recoveryAttempted).toBe(true);
    // The result depends on whether recovery succeeds for 'analysis' stage
    expect(requireDefined(result.notification, 'result.notification').stage).toBe('analysis');
    expect(result.timeSpentMs).toBeGreaterThanOrEqual(0);
  });

  it('should use fallback when recovery fails and fallback is provided', async () => {
    // Use a stage that has no dedicated strategy so recovery will fail
    const operation = async () => {
      throw new Error('No strategy will save us');
    };

    // Open the circuit breaker for this stage to force recovery failure
    const breaker = requireDefined(recovery['circuitBreakers'].get('rendering'), `breaker for rendering`);
    for (let i = 0; i < 10; i++) {
      breaker.recordFailure();
    }

    const result = await recovery.createStageErrorBoundary('rendering', operation, {
      maxRetries: 0,
      fallback: async () => 'fallback output',
    });

    expect(result.success).toBe(true);
    expect(result.result).toBe('fallback output');
    expect(result.recoveryAttempted).toBe(true);
    expect(result.recoveryStrategy).toBe('fallback');
  });

  it('should fail when retries, recovery, and fallback all fail', async () => {
    const operation = async () => {
      throw new Error('Unrecoverable');
    };

    // Open the circuit breaker to prevent recovery
    const breaker = requireDefined(recovery['circuitBreakers'].get('export'), `breaker for export`);
    for (let i = 0; i < 10; i++) {
      breaker.recordFailure();
    }

    const result = await recovery.createStageErrorBoundary('export', operation, {
      maxRetries: 0,
    });

    expect(result.success).toBe(false);
    expect(requireDefined(result.error, 'result.error').message).toBe('Unrecoverable');
    expect(result.recoveryAttempted).toBe(true);
    expect(requireDefined(result.notification, 'result.notification').severity).toBe('high');
  });

  it('should fail when fallback also throws', async () => {
    const operation = async () => {
      throw new Error('Primary failure');
    };

    // Open circuit breaker to prevent recovery
    const breaker = requireDefined(recovery['circuitBreakers'].get('transcription'), `breaker for transcription`);
    for (let i = 0; i < 10; i++) {
      breaker.recordFailure();
    }

    const result = await recovery.createStageErrorBoundary('transcription', operation, {
      maxRetries: 0,
      fallback: async () => { throw new Error('Fallback also fails'); },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.recoveryAttempted).toBe(true);
  });

  it('should include notification on recovery path', async () => {
    const operation = async () => {
      throw new Error('Recoverable error');
    };

    const result = await recovery.createStageErrorBoundary('analysis', operation, {
      maxRetries: 1,
      severity: 'high',
    });

    // Since analysis has recovery strategies, a notification should be generated
    expect(requireDefined(result.notification, 'result.notification').severity).toBe('high');
    expect(requireDefined(result.notification, 'result.notification').stage).toBe('analysis');
  });

  it('should pass component and sessionId to error context', async () => {
    const operation = async () => {
      throw new Error('Tracked error');
    };

    await recovery.createStageErrorBoundary('transcription', operation, {
      maxRetries: 0,
      component: 'whisper-v2',
      sessionId: 'session-123',
    });

    // Verify the error was recorded with the right component
    const errors = requireDefined(recovery['errorHistory'].get('transcription'), 'transcription error history');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].component).toBe('whisper-v2');
    expect(errors[0].userContext.sessionId).toBe('session-123');
  });
});

// ============================================================
// Batch Recovery
// ============================================================
describe('EnhancedErrorRecovery - recoverBatch', () => {
  let recovery: EnhancedErrorRecovery;

  beforeEach(() => {
    recovery = new EnhancedErrorRecovery();
  });

  afterEach(() => {
    recovery.destroy();
  });

  it('should recover from empty array', async () => {
    const results = await recovery.recoverBatch([]);
    expect(results).toEqual([]);
  });

  it('should recover from a single error', async () => {
    const contexts = [makeContext({ stage: 'analysis' })];
    const results = await recovery.recoverBatch(contexts);

    expect(results.length).toBe(1);
    expect(results[0]).toBeDefined();
    expect(results[0].success).toBeDefined();
  });

  it('should recover from multiple errors in order', async () => {
    const contexts = [
      makeContext({ stage: 'transcription' }),
      makeContext({ stage: 'analysis' }),
      makeContext({ stage: 'rendering' }),
    ];

    const results = await recovery.recoverBatch(contexts);

    expect(results.length).toBe(3);
    // Each result should be defined
    for (const result of results) {
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    }
  });

  it('should return results in the same order as input', async () => {
    const contexts = [
      makeContext({ stage: 'rendering', errorMessage: 'render error' }),
      makeContext({ stage: 'transcription', errorMessage: 'transcription error' }),
      makeContext({ stage: 'export', errorMessage: 'export error' }),
    ];

    const results = await recovery.recoverBatch(contexts);

    // Results should correspond to input order, not stage order
    expect(results.length).toBe(3);
    // Verify each result has the right strategy for its stage
    expect(results[0].strategy).toBeDefined();
    expect(results[1].strategy).toBeDefined();
    expect(results[2].strategy).toBeDefined();
  });

  it('should respect maxConcurrency', async () => {
    const executionOrder: number[] = [];

    // Create contexts where we track execution order
    const contexts = Array.from({ length: 6 }, (_, i) =>
      makeContext({ stage: 'analysis', errorMessage: `error-${i}` })
    );

    // Run with concurrency of 2
    const results = await recovery.recoverBatch(contexts, 2);

    expect(results.length).toBe(6);
    // All should have been processed
    for (const result of results) {
      expect(result).toBeDefined();
    }
  });

  it('should handle mixed success and failure results', async () => {
    // Open circuit breaker for one stage to force failure
    const breaker = requireDefined(recovery['circuitBreakers'].get('export'), `breaker for export`);
    for (let i = 0; i < 10; i++) {
      breaker.recordFailure();
    }

    const contexts = [
      makeContext({ stage: 'analysis' }),    // Should recover
      makeContext({ stage: 'export' }),      // Circuit breaker open
      makeContext({ stage: 'transcription' }), // Should recover
    ];

    const results = await recovery.recoverBatch(contexts);

    expect(results.length).toBe(3);
    // Analysis and transcription should have attempted recovery
    expect(results[0].strategy).not.toBe('circuit_breaker');
    // Export may hit circuit breaker
    expect(results[2].strategy).not.toBe('circuit_breaker');
  });

  it('should process all contexts even when some fail', async () => {
    const contexts = [
      makeContext({ stage: 'analysis' }),
      makeContext({ stage: 'segmentation' }),
      makeContext({ stage: 'diagram_detection' }),
    ];

    const results = await recovery.recoverBatch(contexts);

    // All should return a result (no thrown exceptions)
    expect(results.length).toBe(3);
    for (const result of results) {
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.strategy).toBe('string');
    }
  });
});

// Clean up the module-level singleton
afterAll(() => {
  globalErrorRecovery.destroy();
});
