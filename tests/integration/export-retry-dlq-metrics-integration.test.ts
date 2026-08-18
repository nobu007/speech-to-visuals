/**
 * Integration test: Full retry → exhaustion → DLQ → Prometheus metric emission
 *
 * Exercises the complete end-to-end path:
 *   1. Job is enqueued and dequeued
 *   2. Job fails repeatedly through all retry attempts (exponential backoff)
 *   3. Retries are exhausted → job moves to dead letter queue
 *   4. ExportMetricsCollector counters (totalRetries, totalDeadLettered, dlqSize)
 *      are asserted correct
 *   5. Prometheus exposition output contains the expected metric values
 *
 * Phase 109: End-to-end retry → DLQ → metrics verification.
 */

import { jest } from '@jest/globals';
import { ExportJobQueue } from '@/export/export-job-queue';
import { ExportMetricsCollector } from '@/export/export-metrics-collector';
import { exportPrometheusMetrics } from '@/monitoring/prometheus-exporter';
import type { HttpMetricsSnapshot } from '@/monitoring/http-metrics-collector';

jest.mock('@stv/core/utils/logger', () => ({
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

describe('Full retry → exhaustion → DLQ → Prometheus metrics', () => {
  let collector: ExportMetricsCollector;
  let queue: ExportJobQueue;

  beforeEach(() => {
    collector = new ExportMetricsCollector();
    queue = new ExportJobQueue(
      {
        maxConcurrent: 1,
        maxQueueSize: 50,
        starvationPreventionInterval: 999_999,
        maxCompletedJobs: 10,
        maxRetries: 3,
        retryBaseDelayMs: 1,
        retryMaxDelayMs: 10,
        maxDlqJobs: 100,
      },
      collector,
    );
  });

  afterEach(() => {
    queue.stop();
  });

  it('increments retry counter on each failure and dead-letter counter on exhaustion', () => {
    const job = queue.enqueue({
      priority: 'normal',
      format: 'mp4',
      inputHash: 'hash-a',
    });

    // Attempt 1: fail → retry (retryCount 0→1)
    let dequeued = queue.dequeue()!;
    expect(dequeued.jobId).toBe(job.jobId);
    queue.completeJob(dequeued.jobId, false, undefined, 'transient-error-1');
    expect(collector.getSnapshot().queue.totalRetries).toBe(1);
    expect(collector.getSnapshot().queue.totalDeadLettered).toBe(0);

    // Attempt 2: fail → retry (retryCount 1→2)
    dequeued = queue.dequeue()!;
    expect(dequeued.retryCount).toBe(1);
    queue.completeJob(dequeued.jobId, false, undefined, 'transient-error-2');
    expect(collector.getSnapshot().queue.totalRetries).toBe(2);
    expect(collector.getSnapshot().queue.totalDeadLettered).toBe(0);

    // Attempt 3: fail → retry (retryCount 2→3)
    dequeued = queue.dequeue()!;
    expect(dequeued.retryCount).toBe(2);
    queue.completeJob(dequeued.jobId, false, undefined, 'transient-error-3');
    expect(collector.getSnapshot().queue.totalRetries).toBe(3);
    expect(collector.getSnapshot().queue.totalDeadLettered).toBe(0);

    // Attempt 4: fail → retries exhausted (retryCount=3, not < maxRetries=3) → DLQ
    dequeued = queue.dequeue()!;
    expect(dequeued.retryCount).toBe(3);
    queue.completeJob(dequeued.jobId, false, undefined, 'permanent-failure');
    expect(collector.getSnapshot().queue.totalRetries).toBe(3);
    expect(collector.getSnapshot().queue.totalDeadLettered).toBe(1);
    expect(collector.getSnapshot().queue.dlqSize).toBe(1);
  });

  it('preserves error messages through the retry chain into the DLQ', () => {
    const job = queue.enqueue({
      priority: 'high',
      format: 'json',
      inputHash: 'hash-b',
    });

    const errors = ['fail-a', 'fail-b', 'fail-c', 'fail-d'];
    let dequeued = queue.dequeue()!;
    for (let i = 0; i < errors.length; i++) {
      queue.completeJob(dequeued.jobId, false, undefined, errors[i]);
      dequeued = queue.dequeue();
      if (i < errors.length - 1) {
        expect(dequeued).toBeDefined();
      }
    }

    // Last dequeue should be undefined (job is in DLQ, not queue)
    expect(dequeued).toBeUndefined();

    const dlqJobs = queue.listDeadLetterJobs();
    expect(dlqJobs).toHaveLength(1);
    expect(dlqJobs[0].lastError).toBe('fail-d');
    expect(dlqJobs[0].status).toBe('dead-lettered');
    expect(dlqJobs[0].deadLetteredAt).toBeDefined();
    expect(dlqJobs[0].retryCount).toBe(3);
  });

  it('surfaces retry, DLQ size, and dead-letter counters in Prometheus output', () => {
    // Drive a single job through the full retry → DLQ path (3 retries + final failure)
    const job = queue.enqueue({
      priority: 'normal',
      format: 'mp4',
      inputHash: 'hash-c',
    });

    for (let i = 0; i < 4; i++) {
      const dequeued = queue.dequeue()!;
      queue.completeJob(dequeued.jobId, false, undefined, `error-${i}`);
    }

    const snap = collector.getSnapshot();
    const output = exportPrometheusMetrics({
      snapshot: EMPTY_HTTP,
      exportSnapshot: snap,
    });

    // Retry counter: 3 retries before exhaustion
    expect(output).toContain('# HELP export_queue_retry_total');
    expect(output).toContain('# TYPE export_queue_retry_total counter');
    expect(output).toMatch(/export_queue_retry_total 3/);

    // Dead-letter counter: 1 job dead-lettered
    expect(output).toContain('# HELP export_queue_dead_letter_total');
    expect(output).toContain('# TYPE export_queue_dead_letter_total counter');
    expect(output).toMatch(/export_queue_dead_letter_total 1/);

    // DLQ size gauge: 1 job currently in DLQ
    expect(output).toContain('# HELP export_queue_dlq_size');
    expect(output).toContain('# TYPE export_queue_dlq_size gauge');
    expect(output).toMatch(/export_queue_dlq_size 1/);
  });

  it('does not emit DLQ/retry metrics when no retry or DLQ activity has occurred', () => {
    // Enqueue and complete a job successfully — no retries, no DLQ
    const job = queue.enqueue({
      priority: 'normal',
      format: 'mp4',
      inputHash: 'hash-ok',
    });
    queue.dequeue();
    queue.completeJob(job.jobId, true, {
      data: new Uint8Array([0x00, 0x01]),
      sizeBytes: 2,
    });

    const snap = collector.getSnapshot();
    const output = exportPrometheusMetrics({
      snapshot: EMPTY_HTTP,
      exportSnapshot: snap,
    });

    expect(output).not.toContain('export_queue_retry_total');
    expect(output).not.toContain('export_queue_dead_letter_total');
    expect(output).not.toContain('export_queue_dlq_size');
  });

  it('resets DLQ size metric after purging the dead letter queue', () => {
    // Use maxRetries=0 so first failure goes directly to DLQ
    const dlqCollector = new ExportMetricsCollector();
    const dlqQueue = new ExportJobQueue(
      { maxConcurrent: 1, maxRetries: 0, maxDlqJobs: 100 },
      dlqCollector,
    );

    // Dead-letter a job
    const job = dlqQueue.enqueue({
      priority: 'normal',
      format: 'mp4',
      inputHash: 'hash-purge',
    });
    dlqQueue.dequeue();
    dlqQueue.completeJob(job.jobId, false, undefined, 'fail');

    expect(dlqCollector.getSnapshot().queue.dlqSize).toBe(1);

    // Purge the DLQ
    const purged = dlqQueue.purgeDeadLetterJobs();
    expect(purged).toBe(1);
    expect(dlqCollector.getSnapshot().queue.dlqSize).toBe(0);

    // totalDeadLettered counter remains (it's a counter, not a gauge)
    expect(dlqCollector.getSnapshot().queue.totalDeadLettered).toBe(1);

    // Prometheus output reflects purged state
    const output = exportPrometheusMetrics({
      snapshot: EMPTY_HTTP,
      exportSnapshot: dlqCollector.getSnapshot(),
    });
    expect(output).toMatch(/export_queue_dlq_size 0/);
    expect(output).toMatch(/export_queue_dead_letter_total 1/);

    dlqQueue.stop();
  });

  it('clears DLQ metrics after replaying a dead-lettered job', () => {
    // Use maxRetries=0 for immediate DLQ
    const replayCollector = new ExportMetricsCollector();
    const replayQueue = new ExportJobQueue(
      { maxConcurrent: 1, maxRetries: 0, maxDlqJobs: 100 },
      replayCollector,
    );

    // Dead-letter a job
    const job = replayQueue.enqueue({
      priority: 'high',
      format: 'json',
      inputHash: 'hash-replay',
    });
    replayQueue.dequeue();
    replayQueue.completeJob(job.jobId, false, undefined, 'fail');

    expect(replayCollector.getSnapshot().queue.dlqSize).toBe(1);

    // Replay the DLQ job
    const replayed = replayQueue.replayDeadLetterJob(job.jobId);
    expect(replayed).toBeDefined();
    expect(replayed!.retryCount).toBe(0);
    expect(replayed!.status).toBe('queued');

    // DLQ size gauge should be 0 after replay
    expect(replayCollector.getSnapshot().queue.dlqSize).toBe(0);

    // totalDeadLettered counter still reflects the historical event
    expect(replayCollector.getSnapshot().queue.totalDeadLettered).toBe(1);

    replayQueue.stop();
  });

  it('handles multiple jobs failing concurrently through retry to DLQ', () => {
    // Use a queue with maxRetries=1 for quicker exhaustion
    const localCollector = new ExportMetricsCollector();
    const localQueue = new ExportJobQueue(
      {
        maxConcurrent: 2,
        maxQueueSize: 50,
        starvationPreventionInterval: 999_999,
        maxCompletedJobs: 20,
        maxRetries: 1,
        retryBaseDelayMs: 1,
        retryMaxDelayMs: 10,
        maxDlqJobs: 100,
      },
      localCollector,
    );

    // Enqueue 3 jobs
    localQueue.enqueue({ priority: 'normal', format: 'mp4', inputHash: 'm1' });
    localQueue.enqueue({ priority: 'normal', format: 'mp4', inputHash: 'm2' });
    localQueue.enqueue({ priority: 'normal', format: 'mp4', inputHash: 'm3' });

    // Drain all jobs through retry → DLQ by repeatedly dequeueing and failing.
    // Each job needs 2 dequeue+fail cycles: first triggers retry, second triggers DLQ.
    // Total: 3 retries + 3 dead-letters = 6 dequeue+fail operations.
    let dequeued;
    while ((dequeued = localQueue.dequeue()) !== undefined) {
      localQueue.completeJob(dequeued.jobId, false, undefined, 'fail');
    }

    // With maxRetries=1, each job gets 1 retry then goes to DLQ
    expect(localCollector.getSnapshot().queue.totalRetries).toBe(3);
    expect(localCollector.getSnapshot().queue.totalDeadLettered).toBe(3);
    expect(localCollector.getSnapshot().queue.dlqSize).toBe(3);

    // Verify Prometheus output
    const output = exportPrometheusMetrics({
      snapshot: EMPTY_HTTP,
      exportSnapshot: localCollector.getSnapshot(),
    });
    expect(output).toMatch(/export_queue_retry_total 3/);
    expect(output).toMatch(/export_queue_dead_letter_total 3/);
    expect(output).toMatch(/export_queue_dlq_size 3/);

    localQueue.stop();
  });

  it('tracks DLQ replay counter through replay → Prometheus output', () => {
    // Use maxRetries=0 for immediate DLQ
    const replayCollector = new ExportMetricsCollector();
    const replayQueue = new ExportJobQueue(
      { maxConcurrent: 1, maxRetries: 0, maxDlqJobs: 100 },
      replayCollector,
    );

    // Dead-letter two jobs
    const job1 = replayQueue.enqueue({ priority: 'normal', format: 'mp4', inputHash: 'r1' });
    replayQueue.dequeue();
    replayQueue.completeJob(job1.jobId, false, undefined, 'fail-1');

    const job2 = replayQueue.enqueue({ priority: 'normal', format: 'mp4', inputHash: 'r2' });
    replayQueue.dequeue();
    replayQueue.completeJob(job2.jobId, false, undefined, 'fail-2');

    expect(replayCollector.getSnapshot().queue.dlqSize).toBe(2);
    expect(replayCollector.getSnapshot().queue.totalReplayed).toBe(0);

    // Replay both jobs
    const replayed1 = replayQueue.replayDeadLetterJob(job1.jobId);
    const replayed2 = replayQueue.replayDeadLetterJob(job2.jobId);
    expect(replayed1).toBeDefined();
    expect(replayed2).toBeDefined();

    // Replay counter should be 2
    const snap = replayCollector.getSnapshot();
    expect(snap.queue.totalReplayed).toBe(2);
    expect(snap.queue.dlqSize).toBe(0);

    // Prometheus output should include the replay counter
    const output = exportPrometheusMetrics({
      snapshot: EMPTY_HTTP,
      exportSnapshot: snap,
    });

    expect(output).toContain('# HELP export_queue_dlq_replay_total');
    expect(output).toContain('# TYPE export_queue_dlq_replay_total counter');
    expect(output).toMatch(/export_queue_dlq_replay_total 2/);

    // DLQ size gauge should show 0
    expect(output).toMatch(/export_queue_dlq_size 0/);

    // totalDeadLettered counter still reflects the 2 historical events
    expect(output).toMatch(/export_queue_dead_letter_total 2/);

    replayQueue.stop();
  });

  it('does not emit replay metric when no replays have occurred', () => {
    // Drive a job to DLQ without replaying
    const collector2 = new ExportMetricsCollector();
    const queue2 = new ExportJobQueue(
      { maxConcurrent: 1, maxRetries: 0, maxDlqJobs: 100 },
      collector2,
    );

    const job = queue2.enqueue({ priority: 'normal', format: 'mp4', inputHash: 'no-replay' });
    queue2.dequeue();
    queue2.completeJob(job.jobId, false, undefined, 'fail');

    const snap = collector2.getSnapshot();
    const output = exportPrometheusMetrics({
      snapshot: EMPTY_HTTP,
      exportSnapshot: snap,
    });

    // DLQ and dead-letter metrics should be present
    expect(output).toMatch(/export_queue_dlq_size 1/);
    expect(output).toMatch(/export_queue_dead_letter_total 1/);

    // Replay metric should NOT be present
    expect(output).not.toContain('export_queue_dlq_replay_total');

    queue2.stop();
  });
});
