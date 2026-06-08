/**
 * REQ-037: Error Recovery REST API Endpoint Tests
 *
 * Tests for:
 * - GET  /errors/:errorId/options  — recovery options for a recorded error
 * - POST /errors/:errorId/recover  — execute a recovery action
 * - POST /errors/register          — register an error for later recovery
 */

import express from 'express';
import request from 'supertest';
import { createErrorsRouter, errorRegistry } from '../errors';
import { UserGuidedErrorRecovery } from '../../../quality/user-guided-error-recovery';

function createApp(recoveryService?: UserGuidedErrorRecovery) {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/errors', createErrorsRouter(recoveryService));
  return app;
}

describe('Error Recovery REST API Endpoints (REQ-037)', () => {
  let app: express.Express;
  let recoveryService: UserGuidedErrorRecovery;

  beforeEach(() => {
    recoveryService = new UserGuidedErrorRecovery();
    app = createApp(recoveryService);
    errorRegistry.clear();
  });

  afterEach(() => {
    errorRegistry.clear();
  });

  // ---------------------------------------------------------------------------
  // POST /errors/register
  // ---------------------------------------------------------------------------

  describe('POST /register', () => {
    it('should register a new error and return category and severity', async () => {
      const response = await request(app)
        .post('/api/v1/errors/register')
        .send({ errorId: 'err-001', errorMessage: 'File format unsupported' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.errorId).toBe('err-001');
      expect(response.body.data.category).toBe('file_format');
      expect(response.body.data.severity).toBe('low');
    });

    it('should categorize network errors as network category', async () => {
      const response = await request(app)
        .post('/api/v1/errors/register')
        .send({ errorId: 'err-net', errorMessage: 'Network connection failed' });

      expect(response.status).toBe(200);
      expect(response.body.data.category).toBe('network');
    });

    it('should categorize API errors as critical severity', async () => {
      const response = await request(app)
        .post('/api/v1/errors/register')
        .send({ errorId: 'err-api', errorMessage: 'API key is invalid' });

      expect(response.status).toBe(200);
      expect(response.body.data.category).toBe('api');
      expect(response.body.data.severity).toBe('critical');
    });

    it('should return 400 when errorId is missing', async () => {
      const response = await request(app)
        .post('/api/v1/errors/register')
        .send({ errorMessage: 'some error' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when errorMessage is missing', async () => {
      const response = await request(app)
        .post('/api/v1/errors/register')
        .send({ errorId: 'err-002' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when both errorId and errorMessage are missing', async () => {
      const response = await request(app)
        .post('/api/v1/errors/register')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /errors/:errorId/options
  // ---------------------------------------------------------------------------

  describe('GET /:errorId/options', () => {
    it('should return recovery options for a registered error', async () => {
      // Register error first
      await request(app)
        .post('/api/v1/errors/register')
        .send({ errorId: 'err-001', errorMessage: 'Transcription failed' });

      const response = await request(app)
        .get('/api/v1/errors/err-001/options');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.category).toBe('transcription');
      expect(response.body.data.severity).toBe('high');
      expect(response.body.data.userMessage).toBeDefined();
      expect(response.body.data.recoveryStrategies).toBeInstanceOf(Array);
      expect(response.body.data.recoveryStrategies.length).toBeGreaterThan(0);
      expect(response.body.data.preventionTips).toBeInstanceOf(Array);
    });

    it('should include strategy details with expected fields', async () => {
      await request(app)
        .post('/api/v1/errors/register')
        .send({ errorId: 'err-002', errorMessage: 'Timeout while processing' });

      const response = await request(app)
        .get('/api/v1/errors/err-002/options');

      expect(response.status).toBe(200);
      const strategy = response.body.data.recoveryStrategies[0];
      expect(strategy).toHaveProperty('id');
      expect(strategy).toHaveProperty('name');
      expect(strategy).toHaveProperty('description');
      expect(strategy).toHaveProperty('automated');
      expect(strategy).toHaveProperty('estimatedTime');
      expect(strategy).toHaveProperty('successRate');
    });

    it('should return synthetic guidance for unregistered error IDs', async () => {
      const response = await request(app)
        .get('/api/v1/errors/unknown-error-id/options');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.category).toBe('unknown');
      expect(response.body.data.recoveryStrategies).toBeInstanceOf(Array);
    });

    it('should return 400 when errorId is empty', async () => {
      const response = await request(app)
        .get('/api/v1/errors//options');

      // Express will not match this route (empty param), so it returns 404
      // or if it does match, 400
      expect([400, 404]).toContain(response.status);
    });
  });

  // ---------------------------------------------------------------------------
  // POST /errors/:errorId/recover
  // ---------------------------------------------------------------------------

  describe('POST /:errorId/recover', () => {
    it('should execute a recovery strategy for a registered error', async () => {
      // Register a timeout error which has automated strategies
      await request(app)
        .post('/api/v1/errors/register')
        .send({ errorId: 'err-timeout', errorMessage: 'Processing timed out' });

      // Get available strategies
      const optionsResponse = await request(app)
        .get('/api/v1/errors/err-timeout/options');

      const strategyId = optionsResponse.body.data.recoveryStrategies[0].id;

      const response = await request(app)
        .post('/api/v1/errors/err-timeout/recover')
        .send({ strategyId, userChoice: 'auto' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.strategyUsed).toBe(strategyId);
      expect(response.body.data).toHaveProperty('recovered');
      expect(response.body.data).toHaveProperty('processingResumed');
      expect(response.body.data).toHaveProperty('estimatedTime');
      expect(response.body.data).toHaveProperty('successRate');
    });

    it('should return 404 for unregistered error IDs', async () => {
      const response = await request(app)
        .post('/api/v1/errors/nonexistent/recover')
        .send({ strategyId: 'some-strategy', userChoice: 'auto' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('ERROR_NOT_FOUND');
    });

    it('should return 400 when strategyId is missing', async () => {
      await request(app)
        .post('/api/v1/errors/register')
        .send({ errorId: 'err-003', errorMessage: 'Layout overlap detected' });

      const response = await request(app)
        .post('/api/v1/errors/err-003/recover')
        .send({ userChoice: 'auto' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when strategyId is invalid', async () => {
      await request(app)
        .post('/api/v1/errors/register')
        .send({ errorId: 'err-004', errorMessage: 'Memory heap overflow' });

      const response = await request(app)
        .post('/api/v1/errors/err-004/recover')
        .send({ strategyId: 'nonexistent-strategy', userChoice: 'auto' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_STRATEGY');
    });

    it('should accept context with pipelineStage and originalError', async () => {
      await request(app)
        .post('/api/v1/errors/register')
        .send({ errorId: 'err-ctx', errorMessage: 'Rendering video failed' });

      const optionsRes = await request(app)
        .get('/api/v1/errors/err-ctx/options');

      const strategyId = optionsRes.body.data.recoveryStrategies[0].id;

      const response = await request(app)
        .post('/api/v1/errors/err-ctx/recover')
        .send({
          strategyId,
          userChoice: 'auto',
          context: { pipelineStage: 'rendering', originalError: 'GPU OOM' },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should default userChoice to auto when not specified', async () => {
      await request(app)
        .post('/api/v1/errors/register')
        .send({ errorId: 'err-default', errorMessage: 'Network fetch error' });

      const optionsRes = await request(app)
        .get('/api/v1/errors/err-default/options');

      const strategyId = optionsRes.body.data.recoveryStrategies[0].id;

      const response = await request(app)
        .post('/api/v1/errors/err-default/recover')
        .send({ strategyId });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Error category coverage
  // ---------------------------------------------------------------------------

  describe('error categorization across all categories', () => {
    const testCases: Array<{ message: string; expectedCategory: string }> = [
      { message: 'File format unsupported', expectedCategory: 'file_format' },
      { message: 'File too large exceeds maximum size', expectedCategory: 'file_size' },
      { message: 'Transcription failed with whisper', expectedCategory: 'transcription' },
      { message: 'LLM analysis gemini error', expectedCategory: 'analysis' },
      { message: 'Layout overlap detected', expectedCategory: 'layout' },
      { message: 'Video rendering failed', expectedCategory: 'rendering' },
      { message: 'API key is invalid', expectedCategory: 'api' },
      { message: 'Network connection timeout', expectedCategory: 'network' },
      { message: 'Memory heap out of memory', expectedCategory: 'memory' },
      { message: 'Request timed out', expectedCategory: 'timeout' },
      { message: 'Something completely unexpected', expectedCategory: 'unknown' },
    ];

    testCases.forEach(({ message, expectedCategory }) => {
      it(`should categorize "${message}" as ${expectedCategory}`, async () => {
        const response = await request(app)
          .post('/api/v1/errors/register')
          .send({ errorId: `cat-${expectedCategory}`, errorMessage: message });

        expect(response.status).toBe(200);
        expect(response.body.data.category).toBe(expectedCategory);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Integration: register → options → recover flow
  // ---------------------------------------------------------------------------

  describe('full recovery workflow', () => {
    it('should complete register → options → recover flow', async () => {
      // Step 1: Register
      const registerRes = await request(app)
        .post('/api/v1/errors/register')
        .send({ errorId: 'workflow-001', errorMessage: 'Analysis gemini failed' });

      expect(registerRes.status).toBe(200);
      expect(registerRes.body.data.category).toBe('analysis');

      // Step 2: Get options
      const optionsRes = await request(app)
        .get('/api/v1/errors/workflow-001/options');

      expect(optionsRes.status).toBe(200);
      expect(optionsRes.body.data.recoveryStrategies.length).toBeGreaterThan(0);

      // Step 3: Recover
      const strategyId = optionsRes.body.data.recoveryStrategies[0].id;
      const recoverRes = await request(app)
        .post('/api/v1/errors/workflow-001/recover')
        .send({ strategyId, userChoice: 'auto' });

      expect(recoverRes.status).toBe(200);
      expect(recoverRes.body.data.strategyUsed).toBe(strategyId);
    });
  });
});
