/**
 * Adaptive Processing System
 * Dynamically adjusts processing strategy based on audio characteristics
 * and real-time performance feedback
 */

import { ContentCharacteristics, ParameterSet } from './smart-parameter-tuner.js';

export interface ProcessingStrategy {
  name: string;
  description: string;
  transcriptionConfig: {
    model: 'tiny' | 'base' | 'small' | 'medium' | 'large';
    language?: string;
    temperature: number;
  };
  analysisConfig: {
    segmentationStrategy: 'time-based' | 'content-based' | 'hybrid';
    keywordExtractionDepth: 'shallow' | 'medium' | 'deep';
    confidenceThreshold: number;
  };
  layoutConfig: {
    algorithm: 'dagre' | 'force-directed' | 'hierarchical';
    iterations: number;
    spacing: number;
  };
  renderConfig: {
    quality: 'draft' | 'standard' | 'high' | 'ultra';
    fps: number;
    resolution: string;
  };
}

export interface AdaptiveDecision {
  selectedStrategy: ProcessingStrategy;
  reasoning: string[];
  expectedPerformance: {
    processingTime: number;
    memoryUsage: number;
    qualityScore: number;
  };
  confidence: number;
}

class AdaptiveProcessor {
  private strategyHistory: Map<string, ProcessingStrategy[]> = new Map();
  private performanceMetrics: Map<string, number[]> = new Map();

  /**
   * Predefined processing strategies for different scenarios
   */
  private strategies: ProcessingStrategy[] = [
    {
      name: 'fast-preview',
      description: 'Optimized for speed with acceptable quality',
      transcriptionConfig: {
        model: 'tiny',
        temperature: 0.2
      },
      analysisConfig: {
        segmentationStrategy: 'time-based',
        keywordExtractionDepth: 'shallow',
        confidenceThreshold: 0.6
      },
      layoutConfig: {
        algorithm: 'dagre',
        iterations: 50,
        spacing: 1.2
      },
      renderConfig: {
        quality: 'draft',
        fps: 24,
        resolution: '720p'
      }
    },
    {
      name: 'balanced-standard',
      description: 'Balanced speed and quality for most content',
      transcriptionConfig: {
        model: 'base',
        temperature: 0.1
      },
      analysisConfig: {
        segmentationStrategy: 'hybrid',
        keywordExtractionDepth: 'medium',
        confidenceThreshold: 0.75
      },
      layoutConfig: {
        algorithm: 'dagre',
        iterations: 100,
        spacing: 1.5
      },
      renderConfig: {
        quality: 'standard',
        fps: 30,
        resolution: '1080p'
      }
    },
    {
      name: 'high-accuracy',
      description: 'Maximum accuracy for complex or critical content',
      transcriptionConfig: {
        model: 'small',
        temperature: 0.0
      },
      analysisConfig: {
        segmentationStrategy: 'content-based',
        keywordExtractionDepth: 'deep',
        confidenceThreshold: 0.85
      },
      layoutConfig: {
        algorithm: 'hierarchical',
        iterations: 200,
        spacing: 2.0
      },
      renderConfig: {
        quality: 'high',
        fps: 30,
        resolution: '1080p'
      }
    },
    {
      name: 'production-quality',
      description: 'Professional output for presentation or publication',
      transcriptionConfig: {
        model: 'medium',
        temperature: 0.0
      },
      analysisConfig: {
        segmentationStrategy: 'content-based',
        keywordExtractionDepth: 'deep',
        confidenceThreshold: 0.9
      },
      layoutConfig: {
        algorithm: 'force-directed',
        iterations: 300,
        spacing: 2.5
      },
      renderConfig: {
        quality: 'ultra',
        fps: 60,
        resolution: '4K'
      }
    }
  ];

