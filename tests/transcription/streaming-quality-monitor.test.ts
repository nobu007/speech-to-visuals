/**
 * Tests for REQ-091: Streaming Quality Monitoring
 *
 * Validates per-chunk quality evaluation, rolling average calculation,
 * alert emission, and session summaries.
 */

import {
  StreamingQualityMonitor,
  StreamingQualitySummary,
  QualityAlert,
  DEFAULT_STREAMING_QUALITY_CONFIG,
} from '../../src/transcription/streaming-quality-monitor';

describe('StreamingQualityMonitor', () => {
  let monitor: StreamingQualityMonitor;

  beforeEach(() => {
    monitor = new StreamingQualityMonitor();
  });

  // -----------------------------------------------------------------------
  // evaluateChunk
  // -----------------------------------------------------------------------

  test('should accept chunks above minimum confidence', () => {
    const record = monitor.evaluateChunk(0, 0.85);
    expect(record.accepted).toBe(true);
    expect(record.confidence).toBe(0.85);
    expect(record.chunkIndex).toBe(0);
  });

  test('should reject chunks below minimum confidence', () => {
    const record = monitor.evaluateChunk(0, 0.3);
    expect(record.accepted).toBe(false);
    expect(record.confidence).toBe(0.3);
  });

  test('should accept chunks exactly at the threshold', () => {
    const record = monitor.evaluateChunk(0, 0.7);
    expect(record.accepted).toBe(true);
  });

  test('should track all chunk records', () => {
    monitor.evaluateChunk(0, 0.9);
    monitor.evaluateChunk(1, 0.8);
    monitor.evaluateChunk(2, 0.6);

    const records = monitor.getRecords();
    expect(records).toHaveLength(3);
    expect(records[0].chunkIndex).toBe(0);
    expect(records[1].chunkIndex).toBe(1);
    expect(records[2].chunkIndex).toBe(2);
  });

  // -----------------------------------------------------------------------
  // Rolling average
  // -----------------------------------------------------------------------

  test('should compute rolling average over configured window', () => {
    const mon = new StreamingQualityMonitor({ rollingWindowSize: 3 });
    mon.evaluateChunk(0, 0.9);
    mon.evaluateChunk(1, 0.8);
    mon.evaluateChunk(2, 0.7);

    // Rolling average of last 3 = (0.9 + 0.8 + 0.7) / 3 ≈ 0.8
    expect(mon.getRollingAverage()).toBeCloseTo(0.8, 5);
  });

  test('should slide the rolling window', () => {
    const mon = new StreamingQualityMonitor({ rollingWindowSize: 2 });
    mon.evaluateChunk(0, 0.9);
    mon.evaluateChunk(1, 0.5);
    mon.evaluateChunk(2, 0.3);

    // Window = last 2 = (0.5 + 0.3) / 2 = 0.4
    expect(mon.getRollingAverage()).toBeCloseTo(0.4, 5);
  });

  // -----------------------------------------------------------------------
  // Alerts
  // -----------------------------------------------------------------------

  test('should emit warning alert when rolling average drops below warning threshold', () => {
    const alerts: QualityAlert[] = [];
    const mon = new StreamingQualityMonitor({
      rollingWindowSize: 2,
      warningThreshold: 0.6,
    });
    mon.onAlert(alert => alerts.push(alert));

    mon.evaluateChunk(0, 0.8); // avg = 0.8 — no alert
    mon.evaluateChunk(1, 0.4); // avg = 0.6 — no alert (exactly at threshold)

    expect(alerts).toHaveLength(0);

    mon.evaluateChunk(2, 0.3); // avg of [0.4, 0.3] = 0.35 — warning
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe('critical'); // 0.35 < criticalThreshold(0.4) too
  });

  test('should emit critical alert when rolling average drops below critical threshold', () => {
    const alerts: QualityAlert[] = [];
    const mon = new StreamingQualityMonitor({
      rollingWindowSize: 3,
      criticalThreshold: 0.4,
      warningThreshold: 0.6,
    });
    mon.onAlert(alert => alerts.push(alert));

    mon.evaluateChunk(0, 0.5);
    mon.evaluateChunk(1, 0.4);
    mon.evaluateChunk(2, 0.3); // avg = (0.5+0.4+0.3)/3 = 0.4 — at threshold

    // At exactly 0.4, it's not below the critical threshold
    mon.evaluateChunk(3, 0.2); // avg of [0.4, 0.3, 0.2] = 0.3 — critical

    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(alerts.some(a => a.severity === 'critical')).toBe(true);
  });

  test('should not emit alerts for good quality sequences', () => {
    const alerts: QualityAlert[] = [];
    const mon = new StreamingQualityMonitor({
      rollingWindowSize: 3,
    });
    mon.onAlert(alert => alerts.push(alert));

    for (let i = 0; i < 10; i++) {
      mon.evaluateChunk(i, 0.85 + Math.random() * 0.1);
    }

    expect(alerts).toHaveLength(0);
  });

  test('should record all alerts for retrieval', () => {
    const mon = new StreamingQualityMonitor({
      rollingWindowSize: 2,
      warningThreshold: 0.7,
      criticalThreshold: 0.3,
    });

    mon.evaluateChunk(0, 0.9);
    mon.evaluateChunk(1, 0.5); // avg = 0.7 — at threshold
    mon.evaluateChunk(2, 0.4); // avg = 0.45 — warning

    const alerts = mon.getAlerts();
    expect(alerts.length).toBeGreaterThanOrEqual(1);
  });

  // -----------------------------------------------------------------------
  // getSummary
  // -----------------------------------------------------------------------

  test('should produce correct summary for empty session', () => {
    const summary = monitor.getSummary();
    expect(summary.totalChunks).toBe(0);
    expect(summary.acceptedChunks).toBe(0);
    expect(summary.rejectedChunks).toBe(0);
    expect(summary.averageConfidence).toBe(0);
    // Defect-9 polarity b: an empty session must NOT manufacture the TOP
    // quality tier while reporting averageConfidence 0. Absent data fails loud.
    expect(summary.status).toBe('poor');
  });

  test('should produce correct summary after processing chunks', () => {
    monitor.evaluateChunk(0, 0.95);
    monitor.evaluateChunk(1, 0.80);
    monitor.evaluateChunk(2, 0.60); // rejected
    monitor.evaluateChunk(3, 0.90);
    monitor.evaluateChunk(4, 0.85);

    const summary = monitor.getSummary();
    expect(summary.totalChunks).toBe(5);
    expect(summary.acceptedChunks).toBe(4);
    expect(summary.rejectedChunks).toBe(1);
    expect(summary.minConfidence).toBe(0.60);
    expect(summary.maxConfidence).toBe(0.95);
    expect(summary.averageConfidence).toBeCloseTo(0.82, 2);
    expect(summary.status).toBe('good'); // avg 0.82 is "good" (>=0.75 but <0.9)
  });

  test('should classify status as degraded for mediocre quality', () => {
    const mon = new StreamingQualityMonitor({ minChunkConfidence: 0.3 });
    mon.evaluateChunk(0, 0.65);
    mon.evaluateChunk(1, 0.60);
    mon.evaluateChunk(2, 0.55);

    const summary = mon.getSummary();
    expect(summary.status).toBe('degraded');
  });

  test('should classify status as poor for very low quality', () => {
    const mon = new StreamingQualityMonitor({ minChunkConfidence: 0.1 });
    mon.evaluateChunk(0, 0.3);
    mon.evaluateChunk(1, 0.2);
    mon.evaluateChunk(2, 0.25);

    const summary = mon.getSummary();
    expect(summary.status).toBe('poor');
  });

  // -----------------------------------------------------------------------
  // Configuration
  // -----------------------------------------------------------------------

  test('should use custom config values', () => {
    const mon = new StreamingQualityMonitor({
      minChunkConfidence: 0.5,
      rollingWindowSize: 10,
      warningThreshold: 0.45,
      criticalThreshold: 0.2,
    });

    // 0.5 should be accepted with custom threshold
    const record = mon.evaluateChunk(0, 0.5);
    expect(record.accepted).toBe(true);

    // 0.4 should be rejected
    const record2 = mon.evaluateChunk(1, 0.4);
    expect(record2.accepted).toBe(false);
  });

  test('should use default config when no overrides provided', () => {
    expect(DEFAULT_STREAMING_QUALITY_CONFIG.minChunkConfidence).toBe(0.7);
    expect(DEFAULT_STREAMING_QUALITY_CONFIG.rollingWindowSize).toBe(5);
    expect(DEFAULT_STREAMING_QUALITY_CONFIG.warningThreshold).toBe(0.6);
    expect(DEFAULT_STREAMING_QUALITY_CONFIG.criticalThreshold).toBe(0.4);
  });

  // -----------------------------------------------------------------------
  // isCompleted
  // -----------------------------------------------------------------------

  test('should mark session as completed after getSummary', () => {
    expect(monitor.isCompleted()).toBe(false);

    monitor.evaluateChunk(0, 0.85);
    monitor.getSummary();

    expect(monitor.isCompleted()).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Alert callback resilience
  // -----------------------------------------------------------------------

  test('should not disrupt pipeline if alert callback throws', () => {
    const mon = new StreamingQualityMonitor({ rollingWindowSize: 2, warningThreshold: 0.7 });
    mon.onAlert(() => {
      throw new Error('Callback error');
    });
    mon.onAlert(() => {
      // This should still be called
    });

    // Should not throw
    expect(() => {
      mon.evaluateChunk(0, 0.5);
      mon.evaluateChunk(1, 0.4); // triggers alert
    }).not.toThrow();
  });
});
