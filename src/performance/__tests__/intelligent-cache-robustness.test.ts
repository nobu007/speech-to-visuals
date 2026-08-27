/**
 * Tests for ISS-019: JSON.parse robustness in intelligent-cache.ts decompressData
 * Verifies that corrupted cache data returns null instead of throwing.
 */
import { IntelligentCache } from '@/performance/intelligent-cache';
import { logger } from '@stv/core/utils/logger';
import type { DiagramType } from '@stv/core/types/diagram';

function makeMetadata(overrides: Partial<{
  contentType: DiagramType;
  duration: number;
  complexity: number;
  performanceScore: number;
  accessPattern: 'frequent' | 'recent' | 'mixed' | 'cold';
}> = {}) {
  return {
    contentType: 'flow' as DiagramType,
    duration: 100,
    complexity: 0.5,
    performanceScore: 0.8,
    accessPattern: 'mixed' as const,
    ...overrides,
  };
}

describe('IntelligentCache - corrupted data robustness (ISS-019)', () => {
  let cache: IntelligentCache;

  beforeEach(() => {
    cache = new IntelligentCache();
  });

  test('should handle store and get round-trip without throwing', async () => {
    const data = { nested: { value: 42 }, arr: [1, 2, 3] };
    await cache.store('round-trip-key', data, makeMetadata());

    const result = await cache.get('round-trip-key');
    expect(result).toEqual(data);
  });

  test('should handle non-existent key gracefully', async () => {
    const result = await cache.get('non-existent-key');
    expect(result).toBeNull();
  });

  test('should handle complex data types in cache', async () => {
    const complexData = {
      string: 'test',
      number: 123,
      boolean: true,
      nested: { deep: { value: 'deep' } },
      array: [1, 'two', false],
    };

    await cache.store('complex-data', complexData, makeMetadata());
    const result = await cache.get('complex-data');
    expect(result).toEqual(complexData);
  });

  test('should not throw when decompressing data', async () => {
    // Store a large value that triggers compression
    const bigData = { text: 'a'.repeat(2000) };
    await cache.store('big-data', bigData, makeMetadata());

    // Retrieval should not throw (pre-existing compression edge cases may alter data,
    // but the important thing is no uncaught exception)
    const result = await cache.get('big-data');
    expect(result).toBeDefined();
  });

  test('should handle null values in cache', async () => {
    await cache.store('null-key', null, makeMetadata());
    const val = await cache.get('null-key');
    expect(val).toBeNull();
  });
});

describe('IntelligentCache - corruption logging', () => {
  let cache: IntelligentCache;

  beforeEach(() => {
    cache = new IntelligentCache();
    jest.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should log warning when decompressData encounters corrupted JSON', () => {
    // Access the private decompressData method
    const internals = cache as unknown as {
      decompressData: (compressed: string, originalSize: number, cacheKey?: string) => unknown;
      corruptedKeys: Set<string>;
      stats: { corruptionCount: number };
    };

    // Pass corrupted data that will fail JSON.parse
    const result = internals.decompressData('{invalid json!!!', 100, 'test-key-corrupt');

    expect(result).toBeNull();
    // reportCorruption now handles logging: [Corruption:IntelligentCache] ...
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('[Corruption:IntelligentCache]'),
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('test-key-corrupt'),
    );
  });

  test('should track corruption count and corrupted keys on decompression failure', () => {
    const internals = cache as unknown as {
      decompressData: (compressed: string, originalSize: number, cacheKey?: string) => unknown;
      corruptedKeys: Set<string>;
      stats: { corruptionCount: number };
    };

    internals.decompressData('not json', 50, 'corrupt-key-1');
    internals.decompressData('also not json', 50, 'corrupt-key-2');

    expect(internals.stats.corruptionCount).toBe(2);
    expect(internals.corruptedKeys.has('corrupt-key-1')).toBe(true);
    expect(internals.corruptedKeys.has('corrupt-key-2')).toBe(true);
  });

  test('should not log when decompression succeeds', () => {
    const internals = cache as unknown as {
      decompressData: (compressed: string, originalSize: number, cacheKey?: string) => unknown;
    };

    const validJson = JSON.stringify({ data: 'test' });
    internals.decompressData(validJson, validJson.length, 'good-key');

    expect(logger.warn).not.toHaveBeenCalled();
  });
});

