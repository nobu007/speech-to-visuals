/**
 * Iteration 21: Adaptive Content Processor
 *
 * Intelligent system that adapts processing strategies based on content characteristics,
 * user preferences, and real-time performance metrics.
 */

import { DiagramType, ContentSegment, EntityNode, EntityEdge } from '@/types/diagram';
import { globalCache } from '../performance/intelligent-cache';

interface ContentCharacteristics {
  length: number;
  complexity: number;
  domain: string;
  technicalLevel: 'basic' | 'intermediate' | 'advanced' | 'expert';
  language: string;
  structure: 'narrative' | 'procedural' | 'descriptive' | 'analytical';
  clarity: number; // 0-1 score
  cohesion: number; // 0-1 score
}

interface ProcessingStrategy {
  id: string;
  name: string;
  description: string;
  applicableFor: (characteristics: ContentCharacteristics) => boolean;
  estimatedTime: number;
  accuracyExpected: number;
  resourceIntensity: 'low' | 'medium' | 'high';
  parameters: {
    segmentationThreshold: number;
    diagramTypeConfidence: number;
    layoutComplexity: number;
    animationDensity: number;
  };
}

interface AdaptationResult {
  strategy: ProcessingStrategy;
  adaptations: AdaptationDecision[];
  estimatedPerformance: {
    processingTime: number;
    accuracy: number;
    userSatisfaction: number;
  };
  reasoning: string[];
}

interface AdaptationDecision {
  component: string;
  originalSetting: any;
  adaptedSetting: any;
  reason: string;
  expectedImpact: number; // -1 to 1 scale
}

interface UserPreferences {
  preferredSpeed: 'fast' | 'balanced' | 'quality';
  visualStyle: 'minimal' | 'standard' | 'rich';
  technicalDetail: 'low' | 'medium' | 'high';
  animationLevel: 'none' | 'subtle' | 'moderate' | 'dynamic';
  accessibility: {
    highContrast: boolean;
    largeText: boolean;
    reducedMotion: boolean;
    screenReader: boolean;
  };
}

/**
 * Advanced adaptive content processing system
 */
export class AdaptiveContentProcessor {
  private strategies: ProcessingStrategy[] = [];
  private adaptationHistory: Map<string, AdaptationResult[]> = new Map();
  private performanceMetrics: Map<string, number[]> = new Map();
  private userPreferences: UserPreferences;

  constructor(userPreferences?: Partial<UserPreferences>) {
    this.userPreferences = {
      preferredSpeed: 'balanced',
      visualStyle: 'standard',
      technicalDetail: 'medium',
      animationLevel: 'moderate',
      accessibility: {
        highContrast: false,
        largeText: false,
        reducedMotion: false,
        screenReader: false
      },
      ...userPreferences
    };

    this.initializeStrategies();
  }

  /**
   * Initialize processing strategies
   */
  private initializeStrategies(): void {
    this.strategies = [
      {
        id: 'fast_basic',
        name: 'Fast Basic Processing',
        description: 'Quick processing for simple, straightforward content',
        applicableFor: (char) => char.complexity < 0.3 && char.length < 1000,
        estimatedTime: 500,
        accuracyExpected: 0.85,
        resourceIntensity: 'low',
        parameters: {
          segmentationThreshold: 0.6,
          diagramTypeConfidence: 0.7,
          layoutComplexity: 0.3,
          animationDensity: 0.2
        }
      },
      {
        id: 'balanced_standard',
        name: 'Balanced Standard Processing',
        description: 'Good balance of speed and quality for typical content',
        applicableFor: (char) => char.complexity >= 0.3 && char.complexity <= 0.7,
        estimatedTime: 1200,
        accuracyExpected: 0.92,
        resourceIntensity: 'medium',
        parameters: {
          segmentationThreshold: 0.75,
          diagramTypeConfidence: 0.8,
          layoutComplexity: 0.6,
          animationDensity: 0.5
        }
      },
      {
        id: 'high_quality',
        name: 'High Quality Processing',
        description: 'Maximum quality for complex, important content',
        applicableFor: (char) => char.complexity > 0.7 || char.technicalLevel === 'expert',
        estimatedTime: 2500,
        accuracyExpected: 0.96,
        resourceIntensity: 'high',
        parameters: {
          segmentationThreshold: 0.85,
          diagramTypeConfidence: 0.9,
          layoutComplexity: 0.9,
          animationDensity: 0.8
        }
      },
      {
        id: 'accessible_friendly',
        name: 'Accessibility-Optimized Processing',
        description: 'Optimized for users with accessibility needs',
        applicableFor: (char) => this.hasAccessibilityNeeds(),
        estimatedTime: 1500,
        accuracyExpected: 0.90,
        resourceIntensity: 'medium',
        parameters: {
          segmentationThreshold: 0.8,
          diagramTypeConfidence: 0.85,
          layoutComplexity: 0.4,
          animationDensity: 0.1
        }
      },
      {
        id: 'domain_specialized',
        name: 'Domain-Specialized Processing',
        description: 'Specialized processing for technical domains',
        applicableFor: (char) => this.isTechnicalDomain(char.domain),
        estimatedTime: 1800,
        accuracyExpected: 0.94,
        resourceIntensity: 'medium',
        parameters: {
          segmentationThreshold: 0.8,
          diagramTypeConfidence: 0.85,
          layoutComplexity: 0.7,
          animationDensity: 0.6
        }
      }
    ];
  }

