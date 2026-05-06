/**
 * TASK-0046: Batch Processing Routes
 *
 * REST endpoints for batch job management:
 * - POST   /api/v1/batch/jobs             - Create a batch job (returns 202)
 * - GET    /api/v1/batch/jobs/:jobId       - Get job status/progress (returns 200)
 * - POST   /api/v1/batch/jobs/:jobId/cancel - Cancel a job (returns 200)
 *
 * Features:
 * - UUID v4 job IDs
 * - Max 3 concurrent jobs (semaphore pattern)
 * - 4th+ jobs queued, start when running jobs complete
 * - Progress tracking per stage
 * - Proper error codes: VALIDATION_ERROR, TOO_MANY_FILES, JOB_NOT_FOUND, JOB_ALREADY_COMPLETED
 */

import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

// UUID v4 validation regex (ISS-010)
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Allowed preset values (ISS-027)
const VALID_PRESETS = new Set(['fast', 'balanced', 'quality', 'custom']);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type JobState = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface JobProgress {
  total: number;
  completed: number;
  failed: number;
  percentage: number;
}

export interface BatchJobStatus {
  jobId: string;
  status: JobState;
  progress: JobProgress;
  startedAt?: string;
  completedAt?: string;
  estimatedTimeRemaining?: number;
  currentFile?: string;
  preset?: string;
  options?: Record<string, unknown>;
}

interface InternalJob {
  status: BatchJobStatus;
  cancelToken: { cancelled: boolean };
}

interface CreateJobBody {
  files: Array<{ name: string; path: string }>;
  preset?: string;
  options?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// BatchJobManager - In-memory job store with concurrency control
// ---------------------------------------------------------------------------

const MAX_CONCURRENT_JOBS = 3;
const MAX_STORED_JOBS = 200; // ISS-005: prevent unbounded memory growth

export class BatchJobManager {
  public jobs = new Map<string, InternalJob>();

  /**
   * Prune completed/failed/cancelled jobs when store exceeds MAX_STORED_JOBS (ISS-005)
   */
  private pruneOldJobs(): void {
    if (this.jobs.size <= MAX_STORED_JOBS) return;
    const terminalStates: JobState[] = ['completed', 'failed', 'cancelled'];
    for (const [id, job] of this.jobs) {
      if (terminalStates.includes(job.status.status)) {
        this.jobs.delete(id);
        if (this.jobs.size <= MAX_STORED_JOBS) return;
      }
    }
  }

  /**
   * Create a new batch job. Returns the UUID v4 jobId.
   */
  createJob(files: Array<{ name: string; path: string }>, preset?: string, options?: Record<string, unknown>): string {
    this.pruneOldJobs();
    const jobId = uuidv4();

    this.jobs.set(jobId, {
      status: {
        jobId,
        status: 'queued',
        progress: {
          total: files.length,
          completed: 0,
          failed: 0,
          percentage: 0,
        },
        ...(preset ? { preset } : {}),
        ...(options ? { options } : {}),
      },
      cancelToken: { cancelled: false },
    });

    return jobId;
  }

  /**
   * Get job status by ID. Returns null if not found.
   */
  getJobStatus(jobId: string): BatchJobStatus | null {
    return this.jobs.get(jobId)?.status ?? null;
  }

  /**
   * Get the cancel token for a job.
   */
  getCancelToken(jobId: string): { cancelled: boolean } | null {
    return this.jobs.get(jobId)?.cancelToken ?? null;
  }

  /**
   * Update job status fields.
   */
  updateJobStatus(jobId: string, update: Partial<BatchJobStatus>): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = { ...job.status, ...update };
    }
  }

  /**
   * Cancel a job. Returns true if successfully cancelled.
   * Returns 'not_found' if job doesn't exist.
   * Returns 'already_terminal' if job is already completed/failed/cancelled.
   */
  cancelJob(jobId: string): true | 'not_found' | 'already_terminal' {
    const job = this.jobs.get(jobId);
    if (!job) {
      return 'not_found';
    }

    const terminalStates: JobState[] = ['completed', 'failed', 'cancelled'];
    if (terminalStates.includes(job.status.status)) {
      return 'already_terminal';
    }

    job.cancelToken.cancelled = true;
    job.status.status = 'cancelled';
    job.status.completedAt = new Date().toISOString();
    return true;
  }

  /**
   * Get the number of currently processing jobs.
   */
  getRunningCount(): number {
    let count = 0;
    for (const job of this.jobs.values()) {
      if (job.status.status === 'processing') {
        count++;
      }
    }
    return count;
  }

  /**
   * Get the number of queued jobs.
   */
  getQueuedCount(): number {
    let count = 0;
    for (const job of this.jobs.values()) {
      if (job.status.status === 'queued') {
        count++;
      }
    }
    return count;
  }

  /**
   * Start the next queued job if concurrency slot is available.
   * Returns the jobId of the started job, or null if none started.
   */
  startNextQueuedJob(): string | null {
    if (this.getRunningCount() >= MAX_CONCURRENT_JOBS) {
      return null;
    }

    for (const [jobId, job] of this.jobs) {
      if (job.status.status === 'queued') {
        job.status.status = 'processing';
        job.status.startedAt = new Date().toISOString();
        return jobId;
      }
    }

    return null;
  }
}

