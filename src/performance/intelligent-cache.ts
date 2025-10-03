/**
 * Iteration 22: Ultra-High Performance Intelligent Caching System
 *
 * Advanced caching mechanism with optimized algorithms for maximum
 * performance, memory efficiency, and intelligent content matching.
 * Includes LRU eviction, compression, and predictive preloading.
 */

import { DiagramType, ContentSegment, EntityNode, EntityEdge } from '@/types/diagram';

interface CacheEntry {
  id: string;
  contentHash: string;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  data: any;
  compressed: boolean;
  compressedSize: number;
  priority: number; // For LRU-W (Weighted) algorithm
  metadata: {
    contentType: DiagramType;
    duration: number;
    complexity: number;
    performanceScore: number;
    accessPattern: 'frequent' | 'recent' | 'mixed' | 'cold';
  };
}

interface CacheStats {
  totalEntries: number;
  hitRate: number;
  missRate: number;
  averageRetrievalTime: number;
  totalSavedTime: number;
  memoryUsage: number;
  compressionRatio: number;
  evictionCount: number;
  preloadHits: number;
  performanceScore: number;
}

interface ContentFingerprint {
  structuralPattern: string;
  keywordVector: number[];
  semanticSignature: string;
  diagramTypeHint: DiagramType;
  complexity: number;
}

/**
 * Advanced intelligent caching system with similarity detection
 */
export class IntelligentCache {
  private cache: Map<string, CacheEntry> = new Map();
  private fingerprints: Map<string, ContentFingerprint> = new Map();
  private accessOrder: string[] = []; // For LRU tracking
  private preloadQueue: Set<string> = new Set(); // Predictive preloading
  private compressionEnabled = true;
  private stats: CacheStats = {
    totalEntries: 0,
    hitRate: 0,
    missRate: 0,
    averageRetrievalTime: 0,
    totalSavedTime: 0,
    memoryUsage: 0,
    compressionRatio: 0,
    evictionCount: 0,
    preloadHits: 0,
    performanceScore: 0
  };

  private readonly maxSize = 1000;
  private readonly maxAge = 24 * 60 * 60 * 1000; // 24 hours
  private readonly similarityThreshold = 0.85;
  private readonly compressionThreshold = 1024; // 1KB minimum for compression
  private readonly preloadThreshold = 0.7; // Similarity threshold for preloading

  /**
   * Compress data using simple LZ-like compression for memory efficiency
   */
  private compressData(data: any): { compressed: string; originalSize: number; compressedSize: number } {
    const jsonString = JSON.stringify(data);
    const originalSize = jsonString.length;

    if (originalSize < this.compressionThreshold) {
      return {
        compressed: jsonString,
        originalSize,
        compressedSize: originalSize
      };
    }

    // Simple run-length encoding for demonstration
    // In production, use a proper compression library like lz-string
    let compressed = '';
    let count = 1;
    let current = jsonString[0];

    for (let i = 1; i < jsonString.length; i++) {
      if (jsonString[i] === current && count < 255) {
        count++;
      } else {
        if (count > 3) {
          compressed += `${current}${String.fromCharCode(255)}${String.fromCharCode(count)}`;
        } else {
          compressed += current.repeat(count);
        }
        current = jsonString[i];
        count = 1;
      }
    }

    if (count > 3) {
      compressed += `${current}${String.fromCharCode(255)}${String.fromCharCode(count)}`;
    } else {
      compressed += current.repeat(count);
    }

    return {
      compressed,
      originalSize,
      compressedSize: compressed.length
    };
  }

  /**
   * Decompress data
   */
  private decompressData(compressed: string, originalSize: number): any {
    if (compressed.length === originalSize) {
      return JSON.parse(compressed);
    }

    // Simple run-length decoding
    let decompressed = '';
    let i = 0;

    while (i < compressed.length) {
      if (i + 2 < compressed.length && compressed.charCodeAt(i + 1) === 255) {
        const char = compressed[i];
        const count = compressed.charCodeAt(i + 2);
        decompressed += char.repeat(count);
        i += 3;
      } else {
        decompressed += compressed[i];
        i++;
      }
    }

    return JSON.parse(decompressed);
  }