  /**
   * Analyze content characteristics
   */
  async analyzeContent(content: string): Promise<ContentCharacteristics> {
    const words = content.split(/\s+/);
    const sentences = content.split(/[.!?]+/).filter(s => s.trim());

    // Basic metrics
    const length = content.length;
    const wordCount = words.length;
    const avgWordsPerSentence = wordCount / sentences.length;

    // Complexity analysis
    const complexity = this.calculateComplexity(content, words, sentences);

    // Domain detection
    const domain = this.detectDomain(content);

    // Technical level assessment
    const technicalLevel = this.assessTechnicalLevel(content, words);

    // Language detection (simplified)
    const language = this.detectLanguage(content);

    // Structure analysis
    const structure = this.analyzeStructure(content);

    // Clarity and cohesion
    const clarity = this.assessClarity(content, sentences, avgWordsPerSentence);
    const cohesion = this.assessCohesion(content, sentences);

    return {
      length,
      complexity,
      domain,
      technicalLevel,
      language,
      structure,
      clarity,
      cohesion
    };
  }

  /**
   * Select optimal processing strategy
   */
  async selectStrategy(characteristics: ContentCharacteristics): Promise<ProcessingStrategy> {
    // Filter applicable strategies
    const applicableStrategies = this.strategies.filter(strategy =>
      strategy.applicableFor(characteristics)
    );

    if (applicableStrategies.length === 0) {
      // Fallback to balanced strategy
      return this.strategies.find(s => s.id === 'balanced_standard')!;
    }

    // Score strategies based on user preferences and content
    const scoredStrategies = applicableStrategies.map(strategy => ({
      strategy,
      score: this.scoreStrategy(strategy, characteristics)
    }));

    // Sort by score and return best
    scoredStrategies.sort((a, b) => b.score - a.score);
    return scoredStrategies[0].strategy;
  }

