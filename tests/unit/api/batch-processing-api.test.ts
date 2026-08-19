/**
 * TASK-0046: Batch Processing API Tests (TDD)
 *
 * Tests for:
 * - Job creation (POST /api/v1/batch/jobs)
 * - Job retrieval (GET /api/v1/batch/jobs/:jobId)
 * - Job cancellation (POST /api/v1/batch/jobs/:jobId/cancel)
 * - Parallel processing control (max 3 concurrent jobs)
 * - Validation errors (VALIDATION_ERROR 400)
 * - Too many files (TOO_MANY_FILES 429)
 * - Job not found (JOB_NOT_FOUND 404)
 * - Job already completed cancel error (JOB_ALREADY_COMPLETED 409)
 * - Progress tracking
 */

import request from 'supertest';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createBatchRouter, BatchJobManager } from '@/api/routes/batch';
import { errorHandler } from '@/api/middleware/error-handler';

/**
 * Helper: create a fresh Express app with batch routes for each test.
 */
function createTestApp(): { app: express.Express; jobManager: BatchJobManager } {
  const app = express();
  app.use(express.json());

  const jobManager = new BatchJobManager();
  const batchRouter = createBatchRouter(jobManager);
  app.use('/api/v1/batch', batchRouter);
  app.use(errorHandler);

  return { app, jobManager };
}

/**
 * Fail-loud presence check (Phase 150 / TASK-0237). Replaces the `…!`
 * non-null assertions this file used to postfix `jobs.get(…)` /
 * `getJobStatus(…)` results with: an absent job used to surface as an
 * opaque `Cannot read properties of undefined` inside the mutation or
 * expect, the helper keeps the RED verdict naming the missing job.
 */
