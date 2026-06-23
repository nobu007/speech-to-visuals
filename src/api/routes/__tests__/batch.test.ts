/**
 * Tests for batch processing API routes (TASK-0046)
 *
 * Tests cover:
 * - BatchJobManager: createJob, getJobStatus, cancelJob, pruning, concurrency
 * - Route handlers: POST /jobs, GET /jobs/:jobId, POST /jobs/:jobId/cancel
 * - Error classes and status codes
 * - UUID v4 validation
 * - File validation, preset validation, file count limits
 */

import {
  BatchJobManager,
  BatchValidationError,
  TooManyFilesError,
  JobNotFoundError,
  JobAlreadyCompletedError,
  createBatchRouter,
  type JobState,
} from '../batch';
import { BATCH_LIMITS } from '../../../config/limits';
import http from 'http';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Create a mock Express Request */
function mockReq(overrides: Record<string, unknown> = {}): any {
  return {
    body: {},
    params: {},
    ...overrides,
  };
}

/** Create a mock Express Response that captures status and json */
function mockRes(): any {
  const res: any = {
    statusCode: 200,
    body: null as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: unknown) {
      this.body = data;
      return this;
    },
  };
  return res;
}

/** Create a valid file object */
function makeFile(name: string = 'audio.mp3', size: number = 1000) {
  return { name, path: `/input/${name}`, size };
}

// ---------------------------------------------------------------------------
// BatchJobManager tests
// ---------------------------------------------------------------------------

