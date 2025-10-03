/**
 * Smart Parameter Tuner - Iteration 45
 * Automatically optimizes detection thresholds based on content analysis
 * 🎯 Custom Instructions Implementation: 小さく作り、確実に動作確認
 * Enhanced with recursive improvement and adaptive learning
 */

import { performance } from 'perf_hooks';

export interface AudioCharacteristics {
  speechRate: number; // words per minute
  complexity: 'low' | 'medium' | 'high';
  domain: 'technical' | 'business' | 'educational' | 'general';
  audioQuality: number; // 0-1 score
  keywordDensity: number;
  diagramLikelihood: number;
}

export interface ParameterSet {
  confidenceThreshold: number;
  segmentMinLength: number;
  segmentMaxLength: number;
  keywordWeights: Record<string, number>;
  layoutDensity: number;
  processingMode: 'fast' | 'balanced' | 'accurate';
}

export interface OptimizationResult {
  parameters: ParameterSet;
  expectedPerformance: {
    accuracy: number;
    speed: number;
    reliability: number;
  };
  confidence: number;
}

class SmartParameterTuner {
  private historicalData: Map<string, ParameterSet> = new Map();
  private performanceHistory: Map<string, number[]> = new Map();
  private learningRate = 0.1;

  /**
   * Analyze audio content characteristics
   */
  async analyzeContent(transcript: string, audioMetadata: any): Promise<ContentCharacteristics> {
    const words = transcript.split(/\s+/).filter(w => w.length > 0);
    const duration = audioMetadata.duration || 60; // fallback duration

    // Calculate speech rate
    const speechRate = (words.length / duration) * 60;

    // Assess complexity based on vocabulary and sentence structure
    const complexity = this.assessComplexity(transcript);

    // Detect domain from keywords
    const domain = this.detectDomain(transcript);

    // Calculate keyword density
    const keywordDensity = this.calculateKeywordDensity(transcript);

    // Estimate diagram likelihood
    const diagramLikelihood = this.estimateDiagramLikelihood(transcript);

    return {
      speechRate,
      complexity,
      domain,
      audioQuality: audioMetadata.quality || 0.8,
      keywordDensity,
      diagramLikelihood
    };
  }

  /**
   * Generate optimized parameters based on content characteristics
   */
  async optimizeParameters(characteristics: ContentCharacteristics): Promise<OptimizationResult> {
    console.log('[SmartTuner] Optimizing parameters for content characteristics:', characteristics);

    // Base parameters
    let parameters: ParameterSet = {
      confidenceThreshold: 0.75,
      segmentMinLength: 5000,
      segmentMaxLength: 30000,
      keywordWeights: this.getDefaultKeywordWeights(),
      layoutDensity: 0.7,
      processingMode: 'balanced'
    };

    // Adjust based on speech rate
    if (characteristics.speechRate > 180) {
      // Fast speech - shorter segments, higher confidence needed
      parameters.segmentMaxLength = 20000;
      parameters.confidenceThreshold = 0.8;
      parameters.processingMode = 'accurate';
    } else if (characteristics.speechRate < 120) {
      // Slow speech - longer segments, lower confidence OK
      parameters.segmentMaxLength = 40000;
      parameters.confidenceThreshold = 0.7;
    }

    // Adjust based on complexity
    switch (characteristics.complexity) {
      case 'high':
        parameters.confidenceThreshold = Math.min(0.85, parameters.confidenceThreshold + 0.1);
        parameters.processingMode = 'accurate';
        parameters.layoutDensity = 0.6; // More space for complex diagrams
        break;
      case 'low':
        parameters.confidenceThreshold = Math.max(0.65, parameters.confidenceThreshold - 0.1);
        parameters.processingMode = 'fast';
        parameters.layoutDensity = 0.8; // Denser layout for simple content
        break;
    }

    // Adjust based on domain
    parameters.keywordWeights = this.getDomainSpecificWeights(characteristics.domain);

    // Adjust based on audio quality
    if (characteristics.audioQuality < 0.6) {
      parameters.confidenceThreshold = Math.min(0.9, parameters.confidenceThreshold + 0.15);
      parameters.segmentMinLength = 8000; // Longer segments for poor audio
    }

    // Apply historical learning
    const optimizedParams = this.applyHistoricalLearning(parameters, characteristics);

    // Calculate expected performance
    const expectedPerformance = this.predictPerformance(optimizedParams, characteristics);

    const confidence = this.calculateOptimizationConfidence(characteristics, optimizedParams);

    console.log('[SmartTuner] Generated optimized parameters:', {
      parameters: optimizedParams,
      expectedPerformance,
      confidence
    });

    return {
      parameters: optimizedParams,
      expectedPerformance,
      confidence
    };
  }

