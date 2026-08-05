/**
 * Verifies that the /health endpoint logs errors (not silently swallowed)
 * when healthCheckService.performHealthCheck() throws.
 */

import express from 'express';
import request from 'supertest';
import { healthRouter } from '../health';
import { healthCheckService } from '../../../monitoring/health-check-service';
import { logger } from '../../../utils/logger';

jest.mock('../../../monitoring/health-check-service');

describe('Health route error logging', () => {
  let loggerSpy: jest.SpyInstance;

  beforeEach(() => {
    loggerSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    loggerSpy.mockRestore();
    jest.restoreAllMocks();
  });

  it('should log via logger.error when health check throws', async () => {
    const error = new Error('Health check service crashed');
    jest.spyOn(healthCheckService, 'performHealthCheck').mockRejectedValue(error);

    const app = express();
    app.use(healthRouter);

    const response = await request(app).get('/health');

    expect(response.status).toBe(503);
    expect(response.body.success).toBe(false);
    expect(loggerSpy).toHaveBeenCalledWith(
      '[health] Health check failed:',
      error,
    );
  });
});
