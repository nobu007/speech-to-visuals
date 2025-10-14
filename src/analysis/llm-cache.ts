/**
 * Intelligent caching layer for LLM responses
 * - Reduces redundant API calls
 * - Memory-efficient with TTL and size limits
 * - Hash-based key generation for consistent lookups
 * - Persistent file-based storage for cross-session efficiency
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  hits: number;
}

export class LLMCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private maxSize: number;
  private ttlMs: number;
  private persistPath?: string;
  private persistEnabled: boolean;

  constructor(options: { maxSize?: number; ttlMinutes?: number; persistPath?: string } = {}) {
    this.maxSize = options.maxSize ?? 100;
    this.ttlMs = (options.ttlMinutes ?? 60) * 60 * 1000;
    this.persistPath = options.persistPath;
    this.persistEnabled = Boolean(this.persistPath);

    // Load persisted cache on initialization
    if (this.persistEnabled) {
      this.loadFromDisk();
    }
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

    // Persist to disk if enabled
    if (this.persistEnabled) {
      this.saveToDisk();
    }
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

    if (this.persistEnabled) {
      this.saveToDisk();
    }
  }

  /**
   * Save cache to disk (persistent storage)
   */
  private saveToDisk(): void {
    if (!this.persistPath) return;

    try {
      // Ensure cache directory exists
      const cacheDir = path.dirname(this.persistPath);
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }

      // Convert Map to serializable object
      const serializable = {
        version: '1.0',
        timestamp: Date.now(),
        entries: Array.from(this.cache.entries()).map(([key, entry]) => ({
          key,
          data: entry.data,
          timestamp: entry.timestamp,
          hits: entry.hits,
        })),
      };

      // Write to disk atomically (write to temp file, then rename)
      const tempPath = `${this.persistPath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(serializable, null, 2), 'utf8');
      fs.renameSync(tempPath, this.persistPath);

    } catch (error) {
      console.warn('⚠️  Failed to persist LLM cache to disk:', error);
    }
  }

  /**
   * Load cache from disk (persistent storage)
   */
  private loadFromDisk(): void {
    if (!this.persistPath) return;

    try {
      if (!fs.existsSync(this.persistPath)) {
        return; // No cache file yet, start fresh
      }

      const content = fs.readFileSync(this.persistPath, 'utf8');
      const parsed = JSON.parse(content);

      // Validate version
      if (parsed.version !== '1.0') {
        console.warn('⚠️  Cache version mismatch, starting fresh');
        return;
      }

      // Load entries and filter expired ones
      let loadedCount = 0;
      let expiredCount = 0;

      for (const entry of parsed.entries) {
        const cacheEntry: CacheEntry<T> = {
          data: entry.data,
          timestamp: entry.timestamp,
          hits: entry.hits,
        };

        if (this.isValid(cacheEntry)) {
          this.cache.set(entry.key, cacheEntry);
          loadedCount++;
        } else {
          expiredCount++;
        }
      }

      console.log(`💾 Loaded ${loadedCount} cached LLM entries from disk (${expiredCount} expired, discarded)`);

    } catch (error) {
      console.warn('⚠️  Failed to load LLM cache from disk:', error);
    }
  }

  /**
   * Manually trigger cache persistence
   */
  persist(): void {
    if (this.persistEnabled) {
      this.saveToDisk();
    }
  }
}
