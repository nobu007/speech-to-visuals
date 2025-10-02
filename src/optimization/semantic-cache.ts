/**
 * Semantic Caching System - Iteration 9
 * Intelligent caching based on content similarity and layout patterns
 */

import { DiagramScene, LayoutResult } from '../types/diagram';

export interface ContentFingerprint {
  topicHash: string;
  semanticHash: string;
  structureHash: string;
  diagramTypeHint: string;
  complexity: number;
}

export interface CacheEntry {
  fingerprint: ContentFingerprint;
  content: string;
  scenes: DiagramScene[];
  layouts: LayoutResult[];
  performance: {
    processingTime: number;
    accuracy: number;
    userRating: number;
  };
  metadata: {
    createdAt: Date;
    lastAccessed: Date;
    accessCount: number;
    similarity: number;
  };
}

export interface SimilarityMatch {
  entry: CacheEntry;
  similarity: number;
  applicableParts: ('scenes' | 'layouts' | 'structure')[];
  adaptationRequired: boolean;
}

export class SemanticCache {
  private cache: Map<string, CacheEntry> = new Map();
  private semanticIndex: Map<string, string[]> = new Map(); // concept -> cache keys
  private maxCacheSize = 1000;
  private similarityThreshold = 0.75;
  private topicWeights = {
    semantic: 0.4,
    structural: 0.3,
    topical: 0.2,
    performance: 0.1
  };

  /**
   * Generate semantic fingerprint for content
   */
  async generateFingerprint(content: string, scenes: DiagramScene[]): Promise<ContentFingerprint> {
    console.log('🔍 Semantic Cache: Generating content fingerprint...');

    const startTime = performance.now();

    // Extract key topics and concepts
    const topics = this.extractTopics(content);
    const concepts = this.extractConcepts(content);

    // Generate semantic hash based on meaning
    const semanticHash = this.hashConcepts(concepts);

    // Generate structure hash based on organization
    const structureHash = this.hashStructure(scenes);

    // Generate topic hash
    const topicHash = this.hashTopics(topics);

    // Infer diagram type
    const diagramTypeHint = this.inferDiagramType(content, scenes);

    // Calculate complexity score
    const complexity = this.calculateComplexity(content, scenes);

    const fingerprint: ContentFingerprint = {
      topicHash,
      semanticHash,
      structureHash,
      diagramTypeHint,
      complexity
    };

    console.log(`⚡ Fingerprint generated in ${Math.round(performance.now() - startTime)}ms`);
    return fingerprint;
  }

  /**
   * Find similar content in cache
   */
  async findSimilar(fingerprint: ContentFingerprint, content: string): Promise<SimilarityMatch[]> {
    console.log('🔎 Semantic Cache: Searching for similar content...');

    const matches: SimilarityMatch[] = [];

    for (const [key, entry] of this.cache) {
      const similarity = this.calculateSimilarity(fingerprint, entry.fingerprint, content, entry.content);

      if (similarity >= this.similarityThreshold) {
        const applicableParts = this.determineApplicableParts(fingerprint, entry.fingerprint, similarity);
        const adaptationRequired = similarity < 0.9;

        matches.push({
          entry,
          similarity,
          applicableParts,
          adaptationRequired
        });

        // Update access metadata
        entry.metadata.lastAccessed = new Date();
        entry.metadata.accessCount++;
      }
    }

    // Sort by similarity and performance
    matches.sort((a, b) => {
      const scoreA = a.similarity * 0.7 + a.entry.performance.accuracy * 0.3;
      const scoreB = b.similarity * 0.7 + b.entry.performance.accuracy * 0.3;
      return scoreB - scoreA;
    });

    console.log(`📊 Found ${matches.length} similar entries`);
    return matches.slice(0, 5); // Return top 5 matches
  }

  /**
   * Store content and results in cache
   */
  async store(
    content: string,
    scenes: DiagramScene[],
    layouts: LayoutResult[],
    performance: CacheEntry['performance']
  ): Promise<void> {
    console.log('💾 Semantic Cache: Storing new entry...');

    const fingerprint = await this.generateFingerprint(content, scenes);
    const key = this.generateCacheKey(fingerprint);

    // Check if we need to evict entries
    if (this.cache.size >= this.maxCacheSize) {
      await this.evictLRU();
    }

    const entry: CacheEntry = {
      fingerprint,
      content,
      scenes,
      layouts,
      performance,
      metadata: {
        createdAt: new Date(),
        lastAccessed: new Date(),
        accessCount: 1,
        similarity: 1.0
      }
    };

    this.cache.set(key, entry);

    // Update semantic index
    await this.updateSemanticIndex(key, content);

    console.log(`✅ Cached entry with key: ${key}`);
  }

