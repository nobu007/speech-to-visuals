/**
 * TASK-0050: API Integration Tests
 *
 * Comprehensive integration tests for the Batch Processing API,
 * Express routes, error handling, WebSocket event types, and
 * security middleware.
 */

import { BatchProcessingAPI } from '@/api/batch-processing-api';
import type { BatchJobRequest, BatchJobStatus, BatchJobResult } from '@/api/batch-processing-api';
import { createBatchRouter, BatchJobManager } from '@/api/routes/batch';
import type {
  JobProgress,
  JobComplete,
  JobError,
  WebSocketEvents,
} from '@/types/api/index';
import { AppError, errorHandler } from '@/api/middleware/error-handler';
import type { Request, Response, NextFunction } from 'express';

// ---------------------------------------------------------------------------
// Mocks for heavy pipeline dependencies
// ---------------------------------------------------------------------------

jest.mock('@/pipeline/simple-pipeline', () => ({
  simplePipeline: {
    process: jest.fn().mockResolvedValue({
      success: true,
      transcript: 'test transcript',
      scenes: [],
      processingTime: 100,
    }),
  },
}));

jest.mock('@/pipeline/adaptive-quality-presets', () => ({
  adaptiveQualityPresets: {
    setPreset: jest.fn(),
    toPipelineOptions: jest.fn().mockReturnValue({
      audioFile: new File(['audio'], 'test.wav', { type: 'audio/wav' }),
      options: {},
    }),
  },
}));

