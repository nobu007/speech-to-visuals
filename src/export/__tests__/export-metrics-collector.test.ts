import { ExportMetricsCollector } from '../export-metrics-collector';

describe('ExportMetricsCollector', () => {
  let collector: ExportMetricsCollector;

  beforeEach(() => {
    collector = new ExportMetricsCollector();
  });

  describe('recordExport', () => {
    it('records a successful export', () => {
      collector.recordExport('mp4', 'success', 5000, 1000000);
      const snap = collector.getSnapshot();
      expect(snap.totalExports).toBe(1);
      expect(snap.successfulExports).toBe(1);
      expect(snap.failedExports).toBe(0);
    });

    it('records a failed export', () => {
      collector.recordExport('mp4', 'failure', 3000);
      const snap = collector.getSnapshot();
      expect(snap.totalExports).toBe(1);
      expect(snap.successfulExports).toBe(0);
      expect(snap.failedExports).toBe(1);
    });

    it('tracks per-format metrics separately', () => {
      collector.recordExport('mp4', 'success', 5000, 1000000);
      collector.recordExport('svg-animated', 'success', 2000, 50000);
      const snap = collector.getSnapshot();
      expect(snap.formats).toHaveLength(2);
    });

    it('ignores invalid duration', () => {
      collector.recordExport('mp4', 'success', NaN, 1000);
      collector.recordExport('mp4', 'success', -1, 1000);
      const snap = collector.getSnapshot();
      expect(snap.totalExports).toBe(0);
    });

    it('does not record file size for failed exports', () => {
      collector.recordExport('mp4', 'failure', 1000, 500000);
      const snap = collector.getSnapshot();
      const mp4 = snap.formats.find(f => f.format === 'mp4');
      expect(mp4!.fileSize.count).toBe(0);
    });

    it('accumulates duration samples for percentiles', () => {
      for (let i = 1; i <= 100; i++) {
        collector.recordExport('mp4', 'success', i * 100, 50000);
      }
      const snap = collector.getSnapshot();
      const mp4 = snap.formats.find(f => f.format === 'mp4');
      expect(mp4!.duration.count).toBe(100);
      expect(mp4!.duration.minMs).toBe(100);
      expect(mp4!.duration.maxMs).toBe(10000);
      expect(mp4!.duration.percentiles.p50).toBeGreaterThan(0);
      expect(mp4!.duration.percentiles.p95).toBeGreaterThan(mp4!.duration.percentiles.p50);
    });
  });

  describe('recordStageDuration', () => {
    it('records stage timing', () => {
      collector.recordStageDuration('rendering', 2000);
      collector.recordStageDuration('rendering', 3000);
      collector.recordStageDuration('encoding', 1500);
      const snap = collector.getSnapshot();
      expect(snap.stages).toHaveLength(2);
      const rendering = snap.stages.find(s => s.stage === 'rendering');
      expect(rendering!.count).toBe(2);
      expect(rendering!.sumMs).toBe(5000);
      expect(rendering!.avgMs).toBe(2500);
    });

    it('ignores invalid durations', () => {
      collector.recordStageDuration('rendering', NaN);
      collector.recordStageDuration('rendering', -1);
      const snap = collector.getSnapshot();
      expect(snap.stages).toHaveLength(0);
    });
  });

  describe('queue metrics', () => {
    it('records queue size', () => {
      collector.recordQueueSize(5);
      expect(collector.getSnapshot().queue.queueSize).toBe(5);
    });

    it('records dequeue by priority', () => {
      collector.recordQueueDequeue('high');
      collector.recordQueueDequeue('high');
      collector.recordQueueDequeue('normal');
      const q = collector.getSnapshot().queue;
      expect(q.dequeueCount).toBe(3);
      expect(q.dequeueByPriority.high).toBe(2);
      expect(q.dequeueByPriority.normal).toBe(1);
      expect(q.dequeueByPriority.low).toBe(0);
    });

    it('records wait time', () => {
      collector.recordQueueWaitTimeMs(100);
      collector.recordQueueWaitTimeMs(200);
      collector.recordQueueWaitTimeMs(300);
      const q = collector.getSnapshot().queue;
      expect(q.avgWaitTimeMs).toBe(200);
    });

    it('records priority distribution', () => {
      collector.recordQueuePriorityDistribution(3, 5, 2);
      const q = collector.getSnapshot().queue;
      expect(q.priorityDistribution).toEqual({ high: 3, normal: 5, low: 2 });
    });

    it('records DLQ size', () => {
      collector.recordDlqSize(2);
      expect(collector.getSnapshot().queue.dlqSize).toBe(2);
    });

    it('records retry, dead-letter, and replay counts', () => {
      collector.recordRetry();
      collector.recordRetry();
      collector.recordDeadLetter();
      collector.recordReplay();
      collector.recordReplay();
      collector.recordReplay();
      const q = collector.getSnapshot().queue;
      expect(q.totalRetries).toBe(2);
      expect(q.totalDeadLettered).toBe(1);
      expect(q.totalReplayed).toBe(3);
    });

    it('ignores invalid queue size', () => {
      collector.recordQueueSize(-1);
      collector.recordQueueSize(NaN);
      expect(collector.getSnapshot().queue.queueSize).toBe(0);
    });

    it('ignores invalid DLQ size', () => {
      collector.recordDlqSize(-5);
      expect(collector.getSnapshot().queue.dlqSize).toBe(0);
    });
  });

  describe('reset', () => {
    it('clears all metrics', () => {
      collector.recordExport('mp4', 'success', 5000, 1000);
      collector.recordStageDuration('rendering', 2000);
      collector.recordQueueSize(5);
      collector.recordDeadLetter();
      collector.reset();
      const snap = collector.getSnapshot();
      expect(snap.totalExports).toBe(0);
      expect(snap.formats).toHaveLength(0);
      expect(snap.stages).toHaveLength(0);
      expect(snap.queue.queueSize).toBe(0);
      expect(snap.queue.totalDeadLettered).toBe(0);
    });
  });

  describe('getSnapshot', () => {
    it('returns empty snapshot for new collector', () => {
      const snap = collector.getSnapshot();
      expect(snap.totalExports).toBe(0);
      expect(snap.successfulExports).toBe(0);
      expect(snap.failedExports).toBe(0);
      expect(snap.formats).toHaveLength(0);
      expect(snap.stages).toHaveLength(0);
      expect(snap.queue.queueSize).toBe(0);
      expect(snap.queue.avgWaitTimeMs).toBe(0);
    });

    it('computes correct format duration average', () => {
      collector.recordExport('mp4', 'success', 3000, 1000);
      collector.recordExport('mp4', 'success', 5000, 2000);
      const snap = collector.getSnapshot();
      const mp4 = snap.formats.find(f => f.format === 'mp4');
      expect(mp4!.duration.avgMs).toBe(4000);
      expect(mp4!.fileSize.avg).toBe(1500);
    });
  });

  describe('sample trimming', () => {
    it('trims samples when exceeding maxSamplesPerSeries', () => {
      const small = new ExportMetricsCollector({ maxSamplesPerSeries: 10 });
      for (let i = 0; i < 20; i++) {
        small.recordExport('mp4', 'success', i * 100, 1000);
      }
      const snap = small.getSnapshot();
      const mp4 = snap.formats.find(f => f.format === 'mp4');
      // count tracks all, but percentile array is trimmed internally
      expect(mp4!.duration.count).toBe(20);
      // Percentiles still computed from retained samples
      expect(mp4!.duration.percentiles.p50).toBeGreaterThan(0);
    });
  });

  describe('toPrometheusText', () => {
    it('returns empty-but-valid Prometheus text for fresh collector', () => {
      const text = collector.toPrometheusText();
      expect(text).toContain('# HELP export_queue_size');
      expect(text).toContain('export_queue_size 0');
      expect(text).toContain('export_dlq_size 0');
      expect(text).toContain('export_retries_total 0');
    });

    it('includes format-specific counters and summaries', () => {
      collector.recordExport('mp4', 'success', 5000, 1000000);
      collector.recordExport('mp4', 'failure', 2000);
      collector.recordExport('webm', 'success', 3000, 500000);
      const text = collector.toPrometheusText();

      // Counter lines
      expect(text).toContain('export_operations_total{format="mp4",status="success"} 1');
      expect(text).toContain('export_operations_total{format="mp4",status="failure"} 1');
      expect(text).toContain('export_operations_total{format="webm",status="success"} 1');

      // Duration summary
      expect(text).toContain('export_duration_ms{format="mp4",quantile="0.5"}');
      expect(text).toContain('export_duration_ms_count{format="mp4"} 2');

      // File size summary (only for success)
      expect(text).toContain('export_file_size_bytes_count{format="mp4"} 1');
      expect(text).toContain('export_file_size_bytes_sum{format="mp4"} 1000000');
    });

    it('includes stage duration summaries', () => {
      collector.recordStageDuration('rendering', 2000);
      collector.recordStageDuration('encoding', 1000);
      const text = collector.toPrometheusText();
      expect(text).toContain('export_stage_duration_ms{stage="rendering"');
      expect(text).toContain('export_stage_duration_ms{stage="encoding"');
    });

    it('includes queue metrics', () => {
      collector.recordQueueSize(5);
      collector.recordQueueDequeue('high');
      collector.recordQueueWaitTimeMs(100);
      collector.recordDlqSize(3);
      collector.recordRetry();
      collector.recordDeadLetter();
      collector.recordReplay();
      const text = collector.toPrometheusText();

      expect(text).toContain('export_queue_size 5');
      expect(text).toContain('export_queue_dequeue_total{priority="high"} 1');
      expect(text).toContain('export_dlq_size 3');
      expect(text).toContain('export_retries_total 1');
      expect(text).toContain('export_dead_lettered_total 1');
      expect(text).toContain('export_replayed_total 1');
    });
  });
});
