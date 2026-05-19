/**
 * Dedicated tests for LLMCache debounce-interval behavior.
 * Covers: scheduleSave coalescing, destroy cancellation, persist immediate flush,
 * timer interval accuracy, and clearExpired re-scheduling.
 */

import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';

const mockCalculateSemanticSimilarity = jest.fn().mockReturnValue(0);
const mockSemanticMetricsTracker = {
  recordExactHit: jest.fn(),
  recordSemanticHit: jest.fn(),
  recordMiss: jest.fn(),
  recordComparison: jest.fn(),
  getMetrics: jest.fn().mockReturnValue({
    exactHits: 0,
    semanticHits: 0,
    misses: 0,
    avgSimilarityScore: 0,
    totalComparisons: 0,
  }),
  reset: jest.fn(),
};

jest.mock('@/analysis/semantic-similarity', () => ({
  calculateSemanticSimilarity: (...args: unknown[]) => mockCalculateSemanticSimilarity(...args),
  SemanticMetricsTracker: jest.fn().mockImplementation(() => mockSemanticMetricsTracker),
}));

import { LLMCache } from '@/analysis/llm-cache';

describe('LLMCache debounce-interval behavior', () => {
  let tmpDir: string;
  let cachePath: string;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-cache-debounce-'));
    cachePath = path.join(tmpDir, 'cache.json');

    mockCalculateSemanticSimilarity.mockReturnValue(0);
    mockSemanticMetricsTracker.recordExactHit.mockClear();
    mockSemanticMetricsTracker.recordSemanticHit.mockClear();
    mockSemanticMetricsTracker.recordMiss.mockClear();
    mockSemanticMetricsTracker.recordComparison.mockClear();
    mockSemanticMetricsTracker.getMetrics.mockReturnValue({
      exactHits: 0,
      semanticHits: 0,
      misses: 0,
      avgSimilarityScore: 0,
      totalComparisons: 0,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  /** Helper: create a cache with a specific debounce interval. */
  function makeCache(debounceMs: number): LLMCache<string> {
    return new LLMCache<string>({
      persistPath: cachePath,
      persistDebounceMs: debounceMs,
      maxSize: 100,
    });
  }

  /** Helper: read the cache file, returning parsed JSON or null. */
  function readCacheFile(): { entries: Array<{ key: string; data: string }> } | null {
    if (!fs.existsSync(cachePath)) return null;
    return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  }

  // ─── scheduleSave coalescing ────────────────────────────────────────

  describe('scheduleSave coalescing', () => {
    test('multiple rapid set() calls produce only one disk write after debounce elapses', () => {
      const cache = makeCache(50);

      // 10 rapid set() calls before the debounce fires
      for (let i = 0; i < 10; i++) {
        cache.set(`key-${i}`, `value-${i}`);
      }

      // No disk write yet — debounce hasn't elapsed
      expect(readCacheFile()).toBeNull();

      // Advance past the debounce interval
      jest.advanceTimersByTime(50);

      // Exactly one write should have occurred with all 10 entries
      const disk = readCacheFile();
      expect(disk).not.toBeNull();
      expect(disk!.entries).toHaveLength(10);
    });

    test('set() calls spread beyond debounce interval trigger separate writes', () => {
      const cache = makeCache(30);

      cache.set('first', '1');
      jest.advanceTimersByTime(30);

      expect(readCacheFile()!.entries).toHaveLength(1);

      cache.set('second', '2');
      jest.advanceTimersByTime(30);

      const disk = readCacheFile();
      expect(disk!.entries).toHaveLength(2);
    });

    test('intermediate set() resets the debounce timer (full coalescing)', () => {
      const cache = makeCache(100);

      cache.set('a', '1');
      jest.advanceTimersByTime(80); // 80ms of 100ms debounce

      // This set() should reset the 100ms timer
      cache.set('b', '2');

      jest.advanceTimersByTime(30); // 110ms total from first set, but only 30ms from second
      // Still within the reset timer — no write yet
      expect(readCacheFile()).toBeNull();

      jest.advanceTimersByTime(70); // 100ms after second set()
      const disk = readCacheFile();
      expect(disk).not.toBeNull();
      expect(disk!.entries).toHaveLength(2);
    });
  });

  // ─── destroy cancellation ────────────────────────────────────────────

  describe('destroy() cancellation', () => {
    test('destroy() cancels pending debounced save — no file written', () => {
      const cache = makeCache(200);

      cache.set('doomed', 'value');
      cache.destroy();

      jest.advanceTimersByTime(500);

      expect(readCacheFile()).toBeNull();
    });

    test('destroy() is idempotent — calling twice does not throw', () => {
      const cache = makeCache(100);
      cache.set('x', 'y');

      expect(() => {
        cache.destroy();
        cache.destroy();
      }).not.toThrow();
    });

    test('set() after destroy() schedules a new debounced save (in-memory entries preserved)', () => {
      const cache = makeCache(50);

      cache.set('first', '1');
      cache.destroy();

      // destroy() only cancels the timer — no disk write occurs
      jest.advanceTimersByTime(100);
      expect(readCacheFile()).toBeNull();

      // New set after destroy schedules a fresh debounced save.
      // Note: destroy() does NOT clear the in-memory cache, so both entries persist.
      cache.set('second', '2');
      jest.advanceTimersByTime(50);

      const disk = readCacheFile();
      expect(disk).not.toBeNull();
      expect(disk!.entries).toHaveLength(2);
      expect(disk!.entries.map(e => e.data)).toContain('1');
      expect(disk!.entries.map(e => e.data)).toContain('2');
    });
  });

  // ─── persist() immediate flush ───────────────────────────────────────

  describe('persist() immediate flush', () => {
    test('persist() writes immediately, cancelling pending debounce', () => {
      const cache = makeCache(500);

      cache.set('immediate', 'value');

      // persist() should write right away
      cache.persist();

      // File written synchronously — no need to advance timers
      const disk = readCacheFile();
      expect(disk).not.toBeNull();
      expect(disk!.entries).toHaveLength(1);
      expect(disk!.entries[0].data).toBe('value');
    });

    test('persist() cancels a pending timer so advanceTimers does not double-write', () => {
      const cache = makeCache(100);

      cache.set('a', '1');
      cache.persist(); // immediate write, clears timer

      // Track file mtime before timer advance
      const mtimeBefore = fs.statSync(cachePath).mtimeMs;

      jest.advanceTimersByTime(200);

      // No new write — same mtime
      const mtimeAfter = fs.statSync(cachePath).mtimeMs;
      expect(mtimeAfter).toBe(mtimeBefore);
    });

    test('persist() on cache without persistPath is a no-op', () => {
      const cache = new LLMCache<string>({ persistDebounceMs: 100 });
      cache.set('x', 'y');

      expect(() => cache.persist()).not.toThrow();
    });
  });

  // ─── timer interval accuracy ─────────────────────────────────────────

  describe('timer interval accuracy', () => {
    test('save does NOT happen before debounceMs elapses', () => {
      const cache = makeCache(200);

      cache.set('early', 'value');
      jest.advanceTimersByTime(199); // 1ms short

      expect(readCacheFile()).toBeNull();
    });

    test('save DOES happen exactly when debounceMs elapses', () => {
      const cache = makeCache(200);

      cache.set('on-time', 'value');
      jest.advanceTimersByTime(200);

      const disk = readCacheFile();
      expect(disk).not.toBeNull();
      expect(disk!.entries[0].data).toBe('value');
    });
  });

  // ─── clearExpired re-scheduling ──────────────────────────────────────

  describe('clearExpired() re-scheduling', () => {
    test('clearExpired() schedules a new debounced save', () => {
      const cache = new LLMCache<string>({
        persistPath: cachePath,
        persistDebounceMs: 100,
        ttlMinutes: 0, // all entries expire immediately
      });

      cache.set('expiring', 'value');

      // Expire all entries and schedule a debounced save
      cache.clearExpired();

      jest.advanceTimersByTime(100);

      const disk = readCacheFile();
      expect(disk).not.toBeNull();
      // The expired entry was removed before the debounced write
      expect(disk!.entries).toHaveLength(0);
    });

    test('clearExpired() coalesces with a pending debounce from set()', () => {
      const cache = new LLMCache<string>({
        persistPath: cachePath,
        persistDebounceMs: 100,
        ttlMinutes: 60,
      });

      cache.set('keep', 'value');
      // clearExpired resets the debounce timer
      cache.clearExpired();

      jest.advanceTimersByTime(100);

      const disk = readCacheFile();
      expect(disk).not.toBeNull();
      expect(disk!.entries).toHaveLength(1);
    });
  });

  // ─── persistDebounceMs: 0 (synchronous mode) ────────────────────────

  describe('persistDebounceMs: 0 (synchronous fallback)', () => {
    test('set() writes synchronously with no timer', () => {
      const cache = makeCache(0);

      cache.set('sync', 'value');

      // File written immediately — no fake timer advance needed
      const disk = readCacheFile();
      expect(disk).not.toBeNull();
      expect(disk!.entries).toHaveLength(1);
    });

    test('destroy() is safe with synchronous mode', () => {
      const cache = makeCache(0);
      cache.set('x', 'y');

      expect(() => cache.destroy()).not.toThrow();
    });
  });
});
