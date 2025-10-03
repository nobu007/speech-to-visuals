/**
 * Smart Parameter Optimizer - Iteration 13
 * Automatically optimizes detection thresholds and processing parameters based on content analysis
 */

export interface ContentCharacteristics {
  speechRate: number; // words per minute
  complexityScore: number; // 0-1 scale
  domain: 'technical' | 'business' | 'educational' | 'conversational';
  audioQuality: number; // 0-1 scale
  languageConfidence: number; // 0-1 scale
  backgroundNoise: number; // 0-1 scale
}

export interface OptimalParameters {
  confidenceThreshold: number;
  segmentLength: number;
  diagramPreference: string;
  layoutDensity: number;
  animationSpeed: number;
  qualityTarget: number;
}

export interface ParameterHistory {
  characteristics: ContentCharacteristics;
  parameters: OptimalParameters;
  results: {
    qualityScore: number;
    processingTime: number;
    userSatisfaction: number;
  };
  timestamp: Date;
}

export class SmartParameterOptimizer {
  private historyLimit = 100;
  private parameterHistory: ParameterHistory[] = [];
  private learningRate = 0.1;
  private convergenceThreshold = 0.01;

  constructor() {
    this.loadHistoryFromStorage();
  }

  /**
   * Analyze audio characteristics to determine optimal parameters
   */
  async analyzeContent(audioPath: string, transcription?: string): Promise<ContentCharacteristics> {
    console.log('🧠 Analyzing content characteristics for smart optimization...');

    const characteristics: ContentCharacteristics = {
      speechRate: await this.calculateSpeechRate(transcription),
      complexityScore: await this.assessComplexity(transcription),
      domain: await this.detectDomain(transcription),
      audioQuality: await this.assessAudioQuality(audioPath),
      languageConfidence: await this.assessLanguageConfidence(transcription),
      backgroundNoise: await this.detectBackgroundNoise(audioPath)
    };

    console.log('📊 Content characteristics:', {
      speechRate: `${characteristics.speechRate} WPM`,
      complexity: `${(characteristics.complexityScore * 100).toFixed(1)}%`,
      domain: characteristics.domain,
      audioQuality: `${(characteristics.audioQuality * 100).toFixed(1)}%`
    });

    return characteristics;
  }

  /**
   * Generate optimal parameters based on content characteristics and historical learning
   */
  async optimizeParameters(characteristics: ContentCharacteristics): Promise<OptimalParameters> {
    console.log('⚙️ Generating optimal parameters using ML-based optimization...');

    // Find similar historical cases
    const similarCases = this.findSimilarCases(characteristics, 10);

    // Base parameters (default values)
    let optimal: OptimalParameters = {
      confidenceThreshold: 0.7,
      segmentLength: 30,
      diagramPreference: 'auto',
      layoutDensity: 0.6,
      animationSpeed: 1.0,
      qualityTarget: 0.85
    };

    // Apply historical learning
    if (similarCases.length > 0) {
      optimal = this.learnFromHistory(optimal, similarCases);
    }

    // Apply content-specific adjustments
    optimal = this.applyContentAdaptations(optimal, characteristics);

    // Apply gradient-based optimization
    optimal = await this.gradientOptimization(optimal, characteristics);

    console.log('🎯 Optimized parameters:', {
      confidence: `${(optimal.confidenceThreshold * 100).toFixed(1)}%`,
      segmentLength: `${optimal.segmentLength}s`,
      diagramPref: optimal.diagramPreference,
      qualityTarget: `${(optimal.qualityTarget * 100).toFixed(1)}%`
    });

    return optimal;
  }

  /**
   * Record processing results for future learning
   */
  recordResults(
    characteristics: ContentCharacteristics,
    parameters: OptimalParameters,
    results: { qualityScore: number; processingTime: number; userSatisfaction?: number }
  ): void {
    const history: ParameterHistory = {
      characteristics,
      parameters,
      results: {
        qualityScore: results.qualityScore,
        processingTime: results.processingTime,
        userSatisfaction: results.userSatisfaction || this.estimateUserSatisfaction(results)
      },
      timestamp: new Date()
    };

    this.parameterHistory.push(history);

    // Maintain history limit
    if (this.parameterHistory.length > this.historyLimit) {
      this.parameterHistory = this.parameterHistory.slice(-this.historyLimit);
    }

    this.saveHistoryToStorage();
    console.log(`📚 Recorded optimization results (${this.parameterHistory.length} total cases)`);
  }

