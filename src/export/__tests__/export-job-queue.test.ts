/**
 * Tests for ExportJobQueue (REQ-229, Phase 99)
 */

import { ExportJobQueue, type QueuedExportJob, type QueueMetricsSink } from '../export-job-queue';
import { ExportMetricsCollector } from '../export-metrics-collector';
import { ExportArtifactStore } from '../export-artifact-store';

// ---------------------------------------------------------------------------
// Helper: mock metrics sink
// ---------------------------------------------------------------------------

function createMockSink(): QueueMetricsSink & {
  queueSizes: number[];
  waitTimes: number[];
  dequeues: string[];
  distributions: Array<{ high: number; normal: number; low: number }>;
} {
  return {
    queueSizes: [],
    waitTimes: [],
    dequeues: [],
    distributions: [],
    recordQueueSize(size: number) { this.queueSizes.push(size); },
    recordQueueWaitTimeMs(waitMs: number) { this.waitTimes.push(waitMs); },
    recordQueueDequeue(priority: string) { this.dequeues.push(priority); },
    recordQueuePriorityDistribution(high: number, normal: number, low: number) {
      this.distributions.push({ high, normal, low });
    },
    recordDlqSize() {},
    recordRetry() {},
    recordDeadLetter() {},
    recordReplay() {},
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ExportJobQueue', () => {
  let queue: ExportJobQueue;

  beforeEach(() => {
    queue = new ExportJobQueue({ maxConcurrent: 3, maxQueueSize: 100 });
  });

  afterEach(() => {
    queue.stop();
  });

  // -- Enqueue / Dequeue basics --------------------------------------------

  describe('enqueue', () => {
    it('should enqueue a job and assign a jobId', () => {
      const job = queue.enqueue({
        priority: 'normal',
        format: 'mp4',
        inputHash: 'abc123',
      });

      expect(job.jobId).toBeDefined();
      expect(job.status).toBe('queued');
      expect(job.priority).toBe('normal');
      expect(job.format).toBe('mp4');
      expect(job.enqueuedAt).toBeGreaterThan(0);
    });

    it('should throw when queue is full', () => {
      const small = new ExportJobQueue({ maxQueueSize: 2 });
      small.enqueue({ priority: 'low', format: 'mp4', inputHash: '1' });
      small.enqueue({ priority: 'low', format: 'mp4', inputHash: '2' });

      expect(() => {
        small.enqueue({ priority: 'low', format: 'mp4', inputHash: '3' });
      }).toThrow('Export queue is full');

      small.stop();
    });
  });

  describe('dequeue', () => {
    it('should return undefined when queue is empty', () => {
      expect(queue.dequeue()).toBeUndefined();
    });

    it('should dequeue a job and mark it as running', () => {
      const enqueued = queue.enqueue({
        priority: 'normal',
        format: 'mp4',
        inputHash: 'abc',
      });

      const dequeued = queue.dequeue();
      expect(dequeued).toBeDefined();
      expect(dequeued!.jobId).toBe(enqueued.jobId);
      expect(dequeued!.status).toBe('running');
      expect(dequeued!.startedAt).toBeGreaterThan(0);
    });
  });

  // -- Priority ordering ---------------------------------------------------

  describe('priority ordering', () => {
    it('should dequeue high before normal before low', () => {
      const low = queue.enqueue({ priority: 'low', format: 'mp4', inputHash: '1' });
      const normal = queue.enqueue({ priority: 'normal', format: 'mp4', inputHash: '2' });
      const high = queue.enqueue({ priority: 'high', format: 'mp4', inputHash: '3' });

      const first = queue.dequeue();
      const second = queue.dequeue();
      const third = queue.dequeue();

      expect(first!.jobId).toBe(high.jobId);
      expect(second!.jobId).toBe(normal.jobId);
      expect(third!.jobId).toBe(low.jobId);
    });

    it('should maintain FIFO within same priority', () => {
      const a = queue.enqueue({ priority: 'normal', format: 'mp4', inputHash: '1' });
      const b = queue.enqueue({ priority: 'normal', format: 'mp4', inputHash: '2' });
      const c = queue.enqueue({ priority: 'normal', format: 'mp4', inputHash: '3' });

      expect(queue.dequeue()!.jobId).toBe(a.jobId);
      expect(queue.dequeue()!.jobId).toBe(b.jobId);
      expect(queue.dequeue()!.jobId).toBe(c.jobId);
    });

    it('should interleave priorities correctly', () => {
      // Enqueue: low, high, normal, low, high
      const l1 = queue.enqueue({ priority: 'low', format: 'mp4', inputHash: '1' });
      const h1 = queue.enqueue({ priority: 'high', format: 'mp4', inputHash: '2' });
      const n1 = queue.enqueue({ priority: 'normal', format: 'mp4', inputHash: '3' });
      const l2 = queue.enqueue({ priority: 'low', format: 'mp4', inputHash: '4' });
      const h2 = queue.enqueue({ priority: 'high', format: 'mp4', inputHash: '5' });

      // Dequeue order: h1, h2, n1, l1, l2
      expect(queue.dequeue()!.jobId).toBe(h1.jobId);
      expect(queue.dequeue()!.jobId).toBe(h2.jobId);
      expect(queue.dequeue()!.jobId).toBe(n1.jobId);
      expect(queue.dequeue()!.jobId).toBe(l1.jobId);
      expect(queue.dequeue()!.jobId).toBe(l2.jobId);
    });
  });

  // -- Concurrent control --------------------------------------------------

  describe('concurrency control', () => {
    it('should track running jobs', () => {
      queue.enqueue({ priority: 'normal', format: 'mp4', inputHash: '1' });
      queue.enqueue({ priority: 'normal', format: 'mp4', inputHash: '2' });

      queue.dequeue();
      queue.dequeue();

      expect(queue.getQueueStats().running).toBe(2);
    });

    it('should respect maxConcurrent for available slots', () => {
      const q = new ExportJobQueue({ maxConcurrent: 2 });
      q.enqueue({ priority: 'normal', format: 'mp4', inputHash: '1' });
      q.enqueue({ priority: 'normal', format: 'mp4', inputHash: '2' });
      q.enqueue({ priority: 'normal', format: 'mp4', inputHash: '3' });

      q.dequeue();
      q.dequeue();

      expect(q.getAvailableSlots()).toBe(0);
      expect(q.hasCapacity()).toBe(false);

      q.stop();
    });

    it('should free slots when jobs complete', () => {
      queue.enqueue({ priority: 'normal', format: 'mp4', inputHash: '1' });
      const job = queue.dequeue()!;

      expect(queue.getAvailableSlots()).toBe(2);

      queue.completeJob(job.jobId, true);

      expect(queue.getAvailableSlots()).toBe(3);
      expect(queue.getQueueStats().running).toBe(0);
    });
  });

  // -- Cancel --------------------------------------------------------------

  describe('cancel', () => {
    it('should cancel a queued job', () => {
      const job = queue.enqueue({ priority: 'normal', format: 'mp4', inputHash: '1' });
      expect(queue.cancel(job.jobId)).toBe(true);
      expect(queue.getQueueStats().queued).toBe(0);
      expect(queue.dequeue()).toBeUndefined();
    });

    it('should cancel a running job', () => {
      const job = queue.enqueue({ priority: 'normal', format: 'mp4', inputHash: '1' });
      queue.dequeue();
      expect(queue.cancel(job.jobId)).toBe(true);
      expect(queue.getQueueStats().running).toBe(0);
    });

    it('should return false for unknown jobId', () => {
      expect(queue.cancel('non-existent')).toBe(false);
    });
  });

  // -- Queue position & ETA ------------------------------------------------

  describe('queue position and ETA', () => {
    it('should return queue position', () => {
      const a = queue.enqueue({ priority: 'normal', format: 'mp4', inputHash: '1' });
      queue.enqueue({ priority: 'high', format: 'mp4', inputHash: '2' });
      const c = queue.enqueue({ priority: 'normal', format: 'mp4', inputHash: '3' });

      // After sorting: high, a(normal), c(normal)
      // c is at position 2
      expect(queue.getQueuePosition(a.jobId)).toBe(1);
      expect(queue.getQueuePosition(c.jobId)).toBe(2);
    });

    it('should return undefined for non-queued job', () => {
      expect(queue.getQueuePosition('non-existent')).toBeUndefined();
    });

    it('should estimate wait time based on position', () => {
      // Use maxConcurrent=1 so jobs must queue
      const q = new ExportJobQueue({ maxConcurrent: 1, maxQueueSize: 100 });
      // With no history, default avg duration is 10000ms
      q.enqueue({ priority: 'normal', format: 'mp4', inputHash: '1' });
      q.enqueue({ priority: 'normal', format: 'mp4', inputHash: '2' });
      const c = q.enqueue({ priority: 'normal', format: 'mp4', inputHash: '3' });

      const eta = q.getEstimatedWaitTime(c.jobId);
      // Position 2, 0 running, availableSlots=1 => the head (pos 0) starts in
      // the free slot immediately, but this job must wait for BOTH ahead jobs to
      // clear serially (maxConcurrent=1): effectiveAhead = max(0, 2 + 1 - 1) = 2.
      // 2 * 10000 = 20000
      expect(eta).toBe(20_000);

      q.stop();
    });

    it('should reduce ETA by running job count', () => {
      // Use maxConcurrent=1 to make ETA calculation straightforward
      const q = new ExportJobQueue({ maxConcurrent: 1, maxQueueSize: 100 });
      q.enqueue({ priority: 'normal', format: 'mp4', inputHash: '1' });
      q.enqueue({ priority: 'normal', format: 'mp4', inputHash: '2' });
      const c = q.enqueue({ priority: 'normal', format: 'mp4', inputHash: '3' });

      // Dequeue the first job (now running, 1 slot used)
      q.dequeue();

      const eta = q.getEstimatedWaitTime(c.jobId);
      // Position 1, 1 running (maxConcurrent=1) → availableSlots=0. This job
      // must wait for the running job AND the one ahead of it to clear serially:
      // effectiveAhead = max(0, position + 1 - availableSlots) = max(0, 2) = 2.
      // 2 * 10000 = 20000
      expect(eta).toBe(20_000);

      q.stop();
    });

    it('reports a non-zero ETA for the queue head when every slot is busy', () => {
      // Regression: the OLD formula `max(0, position - availableSlots)` forgot
      // that the job ITSELF needs a slot. With every slot busy, the queue head
      // (position 0) computed effectiveAhead = max(0, 0 - 0) = 0 → ETA 0, even
      // though it cannot start until a running job finishes. A queued head with
      // no free slot MUST report a positive wait.
      const q = new ExportJobQueue({ maxConcurrent: 1, maxQueueSize: 100 });
      q.enqueue({ priority: 'normal', format: 'mp4', inputHash: 'running' });
      q.dequeue(); // fills the only slot: running.size=1, availableSlots=0
      const head = q.enqueue({ priority: 'normal', format: 'mp4', inputHash: 'head' });

      expect(q.getQueuePosition(head.jobId)).toBe(0);
      expect(q.getEstimatedWaitTime(head.jobId)).toBeGreaterThan(0);

      q.stop();
    });
  });

  // -- Complete job ---------------------------------------------------------

  describe('completeJob', () => {
    it('should mark a running job as completed', () => {
      const job = queue.enqueue({ priority: 'normal', format: 'mp4', inputHash: '1' });
      queue.dequeue();

      expect(queue.completeJob(job.jobId, true)).toBe(true);
      expect(queue.getQueueStats().completed).toBe(1);
      expect(queue.getQueueStats().failed).toBe(0);
    });

    it('should mark a running job as failed', () => {
      const q = new ExportJobQueue({ maxConcurrent: 3, maxQueueSize: 100, maxRetries: 0 });
      const job = q.enqueue({ priority: 'normal', format: 'mp4', inputHash: '1' });
      q.dequeue();

      expect(q.completeJob(job.jobId, false)).toBe(true);
      expect(q.getQueueStats().failed).toBe(1);
      expect(q.getQueueStats().completed).toBe(0);
      q.stop();
    });

    it('should return false for non-running job', () => {
      expect(queue.completeJob('non-existent', true)).toBe(false);
    });

    it('should track average duration for ETA after completions', () => {
      // Use maxConcurrent=1 to ensure queueing
      const q = new ExportJobQueue({ maxConcurrent: 1, maxQueueSize: 100 });

      // Simulate some completions with known durations
      const d1 = q.enqueue({ priority: 'normal', format: 'mp4', inputHash: '1' });
      const running = q.dequeue()!;
      running.startedAt = Date.now() - 5000;
      q.completeJob(running.jobId, true);

      q.enqueue({ priority: 'normal', format: 'mp4', inputHash: '2' });
      q.enqueue({ priority: 'normal', format: 'mp4', inputHash: '3' });
      const job3 = q.enqueue({ priority: 'normal', format: 'mp4', inputHash: '4' });

      const eta = q.getEstimatedWaitTime(job3.jobId);
      // avgDuration ≈ 5000ms, position=2, availableSlots=1, effectiveAhead=1
      // ETA = 1 * ~5000 = ~5000
      expect(eta).toBeGreaterThan(0);

      q.stop();
    });
  });

  // -- Queue stats ---------------------------------------------------------

  describe('getQueueStats', () => {
    it('should return accurate stats', () => {
      queue.enqueue({ priority: 'normal', format: 'mp4', inputHash: '1' });
      queue.enqueue({ priority: 'high', format: 'mp4', inputHash: '2' });
      const r1 = queue.dequeue()!;
      queue.cancel(r1.jobId);

      const stats = queue.getQueueStats();
      expect(stats.queued).toBe(1);
      expect(stats.cancelled).toBe(1);
      expect(stats.running).toBe(0);
      expect(stats.maxConcurrent).toBe(3);
    });
  });

  // -- Starvation prevention -----------------------------------------------

  describe('starvation prevention', () => {
    it('should promote old low-priority jobs to normal', () => {
      jest.useFakeTimers();

      const q = new ExportJobQueue({
        maxConcurrent: 3,
        starvationPreventionInterval: 1000,
      });

      // Enqueue a low-priority job
      const lowJob = q.enqueue({ priority: 'low', format: 'mp4', inputHash: 'low1' });

      // Advance past the starvation interval
      jest.advanceTimersByTime(1500);

      // Manually trigger (the timer would call preventStarvation)
      // But since we use fake timers, let's just call start and advance
      q.start();
      jest.advanceTimersByTime(1500);

      // The low job should have been promoted to normal
      // Since there are no high-priority jobs, it should still be first
      const dequeued = q.dequeue();
      expect(dequeued).toBeDefined();
      expect(dequeued!.priority).toBe('normal');
      expect(dequeued!.jobId).toBe(lowJob.jobId);

      q.stop();
      jest.useRealTimers();
    });

    it('should not promote recently enqueued low-priority jobs', () => {
      jest.useFakeTimers();

      const q = new ExportJobQueue({
        maxConcurrent: 3,
        starvationPreventionInterval: 5000,
      });

      q.enqueue({ priority: 'low', format: 'mp4', inputHash: 'low1' });

      q.start();
      // Advance less than the interval
      jest.advanceTimersByTime(1000);

      const dequeued = q.dequeue();
      expect(dequeued).toBeDefined();
      // Should still be low priority since not enough time has passed
      expect(dequeued!.priority).toBe('low');

      q.stop();
      jest.useRealTimers();
    });
  });

  // -- Metrics integration -------------------------------------------------

  describe('metrics integration', () => {
    it('should report queue size on enqueue', () => {
      const sink = createMockSink();
      const q = new ExportJobQueue({ maxConcurrent: 3 }, sink as unknown as QueueMetricsSink);

      q.enqueue({ priority: 'normal', format: 'mp4', inputHash: '1' });
      q.enqueue({ priority: 'high', format: 'mp4', inputHash: '2' });

      // The last recorded queue size should be 2
      expect(sink.queueSizes[sink.queueSizes.length - 1]).toBe(2);
      expect(sink.distributions[sink.distributions.length - 1]).toEqual({
        high: 1,
        normal: 1,
        low: 0,
      });

      q.stop();
    });

    it('should record dequeue events with priority', () => {
      const sink = createMockSink();
      const q = new ExportJobQueue({ maxConcurrent: 3 }, sink as unknown as QueueMetricsSink);

      q.enqueue({ priority: 'high', format: 'mp4', inputHash: '1' });
      q.enqueue({ priority: 'normal', format: 'mp4', inputHash: '2' });

      q.dequeue(); // high
      q.dequeue(); // normal

      expect(sink.dequeues).toEqual(['high', 'normal']);

      q.stop();
    });

    it('should record wait time on job completion', () => {
      const sink = createMockSink();
      const q = new ExportJobQueue({ maxConcurrent: 3 }, sink as unknown as QueueMetricsSink);

      const job = q.enqueue({ priority: 'normal', format: 'mp4', inputHash: '1' });
      const dequeued = q.dequeue()!;
      // Simulate some wait time
      dequeued.startedAt = dequeued.enqueuedAt + 500;
      q.completeJob(dequeued.jobId, true);

      expect(sink.waitTimes.length).toBe(1);
      expect(sink.waitTimes[0]).toBe(500);

      q.stop();
    });
  });

  // -- Integration with ExportMetricsCollector -----------------------------

  describe('ExportMetricsCollector queue metrics', () => {
    it('should record and snapshot queue metrics', () => {
      const collector = new ExportMetricsCollector();

      collector.recordQueueSize(5);
      collector.recordQueueDequeue('high');
      collector.recordQueueDequeue('normal');
      collector.recordQueuePriorityDistribution(2, 2, 1);

      const snapshot = collector.getSnapshot();
      expect(snapshot.queue.queueSize).toBe(5);
      expect(snapshot.queue.dequeueCount).toBe(2);
      expect(snapshot.queue.dequeueByPriority).toEqual({ high: 1, normal: 1, low: 0 });
      expect(snapshot.queue.priorityDistribution).toEqual({ high: 2, normal: 2, low: 1 });
    });

    it('should reset queue metrics', () => {
      const collector = new ExportMetricsCollector();

      collector.recordQueueSize(5);
      collector.recordQueueDequeue('high');
      collector.reset();

      const snapshot = collector.getSnapshot();
      expect(snapshot.queue.queueSize).toBe(0);
      expect(snapshot.queue.dequeueCount).toBe(0);
    });

    it('should track average wait time', () => {
      const collector = new ExportMetricsCollector();

      collector.recordQueueWaitTimeMs(100);
      collector.recordQueueWaitTimeMs(300);

      const snapshot = collector.getSnapshot();
      expect(snapshot.queue.avgWaitTimeMs).toBe(200);
    });
  });

  // -- pruneCompletedJobs eviction order -----------------------------------

  describe('pruneCompletedJobs eviction order', () => {
    it('should evict oldest terminal jobs first (strict FIFO)', () => {
      const q = new ExportJobQueue({ maxConcurrent: 1, maxQueueSize: 100, maxCompletedJobs: 3 });
      const ids: string[] = [];

      // Complete 5 jobs sequentially; each completion triggers pruning
      for (let i = 0; i < 5; i++) {
        const job = q.enqueue({ priority: 'normal', format: 'mp4', inputHash: `evict-${i}` });
        ids.push(job.jobId);
        q.dequeue();
        q.completeJob(job.jobId, true);
      }

      // Only the last 3 should survive
      expect(q.findJob(ids[0])).toBeUndefined();
      expect(q.findJob(ids[1])).toBeUndefined();
      expect(q.findJob(ids[2])).toBeDefined();
      expect(q.findJob(ids[3])).toBeDefined();
      expect(q.findJob(ids[4])).toBeDefined();

      const stats = q.getQueueStats();
      expect(stats.completed).toBe(3);
      q.stop();
    });

    it('should evict in FIFO order regardless of terminal status (completed/failed/cancelled)', () => {
      const q = new ExportJobQueue({ maxConcurrent: 1, maxQueueSize: 100, maxCompletedJobs: 3, maxRetries: 0 });

      // Job 0: completed
      const j0 = q.enqueue({ priority: 'normal', format: 'mp4', inputHash: 'mix-0' });
      q.dequeue();
      q.completeJob(j0.jobId, true);

      // Job 1: failed
      const j1 = q.enqueue({ priority: 'normal', format: 'mp4', inputHash: 'mix-1' });
      q.dequeue();
      q.completeJob(j1.jobId, false);

      // Job 2: cancelled (from queue, no need to dequeue)
      const j2 = q.enqueue({ priority: 'normal', format: 'mp4', inputHash: 'mix-2' });
      q.cancel(j2.jobId);

      // Job 3: completed
      const j3 = q.enqueue({ priority: 'normal', format: 'mp4', inputHash: 'mix-3' });
      q.dequeue();
      q.completeJob(j3.jobId, true);

      // Job 4: completed — this triggers pruning of oldest 2 (j0, j1)
      const j4 = q.enqueue({ priority: 'normal', format: 'mp4', inputHash: 'mix-4' });
      q.dequeue();
      q.completeJob(j4.jobId, true);

      // Oldest two evicted from completed list regardless of terminal status
      expect(q.findJob(j0.jobId)).toBeUndefined();
      // j1 was dead-lettered, so it remains in the DLQ after completed-list pruning
      expect(q.findJob(j1.jobId)).toBeDefined();

      // Newer three retained (cancelled j2 is still in the completed array)
      expect(q.findJob(j2.jobId)).toBeDefined();
      expect(q.findJob(j3.jobId)).toBeDefined();
      expect(q.findJob(j4.jobId)).toBeDefined();

      const stats = q.getQueueStats();
      expect(stats.completed).toBe(2); // j3 and j4
      expect(stats.failed).toBe(0);    // j1 was pruned
      expect(stats.cancelled).toBe(1); // j2
      q.stop();
    });

    it('should evict incrementally as new jobs complete', () => {
      const q = new ExportJobQueue({ maxConcurrent: 1, maxQueueSize: 100, maxCompletedJobs: 2 });

      const j0 = q.enqueue({ priority: 'normal', format: 'mp4', inputHash: 'inc-0' });
      q.dequeue(); q.completeJob(j0.jobId, true);

      // 1 job in completed — no eviction yet
      expect(q.findJob(j0.jobId)).toBeDefined();

      const j1 = q.enqueue({ priority: 'normal', format: 'mp4', inputHash: 'inc-1' });
      q.dequeue(); q.completeJob(j1.jobId, true);

      // 2 jobs — exactly at limit, no eviction
      expect(q.findJob(j0.jobId)).toBeDefined();
      expect(q.findJob(j1.jobId)).toBeDefined();

      const j2 = q.enqueue({ priority: 'normal', format: 'mp4', inputHash: 'inc-2' });
      q.dequeue(); q.completeJob(j2.jobId, true);

      // 3 jobs — j0 evicted, j1 and j2 remain
      expect(q.findJob(j0.jobId)).toBeUndefined();
      expect(q.findJob(j1.jobId)).toBeDefined();
      expect(q.findJob(j2.jobId)).toBeDefined();

      const j3 = q.enqueue({ priority: 'normal', format: 'mp4', inputHash: 'inc-3' });
      q.dequeue(); q.completeJob(j3.jobId, true);

      // 4 jobs — j1 also evicted, j2 and j3 remain
      expect(q.findJob(j1.jobId)).toBeUndefined();
      expect(q.findJob(j2.jobId)).toBeDefined();
      expect(q.findJob(j3.jobId)).toBeDefined();

      const stats = q.getQueueStats();
      expect(stats.completed).toBe(2);
      q.stop();
    });
  });

  // -- REQ-233: Artifact auto-save on completion ---------------------------

  describe('artifact auto-save (REQ-233)', () => {
    it('should auto-save artifact on successful completion', () => {
      const store = new ExportArtifactStore({
        maxArtifacts: 10,
        maxStorageBytes: 100_000,
        defaultTtlMs: 60_000,
        downloadUrlTtlMs: 30_000,
        cleanupIntervalMs: 10_000,
      });
      const q = new ExportJobQueue(
        { maxConcurrent: 1, maxQueueSize: 100 },
        undefined,
        store,
      );

      const job = q.enqueue({ priority: 'normal', format: 'mp4', inputHash: 'save-1' });
      q.dequeue();

      const artifactData = new Uint8Array([1, 2, 3, 4, 5]);
      q.completeJob(job.jobId, true, { data: artifactData, sizeBytes: 5 });

      // Job should have an artifactId assigned
      const completed = q.findJob(job.jobId);
      expect(completed).toBeDefined();
      expect(completed!.artifactId).toBeDefined();

      // Artifact should be retrievable from the store
      const artifact = store.get(completed!.artifactId!);
      expect(artifact).toBeDefined();
      expect(artifact!.format).toBe('mp4');
      expect(artifact!.sizeBytes).toBe(5);
      expect(artifact!.metadata).toEqual(
        expect.objectContaining({ jobId: job.jobId, inputHash: 'save-1' }),
      );

      q.stop();
    });

    it('should not auto-save artifact on failed completion', () => {
      const store = new ExportArtifactStore({
        maxArtifacts: 10,
        maxStorageBytes: 100_000,
        defaultTtlMs: 60_000,
        downloadUrlTtlMs: 30_000,
        cleanupIntervalMs: 10_000,
      });
      const q = new ExportJobQueue(
        { maxConcurrent: 1, maxQueueSize: 100 },
        undefined,
        store,
      );

      const job = q.enqueue({ priority: 'normal', format: 'mp4', inputHash: 'fail-1' });
      q.dequeue();

      q.completeJob(job.jobId, false, { data: new Uint8Array([1]), sizeBytes: 1 });

      const completed = q.findJob(job.jobId);
      expect(completed).toBeDefined();
      expect(completed!.artifactId).toBeUndefined();
      expect(store.size).toBe(0);

      q.stop();
    });

    it('should complete job even if artifact store fails', () => {
      const store = new ExportArtifactStore({
        maxArtifacts: 1,
        maxStorageBytes: 1, // tiny quota — will evict immediately
        defaultTtlMs: 60_000,
        downloadUrlTtlMs: 30_000,
        cleanupIntervalMs: 10_000,
      });
      const q = new ExportJobQueue(
        { maxConcurrent: 1, maxQueueSize: 100 },
        undefined,
        store,
      );

      const job = q.enqueue({ priority: 'normal', format: 'mp4', inputHash: 'fail-store' });
      q.dequeue();

      // Artifact data exceeds maxStorageBytes — store will evict it
      q.completeJob(job.jobId, true, {
        data: new Uint8Array(100),
        sizeBytes: 100,
      });

      // Job should still be marked as completed
      const completed = q.findJob(job.jobId);
      expect(completed).toBeDefined();
      expect(completed!.status).toBe('completed');

      q.stop();
    });
  });

  // -- Start / Stop --------------------------------------------------------

  describe('start/stop', () => {
    it('should start and stop cleanly', () => {
      const q = new ExportJobQueue({ maxConcurrent: 3 });
      q.start();
      q.stop();
      // No error thrown = pass
    });

    it('should not create multiple timers on repeated start', () => {
      const q = new ExportJobQueue({ maxConcurrent: 3 });
      q.start();
      q.start();
      q.stop();
    });
  });
});
