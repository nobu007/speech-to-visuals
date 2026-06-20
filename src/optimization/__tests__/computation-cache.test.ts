import { ComputationCache } from '../computation-cache';

describe('ComputationCache', () => {
  let cache: ComputationCache;

  beforeEach(() => {
    cache = new ComputationCache({ maxSize: 5, ttlMs: 1000 });
  });

  describe('getOrCompute', () => {
    it('caches computed values', async () => {
      let calls = 0;
      const compute = async () => { calls++; return `result-${calls}`; };

      expect(await cache.getOrCompute('k1', compute)).toBe('result-1');
      expect(await cache.getOrCompute('k1', compute)).toBe('result-1');
      expect(calls).toBe(1);
    });

    it('computes on cache miss', async () => {
      expect(await cache.getOrCompute('k1', async () => 'a')).toBe('a');
      expect(await cache.getOrCompute('k2', async () => 'b')).toBe('b');
    });
  });

  describe('getOrComputeSync', () => {
    it('caches sync computed values', () => {
      let calls = 0;
      const compute = () => { calls++; return 42; };

      expect(cache.getOrComputeSync('k1', compute)).toBe(42);
      expect(cache.getOrComputeSync('k1', compute)).toBe(42);
      expect(calls).toBe(1);
    });
  });

  describe('TTL expiry', () => {
    it('expires entries after TTL', async () => {
      const shortTtl = new ComputationCache({ ttlMs: 50 });
      await shortTtl.getOrCompute('k1', async () => 'val');

      await new Promise(r => setTimeout(r, 60));

      let calls = 0;
      await shortTtl.getOrCompute('k1', async () => { calls++; return 'val2'; });
      expect(calls).toBe(1);
    });
  });

  describe('invalidate', () => {
    it('removes a specific entry', async () => {
      await cache.getOrCompute('k1', async () => 'val');
      expect(cache.invalidate('k1')).toBe(true);
      expect(cache.invalidate('k1')).toBe(false);
    });

    it('cleans up tag index on invalidate', async () => {
      await cache.getOrCompute('k1', async () => 'v1', ['tag-a']);
      await cache.getOrCompute('k2', async () => 'v2', ['tag-a']);

      cache.invalidate('k1');

      // invalidateByTag should only remove k2, not error on stale k1 ref
      const removed = cache.invalidateByTag('tag-a');
      expect(removed).toBe(1);
    });

    it('removes empty tag sets from index on invalidate', async () => {
      await cache.getOrCompute('k1', async () => 'v1', ['solo-tag']);
      cache.invalidate('k1');

      // Tag should be cleaned up — invalidateByTag returns 0 for non-existent tag
      expect(cache.invalidateByTag('solo-tag')).toBe(0);
    });
  });

  describe('invalidateByTag', () => {
    it('removes all entries with matching tag', async () => {
      await cache.getOrCompute('k1', async () => 'v1', ['group']);
      await cache.getOrCompute('k2', async () => 'v2', ['group']);
      await cache.getOrCompute('k3', async () => 'v3', ['other']);

      const removed = cache.invalidateByTag('group');
      expect(removed).toBe(2);
    });

    it('returns 0 for unknown tag', () => {
      expect(cache.invalidateByTag('nonexistent')).toBe(0);
    });
  });

  describe('invalidateWhere', () => {
    it('removes entries matching predicate', async () => {
      await cache.getOrCompute('key-1', async () => 'v1', ['t1']);
      await cache.getOrCompute('key-2', async () => 'v2', ['t1']);

      const removed = cache.invalidateWhere((key) => key === 'key-1');
      expect(removed).toBe(1);

      // After invalidateWhere, tag index should be cleaned up
      expect(cache.invalidateByTag('t1')).toBe(1); // only key-2 remains
    });
  });

  describe('eviction cleans tag index', () => {
    it('removes tag references when evicting oldest entries', async () => {
      const small = new ComputationCache({ maxSize: 2 });

      await small.getOrCompute('k1', async () => 'v1', ['shared']);
      await small.getOrCompute('k2', async () => 'v2', ['shared']);
      // k3 triggers eviction of k1
      await small.getOrCompute('k3', async () => 'v3', []);

      // tag 'shared' should only reference k2 now (k1 was evicted)
      const removed = small.invalidateByTag('shared');
      expect(removed).toBe(1);
    });
  });

  describe('TTL expiry cleans tag index', () => {
    it('removes tag references when TTL expires', async () => {
      const shortTtl = new ComputationCache({ ttlMs: 30, maxSize: 10 });
      await shortTtl.getOrCompute('k1', async () => 'v1', ['expiring']);
      await shortTtl.getOrCompute('k2', async () => 'v2', ['expiring']);

      // Wait for TTL to expire
      await new Promise(r => setTimeout(r, 40));

      // Access k1 — triggers TTL deletion + tag cleanup
      shortTtl.getOrComputeSync('k1', () => 'recomputed');

      // k2 should also expire on access, but tag should not have stale k1 ref
      const removed = shortTtl.invalidateByTag('expiring');
      // k2 was never re-accessed so it might still be in cache (but expired)
      // After invalidateByTag processes, k2 (if still cached) gets removed
      expect(removed).toBeLessThanOrEqual(1);
    });
  });

  describe('clear', () => {
    it('clears everything and resets stats', async () => {
      await cache.getOrCompute('k1', async () => 'v1', ['tag']);
      cache.clear();

      expect(cache.getStats().size).toBe(0);
      expect(cache.getStats().hits).toBe(0);
      expect(cache.getStats().misses).toBe(0);
      expect(cache.invalidateByTag('tag')).toBe(0);
    });
  });

  describe('getStats', () => {
    it('tracks hits and misses', async () => {
      await cache.getOrCompute('k1', async () => 'v1');

      const stats1 = cache.getStats();
      expect(stats1.size).toBe(1);
      expect(stats1.misses).toBe(1);

      await cache.getOrCompute('k1', async () => 'v1');
      const stats2 = cache.getStats();
      expect(stats2.hits).toBe(1);
    });

    it('tracks evictions', async () => {
      const tiny = new ComputationCache({ maxSize: 1 });
      await tiny.getOrCompute('k1', async () => 'v1');
      await tiny.getOrCompute('k2', async () => 'v2');

      expect(tiny.getStats().evictions).toBe(1);
    });

    it('tracks totalComputeTimeMs', async () => {
      await cache.getOrCompute('k1', async () => {
        await new Promise(r => setTimeout(r, 5));
        return 'v1';
      });

      expect(cache.getStats().totalComputeTimeMs).toBeGreaterThan(0);
    });
  });
});