  /**
   * Select optimal processing strategy based on content and context
   */
  async selectStrategy(
    characteristics: ContentCharacteristics,
    parameters: ParameterSet,
    context: {
      priority: 'speed' | 'quality' | 'balanced';
      timeConstraints?: number; // max processing time in seconds
      memoryConstraints?: number; // max memory in MB
      outputRequirements?: 'preview' | 'standard' | 'presentation';
    }
  ): Promise<AdaptiveDecision> {
    console.log('[AdaptiveProcessor] Selecting strategy for characteristics:', characteristics);
    console.log('[AdaptiveProcessor] Context:', context);

    // Filter strategies based on hard constraints
    let candidateStrategies = this.filterByConstraints(context);

    // Score strategies based on content characteristics and context
    const scoredStrategies = candidateStrategies.map(strategy => ({
      strategy,
      score: this.scoreStrategy(strategy, characteristics, parameters, context),
      reasoning: this.generateReasoning(strategy, characteristics, context)
    }));

    // Sort by score (highest first)
    scoredStrategies.sort((a, b) => b.score - a.score);

    const bestStrategy = scoredStrategies[0];

    // Apply historical learning
    const optimizedStrategy = this.applyHistoricalOptimization(
      bestStrategy.strategy,
      characteristics
    );

    // Predict performance
    const expectedPerformance = this.predictPerformance(optimizedStrategy, characteristics);

    const decision: AdaptiveDecision = {
      selectedStrategy: optimizedStrategy,
      reasoning: bestStrategy.reasoning,
      expectedPerformance,
      confidence: this.calculateDecisionConfidence(bestStrategy.score, scoredStrategies)
    };

    console.log('[AdaptiveProcessor] Selected strategy:', decision.selectedStrategy.name);
    console.log('[AdaptiveProcessor] Reasoning:', decision.reasoning);

    return decision;
  }

  /**
   * Update strategy performance history for learning
   */
  async updatePerformance(
    strategy: ProcessingStrategy,
    characteristics: ContentCharacteristics,
    actualPerformance: {
      processingTime: number;
      memoryUsage: number;
      qualityScore: number;
    }
  ): Promise<void> {
    const key = this.getCharacteristicsKey(characteristics);

    // Track successful strategies
    if (actualPerformance.qualityScore > 0.8) {
      const history = this.strategyHistory.get(key) || [];
      history.push(strategy);

      // Keep only recent successful strategies
      if (history.length > 5) {
        history.shift();
      }

      this.strategyHistory.set(key, history);
    }

    // Track performance metrics
    const performanceScore = this.calculateOverallPerformance(actualPerformance);
    const metrics = this.performanceMetrics.get(strategy.name) || [];
    metrics.push(performanceScore);

    // Keep rolling average
    if (metrics.length > 10) {
      metrics.shift();
    }

    this.performanceMetrics.set(strategy.name, metrics);

    console.log('[AdaptiveProcessor] Updated performance history for strategy:', strategy.name);
  }

  /**
   * Get adaptive recommendations for processing optimization
   */
  async getOptimizationRecommendations(
    currentStrategy: ProcessingStrategy,
    performance: {
      processingTime: number;
      memoryUsage: number;
      qualityScore: number;
    }
  ): Promise<string[]> {
    const recommendations: string[] = [];

    // Analyze performance bottlenecks
    if (performance.processingTime > 60000) { // > 1 minute
      recommendations.push('Consider using "fast-preview" strategy for initial iterations');
      recommendations.push('Enable parallel processing for large files');
    }

    if (performance.memoryUsage > 256) { // > 256MB
      recommendations.push('Switch to streaming processing mode');
      recommendations.push('Reduce transcription model size');
    }

    if (performance.qualityScore < 0.7) {
      recommendations.push('Increase confidence threshold');
      recommendations.push('Use "high-accuracy" strategy for better results');
      recommendations.push('Consider preprocessing audio for better quality');
    }

    // Strategy-specific recommendations
    if (currentStrategy.name === 'fast-preview' && performance.qualityScore > 0.9) {
      recommendations.push('Quality is excellent - consider "balanced-standard" for better visuals');
    }

    if (currentStrategy.name === 'production-quality' && performance.processingTime > 300000) {
      recommendations.push('Very slow processing - consider "high-accuracy" for faster results');
    }

    return recommendations;
  }