  /**
   * Calculate entry priority for LRU-W algorithm with enhanced optimization
   */
  private calculatePriority(entry: CacheEntry): number {
    const now = Date.now();
    const age = (now - entry.timestamp) / this.maxAge;
    const recency = (now - entry.lastAccessed) / (60 * 60 * 1000); // Hours since last access
    const frequency = Math.log(entry.accessCount + 1);
    const performance = entry.metadata.performanceScore;

    // Enhanced priority calculation with access pattern consideration
    const accessPatternMultiplier = this.getAccessPatternMultiplier(entry.metadata.accessPattern);
    const complexityBonus = Math.min(entry.metadata.complexity * 0.15, 0.15); // Bonus for complex content
    const compressionBonus = entry.compressed ? 0.05 : 0; // Bonus for compressed entries

    // Optimized weighted priority: recency (35%), frequency (25%), performance (20%),
    // access pattern (10%), complexity (5%), compression (3%), age (2%)
    return Math.min(1.0, (
      (1 - Math.min(recency / 12, 1)) * 0.35 + // Reduced time window for better recency detection
      Math.min(frequency / 4, 1) * 0.25 + // Adjusted frequency curve
      performance * 0.20 +
      accessPatternMultiplier * 0.10 +
      complexityBonus +
      compressionBonus +
      (1 - age) * 0.02
    ));
  }

  /**
   * Get access pattern multiplier for priority calculation
   */
  private getAccessPatternMultiplier(pattern: 'frequent' | 'recent' | 'mixed' | 'cold'): number {
    switch (pattern) {
      case 'frequent': return 1.0;
      case 'recent': return 0.8;
      case 'mixed': return 0.9;
      case 'cold': return 0.3;
      default: return 0.5;
    }
  }

  /**
   * Update access order for LRU tracking
   */
  private updateAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  /**
   * Enhanced predictive preloading with intelligent selection
   */
  private async predictivePreload(fingerprint: ContentFingerprint): Promise<void> {
    if (this.preloadQueue.size > 15) { // Increased queue size for better performance
      // Intelligent queue management: remove least valuable preloads
      this.optimizePreloadQueue();
      return;
    }

    const candidates: Array<{key: string; similarity: number; priority: number}> = [];

    // Collect and evaluate candidates more efficiently
    for (const [key, cachedFingerprint] of this.fingerprints.entries()) {
      if (this.preloadQueue.has(key)) continue;

      const similarity = this.calculateSimilarity(fingerprint, cachedFingerprint);
      if (similarity > this.preloadThreshold && similarity < this.similarityThreshold) {
        const entry = this.cache.get(key);
        if (entry) {
          const priority = this.calculatePriority(entry);
          candidates.push({ key, similarity, priority });
        }
      }
    }

    // Sort by combined similarity and priority score
    candidates
      .sort((a, b) => (b.similarity * 0.6 + b.priority * 0.4) - (a.similarity * 0.6 + a.priority * 0.4))
      .slice(0, 5) // Take top 5 candidates
      .forEach(candidate => {
        this.preloadQueue.add(candidate.key);

        // Enhanced preloading: update entry metadata for better tracking
        const entry = this.cache.get(candidate.key);
        if (entry) {
          entry.metadata.accessPattern = this.determineAccessPattern(entry);
          entry.priority = this.calculatePriority(entry); // Recalculate with latest data
        }
      });
  }

  /**
   * Optimize preload queue by removing least valuable entries
   */
  private optimizePreloadQueue(): void {
    const queueEntries = Array.from(this.preloadQueue)
      .map(key => {
        const entry = this.cache.get(key);
        return {
          key,
          priority: entry ? this.calculatePriority(entry) : 0
        };
      })
      .sort((a, b) => a.priority - b.priority); // Sort by priority (lowest first)

    // Remove lowest priority entries to make room
    const toRemove = queueEntries.slice(0, 5);
    toRemove.forEach(item => this.preloadQueue.delete(item.key));
  }

