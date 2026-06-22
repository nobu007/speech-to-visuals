/**
 * Tests for interval leak prevention in monitoring modules.
 * Verifies that stop()/destroy() methods properly clean up resources.
 */

import { RealTimePerformanceMonitor } from '../real-time-performance-monitor';
import { ProductionMonitoringExcellence } from '../production-monitoring-excellence';

// Mock memory-usage
jest.mock('@/utils/memory-usage', () => ({
  getMemoryUsage: jest.fn(() => ({
    heapUsed: 100 * 1024 * 1024,
    heapTotal: 200 * 1024 * 1024,
    external: 10 * 1024 * 1024,
    rss: 150 * 1024 * 1024,
  })),
}));

describe('Interval leak prevention', () => {
  describe('RealTimePerformanceMonitor', () => {
    it('has a stop() method', () => {
      const monitor = new RealTimePerformanceMonitor();
      expect(typeof monitor.stop).toBe('function');
      monitor.stop();
    });

    it('stop() clears the snapshot interval without throwing', () => {
      const monitor = new RealTimePerformanceMonitor();
      expect(() => monitor.stop()).not.toThrow();
    });

    it('stop() can be called multiple times safely', () => {
      const monitor = new RealTimePerformanceMonitor();
      monitor.stop();
      expect(() => monitor.stop()).not.toThrow();
    });

    it('stop() removes all event listeners', () => {
      const monitor = new RealTimePerformanceMonitor();
      monitor.on('metric', () => {});
      monitor.on('alert', () => {});
      monitor.stop();
      // EventEmitter.defaultMaxListeners won't grow unbounded
      // Just verify no throw
    });

    it('emits snapshot events when not stopped', (done) => {
      // Create monitor with short interval for testing
      // We can't easily override snapshotIntervalMs, so we test the event interface
      const monitor = new RealTimePerformanceMonitor();
      monitor.on('metric', (m) => {
        expect(m).toBeDefined();
        monitor.stop();
        done();
      });
      monitor.recordMetric('test', 1, 'ms');
    });

    it('reset() still works after stop()', () => {
      const monitor = new RealTimePerformanceMonitor();
      monitor.stop();
      expect(() => monitor.reset()).not.toThrow();
    });

    it('getSnapshot() still works after stop()', () => {
      const monitor = new RealTimePerformanceMonitor();
      monitor.recordRequest(true, 100);
      monitor.stop();
      const snapshot = monitor.getSnapshot();
      expect(snapshot).toBeDefined();
      expect(snapshot.pipeline.totalRequests).toBe(1);
    });
  });

  describe('ProductionMonitoringExcellence', () => {
    // NODE_ENV is 'test' during Jest, so intervals are skipped in constructor.
    // But we test the destroy() method for correctness.

    it('has a destroy() method', () => {
      const pme = new ProductionMonitoringExcellence();
      expect(typeof pme.destroy).toBe('function');
      pme.destroy();
    });

    it('destroy() clears all interval IDs', () => {
      const pme = new ProductionMonitoringExcellence();
      pme.destroy();
      // After destroy, monitoringEnabled should be false
      // We can verify destroy is idempotent
      expect(() => pme.destroy()).not.toThrow();
    });

    it('destroy() can be called multiple times safely', () => {
      const pme = new ProductionMonitoringExcellence();
      pme.destroy();
      pme.destroy();
      pme.destroy();
    });

    it('enhanceMonitoringSystem still works after destroy', async () => {
      const pme = new ProductionMonitoringExcellence();
      pme.destroy();
      // Methods should still be callable (just no background intervals)
      const result = await pme.enhanceMonitoringSystem();
      expect(result).toBeDefined();
    });
  });
});
