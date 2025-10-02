/**
 * Smart Cache Manager - Advanced Optimization Module
 * Implements intelligent caching with predictive pre-loading and memory optimization
 * Following iterative improvement philosophy from instructions
 */

export interface CacheEntry<T> {
  key: string;
  data: T;
  timestamp: number;
  accessCount: number;
  size: number;
  metadata: Record<string, any>;
}

export interface CacheMetrics {
  hitRate: number;
  missRate: number;
  totalRequests: number;
  memoryUsage: number;
  averageAccessTime: number;
  predictiveAccuracy: number;
}

export class SmartCacheManager {
  private cache = new Map<string, CacheEntry<any>>();
  private accessHistory = new Map<string, number[]>();
  private maxMemoryMB: number;
  private maxAge: number;
  private iteration: number = 1;

  // Metrics tracking
  private hits = 0;
  private misses = 0;
  private predictions = new Map<string, { predicted: boolean; actual: boolean }>();

  constructor(config: {
    maxMemoryMB?: number;
    maxAgeMs?: number;
    enablePredictive?: boolean;
  } = {}) {
    this.maxMemoryMB = config.maxMemoryMB || 256;
    this.maxAge = config.maxAgeMs || 30 * 60 * 1000; // 30 minutes

    // Start periodic cleanup
    this.startMaintenanceLoop();

    console.log(`[Smart Cache V${this.iteration}] Initialized with ${this.maxMemoryMB}MB limit`);
  }

  /**
   * Iteration 1: Basic cache with smart eviction
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (entry && this.isValid(entry)) {
      // Update access patterns
      entry.accessCount++;
      this.updateAccessHistory(key);
      this.hits++;

      console.log(`[Cache V${this.iteration}] HIT: ${key} (${entry.accessCount} accesses)`);
      return entry.data as T;
    }

    this.misses++;
    console.log(`[Cache V${this.iteration}] MISS: ${key}`);
    return null;
  }

  /**
   * Store data with intelligent metadata
   */
  async set<T>(key: string, data: T, metadata: Record<string, any> = {}): Promise<void> {
    const size = this.estimateSize(data);

    // Check memory constraints
    await this.ensureMemoryAvailable(size);

    const entry: CacheEntry<T> = {
      key,
      data,
      timestamp: Date.now(),
      accessCount: 1,
      size,
      metadata
    };

    this.cache.set(key, entry);
    this.updateAccessHistory(key);

    console.log(`[Cache V${this.iteration}] STORE: ${key} (${(size / 1024).toFixed(1)}KB)`);
  }

  /**
   * Iteration 2+: Predictive pre-loading based on access patterns
   */
  async predictAndPreload(currentKey: string, generateData: (key: string) => Promise<any>): Promise<void> {
    if (this.iteration < 2) return;

    console.log(`[Cache V${this.iteration}] Analyzing predictive patterns for: ${currentKey}`);

    const predictedKeys = this.predictNextAccess(currentKey);

    for (const predictedKey of predictedKeys) {
      if (!this.cache.has(predictedKey)) {
        try {
          console.log(`[Cache V${this.iteration}] Pre-loading predicted: ${predictedKey}`);
          const data = await generateData(predictedKey);
          await this.set(predictedKey, data, { predicted: true });

          // Track prediction accuracy
          this.predictions.set(predictedKey, { predicted: true, actual: false });
        } catch (error) {
          console.warn(`[Cache V${this.iteration}] Pre-load failed for ${predictedKey}:`, error.message);
        }
      }
    }
  }

  /**
   * Predict next likely access based on patterns
   */
  private predictNextAccess(currentKey: string): string[] {
    const history = this.accessHistory.get(currentKey) || [];
    const predictions: string[] = [];

    // Simple pattern: look for keys accessed after this one historically
    const recentAccesses = Array.from(this.accessHistory.entries())
      .filter(([key]) => key !== currentKey)
      .sort(([, times1], [, times2]) => {
        const recent1 = Math.max(...times1);
        const recent2 = Math.max(...times2);
        return recent2 - recent1;
      })
      .slice(0, 3)
      .map(([key]) => key);

    return recentAccesses;
  }

  /**
   * Memory management with smart eviction
   */
  private async ensureMemoryAvailable(requiredSize: number): Promise<void> {
    const currentMemory = this.getCurrentMemoryUsage();
    const maxBytes = this.maxMemoryMB * 1024 * 1024;

    if (currentMemory + requiredSize > maxBytes) {
      console.log(`[Cache V${this.iteration}] Memory limit approached, running smart eviction...`);

      // Smart eviction strategy: LRU with access pattern consideration
      const entries = Array.from(this.cache.values())
        .sort((a, b) => {
          // Score based on age, access count, and prediction accuracy
          const scoreA = this.calculateEvictionScore(a);
          const scoreB = this.calculateEvictionScore(b);
          return scoreA - scoreB; // Lower score = higher eviction priority
        });

      let freedMemory = 0;
      let evicted = 0;

      for (const entry of entries) {
        if (currentMemory - freedMemory + requiredSize <= maxBytes) break;

        this.cache.delete(entry.key);
        freedMemory += entry.size;
        evicted++;
      }

      console.log(`[Cache V${this.iteration}] Evicted ${evicted} entries, freed ${(freedMemory / 1024).toFixed(1)}KB`);
    }
  }