  /**
   * Adapt cached content to new requirements
   */
  async adaptCachedContent(
    match: SimilarityMatch,
    targetFingerprint: ContentFingerprint,
    newContent: string
  ): Promise<{ scenes: DiagramScene[]; layouts: LayoutResult[] }> {
    console.log('🔄 Semantic Cache: Adapting cached content...');

    const { entry, applicableParts, adaptationRequired } = match;

    if (!adaptationRequired) {
      console.log('📋 Using cached content as-is');
      return {
        scenes: entry.scenes,
        layouts: entry.layouts
      };
    }

    let adaptedScenes = [...entry.scenes];
    let adaptedLayouts = [...entry.layouts];

    // Adapt scenes if applicable
    if (applicableParts.includes('scenes')) {
      adaptedScenes = await this.adaptScenes(entry.scenes, targetFingerprint, newContent);
    }

    // Adapt layouts if applicable
    if (applicableParts.includes('layouts')) {
      adaptedLayouts = await this.adaptLayouts(entry.layouts, targetFingerprint);
    }

    console.log('✅ Content adaptation complete');
    return {
      scenes: adaptedScenes,
      layouts: adaptedLayouts
    };
  }

  /**
   * Get cache performance statistics
   */
  getCacheStats(): {
    totalEntries: number;
    totalHits: number;
    averageSimilarity: number;
    memoryUsage: number;
    topConcepts: string[];
  } {
    const totalEntries = this.cache.size;
    const totalHits = Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.metadata.accessCount, 0);

    // Calculate average similarity of stored content
    const similarities = Array.from(this.cache.values()).map(entry => entry.metadata.similarity);
    const averageSimilarity = similarities.length > 0
      ? similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length
      : 0;

    // Estimate memory usage (simplified)
    const memoryUsage = totalEntries * 50000; // ~50KB per entry estimate

    // Get top concepts from semantic index
    const conceptCounts = new Map<string, number>();
    this.semanticIndex.forEach((keys, concept) => {
      conceptCounts.set(concept, keys.length);
    });

    const topConcepts = Array.from(conceptCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([concept]) => concept);

