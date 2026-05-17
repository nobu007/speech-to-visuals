/**
 * REQ-202: Startup cache warmup integration test
 *
 * Verifies that triggerStartupWarmup() correctly invokes warmupCache()
 * when the LLM service is enabled, skips when disabled, and handles
 * failures gracefully.
 */

import { jest } from '@jest/globals';
import type { LLMService } from '../../analysis/llm-service';

// Mock logger so we don't get console noise
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { triggerStartupWarmup } from '../startup-warmup';
import { logger } from '../../utils/logger';

function createMockService(enabled: boolean) {
  return {
    isEnabled: jest.fn().mockReturnValue(enabled),
    warmupCache: jest.fn().mockResolvedValue(true),
  } as unknown as LLMService;
}

describe('triggerStartupWarmup (REQ-202)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
