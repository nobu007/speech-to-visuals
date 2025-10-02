/**
 * Enhanced Error Handler - Iteration 12
 * Implements intelligent error recovery and adaptive resilience
 * Follows iterative development philosophy: Implement → Test → Evaluate → Improve
 */

export interface ErrorContext {
  stage: string;
  operation: string;
  input: any;
  timestamp: number;
  metadata: Record<string, any>;
  attemptNumber: number;
  previousErrors: Error[];
  systemState: {
    memoryUsage: number;
    cpuUsage: number;
    diskSpace: number;
  };
}

export interface AdaptiveResolution {
  strategy: 'retry' | 'fallback' | 'skip' | 'abort' | 'adaptive' | 'degraded_mode';
  action: string;
  confidence: number;
  estimated_time: number;
  backoffMultiplier: number;
  maxRetries: number;
  fallbackOptions: string[];
  qualityImpact: 'none' | 'minimal' | 'moderate' | 'significant';
}

export interface ErrorPattern {
  errorType: string;
  frequency: number;
  successfulResolutions: AdaptiveResolution[];
  lastOccurrence: Date;
  contextSimilarity: number;
}

/**
 * Intelligent Error Recovery System
 * Learns from past failures and adapts strategies
 */
export class EnhancedErrorHandler {
  private errorHistory: Map<string, ErrorPattern> = new Map();
  private resolutionCache: Map<string, AdaptiveResolution> = new Map();
  private adaptiveThresholds = {
    retryLimit: 3,
    confidenceThreshold: 0.7,
    timeoutMs: 30000,
    memoryThresholdMB: 512
  };

  /**
   * Analyzes error and determines best recovery strategy
   * Iteration 1: Basic pattern matching
   * Iteration 2: Context-aware resolution
   * Iteration 3: Adaptive learning
   */
  async analyzeAndResolve(context: ErrorContext): Promise<AdaptiveResolution> {
    console.log(`🔍 [Iteration ${context.attemptNumber}] Analyzing error in ${context.stage}`);

    // Generate error signature for pattern matching
    const errorSignature = this.generateErrorSignature(context);

    // Check if we've seen this error pattern before
    const knownPattern = this.errorHistory.get(errorSignature);

    if (knownPattern && knownPattern.frequency > 1) {
      console.log(`📚 Found known pattern with ${knownPattern.frequency} occurrences`);
      return this.adaptFromHistory(context, knownPattern);
    }

    // First-time error - use intelligent analysis
    return this.intelligentResolution(context);
  }

  /**
   * Generates unique signature for error patterns
   */
  private generateErrorSignature(context: ErrorContext): string {
    const errorKey = [
      context.stage,
      context.operation,
      context.metadata.errorType || 'unknown',
      JSON.stringify(context.systemState)
    ].join('|');

    return Buffer.from(errorKey).toString('base64').slice(0, 16);
  }

  /**
   * Adapts resolution strategy based on historical success
   */
  private adaptFromHistory(context: ErrorContext, pattern: ErrorPattern): AdaptiveResolution {
    const bestResolution = pattern.successfulResolutions
      .sort((a, b) => b.confidence - a.confidence)[0];

    // Adapt based on current context
    const adaptedResolution: AdaptiveResolution = {
      ...bestResolution,
      confidence: Math.min(bestResolution.confidence * 0.9, 0.95), // Slight confidence penalty
      backoffMultiplier: Math.min(bestResolution.backoffMultiplier * 1.2, 3.0), // Increase backoff
      estimated_time: bestResolution.estimated_time * (1 + context.attemptNumber * 0.1)
    };

    console.log(`🎯 Adapted resolution: ${adaptedResolution.strategy} (confidence: ${adaptedResolution.confidence})`);
    return adaptedResolution;
  }

  /**
   * Intelligent resolution for new error patterns
   */
  private intelligentResolution(context: ErrorContext): AdaptiveResolution {
    const resolution: AdaptiveResolution = {
      strategy: 'adaptive',
      action: 'Analyzing error context and determining optimal strategy',
      confidence: 0.6,
      estimated_time: 5000,
      backoffMultiplier: 1.5,
      maxRetries: this.adaptiveThresholds.retryLimit,
      fallbackOptions: [],
      qualityImpact: 'minimal'
    };

    // Stage-specific intelligent analysis
    switch (context.stage) {
      case 'transcription':
        return this.resolveTranscriptionError(context, resolution);
      case 'analysis':
        return this.resolveAnalysisError(context, resolution);
      case 'visualization':
        return this.resolveVisualizationError(context, resolution);
      case 'video_generation':
        return this.resolveVideoError(context, resolution);
      default:
        return this.resolveGenericError(context, resolution);
    }
  }

  /**
   * Transcription-specific error resolution
   */
  private resolveTranscriptionError(context: ErrorContext, base: AdaptiveResolution): AdaptiveResolution {
    const audioSize = context.metadata.audioSize || 0;
    const duration = context.metadata.duration || 0;

    if (audioSize > 50 * 1024 * 1024) { // Large file
      return {
        ...base,
        strategy: 'fallback',
        action: 'Switch to chunked processing for large audio file',
        confidence: 0.85,
        fallbackOptions: ['chunk_processing', 'lower_quality_model', 'streaming_mode'],
        qualityImpact: 'minimal'
      };
    }

    if (context.attemptNumber > 2) {
      return {
        ...base,
        strategy: 'degraded_mode',
        action: 'Use faster, lower-quality transcription model',
        confidence: 0.7,
        fallbackOptions: ['base_model', 'tiny_model'],
        qualityImpact: 'moderate'
      };
    }

    return {
      ...base,
      strategy: 'retry',
      action: 'Retry transcription with adjusted parameters',
      confidence: 0.8,
      backoffMultiplier: 2.0
    };
  }