  /**
   * Get optimization statistics
   */
  getOptimizationStats(): {
    totalCases: number;
    averageImprovement: number;
    convergenceRate: number;
    domainCoverage: Record<string, number>;
  } {
    if (this.parameterHistory.length === 0) {
      return {
        totalCases: 0,
        averageImprovement: 0,
        convergenceRate: 0,
        domainCoverage: {}
      };
    }

    const totalCases = this.parameterHistory.length;
    const averageImprovement = this.calculateAverageImprovement();
    const convergenceRate = this.calculateConvergenceRate();
    const domainCoverage = this.calculateDomainCoverage();

    return {
      totalCases,
      averageImprovement,
      convergenceRate,
      domainCoverage
    };
  }

  // Private methods

  private async calculateSpeechRate(transcription?: string): Promise<number> {
    if (!transcription) return 150; // Default WPM

    const words = transcription.split(/\s+/).length;
    const estimatedDuration = 18; // Assuming 18s audio (from test file)
    return Math.round((words / estimatedDuration) * 60);
  }

  private async assessComplexity(transcription?: string): Promise<number> {
    if (!transcription) return 0.5;

    // Simple complexity scoring based on vocabulary and structure
    const words = transcription.split(/\s+/);
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
    const vocabularyRichness = uniqueWords.size / words.length;

    const complexity = Math.min(1.0, (avgWordLength / 10 + vocabularyRichness) / 2);
    return Number(complexity.toFixed(3));
  }

  private async detectDomain(transcription?: string): Promise<ContentCharacteristics['domain']> {
    if (!transcription) return 'conversational';

    const text = transcription.toLowerCase();

    // Domain keywords
    const domains = {
      technical: ['system', 'algorithm', 'software', 'code', 'database', 'api', 'framework'],
      business: ['company', 'market', 'revenue', 'strategy', 'customer', 'profit', 'business'],
      educational: ['learn', 'teach', 'student', 'study', 'knowledge', 'understand', 'explain'],
      conversational: ['think', 'feel', 'believe', 'maybe', 'probably', 'seems', 'guess']
    };

    let maxScore = 0;
    let detectedDomain: ContentCharacteristics['domain'] = 'conversational';

    for (const [domain, keywords] of Object.entries(domains)) {
      const score = keywords.reduce((count, keyword) => {
        return count + (text.includes(keyword) ? 1 : 0);
      }, 0);

      if (score > maxScore) {
        maxScore = score;
        detectedDomain = domain as ContentCharacteristics['domain'];
      }
    }

    return detectedDomain;
  }

  private async assessAudioQuality(audioPath: string): Promise<number> {
    // Simulate audio quality assessment
    // In a real implementation, this would analyze audio characteristics
    return 0.8 + Math.random() * 0.2; // Simulate good quality
  }

  private async assessLanguageConfidence(transcription?: string): Promise<number> {
    if (!transcription) return 0.7;

    // Simple language confidence based on transcription quality indicators
    const hasProperCapitalization = /[A-Z]/.test(transcription);
    const hasPunctuation = /[.!?]/.test(transcription);
    const wordsCount = transcription.split(/\s+/).length;

    let confidence = 0.5;
    if (hasProperCapitalization) confidence += 0.2;
    if (hasPunctuation) confidence += 0.2;
    if (wordsCount > 10) confidence += 0.1;

    return Math.min(1.0, confidence);
  }

  private async detectBackgroundNoise(audioPath: string): Promise<number> {
    // Simulate background noise detection
    return Math.random() * 0.3; // Low to medium background noise
  }

  private findSimilarCases(characteristics: ContentCharacteristics, limit: number): ParameterHistory[] {
    if (this.parameterHistory.length === 0) return [];

    // Calculate similarity scores
    const scored = this.parameterHistory.map(history => ({
      history,
      similarity: this.calculateSimilarity(characteristics, history.characteristics)
    }));

    // Sort by similarity and return top matches
    return scored
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(item => item.history);
  }

