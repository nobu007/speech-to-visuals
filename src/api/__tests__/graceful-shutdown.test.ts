/**
 * Tests for graceful shutdown handler (src/api/index.ts)
 *
 * Verifies that SIGTERM / SIGINT / uncaughtException / unhandledRejection
 * trigger orderly cleanup of background services, including monitoring
 * singletons that own setInterval timers.
 */

import { jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// Mocks — must be before any import that touches the real modules
// ---------------------------------------------------------------------------

const mockServerClose = jest.fn((cb?: () => void) => {
  cb?.();
});
const mockServerLike = { close: mockServerClose, once: jest.fn(), on: jest.fn() };
const mockServerListen = jest.fn((_port: number, cb?: () => void) => {
  cb?.();
  return mockServerLike;
});

jest.mock('http', () => {
  const actual = jest.requireActual('http');
  return {
    ...actual,
    createServer: jest.fn(),
  };
});

const mockShutdown = jest.fn().mockResolvedValue(undefined);
const mockStopLearning = jest.fn();
const mockRealTimeMonitorStop = jest.fn();
const mockGlobalDashboardDestroy = jest.fn();
const mockHealthCheckServiceDestroy = jest.fn();

jest.mock('@/quality/enhanced-error-recovery', () => ({
  globalErrorRecovery: { shutdown: mockShutdown },
}));

jest.mock('@/framework/continuous-learner', () => ({
  continuousLearner: { stopLearning: mockStopLearning },
}));

jest.mock('@/analysis/llm-service', () => ({
  llmService: {},
}));

jest.mock('@/api/startup-warmup', () => ({
  triggerStartupWarmup: jest.fn(),
}));

jest.mock('@/monitoring/real-time-performance-monitor', () => ({
  realTimeMonitor: { stop: mockRealTimeMonitorStop },
}));

jest.mock('@/monitoring/performance-dashboard', () => ({
  globalDashboard: { destroy: mockGlobalDashboardDestroy },
}));

jest.mock('@/monitoring/health-check-service', () => ({
  healthCheckService: { destroy: mockHealthCheckServiceDestroy },
}));

jest.mock('@/api/server', () => ({
  app: {
    listen: mockServerListen,
    use: jest.fn(),
    get: jest.fn(),
  },
  artifactStore: { stop: jest.fn().mockResolvedValue(undefined) },
  jobQueue: { stop: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

const mockExit = jest.fn((_code?: number) => undefined as never);
const originalExit = process.exit;

// Capture registered signal handlers
const registeredHandlers: Map<string, (...args: unknown[]) => void> = new Map();

beforeAll(() => {
  process.exit = mockExit as typeof process.exit;

  // Intercept process.on to capture signal handlers
  const origOn = process.on;
  (process as unknown as { on: typeof origOn }).on = jest.fn(
    (event: string | symbol, handler: (...args: unknown[]) => void) => {
      if (typeof event === 'string') {
        registeredHandlers.set(event, handler);
      }
      return origOn.call(process, event, handler);
    },
  ) as typeof origOn;

  // Load the module once — signal handlers get registered
  require('../index');
});

afterAll(() => {
  process.exit = originalExit;
});

describe('graceful shutdown', () => {
  // All assertions run in a single test because the shutdown handler
  // sets an idempotent guard (`isShuttingDown`) that prevents re-invocation.
  it('on SIGTERM: stops all services including monitoring singletons', async () => {
    // Verify signal handlers are registered
    expect(registeredHandlers.has('SIGTERM')).toBe(true);
    expect(registeredHandlers.has('SIGINT')).toBe(true);
    expect(registeredHandlers.has('uncaughtException')).toBe(true);
    expect(registeredHandlers.has('unhandledRejection')).toBe(true);

    const handler = registeredHandlers.get('SIGTERM');
    expect(handler).toBeDefined();

    await handler!('SIGTERM');

    // Core services
    expect(mockShutdown).toHaveBeenCalled();
    expect(mockStopLearning).toHaveBeenCalled();
    // Monitoring singletons added to prevent setInterval leaks
    expect(mockRealTimeMonitorStop).toHaveBeenCalled();
    expect(mockGlobalDashboardDestroy).toHaveBeenCalled();
    expect(mockHealthCheckServiceDestroy).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(0);
  });

  it('prevents double-invocation (idempotent)', async () => {
    const handler = registeredHandlers.get('SIGINT');
    expect(handler).toBeDefined();

    // SIGINT should be a no-op since SIGTERM already triggered shutdown
    const shutdownBefore = mockShutdown.mock.calls.length;
    await handler!('SIGINT');
    expect(mockShutdown.mock.calls.length).toBe(shutdownBefore);
  });
});