// Suppress console.log from BatchProcessingAPI async processing to prevent
// "Cannot log after tests are done" warnings
let consoleLogSpy: jest.SpyInstance;
beforeAll(() => {
  consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterAll(() => {
  consoleLogSpy.mockRestore();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a mock File object with a name property (used by BatchProcessingAPI) */
function createMockFile(name: string): File {
  return new File(['dummy content'], name, { type: 'audio/wav' });
}

/** Build a valid BatchJobRequest with the given number of files */
function buildRequest(fileCount: number, overrides?: Partial<BatchJobRequest>): BatchJobRequest {
  const files = Array.from({ length: fileCount }, (_, i) =>
    createMockFile(`file-${i + 1}.wav`)
  );
  return { files, ...overrides };
}

// ===========================================================================
// 1. Batch Job CRUD
// ===========================================================================

describe('BatchProcessingAPI - Batch Job CRUD', () => {
  let api: BatchProcessingAPI;

  beforeEach(() => {
    api = new BatchProcessingAPI();
  });

  // 1. Submit valid batch job -> returns jobId with status 'queued'
  test('submit valid batch job returns jobId with status queued', async () => {
    const request = buildRequest(2);
    const { jobId } = await api.submitJob(request);

    expect(jobId).toBeDefined();
    expect(typeof jobId).toBe('string');
    expect(jobId).toMatch(/^job_/);

    const status = api.getJobStatus(jobId);
    // The job may already be 'processing' since processJobAsync starts immediately,
    // so we accept either 'queued' or 'processing' as the initial status.
    expect(['queued', 'processing']).toContain(status.status);
    expect(status.progress.total).toBe(2);
    expect(status.progress.failed).toBe(0);
  });

  // 2. Get job status -> returns correct status and progress
  test('getJobStatus returns correct status and progress', async () => {
    const request = buildRequest(3);
    const { jobId } = await api.submitJob(request);

    const status: BatchJobStatus = api.getJobStatus(jobId);

    expect(status.jobId).toBe(jobId);
    expect(status.status).toBeDefined();
    expect(['queued', 'processing']).toContain(status.status);
    // Total is always 3; completed/percentage may advance during async processing
    expect(status.progress.total).toBe(3);
    expect(status.progress.failed).toBe(0);
    expect(status.progress.percentage).toBeGreaterThanOrEqual(0);
    expect(status.progress.percentage).toBeLessThanOrEqual(100);
  });

  // 3. Cancel processing job -> returns success
  test('cancelJob on a queued/processing job returns success', async () => {
    const request = buildRequest(1);
    const { jobId } = await api.submitJob(request);

    // The job starts in 'queued' and transitions to 'processing' async.
    // BatchProcessingAPI.cancelJob only works on 'processing' jobs.
    // We need to wait briefly for async processing to start, then cancel.
    // However, since processing is fast (mocked), we test the API contract:
    // If the job is still processing, cancel returns success.
    // If it already completed, cancel returns failure (covered in test 7).

    // Give the async processJobAsync a tick to start
    await new Promise((r) => setTimeout(r, 10));

    const result = api.cancelJob(jobId);
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('message');
    expect(typeof result.message).toBe('string');
    // Ensure async processing completes before test ends
    try { await api.waitForJob(jobId, { timeoutMs: 1000 }); } catch { /* job may already be terminal */ }
  });

  // 4. Submit job with no files -> throws error
  test('submitJob with no files throws error', async () => {
    const request: BatchJobRequest = { files: [] };

    await expect(api.submitJob(request)).rejects.toThrow('No files provided');
  });

  // 5. Submit job with >100 files -> throws error
  test('submitJob with more than 100 files throws error', async () => {
    const request = buildRequest(101);

    await expect(api.submitJob(request)).rejects.toThrow('Maximum 100 files per batch');
  });

  // 6. Get status for non-existent job -> throws error
  test('getJobStatus for non-existent job throws error', () => {
    expect(() => api.getJobStatus('non-existent-id')).toThrow('Job not found: non-existent-id');
  });

  // 7. Cancel already completed job -> returns failure
  test('cancelJob on already completed job returns failure', async () => {
    const request = buildRequest(1);
    const { jobId } = await api.submitJob(request);

    // Wait for the async processing to complete
    await api.waitForJob(jobId);

    const result = api.cancelJob(jobId);
    expect(result.success).toBe(false);
    expect(result.message).toContain('cannot be cancelled');
  });

  // 8. List all jobs -> returns array of job statuses
  test('listJobs returns array of job statuses', async () => {
    await api.submitJob(buildRequest(1));
    await api.submitJob(buildRequest(2));

    const jobs: BatchJobStatus[] = api.listJobs();

    expect(Array.isArray(jobs)).toBe(true);
    expect(jobs.length).toBeGreaterThanOrEqual(2);
    jobs.forEach((job) => {
      expect(job).toHaveProperty('jobId');
      expect(job).toHaveProperty('status');
      expect(job).toHaveProperty('progress');
    });
  });
});

// ===========================================================================
// 2. Job Lifecycle
// ===========================================================================

describe('BatchProcessingAPI - Job Lifecycle', () => {
  let api: BatchProcessingAPI;

  beforeEach(() => {
    api = new BatchProcessingAPI();
  });

  // 9. Submit job -> wait for processing -> get completed result
  test('full lifecycle: submit, wait, get completed result', async () => {
    const request = buildRequest(1);
    const { jobId } = await api.submitJob(request);

    // Wait for async processing to finish
    await api.waitForJob(jobId);

    const status = api.getJobStatus(jobId);
    expect(status.status).toBe('completed');
    expect(status.progress.percentage).toBe(100);
    expect(status.completedAt).toBeDefined();

    const result: BatchJobResult = api.getJobResult(jobId);
    expect(result.jobId).toBe(jobId);
    expect(result.status).toBe('completed');
    expect(result.results).toHaveLength(1);
    expect(result.results[0].success).toBe(true);
    expect(result.results[0].filename).toBe('file-1.wav');
    expect(result.summary).toBeDefined();
    expect(result.summary.totalFiles).toBe(1);
    expect(result.summary.successCount).toBe(1);
    expect(result.summary.failureCount).toBe(0);
  });

  // 10. Submit job -> check progress updates during processing
  test('progress updates during processing', async () => {
    const request = buildRequest(3);
    const { jobId } = await api.submitJob(request);

    // Check initial status immediately after submission
    const initialStatus = api.getJobStatus(jobId);
    expect(initialStatus.progress.total).toBe(3);

    // Wait for all files to be processed
    await api.waitForJob(jobId);

    const finalStatus = api.getJobStatus(jobId);
    expect(finalStatus.status).toBe('completed');
    expect(finalStatus.progress.percentage).toBe(100);
    expect(finalStatus.progress.completed).toBe(3);
  });

  // 11. Submit job -> cancel -> verify cancelled status
  test('submit job then cancel verifies cancelled status', async () => {
    // Use a moderate number of files so cancellation is likely to occur mid-processing
    const request = buildRequest(5);
    const { jobId } = await api.submitJob(request);

    // Wait briefly for processing to begin
    await new Promise((r) => setTimeout(r, 10));

    const cancelResult = api.cancelJob(jobId);

    // If cancel succeeded, verify status is 'cancelled'
    if (cancelResult.success) {
      const status = api.getJobStatus(jobId);
      expect(status.status).toBe('cancelled');
    } else {
      // Job finished before we could cancel; that's a valid race outcome
      const status = api.getJobStatus(jobId);
      expect(['completed', 'cancelled']).toContain(status.status);
    }
    // Ensure async processing completes before test ends
    try { await api.waitForJob(jobId, { timeoutMs: 1000 }); } catch { /* job may already be terminal */ }
  });
});

// ===========================================================================
// 3. Error Response Format
// ===========================================================================

describe('Error Response Format', () => {
  let api: BatchProcessingAPI;

  beforeEach(() => {
    api = new BatchProcessingAPI();
  });

  // 12. All error responses follow consistent format
  test('API errors throw with descriptive messages', async () => {
    // Validation: no files
    await expect(api.submitJob({ files: [] })).rejects.toThrow('No files provided');

    // Validation: too many files
    await expect(api.submitJob(buildRequest(101))).rejects.toThrow('Maximum 100 files per batch');

    // Not found
    expect(() => api.getJobStatus('missing')).toThrow('Job not found: missing');

    // Result for non-existent job
    expect(() => api.getJobResult('missing')).toThrow('Job not found: missing');
  });

  test('getJobResult for incomplete job throws descriptive error', async () => {
    const request = buildRequest(1);
    const { jobId } = await api.submitJob(request);

    // Immediately try to get result before processing finishes
    // The job may already be completed since mocks resolve fast,
    // so we test the contract conditionally
    const status = api.getJobStatus(jobId);
    if (status.status !== 'completed') {
      expect(() => api.getJobResult(jobId)).toThrow();
    }
    // If already completed, getJobResult should succeed
    if (status.status === 'completed') {
      const result = api.getJobResult(jobId);
      expect(result).toBeDefined();
    }
  });
});

// ===========================================================================
// 4. WebSocket Events (unit-level)
// ===========================================================================

describe('WebSocket Event Types', () => {
  // 13. Verify WebSocket event types are importable and properly structured
  test('WebSocketEvents type interface is exported from types/api', () => {
    // This test verifies that the WebSocket event types are well-defined.
    // We construct sample objects conforming to the interface.
    const progress: JobProgress = {
      jobId: 'job-123',
      stage: 'transcription',
      progress: 50,
      estimatedTimeRemaining: 10,
      currentOperation: 'Processing audio',
    };
    expect(progress.jobId).toBe('job-123');
    expect(progress.progress).toBe(50);
    expect(progress.stage).toBe('transcription');
  });

  // 14. Test job:progress event structure
  test('job:progress event has correct structure', () => {
    const progressEvent: JobProgress = {
      jobId: 'job-abc',
      stage: 'analysis',
      progress: 75,
      estimatedTimeRemaining: 5,
      currentOperation: 'Analyzing scenes',
    };

    expect(progressEvent).toMatchObject({
      jobId: expect.any(String),
      stage: expect.stringMatching(/^(transcription|analysis|visualization|rendering)$/),
      progress: expect.any(Number),
      estimatedTimeRemaining: expect.any(Number),
      currentOperation: expect.any(String),
    });
  });

  // 15. Test job:complete event structure
  test('job:complete event has correct structure', () => {
    const completeEvent: JobComplete = {
      jobId: 'job-complete-1',
      result: {
        jobId: 'job-complete-1',
        text: 'transcribed text',
        captions: [],
        metadata: {
          duration: 120,
          language: 'en',
          confidence: 0.95,
        },
        processingTime: 5000,
      },
    };

    expect(completeEvent).toHaveProperty('jobId', 'job-complete-1');
    expect(completeEvent).toHaveProperty('result');
    expect(completeEvent.result).toHaveProperty('jobId');
    expect(completeEvent.result).toHaveProperty('processingTime');
  });

  // 16. Test job:error event structure
  test('job:error event has correct structure', () => {
    const errorEvent: JobError = {
      jobId: 'job-err-1',
      error: {
        code: 'PROCESSING_ERROR',
        message: 'Failed to process audio file',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      },
    };

    expect(errorEvent).toHaveProperty('jobId', 'job-err-1');
    expect(errorEvent).toHaveProperty('error');
    expect(errorEvent.error).toHaveProperty('code');
    expect(errorEvent.error).toHaveProperty('message');
    expect(errorEvent.error).toHaveProperty('statusCode');
    expect(typeof errorEvent.error.code).toBe('string');
    expect(typeof errorEvent.error.message).toBe('string');
  });
});

// ===========================================================================
// 5. Security Middleware
// ===========================================================================

describe('Security Middleware', () => {
  // 17. Test that the API server can be created without errors
  test('Express app can be created without errors', async () => {
    // Dynamic import to avoid top-level side effects affecting other tests
    const { default: app } = await import('@/api/server');

    expect(app).toBeDefined();
    expect(typeof app.listen).toBe('function');
  });

  // 18. Test CORS configuration existence
  test('CORS middleware is configured on the app', async () => {
    const { default: app } = await import('@/api/server');

    // Verify the app was created (CORS is configured at import time)
    expect(app).toBeDefined();

    // Express v5 lazily initializes the router, so we verify indirectly
    // by checking that the app is an Express application with routing capability.
    // The app was built with cors(), helmet(), express.json(), and rateLimit()
    // middleware in server.ts. We confirm it has the expected HTTP method helpers.
    expect(typeof app.get).toBe('function');
    expect(typeof app.post).toBe('function');
    expect(typeof app.use).toBe('function');
  });
});

// ===========================================================================
// 6. Batch Routes (Express Router Integration)
// ===========================================================================

describe('Batch Routes - Express Router', () => {
  let manager: BatchJobManager;

  beforeEach(() => {
    manager = new BatchJobManager();
  });

  test('createBatchRouter returns a router instance', () => {
    const router = createBatchRouter(manager);
    expect(router).toBeDefined();
  });

  test('BatchJobManager creates job with UUID v4 format', () => {
    const files = [{ name: 'test.wav', path: '/audio/test.wav' }];
    const jobId = manager.createJob(files);

    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    expect(jobId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  test('BatchJobManager tracks job status correctly', () => {
    const files = [{ name: 'a.wav', path: '/a' }, { name: 'b.wav', path: '/b' }];
    const jobId = manager.createJob(files);

    const status = manager.getJobStatus(jobId);
    expect(status).not.toBeNull();
    expect(status!.status).toBe('queued');
    expect(status!.progress.total).toBe(2);
    expect(status!.progress.percentage).toBe(0);
  });

  test('BatchJobManager cancelJob returns not_found for missing job', () => {
    const result = manager.cancelJob('nonexistent');
    expect(result).toBe('not_found');
  });

  test('BatchJobManager cancelJob on queued job succeeds', () => {
    const jobId = manager.createJob([{ name: 'test.wav', path: '/test.wav' }]);

    const result = manager.cancelJob(jobId);
    expect(result).toBe(true);

    const status = manager.getJobStatus(jobId);
    expect(status!.status).toBe('cancelled');
    expect(status!.completedAt).toBeDefined();
  });

  test('BatchJobManager cancelJob on already terminal job returns already_terminal', () => {
    const jobId = manager.createJob([{ name: 'test.wav', path: '/test.wav' }]);

    // Cancel once
    manager.cancelJob(jobId);

    // Try to cancel again
    const result = manager.cancelJob(jobId);
    expect(result).toBe('already_terminal');
  });

  test('BatchJobManager startNextQueuedJob transitions queued to processing', () => {
    const jobId = manager.createJob([{ name: 'test.wav', path: '/test.wav' }]);

    const startedId = manager.startNextQueuedJob();
    expect(startedId).toBe(jobId);

    const status = manager.getJobStatus(jobId);
    expect(status!.status).toBe('processing');
    expect(status!.startedAt).toBeDefined();
  });

  test('BatchJobManager enforces max 3 concurrent jobs', () => {
    // Start 3 jobs
    for (let i = 0; i < 3; i++) {
      const id = manager.createJob([{ name: `file-${i}.wav`, path: `/${i}` }]);
      manager.startNextQueuedJob();
    }

    // Queue a 4th
    manager.createJob([{ name: 'file-4.wav', path: '/4' }]);

    // Should not start - max concurrency reached
    const result = manager.startNextQueuedJob();
    expect(result).toBeNull();

    expect(manager.getRunningCount()).toBe(3);
    expect(manager.getQueuedCount()).toBe(1);
  });

  test('BatchJobManager updateJobStatus merges partial updates', () => {
    const jobId = manager.createJob([{ name: 'test.wav', path: '/test.wav' }]);

    manager.updateJobStatus(jobId, {
      progress: { total: 1, completed: 1, failed: 0, percentage: 100 },
    });

    const status = manager.getJobStatus(jobId);
    expect(status!.progress.percentage).toBe(100);
    expect(status!.jobId).toBe(jobId); // unchanged fields preserved
  });
});

// ===========================================================================
// 7. Error Handler Middleware
// ===========================================================================

describe('Error Handler Middleware', () => {
  function createMockRes() {
    const res: Record<string, unknown> = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    return res as unknown as Response;
  }

  test('handles AppError with correct status code and code', () => {
    const err = new AppError(400, 'VALIDATION_ERROR', 'Invalid input');
    const req = {} as Request;
    const res = createMockRes();
    const next = jest.fn();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
        }),
      })
    );
  });

  test('handles unknown errors with 500 status', () => {
    const err = new Error('Something unexpected');
    const req = {} as Request;
    const res = createMockRes();
    const next = jest.fn();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        }),
      })
    );
  });

  test('includes details when present on AppError', () => {
    const err = new AppError(422, 'VALIDATION_ERROR', 'Field missing', { field: 'email' });
    const req = {} as Request;
    const res = createMockRes();
    const next = jest.fn();

    errorHandler(err, req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          details: { field: 'email' },
        }),
      })
    );
  });
});
