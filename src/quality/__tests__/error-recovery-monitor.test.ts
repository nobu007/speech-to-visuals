/**
 * Tests for ErrorRecoveryMonitor: runtime health monitor for the error recovery system.
 *
 * Verifies:
 * - Constructor with default and custom configs
 * - start/stop lifecycle
 * - sampleNow returns HealthAssessment
 * - getHealthStatus returns correct shape
 * - Alert level computation (none/warning/critical)
 * - Reset clears accumulated state
 * - Interval-based sampling works
 * - Auto-start option
 */

import { jest } from '@jest/globals';

// Mock the intelligent-cache module
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
let ErrorRecoveryMonitor: typeof import('../error-recovery-monitor').ErrorRecoveryMonitor;

beforeAll(async () => {
  const eerMod = await import('../enhanced-error-recovery');
  EnhancedErrorRecovery = eerMod.EnhancedErrorRecovery;
  const monMod = await import('../error-recovery-monitor');
  ErrorRecoveryMonitor = monMod.ErrorRecoveryMonitor;
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('ErrorRecoveryMonitor', () => {
  describe('constructor', () => {
    test('should create with default config', () => {
      const recovery = new EnhancedErrorRecovery();
      const monitor = new ErrorRecoveryMonitor(recovery);

      const status = monitor.getHealthStatus();
      expect(status.running).toBe(false);
      expect(status.totalSamples).toBe(0);
      expect(status.consecutiveDegraded).toBe(0);
      expect(status.alertLevel).toBe('none');
      expect(status.assessment).toBeNull();
      expect(status.lastSampledAt).toBeNull();

      monitor.stop();
    });

    test('should accept custom config', () => {
      const recovery = new EnhancedErrorRecovery();
      const monitor = new ErrorRecoveryMonitor(recovery, {
        intervalMs: 1000,
        degradedAlertThreshold: 5,
        degradedScoreThreshold: 0.3,
        trackerWindowSize: 10,
      });

      // Config is internal but we can verify behavior through sampling
      const status = monitor.getHealthStatus();
      expect(status.running).toBe(false);

      monitor.stop();
    });

    test('should auto-start when autoStart=true', () => {
      const recovery = new EnhancedErrorRecovery();
      const monitor = new ErrorRecoveryMonitor(recovery, { autoStart: true });

      const status = monitor.getHealthStatus();
      expect(status.running).toBe(true);
      // Auto-start takes an immediate sample
      expect(status.totalSamples).toBeGreaterThanOrEqual(1);

      monitor.stop();
    });
  });

  describe('start/stop lifecycle', () => {
    test('start should begin periodic sampling', () => {
      const recovery = new EnhancedErrorRecovery();
      const monitor = new ErrorRecoveryMonitor(recovery, { intervalMs: 100 });

      monitor.start();
      expect(monitor.getHealthStatus().running).toBe(true);

      monitor.stop();
    });

    test('start should take an immediate first sample', () => {
      const recovery = new EnhancedErrorRecovery();
      const monitor = new ErrorRecoveryMonitor(recovery);

      monitor.start();
      expect(monitor.getHealthStatus().totalSamples).toBe(1);

      monitor.stop();
    });

    test('start should be idempotent', () => {
      const recovery = new EnhancedErrorRecovery();
      const monitor = new ErrorRecoveryMonitor(recovery);

      monitor.start();
      monitor.start(); // second start should be no-op

      // Still only 1 sample from the first start
      expect(monitor.getHealthStatus().totalSamples).toBe(1);

      monitor.stop();
    });

    test('stop should halt periodic sampling', () => {
      const recovery = new EnhancedErrorRecovery();
      const monitor = new ErrorRecoveryMonitor(recovery, { intervalMs: 50 });

      monitor.start();
      expect(monitor.getHealthStatus().running).toBe(true);

      monitor.stop();
      expect(monitor.getHealthStatus().running).toBe(false);
    });

    test('stop should be idempotent', () => {
      const recovery = new EnhancedErrorRecovery();
      const monitor = new ErrorRecoveryMonitor(recovery);

      monitor.stop(); // no-op before start
      monitor.stop(); // double stop is safe

      expect(monitor.getHealthStatus().running).toBe(false);
    });
  });

  describe('sampleNow', () => {
    test('should return a HealthAssessment', () => {
      const recovery = new EnhancedErrorRecovery();
      const monitor = new ErrorRecoveryMonitor(recovery);

      const assessment = monitor.sampleNow();

      expect(assessment).toBeDefined();
      expect(typeof assessment.overallScore).toBe('number');
      expect(assessment.overallScore).toBeGreaterThanOrEqual(0);
      expect(assessment.overallScore).toBeLessThanOrEqual(1);
      expect(Array.isArray(assessment.stageScores)).toBe(true);
      expect(Array.isArray(assessment.degradedStages)).toBe(true);
      expect(Array.isArray(assessment.recommendations)).toBe(true);
      expect(typeof assessment.sampledAt).toBe('number');
    });

    test('should increment totalSamples', () => {
      const recovery = new EnhancedErrorRecovery();
      const monitor = new ErrorRecoveryMonitor(recovery);

      monitor.sampleNow();
      monitor.sampleNow();
      monitor.sampleNow();

      expect(monitor.getHealthStatus().totalSamples).toBe(3);
    });
  });

  describe('getHealthStatus', () => {
    test('should return correct shape with all fields', () => {
      const recovery = new EnhancedErrorRecovery();
      const monitor = new ErrorRecoveryMonitor(recovery);

      monitor.sampleNow();
      const status = monitor.getHealthStatus();

      expect(status).toHaveProperty('running');
      expect(status).toHaveProperty('lastSampledAt');
      expect(status).toHaveProperty('assessment');
      expect(status).toHaveProperty('totalSamples');
      expect(status).toHaveProperty('consecutiveDegraded');
      expect(status).toHaveProperty('alertLevel');
      expect(status.lastSampledAt).not.toBeNull();
      expect(status.assessment).not.toBeNull();
    });

    test('alertLevel should be "none" for healthy system', () => {
      const recovery = new EnhancedErrorRecovery();
      const monitor = new ErrorRecoveryMonitor(recovery);

      monitor.sampleNow();
      const status = monitor.getHealthStatus();

      // Fresh recovery system with no errors should be healthy
      expect(status.alertLevel).toBe('none');
    });
  });

  describe('reset', () => {
    test('should clear accumulated state', () => {
      const recovery = new EnhancedErrorRecovery();
      const monitor = new ErrorRecoveryMonitor(recovery);

      monitor.sampleNow();
      monitor.sampleNow();
      monitor.sampleNow();
      expect(monitor.getHealthStatus().totalSamples).toBe(3);

      monitor.reset();

      const status = monitor.getHealthStatus();
      expect(status.totalSamples).toBe(0);
      expect(status.consecutiveDegraded).toBe(0);
      expect(status.assessment).toBeNull();
      expect(status.lastSampledAt).toBeNull();
    });

    test('should NOT stop the monitor', () => {
      const recovery = new EnhancedErrorRecovery();
      const monitor = new ErrorRecoveryMonitor(recovery);

      monitor.start();
      monitor.reset();

      expect(monitor.getHealthStatus().running).toBe(true);
      monitor.stop();
    });
  });

  describe('getTracker', () => {
    test('should return the underlying ErrorRecoveryHealthTracker', () => {
      const recovery = new EnhancedErrorRecovery();
      const monitor = new ErrorRecoveryMonitor(recovery);

      const tracker = monitor.getTracker();
      expect(tracker).toBeDefined();
      expect(tracker.sampleCount).toBe(0);

      monitor.sampleNow();
      expect(tracker.sampleCount).toBe(1);
    });
  });

  describe('interval-based sampling', () => {
    test('should take multiple samples over time', async () => {
      const recovery = new EnhancedErrorRecovery();
      const monitor = new ErrorRecoveryMonitor(recovery, {
        intervalMs: 30,
      });

      monitor.start();
      // Wait for a few intervals
      await new Promise((r) => setTimeout(r, 100));

      const status = monitor.getHealthStatus();
      expect(status.totalSamples).toBeGreaterThan(1);

      monitor.stop();
    });
  });
});