  /**
   * Adapt strategy parameters based on real-time feedback
   */
  async adaptStrategy(
    strategy: ProcessingStrategy,
    characteristics: ContentCharacteristics,
    realtimeMetrics?: { processingTime: number; accuracy: number }
  ): Promise<AdaptationResult> {
    const adaptations: AdaptationDecision[] = [];
    const reasoning: string[] = [];

    // Speed optimization adaptations
    if (this.userPreferences.preferredSpeed === 'fast') {
      if (strategy.parameters.layoutComplexity > 0.5) {
        adaptations.push({
          component: 'layoutComplexity',
          originalSetting: strategy.parameters.layoutComplexity,
          adaptedSetting: Math.max(0.3, strategy.parameters.layoutComplexity - 0.2),
          reason: 'Reduced layout complexity for faster processing',
          expectedImpact: 0.3
        });
        reasoning.push('Simplified layout generation for speed optimization');
      }
    }

    // Quality optimization adaptations
    if (this.userPreferences.preferredSpeed === 'quality') {
      if (strategy.parameters.diagramTypeConfidence < 0.9) {
        adaptations.push({
          component: 'diagramTypeConfidence',
          originalSetting: strategy.parameters.diagramTypeConfidence,
          adaptedSetting: Math.min(0.95, strategy.parameters.diagramTypeConfidence + 0.1),
          reason: 'Increased confidence threshold for better quality',
          expectedImpact: 0.2
        });
        reasoning.push('Enhanced diagram detection for quality optimization');
      }
    }

    // Accessibility adaptations
    if (this.userPreferences.accessibility.reducedMotion) {
      adaptations.push({
        component: 'animationDensity',
        originalSetting: strategy.parameters.animationDensity,
        adaptedSetting: Math.min(0.2, strategy.parameters.animationDensity),
        reason: 'Reduced animations for accessibility',
        expectedImpact: 0.1
      });
      reasoning.push('Minimized animations for reduced motion preference');
    }

    // Content-specific adaptations
    if (characteristics.complexity > 0.8) {
      adaptations.push({
        component: 'segmentationThreshold',
        originalSetting: strategy.parameters.segmentationThreshold,
        adaptedSetting: Math.min(0.9, strategy.parameters.segmentationThreshold + 0.1),
        reason: 'Higher segmentation threshold for complex content',
        expectedImpact: 0.15
      });
      reasoning.push('Increased segmentation precision for complex content');
    }

    // Performance-based adaptations
    if (realtimeMetrics) {
      if (realtimeMetrics.processingTime > strategy.estimatedTime * 1.5) {
        adaptations.push({
          component: 'layoutComplexity',
          originalSetting: strategy.parameters.layoutComplexity,
          adaptedSetting: Math.max(0.2, strategy.parameters.layoutComplexity - 0.3),
          reason: 'Reduced complexity due to slow processing',
          expectedImpact: 0.4
        });
        reasoning.push('Simplified processing due to performance constraints');
      }

      if (realtimeMetrics.accuracy < strategy.accuracyExpected * 0.9) {
        adaptations.push({
          component: 'diagramTypeConfidence',
          originalSetting: strategy.parameters.diagramTypeConfidence,
          adaptedSetting: Math.min(0.95, strategy.parameters.diagramTypeConfidence + 0.15),
          reason: 'Increased confidence threshold due to low accuracy',
          expectedImpact: 0.25
        });
        reasoning.push('Enhanced accuracy measures due to performance feedback');
      }
    }

    // Create adapted strategy
    const adaptedStrategy = { ...strategy };
    adaptations.forEach(adaptation => {
      (adaptedStrategy.parameters as any)[adaptation.component] = adaptation.adaptedSetting;
    });

    // Estimate performance impact
    const estimatedPerformance = this.estimatePerformance(
      adaptedStrategy,
      characteristics,
      adaptations
    );

    return {
      strategy: adaptedStrategy,
      adaptations,
      estimatedPerformance,
      reasoning
    };
  }

  /**
   * Calculate content complexity
   */
  private calculateComplexity(content: string, words: string[], sentences: string[]): number {
    // Factors contributing to complexity
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
    const avgSentenceLength = words.length / sentences.length;
    const uniqueWordRatio = new Set(words.map(w => w.toLowerCase())).size / words.length;
    const punctuationDensity = (content.match(/[,:;]/g) || []).length / words.length;
    const technicalTerms = this.countTechnicalTerms(words);

    // Normalize and combine factors
    const lengthFactor = Math.min(avgWordLength / 6, 1) * 0.2;
    const sentenceFactor = Math.min(avgSentenceLength / 20, 1) * 0.25;
    const vocabularyFactor = (1 - uniqueWordRatio) * 0.2;
    const punctuationFactor = Math.min(punctuationDensity * 10, 1) * 0.15;
    const technicalFactor = Math.min(technicalTerms / words.length * 10, 1) * 0.2;

    return lengthFactor + sentenceFactor + vocabularyFactor + punctuationFactor + technicalFactor;
  }

  /**
   * Detect content domain
   */
  private detectDomain(content: string): string {
    const domainKeywords = {
      'technology': ['software', 'algorithm', 'database', 'system', 'programming', 'api'],
      'business': ['strategy', 'market', 'revenue', 'customer', 'profit', 'organization'],
      'science': ['research', 'experiment', 'hypothesis', 'data', 'analysis', 'methodology'],
      'education': ['learning', 'teaching', 'student', 'curriculum', 'assessment', 'knowledge'],
      'healthcare': ['patient', 'treatment', 'diagnosis', 'medical', 'therapy', 'clinical'],
      'finance': ['investment', 'portfolio', 'risk', 'return', 'capital', 'financial']
    };

    const scores = Object.entries(domainKeywords).map(([domain, keywords]) => ({
      domain,
      score: keywords.reduce((sum, keyword) => {
        return sum + (content.toLowerCase().includes(keyword) ? 1 : 0);
      }, 0)
    }));

    const bestMatch = scores.reduce((max, current) =>
      current.score > max.score ? current : max
    );

    return bestMatch.score > 0 ? bestMatch.domain : 'general';
  }

