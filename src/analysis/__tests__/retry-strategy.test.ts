/**
 * Tests for TASK-0019: Retry Strategy with Exponential Backoff and Jitter
 */

import {
  calculateBackoff,
  generateJitter,
  calculateBackoffWithJitter,
  isRetryable,
  executeWithRetry,
  RetryStrategy,
} from '../retry-strategy';

describe('RetryStrategy', () => {
  // === Test Case 1: Backoff Calculation ===

  describe('calculateBackoff', () => {
    it('should calculate correct exponential backoff without jitter', () => {
      expect(calculateBackoff(0, 1000)).toBe(1000);
      expect(calculateBackoff(1, 1000)).toBe(2000);
      expect(calculateBackoff(2, 1000)).toBe(4000);
      expect(calculateBackoff(3, 1000)).toBe(8000);
    });

    it('should use default baseDelay of 1000ms', () => {
      expect(calculateBackoff(0)).toBe(1000);
      expect(calculateBackoff(1)).toBe(2000);
    });
  });

  // === Test Case 6: Max Delay Cap ===

  describe('maxDelay cap', () => {
    it('should cap delay at maxDelay', () => {
      expect(calculateBackoff(10, 1000, 5000)).toBe(5000);
      expect(calculateBackoff(20, 1000, 5000)).toBe(5000);
    });
  });

  // === Test Case 2: Jitter ===

  describe('generateJitter', () => {
    it('should return values within range', () => {
      // Use seeded random for deterministic test
      let seed = 0;
      const seededRandom = () => {
        seed = (seed * 16807 + 0) % 2147483647;
        return seed / 2147483647;
      };

      for (let i = 0; i < 10; i++) {
        const jitter = generateJitter(500, seededRandom);
        expect(jitter).toBeGreaterThanOrEqual(0);
        expect(jitter).toBeLessThan(500);
      }
    });
  });

  describe('calculateBackoffWithJitter', () => {
    it('should return values within expected range for 10 calls', () => {
      const results: number[] = [];
      for (let i = 0; i < 10; i++) {
        results.push(calculateBackoffWithJitter(1, 1000, 10000));
      }

      // All values should be unique (jitter makes them different)
      const uniqueValues = new Set(results);
      expect(uniqueValues.size).toBeGreaterThan(1);

      // All values should be between 2000 and 3000 (base 2000 + max 50% jitter = 1000)
      for (const val of results) {
        expect(val).toBeGreaterThanOrEqual(2000);
        expect(val).toBeLessThanOrEqual(3000);
      }
    });
  });

  // === Test Case 3: Retry Count Limit ===

  describe('executeWithRetry - retry limit', () => {
    it('should retry max 3 times and then throw', async () => {
      let callCount = 0;
      const errorFn = async () => {
        callCount++;
        const err: Error & { status?: number } = new Error('Server error');
        err.status = 500;
        throw err;
      };

      await expect(executeWithRetry(errorFn, { maxRetries: 3, baseDelay: 1, maxDelay: 10 }))
        .rejects.toThrow('Server error');

      // 1 initial + 3 retries = 4 total calls
      expect(callCount).toBe(4);
    });
  });

  // === Test Case 4: 429 Response Handling ===

  describe('executeWithRetry - 429 handling', () => {
    it('should succeed after 429 errors resolve', async () => {
      let callCount = 0;
      const intermittentFn = async () => {
        callCount++;
        if (callCount <= 2) {
          const err: Error & { status?: number } = new Error('Rate limited');
          err.status = 429;
          throw err;
        }
        return 'success';
      };

      const result = await executeWithRetry(intermittentFn, {
        maxRetries: 3,
        baseDelay: 1,
        maxDelay: 10,
      });

      expect(result).toBe('success');
      expect(callCount).toBe(3);
    });
  });

  // === Test Case 5: Non-retryable Errors ===

  describe('isRetryable', () => {
    it('should identify 429 as retryable', () => {
      const err: Error & { status?: number } = new Error('Rate limited');
      err.status = 429;
      expect(isRetryable(err)).toBe(true);
    });

    it('should identify 500 as retryable', () => {
      const err: Error & { status?: number } = new Error('Server error');
      err.status = 500;
      expect(isRetryable(err)).toBe(true);
    });

    it('should identify 502 as retryable', () => {
      const err: Error & { status?: number } = new Error('Bad gateway');
      err.status = 502;
      expect(isRetryable(err)).toBe(true);
    });

    it('should identify 401 as non-retryable', () => {
      const err: Error & { status?: number } = new Error('Unauthorized');
      err.status = 401;
      expect(isRetryable(err)).toBe(false);
    });

    it('should identify 403 as non-retryable', () => {
      const err: Error & { status?: number } = new Error('Forbidden');
      err.status = 403;
      expect(isRetryable(err)).toBe(false);
    });

    it('should identify 404 as non-retryable', () => {
      const err: Error & { status?: number } = new Error('Not found');
      err.status = 404;
      expect(isRetryable(err)).toBe(false);
    });

    it('should identify network errors as retryable', () => {
      const err: Error & { code?: string } = new Error('Connection reset');
      err.code = 'ECONNRESET';
      expect(isRetryable(err)).toBe(true);
    });
  });

  describe('executeWithRetry - non-retryable', () => {
    it('should not retry on 401 error and throw immediately', async () => {
      let callCount = 0;
      const authErrorFn = async () => {
        callCount++;
        const err: Error & { status?: number } = new Error('Unauthorized');
        err.status = 401;
        throw err;
      };

      await expect(executeWithRetry(authErrorFn, { maxRetries: 3, baseDelay: 1, maxDelay: 10 }))
        .rejects.toThrow('Unauthorized');

      expect(callCount).toBe(1);
    });
  });

  // === RetryStrategy class ===

  describe('RetryStrategy class', () => {
    it('should use default options', () => {
      const strategy = new RetryStrategy();
      const opts = strategy.getOptions();
      expect(opts.maxRetries).toBe(3);
      expect(opts.baseDelay).toBe(1000);
      expect(opts.maxDelay).toBe(10000);
    });

    it('should accept custom options', () => {
      const strategy = new RetryStrategy({ maxRetries: 5, baseDelay: 500 });
      const opts = strategy.getOptions();
      expect(opts.maxRetries).toBe(5);
      expect(opts.baseDelay).toBe(500);
    });

    it('should calculate backoff correctly', () => {
      const strategy = new RetryStrategy({ baseDelay: 1000, maxDelay: 10000 });
      expect(strategy.calculateBackoff(0)).toBe(1000);
      expect(strategy.calculateBackoff(1)).toBe(2000);
    });
  });
});
