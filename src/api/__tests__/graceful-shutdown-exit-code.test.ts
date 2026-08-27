/**
 * Tests for graceful shutdown exit-code parity
 * (src/api/index.ts)
 *
 * Verifies that the exit code passed to `process.exit` matches the signal
 * category:
 *   - SIGTERM / SIGINT              → exit(0)  (orchestrator-requested drain)
 *   - uncaughtException / unhandled → exit(1)  (abnormal termination)
 *
 * Pre-fix behaviour: every code path called `process.exit(0)`, so an
 * `uncaughtException` (which surfaces as a crash, not a clean drain) was
 * reported to the orchestrator and CI as a successful exit. This test pins
 * the parity that the abnormal paths must surface a non-zero code.
 *
 * We exercise `exitCodeForSignal` directly for the four signal categories,
 * then one integration leg drives gracefulShutdown('uncaughtException') on
 * the shared module instance through to a spied process.exit (the clean
 * SIGTERM → exit(0) half stays pinned in graceful-shutdown.test.ts).
 */

import { jest } from '@jest/globals';

// Mocks required to load src/api/index.ts (mirrors the suite in
// graceful-shutdown.test.ts so the module imports resolve).

const mockServerClose = jest.fn((cb?: () => void) => {
  cb?.();
});
const mockServerLike = { close: mockServerClose, once: jest.fn(), on: jest.fn() };
const mockServerListen = jest.fn((_port: number, cb?: () => void) => {
  cb?.();
  return mockServerLike;
});

jest.unstable_mockModule('http', () => ({
  createServer: jest.fn(() => mockServerLike),
  Server: jest.fn().mockImplementation(() => mockServerLike),
}));

jest.unstable_mockModule('express', () => {
  const factory = jest.fn(() => ({
    listen: mockServerListen,
    use: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    set: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    close: mockServerClose,
  }));
  (factory as any).Router = jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    use: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  }));
  (factory as any).json = jest.fn();
  (factory as any).urlencoded = jest.fn();
  (factory as any).static = jest.fn();
  return factory;
});

jest.unstable_mockModule('@/quality/enhanced-error-recovery', () => ({
  globalErrorRecovery: { shutdown: jest.fn().mockResolvedValue(undefined) },
}));
jest.unstable_mockModule('@/framework/continuous-learner', () => ({
  continuousLearner: { stopLearning: jest.fn() },
}));
jest.unstable_mockModule('@/analysis/llm-service', () => ({ llmService: {} }));
jest.unstable_mockModule('@/api/startup-warmup', () => ({
  triggerStartupWarmup: jest.fn(),
}));
jest.unstable_mockModule('@/monitoring/real-time-performance-monitor', () => ({
  realTimeMonitor: { stop: jest.fn() },
}));
jest.unstable_mockModule('@/monitoring/performance-dashboard', () => ({
  globalDashboard: { destroy: jest.fn() },
}));
jest.unstable_mockModule('@/monitoring/health-check-service', () => ({
  healthCheckService: { destroy: jest.fn() },
}));
jest.unstable_mockModule('@/api/server', () => ({
  app: {
    listen: mockServerListen,
    use: jest.fn(),
    get: jest.fn(),
  },
  artifactStore: { stop: jest.fn().mockResolvedValue(undefined) },
  jobQueue: { stop: jest.fn().mockResolvedValue(undefined) },
}));
jest.unstable_mockModule('@stv/core/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import { exitCodeForSignal, gracefulShutdown } from '../index';

describe('graceful shutdown exit code parity', () => {
  it('SIGTERM resolves to exit code 0 (orchestrator-requested clean drain)', () => {
    expect(exitCodeForSignal('SIGTERM')).toBe(0);
  });

  it('SIGINT resolves to exit code 0 (orchestrator-requested clean drain)', () => {
    expect(exitCodeForSignal('SIGINT')).toBe(0);
  });

  it('uncaughtException resolves to exit code 1 (abnormal termination)', () => {
    // Pre-fix: this was 0 (silent crash) → RED on the fix.
    expect(exitCodeForSignal('uncaughtException')).toBe(1);
  });

  it('unhandledRejection resolves to exit code 1 (abnormal termination)', () => {
    // Pre-fix: this was 0 (silent crash) → RED on the fix.
    expect(exitCodeForSignal('unhandledRejection')).toBe(1);
  });

  it('parity contract: clean drain ≠ abnormal termination', () => {
    // Cross-path parity anchor: the two abnormal signals must be 1, the two
    // clean signals must be 0, and 1 ≠ 0. If any path drifts back to a single
    // hard-coded exit code, this assertion fails.
    const codes = {
      SIGTERM: exitCodeForSignal('SIGTERM'),
      SIGINT: exitCodeForSignal('SIGINT'),
      uncaughtException: exitCodeForSignal('uncaughtException'),
      unhandledRejection: exitCodeForSignal('unhandledRejection'),
    };
    expect(codes.SIGTERM).toBe(0);
    expect(codes.SIGINT).toBe(0);
    expect(codes.uncaughtException).toBe(1);
    expect(codes.unhandledRejection).toBe(1);
    expect(new Set(Object.values(codes)).size).toBe(2);
  });
});

describe('gracefulShutdown integration — the exit code reaches process.exit', () => {
  it('uncaughtException path calls process.exit with code 1', async () => {
    // Integration leg (eval follow-up on run 20260827-191221): the legs above
    // pin the pure signal→code map; this leg pins the wiring — the signal
    // must flow gracefulShutdown → exitCodeForSignal → process.exit. The
    // module instance imported above has never had gracefulShutdown invoked
    // (the pure legs do not touch isShuttingDown), so the idempotent guard
    // does not swallow this call. The pre-fix shape (process.exit(0) on
    // every path) REDs here exactly like the pure uncaught/unhandled legs.
    const originalExit = process.exit;
    const exitSpy = jest.fn((_code?: number) => undefined as never);
    process.exit = exitSpy as typeof process.exit;
    try {
      await gracefulShutdown('uncaughtException');
    } finally {
      process.exit = originalExit;
    }
    expect(exitSpy).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
