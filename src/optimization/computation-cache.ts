/**
 * Computation Cache - Memoization with cache invalidation
 * Caches results of expensive computations with flexible invalidation strategies
 */

export interface ComputationCacheOptions {
  /** Maximum number of entries in the cache */
  maxSize?: number;
  /** Time-to-live in milliseconds for cached entries */
  ttlMs?: number;
}

export interface CacheMeta {
  createdAt: number;
  accessCount: number;
  computeTimeMs: number;
}

export interface ComputationCacheStats {
  size: number;
  hits: number;
  misses: number;
  evictions: number;
  totalComputeTimeMs: number;
}

type ComputationKey = string;

const DEFAULT_MAX_SIZE = 200;
const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Computation result cache for expensive operations.
 *
 * Provides memoization with configurable size limits, TTL-based expiration,
 * and explicit invalidation by key or tag.
 */
export class ComputationCache {
  private cache: Map<ComputationKey, { value: unknown; meta: CacheMeta }> = new Map();
  private tagIndex: Map<string, Set<ComputationKey>> = new Map();
  private readonly maxSize: number;
  private readonly ttlMs: number;
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private totalComputeTimeMs = 0;

  constructor(options: ComputationCacheOptions = {}) {
    this.maxSize = options.maxSize ?? DEFAULT_MAX_SIZE;
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  }

  /**
   * Get a cached result or compute and store it.
   *
   * The key function computes the cache key from the input arguments,
   * and the compute function produces the value when a cache miss occurs.
   */
  async getOrCompute<T>(
    key: ComputationKey,
    compute: () => Promise<T>,
    tags?: string[]
  ): Promise<T> {
    const cached = this.getInternal<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const start = performance.now();
    const value = await compute();
    const computeTimeMs = performance.now() - start;
    this.totalComputeTimeMs += computeTimeMs;

    this.setInternal(key, value, computeTimeMs, tags);
    return value;
  }

  /**
   * Synchronous version for pure computation functions.
   */
  getOrComputeSync<T>(
    key: ComputationKey,
    compute: () => T,
    tags?: string[]
  ): T {
    const cached = this.getInternal<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const start = performance.now();
    const value = compute();
    const computeTimeMs = performance.now() - start;
    this.totalComputeTimeMs += computeTimeMs;

    this.setInternal(key, value, computeTimeMs, tags);
    return value;
  }

  private getInternal<T>(key: ComputationKey): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }

    const now = Date.now();
    if (now - entry.meta.createdAt > this.ttlMs) {
      this.cache.delete(key);
      this.removeFromTagIndex(key);
      this.misses++;
      return undefined;
    }

    entry.meta.accessCount++;
    this.hits++;
    return entry.value as T;
  }

  private setInternal<T>(
    key: ComputationKey,
    value: T,
    computeTimeMs: number,
    tags?: string[]
  ): void {
    // Evict oldest entry if at capacity
    while (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
        this.removeFromTagIndex(oldestKey);
        this.evictions++;
      }
    }

    this.cache.set(key, {
      value,
      meta: {
        createdAt: Date.now(),
        accessCount: 0,
        computeTimeMs,
      },
    });

    // Register tags for group invalidation
    if (tags) {
      for (const tag of tags) {
        let keys = this.tagIndex.get(tag);
        if (!keys) {
          keys = new Set();
          this.tagIndex.set(tag, keys);
        }
        keys.add(key);
      }
    }
  }

  /**
   * Invalidate a specific cache entry by key.
   */
  invalidate(key: ComputationKey): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.removeFromTagIndex(key);
    }
    return deleted;
  }

  /**
   * Invalidate all entries associated with a given tag.
   * Returns the number of entries removed.
   */
  invalidateByTag(tag: string): number {
    const keys = this.tagIndex.get(tag);
    if (!keys) return 0;

    let removed = 0;
    for (const key of keys) {
      if (this.cache.delete(key)) {
        removed++;
      }
    }
    this.tagIndex.delete(tag);
    return removed;
  }

  /**
   * Invalidate entries matching a predicate function.
   * Returns the number of entries removed.
   */
  invalidateWhere(predicate: (key: string, meta: CacheMeta) => boolean): number {
    let removed = 0;
    for (const [key, entry] of this.cache) {
      if (predicate(key, entry.meta)) {
        this.cache.delete(key);
        this.removeFromTagIndex(key);
        removed++;
      }
    }
    return removed;
  }

  /**
   * Clear all cached entries and tags.
   */
  clear(): void {
    this.cache.clear();
    this.tagIndex.clear();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    this.totalComputeTimeMs = 0;
  }

  /**
   * Remove a key from all tag index entries.
   * Called whenever a cache entry is deleted to prevent stale tag references.
   */
  private removeFromTagIndex(key: ComputationKey): void {
    for (const [tag, keys] of this.tagIndex) {
      keys.delete(key);
      if (keys.size === 0) {
        this.tagIndex.delete(tag);
      }
    }
  }

  /**
   * Return cache statistics.
   */
  getStats(): ComputationCacheStats {
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      totalComputeTimeMs: this.totalComputeTimeMs,
    };
  }
}
