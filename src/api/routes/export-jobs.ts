/**
 * REQ-241~243: Export Job Routes (Phase 104)
 *
 * REST endpoints for managing export batch jobs:
 * - POST   /api/v1/export/jobs           — Submit a new export job
 * - GET    /api/v1/export/jobs/:jobId     — Get job status
 * - DELETE /api/v1/export/jobs/:jobId     — Cancel a job
 * - GET    /api/v1/export/jobs/dead-letter — List dead-lettered jobs
 * - POST   /api/v1/export/jobs/:jobId/replay — Replay a dead-lettered job
 * - DELETE /api/v1/export/jobs/dead-letter  — Purge all dead-lettered jobs
 */

import { Router, Request, Response } from 'express';
import { ExportJobQueue, type JobPriority } from '../../export/export-job-queue';
import { logger } from '@stv/core/utils/logger';
import { roundTo } from '@stv/core/lib/metrics-utils';
import { UUID_V4_RE } from '../uuid-validation';

const VALID_PRIORITIES: JobPriority[] = ['high', 'normal', 'low'];

// Allowed export formats (mirrors FORMAT_MIME in export.ts)
const VALID_EXPORT_FORMATS = new Set([
  'mp4', 'webm', 'gif', 'apng',
  'interactive-html', 'pdf-animated', 'svg-animated', 'json-lottie',
  'json', 'svg', 'pdf', 'html',
]);

const MAX_INPUT_HASH_LENGTH = 256;

