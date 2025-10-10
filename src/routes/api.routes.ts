/**
 * Core API Routes
 * AutoDiagram Video Generator - Iteration 67 Phase A1
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { authenticate, requirePermissions } from '../middleware/auth';
import {
  apiRateLimiter,
  strictRateLimiter,
  checkProcessingQuota,
  checkConcurrentJobsQuota,
  getQuotaInfo
} from '../middleware/rate-limiter';
import { asyncHandler, AppError } from '../middleware/error-handler';
import { jobManager } from '../services/job-manager';
import {
  TranscribeRequest,
  GenerateDiagramRequest,
  GenerateVideoRequest,
  APIResponse,
  JobStatus,
} from '../types/api';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'audio/mpeg',
      'audio/wav',
      'audio/mp4',
      'audio/ogg',
      'audio/flac',
      'audio/aac',
      'audio/webm',
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only audio files are allowed.'));
    }
  },
});

/**
 * POST /api/v1/transcribe
 * Transcribe audio to text with captions
 */
router.post(
  '/transcribe',
  authenticate,
  requirePermissions('transcribe'),
  apiRateLimiter,
  strictRateLimiter,
  checkProcessingQuota,
  checkConcurrentJobsQuota,
  upload.single('audio'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const options = req.body.options ? JSON.parse(req.body.options) : {};

    // Create job
    const job = jobManager.createJob(userId, 'transcription');

    // TODO: In production, queue the transcription job
    // For now, return job immediately
    const response: APIResponse<JobStatus> = {
      success: true,
      data: job,
      meta: {
        requestId: req.headers['x-request-id'] as string || 'unknown',
        timestamp: new Date().toISOString(),
        version: 'v1',
      },
    };

    res.status(202).json(response);
  })
);

/**
 * POST /api/v1/generate-diagram
 * Generate diagram from text content
 */
router.post(
  '/generate-diagram',
  authenticate,
  requirePermissions('generate-diagram'),
  apiRateLimiter,
  strictRateLimiter,
  checkProcessingQuota,
  checkConcurrentJobsQuota,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const { textContent, options }: GenerateDiagramRequest = req.body;

    if (!textContent) {
      throw new AppError('VALIDATION_ERROR', 'textContent is required', 400);
    }

    // Create job
    const job = jobManager.createJob(userId, 'diagram');

    // TODO: In production, queue the diagram generation job
    // For now, return job immediately
    const response: APIResponse<JobStatus> = {
      success: true,
      data: job,
      meta: {
        requestId: req.headers['x-request-id'] as string || 'unknown',
        timestamp: new Date().toISOString(),
        version: 'v1',
      },
    };

    res.status(202).json(response);
  })
);

/**
 * POST /api/v1/generate-video
 * Generate video from diagram data
 */
router.post(
  '/generate-video',
  authenticate,
  requirePermissions('generate-video'),
  apiRateLimiter,
  strictRateLimiter,
  checkProcessingQuota,
  checkConcurrentJobsQuota,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const { diagramData, options }: GenerateVideoRequest = req.body;

    if (!diagramData) {
      throw new AppError('VALIDATION_ERROR', 'diagramData is required', 400);
    }

    // Create job
    const job = jobManager.createJob(userId, 'video');

    // TODO: In production, queue the video generation job
    // For now, return job immediately
    const response: APIResponse<JobStatus> = {
      success: true,
      data: job,
      meta: {
        requestId: req.headers['x-request-id'] as string || 'unknown',
        timestamp: new Date().toISOString(),
        version: 'v1',
      },
    };

    res.status(202).json(response);
  })
);

/**
 * GET /api/v1/jobs/:jobId
 * Get job status by ID
 */
router.get(
  '/jobs/:jobId',
  authenticate,
  apiRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { jobId } = req.params;

    const job = jobManager.getJob(jobId);

    if (!job) {
      throw new AppError('JOB_NOT_FOUND', 'Job not found', 404);
    }

    const response: APIResponse<JobStatus> = {
      success: true,
      data: job,
      meta: {
        requestId: req.headers['x-request-id'] as string || 'unknown',
        timestamp: new Date().toISOString(),
        version: 'v1',
      },
    };

    res.json(response);
  })
);

/**
 * DELETE /api/v1/jobs/:jobId
 * Cancel a job
 */
router.delete(
  '/jobs/:jobId',
  authenticate,
  apiRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { jobId } = req.params;

    const job = jobManager.cancelJob(jobId);

    if (!job) {
      throw new AppError('JOB_NOT_FOUND', 'Job not found or already completed', 404);
    }

    const response: APIResponse<JobStatus> = {
      success: true,
      data: job,
      meta: {
        requestId: req.headers['x-request-id'] as string || 'unknown',
        timestamp: new Date().toISOString(),
        version: 'v1',
      },
    };

    res.json(response);
  })
);

/**
 * GET /api/v1/jobs
 * Get all jobs for current user
 */
router.get(
  '/jobs',
  authenticate,
  apiRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const jobs = jobManager.getUserJobs(userId);

    const response: APIResponse<JobStatus[]> = {
      success: true,
      data: jobs,
      meta: {
        requestId: req.headers['x-request-id'] as string || 'unknown',
        timestamp: new Date().toISOString(),
        version: 'v1',
      },
    };

    res.json(response);
  })
);

/**
 * GET /api/v1/quota
 * Get current user's quota information
 */
router.get(
  '/quota',
  authenticate,
  apiRateLimiter,
  getQuotaInfo
);

/**
 * GET /api/v1/health
 * Health check endpoint (no auth required)
 */
router.get('/health', (req: Request, res: Response) => {
  const stats = jobManager.getStatistics();

  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      jobs: stats,
    },
  });
});

export default router;
