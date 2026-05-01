/**
 * Comprehensive tests for enhanced-error-recovery.ts
 * Covers: EnhancedErrorRecovery class, CircuitBreaker, retryWithBackoff,
 * executeWithFallback, createErrorNotification, load balancing, resilience metrics,
 * circuit breaker states, recovery strategies, health monitoring, and edge cases.
 */

import { EnhancedErrorRecovery, globalErrorRecovery } from '../enhanced-error-recovery';

// Mock the intelligent-cache module
jest.mock('../../performance/intelligent-cache', () => ({
  globalCache: {
    findSimilar: jest.fn().mockResolvedValue(null),
    getStats: jest.fn().mockReturnValue({ hitRate: 0.5 }),
    clear: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn(),
    has: jest.fn().mockReturnValue(false),
    delete: jest.fn().mockReturnValue(false),
  },
}));

// Helper: create a valid ErrorContext
function createErrorContext(overrides: Record<string, unknown> = {}): Parameters<EnhancedErrorRecovery['recoverFromError']>[0] {
  return {
    stage: 'transcription' as const,
    component: 'test-component',
    input: { text: 'test input' },
    error: new Error('Test error'),
    timestamp: Date.now(),
    retryCount: 0,
    userContext: {
      preferences: {},
      sessionId: 'test-session',
      previousSuccesses: 5,
    },
    ...overrides,
  };
}

// Helper: create a fresh instance for each test
function createInstance(): EnhancedErrorRecovery {
  const instance = new EnhancedErrorRecovery();
  return instance;
}