  private filterByConstraints(context: any): ProcessingStrategy[] {
    return this.strategies.filter(strategy => {
      // Time constraints
      if (context.timeConstraints) {
        const estimatedTime = this.estimateProcessingTime(strategy);
        if (estimatedTime > context.timeConstraints) {
          return false;
        }
      }

      // Memory constraints
      if (context.memoryConstraints) {
        const estimatedMemory = this.estimateMemoryUsage(strategy);
        if (estimatedMemory > context.memoryConstraints) {
          return false;
        }
      }

      // Output requirements
      if (context.outputRequirements) {
        if (context.outputRequirements === 'presentation' &&
            !['high-accuracy', 'production-quality'].includes(strategy.name)) {
          return false;
        }
        if (context.outputRequirements === 'preview' &&
            ['production-quality'].includes(strategy.name)) {
          return false;
        }
      }

      return true;
    });
  }

  private scoreStrategy(
    strategy: ProcessingStrategy,
    characteristics: ContentCharacteristics,
    parameters: ParameterSet,
    context: any
  ): number {
    let score = 0;

    // Base score from strategy quality
    const qualityScores = {
      'fast-preview': 0.6,
      'balanced-standard': 0.8,
      'high-accuracy': 0.9,
      'production-quality': 1.0
    };
    score += (qualityScores[strategy.name as keyof typeof qualityScores] || 0.5) * 40;

    // Adjust for context priority
    switch (context.priority) {
      case 'speed':
        if (strategy.name === 'fast-preview') score += 30;
        if (strategy.name === 'balanced-standard') score += 15;
        break;
      case 'quality':
        if (strategy.name === 'production-quality') score += 30;
        if (strategy.name === 'high-accuracy') score += 20;
        break;
      case 'balanced':
        if (strategy.name === 'balanced-standard') score += 25;
        if (strategy.name === 'high-accuracy') score += 15;
        break;
    }

    // Adjust for content characteristics
    if (characteristics.complexity === 'high') {
      if (['high-accuracy', 'production-quality'].includes(strategy.name)) score += 15;
    }

    if (characteristics.audioQuality < 0.7) {
      if (['high-accuracy', 'production-quality'].includes(strategy.name)) score += 10;
    }

    if (characteristics.diagramLikelihood > 0.8) {
      if (strategy.name !== 'fast-preview') score += 10;
    }

    // Historical performance bonus
    const metrics = this.performanceMetrics.get(strategy.name);
    if (metrics && metrics.length > 0) {
      const avgPerformance = metrics.reduce((a, b) => a + b, 0) / metrics.length;
      score += avgPerformance * 20;
    }

    return score;
  }

  private generateReasoning(
    strategy: ProcessingStrategy,
    characteristics: ContentCharacteristics,
    context: any
  ): string[] {
    const reasoning: string[] = [];

    reasoning.push(`Selected "${strategy.name}" strategy`);

    // Context-based reasoning
    if (context.priority === 'speed') {
      reasoning.push('Prioritizing processing speed over maximum quality');
    } else if (context.priority === 'quality') {
      reasoning.push('Prioritizing output quality over processing speed');
    } else {
      reasoning.push('Balancing speed and quality for optimal user experience');
    }

    // Content-based reasoning
    if (characteristics.complexity === 'high') {
      reasoning.push('High complexity content detected - using enhanced analysis');
    }

    if (characteristics.audioQuality < 0.7) {
      reasoning.push('Low audio quality detected - applying robust processing');
    }

    if (characteristics.diagramLikelihood > 0.8) {
      reasoning.push('High diagram probability - optimizing layout generation');
    }

    // Strategy-specific reasoning
    switch (strategy.name) {
      case 'fast-preview':
        reasoning.push('Optimized for rapid iteration and preview generation');
        break;
      case 'balanced-standard':
        reasoning.push('Standard quality suitable for most use cases');
        break;
      case 'high-accuracy':
        reasoning.push('Enhanced accuracy for complex or important content');
        break;
      case 'production-quality':
        reasoning.push('Maximum quality for professional presentation');
        break;
    }

    return reasoning;
  }

