/**
 * Targeted tests for LLMCache TTL expiry boundaries, max-size eviction
 * ordering, and clearExpired timing precision.
 *
 * Uses fake timers to advance Date.now() deterministically rather than
 * relying on ttlMinutes:0 (instant-expiry) which is already covered in
 * llm-cache.test.ts.
 *
 * Semantic matching is disabled in most tests here to isolate TTL/eviction
 * behavior from fuzzy-match interference.
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

describe('LLMCache TTL boundary and eviction precision', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});

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
  });

  // ─── TTL boundary precision ─────────────────────────────────────────

  describe('TTL boundary precision', () => {
    test('entry is valid 1 ms before TTL elapses', () => {
      const cache = new LLMCache<string>({ ttlMinutes: 1, enableSemantic: false });

      cache.set('key', 'value');

      // Advance to 1 ms before expiry
      jest.advanceTimersByTime(59_999);
      expect(cache.get('key')).toBe('value');
    });

    test('entry is expired 1 ms after TTL elapses', () => {
      const cache = new LLMCache<string>({ ttlMinutes: 1, enableSemantic: false });

      cache.set('key', 'value');
      jest.advanceTimersByTime(60_001);

      expect(cache.get('key')).toBeNull();
    });

    test('entry is expired exactly at TTL boundary', () => {
      const cache = new LLMCache<string>({ ttlMinutes: 1, enableSemantic: false });

      cache.set('key', 'value');
      jest.advanceTimersByTime(60_000);

      // isValid checks Date.now() - entry.timestamp < this.ttlMs
      // At exactly 60 000 ms the difference equals ttlMs, so isValid → false
      expect(cache.get('key')).toBeNull();
    });

    test('get() cleans up expired entry from cache', () => {
      const cache = new LLMCache<string>({ ttlMinutes: 1, enableSemantic: false });

      cache.set('key', 'value');
      jest.advanceTimersByTime(60_001);

      // Before get, entry exists in map (lazy cleanup)
      expect(cache.getStats().size).toBe(1);

      cache.get('key');

      // After get, expired entry is removed
      expect(cache.getStats().size).toBe(0);
    });

    test('multiple entries expire independently based on their own timestamps', () => {
      const cache = new LLMCache<string>({ ttlMinutes: 1, enableSemantic: false });

      cache.set('early', 'v1');
      jest.advanceTimersByTime(30_000); // early has 30s left

      cache.set('late', 'v2');
      jest.advanceTimersByTime(30_001); // early expired, late has ~30s left

      expect(cache.get('early')).toBeNull();
      expect(cache.get('late')).toBe('v2');
    });
  });

  // ─── Max-size eviction ordering ─────────────────────────────────────

  describe('max-size eviction ordering', () => {
    test('evicts the single oldest entry when at capacity', () => {
      const cache = new LLMCache<string>({ maxSize: 2, enableSemantic: false });

      cache.set('oldest', 'v1');
      jest.advanceTimersByTime(1000);

      cache.set('middle', 'v2');
      jest.advanceTimersByTime(1000);

      // Cache is at maxSize (2). Next set evicts oldest.
      cache.set('newest', 'v3');

      expect(cache.get('oldest')).toBeNull();
      expect(cache.get('middle')).toBe('v2');
      expect(cache.get('newest')).toBe('v3');
    });

    test('evicts entries in timestamp order across multiple insertions', () => {
      const cache = new LLMCache<string>({ maxSize: 3, enableSemantic: false });

      cache.set('a', '1');
      jest.advanceTimersByTime(1000);
      cache.set('b', '2');
      jest.advanceTimersByTime(1000);
      cache.set('c', '3');
      // Now at maxSize = 3

      jest.advanceTimersByTime(1000);
      cache.set('d', '4'); // evicts 'a'

      jest.advanceTimersByTime(1000);
      cache.set('e', '5'); // evicts 'b'

      expect(cache.get('a')).toBeNull();
      expect(cache.get('b')).toBeNull();
      expect(cache.get('c')).toBe('3');
      expect(cache.get('d')).toBe('4');
      expect(cache.get('e')).toBe('5');
    });

    test('overwriting an existing key does not trigger eviction', () => {
      const cache = new LLMCache<string>({ maxSize: 2, enableSemantic: false });

      cache.set('key1', 'v1');
      cache.set('key2', 'v2');

      // Overwrite key1 — no eviction needed, size stays at 2
      cache.set('key1', 'updated');

      expect(cache.getStats().size).toBe(2);
      expect(cache.get('key1')).toBe('updated');
      expect(cache.get('key2')).toBe('v2');
    });

    test('eviction does not occur below maxSize', () => {
      const cache = new LLMCache<string>({ maxSize: 10, enableSemantic: false });

      for (let i = 0; i < 9; i++) {
        cache.set(`key-${i}`, `val-${i}`);
      }

      // All 9 entries should be present (maxSize is 10)
      expect(cache.getStats().size).toBe(9);
      for (let i = 0; i < 9; i++) {
        expect(cache.get(`key-${i}`)).toBe(`val-${i}`);
      }
    });
  });

  // ─── clearExpired timing and mixed scenarios ─────────────────────────

  describe('clearExpired mixed scenarios', () => {
    test('clearExpired removes only expired entries, keeps valid ones', () => {
      const cache = new LLMCache<string>({ ttlMinutes: 1, enableSemantic: false });

      cache.set('expired', 'v1');
      jest.advanceTimersByTime(60_001); // expired

      cache.set('valid', 'v2');
      // 'valid' was just set, still fresh

      cache.clearExpired();

      expect(cache.getStats().size).toBe(1);
      expect(cache.get('valid')).toBe('v2');
      expect(cache.get('expired')).toBeNull();
    });

    test('clearExpired on empty cache is a no-op', () => {
      const cache = new LLMCache<string>({ ttlMinutes: 1, enableSemantic: false });

      expect(() => cache.clearExpired()).not.toThrow();
      expect(cache.getStats().size).toBe(0);
    });

    test('clearExpired with all valid entries changes nothing', () => {
      const cache = new LLMCache<string>({ ttlMinutes: 60, enableSemantic: false });

      cache.set('a', '1');
      cache.set('b', '2');
      cache.set('c', '3');

      cache.clearExpired();

      expect(cache.getStats().size).toBe(3);
    });

    test('clearExpired with all expired entries empties cache', () => {
      const cache = new LLMCache<string>({ ttlMinutes: 1, enableSemantic: false });

      cache.set('a', '1');
      cache.set('b', '2');
      cache.set('c', '3');
      jest.advanceTimersByTime(60_001);

      cache.clearExpired();

      expect(cache.getStats().size).toBe(0);
    });

    test('clearExpired frees capacity for new entries without eviction', () => {
      const cache = new LLMCache<string>({ maxSize: 2, ttlMinutes: 1, enableSemantic: false });

      cache.set('old-a', '1');
      jest.advanceTimersByTime(60_001); // old-a expired

      cache.set('old-b', '2');
      jest.advanceTimersByTime(60_001); // old-b expired

      // Cache has 2 expired entries at maxSize
      cache.clearExpired();

      // Now cache is empty, we can insert without eviction
      cache.set('new-a', '3');
      cache.set('new-b', '4');

      expect(cache.getStats().size).toBe(2);
      expect(cache.get('new-a')).toBe('3');
      expect(cache.get('new-b')).toBe('4');
    });
  });

  // ─── TTL + eviction interaction ──────────────────────────────────────

  describe('TTL + eviction interaction', () => {
    test('expired entries still count toward cache size until cleaned up', () => {
      const cache = new LLMCache<string>({ maxSize: 2, ttlMinutes: 1, enableSemantic: false });

      cache.set('a', '1');
      jest.advanceTimersByTime(60_001); // a expired

      cache.set('b', '2');

      // 'a' is expired but still in the map, so size = 2
      // Inserting 'c' triggers eviction based on the Map size
      cache.set('c', '3');

      // 'a' (oldest) should be evicted
      expect(cache.get('a')).toBeNull();
      expect(cache.get('b')).toBe('2');
      expect(cache.get('c')).toBe('3');
    });

    test('getStats distinguishes size vs validEntries with expired items', () => {
      const cache = new LLMCache<string>({ ttlMinutes: 1, enableSemantic: false });

      cache.set('a', '1');
      cache.set('b', '2');
      jest.advanceTimersByTime(60_001); // both expired

      const stats = cache.getStats();
      expect(stats.size).toBe(2);           // still in map
      expect(stats.validEntries).toBe(0);   // all expired
    });
  });

  // ─── clearExpired + persistence scheduling ───────────────────────────

  describe('clearExpired persistence scheduling', () => {
    let tmpDir: string;
    let cachePath: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-cache-ttl-'));
      cachePath = path.join(tmpDir, 'cache.json');
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    function readCacheFile(): { entries: Array<{ key: string; data: string }> } | null {
      if (!fs.existsSync(cachePath)) return null;
      return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    }

    test('clearExpired persists only valid entries to disk', () => {
      const cache = new LLMCache<string>({
        persistPath: cachePath,
        persistDebounceMs: 0,
        ttlMinutes: 1,
        enableSemantic: false,
      });

      cache.set('expired', 'gone');
      jest.advanceTimersByTime(60_001);

      cache.set('valid', 'kept');

      cache.clearExpired();

      const disk = readCacheFile();
      expect(disk).not.toBeNull();
      expect(disk!.entries).toHaveLength(1);
      expect(disk!.entries[0].data).toBe('kept');
    });
  });
});

// ─── loadFromDisk maxSize enforcement (09g capacity-bypass class) ────
//
// The primary set() path maintains maxSize one entry at a time via
// evictOldest(), but loadFromDisk() bulk-inserted every valid disk entry with
// no cap check. A persisted file holding more entries than the configured
// maxSize (e.g. after the cap was lowered) therefore left the cache over its
// cap — and the single-evict evictOldest() could never drain it back. The file
// is populated through the real set() path so the on-disk keys are the hashed
// keys get() looks up.

describe('LLMCache loadFromDisk maxSize enforcement', () => {
  let tmpDir: string;
  let cachePath: string;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-cache-cap-'));
    cachePath = path.join(tmpDir, 'cache.json');
  });

  afterEach(() => {
    jest.useRealTimers();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  /** Populate `cachePath` with `count` entries (distinct timestamps) via set(). */
  function populateDisk(count: number): void {
    const src = new LLMCache<string>({
      persistPath: cachePath,
      maxSize: count + 5, // large enough that the source never evicts
      persistDebounceMs: 0,
      ttlMinutes: 60,
      enableSemantic: false,
    });
    for (let i = 0; i < count; i++) {
      src.set(`key-${i}`, `val-${i}`);
      jest.advanceTimersByTime(1000); // distinct, ascending timestamps
    }
    src.persist();
    src.destroy();
  }

  test('caps loaded entries at maxSize, keeping the newest by timestamp', () => {
    populateDisk(5);

    const cache = new LLMCache<string>({
      persistPath: cachePath,
      maxSize: 2,
      persistDebounceMs: 0,
      ttlMinutes: 60,
      enableSemantic: false,
    });

    // loadFromDisk inserted all 5 valid entries with no cap check → was 5.
    expect(cache.getStats().size).toBe(2);

    // Newest two (highest timestamps) survive the trim.
    expect(cache.get('key-4')).toBe('val-4');
    expect(cache.get('key-3')).toBe('val-3');
    // Oldest three evicted.
    expect(cache.get('key-2')).toBeNull();
    expect(cache.get('key-1')).toBeNull();
    expect(cache.get('key-0')).toBeNull();
  });

  test('a cache loaded exactly at maxSize is unchanged', () => {
    populateDisk(3);

    const cache = new LLMCache<string>({
      persistPath: cachePath,
      maxSize: 3,
      persistDebounceMs: 0,
      ttlMinutes: 60,
      enableSemantic: false,
    });

    expect(cache.getStats().size).toBe(3);
    expect(cache.get('key-0')).toBe('val-0');
    expect(cache.get('key-1')).toBe('val-1');
    expect(cache.get('key-2')).toBe('val-2');
  });

  test('an over-cap cache does not climb back over maxSize on subsequent set()', () => {
    populateDisk(4);

    const cache = new LLMCache<string>({
      persistPath: cachePath,
      maxSize: 2,
      persistDebounceMs: 0,
      ttlMinutes: 60,
      enableSemantic: false,
    });

    // Before the fix the load left 4 entries; a single set() then evicted only
    // one (4 -> 3 -> 4), so the cache stayed permanently over maxSize.
    cache.set('fresh', 'vfresh');
    expect(cache.getStats().size).toBe(2);
  });
});
