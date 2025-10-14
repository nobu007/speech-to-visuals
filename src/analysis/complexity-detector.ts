/**
 * Content Complexity Detection Engine
 * Phase 19: Adaptive LLM Model Selection
 *
 * Analyzes text complexity to determine optimal LLM model:
 * - Simple content → gemini-2.5-flash (fast, cost-effective)
 * - Complex content → gemini-2.5-pro (accurate, slower)
 *
 * Target: 60-75% processing time reduction for simple content
 */

export interface ComplexityAnalysis {
  score: number; // 0-1 scale (0 = simple, 1 = complex)
  level: 'simple' | 'moderate' | 'complex';
  recommendedModel: 'gemini-2.5-flash' | 'gemini-2.5-pro';
  factors: {
    vocabularyComplexity: number;
    structuralComplexity: number;
    semanticDensity: number;
    entityCount: number;
    relationshipDensity: number;
  };
  reasoning: string;
}

export class ComplexityDetector {
  // Phase 43: Calibrated thresholds for optimal model selection
  private readonly SIMPLE_THRESHOLD = 0.15;  // Simple content (Flash model)
  private readonly COMPLEX_THRESHOLD = 0.20; // Complex content (Pro model) - Phase 43 calibration

  // Weight factors for complexity scoring (rebalanced for better discrimination)
  private readonly WEIGHTS = {
    vocabularyComplexity: 0.20,    // Reduced (too dominant)
    structuralComplexity: 0.25,    // Increased (important indicator)
    semanticDensity: 0.30,         // Increased (key differentiator)
    entityCount: 0.10,             // Reduced (less reliable)
    relationshipDensity: 0.15      // Kept same
  };

  /**
   * Analyze text complexity and recommend optimal LLM model
   */
  analyze(text: string): ComplexityAnalysis {
    const factors = {
      vocabularyComplexity: this.analyzeVocabularyComplexity(text),
      structuralComplexity: this.analyzeStructuralComplexity(text),
      semanticDensity: this.analyzeSemanticDensity(text),
      entityCount: this.analyzeEntityCount(text),
      relationshipDensity: this.analyzeRelationshipDensity(text)
    };

    // Calculate weighted complexity score
    const score =
      factors.vocabularyComplexity * this.WEIGHTS.vocabularyComplexity +
      factors.structuralComplexity * this.WEIGHTS.structuralComplexity +
      factors.semanticDensity * this.WEIGHTS.semanticDensity +
      factors.entityCount * this.WEIGHTS.entityCount +
      factors.relationshipDensity * this.WEIGHTS.relationshipDensity;

    // Determine complexity level
    let level: 'simple' | 'moderate' | 'complex';
    let recommendedModel: 'gemini-2.5-flash' | 'gemini-2.5-pro';

    if (score < this.SIMPLE_THRESHOLD) {
      level = 'simple';
      recommendedModel = 'gemini-2.5-flash';
    } else if (score < this.COMPLEX_THRESHOLD) {
      level = 'moderate';
      recommendedModel = 'gemini-2.5-flash'; // Flash can handle moderate complexity
    } else {
      level = 'complex';
      recommendedModel = 'gemini-2.5-pro';
    }

    const reasoning = this.generateReasoning(level, factors);

    return {
      score,
      level,
      recommendedModel,
      factors,
      reasoning
    };
  }

  /**
   * Analyze vocabulary complexity
   * Factors: word length, rare words, technical terms
   */
  private analyzeVocabularyComplexity(text: string): number {
    const words = text.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return 0;

    // Average word length (longer words = more complex)
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
    const wordLengthScore = Math.min(avgWordLength / 15, 1); // Normalize to 0-1

    // Unique word ratio (higher = more diverse vocabulary)
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    const uniqueRatio = uniqueWords.size / words.length;

    // Technical indicators (numbers, special characters, capitalization)
    const technicalPatterns = [
      /\d{4,}/, // Long numbers
      /[A-Z]{2,}/, // Acronyms
      /[→←↑↓⇒⇐]/, // Special symbols
      /[α-ωΑ-Ω]/, // Greek letters
      /\d+\.\d+\.\d+/, // Version numbers
    ];
    const technicalScore = technicalPatterns.filter(pattern => pattern.test(text)).length / technicalPatterns.length;

    return (wordLengthScore * 0.4) + (uniqueRatio * 0.3) + (technicalScore * 0.3);
  }

