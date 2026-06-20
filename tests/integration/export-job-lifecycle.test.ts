/**
 * Integration Test: Export Job Full Lifecycle via Server Wiring (Phase 105)
 *
 * Verifies the end-to-end export job lifecycle through the registered router,
 * exercising the same wiring as src/api/server.ts:
 *   ExportArtifactStore + ExportJobQueue + createExportJobRouter
 *
 * Covers:
 *   - Create job (POST) → Status check (GET) → Simulate processing → Completed status (GET)
 *   - Artifact auto-save on job completion (artifactId appears in status response)
 *   - Priority ordering visible through HTTP API
 *   - Cancel flow through HTTP
 *   - Multiple jobs with mixed priorities
 */

import express from 'express';
import request from 'supertest';
import { jest } from '@jest/globals';
import { ExportArtifactStore } from '../../src/export/export-artifact-store';
import { ExportJobQueue } from '../../src/export/export-job-queue';
import { createExportJobRouter } from '../../src/api/routes/export-jobs';

// ---------------------------------------------------------------------------
// Test harness: replicate server.ts wiring without security middleware
// ---------------------------------------------------------------------------

function createTestServer() {
  const artifactStore = new ExportArtifactStore({
    maxArtifacts: 50,
    maxStorageBytes: 10 * 1024 * 1024,
    defaultTtlMs: 5 * 60_000,
    downloadUrlTtlMs: 60_000,
    cleanupIntervalMs: 60_000,
  });

  const jobQueue = new ExportJobQueue(
    { maxConcurrent: 3, maxQueueSize: 20, starvationPreventionInterval: 60_000, maxRetries: 0 },
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
// Full lifecycle: Create → Status (queued) → Process → Status (completed)
// ---------------------------------------------------------------------------

describe('Export Job Full Lifecycle Integration', () => {
  test('create → check queued → simulate completion → verify completed with artifactId', async () => {
    const { app, jobQueue } = createTestServer();

    // Step 1: Create job via POST
    const createRes = await request(app)
      .post('/api/v1/export/jobs')
      .send({ format: 'mp4', inputHash: 'test-lifecycle-001', priority: 'normal' });

    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);
    expect(createRes.body.data.jobId).toMatch(UUID_V4_RE);
    expect(createRes.body.data.status).toBe('queued');

    const jobId = createRes.body.data.jobId;

    // Step 2: Check status while queued
    const queuedRes = await request(app).get(`/api/v1/export/jobs/${jobId}`);

    expect(queuedRes.status).toBe(200);
    expect(queuedRes.body.data.jobId).toBe(jobId);
    expect(queuedRes.body.data.status).toBe('queued');
    expect(queuedRes.body.data.artifactId).toBeNull();
    expect(queuedRes.body.data.startedAt).toBeNull();
    expect(queuedRes.body.data.completedAt).toBeNull();

    // Step 3: Simulate worker picking up and completing the job
    const dequeued = jobQueue.dequeue();
    expect(dequeued).toBeDefined();
    expect(dequeued!.jobId).toBe(jobId);

    // Verify status is now "running"
    const runningRes = await request(app).get(`/api/v1/export/jobs/${jobId}`);
    expect(runningRes.body.data.status).toBe('running');
    expect(runningRes.body.data.startedAt).toBeGreaterThan(0);

    // Complete the job with artifact data
    const artifactData = new Uint8Array(512);
    const completed = jobQueue.completeJob(jobId, true, {
      data: artifactData,
      sizeBytes: 512,
    });
    expect(completed).toBe(true);

    // Step 4: Verify completed status with artifactId
    const finalRes = await request(app).get(`/api/v1/export/jobs/${jobId}`);

    expect(finalRes.status).toBe(200);
    expect(finalRes.body.data.status).toBe('completed');
    expect(finalRes.body.data.artifactId).toBeDefined();
    expect(finalRes.body.data.artifactId).toMatch(UUID_V4_RE);
    expect(finalRes.body.data.completedAt).toBeGreaterThan(0);
    expect(finalRes.body.data.estimatedWaitTimeMs).toBe(0);
  });

  test('create → simulate failure → verify failed status without artifactId', async () => {
    const { app, jobQueue } = createTestServer();

    // Create
    const createRes = await request(app)
      .post('/api/v1/export/jobs')
      .send({ format: 'svg', inputHash: 'test-lifecycle-fail' });

    const jobId = createRes.body.data.jobId;

    // Simulate worker failure
    jobQueue.dequeue();
    jobQueue.completeJob(jobId, false);

    // Verify failed status
    const statusRes = await request(app).get(`/api/v1/export/jobs/${jobId}`);

    expect(statusRes.body.data.status).toBe('dead-lettered');
    expect(statusRes.body.data.artifactId).toBeNull();
    expect(statusRes.body.data.completedAt).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Priority ordering through HTTP API
// ---------------------------------------------------------------------------

describe('Export Job Priority Ordering via HTTP', () => {
  test('high-priority job is dequeued before normal-priority job', async () => {
    const { app, jobQueue } = createTestServer();

    // Enqueue normal-priority job first
    const normalRes = await request(app)
      .post('/api/v1/export/jobs')
      .send({ format: 'mp4', inputHash: 'hash-normal', priority: 'normal' });

    // Enqueue high-priority job second
    const highRes = await request(app)
      .post('/api/v1/export/jobs')
      .send({ format: 'mp4', inputHash: 'hash-high', priority: 'high' });

    expect(normalRes.body.data.queuePosition).toBe(0);
    expect(highRes.body.data.queuePosition).toBe(0); // High priority jumps to front

    // Dequeue should return the high-priority job first
    const firstDequeued = jobQueue.dequeue();
    expect(firstDequeued!.jobId).toBe(highRes.body.data.jobId);

    const secondDequeued = jobQueue.dequeue();
    expect(secondDequeued!.jobId).toBe(normalRes.body.data.jobId);
  });

  test('multiple jobs with same priority maintain FIFO order', async () => {
    const { app, jobQueue } = createTestServer();

    const jobs: string[] = [];
    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post('/api/v1/export/jobs')
        .send({ format: 'svg', inputHash: `fifo-${i}`, priority: 'normal' });
      jobs.push(res.body.data.jobId);
    }

    // Dequeue in FIFO order
    for (let i = 0; i < 3; i++) {
      const dequeued = jobQueue.dequeue();
      expect(dequeued!.jobId).toBe(jobs[i]);
    }
  });
});

// ---------------------------------------------------------------------------
// Cancel lifecycle through HTTP
// ---------------------------------------------------------------------------

describe('Export Job Cancel via HTTP', () => {
  test('cancel a queued job, then verify it cannot be cancelled again', async () => {
    const { app } = createTestServer();

    // Create
    const createRes = await request(app)
      .post('/api/v1/export/jobs')
      .send({ format: 'mp4', inputHash: 'cancel-test' });

    const jobId = createRes.body.data.jobId;

    // Cancel via DELETE
    const cancelRes = await request(app).delete(`/api/v1/export/jobs/${jobId}`);
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.cancelled).toBe(true);

    // Verify status is "cancelled"
    const statusRes = await request(app).get(`/api/v1/export/jobs/${jobId}`);
    expect(statusRes.body.data.status).toBe('cancelled');

    // Second cancel attempt should return 409
    const secondCancelRes = await request(app).delete(`/api/v1/export/jobs/${jobId}`);
    expect(secondCancelRes.status).toBe(409);
    expect(secondCancelRes.body.error.code).toBe('JOB_ALREADY_TERMINATED');
  });
});

// ---------------------------------------------------------------------------
// Artifact store integration through HTTP API
// ---------------------------------------------------------------------------

describe('Export Job Artifact Store Integration via HTTP', () => {
  test('completed job artifactId is retrievable from store', async () => {
    const { app, jobQueue, artifactStore } = createTestServer();

    // Create and complete a job
    const createRes = await request(app)
      .post('/api/v1/export/jobs')
      .send({ format: 'mp4', inputHash: 'artifact-test' });

    const jobId = createRes.body.data.jobId;

    // Simulate completion with artifact data
    jobQueue.dequeue();
    const artifactBytes = new Uint8Array(128);
    jobQueue.completeJob(jobId, true, { data: artifactBytes, sizeBytes: 128 });

    // Get status to find artifactId
    const statusRes = await request(app).get(`/api/v1/export/jobs/${jobId}`);
    const artifactId = statusRes.body.data.artifactId;

    // Verify the artifact exists in the store
    const artifact = artifactStore.get(artifactId);
    expect(artifact).toBeDefined();
    expect(artifact!.format).toBe('mp4');
    expect(artifact!.sizeBytes).toBe(128);
    expect(artifact!.metadata?.jobId).toBe(jobId);
  });

  test('multiple completed jobs each get distinct artifactIds', async () => {
    const { app, jobQueue, artifactStore } = createTestServer();

    const artifactIds: string[] = [];

    for (let i = 0; i < 3; i++) {
      const createRes = await request(app)
        .post('/api/v1/export/jobs')
        .send({ format: 'svg', inputHash: `multi-${i}` });

      const jobId = createRes.body.data.jobId;
      jobQueue.dequeue();
      jobQueue.completeJob(jobId, true, {
        data: new Uint8Array(32),
        sizeBytes: 32,
      });

      const statusRes = await request(app).get(`/api/v1/export/jobs/${jobId}`);
      artifactIds.push(statusRes.body.data.artifactId);
    }

    // All artifactIds should be unique
    expect(new Set(artifactIds).size).toBe(3);

    // All should be retrievable from the store
    expect(artifactStore.size).toBe(3);
  });
});
