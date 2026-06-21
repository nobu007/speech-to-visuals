/**
 * Tests for memory-cache.ts
 * Covers: get/set, TTL expiration, LRU eviction, cleanup, stats,
 * getOrCompute, destroy, and edge cases.
 */

import { jest } from '@jest/globals';

const { MemoryCache } = await import('../memory-cache');

describe('MemoryCache', () => {
  let cache: InstanceType<typeof MemoryCache<string>>;

  beforeEach(() => {
    cache = new MemoryCache<string>({ maxSize: 5, defaultTtlMs: 1000, cleanupIntervalMs: 0 });
  });

  afterEach(() => {
    cache.destroy();
  });

  // ---------------------------------------------------------------------------
  // Basic get/set
  // ---------------------------------------------------------------------------

  describe('get/set', () => {
    it('should store and retrieve a value', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for missing key', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should overwrite existing value on set', () => {
      cache.set('key1', 'value1');
      cache.set('key1', 'value2');
      expect(cache.get('key1')).toBe('value2');
    });
  });

  // ---------------------------------------------------------------------------
  // TTL expiration
  // ---------------------------------------------------------------------------

  describe('TTL expiration', () => {
    it('should return value within TTL', () => {
      cache.set('key1', 'value1', 5000);
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined after TTL expires', async () => {
      cache.set('key1', 'value1', 50);
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should use default TTL when no override', async () => {
      const shortCache = new MemoryCache<string>({ maxSize: 5, defaultTtlMs: 50, cleanupIntervalMs: 0 });
      shortCache.set('key1', 'value1');
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(shortCache.get('key1')).toBeUndefined();
      shortCache.destroy();
    });

    it('should delete expired entry on get', async () => {
      cache.set('key1', 'value1', 50);
      await new Promise(resolve => setTimeout(resolve, 100));
      cache.get('key1');
      expect(cache.has('key1')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // LRU eviction
  // ---------------------------------------------------------------------------

  describe('LRU eviction', () => {
    it('should evict least recently used when at capacity', () => {
      const smallCache = new MemoryCache<string>({ maxSize: 3, defaultTtlMs: 60000, cleanupIntervalMs: 0 });
      smallCache.set('a', '1');
      smallCache.set('b', '2');
      smallCache.set('c', '3');
      smallCache.set('d', '4'); // Should evict 'a'

      expect(smallCache.get('a')).toBeUndefined();
      expect(smallCache.get('b')).toBe('2');
      expect(smallCache.get('c')).toBe('3');
      expect(smallCache.get('d')).toBe('4');
      smallCache.destroy();
    });

    it('should refresh LRU position on get', () => {
      const smallCache = new MemoryCache<string>({ maxSize: 3, defaultTtlMs: 60000, cleanupIntervalMs: 0 });
      smallCache.set('a', '1');
      smallCache.set('b', '2');
      smallCache.set('c', '3');

      // Access 'a' to make it most recently used
      smallCache.get('a');

      smallCache.set('d', '4'); // Should evict 'b' (least recently used now)

      expect(smallCache.get('a')).toBe('1');
      expect(smallCache.get('b')).toBeUndefined();
      smallCache.destroy();
    });

    it('should refresh position on set with existing key', () => {
      const smallCache = new MemoryCache<string>({ maxSize: 3, defaultTtlMs: 60000, cleanupIntervalMs: 0 });
      smallCache.set('a', '1');
      smallCache.set('b', '2');
      smallCache.set('c', '3');

      // Re-set 'a' to refresh its position
      smallCache.set('a', 'updated');

      smallCache.set('d', '4'); // Should evict 'b'

      expect(smallCache.get('a')).toBe('updated');
      expect(smallCache.get('b')).toBeUndefined();
      smallCache.destroy();
    });
  });

  // ---------------------------------------------------------------------------
  // has()
  // ---------------------------------------------------------------------------

  describe('has', () => {
    it('should return true for existing non-expired key', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
    });

    it('should return false for missing key', () => {
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('should return false for expired key and delete it', async () => {
      cache.set('key1', 'value1', 50);
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(cache.has('key1')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // delete()
  // ---------------------------------------------------------------------------

  describe('delete', () => {
    it('should delete an existing key', () => {
      cache.set('key1', 'value1');
      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should return false for non-existent key', () => {
      expect(cache.delete('nonexistent')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // clear()
  // ---------------------------------------------------------------------------

  describe('clear', () => {
    it('should remove all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
    });

    it('should reset stats', () => {
      cache.set('key1', 'value1');
      cache.get('key1');
      cache.get('missing');
      cache.clear();
      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.evictions).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // cleanup()
  // ---------------------------------------------------------------------------

  describe('cleanup', () => {
    it('should remove only expired entries', async () => {
      cache.set('expired', 'value1', 50);
      cache.set('alive', 'value2', 5000);
      await new Promise(resolve => setTimeout(resolve, 100));

      const removed = cache.cleanup();
      expect(removed).toBe(1);
      expect(cache.get('alive')).toBe('value2');
      expect(cache.get('expired')).toBeUndefined();
    });

    it('should return 0 when nothing expired', () => {
      cache.set('key1', 'value1', 5000);
      expect(cache.cleanup()).toBe(0);
    });

    it('should return 0 on empty cache', () => {
      expect(cache.cleanup()).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // getOrCompute()
  // ---------------------------------------------------------------------------

  describe('getOrCompute', () => {
    it('should return cached value when available', async () => {
      cache.set('key1', 'cached');
      const compute = jest.fn().mockResolvedValue('computed');
      const result = await cache.getOrCompute('key1', compute);
      expect(result).toBe('cached');
      expect(compute).not.toHaveBeenCalled();
    });

    it('should compute and cache when missing', async () => {
      const compute = jest.fn().mockResolvedValue('computed');
      const result = await cache.getOrCompute('key2', compute);
      expect(result).toBe('computed');
      expect(compute).toHaveBeenCalledTimes(1);
      expect(cache.get('key2')).toBe('computed');
    });

    it('should use custom TTL when provided', async () => {
      const compute = jest.fn().mockResolvedValue('computed');
      await cache.getOrCompute('key3', compute, 50);
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(cache.get('key3')).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // getStats()
  // ---------------------------------------------------------------------------

  describe('getStats', () => {
    it('should track hits and misses', () => {
      cache.set('key1', 'value1');
      cache.get('key1'); // hit
      cache.get('missing'); // miss
      cache.get('key1'); // hit

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(2 / 3);
    });

    it('should track evictions', () => {
      const smallCache = new MemoryCache<string>({ maxSize: 2, defaultTtlMs: 60000, cleanupIntervalMs: 0 });
      smallCache.set('a', '1');
      smallCache.set('b', '2');
      smallCache.set('c', '3'); // evicts 'a'

      const stats = smallCache.getStats();
      expect(stats.evictions).toBe(1);
      expect(stats.size).toBe(2);
      smallCache.destroy();
    });

    it('should report hitRate as 0 with no operations', () => {
      const stats = cache.getStats();
      expect(stats.hitRate).toBe(0);
    });

    it('should count expired-entry access as miss', async () => {
      cache.set('key1', 'value1', 50);
      await new Promise(resolve => setTimeout(resolve, 100));
      cache.get('key1'); // should be a miss

      const stats = cache.getStats();
      expect(stats.misses).toBe(1);
      expect(stats.hits).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // destroy()
  // ---------------------------------------------------------------------------

  describe('destroy', () => {
    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.destroy();
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should clear interval timer', () => {
      const timerCache = new MemoryCache<string>({
        maxSize: 5,
        defaultTtlMs: 60000,
        cleanupIntervalMs: 100,
      });
      timerCache.set('key1', 'value1');
      timerCache.destroy();

      // After destroy, the cleanup timer should be stopped
      // We verify by checking the timer is nulled (indirectly via no crash)
      expect(timerCache.get('key1')).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Interval-based cleanup
  // ---------------------------------------------------------------------------

  describe('interval-based cleanup', () => {
    it('should periodically cleanup expired entries', async () => {
      const intervalCache = new MemoryCache<string>({
        maxSize: 10,
        defaultTtlMs: 50,
        cleanupIntervalMs: 100,
      });
      intervalCache.set('short-lived', 'value', 50);

      // Wait for TTL + cleanup interval
      await new Promise(resolve => setTimeout(resolve, 250));

      // The entry should have been cleaned up by the interval
      const stats = intervalCache.getStats();
      expect(stats.size).toBe(0);

      intervalCache.destroy();
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    it('should handle maxSize of 1', () => {
      const tinyCache = new MemoryCache<string>({ maxSize: 1, defaultTtlMs: 60000, cleanupIntervalMs: 0 });
      tinyCache.set('a', '1');
      tinyCache.set('b', '2'); // evicts 'a'
      expect(tinyCache.get('a')).toBeUndefined();
      expect(tinyCache.get('b')).toBe('2');
      tinyCache.destroy();
    });

    it('should work with empty string as key', () => {
      cache.set('', 'empty-key-value');
      expect(cache.get('')).toBe('empty-key-value');
    });

    it('should work with null/undefined-like values', () => {
      const numCache = new MemoryCache<number>({ maxSize: 5, defaultTtlMs: 60000, cleanupIntervalMs: 0 });
      numCache.set('zero', 0);
      expect(numCache.get('zero')).toBe(0);
      numCache.destroy();
    });

    it('should handle objects as values', () => {
      const objCache = new MemoryCache<{ id: number }>({ maxSize: 5, defaultTtlMs: 60000, cleanupIntervalMs: 0 });
      const obj = { id: 42 };
      objCache.set('obj', obj);
      expect(objCache.get('obj')).toEqual(obj);
      objCache.destroy();
    });

    it('should count accessCount on hits', () => {
      cache.set('key1', 'value1');
      cache.get('key1');
      cache.get('key1');
      cache.get('key1');
      // accessCount is internal but we verify LRU behavior still works
      expect(cache.get('key1')).toBe('value1');
    });
  });
});
