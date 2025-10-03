/**
 * Advanced Semantic Diagram Detection System
 * Uses sophisticated NLP techniques and pattern recognition for accurate diagram type detection
 * Supports technical content, business processes, academic concepts, and more
 */

import { DiagramType, NodeDatum, EdgeDatum } from '@/types/diagram';
import { ContentSegment, DiagramAnalysis } from './types';

interface SemanticPattern {
  type: DiagramType;
  primaryKeywords: string[];
  secondaryKeywords: string[];
  contextKeywords: string[];
  structuralPatterns: RegExp[];
  confidence: number;
  weight: number;
}

interface EntityExtraction {
  entities: string[];
  relationships: Array<{ source: string; target: string; type: string }>;
  concepts: string[];
  actions: string[];
  temporal: string[];
}

interface ContextAnalysis {
  domain: string;
  complexity: number;
  technicalLevel: number;
  businessLevel: number;
  academicLevel: number;
  proceduralLevel: number;
}

export class AdvancedSemanticDetector {
  private semanticPatterns: SemanticPattern[];
  private stopWords: Set<string>;
  private technicalTerms: Map<string, string>;
  private businessTerms: Map<string, string>;
  private processIndicators: string[];
  private hierarchyIndicators: string[];
  private temporalIndicators: string[];

  constructor() {
    this.initializeSemanticPatterns();
    this.initializeStopWords();
    this.initializeDomainTerms();
    this.initializeIndicators();
  }

  /**
   * Analyze content segment with advanced semantic understanding
   */
  async analyze(segment: ContentSegment): Promise<DiagramAnalysis> {
    console.log(`[Advanced Semantic] Analyzing: "${segment.summary.substring(0, 60)}..."`);

    try {
      // Stage 1: Context Analysis
      const context = this.analyzeContext(segment);

      // Stage 2: Entity Extraction
      const entities = this.extractEntities(segment);

      // Stage 3: Pattern Matching
      const patternScores = this.calculatePatternScores(segment, context, entities);

      // Stage 4: Advanced Reasoning
      const reasoningResult = this.applyAdvancedReasoning(segment, context, entities, patternScores);

      // Stage 5: Graph Construction
      const { nodes, edges } = this.constructGraph(entities, reasoningResult.type, context);

      // Stage 6: Confidence Calculation
      const confidence = this.calculateConfidence(reasoningResult, patternScores, entities, nodes);

      const analysis: DiagramAnalysis = {
        type: reasoningResult.type,
        nodes,
        edges,
        confidence,
        reasoning: reasoningResult.reasoning,
        context: context,
        entities: entities
      };

      console.log(`[Advanced Semantic] Detected ${analysis.type} (confidence: ${(confidence * 100).toFixed(1)}%)`);
      return analysis;

    } catch (error) {
      console.error('[Advanced Semantic] Analysis failed:', error);
      return this.createFallbackAnalysis(segment);
    }
  }

