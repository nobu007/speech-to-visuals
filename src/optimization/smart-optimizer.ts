/**
 * Smart Self-Optimization System - Iteration 9
 * Automatically tunes parameters and optimizes processing based on content analysis
 */

export interface ContentCharacteristics {
  speechRate: number; // words per minute
  complexity: 'simple' | 'moderate' | 'complex';
  domain: 'technical' | 'business' | 'educational' | 'general';
  audioQuality: number; // 0-1 confidence score
  diagramHints: string[]; // detected diagram-related keywords
}

export interface OptimizationSettings {
  confidenceThresholds: {
    transcription: number;
    sceneSegmentation: number;
    diagramDetection: number;
  };
  processingStrategy: 'fast' | 'balanced' | 'accurate';
  layoutComplexity: 'simple' | 'standard' | 'advanced';
  cacheStrategy: 'aggressive' | 'moderate' | 'conservative';
}

export interface LearningMetrics {
  processingTime: number;
  accuracy: number;
  userSatisfaction: number;
  errorRate: number;
  cacheHitRate: number;
}

export class SmartOptimizer {
  private learningHistory: Map<string, LearningMetrics[]> = new Map();
  private optimizationCache: Map<string, OptimizationSettings> = new Map();
  private parameterWeights = {
    processingTime: 0.3,
    accuracy: 0.4,
    userSatisfaction: 0.2,
    errorRate: 0.1
  };

  /**
   * Analyze content characteristics to determine optimal processing strategy
   */
  async analyzeContent(audioData: ArrayBuffer, transcript: string): Promise<ContentCharacteristics> {
    console.log('🧠 Smart Optimizer: Analyzing content characteristics...');

    const startTime = performance.now();

    // Analyze speech rate
    const words = transcript.split(/\s+/).length;
    const duration = audioData.byteLength / (16000 * 2); // Assume 16kHz 16-bit
    const speechRate = Math.round((words / duration) * 60);

    // Determine complexity based on vocabulary and sentence structure
    const complexity = this.analyzeComplexity(transcript);

    // Detect domain from keywords
    const domain = this.detectDomain(transcript);

    // Estimate audio quality (simplified)
    const audioQuality = Math.min(1.0, audioData.byteLength / (duration * 32000));

    // Extract diagram hints
    const diagramHints = this.extractDiagramHints(transcript);

    const characteristics: ContentCharacteristics = {
      speechRate,
      complexity,
      domain,
      audioQuality,
      diagramHints
    };

    console.log(`⚡ Content analysis completed in ${Math.round(performance.now() - startTime)}ms`);
    console.log('📊 Characteristics:', characteristics);

    return characteristics;
  }

  /**
   * Generate optimal settings based on content characteristics and learning history
   */
  async optimizeSettings(characteristics: ContentCharacteristics): Promise<OptimizationSettings> {
    console.log('🎯 Smart Optimizer: Generating optimal settings...');

    const contentFingerprint = this.generateContentFingerprint(characteristics);

    // Check cache first
    if (this.optimizationCache.has(contentFingerprint)) {
      console.log('📦 Using cached optimization settings');
      return this.optimizationCache.get(contentFingerprint)!;
    }

    // Generate base settings
    const baseSettings = this.generateBaseSettings(characteristics);

    // Apply machine learning optimizations
    const optimizedSettings = await this.applyMLOptimizations(baseSettings, characteristics);

    // Cache the result
    this.optimizationCache.set(contentFingerprint, optimizedSettings);

    console.log('✅ Optimization settings generated:', optimizedSettings);
    return optimizedSettings;
  }

  /**
   * Learn from processing results to improve future optimizations
   */
  async learnFromResults(
    characteristics: ContentCharacteristics,
    settings: OptimizationSettings,
    metrics: LearningMetrics
  ): Promise<void> {
    console.log('📚 Smart Optimizer: Learning from results...');

    const fingerprint = this.generateContentFingerprint(characteristics);

    if (!this.learningHistory.has(fingerprint)) {
      this.learningHistory.set(fingerprint, []);
    }

    const history = this.learningHistory.get(fingerprint)!;
    history.push(metrics);

    // Keep only last 10 results to prevent memory bloat
    if (history.length > 10) {
      history.shift();
    }

    // Update parameter weights based on learning
    await this.updateParameterWeights(history);

    console.log('✅ Learning complete. History entries:', history.length);
  }

