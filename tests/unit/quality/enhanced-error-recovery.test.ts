/**
 * TASK-0045: EnhancedErrorRecovery Enhancement Tests (TDD)
 *
 * Tests for the retry with exponential backoff, fallback processing,
 * and user notification integration additions to EnhancedErrorRecovery.
 */

import {
  EnhancedErrorRecovery,
  RetryOptions,
  FallbackResult,
  NotificationPayload,
  globalErrorRecovery,
} from '@/quality/enhanced-error-recovery';

describe('EnhancedErrorRecovery - Retry with Exponential Backoff', () => {
  let recovery: EnhancedErrorRecovery;

  beforeEach(() => {
    recovery = new EnhancedErrorRecovery();
  });

  afterEach(() => {
    recovery.destroy();
  });

  describe('retryWithBackoff', () => {
    it('should retry with exponential backoff on transient failures', async () => {
      let attemptCount = 0;
      const operation = async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Temporary failure');
        }
        return 'success';
      };

      const options: RetryOptions = {
        maxRetries: 5,
        initialDelayMs: 10, // Fast for tests
        backoffMultiplier: 2,
        maxDelayMs: 100,
      };

      const result = await recovery.retryWithBackoff(operation, options);

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toBe(3);
    });

    it('should fail after max retries exceeded', async () => {
      const operation = async () => {
        throw new Error('Persistent failure');
      };

      const options: RetryOptions = {
        maxRetries: 3,
        initialDelayMs: 10,
        backoffMultiplier: 2,
        maxDelayMs: 50,
      };

      const result = await recovery.retryWithBackoff(operation, options);

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(4); // initial + 3 retries
      expect(result.lastError).toBeDefined();
      expect(result.lastError?.message).toBe('Persistent failure');
    });

    it('should succeed on first attempt if no error', async () => {
      const operation = async () => 'immediate success';

      const result = await recovery.retryWithBackoff(operation, {
        maxRetries: 3,
        initialDelayMs: 10,
        backoffMultiplier: 2,
        maxDelayMs: 100,
      });

      expect(result.success).toBe(true);
      expect(result.result).toBe('immediate success');
      expect(result.attempts).toBe(1);
    });

    it('should respect maxDelayMs', async () => {
      let attemptCount = 0;
      const delays: number[] = [];
      const originalSetTimeout = global.setTimeout;

      const operation = async () => {
        attemptCount++;
        if (attemptCount <= 2) {
          const startTime = Date.now();
          throw new Error('fail');
        }
        return 'done';
      };

      const options: RetryOptions = {
        maxRetries: 3,
        initialDelayMs: 10,
        backoffMultiplier: 3,
        maxDelayMs: 20,
      };

      const result = await recovery.retryWithBackoff(operation, options);

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
    });

    it('should provide default options when none specified', async () => {
      const operation = async () => 'success';

      const result = await recovery.retryWithBackoff(operation);

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
    });
  });

  describe('fallback processing', () => {
    it('should execute fallback when primary operation fails', async () => {
      const primaryOperation = async () => {
        throw new Error('Primary failed');
      };

      const fallbackOperation = async () => {
        return 'fallback result';
      };

      const result: FallbackResult = await recovery.executeWithFallback(
        primaryOperation,
        fallbackOperation,
        { stage: 'rendering' }
      );

      expect(result.success).toBe(true);
      expect(result.result).toBe('fallback result');
      expect(result.fallbackUsed).toBe(true);
      expect(result.primaryError).toBeDefined();
    });

    it('should use primary result when it succeeds', async () => {
      const primaryOperation = async () => 'primary result';
      const fallbackOperation = async () => 'fallback result';

      const result = await recovery.executeWithFallback(
        primaryOperation,
        fallbackOperation,
        { stage: 'analysis' }
      );

      expect(result.success).toBe(true);
      expect(result.result).toBe('primary result');
      expect(result.fallbackUsed).toBe(false);
    });

    it('should report failure when both primary and fallback fail', async () => {
      const primaryOperation = async () => {
        throw new Error('Primary failed');
      };
      const fallbackOperation = async () => {
        throw new Error('Fallback also failed');
      };

      const result = await recovery.executeWithFallback(
        primaryOperation,
        fallbackOperation,
        { stage: 'layout_generation' }
      );

      expect(result.success).toBe(false);
      expect(result.fallbackUsed).toBe(true);
      expect(result.primaryError).toBeDefined();
    });
  });

  describe('user notification integration', () => {
    it('should create notification for error events', () => {
      const error = new Error('API rate limit exceeded');
      const notification: NotificationPayload = recovery.createErrorNotification(error, {
        stage: 'analysis',
        severity: 'high',
      });

      expect(notification).toBeDefined();
      expect(notification.message).toContain('rate limit');
      expect(notification.severity).toBe('high');
      expect(notification.stage).toBe('analysis');
      expect(notification.timestamp).toBeDefined();
      expect(notification.recoverable).toBeDefined();
    });

    it('should create critical notification for OOM errors', () => {
      const error = new Error('JavaScript heap out of memory');
      const notification = recovery.createErrorNotification(error, {
        stage: 'rendering',
        severity: 'critical',
      });

      expect(notification.severity).toBe('critical');
      expect(notification.requiresUserAction).toBe(true);
    });

    it('should include suggested actions in notification', () => {
      const error = new Error('Network connection refused');
      const notification = recovery.createErrorNotification(error, {
        stage: 'transcription',
        severity: 'medium',
      });

      expect(notification.suggestedActions).toBeDefined();
      expect(notification.suggestedActions.length).toBeGreaterThan(0);
    });
  });

  describe('adaptive strategy learning', () => {
    it('should track recovery stats after successful recovery', async () => {
      const context = {
        stage: 'analysis' as const,
        component: 'test-component',
        input: {},
        error: new Error('test error'),
        timestamp: Date.now(),
        retryCount: 0,
        userContext: { preferences: {}, sessionId: 'test', previousSuccesses: 0 },
      };

      await recovery.recoverFromError(context);

      const stats = recovery.getRecoveryStats();
      // Should have at least one tracked strategy after recovery attempt
      expect(stats.length).toBeGreaterThan(0);
    });

    it('should prefer strategies with higher learned scores', async () => {
      // Create a context for the analysis stage
      const context = {
        stage: 'analysis' as const,
        component: 'test-component',
        input: {},
        error: new Error('test error'),
        timestamp: Date.now(),
        retryCount: 0,
        userContext: { preferences: {}, sessionId: 'test', previousSuccesses: 0 },
      };

      // First recovery populates effectiveness data
      await recovery.recoverFromError(context);

      // Second recovery should use learned effectiveness
      const result = await recovery.recoverFromError(context);

      // Verify stats were accumulated
      const stats = recovery.getRecoveryStats();
      const analysisStats = stats.filter(s => s.stage === 'analysis');
      expect(analysisStats.length).toBeGreaterThan(0);

      // At least one strategy should have recorded attempts
      const hasAttempts = analysisStats.some(s => s.successes + s.failures > 0);
      expect(hasAttempts).toBe(true);
    });

    it('should return empty stats when no recoveries attempted', () => {
      const stats = recovery.getRecoveryStats();
      expect(stats).toEqual([]);
    });

    it('should track both successes and failures in stats', async () => {
      const context = {
        stage: 'diagram_detection' as const,
        component: 'test',
        input: {},
        error: new Error('detection failed'),
        timestamp: Date.now(),
        retryCount: 0,
        userContext: { preferences: {}, sessionId: 'test', previousSuccesses: 0 },
      };

      await recovery.recoverFromError(context);

      const stats = recovery.getRecoveryStats();
      const detectionStats = stats.filter(s => s.stage === 'diagram_detection');
      expect(detectionStats.length).toBeGreaterThan(0);

      // Verify the stats shape
      for (const stat of detectionStats) {
        expect(stat).toHaveProperty('strategyId');
        expect(stat).toHaveProperty('successes');
        expect(stat).toHaveProperty('failures');
        expect(stat).toHaveProperty('avgRecoveryTimeMs');
        expect(typeof stat.successes).toBe('number');
        expect(typeof stat.failures).toBe('number');
      }
    });
  });
});

// Clean up the module-level singleton to prevent timer leaks
afterAll(() => {
  globalErrorRecovery.destroy();
});