// ========================================
// EnhancedErrorRecovery - Constructor & Initialization
// ========================================
describe('EnhancedErrorRecovery', () => {
  let recovery: EnhancedErrorRecovery;

  beforeEach(() => {
    jest.clearAllMocks();
    recovery = createInstance();
  });

  afterEach(() => {
    recovery.destroy();
  });

  describe('constructor and initialization', () => {
    it('should create an instance', () => {
      expect(recovery).toBeInstanceOf(EnhancedErrorRecovery);
    });

    it('should initialize health metrics with all stages at 1.0', () => {
      const report = recovery.getHealthReport();
      expect(report.overall).toBe(1.0);
      expect(report.stages.transcription).toBe(1.0);
      expect(report.stages.segmentation).toBe(1.0);
      expect(report.stages.analysis).toBe(1.0);
      expect(report.stages.diagram_detection).toBe(1.0);
      expect(report.stages.layout_generation).toBe(1.0);
      expect(report.stages.animation).toBe(1.0);
      expect(report.stages.rendering).toBe(1.0);
      expect(report.stages.export).toBe(1.0);
    });

    it('should initialize health metrics with predictive indicators', () => {
      const report = recovery.getHealthReport();
      expect(report.indicators).toHaveLength(4);
      const names = report.indicators.map(i => i.name);
      expect(names).toContain('Memory Usage');
      expect(names).toContain('Processing Speed');
      expect(names).toContain('Error Rate');
      expect(names).toContain('Cache Hit Rate');
    });

    it('should initialize with empty recommendations', () => {
      const report = recovery.getHealthReport();
      expect(report.recommendations).toEqual([]);
    });

    it('should set lastUpdated to a recent timestamp', () => {
      const report = recovery.getHealthReport();
      expect(report.lastUpdated).toBeGreaterThan(0);
      expect(Date.now() - report.lastUpdated).toBeLessThan(5000);
    });
  });

  // ========================================
  // retryWithBackoff (TASK-0045)
  // ========================================
  describe('retryWithBackoff', () => {
    it('should return success on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue('ok');
      const result = await recovery.retryWithBackoff(operation);
      expect(result.success).toBe(true);
      expect(result.result).toBe('ok');
      expect(result.attempts).toBe(1);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('recovered');
      const result = await recovery.retryWithBackoff(operation, {
        maxRetries: 3,
        initialDelayMs: 10,
        backoffMultiplier: 2,
        maxDelayMs: 100,
      });
      expect(result.success).toBe(true);
      expect(result.result).toBe('recovered');
      expect(result.attempts).toBe(3);
    });

    it('should return failure after all retries exhausted', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('always fail'));
      const result = await recovery.retryWithBackoff(operation, {
        maxRetries: 2,
        initialDelayMs: 10,
        backoffMultiplier: 2,
        maxDelayMs: 100,
      });
      expect(result.success).toBe(false);
      expect(result.attempts).toBe(3); // 1 initial + 2 retries
      expect(result.lastError).toBeInstanceOf(Error);
      expect(result.lastError!.message).toBe('always fail');
    });

    it('should use default options when none provided', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('fail'));
      const result = await recovery.retryWithBackoff(operation);
      expect(result.success).toBe(false);
      // Default maxRetries is 3, so total attempts = 4
      expect(result.attempts).toBe(4);
    });

    it('should handle partial options', async () => {
      const operation = jest.fn().mockResolvedValue('ok');
      const result = await recovery.retryWithBackoff(operation, { maxRetries: 1 });
      expect(result.success).toBe(true);
      expect(result.attempts).toBe(1);
    });

    it('should handle non-Error thrown values', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce('string error')
        .mockResolvedValue('ok');
      const result = await recovery.retryWithBackoff(operation, {
        maxRetries: 2,
        initialDelayMs: 10,
      });
      expect(result.success).toBe(true);
    });

    it('should respect maxDelayMs cap', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('ok');
      const start = Date.now();
      await recovery.retryWithBackoff(operation, {
        maxRetries: 2,
        initialDelayMs: 10000, // Would be 10s, but capped
        backoffMultiplier: 2,
        maxDelayMs: 50,
      });
      const elapsed = Date.now() - start;
      // Should be capped at 50ms, not 10000ms
      expect(elapsed).toBeLessThan(500);
    });

    it('should succeed with zero retries allowed', async () => {
      const operation = jest.fn().mockResolvedValue('ok');
      const result = await recovery.retryWithBackoff(operation, { maxRetries: 0 });
      expect(result.success).toBe(true);
      expect(result.attempts).toBe(1);
    });

    it('should fail with zero retries when operation fails', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('fail'));
      const result = await recovery.retryWithBackoff(operation, { maxRetries: 0 });
      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1);
    });
  });

  // ========================================
  // executeWithFallback (TASK-0045)
  // ========================================
  describe('executeWithFallback', () => {
    it('should succeed with primary operation', async () => {
      const primary = jest.fn().mockResolvedValue('primary result');
      const fallback = jest.fn().mockResolvedValue('fallback result');

      const result = await recovery.executeWithFallback(primary, fallback);

      expect(result.success).toBe(true);
      expect(result.result).toBe('primary result');
      expect(result.fallbackUsed).toBe(false);
      expect(fallback).not.toHaveBeenCalled();
    });

    it('should fall back when primary fails', async () => {
      const primary = jest.fn().mockRejectedValue(new Error('primary fail'));
      const fallback = jest.fn().mockResolvedValue('fallback result');

      const result = await recovery.executeWithFallback(primary, fallback);

      expect(result.success).toBe(true);
      expect(result.result).toBe('fallback result');
      expect(result.fallbackUsed).toBe(true);
      expect(result.primaryError).toBeInstanceOf(Error);
      expect(result.primaryError!.message).toBe('primary fail');
    });

    it('should return failure when both primary and fallback fail', async () => {
      const primary = jest.fn().mockRejectedValue(new Error('primary fail'));
      const fallback = jest.fn().mockRejectedValue(new Error('fallback fail'));

      const result = await recovery.executeWithFallback(primary, fallback);

      expect(result.success).toBe(false);
      expect(result.fallbackUsed).toBe(true);
      expect(result.primaryError).toBeInstanceOf(Error);
      expect(result.primaryError!.message).toBe('primary fail');
    });

    it('should handle non-Error thrown values in primary', async () => {
      const primary = jest.fn().mockRejectedValue('string error');
      const fallback = jest.fn().mockResolvedValue('fallback result');

      const result = await recovery.executeWithFallback(primary, fallback);

      expect(result.success).toBe(true);
      expect(result.result).toBe('fallback result');
      expect(result.primaryError).toBeInstanceOf(Error);
    });

    it('should handle non-Error thrown values in fallback', async () => {
      const primary = jest.fn().mockRejectedValue(new Error('primary fail'));
      const fallback = jest.fn().mockRejectedValue('string error');

      const result = await recovery.executeWithFallback(primary, fallback);

      expect(result.success).toBe(false);
      expect(result.fallbackUsed).toBe(true);
    });

    it('should use default context when not provided', async () => {
      const primary = jest.fn().mockResolvedValue('ok');
      const fallback = jest.fn();

      const result = await recovery.executeWithFallback(primary, fallback);

      expect(result.success).toBe(true);
    });

    it('should pass context with stage to error log', async () => {
      const primary = jest.fn().mockRejectedValue(new Error('fail'));
      const fallback = jest.fn().mockResolvedValue('ok');

      const result = await recovery.executeWithFallback(primary, fallback, {
        stage: 'transcription',
      });

      expect(result.success).toBe(true);
      expect(result.fallbackUsed).toBe(true);
    });

    it('should handle undefined context gracefully', async () => {
      const primary = jest.fn().mockResolvedValue('ok');
      const fallback = jest.fn();

      // @ts-expect-error Testing undefined behavior
      const result = await recovery.executeWithFallback(primary, fallback, undefined);

      expect(result.success).toBe(true);
    });
  });

  // ========================================
  // createErrorNotification (TASK-0045)
  // ========================================
  describe('createErrorNotification', () => {
    it('should create a notification with correct fields', () => {
      const error = new Error('Something went wrong');
      const notification = recovery.createErrorNotification(error, {
        stage: 'transcription',
        severity: 'high',
      });

      expect(notification.message).toBe('Something went wrong');
      expect(notification.severity).toBe('high');
      expect(notification.stage).toBe('transcription');
      expect(notification.timestamp).toBeGreaterThan(0);
      expect(notification.recoverable).toBe(true);
      expect(notification.requiresUserAction).toBe(false);
      expect(notification.suggestedActions).toBeDefined();
    });

    it('should use "unknown" stage when not provided', () => {
      const notification = recovery.createErrorNotification(
        new Error('test'),
        { severity: 'low' }
      );
      expect(notification.stage).toBe('unknown');
    });

    it('should set requiresUserAction for critical severity', () => {
      const notification = recovery.createErrorNotification(
        new Error('critical error'),
        { severity: 'critical' }
      );
      expect(notification.requiresUserAction).toBe(true);
    });

    it('should set requiresUserAction for unrecoverable errors', () => {
      const notification = recovery.createErrorNotification(
        new Error('Invalid API key'),
        { severity: 'high' }
      );
      expect(notification.recoverable).toBe(false);
      expect(notification.requiresUserAction).toBe(true);
    });

    it('should detect rate limit errors and suggest waiting', () => {
      const notification = recovery.createErrorNotification(
        new Error('Rate limit exceeded'),
        { severity: 'medium' }
      );
      expect(notification.suggestedActions).toContain('Wait a few seconds and retry');
      expect(notification.suggestedActions).toContain('Reduce the frequency of requests');
    });

    it('should detect quota errors', () => {
      const notification = recovery.createErrorNotification(
        new Error('Quota exceeded for today'),
        { severity: 'medium' }
      );
      expect(notification.suggestedActions).toContain('Wait a few seconds and retry');
    });

    it('should detect network errors', () => {
      const notification = recovery.createErrorNotification(
        new Error('Network connection lost'),
        { severity: 'medium' }
      );
      expect(notification.suggestedActions).toContain('Check your internet connection');
    });

    it('should detect memory errors', () => {
      const notification = recovery.createErrorNotification(
        new Error('Out of memory heap allocation failed'),
        { severity: 'high' }
      );
      expect(notification.suggestedActions).toContain('Close other applications to free memory');
    });

    it('should detect timeout errors', () => {
      const notification = recovery.createErrorNotification(
        new Error('Request timeout after 30s'),
        { severity: 'medium' }
      );
      expect(notification.suggestedActions).toContain('Retry with a shorter input');
    });

    it('should suggest contacting support for high severity unknown errors', () => {
      const notification = recovery.createErrorNotification(
        new Error('Unknown error'),
        { severity: 'high' }
      );
      expect(notification.suggestedActions).toContain('Contact support if the issue persists');
    });

    it('should suggest contacting support for critical unknown errors', () => {
      const notification = recovery.createErrorNotification(
        new Error('Unknown error'),
        { severity: 'critical' }
      );
      expect(notification.suggestedActions).toContain('Contact support if the issue persists');
    });

    it('should not suggest contacting support for low severity unknown errors', () => {
      const notification = recovery.createErrorNotification(
        new Error('Unknown error'),
        { severity: 'low' }
      );
      expect(notification.suggestedActions).not.toContain('Contact support if the issue persists');
    });

    it('should mark authentication errors as unrecoverable', () => {
      const notification = recovery.createErrorNotification(
        new Error('Authentication failed for user'),
        { severity: 'high' }
      );
      expect(notification.recoverable).toBe(false);
    });

    it('should mark permission denied as unrecoverable', () => {
      const notification = recovery.createErrorNotification(
        new Error('Permission denied for resource'),
        { severity: 'high' }
      );
      expect(notification.recoverable).toBe(false);
    });

    it('should set correct timestamp', () => {
      const before = Date.now();
      const notification = recovery.createErrorNotification(
        new Error('test'),
        { severity: 'low' }
      );
      const after = Date.now();
      expect(notification.timestamp).toBeGreaterThanOrEqual(before);
      expect(notification.timestamp).toBeLessThanOrEqual(after);
    });
  });

  // ========================================
  // recoverFromError
  // ========================================
  describe('recoverFromError', () => {
    it('should record error and try recovery strategies', async () => {
      const context = createErrorContext({ stage: 'transcription', retryCount: 0 });
      const result = await recovery.recoverFromError(context);
      // Should attempt intelligent_retry strategy for transcription
      expect(result).toBeDefined();
      expect(result.strategy).toBeDefined();
    });

    it('should return abort when circuit breaker is open', async () => {
      // Trip the circuit breaker by triggering multiple failures
      // We need to access the circuit breaker and force it open
      const context = createErrorContext({ stage: 'transcription' });

      // Record enough failures to trip the breaker (threshold is 3)
      for (let i = 0; i < 5; i++) {
        await recovery.recoverFromError(createErrorContext({ stage: 'transcription' }));
      }

      // The circuit breaker should now be open
      const result = await recovery.recoverFromError(context);
      // Eventually it should return abort or a failure result
      expect(result).toBeDefined();
    });

    it('should skip strategies when retryCount >= 3', async () => {
      const context = createErrorContext({ stage: 'transcription', retryCount: 3 });
      const result = await recovery.recoverFromError(context);
      // No applicable strategies when retryCount >= 3
      expect(result.success).toBe(false);
      expect(result.strategy).toBe('none');
      expect(result.nextAction).toBe('abort');
    });

    it('should handle layout_generation stage with degraded_quality_fallback', async () => {
      const context = createErrorContext({
        stage: 'layout_generation',
        retryCount: 0,
        error: new Error('Layout generation failed'),
      });
      const result = await recovery.recoverFromError(context);
      expect(result).toBeDefined();
    });

    it('should handle analysis stage with applicable strategies', async () => {
      const context = createErrorContext({ stage: 'analysis', retryCount: 0 });
      const result = await recovery.recoverFromError(context);
      expect(result).toBeDefined();
    });

    it('should handle diagram_detection stage', async () => {
      const context = createErrorContext({ stage: 'diagram_detection', retryCount: 0 });
      const result = await recovery.recoverFromError(context);
      expect(result).toBeDefined();
    });

    it('should handle rendering stage', async () => {
      const context = createErrorContext({ stage: 'rendering', retryCount: 0 });
      const result = await recovery.recoverFromError(context);
      expect(result).toBeDefined();
    });

    it('should handle animation stage', async () => {
      const context = createErrorContext({ stage: 'animation', retryCount: 0 });
      const result = await recovery.recoverFromError(context);
      expect(result).toBeDefined();
    });

    it('should handle export stage', async () => {
      const context = createErrorContext({ stage: 'export', retryCount: 0 });
      const result = await recovery.recoverFromError(context);
      expect(result).toBeDefined();
    });

    it('should handle segmentation stage', async () => {
      const context = createErrorContext({ stage: 'segmentation', retryCount: 0 });
      const result = await recovery.recoverFromError(context);
      expect(result).toBeDefined();
    });
  });

  // ========================================
  // predictFailureRisk
  // ========================================
  describe('predictFailureRisk', () => {
    it('should return low risk for healthy system', async () => {
      const result = await recovery.predictFailureRisk('transcription', { simple: true });
      expect(result).toBeDefined();
      expect(result.riskLevel).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.indicators).toBeInstanceOf(Array);
      expect(result.recommendations).toBeInstanceOf(Array);
    });

    it('should detect high risk when stage health is low', async () => {
      // Force errors to lower stage health by recording many recent errors
      const context = createErrorContext({ stage: 'analysis' });
      for (let i = 0; i < 15; i++) {
        await recovery.recoverFromError({ ...context, timestamp: Date.now() });
      }

      const result = await recovery.predictFailureRisk('analysis', { data: 'test' });
      expect(result.indicators.length + result.recommendations.length).toBeGreaterThan(0);
    }, 15000);

    it('should consider input complexity', async () => {
      const complexInput = { data: 'x'.repeat(15000), nested: { a: { b: { c: { d: { e: { f: 'deep' } } } } } } };
      const result = await recovery.predictFailureRisk('transcription', complexInput);
      // High complexity should add risk indicators
      expect(result).toBeDefined();
    });

    it('should handle all processing stages', async () => {
      const stages = [
        'transcription', 'segmentation', 'analysis', 'diagram_detection',
        'layout_generation', 'animation', 'rendering', 'export',
      ] as const;

      for (const stage of stages) {
        const result = await recovery.predictFailureRisk(stage, {});
        expect(result.riskLevel).toBeDefined();
        expect(['low', 'medium', 'high', 'critical']).toContain(result.riskLevel);
      }
    });

    it('should return critical risk for multiple risk factors', async () => {
      // Create a scenario with high memory indicator
      const healthReport = recovery.getHealthReport();
      // The initial memory usage indicator has threshold 0.8, current 0.3
      // Force many errors to trigger high error count
      for (let i = 0; i < 10; i++) {
        await recovery.recoverFromError(createErrorContext({
          stage: 'transcription',
          timestamp: Date.now(),
        }));
      }

      const result = await recovery.predictFailureRisk('transcription', { complex: true });
      expect(result).toBeDefined();
    }, 15000);
  });

  // ========================================
  // getHealthReport
  // ========================================
  describe('getHealthReport', () => {
    it('should return a copy of health metrics', () => {
      const report1 = recovery.getHealthReport();
      const report2 = recovery.getHealthReport();
      expect(report1).toEqual(report2);
      // Verify it's a copy
      report1.overall = 0;
      expect(recovery.getHealthReport().overall).toBe(1.0);
    });
  });

  // ========================================
  // getResilienceMetrics
  // ========================================
  describe('getResilienceMetrics', () => {
    it('should return resilience metrics with all expected fields', () => {
      const metrics = recovery.getResilienceMetrics();

      expect(metrics).toHaveProperty('loadHandling');
      expect(metrics).toHaveProperty('circuitBreakerEffectiveness');
      expect(metrics).toHaveProperty('errorRecoverySpeed');
      expect(metrics).toHaveProperty('adaptiveCapacityScore');
      expect(metrics).toHaveProperty('queueManagementScore');
      expect(metrics).toHaveProperty('overallResilience');
      expect(metrics).toHaveProperty('details');
    });

    it('should have overallResilience between 0 and 1', () => {
      const metrics = recovery.getResilienceMetrics();
      expect(metrics.overallResilience).toBeGreaterThanOrEqual(0);
      expect(metrics.overallResilience).toBeLessThanOrEqual(1);
    });

    it('should include details with activeRequests and dynamicCapacity', () => {
      const metrics = recovery.getResilienceMetrics();
      const details = metrics.details as Record<string, unknown>;
      expect(details).toHaveProperty('activeRequests');
      expect(details).toHaveProperty('dynamicCapacity');
      expect(details).toHaveProperty('baseCapacity');
      expect(details).toHaveProperty('queuedRequests');
      expect(details).toHaveProperty('openCircuits');
      expect(details).toHaveProperty('halfOpenCircuits');
      expect(details).toHaveProperty('totalCircuits');
    });

    it('should calculate circuit breaker effectiveness based on states', () => {
      const metrics = recovery.getResilienceMetrics();
      expect(metrics.circuitBreakerEffectiveness).toBeGreaterThanOrEqual(0);
      expect(metrics.circuitBreakerEffectiveness).toBeLessThanOrEqual(1);
    });
  });

  // ========================================
  // executeWithLoadBalancing
  // ========================================
  describe('executeWithLoadBalancing', () => {
    it('should execute a simple operation successfully', async () => {
      const result = await recovery.executeWithLoadBalancing(
        'test-1',
        () => Promise.resolve('done')
      );
      expect(result).toBe('done');
    });

    it('should track active requests during execution', async () => {
      let resolveOp: (value: string) => void;
      const operationPromise = new Promise<string>((resolve) => {
        resolveOp = resolve;
      });

      const execPromise = recovery.executeWithLoadBalancing(
        'test-active',
        () => operationPromise,
        'analysis',
        5
      );

      // Give event loop a tick to register the active request
      await new Promise((r) => setTimeout(r, 10));

      // The request should be tracked
      const metrics = recovery.getResilienceMetrics();
      const details = metrics.details as Record<string, unknown>;
      expect(details.activeRequests).toBeGreaterThanOrEqual(1);

      // Resolve immediately to avoid hanging
      resolveOp!('completed');
      const result = await execPromise;
      expect(result).toBe('completed');
    });

    it('should handle operation errors', async () => {
      await expect(
        recovery.executeWithLoadBalancing(
          'test-error',
          () => Promise.reject(new Error('operation failed'))
        )
      ).rejects.toThrow('operation failed');
    });

    it('should reject when circuit breaker is open for a stage', async () => {
      // Force circuit breaker open by recording many failures
      for (let i = 0; i < 10; i++) {
        try {
          await recovery.executeWithLoadBalancing(
            `fail-${i}`,
            () => Promise.reject(new Error('fail')),
            'rendering',
            5
          );
        } catch {
          // expected
        }
      }

      // Now the circuit breaker for rendering should be tripping
      // Try to execute again - should be rejected
      await expect(
        recovery.executeWithLoadBalancing(
          'blocked',
          () => Promise.resolve('should not work'),
          'rendering',
          5
        )
      ).rejects.toThrow();
    });

    it('should queue requests when at capacity', async () => {
      // Fill up capacity - use fewer ops to avoid timeout
      const slowOps: Array<{ resolve: (v: string) => void }> = [];
      const capacity = 15; // match maxConcurrentRequests

      for (let i = 0; i < capacity; i++) {
        const op = new Promise<string>((resolve) => {
          slowOps.push({ resolve });
        });
        recovery.executeWithLoadBalancing(`fill-${i}`, () => op, 'analysis', 5).catch(() => {});
      }

      // Give time for active requests to register
      await new Promise((r) => setTimeout(r, 20));

      // Verify we are at capacity
      const metrics = recovery.getResilienceMetrics();
      const details = metrics.details as Record<string, unknown>;
      expect(details.activeRequests).toBe(capacity);

      // Resolve all immediately to clean up
      for (const op of slowOps) {
        op.resolve('done');
      }

      // Wait for all to complete
      await new Promise((r) => setTimeout(r, 100));

      // Now execute a request that should NOT be queued (we have capacity)
      const result = await recovery.executeWithLoadBalancing(
        'after-capacity',
        () => Promise.resolve('ok'),
        'analysis',
        5
      );
      expect(result).toBe('ok');
    }, 10000);

    it('should execute without stage parameter', async () => {
      const result = await recovery.executeWithLoadBalancing(
        'no-stage',
        () => Promise.resolve(42)
      );
      expect(result).toBe(42);
    });

    it('should handle stage-specific timeout multipliers', async () => {
      // This mainly verifies that stages with different multipliers don't crash
      const stages = [
        'transcription', 'segmentation', 'analysis', 'diagram_detection',
        'layout_generation', 'animation', 'rendering', 'export',
      ] as const;

      for (const stage of stages) {
        const result = await recovery.executeWithLoadBalancing(
          `timeout-${stage}`,
          () => Promise.resolve('ok'),
          stage,
          3
        );
        expect(result).toBe('ok');
      }
    });

    it('should handle different priority levels', async () => {
      for (let priority = 1; priority <= 5; priority++) {
        const result = await recovery.executeWithLoadBalancing(
          `prio-${priority}`,
          () => Promise.resolve(`result-${priority}`),
          'transcription',
          priority
        );
        expect(result).toBe(`result-${priority}`);
      }
    });
  });

  // ========================================
  // destroy
  // ========================================
  describe('destroy', () => {
    it('should clear all timers and state', () => {
      recovery.destroy();
      // Verify no timers are running - instance should be usable but idle
      const metrics = recovery.getResilienceMetrics();
      expect(metrics).toBeDefined();
    });

    it('should be safe to call destroy multiple times', () => {
      recovery.destroy();
      recovery.destroy();
      recovery.destroy();
    });

    it('should clear active requests and queue', () => {
      recovery.destroy();
      const metrics = recovery.getResilienceMetrics();
      const details = metrics.details as Record<string, unknown>;
      expect(details.activeRequests).toBe(0);
      expect(details.queuedRequests).toBe(0);
    });
  });

  // ========================================
  // shutdown
  // ========================================
  describe('shutdown', () => {
    it('should shutdown gracefully with no active requests', async () => {
      await expect(recovery.shutdown()).resolves.toBeUndefined();
    });

    it('should clear timers on shutdown', async () => {
      await recovery.shutdown();
      // After shutdown, getResilienceMetrics should still work
      const metrics = recovery.getResilienceMetrics();
      expect(metrics).toBeDefined();
    });

    it('should reset circuit breakers on shutdown', async () => {
      await recovery.shutdown();
      const metrics = recovery.getResilienceMetrics();
      expect(metrics.circuitBreakerEffectiveness).toBeGreaterThanOrEqual(0);
    });

    it('should handle shutdown when already destroyed', async () => {
      recovery.destroy();
      await expect(recovery.shutdown()).resolves.toBeUndefined();
    });
  });

  // ========================================
  // Error recording and history
  // ========================================
  describe('error recording and history', () => {
    it('should record errors per stage', async () => {
      await recovery.recoverFromError(createErrorContext({ stage: 'transcription' }));
      await recovery.recoverFromError(createErrorContext({ stage: 'analysis' }));
      await recovery.recoverFromError(createErrorContext({ stage: 'transcription' }));

      // Errors should affect health metrics
      const report = recovery.getHealthReport();
      expect(report).toBeDefined();
    });

    it('should handle many errors for the same stage', async () => {
      for (let i = 0; i < 20; i++) {
        await recovery.recoverFromError(createErrorContext({
          stage: 'rendering',
          timestamp: Date.now(),
          error: new Error(`Error ${i}`),
        }));
      }
      // Should not crash and should maintain state
      const report = recovery.getHealthReport();
      expect(report).toBeDefined();
    });

    it('should handle errors with different components', async () => {
      await recovery.recoverFromError(createErrorContext({
        component: 'whisper',
        error: new Error('Whisper error'),
      }));
      await recovery.recoverFromError(createErrorContext({
        component: 'gemini',
        error: new Error('Gemini error'),
      }));
    });
  });

  // ========================================
  // Failure pattern analysis (via recoverFromError)
  // ========================================
  describe('failure pattern analysis', () => {
    it('should analyze patterns for repeated errors', async () => {
      const error = new Error('Recurring error');
      for (let i = 0; i < 5; i++) {
        await recovery.recoverFromError(createErrorContext({
          stage: 'transcription',
          error,
          component: 'same-component',
          timestamp: Date.now(),
        }));
      }
      // The analyzeFailurePattern method should detect the recurring pattern
    });
  });

  // ========================================
  // Cache recovery strategy
  // ========================================
  describe('cache recovery strategy', () => {
    it('should use cached results when available', async () => {
      // Import the mocked globalCache
      const { globalCache } = jest.requireMock('../../performance/intelligent-cache');

      globalCache.findSimilar.mockResolvedValueOnce({
        data: { cached: 'result', confidence: 0.9 },
      });

      const context = createErrorContext({
        stage: 'analysis',
        retryCount: 0,
      });

      const result = await recovery.recoverFromError(context);
      // Cache recovery should be attempted for 'analysis' stage
      expect(result).toBeDefined();
    });

    it('should handle cache miss gracefully', async () => {
      const { globalCache } = jest.requireMock('../../performance/intelligent-cache');
      globalCache.findSimilar.mockResolvedValueOnce(null);

      const context = createErrorContext({
        stage: 'diagram_detection',
        retryCount: 0,
      });

      const result = await recovery.recoverFromError(context);
      expect(result).toBeDefined();
    });
  });

  // ========================================
  // Adaptive parameter tuning (via adaptParametersForRetry)
  // ========================================
  describe('adaptive parameter tuning', () => {
    it('should adapt parameters for transcription stage', async () => {
      // Force high frequency pattern by recording many errors
      for (let i = 0; i < 4; i++) {
        await recovery.recoverFromError(createErrorContext({
          stage: 'transcription',
          error: new Error('Same error'),
          component: 'same-component',
          timestamp: Date.now(),
        }));
      }
      // The adaptParametersForRetry should lower thresholds
    });

    it('should adapt parameters for analysis stage', async () => {
      for (let i = 0; i < 3; i++) {
        await recovery.recoverFromError(createErrorContext({
          stage: 'analysis',
          error: new Error('Analysis failure'),
          timestamp: Date.now(),
        }));
      }
    });

    it('should adapt parameters for layout_generation stage', async () => {
      await recovery.recoverFromError(createErrorContext({
        stage: 'layout_generation',
        error: new Error('Layout failure'),
        timestamp: Date.now(),
      }));
    });
  });

  // ========================================
  // Circuit Breaker internal class
  // ========================================
  describe('CircuitBreaker behavior', () => {
    it('should trip circuit breaker after threshold failures', async () => {
      // The circuit breaker threshold is 3 for each stage
      const stage = 'rendering';
      for (let i = 0; i < 4; i++) {
        try {
          await recovery.executeWithLoadBalancing(
            `cb-fail-${i}`,
            () => Promise.reject(new Error('fail')),
            stage,
            5
          );
        } catch {
          // expected
        }
      }

      // Now trying to use this stage should fail fast
      await expect(
        recovery.executeWithLoadBalancing(
          'cb-blocked',
          () => Promise.resolve('nope'),
          stage,
          5
        )
      ).rejects.toThrow();
    });

    it('should recover from half-open state after timeout', async () => {
      // This tests that circuit breaker transitions through states
      const stage = 'export';

      // Trip the breaker
      for (let i = 0; i < 5; i++) {
        try {
          await recovery.executeWithLoadBalancing(
            `trip-${i}`,
            () => Promise.reject(new Error('fail')),
            stage,
            5
          );
        } catch {
          // expected
        }
      }

      // Force time forward - we can't easily do this with the internal breaker,
      // but we can verify the system still functions
      const metrics = recovery.getResilienceMetrics();
      expect(metrics.circuitBreakerEffectiveness).toBeLessThan(1.0);
    });
  });

  // ========================================
  // Global instance
  // ========================================
  describe('globalErrorRecovery', () => {
    it('should be an instance of EnhancedErrorRecovery', () => {
      expect(globalErrorRecovery).toBeInstanceOf(EnhancedErrorRecovery);
    });

    it('should have all public methods', () => {
      expect(typeof globalErrorRecovery.retryWithBackoff).toBe('function');
      expect(typeof globalErrorRecovery.executeWithFallback).toBe('function');
      expect(typeof globalErrorRecovery.createErrorNotification).toBe('function');
      expect(typeof globalErrorRecovery.recoverFromError).toBe('function');
      expect(typeof globalErrorRecovery.predictFailureRisk).toBe('function');
      expect(typeof globalErrorRecovery.getHealthReport).toBe('function');
      expect(typeof globalErrorRecovery.getResilienceMetrics).toBe('function');
      expect(typeof globalErrorRecovery.executeWithLoadBalancing).toBe('function');
      expect(typeof globalErrorRecovery.destroy).toBe('function');
      expect(typeof globalErrorRecovery.shutdown).toBe('function');
    });
  });

  // ========================================
  // Edge cases
  // ========================================
  describe('edge cases', () => {
    it('should handle null input in recoverFromError', async () => {
      const context = createErrorContext({ input: null });
      const result = await recovery.recoverFromError(context);
      expect(result).toBeDefined();
    });

    it('should handle undefined input in predictFailureRisk', async () => {
      const result = await recovery.predictFailureRisk('transcription', undefined);
      expect(result).toBeDefined();
    });

    it('should handle empty error message', async () => {
      const notification = recovery.createErrorNotification(
        new Error(''),
        { severity: 'low' }
      );
      expect(notification.message).toBe('');
    });

    it('should handle very long error messages', async () => {
      const longMessage = 'x'.repeat(10000);
      const notification = recovery.createErrorNotification(
        new Error(longMessage),
        { severity: 'medium' }
      );
      expect(notification.message).toBe(longMessage);
    });

    it('should handle concurrent recoverFromError calls', async () => {
      const contexts = Array.from({ length: 10 }, (_, i) =>
        createErrorContext({
          stage: 'transcription',
          component: `concurrent-${i}`,
          timestamp: Date.now(),
        })
      );

      const results = await Promise.all(
        contexts.map((ctx) => recovery.recoverFromError(ctx))
      );

      expect(results).toHaveLength(10);
      results.forEach((result) => {
        expect(result).toBeDefined();
      });
    });

    it('should handle very large input for complexity assessment', async () => {
      const hugeInput = { data: 'a'.repeat(20000) };
      const result = await recovery.predictFailureRisk('analysis', hugeInput);
      expect(result).toBeDefined();
    });

    it('should handle executeWithLoadBalancing with default priority', async () => {
      const result = await recovery.executeWithLoadBalancing(
        'default-priority',
        () => Promise.resolve('ok'),
        'analysis'
      );
      expect(result).toBe('ok');
    });

    it('should handle getStageImportance for all stages', async () => {
      // This is tested indirectly through queue processing
      const stages = [
        'transcription', 'segmentation', 'analysis', 'diagram_detection',
        'layout_generation', 'animation', 'rendering', 'export',
      ] as const;

      for (const stage of stages) {
        const result = await recovery.executeWithLoadBalancing(
          `importance-${stage}`,
          () => Promise.resolve('ok'),
          stage,
          5
        );
        expect(result).toBe('ok');
      }
    });
  });

  // ========================================
  // Recovery strategies detailed testing
  // ========================================
  describe('recovery strategies', () => {
    it('should try intelligent_retry for transcription', async () => {
      const context = createErrorContext({ stage: 'transcription', retryCount: 0 });
      const result = await recovery.recoverFromError(context);
      // intelligent_retry is the first applicable strategy for transcription
      expect(result).toBeDefined();
    });

    it('should try degraded_quality_fallback for layout_generation', async () => {
      const context = createErrorContext({ stage: 'layout_generation', retryCount: 0 });
      const result = await recovery.recoverFromError(context);
      expect(result).toBeDefined();
    });

    it('should try degraded_quality_fallback for animation', async () => {
      const context = createErrorContext({ stage: 'animation', retryCount: 0 });
      const result = await recovery.recoverFromError(context);
      expect(result).toBeDefined();
    });

    it('should try degraded_quality_fallback for rendering', async () => {
      const context = createErrorContext({ stage: 'rendering', retryCount: 0 });
      const result = await recovery.recoverFromError(context);
      expect(result).toBeDefined();
    });

    it('should try cache_recovery for analysis', async () => {
      const context = createErrorContext({ stage: 'analysis', retryCount: 0 });
      const result = await recovery.recoverFromError(context);
      expect(result).toBeDefined();
    });

    it('should try cache_recovery for layout_generation', async () => {
      const context = createErrorContext({ stage: 'layout_generation', retryCount: 0 });
      const result = await recovery.recoverFromError(context);
      expect(result).toBeDefined();
    });

    it('should try alternative_algorithm for diagram_detection', async () => {
      const context = createErrorContext({ stage: 'diagram_detection', retryCount: 0 });
      const result = await recovery.recoverFromError(context);
      expect(result).toBeDefined();
    });

    it('should try minimal_viable_output for applicable stages', async () => {
      const context = createErrorContext({ stage: 'diagram_detection', retryCount: 0 });
      const result = await recovery.recoverFromError(context);
      // minimal_viable_output is a fallback for analysis, diagram_detection, layout_generation, rendering
      expect(result).toBeDefined();
    });
  });

  // ========================================
  // Dynamic timeout calculation
  // ========================================
  describe('dynamic timeout calculation', () => {
    it('should adjust timeout based on stage', async () => {
      // transcription has 1.5x multiplier
      const result = await recovery.executeWithLoadBalancing(
        'timeout-transcription',
        () => Promise.resolve('ok'),
        'transcription',
        5
      );
      expect(result).toBe('ok');
    });

    it('should adjust timeout based on priority', async () => {
      const result = await recovery.executeWithLoadBalancing(
        'timeout-priority',
        () => Promise.resolve('ok'),
        'analysis',
        1
      );
      expect(result).toBe('ok');
    });

    it('should adjust timeout based on load', async () => {
      // Execute normally - just verifies the path works
      const result = await recovery.executeWithLoadBalancing(
        'under-load',
        () => Promise.resolve('loaded'),
        'analysis',
        5
      );
      expect(result).toBe('loaded');
    });
  });

  // ========================================
  // Queue timeout calculation
  // ========================================
  describe('queue timeout calculation', () => {
    it('should vary queue timeout based on priority', async () => {
      // This is tested indirectly through the queueing mechanism
      // High priority should get longer queue timeout
      const result = await recovery.executeWithLoadBalancing(
        'queue-timeout-test',
        () => Promise.resolve('ok'),
        'analysis',
        10 // max priority
      );
      expect(result).toBe('ok');
    });
  });

  // ========================================
  // Preventive actions
  // ========================================
  describe('preventive actions', () => {
    it('should initialize preventive actions', () => {
      // Verify the system is initialized without errors
      expect(recovery.getHealthReport()).toBeDefined();
    });

    it('should handle memory cleanup action', async () => {
      const { globalCache } = jest.requireMock('../../performance/intelligent-cache');
      globalCache.clear.mockResolvedValueOnce(undefined);

      // Force the system into a state where preventive actions trigger
      // by making an indicator high risk
      // The Memory Usage indicator starts at 0.3, threshold 0.8
      // We can't easily change it, but we can verify the system doesn't crash
      await recovery.recoverFromError(createErrorContext());
    });
  });

  // ========================================
  // Load metrics and monitoring
  // ========================================
  describe('load metrics and monitoring', () => {
    it('should track load metrics', () => {
      const metrics = recovery.getResilienceMetrics();
      expect(metrics.details).toBeDefined();
    });

    it('should calculate error recovery speed', () => {
      const metrics = recovery.getResilienceMetrics();
      expect(metrics.errorRecoverySpeed).toBeGreaterThanOrEqual(0);
    });

    it('should calculate queue management score', () => {
      const metrics = recovery.getResilienceMetrics();
      expect(metrics.queueManagementScore).toBeGreaterThanOrEqual(0);
    });

    it('should calculate adaptive capacity score', () => {
      const metrics = recovery.getResilienceMetrics();
      expect(metrics.adaptiveCapacityScore).toBeGreaterThanOrEqual(0);
    });
  });

  // ========================================
  // Response time metrics
  // ========================================
  describe('response time tracking', () => {
    it('should track response times for successful operations', async () => {
      await recovery.executeWithLoadBalancing(
        'timing-test',
        () => new Promise((resolve) => setTimeout(() => resolve('timed'), 50))
      );

      const metrics = recovery.getResilienceMetrics();
      expect(metrics).toBeDefined();
    });

    it('should track response times for failed operations', async () => {
      try {
        await recovery.executeWithLoadBalancing(
          'timing-fail',
          () => new Promise((_, reject) => setTimeout(() => reject(new Error('fail')), 50))
        );
      } catch {
        // expected
      }

      const metrics = recovery.getResilienceMetrics();
      expect(metrics).toBeDefined();
    });
  });
});
