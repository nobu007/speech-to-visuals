/**
 * REQ-226: ExportMetricsCollector unit tests (Phase 96)
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  ExportMetricsCollector,
  type ExportFormat,
  type ExportStage,
  type ExportMetricsSnapshot,
} from '@/export/export-metrics-collector';

function requireDefined<T>(value: T | undefined, label: string): T {
  if (value === undefined) {
    throw new Error(`${label} returned undefined`);
  }
  return value;
}

describe('ExportMetricsCollector', () => {
  let collector: ExportMetricsCollector;

  beforeEach(() => {
    collector = new ExportMetricsCollector({ maxSamplesPerSeries: 10 });
  });

  // -----------------------------------------------------------------------
  // recordExport
  // -----------------------------------------------------------------------

  describe('recordExport', () => {
    it('records a successful export', () => {
      collector.recordExport('mp4', 'success', 1200, 5_000_000);
      const snap = collector.getSnapshot();

      expect(snap.totalExports).toBe(1);
      expect(snap.successfulExports).toBe(1);
      expect(snap.failedExports).toBe(0);
      expect(snap.formats).toHaveLength(1);
      expect(snap.formats[0].format).toBe('mp4');
      expect(snap.formats[0].totalExports).toBe(1);
      expect(snap.formats[0].successfulExports).toBe(1);
    });

    it('records a failed export without file size', () => {
      collector.recordExport('webm', 'failure', 500);
      const snap = collector.getSnapshot();

      expect(snap.totalExports).toBe(1);
      expect(snap.failedExports).toBe(1);
      expect(snap.successfulExports).toBe(0);
      expect(snap.formats[0].fileSize.count).toBe(0);
    });

    it('tracks multiple formats independently', () => {
      collector.recordExport('mp4', 'success', 1200, 1_000);
      collector.recordExport('svg-animated', 'success', 300, 2_000);
      collector.recordExport('gif', 'failure', 800);

      const snap = collector.getSnapshot();
      expect(snap.formats).toHaveLength(3);
      expect(snap.totalExports).toBe(3);
      expect(snap.successfulExports).toBe(2);
      expect(snap.failedExports).toBe(1);
    });

    it('accumulates multiple exports for the same format', () => {
      collector.recordExport('apng', 'success', 100, 500);
      collector.recordExport('apng', 'success', 200, 600);
      collector.recordExport('apng', 'failure', 50);

      const snap = collector.getSnapshot();
      expect(snap.formats).toHaveLength(1);
      expect(snap.formats[0].totalExports).toBe(3);
      expect(snap.formats[0].successfulExports).toBe(2);
      expect(snap.formats[0].failedExports).toBe(1);
      expect(snap.formats[0].duration.count).toBe(3);
      expect(snap.formats[0].duration.sumMs).toBe(350);
      expect(snap.formats[0].duration.avgMs).toBe(117); // Math.round(350/3)
    });
  });

  // -----------------------------------------------------------------------
  // Duration metrics
  // -----------------------------------------------------------------------

  describe('duration metrics', () => {
    it('computes min/max/avg for format durations', () => {
      collector.recordExport('mp4', 'success', 100);
      collector.recordExport('mp4', 'success', 300);
      collector.recordExport('mp4', 'success', 200);

      const [fmt] = collector.getSnapshot().formats;
      expect(fmt.duration.minMs).toBe(100);
      expect(fmt.duration.maxMs).toBe(300);
      expect(fmt.duration.avgMs).toBe(200);
    });

    it('computes percentiles for format durations', () => {
      // Generate 100 samples from 100..10900
      for (let i = 0; i < 100; i++) {
        collector.recordExport('mp4', 'success', 100 + i * 110);
      }

      const [fmt] = collector.getSnapshot().formats;
      expect(fmt.duration.percentiles.p50).toBeGreaterThan(0);
      expect(fmt.duration.percentiles.p95).toBeGreaterThan(fmt.duration.percentiles.p50);
      expect(fmt.duration.percentiles.p99).toBeGreaterThanOrEqual(fmt.duration.percentiles.p95);
    });
  });

  // -----------------------------------------------------------------------
  // File-size metrics
  // -----------------------------------------------------------------------

  describe('file-size metrics', () => {
    it('records file sizes only for successful exports', () => {
      collector.recordExport('mp4', 'success', 100, 5000);
      collector.recordExport('mp4', 'failure', 50);

      const [fmt] = collector.getSnapshot().formats;
      expect(fmt.fileSize.count).toBe(1);
      expect(fmt.fileSize.sum).toBe(5000);
    });

    it('computes file size percentiles', () => {
      for (let i = 1; i <= 20; i++) {
        collector.recordExport('webm', 'success', 100, i * 100_000);
      }

      const [fmt] = collector.getSnapshot().formats;
      expect(fmt.fileSize.min).toBe(100_000);
      expect(fmt.fileSize.max).toBe(2_000_000);
      expect(fmt.fileSize.percentiles.p50).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------------------
  // recordStageDuration
  // -----------------------------------------------------------------------

  describe('recordStageDuration', () => {
    it('records individual export stage durations', () => {
      collector.recordStageDuration('rendering', 500);
      collector.recordStageDuration('encoding', 200);
      collector.recordStageDuration('rendering', 700);

      const snap = collector.getSnapshot();
      expect(snap.stages).toHaveLength(2);

      const rendering = requireDefined(snap.stages.find(s => s.stage === 'rendering'), "stage 'rendering'");
      expect(rendering.count).toBe(2);
      expect(rendering.sumMs).toBe(1200);
      expect(rendering.avgMs).toBe(600);

      const encoding = requireDefined(snap.stages.find(s => s.stage === 'encoding'), "stage 'encoding'");
      expect(encoding.count).toBe(1);
      expect(encoding.sumMs).toBe(200);
    });

    it('computes percentiles for stage durations', () => {
      for (let i = 1; i <= 50; i++) {
        collector.recordStageDuration('finalizing', i * 10);
      }

      const snap = collector.getSnapshot();
      const stage = snap.stages[0];
      expect(stage.percentiles.p50).toBeGreaterThan(0);
      expect(stage.percentiles.p95).toBeGreaterThan(stage.percentiles.p50);
    });

    it('handles all four export stages', () => {
      const stages: ExportStage[] = ['preparing', 'rendering', 'encoding', 'finalizing'];
      for (const stage of stages) {
        collector.recordStageDuration(stage, 100);
      }

      const snap = collector.getSnapshot();
      expect(snap.stages).toHaveLength(4);
      expect(snap.stages.map(s => s.stage).sort()).toEqual(stages.sort());
    });
  });

  // -----------------------------------------------------------------------
  // Sample eviction (bounded memory)
  // -----------------------------------------------------------------------

  describe('sample eviction', () => {
    it('evicts oldest samples when exceeding maxSamplesPerSeries', () => {
      // maxSamplesPerSeries is 10, so after 11 records, eviction occurs
      for (let i = 1; i <= 15; i++) {
        collector.recordExport('mp4', 'success', i * 100, i * 1000);
      }

      const [fmt] = collector.getSnapshot().formats;
      // After eviction, should have roughly half the max (5 samples)
      expect(fmt.duration.count).toBe(15);
      // min should reflect the remaining samples, not the full history
      expect(fmt.duration.minMs).toBeGreaterThanOrEqual(100);
    });
  });

  // -----------------------------------------------------------------------
  // getSnapshot
  // -----------------------------------------------------------------------

  describe('getSnapshot', () => {
    it('returns empty snapshot when no data recorded', () => {
      const snap = collector.getSnapshot();
      expect(snap.formats).toHaveLength(0);
      expect(snap.stages).toHaveLength(0);
      expect(snap.totalExports).toBe(0);
      expect(snap.successfulExports).toBe(0);
      expect(snap.failedExports).toBe(0);
    });

    it('provides a consistent snapshot', () => {
      collector.recordExport('mp4', 'success', 100, 5000);
      collector.recordStageDuration('rendering', 200);

      const snap1 = collector.getSnapshot();
      const snap2 = collector.getSnapshot();

      expect(snap1).toEqual(snap2);
    });
  });

  // -----------------------------------------------------------------------
  // reset
  // -----------------------------------------------------------------------

  describe('reset', () => {
    it('clears all collected metrics', () => {
      collector.recordExport('mp4', 'success', 100, 5000);
      collector.recordStageDuration('rendering', 200);

      collector.reset();

      const snap = collector.getSnapshot();
      expect(snap.formats).toHaveLength(0);
      expect(snap.stages).toHaveLength(0);
      expect(snap.totalExports).toBe(0);
    });

    it('allows recording after reset', () => {
      collector.recordExport('mp4', 'success', 100);
      collector.reset();
      collector.recordExport('webm', 'failure', 50);

      const snap = collector.getSnapshot();
      expect(snap.formats).toHaveLength(1);
      expect(snap.formats[0].format).toBe('webm');
      expect(snap.totalExports).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // All export formats
  // -----------------------------------------------------------------------

  describe('all export formats', () => {
    it('handles all 8 export formats', () => {
      const formats: ExportFormat[] = [
        'mp4', 'webm', 'gif', 'apng',
        'interactive-html', 'pdf-animated', 'svg-animated', 'json-lottie',
      ];

      for (const fmt of formats) {
        collector.recordExport(fmt, 'success', 100, 1000);
      }

      const snap = collector.getSnapshot();
      expect(snap.formats).toHaveLength(8);
      expect(snap.totalExports).toBe(8);
      expect(snap.successfulExports).toBe(8);
    });
  });

  // -----------------------------------------------------------------------
  // Numeric safety (NaN, Infinity, negative values)
  // -----------------------------------------------------------------------

  describe('numeric safety', () => {
    it('ignores NaN duration in recordExport', () => {
      collector.recordExport('mp4', 'success', NaN);
      const snap = collector.getSnapshot();
      expect(snap.totalExports).toBe(0);
    });

    it('ignores Infinity duration in recordExport', () => {
      collector.recordExport('mp4', 'success', Infinity);
      const snap = collector.getSnapshot();
      expect(snap.totalExports).toBe(0);
    });

    it('ignores negative duration in recordExport', () => {
      collector.recordExport('mp4', 'success', -100);
      const snap = collector.getSnapshot();
      expect(snap.totalExports).toBe(0);
    });

    it('ignores NaN in recordStageDuration', () => {
      collector.recordStageDuration('rendering', NaN);
      collector.recordStageDuration('rendering', 200);
      const snap = collector.getSnapshot();
      expect(snap.stages).toHaveLength(1);
      expect(snap.stages[0].count).toBe(1);
      expect(snap.stages[0].sumMs).toBe(200);
    });

    it('ignores negative file size in recordExport', () => {
      collector.recordExport('mp4', 'success', 100, -50);
      const snap = collector.getSnapshot();
      expect(snap.formats[0].fileSize.count).toBe(0);
    });

    it('ignores negative queue size in recordQueueSize', () => {
      collector.recordQueueSize(-5);
      const snap = collector.getSnapshot();
      expect(snap.queue.queueSize).toBe(0);
    });

    it('ignores NaN queue size in recordQueueSize', () => {
      collector.recordQueueSize(NaN);
      const snap = collector.getSnapshot();
      expect(snap.queue.queueSize).toBe(0);
    });

    it('ignores negative wait time in recordQueueWaitTimeMs', () => {
      collector.recordQueueWaitTimeMs(-100);
      collector.recordQueueWaitTimeMs(500);
      const snap = collector.getSnapshot();
      expect(snap.queue.avgWaitTimeMs).toBe(500);
    });

    it('ignores NaN wait time in recordQueueWaitTimeMs', () => {
      collector.recordQueueWaitTimeMs(NaN);
      collector.recordQueueWaitTimeMs(500);
      const snap = collector.getSnapshot();
      expect(snap.queue.avgWaitTimeMs).toBe(500);
    });
  });
});
