/**
 * Tests for graceful shutdown handler (src/api/index.ts)
 *
 * Verifies that SIGTERM / SIGINT / uncaughtException / unhandledRejection
 * trigger orderly cleanup of background services, including monitoring
 * singletons that own setInterval timers.
 */

import { jest } from '@jest/globals';
import { registerApiIndexMocks } from './api-index-mocks';

// ---------------------------------------------------------------------------
// Mocks — must be before any import that touches the real modules.
// The ../index mock graph is shared with the other graceful-shutdown suites
// (see ./api-index-mocks.ts); the returned handles are the collaborators
// this suite asserts on.
// ---------------------------------------------------------------------------

const {
  errorRecoveryShutdown: mockShutdown,
  stopLearning: mockStopLearning,
  monitorStop: mockRealTimeMonitorStop,
  dashboardDestroy: mockGlobalDashboardDestroy,
  healthDestroy: mockHealthCheckServiceDestroy,
} = registerApiIndexMocks();

const mockExit = jest.fn((_code?: number) => undefined as never);
const originalExit = process.exit;

// Capture registered signal handlers
const registeredHandlers: Map<string, (...args: unknown[]) => void> = new Map();

beforeAll(async () => {
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
  // Use dynamic import for ESM compatibility
  await import('../index');
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
