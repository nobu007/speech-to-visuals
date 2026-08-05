/**
 * Tests for export job API routes (REQ-241~243)
 *
 * Tests cover:
 * - Route ordering regression: dead-letter routes must not be shadowed by :jobId
 * - POST /jobs: submit export job (format/priority/inputHash validation)
 * - GET /jobs: list queue stats and active jobs
 * - GET /jobs/health: health endpoint with utilization thresholds
 * - GET /jobs/:jobId: job status lookup + UUID validation
 * - DELETE /jobs/:jobId: cancel job + terminal-state guard
 * - GET /jobs/dead-letter: list DLQ jobs
 * - DELETE /jobs/dead-letter: purge DLQ
 * - POST /jobs/:jobId/replay: replay dead-lettered job
 */

import express from 'express';
import http from 'http';
import { createExportJobRouter } from '../export-jobs';
import type { ExportJobQueue, QueuedExportJob, JobPriority, QueueStats } from '../../../export/export-job-queue';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_UUID = '00000000-0000-4000-8000-000000000001';
const VALID_UUID_2 = '00000000-0000-4000-8000-000000000002';

function makeJob(overrides: Partial<QueuedExportJob> = {}): QueuedExportJob {
  return {
    jobId: VALID_UUID,
    priority: 'normal',
    enqueuedAt: Date.now(),
    status: 'queued',
    format: 'mp4',
    inputHash: 'abc123',
    ...overrides,
  };
}

function makeStats(overrides: Partial<QueueStats> = {}): QueueStats {
  return {
    queued: 0,
    running: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    deadLettered: 0,
    maxConcurrent: 4,
    ...overrides,
  };
}

/** Minimal mock that satisfies the ExportJobQueue interface used by routes */
function mockJobQueue(overrides: Record<string, unknown> = {}): ExportJobQueue {
  const jobs = new Map<string, QueuedExportJob>();
  const dlqJobs: QueuedExportJob[] = [];
  const maxQueueSize = 100;

  const base: Record<string, unknown> = {
    getQueueStats: () => makeStats(),
    getMaxQueueSize: () => maxQueueSize,
    getAvailableSlots: () => 4,
    listActiveJobs: () => [],
    enqueue: ({ priority, format, inputHash }: { priority: JobPriority; format: string; inputHash: string }) => {
      const job = makeJob({ priority, format, inputHash, jobId: VALID_UUID });
      jobs.set(job.jobId, job);
      return job;
    },
    getQueuePosition: () => 1,
    getEstimatedWaitTime: () => 5000,
    findJob: (id: string) => jobs.get(id) ?? null,
    cancel: (id: string) => {
      const job = jobs.get(id);
      if (job) {
        job.status = 'cancelled';
        return true;
      }
      return false;
    },
    listDeadLetterJobs: () => dlqJobs,
    purgeDeadLetterJobs: () => {
      const count = dlqJobs.length;
      dlqJobs.length = 0;
      return count;
    },
    replayDeadLetterJob: (id: string) => {
      const idx = dlqJobs.findIndex(j => j.jobId === id);
      if (idx === -1) return null;
      const newJob = makeJob({ jobId: VALID_UUID_2, status: 'queued' });
      jobs.set(newJob.jobId, newJob);
      return newJob;
    },
    ...overrides,
  };

  return base as unknown as ExportJobQueue;
}

/** Create an Express app with the export job router mounted */
function createApp(queue: ExportJobQueue): express.Application {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/export', createExportJobRouter(queue));
  return app;
}

