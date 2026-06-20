/**
 * REQ-111: authMiddleware Express パイプライン統合テスト
 *
 * Exercises authMiddleware within a real Express pipeline using supertest.
 * Tests verify HTTP response shape, Content-Type headers, CORS header
 * propagation, and middleware ordering — beyond the scope of unit mocks.
 *
 * Uses REAL jsonwebtoken (no mocks) so actual JWT verification is tested.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import express from 'express';
import cors from 'cors';
import request from 'supertest';
import jwt from 'jsonwebtoken';

import { authMiddleware, type AuthenticatedRequest } from '../auth';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const JWT_SECRET = 'integration-test-secret-minimum-32-characters';
const CORS_ORIGIN = 'http://localhost:8080';

function signToken(payload: object, secret: string = JWT_SECRET): string {
  return jwt.sign(payload, secret, { algorithm: 'HS256' });
}

/**
 * Build a minimal Express app that mirrors the production middleware chain
 * (CORS → authMiddleware → route handler) without rate-limiters or helmet
 * to keep the test focused on auth behaviour.
 */
function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cors({ origin: [CORS_ORIGIN], credentials: true }));

  // Protected route — mirrors server.ts pipeline mount
  app.use('/api', (req, res, next) => {
    authMiddleware(req as AuthenticatedRequest, res, next);
  });

  // Dummy protected endpoint
  app.get('/api/protected', (req, res) => {
    const user = (req as AuthenticatedRequest).user;
    res.json({ success: true, data: { userId: user?.id } });
  });

  return app;
}

/**
 * Build an app that includes a rate-limiter BEFORE authMiddleware to test
 * middleware ordering (TC-111-04).
 */
function createAppWithRateLimit() {
  const app = express();
  app.use(express.json());

  // Very low rate limit: 2 requests per window
  let requestCount = 0;
  app.use('/api', (_req, res, next) => {
    requestCount++;
    if (requestCount > 2) {
      res.status(429).json({ success: false, error: { code: 'RATE_LIMITED' } });
      return;
    }
    next();
  });

  app.use('/api', (req, res, next) => {
    authMiddleware(req as AuthenticatedRequest, res, next);
  });

  app.get('/api/protected', (req, res) => {
    const user = (req as AuthenticatedRequest).user;
    res.json({ success: true, data: { userId: user?.id } });
  });

  return { app, resetCounter: () => { requestCount = 0; } };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('REQ-111: authMiddleware Express pipeline integration', () => {
  const originalEnv = process.env;

  beforeAll(() => {
    process.env = { ...originalEnv, JWT_SECRET };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // =========================================================================
  // 正常系 (Happy path)
  // =========================================================================

  describe('正常系', () => {
    let app: express.Express;

    beforeAll(() => {
      app = createApp();
    });

    // TC-111-01
    it('TC-111-01: 有効な Bearer トークンで保護されたエンドポイントが200レスポンス', async () => {
      const token = signToken({ sub: 'user-111', email: 'test@example.com', role: 'admin' });

      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${token}`)
        .set('Origin', CORS_ORIGIN);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.userId).toBe('user-111');
    });

    // TC-111-02
    it('TC-111-02: 認証成功時の Content-Type ヘッダー検証', async () => {
      const token = signToken({ sub: 'user-111', email: 'ct@test.com' });

      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${token}`)
        .set('Origin', CORS_ORIGIN);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/^application\/json/);
    });

    // TC-111-03
    it('TC-111-03: CORS ヘッダーがエラーレスポンスでも伝播', async () => {
      const response = await request(app)
        .get('/api/protected')
        .set('Origin', CORS_ORIGIN); // No auth header

      expect(response.status).toBe(401);
      expect(response.headers['access-control-allow-origin']).toBe(CORS_ORIGIN);
    });

    // TC-111-04
    it('TC-111-04: rate-limit ミドルウェアが authMiddleware の前に動作', async () => {
      const { app: rateLimitedApp, resetCounter } = createAppWithRateLimit();
      const token = signToken({ sub: 'user-111' });

      // First 2 requests pass rate limit and succeed with auth
      await request(rateLimitedApp)
        .get('/api/protected')
        .set('Authorization', `Bearer ${token}`);
      await request(rateLimitedApp)
        .get('/api/protected')
        .set('Authorization', `Bearer ${token}`);

      // Third request hits rate limit — should get 429, not 401
      const response = await request(rateLimitedApp)
        .get('/api/protected')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(429);
      expect(response.body.error.code).toBe('RATE_LIMITED');

      // Clean up for other tests
      resetCounter();
    });
  });

  // =========================================================================
  // 異常系 (Error cases)
  // =========================================================================

  describe('異常系', () => {
    let app: express.Express;

    beforeAll(() => {
      app = createApp();
    });

    // TC-111-E01
    it('TC-111-E01: 欠損 Authorization ヘッダーで401レスポンス形状検証', async () => {
      const response = await request(app)
        .get('/api/protected');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid authorization header',
        },
      });
    });

    // TC-111-E02
    it('TC-111-E02: 期限切れ JWT トークンで401 TOKEN_ERROR レスポンス', async () => {
      // Sign a token that expired 1 hour ago
      const token = signToken({ sub: 'user-111' });
      // Create a manually expired token by decoding and re-signing with exp in the past
      const decoded = jwt.decode(token) as object;
      const expiredToken = jwt.sign(
        { ...decoded },
        JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '-1h' },
      );

      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('TOKEN_ERROR');
    });

    // TC-111-E03
    it('TC-111-E03: 不正な JWT 署名で401 レスポンス', async () => {
      const token = signToken({ sub: 'user-111' }, 'wrong-secret-that-is-long-enough-32');

      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('TOKEN_ERROR');
    });
  });

  // =========================================================================
  // 境界値 (Boundary cases)
  // =========================================================================

  describe('境界値', () => {
    // TC-111-B01
    it('TC-111-B01: SUPABASE_JWT_SECRET フォールバックでの認証成功', async () => {
      const supabaseSecret = 'supabase-secret-minimum-32-characters';
      const originalJwt = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;
      process.env.SUPABASE_JWT_SECRET = supabaseSecret;

      const app = createApp();
      const token = jwt.sign({ sub: 'user-sup', email: 'sup@example.com' }, supabaseSecret, { algorithm: 'HS256' });

      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.userId).toBe('user-sup');

      // Restore
      process.env.JWT_SECRET = originalJwt;
      delete process.env.SUPABASE_JWT_SECRET;
    });

    // TC-111-B02
    it('TC-111-B02: JWT_SECRET/SUPABASE_JWT_SECRET 双方未設定で401', async () => {
      const originalJwt = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;
      delete process.env.SUPABASE_JWT_SECRET;

      const app = createApp();
      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', 'Bearer some.token.value');

      expect(response.status).toBe(401);

      // Restore
      process.env.JWT_SECRET = originalJwt;
    });
  });
});
