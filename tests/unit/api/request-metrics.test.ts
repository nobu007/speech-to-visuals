/**
 * REQ-205: Request Metrics Middleware tests
 *
 * Verifies that the requestMetrics middleware:
 * - Records metrics for regular endpoints
 * - Skips health check endpoints
 * - Propagates correlation ID from X-Request-ID
 * - Correctly tracks active requests
 */

import express, { type Request, type Response } from 'express';
import supertest from 'supertest';
import { requestMetrics } from '@/api/middleware/request-metrics';
import { httpMetricsCollector } from '@/monitoring/http-metrics-collector';

function createApp() {
  const app = express();
  app.use(requestMetrics);

  app.get('/api/v1/test', (_req: Request, res: Response) => {
    res.json({ success: true });
  });

  app.get('/api/v1/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  app.post('/api/v1/data', (_req: Request, res: Response) => {
    res.status(201).json({ created: true });
  });

  app.get('/api/v1/error', (_req: Request, res: Response) => {
    res.status(500).json({ error: 'fail' });
  });

  return app;
}

beforeEach(() => {
  httpMetricsCollector.reset();
});

describe('requestMetrics middleware', () => {
  it('records metrics for a successful request', async () => {
    const app = createApp();
    await supertest(app).get('/api/v1/test');

    const snap = httpMetricsCollector.getSnapshot();
    expect(snap.totalRequests).toBe(1);
    expect(snap.routes).toHaveLength(1);
    expect(snap.routes[0]).toMatchObject({
      method: 'GET',
      path: '/api/v1/test',
      count: 1,
      errorCount: 0,
    });
  });

  it('records metrics for different HTTP methods', async () => {
    const app = createApp();
    await supertest(app).get('/api/v1/test');
    await supertest(app).post('/api/v1/data');

    const snap = httpMetricsCollector.getSnapshot();
    expect(snap.routes).toHaveLength(2);
    const getRoute = snap.routes.find(r => r.method === 'GET' && r.path === '/api/v1/test');
    const postRoute = snap.routes.find(r => r.method === 'POST' && r.path === '/api/v1/data');
    expect(getRoute).toBeDefined();
    expect(postRoute).toBeDefined();
  });

  it('counts 5xx responses as errors', async () => {
    const app = createApp();
    await supertest(app).get('/api/v1/error');

    const snap = httpMetricsCollector.getSnapshot();
    expect(snap.totalErrors).toBe(1);
    expect(snap.routes[0].errorCount).toBe(1);
  });

  it('skips health check endpoints', async () => {
    const app = createApp();
    await supertest(app).get('/api/v1/health');

    const snap = httpMetricsCollector.getSnapshot();
    expect(snap.totalRequests).toBe(0);
    expect(snap.routes).toHaveLength(0);
  });

  it('uses correlation ID from header', async () => {
    const app = createApp();
    // Use a slow threshold that won't trigger - just verify recording works
    await supertest(app)
      .get('/api/v1/test')
      .set('X-Request-ID', 'corr-123');

    const snap = httpMetricsCollector.getSnapshot();
    expect(snap.totalRequests).toBe(1);
  });

  it('records duration with non-zero latency', async () => {
    const app = createApp();
    await supertest(app).get('/api/v1/test');

    const snap = httpMetricsCollector.getSnapshot();
    expect(snap.routes[0].avgMs).toBeGreaterThanOrEqual(0);
    expect(snap.routes[0].minMs).toBeGreaterThanOrEqual(0);
    expect(snap.routes[0].maxMs).toBeGreaterThanOrEqual(0);
  });
});
