/**
 * Tests for untested LLMCache paths:
 *   - getStats computation edge cases (hitRate, avgHitsPerEntry, validEntries)
 *   - set() overwrite resets timestamp/hits/originalText
 *   - clear() vs clearExpired() persistence behavior difference
 *   - eviction tie-breaking when entries share the same timestamp
 *   - loadFromDisk with mixed expired/valid entries
 *   - destroy() + persist() interaction
 *   - semantic matching with prefix filtering accuracy
 */

import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

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

describe('LLMCache untested paths', () => {
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

  // ─── getStats computation edge cases ────────────────────────────────

  describe('getStats computation edge cases', () => {
    test('hitRate is 0 when totalHits is 0 regardless of entry count', () => {
      const cache = new LLMCache<string>({ enableSemantic: false });
      cache.set('a', '1');
      cache.set('b', '2');
      cache.set('c', '3');

      // No gets → no hits
      const stats = cache.getStats();
      expect(stats.totalHits).toBe(0);
      expect(stats.hitRate).toBe(0);
    });

    test('avgHitsPerEntry reflects varying hit counts accurately', () => {
      const cache = new LLMCache<string>({ enableSemantic: false });
      cache.set('a', '1');
      cache.set('b', '2');
      cache.set('c', '3');

      // a: 5 hits, b: 1 hit, c: 0 hits
      for (let i = 0; i < 5; i++) cache.get('a');
      cache.get('b');

      const stats = cache.getStats();
      expect(stats.totalHits).toBe(6);     // 5 + 1 + 0
      expect(stats.avgHitsPerEntry).toBeCloseTo(2); // 6 / 3
    });

    test('validEntries excludes partially expired entries', () => {
      const cache = new LLMCache<string>({ ttlMinutes: 5, enableSemantic: false });

      cache.set('old', 'v1');
      jest.advanceTimersByTime(5 * 60 * 1000 + 1); // exactly expired

      cache.set('fresh', 'v2');

      const stats = cache.getStats();
      expect(stats.size).toBe(2);
      expect(stats.validEntries).toBe(1);
    });

    test('hitRate formula: totalHits / (totalHits + entries.length)', () => {
      const cache = new LLMCache<string>({ enableSemantic: false });
      cache.set('a', '1');
      cache.set('b', '2');

      // 2 entries, 2 hits → hitRate = 2 / (2 + 2) * 100 = 50
      cache.get('a');
      cache.get('b');

      const stats = cache.getStats();
      expect(stats.hitRate).toBe(50);
    });

    test('overallHitRate reflects exact + semantic hits vs total requests', () => {
      // Verify recordExactHit is called on cache hit, then compute hitRate
      const cache = new LLMCache<string>({ enableSemantic: true });
      cache.set('a', '1');
      cache.get('a');   // exact hit → calls recordExactHit()

      // The mock SemanticMetricsTracker always returns 0 from getMetrics(),
      // so we verify the correct metric method was called instead
      expect(mockSemanticMetricsTracker.recordExactHit).toHaveBeenCalledTimes(1);

      // Now wire the mock to reflect the recorded hit and verify the formula
      mockSemanticMetricsTracker.getMetrics.mockReturnValue({
        exactHits: 1,
        semanticHits: 0,
        misses: 0,
        avgSimilarityScore: 0,
        totalComparisons: 0,
      });
      const stats = cache.getStats();
      expect(stats.semantic.overallHitRate).toBe(100); // 1 exact hit / 1 total = 100%
    });
  });

  // ─── set() overwrite resets timestamp and hits ──────────────────────

  describe('set() overwrite behavior', () => {
    test('overwriting same key resets TTL (fresh timestamp)', () => {
      const cache = new LLMCache<string>({ ttlMinutes: 1, enableSemantic: false });

      cache.set('key', 'v1');
      jest.advanceTimersByTime(59_000); // 1s before expiry

      // Overwrite resets the clock
      cache.set('key', 'v2');
      jest.advanceTimersByTime(59_000); // would have expired if timestamp wasn't reset

      expect(cache.get('key')).toBe('v2');
    });

    test('overwriting same key resets hits to 0', () => {
      const cache = new LLMCache<string>({ enableSemantic: false });

      cache.set('key', 'v1');
      cache.get('key'); // 1 hit
      cache.get('key'); // 2 hits

      expect(cache.getStats().totalHits).toBe(2);

      // Overwrite resets hits
      cache.set('key', 'v2');

      // New entry has hits = 0
      // But totalHits includes old entry's accumulated hits...
      // Actually set() replaces the entry, so old hits are gone
      const stats = cache.getStats();
      expect(stats.totalHits).toBe(0);
      expect(stats.size).toBe(1);
    });

    test('overwriting preserves size (no eviction triggered)', () => {
      const cache = new LLMCache<string>({ maxSize: 2, enableSemantic: false });

      cache.set('a', '1');
      cache.set('b', '2');

      // Overwrite 'a' — cache size stays at 2, no eviction
      cache.set('a', 'updated');
      expect(cache.getStats().size).toBe(2);
      expect(cache.get('a')).toBe('updated');
      expect(cache.get('b')).toBe('2');
    });

    test('overwriting updates originalText for semantic matching', () => {
      const cache = new LLMCache<string>({ enableSemantic: true });

      cache.set('hello world', 'v1');

      // Overwrite with different text (same key hash would be different,
      // but since we use the same text the key is the same)
      cache.set('hello world', 'v2');

      // The entry should have the latest originalText
      expect(cache.get('hello world')).toBe('v2');
    });
  });

  // ─── clear() vs clearExpired() persistence difference ───────────────

  describe('clear() vs clearExpired() persistence behavior', () => {
    let tmpDir: string;
    let cachePath: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-cache-persist-'));
      cachePath = path.join(tmpDir, 'cache.json');
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    function readCacheFile(): { entries: Array<{ key: string; data: string }> } | null {
      if (!fs.existsSync(cachePath)) return null;
      return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    }

    test('clear() does not trigger persist to disk', () => {
      const cache = new LLMCache<string>({
        persistPath: cachePath,
        persistDebounceMs: 0,
        enableSemantic: false,
      });

      cache.set('a', '1');
      cache.persist(); // ensure data is on disk
      expect(readCacheFile()!.entries).toHaveLength(1);

      // clear() only clears in-memory map, no scheduleSave() call
      cache.clear();

      // On-disk data is stale until next set/persist
      const disk = readCacheFile();
      expect(disk!.entries).toHaveLength(1); // still has old entry
      expect(cache.getStats().size).toBe(0); // in-memory is empty
    });

    test('clearExpired() does trigger persist to disk', () => {
      const cache = new LLMCache<string>({
        persistPath: cachePath,
        persistDebounceMs: 0,
        ttlMinutes: 1,
        enableSemantic: false,
      });

      cache.set('expired', 'gone');
      jest.advanceTimersByTime(60_001);
      cache.set('valid', 'kept');
      cache.persist(); // flush to disk

      expect(readCacheFile()!.entries).toHaveLength(2);

      cache.clearExpired();

      // Disk now reflects only valid entries
      const disk = readCacheFile();
      expect(disk!.entries).toHaveLength(1);
      expect(disk!.entries[0].data).toBe('kept');
    });

    test('clear() then persist() writes empty cache to disk', () => {
      const cache = new LLMCache<string>({
        persistPath: cachePath,
        persistDebounceMs: 0,
        enableSemantic: false,
      });

      cache.set('a', '1');
      cache.persist();
      expect(readCacheFile()!.entries).toHaveLength(1);

      cache.clear();
      cache.persist();

      const disk = readCacheFile();
      expect(disk!.entries).toHaveLength(0);
    });
  });

  // ─── Eviction tie-breaking ─────────────────────────────────────────

  describe('eviction tie-breaking with identical timestamps', () => {
    test('evicts one entry when all have the same timestamp at capacity', () => {
      const cache = new LLMCache<string>({ maxSize: 3, enableSemantic: false });

      // All entries set in the same tick — identical timestamps
      cache.set('a', '1');
      cache.set('b', '2');
      cache.set('c', '3');

      // At capacity; next insert triggers eviction
      cache.set('d', '4');

      // One of a/b/c was evicted, d is present
      expect(cache.getStats().size).toBe(3);
      expect(cache.get('d')).toBe('4');

      // The eviction chose one entry (deterministic by Map iteration order)
      const remaining = ['a', 'b', 'c'].filter(k => cache.get(k) !== null);
      expect(remaining).toHaveLength(2); // 2 of the original 3 survive
    });

    test('always evicts a single entry (not more) per set()', () => {
      const cache = new LLMCache<string>({ maxSize: 5, enableSemantic: false });

      for (let i = 0; i < 5; i++) {
        cache.set(`k${i}`, `v${i}`);
      }
      expect(cache.getStats().size).toBe(5);

      cache.set('overflow', 'x');

      // Only 1 entry evicted, new one added: 5 - 1 + 1 = 5
      expect(cache.getStats().size).toBe(5);
    });
  });

  // ─── loadFromDisk with mixed expired/valid entries ──────────────────

  describe('loadFromDisk mixed expired/valid filtering', () => {
    let tmpDir: string;
    let cachePath: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-cache-load-'));
      cachePath = path.join(tmpDir, 'cache.json');
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    function computeKey(text: string, prefix = ''): string {
      const normalized = text.trim().toLowerCase().slice(0, 2000);
      const hash = crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
      return prefix ? `${prefix}:${hash}` : hash;
    }

    function writeCacheFile(entries: Array<{ key: string; data: string; timestamp: number; hits: number; originalText?: string }>) {
      const dir = path.dirname(cachePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(cachePath, JSON.stringify({
        version: '2.0',
        timestamp: Date.now(),
        entries,
      }), 'utf8');
    }

    test('loads only valid entries, skips expired ones', () => {
      const now = Date.now();
      jest.setSystemTime(now);

      writeCacheFile([
        { key: computeKey('expired'), data: 'old', timestamp: now - 120 * 60 * 1000, hits: 0, originalText: 'expired' },
        { key: computeKey('valid'), data: 'fresh', timestamp: now - 10 * 60 * 1000, hits: 3, originalText: 'valid' },
        { key: computeKey('also-expired'), data: 'stale', timestamp: now - 200 * 60 * 1000, hits: 1, originalText: 'also-expired' },
      ]);

      const cache = new LLMCache<string>({ persistPath: cachePath, ttlMinutes: 60, enableSemantic: false });

      expect(cache.getStats().size).toBe(1);
      expect(cache.get('valid')).toBe('fresh');
      expect(cache.get('expired')).toBeNull();
    });

    test('preserves hit counts from disk for valid entries', () => {
      const now = Date.now();
      jest.setSystemTime(now);

      writeCacheFile([
        { key: computeKey('key1'), data: 'd1', timestamp: now - 5 * 60 * 1000, hits: 10, originalText: 'key1' },
      ]);

      const cache = new LLMCache<string>({ persistPath: cachePath, ttlMinutes: 60, enableSemantic: false });
      const stats = cache.getStats();
      expect(stats.totalHits).toBe(10);
    });

    test('loads all entries when none are expired', () => {
      const now = Date.now();
      jest.setSystemTime(now);

      writeCacheFile([
        { key: computeKey('a'), data: '1', timestamp: now, hits: 0, originalText: 'a' },
        { key: computeKey('b'), data: '2', timestamp: now, hits: 0, originalText: 'b' },
        { key: computeKey('c'), data: '3', timestamp: now, hits: 0, originalText: 'c' },
      ]);

      const cache = new LLMCache<string>({ persistPath: cachePath, ttlMinutes: 60, enableSemantic: false });
      expect(cache.getStats().size).toBe(3);
    });

    test('loads zero entries when all are expired', () => {
      const now = Date.now();
      jest.setSystemTime(now);

      writeCacheFile([
        { key: computeKey('a'), data: '1', timestamp: now - 61 * 60 * 1000, hits: 0, originalText: 'a' },
        { key: computeKey('b'), data: '2', timestamp: now - 62 * 60 * 1000, hits: 0, originalText: 'b' },
      ]);

      const cache = new LLMCache<string>({ persistPath: cachePath, ttlMinutes: 60, enableSemantic: false });
      expect(cache.getStats().size).toBe(0);
    });

    test('v1.0 entries without originalText are loaded successfully', () => {
      const now = Date.now();
      jest.setSystemTime(now);

      writeCacheFile([]);

      // Manually write v1.0 format
      const dir = path.dirname(cachePath);
      fs.writeFileSync(cachePath, JSON.stringify({
        version: '1.0',
        timestamp: now,
        entries: [
          { key: computeKey('v1key'), data: 'v1data', timestamp: now, hits: 0 },
        ],
      }), 'utf8');

      const cache = new LLMCache<string>({ persistPath: cachePath, ttlMinutes: 60, enableSemantic: true });
      expect(cache.get('v1key')).toBe('v1data');
    });
  });

  // ─── destroy() + persist() interaction ──────────────────────────────

  describe('destroy() and persist() interaction', () => {
    let tmpDir: string;
    let cachePath: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-cache-destroy-'));
      cachePath = path.join(tmpDir, 'cache.json');
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    test('destroy() cancels pending debounced save', () => {
      const cache = new LLMCache<string>({
        persistPath: cachePath,
        persistDebounceMs: 5000,
        enableSemantic: false,
      });

      cache.set('a', '1');

      // Save is scheduled but not yet executed
      expect(fs.existsSync(cachePath)).toBe(false);

      cache.destroy();

      // Advance past debounce — save should NOT execute
      jest.advanceTimersByTime(10_000);
      expect(fs.existsSync(cachePath)).toBe(false);
    });

    test('persist() after destroy() still writes to disk', () => {
      const cache = new LLMCache<string>({
        persistPath: cachePath,
        persistDebounceMs: 5000,
        enableSemantic: false,
      });

      cache.set('a', '1');
      cache.destroy();

      // Explicit persist should still work
      cache.persist();

      expect(fs.existsSync(cachePath)).toBe(true);
      const disk = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      expect(disk.entries).toHaveLength(1);
    });

    test('destroy() is idempotent', () => {
      const cache = new LLMCache<string>({
        persistPath: cachePath,
        persistDebounceMs: 1000,
        enableSemantic: false,
      });

      cache.set('a', '1');

      // Multiple destroy calls should not throw
      expect(() => {
        cache.destroy();
        cache.destroy();
        cache.destroy();
      }).not.toThrow();
    });

    test('destroy() on cache without persistence is a no-op', () => {
      const cache = new LLMCache<string>({ enableSemantic: false });
      expect(() => cache.destroy()).not.toThrow();
    });
  });

  // ─── Semantic matching prefix accuracy ─────────────────────────────

  describe('semantic matching with prefix filtering', () => {
    test('entries stored with different prefixes are isolated', () => {
      const cache = new LLMCache<string>({ enableSemantic: false });

      cache.set('shared text', 'result-a', 'prefix-a');
      cache.set('shared text', 'result-b', 'prefix-b');

      // Same text, different prefixes → different keys, different values
      expect(cache.get('shared text', 'prefix-a')).toBe('result-a');
      expect(cache.get('shared text', 'prefix-b')).toBe('result-b');
      expect(cache.getStats().size).toBe(2);
    });

    test('exact match with prefix returns correct value', () => {
      const cache = new LLMCache<string>({ enableSemantic: true });

      cache.set('exact query', 'result', 'my-prefix');

      const result = cache.get('exact query', 'my-prefix');
      expect(result).toBe('result');
    });

    test('non-matching prefix returns null even with same text', () => {
      const cache = new LLMCache<string>({ enableSemantic: true });

      cache.set('query text', 'result', 'prefix-x');

      // Different prefix should not find the entry
      expect(cache.get('query text', 'prefix-y')).toBeNull();
    });

    test('multiple entries with same text but different prefixes coexist', () => {
      const cache = new LLMCache<string>({ enableSemantic: false });

      for (let i = 0; i < 5; i++) {
        cache.set('same-key', `val-${i}`, `prefix-${i}`);
      }

      expect(cache.getStats().size).toBe(5);

      for (let i = 0; i < 5; i++) {
        expect(cache.get('same-key', `prefix-${i}`)).toBe(`val-${i}`);
      }
    });
  });

  // ─── getStats after complex operation sequences ─────────────────────

  describe('getStats after complex operations', () => {
    test('stats reflect state after get-evict-reget sequence', () => {
      mockSemanticMetricsTracker.getMetrics.mockReturnValue({
        exactHits: 2,
        semanticHits: 0,
        misses: 0,
        avgSimilarityScore: 0,
        totalComparisons: 0,
      });

      const cache = new LLMCache<string>({ maxSize: 2, enableSemantic: false });

      cache.set('a', '1');
      cache.set('b', '2');
      cache.get('a'); // hit
      cache.get('b'); // hit

      // Overwrite a — hits reset
      cache.set('a', 'updated');

      const stats = cache.getStats();
      expect(stats.size).toBe(2);
      // Entry 'a' has 0 hits (overwritten), 'b' has 1 hit
      expect(stats.totalHits).toBe(1); // only b's hit remains
    });

    test('validEntries is accurate after clearExpired removes subset', () => {
      const cache = new LLMCache<string>({ ttlMinutes: 1, enableSemantic: false });

      cache.set('old1', '1');
      jest.advanceTimersByTime(30_000);
      cache.set('mid', '2');
      jest.advanceTimersByTime(30_001); // old1 expired (60_001ms), mid has ~30s left
      cache.set('fresh', '3');

      const before = cache.getStats();
      expect(before.size).toBe(3);
      expect(before.validEntries).toBe(2); // mid + fresh

      cache.clearExpired();

      const after = cache.getStats();
      expect(after.size).toBe(2);
      expect(after.validEntries).toBe(2);
    });

    test('hitRate stays 0 after only set operations (no gets)', () => {
      const cache = new LLMCache<string>({ enableSemantic: false });

      for (let i = 0; i < 20; i++) {
        cache.set(`key-${i}`, `val-${i}`);
      }

      expect(cache.getStats().hitRate).toBe(0);
      expect(cache.getStats().totalHits).toBe(0);
    });
  });
});
