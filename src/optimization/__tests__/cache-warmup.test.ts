import { CacheWarmupManager } from '../cache-warmup';
import type { WarmupPattern, WarmupResult, WarmupStats, HitRateReport } from '../cache-warmup';

// Create a mock LLMCache that implements the interface methods we need
function createMockCache<T>(opts: {
  validEntries?: number;
  semantic?: { exactHits: number; semanticHits: number; misses: number };
} = {}) {
  const store = new Map<string, { value: T; hits: number; expiresAt: number }>();
  const validEntries = opts.validEntries ?? 0;
  const semantic = opts.semantic ?? { exactHits: 0, semanticHits: 0, misses: 0 };

  return {
    get: jest.fn((key: string) => {
      const entry = store.get(key);
      if (entry && entry.expiresAt > Date.now()) {
        entry.hits++;
        return entry.value;
      }
      return null;
    }),
    set: jest.fn((key: string, value: T) => {
      store.set(key, { value, hits: 0, expiresAt: Date.now() + 60000 });
    }),
    getStats: jest.fn(() => ({
      size: store.size,
      validEntries,
      totalHits: 0,
      avgHitsPerEntry: 0,
      hitRate: 0,
      semantic: {
        enabled: true,
        threshold: 0.85,
        exactHits: semantic.exactHits,
        semanticHits: semantic.semanticHits,
        misses: semantic.misses,
        overallHitRate: 0,
        avgSimilarityScore: 0,
        totalComparisons: semantic.exactHits + semantic.semanticHits + semantic.misses,
      },
    })),
    clear: jest.fn(() => store.clear()),
    // Internal store for test assertions
    _store: store,
  };
}