/**
 * Guards the "unbounded .add onto a process-lifetime singleton" bug class.
 *
 * `corruptedKeys` is the asymmetric-cleanup sibling of the otherwise-capped
 * collections: every eviction/expiry/purge path deleted from
 * cache/fingerprints/preloadQueue/accessOrder but NOT corruptedKeys, so any key
 * that ever failed decompression was retained forever on the `globalCache`
 * singleton (key domain = arbitrary input content → unbounded). The fix routes
 * all removal paths through `removeEntry()`, which deletes symmetrically.
 */
describe('IntelligentCache - corruptedKeys unbounded-growth guard', () => {
  test('get()-path decompression failure purges the key from corruptedKeys (no leak)', async () => {
    const cache = new IntelligentCache();
    const internals = cache as unknown as {
      cache: Map<string, { data: string; compressed: boolean; originalSize: number; sourceContent: string }>;
      corruptedKeys: Set<string>;
      generateCacheKey: (content: string) => string;
    };

    // Force many DISTINCT keys through the real runtime decompression-failure
    // path. Before the fix each one was retained in corruptedKeys for the
    // singleton's lifetime; after the fix the purge routes through removeEntry
    // and deletes it, so the set stays bounded regardless of distinct count.
    for (let i = 0; i < 25; i++) {
      const content = `corrupt-content-${i}`;
      await cache.store(content, { i }, makeMetadata());

      const key = internals.generateCacheKey(content);
      const entry = internals.cache.get(key)!;
      // Force the compressed branch + a payload that fails JSON.parse so the
      // get() path hits decompressData -> corruptedKeys.add -> purge.
      entry.compressed = true;
      entry.data = '!!!not-valid-json!!!';
      entry.originalSize = entry.data.length;

      const result = await cache.get(content);
      expect(result).toBeNull();
      // The purge must have evicted the corrupt entry itself.
      expect(internals.cache.has(key)).toBe(false);
    }

    expect(internals.corruptedKeys.size).toBe(0);
  });

  test('findSimilar()-path decompression failure counts as a miss and purges the entry (get() parity)', async () => {
    const cache = new IntelligentCache();
    const internals = cache as unknown as {
      cache: Map<string, { data: string; compressed: boolean; originalSize: number }>;
      corruptedKeys: Set<string>;
      stats: { totalHits?: number; totalMisses?: number; totalSavedTime: number };
      generateCacheKey: (content: string) => string;
    };

    // A real compressed entry whose fingerprint matches the lookup content, so
    // findSimilar() selects it as bestMatch and takes the decompress branch.
    const content = 'process flow step system diagram structure hierarchy timeline sequence network cycle matrix';
    await cache.store(content, { text: 'a'.repeat(2000) }, makeMetadata());

    const key = internals.generateCacheKey(content);
    const entry = internals.cache.get(key)!;
    expect(entry.compressed).toBe(true);

    // Corrupt the stored payload (same idiom as the get()-path leg above).
    entry.data = '!!!not-valid-json!!!';
    entry.originalSize = entry.data.length;

    const hitsBefore = internals.stats.totalHits ?? 0;
    const savedBefore = internals.stats.totalSavedTime;

    const result = await cache.findSimilar(content);

    // get() contract: decompression failure is a MISS — null return, entry
    // purged (incl. corruptedKeys via removeEntry), and no hit-rate /
    // saved-time inflation. Before this parity fix findSimilar() returned a
    // data:null entry while counting it as a hit and adding 1000ms of phantom
    // "saved" time, leaving the corrupt entry resident to hit again.
    expect(result).toBeNull();
    expect(internals.cache.has(key)).toBe(false);
    expect(internals.corruptedKeys.size).toBe(0);
    expect(internals.stats.totalHits ?? 0).toBe(hitsBefore);
    expect(internals.stats.totalMisses ?? 0).toBeGreaterThan(0);
    expect(internals.stats.totalSavedTime).toBe(savedBefore);
  });

  test('removeEntry clears every shadow collection symmetrically', () => {
    const cache = new IntelligentCache();
    const internals = cache as unknown as {
      cache: Map<string, unknown>;
      fingerprints: Map<string, unknown>;
      preloadQueue: Set<string>;
      corruptedKeys: Set<string>;
      accessOrder: string[];
      removeEntry: (key: string) => void;
    };

    const key = 'shadowed-key';
    internals.cache.set(key, {});
    internals.fingerprints.set(key, {});
    internals.preloadQueue.add(key);
    internals.corruptedKeys.add(key);
    internals.accessOrder.push('keep-before', key, 'keep-after');

    internals.removeEntry(key);

    // Dynamically assert no collection-typed instance field still references
    // the key — covers the current set AND any future shadow collection added
    // without being wired into removeEntry (the asymmetric-cleanup regression).
    for (const [, value] of Object.entries(internals)) {
      if (value instanceof Map || value instanceof Set) {
        expect(value.has(key)).toBe(false);
      } else if (Array.isArray(value)) {
        expect(value).not.toContain(key);
      }
    }
    // Splice must remove only the target, preserving neighbors.
    expect(internals.accessOrder).toEqual(['keep-before', 'keep-after']);
  });
});

