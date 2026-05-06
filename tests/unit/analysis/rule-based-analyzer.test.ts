/**
 * ISS-022: Browser-Safe process.env in rule-based-analyzer.ts isDisabledGemini
 *
 * Verifies isDisabledGemini() returns false (not crash) when process.env is undefined.
 */

import { jest, describe, it, expect, afterEach } from '@jest/globals';

describe('ISS-022: Browser-Safe env in rule-based-analyzer isDisabledGemini', () => {
  const originalProcess = global.process;

  afterEach(() => {
    Object.defineProperty(global, 'process', {
      value: originalProcess,
      writable: true,
      configurable: true,
    });
    jest.resetModules();
  });

  it('returns false when process is undefined', async () => {
    delete (global as any).process;

    const { isDisabledGemini } = await import('@/analysis/rule-based-analyzer');
    expect(isDisabledGemini()).toBe(false);
  });

  it('returns true when ANALYSIS_DISABLE_GEMINI is "1"', async () => {
    const orig = process.env.ANALYSIS_DISABLE_GEMINI;
    process.env.ANALYSIS_DISABLE_GEMINI = '1';
    jest.resetModules();

    try {
      const { isDisabledGemini } = await import('@/analysis/rule-based-analyzer');
      expect(isDisabledGemini()).toBe(true);
    } finally {
      process.env.ANALYSIS_DISABLE_GEMINI = orig;
    }
  });

  it('returns false when ANALYSIS_DISABLE_GEMINI is unset', async () => {
    const orig = process.env.ANALYSIS_DISABLE_GEMINI;
    delete process.env.ANALYSIS_DISABLE_GEMINI;
    jest.resetModules();

    try {
      const { isDisabledGemini } = await import('@/analysis/rule-based-analyzer');
      expect(isDisabledGemini()).toBe(false);
    } finally {
      if (orig !== undefined) process.env.ANALYSIS_DISABLE_GEMINI = orig;
    }
  });
});
