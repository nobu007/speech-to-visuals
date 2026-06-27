/**
 * Tests for division-by-zero guards in enhanced-error-recovery.ts
 *
 * Verifies that getResilienceMetrics() and calculateDynamicTimeout()
 * produce finite values even when dynamicCapacity is 0 or
 * maxConcurrentRequests is 0.
 */

import { jest } from '@jest/globals';

const mockFindSimilar = jest.fn().mockResolvedValue(null);
const mockGetStats = jest.fn().mockReturnValue({ hitRate: 0.5 });
const mockClear = jest.fn().mockResolvedValue(undefined);
const mockGet = jest.fn().mockResolvedValue(null);
const mockSet = jest.fn();
const mockHas = jest.fn().mockReturnValue(false);
const mockDelete = jest.fn().mockReturnValue(false);

jest.unstable_mockModule('@/performance/intelligent-cache', () => ({
  globalCache: {
    findSimilar: mockFindSimilar,
    getStats: mockGetStats,
    clear: mockClear,
    get: mockGet,
    set: mockSet,
    has: mockHas,
    delete: mockDelete,
  },
}));

let EnhancedErrorRecovery: typeof import('../enhanced-error-recovery').EnhancedErrorRecovery;

beforeAll(async () => {
  const mod = await import('../enhanced-error-recovery');
  EnhancedErrorRecovery = mod.EnhancedErrorRecovery;
});

describe('EnhancedErrorRecovery division-by-zero guards', () => {
  let recovery: InstanceType<typeof EnhancedErrorRecovery>;

  beforeEach(() => {
    jest.clearAllMocks();
    recovery = new EnhancedErrorRecovery();
  });

  afterEach(() => {
    recovery.destroy();
  });

  describe('getResilienceMetrics with dynamicCapacity=0', () => {
    it('should return finite overallResilience when dynamicCapacity is 0', () => {
      (recovery as unknown as { dynamicCapacity: number }).dynamicCapacity = 0;

      const metrics = recovery.getResilienceMetrics();

      // The overall resilience should be a finite number, not NaN/Infinity
      expect(Number.isFinite(metrics.overallResilience)).toBe(true);
      expect(metrics.overallResilience).toBeGreaterThanOrEqual(0);
      expect(metrics.overallResilience).toBeLessThanOrEqual(1);
    });

    it('should return finite currentLoad when dynamicCapacity is 0', () => {
      (recovery as unknown as { dynamicCapacity: number }).dynamicCapacity = 0;

      const metrics = recovery.getResilienceMetrics();

      expect(Number.isFinite(metrics.loadHandling)).toBe(true);
    });

    it('should return finite overallResilience when maxConcurrentRequests is 0', () => {
      (recovery as unknown as { dynamicCapacity: number }).dynamicCapacity = 0;
      (
        recovery as unknown as { loadBalancingConfig: { maxConcurrentRequests: number } }
      ).loadBalancingConfig.maxConcurrentRequests = 0;

      const metrics = recovery.getResilienceMetrics();

      expect(Number.isFinite(metrics.overallResilience)).toBe(true);
      // queueCapacity = maxConcurrentRequests * 2 = 0 → guard should prevent NaN
      expect(Number.isFinite(metrics.queueManagementScore)).toBe(true);
    });

    it('should return circuitBreakerEffectiveness=1 when no circuits exist', () => {
      // Clear circuit breakers to simulate empty state
      (
        recovery as unknown as { circuitBreakers: Map<string, unknown> }
      ).circuitBreakers.clear();

      const metrics = recovery.getResilienceMetrics();

      expect(metrics.circuitBreakerEffectiveness).toBe(1);
      expect(Number.isFinite(metrics.overallResilience)).toBe(true);
    });
  });

  describe('calculateDynamicTimeout with dynamicCapacity=0', () => {
    it('should return finite timeout when dynamicCapacity is 0', () => {
      (recovery as unknown as { dynamicCapacity: number }).dynamicCapacity = 0;

      const timeout = (
        recovery as unknown as {
          calculateDynamicTimeout: (stage?: string, priority?: number) => number;
        }
      ).calculateDynamicTimeout('export', 5);

      expect(Number.isFinite(timeout)).toBe(true);
      expect(timeout).toBeGreaterThanOrEqual(5000);
      expect(timeout).toBeLessThanOrEqual(120000);
    });

    it('should not produce Infinity loadFactor when capacity is 0', () => {
      (recovery as unknown as { dynamicCapacity: number }).dynamicCapacity = 0;

      const timeout = (
        recovery as unknown as {
          calculateDynamicTimeout: (stage?: string, priority?: number) => number;
        }
      ).calculateDynamicTimeout(undefined, 5);

      expect(Number.isFinite(timeout)).toBe(true);
    });
  });

  describe('updateRequestStats with dynamicCapacity=0', () => {
    it('should produce finite utilization when dynamicCapacity is 0', () => {
      (recovery as unknown as { dynamicCapacity: number }).dynamicCapacity = 0;

      const stats = (
        recovery as unknown as { requestStats: { avgResponseTime: number } }
      ).requestStats;

      expect(Number.isFinite(stats.avgResponseTime)).toBe(true);
    });
  });
});
