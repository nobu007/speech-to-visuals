/**
 * Integration Test: Export Job Edge Cases & Error Handling (Phase 106)
 *
 * Verifies robustness of the export job REST API through the registered router:
 *   - Validation errors (missing fields, invalid UUID, invalid priority)
 *   - Queue full → 503
 *   - Job not found → 404
 *   - Cancel terminal job → 409
 *   - Bounded retention prevents unbounded memory growth
 *   - Running job cancellation
 *   - ETA and queue position accuracy
 */

import express from 'express';
import request from 'supertest';
import { jest } from '@jest/globals';
import { ExportArtifactStore } from '../../src/export/export-artifact-store';
import { ExportJobQueue } from '../../src/export/export-job-queue';
import { createExportJobRouter } from '../../src/api/routes/export-jobs';

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

function createTestServer(options?: {
  maxQueueSize?: number;
  maxCompletedJobs?: number;
}) {
  const artifactStore = new ExportArtifactStore({
    maxArtifacts: 50,
    maxStorageBytes: 10 * 1024 * 1024,
    defaultTtlMs: 5 * 60_000,
    downloadUrlTtlMs: 60_000,
    cleanupIntervalMs: 60_000,
  });

  const jobQueue = new ExportJobQueue(
    {
      maxConcurrent: 2,
      maxQueueSize: options?.maxQueueSize ?? 20,
      starvationPreventionInterval: 60_000,
      maxCompletedJobs: options?.maxCompletedJobs ?? 500,
      maxRetries: 0,
    },
    undefined,
    artifactStore,
  );

  const app = express();
  app.use(express.json());
  app.use('/api/v1/export', createExportJobRouter(jobQueue));

  return { app, jobQueue, artifactStore };
}

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Validation errors
// ---------------------------------------------------------------------------

