/**
 * 🎯 Enhanced Diagram Detector - Iteration 51
 *
 * Advanced diagram type detection using semantic understanding
 * Target: 89.7% → 95% diagram detection accuracy
 *
 * Integration of semantic analysis for intelligent diagram type selection
 */

import { SemanticUnderstandingEngine, SemanticAnalysisResult } from './semantic-understanding-engine';
import { DiagramAnalysis, AnalysisConfig } from './types';
import { performance } from 'perf_hooks';

export interface EnhancedDiagramAnalysis extends DiagramAnalysis {
  semanticInsights: string[];
  confidenceBreakdown: {
    semantic: number;
    pattern: number;
    content: number;
    overall: number;
  };
  alternativeDiagrams: Array<{
    type: string;
    confidence: number;
    rationale: string;
  }>;
}

/**
 * Enhanced Diagram Detector with Semantic Understanding
 * Combines traditional pattern-based detection with advanced semantic analysis
 */
export class EnhancedDiagramDetector {
  private semanticEngine: SemanticUnderstandingEngine;
  private diagramTypeRules: Map<string, any>;

  constructor() {
    this.semanticEngine = new SemanticUnderstandingEngine();
    this.initializeDiagramTypeRules();
  }

  /**
   * Enhanced diagram detection with semantic understanding
   */
  async detectDiagramType(
    content: string,
    config: AnalysisConfig = {}
  ): Promise<EnhancedDiagramAnalysis> {
    const startTime = performance.now();

    console.log('🎯 Starting enhanced diagram detection...');

    try {
      // Phase 1: Semantic Analysis
      console.log('   🧠 Running semantic analysis...');
      const semanticResult = await this.semanticEngine.analyze(content);

      // Phase 2: Pattern-based Analysis
      console.log('   📝 Pattern-based analysis...');
      const patternAnalysis = await this.performPatternAnalysis(content);

      // Phase 3: Content Structure Analysis
      console.log('   🏗️ Content structure analysis...');
      const structureAnalysis = await this.analyzeContentStructure(content);

      // Phase 4: Intelligent Fusion
      console.log('   🔀 Fusing analysis results...');
      const fusedAnalysis = await this.fuseAnalysisResults(
        semanticResult,
        patternAnalysis,
        structureAnalysis
      );

      // Phase 5: Alternative Suggestions
      console.log('   💡 Generating alternatives...');
      const alternatives = await this.generateAlternatives(
        semanticResult,
        patternAnalysis,
        structureAnalysis
      );

      const processingTime = performance.now() - startTime;

      const result: EnhancedDiagramAnalysis = {
        ...fusedAnalysis,
        semanticInsights: semanticResult.keyInsights,
        alternativeDiagrams: alternatives,
        confidence: fusedAnalysis.confidenceBreakdown.overall,
        processingTimeMs: Math.round(processingTime)
      };

      console.log(`✅ Enhanced detection complete (${Math.round(processingTime)}ms)`);
      console.log(`📊 Primary type: ${result.suggestedType} (${Math.round(result.confidence * 100)}%)`);

      return result;

    } catch (error) {
      console.error('❌ Enhanced diagram detection error:', error.message);
      throw new Error(`Enhanced diagram detection failed: ${error.message}`);
    }
  }

