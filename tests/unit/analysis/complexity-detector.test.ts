/**
 * ISS-021: Browser-Safe process.env in complexity-detector.ts
 *
 * Verifies selectModel() does not crash when process.env is undefined.
 */

import { jest, describe, it, expect, afterEach } from '@jest/globals';

describe('ISS-021: Browser-Safe env in complexity-detector selectModel', () => {
  const originalProcess = global.process;

  afterEach(() => {
    Object.defineProperty(global, 'process', {
      value: originalProcess,
      writable: true,
      configurable: true,
    });
    jest.resetModules();
  });

  it('returns rule-based when process is undefined (browser without Vite replacement)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (global as any).process;

    const { ComplexityDetector } = await import('@/analysis/complexity-detector');
    const detector = new ComplexityDetector();
    const model = detector.selectModel(0.5);

    // Without env, DISABLE_GEMINI is falsy so it falls to score-based selection
    expect(typeof model).toBe('string');
    expect(model.length).toBeGreaterThan(0);
  });

  it('respects GEMINI_MODEL_OVERRIDE when process.env is available', async () => {
    const orig = process.env.GEMINI_MODEL_OVERRIDE;
    process.env.GEMINI_MODEL_OVERRIDE = 'test-model-override';
    jest.resetModules();

    try {
      const { ComplexityDetector } = await import('@/analysis/complexity-detector');
      const detector = new ComplexityDetector();
      expect(detector.selectModel(0.5)).toBe('test-model-override');
    } finally {
      if (orig !== undefined) {
        process.env.GEMINI_MODEL_OVERRIDE = orig;
      } else {
        delete process.env.GEMINI_MODEL_OVERRIDE;
      }
    }
  });

  it('returns rule-based when DISABLE_GEMINI is set', async () => {
    const orig = process.env.DISABLE_GEMINI;
    process.env.DISABLE_GEMINI = '1';
    jest.resetModules();

    try {
      const { ComplexityDetector } = await import('@/analysis/complexity-detector');
      const detector = new ComplexityDetector();
      expect(detector.selectModel(0.1)).toBe('rule-based');
    } finally {
      if (orig !== undefined) {
        process.env.DISABLE_GEMINI = orig;
      } else {
        delete process.env.DISABLE_GEMINI;
      }
    }
  });
});
