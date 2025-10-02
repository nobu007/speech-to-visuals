/**
 * Intelligent Caching System
 * Semantic similarity matching and pattern reuse for faster processing
 * Caches layouts, analysis results, and processing patterns
 */

import crypto from 'crypto';

export interface CacheEntry<T> {
  id: string;
  data: T;
  metadata: {
    created: Date;
    accessed: Date;
    hitCount: number;
    fingerprint: string;
    semanticHash: string;
    keywords: string[];
    characteristics: any;
  };
  expiry?: Date;
}

export interface SemanticMatch {
  entryId: string;
  similarity: number;
  confidence: number;
  reasoning: string[];
}

export interface CacheStats {
  totalEntries: number;
  hitRate: number;
  averageRetrievalTime: number;
  storageSize: number;
  mostUsedEntries: string[];
  semanticMatchSuccessRate: number;
}

class IntelligentCache {
  private transcriptionCache: Map<string, CacheEntry<any>> = new Map();
  private analysisCache: Map<string, CacheEntry<any>> = new Map();
  private layoutCache: Map<string, CacheEntry<any>> = new Map();
  private semanticIndex: Map<string, string[]> = new Map(); // keyword -> entry IDs

  private maxEntries = 1000;
  private maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
  private semanticThreshold = 0.7;

  private stats = {
    hits: 0,
    misses: 0,
    retrievalTimes: [] as number[],
    semanticMatches: 0,
    semanticAttempts: 0
  };

  /**
   * Cache transcription results with semantic indexing
   */
  async cacheTranscription(
    audioFingerprint: string,
    transcript: any,
    metadata: {
      duration: number;
      quality: number;
      language?: string;
      characteristics: any;
    }
  ): Promise<void> {
    const keywords = this.extractKeywords(transcript.text || '');
    const semanticHash = this.generateSemanticHash(transcript.text || '', keywords);

    const entry: CacheEntry<any> = {
      id: this.generateId('transcript', audioFingerprint),
      data: transcript,
      metadata: {
        created: new Date(),
        accessed: new Date(),
        hitCount: 0,
        fingerprint: audioFingerprint,
        semanticHash,
        keywords,
        characteristics: metadata.characteristics
      }
    };

    this.transcriptionCache.set(entry.id, entry);
    this.updateSemanticIndex(entry.id, keywords);

    console.log('[IntelligentCache] Cached transcription with semantic hash:', semanticHash);
  }

  /**
   * Retrieve transcription with semantic matching fallback
   */
  async getTranscription(
    audioFingerprint: string,
    fallbackText?: string
  ): Promise<{ data: any; match: 'exact' | 'semantic' | null; similarity?: number }> {
    const startTime = performance.now();

    // Try exact match first
    const exactId = this.generateId('transcript', audioFingerprint);
    const exactMatch = this.transcriptionCache.get(exactId);

    if (exactMatch) {
      this.updateAccessInfo(exactMatch);
      this.recordHit(performance.now() - startTime);
      return { data: exactMatch.data, match: 'exact' };
    }

    // Try semantic matching if fallback text provided
    if (fallbackText) {
      const semanticMatch = await this.findSemanticMatch(fallbackText, this.transcriptionCache);
      if (semanticMatch) {
        const entry = this.transcriptionCache.get(semanticMatch.entryId)!;
        this.updateAccessInfo(entry);
        this.recordSemanticHit(performance.now() - startTime);
        return {
          data: entry.data,
          match: 'semantic',
          similarity: semanticMatch.similarity
        };
      }
    }

    this.recordMiss();
    return { data: null, match: null };
  }

  /**
   * Cache analysis results with content similarity indexing
   */
  async cacheAnalysis(
    contentHash: string,
    analysis: any,
    metadata: {
      diagramTypes: string[];
      confidence: number;
      keywords: string[];
      characteristics: any;
    }
  ): Promise<void> {
    const semanticHash = this.generateSemanticHash(
      metadata.keywords.join(' '),
      metadata.keywords
    );

    const entry: CacheEntry<any> = {
      id: this.generateId('analysis', contentHash),
      data: analysis,
      metadata: {
        created: new Date(),
        accessed: new Date(),
        hitCount: 0,
        fingerprint: contentHash,
        semanticHash,
        keywords: metadata.keywords,
        characteristics: metadata.characteristics
      }
    };

    this.analysisCache.set(entry.id, entry);
    this.updateSemanticIndex(entry.id, metadata.keywords);

    console.log('[IntelligentCache] Cached analysis for diagram types:', metadata.diagramTypes);
  }

