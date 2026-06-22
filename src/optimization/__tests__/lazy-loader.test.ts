/**
 * Tests for LazyLoader.
 *
 * Verifies lazy module loading, caching, concurrent deduplication,
 * preload, invalidation, statistics, and handle creation.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { LazyLoader } from '../lazy-loader';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createDelayedLoader<T>(value: T, delayMs = 0): {
  loader: () => Promise<T>;
  callCount: () => number;
} {
  let count = 0;
  return {
    loader: () => {
      count++;
      return new Promise<T>((resolve) => {
        setTimeout(() => resolve(value), delayMs);
      });
    },
    callCount: () => count,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LazyLoader', () => {
  let loader: LazyLoader;

  beforeEach(() => {
    loader = new LazyLoader();
  });

  // --- Basic loading ---

  it('should load a module on first call', async () => {
    const result = await loader.load('key1', async () => ({ value: 42 }));
    expect(result).toEqual({ value: 42 });
  });

  it('should cache loaded modules', async () => {
    const { loader: fn, callCount } = createDelayedLoader({ data: 'hello' });
    const r1 = await loader.load('key1', fn);
    const r2 = await loader.load('key1', fn);

    expect(r1).toEqual({ data: 'hello' });
    expect(r2).toEqual({ data: 'hello' });
    expect(callCount()).toBe(1); // Loader only called once
  });

  it('should return the same cached object reference', async () => {
    const mod = { value: 'test' };
    const r1 = await loader.load('key1', async () => mod);
    const r2 = await loader.load('key1', async () => ({ value: 'different' }));
    expect(r1).toBe(mod);
    expect(r2).toBe(mod);
  });

  // --- Concurrent deduplication ---

  it('should deduplicate concurrent loads for the same key', async () => {
    const { loader: fn, callCount } = createDelayedLoader({ data: 'shared' }, 10);
    const [r1, r2, r3] = await Promise.all([
      loader.load('concurrent', fn),
      loader.load('concurrent', fn),
      loader.load('concurrent', fn),
    ]);

    expect(r1).toEqual({ data: 'shared' });
    expect(r2).toEqual({ data: 'shared' });
    expect(r3).toEqual({ data: 'shared' });
    expect(callCount()).toBe(1);
  });

  // --- isLoaded / getIfLoaded ---

  it('should report isLoaded correctly', async () => {
    expect(loader.isLoaded('key1')).toBe(false);
    await loader.load('key1', async () => 1);
    expect(loader.isLoaded('key1')).toBe(true);
    expect(loader.isLoaded('key2')).toBe(false);
  });

  it('should return cached module from getIfLoaded', async () => {
    expect(loader.getIfLoaded('key1')).toBeUndefined();
    await loader.load('key1', async () => ({ x: 1 }));
    expect(loader.getIfLoaded('key1')).toEqual({ x: 1 });
  });

  // --- Preload ---

  it('should preload modules without blocking', async () => {
    const { loader: fn, callCount } = createDelayedLoader({ preloaded: true }, 5);

    loader.preload('pre', fn);
    // Immediately after preload, may or may not be loaded yet
    // Wait a tick for preload to complete
    await new Promise(r => setTimeout(r, 20));

    expect(loader.isLoaded('pre')).toBe(true);
    expect(callCount()).toBe(1);

    // Subsequent load should use cache
    const result = await loader.load('pre', fn);
    expect(result).toEqual({ preloaded: true });
    expect(callCount()).toBe(1);
  });

  it('should not preload if already cached', async () => {
    const { loader: fn, callCount } = createDelayedLoader('first');
    await loader.load('key1', fn);
    expect(callCount()).toBe(1);

    loader.preload('key1', fn);
    await new Promise(r => setTimeout(r, 10));
    expect(callCount()).toBe(1);
  });

  // --- Invalidation ---

  it('should invalidate a specific key', async () => {
    const { loader: fn, callCount } = createDelayedLoader({ v: 1 });
    await loader.load('key1', fn);
    expect(callCount()).toBe(1);

    const invalidated = loader.invalidate('key1');
    expect(invalidated).toBe(true);
    expect(loader.isLoaded('key1')).toBe(false);

    // Next load should call loader again
    await loader.load('key1', fn);
    expect(callCount()).toBe(2);
  });

  it('should return false when invalidating non-existent key', () => {
    expect(loader.invalidate('nonexistent')).toBe(false);
  });

  // --- Clear ---

  it('should clear all cached modules', async () => {
    await loader.load('a', async () => 1);
    await loader.load('b', async () => 2);
    expect(loader.isLoaded('a')).toBe(true);

    loader.clear();
    expect(loader.isLoaded('a')).toBe(false);
    expect(loader.isLoaded('b')).toBe(false);
  });

  // --- Statistics ---

  it('should track loaded module count', async () => {
    expect(loader.getStats().loadedModules).toBe(0);
    await loader.load('a', async () => 1);
    await loader.load('b', async () => 2);
    expect(loader.getStats().loadedModules).toBe(2);
  });

  it('should track total load time', async () => {
    await loader.load('a', async () => {
      await new Promise(r => setTimeout(r, 5));
      return 1;
    });
    const stats = loader.getStats();
    expect(stats.totalLoadTimeMs).toBeGreaterThan(0);
    expect(stats.averageLoadTimeMs).toBeGreaterThan(0);
  });

  it('should compute average load time', async () => {
    await loader.load('a', async () => 1);
    await loader.load('b', async () => 2);
    const stats = loader.getStats();
    expect(stats.loadedModules).toBe(2);
    expect(stats.averageLoadTimeMs).toBeCloseTo(stats.totalLoadTimeMs / 2, 1);
  });

  it('should reset stats on clear', async () => {
    await loader.load('a', async () => 1);
    loader.clear();
    expect(loader.getStats().loadedModules).toBe(0);
    expect(loader.getStats().totalLoadTimeMs).toBe(0);
  });

  // --- Handle creation ---

  it('should create a reusable handle', async () => {
    const handle = loader.createHandle('handled', async () => ({ data: 'handled' }));

    expect(handle.isLoaded()).toBe(false);
    const result = await handle.get();
    expect(result).toEqual({ data: 'handled' });
    expect(handle.isLoaded()).toBe(true);

    // Second call uses cache
    const result2 = await handle.get();
    expect(result2).toEqual({ data: 'handled' });
  });

  it('should support handle invalidation', async () => {
    let version = 1;
    const handle = loader.createHandle('versioned', async () => ({ v: version }));

    const r1 = await handle.get();
    expect(r1.v).toBe(1);

    version = 2;
    handle.invalidate();
    expect(handle.isLoaded()).toBe(false);

    const r2 = await handle.get();
    expect(r2.v).toBe(2);
  });

  // --- Error handling (preload) ---

  it('should silently handle preload failures', async () => {
    loader.preload('fail', async () => {
      throw new Error('preload failed');
    });
    // Wait for the rejected promise to settle
    await new Promise(r => setTimeout(r, 10));
    // Should not be loaded, should not throw
    expect(loader.isLoaded('fail')).toBe(false);
  });

  // --- Multiple keys ---

  it('should handle multiple independent keys', async () => {
    await loader.load('x', async () => 'xxx');
    await loader.load('y', async () => 'yyy');
    await loader.load('z', async () => 'zzz');

    expect(loader.getIfLoaded<string>('x')).toBe('xxx');
    expect(loader.getIfLoaded<string>('y')).toBe('yyy');
    expect(loader.getIfLoaded<string>('z')).toBe('zzz');
    expect(loader.getStats().loadedModules).toBe(3);
  });
});
