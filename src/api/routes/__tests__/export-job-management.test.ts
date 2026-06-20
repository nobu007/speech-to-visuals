/**
 * REQ-241~243: Export Job Management API Tests (Phase 104)
 *
 * Tests for:
 * - POST   /api/v1/export/jobs           — Submit export job
 * - GET    /api/v1/export/jobs/:jobId     — Get job status
 * - DELETE /api/v1/export/jobs/:jobId     — Cancel job
 */

import express from 'express';
import request from 'supertest';
import { createExportJobRouter } from '../export-jobs';
import { ExportJobQueue } from '../../../export/export-job-queue';

function createApp() {
  const queue = new ExportJobQueue({
    maxConcurrent: 3,
    maxQueueSize: 10,
    starvationPreventionInterval: 60_000,
    maxRetries: 0,
  });

  const app = express();
  app.use(express.json());
  app.use('/api/v1/export', createExportJobRouter(queue));
  return { app, queue };
}

describe('Export Job Management API (REQ-241~243)', () => {
  let app: express.Express;
  let queue: ExportJobQueue;

  beforeEach(() => {
    ({ app, queue } = createApp());
  });

  // -- POST /jobs (REQ-241) -----------------------------------------------

  describe('POST /api/v1/export/jobs', () => {
    it('enqueues a job with default priority', async () => {
      const res = await request(app)
        .post('/api/v1/export/jobs')
        .send({ format: 'svg', inputHash: 'abc123' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.jobId).toMatch(UUID_V4_RE);
      expect(res.body.data.status).toBe('queued');
      expect(res.body.data.priority).toBe('normal');
      expect(res.body.data.format).toBe('svg');
      expect(res.body.data.queuePosition).toBe(0);
    });

    it('enqueues a job with explicit high priority', async () => {
      const res = await request(app)
        .post('/api/v1/export/jobs')
        .send({ format: 'mp4', priority: 'high', inputHash: 'def456' });

      expect(res.status).toBe(201);
      expect(res.body.data.priority).toBe('high');
    });

    it('enqueues a job with low priority', async () => {
      const res = await request(app)
        .post('/api/v1/export/jobs')
        .send({ format: 'pdf', priority: 'low', inputHash: 'ghi789' });

      expect(res.status).toBe(201);
      expect(res.body.data.priority).toBe('low');
    });

    it('falls back to normal priority for invalid priority', async () => {
      const res = await request(app)
        .post('/api/v1/export/jobs')
        .send({ format: 'svg', priority: 'invalid', inputHash: 'abc' });

      expect(res.status).toBe(201);
      expect(res.body.data.priority).toBe('normal');
    });

    it('returns 400 when format is missing', async () => {
      const res = await request(app)
        .post('/api/v1/export/jobs')
        .send({ inputHash: 'abc123' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for unsupported export format', async () => {
      const res = await request(app)
        .post('/api/v1/export/jobs')
        .send({ format: 'exe', inputHash: 'abc123' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('UNSUPPORTED_FORMAT');
    });

    it('returns 400 for empty string format', async () => {
      const res = await request(app)
        .post('/api/v1/export/jobs')
        .send({ format: '', inputHash: 'abc123' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('accepts all supported formats', async () => {
      const bigQueue = new ExportJobQueue({
        maxConcurrent: 3,
        maxQueueSize: 20,
        starvationPreventionInterval: 60_000,
      });
      const bigApp = express();
      bigApp.use(express.json());
      bigApp.use('/api/v1/export', createExportJobRouter(bigQueue));

      const formats = ['mp4', 'webm', 'gif', 'apng', 'interactive-html',
        'pdf-animated', 'svg-animated', 'json-lottie', 'json', 'svg', 'pdf', 'html'];

      for (const fmt of formats) {
        const res = await request(bigApp)
          .post('/api/v1/export/jobs')
          .send({ format: fmt, inputHash: `hash-${fmt}` });

        expect(res.status).toBe(201);
        expect(res.body.data.format).toBe(fmt);
      }
    });

    it('returns 400 when inputHash is missing', async () => {
      const res = await request(app)
        .post('/api/v1/export/jobs')
        .send({ format: 'svg' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when inputHash exceeds max length', async () => {
      const res = await request(app)
        .post('/api/v1/export/jobs')
        .send({ format: 'svg', inputHash: 'x'.repeat(257) });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns queue position and ETA for enqueued job', async () => {
      // Fill a running slot to make queue position meaningful
      queue.enqueue({ format: 'svg', inputHash: 'running1' });
      const running1 = queue.dequeue()!;
      queue.running.set(running1.jobId, running1);

      const res = await request(app)
        .post('/api/v1/export/jobs')
        .send({ format: 'mp4', inputHash: 'queued1' });

      expect(res.status).toBe(201);
      expect(res.body.data.queuePosition).toBe(0);
      expect(res.body.data.estimatedWaitTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('returns 503 when queue is full', async () => {
      // Fill the queue to max
      const smallQueue = new ExportJobQueue({
        maxConcurrent: 1,
        maxQueueSize: 2,
        starvationPreventionInterval: 60_000,
      });
      const smallApp = express();
      smallApp.use(express.json());
      smallApp.use('/api/v1/export', createExportJobRouter(smallQueue));

      smallQueue.enqueue({ format: 'svg', inputHash: 'q1' });
      smallQueue.enqueue({ format: 'svg', inputHash: 'q2' });

      const res = await request(smallApp)
        .post('/api/v1/export/jobs')
        .send({ format: 'svg', inputHash: 'q3' });

      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('QUEUE_FULL');
    });
  });

  // -- GET /jobs: Queue stats and active jobs -----------------------------

  describe('GET /api/v1/export/jobs (queue overview)', () => {
    it('returns empty queue stats when no jobs exist', async () => {
      const res = await request(app).get('/api/v1/export/jobs');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.stats).toEqual({
        queued: 0,
        running: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
        deadLettered: 0,
        maxConcurrent: 3,
      });
      expect(res.body.data.activeJobs).toEqual([]);
    });

    it('returns stats and active jobs with queued and running jobs', async () => {
      const job1 = queue.enqueue({ format: 'svg', inputHash: 'h1', priority: 'high' });
      queue.enqueue({ format: 'pdf', inputHash: 'h2', priority: 'low' });
      const dequeued = queue.dequeue()!; // job1 is now running

      const res = await request(app).get('/api/v1/export/jobs');

      expect(res.status).toBe(200);
      expect(res.body.data.stats.queued).toBe(1);
      expect(res.body.data.stats.running).toBe(1);
      expect(res.body.data.activeJobs).toHaveLength(2);

      const running = res.body.data.activeJobs.find((j: { jobId: string }) => j.jobId === dequeued.jobId);
      expect(running.status).toBe('running');
      expect(running.format).toBe('svg');

      const queued = res.body.data.activeJobs.find((j: { jobId: string }) => j.jobId !== dequeued.jobId);
      expect(queued.status).toBe('queued');
      expect(queued.format).toBe('pdf');
    });

    it('does not include completed jobs in activeJobs', async () => {
      const job = queue.enqueue({ format: 'svg', inputHash: 'h1' });
      queue.dequeue();
      queue.completeJob(job.jobId, true, { data: new Uint8Array(5), sizeBytes: 5 });

      const res = await request(app).get('/api/v1/export/jobs');

      expect(res.status).toBe(200);
      expect(res.body.data.stats.completed).toBe(1);
      expect(res.body.data.activeJobs).toEqual([]);
    });
  });

  // -- GET /jobs/health (Queue Health) -------------------------------------

  describe('GET /api/v1/export/jobs/health', () => {
    it('returns healthy status with empty queue', async () => {
      const res = await request(app).get('/api/v1/export/jobs/health');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('healthy');
      expect(res.body.data.queueDepth).toBe(0);
      expect(res.body.data.maxQueueSize).toBe(10);
      expect(res.body.data.running).toBe(0);
      expect(res.body.data.maxConcurrent).toBe(3);
      expect(res.body.data.availableSlots).toBe(3);
      expect(res.body.data.queueUtilization).toBe(0);
    });

    it('returns degraded status when queue utilization exceeds 50%', async () => {
      // maxQueueSize=10 → enqueue 6 jobs (all stay queued until dequeued)
      for (let i = 0; i < 6; i++) {
        queue.enqueue({ format: 'svg', inputHash: `job-${i}` });
      }

      const res = await request(app).get('/api/v1/export/jobs/health');

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('degraded');
      expect(res.body.data.queueDepth).toBe(6);
      expect(res.body.data.queueUtilization).toBeGreaterThan(0.5);
    });

    it('returns unhealthy status and 503 when queue utilization exceeds 80%', async () => {
      // maxQueueSize=10 → enqueue 9 jobs (all stay queued until dequeued)
      for (let i = 0; i < 9; i++) {
        queue.enqueue({ format: 'svg', inputHash: `job-${i}` });
      }

      const res = await request(app).get('/api/v1/export/jobs/health');

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.data.status).toBe('unhealthy');
      expect(res.body.data.queueDepth).toBe(9);
      expect(res.body.data.queueUtilization).toBeGreaterThan(0.8);
    });

    it('returns degraded when all concurrency slots are busy', async () => {
      // Enqueue 3 jobs and dequeue them to fill all concurrent slots
      queue.enqueue({ format: 'svg', inputHash: 'a' });
      queue.enqueue({ format: 'svg', inputHash: 'b' });
      queue.enqueue({ format: 'svg', inputHash: 'c' });
      queue.dequeue();
      queue.dequeue();
      queue.dequeue();

      const res = await request(app).get('/api/v1/export/jobs/health');

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('degraded');
      expect(res.body.data.running).toBe(3);
      expect(res.body.data.concurrencyUtilization).toBe(1);
      expect(res.body.data.availableSlots).toBe(0);
    });
  });

  // -- GET /jobs/:jobId (REQ-242) -----------------------------------------

  describe('GET /api/v1/export/jobs/:jobId', () => {
    it('returns job status for queued job', async () => {
      const job = queue.enqueue({ format: 'svg', inputHash: 'abc' });

      const res = await request(app).get(`/api/v1/export/jobs/${job.jobId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.jobId).toBe(job.jobId);
      expect(res.body.data.status).toBe('queued');
      expect(res.body.data.format).toBe('svg');
      expect(res.body.data.artifactId).toBeNull();
    });

    it('returns job status for completed job', async () => {
      const job = queue.enqueue({ format: 'svg', inputHash: 'abc' });
      const dequeued = queue.dequeue()!;
      queue.completeJob(dequeued.jobId, true, { data: new Uint8Array(10), sizeBytes: 10 });

      const res = await request(app).get(`/api/v1/export/jobs/${job.jobId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('completed');
      expect(res.body.data.artifactId).toBeDefined();
      expect(res.body.data.completedAt).toBeGreaterThan(0);
    });

    it('returns job status for failed job', async () => {
      const job = queue.enqueue({ format: 'svg', inputHash: 'abc' });
      const dequeued = queue.dequeue()!;
      queue.completeJob(dequeued.jobId, false);

      const res = await request(app).get(`/api/v1/export/jobs/${job.jobId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('dead-lettered');
    });

    it('returns 404 for non-existent job', async () => {
      const res = await request(app).get('/api/v1/export/jobs/00000000-0000-4000-a000-000000000000');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('JOB_NOT_FOUND');
    });

    it('returns 400 for invalid jobId format', async () => {
      const res = await request(app).get('/api/v1/export/jobs/not-a-uuid');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns queue position and ETA for queued job', async () => {
      const job1 = queue.enqueue({ format: 'svg', inputHash: 'first' });

      const res = await request(app).get(`/api/v1/export/jobs/${job1.jobId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.queuePosition).toBe(0);
    });
  });

  // -- DELETE /jobs/:jobId (REQ-243) --------------------------------------

  describe('DELETE /api/v1/export/jobs/:jobId', () => {
    it('cancels a queued job', async () => {
      const job = queue.enqueue({ format: 'svg', inputHash: 'abc' });

      const res = await request(app).delete(`/api/v1/export/jobs/${job.jobId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.cancelled).toBe(true);
    });

    it('cancels a running job', async () => {
      const job = queue.enqueue({ format: 'svg', inputHash: 'abc' });
      queue.dequeue();

      const res = await request(app).delete(`/api/v1/export/jobs/${job.jobId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.cancelled).toBe(true);
    });

    it('returns 404 for non-existent job', async () => {
      const res = await request(app).delete('/api/v1/export/jobs/00000000-0000-4000-a000-000000000000');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('JOB_NOT_FOUND');
    });

    it('returns 400 for invalid jobId format', async () => {
      const res = await request(app).delete('/api/v1/export/jobs/invalid');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 409 when cancelling a completed job', async () => {
      const job = queue.enqueue({ format: 'svg', inputHash: 'abc' });
      queue.dequeue();
      queue.completeJob(job.jobId, true, { data: new Uint8Array(10), sizeBytes: 10 });

      const res = await request(app).delete(`/api/v1/export/jobs/${job.jobId}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('JOB_ALREADY_TERMINATED');
    });

    it('returns 409 when cancelling a dead-lettered job', async () => {
      const job = queue.enqueue({ format: 'svg', inputHash: 'abc' });
      queue.dequeue();
      queue.completeJob(job.jobId, false);

      const res = await request(app).delete(`/api/v1/export/jobs/${job.jobId}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('JOB_ALREADY_TERMINATED');
    });
  });
});

// UUID v4 regex for test assertions
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
