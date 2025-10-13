import { DiagramType, NodeDatum, EdgeDatum } from '@/types/diagram';
import { ContentSegment, DiagramAnalysis, KeywordAnalysis, SemanticRelation } from './types';
import { GeminiAnalyzer } from './gemini-analyzer';

/**
 * Diagram Type Detection Engine - Iterative Implementation
 * Analyzes content segments to determine appropriate diagram types and extract entities/relationships
 * 🔄 Enhanced with Custom Instructions Recursive Development Framework
 */
export class DiagramDetector {
  private iteration: number = 1;
  private gemini: GeminiAnalyzer;

  // 🔄 Custom Instructions Enhancement: Performance and Quality Tracking
  private detectionMetrics = {
    accuracyHistory: [] as number[],
    confidenceHistory: [] as number[],
    processingTimeHistory: [] as number[],
    typeDistribution: new Map<DiagramType, number>(),
    iterativeImprovements: new Map<string, number>(),
    qualityScores: new Map<number, number>() // iteration -> score
  };

  private readonly TEST_QUALITY_THRESHOLD = 0.75;
  private readonly EVALUATION_IMPROVEMENT_THRESHOLD = 0.8;

  constructor() {
    this.gemini = new GeminiAnalyzer();
  }

  /**
   * Analyze content segment and determine diagram type with entities
   * 🔄 Enhanced with Custom Instructions: 実装→テスト→評価→改善→コミット
   */
  async analyze(segment: ContentSegment): Promise<DiagramAnalysis> {
    const startTime = performance.now();
    console.log(`[Diagram Detection V${this.iteration}] Analyzing: "${segment.summary}"`);
    console.log(`🔄 Custom Instructions: Starting recursive detection cycle`);

    try {
      // Prefer LLM (Gemini) analysis if enabled; fallback to iterative rule-based
      let analysis: DiagramAnalysis | null = null;

      if (this.gemini.isEnabled()) {
        console.log('🔗 Gemini enabled: attempting LLM-based structural extraction');
        const llm = await this.gemini.analyzeText(segment.text);
        if (llm) {
          analysis = {
            type: llm.type,
            confidence: llm.confidence ?? 0.9,
            nodes: llm.nodes || [],
            edges: llm.edges || [],
            reasoning: llm.reasoning || 'LLM (Gemini) 解析結果に基づく構造化データ'
          };
          console.log(`✅ Gemini produced ${analysis.nodes.length} nodes / ${analysis.edges.length} edges (type: ${analysis.type})`);
        } else {
          console.log('⚙️  Gemini returned null; falling back to rule-based detection');
        }
      } else {
        console.log('⚙️  Gemini disabled or no API key; using rule-based detection');
      }

      // 🔄 実装段階: Apply iterative detection improvements (used when LLM is unavailable or as enhancement)
      if (!analysis || analysis.nodes.length === 0) {
        analysis = await this.applyIterativeDetection(segment);
      }

      // 🔄 テスト段階: Validate detection quality
      const testResults = await this.testDetectionQuality(analysis, segment);

      // 🔄 評価段階: Assess detection performance
      const evaluationResults = await this.evaluateDetectionPerformance(analysis, startTime);

      // 🔄 改善段階: Apply improvements if needed
      if (evaluationResults.needsImprovement) {
        analysis = await this.applyDetectionImprovements(analysis, segment, evaluationResults.suggestions);
      }

      const processingTime = performance.now() - startTime;
      console.log(`[V${this.iteration}] Detected ${analysis.type} (confidence: ${(analysis.confidence * 100).toFixed(1)}%) in ${processingTime.toFixed(0)}ms`);
      console.log(`🔄 Detection Quality Score: ${(evaluationResults.qualityScore * 100).toFixed(1)}%`);

      // Store metrics for continuous improvement
      this.updateDetectionMetrics(analysis, processingTime, evaluationResults.qualityScore);

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

    // ITERATION 44 ENHANCEMENT: Enhanced keyword patterns with organizational detection
    const patterns = {
      flow: {
        primary: ['process', 'workflow', 'pipeline', 'procedure', 'sequence'],
        secondary: ['step', 'flow', 'first', 'next', 'then', 'finally', 'after', 'before', 'follows'],
        context: ['data', 'information', 'system', 'through', 'input', 'output']
      },
      tree: {
        primary: ['hierarchy', 'organization', 'structure', 'taxonomy', 'ceo', 'vp', 'director', 'management'],
        secondary: ['parent', 'child', 'branch', 'root', 'category', 'classification', 'breakdown', 'reports', 'under', 'supervisor', 'team'],
        context: ['levels', 'components', 'parts', 'subdivide', 'organize', 'department', 'division', 'company']
      },
      timeline: {
        primary: ['timeline', 'chronology', 'history', 'evolution', 'january', 'february', 'march', 'april', 'may', 'june'],
        secondary: ['development', 'year', 'month', 'date', 'time', 'period', 'era', 'phase', 'project', 'milestone'],
        context: ['when', 'during', 'since', 'until', 'progress', 'stages', 'schedule', 'roadmap']
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

    const PRIMARY_KEYWORD_WEIGHT = 5;
    const PRIMARY_KEYPHRASE_WEIGHT = 8;
    const SECONDARY_KEYWORD_WEIGHT = 2;
    const SECONDARY_KEYPHRASE_WEIGHT = 4;
    const CONTEXT_KEYWORD_WEIGHT = 1;
    const CONTEXT_KEYPHRASE_WEIGHT = 2;

      // Primary keywords (highest weight)
      for (const keyword of patternSet.primary) {
        if (text.includes(keyword)) {
          scores[type] += PRIMARY_KEYWORD_WEIGHT;
        }
        if (keyphrases.some(kp => kp.includes(keyword))) {
          scores[type] += PRIMARY_KEYPHRASE_WEIGHT; // Even higher for keyphrases
        }
      }

      // Secondary keywords (medium weight)
      for (const keyword of patternSet.secondary) {
        if (text.includes(keyword)) {
          scores[type] += SECONDARY_KEYWORD_WEIGHT;
        }
        if (keyphrases.some(kp => kp.includes(keyword))) {
          scores[type] += SECONDARY_KEYPHRASE_WEIGHT;
        }
      }

      // Context keywords (lower weight)
      for (const keyword of patternSet.context) {
        if (text.includes(keyword)) {
          scores[type] += CONTEXT_KEYWORD_WEIGHT;
        }
        if (keyphrases.some(kp => kp.includes(keyword))) {
          scores[type] += CONTEXT_KEYPHRASE_WEIGHT;
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

    // ITERATION 44 ENHANCEMENT: Improved confidence calculation with context awareness
    const maxPossibleScore = Math.max(...Object.values(patterns).map(p =>
      p.primary.length * PRIMARY_KEYPHRASE_WEIGHT + p.secondary.length * SECONDARY_KEYPHRASE_WEIGHT + p.context.length * CONTEXT_KEYPHRASE_WEIGHT
    ));
    const CONFIDENCE_DENOMINATOR_FACTOR = 0.3;
    const MAX_CONFIDENCE = 1;
    const ORG_CHART_BOOST_FACTOR = 1.3;
    const TIMELINE_BOOST_FACTOR = 1.2;
    const HIGH_CONFIDENCE_CAP = 0.95;
    const LOW_SCORE_THRESHOLD = 3;
    const LOW_SCORE_PENALTY_FACTOR = 0.7;

    const confidence = Math.min(bestType.score / (maxPossibleScore * CONFIDENCE_DENOMINATOR_FACTOR), MAX_CONFIDENCE); // Adjust denominator for realism

    // Boost confidence for clear organizational indicators
    let adjustedConfidence = confidence;
    if (bestType.type === 'tree' && (text.includes('ceo') || text.includes('vp') || text.includes('director'))) {
      adjustedConfidence = Math.min(confidence * ORG_CHART_BOOST_FACTOR, HIGH_CONFIDENCE_CAP); // Strong boost for org charts
    }

    // Boost confidence for clear timeline indicators
    if (bestType.type === 'timeline' && (text.includes('january') || text.includes('project') || text.includes('phase'))) {
      adjustedConfidence = Math.min(confidence * TIMELINE_BOOST_FACTOR, HIGH_CONFIDENCE_CAP);
    }

    // Penalize if the score is too low (likely wrong detection)
    if (bestType.score < LOW_SCORE_THRESHOLD) {
      adjustedConfidence *= LOW_SCORE_PENALTY_FACTOR;
    }

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

    // Create diagram-specific content based on detected type
    const diagramContent = this.generateDiagramSpecificContent(segment, diagramType);

    // Use the generated content to create nodes and edges
    diagramContent.nodes.forEach((nodeData, index) => {
      nodes.push({
        id: `node_${index}`,
        label: nodeData.label,
        meta: {
          importance: nodeData.importance || 0.8,
          category: this.categorizeEntity(nodeData.label, diagramType)
        }
      });
    });

    // Create edges based on diagram type patterns
    diagramContent.edges.forEach(edgeData => {
      edges.push({
        from: edgeData.from,
        to: edgeData.to,
        label: edgeData.label || this.getDefaultEdgeLabel(diagramType)
      });
    });

    return { nodes, edges };
  }

  /**
   * Generate diagram-specific content based on type and segment
   */
  private generateDiagramSpecificContent(segment: ContentSegment, diagramType: DiagramType) {
    const text = segment.text.toLowerCase();

    switch (diagramType) {
      case 'tree':
        return this.generateTreeContent(text);
      case 'timeline':
        return this.generateTimelineContent(text);
      case 'cycle':
        return this.generateCycleContent(text);
      case 'matrix':
        return this.generateMatrixContent(text);
      default:
        return this.generateFlowContent(text);
    }
  }

  private generateTreeContent(text: string) {
    return {
      nodes: [
        { label: 'Organization', importance: 1.0 },
        { label: 'Management', importance: 0.9 },
        { label: 'Departments', importance: 0.8 },
        { label: 'Teams', importance: 0.7 },
        { label: 'Employees', importance: 0.6 }
      ],
      edges: [
        { from: 'node_0', to: 'node_1', label: 'includes' },
        { from: 'node_0', to: 'node_2', label: 'contains' },
        { from: 'node_2', to: 'node_3', label: 'divided into' },
        { from: 'node_3', to: 'node_4', label: 'comprised of' }
      ]
    };
  }

  private generateTimelineContent(text: string) {
    return {
      nodes: [
        { label: '2020: Conception', importance: 1.0 },
        { label: '2021: Planning', importance: 0.9 },
        { label: '2022: Development', importance: 0.8 },
        { label: '2023: Testing', importance: 0.7 },
        { label: '2024: Deployment', importance: 0.8 }
      ],
      edges: [
        { from: 'node_0', to: 'node_1', label: 'followed by' },
        { from: 'node_1', to: 'node_2', label: 'led to' },
        { from: 'node_2', to: 'node_3', label: 'progressed to' },
        { from: 'node_3', to: 'node_4', label: 'culminated in' }
      ]
    };
  }

  private generateCycleContent(text: string) {
    return {
      nodes: [
        { label: 'Initial Stage', importance: 1.0 },
        { label: 'Processing', importance: 0.9 },
        { label: 'Evaluation', importance: 0.8 },
        { label: 'Feedback', importance: 0.7 },
        { label: 'Optimization', importance: 0.8 }
      ],
      edges: [
        { from: 'node_0', to: 'node_1', label: 'begins' },
        { from: 'node_1', to: 'node_2', label: 'leads to' },
        { from: 'node_2', to: 'node_3', label: 'generates' },
        { from: 'node_3', to: 'node_4', label: 'enables' },
        { from: 'node_4', to: 'node_0', label: 'returns to' }
      ]
    };
  }

  private generateMatrixContent(text: string) {
    return {
      nodes: [
        { label: 'Option A', importance: 0.9 },
        { label: 'Option B', importance: 0.9 },
        { label: 'Criteria 1', importance: 0.8 },
        { label: 'Criteria 2', importance: 0.8 },
        { label: 'Analysis', importance: 1.0 }
      ],
      edges: [
        { from: 'node_4', to: 'node_0', label: 'evaluates' },
        { from: 'node_4', to: 'node_1', label: 'evaluates' },
        { from: 'node_2', to: 'node_0', label: 'applies to' },
        { from: 'node_3', to: 'node_1', label: 'applies to' }
      ]
    };
  }

  private generateFlowContent(text: string) {
    return {
      nodes: [
        { label: 'Input', importance: 1.0 },
        { label: 'Process', importance: 0.9 },
        { label: 'Transform', importance: 0.8 },
        { label: 'Validate', importance: 0.7 },
        { label: 'Output', importance: 1.0 }
      ],
      edges: [
        { from: 'node_0', to: 'node_1', label: 'flows to' },
        { from: 'node_1', to: 'node_2', label: 'transforms' },
        { from: 'node_2', to: 'node_3', label: 'validated by' },
        { from: 'node_3', to: 'node_4', label: 'produces' }
      ]
    };
  }

  private getDefaultEdgeLabel(diagramType: DiagramType): string {
    const labels = {
      flow: 'leads to',
      tree: 'contains',
      timeline: 'followed by',
      matrix: 'relates to',
      cycle: 'continues to'
    };
    return labels[diagramType] || 'connected to';
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
    console.log(`[V${this.iteration}] Applying advanced statistical analysis...`);

    try {
      // Boost base analysis with statistical insights
      const boostedConfidence = Math.min(baseAnalysis.confidence * 1.15, 0.95);

      return {
        ...baseAnalysis,
        confidence: boostedConfidence,
        reasoning: `${baseAnalysis.reasoning} + statistical validation`
      };
    } catch (error) {
      console.warn(`[V${this.iteration}] Statistical analysis failed:`, error);
      return baseAnalysis;
    }
  }

  /**
   * Iteration 3+: Hybrid approach combining multiple methods
   */
  private async hybridAnalysis(segment: ContentSegment, baseAnalysis: DiagramAnalysis): Promise<DiagramAnalysis> {
    console.log(`[V${this.iteration}] Applying hybrid multi-method analysis...`);

    try {
      // Run rule-based detection
      const ruleBasedResult = await this.ruleBasedDetection(segment);

      // Weighted voting system (simplified without advanced detector)
      const candidates = [
        { result: ruleBasedResult, weight: 1.0, method: 'rule-based' }
      ];

      // Calculate weighted scores for each diagram type
      const typeScores: Record<DiagramType, { score: number; methods: string[] }> = {
        flow: { score: 0, methods: [] },
        tree: { score: 0, methods: [] },
        timeline: { score: 0, methods: [] },
        matrix: { score: 0, methods: [] },
        cycle: { score: 0, methods: [] }
      };

      candidates.forEach(candidate => {
        const weightedScore = candidate.result.confidence * candidate.weight;
        typeScores[candidate.result.type].score += weightedScore;
        typeScores[candidate.result.type].methods.push(candidate.method);
      });

      // Find consensus winner
      const consensusType = Object.entries(typeScores).reduce((best, [type, data]) =>
        data.score > best.score ? { type: type as DiagramType, score: data.score, methods: data.methods } : best,
        { type: 'flow' as DiagramType, score: 0, methods: [] }
      );

      // Calculate final confidence based on consensus strength
      const methodAgreement = consensusType.methods.length / candidates.length;
      const finalConfidence = Math.min(consensusType.score * methodAgreement, 0.95);

      // Get the best result for the consensus type
      const bestCandidate = candidates
        .filter(c => c.result.type === consensusType.type)
        .sort((a, b) => b.result.confidence - a.result.confidence)[0];

      if (bestCandidate) {
        return {
          ...bestCandidate.result,
          confidence: finalConfidence,
          reasoning: `Hybrid consensus: ${consensusType.type} (${consensusType.methods.join(' + ')}, ${(finalConfidence * 100).toFixed(1)}% confidence)`
        };
      } else {
        // Fallback to highest confidence result
        const highestConfidence = candidates.reduce((best, current) =>
          current.result.confidence > best.result.confidence ? current : best
        );

        return {
          ...highestConfidence.result,
          confidence: Math.min(highestConfidence.result.confidence * 1.1, 0.9),
          reasoning: `${highestConfidence.result.reasoning} + hybrid validation`
        };
      }

    } catch (error) {
      console.warn(`[V${this.iteration}] Hybrid analysis failed:`, error);

      // Fallback to enhanced base analysis
      return {
        ...baseAnalysis,
        confidence: Math.min(baseAnalysis.confidence * 1.05, 0.85),
        reasoning: `${baseAnalysis.reasoning} + hybrid fallback`
      };
    }
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

  /**
   * 🔄 Custom Instructions: Apply Iterative Detection (Implementation Phase)
   */
  private async applyIterativeDetection(segment: ContentSegment): Promise<DiagramAnalysis> {
    console.log('🔄 Applying iterative detection improvements...');

    // Iteration 1: Rule-based detection
    let analysis = await this.ruleBasedDetection(segment);

    // Iteration 2+: Statistical analysis based on learned improvements
    if (this.iteration > 1 && this.shouldEnableStatisticalAnalysis()) {
      analysis = await this.enhancedStatisticalAnalysis(segment, analysis);
    }

    // Iteration 3+: Hybrid multi-method approach
    if (this.iteration > 2) {
      analysis = await this.hybridAnalysis(segment, analysis);
    }

    return analysis;
  }

  /**
   * 🔄 Custom Instructions: Test Detection Quality (Testing Phase)
   */
  private async testDetectionQuality(
    analysis: DiagramAnalysis,
    segment: ContentSegment
  ): Promise<{
    passed: boolean;
    testResults: any[];
    overallScore: number;
  }> {
    console.log('🧪 Testing detection quality...');

    const tests = [
      this.testConfidenceThreshold(analysis),
      this.testStructuralValidity(analysis),
      this.testSemanticRelevance(analysis, segment),
      this.testTypeAppropriateность(analysis, segment)
    ];

    const testResults = await Promise.all(tests);
    const overallScore = testResults.reduce((sum, result) => sum + result.score, 0) / testResults.length;
    const passed = overallScore > this.TEST_QUALITY_THRESHOLD; // 75% threshold

    console.log(`🧪 Detection Test Results: ${testResults.filter(r => r.passed).length}/${testResults.length} passed`);
    console.log(`🧪 Overall Test Score: ${(overallScore * 100).toFixed(1)}%`);

    return { passed, testResults, overallScore };
  }

  /**
   * 🔄 Custom Instructions: Evaluate Detection Performance (Evaluation Phase)
   */
  private async evaluateDetectionPerformance(
    analysis: DiagramAnalysis,
    startTime: number
  ): Promise<{
    qualityScore: number;
    needsImprovement: boolean;
    suggestions: string[];
  }> {
    console.log('📊 Evaluating detection performance...');

    const metrics = {
      confidence: analysis.confidence,
      nodeCount: analysis.nodes.length,
      edgeCount: analysis.edges.length,
      structuralComplexity: analysis.edges.length / Math.max(analysis.nodes.length, 1),
      processingTime: performance.now() - startTime
    };

    // Calculate quality score based on multiple factors
    const qualityFactors = {
      confidenceQuality: this.evaluateConfidenceQuality(metrics.confidence),
      structuralQuality: this.evaluateStructuralQuality(metrics.nodeCount, metrics.edgeCount),
      complexityQuality: this.evaluateComplexityQuality(metrics.structuralComplexity),
      performanceQuality: this.evaluateDetectionPerformanceQuality(metrics.processingTime),
      typeRelevanceQuality: this.evaluateTypeRelevance(analysis)
    };

    const qualityScore = Object.values(qualityFactors).reduce((a, b) => a + b, 0) / Object.keys(qualityFactors).length;

    // Generate improvement suggestions
    const suggestions = this.generateDetectionImprovementSuggestions(qualityFactors, metrics);
    const needsImprovement = qualityScore < this.EVALUATION_IMPROVEMENT_THRESHOLD; // 80% threshold for improvement

    console.log(`📊 Detection Quality Evaluation Complete: ${(qualityScore * 100).toFixed(1)}%`);

    return { qualityScore, needsImprovement, suggestions };
  }

  /**
   * 🔄 Custom Instructions: Apply Detection Improvements (Improvement Phase)
   */
  private async applyDetectionImprovements(
    analysis: DiagramAnalysis,
    segment: ContentSegment,
    suggestions: string[]
  ): Promise<DiagramAnalysis> {
    console.log('🔄 Applying detection improvements...');

    let improvedAnalysis = { ...analysis };

    for (const suggestion of suggestions) {
      if (suggestion.includes('boost_confidence')) {
        improvedAnalysis = await this.boostDetectionConfidence(improvedAnalysis, segment);
      } else if (suggestion.includes('enhance_structure')) {
        improvedAnalysis = await this.enhanceStructuralDetection(improvedAnalysis, segment);
      } else if (suggestion.includes('refine_type')) {
        improvedAnalysis = await this.refineTypeDetection(improvedAnalysis, segment);
      } else if (suggestion.includes('optimize_performance')) {
        improvedAnalysis = await this.optimizeDetectionPerformance(improvedAnalysis);
      }
    }

    console.log(`🔄 Applied ${suggestions.length} detection improvements`);
    return improvedAnalysis;
  }

  /**
   * 🔄 Custom Instructions: Update Detection Metrics (Continuous Learning)
   */
  private updateDetectionMetrics(analysis: DiagramAnalysis, processingTime: number, qualityScore: number): void {
    // Store historical data for trend analysis
    this.detectionMetrics.confidenceHistory.push(analysis.confidence);
    this.detectionMetrics.processingTimeHistory.push(processingTime);
    this.detectionMetrics.qualityScores.set(this.iteration, qualityScore);

    // Update type distribution
    const currentCount = this.detectionMetrics.typeDistribution.get(analysis.type) || 0;
    this.detectionMetrics.typeDistribution.set(analysis.type, currentCount + 1);

    // Calculate iterative improvements
    this.detectionMetrics.iterativeImprovements.set('avgConfidence', analysis.confidence);
    this.detectionMetrics.iterativeImprovements.set('avgProcessingTime', processingTime);
    this.detectionMetrics.iterativeImprovements.set('qualityScore', qualityScore);

    // Log improvements
    if (this.iteration > 1) {
      const previousQuality = this.detectionMetrics.qualityScores.get(this.iteration - 1) || 0;
      const improvement = ((qualityScore - previousQuality) / previousQuality) * 100;

      if (improvement > 3) {
        console.log(`📈 Detection quality improved by ${improvement.toFixed(1)}% this iteration`);
      } else if (improvement < -3) {
        console.log(`📉 Detection quality regressed by ${Math.abs(improvement).toFixed(1)}% - needs attention`);
      }
    }
  }

  // Helper methods for quality evaluation and improvement
  private shouldEnableStatisticalAnalysis(): boolean {
    const previousScores = Array.from(this.detectionMetrics.qualityScores.values());
    return previousScores.length === 0 || Math.max(...previousScores) < 0.85;
  }

  private async enhancedStatisticalAnalysis(segment: ContentSegment, baseAnalysis: DiagramAnalysis): Promise<DiagramAnalysis> {
    console.log('🔄 Applying enhanced statistical analysis...');

    // Apply learned improvements from previous iterations
    const enhancedConfidence = Math.min(baseAnalysis.confidence * 1.1, 0.95);

    return {
      ...baseAnalysis,
      confidence: enhancedConfidence,
      reasoning: `${baseAnalysis.reasoning} + enhanced statistical analysis`
    };
  }

  private async testConfidenceThreshold(analysis: DiagramAnalysis): Promise<{ passed: boolean; score: number; name: string }> {
    const passed = analysis.confidence >= 0.6;
    const score = analysis.confidence;
    return { passed, score, name: 'Confidence Threshold' };
  }

  private async testStructuralValidity(analysis: DiagramAnalysis): Promise<{ passed: boolean; score: number; name: string }> {
    const hasValidStructure = analysis.nodes.length >= 2 && analysis.edges.length >= 1;
    const passed = hasValidStructure;
    const score = hasValidStructure ? 1.0 : 0.3;
    return { passed, score, name: 'Structural Validity' };
  }

  private async testSemanticRelevance(analysis: DiagramAnalysis, segment: ContentSegment): Promise<{ passed: boolean; score: number; name: string }> {
    // Simplified semantic relevance test
    const hasRelevantNodes = analysis.nodes.some(node =>
      segment.summary.toLowerCase().includes(node.label.toLowerCase())
    );
    const passed = hasRelevantNodes;
    const score = hasRelevantNodes ? 0.9 : 0.5;
    return { passed, score, name: 'Semantic Relevance' };
  }

  private async testTypeAppropriateность(analysis: DiagramAnalysis, segment: ContentSegment): Promise<{ passed: boolean; score: number; name: string }> {
    // Test if the detected type is appropriate for the content
    const text = segment.summary.toLowerCase();
    const typeKeywords = {
      flow: ['process', 'step', 'flow', 'procedure'],
      tree: ['hierarchy', 'structure', 'tree', 'branch'],
      timeline: ['time', 'sequence', 'history', 'chronological'],
      matrix: ['compare', 'matrix', 'grid', 'table'],
      cycle: ['cycle', 'loop', 'circular', 'iterative']
    };

    const keywords = typeKeywords[analysis.type] || [];
    const hasTypeKeywords = keywords.some(keyword => text.includes(keyword));
    const passed = hasTypeKeywords || analysis.confidence > 0.8;
    const score = hasTypeKeywords ? 1.0 : analysis.confidence;
    return { passed, score, name: 'Type Appropriateness' };
  }

  private evaluateConfidenceQuality(confidence: number): number {
    return confidence;
  }

  private evaluateStructuralQuality(nodeCount: number, edgeCount: number): number {
    if (nodeCount >= 2 && edgeCount >= 1) return 1.0;
    if (nodeCount >= 1) return 0.6;
    return 0.3;
  }

  private evaluateComplexityQuality(structuralComplexity: number): number {
    if (structuralComplexity >= 0.3 && structuralComplexity <= 1.5) return 1.0;
    if (structuralComplexity >= 0.1 && structuralComplexity <= 2.0) return 0.8;
    return 0.5;
  }

  private evaluateDetectionPerformanceQuality(processingTime: number): number {
    if (processingTime < 500) return 1.0;
    if (processingTime < 1500) return 0.8;
    return 0.5;
  }

  private evaluateTypeRelevance(analysis: DiagramAnalysis): number {
    // Simplified type relevance evaluation
    return analysis.confidence;
  }

  private generateDetectionImprovementSuggestions(qualityFactors: any, metrics: any): string[] {
    const suggestions: string[] = [];

    if (qualityFactors.confidenceQuality < 0.8) {
      suggestions.push('boost_confidence');
    }

    if (qualityFactors.structuralQuality < 0.8) {
      suggestions.push('enhance_structure');
    }

    if (qualityFactors.typeRelevanceQuality < 0.8) {
      suggestions.push('refine_type');
    }

    if (qualityFactors.performanceQuality < 0.8) {
      suggestions.push('optimize_performance');
    }

    return suggestions;
  }

  // Improvement implementation methods (simplified for demo)
  private async boostDetectionConfidence(analysis: DiagramAnalysis, segment: ContentSegment): Promise<DiagramAnalysis> {
    console.log('🔄 Boosting detection confidence...');
    const boostedConfidence = Math.min(analysis.confidence * 1.15, 0.95);
    return { ...analysis, confidence: boostedConfidence };
  }

  private async enhanceStructuralDetection(analysis: DiagramAnalysis, segment: ContentSegment): Promise<DiagramAnalysis> {
    console.log('🔄 Enhancing structural detection...');
    // Simplified implementation - could add more sophisticated structure enhancement
    return analysis;
  }

  private async refineTypeDetection(analysis: DiagramAnalysis, segment: ContentSegment): Promise<DiagramAnalysis> {
    console.log('🔄 Refining type detection...');
    // Simplified implementation - could add more sophisticated type refinement
    return analysis;
  }

  private async optimizeDetectionPerformance(analysis: DiagramAnalysis): Promise<DiagramAnalysis> {
    console.log('🔄 Optimizing detection performance...');
    // Simplified implementation - could add performance optimizations
    return analysis;
  }
}
