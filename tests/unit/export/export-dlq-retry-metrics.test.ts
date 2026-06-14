/**
 * Tests for DLQ and retry metrics recording in ExportMetricsCollector
 * and ExportJobQueue integration (REQ-229).
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ExportMetricsCollector } from '@/export/export-metrics-collector';
import { ExportJobQueue, type QueueMetricsSink } from '@/export/export-job-queue';

// ---------------------------------------------------------------------------
// Mock metrics sink for ExportJobQueue integration tests
// ---------------------------------------------------------------------------

function createMockSink(): QueueMetricsSink & {
  calls: { method: string; args: unknown[] }[];
} {
  const calls: { method: string; args: unknown[] }[] = [];
  return {
    calls,
    recordQueueSize(size: number) { calls.push({ method: 'recordQueueSize', args: [size] }); },
    recordQueueWaitTimeMs(waitMs: number) { calls.push({ method: 'recordQueueWaitTimeMs', args: [waitMs] }); },
    recordQueueDequeue(priority: string) { calls.push({ method: 'recordQueueDequeue', args: [priority] }); },
    recordQueuePriorityDistribution(h: number, n: number, l: number) { calls.push({ method: 'recordQueuePriorityDistribution', args: [h, n, l] }); },
    recordDlqSize(size: number) { calls.push({ method: 'recordDlqSize', args: [size] }); },
    recordRetry() { calls.push({ method: 'recordRetry', args: [] }); },
    recordDeadLetter() { calls.push({ method: 'recordDeadLetter', args: [] }); },
  };
}

// ---------------------------------------------------------------------------
// ExportMetricsCollector DLQ/retry methods
// ---------------------------------------------------------------------------

describe('ExportMetricsCollector DLQ and retry metrics', () => {
  let collector: ExportMetricsCollector;

  beforeEach(() => {
    collector = new ExportMetricsCollector();
  });

  describe('recordDlqSize', () => {
    it('records the DLQ size', () => {
      collector.recordDlqSize(5);
      expect(collector.getSnapshot().queue.dlqSize).toBe(5);
    });

    it('updates on subsequent calls', () => {
      collector.recordDlqSize(3);
      collector.recordDlqSize(7);
      expect(collector.getSnapshot().queue.dlqSize).toBe(7);
    });

    it('ignores non-finite values', () => {
      collector.recordDlqSize(NaN);
      expect(collector.getSnapshot().queue.dlqSize).toBe(0);
    });

    it('ignores negative values', () => {
      collector.recordDlqSize(-1);
      expect(collector.getSnapshot().queue.dlqSize).toBe(0);
    });

    it('floors fractional values', () => {
      collector.recordDlqSize(3.9);
      expect(collector.getSnapshot().queue.dlqSize).toBe(3);
    });
  });

  describe('recordRetry', () => {
    it('increments total retries', () => {
      collector.recordRetry();
      collector.recordRetry();
      collector.recordRetry();
      expect(collector.getSnapshot().queue.totalRetries).toBe(3);
    });

    it('starts at zero', () => {
      expect(collector.getSnapshot().queue.totalRetries).toBe(0);
    });
  });

  describe('recordDeadLetter', () => {
    it('increments total dead-lettered', () => {
      collector.recordDeadLetter();
      collector.recordDeadLetter();
      expect(collector.getSnapshot().queue.totalDeadLettered).toBe(2);
    });

    it('starts at zero', () => {
      expect(collector.getSnapshot().queue.totalDeadLettered).toBe(0);
    });
  });

  describe('reset', () => {
    it('resets all DLQ and retry metrics', () => {
      collector.recordDlqSize(10);
      collector.recordRetry();
      collector.recordRetry();
      collector.recordDeadLetter();

      collector.reset();

      const q = collector.getSnapshot().queue;
      expect(q.dlqSize).toBe(0);
      expect(q.totalRetries).toBe(0);
      expect(q.totalDeadLettered).toBe(0);
    });
  });

  describe('getSnapshot', () => {
    it('includes dlqSize, totalRetries, totalDeadLettered in queue snapshot', () => {
      collector.recordDlqSize(4);
      collector.recordRetry();
      collector.recordDeadLetter();
      collector.recordDeadLetter();

      const q = collector.getSnapshot().queue;
      expect(q.dlqSize).toBe(4);
      expect(q.totalRetries).toBe(1);
      expect(q.totalDeadLettered).toBe(2);
    });
  });
});

// ---------------------------------------------------------------------------
// ExportJobQueue → metrics sink integration
// ---------------------------------------------------------------------------

describe('ExportJobQueue DLQ/retry metrics integration', () => {
  it('reports DLQ size via emitMetrics after dead-lettering a job', () => {
    const sink = createMockSink();
    const queue = new ExportJobQueue(
      { maxConcurrent: 1, maxRetries: 0, maxDlqJobs: 10 },
      sink,
    );

    const job = queue.enqueue({ priority: 'normal', format: 'mp4', inputHash: 'abc' });
    queue.dequeue();
    queue.completeJob(job.jobId, false, undefined, 'fatal error');

    const dlqCalls = sink.calls.filter((c) => c.method === 'recordDlqSize');
    expect(dlqCalls.length).toBeGreaterThan(0);
    // The last dlqSize call should reflect 1 job in DLQ
    const lastDlq = dlqCalls[dlqCalls.length - 1];
    expect(lastDlq.args[0]).toBe(1);
  });

  it('reports DLQ size as 0 initially via emitMetrics', () => {
    const sink = createMockSink();
    const queue = new ExportJobQueue({}, sink);

    // Enqueue + dequeue to trigger emitMetrics
    queue.enqueue({ priority: 'normal', format: 'mp4', inputHash: 'abc' });

    const dlqCalls = sink.calls.filter((c) => c.method === 'recordDlqSize');
    expect(dlqCalls.length).toBeGreaterThan(0);
    expect(dlqCalls[0].args[0]).toBe(0);
  });

  it('calls recordDeadLetter when a job exhausts retries', () => {
    const sink = createMockSink();
    const queue = new ExportJobQueue(
      { maxConcurrent: 1, maxRetries: 0, maxDlqJobs: 10 },
      sink,
    );

    const job = queue.enqueue({ priority: 'high', format: 'json', inputHash: 'xyz' });
    queue.dequeue();
    queue.completeJob(job.jobId, false, undefined, 'permanent failure');

    const dlCalls = sink.calls.filter((c) => c.method === 'recordDeadLetter');
    expect(dlCalls).toHaveLength(1);
  });

  it('calls recordRetry when a job is re-queued for retry', () => {
    const sink = createMockSink();
    const queue = new ExportJobQueue(
      { maxConcurrent: 1, maxRetries: 3, maxDlqJobs: 10 },
      sink,
    );

    const job = queue.enqueue({ priority: 'normal', format: 'svg', inputHash: 'h1' });
    queue.dequeue();
    queue.completeJob(job.jobId, false, undefined, 'transient error');

    const retryCalls = sink.calls.filter((c) => c.method === 'recordRetry');
    expect(retryCalls).toHaveLength(1);
  });

  it('does not call recordRetry when job succeeds', () => {
    const sink = createMockSink();
    const queue = new ExportJobQueue(
      { maxConcurrent: 1, maxRetries: 3, maxDlqJobs: 10 },
      sink,
    );

    const job = queue.enqueue({ priority: 'normal', format: 'svg', inputHash: 'h1' });
    queue.dequeue();
    queue.completeJob(job.jobId, true, { data: new Uint8Array([1]), sizeBytes: 1 });

    const retryCalls = sink.calls.filter((c) => c.method === 'recordRetry');
    expect(retryCalls).toHaveLength(0);
  });

  it('records multiple retries and then a dead-letter', () => {
    const sink = createMockSink();
    const queue = new ExportJobQueue(
      { maxConcurrent: 1, maxRetries: 2, maxDlqJobs: 10 },
      sink,
    );

    // First attempt fails → retry
    const job = queue.enqueue({ priority: 'normal', format: 'mp4', inputHash: 'h1' });
    let dequeued = queue.dequeue()!;
    queue.completeJob(dequeued.jobId, false, undefined, 'fail 1');

    // Second attempt fails → retry
    dequeued = queue.dequeue()!;
    queue.completeJob(dequeued.jobId, false, undefined, 'fail 2');

    // Third attempt fails → dead-letter (retries exhausted)
    dequeued = queue.dequeue()!;
    queue.completeJob(dequeued.jobId, false, undefined, 'fail 3');

    const retryCalls = sink.calls.filter((c) => c.method === 'recordRetry');
    expect(retryCalls).toHaveLength(2);

    const dlCalls = sink.calls.filter((c) => c.method === 'recordDeadLetter');
    expect(dlCalls).toHaveLength(1);
  });

  it('updates DLQ size after purge', () => {
    const sink = createMockSink();
    const queue = new ExportJobQueue(
      { maxConcurrent: 1, maxRetries: 0, maxDlqJobs: 10 },
      sink,
    );

    // Dead-letter a job
    const job = queue.enqueue({ priority: 'low', format: 'mp4', inputHash: 'h1' });
    queue.dequeue();
    queue.completeJob(job.jobId, false, undefined, 'fail');

    // Clear calls
    sink.calls.length = 0;

    // Purge DLQ
    queue.purgeDeadLetterJobs();

    const dlqCalls = sink.calls.filter((c) => c.method === 'recordDlqSize');
    expect(dlqCalls.length).toBeGreaterThan(0);
    expect(dlqCalls[dlqCalls.length - 1].args[0]).toBe(0);
  });
});
