import { LazyLoader } from '@/optimization/lazy-loader';

describe('LazyLoader', () => {
  let loader: LazyLoader;

  beforeEach(() => {
    loader = new LazyLoader();
  });

  describe('基本ロードとキャッシュ', () => {
    test('同じキーで2回loadすると、2回目はキャッシュから返される', async () => {
      let loadCount = 0;

      const result1 = await loader.load('mod1', async () => {
        loadCount++;
        return { name: 'module1' };
      });
      const result2 = await loader.load('mod1', async () => {
        loadCount++;
        return { name: 'module1-new' };
      });

      expect(result1).toEqual({ name: 'module1' });
      expect(result2).toEqual({ name: 'module1' });
      expect(loadCount).toBe(1);
    });

    test('異なるキーは独立してロードされる', async () => {
      const r1 = await loader.load('a', async () => 'A');
      const r2 = await loader.load('b', async () => 'B');

      expect(r1).toBe('A');
      expect(r2).toBe('B');
    });
  });

  describe('同時ロード重複排除', () => {
    test('同じキーへの同時ロード要求が1回のロードに束ねられる', async () => {
      let loadCount = 0;

      const loaderFn = async () => {
        loadCount++;
        // Simulate slow load
        await new Promise((resolve) => setTimeout(resolve, 50));
        return 'loaded';
      };

      // Fire 3 concurrent loads for the same key
      const [r1, r2, r3] = await Promise.all([
        loader.load('concurrent', loaderFn),
        loader.load('concurrent', loaderFn),
        loader.load('concurrent', loaderFn),
      ]);

      expect(r1).toBe('loaded');
      expect(r2).toBe('loaded');
      expect(r3).toBe('loaded');
      // With deduplication, should only load once
      expect(loadCount).toBe(1);
    });
  });

  describe('プリロード', () => {
    test('preload で非同期事前キャッシュが動作する', async () => {
      let loadCount = 0;

      loader.preload('preloaded', async () => {
        loadCount++;
        return 'preloaded-value';
      });

      // Wait for preload to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      const result = await loader.load('preloaded', async () => {
        loadCount++;
        return 'new-value';
      });

      expect(result).toBe('preloaded-value');
      expect(loadCount).toBe(1);
    });

    test('preload エラーは無視され、後続のloadで再試行される', async () => {
      let callCount = 0;

      loader.preload('fail-preload', async () => {
        callCount++;
        throw new Error('preload fail');
      });

      // Wait for preload to fail silently
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Subsequent load should retry
      const result = await loader.load('fail-preload', async () => {
        callCount++;
        return 'recovered';
      });

      expect(result).toBe('recovered');
      expect(callCount).toBe(2); // 1 failed preload + 1 successful load
    });
  });

  describe('無効化', () => {
    test('invalidate でキャッシュが無効化される', async () => {
      let loadCount = 0;

      await loader.load('inv', async () => {
        loadCount++;
        return 'first';
      });

      const invalidated = loader.invalidate('inv');
      expect(invalidated).toBe(true);

      const result = await loader.load('inv', async () => {
        loadCount++;
        return 'second';
      });

      expect(result).toBe('second');
      expect(loadCount).toBe(2);
    });

    test('存在しないキーの無効化は false を返す', () => {
      expect(loader.invalidate('nonexistent')).toBe(false);
    });

    test('clear で全キャッシュがクリアされる', async () => {
      await loader.load('a', async () => 'A');
      await loader.load('b', async () => 'B');

      loader.clear();

      expect(loader.isLoaded('a')).toBe(false);
      expect(loader.isLoaded('b')).toBe(false);
    });
  });

  describe('ハンドルファクトリ', () => {
    test('createHandle でカプセル化されたアクセスが提供される', async () => {
      let loadCount = 0;
      const handle = loader.createHandle('handle-mod', async () => {
        loadCount++;
        return 'handle-value';
      });

      expect(handle.isLoaded()).toBe(false);

      const result = await handle.get();
      expect(result).toBe('handle-value');
      expect(handle.isLoaded()).toBe(true);
      expect(loadCount).toBe(1);

      // Second get should use cache
      const result2 = await handle.get();
      expect(result2).toBe('handle-value');
      expect(loadCount).toBe(1);
    });

    test('handle.invalidate でハンドル経由で無効化できる', async () => {
      const handle = loader.createHandle('inv-handle', async () => 'value');
      await handle.get();

      expect(handle.invalidate()).toBe(true);
      expect(handle.isLoaded()).toBe(false);
    });
  });

  describe('統計情報', () => {
    test('loadedModules が正確に記録される', async () => {
      await loader.load('a', async () => 'A');
      await loader.load('b', async () => 'B');

      const stats = loader.getStats();
      expect(stats.loadedModules).toBe(2);
    });

    test('averageLoadTimeMs が正確に記録される', async () => {
      await loader.load('slow', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'slow-module';
      });

      const stats = loader.getStats();
      expect(stats.averageLoadTimeMs).toBeGreaterThanOrEqual(0);
      expect(stats.totalLoadTimeMs).toBeGreaterThanOrEqual(0);
    });

    test('空の統計情報', () => {
      const stats = loader.getStats();
      expect(stats.loadedModules).toBe(0);
      expect(stats.totalLoadTimeMs).toBe(0);
      expect(stats.averageLoadTimeMs).toBe(0);
    });
  });

  describe('isLoaded と getIfLoaded', () => {
    test('isLoaded でロード済みか確認できる', async () => {
      expect(loader.isLoaded('mod')).toBe(false);
      await loader.load('mod', async () => 'value');
      expect(loader.isLoaded('mod')).toBe(true);
    });

    test('getIfLoaded でロード済みモジュールを取得できる', async () => {
      expect(loader.getIfLoaded('mod')).toBeUndefined();

      await loader.load('mod', async () => 'value');
      expect(loader.getIfLoaded('mod')).toBe('value');
    });
  });
});
