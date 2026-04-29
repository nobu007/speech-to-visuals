import {
  ComputationCache,
  ComputationCacheOptions,
} from '@/optimization/computation-cache';

describe('ComputationCache', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('基本キャッシュ動作', () => {
    test('同じキーで2回呼び出すと、2回目はキャッシュから返される', async () => {
      const cache = new ComputationCache();
      let callCount = 0;

      const result1 = await cache.getOrCompute('key1', async () => {
        callCount++;
        return 'value1';
      });
      const result2 = await cache.getOrCompute('key1', async () => {
        callCount++;
        return 'value1-new';
      });

      expect(result1).toBe('value1');
      expect(result2).toBe('value1');
      expect(callCount).toBe(1);
    });

    test('同期版 getOrComputeSync もキャッシュが動作する', () => {
      const cache = new ComputationCache();
      let callCount = 0;

      const result1 = cache.getOrComputeSync('key1', () => {
        callCount++;
        return 42;
      });
      const result2 = cache.getOrComputeSync('key1', () => {
        callCount++;
        return 99;
      });

      expect(result1).toBe(42);
      expect(result2).toBe(42);
      expect(callCount).toBe(1);
    });

    test('異なるキーは独立してキャッシュされる', async () => {
      const cache = new ComputationCache();

      const r1 = await cache.getOrCompute('a', async () => 'A');
      const r2 = await cache.getOrCompute('b', async () => 'B');

      expect(r1).toBe('A');
      expect(r2).toBe('B');
      expect(cache.getStats().size).toBe(2);
    });
  });

  describe('TTL有効期限', () => {
    test('TTL期限切れのエントリは再計算される', async () => {
      const cache = new ComputationCache({ ttlMs: 1000 });
      let callCount = 0;

      await cache.getOrCompute('key', async () => {
        callCount++;
        return 'fresh';
      });
      expect(callCount).toBe(1);

      // TTL expires
      jest.advanceTimersByTime(1001);

      const result = await cache.getOrCompute('key', async () => {
        callCount++;
        return 'refreshed';
      });

      expect(result).toBe('refreshed');
      expect(callCount).toBe(2);
    });

    test('TTL期限内はキャッシュが有効', async () => {
      const cache = new ComputationCache({ ttlMs: 10000 });
      let callCount = 0;

      await cache.getOrCompute('key', async () => {
        callCount++;
        return 'value';
      });

      jest.advanceTimersByTime(5000);

      await cache.getOrCompute('key', async () => {
        callCount++;
        return 'new';
      });

      expect(callCount).toBe(1); // Should not recompute
    });
  });

  describe('タグベース無効化', () => {
    test('同じタグの全エントリが一括無効化される', async () => {
      const cache = new ComputationCache();

      await cache.getOrCompute('k1', async () => 'v1', ['tag-a']);
      await cache.getOrCompute('k2', async () => 'v2', ['tag-a']);
      await cache.getOrCompute('k3', async () => 'v3', ['tag-b']);

      const removed = cache.invalidateByTag('tag-a');

      expect(removed).toBe(2);
      expect(cache.getStats().size).toBe(1);
    });

    test('存在しないタグは0を返す', () => {
      const cache = new ComputationCache();
      expect(cache.invalidateByTag('nonexistent')).toBe(0);
    });
  });

  describe('LRU退行', () => {
    test('最大エントリ数超過時、最も古いエントリが退行される', async () => {
      const cache = new ComputationCache({ maxSize: 3 });

      await cache.getOrCompute('k1', async () => 'v1');
      await cache.getOrCompute('k2', async () => 'v2');
      await cache.getOrCompute('k3', async () => 'v3');
      // Exceeds capacity - should evict oldest
      await cache.getOrCompute('k4', async () => 'v4');

      const stats = cache.getStats();
      expect(stats.size).toBe(3);
      expect(stats.evictions).toBeGreaterThanOrEqual(1);
    });
  });

  describe('個別無効化', () => {
    test('invalidate で特定キーが削除される', async () => {
      const cache = new ComputationCache();
      await cache.getOrCompute('k1', async () => 'v1');

      expect(cache.invalidate('k1')).toBe(true);
      expect(cache.getStats().size).toBe(0);
    });

    test('存在しないキーは false を返す', () => {
      const cache = new ComputationCache();
      expect(cache.invalidate('nonexistent')).toBe(false);
    });
  });

  describe('invalidateWhere', () => {
    test('条件に一致するエントリが削除される', async () => {
      const cache = new ComputationCache();
      await cache.getOrCompute('keep', async () => 'v1');
      await cache.getOrCompute('remove-me', async () => 'v2');

      const removed = cache.invalidateWhere((key) => key.startsWith('remove'));

      expect(removed).toBe(1);
      expect(cache.getStats().size).toBe(1);
    });
  });

  describe('clear と getStats', () => {
    test('clear で全統計がリセットされる', async () => {
      const cache = new ComputationCache();
      await cache.getOrCompute('k1', async () => 'v1');
      await cache.getOrCompute('k1', async () => 'v1'); // hit

      cache.clear();

      const stats = cache.getStats();
      expect(stats.size).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.evictions).toBe(0);
    });

    test('統計情報が正確に記録される', async () => {
      const cache = new ComputationCache({ maxSize: 5 });

      await cache.getOrCompute('k1', async () => 'v1'); // miss
      await cache.getOrCompute('k1', async () => 'v1'); // hit
      await cache.getOrCompute('k2', async () => 'v2'); // miss
      await cache.getOrCompute('missing', async () => 'v3'); // miss

      const stats = cache.getStats();
      expect(stats.size).toBe(3);
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(3); // k1 miss, k2 miss, missing miss
    });
  });
});