  /**
   * Get analysis with intelligent pattern matching
   */
  async getAnalysis(
    contentHash: string,
    keywords?: string[]
  ): Promise<{ data: any; match: 'exact' | 'semantic' | null; similarity?: number }> {
    const startTime = performance.now();

    // Try exact match
    const exactId = this.generateId('analysis', contentHash);
    const exactMatch = this.analysisCache.get(exactId);

    if (exactMatch) {
      this.updateAccessInfo(exactMatch);
      this.recordHit(performance.now() - startTime);
      return { data: exactMatch.data, match: 'exact' };
    }

    // Try semantic matching based on keywords
    if (keywords && keywords.length > 0) {
      const keywordText = keywords.join(' ');
      const semanticMatch = await this.findSemanticMatch(keywordText, this.analysisCache);

      if (semanticMatch) {
        const entry = this.analysisCache.get(semanticMatch.entryId)!;
        this.updateAccessInfo(entry);
        this.recordSemanticHit(performance.now() - startTime);
        return {
          data: entry.data,
          match: 'semantic',
          similarity: semanticMatch.similarity
        };
      }
    }

    this.recordMiss();
    return { data: null, match: null };
  }

  /**
   * Cache layout configurations with structural similarity
   */
  async cacheLayout(
    layoutHash: string,
    layout: any,
    metadata: {
      nodeCount: number;
      diagramType: string;
      complexity: number;
      characteristics: any;
    }
  ): Promise<void> {
    const structuralFeatures = this.extractStructuralFeatures(layout, metadata);
    const semanticHash = this.generateStructuralHash(structuralFeatures);

    const entry: CacheEntry<any> = {
      id: this.generateId('layout', layoutHash),
      data: layout,
      metadata: {
        created: new Date(),
        accessed: new Date(),
        hitCount: 0,
        fingerprint: layoutHash,
        semanticHash,
        keywords: [metadata.diagramType, `nodes_${metadata.nodeCount}`],
        characteristics: metadata.characteristics
      }
    };

    this.layoutCache.set(entry.id, entry);
    this.updateSemanticIndex(entry.id, entry.metadata.keywords);

    console.log('[IntelligentCache] Cached layout for type:', metadata.diagramType);
  }

  /**
   * Get layout with structural pattern matching
   */
  async getLayout(
    layoutHash: string,
    diagramType?: string,
    nodeCount?: number
  ): Promise<{ data: any; match: 'exact' | 'semantic' | null; similarity?: number }> {
    const startTime = performance.now();

    // Try exact match
    const exactId = this.generateId('layout', layoutHash);
    const exactMatch = this.layoutCache.get(exactId);

    if (exactMatch) {
      this.updateAccessInfo(exactMatch);
      this.recordHit(performance.now() - startTime);
      return { data: exactMatch.data, match: 'exact' };
    }

    // Try structural similarity matching
    if (diagramType && nodeCount) {
      const structuralMatch = await this.findStructuralMatch(
        diagramType,
        nodeCount,
        this.layoutCache
      );

      if (structuralMatch) {
        const entry = this.layoutCache.get(structuralMatch.entryId)!;
        this.updateAccessInfo(entry);
        this.recordSemanticHit(performance.now() - startTime);
        return {
          data: this.adaptLayout(entry.data, nodeCount),
          match: 'semantic',
          similarity: structuralMatch.similarity
        };
      }
    }

    this.recordMiss();
    return { data: null, match: null };
  }

  /**
   * Find similar content using semantic analysis
   */
  private async findSemanticMatch<T>(
    queryText: string,
    cache: Map<string, CacheEntry<T>>
  ): Promise<SemanticMatch | null> {
    this.stats.semanticAttempts++;

    const queryKeywords = this.extractKeywords(queryText);
    const candidates: { entryId: string; similarity: number }[] = [];

    // Find candidates using keyword intersection
    const candidateIds = new Set<string>();
    queryKeywords.forEach(keyword => {
      const relatedEntries = this.semanticIndex.get(keyword) || [];
      relatedEntries.forEach(id => candidateIds.add(id));
    });

    // Calculate semantic similarity for candidates
    candidateIds.forEach(entryId => {
      const entry = cache.get(entryId);
      if (entry) {
        const similarity = this.calculateSemanticSimilarity(
          queryKeywords,
          entry.metadata.keywords
        );
        if (similarity >= this.semanticThreshold) {
          candidates.push({ entryId, similarity });
        }
      }
    });

    if (candidates.length === 0) {
      return null;
    }

    // Select best match
    candidates.sort((a, b) => b.similarity - a.similarity);
    const best = candidates[0];

    const reasoning = this.generateMatchReasoning(queryKeywords, cache.get(best.entryId)!);

    this.stats.semanticMatches++;

    return {
      entryId: best.entryId,
      similarity: best.similarity,
      confidence: this.calculateMatchConfidence(best.similarity, candidates),
      reasoning
    };
  }

