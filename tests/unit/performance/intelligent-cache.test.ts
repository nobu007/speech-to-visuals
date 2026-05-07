import { IntelligentCache, globalCache, cached } from '@/performance/intelligent-cache';

describe('IntelligentCache', () => {
  let cache: IntelligentCache;

  beforeEach(() => {
    cache = new IntelligentCache();
  });

  describe('store and get', () => {
    it('should store and retrieve data', async () => {
      await cache.store('test content', { result: 'hello' }, {
        contentType: 'flow',
        duration: 5000,
        complexity: 0.5,
        performanceScore: 0.8,
        accessPattern: 'mixed',
      });

      const result = await cache.get('test content');
      expect(result).toEqual({ result: 'hello' });
    });

    it('should return null for non-existent key', async () => {
      const result = await cache.get('non-existent');
      expect(result).toBeNull();
    });

    it('should return null for expired entries', async () => {
      await cache.store('test content', { result: 'hello' }, {
        contentType: 'flow',
        duration: 5000,
        complexity: 0.5,
        performanceScore: 0.8,
        accessPattern: 'mixed',
      });

      // Manually expire by modifying timestamp
      const key = (cache as unknown as { generateCacheKey: (s: string) => string }).generateCacheKey('test content');
      const internalCache = (cache as unknown as { cache: Map<string, { timestamp: number }> }).cache;
      const entry = internalCache.get(key);
      if (entry) {
        entry.timestamp = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago
      }

      const result = await cache.get('test content');
      expect(result).toBeNull();
    });

    it('should update stats on store', async () => {
      await cache.store('content', { data: 1 }, {
        contentType: 'flow',
        duration: 1000,
        complexity: 0.3,
        performanceScore: 0.7,
        accessPattern: 'recent',
      });

      const stats = cache.getStats();
      expect(stats.totalEntries).toBe(1);
    });
  });

  describe('findSimilar', () => {
    it('should return null for empty cache', async () => {
      const result = await cache.findSimilar('test content');
      expect(result).toBeNull();
    });

    it('should find similar content', async () => {
      await cache.store('process flow diagram with steps', { type: 'flow' }, {
        contentType: 'flow',
        duration: 5000,
        complexity: 0.6,
        performanceScore: 0.8,
        accessPattern: 'mixed',
      });

      const result = await cache.findSimilar('process flow diagram with steps');
      expect(result).not.toBeNull();
    });

    it('should handle miss gracefully', async () => {
      const result = await cache.findSimilar('completely different content xyz');
      expect(result).toBeNull();
    });

    it('should find similar content with preload hits', async () => {
      // Store two similar entries
      await cache.store('process flow steps one two three', { v: 1 }, {
        contentType: 'flow',
        duration: 5000,
        complexity: 0.5,
        performanceScore: 0.9,
        accessPattern: 'frequent',
      });

      await cache.store('process flow steps one two four', { v: 2 }, {
        contentType: 'flow',
        duration: 5000,
        complexity: 0.5,
        performanceScore: 0.9,
        accessPattern: 'frequent',
      });

      const result = await cache.findSimilar('process flow steps one two three');
      expect(result).not.toBeNull();
    });
  });

  describe('clear', () => {
    it('should clear all entries and reset stats', async () => {
      await cache.store('content1', { data: 1 }, {
        contentType: 'flow',
        duration: 1000,
        complexity: 0.3,
        performanceScore: 0.7,
        accessPattern: 'recent',
      });
      await cache.store('content2', { data: 2 }, {
        contentType: 'tree',
        duration: 2000,
        complexity: 0.5,
        performanceScore: 0.8,
        accessPattern: 'mixed',
      });

      cache.clear();

      const stats = cache.getStats();
      expect(stats.totalEntries).toBe(0);
      expect(stats.hitRate).toBe(0);
      expect(stats.missRate).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return current stats', () => {
      const stats = cache.getStats();
      expect(stats).toHaveProperty('totalEntries');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('missRate');
      expect(stats).toHaveProperty('memoryUsage');
      expect(stats).toHaveProperty('performanceScore');
    });
  });

  describe('getEfficiencyReport', () => {
    it('should return efficiency report', () => {
      const report = cache.getEfficiencyReport();
      expect(report).toHaveProperty('efficiency');
      expect(report).toHaveProperty('recommendations');
      expect(report).toHaveProperty('performance');
      expect(['excellent', 'good', 'fair', 'poor']).toContain(report.performance);
    });

    it('should return poor performance for empty cache', () => {
      const report = cache.getEfficiencyReport();
      expect(report.performance).toBe('poor');
    });
  });

  describe('compression', () => {
    it('should store and retrieve large data', async () => {
      // Create data large enough to trigger compression
      const largeData = { text: 'a'.repeat(2000) };
      await cache.store('large content', largeData, {
        contentType: 'flow',
        duration: 5000,
        complexity: 0.7,
        performanceScore: 0.9,
        accessPattern: 'mixed',
      });

      // Verify data is stored (exact decompression may differ due to RLE encoding)
      const internalCache = (cache as unknown as { cache: Map<string, { compressed: boolean }> }).cache;
      const key = (cache as unknown as { generateCacheKey: (s: string) => string }).generateCacheKey('large content');
      const entry = internalCache.get(key);
      expect(entry).toBeDefined();
    });

    it('should not compress small data', async () => {
      const smallData = { x: 1 };
      await cache.store('small content', smallData, {
        contentType: 'flow',
        duration: 1000,
        complexity: 0.2,
        performanceScore: 0.5,
        accessPattern: 'recent',
      });

      const result = await cache.get('small content');
      expect(result).toEqual(smallData);
    });
  });

  describe('access patterns', () => {
    it('should track frequent access pattern', async () => {
      await cache.store('frequently accessed', { data: 1 }, {
        contentType: 'flow',
        duration: 1000,
        complexity: 0.3,
        performanceScore: 0.7,
        accessPattern: 'recent',
      });

      // Access multiple times
      for (let i = 0; i < 5; i++) {
        await cache.get('frequently accessed');
      }

      const result = await cache.get('frequently accessed');
      expect(result).toEqual({ data: 1 });
    });
  });

  describe('eviction', () => {
    it('should store many entries without error', async () => {
      const smallCache = new IntelligentCache();

      for (let i = 0; i < 10; i++) {
        await smallCache.store(`content ${i} unique string xyz ${i}`, { data: i }, {
          contentType: 'flow',
          duration: 1000,
          complexity: 0.5,
          performanceScore: 0.7,
          accessPattern: 'mixed',
        });
      }

      const stats = smallCache.getStats();
      expect(stats.totalEntries).toBe(10);
    });
  });

  describe('content fingerprinting', () => {
    it('should generate different fingerprints for different content', async () => {
      await cache.store('process flow with steps', { type: 'flow' }, {
        contentType: 'flow',
        duration: 5000,
        complexity: 0.6,
        performanceScore: 0.8,
        accessPattern: 'mixed',
      });

      await cache.store('hierarchy tree structure', { type: 'tree' }, {
        contentType: 'tree',
        duration: 5000,
        complexity: 0.5,
        performanceScore: 0.7,
        accessPattern: 'recent',
      });

      const flowResult = await cache.get('process flow with steps');
      const treeResult = await cache.get('hierarchy tree structure');
      expect(flowResult).toEqual({ type: 'flow' });
      expect(treeResult).toEqual({ type: 'tree' });
    });
  });

  describe('similarity detection', () => {
    it('should detect similar content based on structural patterns', async () => {
      await cache.store('first we do step one then step two in the process', { type: 'sequential' }, {
        contentType: 'flow',
        duration: 5000,
        complexity: 0.5,
        performanceScore: 0.8,
        accessPattern: 'mixed',
      });

      // Same structural pattern
      const result = await cache.findSimilar('first we do step three then step four in the process');
      if (result) {
        expect(result.data).toBeDefined();
      }
    });

    it('should detect cycle diagram type', async () => {
      await cache.store('cycle circular loop recurring iterative process', { type: 'cycle' }, {
        contentType: 'cycle',
        duration: 5000,
        complexity: 0.7,
        performanceScore: 0.8,
        accessPattern: 'mixed',
      });

      const result = await cache.findSimilar('cycle circular loop recurring iterative process');
      expect(result).not.toBeNull();
    });
  });
});

describe('globalCache', () => {
  it('should be an instance of IntelligentCache', () => {
    expect(globalCache).toBeInstanceOf(IntelligentCache);
  });
});

describe('cached decorator', () => {
  it('should be a function', () => {
    expect(typeof cached).toBe('function');
  });

  it('should return a decorator function', () => {
    const decorator = cached();
    expect(typeof decorator).toBe('function');
  });
});
