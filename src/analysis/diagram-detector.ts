import { DiagramType, NodeDatum, EdgeDatum } from '@/types/diagram';
import { ContentSegment, DiagramAnalysis, KeywordAnalysis, SemanticRelation } from './types';

/**
 * Diagram Type Detection Engine - Iterative Implementation
 * Analyzes content segments to determine appropriate diagram types and extract entities/relationships
 */
export class DiagramDetector {
  private iteration: number = 1;

  /**
   * Analyze content segment and determine diagram type with entities
   */
  async analyze(segment: ContentSegment): Promise<DiagramAnalysis> {
    const startTime = performance.now();
    console.log(`[Diagram Detection V${this.iteration}] Analyzing: "${segment.summary}"`);

    try {
      // Iteration 1: Rule-based detection
      let analysis = await this.ruleBasedDetection(segment);

      // Iteration 2+: Statistical analysis
      if (this.iteration > 1) {
        analysis = await this.statisticalAnalysis(segment, analysis);
      }

      // Iteration 3+: Hybrid approach
      if (this.iteration > 2) {
        analysis = await this.hybridAnalysis(segment, analysis);
      }

      const processingTime = performance.now() - startTime;
      console.log(`[V${this.iteration}] Detected ${analysis.type} (confidence: ${(analysis.confidence * 100).toFixed(1)}%) in ${processingTime.toFixed(0)}ms`);

      await this.evaluateDetection(analysis, processingTime);
      return analysis;

    } catch (error) {
      console.error('[Diagram Detection] Error:', error);
      return {
        type: 'flow',
        confidence: 0,
        nodes: [],
        edges: [],
        reasoning: 'Error in analysis'
      };
    }
  }

  /**
   * Iteration 1: Rule-based diagram type detection
   */
  private async ruleBasedDetection(segment: ContentSegment): Promise<DiagramAnalysis> {
    console.log(`[V${this.iteration}] Applying rule-based detection...`);

    const text = segment.text.toLowerCase();
    const keyphrases = segment.keyphrases.map(kp => kp.toLowerCase());

    // Define keyword patterns for different diagram types with weights
    const patterns = {
      flow: {
        primary: ['process', 'workflow', 'pipeline', 'procedure', 'sequence'],
        secondary: ['step', 'flow', 'first', 'next', 'then', 'finally', 'after', 'before', 'follows'],
        context: ['data', 'information', 'system', 'through', 'input', 'output']
      },
      tree: {
        primary: ['hierarchy', 'organization', 'structure', 'taxonomy'],
        secondary: ['parent', 'child', 'branch', 'root', 'category', 'classification', 'breakdown'],
        context: ['levels', 'components', 'parts', 'subdivide', 'organize']
      },
      timeline: {
        primary: ['timeline', 'chronology', 'history', 'evolution'],
        secondary: ['development', 'year', 'month', 'date', 'time', 'period', 'era', 'phase'],
        context: ['when', 'during', 'since', 'until', 'progress', 'stages']
      },
      matrix: {
        primary: ['comparison', 'matrix', 'table', 'versus'],
        secondary: ['against', 'compare', 'criteria', 'features', 'properties', 'characteristics'],
        context: ['different', 'similar', 'options', 'alternatives', 'choices']
      },
      cycle: {
        primary: ['cycle', 'loop', 'circular', 'recurring'],
        secondary: ['repeat', 'iteration', 'continuous', 'ongoing', 'cyclical', 'returns'],
        context: ['back', 'again', 'repeatedly', 'continuous', 'infinite']
      }
    };

    // Calculate weighted scores for each diagram type
    const scores: Record<DiagramType, number> = {
      flow: 0,
      tree: 0,
      timeline: 0,
      matrix: 0,
      cycle: 0
    };

    for (const [diagramType, patternSet] of Object.entries(patterns)) {
      const type = diagramType as DiagramType;

      // Primary keywords (highest weight)
      for (const keyword of patternSet.primary) {
        if (text.includes(keyword)) {
          scores[type] += 5;
        }
        if (keyphrases.some(kp => kp.includes(keyword))) {
          scores[type] += 8; // Even higher for keyphrases
        }
      }

      // Secondary keywords (medium weight)
      for (const keyword of patternSet.secondary) {
        if (text.includes(keyword)) {
          scores[type] += 2;
        }
        if (keyphrases.some(kp => kp.includes(keyword))) {
          scores[type] += 4;
        }
      }

      // Context keywords (lower weight)
      for (const keyword of patternSet.context) {
        if (text.includes(keyword)) {
          scores[type] += 1;
        }
        if (keyphrases.some(kp => kp.includes(keyword))) {
          scores[type] += 2;
        }
      }
    }

    // Find the best match
    const bestType = Object.entries(scores).reduce((best, [type, score]) =>
      score > best.score ? { type: type as DiagramType, score } : best,
      { type: 'flow' as DiagramType, score: 0 }
    );

    // Extract entities and relationships
    const { nodes, edges } = await this.extractEntitiesAndRelationships(segment, bestType.type);

    // Improved confidence calculation
    const maxPossibleScore = 8 + 4 + 2; // Max primary + secondary + context
    const confidence = Math.min(bestType.score / maxPossibleScore, 1);

    // Boost confidence if multiple diagram indicators are present
    const nonZeroScores = Object.values(scores).filter(s => s > 0).length;
    const adjustedConfidence = nonZeroScores === 1 ? confidence * 1.2 : confidence;

    return {
      type: bestType.type,
      confidence: Math.min(adjustedConfidence, 1),
      nodes,
      edges,
      reasoning: `Weighted detection: ${bestType.score} points for ${bestType.type} (confidence: ${(adjustedConfidence * 100).toFixed(1)}%)`
    };
  }

