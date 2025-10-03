/**
 * 🧠 Semantic Understanding Engine - Iteration 51 Enhancement
 *
 * Advanced semantic analysis for improved content understanding
 * Target: 78% → 88% semantic understanding accuracy
 *
 * Following Custom Instructions Methodology:
 * 1. 小さく作り (Build incrementally)
 * 2. 確実に動作確認 (Verify reliable operation)
 * 3. 疎結合設計 (Loosely coupled design)
 */

import { performance } from 'perf_hooks';

export interface SemanticConcept {
  id: string;
  type: 'entity' | 'relationship' | 'process' | 'property';
  label: string;
  confidence: number;
  context: string[];
  relationships: string[];
  importance: number; // 0-1 scale
}

export interface SemanticGraph {
  concepts: SemanticConcept[];
  relationships: {
    source: string;
    target: string;
    type: string;
    strength: number;
  }[];
  metadata: {
    complexity: number;
    coherence: number;
    abstractness: number;
  };
}

export interface SemanticAnalysisResult {
  graph: SemanticGraph;
  keyInsights: string[];
  suggestedDiagramType: string;
  confidence: number;
  processingTime: number;
}

/**
 * Advanced Semantic Understanding Engine
 * Implements sophisticated natural language understanding for diagram generation
 */
export class SemanticUnderstandingEngine {
  private conceptPatterns: Map<string, RegExp[]> = new Map();
  private relationshipPatterns: Map<string, RegExp[]> = new Map();
  private domainKnowledge: Map<string, string[]> = new Map();

  constructor() {
    this.initializePatterns();
    this.initializeDomainKnowledge();
  }

  /**
   * Main semantic analysis entry point
   */
  async analyze(text: string, context: string = 'general'): Promise<SemanticAnalysisResult> {
    const startTime = performance.now();

    console.log('🧠 Starting semantic analysis...');

    try {
      // Phase 1: Concept Extraction
      const concepts = await this.extractConcepts(text, context);

      // Phase 2: Relationship Detection
      const relationships = await this.detectRelationships(text, concepts);

      // Phase 3: Graph Construction
      const graph = await this.constructSemanticGraph(concepts, relationships);

      // Phase 4: Insight Generation
      const keyInsights = await this.generateKeyInsights(graph, text);

      // Phase 5: Diagram Type Suggestion
      const suggestedDiagramType = await this.suggestDiagramType(graph);

      const processingTime = performance.now() - startTime;

      const result: SemanticAnalysisResult = {
        graph,
        keyInsights,
        suggestedDiagramType,
        confidence: this.calculateConfidence(graph),
        processingTime
      };

      console.log(`✅ Semantic analysis complete (${Math.round(processingTime)}ms)`);
      console.log(`📊 Extracted ${concepts.length} concepts, ${relationships.length} relationships`);

      return result;

    } catch (error) {
      console.error('❌ Semantic analysis error:', error.message);
      throw new Error(`Semantic analysis failed: ${error.message}`);
    }
  }

  /**
   * Extract semantic concepts from text
   */
  private async extractConcepts(text: string, context: string): Promise<SemanticConcept[]> {
    console.log('   📝 Extracting concepts...');

    const concepts: SemanticConcept[] = [];
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();

      // Entity extraction
      const entities = this.extractEntities(sentence);
      concepts.push(...entities.map(entity => ({
        id: `entity-${concepts.length + entity.index}`,
        type: 'entity' as const,
        label: entity.text,
        confidence: entity.confidence,
        context: [sentence],
        relationships: [],
        importance: this.calculateImportance(entity.text, sentence, text)
      })));

      // Process extraction
      const processes = this.extractProcesses(sentence);
      concepts.push(...processes.map(process => ({
        id: `process-${concepts.length + process.index}`,
        type: 'process' as const,
        label: process.text,
        confidence: process.confidence,
        context: [sentence],
        relationships: [],
        importance: this.calculateImportance(process.text, sentence, text)
      })));
    }

    // Deduplicate and merge similar concepts
    const deduplicated = this.deduplicateConcepts(concepts);

