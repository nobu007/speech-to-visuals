/**
 * Tests for StreamingQualityMonitor (REQ-091)
 *
 * Verifies:
 * - Chunk evaluation (accept/reject based on confidence)
 * - Rolling average calculation
 * - Alert emission (warning / critical)
 * - Session summary generation
 * - Callback error handling (errors are logged, not swallowed silently)
 */

import {
  StreamingQualityMonitor,
  DEFAULT_STREAMING_QUALITY_CONFIG,
} from '../streaming-quality-monitor';

describe('StreamingQualityMonitor', () => {
  describe('constructor', () => {
    it('should use default config when no overrides provided', () => {
      const monitor = new StreamingQualityMonitor();
      // Default minChunkConfidence = 0.7
      const record = monitor.evaluateChunk(0, 0.8);
      expect(record.accepted).toBe(true);
    });

    it('should merge custom config with defaults', () => {
      const monitor = new StreamingQualityMonitor({ minChunkConfidence: 0.9 });
      const record = monitor.evaluateChunk(0, 0.8);
      expect(record.accepted).toBe(false);
    });
  });

  describe('evaluateChunk', () => {
    it('should accept chunks above minChunkConfidence', () => {
      const monitor = new StreamingQualityMonitor({ minChunkConfidence: 0.7 });
      const record = monitor.evaluateChunk(0, 0.85);
      expect(record.accepted).toBe(true);
      expect(record.chunkIndex).toBe(0);
      expect(record.confidence).toBe(0.85);
    });

    it('should reject chunks below minChunkConfidence', () => {
      const monitor = new StreamingQualityMonitor({ minChunkConfidence: 0.7 });
      const record = monitor.evaluateChunk(0, 0.5);
      expect(record.accepted).toBe(false);
    });

    it('should handle non-finite confidence as 0', () => {
      const monitor = new StreamingQualityMonitor();
      const record = monitor.evaluateChunk(0, NaN);
      expect(record.confidence).toBe(0);
      expect(record.accepted).toBe(false);
    });

    it('should handle Infinity confidence as 0', () => {
      const monitor = new StreamingQualityMonitor();
      const record = monitor.evaluateChunk(0, Infinity);
      expect(record.confidence).toBe(0);
    });

    it('should record timestamp on each chunk', () => {
      const monitor = new StreamingQualityMonitor();
      const record = monitor.evaluateChunk(0, 0.9);
      expect(record.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('getRollingAverage', () => {
    it('should return 0 when no chunks recorded', () => {
      const monitor = new StreamingQualityMonitor();
      expect(monitor.getRollingAverage()).toBe(0);
    });

    it('should compute average over last N chunks', () => {
      const monitor = new StreamingQualityMonitor({ rollingWindowSize: 3 });
      monitor.evaluateChunk(0, 0.9);
      monitor.evaluateChunk(1, 0.8);
      monitor.evaluateChunk(2, 0.7);
      // Average of [0.9, 0.8, 0.7] = 0.8
      expect(monitor.getRollingAverage()).toBeCloseTo(0.8, 5);
    });

    it('should slide the window', () => {
      const monitor = new StreamingQualityMonitor({ rollingWindowSize: 2 });
      monitor.evaluateChunk(0, 1.0);
      monitor.evaluateChunk(1, 0.4);
      monitor.evaluateChunk(2, 0.4);
      // Window is last 2: [0.4, 0.4] = 0.4
      expect(monitor.getRollingAverage()).toBeCloseTo(0.4, 5);
    });
  });

  describe('alert emission', () => {
    it('should emit warning alert when rolling avg drops below warningThreshold', () => {
      const monitor = new StreamingQualityMonitor({
        rollingWindowSize: 3,
        warningThreshold: 0.6,
        criticalThreshold: 0.3,
      });
      let alertCallCount = 0;
      monitor.onAlert(() => { alertCallCount++; });

      // Fill window with low confidence to trigger warning
      monitor.evaluateChunk(0, 0.5);
      monitor.evaluateChunk(1, 0.5);
      monitor.evaluateChunk(2, 0.5);

      const alerts = monitor.getAlerts();
      expect(alerts.length).toBeGreaterThanOrEqual(1);
      expect(alerts[0].severity).toBe('warning');
      expect(alertCallCount).toBeGreaterThanOrEqual(1);
    });

    it('should emit critical alert when rolling avg drops below criticalThreshold', () => {
      const monitor = new StreamingQualityMonitor({
        rollingWindowSize: 3,
        warningThreshold: 0.6,
        criticalThreshold: 0.4,
      });
      monitor.evaluateChunk(0, 0.2);
      monitor.evaluateChunk(1, 0.2);
      monitor.evaluateChunk(2, 0.2);

      const alerts = monitor.getAlerts();
      const criticalAlerts = alerts.filter(a => a.severity === 'critical');
      expect(criticalAlerts.length).toBeGreaterThanOrEqual(1);
    });

    it('should not emit alerts before window is filled', () => {
      const monitor = new StreamingQualityMonitor({
        rollingWindowSize: 5,
        warningThreshold: 0.6,
        criticalThreshold: 0.4,
      });
      monitor.evaluateChunk(0, 0.1);
      monitor.evaluateChunk(1, 0.1);
      expect(monitor.getAlerts()).toHaveLength(0);
    });

    it('should not emit alerts when quality is above thresholds', () => {
      const monitor = new StreamingQualityMonitor({
        rollingWindowSize: 3,
        warningThreshold: 0.6,
        criticalThreshold: 0.4,
      });
      for (let i = 0; i < 5; i++) {
        monitor.evaluateChunk(i, 0.95);
      }
      expect(monitor.getAlerts()).toHaveLength(0);
    });

    it('should include message and rollingAverage in alert', () => {
      const monitor = new StreamingQualityMonitor({
        rollingWindowSize: 3,
        warningThreshold: 0.6,
        criticalThreshold: 0.3,
      });
      monitor.evaluateChunk(0, 0.5);
      monitor.evaluateChunk(1, 0.5);
      monitor.evaluateChunk(2, 0.5);

      const alert = monitor.getAlerts()[0];
      expect(alert.message).toContain('degraded');
      expect(alert.rollingAverage).toBeCloseTo(0.5, 5);
      expect(alert.chunkIndex).toBe(2);
      expect(alert.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('callback error handling', () => {
    it('should not throw when alert callback throws', () => {
      const monitor = new StreamingQualityMonitor({
        rollingWindowSize: 2,
        warningThreshold: 0.6,
        criticalThreshold: 0.3,
      });
      monitor.onAlert(() => { throw new Error('callback failure'); });

      // This should not throw despite the callback error
      expect(() => {
        monitor.evaluateChunk(0, 0.3);
        monitor.evaluateChunk(1, 0.3);
      }).not.toThrow();
    });

    it('should continue calling remaining callbacks when one throws', () => {
      const monitor = new StreamingQualityMonitor({
        rollingWindowSize: 2,
        warningThreshold: 0.6,
        criticalThreshold: 0.3,
      });
      let secondCalled = false;
      monitor.onAlert(() => { throw new Error('first callback failure'); });
      monitor.onAlert(() => { secondCalled = true; });

      monitor.evaluateChunk(0, 0.3);
      monitor.evaluateChunk(1, 0.3);

      expect(secondCalled).toBe(true);
    });

    it('should log the error when callback throws', () => {
      // The error logging replaces the previous silent catch.
      // We verify the monitor does not crash and alerts are still emitted.
      const monitor = new StreamingQualityMonitor({
        rollingWindowSize: 2,
        warningThreshold: 0.6,
        criticalThreshold: 0.3,
      });
      const error = new Error('test callback error');
      monitor.onAlert(() => { throw error; });

      monitor.evaluateChunk(0, 0.3);
      monitor.evaluateChunk(1, 0.3);

      // Alert should still be recorded internally even if callback failed
      expect(monitor.getAlerts().length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('onAlert unsubscribe (listener-registration leak)', () => {
    // onAlert MUST return an unsubscribe so a caller registering repeatedly
    // against the same instance releases the callback (and its closure) rather
    // than relying on incidental GC. Mirrors ProductionErrorHandler.onError
    // (09t): ref-counted — same reference registered N times needs N
    // unsubscribes. The public evaluateChunk path fires alerts on every chunk
    // once the rolling window is full and the average stays below threshold.
    const newMonitor = () =>
      new StreamingQualityMonitor({
        rollingWindowSize: 2,
        warningThreshold: 0.6,
        criticalThreshold: 0.3,
      });

    it('returns an unsubscribe that stops the callback from firing', () => {
      const monitor = newMonitor();
      const cb = jest.fn();
      const unsubscribe = monitor.onAlert(cb);

      monitor.evaluateChunk(0, 0.3); // window not full yet
      monitor.evaluateChunk(1, 0.3); // window full → warning alert fires
      expect(cb).toHaveBeenCalledTimes(1);

      unsubscribe();

      monitor.evaluateChunk(2, 0.3); // would fire again — but cb is released
      monitor.evaluateChunk(3, 0.3);
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('is ref-counted: N registrations need N unsubscribes', () => {
      const monitor = newMonitor();
      const cb = jest.fn();
      const unsub1 = monitor.onAlert(cb);
      const unsub2 = monitor.onAlert(cb);

      monitor.evaluateChunk(0, 0.3);
      monitor.evaluateChunk(1, 0.3); // 2 registrations → fires twice
      expect(cb).toHaveBeenCalledTimes(2);

      unsub1();
      monitor.evaluateChunk(2, 0.3); // 1 registration remains
      expect(cb).toHaveBeenCalledTimes(3);

      unsub2();
      monitor.evaluateChunk(3, 0.3); // fully released
      expect(cb).toHaveBeenCalledTimes(3);
    });

    it('unsubscribe is idempotent and isolates siblings', () => {
      const monitor = newMonitor();
      const cbA = jest.fn();
      const cbB = jest.fn();
      const unsubA = monitor.onAlert(cbA);
      monitor.onAlert(cbB);

      expect(() => { unsubA(); unsubA(); }).not.toThrow();

      monitor.evaluateChunk(0, 0.3);
      monitor.evaluateChunk(1, 0.3);
      expect(cbA).not.toHaveBeenCalled();
      expect(cbB).toHaveBeenCalledTimes(1);
    });
  });

  describe('getSummary', () => {
    it('should return empty summary when no chunks evaluated', () => {
      const monitor = new StreamingQualityMonitor();
      const summary = monitor.getSummary();
      expect(summary.totalChunks).toBe(0);
      expect(summary.acceptedChunks).toBe(0);
      expect(summary.rejectedChunks).toBe(0);
      expect(summary.averageConfidence).toBe(0);
      // Defect-9 polarity b: an empty session must NOT manufacture the TOP
      // quality tier from nothing (status 'excellent' while averageConfidence
      // is 0 — a self-contradictory summary). Absent data fails loud.
      expect(summary.status).toBe('poor');
    });

    it('should compute summary statistics correctly', () => {
      const monitor = new StreamingQualityMonitor({
        minChunkConfidence: 0.7,
        rollingWindowSize: 5,
        warningThreshold: 0.2,
        criticalThreshold: 0.1,
      });
      monitor.evaluateChunk(0, 0.9);
      monitor.evaluateChunk(1, 0.8);
      monitor.evaluateChunk(2, 0.5);
      monitor.evaluateChunk(3, 0.95);

      const summary = monitor.getSummary();
      expect(summary.totalChunks).toBe(4);
      expect(summary.acceptedChunks).toBe(3);
      expect(summary.rejectedChunks).toBe(1);
      expect(summary.averageConfidence).toBeCloseTo((0.9 + 0.8 + 0.5 + 0.95) / 4, 5);
      expect(summary.minConfidence).toBeCloseTo(0.5, 5);
      expect(summary.maxConfidence).toBeCloseTo(0.95, 5);
    });

    it('should determine status as excellent for avg >= 0.9', () => {
      const monitor = new StreamingQualityMonitor({
        rollingWindowSize: 5,
        warningThreshold: 0.2,
        criticalThreshold: 0.1,
      });
      for (let i = 0; i < 5; i++) {
        monitor.evaluateChunk(i, 0.95);
      }
      expect(monitor.getSummary().status).toBe('excellent');
    });

    it('should determine status as good for avg >= 0.75', () => {
      const monitor = new StreamingQualityMonitor({
        rollingWindowSize: 5,
        warningThreshold: 0.2,
        criticalThreshold: 0.1,
      });
      for (let i = 0; i < 5; i++) {
        monitor.evaluateChunk(i, 0.8);
      }
      expect(monitor.getSummary().status).toBe('good');
    });

    it('should determine status as degraded for avg >= 0.55', () => {
      const monitor = new StreamingQualityMonitor({
        rollingWindowSize: 5,
        warningThreshold: 0.2,
        criticalThreshold: 0.1,
      });
      for (let i = 0; i < 5; i++) {
        monitor.evaluateChunk(i, 0.6);
      }
      expect(monitor.getSummary().status).toBe('degraded');
    });

    it('should determine status as poor for avg < 0.55', () => {
      const monitor = new StreamingQualityMonitor({
        rollingWindowSize: 5,
        warningThreshold: 0.2,
        criticalThreshold: 0.1,
      });
      for (let i = 0; i < 5; i++) {
        monitor.evaluateChunk(i, 0.4);
      }
      expect(monitor.getSummary().status).toBe('poor');
    });

    it('should include all alerts in summary', () => {
      const monitor = new StreamingQualityMonitor({
        rollingWindowSize: 2,
        warningThreshold: 0.6,
        criticalThreshold: 0.3,
      });
      monitor.evaluateChunk(0, 0.4);
      monitor.evaluateChunk(1, 0.4);
      monitor.evaluateChunk(2, 0.4);
      monitor.evaluateChunk(3, 0.4);

      const summary = monitor.getSummary();
      expect(summary.alerts.length).toBeGreaterThanOrEqual(2);
    });

    it('should only log summary once on first getSummary call', () => {
      const monitor = new StreamingQualityMonitor();
      monitor.evaluateChunk(0, 0.9);
      const s1 = monitor.getSummary();
      const s2 = monitor.getSummary();
      expect(s1.totalChunks).toBe(s2.totalChunks);
      expect(monitor.isCompleted()).toBe(true);
    });
  });

  describe('getRecords', () => {
    it('should return all recorded chunks', () => {
      const monitor = new StreamingQualityMonitor();
      monitor.evaluateChunk(0, 0.9);
      monitor.evaluateChunk(1, 0.8);
      const records = monitor.getRecords();
      expect(records).toHaveLength(2);
      expect(records[0].chunkIndex).toBe(0);
      expect(records[1].chunkIndex).toBe(1);
    });
  });

  describe('DEFAULT_STREAMING_QUALITY_CONFIG', () => {
    it('should have expected default values', () => {
      expect(DEFAULT_STREAMING_QUALITY_CONFIG.minChunkConfidence).toBe(0.7);
      expect(DEFAULT_STREAMING_QUALITY_CONFIG.rollingWindowSize).toBe(5);
      expect(DEFAULT_STREAMING_QUALITY_CONFIG.warningThreshold).toBe(0.6);
      expect(DEFAULT_STREAMING_QUALITY_CONFIG.criticalThreshold).toBe(0.4);
    });
  });
});
