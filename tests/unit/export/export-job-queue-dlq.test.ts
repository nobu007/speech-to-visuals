/**
 * Export job queue retry and dead letter queue tests.
 *
 * Verifies exponential backoff retry logic, DLQ transitions,
 * replay/purge operations, and QueueStats integration.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ExportJobQueue, type QueuedExportJob } from '@/export/export-job-queue';

describe('ExportJobQueue — retry and dead letter queue', () => {
  let queue: ExportJobQueue;

  beforeEach(() => {
    queue = new ExportJobQueue({
      maxConcurrent: 2,
      maxQueueSize: 50,
      starvationPreventionInterval: 60_000,
      maxCompletedJobs: 100,
      maxRetries: 3,
      retryBaseDelayMs: 100,
      retryMaxDelayMs: 1_000,
      maxDlqJobs: 50,
    });
  });

  // -------------------------------------------------------------------------
  // Retry with exponential backoff
  // -------------------------------------------------------------------------

  describe('retry behavior', () => {
    it('re-enqueues a failed job for retry instead of failing immediately', () => {
      const job = queue.enqueue({
        priority: 'normal',
        format: 'mp4',
        inputHash: 'abc123',
      });

      queue.dequeue();
      queue.completeJob(job.jobId, false, undefined, 'render failed');

      // Job should be back in the queue with retryCount = 1
      const stats = queue.getQueueStats();
      expect(stats.queued).toBe(1);
      expect(stats.running).toBe(0);

      const found = queue.findJob(job.jobId);
      expect(found).toBeDefined();
      expect(found!.status).toBe('queued');
      expect(found!.retryCount).toBe(1);
      expect(found!.lastError).toBe('render failed');
    });

    it('increments retryCount on each failure', () => {
      const job = queue.enqueue({
        priority: 'high',
        format: 'mp4',
        inputHash: 'hash1',
      });

      // First failure → retry 1
      queue.dequeue();
      queue.completeJob(job.jobId, false, undefined, 'error 1');
      expect(queue.findJob(job.jobId)!.retryCount).toBe(1);

      // Second failure → retry 2
      queue.dequeue();
      queue.completeJob(job.jobId, false, undefined, 'error 2');
      expect(queue.findJob(job.jobId)!.retryCount).toBe(2);

      // Third failure → retry 3
      queue.dequeue();
      queue.completeJob(job.jobId, false, undefined, 'error 3');
      expect(queue.findJob(job.jobId)!.retryCount).toBe(3);
    });

    it('moves job to DLQ after exhausting maxRetries', () => {
      const job = queue.enqueue({
        priority: 'normal',
        format: 'mp4',
        inputHash: 'dlq-test',
      });

      // Fail 4 times (initial + 3 retries)
      for (let i = 0; i < 4; i++) {
        queue.dequeue();
        queue.completeJob(job.jobId, false, undefined, `failure ${i + 1}`);
      }

      const stats = queue.getQueueStats();
      expect(stats.queued).toBe(0);
      expect(stats.deadLettered).toBe(1);

      const dlqJob = queue.findJob(job.jobId);
      expect(dlqJob).toBeDefined();
      expect(dlqJob!.status).toBe('dead-lettered');
      expect(dlqJob!.retryCount).toBe(3);
      expect(dlqJob!.deadLetteredAt).toBeDefined();
      expect(dlqJob!.lastError).toBe('failure 4');
    });

    it('resets startedAt when re-queuing for retry', () => {
      const job = queue.enqueue({
        priority: 'normal',
        format: 'mp4',
        inputHash: 'reset-test',
      });

      queue.dequeue();
      expect(queue.findJob(job.jobId)!.startedAt).toBeDefined();

      queue.completeJob(job.jobId, false, undefined, 'fail');
      const found = queue.findJob(job.jobId);
      expect(found!.startedAt).toBeUndefined();
      expect(found!.completedAt).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // getRetryDelay
  // -------------------------------------------------------------------------

  describe('getRetryDelay', () => {
    it('computes exponential backoff delay', () => {
      // baseDelay=100, maxDelay=1000
      expect(queue.getRetryDelay(1)).toBe(100);     // 100 * 2^0 = 100
      expect(queue.getRetryDelay(2)).toBe(200);     // 100 * 2^1 = 200
      expect(queue.getRetryDelay(3)).toBe(400);     // 100 * 2^2 = 400
      expect(queue.getRetryDelay(4)).toBe(800);     // 100 * 2^3 = 800
    });

    it('caps at maxDelay', () => {
      // 100 * 2^4 = 1600 > 1000
      expect(queue.getRetryDelay(5)).toBe(1000);
      expect(queue.getRetryDelay(10)).toBe(1000);
    });

    it('handles edge case of retryCount 0', () => {
      expect(queue.getRetryDelay(0)).toBe(100); // treated as attempt 1
    });
  });

  // -------------------------------------------------------------------------
  // Dead letter queue operations
  // -------------------------------------------------------------------------

  describe('listDeadLetterJobs', () => {
    it('returns empty array when DLQ is empty', () => {
      expect(queue.listDeadLetterJobs()).toEqual([]);
    });

    it('returns DLQ jobs newest first', () => {
      // Create and fail 3 jobs through all retries
      for (let i = 0; i < 3; i++) {
        const job = queue.enqueue({
          priority: 'normal',
          format: 'mp4',
          inputHash: `hash-${i}`,
        });
        for (let r = 0; r < 4; r++) {
          queue.dequeue();
          queue.completeJob(job.jobId, false, undefined, `fail-${i}-${r}`);
        }
      }

      const dlq = queue.listDeadLetterJobs();
      expect(dlq).toHaveLength(3);
      // Newest first (last dead-lettered job is first)
      expect(dlq[0].inputHash).toBe('hash-2');
      expect(dlq[2].inputHash).toBe('hash-0');
    });
  });

  describe('replayDeadLetterJob', () => {
    it('replays a DLQ job with fresh retry count and new job ID', () => {
      const job = queue.enqueue({
        priority: 'high',
        format: 'mp4',
        inputHash: 'replay-test',
      });

      // Exhaust retries
      for (let i = 0; i < 4; i++) {
        queue.dequeue();
        queue.completeJob(job.jobId, false, undefined, 'fail');
      }

      expect(queue.getQueueStats().deadLettered).toBe(1);
      expect(queue.getQueueStats().queued).toBe(0);

      const replayed = queue.replayDeadLetterJob(job.jobId);
      expect(replayed).toBeDefined();
      expect(replayed!.jobId).not.toBe(job.jobId);
      expect(replayed!.status).toBe('queued');
      expect(replayed!.retryCount).toBe(0);
      expect(replayed!.lastError).toBeUndefined();
      expect(replayed!.deadLetteredAt).toBeUndefined();

      // DLQ should be empty, queue should have 1
      expect(queue.getQueueStats().deadLettered).toBe(0);
      expect(queue.getQueueStats().queued).toBe(1);
    });

    it('returns undefined for non-existent job', () => {
      expect(queue.replayDeadLetterJob('nonexistent-id')).toBeUndefined();
    });

    it('preserves original priority on replay', () => {
      const job = queue.enqueue({
        priority: 'low',
        format: 'webm',
        inputHash: 'priority-test',
      });

      for (let i = 0; i < 4; i++) {
        queue.dequeue();
        queue.completeJob(job.jobId, false, undefined, 'fail');
      }

      const replayed = queue.replayDeadLetterJob(job.jobId);
      expect(replayed!.priority).toBe('low');
    });

    it('can succeed after replay', () => {
      const job = queue.enqueue({
        priority: 'normal',
        format: 'mp4',
        inputHash: 'success-after-replay',
      });

      // Exhaust retries
      for (let i = 0; i < 4; i++) {
        queue.dequeue();
        queue.completeJob(job.jobId, false, undefined, 'fail');
      }

      // Replay and succeed
      const replayed = queue.replayDeadLetterJob(job.jobId);
      queue.dequeue();
      queue.completeJob(replayed!.jobId, true);

      const found = queue.findJob(replayed!.jobId);
      expect(found!.status).toBe('completed');
    });
  });

  describe('purgeDeadLetterJobs', () => {
    it('removes all DLQ jobs and returns count', () => {
      for (let i = 0; i < 3; i++) {
        const job = queue.enqueue({
          priority: 'normal',
          format: 'mp4',
          inputHash: `purge-${i}`,
        });
        for (let r = 0; r < 4; r++) {
          queue.dequeue();
          queue.completeJob(job.jobId, false, undefined, 'fail');
        }
      }

      expect(queue.getQueueStats().deadLettered).toBe(3);

      const purged = queue.purgeDeadLetterJobs();
      expect(purged).toBe(3);
      expect(queue.getQueueStats().deadLettered).toBe(0);
      expect(queue.listDeadLetterJobs()).toHaveLength(0);
    });

    it('returns 0 when DLQ is empty', () => {
      expect(queue.purgeDeadLetterJobs()).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // QueueStats integration
  // -------------------------------------------------------------------------

  describe('QueueStats deadLettered count', () => {
    it('tracks deadLettered count in stats', () => {
      const stats = queue.getQueueStats();
      expect(stats.deadLettered).toBe(0);

      const job = queue.enqueue({
        priority: 'normal',
        format: 'mp4',
        inputHash: 'stats-test',
      });

      for (let i = 0; i < 4; i++) {
        queue.dequeue();
        queue.completeJob(job.jobId, false, undefined, 'fail');
      }

      const stats2 = queue.getQueueStats();
      expect(stats2.deadLettered).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // DLQ retention / pruning
  // -------------------------------------------------------------------------

  describe('DLQ pruning', () => {
    it('prunes oldest DLQ jobs when exceeding maxDlqJobs', () => {
      const smallQueue = new ExportJobQueue({
        maxConcurrent: 1,
        maxQueueSize: 50,
        starvationPreventionInterval: 60_000,
        maxCompletedJobs: 100,
        maxRetries: 0, // No retries → immediate DLQ on first failure
        retryBaseDelayMs: 100,
        retryMaxDelayMs: 1_000,
        maxDlqJobs: 3,
      });

      for (let i = 0; i < 5; i++) {
        const job = smallQueue.enqueue({
          priority: 'normal',
          format: 'mp4',
          inputHash: `pruning-${i}`,
        });
        smallQueue.dequeue();
        smallQueue.completeJob(job.jobId, false, undefined, 'fail');
      }

      // Should only retain the last 3
      expect(smallQueue.getQueueStats().deadLettered).toBe(3);
      const dlq = smallQueue.listDeadLetterJobs();
      expect(dlq[0].inputHash).toBe('pruning-4');
      expect(dlq[2].inputHash).toBe('pruning-2');
    });
  });

  // -------------------------------------------------------------------------
  // findJob across DLQ
  // -------------------------------------------------------------------------

  describe('findJob with DLQ', () => {
    it('finds dead-lettered jobs via findJob', () => {
      const job = queue.enqueue({
        priority: 'normal',
        format: 'mp4',
        inputHash: 'find-dlq',
      });

      for (let i = 0; i < 4; i++) {
        queue.dequeue();
        queue.completeJob(job.jobId, false, undefined, 'fail');
      }

      const found = queue.findJob(job.jobId);
      expect(found).toBeDefined();
      expect(found!.status).toBe('dead-lettered');
    });
  });

  // -------------------------------------------------------------------------
  // Successful job after retry
  // -------------------------------------------------------------------------

  describe('successful completion after retry', () => {
    it('completes a job that succeeds on second attempt', () => {
      const job = queue.enqueue({
        priority: 'normal',
        format: 'mp4',
        inputHash: 'retry-success',
      });

      // First attempt fails
      queue.dequeue();
      queue.completeJob(job.jobId, false, undefined, 'transient error');
      expect(queue.findJob(job.jobId)!.retryCount).toBe(1);

      // Second attempt succeeds
      queue.dequeue();
      queue.completeJob(job.jobId, true, { data: new Uint8Array([1, 2, 3]), sizeBytes: 3 });

      const found = queue.findJob(job.jobId);
      expect(found!.status).toBe('completed');
      expect(found!.retryCount).toBe(1); // Retry count preserved
    });
  });
});
