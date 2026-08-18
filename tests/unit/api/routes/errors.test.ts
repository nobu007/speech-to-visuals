/**
 * REQ-037: Error Recovery REST API Endpoint Unit Tests
 *
 * Tests for the error recovery router:
 * - POST /errors/register         — register an error
 * - GET  /errors/:errorId/options  — recovery options for an error
 * - POST /errors/:errorId/recover  — execute a recovery action
 */

import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { createErrorsRouter, errorRegistry } from '@/api/routes/errors';

// Suppress logger noise during tests
jest.mock('@stv/core/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/errors', createErrorsRouter());
  return app;
}

// ---------------------------------------------------------------------------
// POST /errors/register
// ---------------------------------------------------------------------------

describe('REQ-037: POST /api/v1/errors/register', () => {
  let app: express.Express;

  beforeEach(() => {
    app = createApp();
    errorRegistry.clear();
  });

  it('should register an error and return category/severity', async () => {
    const res = await request(app)
      .post('/api/v1/errors/register')
      .send({ errorId: 'err-001', errorMessage: 'LLM_TIMEOUT during analysis' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.errorId).toBe('err-001');
    expect(res.body.data.category).toBeDefined();
    expect(res.body.data.severity).toBeDefined();
  });

  it('should return 400 when errorId is missing', async () => {
    const res = await request(app)
      .post('/api/v1/errors/register')
      .send({ errorMessage: 'some error' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 when errorMessage is missing', async () => {
    const res = await request(app)
      .post('/api/v1/errors/register')
      .send({ errorId: 'err-002' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should categorize transcription errors correctly', async () => {
    const res = await request(app)
      .post('/api/v1/errors/register')
      .send({ errorId: 'err-trans', errorMessage: 'Whisper transcription failed' });

    expect(res.status).toBe(200);
    expect(res.body.data.category).toBe('transcription');
    expect(res.body.data.severity).toBe('high');
  });

  it('should categorize analysis errors correctly', async () => {
    const res = await request(app)
      .post('/api/v1/errors/register')
      .send({ errorId: 'err-analysis', errorMessage: 'LLM analysis timed out' });

    expect(res.status).toBe(200);
    expect(res.body.data.category).toBe('analysis');
  });

  it('should categorize memory errors as critical', async () => {
    const res = await request(app)
      .post('/api/v1/errors/register')
      .send({ errorId: 'err-mem', errorMessage: 'Out of heap memory' });

    expect(res.status).toBe(200);
    expect(res.body.data.severity).toBe('critical');
  });

  it('should accept optional context', async () => {
    const res = await request(app)
      .post('/api/v1/errors/register')
      .send({
        errorId: 'err-ctx',
        errorMessage: 'file format unsupported',
        context: { stage: 'upload' },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GET /errors/:errorId/options
// ---------------------------------------------------------------------------

describe('REQ-037: GET /api/v1/errors/:errorId/options', () => {
  let app: express.Express;

  beforeEach(() => {
    app = createApp();
    errorRegistry.clear();
  });

  it('should return recovery options for a registered error', async () => {
    // Register first
    await request(app)
      .post('/api/v1/errors/register')
      .send({ errorId: 'err-opts', errorMessage: 'rendering video failed' });

    const res = await request(app).get('/api/v1/errors/err-opts/options');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.category).toBe('rendering');
    expect(res.body.data.severity).toBe('medium');
    expect(res.body.data.userMessage).toBeDefined();
    expect(Array.isArray(res.body.data.recoveryStrategies)).toBe(true);
    expect(res.body.data.recoveryStrategies.length).toBeGreaterThan(0);

    // Verify strategy shape
    const strategy = res.body.data.recoveryStrategies[0];
    expect(strategy).toHaveProperty('id');
    expect(strategy).toHaveProperty('name');
    expect(strategy).toHaveProperty('description');
    expect(strategy).toHaveProperty('automated');
    expect(strategy).toHaveProperty('estimatedTime');
    expect(strategy).toHaveProperty('successRate');
  });

  it('should return prevention tips', async () => {
    await request(app)
      .post('/api/v1/errors/register')
      .send({ errorId: 'err-tips', errorMessage: 'transcription quality too low' });

    const res = await request(app).get('/api/v1/errors/err-tips/options');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.preventionTips)).toBe(true);
    expect(res.body.data.preventionTips.length).toBeGreaterThan(0);
  });

  it('should return options for unregistered error IDs (synthetic)', async () => {
    const res = await request(app).get('/api/v1/errors/unknown-error-id/options');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.recoveryStrategies).toBeDefined();
  });

  it('should return 400 for whitespace-only errorId', async () => {
    const res = await request(app).get('/api/v1/errors/ /options');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_ERROR_ID');
  });
});

// ---------------------------------------------------------------------------
// POST /errors/:errorId/recover
// ---------------------------------------------------------------------------

describe('REQ-037: POST /api/v1/errors/:errorId/recover', () => {
  let app: express.Express;

  beforeEach(() => {
    app = createApp();
    errorRegistry.clear();
  });

  it('should execute a recovery strategy', async () => {
    // Register a rendering error (has automated strategy)
    await request(app)
      .post('/api/v1/errors/register')
      .send({ errorId: 'err-recover', errorMessage: 'rendering video failed' });

    // Get available strategies first
    const optsRes = await request(app).get('/api/v1/errors/err-recover/options');
    const strategyId = optsRes.body.data.recoveryStrategies[0].id;

    // Execute recovery
    const res = await request(app)
      .post('/api/v1/errors/err-recover/recover')
      .send({ strategyId, userChoice: 'auto' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.strategyUsed).toBe(strategyId);
    expect(typeof res.body.data.recovered).toBe('boolean');
    expect(typeof res.body.data.processingResumed).toBe('boolean');
  });

  it('should return 404 for unregistered error ID', async () => {
    const res = await request(app)
      .post('/api/v1/errors/nonexistent/recover')
      .send({ strategyId: 'some-strategy', userChoice: 'auto' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('ERROR_NOT_FOUND');
  });

  it('should return 400 for invalid strategy ID', async () => {
    await request(app)
      .post('/api/v1/errors/register')
      .send({ errorId: 'err-badstrat', errorMessage: 'network connection timeout' });

    const res = await request(app)
      .post('/api/v1/errors/err-badstrat/recover')
      .send({ strategyId: 'nonexistent-strategy', userChoice: 'auto' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_STRATEGY');
  });

  it('should return 400 when strategyId is missing from body', async () => {
    const res = await request(app)
      .post('/api/v1/errors/err-recover/recover')
      .send({ userChoice: 'auto' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 for invalid userChoice', async () => {
    const res = await request(app)
      .post('/api/v1/errors/err-recover/recover')
      .send({ strategyId: 'some-id', userChoice: 'invalid-choice' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should default userChoice to auto when not provided', async () => {
    await request(app)
      .post('/api/v1/errors/register')
      .send({ errorId: 'err-default', errorMessage: 'timeout exceeded' });

    const optsRes = await request(app).get('/api/v1/errors/err-default/options');
    const strategyId = optsRes.body.data.recoveryStrategies[0].id;

    const res = await request(app)
      .post('/api/v1/errors/err-default/recover')
      .send({ strategyId });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should accept optional context in recover body', async () => {
    await request(app)
      .post('/api/v1/errors/register')
      .send({ errorId: 'err-ctx', errorMessage: 'analysis llm gemini error' });

    const optsRes = await request(app).get('/api/v1/errors/err-ctx/options');
    const strategyId = optsRes.body.data.recoveryStrategies[0].id;

    const res = await request(app)
      .post('/api/v1/errors/err-ctx/recover')
      .send({
        strategyId,
        userChoice: 'auto',
        context: { pipelineStage: 'analysis', originalError: 'LLM_TIMEOUT' },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// End-to-end flow: register → options → recover
// ---------------------------------------------------------------------------

describe('REQ-037: Full error recovery flow', () => {
  let app: express.Express;

  beforeEach(() => {
    app = createApp();
    errorRegistry.clear();
  });

  it('should complete the full recovery flow for a transcription error', async () => {
    // 1. Register
    const regRes = await request(app)
      .post('/api/v1/errors/register')
      .send({ errorId: 'err-flow', errorMessage: 'Whisper transcription failed' });
    expect(regRes.status).toBe(200);
    expect(regRes.body.data.category).toBe('transcription');

    // 2. Get options
    const optsRes = await request(app).get('/api/v1/errors/err-flow/options');
    expect(optsRes.status).toBe(200);
    expect(optsRes.body.data.recoveryStrategies.length).toBeGreaterThanOrEqual(1);

    // 3. Pick automated strategy
    const autoStrategy = optsRes.body.data.recoveryStrategies.find(
      (s: { automated: boolean }) => s.automated,
    );
    expect(autoStrategy).toBeDefined();

    // 4. Recover
    const recRes = await request(app)
      .post('/api/v1/errors/err-flow/recover')
      .send({ strategyId: autoStrategy.id, userChoice: 'auto' });
    expect(recRes.status).toBe(200);
    expect(recRes.body.data.recovered).toBe(true);
    expect(recRes.body.data.strategyUsed).toBe(autoStrategy.id);
  });

  it('should handle multiple errors independently', async () => {
    // Register two different errors
    await request(app)
      .post('/api/v1/errors/register')
      .send({ errorId: 'err-a', errorMessage: 'file format unsupported' });

    await request(app)
      .post('/api/v1/errors/register')
      .send({ errorId: 'err-b', errorMessage: 'memory heap exhausted' });

    // Get options for each
    const optsA = await request(app).get('/api/v1/errors/err-a/options');
    const optsB = await request(app).get('/api/v1/errors/err-b/options');

    expect(optsA.body.data.category).toBe('file_format');
    expect(optsB.body.data.category).toBe('memory');
    expect(optsB.body.data.severity).toBe('critical');
  });
});

// ---------------------------------------------------------------------------
// Input validation edge cases
// ---------------------------------------------------------------------------

describe('REQ-037: Input validation edge cases', () => {
  let app: express.Express;

  beforeEach(() => {
    app = createApp();
    errorRegistry.clear();
  });

  // errorId format validation
  it('should reject errorId with spaces', async () => {
    const res = await request(app)
      .post('/api/v1/errors/register')
      .send({ errorId: 'err space', errorMessage: 'test error' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should reject errorId with special characters', async () => {
    const res = await request(app)
      .post('/api/v1/errors/register')
      .send({ errorId: 'err@#$%', errorMessage: 'test error' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should accept errorId with hyphens, underscores, and dots', async () => {
    const res = await request(app)
      .post('/api/v1/errors/register')
      .send({ errorId: 'my-error_id.v2', errorMessage: 'test error' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.errorId).toBe('my-error_id.v2');
  });

  it('should reject errorId exceeding max length', async () => {
    const longId = 'a'.repeat(129);
    const res = await request(app)
      .post('/api/v1/errors/register')
      .send({ errorId: longId, errorMessage: 'test error' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should reject errorMessage exceeding max length', async () => {
    const longMessage = 'x'.repeat(2001);
    const res = await request(app)
      .post('/api/v1/errors/register')
      .send({ errorId: 'err-long', errorMessage: longMessage });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // XSS sanitization
  it('should strip HTML tags from errorMessage', async () => {
    const res = await request(app)
      .post('/api/v1/errors/register')
      .send({ errorId: 'err-xss', errorMessage: '<script>alert("xss")</script>File format unsupported' });

    expect(res.status).toBe(200);
    // The error category is based on the sanitized message
    expect(res.body.success).toBe(true);
  });

  // Path parameter validation
  it('should reject special characters in :errorId path param for GET /options', async () => {
    const res = await request(app)
      .get('/api/v1/errors/err%20id/options');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_ERROR_ID');
  });

  it('should reject special characters in :errorId path param for POST /recover', async () => {
    const res = await request(app)
      .post('/api/v1/errors/err%20id/recover')
      .send({ strategyId: 's1', userChoice: 'auto' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_ERROR_ID');
  });
});