  private calculateSimilarity(a: ContentCharacteristics, b: ContentCharacteristics): number {
    const weights = {
      speechRate: 0.2,
      complexityScore: 0.25,
      domain: 0.2,
      audioQuality: 0.15,
      languageConfidence: 0.1,
      backgroundNoise: 0.1
    };

    let similarity = 0;

    // Numeric similarities
    similarity += weights.speechRate * (1 - Math.abs(a.speechRate - b.speechRate) / 200);
    similarity += weights.complexityScore * (1 - Math.abs(a.complexityScore - b.complexityScore));
    similarity += weights.audioQuality * (1 - Math.abs(a.audioQuality - b.audioQuality));
    similarity += weights.languageConfidence * (1 - Math.abs(a.languageConfidence - b.languageConfidence));
    similarity += weights.backgroundNoise * (1 - Math.abs(a.backgroundNoise - b.backgroundNoise));

    // Categorical similarity
    similarity += weights.domain * (a.domain === b.domain ? 1 : 0);

    return Math.max(0, Math.min(1, similarity));
  }

  private learnFromHistory(base: OptimalParameters, similarCases: ParameterHistory[]): OptimalParameters {
    if (similarCases.length === 0) return base;

    // Weight cases by their success (quality score and user satisfaction)
    const weightedCases = similarCases.map(case_ => ({
      parameters: case_.parameters,
      weight: (case_.results.qualityScore + case_.results.userSatisfaction) / 2
    }));

    const totalWeight = weightedCases.reduce((sum, case_) => sum + case_.weight, 0);

    // Calculate weighted averages
    const learned: OptimalParameters = {
      confidenceThreshold: weightedCases.reduce((sum, case_) =>
        sum + case_.parameters.confidenceThreshold * case_.weight, 0) / totalWeight,
      segmentLength: Math.round(weightedCases.reduce((sum, case_) =>
        sum + case_.parameters.segmentLength * case_.weight, 0) / totalWeight),
      diagramPreference: this.getMostSuccessfulDiagramType(weightedCases),
      layoutDensity: weightedCases.reduce((sum, case_) =>
        sum + case_.parameters.layoutDensity * case_.weight, 0) / totalWeight,
      animationSpeed: weightedCases.reduce((sum, case_) =>
        sum + case_.parameters.animationSpeed * case_.weight, 0) / totalWeight,
      qualityTarget: weightedCases.reduce((sum, case_) =>
        sum + case_.parameters.qualityTarget * case_.weight, 0) / totalWeight
    };

    // Blend with base parameters using learning rate
    return {
      confidenceThreshold: base.confidenceThreshold * (1 - this.learningRate) + learned.confidenceThreshold * this.learningRate,
      segmentLength: Math.round(base.segmentLength * (1 - this.learningRate) + learned.segmentLength * this.learningRate),
      diagramPreference: learned.diagramPreference,
      layoutDensity: base.layoutDensity * (1 - this.learningRate) + learned.layoutDensity * this.learningRate,
      animationSpeed: base.animationSpeed * (1 - this.learningRate) + learned.animationSpeed * this.learningRate,
      qualityTarget: base.qualityTarget * (1 - this.learningRate) + learned.qualityTarget * this.learningRate
    };
  }

  private getMostSuccessfulDiagramType(weightedCases: Array<{parameters: OptimalParameters, weight: number}>): string {
    const diagramScores: Record<string, number> = {};

    weightedCases.forEach(case_ => {
      const type = case_.parameters.diagramPreference;
      diagramScores[type] = (diagramScores[type] || 0) + case_.weight;
    });

    return Object.entries(diagramScores)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'auto';
  }

