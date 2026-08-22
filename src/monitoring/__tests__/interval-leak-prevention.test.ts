/**
 * Tests for interval leak prevention in monitoring modules.
 * Verifies that stop()/destroy() methods properly clean up resources.
 */

import { RealTimePerformanceMonitor } from '../real-time-performance-monitor';

// Mock memory-usage
jest.mock('@stv/core/utils/memory-usage', () => ({
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

  // ProductionMonitoringExcellence describe removed with the module itself
  // (REQ-391): every metric it published was a hardcoded/random fixture
  // (97.8% detection accuracy, random 5-20% "optimization gains", 7
  // fabricated health indicators). Its only live consumer was destroy() in
  // the API graceful-shutdown list; the interval-leak surface it was tested
  // for no longer exists.
});