  /**
   * Initialize comprehensive semantic patterns
   */
  private initializeSemanticPatterns(): void {
    this.semanticPatterns = [
      {
        type: 'flow',
        primaryKeywords: ['process', 'workflow', 'pipeline', 'flow', 'procedure', 'steps', 'sequence'],
        secondaryKeywords: ['input', 'output', 'transform', 'execute', 'process', 'handle', 'move', 'transfer'],
        contextKeywords: ['data', 'information', 'system', 'operation', 'function', 'method'],
        structuralPatterns: [
          /\b(first|then|next|after|before|finally|lastly)\b/gi,
          /\b(step \d+|stage \d+|phase \d+)\b/gi,
          /\b(input|output|transform|process)\b/gi
        ],
        confidence: 0.85,
        weight: 1.0
      },
      {
        type: 'tree',
        primaryKeywords: ['hierarchy', 'organization', 'structure', 'tree', 'taxonomy', 'classification'],
        secondaryKeywords: ['parent', 'child', 'branch', 'root', 'leaf', 'category', 'subcategory', 'level'],
        contextKeywords: ['organization', 'company', 'department', 'division', 'group', 'team', 'family'],
        structuralPatterns: [
          /\b(ceo|manager|director|supervisor|lead|head)\b/gi,
          /\b(under|above|reports to|manages|oversees)\b/gi,
          /\b(department|division|unit|section|group)\b/gi
        ],
        confidence: 0.80,
        weight: 1.0
      },
      {
        type: 'timeline',
        primaryKeywords: ['timeline', 'chronology', 'history', 'evolution', 'development', 'progression'],
        secondaryKeywords: ['year', 'month', 'date', 'time', 'period', 'era', 'epoch', 'phase'],
        contextKeywords: ['when', 'during', 'since', 'until', 'before', 'after', 'while'],
        structuralPatterns: [
          /\b(\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})\b/g,
          /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi,
          /\b(q1|q2|q3|q4|quarter)\b/gi
        ],
        confidence: 0.90,
        weight: 1.2
      },
      {
        type: 'matrix',
        primaryKeywords: ['comparison', 'matrix', 'table', 'grid', 'versus', 'compare'],
        secondaryKeywords: ['criteria', 'features', 'properties', 'characteristics', 'attributes', 'dimensions'],
        contextKeywords: ['different', 'similar', 'options', 'alternatives', 'choices', 'evaluate'],
        structuralPatterns: [
          /\b(vs|versus|compared to|against)\b/gi,
          /\b(pros and cons|advantages and disadvantages)\b/gi,
          /\b(option [a-z]|alternative \d+)\b/gi
        ],
        confidence: 0.75,
        weight: 0.9
      },
      {
        type: 'cycle',
        primaryKeywords: ['cycle', 'loop', 'circular', 'recurring', 'iterative', 'repeating'],
        secondaryKeywords: ['repeat', 'iteration', 'continuous', 'ongoing', 'cyclical', 'circular'],
        contextKeywords: ['back', 'again', 'repeatedly', 'continuous', 'infinite', 'periodic'],
        structuralPatterns: [
          /\b(repeat|cycle|loop|iterate)\b/gi,
          /\b(back to|return to|repeat)\b/gi,
          /\b(continuous|ongoing|perpetual)\b/gi
        ],
        confidence: 0.70,
        weight: 0.8
      },
      // Advanced diagram types
      {
        type: 'network',
        primaryKeywords: ['network', 'graph', 'connection', 'relationship', 'link', 'node'],
        secondaryKeywords: ['connect', 'linked', 'related', 'associated', 'network', 'web'],
        contextKeywords: ['system', 'infrastructure', 'topology', 'architecture', 'communication'],
        structuralPatterns: [
          /\b(server|client|node|endpoint)\b/gi,
          /\b(connected to|linked with|communicates with)\b/gi
        ],
        confidence: 0.80,
        weight: 1.0
      },
      {
        type: 'venn',
        primaryKeywords: ['overlap', 'intersection', 'common', 'shared', 'both', 'neither'],
        secondaryKeywords: ['set', 'group', 'category', 'union', 'intersection', 'difference'],
        contextKeywords: ['similarities', 'differences', 'overlap', 'unique', 'exclusive'],
        structuralPatterns: [
          /\b(both .+ and .+|neither .+ nor .+)\b/gi,
          /\b(overlap|intersect|common)\b/gi
        ],
        confidence: 0.75,
        weight: 0.9
      }
    ];
  }

  /**
   * Initialize stop words for filtering
   */
  private initializeStopWords(): void {
    this.stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
      'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after',
      'above', 'below', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further',
      'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any',
      'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
      'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will',
      'just', 'should', 'now'
    ]);
  }

  /**
   * Initialize domain-specific terms
   */
  private initializeDomainTerms(): void {
    this.technicalTerms = new Map([
      ['algorithm', 'technical'],
      ['database', 'technical'],
      ['server', 'technical'],
      ['api', 'technical'],
      ['framework', 'technical'],
      ['architecture', 'technical'],
      ['deployment', 'technical'],
      ['infrastructure', 'technical'],
      ['microservice', 'technical'],
      ['container', 'technical'],
      ['kubernetes', 'technical'],
      ['docker', 'technical'],
      ['cloud', 'technical'],
      ['machine learning', 'technical'],
      ['artificial intelligence', 'technical'],
      ['neural network', 'technical'],
      ['data science', 'technical'],
      ['blockchain', 'technical'],
      ['cryptocurrency', 'technical']
    ]);

    this.businessTerms = new Map([
      ['revenue', 'business'],
      ['profit', 'business'],
      ['customer', 'business'],
      ['market', 'business'],
      ['sales', 'business'],
      ['marketing', 'business'],
      ['strategy', 'business'],
      ['stakeholder', 'business'],
      ['roi', 'business'],
      ['kpi', 'business'],
      ['budget', 'business'],
      ['forecast', 'business'],
      ['quarter', 'business'],
      ['pipeline', 'business'],
      ['funnel', 'business'],
      ['conversion', 'business'],
      ['acquisition', 'business'],
      ['retention', 'business']
    ]);
  }

  /**
   * Initialize structural indicators
   */
  private initializeIndicators(): void {
    this.processIndicators = [
      'first', 'second', 'third', 'then', 'next', 'after', 'before', 'finally',
      'step', 'stage', 'phase', 'process', 'procedure', 'workflow', 'pipeline'
    ];

    this.hierarchyIndicators = [
      'ceo', 'manager', 'director', 'supervisor', 'lead', 'head', 'chief',
      'reports to', 'manages', 'oversees', 'under', 'above', 'department',
      'division', 'unit', 'section', 'group', 'team', 'organization'
    ];

    this.temporalIndicators = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december',
      'year', 'month', 'day', 'week', 'quarter', 'q1', 'q2', 'q3', 'q4',
      'timeline', 'history', 'evolution', 'development', 'progression'
    ];
  }

  /**
   * Analyze context and domain of the content
   */
  private analyzeContext(segment: ContentSegment): ContextAnalysis {
    const text = segment.text.toLowerCase();
    const words = this.tokenize(text);

    let technicalScore = 0;
    let businessScore = 0;
    let academicScore = 0;
    let proceduralScore = 0;

    // Calculate domain scores
    words.forEach(word => {
      if (this.technicalTerms.has(word)) technicalScore++;
      if (this.businessTerms.has(word)) businessScore++;
      if (this.processIndicators.includes(word)) proceduralScore++;
    });

    // Academic indicators
    const academicPatterns = [
      /\b(study|research|analysis|experiment|hypothesis|theory|methodology)\b/gi,
      /\b(university|college|academic|scholar|professor|student)\b/gi,
      /\b(paper|journal|publication|citation|reference)\b/gi
    ];

    academicPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) academicScore += matches.length;
    });

    const totalWords = words.length;
    const domain = this.determineDomain(technicalScore, businessScore, academicScore, proceduralScore);

    return {
      domain,
      complexity: this.calculateComplexity(words, text),
      technicalLevel: technicalScore / totalWords,
      businessLevel: businessScore / totalWords,
      academicLevel: academicScore / totalWords,
      proceduralLevel: proceduralScore / totalWords
    };
  }

  /**
   * Extract entities and relationships from text
   */
  private extractEntities(segment: ContentSegment): EntityExtraction {
    const text = segment.text;
    const words = this.tokenize(text.toLowerCase());

    // Extract entities (nouns and noun phrases)
    const entities = this.extractNouns(text);

    // Extract relationships
    const relationships = this.extractRelationships(text, entities);

    // Extract concepts (abstract nouns)
    const concepts = this.extractConcepts(words);

    // Extract actions (verbs)
    const actions = this.extractActions(text);

    // Extract temporal elements
    const temporal = this.extractTemporal(text);

    return {
      entities,
      relationships,
      concepts,
      actions,
      temporal
    };
  }

  /**
   * Calculate pattern scores for each diagram type
   */
  private calculatePatternScores(
    segment: ContentSegment,
    context: ContextAnalysis,
    entities: EntityExtraction
  ): Map<DiagramType, number> {
    const scores = new Map<DiagramType, number>();
    const text = segment.text.toLowerCase();

    this.semanticPatterns.forEach(pattern => {
      let score = 0;

      // Primary keyword scoring
      const primaryMatches = pattern.primaryKeywords.filter(keyword =>
        text.includes(keyword.toLowerCase())
      ).length;
      score += primaryMatches * 3;

      // Secondary keyword scoring
      const secondaryMatches = pattern.secondaryKeywords.filter(keyword =>
        text.includes(keyword.toLowerCase())
      ).length;
      score += secondaryMatches * 2;

      // Context keyword scoring
      const contextMatches = pattern.contextKeywords.filter(keyword =>
        text.includes(keyword.toLowerCase())
      ).length;
      score += contextMatches;

      // Structural pattern scoring
      pattern.structuralPatterns.forEach(regex => {
        const matches = text.match(regex);
        if (matches) score += matches.length * 2;
      });

      // Domain context adjustment
      if (pattern.type === 'flow' && context.proceduralLevel > 0.1) score *= 1.2;
      if (pattern.type === 'tree' && context.businessLevel > 0.1) score *= 1.3;
      if (pattern.type === 'timeline' && entities.temporal.length > 0) score *= 1.5;

      // Apply pattern weight and confidence
      score *= pattern.weight * pattern.confidence;

      scores.set(pattern.type, score);
    });

    return scores;
  }

  /**
   * Apply advanced reasoning to determine final diagram type
   */
  private applyAdvancedReasoning(
    segment: ContentSegment,
    context: ContextAnalysis,
    entities: EntityExtraction,
    patternScores: Map<DiagramType, number>
  ): { type: DiagramType; reasoning: string } {
    // Find top scoring patterns
    const sortedScores = Array.from(patternScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    const topType = sortedScores[0][0];
    const topScore = sortedScores[0][1];

    // Advanced reasoning rules
    let finalType = topType;
    let reasoning = `Primary match: ${topType} (score: ${topScore.toFixed(2)})`;

    // Rule 1: Strong temporal indicators override other patterns
    if (entities.temporal.length > 2 && topType !== 'timeline') {
      finalType = 'timeline';
      reasoning = `Temporal override: ${entities.temporal.length} temporal indicators found`;
    }

    // Rule 2: Hierarchical structures in business context
    else if (context.businessLevel > 0.15 && entities.relationships.some(r =>
      r.type.includes('manage') || r.type.includes('report'))) {
      finalType = 'tree';
      reasoning = `Business hierarchy detected: management relationships found`;
    }

    // Rule 3: Process flows with sequential actions
    else if (entities.actions.length > 3 && context.proceduralLevel > 0.2) {
      finalType = 'flow';
      reasoning = `Process flow detected: ${entities.actions.length} actions with sequential indicators`;
    }

    // Rule 4: Comparison context
    else if (segment.text.toLowerCase().includes('compare') ||
             segment.text.toLowerCase().includes('versus') ||
             segment.text.toLowerCase().includes('vs')) {
      finalType = 'matrix';
      reasoning = `Comparison context detected`;
    }

    // Rule 5: Network/system architecture
    else if (context.technicalLevel > 0.2 && entities.entities.some(e =>
      ['server', 'client', 'node', 'service', 'component'].some(term =>
        e.toLowerCase().includes(term)))) {
      finalType = 'network';
      reasoning = `Technical network architecture detected`;
    }

    return { type: finalType, reasoning };
  }

  /**
   * Construct graph nodes and edges based on entities and diagram type
   */
  private constructGraph(
    entities: EntityExtraction,
    diagramType: DiagramType,
    context: ContextAnalysis
  ): { nodes: NodeDatum[]; edges: EdgeDatum[] } {
    const nodes: NodeDatum[] = [];
    const edges: EdgeDatum[] = [];

    switch (diagramType) {
      case 'flow':
        return this.constructFlowGraph(entities);
      case 'tree':
        return this.constructTreeGraph(entities);
      case 'timeline':
        return this.constructTimelineGraph(entities);
      case 'matrix':
        return this.constructMatrixGraph(entities);
      case 'cycle':
        return this.constructCycleGraph(entities);
      case 'network':
        return this.constructNetworkGraph(entities);
      default:
        return this.constructGenericGraph(entities);
    }
  }

  /**
   * Construct flow diagram graph
   */
  private constructFlowGraph(entities: EntityExtraction): { nodes: NodeDatum[]; edges: EdgeDatum[] } {
    const nodes: NodeDatum[] = [];
    const edges: EdgeDatum[] = [];

    // Create nodes from actions and key entities
    const processNodes = [...entities.actions.slice(0, 5), ...entities.entities.slice(0, 3)];

    processNodes.forEach((entity, index) => {
      nodes.push({
        id: `node-${index}`,
        label: this.capitalizeWords(entity)
      });
    });

    // Create sequential edges
    for (let i = 0; i < nodes.length - 1; i++) {
      edges.push({
        source: nodes[i].id,
        target: nodes[i + 1].id,
        label: 'flows to'
      });
    }

    return { nodes, edges };
  }

  /**
   * Construct tree diagram graph
   */
  private constructTreeGraph(entities: EntityExtraction): { nodes: NodeDatum[]; edges: EdgeDatum[] } {
    const nodes: NodeDatum[] = [];
    const edges: EdgeDatum[] = [];

    // Root node from main entities
    if (entities.entities.length > 0) {
      nodes.push({
        id: 'root',
        label: this.capitalizeWords(entities.entities[0])
      });

      // Child nodes
      entities.entities.slice(1, 5).forEach((entity, index) => {
        const nodeId = `child-${index}`;
        nodes.push({
          id: nodeId,
          label: this.capitalizeWords(entity)
        });

        edges.push({
          source: 'root',
          target: nodeId,
          label: 'includes'
        });
      });
    }

    return { nodes, edges };
  }

  /**
   * Construct timeline diagram graph
   */
  private constructTimelineGraph(entities: EntityExtraction): { nodes: NodeDatum[]; edges: EdgeDatum[] } {
    const nodes: NodeDatum[] = [];
    const edges: EdgeDatum[] = [];

    // Create nodes from temporal elements and events
    const timelineEvents = [...entities.temporal, ...entities.concepts].slice(0, 5);

    timelineEvents.forEach((event, index) => {
      nodes.push({
        id: `event-${index}`,
        label: this.capitalizeWords(event)
      });
    });

    // Create chronological edges
    for (let i = 0; i < nodes.length - 1; i++) {
      edges.push({
        source: nodes[i].id,
        target: nodes[i + 1].id,
        label: 'then'
      });
    }

    return { nodes, edges };
  }

  /**
   * Construct matrix diagram graph
   */
  private constructMatrixGraph(entities: EntityExtraction): { nodes: NodeDatum[]; edges: EdgeDatum[] } {
    const nodes: NodeDatum[] = [];
    const edges: EdgeDatum[] = [];

    // Create comparison nodes
    const items = entities.entities.slice(0, 4);

    items.forEach((item, index) => {
      nodes.push({
        id: `item-${index}`,
        label: this.capitalizeWords(item)
      });
    });

    // Create comparison relationships
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        edges.push({
          source: nodes[i].id,
          target: nodes[j].id,
          label: 'compared to'
        });
      }
    }

    return { nodes, edges };
  }

  /**
   * Construct cycle diagram graph
   */
  private constructCycleGraph(entities: EntityExtraction): { nodes: NodeDatum[]; edges: EdgeDatum[] } {
    const nodes: NodeDatum[] = [];
    const edges: EdgeDatum[] = [];

    const cycleElements = [...entities.actions, ...entities.concepts].slice(0, 4);

    cycleElements.forEach((element, index) => {
      nodes.push({
        id: `cycle-${index}`,
        label: this.capitalizeWords(element)
      });
    });

    // Create cyclic edges
    for (let i = 0; i < nodes.length; i++) {
      const nextIndex = (i + 1) % nodes.length;
      edges.push({
        source: nodes[i].id,
        target: nodes[nextIndex].id,
        label: 'leads to'
      });
    }

    return { nodes, edges };
  }

  /**
   * Construct network diagram graph
   */
  private constructNetworkGraph(entities: EntityExtraction): { nodes: NodeDatum[]; edges: EdgeDatum[] } {
    const nodes: NodeDatum[] = [];
    const edges: EdgeDatum[] = [];

    const networkNodes = entities.entities.slice(0, 5);

    networkNodes.forEach((node, index) => {
      nodes.push({
        id: `net-${index}`,
        label: this.capitalizeWords(node)
      });
    });

    // Create network connections based on relationships
    entities.relationships.forEach(rel => {
      const sourceIndex = networkNodes.findIndex(n =>
        n.toLowerCase().includes(rel.source.toLowerCase()));
      const targetIndex = networkNodes.findIndex(n =>
        n.toLowerCase().includes(rel.target.toLowerCase()));

      if (sourceIndex >= 0 && targetIndex >= 0) {
        edges.push({
          source: `net-${sourceIndex}`,
          target: `net-${targetIndex}`,
          label: rel.type
        });
      }
    });

    return { nodes, edges };
  }

  /**
   * Construct generic graph for unknown patterns
   */
  private constructGenericGraph(entities: EntityExtraction): { nodes: NodeDatum[]; edges: EdgeDatum[] } {
    const nodes: NodeDatum[] = [];
    const edges: EdgeDatum[] = [];

    entities.entities.slice(0, 3).forEach((entity, index) => {
      nodes.push({
        id: `generic-${index}`,
        label: this.capitalizeWords(entity)
      });
    });

    return { nodes, edges };
  }

  /**
   * Calculate final confidence score
   */
  private calculateConfidence(
    reasoning: { type: DiagramType; reasoning: string },
    patternScores: Map<DiagramType, number>,
    entities: EntityExtraction,
    nodes: NodeDatum[]
  ): number {
    const baseScore = patternScores.get(reasoning.type) || 0;
    const normalizedScore = Math.min(baseScore / 20, 1); // Normalize to 0-1

    // Boost confidence based on entity richness
    let entityBoost = 0;
    if (entities.entities.length > 2) entityBoost += 0.1;
    if (entities.relationships.length > 0) entityBoost += 0.1;
    if (nodes.length > 1) entityBoost += 0.1;

    // Penalty for low entity count
    if (nodes.length === 0) return 0.1;

    return Math.min(normalizedScore + entityBoost, 0.95);
  }

  /**
   * Create fallback analysis when detection fails
   */
  private createFallbackAnalysis(segment: ContentSegment): DiagramAnalysis {
    return {
      type: 'flow',
      nodes: [{
        id: 'concept',
        label: segment.summary.split(' ').slice(0, 3).join(' ')
      }],
      edges: [],
      confidence: 0.1,
      reasoning: 'Fallback analysis - could not determine optimal diagram type'
    };
  }

  // Utility methods

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !this.stopWords.has(word));
  }

  private extractNouns(text: string): string[] {
    // Simple noun extraction using patterns
    const nounPatterns = [
      /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g, // Proper nouns
      /\b\w+(?:tion|sion|ment|ness|ity|ism)\b/g, // Noun suffixes
    ];

    const nouns: string[] = [];

    nounPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        nouns.push(...matches.map(match => match.toLowerCase()));
      }
    });

    return [...new Set(nouns)].slice(0, 10);
  }

  private extractRelationships(text: string, entities: string[]): Array<{ source: string; target: string; type: string }> {
    const relationships: Array<{ source: string; target: string; type: string }> = [];

    // Simple relationship patterns
    const relationPatterns = [
      { pattern: /(\w+)\s+manages\s+(\w+)/gi, type: 'manages' },
      { pattern: /(\w+)\s+reports\s+to\s+(\w+)/gi, type: 'reports_to' },
      { pattern: /(\w+)\s+connects\s+to\s+(\w+)/gi, type: 'connects_to' },
      { pattern: /(\w+)\s+flows\s+to\s+(\w+)/gi, type: 'flows_to' },
    ];

    relationPatterns.forEach(({ pattern, type }) => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        relationships.push({
          source: match[1].toLowerCase(),
          target: match[2].toLowerCase(),
          type
        });
      }
    });

    return relationships;
  }

  private extractConcepts(words: string[]): string[] {
    const conceptPatterns = [
      /\w+(?:tion|sion|ment|ness|ity|ism|ogy|ics)$/
    ];

    const concepts: string[] = [];

    words.forEach(word => {
      conceptPatterns.forEach(pattern => {
        if (pattern.test(word) && word.length > 4) {
          concepts.push(word);
        }
      });
    });

    return [...new Set(concepts)].slice(0, 5);
  }

  private extractActions(text: string): string[] {
    const actionPatterns = [
      /\b\w+(?:ing|ed|ize|ise)\b/g,
      /\b(?:create|build|develop|implement|execute|process|analyze|design|deploy)\b/g
    ];

    const actions: string[] = [];

    actionPatterns.forEach(pattern => {
      const matches = text.toLowerCase().match(pattern);
      if (matches) {
        actions.push(...matches);
      }
    });

    return [...new Set(actions)].slice(0, 8);
  }

  private extractTemporal(text: string): string[] {
    const temporalPatterns = [
      /\b\d{4}\b/g, // Years
      /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\b/gi,
      /\b(?:q1|q2|q3|q4|quarter)\b/gi,
      /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g // Dates
    ];

    const temporal: string[] = [];

    temporalPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        temporal.push(...matches.map(match => match.toLowerCase()));
      }
    });

    return [...new Set(temporal)];
  }

  private calculateComplexity(words: string[], text: string): number {
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
    const sentenceCount = text.split(/[.!?]+/).length;
    const avgSentenceLength = words.length / sentenceCount;

    return (avgWordLength / 10) + (avgSentenceLength / 20);
  }

  private determineDomain(tech: number, business: number, academic: number, procedural: number): string {
    const scores = { tech, business, academic, procedural };
    const max = Math.max(...Object.values(scores));

    if (max === 0) return 'general';

    return Object.keys(scores).find(key => scores[key as keyof typeof scores] === max) || 'general';
  }

  private capitalizeWords(text: string): string {
    return text
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

export default AdvancedSemanticDetector;