/** Promisified HTTP request helper */
function request(app: express.Application, method: string, path: string, body?: unknown): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        server.close();
        reject(new Error('Failed to get server address'));
        return;
      }
      const port = addr.port;
      const payload = body ? JSON.stringify(body) : undefined;
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path,
          method,
          headers: {
            'Content-Type': 'application/json',
            ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            server.close();
            try {
              resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) });
            } catch {
              resolve({ status: res.statusCode ?? 0, body: data });
            }
          });
        },
      );
      req.on('error', (err) => {
        server.close();
        reject(err);
      });
      if (payload) req.write(payload);
      req.end();
    });
    server.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Export Job Routes', () => {

  // -------------------------------------------------------------------------
  // Route ordering regression: dead-letter must not be shadowed by :jobId
  // -------------------------------------------------------------------------

  describe('route ordering (dead-letter vs :jobId)', () => {
    test('GET /jobs/dead-letter is NOT shadowed by GET /jobs/:jobId', async () => {
      const queue = mockJobQueue({
        listDeadLetterJobs: () => [makeJob({ status: 'dead-lettered', deadLetteredAt: Date.now() })],
      });
      const app = createApp(queue);
      const res = await request(app, 'GET', '/api/v1/export/jobs/dead-letter');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.count).toBe(1);
      // If shadowed, we'd get 400 "Invalid jobId format"
      expect(res.body.error).toBeUndefined();
    });

    test('DELETE /jobs/dead-letter is NOT shadowed by DELETE /jobs/:jobId', async () => {
      const queue = mockJobQueue({
        purgeDeadLetterJobs: () => 3,
      });
      const app = createApp(queue);
      const res = await request(app, 'DELETE', '/api/v1/export/jobs/dead-letter');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.purged).toBe(3);
    });
  });

  // -------------------------------------------------------------------------
  // GET /jobs/health
  // -------------------------------------------------------------------------

  describe('GET /jobs/health', () => {
    test('returns healthy when queue utilization is low', async () => {
      const queue = mockJobQueue({
        getQueueStats: () => makeStats({ queued: 5, running: 1 }),
        getMaxQueueSize: () => 100,
        getAvailableSlots: () => 3,
      });
      const app = createApp(queue);
      const res = await request(app, 'GET', '/api/v1/export/jobs/health');

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('healthy');
      expect(res.body.data.queueDepth).toBe(5);
      expect(res.body.data.running).toBe(1);
    });

    test('returns degraded when queue utilization > 50%', async () => {
      const queue = mockJobQueue({
        getQueueStats: () => makeStats({ queued: 60, running: 4 }),
        getMaxQueueSize: () => 100,
        getAvailableSlots: () => 0,
      });
      const app = createApp(queue);
      const res = await request(app, 'GET', '/api/v1/export/jobs/health');

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('degraded');
    });

    test('returns unhealthy (503) when queue utilization > 80%', async () => {
      const queue = mockJobQueue({
        getQueueStats: () => makeStats({ queued: 85, running: 4 }),
        getMaxQueueSize: () => 100,
        getAvailableSlots: () => 0,
      });
      const app = createApp(queue);
      const res = await request(app, 'GET', '/api/v1/export/jobs/health');

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.data.status).toBe('unhealthy');
    });

    test('returns degraded when concurrency is at 100%', async () => {
      const queue = mockJobQueue({
        getQueueStats: () => makeStats({ queued: 10, running: 4 }),
        getMaxQueueSize: () => 100,
        getAvailableSlots: () => 0,
      });
      const app = createApp(queue);
      const res = await request(app, 'GET', '/api/v1/export/jobs/health');

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('degraded');
      expect(res.body.data.concurrencyUtilization).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // GET /jobs
  // -------------------------------------------------------------------------

  describe('GET /jobs', () => {
    test('returns queue stats and active jobs', async () => {
      const activeJob = makeJob({ status: 'running' });
      const queue = mockJobQueue({
        getQueueStats: () => makeStats({ queued: 2, running: 1 }),
        listActiveJobs: () => [activeJob],
      });
      const app = createApp(queue);
      const res = await request(app, 'GET', '/api/v1/export/jobs');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.stats.queued).toBe(2);
      expect(res.body.data.activeJobs).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // POST /jobs
  // -------------------------------------------------------------------------

  describe('POST /jobs', () => {
    test('creates job with valid input', async () => {
      const queue = mockJobQueue();
      const app = createApp(queue);
      const res = await request(app, 'POST', '/api/v1/export/jobs', {
        format: 'mp4',
        inputHash: 'sha256:abc123',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.jobId).toBe(VALID_UUID);
      expect(res.body.data.format).toBe('mp4');
      expect(res.body.data.priority).toBe('normal');
    });

    test('accepts valid priority', async () => {
      const queue = mockJobQueue();
      const app = createApp(queue);
      const res = await request(app, 'POST', '/api/v1/export/jobs', {
        format: 'webm',
        priority: 'high',
        inputHash: 'abc',
      });

      expect(res.status).toBe(201);
      expect(res.body.data.priority).toBe('high');
    });

    test('defaults to normal priority for invalid priority', async () => {
      const queue = mockJobQueue();
      const app = createApp(queue);
      const res = await request(app, 'POST', '/api/v1/export/jobs', {
        format: 'mp4',
        priority: 'super-urgent',
        inputHash: 'abc',
      });

      expect(res.status).toBe(201);
      expect(res.body.data.priority).toBe('normal');
    });

    test('rejects missing format', async () => {
      const app = createApp(mockJobQueue());
      const res = await request(app, 'POST', '/api/v1/export/jobs', {
        inputHash: 'abc',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('rejects empty format', async () => {
      const app = createApp(mockJobQueue());
      const res = await request(app, 'POST', '/api/v1/export/jobs', {
        format: '  ',
        inputHash: 'abc',
      });

      expect(res.status).toBe(400);
    });

    test('rejects unsupported format', async () => {
      const app = createApp(mockJobQueue());
      const res = await request(app, 'POST', '/api/v1/export/jobs', {
        format: 'exe',
        inputHash: 'abc',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('UNSUPPORTED_FORMAT');
    });

    test('rejects missing inputHash', async () => {
      const app = createApp(mockJobQueue());
      const res = await request(app, 'POST', '/api/v1/export/jobs', {
        format: 'mp4',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('rejects inputHash exceeding 256 chars', async () => {
      const app = createApp(mockJobQueue());
      const res = await request(app, 'POST', '/api/v1/export/jobs', {
        format: 'mp4',
        inputHash: 'x'.repeat(257),
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('returns 503 when queue is full', async () => {
      const queue = mockJobQueue({
        enqueue: () => { throw new Error('queue is full'); },
      });
      const app = createApp(queue);
      const res = await request(app, 'POST', '/api/v1/export/jobs', {
        format: 'mp4',
        inputHash: 'abc',
      });

      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('QUEUE_FULL');
    });

    test('returns 500 on internal enqueue error', async () => {
      const queue = mockJobQueue({
        enqueue: () => { throw new Error('database is down'); },
      });
      const app = createApp(queue);
      const res = await request(app, 'POST', '/api/v1/export/jobs', {
        format: 'mp4',
        inputHash: 'abc',
      });

      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe('INTERNAL_ERROR');
    });

    test('accepts all 12 valid export formats', async () => {
      const formats = ['mp4', 'webm', 'gif', 'apng', 'interactive-html', 'pdf-animated', 'svg-animated', 'json-lottie', 'json', 'svg', 'pdf', 'html'];
      const queue = mockJobQueue();
      const app = createApp(queue);

      for (const format of formats) {
        const res = await request(app, 'POST', '/api/v1/export/jobs', {
          format,
          inputHash: 'abc',
        });
        expect(res.status).toBe(201);
        expect(res.body.data.format).toBe(format);
      }
    });
  });

  // -------------------------------------------------------------------------
  // GET /jobs/:jobId
  // -------------------------------------------------------------------------

  describe('GET /jobs/:jobId', () => {
    test('returns job details for valid UUID', async () => {
      const job = makeJob({ status: 'running', startedAt: Date.now() });
      const queue = mockJobQueue({
        findJob: () => job,
        getQueuePosition: () => null,
        getEstimatedWaitTime: () => 0,
      });
      const app = createApp(queue);
      const res = await request(app, 'GET', `/api/v1/export/jobs/${VALID_UUID}`);

      expect(res.status).toBe(200);
      expect(res.body.data.jobId).toBe(VALID_UUID);
      expect(res.body.data.status).toBe('running');
    });

    test('returns 400 for invalid UUID', async () => {
      const app = createApp(mockJobQueue());
      const res = await request(app, 'GET', '/api/v1/export/jobs/not-a-uuid');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('returns 404 when job not found', async () => {
      const queue = mockJobQueue({ findJob: () => null });
      const app = createApp(queue);
      const res = await request(app, 'GET', `/api/v1/export/jobs/${VALID_UUID}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('JOB_NOT_FOUND');
    });

    test('returns ETA for queued jobs, 0 for running', async () => {
      const queuedJob = makeJob({ status: 'queued' });
      const queue = mockJobQueue({
        findJob: () => queuedJob,
        getEstimatedWaitTime: () => 30000,
      });
      const app = createApp(queue);
      const res = await request(app, 'GET', `/api/v1/export/jobs/${VALID_UUID}`);

      expect(res.body.data.estimatedWaitTimeMs).toBe(30000);
    });

    test('returns 0 ETA for completed jobs', async () => {
      const completedJob = makeJob({ status: 'completed', completedAt: Date.now() });
      const queue = mockJobQueue({
        findJob: () => completedJob,
        getEstimatedWaitTime: () => 30000,
      });
      const app = createApp(queue);
      const res = await request(app, 'GET', `/api/v1/export/jobs/${VALID_UUID}`);

      expect(res.body.data.estimatedWaitTimeMs).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /jobs/:jobId
  // -------------------------------------------------------------------------

  describe('DELETE /jobs/:jobId', () => {
    test('cancels a queued job', async () => {
      const job = makeJob({ status: 'queued' });
      const queue = mockJobQueue({
        findJob: () => job,
        cancel: () => true,
      });
      const app = createApp(queue);
      const res = await request(app, 'DELETE', `/api/v1/export/jobs/${VALID_UUID}`);

      expect(res.status).toBe(200);
      expect(res.body.data.cancelled).toBe(true);
    });

    test('returns 400 for invalid UUID', async () => {
      const app = createApp(mockJobQueue());
      const res = await request(app, 'DELETE', '/api/v1/export/jobs/bad');

      expect(res.status).toBe(400);
    });

    test('returns 404 when job not found', async () => {
      const queue = mockJobQueue({ findJob: () => null });
      const app = createApp(queue);
      const res = await request(app, 'DELETE', `/api/v1/export/jobs/${VALID_UUID}`);

      expect(res.status).toBe(404);
    });

    test('returns 409 for completed job', async () => {
      const job = makeJob({ status: 'completed' });
      const queue = mockJobQueue({ findJob: () => job });
      const app = createApp(queue);
      const res = await request(app, 'DELETE', `/api/v1/export/jobs/${VALID_UUID}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('JOB_ALREADY_TERMINATED');
    });

    test('returns 409 for dead-lettered job', async () => {
      const job = makeJob({ status: 'dead-lettered' });
      const queue = mockJobQueue({ findJob: () => job });
      const app = createApp(queue);
      const res = await request(app, 'DELETE', `/api/v1/export/jobs/${VALID_UUID}`);

      expect(res.status).toBe(409);
    });

    test('returns 500 when cancel fails', async () => {
      const job = makeJob({ status: 'queued' });
      const queue = mockJobQueue({
        findJob: () => job,
        cancel: () => false,
      });
      const app = createApp(queue);
      const res = await request(app, 'DELETE', `/api/v1/export/jobs/${VALID_UUID}`);

      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe('CANCEL_FAILED');
    });
  });

  // -------------------------------------------------------------------------
  // GET /jobs/dead-letter
  // -------------------------------------------------------------------------

  describe('GET /jobs/dead-letter', () => {
    test('returns empty list when no DLQ jobs', async () => {
      const queue = mockJobQueue({ listDeadLetterJobs: () => [] });
      const app = createApp(queue);
      const res = await request(app, 'GET', '/api/v1/export/jobs/dead-letter');

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(0);
      expect(res.body.data.jobs).toHaveLength(0);
    });

    test('returns DLQ jobs with details', async () => {
      const dlqJob = makeJob({
        jobId: '00000000-0000-4000-8000-0000000000aa',
        status: 'dead-lettered',
        deadLetteredAt: 1700000000000,
        retryCount: 3,
        lastError: 'Out of memory',
      });
      const queue = mockJobQueue({ listDeadLetterJobs: () => [dlqJob] });
      const app = createApp(queue);
      const res = await request(app, 'GET', '/api/v1/export/jobs/dead-letter');

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(1);
      expect(res.body.data.jobs[0].retryCount).toBe(3);
      expect(res.body.data.jobs[0].lastError).toBe('Out of memory');
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /jobs/dead-letter
  // -------------------------------------------------------------------------

  describe('DELETE /jobs/dead-letter', () => {
    test('purges all DLQ jobs', async () => {
      const queue = mockJobQueue({ purgeDeadLetterJobs: () => 5 });
      const app = createApp(queue);
      const res = await request(app, 'DELETE', '/api/v1/export/jobs/dead-letter');

      expect(res.status).toBe(200);
      expect(res.body.data.purged).toBe(5);
    });

    test('returns 0 when DLQ is empty', async () => {
      const queue = mockJobQueue({ purgeDeadLetterJobs: () => 0 });
      const app = createApp(queue);
      const res = await request(app, 'DELETE', '/api/v1/export/jobs/dead-letter');

      expect(res.status).toBe(200);
      expect(res.body.data.purged).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // POST /jobs/:jobId/replay
  // -------------------------------------------------------------------------

  describe('POST /jobs/:jobId/replay', () => {
    test('replays a dead-lettered job', async () => {
      const dlqJob = makeJob({ status: 'dead-lettered' });
      const replayedJob = makeJob({ jobId: VALID_UUID_2, status: 'queued' });
      const queue = mockJobQueue({
        findJob: () => dlqJob,
        replayDeadLetterJob: () => replayedJob,
      });
      const app = createApp(queue);
      const res = await request(app, 'POST', `/api/v1/export/jobs/${VALID_UUID}/replay`);

      expect(res.status).toBe(201);
      expect(res.body.data.originalJobId).toBe(VALID_UUID);
      expect(res.body.data.newJobId).toBe(VALID_UUID_2);
    });

    test('returns 400 for invalid UUID', async () => {
      const app = createApp(mockJobQueue());
      const res = await request(app, 'POST', '/api/v1/export/jobs/bad/replay');

      expect(res.status).toBe(400);
    });

    test('returns 404 when job is not in DLQ', async () => {
      const queue = mockJobQueue({
        findJob: () => makeJob({ status: 'completed' }),
      });
      const app = createApp(queue);
      const res = await request(app, 'POST', `/api/v1/export/jobs/${VALID_UUID}/replay`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('JOB_NOT_IN_DLQ');
    });

    test('returns 404 when job not found', async () => {
      const queue = mockJobQueue({ findJob: () => null });
      const app = createApp(queue);
      const res = await request(app, 'POST', `/api/v1/export/jobs/${VALID_UUID}/replay`);

      expect(res.status).toBe(404);
    });

    test('returns 500 when replay returns null', async () => {
      const queue = mockJobQueue({
        findJob: () => makeJob({ status: 'dead-lettered' }),
        replayDeadLetterJob: () => null,
      });
      const app = createApp(queue);
      const res = await request(app, 'POST', `/api/v1/export/jobs/${VALID_UUID}/replay`);

      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe('REPLAY_FAILED');
    });

    test('returns 500 when replay throws', async () => {
      const queue = mockJobQueue({
        findJob: () => makeJob({ status: 'dead-lettered' }),
        replayDeadLetterJob: () => { throw new Error('Queue is full'); },
      });
      const app = createApp(queue);
      const res = await request(app, 'POST', `/api/v1/export/jobs/${VALID_UUID}/replay`);

      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe('REPLAY_FAILED');
    });
  });

  // -------------------------------------------------------------------------
  // Error logging verification
  // -------------------------------------------------------------------------

  describe('error logging on 500', () => {
    let loggerSpy: jest.SpyInstance;

    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { logger } = require('../../../utils/logger');
      loggerSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      loggerSpy.mockRestore();
    });

    test('POST /jobs logs via logger.error on 500 internal error', async () => {
      const queue = mockJobQueue({
        enqueue: () => { throw new Error('database is down'); },
      });
      const app = createApp(queue);
      const res = await request(app, 'POST', '/api/v1/export/jobs', {
        format: 'mp4',
        inputHash: 'abc',
      });

      expect(res.status).toBe(500);
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('[export-jobs]'),
        expect.any(Error),
      );
    });

    test('POST /jobs/:jobId/replay logs via logger.error on 500', async () => {
      const queue = mockJobQueue({
        findJob: () => makeJob({ status: 'dead-lettered' }),
        replayDeadLetterJob: () => { throw new Error('Queue is full'); },
      });
      const app = createApp(queue);
      const res = await request(app, 'POST', `/api/v1/export/jobs/${VALID_UUID}/replay`);

      expect(res.status).toBe(500);
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('[export-jobs]'),
        expect.any(Error),
      );
    });
  });
});
