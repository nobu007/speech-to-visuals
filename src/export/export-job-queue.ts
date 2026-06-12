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
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type JobPriority = 'high' | 'normal' | 'low';

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface QueuedExportJob {
  jobId: string;
  priority: JobPriority;
  enqueuedAt: number;
  startedAt?: number;
  completedAt?: number;
  status: JobStatus;
  format: string;
  inputHash: string;
}

export interface ExportJobQueueOptions {
  maxConcurrent: number;
  maxQueueSize: number;
  starvationPreventionInterval: number;
}

export interface QueueStats {
  queued: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
  maxConcurrent: number;
}

export interface QueueMetricsSink {
  recordQueueSize(size: number): void;
  recordQueueWaitTimeMs(waitMs: number): void;
  recordQueueDequeue(priority: JobPriority): void;
  recordQueuePriorityDistribution(high: number, normal: number, low: number): void;
}

const DEFAULT_OPTIONS: ExportJobQueueOptions = {
  maxConcurrent: EXPORT_QUEUE_LIMITS.MAX_CONCURRENT,
  maxQueueSize: EXPORT_QUEUE_LIMITS.MAX_QUEUE_SIZE,
  starvationPreventionInterval: EXPORT_QUEUE_LIMITS.STARVATION_PREVENTION_INTERVAL_MS,
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
  private readonly options: ExportJobQueueOptions;
  private readonly metrics?: QueueMetricsSink;
  private starvationTimer?: ReturnType<typeof setInterval>;
  private started = false;

  // Track average job duration for ETA estimation
  private recentDurations: number[] = [];
  private static readonly MAX_RECENT_DURATIONS = 50;

  constructor(options?: Partial<ExportJobQueueOptions>, metrics?: QueueMetricsSink) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.metrics = metrics;
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

    // Insert in priority order (binary search for insertion point)
    let lo = 0;
    let hi = this.queue.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (comparePriority(this.queue[mid], job) < 0) {
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
   */
  completeJob(jobId: string, success: boolean): boolean {
    const job = this.running.get(jobId);
    if (!job) return false;

    job.status = success ? 'completed' : 'failed';
    job.completedAt = Date.now();

    const duration = job.completedAt - (job.startedAt ?? job.enqueuedAt);
    this.recentDurations.push(duration);
    if (this.recentDurations.length > ExportJobQueue.MAX_RECENT_DURATIONS) {
      this.recentDurations.shift();
    }

    if (success) {
      this.metrics?.recordQueueWaitTimeMs(job.startedAt! - job.enqueuedAt);
    }

    this.running.delete(jobId);
    this.completed.push(job);

    this.emitMetrics();
    logger.info(`[ExportJobQueue] Job ${jobId} completed (success=${success})`);
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
    // Jobs ahead that won't start immediately due to no available slots
    const availableSlots = Math.max(0, this.options.maxConcurrent - this.running.size);
    const effectiveAhead = Math.max(0, position - availableSlots);
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
      else if (job.status === 'failed') failed++;
      else if (job.status === 'cancelled') cancelled++;
    }

    return {
      queued: this.queue.length,
      running: this.running.size,
      completed,
      failed,
      cancelled,
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
   * Check if the queue can accept more running jobs.
   */
  hasCapacity(): boolean {
    return this.running.size < this.options.maxConcurrent;
  }

  /**
   * Start the starvation prevention timer.
   */
  start(): void {
    if (this.started) return;
    this.started = true;

    this.starvationTimer = setInterval(
      () => this.preventStarvation(),
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
        if (comparePriority(this.queue[mid], lowJob) < 0) {
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
