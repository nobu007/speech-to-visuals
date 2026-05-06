/**
 * ISS-030: Pipeline endpoints authentication tests
 *
 * Verifies that pipeline routes (/api/render, /api/git/commit, etc.)
 * enforce JWT authentication when NODE_ENV === 'production',
 * and remain accessible in development/test mode.
 */

import express from 'express';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { authMiddleware, AuthenticatedRequest } from '../../middleware/auth';
import { createPipelineRouter, PipelineStateManager } from '../pipeline';

const JWT_SECRET = 'test-jwt-secret-for-iss030';

function createAuthApp(stateManager?: PipelineStateManager, enforceAuth = true) {
  const app = express();
  app.use(express.json());

  if (enforceAuth) {
    app.use('/api', (req, res, next) => {
      // Simulate production auth enforcement
      authMiddleware(req as AuthenticatedRequest, res, next);
    });
  }

  app.use('/api', createPipelineRouter(stateManager));
  return app;
}

function signToken(payload: object, secret = JWT_SECRET): string {
  return jwt.sign(payload, secret, { algorithm: 'HS256' });
}

describe('ISS-030: Pipeline authentication', () => {
  const originalSecret = process.env.JWT_SECRET;
  const originalSupabaseSecret = process.env.SUPABASE_JWT_SECRET;
  let stateManager: PipelineStateManager;

  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET;
    delete process.env.SUPABASE_JWT_SECRET;
  });

  afterAll(() => {
    if (originalSecret) process.env.JWT_SECRET = originalSecret;
    else delete process.env.JWT_SECRET;
    if (originalSupabaseSecret) process.env.SUPABASE_JWT_SECRET = originalSupabaseSecret;
    else delete process.env.SUPABASE_JWT_SECRET;
  });

  beforeEach(() => {
    stateManager = new PipelineStateManager();
  });

  // -------------------------------------------------------------------------
  // Auth enforced mode
  // -------------------------------------------------------------------------

  describe('when auth is enforced (production)', () => {
    let app: express.Express;

    beforeEach(() => {
      app = createAuthApp(stateManager, true);
    });

    it('should reject POST /api/render without auth token', async () => {
      const response = await request(app)
        .post('/api/render')
        .send({ scenes: [{ id: 1 }] });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject POST /api/git/commit without auth token', async () => {
      const response = await request(app)
        .post('/api/git/commit')
        .send({ message: 'test commit' });

      expect(response.status).toBe(401);
    });

    it('should reject GET /api/iteration-log without auth token', async () => {
      const response = await request(app)
        .get('/api/iteration-log');

      expect(response.status).toBe(401);
    });

    it('should reject GET /api/framework/status without auth token', async () => {
      const response = await request(app)
        .get('/api/framework/status');

      expect(response.status).toBe(401);
    });

    it('should reject request with invalid JWT token', async () => {
      const response = await request(app)
        .post('/api/render')
        .set('Authorization', 'Bearer invalid-token-here')
        .send({ scenes: [{ id: 1 }] });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('TOKEN_ERROR');
    });

    it('should reject request with wrong secret', async () => {
      const token = signToken({ sub: 'user-1' }, 'wrong-secret');

      const response = await request(app)
        .post('/api/render')
        .set('Authorization', `Bearer ${token}`)
        .send({ scenes: [{ id: 1 }] });

      expect(response.status).toBe(401);
    });

    it('should accept POST /api/render with valid JWT', async () => {
      const token = signToken({ sub: 'user-123', email: 'test@example.com' });

      const response = await request(app)
        .post('/api/render')
        .set('Authorization', `Bearer ${token}`)
        .send({ scenes: [{ id: 1 }] });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should accept POST /api/git/commit with valid JWT', async () => {
      const token = signToken({ sub: 'user-123', email: 'test@example.com' });

      const response = await request(app)
        .post('/api/git/commit')
        .set('Authorization', `Bearer ${token}`)
        .send({ message: 'test commit' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should accept GET /api/iteration-log with valid JWT', async () => {
      const token = signToken({ sub: 'user-123', email: 'test@example.com' });

      const response = await request(app)
        .get('/api/iteration-log')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should accept GET /api/framework/status with valid JWT', async () => {
      const token = signToken({ sub: 'user-123', email: 'test@example.com' });

      const response = await request(app)
        .get('/api/framework/status')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject JWT with missing sub claim', async () => {
      const token = signToken({ email: 'test@example.com' });

      const response = await request(app)
        .post('/api/render')
        .set('Authorization', `Bearer ${token}`)
        .send({ scenes: [{ id: 1 }] });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });
  });

  // -------------------------------------------------------------------------
  // Auth bypassed mode (development / test)
  // -------------------------------------------------------------------------

  describe('when auth is bypassed (development/test)', () => {
    let app: express.Express;

    beforeEach(() => {
      app = createAuthApp(stateManager, false);
    });

    it('should allow POST /api/render without auth', async () => {
      const response = await request(app)
        .post('/api/render')
        .send({ scenes: [{ id: 1 }] });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should allow GET /api/iteration-log without auth', async () => {
      const response = await request(app)
        .get('/api/iteration-log');

      expect(response.status).toBe(200);
    });

    it('should allow GET /api/framework/status without auth', async () => {
      const response = await request(app)
        .get('/api/framework/status');

      expect(response.status).toBe(200);
    });
  });
});
