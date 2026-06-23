/**
 * Memory Cache - LRU cache with TTL support
 * Provides generic in-memory caching with configurable size limits and expiration
 */

import { logger } from '@/utils/logger';

export interface CacheEntry<V> {
  value: V;
  expiresAt: number;
  createdAt: number;
  accessCount: number;
}

export interface MemoryCacheOptions {
  maxSize: number;
  defaultTtlMs: number;
  cleanupIntervalMs?: number;
}

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
}

const DEFAULT_OPTIONS: MemoryCacheOptions = {
  maxSize: 100,
  defaultTtlMs: 5 * 60 * 1000, // 5 minutes
  cleanupIntervalMs: 60 * 1000, // 1 minute
};

/**
 * Generic LRU Memory Cache with TTL expiration
 *
 * Uses a Map to maintain insertion order for LRU eviction.
 * Entries expire based on configurable TTL and are lazily cleaned up.
 */
export class MemoryCache<V> {
  private cache: Map<string, CacheEntry<V>> = new Map();
  private readonly maxSize: number;
  private readonly defaultTtlMs: number;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(options: Partial<MemoryCacheOptions> = {}) {
    const resolved = { ...DEFAULT_OPTIONS, ...options };
    this.maxSize = resolved.maxSize;
    this.defaultTtlMs = resolved.defaultTtlMs;

    if (resolved.cleanupIntervalMs && resolved.cleanupIntervalMs > 0) {
      this.cleanupTimer = setInterval(
        () => {
          try {
            this.cleanup();
          } catch (err) {
            logger.error('[MemoryCache] Cleanup tick failed:', err);
          }
        },
        resolved.cleanupIntervalMs
      );
    }
  }

  /**
   * Retrieve a value from cache if it exists and has not expired.
   * Refreshes the entry position in the LRU order on hit.
   */
  get(key: string): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    entry.accessCount++;
    this.cache.set(key, entry);
    this.hits++;
    return entry.value;
  }

  /**
   * Store a value in the cache with an optional TTL override.
   * Evicts the least recently used entry if the cache is at capacity.
   */
  set(key: string, value: V, ttlMs?: number): void {
    // Remove existing entry to refresh position
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict LRU entries if at capacity
    while (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
        this.evictions++;
      }
    }

    const now = Date.now();
    this.cache.set(key, {
      value,
      expiresAt: now + (ttlMs ?? this.defaultTtlMs),
      createdAt: now,
      accessCount: 0,
    });
  }

  /**
   * Check if a non-expired entry exists for the given key.
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Manually remove an entry from the cache.
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Remove all entries from the cache.
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  /**
   * Get a cached value or compute and cache it if missing.
   */
  async getOrCompute(key: string, compute: () => Promise<V>, ttlMs?: number): Promise<V> {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const value = await compute();
    this.set(key, value, ttlMs);
    return value;
  }

  /**
   * Remove all expired entries from the cache.
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }
    return removed;
  }

  /**
   * Return cache statistics for monitoring.
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
      evictions: this.evictions,
    };
  }

  /**
   * Stop the cleanup timer. Call when the cache is no longer needed.
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clear();
  }
}
