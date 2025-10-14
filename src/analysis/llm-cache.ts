/**
 * Intelligent caching layer for LLM responses
 * - Reduces redundant API calls
 * - Memory-efficient with TTL and size limits
 * - Hash-based key generation for consistent lookups
 */

import crypto from 'crypto';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  hits: number;
}

export class LLMCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private maxSize: number;
  private ttlMs: number;

  constructor(options: { maxSize?: number; ttlMinutes?: number } = {}) {
    this.maxSize = options.maxSize ?? 100;
    this.ttlMs = (options.ttlMinutes ?? 60) * 60 * 1000;
  }

  /**
   * Generate a stable cache key from input text
   */
  private generateKey(text: string, prefix: string = ''): string {
    const normalized = text.trim().toLowerCase().slice(0, 2000);
    const hash = crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
    return prefix ? `${prefix}:${hash}` : hash;
  }

  /**
   * Check if entry is still valid
   */
  private isValid(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp < this.ttlMs;
  }

  /**
   * Evict oldest entries when cache is full
   */
  private evictOldest(): void {
    if (this.cache.size < this.maxSize) return;

    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Get cached result if available and valid
   */
  get(text: string, prefix?: string): T | null {
    const key = this.generateKey(text, prefix);
    const entry = this.cache.get(key);

    if (!entry) return null;

    if (!this.isValid(entry)) {
      this.cache.delete(key);
      return null;
    }

    entry.hits++;
    return entry.data;
  }

  /**
   * Store result in cache
   */
  set(text: string, data: T, prefix?: string): void {
    this.evictOldest();

    const key = this.generateKey(text, prefix);
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      hits: 0,
    });
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const entries = Array.from(this.cache.values());
    const validEntries = entries.filter(e => this.isValid(e));
    const totalHits = entries.reduce((sum, e) => sum + e.hits, 0);

    return {
      size: this.cache.size,
      validEntries: validEntries.length,
      totalHits,
      avgHitsPerEntry: entries.length > 0 ? totalHits / entries.length : 0,
      hitRate: totalHits > 0 ? (totalHits / (totalHits + entries.length)) * 100 : 0,
    };
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Clear expired entries
   */
  clearExpired(): void {
    for (const [key, entry] of this.cache.entries()) {
      if (!this.isValid(entry)) {
        this.cache.delete(key);
      }
    }
  }
}
