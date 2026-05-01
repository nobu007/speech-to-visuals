/**
 * TASK-0073: Pipeline REST API Endpoint Tests (REQ-057)
 *
 * Tests for:
 * - POST /api/render
 * - POST /api/git/commit
 * - GET /api/iteration-log
 * - GET /api/framework/status
 */

import express from 'express';
import request from 'supertest';
import { createPipelineRouter, PipelineStateManager } from '../pipeline';

function createApp(stateManager?: PipelineStateManager) {
  const app = express();
  app.use(express.json());
  app.use('/api', createPipelineRouter(stateManager));
  return app;
}

describe('Pipeline REST API Endpoints', () => {
  let app: express.Express;
  let stateManager: PipelineStateManager;

  beforeEach(() => {
    stateManager = new PipelineStateManager();
    app = createApp(stateManager);
  });

  // -------------------------------------------------------------------------
  // POST /api/render
  // -------------------------------------------------------------------------

  describe('POST /api/render', () => {
    it('should return video URL and metadata for valid scene data', async () => {
      const response = await request(app)
        .post('/api/render')
        .send({
          scenes: [
            { id: 1, type: 'flow', elements: [] },
            { id: 2, type: 'tree', elements: [] },
          ],
          quality: 'medium',
          outputName: 'test-video',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.videoUrl).toContain('test-video');
      expect(response.body.videoUrl).toContain('.mp4');
      expect(response.body.fileSize).toBeGreaterThan(0);
      expect(response.body.duration).toBeGreaterThan(0);
    });

    it('should reject empty scenes array', async () => {
      const response = await request(app)
        .post('/api/render')
        .send({ scenes: [] });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject missing scenes field', async () => {
      const response = await request(app)
        .post('/api/render')
        .send({ quality: 'high' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should use default output name when not provided', async () => {
      const response = await request(app)
        .post('/api/render')
        .send({ scenes: [{ id: 1 }] });

      expect(response.status).toBe(200);
      expect(response.body.videoUrl).toContain('video-');
      expect(response.body.videoUrl).toContain('.mp4');
    });

    it('should estimate duration based on scene count', async () => {
      const response = await request(app)
        .post('/api/render')
        .send({ scenes: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }] });

      expect(response.status).toBe(200);
      expect(response.body.duration).toBe(10); // 4 scenes * 2.5
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/git/commit
  // -------------------------------------------------------------------------

  describe('POST /api/git/commit', () => {
    it('should return commit hash for valid commit request', async () => {
      const response = await request(app)
        .post('/api/git/commit')
        .send({ message: 'feat(pipeline): improvement iteration 1' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.commitHash).toBeDefined();
      expect(response.body.commitHash).toHaveLength(7);
    });

    it('should reject missing message', async () => {
      const response = await request(app)
        .post('/api/git/commit')
        .send({ files: ['src/test.ts'] });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject non-string message', async () => {
      const response = await request(app)
        .post('/api/git/commit')
        .send({ message: 123 });

      expect(response.status).toBe(400);
    });

    it('should accept request with files', async () => {
      const response = await request(app)
        .post('/api/git/commit')
        .send({
          message: 'fix: resolve layout issue',
          files: ['src/analysis/llm-service.ts'],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/iteration-log
  // -------------------------------------------------------------------------

  describe('GET /api/iteration-log', () => {
    it('should return empty iterations initially', async () => {
      const response = await request(app)
        .get('/api/iteration-log');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.iterations).toEqual([]);
      expect(response.body.qualityTrend).toBe('stable');
      expect(response.body.recommendations).toBeDefined();
    });

    it('should return iteration data after recording', async () => {
      stateManager.addIteration('quality_improvement', 85);
      stateManager.addIteration('quality_improvement', 92);

      const response = await request(app)
        .get('/api/iteration-log');

      expect(response.status).toBe(200);
      expect(response.body.iterations).toHaveLength(2);
      expect(response.body.iterations[0].qualityScore).toBe(85);
      expect(response.body.iterations[1].qualityScore).toBe(92);
      expect(response.body.qualityTrend).toBe('improving');
    });

    it('should include recommendations when quality is low', async () => {
      stateManager.addIteration('analysis', 50);

      const response = await request(app)
        .get('/api/iteration-log');

      expect(response.status).toBe(200);
      expect(response.body.recommendations.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/framework/status
  // -------------------------------------------------------------------------

  describe('GET /api/framework/status', () => {
    it('should return idle status initially', async () => {
      const response = await request(app)
        .get('/api/framework/status');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.currentPhase).toBe('idle');
      expect(response.body.qualityScore).toBe(0);
      expect(response.body.isRunning).toBe(false);
      expect(response.body.improvementSuggestions).toBeDefined();
    });

    it('should reflect updated state', async () => {
      stateManager.setCurrentPhase('quality_improvement');
      stateManager.setQualityScore(95);
      stateManager.setIsRunning(true);

      const response = await request(app)
        .get('/api/framework/status');

      expect(response.status).toBe(200);
      expect(response.body.currentPhase).toBe('quality_improvement');
      expect(response.body.qualityScore).toBe(95);
      expect(response.body.isRunning).toBe(true);
    });

    it('should include improvement suggestions when score is low', async () => {
      stateManager.setQualityScore(60);

      const response = await request(app)
        .get('/api/framework/status');

      expect(response.status).toBe(200);
      expect(response.body.improvementSuggestions.length).toBeGreaterThan(0);
    });

    it('should not include improvement suggestions when score is high', async () => {
      stateManager.setQualityScore(95);

      const response = await request(app)
        .get('/api/framework/status');

      expect(response.status).toBe(200);
      expect(response.body.improvementSuggestions).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------
// PipelineStateManager unit tests
// ---------------------------------------------------------------------------

describe('PipelineStateManager', () => {
  let state: PipelineStateManager;

  beforeEach(() => {
    state = new PipelineStateManager();
  });

  describe('iterations', () => {
    it('should track iterations', () => {
      state.addIteration('analysis', 80);
      state.addIteration('rendering', 90);

      const iterations = state.getIterations();
      expect(iterations).toHaveLength(2);
      expect(iterations[0].id).toBe(1);
      expect(iterations[1].id).toBe(2);
    });

    it('should return copy of iterations', () => {
      state.addIteration('analysis', 80);
      const iterations = state.getIterations();
      iterations.push({ id: 99, phase: 'test', qualityScore: 0, timestamp: '' });

      expect(state.getIterations()).toHaveLength(1);
    });
  });

  describe('quality trend', () => {
    it('should return stable with fewer than 2 iterations', () => {
      state.addIteration('analysis', 80);
      expect(state.getQualityTrend()).toBe('stable');
    });

    it('should detect improving trend', () => {
      state.addIteration('analysis', 70);
      state.addIteration('analysis', 80);
      state.addIteration('analysis', 90);
      expect(state.getQualityTrend()).toBe('improving');
    });

    it('should detect fluctuating trend', () => {
      state.addIteration('analysis', 80);
      state.addIteration('analysis', 60);
      state.addIteration('analysis', 90);
      expect(state.getQualityTrend()).toBe('fluctuating');
    });
  });

  describe('recommendations', () => {
    it('should recommend executing pipeline when no iterations', () => {
      const recs = state.getRecommendations();
      expect(recs).toContain('No iterations recorded. Execute pipeline to generate data.');
    });

    it('should recommend review when quality is low', () => {
      state.addIteration('analysis', 50);
      state.setQualityScore(50);
      const recs = state.getRecommendations();
      expect(recs.some(r => r.includes('Quality score below target'))).toBe(true);
    });
  });

  describe('status', () => {
    it('should update and retrieve status', () => {
      state.setCurrentPhase('rendering');
      state.setQualityScore(88);
      state.setIsRunning(true);

      const status = state.getStatus();
      expect(status.currentPhase).toBe('rendering');
      expect(status.qualityScore).toBe(88);
      expect(status.isRunning).toBe(true);
    });
  });
});