    return {
      totalEntries,
      totalHits,
      averageSimilarity,
      memoryUsage,
      topConcepts
    };
  }

  private extractTopics(content: string): string[] {
    const topics: string[] = [];

    // Extract noun phrases as potential topics
    const words = content.toLowerCase().split(/\s+/);
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);

    // Simple bigram extraction
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      if (!stopWords.has(words[i]) && !stopWords.has(words[i + 1])) {
        topics.push(bigram);
      }
    }

    // Extract important single words
    const importantWords = words.filter(word =>
      word.length > 4 && !stopWords.has(word) && /^[a-z]+$/.test(word)
    );

    return [...new Set([...topics, ...importantWords])].slice(0, 20);
  }

  private extractConcepts(content: string): string[] {
    const concepts: string[] = [];

    // Extract action-oriented concepts
    const actionPatterns = [
      /\b(implement|create|design|analyze|optimize|process|generate|build|develop)\s+(\w+)/gi,
      /\b(\w+)\s+(system|process|method|algorithm|approach|strategy)/gi
    ];

    actionPatterns.forEach(pattern => {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        concepts.push(match[0].toLowerCase());
      }
    });

    return [...new Set(concepts)].slice(0, 15);
  }

  private hashTopics(topics: string[]): string {
    const sorted = topics.sort();
    return this.simpleHash(sorted.join('|'));
  }

  private hashConcepts(concepts: string[]): string {
    const sorted = concepts.sort();
    return this.simpleHash(sorted.join('|'));
  }

  private hashStructure(scenes: DiagramScene[]): string {
    const structure = scenes.map(scene => ({
      type: scene.diagram.type,
      nodeCount: scene.diagram.nodes.length,
      edgeCount: scene.diagram.edges.length
    }));
    return this.simpleHash(JSON.stringify(structure));
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private inferDiagramType(content: string, scenes: DiagramScene[]): string {
    if (scenes.length > 0) {
      return scenes[0].diagram.type;
    }

    const text = content.toLowerCase();
    if (text.includes('flow') || text.includes('process')) return 'flow';
    if (text.includes('hierarchy') || text.includes('tree')) return 'tree';
    if (text.includes('timeline') || text.includes('sequence')) return 'timeline';
    if (text.includes('matrix') || text.includes('comparison')) return 'matrix';
    if (text.includes('cycle') || text.includes('loop')) return 'cycle';

    return 'flow'; // default
  }

  private calculateComplexity(content: string, scenes: DiagramScene[]): number {
    const wordCount = content.split(/\s+/).length;
    const sceneCount = scenes.length;
    const avgNodesPerScene = scenes.length > 0
      ? scenes.reduce((sum, scene) => sum + scene.diagram.nodes.length, 0) / scenes.length
      : 0;

    // Normalize to 0-1 scale
    const wordComplexity = Math.min(1, wordCount / 1000);
    const sceneComplexity = Math.min(1, sceneCount / 10);
    const nodeComplexity = Math.min(1, avgNodesPerScene / 15);

    return (wordComplexity + sceneComplexity + nodeComplexity) / 3;
  }

  private calculateSimilarity(
    fp1: ContentFingerprint,
    fp2: ContentFingerprint,
    content1: string,
    content2: string
  ): number {
    // Hash-based similarity
    const topicSimilarity = fp1.topicHash === fp2.topicHash ? 1 : 0;
    const semanticSimilarity = fp1.semanticHash === fp2.semanticHash ? 1 : 0;
    const structureSimilarity = fp1.structureHash === fp2.structureHash ? 1 : 0;

    // Diagram type similarity
    const diagramSimilarity = fp1.diagramTypeHint === fp2.diagramTypeHint ? 1 : 0;

    // Complexity similarity
    const complexitySimilarity = 1 - Math.abs(fp1.complexity - fp2.complexity);

    // Text-based similarity (simplified Jaccard index)
    const textSimilarity = this.calculateTextSimilarity(content1, content2);

    return (
      topicSimilarity * this.topicWeights.topical +
      semanticSimilarity * this.topicWeights.semantic +
      structureSimilarity * this.topicWeights.structural +
      (diagramSimilarity + complexitySimilarity + textSimilarity) / 3 * this.topicWeights.performance
    );
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  private determineApplicableParts(
    fp1: ContentFingerprint,
    fp2: ContentFingerprint,
    similarity: number
  ): ('scenes' | 'layouts' | 'structure')[] {
    const parts: ('scenes' | 'layouts' | 'structure')[] = [];

    if (fp1.structureHash === fp2.structureHash || similarity > 0.9) {
      parts.push('structure');
    }

    if (fp1.diagramTypeHint === fp2.diagramTypeHint || similarity > 0.85) {
      parts.push('layouts');
    }

    if (fp1.semanticHash === fp2.semanticHash || similarity > 0.8) {
      parts.push('scenes');
    }

    return parts;
  }

  private generateCacheKey(fingerprint: ContentFingerprint): string {
    return `${fingerprint.topicHash}-${fingerprint.semanticHash}-${fingerprint.diagramTypeHint}`;
  }

  private async evictLRU(): Promise<void> {
    let oldestKey = '';
    let oldestAccess = new Date();

    for (const [key, entry] of this.cache) {
      if (entry.metadata.lastAccessed < oldestAccess) {
        oldestAccess = entry.metadata.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      console.log(`🗑️ Evicted LRU cache entry: ${oldestKey}`);
    }
  }

  private async updateSemanticIndex(key: string, content: string): Promise<void> {
    const concepts = this.extractConcepts(content);

    concepts.forEach(concept => {
      if (!this.semanticIndex.has(concept)) {
        this.semanticIndex.set(concept, []);
      }
      this.semanticIndex.get(concept)!.push(key);
    });
  }

  private async adaptScenes(
    scenes: DiagramScene[],
    targetFingerprint: ContentFingerprint,
    newContent: string
  ): Promise<DiagramScene[]> {
    // Simplified adaptation - in production this would be more sophisticated
    return scenes.map(scene => ({
      ...scene,
      title: `Adapted: ${scene.title}`,
      confidence: scene.confidence * 0.9 // Slightly lower confidence for adapted content
    }));
  }

  private async adaptLayouts(
    layouts: LayoutResult[],
    targetFingerprint: ContentFingerprint
  ): Promise<LayoutResult[]> {
    // Simplified adaptation - adjust positions slightly for new content
    return layouts.map(layout => ({
      ...layout,
      nodes: layout.nodes.map(node => ({
        ...node,
        x: node.x + (Math.random() - 0.5) * 20, // Small random adjustment
        y: node.y + (Math.random() - 0.5) * 20
      }))
    }));
  }
}

export const semanticCache = new SemanticCache();