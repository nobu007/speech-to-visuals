/**
 * Adaptive Content Processor - Iteration 45
 * Adjusts processing strategy based on audio characteristics
 * 🎯 Custom Instructions Implementation: 動作→評価→改善→コミット
 */

import { performance } from 'perf_hooks';
import type { AudioCharacteristics, OptimalParameters } from './smart-parameter-tuner';

export interface ProcessingStrategy {
  name: string;
  transcriptionConfig: {
    model: 'base' | 'small' | 'medium' | 'large';
    combineMs: number;
    retryCount: number;
  };
  analysisConfig: {
    segmentationMode: 'auto' | 'fixed' | 'adaptive';
    diagramDetectionSensitivity: number;
    complexityThreshold: number;
  };
  layoutConfig: {
    algorithm: 'dagre' | 'force' | 'hierarchical';
    spacing: number;
    iterations: number;
  };
}

export interface AdaptiveResult {
  strategy: ProcessingStrategy;
  confidence: number;
  reasoning: string[];
  expectedImprovement: number;
  processingTime: number;
}

/**
 * Adaptive Content Processor
 * Selects optimal processing strategy based on content characteristics
 */
export class AdaptiveContentProcessor {
  private version = "1.0.0";
  private strategyHistory: Map<string, ProcessingStrategy> = new Map();

  // Predefined processing strategies
  private readonly strategies: Record<string, ProcessingStrategy> = {
    fast: {
      name: 'Fast Processing',
      transcriptionConfig: {
        model: 'base',
        combineMs: 500,
        retryCount: 2
      },
      analysisConfig: {
        segmentationMode: 'fixed',
        diagramDetectionSensitivity: 0.5,
        complexityThreshold: 0.6
      },
      layoutConfig: {
        algorithm: 'dagre',
        spacing: 50,
        iterations: 100
      }
    },

    balanced: {
      name: 'Balanced Processing',
      transcriptionConfig: {
        model: 'small',
        combineMs: 300,
        retryCount: 3
      },
      analysisConfig: {
        segmentationMode: 'adaptive',
        diagramDetectionSensitivity: 0.7,
        complexityThreshold: 0.5
      },
      layoutConfig: {
        algorithm: 'dagre',
        spacing: 75,
        iterations: 200
      }
    },

    accurate: {
      name: 'High Accuracy Processing',
      transcriptionConfig: {
        model: 'medium',
        combineMs: 200,
        retryCount: 4
      },
      analysisConfig: {
        segmentationMode: 'adaptive',
        diagramDetectionSensitivity: 0.8,
        complexityThreshold: 0.4
      },
      layoutConfig: {
        algorithm: 'hierarchical',
        spacing: 100,
        iterations: 300
      }
    }
  };

  constructor() {
    console.log(`[AdaptiveContentProcessor] Initializing version ${this.version}`);
  }

  /**
   * Select optimal processing strategy based on content characteristics
   */
  async selectStrategy(
    characteristics: AudioCharacteristics,
    parameters: OptimalParameters
  ): Promise<AdaptiveResult> {
    const startTime = performance.now();
    console.log(`[AdaptiveProcessor] Selecting strategy for content...`);

    try {
      // Generate content fingerprint
      const fingerprint = this.generateFingerprint(characteristics);

      // Check for cached strategy
      const cachedStrategy = this.strategyHistory.get(fingerprint);
      if (cachedStrategy) {
        console.log('✅ Using cached processing strategy');
        return {
          strategy: cachedStrategy,
          confidence: 0.95,
          reasoning: ['Strategy from similar content analysis'],
          expectedImprovement: 20,
          processingTime: performance.now() - startTime
        };
      }

      // Select base strategy based on processing mode
      const selectedStrategy = this.strategies[parameters.processingMode];

      // Customize strategy based on content characteristics
      const customizedStrategy = this.customizeStrategy(selectedStrategy, characteristics, parameters);

      // Calculate confidence and expected improvement
      const confidence = this.calculateStrategyConfidence(characteristics, customizedStrategy);
      const improvement = this.estimateStrategyImprovement(characteristics, customizedStrategy);

      // Generate reasoning
      const reasoning = this.generateStrategyReasoning(characteristics, parameters, customizedStrategy);

      // Cache the strategy
      this.strategyHistory.set(fingerprint, customizedStrategy);

      const result: AdaptiveResult = {
        strategy: customizedStrategy,
        confidence,
        reasoning,
        expectedImprovement: improvement,
        processingTime: performance.now() - startTime
      };

      console.log(`✅ Strategy selection complete: ${customizedStrategy.name}`);
      console.log(`📊 Confidence: ${(confidence * 100).toFixed(1)}%`);
      console.log(`📈 Expected improvement: ${improvement.toFixed(1)}%`);

      return result;

    } catch (error) {
      console.error('❌ Strategy selection failed:', error);

      // Fallback to balanced strategy
      return {
        strategy: this.strategies.balanced,
        confidence: 0.5,
        reasoning: ['Error occurred, using balanced strategy', error.message],
        expectedImprovement: 0,
        processingTime: performance.now() - startTime
      };
    }
  }

