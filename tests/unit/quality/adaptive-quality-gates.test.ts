/**
 * REQ-065 (ISS-011): Quality Gate Array Cap Tests
 *
 * Verifies that AdaptiveQualityGatesSystem enforces a maximum of 50 gates.
 */
import { jest } from '@jest/globals';

// Mock the real-time-monitor dependency before importing the module under test
jest.unstable_mockModule('@/monitoring/real-time-performance-monitor', () => ({
  realTimeMonitor: {
    getSnapshot: () => ({
      pipeline: { avgProcessingTime: 1000, p95ProcessingTime: 2000, p99ProcessingTime: 3000, successRate: 0.97, activeRequests: 0 },
      llm: { cacheHitRate: 0.5, avgFlashResponseTime: 1000, avgProResponseTime: 5000, flashUsagePercent: 80 },
      system: { memoryUsagePercent: 50, memoryUsageMB: 512, cpuUsagePercent: 30 },
      errors: { errorRate: 0.02, recoverySuccessRate: 0.90, totalErrors: 5 },
      quality: { transcriptionAccuracy: 0.90, layoutOverlapRate: 0, avgSceneQuality: 0.85 },
    }),
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PerformanceSnapshot: {} as any,
}));

const { AdaptiveQualityGatesSystem } = await import('@/quality/adaptive-quality-gates');

describe('REQ-065: Quality Gate Array Cap (ISS-011)', () => {
  let system: AdaptiveQualityGatesSystem;

  beforeEach(() => {
    system = new AdaptiveQualityGatesSystem();
  });

  it('TC-065-E01: should reject adding the 51st gate (MAX_GATES=50)', () => {
    // The constructor adds 10 default gates, so add 40 more to reach 50
    for (let i = 0; i < 40; i++) {
      const added = system.addGate({
        name: `extra-gate-${i}`,
        metric: 'avgProcessingTime',
        threshold: 1000,
        operator: 'lt',
        severity: 'minor',
        adaptable: false,
      });
      expect(added).toBe(true);
    }

    // Now we have 50 gates. The 51st should be rejected.
    const result = system.addGate({
      name: 'overflow-gate',
      metric: 'avgProcessingTime',
      threshold: 500,
      operator: 'lt',
      severity: 'minor',
      adaptable: false,
    });

    expect(result).toBe(false);
    expect(system.getGates().length).toBe(50);
  });

  it('TC-065-B01: should accept adding gates up to the exact limit (50)', () => {
    // The constructor adds 10 default gates; fill up to exactly 50
    for (let i = 0; i < 40; i++) {
      const added = system.addGate({
        name: `fill-gate-${i}`,
        metric: 'avgProcessingTime',
        threshold: 1000,
        operator: 'lt',
        severity: 'minor',
        adaptable: false,
      });
      expect(added).toBe(true);
    }

    // 50th gate should succeed
    expect(system.getGates().length).toBe(50);
  });
});
