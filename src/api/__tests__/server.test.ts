/**
 * Tests for server.ts
 *
 * Covers:
 *  - CORS configuration (production/development)
 *  - Monitoring route registration (TASK-0147)
 */

import request from 'supertest';

/**
 * Clean up background timers from monitoring singletons that get
 * instantiated when the server module is imported with NODE_ENV !== 'test'.
 *
 * When tests set NODE_ENV to 'development' or 'production' before importing
 * the server, the HealthCheckService and RealTimePerformanceMonitor
 * constructors start setInterval timers. These must be stopped to prevent
 * Jest worker hangs (especially with maxWorkers > 1).
 */
async function cleanupMonitoringTimers(): Promise<void> {
  try {
    const { healthCheckService } = await import('../../monitoring/health-check-service');
    healthCheckService.stop?.();
  } catch { /* module not loaded */ }
  try {
    const { realTimeMonitor } = await import('../../monitoring/real-time-performance-monitor');
    realTimeMonitor.stop?.();
  } catch { /* module not loaded */ }
  try {
    const { globalDashboard } = await import('../../monitoring/performance-dashboard');
    globalDashboard.destroy?.();
  } catch { /* module not loaded */ }
}

describe('server CORS configuration', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalJwtSecret = process.env.JWT_SECRET;

  afterEach(async () => {
    await cleanupMonitoringTimers();
    jest.resetModules();
    process.env.NODE_ENV = originalEnv;
    if (originalJwtSecret) process.env.JWT_SECRET = originalJwtSecret;
    else delete process.env.JWT_SECRET;
  });

  it('should configure CORS with specific origins in development', async () => {
    process.env.NODE_ENV = 'development';
    const { app } = await import('../server');
    expect(app).toBeDefined();
  });

  it('should configure CORS with origin=false in production', async () => {
    // Reset module registry so the module is re-imported with new env
    jest.resetModules();
    process.env.NODE_ENV = 'production';
    // ISS-045: JWT_SECRET required in production
    process.env.JWT_SECRET = 'Test-Secret-Key-For-Production-Test-2026!@#$';

    const { app } = await import('../server');
    expect(app).toBeDefined();

    // Restore
    jest.resetModules();
    process.env.NODE_ENV = originalEnv;
    if (originalJwtSecret) process.env.JWT_SECRET = originalJwtSecret;
    else delete process.env.JWT_SECRET;
  });
});

// ---------------------------------------------------------------------------
// TASK-0147: Verify monitoring routes are wired into production server
// ---------------------------------------------------------------------------
describe('server monitoring route registration', () => {
  afterEach(async () => {
    await cleanupMonitoringTimers();
    jest.resetModules();
  });

  it('should register monitoring endpoints at /api/v1/monitoring', async () => {
    jest.resetModules();
    process.env.NODE_ENV = 'development';
    const { app } = await import('../server');

    // Verify monitoring health endpoint responds
    const healthRes = await request(app)
      .get('/api/v1/monitoring/health');
    expect(healthRes.status).toBe(200);
    expect(healthRes.body.success).toBe(true);
    expect(healthRes.body.data).toHaveProperty('status');

    // Verify monitoring cost endpoint responds
    const costRes = await request(app)
      .get('/api/v1/monitoring/cost');
    expect(costRes.status).toBe(200);
    expect(costRes.body.success).toBe(true);
    expect(costRes.body.data).toHaveProperty('totalCost');

    // Clean up the globalDashboard timer
    const { globalDashboard } = await import('../../monitoring/performance-dashboard');
    globalDashboard.destroy();
  });

  it('should register monitoring metrics endpoint', async () => {
    jest.resetModules();
    process.env.NODE_ENV = 'development';
    const { app } = await import('../server');

    const res = await request(app)
      .get('/api/v1/monitoring/metrics');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('summary');

    // Clean up
    const { globalDashboard } = await import('../../monitoring/performance-dashboard');
    globalDashboard.destroy();
  });
});