  /**
   * Find structurally similar layouts
   */
  private async findStructuralMatch(
    diagramType: string,
    nodeCount: number,
    cache: Map<string, CacheEntry<any>>
  ): Promise<SemanticMatch | null> {
    const candidates: { entryId: string; similarity: number }[] = [];

    // Find candidates with similar structure
    cache.forEach((entry, entryId) => {
      const entryType = entry.metadata.keywords.find(k =>
        ['flow', 'tree', 'timeline', 'matrix', 'cycle'].includes(k)
      );

      if (entryType === diagramType) {
        const entryNodeCount = parseInt(
          entry.metadata.keywords.find(k => k.startsWith('nodes_'))?.split('_')[1] || '0'
        );

        // Calculate structural similarity
        const nodeCountSimilarity = 1 - Math.abs(nodeCount - entryNodeCount) / Math.max(nodeCount, entryNodeCount);
        const similarity = nodeCountSimilarity * 0.8 + 0.2; // Type match bonus

        if (similarity >= this.semanticThreshold) {
          candidates.push({ entryId, similarity });
        }
      }
    });

    if (candidates.length === 0) {
      return null;
    }

    // Select best structural match
    candidates.sort((a, b) => b.similarity - a.similarity);
    const best = candidates[0];

    return {
      entryId: best.entryId,
      similarity: best.similarity,
      confidence: this.calculateMatchConfidence(best.similarity, candidates),
      reasoning: [`Structural match for ${diagramType} with ${nodeCount} nodes`]
    };
  }

  /**
   * Get comprehensive cache statistics
   */
  getCacheStats(): CacheStats {
    const totalEntries = this.transcriptionCache.size +
                        this.analysisCache.size +
                        this.layoutCache.size;

    const hitRate = this.stats.hits / (this.stats.hits + this.stats.misses);
    const avgRetrievalTime = this.stats.retrievalTimes.length > 0 ?
      this.stats.retrievalTimes.reduce((a, b) => a + b, 0) / this.stats.retrievalTimes.length : 0;

    const semanticSuccessRate = this.stats.semanticAttempts > 0 ?
      this.stats.semanticMatches / this.stats.semanticAttempts : 0;

    // Find most used entries
    const allEntries = [
      ...this.transcriptionCache.values(),
      ...this.analysisCache.values(),
      ...this.layoutCache.values()
    ];
    const mostUsed = allEntries
      .sort((a, b) => b.metadata.hitCount - a.metadata.hitCount)
      .slice(0, 5)
      .map(entry => entry.id);

    return {
      totalEntries,
      hitRate,
      averageRetrievalTime: avgRetrievalTime,
      storageSize: this.estimateStorageSize(),
      mostUsedEntries: mostUsed,
      semanticMatchSuccessRate: semanticSuccessRate
    };
  }

  /**
   * Clean expired and least-used entries
   */
  async cleanup(): Promise<{ removed: number; compacted: number }> {
    const now = new Date();
    let removed = 0;
    let compacted = 0;

    // Clean expired entries
    [this.transcriptionCache, this.analysisCache, this.layoutCache].forEach(cache => {
      const toRemove: string[] = [];

      cache.forEach((entry, id) => {
        if (entry.expiry && entry.expiry < now) {
          toRemove.push(id);
        } else if (now.getTime() - entry.metadata.created.getTime() > this.maxAge) {
          toRemove.push(id);
        }
      });

      toRemove.forEach(id => {
        cache.delete(id);
        removed++;
      });
    });

    // Compact if over limit
    const totalEntries = this.transcriptionCache.size +
                        this.analysisCache.size +
                        this.layoutCache.size;

    if (totalEntries > this.maxEntries) {
      const excessEntries = totalEntries - this.maxEntries;
      compacted = await this.compactLeastUsed(excessEntries);
    }

    // Rebuild semantic index
    this.rebuildSemanticIndex();

    console.log(`[IntelligentCache] Cleanup completed: ${removed} expired, ${compacted} compacted`);

    return { removed, compacted };
  }

  // Helper methods

  private extractKeywords(text: string): string[] {
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2);