export function createExportJobRouter(jobQueue: ExportJobQueue): Router {
  const router = Router();

  // -- GET /jobs/health: Queue health for readiness probes ------------------

  router.get('/jobs/health', (_req: Request, res: Response) => {
    const stats = jobQueue.getQueueStats();
    const maxQueueSize = jobQueue.getMaxQueueSize();
    const queueUtilization = maxQueueSize > 0 ? stats.queued / maxQueueSize : 0;
    const concurrencyUtilization = stats.maxConcurrent > 0 ? stats.running / stats.maxConcurrent : 0;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (queueUtilization > 0.8) {
      status = 'unhealthy';
    } else if (queueUtilization > 0.5 || concurrencyUtilization >= 1) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    res.status(status === 'unhealthy' ? 503 : 200).json({
      success: status !== 'unhealthy',
      data: {
        status,
        queueDepth: stats.queued,
        maxQueueSize,
        queueUtilization: roundTo(queueUtilization, 2),
        running: stats.running,
        maxConcurrent: stats.maxConcurrent,
        concurrencyUtilization: roundTo(concurrencyUtilization, 2),
        availableSlots: jobQueue.getAvailableSlots(),
      },
    });
  });

  // -- GET /jobs: Queue stats and active jobs -----------------------------

  router.get('/jobs', (_req: Request, res: Response) => {
    const stats = jobQueue.getQueueStats();
    const activeJobs = jobQueue.listActiveJobs();

    res.json({
      success: true,
      data: {
        stats,
        activeJobs,
      },
    });
  });

  // ---------------------------------------------------------------------------
  // Dead-letter routes MUST be registered before /:jobId to avoid route
  // shadowing (Express matches /jobs/dead-letter against /jobs/:jobId first).
  // ---------------------------------------------------------------------------

  // -- GET /jobs/dead-letter: List dead-lettered jobs ---------------------

  router.get('/jobs/dead-letter', (_req: Request, res: Response) => {
    const dlqJobs = jobQueue.listDeadLetterJobs();

    res.json({
      success: true,
      data: {
        count: dlqJobs.length,
        jobs: dlqJobs.map((j) => ({
          jobId: j.jobId,
          priority: j.priority,
          status: j.status,
          format: j.format,
          enqueuedAt: j.enqueuedAt,
          deadLetteredAt: j.deadLetteredAt ?? null,
          retryCount: j.retryCount ?? 0,
          lastError: j.lastError ?? null,
        })),
      },
    });
  });

  // -- DELETE /jobs/dead-letter: Purge all dead-lettered jobs -------------

  router.delete('/jobs/dead-letter', (_req: Request, res: Response) => {
    const purged = jobQueue.purgeDeadLetterJobs();

    logger.info(`[ExportJobRouter] Purged ${purged} dead-lettered jobs`);

    res.json({
      success: true,
      data: { purged },
    });
  });

  // -- REQ-241: Submit export job -----------------------------------------

  router.post('/jobs', (req: Request, res: Response) => {
    const { format, priority, inputHash } = req.body;

    if (!format || typeof format !== 'string' || format.trim() === '') {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Missing or invalid "format" field' },
      });
      return;
    }

    if (!VALID_EXPORT_FORMATS.has(format)) {
      res.status(400).json({
        success: false,
        error: { code: 'UNSUPPORTED_FORMAT', message: `Unsupported export format: ${format}. Allowed: ${[...VALID_EXPORT_FORMATS].join(', ')}` },
      });
      return;
    }

    if (!inputHash || typeof inputHash !== 'string' || inputHash.trim() === '') {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Missing or invalid "inputHash" field' },
      });
      return;
    }

    if (inputHash.length > MAX_INPUT_HASH_LENGTH) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: `"inputHash" must be ${MAX_INPUT_HASH_LENGTH} characters or less` },
      });
      return;
    }

    const resolvedPriority: JobPriority = VALID_PRIORITIES.includes(priority)
      ? (priority as JobPriority)
      : 'normal';

    try {
      const job = jobQueue.enqueue({
        priority: resolvedPriority,
        format,
        inputHash,
      });

      const queuePosition = jobQueue.getQueuePosition(job.jobId);
      const eta = jobQueue.getEstimatedWaitTime(job.jobId);

      logger.info(`[ExportJobRouter] Enqueued job ${job.jobId} (priority=${job.priority}, format=${format})`);

      res.status(201).json({
        success: true,
        data: {
          jobId: job.jobId,
          status: job.status,
          priority: job.priority,
          format: job.format,
          queuePosition: queuePosition ?? null,
          estimatedWaitTimeMs: eta,
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error('[export-jobs] Create job error:', err);
      if (message.includes('queue is full')) {
        res.status(503).json({
          success: false,
          error: { code: 'QUEUE_FULL', message: 'Export job queue is full. Try again later.' },
        });
        return;
      }
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message },
      });
    }
  });

  // -- REQ-242: Get job status --------------------------------------------

  router.get('/jobs/:jobId', (req: Request, res: Response) => {
    const jobId = req.params.jobId as string;

    if (!jobId || !UUID_V4_RE.test(jobId)) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid jobId format (expected UUID v4)' },
      });
      return;
    }

    const job = jobQueue.findJob(jobId);
    if (!job) {
      res.status(404).json({
        success: false,
        error: { code: 'JOB_NOT_FOUND', message: 'Export job not found' },
      });
      return;
    }

    const queuePosition = jobQueue.getQueuePosition(job.jobId);
    const eta = jobQueue.getEstimatedWaitTime(job.jobId);

    res.json({
      success: true,
      data: {
        jobId: job.jobId,
        status: job.status,
        priority: job.priority,
        format: job.format,
        enqueuedAt: job.enqueuedAt,
        startedAt: job.startedAt ?? null,
        completedAt: job.completedAt ?? null,
        artifactId: job.artifactId ?? null,
        queuePosition: queuePosition ?? null,
        estimatedWaitTimeMs: job.status === 'queued' ? eta : 0,
      },
    });
  });

  // -- REQ-243: Cancel job ------------------------------------------------

  router.delete('/jobs/:jobId', (req: Request, res: Response) => {
    const jobId = req.params.jobId as string;

    if (!jobId || !UUID_V4_RE.test(jobId)) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid jobId format (expected UUID v4)' },
      });
      return;
    }

    const job = jobQueue.findJob(jobId);
    if (!job) {
      res.status(404).json({
        success: false,
        error: { code: 'JOB_NOT_FOUND', message: 'Export job not found' },
      });
      return;
    }

    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled' || job.status === 'dead-lettered') {
      res.status(409).json({
        success: false,
        error: { code: 'JOB_ALREADY_TERMINATED', message: `Job is already in terminal state: ${job.status}` },
      });
      return;
    }

    const cancelled = jobQueue.cancel(jobId);
    if (!cancelled) {
      res.status(500).json({
        success: false,
        error: { code: 'CANCEL_FAILED', message: 'Failed to cancel job' },
      });
      return;
    }

    logger.info(`[ExportJobRouter] Cancelled job ${jobId}`);

    res.json({
      success: true,
      data: { jobId, cancelled: true },
    });
  });

  // -- POST /jobs/:jobId/replay: Replay a dead-lettered job ---------------

  router.post('/jobs/:jobId/replay', (req: Request, res: Response) => {
    const jobId = req.params.jobId as string;

    if (!jobId || !UUID_V4_RE.test(jobId)) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid jobId format (expected UUID v4)' },
      });
      return;
    }

    const dlqJob = jobQueue.findJob(jobId);
    if (!dlqJob || dlqJob.status !== 'dead-lettered') {
      res.status(404).json({
        success: false,
        error: { code: 'JOB_NOT_IN_DLQ', message: 'Job not found in dead letter queue' },
      });
      return;
    }

    try {
      const replayedJob = jobQueue.replayDeadLetterJob(jobId);
      if (!replayedJob) {
        res.status(500).json({
          success: false,
          error: { code: 'REPLAY_FAILED', message: 'Failed to replay job' },
        });
        return;
      }

      const queuePosition = jobQueue.getQueuePosition(replayedJob.jobId);
      const eta = jobQueue.getEstimatedWaitTime(replayedJob.jobId);

      logger.info(`[ExportJobRouter] Replayed DLQ job ${jobId} as ${replayedJob.jobId}`);

      res.status(201).json({
        success: true,
        data: {
          originalJobId: jobId,
          newJobId: replayedJob.jobId,
          status: replayedJob.status,
          priority: replayedJob.priority,
          format: replayedJob.format,
          queuePosition: queuePosition ?? null,
          estimatedWaitTimeMs: eta,
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error('[export-jobs] Replay job error:', err);
      res.status(500).json({
        success: false,
        error: { code: 'REPLAY_FAILED', message },
      });
    }
  });

  return router;
}
