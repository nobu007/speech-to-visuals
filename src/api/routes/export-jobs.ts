/**
 * REQ-241~243: Export Job Routes (Phase 104)
 *
 * REST endpoints for managing export batch jobs:
 * - POST   /api/v1/export/jobs           — Submit a new export job
 * - GET    /api/v1/export/jobs/:jobId     — Get job status
 * - DELETE /api/v1/export/jobs/:jobId     — Cancel a job
 */

import { Router, Request, Response } from 'express';
import { ExportJobQueue, type JobPriority } from '../../export/export-job-queue';
import { logger } from '../../utils/logger';

// UUID v4 validation regex
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

  // -- REQ-241: Submit export job -----------------------------------------

  router.post('/jobs', (req: Request, res: Response) => {
    const { format, priority, inputHash } = req.body;

    if (!format || typeof format !== 'string') {
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

    if (!inputHash || typeof inputHash !== 'string') {
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
    const { jobId } = req.params;

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
    const { jobId } = req.params;

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

    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
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

  return router;
}