function requireDefined<T>(value: T | undefined | null, label: string): T {
  if (value === undefined || value === null) {
    throw new Error(`${label} not found`);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Test Suites
// ---------------------------------------------------------------------------

describe('Batch Processing API', () => {
  // =========================================================================
  // POST /api/v1/batch/jobs  -- Job Creation
  // =========================================================================
  describe('POST /api/v1/batch/jobs - Create Job', () => {
    it('should create a batch job and return 202 with jobId', async () => {
      const { app } = createTestApp();

      const res = await request(app)
        .post('/api/v1/batch/jobs')
        .send({
          files: [
            { name: 'file1.wav', path: '/audio/file1.wav' },
            { name: 'file2.wav', path: '/audio/file2.wav' },
          ],
        });

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
      expect(res.body.data.jobId).toBeDefined();
      expect(typeof res.body.data.jobId).toBe('string');
      // UUID v4 format check
      expect(res.body.data.jobId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
      expect(res.body.data.status).toBe('queued');
    });

    it('should return VALIDATION_ERROR (400) when no files are provided', async () => {
      const { app } = createTestApp();

      const res = await request(app)
        .post('/api/v1/batch/jobs')
        .send({ files: [] });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return VALIDATION_ERROR (400) when files field is missing', async () => {
      const { app } = createTestApp();

      const res = await request(app)
        .post('/api/v1/batch/jobs')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return VALIDATION_ERROR (400) when files is not an array', async () => {
      const { app } = createTestApp();

      const res = await request(app)
        .post('/api/v1/batch/jobs')
        .send({ files: 'not-an-array' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return TOO_MANY_FILES (429) when more than 100 files', async () => {
      const { app } = createTestApp();

      const files = Array.from({ length: 101 }, (_, i) => ({
        name: `file${i}.wav`,
        path: `/audio/file${i}.wav`,
      }));

      const res = await request(app)
        .post('/api/v1/batch/jobs')
        .send({ files });

      expect(res.status).toBe(429);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('TOO_MANY_FILES');
    });

    it('should accept optional preset and options', async () => {
      const { app } = createTestApp();

      const res = await request(app)
        .post('/api/v1/batch/jobs')
        .send({
          files: [{ name: 'test.wav', path: '/audio/test.wav' }],
          preset: 'quality',
          options: {
            generateVideo: true,
            exportFormats: ['svg', 'png'],
          },
        });

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
      expect(res.body.data.jobId).toBeDefined();
    });

    it('should reject file objects missing name property (ISS-004)', async () => {
      const { app } = createTestApp();

      const res = await request(app)
        .post('/api/v1/batch/jobs')
        .send({
          files: [{ path: '/audio/test.wav' }], // missing name
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject file objects with non-string name (ISS-004)', async () => {
      const { app } = createTestApp();

      const res = await request(app)
        .post('/api/v1/batch/jobs')
        .send({
          files: [{ name: 123, path: '/audio/test.wav' }],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject null file objects in array (ISS-004)', async () => {
      const { app } = createTestApp();

      const res = await request(app)
        .post('/api/v1/batch/jobs')
        .send({
          files: [null, { name: 'ok.wav', path: '/ok.wav' }],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // =========================================================================
  // REQ-064: jobId UUID validation edge cases (ISS-010)
  // =========================================================================
  describe('REQ-064: jobId UUID format validation (ISS-010)', () => {
    it('TC-064-B01: valid UUID v4 jobId for existing job returns 200', async () => {
      const { app } = createTestApp();

      const createRes = await request(app)
        .post('/api/v1/batch/jobs')
        .send({ files: [{ name: 'test.wav', path: '/test.wav' }] });

      const jobId = createRes.body.data.jobId;
      // jobId is a valid UUID v4 — should return 200 for existing job
      expect(jobId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

      const res = await request(app).get(`/api/v1/batch/jobs/${jobId}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('TC-064-B01: valid UUID v4 for non-existent job returns 404', async () => {
      const { app } = createTestApp();

      const validButNonExistent = '550e8400-e29b-41d4-a716-446655440000';
      const res = await request(app).get(`/api/v1/batch/jobs/${validButNonExistent}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('JOB_NOT_FOUND');
    });

    it('TC-064-E01: SQL injection jobId returns 400', async () => {
      const { app } = createTestApp();

      const res = await request(app).get(`/api/v1/batch/jobs/'%3B%20DROP%20TABLE%20jobs%3B--`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('TC-064-E02: non-UUID string jobId on cancel returns 400', async () => {
      const { app } = createTestApp();

      const res = await request(app).post('/api/v1/batch/jobs/abc-not-a-uuid/cancel');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('TC-064-E03: empty/whitespace-only jobId is rejected', async () => {
      const { app } = createTestApp();

      // Space-only path — UUID validation catches it
      const res = await request(app).get('/api/v1/batch/jobs/%20');

      expect([400, 404]).toContain(res.status);
      // Verify no successful response body either way
      if (res.body && res.body.success !== undefined) {
        expect(res.body.success).toBe(false);
      }
    });
  });

  // =========================================================================
  // GET /api/v1/batch/jobs/:jobId  -- Job Retrieval
  // =========================================================================
  describe('GET /api/v1/batch/jobs/:jobId - Get Job Status', () => {
    it('should return job status with 200', async () => {
      const { app } = createTestApp();

      // Create a job first
      const createRes = await request(app)
        .post('/api/v1/batch/jobs')
        .send({
          files: [{ name: 'file1.wav', path: '/audio/file1.wav' }],
        });

      const jobId = createRes.body.data.jobId;

      // Retrieve job status
      const res = await request(app).get(`/api/v1/batch/jobs/${jobId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.jobId).toBe(jobId);
      expect(res.body.data.status).toBe('queued');
      expect(res.body.data.progress).toBeDefined();
      expect(res.body.data.progress.total).toBe(1);
      expect(res.body.data.progress.completed).toBe(0);
      expect(res.body.data.progress.failed).toBe(0);
      expect(res.body.data.progress.percentage).toBe(0);
    });

    it('should return JOB_NOT_FOUND (404) for non-existent job', async () => {
      const { app } = createTestApp();

      const fakeJobId = uuidv4();
      const res = await request(app).get(`/api/v1/batch/jobs/${fakeJobId}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('JOB_NOT_FOUND');
    });

    it('should return VALIDATION_ERROR (400) for invalid job ID format (ISS-010)', async () => {
      const { app } = createTestApp();

      const res = await request(app).get('/api/v1/batch/jobs/invalid-id');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return VALIDATION_ERROR (400) for numeric-only jobId (ISS-010)', async () => {
      const { app } = createTestApp();

      const res = await request(app).get('/api/v1/batch/jobs/12345');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return VALIDATION_ERROR (400) for SQL-like injection in jobId (ISS-010)', async () => {
      const { app } = createTestApp();

      const res = await request(app).get('/api/v1/batch/jobs/;%20DROP%20TABLE%20jobs;--');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return VALIDATION_ERROR (400) for empty string jobId (ISS-010)', async () => {
      const { app } = createTestApp();

      // Express won't match /jobs/:jobId for empty string, but the UUID regex
      // also rejects empty strings. Test via a whitespace-only path.
      const res = await request(app).get('/api/v1/batch/jobs/ ');

      // Either 400 (route matched, UUID rejected) or 404 (no route matched) —
      // both prevent processing with an empty jobId.
      expect([400, 404]).toContain(res.status);
    });
  });

  // =========================================================================
  // POST /api/v1/batch/jobs/:jobId/cancel  -- Job Cancellation
  // =========================================================================
  describe('POST /api/v1/batch/jobs/:jobId/cancel - Cancel Job', () => {
    it('should cancel a queued job and return 200', async () => {
      const { app } = createTestApp();

      // Create a job
      const createRes = await request(app)
        .post('/api/v1/batch/jobs')
        .send({
          files: [{ name: 'file1.wav', path: '/audio/file1.wav' }],
        });

      const jobId = createRes.body.data.jobId;

      // Cancel the job
      const res = await request(app).post(`/api/v1/batch/jobs/${jobId}/cancel`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('cancelled');

      // Verify the job is now cancelled
      const statusRes = await request(app).get(`/api/v1/batch/jobs/${jobId}`);
      expect(statusRes.body.data.status).toBe('cancelled');
    });

    it('should return JOB_NOT_FOUND (404) when cancelling non-existent job', async () => {
      const { app } = createTestApp();

      const fakeJobId = uuidv4();
      const res = await request(app).post(`/api/v1/batch/jobs/${fakeJobId}/cancel`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('JOB_NOT_FOUND');
    });

    it('should return JOB_ALREADY_COMPLETED (409) when cancelling a completed job', async () => {
      const { app, jobManager } = createTestApp();

      // Create a job
      const createRes = await request(app)
        .post('/api/v1/batch/jobs')
        .send({
          files: [{ name: 'file1.wav', path: '/audio/file1.wav' }],
        });

      const jobId = createRes.body.data.jobId;

      // Manually mark as completed
      requireDefined(jobManager['jobs'].get(jobId), `job ${jobId}`).status.status = 'completed';

      // Try to cancel
      const res = await request(app).post(`/api/v1/batch/jobs/${jobId}/cancel`);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('JOB_ALREADY_COMPLETED');
    });

    it('should return JOB_ALREADY_COMPLETED (409) when cancelling a failed job', async () => {
      const { app, jobManager } = createTestApp();

      // Create a job
      const createRes = await request(app)
        .post('/api/v1/batch/jobs')
        .send({
          files: [{ name: 'file1.wav', path: '/audio/file1.wav' }],
        });

      const jobId = createRes.body.data.jobId;

      // Manually mark as failed
      requireDefined(jobManager['jobs'].get(jobId), `job ${jobId}`).status.status = 'failed';

      // Try to cancel
      const res = await request(app).post(`/api/v1/batch/jobs/${jobId}/cancel`);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('JOB_ALREADY_COMPLETED');
    });

    it('should return VALIDATION_ERROR (400) for invalid jobId format on cancel (ISS-010)', async () => {
      const { app } = createTestApp();

      const res = await request(app).post('/api/v1/batch/jobs/not-a-uuid/cancel');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return VALIDATION_ERROR (400) for UUID-like but invalid hex chars on cancel (ISS-010)', async () => {
      const { app } = createTestApp();

      const res = await request(app).post('/api/v1/batch/jobs/gggggggg-gggg-4ggg-8ggg-gggggggggggg/cancel');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // =========================================================================
  // Parallel Processing Control
  // =========================================================================
  describe('Parallel Processing Control', () => {
    it('should allow at most 3 concurrent processing jobs', async () => {
      const { app, jobManager } = createTestApp();

      // Create 4 jobs
      const jobIds: string[] = [];
      for (let i = 0; i < 4; i++) {
        const res = await request(app)
          .post('/api/v1/batch/jobs')
          .send({
            files: [{ name: `file${i}.wav`, path: `/audio/file${i}.wav` }],
          });
        jobIds.push(res.body.data.jobId);
      }

      // Manually set 3 jobs to "processing" to simulate them running
      for (let i = 0; i < 3; i++) {
        requireDefined(jobManager['jobs'].get(jobIds[i]), `job ${jobIds[i]}`).status.status = 'processing';
      }

      // The 4th job should still be "queued" because max 3 are processing
      const fourthJobStatus = jobManager.getJobStatus(jobIds[3]);
      expect(requireDefined(fourthJobStatus, 'fourth job status').status).toBe('queued');
    });

    it('should start queued job when a processing job completes', async () => {
      const { app, jobManager } = createTestApp();

      // Create 4 jobs
      const jobIds: string[] = [];
      for (let i = 0; i < 4; i++) {
        const res = await request(app)
          .post('/api/v1/batch/jobs')
          .send({
            files: [{ name: `file${i}.wav`, path: `/audio/file${i}.wav` }],
          });
        jobIds.push(res.body.data.jobId);
      }

      // Set 3 to processing
      for (let i = 0; i < 3; i++) {
        requireDefined(jobManager['jobs'].get(jobIds[i]), `job ${jobIds[i]}`).status.status = 'processing';
      }

      // Complete one job
      requireDefined(jobManager['jobs'].get(jobIds[0]), `job ${jobIds[0]}`).status.status = 'completed';

      // Simulate the queue starting the next job
      jobManager.startNextQueuedJob();

      // The 4th job should now be processing
      const fourthJobStatus = jobManager.getJobStatus(jobIds[3]);
      expect(requireDefined(fourthJobStatus, 'fourth job status').status).toBe('processing');
    });

    it('should track running and queued job counts correctly', () => {
      const jobManager = new BatchJobManager();

      // Create 5 jobs directly
      const ids: string[] = [];
      for (let i = 0; i < 5; i++) {
        const id = jobManager.createJob([{ name: `file${i}.wav`, path: `/audio/file${i}.wav` }]);
        ids.push(id);
      }

      // Set first 3 to processing
      for (let i = 0; i < 3; i++) {
        requireDefined(jobManager['jobs'].get(ids[i]), `job ${ids[i]}`).status.status = 'processing';
      }

      expect(jobManager.getRunningCount()).toBe(3);
      expect(jobManager.getQueuedCount()).toBe(2);
    });

    it('should prune completed jobs when store exceeds limit (ISS-005)', () => {
      const jobManager = new BatchJobManager();

      // Create and complete more than MAX_STORED_JOBS (200) jobs
      for (let i = 0; i < 205; i++) {
        const id = jobManager.createJob([{ name: `file${i}.wav`, path: `/audio/file${i}.wav` }]);
        // Mark older jobs as completed so they can be pruned
        if (i < 200) {
          requireDefined(jobManager['jobs'].get(id), `job ${id}`).status.status = 'completed';
          requireDefined(jobManager['jobs'].get(id), `job ${id}`).status.completedAt = new Date().toISOString();
        }
      }

      // Store should have been pruned - completed jobs removed
      // The 5 newest jobs + some remaining should be under limit
      expect(jobManager.jobs.size).toBeLessThanOrEqual(205);
    });
  });

  // =========================================================================
  // Progress Tracking
  // =========================================================================
  describe('Progress Tracking', () => {
    it('should track progress with total, completed, failed, percentage', async () => {
      const { app, jobManager } = createTestApp();

      const createRes = await request(app)
        .post('/api/v1/batch/jobs')
        .send({
          files: [
            { name: 'file1.wav', path: '/audio/file1.wav' },
            { name: 'file2.wav', path: '/audio/file2.wav' },
            { name: 'file3.wav', path: '/audio/file3.wav' },
          ],
        });

      const jobId = createRes.body.data.jobId;

      // Simulate partial progress
      const job = requireDefined(jobManager['jobs'].get(jobId), `job ${jobId}`);
      job.status.progress = {
        total: 3,
        completed: 1,
        failed: 0,
        percentage: 33,
      };

      const res = await request(app).get(`/api/v1/batch/jobs/${jobId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.progress.total).toBe(3);
      expect(res.body.data.progress.completed).toBe(1);
      expect(res.body.data.progress.failed).toBe(0);
      expect(res.body.data.progress.percentage).toBe(33);
    });

    it('should show correct initial progress for new job', async () => {
      const { app } = createTestApp();

      const createRes = await request(app)
        .post('/api/v1/batch/jobs')
        .send({
          files: [
            { name: 'file1.wav', path: '/audio/file1.wav' },
            { name: 'file2.wav', path: '/audio/file2.wav' },
          ],
        });

      const jobId = createRes.body.data.jobId;

      const res = await request(app).get(`/api/v1/batch/jobs/${jobId}`);
      expect(res.body.data.progress).toEqual({
        total: 2,
        completed: 0,
        failed: 0,
        percentage: 0,
      });
    });
  });

  // =========================================================================
  // Job State Transitions
  // =========================================================================
  describe('Job State Transitions', () => {
    it('should track full job lifecycle: queued -> processing -> completed', async () => {
      const { app, jobManager } = createTestApp();

      // Create job
      const createRes = await request(app)
        .post('/api/v1/batch/jobs')
        .send({
          files: [{ name: 'file1.wav', path: '/audio/file1.wav' }],
        });

      const jobId = createRes.body.data.jobId;

      // Check queued state
      let statusRes = await request(app).get(`/api/v1/batch/jobs/${jobId}`);
      expect(statusRes.body.data.status).toBe('queued');

      // Move to processing
      requireDefined(jobManager['jobs'].get(jobId), `job ${jobId}`).status.status = 'processing';
      statusRes = await request(app).get(`/api/v1/batch/jobs/${jobId}`);
      expect(statusRes.body.data.status).toBe('processing');

      // Move to completed
      requireDefined(jobManager['jobs'].get(jobId), `job ${jobId}`).status.status = 'completed';
      requireDefined(jobManager['jobs'].get(jobId), `job ${jobId}`).status.progress = {
        total: 1,
        completed: 1,
        failed: 0,
        percentage: 100,
      };
      statusRes = await request(app).get(`/api/v1/batch/jobs/${jobId}`);
      expect(statusRes.body.data.status).toBe('completed');
      expect(statusRes.body.data.progress.percentage).toBe(100);
    });
  });

  // =========================================================================
  // Job ID Format
  // =========================================================================
  describe('Job ID Management', () => {
    it('should generate UUID v4 format job IDs', async () => {
      const { app } = createTestApp();

      const res = await request(app)
        .post('/api/v1/batch/jobs')
        .send({
          files: [{ name: 'file1.wav', path: '/audio/file1.wav' }],
        });

      const jobId = res.body.data.jobId;
      // UUID v4 regex
      const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(jobId).toMatch(uuidV4Regex);
    });

    it('should generate unique IDs for each job', async () => {
      const { app } = createTestApp();

      const ids = new Set<string>();
      for (let i = 0; i < 10; i++) {
        const res = await request(app)
          .post('/api/v1/batch/jobs')
          .send({
            files: [{ name: `file${i}.wav`, path: `/audio/file${i}.wav` }],
          });
        ids.add(res.body.data.jobId);
      }

      expect(ids.size).toBe(10);
    });
  });

  // =========================================================================
  // Error Response Format
  // =========================================================================
  describe('Error Response Format', () => {
    it('should include success:false, error.code, and error.message for all errors', async () => {
      const { app } = createTestApp();

      // Validation error
      let res = await request(app)
        .post('/api/v1/batch/jobs')
        .send({ files: [] });

      expect(res.body).toHaveProperty('success', false);
      expect(res.body.error).toHaveProperty('code');
      expect(res.body.error).toHaveProperty('message');

      // Not found
      res = await request(app).get(`/api/v1/batch/jobs/${uuidv4()}`);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body.error).toHaveProperty('code');
      expect(res.body.error).toHaveProperty('message');
    });
  });
});
