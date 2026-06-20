/**
 * Tests for graceful shutdown handler (src/api/index.ts)
 *
 * Verifies that SIGTERM / SIGINT / uncaughtException / unhandledRejection
 * trigger orderly cleanup of background services.
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

jest.unstable_mockModule('@/quality/enhanced-error-recovery', () => ({
  globalErrorRecovery: { shutdown: mockShutdown },
}));

jest.unstable_mockModule('@/framework/continuous-learner', () => ({
  continuousLearner: { stopLearning: mockStopLearning },
}));

jest.unstable_mockModule('@/analysis/llm-service', () => ({
  llmService: {},
}));

jest.unstable_mockModule('@/api/startup-warmup', () => ({
  triggerStartupWarmup: jest.fn(),
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

jest.unstable_mockModule('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

const mockExit = jest.fn((_code?: number) => undefined as never);
const originalExit = process.exit;

// We spy on process.on so we can capture registered handlers
const registeredHandlers: Map<string, (...args: unknown[]) => void> = new Map();
const originalProcessOn = process.on;

beforeAll(() => {
  // Override process.exit so we don't kill the test runner
  process.exit = mockExit as typeof process.exit;
});

afterAll(() => {
  process.exit = originalExit;
  // Not needed to restore process.on because jest isolates modules
});

describe('graceful shutdown', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    registeredHandlers.clear();
  });

  it('registers handlers for SIGTERM, SIGINT, uncaughtException, unhandledRejection', async () => {
    // Capture process.on registrations by temporarily intercepting
    const spies: string[] = [];
    const origOn = process.on;
    const patchedOn = jest.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (['SIGTERM', 'SIGINT', 'uncaughtException', 'unhandledRejection'].includes(event)) {
        spies.push(event);
        registeredHandlers.set(event, handler);
      }
      return origOn.call(process, event, handler);
    });

    const saved = process.on;
    (process as unknown as { on: typeof patchedOn }).on = patchedOn;

    await import('../index');

    (process as unknown as { on: typeof saved }).on = saved;

    expect(spies).toContain('SIGTERM');
    expect(spies).toContain('SIGINT');
    expect(spies).toContain('uncaughtException');
    expect(spies).toContain('unhandledRejection');
  });

  it('calls globalErrorRecovery.shutdown() and continuousLearner.stopLearning()', async () => {
    // First import to get handlers registered
    const origOn = process.on;
    const patchedOn = jest.fn((event: string, handler: (...args: unknown[]) => void) => {
      registeredHandlers.set(event, handler);
      return origOn.call(process, event, handler);
    });
    (process as unknown as { on: typeof patchedOn }).on = patchedOn;

    await import('../index');

    (process as unknown as { on: typeof origOn }).on = origOn;

    const handler = registeredHandlers.get('SIGTERM');
    expect(handler).toBeDefined();

    // Invoke the handler (it's async)
    await handler!('SIGTERM');

    expect(mockShutdown).toHaveBeenCalled();
    expect(mockStopLearning).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(0);
  });

  it('prevents double-invocation (idempotent)', async () => {
    const origOn = process.on;
    const patchedOn = jest.fn((event: string, handler: (...args: unknown[]) => void) => {
      registeredHandlers.set(event, handler);
      return origOn.call(process, event, handler);
    });
    (process as unknown as { on: typeof patchedOn }).on = patchedOn;

    await import('../index');

    (process as unknown as { on: typeof origOn }).on = origOn;

    const handler = registeredHandlers.get('SIGINT');
    expect(handler).toBeDefined();

    // First call
    await handler!('SIGINT');
    jest.clearAllMocks();

    // Second call — should be a no-op
    await handler!('SIGINT');

    expect(mockShutdown).not.toHaveBeenCalled();
    expect(mockExit).not.toHaveBeenCalled();
  });
});