  /**
   * Assess technical level
   */
  private assessTechnicalLevel(content: string, words: string[]): 'basic' | 'intermediate' | 'advanced' | 'expert' {
    const technicalTermCount = this.countTechnicalTerms(words);
    const jargonRatio = technicalTermCount / words.length;

    if (jargonRatio > 0.15) return 'expert';
    if (jargonRatio > 0.1) return 'advanced';
    if (jargonRatio > 0.05) return 'intermediate';
    return 'basic';
  }

  /**
   * Count technical terms (simplified heuristic)
   */
  private countTechnicalTerms(words: string[]): number {
    const technicalPatterns = [
      /^[A-Z]{2,}$/, // Acronyms
      /.*[Tt]ech.*/, // Technology-related
      /.*[Ss]ystem.*/, // System-related
      /.*[Pp]rocess.*/, // Process-related
      /.*[Mm]ethod.*/, // Method-related
    ];

    return words.filter(word =>
      technicalPatterns.some(pattern => pattern.test(word)) ||
      word.length > 8 // Long words often technical
    ).length;
  }

  /**
   * Detect language (simplified)
   */
  private detectLanguage(content: string): string {
    // Simple heuristic - could be enhanced with proper language detection
    const japaneseChars = content.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g);
    if (japaneseChars && japaneseChars.length > content.length * 0.1) {
      return 'ja';
    }
    return 'en'; // Default to English
  }

  /**
   * Analyze content structure
   */
  private analyzeStructure(content: string): 'narrative' | 'procedural' | 'descriptive' | 'analytical' {
    const indicators = {
      narrative: ['story', 'then', 'next', 'finally', 'once'],
      procedural: ['step', 'process', 'procedure', 'method', 'first', 'second'],
      descriptive: ['describe', 'characteristic', 'feature', 'property', 'aspect'],
      analytical: ['analyze', 'compare', 'evaluate', 'assess', 'examine']
    };

    const scores = Object.entries(indicators).map(([type, words]) => ({
      type: type as any,
      score: words.reduce((sum, word) => {
        return sum + (content.toLowerCase().includes(word) ? 1 : 0);
      }, 0)
    }));

    const best = scores.reduce((max, current) =>
      current.score > max.score ? current : max
    );

    return best.score > 0 ? best.type : 'descriptive';
  }

  /**
   * Assess content clarity
   */
  private assessClarity(content: string, sentences: string[], avgWordsPerSentence: number): number {
    // Factors affecting clarity
    const sentenceLengthScore = Math.max(0, 1 - avgWordsPerSentence / 30);
    const repetitionScore = this.calculateRepetitionScore(content);
    const structureScore = this.calculateStructureScore(sentences);

    return (sentenceLengthScore + repetitionScore + structureScore) / 3;
  }

  /**
   * Assess content cohesion
   */
  private assessCohesion(content: string, sentences: string[]): number {
    // Simple cohesion metrics
    const transitionWords = ['however', 'therefore', 'furthermore', 'moreover', 'additionally'];
    const transitionScore = transitionWords.reduce((sum, word) => {
      return sum + (content.toLowerCase().includes(word) ? 1 : 0);
    }, 0) / sentences.length;

    const pronounUsage = (content.match(/\b(this|that|these|those|it|they)\b/gi) || []).length / sentences.length;

    return Math.min(1, (transitionScore * 0.6 + Math.min(pronounUsage / 2, 1) * 0.4));
  }

  /**
   * Helper methods for clarity assessment
   */
  private calculateRepetitionScore(content: string): number {
    const words = content.toLowerCase().match(/\w+/g) || [];
    const wordCounts = new Map<string, number>();

    words.forEach(word => {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    });

    const repetitiveWords = Array.from(wordCounts.values()).filter(count => count > 3).length;
    return Math.max(0, 1 - repetitiveWords / words.length * 5);
  }

  private calculateStructureScore(sentences: string[]): number {
    // Check for structured elements
    const hasNumbering = sentences.some(s => /^\d+[.)]\s/.test(s.trim()));
    const hasBullets = sentences.some(s => /^[-*•]\s/.test(s.trim()));
    const hasHeaders = sentences.some(s => s.length < 50 && !s.includes('.'));

    return (hasNumbering ? 0.4 : 0) + (hasBullets ? 0.3 : 0) + (hasHeaders ? 0.3 : 0);
  }

  /**
   * Score strategy based on user preferences and content
   */
  private scoreStrategy(strategy: ProcessingStrategy, characteristics: ContentCharacteristics): number {
    let score = 0;

    // Base applicability score
    score += strategy.applicableFor(characteristics) ? 50 : 0;

    // User preference alignment
    switch (this.userPreferences.preferredSpeed) {
      case 'fast':
        score += (1 - strategy.estimatedTime / 3000) * 30;
        break;
      case 'quality':
        score += strategy.accuracyExpected * 30;
        break;
      case 'balanced':
        score += (strategy.accuracyExpected * 0.5 + (1 - strategy.estimatedTime / 3000) * 0.5) * 30;
        break;
    }

    // Content appropriateness
    if (characteristics.complexity > 0.7 && strategy.accuracyExpected > 0.9) {
      score += 20; // Bonus for high-quality strategy on complex content
    }

    if (characteristics.complexity < 0.3 && strategy.estimatedTime < 1000) {
      score += 15; // Bonus for fast strategy on simple content
    }

    return score;
  }

  /**
   * Estimate performance of adapted strategy
   */
  private estimatePerformance(
    strategy: ProcessingStrategy,
    characteristics: ContentCharacteristics,
    adaptations: AdaptationDecision[]
  ): { processingTime: number; accuracy: number; userSatisfaction: number } {
    let processingTime = strategy.estimatedTime;
    let accuracy = strategy.accuracyExpected;

    // Apply adaptation impacts
    adaptations.forEach(adaptation => {
      if (adaptation.component === 'layoutComplexity' || adaptation.component === 'animationDensity') {
        const timeDelta = (adaptation.originalSetting - adaptation.adaptedSetting) * 500;
        processingTime -= timeDelta;
      }

      if (adaptation.component === 'diagramTypeConfidence' || adaptation.component === 'segmentationThreshold') {
        const accuracyDelta = (adaptation.adaptedSetting - adaptation.originalSetting) * 0.1;
        accuracy += accuracyDelta;
      }
    });

    // Estimate user satisfaction based on preference alignment
    let userSatisfaction = 0.7; // Base satisfaction

    if (this.userPreferences.preferredSpeed === 'fast' && processingTime < 1000) {
      userSatisfaction += 0.2;
    }
    if (this.userPreferences.preferredSpeed === 'quality' && accuracy > 0.9) {
      userSatisfaction += 0.2;
    }
    if (this.hasAccessibilityNeeds() && strategy.id === 'accessible_friendly') {
      userSatisfaction += 0.1;
    }

    return {
      processingTime: Math.max(200, processingTime),
      accuracy: Math.min(1, Math.max(0.5, accuracy)),
      userSatisfaction: Math.min(1, Math.max(0.3, userSatisfaction))
    };
  }

  /**
   * Check if user has accessibility needs
   */
  private hasAccessibilityNeeds(): boolean {
    const { accessibility } = this.userPreferences;
    return accessibility.highContrast || accessibility.largeText ||
           accessibility.reducedMotion || accessibility.screenReader;
  }

  /**
   * Check if domain is technical
   */
  private isTechnicalDomain(domain: string): boolean {
    return ['technology', 'science', 'healthcare'].includes(domain);
  }

  /**
   * Update user preferences
   */
  updateUserPreferences(preferences: Partial<UserPreferences>): void {
    this.userPreferences = { ...this.userPreferences, ...preferences };
  }

  /**
   * Get adaptation history for analysis
   */
  getAdaptationHistory(contentId?: string): AdaptationResult[] {
    if (contentId) {
      return this.adaptationHistory.get(contentId) || [];
    }
    return Array.from(this.adaptationHistory.values()).flat();
  }

  /**
   * Record adaptation result for learning
   */
  recordAdaptationResult(contentId: string, result: AdaptationResult): void {
    const history = this.adaptationHistory.get(contentId) || [];
    history.push(result);
    this.adaptationHistory.set(contentId, history);

    // Keep only recent adaptations (last 50 per content)
    if (history.length > 50) {
      history.splice(0, history.length - 50);
    }
  }
}

/**
 * Global adaptive processor instance
 */
export const globalAdaptiveProcessor = new AdaptiveContentProcessor();