  private applyHistoricalOptimization(
    strategy: ProcessingStrategy,
    characteristics: ContentCharacteristics
  ): ProcessingStrategy {
    const key = this.getCharacteristicsKey(characteristics);
    const history = this.strategyHistory.get(key);

    if (!history || history.length === 0) {
      return strategy;
    }

    // Find most successful similar strategy
    const similarStrategy = history[history.length - 1];

    // Blend configurations
    const optimized: ProcessingStrategy = {
      ...strategy,
      analysisConfig: {
        ...strategy.analysisConfig,
        confidenceThreshold: this.blend(
          strategy.analysisConfig.confidenceThreshold,
          similarStrategy.analysisConfig.confidenceThreshold,
          0.2
        )
      },
      layoutConfig: {
        ...strategy.layoutConfig,
        spacing: this.blend(
          strategy.layoutConfig.spacing,
          similarStrategy.layoutConfig.spacing,
          0.1
        )
      }
    };

    return optimized;
  }

  private predictPerformance(
    strategy: ProcessingStrategy,
    characteristics: ContentCharacteristics
  ): { processingTime: number; memoryUsage: number; qualityScore: number } {
    // Base performance estimates
    const basePerformance = {
      'fast-preview': { time: 15000, memory: 64, quality: 0.7 },
      'balanced-standard': { time: 30000, memory: 128, quality: 0.85 },
      'high-accuracy': { time: 60000, memory: 192, quality: 0.92 },
      'production-quality': { time: 120000, memory: 256, quality: 0.95 }
    };

    const base = basePerformance[strategy.name as keyof typeof basePerformance] ||
                  basePerformance['balanced-standard'];

    // Adjust based on content characteristics
    let timeMultiplier = 1.0;
    let memoryMultiplier = 1.0;
    let qualityMultiplier = 1.0;

    if (characteristics.complexity === 'high') {
      timeMultiplier *= 1.3;
      memoryMultiplier *= 1.2;
    }

    if (characteristics.audioQuality < 0.7) {
      timeMultiplier *= 1.2;
      qualityMultiplier *= 0.95;
    }

    if (characteristics.speechRate > 180) {
      timeMultiplier *= 1.1;
    }

    return {
      processingTime: Math.round(base.time * timeMultiplier),
      memoryUsage: Math.round(base.memory * memoryMultiplier),
      qualityScore: Math.min(0.98, base.quality * qualityMultiplier)
    };
  }

  private calculateDecisionConfidence(bestScore: number, allScores: any[]): number {
    if (allScores.length < 2) return 0.8;

    const secondBestScore = allScores[1].score;
    const margin = bestScore - secondBestScore;

    // Higher margin = higher confidence
    return Math.min(0.95, 0.6 + (margin / 100) * 0.35);
  }

  private estimateProcessingTime(strategy: ProcessingStrategy): number {
    const timeEstimates = {
      'fast-preview': 15000,
      'balanced-standard': 30000,
      'high-accuracy': 60000,
      'production-quality': 120000
    };

    return timeEstimates[strategy.name as keyof typeof timeEstimates] || 30000;
  }

  private estimateMemoryUsage(strategy: ProcessingStrategy): number {
    const memoryEstimates = {
      'fast-preview': 64,
      'balanced-standard': 128,
      'high-accuracy': 192,
      'production-quality': 256
    };

    return memoryEstimates[strategy.name as keyof typeof memoryEstimates] || 128;
  }

  private calculateOverallPerformance(performance: any): number {
    // Normalize and combine performance metrics
    const timeScore = Math.max(0, 1 - performance.processingTime / 300000); // 5 minutes max
    const memoryScore = Math.max(0, 1 - performance.memoryUsage / 512); // 512MB max
    const qualityScore = performance.qualityScore;

    return (timeScore * 0.3 + memoryScore * 0.2 + qualityScore * 0.5);
  }

  private getCharacteristicsKey(characteristics: ContentCharacteristics): string {
    return `${characteristics.domain}_${characteristics.complexity}_${Math.round(characteristics.speechRate / 30) * 30}`;
  }

  private blend(current: number, historical: number, factor: number): number {
    return current * (1 - factor) + historical * factor;
  }
}

export default AdaptiveProcessor;