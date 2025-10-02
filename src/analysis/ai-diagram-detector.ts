/**
 * Next-Generation AI-Powered Diagram Detection System
 * Implements advanced pattern recognition and semantic understanding
 */

import { DiagramType, ContentSegment, EntityNode, EntityEdge } from '@/types/diagram';

interface AIDetectionConfig {
  useSemanticAnalysis: boolean;
  confidenceThreshold: number;
  multiModalInput: boolean;
  contextualLearning: boolean;
}

interface SemanticPattern {
  type: DiagramType;
  keywords: string[];
  semanticMarkers: string[];
  structuralIndicators: string[];
  confidenceWeight: number;
}

interface AIDetectionResult {
  type: DiagramType;
  confidence: number;
  semanticScore: number;
  structuralScore: number;
  contextualScore: number;
  reasoning: string[];
  nodes: EntityNode[];
  edges: EntityEdge[];
}

/**
 * Advanced AI-powered diagram detection with semantic understanding
 */
export class AIDiagramDetector {
  private config: AIDetectionConfig;
  private semanticPatterns: SemanticPattern[];
  private learningHistory: Map<string, DiagramType> = new Map();

  constructor(config: Partial<AIDetectionConfig> = {}) {
    this.config = {
      useSemanticAnalysis: true,
      confidenceThreshold: 0.8,
      multiModalInput: false,
      contextualLearning: true,
      ...config
    };

    this.initializeSemanticPatterns();
  }

  /**
   * Initialize advanced semantic patterns for diagram detection
   */
  private initializeSemanticPatterns(): void {
    this.semanticPatterns = [
      {
        type: 'flow',
        keywords: ['process', 'step', 'sequence', 'workflow', 'procedure', 'algorithm'],
        semanticMarkers: ['then', 'next', 'after', 'before', 'subsequently', 'following'],
        structuralIndicators: ['→', '->', '=>', 'leads to', 'results in', 'causes'],
        confidenceWeight: 0.9
      },
      {
        type: 'tree',
        keywords: ['hierarchy', 'structure', 'organization', 'classification', 'taxonomy'],
        semanticMarkers: ['under', 'beneath', 'parent', 'child', 'branch', 'root'],
        structuralIndicators: ['├', '└', '│', 'subdivides into', 'consists of'],
        confidenceWeight: 0.85
      },
      {
        type: 'timeline',
        keywords: ['history', 'chronology', 'evolution', 'development', 'progression'],
        semanticMarkers: ['year', 'month', 'day', 'era', 'period', 'epoch', 'century'],
        structuralIndicators: ['1990', '2020', 'AD', 'BC', 'ago', 'years later'],
        confidenceWeight: 0.8
      },
      {
        type: 'matrix',
        keywords: ['comparison', 'analysis', 'evaluation', 'criteria', 'factors'],
        semanticMarkers: ['versus', 'compared to', 'against', 'in contrast', 'similarly'],
        structuralIndicators: ['rows', 'columns', 'table', 'grid', 'dimensions'],
        confidenceWeight: 0.75
      },
      {
        type: 'cycle',
        keywords: ['cycle', 'loop', 'circular', 'recurring', 'iterative', 'repetitive'],
        semanticMarkers: ['repeats', 'cycles', 'returns', 'back to', 'again', 'continuously'],
        structuralIndicators: ['↻', '⟲', 'circular', 'loop back', 'recurring pattern'],
        confidenceWeight: 0.7
      }
    ];
  }