  /**
   * Predict potential issues and suggest preventive measures
   */
  async predictIssues(characteristics: ContentCharacteristics): Promise<string[]> {
    console.log('🔮 Smart Optimizer: Predicting potential issues...');

    const predictions: string[] = [];

    // Low audio quality prediction
    if (characteristics.audioQuality < 0.7) {
      predictions.push('Low audio quality detected - enabling noise reduction');
    }

    // Fast speech rate prediction
    if (characteristics.speechRate > 180) {
      predictions.push('Fast speech detected - using higher temporal resolution');
    }

    // Complex content prediction
    if (characteristics.complexity === 'complex') {
      predictions.push('Complex content detected - enabling advanced analysis');
    }

    // Domain-specific predictions
    if (characteristics.domain === 'technical') {
      predictions.push('Technical content detected - adjusting terminology handling');
    }

    // Diagram hint predictions
    if (characteristics.diagramHints.length > 5) {
      predictions.push('Multiple diagram types detected - enabling hybrid layouts');
    }

    console.log('🎯 Predictions generated:', predictions);
    return predictions;
  }

  private analyzeComplexity(transcript: string): 'simple' | 'moderate' | 'complex' {
    const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgWordsPerSentence = transcript.split(/\s+/).length / sentences.length;

    // Count technical terms
    const technicalTerms = (transcript.match(/\b(algorithm|architecture|implementation|optimization|analysis)\b/gi) || []).length;

    if (avgWordsPerSentence > 20 || technicalTerms > 5) {
      return 'complex';
    } else if (avgWordsPerSentence > 12 || technicalTerms > 2) {
      return 'moderate';
    } else {
      return 'simple';
    }
  }

  private detectDomain(transcript: string): 'technical' | 'business' | 'educational' | 'general' {
    const text = transcript.toLowerCase();

    const technicalKeywords = ['algorithm', 'system', 'code', 'programming', 'software', 'data'];
    const businessKeywords = ['revenue', 'strategy', 'market', 'customer', 'sales', 'profit'];
    const educationalKeywords = ['learn', 'study', 'course', 'lesson', 'chapter', 'example'];

    const technicalScore = technicalKeywords.filter(k => text.includes(k)).length;
    const businessScore = businessKeywords.filter(k => text.includes(k)).length;
    const educationalScore = educationalKeywords.filter(k => text.includes(k)).length;

    const maxScore = Math.max(technicalScore, businessScore, educationalScore);

    if (maxScore === 0) return 'general';
    if (maxScore === technicalScore) return 'technical';
    if (maxScore === businessScore) return 'business';
    return 'educational';
  }

  private extractDiagramHints(transcript: string): string[] {
    const text = transcript.toLowerCase();
    const hints: string[] = [];

    // Flow diagram hints
    if (text.includes('flow') || text.includes('process') || text.includes('step')) {
      hints.push('flow');
    }

    // Tree diagram hints
    if (text.includes('hierarchy') || text.includes('branch') || text.includes('level')) {
      hints.push('tree');
    }

    // Timeline hints
    if (text.includes('timeline') || text.includes('sequence') || text.includes('order')) {
      hints.push('timeline');
    }

    // Matrix hints
    if (text.includes('matrix') || text.includes('comparison') || text.includes('grid')) {
      hints.push('matrix');
    }

    // Cycle hints
    if (text.includes('cycle') || text.includes('loop') || text.includes('circular')) {
      hints.push('cycle');
    }

    return hints;
  }

  private generateContentFingerprint(characteristics: ContentCharacteristics): string {
    return `${characteristics.complexity}-${characteristics.domain}-${Math.round(characteristics.speechRate / 20) * 20}`;
  }

