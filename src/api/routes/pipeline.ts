/**
 * TASK-0073: Pipeline REST API Endpoints (REQ-057)
 *
 * REST endpoints for pipeline operations:
 * - POST /api/render          - Trigger video rendering
 * - POST /api/git/commit      - Execute framework pipeline auto-commit
 * - GET  /api/iteration-log   - Retrieve iteration log
 * - GET  /api/framework/status - Get framework execution status
 */

import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RenderRequest {
  scenes: unknown[];
  quality?: 'low' | 'medium' | 'high';
  outputName?: string;
  options?: {
    resolution?: string;
    fps?: number;
    codec?: string;
  };
}

interface RenderResponse {
  success: boolean;
  videoUrl?: string;
  fileSize?: number;
  duration?: number;
  error?: { code: string; message: string };
}

interface CommitRequest {
  message: string;
  files?: string[];
}

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
  res.status(statusCode).json({ success: false, error: { code, message } });
}

// ---------------------------------------------------------------------------
// Route factory
// ---------------------------------------------------------------------------

export function createPipelineRouter(stateManager?: PipelineStateManager): Router {
  const router = Router();
  const state = stateManager ?? PipelineStateManager.getInstance();

  // POST /api/render - Trigger video rendering
  router.post('/render', async (req: Request, res: Response) => {
    const body = req.body as RenderRequest;

    if (!body.scenes || !Array.isArray(body.scenes)) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'scenes must be a non-empty array');
    }

    if (body.scenes.length === 0) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'No scenes provided');
    }

    try {
      const rawOutputName = body.outputName || `video-${Date.now()}`;
      // Sanitize outputName to prevent path traversal (ISS-003)
      const outputName = rawOutputName.replace(/[/\\]/g, '_').replace(/\.\./g, '');
      const quality = body.quality || 'medium';

      // Simulate rendering process with scene data
      const sceneCount = body.scenes.length;
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
      return sendError(res, 500, 'RENDER_ERROR', error instanceof Error ? error.message : 'Render failed');
    }
  });

  // POST /api/git/commit - Execute auto-commit
  router.post('/git/commit', async (req: Request, res: Response) => {
    const body = req.body as CommitRequest;

    if (!body.message || typeof body.message !== 'string') {
      return sendError(res, 400, 'VALIDATION_ERROR', 'message is required and must be a string');
    }

    try {
      // Generate commit hash (simulated)
      const commitHash = randomUUID().substring(0, 7);

      const response: CommitResponse = {
        success: true,
        commitHash,
      };

      return res.status(200).json(response);
    } catch (error) {
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
      return sendError(res, 500, 'STATUS_ERROR', error instanceof Error ? error.message : 'Failed to get framework status');
    }
  });

  return router;
}

// Export state manager for testing and external use
export { PipelineStateManager };