  /**
   * Calculate eviction priority score (lower = evict first)
   */
  private calculateEvictionScore(entry: CacheEntry<any>): number {
    const age = Date.now() - entry.timestamp;
    const ageScore = Math.min(age / this.maxAge, 1); // 0-1, higher = older
    const accessScore = 1 / (1 + entry.accessCount); // 0-1, higher = less accessed
    const sizeScore = entry.size / (1024 * 1024); // MB, higher = larger

    // Prediction bonus
    const isPredicted = entry.metadata.predicted === true;
    const predictionBonus = isPredicted ? -0.2 : 0; // Negative = keep longer

    return ageScore * 0.4 + accessScore * 0.4 + sizeScore * 0.1 + predictionBonus;
  }

  /**
   * Maintenance and optimization
   */
  private startMaintenanceLoop(): void {
    setInterval(() => {
      this.runMaintenance();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  private runMaintenance(): void {
    const before = this.cache.size;
    const expired = [];

    // Remove expired entries
    for (const [key, entry] of this.cache.entries()) {
      if (!this.isValid(entry)) {
        expired.push(key);
      }
    }

    expired.forEach(key => this.cache.delete(key));

    // Update prediction accuracy
    this.updatePredictionAccuracy();

    if (expired.length > 0) {
      console.log(`[Cache V${this.iteration}] Maintenance: Removed ${expired.length} expired entries`);
    }

    // Log metrics every 10 maintenance cycles
    if (Math.random() < 0.1) {
      this.logMetrics();
    }
  }

  private updatePredictionAccuracy(): void {
    for (const [key, prediction] of this.predictions.entries()) {
      if (this.cache.has(key)) {
        prediction.actual = true;
      }
    }
  }

  /**
   * Utility methods
   */
  private isValid(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp < this.maxAge;
  }

  private updateAccessHistory(key: string): void {
    const history = this.accessHistory.get(key) || [];
    history.push(Date.now());

    // Keep only recent history
    const recentHistory = history.slice(-10);
    this.accessHistory.set(key, recentHistory);
  }

  private estimateSize(data: any): number {
    try {
      return new Blob([JSON.stringify(data)]).size;
    } catch {
      return 1024; // 1KB fallback
    }
  }

  private getCurrentMemoryUsage(): number {
    return Array.from(this.cache.values())
      .reduce((total, entry) => total + entry.size, 0);
  }

  /**
   * Metrics and evaluation
   */
  getMetrics(): CacheMetrics {
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? this.hits / totalRequests : 0;
    const missRate = 1 - hitRate;

    // Calculate prediction accuracy
    const predictions = Array.from(this.predictions.values());
    const correctPredictions = predictions.filter(p => p.predicted && p.actual).length;
    const predictiveAccuracy = predictions.length > 0 ? correctPredictions / predictions.length : 0;

    return {
      hitRate,
      missRate,
      totalRequests,
      memoryUsage: this.getCurrentMemoryUsage(),
      averageAccessTime: 0, // Would need performance monitoring
      predictiveAccuracy
    };
  }

  private logMetrics(): void {
    const metrics = this.getMetrics();
    console.log('\n📊 Smart Cache Metrics:');
    console.log(`- Hit Rate: ${(metrics.hitRate * 100).toFixed(1)}%`);
    console.log(`- Memory Usage: ${(metrics.memoryUsage / 1024 / 1024).toFixed(1)}MB`);
    console.log(`- Predictive Accuracy: ${(metrics.predictiveAccuracy * 100).toFixed(1)}%`);
    console.log(`- Total Requests: ${metrics.totalRequests}`);
  }

  /**
   * Iteration management
   */
  nextIteration(): void {
    this.iteration++;
    console.log(`🔄 Smart Cache moving to iteration ${this.iteration}`);

    // Reset some metrics for fresh evaluation
    this.predictions.clear();
  }

  /**
   * Advanced cache warming for known patterns
   */
  async warmCache(patterns: string[], generateData: (key: string) => Promise<any>): Promise<void> {
    console.log(`[Cache V${this.iteration}] Warming cache with ${patterns.length} patterns...`);

    const warmingPromises = patterns.map(async pattern => {
      if (!this.cache.has(pattern)) {
        try {
          const data = await generateData(pattern);
          await this.set(pattern, data, { warmed: true });
        } catch (error) {
          console.warn(`Cache warming failed for ${pattern}:`, error.message);
        }
      }
    });

    await Promise.all(warmingPromises);
    console.log(`[Cache V${this.iteration}] Cache warming completed`);
  }

  /**
   * Clear cache (useful for testing iterations)
   */
  clear(): void {
    this.cache.clear();
    this.accessHistory.clear();
    this.predictions.clear();
    this.hits = 0;
    this.misses = 0;
    console.log(`[Cache V${this.iteration}] Cache cleared for fresh iteration`);
  }
}

export const smartCache = new SmartCacheManager({
  maxMemoryMB: 256,
  maxAgeMs: 30 * 60 * 1000, // 30 minutes
  enablePredictive: true
});