  /**
   * Extract nodes and edges from content based on diagram type
   */
  private async extractEntitiesAndRelationships(
    segment: ContentSegment,
    diagramType: DiagramType
  ): Promise<{ nodes: NodeDatum[]; edges: EdgeDatum[] }> {
    const text = segment.text;
    const nodes: NodeDatum[] = [];
    const edges: EdgeDatum[] = [];

    // Simple entity extraction based on keyphrases and common patterns
    const entities = this.extractEntities(text, segment.keyphrases);

    // Create nodes from entities
    entities.forEach((entity, index) => {
      nodes.push({
        id: `node_${index}`,
        label: entity.term,
        meta: {
          importance: entity.importance,
          category: this.categorizeEntity(entity.term, diagramType)
        }
      });
    });

    // Create edges based on diagram type and text analysis
    const relationships = this.extractRelationships(text, entities, diagramType);
    relationships.forEach((rel, index) => {
      const fromNode = nodes.find(n => n.label.toLowerCase().includes(rel.subject.toLowerCase()));
      const toNode = nodes.find(n => n.label.toLowerCase().includes(rel.object.toLowerCase()));

      if (fromNode && toNode) {
        edges.push({
          from: fromNode.id,
          to: toNode.id,
          label: rel.relation
        });
      }
    });

    // Ensure minimum viable diagram
    if (nodes.length < 2) {
      this.addFallbackNodes(nodes, segment.keyphrases);
    }

    return { nodes, edges };
  }

  /**
   * Extract entities from text using keyword analysis
   */
  private extractEntities(text: string, keyphrases: string[]): KeywordAnalysis[] {
    const entities: KeywordAnalysis[] = [];

    // Add keyphrases as primary entities
    keyphrases.forEach(phrase => {
      entities.push({
        term: phrase,
        frequency: this.countOccurrences(text, phrase),
        importance: 0.8,
        context: this.extractContext(text, phrase)
      });
    });

    // Extract additional entities using simple NLP patterns
    const capitalizedWords = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
    const uniqueCapitalized = [...new Set(capitalizedWords)]
      .filter(word => word.length > 3 && !this.isCommonWord(word));

    uniqueCapitalized.forEach(word => {
      if (!entities.some(e => e.term.toLowerCase() === word.toLowerCase())) {
        entities.push({
          term: word,
          frequency: this.countOccurrences(text, word),
          importance: 0.6,
          context: this.extractContext(text, word)
        });
      }
    });

    return entities.sort((a, b) => b.importance * b.frequency - a.importance * a.frequency);
  }

  /**
   * Extract relationships based on simple pattern matching
   */
  private extractRelationships(
    text: string,
    entities: KeywordAnalysis[],
    diagramType: DiagramType
  ): SemanticRelation[] {
    const relationships: SemanticRelation[] = [];

    // Define relationship patterns based on diagram type
    const relationPatterns = {
      flow: ['leads to', 'results in', 'followed by', 'then', 'next'],
      tree: ['contains', 'includes', 'part of', 'under', 'parent'],
      timeline: ['before', 'after', 'during', 'preceded by', 'followed by'],
      matrix: ['versus', 'compared to', 'against', 'different from'],
      cycle: ['returns to', 'cycles back', 'repeats', 'continues to']
    };

    const patterns = relationPatterns[diagramType] || relationPatterns.flow;

    // Simple relationship extraction
    for (let i = 0; i < entities.length - 1; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const entity1 = entities[i];
        const entity2 = entities[j];

        // Look for relationship indicators between entities
        const relationMatch = this.findRelationBetweenEntities(text, entity1.term, entity2.term, patterns);

        if (relationMatch) {
          relationships.push({
            subject: entity1.term,
            relation: relationMatch,
            object: entity2.term,
            confidence: 0.7
          });
        }
      }
    }

