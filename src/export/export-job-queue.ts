/**
 * REQ-229: Export Job Queue Service (Phase 99)
 *
 * Priority-based job queue for export operations.
 * Supports high/normal/low priority scheduling, concurrency
 * control via semaphore pattern, queue position tracking with
 * ETA estimation, and fair scheduling to prevent low-priority
 * job starvation.
 *
 * Integrates with ExportMetricsCollector for queue_* metrics.
 */

import { randomUUID } from 'crypto';
import { EXPORT_QUEUE_LIMITS } from '@/config/limits';
import type { ExportArtifactStore } from './export-artifact-store';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type JobPriority = 'high' | 'normal' | 'low';

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'dead-lettered';

export interface QueuedExportJob {
  jobId: string;
  priority: JobPriority;
  enqueuedAt: number;
  startedAt?: number;
  completedAt?: number;
  status: JobStatus;
  format: string;
  inputHash: string;
  /** Artifact ID assigned after successful auto-save (REQ-233) */
  artifactId?: string;
  /** Number of retry attempts so far (0 = first attempt) */
  retryCount?: number;
  /** Error message from the last failure */
  lastError?: string;
  /** Timestamp when the job was moved to the dead letter queue */
  deadLetteredAt?: number;
}

export interface ExportJobQueueOptions {
  maxConcurrent: number;
  maxQueueSize: number;
  starvationPreventionInterval: number;
  maxCompletedJobs: number;
  maxRetries: number;
  retryBaseDelayMs: number;
  retryMaxDelayMs: number;
  maxDlqJobs: number;
}

export interface QueueStats {
  queued: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
  deadLettered: number;
  maxConcurrent: number;
}

export interface QueueMetricsSink {
  recordQueueSize(size: number): void;
  recordQueueWaitTimeMs(waitMs: number): void;
  recordQueueDequeue(priority: JobPriority): void;
  recordQueuePriorityDistribution(high: number, normal: number, low: number): void;
  recordDlqSize(size: number): void;
  recordRetry(): void;
  recordDeadLetter(): void;
  recordReplay(): void;
}