  /**
   * Analyze structural complexity
   * Factors: sentence length, nesting, punctuation variety
   */
  private analyzeStructuralComplexity(text: string): number {
    const sentences = text.split(/[。.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length === 0) return 0;

    // Average sentence length (longer = more complex)
    const avgSentenceLength = text.length / sentences.length;
    const sentenceLengthScore = Math.min(avgSentenceLength / 200, 1);

    // Sentence count (more sentences = potentially more structure)
    const sentenceCountScore = Math.min(sentences.length / 10, 1);

    // Punctuation variety (commas, colons, semicolons indicate complex structure)
    const punctuationTypes = [',', ':', ';', '(', ')', '[', ']', '"', "'"].filter(p => text.includes(p));
    const punctuationScore = punctuationTypes.length / 9;

    // Nesting indicators (parentheses, quotes, brackets)
    const nestingCount = (text.match(/[([{]/g) || []).length;
    const nestingScore = Math.min(nestingCount / 5, 1);

    return (sentenceLengthScore * 0.3) + (sentenceCountScore * 0.2) + (punctuationScore * 0.3) + (nestingScore * 0.2);
  }

  /**
   * Analyze semantic density
   * Factors: concept indicators, abstract terms, relationship markers
   */
  private analyzeSemanticDensity(text: string): number {
    const lowerText = text.toLowerCase();

    // Abstract concept indicators
    const abstractConcepts = [
      'concept', 'theory', 'principle', 'approach', 'methodology', 'framework',
      'philosophy', 'strategy', 'paradigm', 'hypothesis',
      // Japanese equivalents
      '概念', '理論', '原理', 'アプローチ', '方法論', 'フレームワーク',
      '哲学', '戦略', 'パラダイム', '仮説'
    ];
    const abstractScore = abstractConcepts.filter(term => lowerText.includes(term)).length / abstractConcepts.length;

    // Relationship markers (indicates complex reasoning)
    const relationshipMarkers = [
      'because', 'therefore', 'however', 'although', 'furthermore', 'moreover',
      'consequently', 'nevertheless', 'meanwhile', 'in contrast',
      // Japanese equivalents
      'なぜなら', 'したがって', 'しかし', 'けれども', 'さらに', 'また',
      '結果として', 'それにもかかわらず', '一方', '対照的に'
    ];
    const relationshipScore = relationshipMarkers.filter(marker => lowerText.includes(marker)).length / relationshipMarkers.length;

    // Domain-specific terminology (technical, scientific, business)
    const domainTerms = [
      'algorithm', 'analysis', 'architecture', 'implementation', 'optimization',
      'integration', 'validation', 'performance', 'scalability', 'efficiency',
      // Japanese equivalents
      'アルゴリズム', '解析', 'アーキテクチャ', '実装', '最適化',
      '統合', '検証', 'パフォーマンス', 'スケーラビリティ', '効率'
    ];
    const domainScore = domainTerms.filter(term => lowerText.includes(term)).length / domainTerms.length;

    return (abstractScore * 0.35) + (relationshipScore * 0.35) + (domainScore * 0.30);
  }

  /**
   * Analyze entity count
   * More entities = more complex to extract and relate
   */
  private analyzeEntityCount(text: string): number {
    // Capitalized words (potential entities)
    const capitalizedWords = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
    const uniqueCapitalized = new Set(capitalizedWords.filter(w => w.length > 2));

    // Numbers (potential quantitative entities)
    const numbers = text.match(/\b\d+(?:\.\d+)?(?:%|円|ドル|人|個)?\b/g) || [];

    // Quoted terms (explicit entities)
    const quotedTerms = text.match(/"([^"]+)"|「([^」]+)」/g) || [];

    const totalEntityCount = uniqueCapitalized.size + numbers.length + quotedTerms.length;
    return Math.min(totalEntityCount / 20, 1); // Normalize: 20+ entities = max complexity
  }

  /**
   * Analyze relationship density
   * Connection words indicate complex relationships between concepts
   */
  private analyzeRelationshipDensity(text: string): number {
    const lowerText = text.toLowerCase();
    const words = text.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return 0;

    // Relationship indicators
    const relationshipIndicators = [
      // English
      'after', 'before', 'during', 'following', 'next', 'then', 'finally',
      'causes', 'results in', 'leads to', 'affects', 'impacts',
      'includes', 'contains', 'comprises', 'consists of',
      'depends on', 'requires', 'needs', 'uses', 'applies',
      // Japanese
      '次に', 'その後', 'その前', '続いて', '最後に',
      'により', 'によって', 'から', 'まで', 'を経て',
      '含む', '含まれる', '構成する', '依存', '必要',
      '使用', '適用', '影響', '結果'
    ];

    const relationshipCount = relationshipIndicators.filter(indicator =>
      lowerText.includes(indicator)
    ).length;

    // Calculate density: relationship markers per 100 words
    const density = (relationshipCount / words.length) * 100;
    return Math.min(density / 10, 1); // Normalize: 10+ markers per 100 words = max complexity
  }

  /**
   * Generate human-readable reasoning for complexity assessment
   */
  private generateReasoning(level: 'simple' | 'moderate' | 'complex', factors: ComplexityAnalysis['factors']): string {
    const topFactors = Object.entries(factors)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2)
      .map(([name]) => this.formatFactorName(name));

    if (level === 'simple') {
      return `Simple content detected. Primary factors: ${topFactors.join(', ')}. Using Flash model for optimal speed.`;
    } else if (level === 'moderate') {
      return `Moderate complexity detected. Primary factors: ${topFactors.join(', ')}. Flash model can handle this efficiently.`;
    } else {
      return `Complex content detected. Primary factors: ${topFactors.join(', ')}. Using Pro model for highest accuracy.`;
    }
  }

  /**
   * Format factor name for human readability
   */
  private formatFactorName(name: string): string {
    return name
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  /**
   * Get complexity statistics for monitoring
   */
  getComplexityStats(analyses: ComplexityAnalysis[]): {
    avgComplexity: number;
    modelDistribution: Record<string, number>;
    levelDistribution: Record<string, number>;
  } {
    if (analyses.length === 0) {
      return {
        avgComplexity: 0,
        modelDistribution: {},
        levelDistribution: {}
      };
    }

    const avgComplexity = analyses.reduce((sum, a) => sum + a.score, 0) / analyses.length;

    const modelDistribution = analyses.reduce((dist, a) => {
      dist[a.recommendedModel] = (dist[a.recommendedModel] || 0) + 1;
      return dist;
    }, {} as Record<string, number>);

    const levelDistribution = analyses.reduce((dist, a) => {
      dist[a.level] = (dist[a.level] || 0) + 1;
      return dist;
    }, {} as Record<string, number>);

    return {
      avgComplexity,
      modelDistribution,
      levelDistribution
    };
  }
}
