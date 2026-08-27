/**
 * Graceful-shutdown exit-code WIRING test (src/api/index.ts) — the
 * integration counterpart of graceful-shutdown-exit-code.test.ts.
 *
 * The exit-code suite pins the pure signal→code map (exitCodeForSignal);
 * this suite pins the wiring: a signal driven through gracefulShutdown must
 * reach process.exit with the parity code, exactly once. The clean drain
 * half (SIGTERM → exit(0)) is already pinned at the wiring level in
 * graceful-shutdown.test.ts, so this file drives the abnormal half and
 * completes both signal categories at the wiring level (INV-API-001).
 *
 * Why a dedicated file instead of a describe block next to the pure legs:
 * `isShuttingDown` is module-PRIVATE, so the only jest-level way to reset
 * the idempotent guard is a fresh module registry — and jest hands every
 * test file its own registry. Hosting this leg in its own file makes the
 * freshness structural: no earlier leg (in this file or any other) can have
 * consumed the guard, and legs added later cannot break it.
 *
 * Why not jest.isolateModulesAsync (the in-file fresh-import API): with
 * native-VM ESM, an isolated import of a MOCK-WIRED module graph (this file
 * unstable_mockModule's every dependency of ../index) is evaluated in a
 * separate VM context whose `process` is not the test realm's — a
 * process.exit spy installed from the test is never reached (verified
 * empirically on jest 30.4.2: a plain module imported in the same isolated
 * registry DOES hit the spy; the mock-wired ../index does not). File-level
 * isolation sidesteps the whole class.
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

describe('gracefulShutdown wiring — the exit code reaches process.exit', () => {
  it('uncaughtException path calls process.exit with code 1', async () => {
    // The pre-fix shape (process.exit(0) on every path) REDs here exactly
    // like the pure uncaught/unhandled legs: the spy records the code the
    // orchestrator would actually see.
    //
    // process.exit is replaced by plain property assignment (the same idiom
    // as graceful-shutdown.test.ts), NOT jest.spyOn: spyOn's
    // defineProperty-based swap is NOT VISIBLE to the module under test —
    // it evaluates in a separate VM context and reads process.exit at call
    // time from that context, where the spy's descriptor never landed
    // (empirically verified on jest 30.4.2: this exact leg is green with
    // the assignment and permanently RED with spyOn — 0 recorded calls).
    // Restore in finally keeps the worker's real process.exit intact even
    // when the leg fails.
    const exitSpy = jest.fn((_code?: number) => undefined as never);
    const originalExit = process.exit;
    process.exit = exitSpy as typeof process.exit;
    try {
      // Fresh module registry (this file's own): isShuttingDown starts
      // false by construction, and the mocks above apply because the
      // import is dynamic.
      const { gracefulShutdown } = await import('../index');
      await gracefulShutdown('uncaughtException');
    } finally {
      process.exit = originalExit;
    }
    expect(exitSpy).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