describe('Export Job Validation Errors', () => {
  test('POST without format returns 400', async () => {
    const { app } = createTestServer();

    const res = await request(app)
      .post('/api/v1/export/jobs')
      .send({ inputHash: 'abc' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('POST without inputHash returns 400', async () => {
    const { app } = createTestServer();

    const res = await request(app)
      .post('/api/v1/export/jobs')
      .send({ format: 'mp4' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('inputHash');
  });

  test('POST with non-string format returns 400', async () => {
    const { app } = createTestServer();

    const res = await request(app)
      .post('/api/v1/export/jobs')
      .send({ format: 123, inputHash: 'abc' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('GET with invalid UUID returns 400', async () => {
    const { app } = createTestServer();

    const res = await request(app).get('/api/v1/export/jobs/not-a-uuid');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('UUID');
  });

  test('DELETE with invalid UUID returns 400', async () => {
    const { app } = createTestServer();

    const res = await request(app).delete('/api/v1/export/jobs/xyz');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('empty string format returns 400', async () => {
    const { app } = createTestServer();

    const res = await request(app)
      .post('/api/v1/export/jobs')
      .send({ format: '', inputHash: 'abc' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('whitespace-only format returns 400', async () => {
    const { app } = createTestServer();

    const res = await request(app)
      .post('/api/v1/export/jobs')
      .send({ format: '   ', inputHash: 'abc' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('empty string inputHash returns 400', async () => {
    const { app } = createTestServer();

    const res = await request(app)
      .post('/api/v1/export/jobs')
      .send({ format: 'mp4', inputHash: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('inputHash');
  });

  test('whitespace-only inputHash returns 400', async () => {
    const { app } = createTestServer();

    const res = await request(app)
      .post('/api/v1/export/jobs')
      .send({ format: 'mp4', inputHash: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('inputHash');
  });

  test('invalid priority falls back to normal', async () => {
    const { app } = createTestServer();

    const res = await request(app)
      .post('/api/v1/export/jobs')
      .send({ format: 'mp4', inputHash: 'test-prio', priority: 'urgent' });

    expect(res.status).toBe(201);
    expect(res.body.data.priority).toBe('normal');
  });
});

// ---------------------------------------------------------------------------
// Not found & conflict errors
// ---------------------------------------------------------------------------

describe('Export Job Not Found & Conflict Errors', () => {
  test('GET non-existent job returns 404', async () => {
    const { app } = createTestServer();

    const fakeId = '00000000-0000-4000-a000-000000000000';
    const res = await request(app).get(`/api/v1/export/jobs/${fakeId}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('JOB_NOT_FOUND');
  });

  test('DELETE non-existent job returns 404', async () => {
    const { app } = createTestServer();

    const fakeId = '00000000-0000-4000-a000-000000000000';
    const res = await request(app).delete(`/api/v1/export/jobs/${fakeId}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('JOB_NOT_FOUND');
  });

  test('DELETE completed job returns 409', async () => {
    const { app, jobQueue } = createTestServer();

    const createRes = await request(app)
      .post('/api/v1/export/jobs')
      .send({ format: 'mp4', inputHash: 'conflict-test' });

    const jobId = createRes.body.data.jobId;

    // Complete the job
    jobQueue.dequeue();
    jobQueue.completeJob(jobId, true, { data: new Uint8Array(16), sizeBytes: 16 });

    // Attempt cancel on terminal job
    const cancelRes = await request(app).delete(`/api/v1/export/jobs/${jobId}`);

    expect(cancelRes.status).toBe(409);
    expect(cancelRes.body.error.code).toBe('JOB_ALREADY_TERMINATED');
    expect(cancelRes.body.error.message).toContain('completed');
  });

  test('DELETE dead-lettered job returns 409', async () => {
    const { app, jobQueue } = createTestServer();

    const createRes = await request(app)
      .post('/api/v1/export/jobs')
      .send({ format: 'svg', inputHash: 'fail-conflict' });

    const jobId = createRes.body.data.jobId;
    jobQueue.dequeue();
    jobQueue.completeJob(jobId, false);

    const cancelRes = await request(app).delete(`/api/v1/export/jobs/${jobId}`);

    expect(cancelRes.status).toBe(409);
    expect(cancelRes.body.error.message).toContain('dead-lettered');
  });
});

// ---------------------------------------------------------------------------
// Queue full scenario
// ---------------------------------------------------------------------------

describe('Export Job Queue Full', () => {
  test('POST returns 503 when queue is full', async () => {
    const { app } = createTestServer({ maxQueueSize: 3 });

    // Fill the queue to capacity
    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post('/api/v1/export/jobs')
        .send({ format: 'mp4', inputHash: `full-${i}` });
      expect(res.status).toBe(201);
    }

    // Next enqueue should be rejected
    const rejected = await request(app)
      .post('/api/v1/export/jobs')
      .send({ format: 'mp4', inputHash: 'overflow' });

    expect(rejected.status).toBe(503);
    expect(rejected.body.error.code).toBe('QUEUE_FULL');
  });
});

// ---------------------------------------------------------------------------
// Running job cancellation
// ---------------------------------------------------------------------------

describe('Export Job Running Cancel', () => {
  test('cancel a running job via DELETE', async () => {
    const { app, jobQueue } = createTestServer();

    const createRes = await request(app)
      .post('/api/v1/export/jobs')
      .send({ format: 'mp4', inputHash: 'cancel-running' });

    const jobId = createRes.body.data.jobId;

    // Start the job (move to running)
    jobQueue.dequeue();

    // Cancel while running
    const cancelRes = await request(app).delete(`/api/v1/export/jobs/${jobId}`);
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.cancelled).toBe(true);

    // Verify status is cancelled
    const statusRes = await request(app).get(`/api/v1/export/jobs/${jobId}`);
    expect(statusRes.body.data.status).toBe('cancelled');
    expect(statusRes.body.data.completedAt).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Bounded retention of terminal jobs
// ---------------------------------------------------------------------------

describe('Export Job Bounded Retention', () => {
  test('terminal jobs beyond maxCompletedJobs are pruned', () => {
    const { jobQueue } = createTestServer({ maxCompletedJobs: 5 });

    // Enqueue, dequeue, and complete 10 jobs
    for (let i = 0; i < 10; i++) {
      const job = jobQueue.enqueue({
        priority: 'normal',
        format: 'svg',
        inputHash: `retention-${i}`,
      });
      jobQueue.dequeue();
      jobQueue.completeJob(job.jobId, true, {
        data: new Uint8Array(8),
        sizeBytes: 8,
      });
    }

    const stats = jobQueue.getQueueStats();
    expect(stats.completed).toBe(5); // Only 5 retained
    expect(stats.queued).toBe(0);
    expect(stats.running).toBe(0);
  });

  test('pruned jobs are no longer findable via findJob', () => {
    const { jobQueue } = createTestServer({ maxCompletedJobs: 3 });

    const jobIds: string[] = [];
    for (let i = 0; i < 5; i++) {
      const job = jobQueue.enqueue({
        priority: 'normal',
        format: 'mp4',
        inputHash: `prune-${i}`,
      });
      jobIds.push(job.jobId);
      jobQueue.dequeue();
      jobQueue.completeJob(job.jobId, true, {
        data: new Uint8Array(4),
        sizeBytes: 4,
      });
    }

    // Oldest 2 jobs should have been pruned
    expect(jobQueue.findJob(jobIds[0])).toBeUndefined();
    expect(jobQueue.findJob(jobIds[1])).toBeUndefined();

    // Newest 3 should still be findable
    expect(jobQueue.findJob(jobIds[2])).toBeDefined();
    expect(jobQueue.findJob(jobIds[3])).toBeDefined();
    expect(jobQueue.findJob(jobIds[4])).toBeDefined();
  });

  test('cancelled jobs are also subject to pruning', () => {
    const { jobQueue } = createTestServer({ maxCompletedJobs: 3 });

    const jobIds: string[] = [];
    for (let i = 0; i < 5; i++) {
      const job = jobQueue.enqueue({
        priority: 'low',
        format: 'png',
        inputHash: `cancel-prune-${i}`,
      });
      jobIds.push(job.jobId);
      jobQueue.cancel(job.jobId);
    }

    const stats = jobQueue.getQueueStats();
    expect(stats.cancelled).toBe(3); // Only 3 retained
    expect(jobQueue.findJob(jobIds[0])).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// ETA and queue position accuracy
// ---------------------------------------------------------------------------

describe('Export Job Queue Position & ETA', () => {
  test('queue position updates as jobs are dequeued', async () => {
    const { app, jobQueue } = createTestServer();

    // Enqueue 3 jobs
    const jobIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post('/api/v1/export/jobs')
        .send({ format: 'svg', inputHash: `pos-${i}` });
      jobIds.push(res.body.data.jobId);
    }

    // Check positions
    let status0 = await request(app).get(`/api/v1/export/jobs/${jobIds[0]}`);
    expect(status0.body.data.queuePosition).toBe(0);

    let status2 = await request(app).get(`/api/v1/export/jobs/${jobIds[2]}`);
    expect(status2.body.data.queuePosition).toBe(2);

    // Dequeue first job
    jobQueue.dequeue();

    // Positions shift
    status0 = await request(app).get(`/api/v1/export/jobs/${jobIds[1]}`);
    expect(status0.body.data.queuePosition).toBe(0);

    status2 = await request(app).get(`/api/v1/export/jobs/${jobIds[2]}`);
    expect(status2.body.data.queuePosition).toBe(1);
  });

  test('running and completed jobs have null queue position', async () => {
    const { app, jobQueue } = createTestServer();

    const createRes = await request(app)
      .post('/api/v1/export/jobs')
      .send({ format: 'mp4', inputHash: 'running-pos' });

    const jobId = createRes.body.data.jobId;
    jobQueue.dequeue();

    const statusRes = await request(app).get(`/api/v1/export/jobs/${jobId}`);
    expect(statusRes.body.data.status).toBe('running');
    expect(statusRes.body.data.queuePosition).toBeNull();
    expect(statusRes.body.data.estimatedWaitTimeMs).toBe(0);
  });
});
