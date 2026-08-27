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
import { logger } from '@stv/core/utils/logger';
import { reportCorruption } from '@stv/core/utils/report-corruption';
import { sanitizeUntrustedJsonValue } from './llm-utils';

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
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private debounceMs: number;

  constructor(options: {
    maxSize?: number;
    ttlMinutes?: number;
    persistPath?: string;
    semanticThreshold?: number;
    enableSemantic?: boolean;
    /** Debounce interval in ms for disk persistence (default: 1000). Set 0 for immediate writes. */
    persistDebounceMs?: number;
  } = {}) {
    this.maxSize = options.maxSize ?? 100;
    this.ttlMs = (options.ttlMinutes ?? 60) * 60 * 1000;
    this.persistPath = options.persistPath;
    this.persistEnabled = Boolean(this.persistPath);
    this.semanticThreshold = options.semanticThreshold ?? 0.80; // 80% similarity threshold
    this.semanticEnabled = options.enableSemantic ?? true;
    this.semanticMetrics = new SemanticMetricsTracker();
    this.debounceMs = options.persistDebounceMs ?? 1000;

    // Load persisted cache on initialization
    if (this.persistEnabled) {
      this.loadFromDisk();
    }
  }

  /**
   * Generate a stable cache key from input text.
   *
   * The hash is taken over the FULL normalized text — never a truncated prefix.
   * The earlier `slice(0, 2000)` made two distinct inputs that shared a long
   * common prefix collapse onto a single slot, so a lookup for one returned the
   * other's data. This bit the GeminiAnalyzer path in particular: it forwards
   * its full-text key `gemini-analyzer-v26:${text}` here, and that 21-char
   * prefix meant only the first ~1979 chars of a real transcript reached the
   * hash — the same prefix-truncation class as buildAnalyzerCacheKey (f6d5dc43),
   * surviving at the storage layer that the analyzer's own injectivity test
   * never exercised. sha256 streams over arbitrary length at negligible cost,
   * and buildAnalyzerCacheKey relies on exactly this full-text hashing.
   *
   * (The OUTPUT hex is sliced to 16 chars / 64 bits — a deliberate, fixed
   * shortening of the digest, astronomically unlikely to collide at this
   * cache's scale. Only the INPUT must not be truncated.)
   */
  // `protected` (not `private`) so test subclasses can install a mutation witness
  // (see tests/guards/llm-cache-namespace-mutation-witness.test.ts). The internal
  // key-mixing algorithm MUST not be silently bypassed by a future refactor —
  // namespace isolation is the contract INV-CACHE-001 pins.
  protected generateKey(text: string, prefix: string = ''): string {
    const normalized = text.trim().toLowerCase();
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
   * Evict oldest-timestamp entries until the cache holds at most `targetSize`
   * entries.
   *
   * Single canonical eviction routine. `set()` makes room for one new entry by
   * trimming to `maxSize - 1`; `loadFromDisk()` re-enforces the `maxSize` cap
   * after bulk-loading. Trimming by oldest timestamp matches the per-entry
   * policy, and looping (rather than removing a single entry) lets an over-cap
   * state self-heal — the previous single-evict form could only ever remove one
   * entry per call, so a cache ever loaded past its cap stayed past its cap
   * permanently (each `set()` was net-zero at best).
   */
  private evictToSize(targetSize: number): void {
    while (this.cache.size > targetSize) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;

      for (const [key, entry] of this.cache.entries()) {
        if (entry.timestamp < oldestTime) {
          oldestTime = entry.timestamp;
          oldestKey = key;
        }
      }

      if (!oldestKey) break;
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Make room for one new entry: trim to `maxSize - 1`.
   */
  private evictOldest(): void {
    this.evictToSize(this.maxSize - 1);
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

    // Schedule debounced persist to disk
    if (this.persistEnabled) {
      this.scheduleSave();
    }
  }

  /**
   * Get cache statistics
   * Now includes semantic matching metrics
   */
  getStats() {
    const entries = Array.from(this.cache.values());
    const validEntries = entries.filter(e => this.isValid(e));
    const totalHits = entries.reduce((sum, e) => sum + (Number.isFinite(e.hits) ? e.hits : 0), 0);
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
      this.scheduleSave();
    }
  }

  /**
   * Schedule a debounced save-to-disk.
   * Coalesces rapid successive set() calls into a single disk write.
   */
  private scheduleSave(): void {
    if (this.debounceMs <= 0) {
      this.saveToDisk();
      return;
    }
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.saveToDisk();
    }, this.debounceMs);
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
      logger.warn('Failed to persist LLM cache to disk:', error);
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
      // The cache file round-trips LLM-derived data and may be a legacy/tampered
      // artifact on disk, so sanitize at the read boundary: drop prototype-
      // pollution keys and neutralize non-finite numbers (1e400 → Infinity).
      const parsed = sanitizeUntrustedJsonValue(JSON.parse(content)) as {
        version?: string;
        entries?: Array<{ key: string; data: unknown; timestamp: number; hits: number; originalText?: string }>;
      };

      // Support both v1.0 (without semantic) and v2.0 (with semantic)
      if (parsed.version !== '1.0' && parsed.version !== '2.0') {
        logger.warn('Cache version mismatch, starting fresh');
        return;
      }

      // Load entries and filter expired ones
      let loadedCount = 0;
      let expiredCount = 0;

      for (const entry of parsed.entries ?? []) {
        const cacheEntry: CacheEntry<T> = {
          data: entry.data as T,
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

      // Re-enforce the maxSize cap on the bulk-loaded set. The primary set()
      // path maintains the cap one entry at a time, but the loop above inserts
      // every valid disk entry with no cap check — so a persisted file holding
      // more entries than the configured maxSize (e.g. after the cap was
      // lowered) would otherwise leave the cache over its cap. evictToSize
      // keeps the newest entries by timestamp, matching the per-entry policy.
      this.evictToSize(this.maxSize);

      const semanticSupport = parsed.version === '2.0' ? ' (with semantic support)' : '';

    } catch (error) {
      reportCorruption('LLMCache', `Failed to load cache from disk: ${String(error)}`);
    }
  }

  /**
   * Manually trigger cache persistence (immediate, cancels any pending debounced save)
   */
  persist(): void {
    if (this.persistEnabled) {
      if (this.saveTimer !== null) {
        clearTimeout(this.saveTimer);
        this.saveTimer = null;
      }
      this.saveToDisk();
    }
  }

  /**
   * Cancel pending debounced saves and release resources.
   * Call this when disposing of the cache instance.
   */
  destroy(): void {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }
}
