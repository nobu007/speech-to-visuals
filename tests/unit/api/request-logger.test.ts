/**
 * REQ-201: Structured HTTP request/response logging middleware tests
 *
 * Verifies that the requestLogger middleware:
 * - Logs requests with method, path, statusCode, duration, requestId
 * - Uses logger.info for 2xx, logger.warn for 4xx, logger.error for 5xx
 * - Skips health check endpoints to reduce noise
 * - Records response duration in milliseconds
 */

import express, { type Request, type Response, type NextFunction } from 'express';
import supertest from 'supertest';
import { logger } from '@stv/core/utils/logger';
import { requestLogger } from '@/api/middleware/request-logger';

function createApp() {
  const app = express();

  app.use(requestLogger);

  app.get('/api/v1/test', (_req: Request, res: Response) => {
    res.json({ success: true });
  });

  app.get('/api/v1/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/v1/bad', (_req: Request, res: Response) => {
    res.status(400).json({ error: 'bad request' });
  });

  app.get('/api/v1/server-error', (_req: Request, res: Response) => {
    res.status(500).json({ error: 'internal error' });
  });

  return app;
}

let infoSpy: jest.SpyInstance;
let warnSpy: jest.SpyInstance;
let errorSpy: jest.SpyInstance;

beforeEach(() => {
  infoSpy = jest.spyOn(logger, 'info').mockImplementation(() => {});
  warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
  errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
});

afterEach(() => {
  infoSpy.mockRestore();
  warnSpy.mockRestore();
  errorSpy.mockRestore();
});

describe('requestLogger middleware', () => {
  it('logs successful requests (2xx) at info level', async () => {
    const app = createApp();
    await supertest(app).get('/api/v1/test');

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const call = infoSpy.mock.calls[0];
    expect(call[0]).toContain('GET');
    expect(call[0]).toContain('/api/v1/test');
    expect(call[0]).toContain('200');
  });

  it('logs 4xx responses at warn level', async () => {
    const app = createApp();
    await supertest(app).get('/api/v1/bad');

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const call = warnSpy.mock.calls[0];
    expect(call[0]).toContain('400');
  });

  it('logs 5xx responses at error level', async () => {
    const app = createApp();
    await supertest(app).get('/api/v1/server-error');

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const call = errorSpy.mock.calls[0];
    expect(call[0]).toContain('500');
  });

  it('includes method, path, status, and duration in log message', async () => {
    const app = createApp();
    await supertest(app).get('/api/v1/test');

    const logMessage = infoSpy.mock.calls[0][0];
    expect(logMessage).toMatch(/GET/);
    expect(logMessage).toMatch(/\/api\/v1\/test/);
    expect(logMessage).toMatch(/200/);
    expect(logMessage).toMatch(/\d+ms/);
  });

  it('includes requestId from X-Request-ID header when present', async () => {
    const app = createApp();
    await supertest(app)
      .get('/api/v1/test')
      .set('X-Request-ID', 'test-correlation-123');

    const logMessage = infoSpy.mock.calls[0][0];
    expect(logMessage).toContain('test-correlation-123');
  });

  it('shows "-" when no requestId is present', async () => {
    const app = createApp();
    await supertest(app).get('/api/v1/test');

    const logMessage = infoSpy.mock.calls[0][0];
    expect(logMessage).toContain('rid=-');
  });

  it('skips logging for health check endpoints', async () => {
    const app = createApp();
    await supertest(app).get('/api/v1/health');

    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