const DEFAULT_OPTIONS: ExportJobQueueOptions = {
  maxConcurrent: EXPORT_QUEUE_LIMITS.MAX_CONCURRENT,
  maxQueueSize: EXPORT_QUEUE_LIMITS.MAX_QUEUE_SIZE,
  starvationPreventionInterval: EXPORT_QUEUE_LIMITS.STARVATION_PREVENTION_INTERVAL_MS,
  maxCompletedJobs: EXPORT_QUEUE_LIMITS.MAX_COMPLETED_JOBS,
  maxRetries: EXPORT_QUEUE_LIMITS.MAX_RETRIES,
  retryBaseDelayMs: EXPORT_QUEUE_LIMITS.RETRY_BASE_DELAY_MS,
  retryMaxDelayMs: EXPORT_QUEUE_LIMITS.RETRY_MAX_DELAY_MS,
  maxDlqJobs: EXPORT_QUEUE_LIMITS.MAX_DLQ_JOBS,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PRIORITY_ORDER: Record<JobPriority, number> = {
  high: 0,
  normal: 1,
  low: 2,
};

function comparePriority(a: QueuedExportJob, b: QueuedExportJob): number {
  const diff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  if (diff !== 0) return diff;
  // FIFO within same priority
  return a.enqueuedAt - b.enqueuedAt;
}

// ---------------------------------------------------------------------------
// ExportJobQueue
// ---------------------------------------------------------------------------

export class ExportJobQueue {
  private queue: QueuedExportJob[] = [];
  private running = new Map<string, QueuedExportJob>();
  private completed: QueuedExportJob[] = [];
  private deadLetterQueue: QueuedExportJob[] = [];
  private readonly options: ExportJobQueueOptions;
  private readonly metrics?: QueueMetricsSink;
  private readonly artifactStore?: ExportArtifactStore;
  private starvationTimer?: ReturnType<typeof setInterval>;
  private started = false;

  // Track average job duration for ETA estimation
  private recentDurations: number[] = [];
  private static readonly MAX_RECENT_DURATIONS = 50;

  constructor(
    options?: Partial<ExportJobQueueOptions>,
    metrics?: QueueMetricsSink,
    artifactStore?: ExportArtifactStore,
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.metrics = metrics;
    this.artifactStore = artifactStore;
  }

  // -- Public API ----------------------------------------------------------

  /**
   * Enqueue a new export job.
   * Returns the created job or throws if the queue is full.
   */
  enqueue(
    input: Omit<QueuedExportJob, 'jobId' | 'enqueuedAt' | 'status'>,
  ): QueuedExportJob {
    if (this.queue.length >= this.options.maxQueueSize) {
      throw new Error(
        `Export queue is full (${this.options.maxQueueSize} jobs)`,
      );
    }

    const job: QueuedExportJob = {
      ...input,
      jobId: randomUUID(),
      enqueuedAt: Date.now(),
      status: 'queued',
    };

    // Insert in priority order (binary search for insertion point, FIFO for ties)
    let lo = 0;
    let hi = this.queue.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (comparePriority(this.queue[mid], job) <= 0) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    this.queue.splice(lo, 0, job);

    this.emitMetrics();
    logger.info(`[ExportJobQueue] Enqueued job ${job.jobId} (priority=${job.priority}, queueSize=${this.queue.length})`);
    return job;
  }

  /**
   * Dequeue the highest-priority job and mark it as running.
   * Returns undefined if the queue is empty.
   */
  dequeue(): QueuedExportJob | undefined {
    const job = this.queue.shift();
    if (!job) return undefined;

    job.status = 'running';
    job.startedAt = Date.now();
    this.running.set(job.jobId, job);

    this.metrics?.recordQueueDequeue(job.priority);
    this.emitMetrics();
    logger.info(`[ExportJobQueue] Dequeued job ${job.jobId} (priority=${job.priority})`);
    return job;
  }

  /**
   * Mark a running job as completed and remove it from the active set.
   * On failure, attempts retry with exponential backoff if retries remain.
   * Jobs that exhaust retries are moved to the dead letter queue.
   * REQ-233: Auto-save artifact to ExportArtifactStore on successful completion.
   */
  completeJob(
    jobId: string,
    success: boolean,
    artifactData?: { data: Uint8Array; sizeBytes: number },
    errorMessage?: string,
  ): boolean {
    const job = this.running.get(jobId);
    if (!job) return false;

    const duration = Date.now() - (job.startedAt ?? job.enqueuedAt);
    this.recentDurations.push(duration);
    if (this.recentDurations.length > ExportJobQueue.MAX_RECENT_DURATIONS) {
      this.recentDurations.shift();
    }

    if (success) {
      job.status = 'completed';
      job.completedAt = Date.now();
      this.metrics?.recordQueueWaitTimeMs(job.startedAt! - job.enqueuedAt);

      // REQ-233: Auto-save artifact on successful completion
      if (this.artifactStore && artifactData) {
        try {
          const stored = this.artifactStore.store({
            format: job.format,
            data: artifactData.data,
            sizeBytes: artifactData.sizeBytes,
            metadata: { jobId: job.jobId, inputHash: job.inputHash },
          });
          job.artifactId = stored.artifactId;
          logger.info(`[ExportJobQueue] Artifact auto-saved for job ${jobId}: ${stored.artifactId}`);
        } catch (storeError) {
          logger.warn(
            `[ExportJobQueue] Artifact auto-save failed for job ${jobId} (non-blocking):`,
            storeError instanceof Error ? storeError.message : String(storeError),
          );
        }
      }

      this.running.delete(jobId);
      this.completed.push(job);
      this.pruneCompletedJobs();
      this.emitMetrics();
      logger.info(`[ExportJobQueue] Job ${jobId} completed`);
      return true;
    }

    // Failure path — check retry eligibility and queue capacity
    const currentRetryCount = job.retryCount ?? 0;
    const canRetry = currentRetryCount < this.options.maxRetries;
    const hasQueueCapacity = this.queue.length < this.options.maxQueueSize;

    if (canRetry && hasQueueCapacity) {
      job.retryCount = currentRetryCount + 1;
      job.lastError = errorMessage;
      job.status = 'queued';
      job.startedAt = undefined;
      job.completedAt = undefined;

      this.running.delete(jobId);
      this.requeueForRetry(job);
      this.metrics?.recordRetry();

      logger.info(
        `[ExportJobQueue] Job ${jobId} failed (attempt ${currentRetryCount + 1}), re-queued for retry ` +
        `(${job.retryCount}/${this.options.maxRetries})`,
      );
      return true;
    }

    // Retries exhausted, retries disabled, or queue at capacity — always dead-letter
    const isDeadLettered = true;
    job.status = isDeadLettered ? 'dead-lettered' : 'failed';
    job.completedAt = Date.now();
    job.lastError = errorMessage;

    this.running.delete(jobId);
    this.completed.push(job);
    this.pruneCompletedJobs();

    if (isDeadLettered) {
      job.deadLetteredAt = Date.now();
      this.deadLetterQueue.push(job);
      this.pruneDeadLetterQueue();
      this.metrics?.recordDeadLetter();
    }
    this.emitMetrics();

    if (isDeadLettered) {
      const reason = !canRetry
        ? ` after ${currentRetryCount} retries`
        : ' (queue at capacity — cannot retry)';
      logger.warn(
        `[ExportJobQueue] Job ${jobId} moved to dead letter queue` +
        reason +
        (errorMessage ? `: ${errorMessage}` : ''),
      );
    } else {
      logger.warn(
        `[ExportJobQueue] Job ${jobId} failed (no retries configured)` +
        (errorMessage ? `: ${errorMessage}` : ''),
      );
    }
    return true;
  }

  /**
   * Cancel a queued or running job.
   * Returns true if the job was found and cancelled.
   */
  cancel(jobId: string): boolean {
    // Check running jobs first
    const runningJob = this.running.get(jobId);
    if (runningJob) {
      runningJob.status = 'cancelled';
      runningJob.completedAt = Date.now();
      this.running.delete(jobId);
      this.completed.push(runningJob);
      this.pruneCompletedJobs();
      this.emitMetrics();
      logger.info(`[ExportJobQueue] Cancelled running job ${jobId}`);
      return true;
    }

    // Check queued jobs
    const idx = this.queue.findIndex((j) => j.jobId === jobId);
    if (idx !== -1) {
      const [job] = this.queue.splice(idx, 1);
      job.status = 'cancelled';
      job.completedAt = Date.now();
      this.completed.push(job);
      this.pruneCompletedJobs();
      this.emitMetrics();
      logger.info(`[ExportJobQueue] Cancelled queued job ${jobId}`);
      return true;
    }

    return false;
  }

  /**
   * Get the position of a job in the queue (0-indexed).
   * Returns undefined if the job is not queued.
   */
  getQueuePosition(jobId: string): number | undefined {
    const idx = this.queue.findIndex((j) => j.jobId === jobId);
    return idx !== -1 ? idx : undefined;
  }

  /**
   * Estimate the wait time for a job in milliseconds.
   * Based on average job duration × number of jobs ahead.
   */
  getEstimatedWaitTime(jobId: string): number {
    const position = this.getQueuePosition(jobId);
    if (position === undefined) return 0;

    const avgDuration = this.getAverageDuration();
    // Free slots that would let queued jobs start immediately.
    const availableSlots = Math.max(0, this.options.maxConcurrent - this.running.size);
    // Count the slot-freeings this job must wait for: it needs a slot itself, so
    // it is included. The first `availableSlots` queued jobs (positions
    // 0..availableSlots-1) start immediately; everyone from there on waits, and
    // this job is the (position + 1 - availableSlots)-th waiter. Without the
    // `+ 1` the queue HEAD with every slot busy computed 0 waiters → ETA 0,
    // even though it cannot start until a running job finishes.
    const effectiveAhead = Math.max(0, position + 1 - availableSlots);
    // Serial upper bound (as if one job clears per avgDuration); does not model
    // parallel slot-freeing — same coarseness as before, only the off-by-one is
    // corrected here.
    return effectiveAhead * avgDuration;
  }

  /**
   * Get current queue statistics.
   */
  getQueueStats(): QueueStats {
    let completed = 0;
    let failed = 0;
    let cancelled = 0;
    for (const job of this.completed) {
      if (job.status === 'completed') completed++;
      else if (job.status === 'failed' || job.status === 'dead-lettered') failed++;
      else if (job.status === 'cancelled') cancelled++;
    }

    return {
      queued: this.queue.length,
      running: this.running.size,
      completed,
      failed,
      cancelled,
      deadLettered: this.deadLetterQueue.length,
      maxConcurrent: this.options.maxConcurrent,
    };
  }

  /**
   * Get the number of jobs that can be dequeued right now
   * (slots available under maxConcurrent).
   */
  getAvailableSlots(): number {
    return Math.max(0, this.options.maxConcurrent - this.running.size);
  }

  /**
   * Get the maximum queue size (capacity).
   */
  getMaxQueueSize(): number {
    return this.options.maxQueueSize;
  }

  /**
   * List active (queued + running) job summaries for monitoring.
   * Returns shallow copies to prevent external mutation.
   */
  listActiveJobs(): Pick<QueuedExportJob, 'jobId' | 'priority' | 'status' | 'format' | 'enqueuedAt' | 'startedAt'>[] {
    const queued = this.queue.map((j) => ({
      jobId: j.jobId,
      priority: j.priority,
      status: j.status,
      format: j.format,
      enqueuedAt: j.enqueuedAt,
      startedAt: j.startedAt,
    }));
    const running = [...this.running.values()].map((j) => ({
      jobId: j.jobId,
      priority: j.priority,
      status: j.status,
      format: j.format,
      enqueuedAt: j.enqueuedAt,
      startedAt: j.startedAt,
    }));
    return [...running, ...queued];
  }

  /**
   * Find a job by ID across all states (queued, running, completed, dead-letter).
   * Returns the job or undefined if not found.
   */
  findJob(jobId: string): QueuedExportJob | undefined {
    const queued = this.queue.find((j) => j.jobId === jobId);
    if (queued) return queued;

    const running = this.running.get(jobId);
    if (running) return running;

    const completed = this.completed.find((j) => j.jobId === jobId);
    if (completed) return completed;

    return this.deadLetterQueue.find((j) => j.jobId === jobId);
  }

  /**
   * Check if the queue can accept more running jobs.
   */
  hasCapacity(): boolean {
    return this.running.size < this.options.maxConcurrent;
  }

  /**
   * List dead-lettered jobs (newest first).
   */
  listDeadLetterJobs(): QueuedExportJob[] {
    return [...this.deadLetterQueue].reverse();
  }

  /**
   * Replay a dead-lettered job by re-enqueuing it with a fresh retry count.
   * Returns the re-enqueued job or undefined if not found in DLQ.
   */
  replayDeadLetterJob(jobId: string): QueuedExportJob | undefined {
    const idx = this.deadLetterQueue.findIndex((j) => j.jobId === jobId);
    if (idx === -1) return undefined;

    // Enforce the same capacity invariant as enqueue() — checked BEFORE the
    // splice so that (a) a full queue can never be exceeded via replay and
    // (b) the DLQ entry is preserved when replay is rejected, leaving the job
    // recoverable for a later replay once the queue drains. The replay API
    // route already maps this throw to a 500 REPLAY_FAILED response.
    if (this.queue.length >= this.options.maxQueueSize) {
      throw new Error(
        `Export queue is full (${this.options.maxQueueSize} jobs)`,
      );
    }

    const [dlqJob] = this.deadLetterQueue.splice(idx, 1);

    // Reset retry state and re-enqueue
    const reEnqueued: QueuedExportJob = {
      ...dlqJob,
      jobId: randomUUID(),
      enqueuedAt: Date.now(),
      startedAt: undefined,
      completedAt: undefined,
      deadLetteredAt: undefined,
      status: 'queued',
      retryCount: 0,
      lastError: undefined,
      artifactId: undefined,
    };

    // Insert in priority order
    let lo = 0;
    let hi = this.queue.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (comparePriority(this.queue[mid], reEnqueued) <= 0) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    this.queue.splice(lo, 0, reEnqueued);

    this.emitMetrics();
    this.metrics?.recordReplay();
    logger.info(`[ExportJobQueue] Replayed DLQ job ${jobId} as new job ${reEnqueued.jobId}`);
    return reEnqueued;
  }

  /**
   * Purge all dead-lettered jobs. Returns the number of purged jobs.
   */
  purgeDeadLetterJobs(): number {
    const count = this.deadLetterQueue.length;
    this.deadLetterQueue = [];
    this.emitMetrics();
    logger.info(`[ExportJobQueue] Purged ${count} dead-lettered jobs`);
    return count;
  }

  /**
   * Get the retry delay for a given retry attempt using exponential backoff.
   * delay = min(baseDelay * 2^(attempt-1), maxDelay)
   */
  getRetryDelay(retryCount: number): number {
    const attempt = Math.max(1, retryCount);
    const delay = this.options.retryBaseDelayMs * Math.pow(2, attempt - 1);
    return Math.min(delay, this.options.retryMaxDelayMs);
  }

  /**
   * Start the starvation prevention timer.
   */
  start(): void {
    if (this.started) return;
    this.started = true;

    this.starvationTimer = setInterval(
      () => {
        try {
          this.preventStarvation();
        } catch (err) {
          logger.error('[ExportJobQueue] Starvation prevention tick failed:', err);
        }
      },
      this.options.starvationPreventionInterval,
    );

    // Prevent the timer from keeping the process alive
    if (this.starvationTimer.unref) {
      this.starvationTimer.unref();
    }

    logger.info('[ExportJobQueue] Started starvation prevention timer');
  }

  /**
   * Stop the starvation prevention timer.
   */
  stop(): void {
    if (this.starvationTimer) {
      clearInterval(this.starvationTimer);
      this.starvationTimer = undefined;
    }
    this.started = false;
    logger.info('[ExportJobQueue] Stopped');
  }

  // -- Internal helpers ----------------------------------------------------

  /**
   * Prune the completed jobs array when it exceeds the retention limit.
   * Removes the oldest terminal jobs to prevent unbounded memory growth.
   */
  private pruneCompletedJobs(): void {
    const max = this.options.maxCompletedJobs;
    if (this.completed.length > max) {
      const removed = this.completed.length - max;
      this.completed.splice(0, removed);
      logger.info(`[ExportJobQueue] Pruned ${removed} old terminal jobs (retention limit: ${max})`);
    }
  }

  /**
   * Prune the dead letter queue when it exceeds the retention limit.
   */
  private pruneDeadLetterQueue(): void {
    const max = this.options.maxDlqJobs;
    if (this.deadLetterQueue.length > max) {
      const removed = this.deadLetterQueue.length - max;
      this.deadLetterQueue.splice(0, removed);
      logger.info(`[ExportJobQueue] Pruned ${removed} old DLQ jobs (retention limit: ${max})`);
    }
  }

  /**
   * Re-enqueue a job for retry after failure.
   * Uses binary-search insertion to maintain priority order.
   */
  private requeueForRetry(job: QueuedExportJob): void {
    let lo = 0;
    let hi = this.queue.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (comparePriority(this.queue[mid], job) <= 0) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    this.queue.splice(lo, 0, job);
    this.emitMetrics();
  }

  /**
   * Promote the oldest low-priority job if it has been waiting
   * longer than the starvation prevention interval.
   */
  private preventStarvation(): void {
    // Find oldest low-priority job
    const lowIdx = this.queue.findIndex((j) => j.priority === 'low');
    if (lowIdx === -1) return;

    const lowJob = this.queue[lowIdx];
    const waitTime = Date.now() - lowJob.enqueuedAt;

    if (waitTime >= this.options.starvationPreventionInterval) {
      // Promote to normal priority and re-sort
      this.queue.splice(lowIdx, 1);
      lowJob.priority = 'normal';

      // Re-insert in sorted order
      let lo = 0;
      let hi = this.queue.length;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (comparePriority(this.queue[mid], lowJob) <= 0) {
          lo = mid + 1;
        } else {
          hi = mid;
        }
      }
      this.queue.splice(lo, 0, lowJob);

      this.emitMetrics();
      logger.info(
        `[ExportJobQueue] Promoted job ${lowJob.jobId} from low to normal priority (waited ${waitTime}ms)`,
      );
    }
  }

  /**
   * Get the average duration of recently completed jobs.
   */
  private getAverageDuration(): number {
    if (this.recentDurations.length === 0) {
      // Default estimate: 10 seconds
      return 10_000;
    }
    const sum = this.recentDurations.reduce((a, b) => a + b, 0);
    return sum / this.recentDurations.length;
  }

  /**
   * Emit current queue metrics to the metrics sink.
   */
  private emitMetrics(): void {
    if (!this.metrics) return;

    this.metrics.recordQueueSize(this.queue.length);
    this.metrics.recordDlqSize(this.deadLetterQueue.length);

    let high = 0;
    let normal = 0;
    let low = 0;
    for (const job of this.queue) {
      if (job.priority === 'high') high++;
      else if (job.priority === 'normal') normal++;
      else low++;
    }
    this.metrics.recordQueuePriorityDistribution(high, normal, low);
  }
}