// ---------------------------------------------------------------------------
// Custom application errors for batch API
// ---------------------------------------------------------------------------

export class BatchValidationError extends Error {
  public readonly statusCode = 400;
  public readonly code = 'VALIDATION_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'BatchValidationError';
  }
}

export class TooManyFilesError extends Error {
  public readonly statusCode = 429;
  public readonly code = 'TOO_MANY_FILES';
  constructor(message: string = 'Too many files. Maximum 100 files per batch.') {
    super(message);
    this.name = 'TooManyFilesError';
  }
}

export class JobNotFoundError extends Error {
  public readonly statusCode = 404;
  public readonly code = 'JOB_NOT_FOUND';
  constructor(jobId: string) {
    super(`Job not found: ${jobId}`);
    this.name = 'JobNotFoundError';
  }
}

export class JobAlreadyCompletedError extends Error {
  public readonly statusCode = 409;
  public readonly code = 'JOB_ALREADY_COMPLETED';
  constructor(jobId: string) {
    super(`Job ${jobId} is already completed and cannot be cancelled`);
    this.name = 'JobAlreadyCompletedError';
  }
}

// ---------------------------------------------------------------------------
// Error handler middleware (specific to batch routes)
// ---------------------------------------------------------------------------

function sendBatchError(res: Response, statusCode: number, code: string, message: string): void {
  res.status(statusCode).json({
    success: false,
    error: { code, message },
  });
}

// ---------------------------------------------------------------------------
// Route factory
// ---------------------------------------------------------------------------

export function createBatchRouter(jobManager?: BatchJobManager): Router {
  const router = Router();
  const manager = jobManager ?? new BatchJobManager();

  // POST /api/v1/batch/jobs - Create batch job
  router.post('/jobs', (req: Request, res: Response) => {
    const body = req.body as CreateJobBody;

    // Validate files field presence and type
    if (!body.files || !Array.isArray(body.files)) {
      return sendBatchError(res, 400, 'VALIDATION_ERROR', 'files must be a non-empty array');
    }

    if (body.files.length === 0) {
      return sendBatchError(res, 400, 'VALIDATION_ERROR', 'No files provided');
    }

    // Validate file count limit
    if (body.files.length > 100) {
      return sendBatchError(res, 429, 'TOO_MANY_FILES', 'Too many files. Maximum 100 files per batch.');
    }

    // Validate individual file object shape (ISS-004)
    for (let i = 0; i < body.files.length; i++) {
      const file = body.files[i];
      if (!file || typeof file !== 'object' || !file.name || typeof file.name !== 'string') {
        return sendBatchError(res, 400, 'VALIDATION_ERROR', `Invalid file object at index ${i}: must have a string 'name' property`);
      }
    }

    // Validate preset value (ISS-027)
    if (body.preset !== undefined && !VALID_PRESETS.has(body.preset)) {
      return sendBatchError(res, 400, 'VALIDATION_ERROR', `Invalid preset: must be one of fast, balanced, quality, custom`);
    }

    const jobId = manager.createJob(body.files, body.preset, body.options);
    const status = manager.getJobStatus(jobId)!;

    return res.status(202).json({
      success: true,
      data: {
        jobId: status.jobId,
        status: status.status,
        progress: status.progress,
      },
    });
  });

  // GET /api/v1/batch/jobs/:jobId - Get job status
  router.get('/jobs/:jobId', (req: Request, res: Response) => {
    const jobId = req.params.jobId as string;

    // ISS-010: Validate jobId is a valid UUID v4 before use
    if (!UUID_V4_RE.test(jobId)) {
      return sendBatchError(res, 400, 'VALIDATION_ERROR', 'jobId must be a valid UUID v4');
    }

    const status = manager.getJobStatus(jobId);
    if (!status) {
      return sendBatchError(res, 404, 'JOB_NOT_FOUND', `Job not found: ${jobId}`);
    }

    return res.status(200).json({
      success: true,
      data: status,
    });
  });

  // POST /api/v1/batch/jobs/:jobId/cancel - Cancel job
  router.post('/jobs/:jobId/cancel', (req: Request, res: Response) => {
    const jobId = req.params.jobId as string;

    // ISS-010: Validate jobId is a valid UUID v4 before use
    if (!UUID_V4_RE.test(jobId)) {
      return sendBatchError(res, 400, 'VALIDATION_ERROR', 'jobId must be a valid UUID v4');
    }

    const result = manager.cancelJob(jobId);

    if (result === 'not_found') {
      return sendBatchError(res, 404, 'JOB_NOT_FOUND', `Job not found: ${jobId}`);
    }

    if (result === 'already_terminal') {
      return sendBatchError(res, 409, 'JOB_ALREADY_COMPLETED', `Job ${jobId} is already completed and cannot be cancelled`);
    }

    const status = manager.getJobStatus(jobId)!;
    return res.status(200).json({
      success: true,
      data: {
        jobId: status.jobId,
        status: status.status,
        message: `Job ${jobId} cancelled successfully`,
      },
    });
  });

  return router;
}
