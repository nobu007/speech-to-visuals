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

/** Browser-safe env accessor — returns undefined when process is unavailable (ISS-021) */
function safeEnv(key: string): string | undefined {
  try {
    return (typeof process !== 'undefined' && process.env) ? process.env[key] : undefined;
  } catch {
    return undefined;
  }
}

export interface ComplexityAnalysis {
  score: number; // 0-1 scale (0 = simple, 1 = complex)
  level: 'simple' | 'moderate' | 'complex';
  recommendedModel: string;
  factors: {
    vocabularyComplexity: number;
    structuralComplexity: number;
    semanticDensity: number;
    entityCount: number;
    relationshipDensity: number;
  };
  reasoning: string;
}

/**
 * TASK-0016: Complexity factor representing a single dimension of complexity.
 */
export interface ComplexityFactor {
  type: 'text_length' | 'sentence_complexity' | 'technical_density' | 'data_content' | 'abstractness';
  weight: number;    // Pre-defined weight for this factor type (0-1)
  contribution: number; // Actual contribution to the complexity score (0-1)
  description: string;
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
   * Analyze text complexity and recommend optimal LLM model.
   *
   * TASK-0016: Uses identifyComplexityFactors for score calculation and
   * selectModel for model recommendation (consistent with TASK-0016 spec).
   */
  analyze(text: string): ComplexityAnalysis {
    // Compute legacy factor dimensions for backward compatibility
    const legacyFactors = {
      vocabularyComplexity: this.analyzeVocabularyComplexity(text),
      structuralComplexity: this.analyzeStructuralComplexity(text),
      semanticDensity: this.analyzeSemanticDensity(text),
      entityCount: this.analyzeEntityCount(text),
      relationshipDensity: this.analyzeRelationshipDensity(text)
    };

    // TASK-0016: Use new factor-based scoring for the overall score
    const complexityFactors = this.identifyComplexityFactors(text);
    const score = complexityFactors.reduce(
      (sum, f) => sum + f.weight * f.contribution, 0
    );

    // Determine complexity level
    let level: 'simple' | 'moderate' | 'complex';
    if (score < this.SIMPLE_THRESHOLD) {
      level = 'simple';
    } else if (score < this.COMPLEX_THRESHOLD) {
      level = 'moderate';
    } else {
      level = 'complex';
    }

    // TASK-0016: Delegate model selection to selectModel (handles env vars)
    const recommendedModel = this.selectModel(score);

    const reasoning = this.generateReasoning(level, legacyFactors);

    return {
      score,
      level,
      recommendedModel,
      factors: legacyFactors,
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

  // =========================================================================
  // TASK-0016: Model selection with environment variable support
  // =========================================================================

  /**
   * Select the optimal LLM model based on complexity score.
   *
   * Rules:
   * - score < 0.2 → 'gemini-2.5-flash' (fast, cost-effective)
   * - score >= 0.2 → 'gemini-2.5-pro' (accurate, slower)
   * - DISABLE_GEMINI env → 'rule-based'
   * - GEMINI_MODEL_OVERRIDE env → override value (highest priority)
   */
  selectModel(score: number): string {
    // Highest priority: explicit override
    const override = safeEnv('GEMINI_MODEL_OVERRIDE');
    if (override) {
      return override;
    }

    // Second priority: disable Gemini entirely
    if (safeEnv('DISABLE_GEMINI')) {
      return 'rule-based';
    }

    // Default: score-based selection with 20% threshold
    const threshold = parseFloat(safeEnv('COMPLEXITY_THRESHOLD') ?? '0.2');
    return score < threshold ? 'gemini-2.5-flash' : 'gemini-2.5-pro';
  }

  // =========================================================================
  // TASK-0016: Complexity factor identification
  // =========================================================================

  /**
   * Factor weights as specified in TASK-0016:
   * - text_length: 0.15
   * - sentence_complexity: 0.25
   * - technical_density: 0.30
   * - data_content: 0.15
   * - abstractness: 0.15
   */
  private readonly FACTOR_WEIGHTS: Record<ComplexityFactor['type'], number> = {
    text_length: 0.15,
    sentence_complexity: 0.25,
    technical_density: 0.30,
    data_content: 0.15,
    abstractness: 0.15,
  };

  /**
   * Identify individual complexity factors contributing to the overall score.
   * Each factor has a fixed weight and a computed contribution based on text content.
   */
  identifyComplexityFactors(text: string): ComplexityFactor[] {
    const factors: ComplexityFactor[] = [];

    // 1. text_length: longer text is more complex
    const textLengthScore = this.computeTextLength(text);
    factors.push({
      type: 'text_length',
      weight: this.FACTOR_WEIGHTS.text_length,
      contribution: textLengthScore,
      description: textLengthScore > 0.5
        ? 'Long text increases processing complexity'
        : 'Text length is within normal range',
    });

    // 2. sentence_complexity: longer and nested sentences
    const sentenceComplexityScore = this.computeSentenceComplexity(text);
    factors.push({
      type: 'sentence_complexity',
      weight: this.FACTOR_WEIGHTS.sentence_complexity,
      contribution: sentenceComplexityScore,
      description: sentenceComplexityScore > 0.5
        ? 'Complex sentence structure detected'
        : 'Sentence structure is relatively simple',
    });

    // 3. technical_density: specialized terminology and jargon
    const technicalDensityScore = this.computeTechnicalDensity(text);
    factors.push({
      type: 'technical_density',
      weight: this.FACTOR_WEIGHTS.technical_density,
      contribution: technicalDensityScore,
      description: technicalDensityScore > 0.5
        ? 'High density of technical terminology'
        : 'Low technical term density',
    });

    // 4. data_content: numbers, percentages, statistics
    const dataContentScore = this.computeDataContent(text);
    factors.push({
      type: 'data_content',
      weight: this.FACTOR_WEIGHTS.data_content,
      contribution: dataContentScore,
      description: dataContentScore > 0.3
        ? 'Contains quantitative data and statistics'
        : 'Minimal quantitative content',
    });

    // 5. abstractness: abstract concepts and theoretical content
    const abstractnessScore = this.computeAbstractness(text);
    factors.push({
      type: 'abstractness',
      weight: this.FACTOR_WEIGHTS.abstractness,
      contribution: abstractnessScore,
      description: abstractnessScore > 0.3
        ? 'Contains abstract concepts'
        : 'Content is concrete',
    });

    return factors;
  }

  // -------------------------------------------------------------------------
  // Private helpers for factor computation
  // -------------------------------------------------------------------------

  private computeTextLength(text: string): number {
    if (text.length === 0) return 0;
    // Normalize: 500+ chars → max complexity
    return Math.min(text.length / 500, 1);
  }

  private computeSentenceComplexity(text: string): number {
    // Split on sentence-ending punctuation
    const sentences = text.split(/[。.!?\n]+/).filter(s => s.trim().length > 0);
    if (sentences.length === 0) return 0;

    // Average sentence length
    const avgLen = text.length / sentences.length;
    const lenScore = Math.min(avgLen / 100, 1);

    // Comma / conjunction count indicates nesting
    const commas = (text.match(/[、,;；]/g) || []).length;
    const commaScore = Math.min(commas / 5, 1);

    return lenScore * 0.6 + commaScore * 0.4;
  }

  private computeTechnicalDensity(text: string): number {
    const lower = text.toLowerCase();
    const technicalTerms = [
      // English
      'algorithm', 'api', 'architecture', 'async', 'await',
      'callback', 'class', 'closure', 'compiler', 'component',
      'concurrent', 'database', 'debugging', 'deploy', 'dependency',
      'encryption', 'endpoint', 'event loop', 'exception', 'framework',
      'function', 'garbage collection', 'generator', 'heap', 'http',
      'inheritance', 'interface', 'iterator', 'lambda', 'library',
      'middleware', 'module', 'mutex', 'node', 'object',
      'promise', 'protocol', 'queue', 'recursion', 'refactoring',
      'runtime', 'scheduler', 'scope', 'server', 'stack',
      'stream', 'thread', 'token', 'type', 'variable',
      // Japanese equivalents
      'アルゴリズム', 'アーキテクチャ', '非同期', 'コールバック',
      'クロージャ', 'コンパイラ', 'コンポーネント', 'データベース',
      'デバッグ', 'デプロイ', '依存', '暗号化', 'イベントループ',
      '例外', 'フレームワーク', 'ガベージコレクション', 'ヒープ',
      '継承', 'インターフェース', 'イテレータ', 'ミドルウェア',
      'モジュール', 'プロミス', 'プロトコル', 'キュー', '再帰',
      'リファクタリング', 'ランタイム', 'スケジューラ', 'サーバー',
      'スタック', 'ストリーム', 'スレッド', 'マイクロタスク',
    ];

    const matchCount = technicalTerms.filter(t => lower.includes(t)).length;
    return Math.min(matchCount / 5, 1);
  }

  private computeDataContent(text: string): number {
    // Count numeric patterns: percentages, monetary values, quantities
    const percentages = (text.match(/\d+(?:\.\d+)?%/g) || []).length;
    const numbers = (text.match(/\d+(?:\.\d+)?/g) || []).length;
    const dataIndicators = (text.match(/[图表グラフチャート]/g) || []).length;

    // Normalize: 3+ data points → high data content
    const dataScore = Math.min((percentages * 2 + numbers + dataIndicators) / 6, 1);
    return dataScore;
  }

  private computeAbstractness(text: string): number {
    const lower = text.toLowerCase();

    const abstractTerms = [
      // English
      'abstract', 'concept', 'conceptual', 'fundamental', 'intrinsic',
      'metaphor', 'ontolog', 'paradigm', 'phenomenon', 'philosophy',
      'principle', 'qualitative', 'quantum', 'semantic', 'structuralism',
      'theoretical', 'transcend', 'universal',
      // Japanese
      '概念', '抽象', '原理', '哲学', '理論', '本質', '普遍',
      'パラダイム', '存在論', '現象', '仮説', '意味論',
    ];

    const matchCount = abstractTerms.filter(t => lower.includes(t)).length;
    return Math.min(matchCount / 3, 1);
  }
}
