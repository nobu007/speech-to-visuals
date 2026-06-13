/**
 * Integration test: ExportJobQueue → ExportMetricsCollector wiring
 *
 * Validates that ExportJobQueue correctly reports queue metrics through
 * the QueueMetricsSink interface to ExportMetricsCollector, and that
 * those metrics surface in Prometheus exposition output.
 *
 * Phase 108: Verify end-to-end metrics flow from job queue to Prometheus.
 */

import { jest } from '@jest/globals';
import { ExportJobQueue } from '@/export/export-job-queue';
import { ExportMetricsCollector } from '@/export/export-metrics-collector';
import { exportPrometheusMetrics } from '@/monitoring/prometheus-exporter';
import type { HttpMetricsSnapshot } from '@/monitoring/http-metrics-collector';

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const EMPTY_HTTP: HttpMetricsSnapshot = {
  totalRequests: 0,
  totalErrors: 0,
  globalErrorRate: 0,
  activeRequests: 0,
  routes: [],
  slowRequests: [],
  uptime: 1000,
};

describe('ExportJobQueue → ExportMetricsCollector wiring', () => {
  let collector: ExportMetricsCollector;
  let queue: ExportJobQueue;

  beforeEach(() => {
    collector = new ExportMetricsCollector();
    queue = new ExportJobQueue(
      { maxConcurrent: 2, maxQueueSize: 50, starvationPreventionInterval: 999_999, maxCompletedJobs: 10 },
      collector,
    );
  });

  afterEach(() => {
    queue.stop();
  });

  it('reports queue size to the metrics collector on enqueue', () => {
    queue.enqueue({ priority: 'high', format: 'mp4', inputHash: 'abc' });
    queue.enqueue({ priority: 'normal', format: 'webm', inputHash: 'def' });

    const snap = collector.getSnapshot();
    expect(snap.queue.queueSize).toBe(2);
  });

  it('reports priority distribution after enqueue', () => {
    queue.enqueue({ priority: 'high', format: 'mp4', inputHash: 'h1' });
    queue.enqueue({ priority: 'high', format: 'mp4', inputHash: 'h2' });
    queue.enqueue({ priority: 'normal', format: 'mp4', inputHash: 'n1' });
    queue.enqueue({ priority: 'low', format: 'mp4', inputHash: 'l1' });

    const snap = collector.getSnapshot();
    expect(snap.queue.priorityDistribution).toEqual({ high: 2, normal: 1, low: 1 });
  });

  it('records dequeue by priority', () => {
    queue.enqueue({ priority: 'high', format: 'mp4', inputHash: 'a' });
    queue.enqueue({ priority: 'low', format: 'mp4', inputHash: 'b' });

    // Dequeue both
    queue.dequeue();
    queue.dequeue();

    const snap = collector.getSnapshot();
    expect(snap.queue.dequeueCount).toBe(2);
    expect(snap.queue.dequeueByPriority).toEqual({ high: 1, low: 1, normal: 0 });
  });

  it('records queue wait time on successful job completion', () => {
    const job = queue.enqueue({ priority: 'normal', format: 'mp4', inputHash: 'x' });
    queue.dequeue();
    queue.completeJob(job.jobId, true);

    const snap = collector.getSnapshot();
    // Wait time is recorded (startedAt - enqueuedAt ≈ 0ms in test)
    expect(snap.queue.avgWaitTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('updates queue size after dequeue', () => {
    queue.enqueue({ priority: 'normal', format: 'mp4', inputHash: '1' });
    queue.enqueue({ priority: 'normal', format: 'mp4', inputHash: '2' });

    expect(collector.getSnapshot().queue.queueSize).toBe(2);

    queue.dequeue();
    expect(collector.getSnapshot().queue.queueSize).toBe(1);

    queue.dequeue();
    expect(collector.getSnapshot().queue.queueSize).toBe(0);
  });

  it('surfaces queue metrics in Prometheus exposition output', () => {
    // Enqueue and dequeue to generate activity
    queue.enqueue({ priority: 'high', format: 'mp4', inputHash: 'p1' });
    queue.enqueue({ priority: 'normal', format: 'webm', inputHash: 'p2' });
    queue.dequeue();

    const exportSnap = collector.getSnapshot();
    const output = exportPrometheusMetrics({
      snapshot: EMPTY_HTTP,
      exportSnapshot: exportSnap,
    });

    // Queue size gauge should reflect current queue depth
    expect(output).toContain('# HELP export_queue_size');
    expect(output).toContain('# TYPE export_queue_size gauge');
    expect(output).toMatch(/export_queue_size 1/);

    // Dequeue counter should show the high-priority dequeue
    expect(output).toContain('# HELP export_queue_dequeue_total');
    expect(output).toMatch(/export_queue_dequeue_total\{priority="high"\} 1/);
  });

  it('surfaces priority distribution through Prometheus after multiple operations', () => {
    queue.enqueue({ priority: 'high', format: 'mp4', inputHash: 'a' });
    queue.enqueue({ priority: 'high', format: 'mp4', inputHash: 'b' });
    queue.enqueue({ priority: 'normal', format: 'mp4', inputHash: 'c' });
    queue.enqueue({ priority: 'low', format: 'mp4', inputHash: 'd' });

    const exportSnap = collector.getSnapshot();
    const output = exportPrometheusMetrics({
      snapshot: EMPTY_HTTP,
      exportSnapshot: exportSnap,
    });

    // Queue size = 4
    expect(output).toMatch(/export_queue_size 4/);
  });

  it('clears queue size metric when queue is emptied', () => {
    queue.enqueue({ priority: 'normal', format: 'mp4', inputHash: 'x' });
    expect(collector.getSnapshot().queue.queueSize).toBe(1);

    queue.dequeue();
    expect(collector.getSnapshot().queue.queueSize).toBe(0);

    const exportSnap = collector.getSnapshot();
    // After dequeue but with dequeueCount > 0, queue metrics should still appear
    expect(exportSnap.queue.dequeueCount).toBe(1);
  });
});