/**
 * Branch-parity complement to the findSimilar decompress-failure leg above
 * (INV-CACHE-002): the same decompress gate also guards the SUCCESS path for
 * entries that were never compressed (compressed=false → wasDecompressed
 * stays false). This leg pins that branch — the raw stored data comes back
 * as-is, the entry stays resident, and the hit bookkeeping (hit count,
 * saved-time estimate, access mutation) still executes. A regression here
 * (e.g. unconditionally returning `{ ...bestMatch, data: decompressedData }`
 * after a helper extraction) would hand every small-entry caller
 * `data: undefined` while still counting the hit.
 */
describe('IntelligentCache - findSimilar non-compressed success branch (INV-CACHE-002 parity)', () => {
  test('findSimilar() hit on a NON-compressed entry returns the raw data and still records the hit', async () => {
    const cache = new IntelligentCache();
    const internals = cache as unknown as {
      cache: Map<string, { data: unknown; compressed: boolean; accessCount: number }>;
      stats: { totalHits?: number; totalMisses?: number; totalSavedTime: number };
      generateCacheKey: (content: string) => string;
    };

    // Small payload: compression is not beneficial, so store() keeps the raw
    // object and the entry stays compressed=false — the branch the gate skips.
    const content = 'process flow step system diagram structure hierarchy timeline sequence network cycle matrix';
    const payload = { type: 'flow', version: 7 };
    await cache.store(content, payload, makeMetadata());

    const key = internals.generateCacheKey(content);
    const entry = internals.cache.get(key);
    // Precondition: this leg exercises the wasDecompressed=false branch.
    expect(entry?.compressed).toBe(false);

    const hitsBefore = internals.stats.totalHits ?? 0;
    const missesBefore = internals.stats.totalMisses ?? 0;
    const savedBefore = internals.stats.totalSavedTime;
    const accessBefore = entry?.accessCount ?? 0;

    const result = await cache.findSimilar(content);

    // Success semantics of the uncompressed branch: raw data out, entry stays
    // resident (contrast the corrupt leg's purge), hit accounting still runs —
    // the gate must guard the failure path without removing the bookkeeping.
    expect(result?.data).toEqual(payload);
    expect(internals.cache.has(key)).toBe(true);
    expect(internals.stats.totalHits ?? 0).toBe(hitsBefore + 1);
    expect(internals.stats.totalMisses ?? 0).toBe(missesBefore);
    expect(internals.stats.totalSavedTime).toBe(savedBefore + 1000);
    expect(internals.cache.get(key)?.accessCount).toBe(accessBefore + 1);
  });
});
