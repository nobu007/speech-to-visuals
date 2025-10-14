/**
 * Intelligent caching layer for LLM responses
 * - Reduces redundant API calls
 * - Memory-efficient with TTL and size limits
 * - Hash-based key generation for consistent lookups
 * - Persistent file-based storage for cross-session efficiency
 * - Semantic similarity matching for fuzzy cache hits (Phase 17)
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { calculateSemanticSimilarity, SemanticMetricsTracker } from './semantic-similarity';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  hits: number;
  originalText?: string; // Store original text for semantic matching
}

export class LLMCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private maxSize: number;
  private ttlMs: number;
  private persistPath?: string;
  private persistEnabled: boolean;
  private semanticThreshold: number;
  private semanticEnabled: boolean;
  private semanticMetrics: SemanticMetricsTracker;

  constructor(options: {
    maxSize?: number;
    ttlMinutes?: number;
    persistPath?: string;
    semanticThreshold?: number;
    enableSemantic?: boolean;
  } = {}) {
    this.maxSize = options.maxSize ?? 100;
    this.ttlMs = (options.ttlMinutes ?? 60) * 60 * 1000;
    this.persistPath = options.persistPath;
    this.persistEnabled = Boolean(this.persistPath);
    this.semanticThreshold = options.semanticThreshold ?? 0.80; // 80% similarity threshold
    this.semanticEnabled = options.enableSemantic ?? true;
    this.semanticMetrics = new SemanticMetricsTracker();

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
   * Now with semantic similarity fallback for fuzzy matching
   */
  get(text: string, prefix?: string): T | null {
    const key = this.generateKey(text, prefix);
    const entry = this.cache.get(key);

    // Exact match found
    if (entry && this.isValid(entry)) {
      entry.hits++;
      this.semanticMetrics.recordExactHit();
      return entry.data;
    }

    // Clean up invalid entry if exists
    if (entry && !this.isValid(entry)) {
      this.cache.delete(key);
    }

    // Try semantic similarity matching if enabled
    if (this.semanticEnabled) {
      return this.getSemanticMatch(text, prefix);
    }

    this.semanticMetrics.recordMiss();
    return null;
  }

  /**
   * Find semantically similar cached entry
   * @private
   */
  private getSemanticMatch(text: string, prefix?: string): T | null {
    const normalized = text.trim().toLowerCase().slice(0, 2000);
    let bestMatch: { entry: CacheEntry<T>; similarity: number } | null = null;

    // Iterate through all valid cache entries
    for (const [cachedKey, entry] of this.cache.entries()) {
      // Skip if wrong prefix or expired
      if (prefix && !cachedKey.startsWith(`${prefix}:`)) continue;
      if (!this.isValid(entry)) continue;
      if (!entry.originalText) continue;

      this.semanticMetrics.recordComparison();

      // Calculate similarity
      const similarity = calculateSemanticSimilarity(normalized, entry.originalText);

      // Update best match if this is better
      if (similarity >= this.semanticThreshold) {
        if (!bestMatch || similarity > bestMatch.similarity) {
          bestMatch = { entry, similarity };
        }
      }
    }

    // Return best match if found
    if (bestMatch) {
      bestMatch.entry.hits++;
      this.semanticMetrics.recordSemanticHit(bestMatch.similarity);
      console.log(`🔍 Semantic cache hit (similarity: ${(bestMatch.similarity * 100).toFixed(1)}%)`);
      return bestMatch.entry.data;
    }

    this.semanticMetrics.recordMiss();
    return null;
  }

  /**
   * Store result in cache
   * Now stores original text for semantic matching
   */
  set(text: string, data: T, prefix?: string): void {
    this.evictOldest();

    const key = this.generateKey(text, prefix);
    const normalized = text.trim().toLowerCase().slice(0, 2000);

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      hits: 0,
      originalText: this.semanticEnabled ? normalized : undefined,
    });

    // Persist to disk if enabled
    if (this.persistEnabled) {
      this.saveToDisk();
    }
  }

  /**
   * Get cache statistics
   * Now includes semantic matching metrics
   */
  getStats() {
    const entries = Array.from(this.cache.values());
    const validEntries = entries.filter(e => this.isValid(e));
    const totalHits = entries.reduce((sum, e) => sum + e.hits, 0);
    const semanticMetrics = this.semanticMetrics.getMetrics();

    const totalRequests = semanticMetrics.exactHits + semanticMetrics.semanticHits + semanticMetrics.misses;
    const overallHitRate = totalRequests > 0
      ? ((semanticMetrics.exactHits + semanticMetrics.semanticHits) / totalRequests) * 100
      : 0;

    return {
      size: this.cache.size,
      validEntries: validEntries.length,
      totalHits,
      avgHitsPerEntry: entries.length > 0 ? totalHits / entries.length : 0,
      hitRate: totalHits > 0 ? (totalHits / (totalHits + entries.length)) * 100 : 0,
      semantic: {
        enabled: this.semanticEnabled,
        threshold: this.semanticThreshold,
        exactHits: semanticMetrics.exactHits,
        semanticHits: semanticMetrics.semanticHits,
        misses: semanticMetrics.misses,
        overallHitRate,
        avgSimilarityScore: semanticMetrics.avgSimilarityScore,
        totalComparisons: semanticMetrics.totalComparisons,
      },
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
        version: '2.0', // Updated version for semantic cache support
        timestamp: Date.now(),
        entries: Array.from(this.cache.entries()).map(([key, entry]) => ({
          key,
          data: entry.data,
          timestamp: entry.timestamp,
          hits: entry.hits,
          originalText: entry.originalText,
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

      // Support both v1.0 (without semantic) and v2.0 (with semantic)
      if (parsed.version !== '1.0' && parsed.version !== '2.0') {
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
          originalText: entry.originalText, // May be undefined for v1.0 caches
        };

        if (this.isValid(cacheEntry)) {
          this.cache.set(entry.key, cacheEntry);
          loadedCount++;
        } else {
          expiredCount++;
        }
      }

      const semanticSupport = parsed.version === '2.0' ? ' (with semantic support)' : '';
      console.log(`💾 Loaded ${loadedCount} cached LLM entries from disk${semanticSupport} (${expiredCount} expired, discarded)`);

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