  /**
   * Learn from processing results to improve future optimizations
   */
  async updateFromResults(
    characteristics: ContentCharacteristics,
    parameters: ParameterSet,
    actualPerformance: { accuracy: number; speed: number; reliability: number }
  ): Promise<void> {
    const key = this.getCharacteristicsKey(characteristics);

    // Store successful parameter sets
    if (actualPerformance.accuracy > 0.8 && actualPerformance.reliability > 0.9) {
      this.historicalData.set(key, parameters);
    }

    // Track performance history
    const history = this.performanceHistory.get(key) || [];
    const combinedScore = (actualPerformance.accuracy + actualPerformance.reliability) / 2;
    history.push(combinedScore);

    // Keep only recent history
    if (history.length > 10) {
      history.shift();
    }

    this.performanceHistory.set(key, history);

    console.log('[SmartTuner] Updated learning data for characteristics:', key);
  }

  private assessComplexity(transcript: string): 'low' | 'medium' | 'high' {
    const words = transcript.split(/\s+/);
    const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 0);

    // Calculate metrics
    const avgWordsPerSentence = words.length / sentences.length;
    const uniqueWords = new Set(words.map(w => w.toLowerCase())).size;
    const vocabularyRichness = uniqueWords / words.length;

    // Technical terms indicator
    const technicalTerms = /\b(system|process|algorithm|method|structure|framework|implementation|analysis)\b/gi;
    const technicalDensity = (transcript.match(technicalTerms) || []).length / words.length;

    if (avgWordsPerSentence > 15 || vocabularyRichness > 0.7 || technicalDensity > 0.1) {
      return 'high';
    } else if (avgWordsPerSentence > 10 || vocabularyRichness > 0.5 || technicalDensity > 0.05) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  private detectDomain(transcript: string): 'technical' | 'business' | 'educational' | 'general' {
    const text = transcript.toLowerCase();

    const technicalKeywords = ['algorithm', 'system', 'software', 'code', 'database', 'api', 'framework'];
    const businessKeywords = ['market', 'strategy', 'revenue', 'customer', 'profit', 'sales', 'investment'];
    const educationalKeywords = ['lesson', 'student', 'learn', 'teach', 'understand', 'explain', 'concept'];

    const technicalScore = technicalKeywords.reduce((score, keyword) =>
      score + (text.includes(keyword) ? 1 : 0), 0);
    const businessScore = businessKeywords.reduce((score, keyword) =>
      score + (text.includes(keyword) ? 1 : 0), 0);
    const educationalScore = educationalKeywords.reduce((score, keyword) =>
      score + (text.includes(keyword) ? 1 : 0), 0);

    const maxScore = Math.max(technicalScore, businessScore, educationalScore);

    if (maxScore === 0) return 'general';
    if (maxScore === technicalScore) return 'technical';
    if (maxScore === businessScore) return 'business';
    return 'educational';
  }

  private calculateKeywordDensity(transcript: string): number {
    const words = transcript.split(/\s+/);
    const diagramKeywords = [
      'flow', 'process', 'step', 'stage', 'phase', 'sequence',
      'tree', 'hierarchy', 'structure', 'branch', 'level',
      'timeline', 'chronology', 'order', 'schedule',
      'matrix', 'table', 'compare', 'comparison',
      'cycle', 'loop', 'repeat', 'circular', 'feedback'
    ];

    const keywordCount = words.filter(word =>
      diagramKeywords.includes(word.toLowerCase().replace(/[^\w]/g, ''))
    ).length;

    return keywordCount / words.length;
  }

  private estimateDiagramLikelihood(transcript: string): number {
    const indicators = [
      /\b(first|second|third|then|next|finally|lastly)\b/gi,
      /\b(step|stage|phase|process|flow)\b/gi,
      /\b(above|below|left|right|between|under|over)\b/gi,
      /\b(compare|contrast|versus|different|similar)\b/gi,
      /\b(cycle|repeat|circular|feedback|loop)\b/gi
    ];

    let score = 0;
    indicators.forEach(pattern => {
      const matches = transcript.match(pattern) || [];
      score += matches.length;
    });

    // Normalize to 0-1 range
    return Math.min(1, score / 20);
  }