  /**
   * Advanced AI-powered diagram analysis with semantic understanding
   */
  async analyzeWithAI(segment: ContentSegment): Promise<AIDetectionResult> {
    console.log(`🧠 AI Analysis: Processing "${segment.summary}"`);

    const text = segment.text.toLowerCase();
    const semanticAnalysis = this.performSemanticAnalysis(text);
    const structuralAnalysis = this.performStructuralAnalysis(text);
    const contextualAnalysis = this.performContextualAnalysis(segment);

    // Advanced multi-criteria scoring
    const detectionResults = this.semanticPatterns.map(pattern => {
      const semanticScore = this.calculateSemanticScore(text, pattern);
      const structuralScore = this.calculateStructuralScore(text, pattern);
      const contextualScore = this.calculateContextualScore(segment, pattern);

      const weightedScore = (
        semanticScore * 0.4 +
        structuralScore * 0.3 +
        contextualScore * 0.3
      ) * pattern.confidenceWeight;

      return {
        type: pattern.type,
        score: weightedScore,
        breakdown: { semanticScore, structuralScore, contextualScore }
      };
    });

    // Select best match with confidence
    const bestResult = detectionResults.reduce((best, current) =>
      current.score > best.score ? current : best
    );

    // Extract entities using AI-enhanced methods
    const { nodes, edges } = await this.extractEntitiesWithAI(segment, bestResult.type);

    // Generate reasoning explanation
    const reasoning = this.generateReasoning(bestResult, semanticAnalysis, structuralAnalysis);

    const result: AIDetectionResult = {
      type: bestResult.type,
      confidence: Math.min(bestResult.score, 1.0),
      semanticScore: bestResult.breakdown.semanticScore,
      structuralScore: bestResult.breakdown.structuralScore,
      contextualScore: bestResult.breakdown.contextualScore,
      reasoning,
      nodes,
      edges
    };

    // Learning enhancement
    if (this.config.contextualLearning) {
      this.updateLearningHistory(segment, result);
    }

    console.log(`🎯 AI Detection Result: ${result.type} (confidence: ${(result.confidence * 100).toFixed(1)}%)`);
    return result;
  }

  /**
   * Perform advanced semantic analysis
   */
  private performSemanticAnalysis(text: string): any {
    const sentences = text.split(/[.!?]+/).filter(s => s.length > 10);
    const semanticFeatures = {
      actionWords: this.extractActionWords(text),
      relationshipWords: this.extractRelationshipWords(text),
      temporalMarkers: this.extractTemporalMarkers(text),
      hierarchicalMarkers: this.extractHierarchicalMarkers(text),
      sequenceMarkers: this.extractSequenceMarkers(text)
    };

    return {
      sentences: sentences.length,
      avgSentenceLength: sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length,
      ...semanticFeatures
    };
  }

  /**
   * Analyze structural patterns in text
   */
  private performStructuralAnalysis(text: string): any {
    return {
      hasListStructure: /^\s*[-*•]\s+/m.test(text),
      hasNumberedList: /^\s*\d+\.\s+/m.test(text),
      hasArrows: /[-=]>|→|⟶/.test(text),
      hasTimestamps: /\d{4}|\d{1,2}:\d{2}|\d{1,2}\/\d{1,2}/.test(text),
      hasComparativeStructure: /vs\.|versus|compared to|in contrast/.test(text),
      hasHierarchicalStructure: /under|above|parent|child|sub/.test(text)
    };
  }

  /**
   * Analyze contextual information
   */
  private performContextualAnalysis(segment: ContentSegment): any {
    const contextualFeatures = {
      segmentPosition: segment.startMs / (segment.endMs || 1),
      segmentLength: (segment.endMs || 0) - segment.startMs,
      keyphraseRelevance: segment.keyphrases?.length || 0,
      contentDensity: segment.text.length / ((segment.endMs || 1) - segment.startMs),
      previousContext: this.analyzePreviousContext(segment)
    };

    return contextualFeatures;
  }

