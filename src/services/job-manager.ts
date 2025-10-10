/**
 * Job Management Service
 * AutoDiagram Video Generator - Iteration 67 Phase A1
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { JobStatus, TranscriptionResult, DiagramResult, VideoResult } from '../types/api';

/**
 * Job Manager - handles job lifecycle and status tracking
 */
export class JobManager extends EventEmitter {
  private jobs: Map<string, JobStatus> = new Map();

  /**
   * Create a new job
   */
  createJob(
    userId: string,
    type: 'transcription' | 'diagram' | 'video'
  ): JobStatus {
    const jobId = uuidv4();
    const job: JobStatus = {
      jobId,
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.jobs.set(jobId, job);

    // Emit job created event
    this.emit('job:created', { jobId, userId, type });

    return job;
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): JobStatus | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Update job status
   */
  updateJob(jobId: string, updates: Partial<JobStatus>): JobStatus | undefined {
    const job = this.jobs.get(jobId);

    if (!job) {
      return undefined;
    }

    Object.assign(job, updates, { updatedAt: new Date() });

    // Emit job updated event
    this.emit('job:updated', job);

    return job;
  }

  /**
   * Update job progress
   */
  updateProgress(
    jobId: string,
    progress: number,
    stage?: JobStatus['stage'],
    currentOperation?: string,
    estimatedTimeRemaining?: number
  ): JobStatus | undefined {
    return this.updateJob(jobId, {
      status: 'processing',
      progress: Math.min(100, Math.max(0, progress)),
      stage,
      currentOperation,
      estimatedTimeRemaining,
    });
  }

  /**
   * Mark job as completed
   */
  completeJob(
    jobId: string,
    result: TranscriptionResult | DiagramResult | VideoResult
  ): JobStatus | undefined {
    const job = this.updateJob(jobId, {
      status: 'completed',
      progress: 100,
      result,
    });

    if (job) {
      this.emit('job:completed', job);
    }

    return job;
  }

  /**
   * Mark job as failed
   */
  failJob(jobId: string, error: { code: string; message: string; details?: any }): JobStatus | undefined {
    const job = this.updateJob(jobId, {
      status: 'failed',
      error,
    });

    if (job) {
      this.emit('job:failed', job);
    }

    return job;
  }

  /**
   * Cancel a job
   */
  cancelJob(jobId: string): JobStatus | undefined {
    const job = this.jobs.get(jobId);

    if (!job || job.status === 'completed') {
      return undefined;
    }

    this.updateJob(jobId, {
      status: 'failed',
      error: {
        code: 'JOB_CANCELLED',
        message: 'Job was cancelled by user',
      },
    });

    this.emit('job:cancelled', job);

    return job;
  }

  /**
   * Get all jobs for a user
   */
  getUserJobs(userId: string): JobStatus[] {
    // In production, this would query from database with userId filter
    return Array.from(this.jobs.values());
  }

  /**
   * Clean up old completed jobs (older than 24 hours)
   */
  cleanupOldJobs(): number {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    let cleaned = 0;

    for (const [jobId, job] of this.jobs.entries()) {
      if (
        (job.status === 'completed' || job.status === 'failed') &&
        job.updatedAt < twentyFourHoursAgo
      ) {
        this.jobs.delete(jobId);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get job statistics
   */
  getStatistics(): {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  } {
    const stats = {
      total: this.jobs.size,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    };

    for (const job of this.jobs.values()) {
      stats[job.status]++;
    }

    return stats;
  }
}

// Singleton instance
export const jobManager = new JobManager();

// Auto-cleanup every hour
setInterval(() => {
  const cleaned = jobManager.cleanupOldJobs();
  if (cleaned > 0) {
    console.log(`[JobManager] Cleaned up ${cleaned} old jobs`);
  }
}, 60 * 60 * 1000);