  private getDefaultKeywordWeights(): Record<string, number> {
    return {
      'flow': 1.2,
      'process': 1.2,
      'tree': 1.1,
      'hierarchy': 1.1,
      'timeline': 1.1,
      'sequence': 1.0,
      'matrix': 1.0,
      'cycle': 1.0,
      'step': 0.9,
      'stage': 0.9
    };
  }

  private getDomainSpecificWeights(domain: string): Record<string, number> {
    const weights = this.getDefaultKeywordWeights();

    switch (domain) {
      case 'technical':
        weights['system'] = 1.3;
        weights['architecture'] = 1.3;
        weights['algorithm'] = 1.2;
        break;
      case 'business':
        weights['strategy'] = 1.3;
        weights['market'] = 1.2;
        weights['revenue'] = 1.1;
        break;
      case 'educational':
        weights['concept'] = 1.2;
        weights['explain'] = 1.1;
        weights['understand'] = 1.1;
        break;
    }

    return weights;
  }

  private applyHistoricalLearning(
    baseParameters: ParameterSet,
    characteristics: ContentCharacteristics
  ): ParameterSet {
    const key = this.getCharacteristicsKey(characteristics);
    const historicalParams = this.historicalData.get(key);

    if (!historicalParams) {
      return baseParameters;
    }

    // Blend historical success with current optimization
    return {
      confidenceThreshold: this.blend(baseParameters.confidenceThreshold, historicalParams.confidenceThreshold),
      segmentMinLength: Math.round(this.blend(baseParameters.segmentMinLength, historicalParams.segmentMinLength)),
      segmentMaxLength: Math.round(this.blend(baseParameters.segmentMaxLength, historicalParams.segmentMaxLength)),
      keywordWeights: this.blendWeights(baseParameters.keywordWeights, historicalParams.keywordWeights),
      layoutDensity: this.blend(baseParameters.layoutDensity, historicalParams.layoutDensity),
      processingMode: baseParameters.processingMode // Keep current optimization for processing mode
    };
  }

  private blend(current: number, historical: number): number {
    return current * (1 - this.learningRate) + historical * this.learningRate;
  }

  private blendWeights(current: Record<string, number>, historical: Record<string, number>): Record<string, number> {
    const result = { ...current };

    for (const key in historical) {
      if (key in result) {
        result[key] = this.blend(result[key], historical[key]);
      }
    }

    return result;
  }

  private predictPerformance(
    parameters: ParameterSet,
    characteristics: ContentCharacteristics
  ): { accuracy: number; speed: number; reliability: number } {
    // Base performance prediction based on parameters
    let accuracy = 0.85;
    let speed = 6.0; // 6x realtime
    let reliability = 0.95;

    // Adjust based on confidence threshold
    accuracy += (parameters.confidenceThreshold - 0.75) * 0.4;
    speed -= (parameters.confidenceThreshold - 0.75) * 2; // Higher confidence = slower

    // Adjust based on processing mode
    switch (parameters.processingMode) {
      case 'fast':
        speed *= 1.5;
        accuracy *= 0.95;
        break;
      case 'accurate':
        speed *= 0.7;
        accuracy *= 1.1;
        reliability *= 1.05;
        break;
    }

    // Adjust based on content characteristics
    if (characteristics.audioQuality < 0.7) {
      accuracy *= 0.9;
      reliability *= 0.95;
    }

    if (characteristics.complexity === 'high') {
      accuracy *= 0.95;
      speed *= 0.9;
    }

    // Ensure bounds
    accuracy = Math.min(0.98, Math.max(0.7, accuracy));
    speed = Math.max(1.0, speed);
    reliability = Math.min(0.99, Math.max(0.8, reliability));

    return { accuracy, speed, reliability };
  }

  private calculateOptimizationConfidence(
    characteristics: ContentCharacteristics,
    parameters: ParameterSet
  ): number {
    let confidence = 0.8; // Base confidence

    // Higher confidence for common patterns
    const key = this.getCharacteristicsKey(characteristics);
    if (this.historicalData.has(key)) {
      confidence += 0.15;
    }

    // Adjust based on content quality
    confidence += (characteristics.audioQuality - 0.5) * 0.2;

    // Adjust based on diagram likelihood
    confidence += characteristics.diagramLikelihood * 0.1;

    return Math.min(0.95, Math.max(0.6, confidence));
  }

  private getCharacteristicsKey(characteristics: ContentCharacteristics): string {
    return `${characteristics.domain}_${characteristics.complexity}_${Math.round(characteristics.speechRate / 30) * 30}`;
  }
}

export default SmartParameterTuner;