  /**
   * Customize base strategy based on content characteristics
   */
  private customizeStrategy(
    baseStrategy: ProcessingStrategy,
    characteristics: AudioCharacteristics,
    parameters: OptimalParameters
  ): ProcessingStrategy {
    const customized = JSON.parse(JSON.stringify(baseStrategy)); // Deep copy

    // Customize transcription config
    if (characteristics.clarity && characteristics.clarity < 0.6) {
      // Poor audio quality - use larger model and more retries
      customized.transcriptionConfig.model = 'medium';
      customized.transcriptionConfig.retryCount = Math.max(3, customized.transcriptionConfig.retryCount);
      customized.transcriptionConfig.combineMs = Math.min(200, customized.transcriptionConfig.combineMs);
    }

    if (characteristics.speechRate > 200) {
      // Fast speech - shorter combine window
      customized.transcriptionConfig.combineMs = Math.min(200, customized.transcriptionConfig.combineMs);
    }

    // Customize analysis config
    customized.analysisConfig.diagramDetectionSensitivity = parameters.diagramSensitivity;

    if (characteristics.complexity === 'high') {
      customized.analysisConfig.segmentationMode = 'adaptive';
      customized.analysisConfig.complexityThreshold = 0.3; // Lower threshold for complex content
    }

    // Customize layout config
    customized.layoutConfig.spacing = Math.round(50 + (parameters.layoutDensity * 100));

    if (characteristics.diagramLikelihood && characteristics.diagramLikelihood > 0.8) {
      // High diagram likelihood - use better algorithm
      customized.layoutConfig.algorithm = 'hierarchical';
      customized.layoutConfig.iterations = Math.max(200, customized.layoutConfig.iterations);
    }

    // Set custom name
    customized.name = `${baseStrategy.name} (Customized)`;

    return customized;
  }

  /**
   * Generate fingerprint for strategy caching
   */
  private generateFingerprint(characteristics: AudioCharacteristics): string {
    const normalized = {
      speechRate: Math.round(characteristics.speechRate / 50) * 50,
      complexity: characteristics.complexity,
      domain: characteristics.domain,
      audioQuality: Math.round((characteristics.audioQuality || 0.8) * 10) / 10
    };

    return `${normalized.domain}-${normalized.complexity}-sr${normalized.speechRate}-q${normalized.audioQuality}`;
  }

  /**
   * Calculate confidence in strategy selection
   */
  private calculateStrategyConfidence(
    characteristics: AudioCharacteristics,
    strategy: ProcessingStrategy
  ): number {
    let confidence = 0.8; // Base confidence

    // Higher confidence for common audio quality ranges
    if (characteristics.audioQuality && characteristics.audioQuality > 0.7) {
      confidence += 0.1;
    }

    // Higher confidence for recognized patterns
    const fingerprint = this.generateFingerprint(characteristics);
    if (this.strategyHistory.has(fingerprint)) {
      confidence += 0.1;
    }

    // Higher confidence for clear content characteristics
    if (characteristics.diagramLikelihood && characteristics.diagramLikelihood > 0.6) {
      confidence += 0.05;
    }

    return Math.min(0.95, Math.max(0.6, confidence));
  }

  /**
   * Estimate improvement from strategy customization
   */
  private estimateStrategyImprovement(
    characteristics: AudioCharacteristics,
    strategy: ProcessingStrategy
  ): number {
    let improvement = 15; // Base improvement from adaptive processing

    // Higher improvement for poor audio quality with appropriate strategy
    if (characteristics.audioQuality && characteristics.audioQuality < 0.6 &&
        strategy.transcriptionConfig.model !== 'base') {
      improvement += 25;
    }

    // Higher improvement for complex content with adaptive segmentation
    if (characteristics.complexity === 'high' &&
        strategy.analysisConfig.segmentationMode === 'adaptive') {
      improvement += 15;
    }

    // Higher improvement for diagram-heavy content with hierarchical layout
    if (characteristics.diagramLikelihood && characteristics.diagramLikelihood > 0.7 &&
        strategy.layoutConfig.algorithm === 'hierarchical') {
      improvement += 20;
    }

    return Math.min(60, improvement); // Cap at 60% improvement
  }

  /**
   * Generate reasoning for strategy selection
   */
  private generateStrategyReasoning(
    characteristics: AudioCharacteristics,
    parameters: OptimalParameters,
    strategy: ProcessingStrategy
  ): string[] {
    const reasoning: string[] = [];

    reasoning.push(`Selected ${strategy.name} based on ${parameters.processingMode} processing mode`);

    if (characteristics.audioQuality && characteristics.audioQuality < 0.7) {
      reasoning.push(`Enhanced transcription model (${strategy.transcriptionConfig.model}) for poor audio quality`);
    }

    if (characteristics.speechRate > 200) {
      reasoning.push(`Reduced combine window (${strategy.transcriptionConfig.combineMs}ms) for fast speech`);
    }

    if (characteristics.complexity === 'high') {
      reasoning.push(`Adaptive segmentation enabled for complex content`);
    }

    if (characteristics.diagramLikelihood && characteristics.diagramLikelihood > 0.7) {
      reasoning.push(`Hierarchical layout algorithm selected for diagram-rich content`);
    }

    if (reasoning.length === 1) {
      reasoning.push('Standard strategy configuration - content characteristics within normal ranges');
    }

    return reasoning;
  }

  /**
   * Get processing statistics
   */
  getProcessingStats() {
    return {
      version: this.version,
      cachedStrategies: this.strategyHistory.size,
      availableStrategies: Object.keys(this.strategies).length,
      customizationsApplied: this.strategyHistory.size
    };
  }

  /**
   * Clear strategy history (for testing/reset)
   */
  clearHistory() {
    this.strategyHistory.clear();
    console.log('🧹 Strategy history cleared');
  }
}

// Export singleton instance
export const adaptiveContentProcessor = new AdaptiveContentProcessor();