    console.log(`   ✅ Extracted ${deduplicated.length} unique concepts`);
    return deduplicated;
  }

  /**
   * Detect relationships between concepts
   */
  private async detectRelationships(text: string, concepts: SemanticConcept[]): Promise<any[]> {
    console.log('   🔗 Detecting relationships...');

    const relationships = [];

    // Pattern-based relationship detection
    for (const pattern of this.relationshipPatterns.keys()) {
      const regex = new RegExp(pattern, 'gi');
      const matches = text.matchAll(regex);

      for (const match of matches) {
        const relationship = this.parseRelationshipMatch(match, concepts);
        if (relationship) {
          relationships.push(relationship);
        }
      }
    }

    // Proximity-based relationship inference
    const proximityRelationships = this.inferProximityRelationships(concepts, text);
    relationships.push(...proximityRelationships);

    console.log(`   ✅ Detected ${relationships.length} relationships`);
    return relationships;
  }

  /**
   * Construct semantic graph from concepts and relationships
   */
  private async constructSemanticGraph(concepts: SemanticConcept[], relationships: any[]): Promise<SemanticGraph> {
    console.log('   🕸️ Constructing semantic graph...');

    const graph: SemanticGraph = {
      concepts,
      relationships,
      metadata: {
        complexity: this.calculateComplexity(concepts, relationships),
        coherence: this.calculateCoherence(concepts, relationships),
        abstractness: this.calculateAbstractness(concepts)
      }
    };

    console.log(`   ✅ Graph constructed with ${concepts.length} nodes, ${relationships.length} edges`);
    return graph;
  }

  /**
   * Generate key insights from semantic graph
   */
  private async generateKeyInsights(graph: SemanticGraph, originalText: string): Promise<string[]> {
    console.log('   💡 Generating insights...');

    const insights: string[] = [];

    // Complexity insight
    if (graph.metadata.complexity > 0.7) {
      insights.push("High complexity content detected - consider hierarchical diagram structure");
    }

    // Coherence insight
    if (graph.metadata.coherence < 0.6) {
      insights.push("Low coherence detected - may benefit from explicit relationship labels");
    }

    // Concept density insight
    const conceptDensity = graph.concepts.length / originalText.split(' ').length;
    if (conceptDensity > 0.1) {
      insights.push("High concept density - information-rich content suitable for detailed diagrams");
    }

    // Main theme identification
    const mainConcepts = graph.concepts
      .filter(c => c.importance > 0.7)
      .map(c => c.label);

    if (mainConcepts.length > 0) {
      insights.push(`Main themes identified: ${mainConcepts.join(', ')}`);
    }

    console.log(`   ✅ Generated ${insights.length} insights`);
    return insights;
  }

  /**
   * Suggest optimal diagram type based on semantic analysis
   */
  private async suggestDiagramType(graph: SemanticGraph): Promise<string> {
    console.log('   🎨 Suggesting diagram type...');

    const processes = graph.concepts.filter(c => c.type === 'process').length;
    const entities = graph.concepts.filter(c => c.type === 'entity').length;
    const relationshipDensity = graph.relationships.length / graph.concepts.length;

    let suggestion = 'concept-map'; // default

    if (processes > entities && relationshipDensity > 1.5) {
      suggestion = 'flowchart';
    } else if (entities > processes && relationshipDensity < 1.0) {
      suggestion = 'hierarchy';
    } else if (graph.metadata.complexity > 0.8) {
      suggestion = 'network-diagram';
    } else if (processes > 0 && relationshipDensity > 1.0) {
      suggestion = 'process-diagram';
    }

    console.log(`   ✅ Suggested diagram type: ${suggestion}`);
    return suggestion;
  }

  /**
   * Initialize concept extraction patterns
   */
  private initializePatterns(): void {
    // Entity patterns
    this.conceptPatterns.set('entities', [
      /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g, // Proper nouns
      /\b(?:system|service|component|module|class|function|method)\b/gi, // Technical entities
      /\b(?:user|customer|client|admin|manager)\b/gi, // User entities
    ]);

    // Process patterns
    this.conceptPatterns.set('processes', [
      /\b(?:create|build|generate|process|analyze|transform|convert)\b/gi,
      /\b(?:sends?|receives?|connects?|transfers?)\b/gi,
      /\b(?:validates?|verifies?|checks?|tests?)\b/gi,
    ]);

    // Relationship patterns
    this.relationshipPatterns.set('causation', [
      /(.+?)\s+(?:causes?|leads? to|results? in)\s+(.+?)(?:\.|,|$)/gi,
      /(.+?)\s+(?:triggers?|initiates?)\s+(.+?)(?:\.|,|$)/gi,
    ]);

    this.relationshipPatterns.set('composition', [
      /(.+?)\s+(?:contains?|includes?|comprises?)\s+(.+?)(?:\.|,|$)/gi,
      /(.+?)\s+(?:consists? of|is made of)\s+(.+?)(?:\.|,|$)/gi,
    ]);
  }

  /**
   * Initialize domain knowledge for enhanced understanding
   */
  private initializeDomainKnowledge(): void {
    this.domainKnowledge.set('software', [
      'API', 'database', 'server', 'client', 'framework', 'library',
      'authentication', 'authorization', 'microservice', 'container'
    ]);

    this.domainKnowledge.set('business', [
      'workflow', 'process', 'stakeholder', 'requirement', 'objective',
      'strategy', 'organization', 'department', 'team', 'role'
    ]);

    this.domainKnowledge.set('technical', [
      'algorithm', 'data structure', 'protocol', 'interface', 'implementation',
      'architecture', 'design pattern', 'optimization', 'performance'
    ]);
  }

  // Helper methods for semantic analysis
  private extractEntities(sentence: string): Array<{text: string, confidence: number, index: number}> {
    const entities = [];
    const patterns = this.conceptPatterns.get('entities') || [];

    for (const pattern of patterns) {
      const matches = sentence.matchAll(pattern);
      for (const match of matches) {
        entities.push({
          text: match[0],
          confidence: 0.8,
          index: match.index || 0
        });
      }
    }

    return entities;
  }

  private extractProcesses(sentence: string): Array<{text: string, confidence: number, index: number}> {
    const processes = [];
    const patterns = this.conceptPatterns.get('processes') || [];

    for (const pattern of patterns) {
      const matches = sentence.matchAll(pattern);
      for (const match of matches) {
        processes.push({
          text: match[0],
          confidence: 0.7,
          index: match.index || 0
        });
      }
    }

    return processes;
  }

  private calculateImportance(concept: string, sentence: string, fullText: string): number {
    // Simple importance calculation based on frequency and position
    const frequency = (fullText.toLowerCase().match(new RegExp(concept.toLowerCase(), 'g')) || []).length;
    const position = fullText.toLowerCase().indexOf(concept.toLowerCase()) / fullText.length;
    const positionWeight = 1 - position; // Earlier = more important

    return Math.min(1, (frequency * 0.3 + positionWeight * 0.7));
  }

  private deduplicateConcepts(concepts: SemanticConcept[]): SemanticConcept[] {
    const unique = new Map<string, SemanticConcept>();

    for (const concept of concepts) {
      const key = concept.label.toLowerCase();
      const existing = unique.get(key);

      if (!existing || concept.confidence > existing.confidence) {
        unique.set(key, concept);
      }
    }

    return Array.from(unique.values());
  }

  private parseRelationshipMatch(match: RegExpMatchArray, concepts: SemanticConcept[]): any | null {
    // Extract relationship from regex match
    if (match.length >= 3) {
      const source = match[1]?.trim();
      const target = match[2]?.trim();

      if (source && target) {
        return {
          source: source,
          target: target,
          type: 'causation',
          strength: 0.8
        };
      }
    }
    return null;
  }

  private inferProximityRelationships(concepts: SemanticConcept[], text: string): any[] {
    const relationships = [];

    // Simple proximity-based relationship inference
    for (let i = 0; i < concepts.length - 1; i++) {
      for (let j = i + 1; j < concepts.length; j++) {
        const concept1 = concepts[i];
        const concept2 = concepts[j];

        // Check if concepts appear in the same context
        const sharedContext = concept1.context.some(c1 =>
          concept2.context.some(c2 => c1 === c2)
        );

        if (sharedContext) {
          relationships.push({
            source: concept1.id,
            target: concept2.id,
            type: 'related',
            strength: 0.5
          });
        }
      }
    }

    return relationships;
  }

  private calculateComplexity(concepts: SemanticConcept[], relationships: any[]): number {
    const conceptCount = concepts.length;
    const relationshipCount = relationships.length;
    const density = relationshipCount / Math.max(1, conceptCount);

    return Math.min(1, density / 2); // Normalize to 0-1
  }

  private calculateCoherence(concepts: SemanticConcept[], relationships: any[]): number {
    const totalConcepts = concepts.length;
    const connectedConcepts = new Set();

    relationships.forEach(rel => {
      connectedConcepts.add(rel.source);
      connectedConcepts.add(rel.target);
    });

    return totalConcepts > 0 ? connectedConcepts.size / totalConcepts : 0;
  }

  private calculateAbstractness(concepts: SemanticConcept[]): number {
    const abstractConcepts = concepts.filter(c =>
      c.type === 'property' || c.label.match(/\b(concept|idea|principle|strategy)\b/i)
    );

    return concepts.length > 0 ? abstractConcepts.length / concepts.length : 0;
  }

  private calculateConfidence(graph: SemanticGraph): number {
    const avgConceptConfidence = graph.concepts.reduce((sum, c) => sum + c.confidence, 0) / graph.concepts.length;
    const coherenceBonus = graph.metadata.coherence * 0.2;

    return Math.min(1, avgConceptConfidence + coherenceBonus);
  }
}

export default SemanticUnderstandingEngine;