    // Remove common stop words
    const stopWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'who', 'boy', 'did', 'she', 'use', 'way', 'why']);

    return words.filter(w => !stopWords.has(w));
  }

  private generateSemanticHash(text: string, keywords: string[]): string {
    const combined = text + ' ' + keywords.sort().join(' ');
    return crypto.createHash('md5').update(combined).digest('hex').substring(0, 16);
  }

  private extractStructuralFeatures(layout: any, metadata: any): any {
    return {
      nodeCount: metadata.nodeCount,
      diagramType: metadata.diagramType,
      complexity: metadata.complexity,
      aspectRatio: layout.width / layout.height || 1
    };
  }

  private generateStructuralHash(features: any): string {
    const str = JSON.stringify(features, Object.keys(features).sort());
    return crypto.createHash('md5').update(str).digest('hex').substring(0, 16);
  }

  private calculateSemanticSimilarity(keywords1: string[], keywords2: string[]): number {
    const set1 = new Set(keywords1);
    const set2 = new Set(keywords2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size; // Jaccard similarity
  }

  private generateId(type: string, fingerprint: string): string {
    return `${type}_${fingerprint}`;
  }

  private updateSemanticIndex(entryId: string, keywords: string[]): void {
    keywords.forEach(keyword => {
      const entries = this.semanticIndex.get(keyword) || [];
      if (!entries.includes(entryId)) {
        entries.push(entryId);
        this.semanticIndex.set(keyword, entries);
      }
    });
  }

  private updateAccessInfo(entry: CacheEntry<any>): void {
    entry.metadata.accessed = new Date();
    entry.metadata.hitCount++;
  }

  private recordHit(time: number): void {
    this.stats.hits++;
    this.stats.retrievalTimes.push(time);
    if (this.stats.retrievalTimes.length > 100) {
      this.stats.retrievalTimes.shift();
    }
  }

  private recordSemanticHit(time: number): void {
    this.recordHit(time);
    this.stats.semanticMatches++;
  }

  private recordMiss(): void {
    this.stats.misses++;
  }

  private generateMatchReasoning(queryKeywords: string[], entry: CacheEntry<any>): string[] {
    const commonKeywords = queryKeywords.filter(k => entry.metadata.keywords.includes(k));
    return [
      `Matched ${commonKeywords.length} keywords: ${commonKeywords.join(', ')}`,
      `Entry age: ${Math.round((Date.now() - entry.metadata.created.getTime()) / (1000 * 60))} minutes`,
      `Hit count: ${entry.metadata.hitCount}`
    ];
  }

  private calculateMatchConfidence(similarity: number, candidates: any[]): number {
    // Higher confidence if similarity is high and there are multiple candidates
    const base = similarity;
    const candidateBonus = Math.min(0.1, candidates.length * 0.02);
    return Math.min(0.95, base + candidateBonus);
  }

  private adaptLayout(originalLayout: any, newNodeCount: number): any {
    // Simple adaptation - scale spacing based on node count difference
    const scaleFactor = Math.sqrt(newNodeCount / (originalLayout.nodes?.length || newNodeCount));

    return {
      ...originalLayout,
      spacing: (originalLayout.spacing || 50) * scaleFactor,
      adapted: true,
      originalNodeCount: originalLayout.nodes?.length || 0,
      newNodeCount
    };
  }

  private estimateStorageSize(): number {
    // Rough estimate in KB
    const entrySize = 2; // Average 2KB per entry
    const totalEntries = this.transcriptionCache.size +
                        this.analysisCache.size +
                        this.layoutCache.size;
    return totalEntries * entrySize;
  }

  private async compactLeastUsed(targetRemoval: number): Promise<number> {
    const allEntries = [
      ...Array.from(this.transcriptionCache.entries()).map(([id, entry]) => ({ id, entry, cache: this.transcriptionCache })),
      ...Array.from(this.analysisCache.entries()).map(([id, entry]) => ({ id, entry, cache: this.analysisCache })),
      ...Array.from(this.layoutCache.entries()).map(([id, entry]) => ({ id, entry, cache: this.layoutCache }))
    ];

    // Sort by hit count and age (least used first)
    allEntries.sort((a, b) => {
      const hitDiff = a.entry.metadata.hitCount - b.entry.metadata.hitCount;
      if (hitDiff !== 0) return hitDiff;

      return a.entry.metadata.created.getTime() - b.entry.metadata.created.getTime();
    });

    let removed = 0;
    for (let i = 0; i < Math.min(targetRemoval, allEntries.length); i++) {
      const { id, cache } = allEntries[i];
      cache.delete(id);
      removed++;
    }

    return removed;
  }

  private rebuildSemanticIndex(): void {
    this.semanticIndex.clear();

    const allCaches = [this.transcriptionCache, this.analysisCache, this.layoutCache];
    allCaches.forEach(cache => {
      cache.forEach((entry, id) => {
        this.updateSemanticIndex(id, entry.metadata.keywords);
      });
    });
  }
}

export default IntelligentCache;