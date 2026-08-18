/**
 * Cache Warmup Strategy for LLM Semantic Cache
 *
 * REQ-202: When the cache is in a cold-start state, execute a warmup strategy
 * to pre-populate the cache with representative query patterns, and track
 * hit rate improvement over time.
 *
 * Features:
 * - Cold-start detection based on configurable entry count threshold
 * - Pre-population with common query patterns (default + custom)
 * - Hit rate tracking before and after warmup
 * - Warmup statistics for monitoring effectiveness
 */

import { LLMCache } from '@/analysis/llm-cache';
import { logger } from '@stv/core/utils/logger';

/**
 * Represents a query pattern used for cache warmup
 */
export interface WarmupPattern {
  /** The query text to pre-populate */
  text: string;
  /** Category of the pattern (e.g., 'tutorial', 'algorithm', 'architecture') */
  category: string;
  /** Language of the query */
  language: 'en' | 'ja';
}

/**
 * Result of a warmup execution
 */
export interface WarmupResult {
  /** Number of patterns processed */
  patternsProcessed: number;
  /** Number of successfully cached patterns */
  successCount: number;
  /** Number of failed patterns */
  failureCount: number;
  /** Time taken for warmup in milliseconds */
  durationMs: number;
  /** Hit rate before warmup (0-1) */
  hitRateBefore: number;
  /** Hit rate after warmup simulation (0-1) */
  hitRateAfter: number;
}

/**
 * Cumulative warmup statistics
 */
export interface WarmupStats {
  /** Total number of warmup executions */
  totalWarmups: number;
  /** Total patterns processed across all warmups */
  totalPatternsProcessed: number;
  /** Total successful pattern resolutions */
  totalSuccesses: number;
  /** Total failed pattern resolutions */
  totalFailures: number;
}

/**
 * Hit rate report showing warmup effectiveness
 */
export interface HitRateReport {
  /** Hit rate before warmup (0-1) */
  hitRateBefore: number;
  /** Hit rate after warmup (0-1) */
  hitRateAfterWarmup: number;
  /** Number of queries executed after warmup */
  queriesAfterWarmup: number;
  /** Number of cache hits after warmup */
  hitsAfterWarmup: number;
  /** Absolute improvement in hit rate (0-1) */
  improvement: number;
}

/**
 * Configuration options for the CacheWarmupManager
 */
export interface WarmupOptions {
  /** Minimum number of entries required to not be considered cold-start (default: 5) */
  coldStartThreshold?: number;
}

/**
 * Default warmup patterns covering common query categories
 * in both English and Japanese.
 */
const DEFAULT_WARMUP_PATTERNS: WarmupPattern[] = [
  // Sequential / tutorial patterns
  {
    text: 'First, we need to understand the basic concepts. Next, we will explore the implementation details.',
    category: 'tutorial',
    language: 'en',
  },
  {
    text: 'The algorithm starts by initializing variables. Then it processes each element in the input array.',
    category: 'algorithm',
    language: 'en',
  },
  {
    text: 'The architecture follows a layered approach. The presentation layer handles user interactions.',
    category: 'architecture',
    language: 'en',
  },
  {
    text: 'The process begins with customer request submission. The request is validated and assigned to a team.',
    category: 'workflow',
    language: 'en',
  },
  {
    text: 'The research team formulated a hypothesis. They designed experiments to test the hypothesis.',
    category: 'research',
    language: 'en',
  },
  // Japanese patterns
  {
    text: 'まず、基本的な概念を理解する必要があります。次に、実装の詳細を探求します。',
    category: 'tutorial',
    language: 'ja',
  },
  {
    text: 'アルゴリズムは変数の初期化から始まります。その後、入力配列の各要素を処理します。',
    category: 'algorithm',
    language: 'ja',
  },
  {
    text: 'システムは3つのサブシステムで構成されています。第1のサブシステムはデータ入力と検証を処理します。',
    category: 'architecture',
    language: 'ja',
  },
];

const DEFAULT_COLD_START_THRESHOLD = 5;

/**
 * CacheWarmupManager handles cold-start detection and cache warmup strategy.
 *
 * It wraps an LLMCache instance and provides methods to:
 * 1. Detect cold-start state (cache has fewer entries than threshold)
 * 2. Execute warmup by resolving patterns and populating the cache
 * 3. Track hit rate improvements before and after warmup
 */
export class CacheWarmupManager<T> {
  private cache: LLMCache<T>;
  private coldStartThreshold: number;
  private warmupPatterns: WarmupPattern[] = [];
  private hitRateBeforeWarmup: number = 0;
  private queriesAfterWarmup: number = 0;
  private hitsAfterWarmup: number = 0;
  private warmupStats: WarmupStats = {
    totalWarmups: 0,
    totalPatternsProcessed: 0,
    totalSuccesses: 0,
    totalFailures: 0,
  };

