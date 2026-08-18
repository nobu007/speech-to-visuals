/**
 * REQ-207: Enhanced Health Endpoint Unit Tests
 *
 * Tests for the health route that integrates HealthCheckService:
 * - GET /health      — full component-level health check
 * - GET /health/live — Kubernetes-style liveness probe
 * - GET /health/ready — Kubernetes-style readiness probe
 *
 * Validates response shapes, HTTP status codes, and error handling.
 */

import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { healthCheckService } from '@/monitoring/health-check-service';

jest.mock('@stv/core/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { healthRouter } from '@/api/routes/health';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', healthRouter);
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Health Route', () => {
  let app: express.Express;
  let performHealthCheckSpy: jest.SpiedFunction<typeof healthCheckService.performHealthCheck>;
  let checkLivenessSpy: jest.SpiedFunction<typeof healthCheckService.checkLiveness>;
  let checkReadinessSpy: jest.SpiedFunction<typeof healthCheckService.checkReadiness>;

  beforeEach(() => {
    app = createApp();
    performHealthCheckSpy = jest.spyOn(healthCheckService, 'performHealthCheck');
    checkLivenessSpy = jest.spyOn(healthCheckService, 'checkLiveness');
    checkReadinessSpy = jest.spyOn(healthCheckService, 'checkReadiness');
  });

  afterEach(() => {
    performHealthCheckSpy.mockRestore();
    checkLivenessSpy.mockRestore();
    checkReadinessSpy.mockRestore();
  });

  describe('GET /health', () => {
    it('returns 200 with component-level health when healthy', async () => {
      performHealthCheckSpy.mockResolvedValue({
        status: 'healthy',
        timestamp: Date.now(),
        uptime: 60000,
        checks: {
          memory: { status: 'healthy', message: 'ok', latency: 1, lastChecked: Date.now() },
          cache: { status: 'healthy', message: 'ok', latency: 1, lastChecked: Date.now() },
          pipeline: { status: 'healthy', message: 'ok', latency: 1, lastChecked: Date.now() },
          llm: { status: 'healthy', message: 'ok', latency: 1, lastChecked: Date.now() },
          errorRecovery: { status: 'healthy', message: 'ok', latency: 1, lastChecked: Date.now() },
          performance: { status: 'healthy', message: 'ok', latency: 1, lastChecked: Date.now() },
        },
        metrics: {
          timestamp: Date.now(),
          uptime: 60000,
          system: { cpuUsagePercent: 0, memoryUsageMB: 0, memoryUsagePercent: 0, heapUsedMB: 0, heapTotalMB: 0 },
          pipeline: { totalRequests: 0, successRate: 0, avgProcessingTime: 0, p95ProcessingTime: 0, p99ProcessingTime: 0, activeRequests: 0 },
          llm: { totalRequests: 0, cacheHitRate: 0, flashUsagePercent: 0, proUsagePercent: 0, avgFlashResponseTime: 0, avgProResponseTime: 0, estimatedCostSavings: 0 },
          errors: { totalErrors: 0, errorRate: 0, recoverySuccessRate: 0, recentErrors: [] },
          quality: { transcriptionAccuracy: 0, layoutOverlapRate: 0, avgSceneQuality: 0 },
        },
        recommendations: ['System is operating optimally'],
      } as any);

      const res = await request(app).get('/api/v1/health');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('healthy');
      expect(res.body.data.checks).toBeDefined();
      expect(res.body.data.recommendations).toEqual(['System is operating optimally']);
      expect(res.body.data.uptime).toBe(60000);
      expect(res.body.data.timestamp).toBeDefined();
    });

    it('returns 200 with degraded status when degraded', async () => {
      performHealthCheckSpy.mockResolvedValue({
        status: 'degraded',
        timestamp: Date.now(),
        uptime: 60000,
        checks: {
          memory: { status: 'degraded', message: 'elevated', latency: 1, lastChecked: Date.now() },
          cache: { status: 'healthy', message: 'ok', latency: 1, lastChecked: Date.now() },
          pipeline: { status: 'healthy', message: 'ok', latency: 1, lastChecked: Date.now() },
          llm: { status: 'healthy', message: 'ok', latency: 1, lastChecked: Date.now() },
          errorRecovery: { status: 'healthy', message: 'ok', latency: 1, lastChecked: Date.now() },
          performance: { status: 'healthy', message: 'ok', latency: 1, lastChecked: Date.now() },
        },
        metrics: {
          timestamp: Date.now(),
          uptime: 60000,
          system: { cpuUsagePercent: 0, memoryUsageMB: 0, memoryUsagePercent: 0, heapUsedMB: 0, heapTotalMB: 0 },
          pipeline: { totalRequests: 0, successRate: 0, avgProcessingTime: 0, p95ProcessingTime: 0, p99ProcessingTime: 0, activeRequests: 0 },
          llm: { totalRequests: 0, cacheHitRate: 0, flashUsagePercent: 0, proUsagePercent: 0, avgFlashResponseTime: 0, avgProResponseTime: 0, estimatedCostSavings: 0 },
          errors: { totalErrors: 0, errorRate: 0, recoverySuccessRate: 0, recentErrors: [] },
          quality: { transcriptionAccuracy: 0, layoutOverlapRate: 0, avgSceneQuality: 0 },
        },
        recommendations: ['Consider increasing memory allocation'],
      } as any);

      const res = await request(app).get('/api/v1/health');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('degraded');
    });

    it('returns 503 with unhealthy status when unhealthy', async () => {
      performHealthCheckSpy.mockResolvedValue({
        status: 'unhealthy',
        timestamp: Date.now(),
        uptime: 60000,
        checks: {
          memory: { status: 'unhealthy', message: 'critical', latency: 1, lastChecked: Date.now() },
          cache: { status: 'healthy', message: 'ok', latency: 1, lastChecked: Date.now() },
          pipeline: { status: 'healthy', message: 'ok', latency: 1, lastChecked: Date.now() },
          llm: { status: 'healthy', message: 'ok', latency: 1, lastChecked: Date.now() },
          errorRecovery: { status: 'healthy', message: 'ok', latency: 1, lastChecked: Date.now() },
          performance: { status: 'healthy', message: 'ok', latency: 1, lastChecked: Date.now() },
        },
        metrics: {
          timestamp: Date.now(),
          uptime: 60000,
          system: { cpuUsagePercent: 0, memoryUsageMB: 0, memoryUsagePercent: 0, heapUsedMB: 0, heapTotalMB: 0 },
          pipeline: { totalRequests: 0, successRate: 0, avgProcessingTime: 0, p95ProcessingTime: 0, p99ProcessingTime: 0, activeRequests: 0 },
          llm: { totalRequests: 0, cacheHitRate: 0, flashUsagePercent: 0, proUsagePercent: 0, avgFlashResponseTime: 0, avgProResponseTime: 0, estimatedCostSavings: 0 },
          errors: { totalErrors: 0, errorRate: 0, recoverySuccessRate: 0, recentErrors: [] },
          quality: { transcriptionAccuracy: 0, layoutOverlapRate: 0, avgSceneQuality: 0 },
        },
        recommendations: ['CRITICAL: Memory usage is very high'],
      } as any);

      const res = await request(app).get('/api/v1/health');

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.data.status).toBe('unhealthy');
    });

    it('returns 503 when performHealthCheck throws', async () => {
      performHealthCheckSpy.mockRejectedValue(new Error('service unavailable'));

      const res = await request(app).get('/api/v1/health');

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.data.status).toBe('unhealthy');
      expect(res.body.data.error).toBe('service unavailable');
    });
  });

  describe('GET /health/live', () => {
    it('returns 200 when alive', async () => {
      checkLivenessSpy.mockResolvedValue({ alive: true, reason: 'System is responsive' });

      const res = await request(app).get('/api/v1/health/live');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.alive).toBe(true);
      expect(res.body.data.reason).toBe('System is responsive');
    });

    it('returns 503 when not alive', async () => {
      checkLivenessSpy.mockResolvedValue({ alive: false, reason: 'System responsiveness issue' });

      const res = await request(app).get('/api/v1/health/live');

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.data.alive).toBe(false);
    });
  });

  describe('GET /health/ready', () => {
    it('returns 200 when ready', async () => {
      checkReadinessSpy.mockResolvedValue({ ready: true, reason: 'System is ready to accept requests' });

      const res = await request(app).get('/api/v1/health/ready');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ready).toBe(true);
      expect(res.body.data.reason).toBe('System is ready to accept requests');
    });

    it('returns 503 when not ready', async () => {
      checkReadinessSpy.mockResolvedValue({ ready: false, reason: 'System is unhealthy: memory' });

      const res = await request(app).get('/api/v1/health/ready');

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.data.ready).toBe(false);
      expect(res.body.data.reason).toBe('System is unhealthy: memory');
    });
  });
});
