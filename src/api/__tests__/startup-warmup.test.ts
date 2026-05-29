/**
 * REQ-202: Startup cache warmup integration test
 *
 * Verifies that triggerStartupWarmup() correctly invokes warmupCache()
 * when the LLM service is enabled, skips when disabled, handles
 * failures gracefully, and tracks warmup status for observability.
 */

import { jest } from '@jest/globals';
import type { LLMService } from '../../analysis/llm-service';

// Mock logger so we don't get console noise
jest.unstable_mockModule('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const { triggerStartupWarmup, getWarmupStatus, resetWarmupStatus } = await import('../startup-warmup');
const { logger } = await import('../../utils/logger') as { logger: { info: jest.Mock; warn: jest.Mock; error: jest.Mock } };

function createMockService(enabled: boolean, warmupStats = { totalPatternsProcessed: 8 }) {
  return {
    isEnabled: jest.fn().mockReturnValue(enabled),
    warmupCache: jest.fn().mockResolvedValue(true),
    getCacheWarmupStats: jest.fn().mockReturnValue(warmupStats),
  } as unknown as LLMService;
}

describe('triggerStartupWarmup (REQ-202)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetWarmupStatus();
  });

  test('calls warmupCache when LLM service is enabled', async () => {
    const service = createMockService(true);

    triggerStartupWarmup(service);

    // Give the async warmup a tick to resolve
    await new Promise((r) => setTimeout(r, 50));

    expect(service.isEnabled).toHaveBeenCalled();
    expect(service.warmupCache).toHaveBeenCalled();
  });

  test('logs success when warmup completes', async () => {
    const service = createMockService(true);

    triggerStartupWarmup(service);

    await new Promise((r) => setTimeout(r, 50));

    expect(logger.info).toHaveBeenCalledWith('[startup] Cache warmup completed successfully');
  });

  test('does not log when warmup is skipped (cache already warm)', async () => {
    const service = createMockService(true);
    (service.warmupCache as jest.Mock).mockResolvedValue(false);

    triggerStartupWarmup(service);

    await new Promise((r) => setTimeout(r, 50));

    expect(service.warmupCache).toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalledWith('[startup] Cache warmup completed successfully');
  });

  test('skips warmup when LLM service is disabled', async () => {
    const service = createMockService(false);

    triggerStartupWarmup(service);

    await new Promise((r) => setTimeout(r, 50));

    expect(service.isEnabled).toHaveBeenCalled();
    expect(service.warmupCache).not.toHaveBeenCalled();
  });

  test('warmup failure does not throw, logs warning instead', async () => {
    const service = createMockService(true);
    const error = new Error('warmup boom');
    (service.warmupCache as jest.Mock).mockRejectedValue(error);

    // Should not throw
    expect(() => triggerStartupWarmup(service)).not.toThrow();

    await new Promise((r) => setTimeout(r, 50));

    expect(logger.warn).toHaveBeenCalledWith(
      '[startup] Cache warmup failed (non-fatal):',
      error,
    );
  });

  // --- Warmup status tracking tests ---

  test('initial status is pending', () => {
    const status = getWarmupStatus();
    expect(status.status).toBe('pending');
  });

  test('status becomes completed after successful warmup', async () => {
    const service = createMockService(true);

    triggerStartupWarmup(service);
    await new Promise((r) => setTimeout(r, 50));

    const status = getWarmupStatus();
    expect(status.status).toBe('completed');
    expect(status.timestamp).toBeDefined();
    expect(status.patternsProcessed).toBe(8);
  });

  test('status becomes skipped when cache is already warm', async () => {
    const service = createMockService(true);
    (service.warmupCache as jest.Mock).mockResolvedValue(false);

    triggerStartupWarmup(service);
    await new Promise((r) => setTimeout(r, 50));

    const status = getWarmupStatus();
    expect(status.status).toBe('skipped');
    expect(status.timestamp).toBeDefined();
  });

  test('status becomes skipped when LLM service is disabled', () => {
    const service = createMockService(false);

    triggerStartupWarmup(service);

    const status = getWarmupStatus();
    expect(status.status).toBe('skipped');
    expect(status.timestamp).toBeDefined();
  });

  test('status becomes failed when warmup throws', async () => {
    const service = createMockService(true);
    (service.warmupCache as jest.Mock).mockRejectedValue(new Error('network error'));

    triggerStartupWarmup(service);
    await new Promise((r) => setTimeout(r, 50));

    const status = getWarmupStatus();
    expect(status.status).toBe('failed');
    expect(status.timestamp).toBeDefined();
    expect(status.error).toBe('network error');
  });

  test('status remains pending while warmup is in-flight', () => {
    const service = createMockService(true);
    // Make warmupCache hang forever
    (service.warmupCache as jest.Mock).mockReturnValue(new Promise(() => {}));

    triggerStartupWarmup(service);

    const status = getWarmupStatus();
    expect(status.status).toBe('pending');
  });

  test('resetWarmupStatus resets to pending', async () => {
    const service = createMockService(true);
    triggerStartupWarmup(service);
    await new Promise((r) => setTimeout(r, 50));

    expect(getWarmupStatus().status).toBe('completed');

    resetWarmupStatus();
    expect(getWarmupStatus().status).toBe('pending');
  });

  test('getWarmupStatus returns a copy (not the internal object)', async () => {
    const service = createMockService(true);
    triggerStartupWarmup(service);
    await new Promise((r) => setTimeout(r, 50));

    const s1 = getWarmupStatus();
    const s2 = getWarmupStatus();
    expect(s1).toEqual(s2);
    expect(s1).not.toBe(s2);
  });
});