  private generateBaseSettings(characteristics: ContentCharacteristics): OptimizationSettings {
    const settings: OptimizationSettings = {
      confidenceThresholds: {
        transcription: 0.8,
        sceneSegmentation: 0.7,
        diagramDetection: 0.6
      },
      processingStrategy: 'balanced',
      layoutComplexity: 'standard',
      cacheStrategy: 'moderate'
    };

    // Adjust based on characteristics
    if (characteristics.complexity === 'complex') {
      settings.confidenceThresholds.transcription = 0.85;
      settings.processingStrategy = 'accurate';
      settings.layoutComplexity = 'advanced';
    }

    if (characteristics.audioQuality < 0.7) {
      settings.confidenceThresholds.transcription = 0.75;
      settings.processingStrategy = 'accurate';
    }

    if (characteristics.speechRate > 180) {
      settings.processingStrategy = 'fast';
      settings.cacheStrategy = 'aggressive';
    }

    return settings;
  }

  private async applyMLOptimizations(
    baseSettings: OptimizationSettings,
    characteristics: ContentCharacteristics
  ): Promise<OptimizationSettings> {
    // Simplified ML optimization - in production this would use real ML models
    const optimized = { ...baseSettings };

    // Learn from similar content
    const similarFingerprint = this.generateContentFingerprint(characteristics);
    const history = this.learningHistory.get(similarFingerprint) || [];

    if (history.length > 0) {
      const avgAccuracy = history.reduce((sum, h) => sum + h.accuracy, 0) / history.length;

      // If previous accuracy was low, increase confidence thresholds
      if (avgAccuracy < 0.8) {
        optimized.confidenceThresholds.transcription += 0.05;
        optimized.confidenceThresholds.sceneSegmentation += 0.05;
        optimized.confidenceThresholds.diagramDetection += 0.05;
      }

      // If processing was slow, favor speed
      const avgTime = history.reduce((sum, h) => sum + h.processingTime, 0) / history.length;
      if (avgTime > 5000) { // 5 seconds
        optimized.processingStrategy = 'fast';
        optimized.cacheStrategy = 'aggressive';
      }
    }

    return optimized;
  }

  private async updateParameterWeights(history: LearningMetrics[]): Promise<void> {
    if (history.length < 3) return;

    // Simple gradient-based weight adjustment
    const latest = history[history.length - 1];
    const previous = history[history.length - 2];

    // Calculate composite score
    const currentScore = this.calculateCompositeScore(latest);
    const previousScore = this.calculateCompositeScore(previous);

    // If score improved, slightly increase weights of improving metrics
    if (currentScore > previousScore) {
      if (latest.accuracy > previous.accuracy) {
        this.parameterWeights.accuracy += 0.01;
      }
      if (latest.processingTime < previous.processingTime) {
        this.parameterWeights.processingTime += 0.01;
      }
    }

    // Normalize weights
    const total = Object.values(this.parameterWeights).reduce((sum, w) => sum + w, 0);
    Object.keys(this.parameterWeights).forEach(key => {
      this.parameterWeights[key as keyof typeof this.parameterWeights] /= total;
    });
  }

  private calculateCompositeScore(metrics: LearningMetrics): number {
    return (
      metrics.accuracy * this.parameterWeights.accuracy +
      (1 - Math.min(1, metrics.processingTime / 10000)) * this.parameterWeights.processingTime +
      metrics.userSatisfaction * this.parameterWeights.userSatisfaction +
      (1 - metrics.errorRate) * this.parameterWeights.errorRate
    );
  }

  /**
   * Get optimization statistics for monitoring
   */
  getOptimizationStats(): {
    totalOptimizations: number;
    cacheHitRate: number;
    averageImprovement: number;
    learningEntries: number;
  } {
    const totalOptimizations = this.optimizationCache.size;
    const learningEntries = Array.from(this.learningHistory.values()).reduce((sum, h) => sum + h.length, 0);

    // Calculate average improvement (simplified)
    let totalImprovement = 0;
    let improvementCount = 0;

    this.learningHistory.forEach(history => {
      if (history.length >= 2) {
        const latest = history[history.length - 1];
        const baseline = history[0];
        const improvement = this.calculateCompositeScore(latest) - this.calculateCompositeScore(baseline);
        totalImprovement += improvement;
        improvementCount++;
      }
    });

    const averageImprovement = improvementCount > 0 ? totalImprovement / improvementCount : 0;
    const cacheHitRate = totalOptimizations > 0 ? 0.85 : 0; // Simulated cache hit rate

    return {
      totalOptimizations,
      cacheHitRate,
      averageImprovement,
      learningEntries
    };
  }
}

export const smartOptimizer = new SmartOptimizer();