    return relationships;
  }

  /**
   * Helper methods
   */
  private countOccurrences(text: string, term: string): number {
    return (text.toLowerCase().match(new RegExp(term.toLowerCase(), 'g')) || []).length;
  }

  private extractContext(text: string, term: string): string[] {
    const sentences = text.split(/[.!?]+/);
    return sentences.filter(sentence =>
      sentence.toLowerCase().includes(term.toLowerCase())
    ).map(s => s.trim()).slice(0, 2);
  }

  private isCommonWord(word: string): boolean {
    const commonWords = ['The', 'This', 'That', 'With', 'From', 'They', 'Were', 'Been', 'Have', 'Will'];
    return commonWords.includes(word);
  }

  private categorizeEntity(term: string, diagramType: DiagramType): string {
    // Simple categorization based on diagram type
    const categories = {
      flow: 'process',
      tree: 'node',
      timeline: 'event',
      matrix: 'item',
      cycle: 'stage'
    };
    return categories[diagramType] || 'entity';
  }

  private findRelationBetweenEntities(text: string, entity1: string, entity2: string, patterns: string[]): string | null {
    const lowerText = text.toLowerCase();
    const pos1 = lowerText.indexOf(entity1.toLowerCase());
    const pos2 = lowerText.indexOf(entity2.toLowerCase());

    if (pos1 === -1 || pos2 === -1) return null;

    const start = Math.min(pos1, pos2);
    const end = Math.max(pos1, pos2) + Math.max(entity1.length, entity2.length);
    const contextText = text.substring(start, end);

    for (const pattern of patterns) {
      if (contextText.toLowerCase().includes(pattern)) {
        return pattern;
      }
    }

    // Default relationship based on position
    return pos1 < pos2 ? 'leads to' : 'preceded by';
  }

  private addFallbackNodes(nodes: NodeDatum[], keyphrases: string[]): void {
    if (keyphrases.length === 0) {
      nodes.push(
        { id: 'node_0', label: 'Main Topic', meta: { importance: 1 } },
        { id: 'node_1', label: 'Sub Topic', meta: { importance: 0.8 } }
      );
    } else {
      keyphrases.slice(0, 3).forEach((phrase, index) => {
        if (!nodes.some(n => n.label === phrase)) {
          nodes.push({
            id: `node_${nodes.length}`,
            label: phrase,
            meta: { importance: 0.7 - index * 0.1 }
          });
        }
      });
    }
  }

  /**
   * Iteration 2+: Statistical analysis for improved detection
   */
  private async statisticalAnalysis(segment: ContentSegment, baseAnalysis: DiagramAnalysis): Promise<DiagramAnalysis> {
    console.log(`[V${this.iteration}] Applying statistical analysis...`);

    // TODO: Implement statistical improvements
    // - TF-IDF scoring for better keyword detection
    // - N-gram analysis for pattern recognition
    // - Confidence scoring based on multiple factors

    return baseAnalysis;
  }

  /**
   * Iteration 3+: Hybrid approach combining multiple methods
   */
  private async hybridAnalysis(segment: ContentSegment, baseAnalysis: DiagramAnalysis): Promise<DiagramAnalysis> {
    console.log(`[V${this.iteration}] Applying hybrid analysis...`);

    // TODO: Implement hybrid approach
    // - Combine rule-based, statistical, and ML approaches
    // - Weighted voting system
    // - Context-aware analysis

    return baseAnalysis;
  }

  /**
   * Evaluate detection quality
   */
  private async evaluateDetection(analysis: DiagramAnalysis, processingTime: number): Promise<void> {
    const metrics = {
      confidence: analysis.confidence,
      nodeCount: analysis.nodes.length,
      edgeCount: analysis.edges.length,
      hasValidStructure: analysis.nodes.length >= 2,
      processingTime
    };

    console.log('\n📊 Detection Metrics:');
    console.log(`- Type: ${analysis.type}`);
    console.log(`- Confidence: ${(metrics.confidence * 100).toFixed(1)}%`);
    console.log(`- Nodes: ${metrics.nodeCount}`);
    console.log(`- Edges: ${metrics.edgeCount}`);
    console.log(`- Processing Time: ${metrics.processingTime.toFixed(0)}ms`);

    const successCriteria = {
      hasStructure: metrics.hasValidStructure,
      goodConfidence: metrics.confidence > 0.5,
      hasContent: metrics.nodeCount > 0
    };

    const success = Object.values(successCriteria).every(v => v);
    console.log(success ? '✅ Detection successful' : '⚠️ Detection needs improvement');
  }

  /**
   * Method to increment iteration for testing improvements
   */
  public nextIteration(): void {
    this.iteration++;
    console.log(`🔄 Moving to detection iteration ${this.iteration}`);
  }
}