  /**
   * Analysis-specific error resolution
   */
  private resolveAnalysisError(context: ErrorContext, base: AdaptiveResolution): AdaptiveResolution {
    const segmentCount = context.metadata.segmentCount || 0;

    if (segmentCount === 0) {
      return {
        ...base,
        strategy: 'fallback',
        action: 'Use rule-based analysis for empty segments',
        confidence: 0.9,
        fallbackOptions: ['rule_based_detection', 'simple_layout'],
        qualityImpact: 'minimal'
      };
    }

    return {
      ...base,
      strategy: 'retry',
      action: 'Retry analysis with relaxed parameters',
      confidence: 0.75
    };
  }

  /**
   * Visualization-specific error resolution
   */
  private resolveVisualizationError(context: ErrorContext, base: AdaptiveResolution): AdaptiveResolution {
    const nodeCount = context.metadata.nodeCount || 0;

    if (nodeCount > 50) { // Complex diagram
      return {
        ...base,
        strategy: 'degraded_mode',
        action: 'Simplify layout for complex diagram',
        confidence: 0.8,
        fallbackOptions: ['simplified_layout', 'hierarchical_clustering'],
        qualityImpact: 'moderate'
      };
    }

    return {
      ...base,
      strategy: 'fallback',
      action: 'Use alternative layout algorithm',
      confidence: 0.85,
      fallbackOptions: ['grid_layout', 'force_directed', 'circular_layout']
    };
  }

  /**
   * Video generation error resolution
   */
  private resolveVideoError(context: ErrorContext, base: AdaptiveResolution): AdaptiveResolution {
    if (context.systemState.memoryUsage > this.adaptiveThresholds.memoryThresholdMB) {
      return {
        ...base,
        strategy: 'degraded_mode',
        action: 'Reduce video quality to manage memory usage',
        confidence: 0.9,
        fallbackOptions: ['lower_resolution', 'reduced_framerate'],
        qualityImpact: 'moderate'
      };
    }

    return {
      ...base,
      strategy: 'retry',
      action: 'Retry video generation with optimized settings',
      confidence: 0.8
    };
  }

  /**
   * Generic error resolution
   */
  private resolveGenericError(context: ErrorContext, base: AdaptiveResolution): AdaptiveResolution {
    if (context.attemptNumber >= this.adaptiveThresholds.retryLimit) {
      return {
        ...base,
        strategy: 'abort',
        action: 'Maximum retry attempts reached - aborting operation',
        confidence: 1.0,
        qualityImpact: 'significant'
      };
    }

    return {
      ...base,
      strategy: 'retry',
      action: 'Retry with exponential backoff',
      backoffMultiplier: Math.pow(2, context.attemptNumber)
    };
  }

  /**
   * Records resolution outcome for learning
   */
  recordResolutionOutcome(
    context: ErrorContext,
    resolution: AdaptiveResolution,
    success: boolean
  ): void {
    const signature = this.generateErrorSignature(context);
    const pattern = this.errorHistory.get(signature) || {
      errorType: context.metadata.errorType || 'unknown',
      frequency: 0,
      successfulResolutions: [],
      lastOccurrence: new Date(),
      contextSimilarity: 1.0
    };

    pattern.frequency++;
    pattern.lastOccurrence = new Date();

    if (success) {
      pattern.successfulResolutions.push({
        ...resolution,
        confidence: Math.min(resolution.confidence * 1.1, 1.0) // Boost confidence on success
      });

      // Keep only the best 5 resolutions
      pattern.successfulResolutions = pattern.successfulResolutions
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5);
    }

    this.errorHistory.set(signature, pattern);

    console.log(`📊 Error pattern updated: ${signature} (frequency: ${pattern.frequency}, success: ${success})`);
  }

  /**
   * Gets current error handling statistics
   */
  getStatistics(): {
    totalPatterns: number;
    averageResolutionTime: number;
    successRate: number;
    mostCommonErrors: string[];
  } {
    const patterns = Array.from(this.errorHistory.values());
    const totalResolutions = patterns.reduce((sum, p) => sum + p.successfulResolutions.length, 0);
    const totalFrequency = patterns.reduce((sum, p) => sum + p.frequency, 0);

    return {
      totalPatterns: patterns.length,
      averageResolutionTime: patterns.reduce((sum, p) => {
        const avgTime = p.successfulResolutions.reduce((s, r) => s + r.estimated_time, 0) / (p.successfulResolutions.length || 1);
        return sum + avgTime;
      }, 0) / (patterns.length || 1),
      successRate: totalResolutions / (totalFrequency || 1),
      mostCommonErrors: patterns
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 5)
        .map(p => p.errorType)
    };
  }
}

export default EnhancedErrorHandler;