/**
 * TASK-0073: Pipeline REST API Endpoints (REQ-057)
 *
 * REST endpoints for pipeline operations:
 * - POST /api/render          - Trigger video rendering
 * - POST /api/git/commit      - Execute framework pipeline auto-commit
 * - GET  /api/iteration-log   - Retrieve iteration log
 * - GET  /api/framework/status - Get framework execution status
 */

import { Router, Request, Response, RequestHandler } from 'express';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { PIPELINE_LIMITS } from '../../config/limits';
import { sanitizeFilename } from '../../utils/sanitize';
import { exportRateLimiter } from '../middleware/rate-limit';
import { logger } from '../../utils/logger';

/** Supported codecs for rendering */
const VALID_CODECS = ['h264', 'h265', 'vp9', 'av1'] as const;

/** Resolution pattern: WIDTHxHEIGHT (e.g. 1920x1080) */
const RESOLUTION_REGEX = /^\d{1,5}x\d{1,5}$/;

// ---------------------------------------------------------------------------
// Zod validation schemas
// ---------------------------------------------------------------------------

const RenderRequestSchema = z.object({
  scenes: z.array(z.unknown()).min(1, 'No scenes provided').max(PIPELINE_LIMITS.MAX_SCENES, `Too many scenes (max ${PIPELINE_LIMITS.MAX_SCENES})`),
  quality: z.enum(['low', 'medium', 'high']).optional(),
  outputName: z.string().max(PIPELINE_LIMITS.MAX_OUTPUT_NAME_LENGTH, `outputName must be at most ${PIPELINE_LIMITS.MAX_OUTPUT_NAME_LENGTH} characters`).optional(),
  options: z.object({
    resolution: z.string().max(50).regex(RESOLUTION_REGEX, 'resolution must be in WIDTHxHEIGHT format (e.g. 1920x1080)').refine(
      (val) => {
        const [w, h] = val.split('x').map(Number);
        return w <= PIPELINE_LIMITS.MAX_RESOLUTION_DIMENSION && h <= PIPELINE_LIMITS.MAX_RESOLUTION_DIMENSION;
      },
      `resolution dimensions must not exceed ${PIPELINE_LIMITS.MAX_RESOLUTION_DIMENSION}px`,
    ).optional(),
    fps: z.number().int().min(1).max(PIPELINE_LIMITS.MAX_FPS, `fps must be between 1 and ${PIPELINE_LIMITS.MAX_FPS}`).optional(),
    codec: z.enum(VALID_CODECS, { message: `codec must be one of: ${(VALID_CODECS as readonly string[]).join(', ')}` }).optional(),
  }).optional(),
});

const CommitRequestSchema = z.object({
  message: z.string().min(1, 'message is required and must be a non-empty string').max(PIPELINE_LIMITS.MAX_COMMIT_MESSAGE_LENGTH, `message must be at most ${PIPELINE_LIMITS.MAX_COMMIT_MESSAGE_LENGTH} characters`),
  files: z.array(z.string()).optional(),
});

// ---------------------------------------------------------------------------
// Types (inferred from Zod schemas)
// ---------------------------------------------------------------------------

type RenderRequest = z.infer<typeof RenderRequestSchema>;

interface RenderResponse {
  success: boolean;
  videoUrl?: string;
  fileSize?: number;
  duration?: number;
  error?: { code: string; message: string };
}

type CommitRequest = z.infer<typeof CommitRequestSchema>;

interface CommitResponse {
  success: boolean;
  commitHash?: string;
  error?: { code: string; message: string };
}

interface IterationEntry {
  id: number;
  phase: string;
  qualityScore: number;
  timestamp: string;
}

interface IterationLogResponse {
  success: boolean;
  iterations: IterationEntry[];
  qualityTrend: string;
  recommendations: string[];
}

interface FrameworkStatusResponse {
  success: boolean;
  currentPhase: string;
  qualityScore: number;
  isRunning: boolean;
  improvementSuggestions: string[];
  executionStatus?: Record<string, unknown>;
  iterationHistory?: unknown[];
  qualityAnalysis?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Pipeline state manager (in-memory singleton)
// ---------------------------------------------------------------------------

class PipelineStateManager {
  private static instance: PipelineStateManager;
  private static readonly MAX_ITERATIONS = PIPELINE_LIMITS.MAX_ITERATIONS;
  private iterations: IterationEntry[] = [];
  private currentPhase = 'idle';
  private qualityScore = 0;
  private isRunning = false;

  static getInstance(): PipelineStateManager {
    if (!PipelineStateManager.instance) {
      PipelineStateManager.instance = new PipelineStateManager();
    }
    return PipelineStateManager.instance;
  }

  addIteration(phase: string, qualityScore: number): void {
    if (this.iterations.length >= PipelineStateManager.MAX_ITERATIONS) {
      this.iterations = this.iterations.slice(-Math.floor(PipelineStateManager.MAX_ITERATIONS / 2));
    }
    this.iterations.push({
      id: this.iterations.length + 1,
      phase,
      qualityScore,
      timestamp: new Date().toISOString(),
    });
  }

  getIterations(): IterationEntry[] {
    return [...this.iterations];
  }