  /**
   * Determine access pattern for intelligent caching
   */
  private determineAccessPattern(entry: CacheEntry): 'frequent' | 'recent' | 'mixed' | 'cold' {
    const now = Date.now();
    const hoursSinceCreation = (now - entry.timestamp) / (60 * 60 * 1000);
    const hoursSinceLastAccess = (now - entry.lastAccessed) / (60 * 60 * 1000);
    const accessesPerHour = entry.accessCount / Math.max(hoursSinceCreation, 1);

    if (accessesPerHour > 2) return 'frequent';
    if (hoursSinceLastAccess < 1) return 'recent';
    if (entry.accessCount > 5 && hoursSinceLastAccess < 24) return 'mixed';
    return 'cold';
  }

  /**
   * Advanced cleanup with optimized LRU-W algorithm and intelligent eviction
   */
  private async advancedCleanup(): Promise<void> {
    const now = Date.now();
    const toDelete: string[] = [];

    // First pass: remove expired entries
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.maxAge) {
        toDelete.push(key);
      }
    }

    // Second pass: Intelligent LRU-W eviction if still over limit
    if (this.cache.size - toDelete.length >= this.maxSize) {
      const entries = Array.from(this.cache.entries())
        .map(([key, entry]) => ({
          key,
          entry,
          priority: this.calculatePriority(entry),
          // Additional factors for smarter eviction
          accessDensity: entry.accessCount / Math.max((now - entry.timestamp) / (60 * 60 * 1000), 1),
          memoryScore: entry.compressed ? entry.compressedSize : JSON.stringify(entry.data).length,
          utilityScore: this.calculateUtilityScore(entry)
        }))
        .sort((a, b) => {
          // Multi-factor sorting: priority first, then utility, then memory efficiency
          const priorityDiff = a.priority - b.priority;
          if (Math.abs(priorityDiff) > 0.1) return priorityDiff;

          const utilityDiff = a.utilityScore - b.utilityScore;
          if (Math.abs(utilityDiff) > 0.05) return utilityDiff;

          return b.memoryScore - a.memoryScore; // Prefer to evict larger entries when other factors are equal
        });

      // Adaptive eviction size based on memory pressure
      const memoryPressure = this.stats.memoryUsage / (50 * 1024 * 1024); // Relative to 50MB target
      const baseEvictionRate = memoryPressure > 0.8 ? 0.25 : 0.15; // More aggressive when under pressure

      const numToEvict = Math.min(
        Math.floor(this.maxSize * baseEvictionRate),
        this.cache.size - toDelete.length - Math.floor(this.maxSize * 0.75) // Maintain 75% capacity
      );

      // Smart eviction: avoid evicting recently successful entries
      let evicted = 0;
      for (let i = 0; i < entries.length && evicted < numToEvict; i++) {
        const entry = entries[i];

        // Protection for high-value entries
        if (entry.priority > 0.8 || entry.utilityScore > 0.9) {
          continue; // Skip high-value entries
        }

        // Protection for recently accessed entries
        if ((now - entry.entry.lastAccessed) < 30 * 60 * 1000) { // Less than 30 minutes
          continue; // Skip recently accessed
        }

        toDelete.push(entry.key);
        evicted++;
      }
    }

    // Perform deletion and update stats
    toDelete.forEach(key => {
      this.cache.delete(key);
      this.fingerprints.delete(key);
      this.preloadQueue.delete(key);

      const orderIndex = this.accessOrder.indexOf(key);
      if (orderIndex > -1) {
        this.accessOrder.splice(orderIndex, 1);
      }
    });

    this.stats.evictionCount += toDelete.length;
    this.stats.totalEntries = this.cache.size;
    this.updateMemoryUsage();
    this.updatePerformanceScore();
  }

  /**
   * Calculate utility score for intelligent eviction decisions
   */
  private calculateUtilityScore(entry: CacheEntry): number {
    const now = Date.now();
    const ageHours = (now - entry.timestamp) / (60 * 60 * 1000);
    const accessFrequency = entry.accessCount / Math.max(ageHours, 1);
    const recentAccess = Math.max(0, 1 - (now - entry.lastAccessed) / (24 * 60 * 60 * 1000));
    const complexityValue = entry.metadata.complexity; // Complex content might be expensive to recreate
    const performanceBonus = entry.metadata.performanceScore;

    return (
      accessFrequency * 0.3 +
      recentAccess * 0.25 +
      complexityValue * 0.2 +
      performanceBonus * 0.15 +
      (entry.compressed ? 0.1 : 0) // Compressed entries are more valuable
    );
  }

  /**
   * Enhanced performance score calculation with optimized weightings
   */
  private updatePerformanceScore(): void {
    const { hitRate, averageRetrievalTime, compressionRatio, memoryUsage, preloadHits, evictionCount } = this.stats;
    const maxMemory = 50 * 1024 * 1024; // 50MB target
    const maxRetrievalTime = 30; // Optimized target: 30ms
    const totalRequests = this.stats.hitRate + this.stats.missRate + 1;

    // Enhanced scoring with additional factors
    const hitRateScore = Math.min(hitRate * 1.2, 1); // Bonus for high hit rates
    const speedScore = Math.max(0, 1 - averageRetrievalTime / maxRetrievalTime);
    const memoryEfficiencyScore = Math.max(0, 1 - memoryUsage / maxMemory);
    const compressionEfficiencyScore = Math.min(compressionRatio * 1.5, 1); // Enhanced compression value
    const preloadEffectivenessScore = totalRequests > 0 ? Math.min(preloadHits / totalRequests * 2, 1) : 0;
    const stabilityScore = Math.max(0, 1 - evictionCount / Math.max(this.cache.size, 1));

    // Optimized weighted performance calculation
    this.stats.performanceScore = Math.max(0, Math.min(1,
      hitRateScore * 0.35 +                    // Increased hit rate importance
      speedScore * 0.25 +                      // Speed is critical
      memoryEfficiencyScore * 0.15 +           // Memory management
      compressionEfficiencyScore * 0.10 +      // Compression benefits
      preloadEffectivenessScore * 0.10 +       // Preloading effectiveness
      stabilityScore * 0.05                    // Cache stability
    ));
  }

  /**
   * Generate content fingerprint for similarity matching
   */
  private generateFingerprint(content: string): ContentFingerprint {
    const words = content.toLowerCase().match(/\w+/g) || [];
    const wordCounts = new Map<string, number>();

    // Build word frequency vector
    words.forEach(word => {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    });

    // Extract structural patterns
    const structuralPattern = this.extractStructuralPattern(content);

    // Create semantic signature
    const semanticSignature = this.createSemanticSignature(words);

    // Generate keyword vector (simplified TF-IDF approach)
    const keywordVector = this.createKeywordVector(wordCounts, words.length);

    // Estimate complexity
    const complexity = this.estimateComplexity(content);

    // Predict diagram type
    const diagramTypeHint = this.predictDiagramType(content);

    return {
      structuralPattern,
      keywordVector,
      semanticSignature,
      diagramTypeHint,
      complexity
    };
  }

  /**
   * Extract structural patterns from content
   */
  private extractStructuralPattern(content: string): string {
    const patterns = [
      content.includes('first') && content.includes('then') ? 'sequential' : '',
      content.includes('because') || content.includes('therefore') ? 'causal' : '',
      content.includes('versus') || content.includes('compared to') ? 'comparative' : '',
      content.match(/\d+[\.\)]/g) ? 'enumerated' : '',
      content.includes('step') && content.includes('process') ? 'procedural' : ''
    ].filter(p => p);

    return patterns.join(',') || 'narrative';
  }

  /**
   * Create semantic signature for content
   */
  private createSemanticSignature(words: string[]): string {
    const semanticIndicators = [
      'concept', 'process', 'system', 'relationship', 'flow', 'structure',
      'hierarchy', 'timeline', 'comparison', 'cycle', 'matrix', 'network'
    ];

    const present = semanticIndicators.filter(indicator =>
      words.some(word => word.includes(indicator))
    );

    return present.join(',') || 'general';
  }

  /**
   * Create keyword vector for similarity comparison
   */
  private createKeywordVector(wordCounts: Map<string, number>, totalWords: number): number[] {
    const importantWords = [
      'process', 'step', 'flow', 'system', 'relationship', 'hierarchy',
      'timeline', 'sequence', 'structure', 'network', 'cycle', 'matrix'
    ];

    return importantWords.map(word => {
      const count = wordCounts.get(word) || 0;
      return count / totalWords; // Simple TF normalization
    });
  }

  /**
   * Estimate content complexity
   */
  private estimateComplexity(content: string): number {
    const factors = [
      content.length / 1000, // Length factor
      (content.match(/\./g) || []).length / 10, // Sentence count factor
      (content.match(/\w+/g) || []).length / 100, // Word count factor
      (content.match(/[,;:]/g) || []).length / 20 // Punctuation complexity
    ];

    return Math.min(factors.reduce((sum, factor) => sum + factor, 0), 1);
  }

  /**
   * Predict likely diagram type
   */
  private predictDiagramType(content: string): DiagramType {
    const indicators = {
      'flow': ['process', 'step', 'flow', 'procedure', 'sequence'],
      'tree': ['hierarchy', 'structure', 'organization', 'branch', 'category'],
      'timeline': ['timeline', 'chronology', 'history', 'evolution', 'progression'],
      'matrix': ['matrix', 'comparison', 'table', 'grid', 'relationship'],
      'cycle': ['cycle', 'circular', 'loop', 'recurring', 'iterative']
    };

    const scores = Object.entries(indicators).map(([type, words]) => ({
      type: type as DiagramType,
      score: words.reduce((sum, word) => {
        return sum + (content.toLowerCase().includes(word) ? 1 : 0);
      }, 0)
    }));

    const best = scores.reduce((max, current) =>
      current.score > max.score ? current : max
    );

    return best.score > 0 ? best.type : 'flow';
  }

  /**
   * Calculate similarity between two fingerprints
   */
  private calculateSimilarity(fp1: ContentFingerprint, fp2: ContentFingerprint): number {
    // Structural pattern similarity
    const structuralSim = fp1.structuralPattern === fp2.structuralPattern ? 0.3 : 0;

    // Diagram type similarity
    const typeSim = fp1.diagramTypeHint === fp2.diagramTypeHint ? 0.2 : 0;

    // Keyword vector similarity (cosine similarity)
    const vectorSim = this.cosineSimilarity(fp1.keywordVector, fp2.keywordVector) * 0.3;

    // Semantic signature similarity
    const semanticSim = this.jacquardSimilarity(
      fp1.semanticSignature.split(','),
      fp2.semanticSignature.split(',')
    ) * 0.2;

    return structuralSim + typeSim + vectorSim + semanticSim;
  }

  /**
   * Calculate cosine similarity between vectors
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) return 0;

    const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
    const magnitude1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
    const magnitude2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));

    if (magnitude1 === 0 || magnitude2 === 0) return 0;
    return dotProduct / (magnitude1 * magnitude2);
  }

  /**
   * Calculate Jaccard similarity between sets
   */
  private jacquardSimilarity(set1: string[], set2: string[]): number {
    const s1 = new Set(set1.filter(x => x));
    const s2 = new Set(set2.filter(x => x));

    const intersection = new Set([...s1].filter(x => s2.has(x)));
    const union = new Set([...s1, ...s2]);

    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  /**
   * Generate cache key from content
   */
  private generateCacheKey(content: string): string {
    // Use a more sophisticated hash for better distribution
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `cache_${Math.abs(hash)}_${content.length}`;
  }

  /**
   * Find similar cached content with advanced optimization
   */
  async findSimilar(content: string): Promise<CacheEntry | null> {
    const startTime = performance.now();
    const fingerprint = this.generateFingerprint(content);

    // Trigger predictive preloading
    await this.predictivePreload(fingerprint);

    let bestMatch: CacheEntry | null = null;
    let bestSimilarity = 0;
    let isPreloadHit = false;

    // Check preload queue first for better performance
    for (const key of this.preloadQueue) {
      const entry = this.cache.get(key);
      const cachedFingerprint = this.fingerprints.get(key);

      if (!entry || !cachedFingerprint) continue;

      const similarity = this.calculateSimilarity(fingerprint, cachedFingerprint);

      if (similarity > this.similarityThreshold && similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = entry;
        isPreloadHit = true;
      }
    }

    // If no preload hit, check full cache
    if (!bestMatch) {
      for (const [key, entry] of this.cache.entries()) {
        const cachedFingerprint = this.fingerprints.get(key);
        if (!cachedFingerprint) continue;

        const similarity = this.calculateSimilarity(fingerprint, cachedFingerprint);

        if (similarity > this.similarityThreshold && similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestMatch = entry;
        }
      }
    }

    // Update stats and tracking
    const retrievalTime = performance.now() - startTime;
    this.stats.averageRetrievalTime =
      (this.stats.averageRetrievalTime + retrievalTime) / 2;

    if (bestMatch) {
      bestMatch.accessCount++;
      bestMatch.lastAccessed = Date.now();
      bestMatch.priority = this.calculatePriority(bestMatch);
      bestMatch.metadata.accessPattern = this.determineAccessPattern(bestMatch);

      this.updateAccessOrder(bestMatch.id);
      this.stats.hitRate = this.updateHitRate(true);
      this.stats.totalSavedTime += 1000; // Estimate saved processing time

      if (isPreloadHit) {
        this.stats.preloadHits++;
      }

      // Return decompressed data
      if (bestMatch.compressed) {
        const decompressedData = this.decompressData(bestMatch.data, bestMatch.compressedSize);
        return { ...bestMatch, data: decompressedData };
      }
    } else {
      this.stats.missRate = this.updateHitRate(false);
    }

    this.updatePerformanceScore();
    return bestMatch;
  }

  /**
   * Store content in cache with compression and optimization
   */
  async store(content: string, data: any, metadata: CacheEntry['metadata']): Promise<void> {
    const key = this.generateCacheKey(content);
    const fingerprint = this.generateFingerprint(content);

    // Clean old entries if cache is full
    if (this.cache.size >= this.maxSize) {
      await this.advancedCleanup();
    }

    // Compress data if enabled and beneficial
    let finalData = data;
    let compressed = false;
    let compressedSize = 0;

    if (this.compressionEnabled) {
      const compressionResult = this.compressData(data);
      if (compressionResult.compressedSize < compressionResult.originalSize * 0.8) {
        finalData = compressionResult.compressed;
        compressed = true;
        compressedSize = compressionResult.compressedSize;

        // Update compression ratio stats
        const ratio = compressionResult.compressedSize / compressionResult.originalSize;
        this.stats.compressionRatio = (this.stats.compressionRatio + ratio) / 2;
      }
    }

    const entry: CacheEntry = {
      id: key,
      contentHash: key,
      timestamp: Date.now(),
      accessCount: 1,
      lastAccessed: Date.now(),
      data: finalData,
      compressed,
      compressedSize,
      priority: 1.0, // New entries start with high priority
      metadata: {
        ...metadata,
        accessPattern: 'recent'
      }
    };

    this.cache.set(key, entry);
    this.fingerprints.set(key, fingerprint);
    this.updateAccessOrder(key);

    this.stats.totalEntries = this.cache.size;
    this.updateMemoryUsage();
    this.updatePerformanceScore();
  }

  /**
   * Retrieve exact match from cache with decompression
   */
  async get(content: string): Promise<any | null> {
    const key = this.generateCacheKey(content);
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check if entry is expired
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(key);
      this.fingerprints.delete(key);
      this.preloadQueue.delete(key);
      return null;
    }

    // Update access tracking
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    entry.priority = this.calculatePriority(entry);
    entry.metadata.accessPattern = this.determineAccessPattern(entry);

    this.updateAccessOrder(key);

    // Return decompressed data if needed
    if (entry.compressed) {
      return this.decompressData(entry.data, entry.compressedSize);
    }

    return entry.data;
  }

  /**
   * Legacy cleanup method - delegates to advanced cleanup
   */
  private async cleanup(): Promise<void> {
    await this.advancedCleanup();
  }

  /**
   * Update hit rate statistics
   */
  private updateHitRate(isHit: boolean): number {
    const totalRequests = this.stats.hitRate + this.stats.missRate + 1;
    if (isHit) {
      return (this.stats.hitRate + 1) / totalRequests;
    } else {
      return this.stats.hitRate / totalRequests;
    }
  }

  /**
   * Update memory usage estimation
   */
  private updateMemoryUsage(): void {
    // Rough estimation of memory usage
    let totalSize = 0;
    for (const entry of this.cache.values()) {
      totalSize += JSON.stringify(entry).length * 2; // Rough byte estimation
    }
    this.stats.memoryUsage = totalSize;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.fingerprints.clear();
    this.accessOrder = [];
    this.preloadQueue.clear();
    this.stats = {
      totalEntries: 0,
      hitRate: 0,
      missRate: 0,
      averageRetrievalTime: 0,
      totalSavedTime: 0,
      memoryUsage: 0,
      compressionRatio: 0,
      evictionCount: 0,
      preloadHits: 0,
      performanceScore: 0
    };
  }

  /**
   * Get cache efficiency report
   */
  getEfficiencyReport(): {
    efficiency: number;
    recommendations: string[];
    performance: 'excellent' | 'good' | 'fair' | 'poor';
  } {
    const { hitRate, totalSavedTime, averageRetrievalTime } = this.stats;

    const efficiency = hitRate * 0.5 +
                      Math.min(totalSavedTime / 10000, 1) * 0.3 +
                      Math.max(0, 1 - averageRetrievalTime / 100) * 0.2;

    const recommendations: string[] = [];

    if (hitRate < 0.3) {
      recommendations.push('Consider adjusting similarity threshold');
    }
    if (averageRetrievalTime > 50) {
      recommendations.push('Optimize fingerprint generation for faster lookups');
    }
    if (this.stats.memoryUsage > 50 * 1024 * 1024) { // 50MB
      recommendations.push('Consider reducing cache size or implementing compression');
    }

    let performance: 'excellent' | 'good' | 'fair' | 'poor';
    if (efficiency > 0.8) performance = 'excellent';
    else if (efficiency > 0.6) performance = 'good';
    else if (efficiency > 0.4) performance = 'fair';
    else performance = 'poor';

    return { efficiency, recommendations, performance };
  }
}

/**
 * Global cache instance with smart initialization
 */
export const globalCache = new IntelligentCache();

/**
 * Decorator for caching function results
 */
export function cached(keyGenerator?: (args: any[]) => string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheKey = keyGenerator ?
        keyGenerator(args) :
        `${propertyName}_${JSON.stringify(args).slice(0, 100)}`;

      // Try exact match first
      const exactMatch = await globalCache.get(cacheKey);
      if (exactMatch) {
        return exactMatch;
      }

      // Try similarity match
      const similarMatch = await globalCache.findSimilar(cacheKey);
      if (similarMatch) {
        return similarMatch.data;
      }

      // Execute original method
      const result = await method.apply(this, args);

      // Store result with metadata
      await globalCache.store(cacheKey, result, {
        contentType: 'flow', // Default type
        duration: performance.now(),
        complexity: 0.5,
        performanceScore: 0.8
      });

      return result;
    };
  };
}