  /**
   * Traditional pattern-based analysis
   */
  private async performPatternAnalysis(content: string): Promise<any> {
    const patterns = {
      flowchart: [
        /\b(?:step|then|next|after|before|flow|process|workflow)\b/gi,
        /\b(?:start|begin|end|finish|complete)\b/gi,
        /\b(?:if|else|when|condition|decision)\b/gi,
      ],
      hierarchy: [
        /\b(?:organization|structure|level|tier|parent|child)\b/gi,
        /\b(?:top|bottom|above|below|under|over)\b/gi,
        /\b(?:manager|director|team|department|division)\b/gi,
      ],
      network: [
        /\b(?:connect|link|network|node|edge|relationship)\b/gi,
        /\b(?:communicate|interact|interface|protocol)\b/gi,
        /\b(?:server|client|peer|hub|endpoint)\b/gi,
      ],
      sequence: [
        /\b(?:sequence|order|timeline|chronological|temporal)\b/gi,
        /\b(?:first|second|third|finally|lastly|initially)\b/gi,
        /\b(?:time|duration|period|phase|stage)\b/gi,
      ],
      'concept-map': [
        /\b(?:concept|idea|relationship|association|connection)\b/gi,
        /\b(?:related|associated|linked|connected)\b/gi,
        /\b(?:theme|topic|subject|category|classification)\b/gi,
      ]
    };

    const scores = new Map<string, number>();

    for (const [type, typePatterns] of Object.entries(patterns)) {
      let score = 0;
      for (const pattern of typePatterns) {
        const matches = content.match(pattern);
        score += matches ? matches.length : 0;
      }
      scores.set(type, score);
    }

    // Find the highest scoring type
    const sortedTypes = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]);
    const topType = sortedTypes[0];
    const totalMatches = Array.from(scores.values()).reduce((sum, score) => sum + score, 0);

    return {
      suggestedType: topType[0],
      confidence: totalMatches > 0 ? topType[1] / totalMatches : 0.5,
      scores: Object.fromEntries(scores)
    };
  }

  /**
   * Analyze content structure for diagram hints
   */
  private async analyzeContentStructure(content: string): Promise<any> {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);

    const structure = {
      sentenceCount: sentences.length,
      paragraphCount: paragraphs.length,
      avgSentenceLength: sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length,
      hasLists: /[-*•]\s/.test(content),
      hasNumbering: /^\d+\./.test(content),
      hasQuestions: /\?/.test(content),
      hasSequentialWords: /\b(?:first|then|next|finally)\b/gi.test(content),
      hasHierarchicalWords: /\b(?:main|sub|under|above|top|bottom)\b/gi.test(content)
    };

    // Determine suggested type based on structure
    let suggestedType = 'concept-map'; // default
    let confidence = 0.6;

    if (structure.hasSequentialWords && structure.hasNumbering) {
      suggestedType = 'flowchart';
      confidence = 0.8;
    } else if (structure.hasHierarchicalWords && structure.paragraphCount > 3) {
      suggestedType = 'hierarchy';
      confidence = 0.7;
    } else if (structure.hasLists && !structure.hasSequentialWords) {
      suggestedType = 'concept-map';
      confidence = 0.6;
    }

    return { suggestedType, confidence, structure };
  }

  /**
   * Intelligently fuse multiple analysis results
   */
  private async fuseAnalysisResults(
    semantic: SemanticAnalysisResult,
    pattern: any,
    structure: any
  ): Promise<any> {
    const weights = {
      semantic: 0.5,
      pattern: 0.3,
      structure: 0.2
    };

    // Calculate weighted confidence for each diagram type
    const typeScores = new Map<string, number>();

    // Semantic contribution
    const semanticType = semantic.suggestedDiagramType;
    typeScores.set(semanticType, (typeScores.get(semanticType) || 0) + semantic.confidence * weights.semantic);

    // Pattern contribution
    const patternType = pattern.suggestedType;
    typeScores.set(patternType, (typeScores.get(patternType) || 0) + pattern.confidence * weights.pattern);

    // Structure contribution
    const structureType = structure.suggestedType;
    typeScores.set(structureType, (typeScores.get(structureType) || 0) + structure.confidence * weights.structure);

    // Find the highest scoring type
    const sortedTypes = Array.from(typeScores.entries()).sort((a, b) => b[1] - a[1]);
    const bestType = sortedTypes[0];

    const confidenceBreakdown = {
      semantic: semantic.confidence,
      pattern: pattern.confidence,
      content: structure.confidence,
      overall: bestType[1]
    };

    return {
      suggestedType: bestType[0],
      confidenceBreakdown,
      reasoning: this.generateReasoning(semantic, pattern, structure, bestType[0])
    };
  }

  /**
   * Generate alternative diagram suggestions
   */
  private async generateAlternatives(
    semantic: SemanticAnalysisResult,
    pattern: any,
    structure: any
  ): Promise<Array<{type: string, confidence: number, rationale: string}>> {
    const alternatives = [];

    // Collect all suggestions
    const suggestions = [
      { type: semantic.suggestedDiagramType, confidence: semantic.confidence, source: 'semantic' },
      { type: pattern.suggestedType, confidence: pattern.confidence, source: 'pattern' },
      { type: structure.suggestedType, confidence: structure.confidence, source: 'structure' }
    ];

    // Remove duplicates and sort by confidence
    const uniqueSuggestions = suggestions.reduce((acc, current) => {
      const existing = acc.find(item => item.type === current.type);
      if (!existing) {
        acc.push(current);
      } else if (current.confidence > existing.confidence) {
        existing.confidence = current.confidence;
        existing.source = current.source;
      }
      return acc;
    }, [] as any[]);

    uniqueSuggestions.sort((a, b) => b.confidence - a.confidence);

    // Generate rationales
    for (const suggestion of uniqueSuggestions.slice(0, 3)) {
      alternatives.push({
        type: suggestion.type,
        confidence: suggestion.confidence,
        rationale: this.generateAlternativeRationale(suggestion.type, suggestion.source)
      });
    }

    return alternatives;
  }

  /**
   * Generate reasoning for the selected diagram type
   */
  private generateReasoning(semantic: any, pattern: any, structure: any, selectedType: string): string {
    const reasons = [];

    if (semantic.suggestedDiagramType === selectedType) {
      reasons.push(`Semantic analysis strongly suggests ${selectedType} based on content meaning`);
    }

    if (pattern.suggestedType === selectedType) {
      reasons.push(`Pattern matching confirms ${selectedType} through keyword analysis`);
    }

    if (structure.suggestedType === selectedType) {
      reasons.push(`Content structure supports ${selectedType} format`);
    }

    return reasons.join('. ') || `Selected ${selectedType} based on balanced analysis`;
  }

  /**
   * Generate rationale for alternative suggestions
   */
  private generateAlternativeRationale(type: string, source: string): string {
    const rationales = {
      semantic: `Strong semantic indicators for ${type} structure`,
      pattern: `Keyword patterns suggest ${type} organization`,
      structure: `Content structure aligns with ${type} format`
    };

    return rationales[source as keyof typeof rationales] || `Alternative suggestion for ${type}`;
  }

  /**
   * Initialize diagram type detection rules
   */
  private initializeDiagramTypeRules(): void {
    this.diagramTypeRules = new Map([
      ['flowchart', {
        keywords: ['step', 'process', 'flow', 'workflow', 'procedure'],
        complexity: 'medium',
        interactivity: 'low'
      }],
      ['hierarchy', {
        keywords: ['organization', 'structure', 'level', 'parent', 'child'],
        complexity: 'low',
        interactivity: 'low'
      }],
      ['network', {
        keywords: ['network', 'connection', 'node', 'link', 'relationship'],
        complexity: 'high',
        interactivity: 'medium'
      }],
      ['sequence', {
        keywords: ['sequence', 'timeline', 'chronological', 'order'],
        complexity: 'medium',
        interactivity: 'medium'
      }],
      ['concept-map', {
        keywords: ['concept', 'idea', 'relationship', 'association'],
        complexity: 'high',
        interactivity: 'high'
      }]
    ]);
  }
}

export default EnhancedDiagramDetector;