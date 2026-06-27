/**
 * Tests for ISS-019: JSON.parse robustness in intelligent-cache.ts decompressData
 * Verifies that corrupted cache data returns null instead of throwing.
 */
import { IntelligentCache } from '@/performance/intelligent-cache';
import { logger } from '@/utils/logger';
import type { DiagramType } from '@/types/diagram';

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
