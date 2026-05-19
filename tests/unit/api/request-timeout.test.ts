/**
 * Tests for request timeout middleware.
 *
 * Verifies that slow requests receive 504 Gateway Timeout responses
 * and that normal requests pass through unaffected.
 */

import express, { Request, Response } from 'express';
import request from 'supertest';
import { requestTimeout } from '@/api/middleware/timeout';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createApp(timeoutMs: number, handlerDelay?: number) {
  const app = express();
  app.use(express.json());
  app.use(requestTimeout(timeoutMs));

  app.get('/fast', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.get('/delayed', (req: Request, res: Response) => {
    // Delay longer than the timeout to trigger 504
    const delay = handlerDelay ?? timeoutMs * 10;
    setTimeout(() => {
      if (!res.headersSent) {
        res.json({ late: true });
      }
    }, delay);
  });

  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('requestTimeout middleware', () => {
  it('passes through fast requests without modification', async () => {
    const app = createApp(5000);
    const res = await request(app).get('/fast');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('returns 504 when a request exceeds the timeout', async () => {
    // 50ms timeout, handler delays 500ms
    const app = createApp(50, 500);
    const res = await request(app).get('/delayed');

    expect(res.status).toBe(504);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('REQUEST_TIMEOUT');
    expect(res.body.error.message).toContain('50');
  });

  it('does not interfere when response completes before timeout', async () => {
    // 5000ms timeout, handler delays only 10ms
    const app = createApp(5000, 10);
    const res = await request(app).get('/delayed');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ late: true });
  });

  it('exports a middleware function from the factory', () => {
    expect(typeof requestTimeout).toBe('function');
    const middleware = requestTimeout(10000);
    expect(typeof middleware).toBe('function');
  });
});