  getQualityTrend(): string {
    if (this.iterations.length < 2) return 'stable';
    const recent = this.iterations.slice(-3);
    const scores = recent.map(i => i.qualityScore);
    const improving = scores.every((s, i) => i === 0 || s >= scores[i - 1]);
    return improving ? 'improving' : 'fluctuating';
  }

  getRecommendations(): string[] {
    const recs: string[] = [];
    if (this.qualityScore < 80) recs.push('Quality score below target. Review analysis accuracy.');
    if (this.iterations.length > 5 && this.getQualityTrend() !== 'improving') {
      recs.push('Quality not improving after multiple iterations. Consider adjusting parameters.');
    }
    if (this.iterations.length === 0) recs.push('No iterations recorded. Execute pipeline to generate data.');
    return recs;
  }

  setCurrentPhase(phase: string): void {
    this.currentPhase = phase;
  }

  setQualityScore(score: number): void {
    this.qualityScore = score;
  }

  setIsRunning(running: boolean): void {
    this.isRunning = running;
  }

  getStatus(): { currentPhase: string; qualityScore: number; isRunning: boolean } {
    return {
      currentPhase: this.currentPhase,
      qualityScore: this.qualityScore,
      isRunning: this.isRunning,
    };
  }
}

// ---------------------------------------------------------------------------
// Error helper
// ---------------------------------------------------------------------------

function sendError(res: Response, statusCode: number, code: string, message: string): void {
  if (statusCode >= 500) {
    logger.error(`[PipelineRoute] ${code}: ${message}`);
  }
  res.status(statusCode).json({ success: false, error: { code, message } });
}

// ---------------------------------------------------------------------------
// Route factory
// ---------------------------------------------------------------------------

export function createPipelineRouter(stateManager?: PipelineStateManager, renderRateLimiter?: RequestHandler): Router {
  const router = Router();
  const state = stateManager ?? PipelineStateManager.getInstance();
  const renderLimiter = renderRateLimiter ?? exportRateLimiter;

  // POST /api/render - Trigger video rendering (export rate-limited)
  router.post('/render', renderLimiter, async (req: Request, res: Response) => {
    const parsed = RenderRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Validation failed';
      return sendError(res, 400, 'VALIDATION_ERROR', msg);
    }
    const body = parsed.data;

    try {
      const rawOutputName = body.outputName || `video-${Date.now()}`;
      // Sanitize outputName to prevent path traversal (ISS-003)
      const outputName = sanitizeFilename(rawOutputName);
      const quality = body.quality || 'medium';

      // Simulate rendering process with scene data
      const sceneCount = (body.scenes || []).length;
      const estimatedDuration = sceneCount * 2.5;
      const estimatedFileSize = sceneCount * 512 * 1024;

      const response: RenderResponse = {
        success: true,
        videoUrl: `/output/${outputName}.mp4`,
        fileSize: estimatedFileSize,
        duration: estimatedDuration,
      };

      return res.status(200).json(response);
    } catch (error) {
      logger.error('[pipeline] Render error:', error);
      return sendError(res, 500, 'RENDER_ERROR', error instanceof Error ? error.message : 'Render failed');
    }
  });

  // POST /api/git/commit - Execute auto-commit
  router.post('/git/commit', async (req: Request, res: Response) => {
    const parsed = CommitRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Validation failed';
      return sendError(res, 400, 'VALIDATION_ERROR', msg);
    }
    const body = parsed.data;

    try {
      // Generate commit hash (simulated)
      const commitHash = randomUUID().substring(0, 7);

      const response: CommitResponse = {
        success: true,
        commitHash,
      };

      return res.status(200).json(response);
    } catch (error) {
      logger.error('[pipeline] Commit error:', error);
      return sendError(res, 500, 'COMMIT_ERROR', error instanceof Error ? error.message : 'Commit failed');
    }
  });

  // GET /api/iteration-log - Retrieve iteration log
  router.get('/iteration-log', (_req: Request, res: Response) => {
    try {
      const iterations = state.getIterations();
      const response: IterationLogResponse = {
        success: true,
        iterations,
        qualityTrend: state.getQualityTrend(),
        recommendations: state.getRecommendations(),
      };

      return res.status(200).json(response);
    } catch (error) {
      logger.error('[pipeline] Iteration log error:', error);
      return sendError(res, 500, 'ITERATION_LOG_ERROR', error instanceof Error ? error.message : 'Failed to retrieve iteration log');
    }
  });

  // GET /api/framework/status - Get framework execution status
  router.get('/framework/status', (_req: Request, res: Response) => {
    try {
      const status = state.getStatus();

      const response: FrameworkStatusResponse = {
        success: true,
        currentPhase: status.currentPhase,
        qualityScore: status.qualityScore,
        isRunning: status.isRunning,
        improvementSuggestions: status.qualityScore < 80
          ? ['Consider adjusting analysis parameters for better quality']
          : [],
      };

      return res.status(200).json(response);
    } catch (error) {
      logger.error('[pipeline] Framework status error:', error);
      return sendError(res, 500, 'STATUS_ERROR', error instanceof Error ? error.message : 'Failed to get framework status');
    }
  });

  return router;
}

// Export state manager for testing and external use
export { PipelineStateManager };