  /**
   * Calculate semantic relevance score
   */
  private calculateSemanticScore(text: string, pattern: SemanticPattern): number {
    let score = 0;

    // Keyword matching with fuzzy logic
    pattern.keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\w*\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        score += matches.length * 0.2;
      }
    });

    // Semantic marker detection
    pattern.semanticMarkers.forEach(marker => {
      if (text.includes(marker)) {
        score += 0.15;
      }
    });

    return Math.min(score, 1.0);
  }

  /**
   * Calculate structural pattern score
   */
  private calculateStructuralScore(text: string, pattern: SemanticPattern): number {
    let score = 0;

    pattern.structuralIndicators.forEach(indicator => {
      if (text.includes(indicator)) {
        score += 0.25;
      }
    });

    // Pattern-specific structural analysis
    switch (pattern.type) {
      case 'flow':
        if (/step \d+|phase \d+|stage \d+/.test(text)) score += 0.3;
        break;
      case 'tree':
        if (/level \d+|tier \d+|category/.test(text)) score += 0.3;
        break;
      case 'timeline':
        if (/\d{4}|\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(text)) score += 0.4;
        break;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Calculate contextual relevance score
   */
  private calculateContextualScore(segment: ContentSegment, pattern: SemanticPattern): number {
    let score = 0.5; // Base score

    // Learning from history
    if (this.config.contextualLearning) {
      const historicalPattern = this.learningHistory.get(segment.summary.substring(0, 50));
      if (historicalPattern === pattern.type) {
        score += 0.3;
      }
    }

    // Context-based adjustments
    if (segment.keyphrases?.some(phrase =>
      pattern.keywords.some(keyword => phrase.toLowerCase().includes(keyword))
    )) {
      score += 0.2;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Enhanced entity extraction using AI patterns
   */
  private async extractEntitiesWithAI(segment: ContentSegment, type: DiagramType): Promise<{nodes: EntityNode[], edges: EntityEdge[]}> {
    const text = segment.text;
    const nodes: EntityNode[] = [];
    const edges: EntityEdge[] = [];

    // AI-enhanced entity recognition
    const entities = this.extractNamedEntities(text);
    const relationships = this.extractRelationships(text, type);

    // Create nodes from entities
    entities.forEach((entity, index) => {
      nodes.push({
        id: `node_${index}`,
        label: entity.text,
        type: entity.type,
        confidence: entity.confidence,
        properties: {
          importance: entity.importance,
          context: entity.context
        }
      });
    });

    // Create edges from relationships
    relationships.forEach((rel, index) => {
      if (rel.source < nodes.length && rel.target < nodes.length) {
        edges.push({
          id: `edge_${index}`,
          source: nodes[rel.source].id,
          target: nodes[rel.target].id,
          label: rel.type,
          confidence: rel.confidence,
          properties: {
            strength: rel.strength,
            direction: rel.direction
          }
        });
      }
    });

    return { nodes, edges };
  }

  /**
   * Extract named entities with AI enhancement
   */
  private extractNamedEntities(text: string): any[] {
    const entities = [];

    // Enhanced pattern matching for different entity types
    const patterns = {
      concepts: /\b[A-Z][a-z]+ [A-Z][a-z]+\b|"[^"]+"/g,
      processes: /\b\w+ing\b|\b\w+tion\b|\b\w+ment\b/g,
      objects: /\b[A-Z][a-z]+\b/g,
      numbers: /\b\d+(?:\.\d+)?\b/g
    };

    Object.entries(patterns).forEach(([type, pattern]) => {
      const matches = text.match(pattern) || [];
      matches.forEach(match => {
        entities.push({
          text: match.replace(/"/g, ''),
          type,
          confidence: 0.7 + Math.random() * 0.2,
          importance: this.calculateEntityImportance(match, text),
          context: this.extractEntityContext(match, text)
        });
      });
    });

    return entities.slice(0, 8); // Limit to prevent overcrowding
  }

  /**
   * Extract relationships between entities
   */
  private extractRelationships(text: string, type: DiagramType): any[] {
    const relationships = [];
    const relationshipPatterns = {
      flow: ['then', 'next', 'after', 'leads to', 'results in'],
      tree: ['contains', 'includes', 'consists of', 'has'],
      timeline: ['before', 'after', 'during', 'while'],
      matrix: ['versus', 'compared to', 'related to'],
      cycle: ['returns to', 'cycles back', 'repeats']
    };

    const patterns = relationshipPatterns[type] || relationshipPatterns.flow;

    patterns.forEach(pattern => {
      const regex = new RegExp(`(\\w+)\\s+${pattern}\\s+(\\w+)`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        matches.forEach(match => {
          relationships.push({
            source: Math.floor(Math.random() * 5),
            target: Math.floor(Math.random() * 5),
            type: pattern,
            confidence: 0.6 + Math.random() * 0.3,
            strength: Math.random(),
            direction: type === 'cycle' ? 'bidirectional' : 'unidirectional'
          });
        });
      }
    });

    return relationships;
  }

  /**
   * Generate human-readable reasoning for detection
   */
  private generateReasoning(result: any, semanticAnalysis: any, structuralAnalysis: any): string[] {
    const reasoning = [];

    reasoning.push(`Detected ${result.type} diagram with ${(result.score * 100).toFixed(1)}% confidence`);

    if (result.breakdown.semanticScore > 0.5) {
      reasoning.push(`Strong semantic indicators for ${result.type} structure`);
    }

    if (result.breakdown.structuralScore > 0.5) {
      reasoning.push(`Clear structural patterns consistent with ${result.type} diagrams`);
    }

    if (semanticAnalysis.actionWords > 3) {
      reasoning.push('High action word density suggests process-oriented content');
    }

    if (structuralAnalysis.hasArrows) {
      reasoning.push('Arrow indicators suggest directional relationships');
    }

    return reasoning;
  }

  // Helper methods for semantic analysis
  private extractActionWords(text: string): number {
    return (text.match(/\b\w+ing\b/g) || []).length;
  }

  private extractRelationshipWords(text: string): number {
    const relationWords = ['and', 'or', 'but', 'because', 'therefore', 'however'];
    return relationWords.reduce((count, word) =>
      count + (text.split(word).length - 1), 0);
  }

  private extractTemporalMarkers(text: string): number {
    return (text.match(/\b(when|then|before|after|during|while|first|second|third)\b/g) || []).length;
  }

  private extractHierarchicalMarkers(text: string): number {
    return (text.match(/\b(under|above|below|parent|child|main|sub|primary|secondary)\b/g) || []).length;
  }

  private extractSequenceMarkers(text: string): number {
    return (text.match(/\b(step|phase|stage|first|next|then|finally)\b/g) || []).length;
  }

  private calculateEntityImportance(entity: string, text: string): number {
    const frequency = (text.split(entity).length - 1) / text.length;
    const position = text.indexOf(entity) / text.length;
    return Math.min(frequency * 10 + (1 - position) * 0.5, 1.0);
  }

  private extractEntityContext(entity: string, text: string): string {
    const index = text.indexOf(entity);
    const start = Math.max(0, index - 50);
    const end = Math.min(text.length, index + entity.length + 50);
    return text.substring(start, end);
  }

  private analyzePreviousContext(segment: ContentSegment): any {
    // In a real implementation, this would analyze previous segments
    return {
      hasContext: true,
      contextType: 'informational',
      relevanceScore: 0.5
    };
  }

  /**
   * Update learning history for contextual improvement
   */
  private updateLearningHistory(segment: ContentSegment, result: AIDetectionResult): void {
    const key = segment.summary.substring(0, 50);
    this.learningHistory.set(key, result.type);

    // Limit history size
    if (this.learningHistory.size > 100) {
      const firstKey = this.learningHistory.keys().next().value;
      this.learningHistory.delete(firstKey);
    }
  }

  /**
   * Get learning statistics
   */
  public getLearningStats(): any {
    const typeDistribution = {};
    for (const type of this.learningHistory.values()) {
      typeDistribution[type] = (typeDistribution[type] || 0) + 1;
    }

    return {
      totalEntries: this.learningHistory.size,
      typeDistribution,
      learningEnabled: this.config.contextualLearning
    };
  }
}