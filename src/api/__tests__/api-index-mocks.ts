/**
 * Shared `../index` mock graph for the graceful-shutdown suites
 * (graceful-shutdown.test.ts, graceful-shutdown-exit-code.test.ts,
 * graceful-shutdown-exit-wiring.test.ts).
 *
 * Every suite that loads src/api/index.ts needs the same ~10
 * unstable_mockModule registrations for the import to resolve without
 * booting the real server graph (express internals, app.listen(3001),
 * the real logger). The graph used to be copy-pasted across the three
 * files (~60 lines each), so a new dependency of ../index meant patching
 * three places in lockstep — extracted here (eval follow-up on run
 * 20260827-194357, suggestion 2) so there is one registration site.
 *
 * Usage contract:
 *   import { registerApiIndexMocks } from './api-index-mocks';
 *   registerApiIndexMocks();          // test-file top level
 *   ...                                // later: await import('../index')
 *
 * - Call it at the test file's top level: unstable_mockModule is NOT
 *   hoisted, it applies purely by execution order, so the registrations
 *   must run before the (dynamic) import of '../index' — importing this
 *   helper statically satisfies that for every current consumer.
 * - jest hands each test FILE its own module registry; the static import
 *   keeps the registrations in the importing file's registry, so the
 *   helper stays per-file scoped exactly like the inline calls it
 *   replaces.
 * - Mocks referenced by assertions (the shutdown-path collaborators) are
 *   returned as handles; everything else stays internal to the factory
 *   closures.
 */

import { jest } from '@jest/globals';

export function registerApiIndexMocks() {
  const serverClose = jest.fn((cb?: () => void) => {
    cb?.();
  });
  const serverLike = { close: serverClose, once: jest.fn(), on: jest.fn() };
  const serverListen = jest.fn((_port: number, cb?: () => void) => {
    cb?.();
    return serverLike;
  });

  jest.unstable_mockModule('http', () => ({
    // In ESM, jest.requireActual may not work. Provide a minimal mock.
    createServer: jest.fn(() => serverLike),
    Server: jest.fn().mockImplementation(() => serverLike),
  }));

  // Mock express to avoid importing the real module which needs http internals
  jest.unstable_mockModule('express', () => {
    const factory = jest.fn(() => ({
      listen: serverListen,
      use: jest.fn(),
      get: jest.fn(),
      post: jest.fn(),
      set: jest.fn(),
      on: jest.fn(),
      once: jest.fn(),
      close: serverClose,
    }));
    // Provide named exports that ESM imports expect
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

  const errorRecoveryShutdown = jest.fn().mockResolvedValue(undefined);
  const stopLearning = jest.fn();
  const monitorStop = jest.fn();
  const dashboardDestroy = jest.fn();
  const healthDestroy = jest.fn();

  jest.unstable_mockModule('@/quality/enhanced-error-recovery', () => ({
    globalErrorRecovery: { shutdown: errorRecoveryShutdown },
  }));

  jest.unstable_mockModule('@/framework/continuous-learner', () => ({
    continuousLearner: { stopLearning },
  }));

  jest.unstable_mockModule('@/analysis/llm-service', () => ({
    llmService: {},
  }));

  jest.unstable_mockModule('@/api/startup-warmup', () => ({
    triggerStartupWarmup: jest.fn(),
  }));

  jest.unstable_mockModule('@/monitoring/real-time-performance-monitor', () => ({
    realTimeMonitor: { stop: monitorStop },
  }));

  jest.unstable_mockModule('@/monitoring/performance-dashboard', () => ({
    globalDashboard: { destroy: dashboardDestroy },
  }));

  jest.unstable_mockModule('@/monitoring/health-check-service', () => ({
    healthCheckService: { destroy: healthDestroy },
  }));

  jest.unstable_mockModule('@/api/server', () => ({
    app: {
      listen: serverListen,
      use: jest.fn(),
      get: jest.fn(),
    },
    artifactStore: { stop: jest.fn().mockResolvedValue(undefined) },
    jobQueue: { stop: jest.fn().mockResolvedValue(undefined) },
  }));

  jest.unstable_mockModule('@stv/core/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  }));

  return {
    serverClose,
    serverListen,
    errorRecoveryShutdown,
    stopLearning,
    monitorStop,
    dashboardDestroy,
    healthDestroy,
  };
}

export type ApiIndexMockHandles = ReturnType<typeof registerApiIndexMocks>;
