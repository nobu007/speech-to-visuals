/**
 * REQ-138: memory-usage.ts Unit Tests
 *
 * Tests the cross-platform memory usage utility:
 * - Node.js path: process.memoryUsage()
 * - Chrome path: performance.memory
 * - Fallback: returns zeroes
 * - getHeapUsed convenience function
 */

import { jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('memory-usage (REQ-138)', () => {
  // We need to isolate module imports between tests because the module
  // decides the path at import time. We'll use jest.resetModules + dynamic
  // import() to test each code path.

  // =========================================================================
  // Node.js path
  // =========================================================================

  describe('Node.js path', () => {
    test('should use process.memoryUsage when available', async () => {
      // In the test environment, process.memoryUsage is available
      const { getMemoryUsage } = await import('../../../src/utils/memory-usage');
      const result = getMemoryUsage();

      expect(result.heapUsed).toBeGreaterThan(0);
      expect(result.heapTotal).toBeGreaterThan(0);
      expect(result.rss).toBeGreaterThan(0);
    });

    test('should include rss and external fields', async () => {
      const { getMemoryUsage } = await import('../../../src/utils/memory-usage');
      const result = getMemoryUsage();

      expect(result).toHaveProperty('rss');
      expect(result).toHaveProperty('external');
      expect(typeof result.rss).toBe('number');
      expect(typeof result.external).toBe('number');
    });
  });

  // =========================================================================
  // Fallback path (no process.memoryUsage, no performance.memory)
  // =========================================================================

  describe('fallback path', () => {
    test('should return zeroes when no memory API is available', async () => {
      // Mock process.memoryUsage to be undefined to force fallback
      const origProcess = global.process;
      const origPerf = global.performance;

      // Temporarily remove process.memoryUsage
      const origMemUsage = process.memoryUsage;
      // @ts-expect-error -- intentionally removing for test
      delete process.memoryUsage;

      // Remove performance.memory if present
      const perfMem = (performance as Record<string, unknown>).memory;
      delete (performance as Record<string, unknown>).memory;

      try {
        // Need fresh import to pick up the changed environment
        jest.resetModules();
        const { getMemoryUsage } = await import('../../../src/utils/memory-usage');
        const result = getMemoryUsage();

        expect(result.heapUsed).toBe(0);
        expect(result.heapTotal).toBe(0);
        expect(result.rss).toBeUndefined();
        expect(result.external).toBeUndefined();
      } finally {
        // Restore
        Object.defineProperty(process, 'memoryUsage', { value: origMemUsage, writable: true });
        if (perfMem !== undefined) {
          (performance as Record<string, unknown>).memory = perfMem;
        }
        jest.resetModules();
      }
    });
  });

  // =========================================================================
  // MemoryMetrics interface
  // =========================================================================

  describe('MemoryMetrics interface', () => {
    test('result has correct shape', async () => {
      const { getMemoryUsage } = await import('../../../src/utils/memory-usage');
      const result = getMemoryUsage();

      expect(result).toHaveProperty('heapUsed');
      expect(result).toHaveProperty('heapTotal');
      expect(typeof result.heapUsed).toBe('number');
      expect(typeof result.heapTotal).toBe('number');
    });

    test('heapUsed should not exceed heapTotal', async () => {
      const { getMemoryUsage } = await import('../../../src/utils/memory-usage');
      const result = getMemoryUsage();
      expect(result.heapUsed).toBeLessThanOrEqual(result.heapTotal);
    });
  });

  // =========================================================================
  // getHeapUsed convenience function
  // =========================================================================

  describe('getHeapUsed', () => {
    test('should return a positive number', async () => {
      const { getHeapUsed } = await import('../../../src/utils/memory-usage');
      const heapUsed = getHeapUsed();
      expect(typeof heapUsed).toBe('number');
      expect(heapUsed).toBeGreaterThan(0);
    });

    test('should be close to getMemoryUsage().heapUsed', async () => {
      const { getMemoryUsage, getHeapUsed } = await import('../../../src/utils/memory-usage');
      // heap fluctuates between calls; just verify they're in the same ballpark
      const direct = getMemoryUsage().heapUsed;
      const via = getHeapUsed();
      expect(Math.abs(direct - via)).toBeLessThan(10_000_000); // within 10MB
    });
  });

  // =========================================================================
  // REQ-138 Acceptance Criteria
  // =========================================================================

  describe('REQ-138 acceptance criteria', () => {
    test('TC-138-M01: Node.js path returns non-zero metrics', async () => {
      const { getMemoryUsage } = await import('../../../src/utils/memory-usage');
      const result = getMemoryUsage();
      expect(result.heapUsed).toBeGreaterThan(0);
      expect(result.heapTotal).toBeGreaterThanOrEqual(result.heapUsed);
    });

    test('TC-138-M02: getHeapUsed returns a number', async () => {
      const { getHeapUsed } = await import('../../../src/utils/memory-usage');
      expect(typeof getHeapUsed()).toBe('number');
    });
  });
});