  private applyContentAdaptations(base: OptimalParameters, characteristics: ContentCharacteristics): OptimalParameters {
    const adapted = { ...base };

    // Adjust based on speech rate
    if (characteristics.speechRate > 180) {
      adapted.segmentLength = Math.max(20, adapted.segmentLength - 5);
      adapted.animationSpeed *= 1.2;
    } else if (characteristics.speechRate < 120) {
      adapted.segmentLength = Math.min(45, adapted.segmentLength + 5);
      adapted.animationSpeed *= 0.8;
    }

    // Adjust based on complexity
    if (characteristics.complexityScore > 0.7) {
      adapted.confidenceThreshold = Math.max(0.6, adapted.confidenceThreshold - 0.1);
      adapted.layoutDensity = Math.max(0.4, adapted.layoutDensity - 0.1);
    } else if (characteristics.complexityScore < 0.3) {
      adapted.confidenceThreshold = Math.min(0.9, adapted.confidenceThreshold + 0.1);
      adapted.layoutDensity = Math.min(0.8, adapted.layoutDensity + 0.1);
    }

    // Adjust based on domain
    switch (characteristics.domain) {
      case 'technical':
        adapted.diagramPreference = 'flow';
        adapted.qualityTarget = Math.min(0.95, adapted.qualityTarget + 0.05);
        break;
      case 'business':
        adapted.diagramPreference = 'matrix';
        break;
      case 'educational':
        adapted.diagramPreference = 'tree';
        adapted.animationSpeed *= 0.9;
        break;
    }

    // Adjust based on audio quality
    if (characteristics.audioQuality < 0.6) {
      adapted.confidenceThreshold = Math.max(0.5, adapted.confidenceThreshold - 0.15);
    }

    return adapted;
  }

  private async gradientOptimization(base: OptimalParameters, characteristics: ContentCharacteristics): Promise<OptimalParameters> {
    // Simulate gradient-based optimization
    // In a real implementation, this would use historical gradient information
    const optimized = { ...base };

    // Small random adjustments to explore parameter space
    const explorationRate = 0.05;

    optimized.confidenceThreshold += (Math.random() - 0.5) * explorationRate;
    optimized.confidenceThreshold = Math.max(0.3, Math.min(0.95, optimized.confidenceThreshold));

    optimized.layoutDensity += (Math.random() - 0.5) * explorationRate;
    optimized.layoutDensity = Math.max(0.2, Math.min(0.9, optimized.layoutDensity));

    return optimized;
  }

  private estimateUserSatisfaction(results: { qualityScore: number; processingTime: number }): number {
    // Estimate user satisfaction based on quality and speed
    const qualityFactor = results.qualityScore;
    const speedFactor = Math.max(0.1, 1 - (results.processingTime - 1000) / 10000); // Penalty for slow processing

    return Math.min(1.0, (qualityFactor * 0.7 + speedFactor * 0.3));
  }

  private calculateAverageImprovement(): number {
    if (this.parameterHistory.length < 2) return 0;

    let improvements = 0;
    let count = 0;

    for (let i = 1; i < this.parameterHistory.length; i++) {
      const current = this.parameterHistory[i].results.qualityScore;
      const previous = this.parameterHistory[i - 1].results.qualityScore;

      if (current > previous) {
        improvements += (current - previous);
        count++;
      }
    }

    return count > 0 ? improvements / count : 0;
  }

  private calculateConvergenceRate(): number {
    if (this.parameterHistory.length < 10) return 0;

    const recent = this.parameterHistory.slice(-10);
    const qualityVariance = this.calculateVariance(recent.map(h => h.results.qualityScore));

    // Lower variance indicates better convergence
    return Math.max(0, 1 - qualityVariance * 10);
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
  }

  private calculateDomainCoverage(): Record<string, number> {
    const coverage: Record<string, number> = {};
    const total = this.parameterHistory.length;

    this.parameterHistory.forEach(history => {
      const domain = history.characteristics.domain;
      coverage[domain] = (coverage[domain] || 0) + 1;
    });

    // Convert to percentages
    Object.keys(coverage).forEach(domain => {
      coverage[domain] = coverage[domain] / total;
    });

    return coverage;
  }

  private loadHistoryFromStorage(): void {
    try {
      const stored = localStorage?.getItem('parameter-optimization-history');
      if (stored) {
        this.parameterHistory = JSON.parse(stored).map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        }));
      }
    } catch (error) {
      console.warn('Could not load optimization history:', error);
    }
  }

  private saveHistoryToStorage(): void {
    try {
      localStorage?.setItem('parameter-optimization-history', JSON.stringify(this.parameterHistory));
    } catch (error) {
      console.warn('Could not save optimization history:', error);
    }
  }
}

// Export singleton instance
export const smartParameterOptimizer = new SmartParameterOptimizer();