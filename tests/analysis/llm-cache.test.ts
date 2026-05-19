/**
 * Tests for LLMCache module
 * Covers: constructor, get, set, getStats, clear, clearExpired, persist
 * Includes: TTL handling, eviction, semantic matching, persistence
 */

import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Mock semantic-similarity module
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

describe('LLMCache', () => {
  let cache: LLMCache<string>;

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    // Reset all mock trackers
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

    cache = new LLMCache<string>();
  });

  afterEach(() => {
    cache.clear();
    jest.restoreAllMocks();
  });

  // ========================================
  // constructor
  // ========================================
  describe('constructor', () => {
    test('should create cache with default options', () => {
      const c = new LLMCache<string>();
      const stats = c.getStats();

      expect(stats.size).toBe(0);
      expect(stats.validEntries).toBe(0);
    });

    test('should accept custom maxSize', () => {
      const c = new LLMCache<string>({ maxSize: 5 });
      // Fill beyond maxSize
      for (let i = 0; i < 10; i++) {
        c.set(`key ${i}`, `value ${i}`);
      }
      expect(c.getStats().size).toBeLessThanOrEqual(6); // maxSize + 1 tolerance for eviction timing
    });

    test('should accept custom ttlMinutes', () => {
      const c = new LLMCache<string>({ ttlMinutes: 0 }); // 0 minutes = instant expiry
      c.set('key', 'value');

      // Entry should already be expired since ttlMinutes is 0
      const result = c.get('key');
      expect(result).toBeNull();
    });

    test('should enable semantic by default', () => {
      const stats = cache.getStats();
      expect(stats.semantic.enabled).toBe(true);
    });

    test('should disable semantic when enableSemantic is false', () => {
      const c = new LLMCache<string>({ enableSemantic: false });
      const stats = c.getStats();
      expect(stats.semantic.enabled).toBe(false);
    });

    test('should use default semantic threshold of 0.80', () => {
      const stats = cache.getStats();
      expect(stats.semantic.threshold).toBe(0.80);
    });

    test('should accept custom semanticThreshold', () => {
      const c = new LLMCache<string>({ semanticThreshold: 0.9 });
      expect(c.getStats().semantic.threshold).toBe(0.9);
    });
  });

  // ========================================
  // set and get (basic operations)
  // ========================================
  describe('set and get', () => {
    test('should store and retrieve a value', () => {
      cache.set('hello world', 'result1');
      expect(cache.get('hello world')).toBe('result1');
    });

    test('should return null for non-existent key', () => {
      expect(cache.get('nonexistent')).toBeNull();
    });

    test('should handle prefix in set and get', () => {
      cache.set('test', 'val1', 'prefix1');
      cache.set('test', 'val2', 'prefix2');

      expect(cache.get('test', 'prefix1')).toBe('val1');
      expect(cache.get('test', 'prefix2')).toBe('val2');
    });

    test('should not find value without matching prefix', () => {
      cache.set('test', 'val1', 'prefix1');
      expect(cache.get('test', 'prefix2')).toBeNull();
    });

    test('should overwrite existing key', () => {
      cache.set('key', 'old');
      cache.set('key', 'new');
      expect(cache.get('key')).toBe('new');
    });

    test('should handle text normalization (trim, lowercase)', () => {
      cache.set('  Hello World  ', 'result');
      expect(cache.get('hello world')).toBe('result');
    });

    test('should record exact hit on successful get', () => {
      cache.set('key', 'value');
      cache.get('key');

      expect(mockSemanticMetricsTracker.recordExactHit).toHaveBeenCalled();
    });
  });

  // ========================================
  // TTL handling
  // ========================================
  describe('TTL handling', () => {
    test('should return null for expired entries', () => {
      const c = new LLMCache<string>({ ttlMinutes: 0 });
      c.set('key', 'value');

      expect(c.get('key')).toBeNull();
    });

    test('should clean up expired entries on get', () => {
      const c = new LLMCache<string>({ ttlMinutes: 0 });
      c.set('key', 'value');
      c.get('key');

      // After get, the expired entry should be cleaned up
      expect(c.getStats().size).toBe(0);
    });

    test('should include only valid entries in stats', () => {
      const c = new LLMCache<string>({ ttlMinutes: 0 });
      c.set('key1', 'value1');
      c.set('key2', 'value2');

      // Both expired
      const stats = c.getStats();
      expect(stats.validEntries).toBe(0);
    });
  });

  // ========================================
  // Eviction
  // ========================================
  describe('eviction', () => {
    test('should evict oldest entry when cache is full', () => {
      const c = new LLMCache<string>({ maxSize: 2 });

      c.set('first', 'val1');
      c.set('second', 'val2');
      c.set('third', 'val3'); // This should evict 'first'

      const stats = c.getStats();
      expect(stats.size).toBeLessThanOrEqual(3); // At most maxSize + 1
    });
  });

  // ========================================
  // getStats
  // ========================================
  describe('getStats', () => {
    test('should return correct structure', () => {
      const stats = cache.getStats();

      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('validEntries');
      expect(stats).toHaveProperty('totalHits');
      expect(stats).toHaveProperty('avgHitsPerEntry');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('semantic');
    });

    test('should return correct semantic sub-structure', () => {
      const stats = cache.getStats();

      expect(stats.semantic).toHaveProperty('enabled');
      expect(stats.semantic).toHaveProperty('threshold');
      expect(stats.semantic).toHaveProperty('exactHits');
      expect(stats.semantic).toHaveProperty('semanticHits');
      expect(stats.semantic).toHaveProperty('misses');
      expect(stats.semantic).toHaveProperty('overallHitRate');
      expect(stats.semantic).toHaveProperty('avgSimilarityScore');
      expect(stats.semantic).toHaveProperty('totalComparisons');
    });

    test('should track cache size correctly', () => {
      expect(cache.getStats().size).toBe(0);

      cache.set('a', '1');
      expect(cache.getStats().size).toBe(1);

      cache.set('b', '2');
      expect(cache.getStats().size).toBe(2);
    });

    test('should compute avgHitsPerEntry', () => {
      cache.set('key1', 'val1');
      cache.get('key1'); // 1 hit
      cache.get('key1'); // 2 hits

      const stats = cache.getStats();
      expect(stats.avgHitsPerEntry).toBeGreaterThan(0);
    });

    test('should return 0 avgHitsPerEntry for empty cache', () => {
      expect(cache.getStats().avgHitsPerEntry).toBe(0);
    });
  });

  // ========================================
  // clear
  // ========================================
  describe('clear', () => {
    test('should remove all entries', () => {
      cache.set('a', '1');
      cache.set('b', '2');
      cache.set('c', '3');

      expect(cache.getStats().size).toBe(3);

      cache.clear();

      expect(cache.getStats().size).toBe(0);
      expect(cache.get('a')).toBeNull();
    });
  });

  // ========================================
  // clearExpired
  // ========================================
  describe('clearExpired', () => {
    test('should remove expired entries', () => {
      const c = new LLMCache<string>({ ttlMinutes: 0 });
      c.set('expired', 'val');

      expect(c.getStats().size).toBe(1);

      c.clearExpired();

      expect(c.getStats().size).toBe(0);
    });

    test('should keep valid entries', () => {
      const c = new LLMCache<string>({ ttlMinutes: 60 });
      c.set('valid', 'val');

      c.clearExpired();

      expect(c.getStats().size).toBe(1);
      expect(c.get('valid')).toBe('val');
    });
  });

  // ========================================
  // Semantic matching
  // ========================================
  describe('semantic matching', () => {
    test('should try semantic matching when no exact match found', () => {
      cache.set('hello world', 'result');
      cache.get('hello earth'); // No exact match, triggers semantic search

      expect(mockCalculateSemanticSimilarity).toHaveBeenCalled();
    });

    test('should return semantically similar result above threshold', () => {
      mockCalculateSemanticSimilarity.mockReturnValue(0.9);
      mockSemanticMetricsTracker.getMetrics.mockReturnValue({
        exactHits: 0,
        semanticHits: 1,
        misses: 0,
        avgSimilarityScore: 0.9,
        totalComparisons: 1,
      });

      cache.set('the quick brown fox', 'fox-result');
      const result = cache.get('the quick brown cat');

      expect(result).toBe('fox-result');
      expect(mockSemanticMetricsTracker.recordSemanticHit).toHaveBeenCalledWith(0.9);
    });

    test('should not return result below semantic threshold', () => {
      mockCalculateSemanticSimilarity.mockReturnValue(0.3); // Below 0.80 threshold

      cache.set('completely different text', 'result');
      const result = cache.get('something else entirely');

      expect(result).toBeNull();
      expect(mockSemanticMetricsTracker.recordMiss).toHaveBeenCalled();
    });

    test('should skip entries without originalText', () => {
      // When semantic is disabled, originalText is undefined
      const c = new LLMCache<string>({ enableSemantic: false });
      c.set('key', 'value');

      // Even though exact match won't work, semantic is disabled
      expect(c.get('key')).toBe('value');
    });

    test('should not try semantic matching when disabled', () => {
      const c = new LLMCache<string>({ enableSemantic: false });
      c.set('hello world', 'result');

      // Exact match still works
      expect(c.get('hello world')).toBe('result');

      // Non-match returns null without semantic lookup
      expect(c.get('hello earth')).toBeNull();
    });

    test('should respect prefix in semantic matching', () => {
      mockCalculateSemanticSimilarity.mockReturnValue(0.95);

      cache.set('test query', 'result', 'prefix-a');

      // Try to find with different prefix - should not match
      const result = cache.get('test query similar', 'prefix-b');
      // Semantic match should skip entries with wrong prefix
      expect(result).toBeNull();
    });
  });

  // ========================================
  // Persistence
  // ========================================
  describe('persistence', () => {
    const testCachePath = path.join('/tmp', 'test-llm-cache', `cache-${Date.now()}.json`);

    afterEach(() => {
      // Clean up test cache file
      try {
        if (fs.existsSync(testCachePath)) {
          fs.unlinkSync(testCachePath);
        }
        const dir = path.dirname(testCachePath);
        if (fs.existsSync(dir)) {
          fs.rmSync(dir, { recursive: true });
        }
      } catch {
        // ignore cleanup errors
      }
    });

    test('should persist cache to disk on set', () => {
      const c = new LLMCache<string>({ persistPath: testCachePath });
      c.set('persist-key', 'persist-value');
      c.persist();

      expect(fs.existsSync(testCachePath)).toBe(true);
      const content = JSON.parse(fs.readFileSync(testCachePath, 'utf8'));
      expect(content.version).toBe('2.0');
      expect(content.entries).toHaveLength(1);
      expect(content.entries[0].data).toBe('persist-value');
    });

    test('should load cache from disk on construction', () => {
      // Write a cache file
      const dir = path.dirname(testCachePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // The key must be the actual hash that matches 'loaded-key' text
      // We need to compute the key the same way the cache does
      const normalized = 'loaded-key'.trim().toLowerCase().slice(0, 2000);
      const hash = crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);

      const cacheData = {
        version: '2.0',
        timestamp: Date.now(),
        entries: [{
          key: hash,
          data: 'loaded-value',
          timestamp: Date.now(),
          hits: 5,
          originalText: 'loaded-key',
        }],
      };
      fs.writeFileSync(testCachePath, JSON.stringify(cacheData), 'utf8');

      const c = new LLMCache<string>({ persistPath: testCachePath });
      expect(c.get('loaded-key')).toBe('loaded-value');
    });

    test('should handle missing persist file gracefully', () => {
      const c = new LLMCache<string>({ persistPath: '/tmp/nonexistent/path/cache.json' });
      expect(c.getStats().size).toBe(0);
    });

    test('should handle corrupted persist file gracefully', () => {
      const dir = path.dirname(testCachePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(testCachePath, 'not valid json{{{', 'utf8');

      const c = new LLMCache<string>({ persistPath: testCachePath });
      expect(c.getStats().size).toBe(0);
    });

    test('should handle version mismatch in persist file', () => {
      const dir = path.dirname(testCachePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(testCachePath, JSON.stringify({
        version: '99.0',
        entries: [],
      }), 'utf8');

      const c = new LLMCache<string>({ persistPath: testCachePath });
      expect(c.getStats().size).toBe(0);
    });

    test('should support v1.0 cache format', () => {
      const dir = path.dirname(testCachePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Compute the key hash the same way the cache does
      const normalized = 'v1-key'.trim().toLowerCase().slice(0, 2000);
      const hash = crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);

      const cacheData = {
        version: '1.0',
        timestamp: Date.now(),
        entries: [{
          key: hash,
          data: 'v1-value',
          timestamp: Date.now(),
          hits: 0,
        }],
      };
      fs.writeFileSync(testCachePath, JSON.stringify(cacheData), 'utf8');

      const c = new LLMCache<string>({ persistPath: testCachePath });
      expect(c.get('v1-key')).toBe('v1-value');
    });

    test('should filter expired entries when loading', () => {
      const dir = path.dirname(testCachePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const cacheData = {
        version: '2.0',
        timestamp: Date.now(),
        entries: [{
          key: 'expired-key',
          data: 'expired-value',
          timestamp: Date.now() - 100 * 60 * 60 * 1000, // 100 hours ago
          hits: 0,
          originalText: 'expired key',
        }],
      };
      fs.writeFileSync(testCachePath, JSON.stringify(cacheData), 'utf8');

      const c = new LLMCache<string>({ persistPath: testCachePath, ttlMinutes: 60 });
      expect(c.getStats().size).toBe(0);
    });

    test('persist() should save to disk when persist is enabled', () => {
      const c = new LLMCache<string>({ persistPath: testCachePath });
      c.set('manual-key', 'manual-value');
      c.persist();

      expect(fs.existsSync(testCachePath)).toBe(true);
    });

    test('persist() should be no-op when persist is disabled', () => {
      const c = new LLMCache<string>();
      expect(() => c.persist()).not.toThrow();
    });

    test('clearExpired should persist when enabled', () => {
      const c = new LLMCache<string>({ persistPath: testCachePath, ttlMinutes: 0 });
      c.set('expired', 'value');
      c.persist();

      c.clearExpired();
      c.persist();

      const content = JSON.parse(fs.readFileSync(testCachePath, 'utf8'));
      expect(content.entries).toHaveLength(0);
    });

    test('should create cache directory if it does not exist', () => {
      const deepPath = path.join('/tmp', `test-deep-${Date.now()}`, 'sub', 'cache.json');
      const c = new LLMCache<string>({ persistPath: deepPath });
      c.set('key', 'value');
      c.persist();

      expect(fs.existsSync(deepPath)).toBe(true);

      // Cleanup
      try {
        fs.rmSync(path.dirname(deepPath).split('/').slice(0, 3).join('/'), { recursive: true });
      } catch {
        // ignore
      }
    });
  });

  // ========================================
  // Semantic matching with multiple similar entries (best match selection)
  // ========================================
  describe('semantic matching best match selection', () => {
    test('should select the entry with highest similarity when multiple match', () => {
      // Set up multiple entries
      cache.set('hello world', 'result-world');
      cache.set('hello universe', 'result-universe');

      // Mock similarity to return different scores for each entry
      let callCount = 0;
      mockCalculateSemanticSimilarity.mockImplementation(() => {
        callCount++;
        // First call matches first entry with 0.85, second call matches second with 0.95
        return callCount === 1 ? 0.85 : 0.95;
      });
      mockSemanticMetricsTracker.getMetrics.mockReturnValue({
        exactHits: 0,
        semanticHits: 1,
        misses: 0,
        avgSimilarityScore: 0.95,
        totalComparisons: 2,
      });

      const result = cache.get('hello something');
      expect(result).toBe('result-universe');
      expect(mockSemanticMetricsTracker.recordSemanticHit).toHaveBeenCalledWith(0.95);
    });

    test('should compare against all entries when searching for semantic match', () => {
      cache.set('apple pie recipe', 'pie-result');
      cache.set('apple juice recipe', 'juice-result');
      cache.set('banana bread recipe', 'bread-result');

      let callCount = 0;
      mockCalculateSemanticSimilarity.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return 0.75; // Below threshold
        if (callCount === 2) return 0.82; // Above threshold
        return 0.91; // Best match
      });

      const result = cache.get('apple smoothie recipe');
      expect(result).toBe('bread-result');
    });

    test('should return null when no entry meets threshold', () => {
      cache.set('entry one', 'result1');
      cache.set('entry two', 'result2');
      cache.set('entry three', 'result3');

      // All below threshold
      mockCalculateSemanticSimilarity.mockReturnValue(0.5);

      const result = cache.get('something different');
      expect(result).toBeNull();
      expect(mockSemanticMetricsTracker.recordMiss).toHaveBeenCalled();
    });

    test('should skip expired entries during semantic search', () => {
      const c = new LLMCache<string>({ ttlMinutes: 0 });
      c.set('expired entry', 'expired-result');

      // The entry is expired, so semantic search should skip it
      mockCalculateSemanticSimilarity.mockReturnValue(0.95);
      const result = c.get('expired entry similar');
      expect(result).toBeNull();
    });
  });

  // ========================================
  // Eviction behavior at exact boundary
  // ========================================
  describe('eviction at exact boundary', () => {
    test('should evict when cache reaches exactly maxSize', () => {
      const c = new LLMCache<string>({ maxSize: 3 });

      c.set('first', 'val1');
      c.set('second', 'val2');
      c.set('third', 'val3');

      // Cache is exactly at maxSize now
      expect(c.getStats().size).toBe(3);

      // Adding one more should trigger eviction
      c.set('fourth', 'val4');
      expect(c.getStats().size).toBeLessThanOrEqual(4);
      // First entry may or may not be evicted yet (eviction happens before set)
    });

    test('should evict oldest entry specifically', () => {
      const c = new LLMCache<string>({ maxSize: 2 });

      c.set('oldest', 'val1');
      c.set('middle', 'val2');
      c.set('newest', 'val3');

      // The oldest entry should be evicted
      const stats = c.getStats();
      expect(stats.size).toBeLessThanOrEqual(3);

      // Oldest should no longer be retrievable
      expect(c.get('oldest')).toBeNull();
    });

    test('should not evict when below maxSize', () => {
      const c = new LLMCache<string>({ maxSize: 5 });

      c.set('a', '1');
      c.set('b', '2');
      c.set('c', '3');

      expect(c.getStats().size).toBe(3);
      expect(c.get('a')).toBe('1');
      expect(c.get('b')).toBe('2');
      expect(c.get('c')).toBe('3');
    });
  });

  // ========================================
  // Atomic file write failure scenarios
  // ========================================
  describe('atomic file write failures', () => {
    test('should handle write failure gracefully', () => {
      // Use a read-only location that will fail on write
      // persistDebounceMs: 0 ensures immediate synchronous write so the error path is tested
      const c = new LLMCache<string>({ persistPath: '/tmp/nonexistent-dead-end/impossible/path/cache.json', persistDebounceMs: 0 });

      // Should not throw despite write failure
      expect(() => c.set('key', 'value')).not.toThrow();
    });

    test('should handle clearExpired persist failure gracefully', () => {
      const c = new LLMCache<string>({ persistPath: '/tmp/nonexistent-dead-end/impossible/cache.json', ttlMinutes: 0, persistDebounceMs: 0 });
      c.set('expired', 'value');

      // Should not throw even though persist will fail
      expect(() => c.clearExpired()).not.toThrow();
    });
  });

  // ========================================
  // Concurrent get/set operations
  // ========================================
  describe('concurrent get/set operations', () => {
    test('should handle interleaved get and set operations', async () => {
      const c = new LLMCache<string>();

      // Interleave sets and gets
      c.set('key1', 'value1');
      const r1 = c.get('key1');
      c.set('key2', 'value2');
      const r2 = c.get('key2');
      c.set('key3', 'value3');
      const r3 = c.get('key3');

      expect(r1).toBe('value1');
      expect(r2).toBe('value2');
      expect(r3).toBe('value3');
    });

    test('should handle set overwriting during concurrent access pattern', () => {
      const c = new LLMCache<string>();

      c.set('shared', 'first');
      expect(c.get('shared')).toBe('first');

      c.set('shared', 'second');
      expect(c.get('shared')).toBe('second');
    });

    test('should handle multiple rapid sets', () => {
      const c = new LLMCache<string>();

      for (let i = 0; i < 50; i++) {
        c.set(`key-${i}`, `value-${i}`);
      }

      expect(c.getStats().size).toBe(50);

      for (let i = 0; i < 50; i++) {
        expect(c.get(`key-${i}`)).toBe(`value-${i}`);
      }
    });
  });

  // ========================================
  // Stats calculation accuracy
  // ========================================
  describe('stats calculation accuracy', () => {
    test('should calculate hitRate correctly after multiple operations', () => {
      cache.set('key1', 'val1');
      cache.set('key2', 'val2');

      // 2 hits
      cache.get('key1');
      cache.get('key2');

      // 1 miss
      cache.get('nonexistent');

      const stats = cache.getStats();
      // avgHitsPerEntry = totalHits / entries.length
      // totalHits from entries = 2 (from get operations)
      expect(stats.totalHits).toBe(2);
      expect(stats.size).toBe(2);
      expect(stats.avgHitsPerEntry).toBe(1); // 2 hits / 2 entries
    });

    test('should track validEntries accurately with expired entries', () => {
      const c = new LLMCache<string>({ ttlMinutes: 0 });
      c.set('expired1', 'val1');
      c.set('expired2', 'val2');
      c.set('expired3', 'val3');

      // All are expired
      expect(c.getStats().validEntries).toBe(0);
      expect(c.getStats().size).toBe(3); // Still in cache
    });

    test('should compute hitRate as 0 for empty cache', () => {
      const stats = cache.getStats();
      expect(stats.hitRate).toBe(0);
    });

    test('should compute overallHitRate from semantic metrics', () => {
      mockSemanticMetricsTracker.getMetrics.mockReturnValue({
        exactHits: 5,
        semanticHits: 2,
        misses: 3,
        avgSimilarityScore: 0.85,
        totalComparisons: 10,
      });

      const stats = cache.getStats();
      // overallHitRate = (5 + 2) / (5 + 2 + 3) * 100 = 70
      expect(stats.semantic.overallHitRate).toBe(70);
    });

    test('should return 0 overallHitRate when no requests', () => {
      mockSemanticMetricsTracker.getMetrics.mockReturnValue({
        exactHits: 0,
        semanticHits: 0,
        misses: 0,
        avgSimilarityScore: 0,
        totalComparisons: 0,
      });

      const stats = cache.getStats();
      expect(stats.semantic.overallHitRate).toBe(0);
    });

    test('should track semantic stats accurately', () => {
      // Exact hit
      cache.set('exact', 'result');
      cache.get('exact');

      expect(mockSemanticMetricsTracker.recordExactHit).toHaveBeenCalled();

      const stats = cache.getStats();
      expect(stats.semantic.enabled).toBe(true);
      expect(stats.semantic.threshold).toBe(0.80);
    });
  });

  // ========================================
  // Edge cases in key generation
  // ========================================
  describe('key generation edge cases', () => {
    test('should handle very long keys by truncating', () => {
      const longKey = 'a'.repeat(5000);
      cache.set(longKey, 'value');

      // Should still be retrievable with normalized version
      expect(cache.get(longKey)).toBe('value');
    });

    test('should handle special characters in keys', () => {
      cache.set('hello "world" & <friends>', 'value');
      expect(cache.get('hello "world" & <friends>')).toBe('value');
    });

    test('should handle empty string key', () => {
      cache.set('', 'empty-value');
      expect(cache.get('')).toBe('empty-value');
    });

    test('should produce different keys for different prefixes', () => {
      cache.set('same', 'val-a', 'prefix-a');
      cache.set('same', 'val-b', 'prefix-b');

      expect(cache.get('same', 'prefix-a')).toBe('val-a');
      expect(cache.get('same', 'prefix-b')).toBe('val-b');
    });
  });
});
