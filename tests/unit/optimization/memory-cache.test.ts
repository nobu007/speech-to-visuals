import { MemoryCache } from '@/optimization/memory-cache';

describe('MemoryCache', () => {
  let cache: MemoryCache<string>;

  beforeEach(() => {
    jest.useFakeTimers();
    cache = new MemoryCache<string>({ maxSize: 5, defaultTtlMs: 60000, cleanupIntervalMs: 0 });
  });

  afterEach(() => {
    cache.destroy();
    jest.useRealTimers();
  });

  describe('基本動作', () => {
    test('set/get で値が正しく格納・取得される', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    test('存在しないキーは undefined を返す', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    test('has でキーの存在確認ができる', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('nonexistent')).toBe(false);
    });

    test('delete でキーが削除される', () => {
      cache.set('key1', 'value1');
      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeUndefined();
    });

    test('clear で全エントリが削除される', () => {
      cache.set('a', '1');
      cache.set('b', '2');
      cache.clear();
      expect(cache.getStats().size).toBe(0);
    });
  });

  describe('TTL有効期限', () => {
    test('TTL期限切れのエントリは取得できない', () => {
      const shortCache = new MemoryCache<string>({
        maxSize: 10,
        defaultTtlMs: 1000,
        cleanupIntervalMs: 0,
      });

      shortCache.set('key', 'value');
      expect(shortCache.get('key')).toBe('value');

      jest.advanceTimersByTime(1001);
      expect(shortCache.get('key')).toBeUndefined();
      shortCache.destroy();
    });

    test('カスタムTTLで個別に期限設定ができる', () => {
      cache.set('short', 'value', 500);
      cache.set('long', 'value', 5000);

      jest.advanceTimersByTime(501);

      expect(cache.get('short')).toBeUndefined();
      expect(cache.get('long')).toBe('value');
    });

    test('has もTTL期限切れを正しく判定する', () => {
      cache.set('key', 'value', 1000);
      jest.advanceTimersByTime(1001);
      expect(cache.has('key')).toBe(false);
    });
  });

  describe('LRU退行', () => {
    test('最大サイズ超過時、最も古いエントリが退行される', () => {
      cache.set('a', '1');
      cache.set('b', '2');
      cache.set('c', '3');
      cache.set('d', '4');
      cache.set('e', '5');
      // maxSize is 5, next set should evict 'a'
      cache.set('f', '6');

      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('f')).toBe('6');
      expect(cache.getStats().evictions).toBeGreaterThanOrEqual(1);
    });

    test('アクセスされるとLRU順序が更新される', () => {
      cache.set('a', '1');
      cache.set('b', '2');
      cache.set('c', '3');
      cache.set('d', '4');
      cache.set('e', '5');

      // Access 'a' to move it to the end (most recently used)
      cache.get('a');

      // Now 'b' should be the LRU entry
      cache.set('f', '6');

      expect(cache.get('a')).toBe('1'); // Should still exist
      expect(cache.get('b')).toBeUndefined(); // Should be evicted
    });
  });

  describe('定期クリーンアップ', () => {
    test('クリーンアップで期限切れエントリが削除される', () => {
      const timedCache = new MemoryCache<string>({
        maxSize: 10,
        defaultTtlMs: 1000,
        cleanupIntervalMs: 2000,
      });

      timedCache.set('expired', 'value');
      jest.advanceTimersByTime(1001);

      const removed = timedCache.cleanup();
      expect(removed).toBe(1);
      expect(timedCache.getStats().size).toBe(0);
      timedCache.destroy();
    });
  });

  describe('ヒット率統計', () => {
    test('ヒット・ミス・ヒット率が正確に記録される', () => {
      cache.set('key1', 'value1');

      cache.get('key1'); // hit
      cache.get('key1'); // hit
      cache.get('missing'); // miss

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(2 / 3);
    });

    test('クリアで統計がリセットされる', () => {
      cache.set('key', 'value');
      cache.get('key');

      cache.clear();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
      expect(stats.evictions).toBe(0);
    });

    test('空キャッシュのヒット率は0', () => {
      expect(cache.getStats().hitRate).toBe(0);
    });
  });

  describe('getOrCompute', () => {
    test('キャッシュミス時にcomputeが呼ばれる', async () => {
      let computeCount = 0;

      const result = await cache.getOrCompute('key', async () => {
        computeCount++;
        return 'computed';
      });

      expect(result).toBe('computed');
      expect(computeCount).toBe(1);
    });

    test('キャッシュヒット時にcomputeが呼ばれない', async () => {
      let computeCount = 0;

      cache.set('key', 'cached');

      const result = await cache.getOrCompute('key', async () => {
        computeCount++;
        return 'computed';
      });

      expect(result).toBe('cached');
      expect(computeCount).toBe(0);
    });
  });

  describe('destroy', () => {
    test('destroy でクリーンアップタイマーが停止される', () => {
      const timedCache = new MemoryCache<string>({
        maxSize: 10,
        defaultTtlMs: 5000,
        cleanupIntervalMs: 1000,
      });

      timedCache.set('key', 'value');
      timedCache.destroy();

      // After destroy, cache should be cleared
      expect(timedCache.getStats().size).toBe(0);
    });
  });
});
