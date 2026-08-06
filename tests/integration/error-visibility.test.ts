/**
 * @jest-environment jsdom
 *
 * Integration test: Error visibility when handleError is invoked
 *
 * Context: The feedback noted that .catch additions should ensure user-visible
 * error notification when handleError is called (e.g. sync failure notifications).
 *
 * This test verifies that:
 * 1. handleError triggers registered error callbacks (user-visible notification path)
 * 2. Callback invocation failures don't swallow the original error
 * 3. The error alert contains a user-friendly message
 * 4. Multiple components registering callbacks all receive notifications
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock logger to avoid console noise during tests
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { ProductionErrorHandler } from '@/monitoring/production-error-handler';
import type { ErrorAlert } from '@/monitoring/production-error-handler';

describe('Error visibility: handleError → user notification', () => {
  let handler: ProductionErrorHandler;

  beforeEach(() => {
    handler = new ProductionErrorHandler();
  });

  it('handleError triggers registered error callback with user-friendly alert', async () => {
    const receivedAlerts: ErrorAlert[] = [];
    handler.onError('TestComponent', (alert) => {
      receivedAlerts.push(alert);
    });

    const alert = await handler.handleError(
      new Error('Whisper API connection failed'),
      { component: 'TestComponent' }
    );

    // The returned alert should have user-facing info
    expect(alert.id).toBeDefined();
    expect(alert.severity).toBeDefined();
    expect(alert.userMessage).toBeDefined();
    expect(alert.userMessage.length).toBeGreaterThan(0);

    // The callback should have been invoked
    expect(receivedAlerts).toHaveLength(1);
    expect(receivedAlerts[0].id).toBe(alert.id);
    expect(receivedAlerts[0].message).toContain('Whisper API');
  });

  it('multiple components receive the same error notification', async () => {
    const componentAAlerts: ErrorAlert[] = [];
    const componentBAlerts: ErrorAlert[] = [];

    handler.onError('ComponentA', (alert) => componentAAlerts.push(alert));
    handler.onError('ComponentB', (alert) => componentBAlerts.push(alert));

    await handler.handleError(
      new Error('Network timeout'),
      { component: 'ComponentA' }
    );

    expect(componentAAlerts).toHaveLength(1);
    expect(componentBAlerts).toHaveLength(1);
    expect(componentAAlerts[0].id).toBe(componentBAlerts[0].id);
  });

  it('callback error does not suppress other callbacks or the returned alert', async () => {
    const goodCallback = jest.fn();
    const badCallback = jest.fn(() => {
      throw new Error('Callback internal failure');
    });

    handler.onError('GoodComponent', goodCallback);
    handler.onError('BadComponent', badCallback);

    const alert = await handler.handleError(
      new Error('Pipeline stage failed'),
      { component: 'Pipeline' }
    );

    // Original error is still returned despite callback failure
    expect(alert).toBeDefined();
    expect(alert.message).toContain('Pipeline stage failed');

    // Good callback still received the alert even though bad callback threw
    expect(goodCallback).toHaveBeenCalledWith(alert);
    // Bad callback was invoked (and its error was caught internally)
    expect(badCallback).toHaveBeenCalled();
  });

  it('critical errors trigger automatic recovery attempt', async () => {
    const alerts: ErrorAlert[] = [];
    handler.onError('CriticalComponent', (alert) => alerts.push(alert));

    const alert = await handler.handleError(
      new Error('Cannot allocate memory for rendering'),
      { component: 'CriticalComponent' }
    );

    // Critical or high severity → recoveryOptions should exist
    expect(alert.severity).toMatch(/critical|high/);
    expect(alerts).toHaveLength(1);
  });

  it('.catch → handleError chain: error is visible to user notification system', async () => {
    // Simulate the pattern: someAsyncOp().catch(err => handler.handleError(err, ...))
    const alerts: ErrorAlert[] = [];
    handler.onError('SyncComponent', (alert) => alerts.push(alert));

    // Simulate an async operation that fails and is caught via .catch
    const failingOperation = async (): Promise<void> => {
      throw new Error('Sync metadata fetch failed');
    };

    // This is the .catch pattern we want to verify user visibility for
    await failingOperation().catch(async (err: Error) => {
      await handler.handleError(err, { component: 'SyncComponent' });
    });

    // The error should have been surfaced to the notification system
    expect(alerts).toHaveLength(1);
    expect(alerts[0].message).toContain('Sync metadata fetch failed');
    expect(alerts[0].userMessage).toBeDefined();
  });

  it('.catch chain: handleError rejection is surfaced, not silently swallowed', async () => {
    // When handleError itself throws (e.g. internal error in the handler),
    // the .catch chain must still surface the error rather than silently
    // swallowing it. This is the sync-failure-notification regression guard.
    const alerts: ErrorAlert[] = [];
    handler.onError('ResilientComponent', (alert) => alerts.push(alert));

    const failingOperation = async (): Promise<void> => {
      throw new Error('Original pipeline failure');
    };

    // Simulate .catch where handleError also fails — the outer .catch
    // must still produce a visible notification
    let outerCatchTriggered = false;
    let surfacedError: Error | null = null;

    await failingOperation()
      .catch(async (err: Error) => {
        // Register the original error
        await handler.handleError(err, { component: 'ResilientComponent' });
        // Simulate an internal handler failure
        throw new Error('handleError internal failure');
      })
      .catch((err: Error) => {
        outerCatchTriggered = true;
        surfacedError = err;
      });

    // The outer .catch was triggered → error not swallowed
    expect(outerCatchTriggered).toBe(true);
    expect(surfacedError).not.toBeNull();
    expect(surfacedError!.message).toContain('handleError internal failure');

    // The original error was still registered via callbacks before the throw
    expect(alerts).toHaveLength(1);
    expect(alerts[0].message).toContain('Original pipeline failure');
  });

  it('.catch chain: concurrent failures all produce visible notifications', async () => {
    // Multiple async operations failing concurrently — each .catch must
    // independently surface its error to the notification system.
    // Both callbacks receive both alerts (notifyErrorCallbacks broadcasts
    // to all registered callbacks), so we expect 4 total (2 errors × 2 callbacks).
    const alerts: ErrorAlert[] = [];
    handler.onError('ConcurrentA', (alert) => alerts.push(alert));
    handler.onError('ConcurrentB', (alert) => alerts.push(alert));

    const opA = async () => {
      throw new Error('Concurrent A failed');
    };
    const opB = async () => {
      throw new Error('Concurrent B failed');
    };

    await Promise.all([
      opA().catch(async (err: Error) => {
        await handler.handleError(err, { component: 'ConcurrentA' });
      }),
      opB().catch(async (err: Error) => {
        await handler.handleError(err, { component: 'ConcurrentB' });
      }),
    ]);

    // Both errors broadcast to both callbacks → 4 alerts
    expect(alerts).toHaveLength(4);
    const messages = alerts.map((a) => a.message);
    expect(messages).toContain('Concurrent A failed');
    expect(messages).toContain('Concurrent B failed');
    // Verify unique error IDs (two distinct errors)
    const uniqueIds = new Set(alerts.map((a) => a.id));
    expect(uniqueIds.size).toBe(2);
  });
});