describe('CacheWarmupManager', () => {
  const samplePatterns: WarmupPattern[] = [
    { text: 'pattern-1', category: 'tutorial', language: 'en' },
    { text: 'pattern-2', category: 'algorithm', language: 'en' },
    { text: 'pattern-3', category: 'architecture', language: 'ja' },
  ];

  describe('isColdStart', () => {
    it('should return true when cache has fewer entries than threshold', () => {
      const cache = createMockCache({ validEntries: 2 });
      const manager = new CacheWarmupManager<string>(cache, { coldStartThreshold: 5 });

      expect(manager.isColdStart()).toBe(true);
    });

    it('should return false when cache meets threshold', () => {
      const cache = createMockCache({ validEntries: 5 });
      const manager = new CacheWarmupManager<string>(cache, { coldStartThreshold: 5 });

      expect(manager.isColdStart()).toBe(false);
    });

    it('should return false when cache exceeds threshold', () => {
      const cache = createMockCache({ validEntries: 10 });
      const manager = new CacheWarmupManager<string>(cache, { coldStartThreshold: 5 });

      expect(manager.isColdStart()).toBe(false);
    });

    it('should use default threshold of 5 when not specified', () => {
      const cache = createMockCache({ validEntries: 4 });
      const manager = new CacheWarmupManager<string>(cache);

      expect(manager.isColdStart()).toBe(true);
    });

    it('should return true when cache is empty', () => {
      const cache = createMockCache({ validEntries: 0 });
      const manager = new CacheWarmupManager<string>(cache);

      expect(manager.isColdStart()).toBe(true);
    });
  });

  describe('getDefaultPatterns', () => {
    it('should return default warmup patterns', () => {
      const cache = createMockCache();
      const manager = new CacheWarmupManager<string>(cache);

      const patterns = manager.getDefaultPatterns();

      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns.every(p => p.text && p.category && p.language)).toBe(true);
    });

    it('should include both English and Japanese patterns', () => {
      const cache = createMockCache();
      const manager = new CacheWarmupManager<string>(cache);

      const patterns = manager.getDefaultPatterns();
      const hasEn = patterns.some(p => p.language === 'en');
      const hasJa = patterns.some(p => p.language === 'ja');

      expect(hasEn).toBe(true);
      expect(hasJa).toBe(true);
    });

    it('should return a copy, not the original array', () => {
      const cache = createMockCache();
      const manager = new CacheWarmupManager<string>(cache);

      const patterns1 = manager.getDefaultPatterns();
      const patterns2 = manager.getDefaultPatterns();

      expect(patterns1).not.toBe(patterns2);
      expect(patterns1).toEqual(patterns2);
    });
  });

  describe('setWarmupPatterns', () => {
    it('should set custom warmup patterns', () => {
      const cache = createMockCache();
      const manager = new CacheWarmupManager<string>(cache);
      const customPatterns: WarmupPattern[] = [
        { text: 'custom-1', category: 'custom', language: 'en' },
      ];

      manager.setWarmupPatterns(customPatterns);
      // Patterns will be used in next warmupIfCold
      // Verify indirectly by checking warmup behavior
      expect(true).toBe(true); // No getter available, tested via warmupIfCold
    });
  });

  describe('warmupIfCold', () => {
    it('should execute warmup when cache is cold', async () => {
      const cache = createMockCache({ validEntries: 0 });
      const manager = new CacheWarmupManager<string>(cache);

      const resolver = jest.fn().mockResolvedValue('resolved-value');
      const executed = await manager.warmupIfCold(resolver);

      expect(executed).toBe(true);
      expect(resolver).toHaveBeenCalled();
    });

    it('should skip warmup when cache is not cold', async () => {
      const cache = createMockCache({ validEntries: 10 });
      const manager = new CacheWarmupManager<string>(cache);

      const resolver = jest.fn().mockResolvedValue('resolved-value');
      const executed = await manager.warmupIfCold(resolver);

      expect(executed).toBe(false);
      expect(resolver).not.toHaveBeenCalled();
    });

    it('should use custom patterns when set', async () => {
      const cache = createMockCache({ validEntries: 0 });
      const manager = new CacheWarmupManager<string>(cache);
      const customPatterns: WarmupPattern[] = [
        { text: 'custom-pattern', category: 'custom', language: 'en' },
      ];
      manager.setWarmupPatterns(customPatterns);

      const resolver = jest.fn().mockResolvedValue('resolved');
      await manager.warmupIfCold(resolver);

      expect(resolver).toHaveBeenCalledWith('custom-pattern');
      expect(resolver).toHaveBeenCalledTimes(1);
    });

    it('should use default patterns when no custom patterns set', async () => {
      const cache = createMockCache({ validEntries: 0 });
      const manager = new CacheWarmupManager<string>(cache);

      const resolver = jest.fn().mockResolvedValue('resolved');
      await manager.warmupIfCold(resolver);

      const defaultPatterns = manager.getDefaultPatterns();
      expect(resolver).toHaveBeenCalledTimes(defaultPatterns.length);
    });
  });

  describe('warmup', () => {
    it('should successfully warm all patterns', async () => {
      const cache = createMockCache();
      const manager = new CacheWarmupManager<string>(cache);
      const resolver = jest.fn().mockResolvedValue('result');

      const result = await manager.warmup(samplePatterns, resolver);

      expect(result.patternsProcessed).toBe(3);
      expect(result.successCount).toBe(3);
      expect(result.failureCount).toBe(0);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should cache resolved values', async () => {
      const cache = createMockCache();
      const manager = new CacheWarmupManager<string>(cache);
      const resolver = jest.fn().mockResolvedValue('cached-result');

      await manager.warmup(samplePatterns, resolver);

      expect(cache.set).toHaveBeenCalledTimes(3);
      expect(cache.set).toHaveBeenCalledWith('pattern-1', 'cached-result');
      expect(cache.set).toHaveBeenCalledWith('pattern-2', 'cached-result');
      expect(cache.set).toHaveBeenCalledWith('pattern-3', 'cached-result');
    });

    it('should skip already cached patterns', async () => {
      const cache = createMockCache();
      // Pre-populate cache with pattern-1 via internal store
      cache.set('pattern-1', 'existing-value');

      const manager = new CacheWarmupManager<string>(cache);
      const resolver = jest.fn().mockResolvedValue('new-value');

      const result = await manager.warmup(samplePatterns, resolver);

      // pattern-1 should not be resolved (already cached), only 2 and 3
      expect(resolver).toHaveBeenCalledTimes(2);
      expect(resolver).not.toHaveBeenCalledWith('pattern-1');
      expect(result.successCount).toBe(3);
    });

    it('should handle resolver failures gracefully', async () => {
      const cache = createMockCache();
      const manager = new CacheWarmupManager<string>(cache);
      const resolver = jest.fn()
        .mockResolvedValueOnce('result-1')
        .mockRejectedValueOnce(new Error('Resolution failed'))
        .mockResolvedValueOnce('result-3');

      const result = await manager.warmup(samplePatterns, resolver);

      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(1);
    });

    it('should handle resolver rejecting with non-Error', async () => {
      const cache = createMockCache();
      const manager = new CacheWarmupManager<string>(cache);
      const resolver = jest.fn()
        .mockRejectedValueOnce('string error')
        .mockResolvedValueOnce('result-2')
        .mockResolvedValueOnce('result-3');

      const result = await manager.warmup(samplePatterns, resolver);

      expect(result.failureCount).toBe(1);
      expect(result.successCount).toBe(2);
    });

    it('should handle empty patterns array', async () => {
      const cache = createMockCache();
      const manager = new CacheWarmupManager<string>(cache);
      const resolver = jest.fn();

      const result = await manager.warmup([], resolver);

      expect(result.patternsProcessed).toBe(0);
      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(0);
      expect(resolver).not.toHaveBeenCalled();
    });

    it('should record hit rate before warmup', async () => {
      const cache = createMockCache({
        semantic: { exactHits: 3, semanticHits: 2, misses: 5 },
      });
      const manager = new CacheWarmupManager<string>(cache);
      const resolver = jest.fn().mockResolvedValue('result');

      const result = await manager.warmup(samplePatterns, resolver);

      // hit rate = (3+2)/(3+2+5) = 0.5
      expect(result.hitRateBefore).toBeCloseTo(0.5, 2);
    });

    it('should record zero hit rate when no requests', async () => {
      const cache = createMockCache({
        semantic: { exactHits: 0, semanticHits: 0, misses: 0 },
      });
      const manager = new CacheWarmupManager<string>(cache);
      const resolver = jest.fn().mockResolvedValue('result');

      const result = await manager.warmup(samplePatterns, resolver);

      expect(result.hitRateBefore).toBe(0);
    });
  });

  describe('recordQuery and hit rate tracking', () => {
    it('should track queries after warmup', async () => {
      const cache = createMockCache();
      const manager = new CacheWarmupManager<string>(cache);
      const resolver = jest.fn().mockResolvedValue('result');

      await manager.warmup(samplePatterns, resolver);

      manager.recordQuery(true);
      manager.recordQuery(false);
      manager.recordQuery(true);

      const report = manager.getHitRateReport();

      expect(report.queriesAfterWarmup).toBe(3);
      expect(report.hitsAfterWarmup).toBe(2);
      expect(report.hitRateAfterWarmup).toBeCloseTo(2 / 3, 2);
    });

    it('should calculate improvement correctly', async () => {
      const cache = createMockCache({
        semantic: { exactHits: 0, semanticHits: 0, misses: 10 },
      });
      const manager = new CacheWarmupManager<string>(cache);
      const resolver = jest.fn().mockResolvedValue('result');

      await manager.warmup(samplePatterns, resolver);

      // hitRateBefore = 0/10 = 0
      // Record all hits after warmup
      manager.recordQuery(true);
      manager.recordQuery(true);
      manager.recordQuery(true);
      manager.recordQuery(false);

      const report = manager.getHitRateReport();

      expect(report.improvement).toBeGreaterThan(0);
      expect(report.hitRateAfterWarmup).toBeCloseTo(0.75, 2);
    });

    it('should show zero improvement when no queries recorded', async () => {
      const cache = createMockCache();
      const manager = new CacheWarmupManager<string>(cache);
      const resolver = jest.fn().mockResolvedValue('result');

      await manager.warmup(samplePatterns, resolver);

      const report = manager.getHitRateReport();

      expect(report.queriesAfterWarmup).toBe(0);
      expect(report.hitRateAfterWarmup).toBe(0);
      expect(report.improvement).toBe(0);
    });

    it('should reset query tracking on each warmup', async () => {
      const cache = createMockCache();
      const manager = new CacheWarmupManager<string>(cache);
      const resolver = jest.fn().mockResolvedValue('result');

      await manager.warmup(samplePatterns, resolver);
      manager.recordQuery(true);
      manager.recordQuery(true);

      // Second warmup should reset tracking
      await manager.warmup(samplePatterns, resolver);

      const report = manager.getHitRateReport();
      expect(report.queriesAfterWarmup).toBe(0);
    });
  });

  describe('getWarmupStats', () => {
    it('should return initial stats', () => {
      const cache = createMockCache();
      const manager = new CacheWarmupManager<string>(cache);

      const stats = manager.getWarmupStats();

      expect(stats.totalWarmups).toBe(0);
      expect(stats.totalPatternsProcessed).toBe(0);
      expect(stats.totalSuccesses).toBe(0);
      expect(stats.totalFailures).toBe(0);
    });

    it('should accumulate stats across multiple warmups', async () => {
      const cache = createMockCache();
      const manager = new CacheWarmupManager<string>(cache);
      const resolver = jest.fn()
        .mockResolvedValueOnce('r1')
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce('r3');

      await manager.warmup(samplePatterns, resolver);

      const resolver2 = jest.fn()
        .mockResolvedValueOnce('r1')
        .mockResolvedValueOnce('r2')
        .mockResolvedValueOnce('r3');

      // Clear cache so patterns are re-resolved
      cache.clear();
      await manager.warmup(samplePatterns, resolver2);

      const stats = manager.getWarmupStats();

      expect(stats.totalWarmups).toBe(2);
      expect(stats.totalPatternsProcessed).toBe(6);
      expect(stats.totalSuccesses).toBe(5);
      expect(stats.totalFailures).toBe(1);
    });

    it('should return a copy of stats', () => {
      const cache = createMockCache();
      const manager = new CacheWarmupManager<string>(cache);

      const stats1 = manager.getWarmupStats();
      const stats2 = manager.getWarmupStats();

      expect(stats1).not.toBe(stats2);
      expect(stats1).toEqual(stats2);
    });
  });

  describe('custom cold start threshold', () => {
    it('should respect custom threshold of 1', () => {
      const cache = createMockCache({ validEntries: 0 });
      const manager = new CacheWarmupManager<string>(cache, { coldStartThreshold: 1 });

      expect(manager.isColdStart()).toBe(true);
    });

    it('should respect custom threshold of 100', () => {
      const cache = createMockCache({ validEntries: 50 });
      const manager = new CacheWarmupManager<string>(cache, { coldStartThreshold: 100 });

      expect(manager.isColdStart()).toBe(true);
    });

    it('should not be cold start when entries equal custom threshold', () => {
      const cache = createMockCache({ validEntries: 10 });
      const manager = new CacheWarmupManager<string>(cache, { coldStartThreshold: 10 });

      expect(manager.isColdStart()).toBe(false);
    });
  });
});
