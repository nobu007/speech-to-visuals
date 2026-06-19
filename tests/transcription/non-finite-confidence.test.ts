/**
 * Regression tests for non-finite confidence value handling.
 *
 * Verifies that NaN, Infinity, and undefined confidence values are
 * safely coerced to 0 rather than propagating through averages,
 * summaries, and alerts.
 */

import {
  StreamingQualityMonitor,
} from '../../src/transcription/streaming-quality-monitor';

describe('Non-finite confidence guards', () => {
  // -------------------------------------------------------------------------
  // StreamingQualityMonitor.evaluateChunk
  // -------------------------------------------------------------------------

  describe('StreamingQualityMonitor.evaluateChunk', () => {
    test('should coerce NaN confidence to 0', () => {
      const mon = new StreamingQualityMonitor({ minChunkConfidence: 0.5 });
      const record = mon.evaluateChunk(0, NaN);
      expect(record.confidence).toBe(0);
      expect(record.accepted).toBe(false);
    });

    test('should coerce Infinity confidence to 0', () => {
      const mon = new StreamingQualityMonitor({ minChunkConfidence: 0.5 });
      const record = mon.evaluateChunk(0, Infinity);
      expect(record.confidence).toBe(0);
      expect(record.accepted).toBe(false);
    });

    test('should coerce -Infinity confidence to 0', () => {
      const mon = new StreamingQualityMonitor();
      const record = mon.evaluateChunk(0, -Infinity);
      expect(record.confidence).toBe(0);
    });

    test('should not let NaN corrupt rolling average', () => {
      const mon = new StreamingQualityMonitor({ rollingWindowSize: 3 });
      mon.evaluateChunk(0, 0.9);
      mon.evaluateChunk(1, NaN);
      mon.evaluateChunk(2, 0.8);

      // (0.9 + 0 + 0.8) / 3 = 0.566... — not NaN
      const avg = mon.getRollingAverage();
      expect(Number.isFinite(avg)).toBe(true);
      expect(avg).toBeCloseTo((0.9 + 0 + 0.8) / 3, 5);
    });

    test('should not let Infinity corrupt summary', () => {
      const mon = new StreamingQualityMonitor();
      mon.evaluateChunk(0, 0.9);
      mon.evaluateChunk(1, Infinity);
      mon.evaluateChunk(2, 0.8);

      const summary = mon.getSummary();
      expect(Number.isFinite(summary.averageConfidence)).toBe(true);
      expect(Number.isFinite(summary.minConfidence)).toBe(true);
      expect(Number.isFinite(summary.maxConfidence)).toBe(true);
    });

    test('should not emit spurious alerts from corrupted confidence', () => {
      const mon = new StreamingQualityMonitor({ rollingWindowSize: 2 });
      // NaN coerced to 0 would trigger alerts — but that's the correct
      // behaviour: a chunk with invalid confidence *should* be flagged.
      const alerts: { severity: string }[] = [];
      mon.onAlert(a => alerts.push(a));
      mon.evaluateChunk(0, NaN);     // coerced to 0
      mon.evaluateChunk(1, NaN);     // coerced to 0, avg=0 < critical
      expect(alerts.length).toBeGreaterThanOrEqual(1);
      expect(alerts.some(a => a.severity === 'critical')).toBe(true);
    });

    test('should classify non-finite average as poor status', () => {
      const mon = new StreamingQualityMonitor();
      mon.evaluateChunk(0, NaN);
      mon.evaluateChunk(1, NaN);

      const summary = mon.getSummary();
      // With all values coerced to 0, status should be 'poor'
      expect(summary.status).toBe('poor');
    });

    test('should preserve normal operation after a non-finite chunk', () => {
      const mon = new StreamingQualityMonitor();
      mon.evaluateChunk(0, 0.9);
      mon.evaluateChunk(1, NaN); // coerced to 0
      mon.evaluateChunk(2, 0.85);
      mon.evaluateChunk(3, 0.9);

      const summary = mon.getSummary();
      // Should still produce valid results
      expect(summary.totalChunks).toBe(4);
      expect(Number.isFinite(summary.averageConfidence)).toBe(true);
      expect(summary.acceptedChunks).toBe(3); // NaN chunk rejected
    });
  });
});