describe('BatchJobManager', () => {
  let manager: BatchJobManager;

  beforeEach(() => {
    manager = new BatchJobManager();
  });

  // -------------------------------------------------------------------------
  // createJob
  // -------------------------------------------------------------------------

  describe('createJob', () => {
    test('creates job with UUID v4 id', () => {
      const jobId = manager.createJob([makeFile()]);
      expect(jobId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    test('initializes with queued status', () => {
      const jobId = manager.createJob([makeFile()]);
      const status = manager.getJobStatus(jobId);
      expect(status?.status).toBe('queued');
    });

    test('sets progress with correct file count', () => {
      const jobId = manager.createJob([makeFile('a.mp3'), makeFile('b.mp3'), makeFile('c.mp3')]);
      const status = manager.getJobStatus(jobId);
      expect(status?.progress.total).toBe(3);
      expect(status?.progress.completed).toBe(0);
      expect(status?.progress.failed).toBe(0);
      expect(status?.progress.percentage).toBe(0);
    });

    test('stores preset when provided', () => {
      const jobId = manager.createJob([makeFile()], 'fast');
      const status = manager.getJobStatus(jobId);
      expect(status?.preset).toBe('fast');
    });

    test('omits preset when not provided', () => {
      const jobId = manager.createJob([makeFile()]);
      const status = manager.getJobStatus(jobId);
      expect(status?.preset).toBeUndefined();
    });

    test('stores options when provided', () => {
      const opts = { quality: 'high', format: 'mp4' };
      const jobId = manager.createJob([makeFile()], undefined, opts);
      const status = manager.getJobStatus(jobId);
      expect(status?.options).toEqual(opts);
    });
  });

  // -------------------------------------------------------------------------
  // getJobStatus
  // -------------------------------------------------------------------------

  describe('getJobStatus', () => {
    test('returns status for existing job', () => {
      const jobId = manager.createJob([makeFile()]);
      const status = manager.getJobStatus(jobId);
      expect(status).not.toBeNull();
      expect(status?.jobId).toBe(jobId);
    });

    test('returns null for non-existent job', () => {
      expect(manager.getJobStatus('nonexistent-id')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // getCancelToken
  // -------------------------------------------------------------------------

  describe('getCancelToken', () => {
    test('returns cancel token for existing job', () => {
      const jobId = manager.createJob([makeFile()]);
      const token = manager.getCancelToken(jobId);
      expect(token).not.toBeNull();
      expect(token?.cancelled).toBe(false);
    });

    test('returns null for non-existent job', () => {
      expect(manager.getCancelToken('nonexistent')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // updateJobStatus
  // -------------------------------------------------------------------------

  describe('updateJobStatus', () => {
    test('updates job status fields', () => {
      const jobId = manager.createJob([makeFile()]);
      manager.updateJobStatus(jobId, {
        status: 'processing',
        startedAt: '2024-01-01T00:00:00Z',
      });
      const status = manager.getJobStatus(jobId);
      expect(status?.status).toBe('processing');
      expect(status?.startedAt).toBe('2024-01-01T00:00:00Z');
    });

    test('updates progress fields', () => {
      const jobId = manager.createJob([makeFile('a.mp3'), makeFile('b.mp3')]);
      manager.updateJobStatus(jobId, {
        progress: { total: 2, completed: 1, failed: 0, percentage: 50 },
      });
      const status = manager.getJobStatus(jobId);
      expect(status?.progress.percentage).toBe(50);
    });

    test('is no-op for non-existent job', () => {
      expect(() => manager.updateJobStatus('nonexistent', { status: 'completed' })).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // cancelJob
  // -------------------------------------------------------------------------

  describe('cancelJob', () => {
    test('cancels queued job', () => {
      const jobId = manager.createJob([makeFile()]);
      const result = manager.cancelJob(jobId);
      expect(result).toBe(true);
      expect(manager.getJobStatus(jobId)?.status).toBe('cancelled');
      expect(manager.getCancelToken(jobId)?.cancelled).toBe(true);
    });

    test('cancels processing job', () => {
      const jobId = manager.createJob([makeFile()]);
      manager.updateJobStatus(jobId, { status: 'processing' });
      expect(manager.cancelJob(jobId)).toBe(true);
      expect(manager.getJobStatus(jobId)?.status).toBe('cancelled');
    });

    test('sets completedAt on cancel', () => {
      const jobId = manager.createJob([makeFile()]);
      manager.cancelJob(jobId);
      expect(manager.getJobStatus(jobId)?.completedAt).toBeDefined();
    });

    test('returns not_found for non-existent job', () => {
      expect(manager.cancelJob('nonexistent')).toBe('not_found');
    });

    test('returns already_terminal for completed job', () => {
      const jobId = manager.createJob([makeFile()]);
      manager.updateJobStatus(jobId, { status: 'completed' });
      expect(manager.cancelJob(jobId)).toBe('already_terminal');
    });

    test('returns already_terminal for failed job', () => {
      const jobId = manager.createJob([makeFile()]);
      manager.updateJobStatus(jobId, { status: 'failed' });
      expect(manager.cancelJob(jobId)).toBe('already_terminal');
    });

    test('returns already_terminal for already cancelled job', () => {
      const jobId = manager.createJob([makeFile()]);
      manager.cancelJob(jobId);
      expect(manager.cancelJob(jobId)).toBe('already_terminal');
    });
  });

  // -------------------------------------------------------------------------
  // Concurrency control
  // -------------------------------------------------------------------------

  describe('concurrency control', () => {
    test('getRunningCount returns 0 initially', () => {
      expect(manager.getRunningCount()).toBe(0);
    });

    test('getRunningCount counts processing jobs', () => {
      const id1 = manager.createJob([makeFile()]);
      const id2 = manager.createJob([makeFile()]);
      manager.updateJobStatus(id1, { status: 'processing' });
      manager.updateJobStatus(id2, { status: 'processing' });
      expect(manager.getRunningCount()).toBe(2);
    });

    test('getQueuedCount returns queued jobs', () => {
      manager.createJob([makeFile('a.mp3')]);
      manager.createJob([makeFile('b.mp3')]);
      expect(manager.getQueuedCount()).toBe(2);
    });

    test('startNextQueuedJob starts first queued job', () => {
      const id1 = manager.createJob([makeFile('a.mp3')]);
      manager.createJob([makeFile('b.mp3')]);
      const started = manager.startNextQueuedJob();
      expect(started).toBe(id1);
      expect(manager.getJobStatus(id1)?.status).toBe('processing');
      expect(manager.getJobStatus(id1)?.startedAt).toBeDefined();
    });

    test('startNextQueuedJob returns null when max concurrency reached', () => {
      for (let i = 0; i < BATCH_LIMITS.MAX_CONCURRENT_JOBS; i++) {
        const id = manager.createJob([makeFile(`a${i}.mp3`)]);
        manager.updateJobStatus(id, { status: 'processing' });
      }
      manager.createJob([makeFile('queued.mp3')]);
      expect(manager.startNextQueuedJob()).toBeNull();
    });

    test('startNextQueuedJob returns null when no queued jobs', () => {
      expect(manager.startNextQueuedJob()).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Pruning
  // -------------------------------------------------------------------------

  describe('pruneOldJobs', () => {
    test('prunes terminal jobs when exceeding MAX_STORED_JOBS', () => {
      // Create and complete many jobs
      for (let i = 0; i < 5; i++) {
        const id = manager.createJob([makeFile(`f${i}.mp3`)]);
        manager.updateJobStatus(id, { status: 'completed' });
      }
      // Create more jobs to exceed limit — pruneOldJobs runs before each createJob,
      // so after pruning terminal jobs to reach MAX_STORED_JOBS, the new job is added
      // making the total MAX_STORED_JOBS + 1 at most.
      for (let i = 0; i < BATCH_LIMITS.MAX_STORED_JOBS + 1; i++) {
        manager.createJob([makeFile(`batch${i}.mp3`)]);
      }
      // Pruning removes terminal jobs; size may be MAX + 1 because prune runs before add
      expect(manager.jobs.size).toBeLessThanOrEqual(BATCH_LIMITS.MAX_STORED_JOBS + 1);
    });
  });
});

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

describe('Error classes', () => {
  test('BatchValidationError has correct status and code', () => {
    const err = new BatchValidationError('test error');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.message).toBe('test error');
    expect(err.name).toBe('BatchValidationError');
  });

  test('TooManyFilesError has correct status and code', () => {
    const err = new TooManyFilesError();
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe('TOO_MANY_FILES');
    expect(err.message).toContain(String(BATCH_LIMITS.MAX_FILES_PER_BATCH));
    expect(err.name).toBe('TooManyFilesError');
  });

  test('JobNotFoundError has correct status and code', () => {
    const err = new JobNotFoundError('abc-123');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('JOB_NOT_FOUND');
    expect(err.message).toContain('abc-123');
    expect(err.name).toBe('JobNotFoundError');
  });

  test('JobAlreadyCompletedError has correct status and code', () => {
    const err = new JobAlreadyCompletedError('abc-123');
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('JOB_ALREADY_COMPLETED');
    expect(err.message).toContain('abc-123');
    expect(err.name).toBe('JobAlreadyCompletedError');
  });
});

// ---------------------------------------------------------------------------
// Route handler tests
// ---------------------------------------------------------------------------

describe('createBatchRouter', () => {
  let manager: BatchJobManager;
  let router: ReturnType<typeof createBatchRouter>;

  beforeEach(() => {
    manager = new BatchJobManager();
    router = createBatchRouter(manager);
  });

  /** Helper to call a route handler */
  function callRoute(method: 'post' | 'get', path: string, reqOverrides: Record<string, unknown> = {}) {
    return new Promise<{ res: any }>((resolve) => {
      const req = mockReq({ method: method.toUpperCase(), url: path, ...reqOverrides });
      const res = mockRes();
      // Find matching route handler
      (router as any).stack.forEach((layer: any) => {
        if (layer.route) {
          const routePath = layer.route.path;
          const routeMethod = layer.route.stack[0].method;
          if (routeMethod === method && pathMatches(routePath, path)) {
            layer.route.stack[0].handle(req, res);
          }
        }
      });
      resolve({ res });
    });
  }

  test('router is defined', () => {
    expect(router).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // POST /jobs
  // -------------------------------------------------------------------------

  describe('POST /jobs', () => {
    test('creates job and returns 202', () => {
      const req = mockReq({
        body: { files: [makeFile()] },
      });
      const res = mockRes();

      // Directly call the handler
      (router as any).stack.forEach((layer: any) => {
        if (layer.route?.path === '/jobs' && layer.route.stack[0].method === 'post') {
          layer.route.stack[0].handle(req, res);
        }
      });

      expect(res.statusCode).toBe(202);
      expect(res.body.success).toBe(true);
      expect(res.body.data.jobId).toBeDefined();
      expect(res.body.data.status).toBe('queued');
    });

    test('returns 400 when files is missing', () => {
      const req = mockReq({ body: {} });
      const res = mockRes();

      (router as any).stack.forEach((layer: any) => {
        if (layer.route?.path === '/jobs' && layer.route.stack[0].method === 'post') {
          layer.route.stack[0].handle(req, res);
        }
      });

      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('files');
    });

    test('returns 400 when files is empty array', () => {
      const req = mockReq({ body: { files: [] } });
      const res = mockRes();

      (router as any).stack.forEach((layer: any) => {
        if (layer.route?.path === '/jobs' && layer.route.stack[0].method === 'post') {
          layer.route.stack[0].handle(req, res);
        }
      });

      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('returns 400 when file object missing name', () => {
      const req = mockReq({
        body: { files: [{ path: '/input/test' }] },
      });
      const res = mockRes();

      (router as any).stack.forEach((layer: any) => {
        if (layer.route?.path === '/jobs' && layer.route.stack[0].method === 'post') {
          layer.route.stack[0].handle(req, res);
        }
      });

      expect(res.statusCode).toBe(400);
      expect(res.body.error.message).toContain('name');
    });

    test('returns 429 when too many files', () => {
      const files = Array(BATCH_LIMITS.MAX_FILES_PER_BATCH + 1)
        .fill(null)
        .map((_, i) => makeFile(`file${i}.mp3`));

      const req = mockReq({ body: { files } });
      const res = mockRes();

      (router as any).stack.forEach((layer: any) => {
        if (layer.route?.path === '/jobs' && layer.route.stack[0].method === 'post') {
          layer.route.stack[0].handle(req, res);
        }
      });

      expect(res.statusCode).toBe(429);
      expect(res.body.error.code).toBe('TOO_MANY_FILES');
    });

    test('returns 400 for invalid preset', () => {
      const req = mockReq({
        body: { files: [makeFile()], preset: 'invalid' },
      });
      const res = mockRes();

      (router as any).stack.forEach((layer: any) => {
        if (layer.route?.path === '/jobs' && layer.route.stack[0].method === 'post') {
          layer.route.stack[0].handle(req, res);
        }
      });

      expect(res.statusCode).toBe(400);
      expect(res.body.error.message).toContain('preset');
    });

    test('accepts valid preset', () => {
      for (const preset of ['fast', 'balanced', 'quality', 'custom']) {
        const req = mockReq({
          body: { files: [makeFile()], preset },
        });
        const res = mockRes();

        (router as any).stack.forEach((layer: any) => {
          if (layer.route?.path === '/jobs' && layer.route.stack[0].method === 'post') {
            layer.route.stack[0].handle(req, res);
          }
        });

        expect(res.statusCode).toBe(202);
      }
    });
  });

  // -------------------------------------------------------------------------
  // GET /jobs/:jobId
  // -------------------------------------------------------------------------

  describe('GET /jobs/:jobId', () => {
    test('returns 200 with job status', () => {
      const jobId = manager.createJob([makeFile()]);
      const req = mockReq({ params: { jobId } });
      const res = mockRes();

      (router as any).stack.forEach((layer: any) => {
        if (layer.route?.path === '/jobs/:jobId' && layer.route.stack[0].method === 'get') {
          layer.route.stack[0].handle(req, res);
        }
      });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.jobId).toBe(jobId);
    });

    test('returns 400 for invalid UUID', () => {
      const req = mockReq({ params: { jobId: 'not-a-uuid' } });
      const res = mockRes();

      (router as any).stack.forEach((layer: any) => {
        if (layer.route?.path === '/jobs/:jobId' && layer.route.stack[0].method === 'get') {
          layer.route.stack[0].handle(req, res);
        }
      });

      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('UUID');
    });

    test('returns 404 for non-existent job', () => {
      const req = mockReq({
        params: { jobId: '550e8400-e29b-41d4-a716-446655440000' },
      });
      const res = mockRes();

      (router as any).stack.forEach((layer: any) => {
        if (layer.route?.path === '/jobs/:jobId' && layer.route.stack[0].method === 'get') {
          layer.route.stack[0].handle(req, res);
        }
      });

      expect(res.statusCode).toBe(404);
      expect(res.body.error.code).toBe('JOB_NOT_FOUND');
    });
  });

  // -------------------------------------------------------------------------
  // POST /jobs/:jobId/cancel
  // -------------------------------------------------------------------------

  describe('POST /jobs/:jobId/cancel', () => {
    test('returns 200 when cancelling queued job', () => {
      const jobId = manager.createJob([makeFile()]);
      const req = mockReq({ params: { jobId } });
      const res = mockRes();

      (router as any).stack.forEach((layer: any) => {
        if (layer.route?.path === '/jobs/:jobId/cancel' && layer.route.stack[0].method === 'post') {
          layer.route.stack[0].handle(req, res);
        }
      });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.status).toBe('cancelled');
    });

    test('returns 400 for invalid UUID', () => {
      const req = mockReq({ params: { jobId: 'bad-id' } });
      const res = mockRes();

      (router as any).stack.forEach((layer: any) => {
        if (layer.route?.path === '/jobs/:jobId/cancel' && layer.route.stack[0].method === 'post') {
          layer.route.stack[0].handle(req, res);
        }
      });

      expect(res.statusCode).toBe(400);
    });

    test('returns 404 for non-existent job', () => {
      const req = mockReq({
        params: { jobId: '550e8400-e29b-41d4-a716-446655440000' },
      });
      const res = mockRes();

      (router as any).stack.forEach((layer: any) => {
        if (layer.route?.path === '/jobs/:jobId/cancel' && layer.route.stack[0].method === 'post') {
          layer.route.stack[0].handle(req, res);
        }
      });

      expect(res.statusCode).toBe(404);
    });

    test('returns 409 for already completed job', () => {
      const jobId = manager.createJob([makeFile()]);
      manager.updateJobStatus(jobId, { status: 'completed' });

      const req = mockReq({ params: { jobId } });
      const res = mockRes();

      (router as any).stack.forEach((layer: any) => {
        if (layer.route?.path === '/jobs/:jobId/cancel' && layer.route.stack[0].method === 'post') {
          layer.route.stack[0].handle(req, res);
        }
      });

      expect(res.statusCode).toBe(409);
      expect(res.body.error.code).toBe('JOB_ALREADY_COMPLETED');
    });
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check if route path matches URL path */
function pathMatches(routePath: string, urlPath: string): boolean {
  if (routePath === urlPath) return true;
  // Handle parameterized routes like /jobs/:jobId
  const routeParts = routePath.split('/');
  const urlParts = urlPath.split('/');
  if (routeParts.length !== urlParts.length) return false;
  return routeParts.every((rp, i) => rp.startsWith(':') || rp === urlParts[i]);
}