  constructor(cache: LLMCache<T>, options: WarmupOptions = {}) {
    this.cache = cache;
    this.coldStartThreshold = options.coldStartThreshold ?? DEFAULT_COLD_START_THRESHOLD;
  }

  /**
   * Check if the cache is in a cold-start state.
   * A cache is considered cold if it has fewer valid entries than the threshold.
   */
  isColdStart(): boolean {
    const stats = this.cache.getStats();
    return stats.validEntries < this.coldStartThreshold;
  }

  /**
   * Get the default warmup patterns.
   */
  getDefaultPatterns(): WarmupPattern[] {
    return [...DEFAULT_WARMUP_PATTERNS];
  }

  /**
   * Set the warmup patterns to use for warmupIfCold.
   */
  setWarmupPatterns(patterns: WarmupPattern[]): void {
    this.warmupPatterns = [...patterns];
  }

  /**
   * Execute warmup only if the cache is in a cold-start state.
   *
   * @param resolver - Function that resolves a query text to a cached result
   * @returns true if warmup was executed, false if skipped
   */
  async warmupIfCold(resolver: (text: string) => Promise<T>): Promise<boolean> {
    if (!this.isColdStart()) {
      return false;
    }

    const patterns = this.warmupPatterns.length > 0
      ? this.warmupPatterns
      : this.getDefaultPatterns();

    await this.warmup(patterns, resolver);
    return true;
  }

  /**
   * Execute warmup with the given patterns.
   *
   * @param patterns - Array of warmup patterns to resolve and cache
   * @param resolver - Function that resolves a query text to a cached result
   * @returns WarmupResult with statistics about the warmup execution
   */
  async warmup(
    patterns: WarmupPattern[],
    resolver: (text: string) => Promise<T>
  ): Promise<WarmupResult> {
    const startTime = Date.now();

    // Record hit rate before warmup
    this.hitRateBeforeWarmup = this.getCurrentHitRate();

    let successCount = 0;
    let failureCount = 0;

    for (const pattern of patterns) {
      try {
        // Check if already cached to avoid redundant resolution
        const existing = this.cache.get(pattern.text);
        if (existing !== null) {
          successCount++;
          continue;
        }

        // Resolve and cache
        const result = await resolver(pattern.text);
        this.cache.set(pattern.text, result);
        successCount++;
      } catch (err) {
        logger.error('[CacheWarmup] Failed to warm pattern:', { pattern: pattern.text, error: err instanceof Error ? err.message : String(err) });
        failureCount++;
      }
    }

    const durationMs = Date.now() - startTime;

    // Update cumulative stats
    this.warmupStats.totalWarmups++;
    this.warmupStats.totalPatternsProcessed += patterns.length;
    this.warmupStats.totalSuccesses += successCount;
    this.warmupStats.totalFailures += failureCount;

    // Reset post-warmup tracking
    this.queriesAfterWarmup = 0;
    this.hitsAfterWarmup = 0;

    return {
      patternsProcessed: patterns.length,
      successCount,
      failureCount,
      durationMs,
      hitRateBefore: this.hitRateBeforeWarmup,
      hitRateAfter: 0, // Will be updated as queries come in
    };
  }

  /**
   * Record a query result for hit rate tracking after warmup.
   * Call this after each query to track improvement.
   */
  recordQuery(wasHit: boolean): void {
    this.queriesAfterWarmup++;
    if (wasHit) this.hitsAfterWarmup++;
  }

  /**
   * Get the hit rate report showing warmup effectiveness.
   */
  getHitRateReport(): HitRateReport {
    const currentHitRate = this.queriesAfterWarmup > 0
      ? this.hitsAfterWarmup / this.queriesAfterWarmup
      : 0;

    return {
      hitRateBefore: this.hitRateBeforeWarmup,
      hitRateAfterWarmup: currentHitRate,
      queriesAfterWarmup: this.queriesAfterWarmup,
      hitsAfterWarmup: this.hitsAfterWarmup,
      improvement: currentHitRate - this.hitRateBeforeWarmup,
    };
  }

  /**
   * Get cumulative warmup statistics.
   */
  getWarmupStats(): WarmupStats {
    return { ...this.warmupStats };
  }

  /**
   * Get current cache hit rate from the underlying LLMCache.
   */
  private getCurrentHitRate(): number {
    const stats = this.cache.getStats();
    const semantic = stats.semantic;
    const totalRequests = semantic.exactHits + semantic.semanticHits + semantic.misses;
    if (totalRequests === 0) return 0;
    return (semantic.exactHits + semantic.semanticHits) / totalRequests;
  }
}
