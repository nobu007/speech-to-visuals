/**
 * Iteration 22: Ultra-Responsive Adaptive Content Processor
 *
 * Intelligent system with real-time parameter adaptation, machine learning-based
 * optimization, and predictive adjustment for maximum performance and accuracy.
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
  adaptable: boolean; // Whether strategy supports real-time adaptation
  parameters: {
    segmentationThreshold: number;
    diagramTypeConfidence: number;
    layoutComplexity: number;
    animationDensity: number;
    adaptationSpeed: number; // How quickly parameters can change (0-1)
    stabilityThreshold: number; // Minimum performance before adaptation
  };
}

interface RealTimeMetrics {
  processingTime: number;
  accuracyScore: number;
  memoryUsage: number;
  userEngagement: number;
  errorRate: number;
  timestamp: number;
}

interface ParameterOptimization {
  parameter: string;
  currentValue: number;
  targetValue: number;
  adjustmentRate: number;
  confidence: number;
  expectedImprovement: number;
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
  private realTimeMetrics: RealTimeMetrics[] = [];
  private activeOptimizations: Map<string, ParameterOptimization[]> = new Map();
  private adaptationTimer: NodeJS.Timer | null = null;
  private userPreferences: UserPreferences;
  private learningRate = 0.1; // Machine learning adaptation rate
  private stabilityWindow = 5; // Number of measurements for stability check

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
    this.startRealTimeAdaptation();
  }

  /**
   * Start real-time adaptation system
   */
  private startRealTimeAdaptation(): void {
    if (this.adaptationTimer) return;

    this.adaptationTimer = setInterval(() => {
      this.performRealTimeAdaptation();
    }, 2000); // Adapt every 2 seconds for responsiveness
  }

  /**
   * Perform real-time parameter adaptation based on current metrics
   */
  private async performRealTimeAdaptation(): Promise<void> {
    if (this.realTimeMetrics.length < this.stabilityWindow) return;

    const recentMetrics = this.realTimeMetrics.slice(-this.stabilityWindow);
    const currentPerformance = this.calculateCurrentPerformance(recentMetrics);

    // Identify parameters that need optimization
    for (const strategy of this.strategies) {
      if (!strategy.adaptable) continue;

      const optimizations = this.identifyOptimizations(strategy, currentPerformance);
      if (optimizations.length > 0) {
        await this.applyOptimizations(strategy.id, optimizations);
      }
    }
  }

  /**
   * Calculate current system performance from metrics
   */
  private calculateCurrentPerformance(metrics: RealTimeMetrics[]): {
    averageTime: number;
    averageAccuracy: number;
    stabilityScore: number;
    trendDirection: 'improving' | 'stable' | 'degrading';
  } {
    const avgTime = metrics.reduce((sum, m) => sum + m.processingTime, 0) / metrics.length;
    const avgAccuracy = metrics.reduce((sum, m) => sum + m.accuracyScore, 0) / metrics.length;

    // Calculate stability (lower variance = higher stability)
    const timeVariance = this.calculateVariance(metrics.map(m => m.processingTime));
    const stabilityScore = Math.max(0, 1 - (timeVariance / (avgTime * avgTime)));

    // Determine trend direction
    const firstHalf = metrics.slice(0, Math.floor(metrics.length / 2));
    const secondHalf = metrics.slice(Math.floor(metrics.length / 2));

    const firstAvgTime = firstHalf.reduce((sum, m) => sum + m.processingTime, 0) / firstHalf.length;
    const secondAvgTime = secondHalf.reduce((sum, m) => sum + m.processingTime, 0) / secondHalf.length;

    let trendDirection: 'improving' | 'stable' | 'degrading';
    const improvement = (firstAvgTime - secondAvgTime) / firstAvgTime;

    if (improvement > 0.1) trendDirection = 'improving';
    else if (improvement < -0.1) trendDirection = 'degrading';
    else trendDirection = 'stable';

    return {
      averageTime: avgTime,
      averageAccuracy: avgAccuracy,
      stabilityScore,
      trendDirection
    };
  }

  /**
   * Calculate variance for stability measurement
   */
  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
  }

  /**
   * Enhanced parameter optimization with machine learning-based recommendations
   */
  private identifyOptimizations(
    strategy: ProcessingStrategy,
    performance: ReturnType<typeof this.calculateCurrentPerformance>
  ): ParameterOptimization[] {
    const optimizations: ParameterOptimization[] = [];

    // Enhanced performance thresholds with adaptive targets
    const timeThreshold = strategy.estimatedTime * (1 + (1 - performance.stabilityScore) * 0.3); // Dynamic threshold
    const accuracyTarget = Math.max(0.85, strategy.accuracyExpected - 0.05); // Adaptive accuracy target

    // Advanced performance degradation detection
    if (performance.trendDirection === 'degrading' || performance.averageTime > timeThreshold) {

      // Smart segmentation optimization with learning
      const segmentationOptimization = this.calculateOptimalSegmentation(strategy, performance);
      if (segmentationOptimization) {
        optimizations.push(segmentationOptimization);
      }

      // Intelligent layout complexity adjustment
      if (performance.averageAccuracy > accuracyTarget) {
        const complexityReduction = this.calculateOptimalComplexityReduction(strategy, performance);
        optimizations.push({
          parameter: 'layoutComplexity',
          currentValue: strategy.parameters.layoutComplexity,
          targetValue: complexityReduction.targetValue,
          adjustmentRate: strategy.parameters.adaptationSpeed * complexityReduction.urgency,
          confidence: complexityReduction.confidence,
          expectedImprovement: complexityReduction.expectedGain
        });
      }

      // Adaptive animation optimization
      const animationOptimization = this.calculateOptimalAnimation(strategy, performance);
      optimizations.push(animationOptimization);
    }

    // Proactive accuracy optimization with stability consideration
    if (performance.trendDirection === 'stable' && performance.averageAccuracy < 0.92) {
      const confidenceOptimization = this.calculateOptimalConfidence(strategy, performance);
      optimizations.push(confidenceOptimization);
    }

    // Multi-factor opportunity detection
    const additionalOptimizations = this.detectOptimizationOpportunities(strategy, performance);
    optimizations.push(...additionalOptimizations);

    // Enhanced filtering with dynamic confidence thresholds
    const confidenceThreshold = performance.stabilityScore > 0.8 ? 0.3 : 0.6; // Lower threshold for stable systems
    return optimizations.filter(opt => opt.confidence > confidenceThreshold);
  }

  /**
   * Calculate optimal segmentation threshold using historical data
   */
  private calculateOptimalSegmentation(
    strategy: ProcessingStrategy,
    performance: ReturnType<typeof this.calculateCurrentPerformance>
  ): ParameterOptimization | null {
    if (performance.averageTime <= strategy.estimatedTime * 1.3) return null;

    // Calculate adjustment based on performance gap
    const performanceGap = (performance.averageTime - strategy.estimatedTime) / strategy.estimatedTime;
    const urgencyMultiplier = Math.min(2.0, 1 + performanceGap);

    const adjustment = Math.min(0.15, 0.05 + performanceGap * 0.1);
    const targetValue = Math.min(1.0, strategy.parameters.segmentationThreshold + adjustment);

    return {
      parameter: 'segmentationThreshold',
      currentValue: strategy.parameters.segmentationThreshold,
      targetValue,
      adjustmentRate: strategy.parameters.adaptationSpeed * urgencyMultiplier,
      confidence: Math.min(0.9, 0.6 + performanceGap * 0.3),
      expectedImprovement: Math.min(0.25, 0.1 + performanceGap * 0.15)
    };
  }

  /**
   * Calculate optimal complexity reduction with accuracy preservation
   */
  private calculateOptimalComplexityReduction(
    strategy: ProcessingStrategy,
    performance: ReturnType<typeof this.calculateCurrentPerformance>
  ): { targetValue: number; urgency: number; confidence: number; expectedGain: number } {
    const accuracyBuffer = performance.averageAccuracy - strategy.accuracyExpected;
    const timeOverrun = (performance.averageTime - strategy.estimatedTime) / strategy.estimatedTime;

    // More aggressive reduction if we have accuracy buffer
    const reductionFactor = Math.min(0.3, 0.1 + Math.max(0, accuracyBuffer) * 0.4 + timeOverrun * 0.2);
    const targetValue = Math.max(0.1, strategy.parameters.layoutComplexity * (1 - reductionFactor));

    return {
      targetValue,
      urgency: Math.min(2.0, 1 + timeOverrun),
      confidence: Math.min(0.9, 0.5 + accuracyBuffer * 2 + (timeOverrun > 0.3 ? 0.3 : 0)),
      expectedGain: Math.min(0.4, reductionFactor * 1.5)
    };
  }

  /**
   * Calculate optimal animation density with performance consideration
   */
  private calculateOptimalAnimation(
    strategy: ProcessingStrategy,
    performance: ReturnType<typeof this.calculateCurrentPerformance>
  ): ParameterOptimization {
    const timeOverrun = Math.max(0, (performance.averageTime - strategy.estimatedTime) / strategy.estimatedTime);
    const stabilityPenalty = 1 - performance.stabilityScore;

    const reduction = Math.min(0.15, 0.03 + timeOverrun * 0.1 + stabilityPenalty * 0.05);
    const targetValue = Math.max(0.05, strategy.parameters.animationDensity - reduction);

    return {
      parameter: 'animationDensity',
      currentValue: strategy.parameters.animationDensity,
      targetValue,
      adjustmentRate: strategy.parameters.adaptationSpeed * (1 + timeOverrun),
      confidence: Math.min(0.95, 0.7 + timeOverrun * 0.2),
      expectedImprovement: Math.min(0.2, reduction * 2)
    };
  }

  /**
   * Calculate optimal confidence threshold with learning from history
   */
  private calculateOptimalConfidence(
    strategy: ProcessingStrategy,
    performance: ReturnType<typeof this.calculateCurrentPerformance>
  ): ParameterOptimization {
    const accuracyGap = 0.92 - performance.averageAccuracy;
    const stabilityBonus = performance.stabilityScore > 0.8 ? 0.02 : 0;

    const adjustment = Math.min(0.1, accuracyGap * 0.3 + stabilityBonus);
    const targetValue = Math.min(0.98, strategy.parameters.diagramTypeConfidence + adjustment);

    return {
      parameter: 'diagramTypeConfidence',
      currentValue: strategy.parameters.diagramTypeConfidence,
      targetValue,
      adjustmentRate: strategy.parameters.adaptationSpeed * 0.7, // Conservative for accuracy
      confidence: Math.min(0.8, 0.4 + accuracyGap * 2 + stabilityBonus * 5),
      expectedImprovement: Math.min(0.15, adjustment * 1.5)
    };
  }

  /**
   * Detect additional optimization opportunities using pattern recognition
   */
  private detectOptimizationOpportunities(
    strategy: ProcessingStrategy,
    performance: ReturnType<typeof this.calculateCurrentPerformance>
  ): ParameterOptimization[] {
    const opportunities: ParameterOptimization[] = [];

    // Detect systematic inefficiencies
    if (this.realTimeMetrics.length >= 10) {
      const recentErrors = this.realTimeMetrics.slice(-10);
      const avgErrorRate = recentErrors.reduce((sum, m) => sum + m.errorRate, 0) / recentErrors.length;

      // If error rate is high, adjust stability threshold
      if (avgErrorRate > 0.1) {
        opportunities.push({
          parameter: 'stabilityThreshold',
          currentValue: strategy.parameters.stabilityThreshold,
          targetValue: Math.min(0.98, strategy.parameters.stabilityThreshold + 0.05),
          adjustmentRate: strategy.parameters.adaptationSpeed * 0.5,
          confidence: Math.min(0.8, avgErrorRate * 5),
          expectedImprovement: Math.min(0.1, avgErrorRate * 0.5)
        });
      }
    }

    // Detect memory pressure impact
    const recentMemoryUsage = this.realTimeMetrics.slice(-5);
    if (recentMemoryUsage.length > 0) {
      const avgMemoryPressure = recentMemoryUsage.reduce((sum, m) => sum + m.memoryUsage, 0) / recentMemoryUsage.length;

      if (avgMemoryPressure > 100 * 1024 * 1024) { // 100MB threshold
        opportunities.push({
          parameter: 'layoutComplexity',
          currentValue: strategy.parameters.layoutComplexity,
          targetValue: Math.max(0.2, strategy.parameters.layoutComplexity - 0.1),
          adjustmentRate: strategy.parameters.adaptationSpeed,
          confidence: 0.7,
          expectedImprovement: 0.15
        });
      }
    }

    return opportunities;
  }

  /**
   * Enhanced parameter optimization application with intelligent learning
   */
  private async applyOptimizations(strategyId: string, optimizations: ParameterOptimization[]): Promise<void> {
    const strategy = this.strategies.find(s => s.id === strategyId);
    if (!strategy) return;

    console.log(`🔧 Applying ${optimizations.length} ML-optimized adjustments to ${strategy.name}`);

    // Store active optimizations for tracking with timestamps
    const timestampedOptimizations = optimizations.map(opt => ({
      ...opt,
      appliedAt: Date.now(),
      strategyId
    }));
    this.activeOptimizations.set(strategyId, timestampedOptimizations);

    // Calculate adaptive learning rate based on recent success
    const adaptiveLearningRate = this.calculateAdaptiveLearningRate(strategy);

    // Apply intelligent parameter adjustments with momentum
    for (const opt of optimizations) {
      const currentValue = (strategy.parameters as any)[opt.parameter];

      // Enhanced adjustment calculation with momentum and dampening
      const confidence_weight = Math.pow(opt.confidence, 0.5); // Square root for smoother scaling
      const baseAdjustment = (opt.targetValue - currentValue) * opt.adjustmentRate;
      const learningAdjustment = baseAdjustment * adaptiveLearningRate * confidence_weight;

      // Apply momentum from previous adjustments (if any)
      const momentum = this.calculateMomentum(strategyId, opt.parameter);
      const adjustmentWithMomentum = learningAdjustment + momentum * 0.1;

      const newValue = this.applyBoundedAdjustment(currentValue, adjustmentWithMomentum, opt.parameter);

      // Apply the adjustment with parameter-specific bounds
      (strategy.parameters as any)[opt.parameter] = newValue;

      // Track parameter history for momentum calculation
      this.trackParameterHistory(strategyId, opt.parameter, currentValue, newValue);

      console.log(`   🎯 ${opt.parameter}: ${currentValue.toFixed(3)} → ${newValue.toFixed(3)} (target: ${opt.targetValue.toFixed(3)}, confidence: ${(opt.confidence * 100).toFixed(1)}%)`);
    }

    // Enhanced strategy metadata update with decay prevention
    const totalExpectedImprovement = optimizations.reduce((sum, opt) =>
      sum + opt.expectedImprovement * opt.confidence, 0) / optimizations.length;

    const timeImprovementFactor = Math.max(0.8, 1 - totalExpectedImprovement * 0.5); // Prevent over-optimization
    strategy.estimatedTime = Math.max(200, strategy.estimatedTime * timeImprovementFactor);

    // Update accuracy expectation based on confidence adjustments
    const accuracyOptimizations = optimizations.filter(opt =>
      opt.parameter === 'diagramTypeConfidence' || opt.parameter === 'segmentationThreshold');

    if (accuracyOptimizations.length > 0) {
      const accuracyImprovement = accuracyOptimizations.reduce((sum, opt) =>
        sum + opt.expectedImprovement * opt.confidence, 0) / accuracyOptimizations.length;
      strategy.accuracyExpected = Math.min(0.98, strategy.accuracyExpected + accuracyImprovement * 0.1);
    }
  }

  /**
   * Calculate adaptive learning rate based on recent optimization success
   */
  private calculateAdaptiveLearningRate(strategy: ProcessingStrategy): number {
    const effectiveness = this.calculateAdaptationEffectiveness();
    const stabilityFactor = this.realTimeMetrics.length >= 5 ?
      this.calculateCurrentPerformance(this.realTimeMetrics.slice(-5)).stabilityScore : 0.5;

    // Increase learning rate for effective adaptations, decrease for unstable systems
    const baseRate = this.learningRate;
    const effectivenessMultiplier = 0.5 + effectiveness; // Range: 0.5 to 1.5
    const stabilityMultiplier = 0.7 + stabilityFactor * 0.6; // Range: 0.7 to 1.3

    return Math.min(0.5, baseRate * effectivenessMultiplier * stabilityMultiplier);
  }

  /**
   * Calculate momentum from previous parameter adjustments
   */
  private calculateMomentum(strategyId: string, parameter: string): number {
    // Simple momentum calculation - would be enhanced with proper history tracking
    const activeOpts = this.activeOptimizations.get(strategyId) || [];
    const recentAdjustments = activeOpts
      .filter((opt: any) => opt.parameter === parameter && Date.now() - opt.appliedAt < 10000)
      .slice(-3);

    if (recentAdjustments.length < 2) return 0;

    // Calculate average adjustment direction
    let totalMomentum = 0;
    for (let i = 1; i < recentAdjustments.length; i++) {
      const prev = recentAdjustments[i - 1] as any;
      const curr = recentAdjustments[i] as any;
      totalMomentum += (curr.targetValue - curr.currentValue) * 0.1;
    }

    return totalMomentum / (recentAdjustments.length - 1);
  }

  /**
   * Apply bounded adjustment with parameter-specific constraints
   */
  private applyBoundedAdjustment(currentValue: number, adjustment: number, parameter: string): number {
    const bounds = this.getParameterBounds(parameter);
    const newValue = currentValue + adjustment;

    // Apply parameter-specific bounds
    return Math.max(bounds.min, Math.min(bounds.max, newValue));
  }

  /**
   * Get parameter-specific bounds for safe adjustment
   */
  private getParameterBounds(parameter: string): { min: number; max: number } {
    const bounds = {
      segmentationThreshold: { min: 0.1, max: 0.95 },
      diagramTypeConfidence: { min: 0.3, max: 0.98 },
      layoutComplexity: { min: 0.05, max: 0.95 },
      animationDensity: { min: 0.02, max: 0.9 },
      adaptationSpeed: { min: 0.1, max: 1.0 },
      stabilityThreshold: { min: 0.5, max: 0.99 }
    };

    return bounds[parameter as keyof typeof bounds] || { min: 0, max: 1 };
  }

  /**
   * Track parameter history for momentum and learning
   */
  private trackParameterHistory(strategyId: string, parameter: string, oldValue: number, newValue: number): void {
    // Simplified history tracking - in production would use proper data structure
    const key = `${strategyId}_${parameter}_history`;
    if (!this.performanceMetrics.has(key)) {
      this.performanceMetrics.set(key, []);
    }

    const history = this.performanceMetrics.get(key)!;
    history.push(newValue);

    // Keep only recent history (last 20 adjustments)
    if (history.length > 20) {
      history.splice(0, history.length - 20);
    }
  }

  /**
   * Record real-time metrics for adaptation
   */
  recordMetrics(metrics: Partial<RealTimeMetrics>): void {
    const fullMetrics: RealTimeMetrics = {
      processingTime: metrics.processingTime || 0,
      accuracyScore: metrics.accuracyScore || 0,
      memoryUsage: metrics.memoryUsage || 0,
      userEngagement: metrics.userEngagement || 0.5,
      errorRate: metrics.errorRate || 0,
      timestamp: Date.now()
    };

    this.realTimeMetrics.push(fullMetrics);

    // Keep only recent metrics (last 50 measurements)
    if (this.realTimeMetrics.length > 50) {
      this.realTimeMetrics = this.realTimeMetrics.slice(-50);
    }
  }

  /**
   * Get current optimization status
   */
  getOptimizationStatus(): {
    activeOptimizations: number;
    performanceTrend: string;
    adaptationEffectiveness: number;
    recommendations: string[];
  } {
    const totalOptimizations = Array.from(this.activeOptimizations.values())
      .reduce((sum, opts) => sum + opts.length, 0);

    const recentMetrics = this.realTimeMetrics.slice(-this.stabilityWindow);
    const performance = recentMetrics.length >= this.stabilityWindow ?
      this.calculateCurrentPerformance(recentMetrics) : null;

    const adaptationEffectiveness = this.calculateAdaptationEffectiveness();

    const recommendations: string[] = [];
    if (performance?.trendDirection === 'degrading') {
      recommendations.push('Consider reducing visual complexity for better performance');
    }
    if (adaptationEffectiveness < 0.5) {
      recommendations.push('Increase adaptation sensitivity for better responsiveness');
    }
    if (performance?.stabilityScore && performance.stabilityScore < 0.7) {
      recommendations.push('System performance is unstable - review parameter bounds');
    }

    return {
      activeOptimizations: totalOptimizations,
      performanceTrend: performance?.trendDirection || 'unknown',
      adaptationEffectiveness,
      recommendations
    };
  }

  /**
   * Enhanced adaptation effectiveness calculation with multiple metrics
   */
  private calculateAdaptationEffectiveness(): number {
    if (this.realTimeMetrics.length < 10) return 0.5; // Not enough data

    const beforeAdaptation = this.realTimeMetrics.slice(-20, -10);
    const afterAdaptation = this.realTimeMetrics.slice(-10);

    if (beforeAdaptation.length === 0 || afterAdaptation.length === 0) return 0.5;

    // Multi-metric effectiveness calculation
    const timeEffectiveness = this.calculateTimeImprovement(beforeAdaptation, afterAdaptation);
    const accuracyEffectiveness = this.calculateAccuracyImprovement(beforeAdaptation, afterAdaptation);
    const stabilityEffectiveness = this.calculateStabilityImprovement(beforeAdaptation, afterAdaptation);
    const errorEffectiveness = this.calculateErrorReduction(beforeAdaptation, afterAdaptation);

    // Weighted combination of effectiveness metrics
    const overallEffectiveness = (
      timeEffectiveness * 0.4 +        // Processing time improvement (40%)
      accuracyEffectiveness * 0.3 +    // Accuracy improvement (30%)
      stabilityEffectiveness * 0.2 +   // Stability improvement (20%)
      errorEffectiveness * 0.1         // Error reduction (10%)
    );

    return Math.max(0.1, Math.min(0.95, overallEffectiveness));
  }

  /**
   * Calculate processing time improvement effectiveness
   */
  private calculateTimeImprovement(before: RealTimeMetrics[], after: RealTimeMetrics[]): number {
    const beforeAvgTime = before.reduce((sum, m) => sum + m.processingTime, 0) / before.length;
    const afterAvgTime = after.reduce((sum, m) => sum + m.processingTime, 0) / after.length;

    const improvement = (beforeAvgTime - afterAvgTime) / beforeAvgTime;

    // Convert improvement to 0-1 scale with 0.5 as baseline (no change)
    return Math.max(0, Math.min(1, 0.5 + improvement * 2)); // Scale improvement by 2x for sensitivity
  }

  /**
   * Calculate accuracy improvement effectiveness
   */
  private calculateAccuracyImprovement(before: RealTimeMetrics[], after: RealTimeMetrics[]): number {
    const beforeAvgAcc = before.reduce((sum, m) => sum + m.accuracyScore, 0) / before.length;
    const afterAvgAcc = after.reduce((sum, m) => sum + m.accuracyScore, 0) / after.length;

    const improvement = (afterAvgAcc - beforeAvgAcc) / Math.max(beforeAvgAcc, 0.1);

    // Accuracy improvements are valuable, scale appropriately
    return Math.max(0, Math.min(1, 0.5 + improvement * 5)); // 5x scaling for accuracy sensitivity
  }

  /**
   * Calculate stability improvement effectiveness
   */
  private calculateStabilityImprovement(before: RealTimeMetrics[], after: RealTimeMetrics[]): number {
    const beforeVariance = this.calculateVariance(before.map(m => m.processingTime));
    const afterVariance = this.calculateVariance(after.map(m => m.processingTime));

    const avgTime = (before.concat(after)).reduce((sum, m) => sum + m.processingTime, 0) / (before.length + after.length);

    const beforeCV = Math.sqrt(beforeVariance) / avgTime; // Coefficient of variation
    const afterCV = Math.sqrt(afterVariance) / avgTime;

    const stabilityImprovement = (beforeCV - afterCV) / Math.max(beforeCV, 0.01);

    return Math.max(0, Math.min(1, 0.5 + stabilityImprovement * 1.5)); // 1.5x scaling for stability
  }

  /**
   * Calculate error reduction effectiveness
   */
  private calculateErrorReduction(before: RealTimeMetrics[], after: RealTimeMetrics[]): number {
    const beforeAvgError = before.reduce((sum, m) => sum + m.errorRate, 0) / before.length;
    const afterAvgError = after.reduce((sum, m) => sum + m.errorRate, 0) / after.length;

    const errorReduction = (beforeAvgError - afterAvgError) / Math.max(beforeAvgError, 0.001);

    return Math.max(0, Math.min(1, 0.5 + errorReduction * 3)); // 3x scaling for error reduction importance
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
        adaptable: true,
        parameters: {
          segmentationThreshold: 0.6,
          diagramTypeConfidence: 0.7,
          layoutComplexity: 0.3,
          animationDensity: 0.2,
          adaptationSpeed: 0.8, // Fast adaptation for basic processing
          stabilityThreshold: 0.75
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
        adaptable: true,
        parameters: {
          segmentationThreshold: 0.75,
          diagramTypeConfidence: 0.8,
          layoutComplexity: 0.6,
          animationDensity: 0.5,
          adaptationSpeed: 0.6, // Moderate adaptation for balanced processing
          stabilityThreshold: 0.8
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
        adaptable: true,
        parameters: {
          segmentationThreshold: 0.85,
          diagramTypeConfidence: 0.9,
          layoutComplexity: 0.9,
          animationDensity: 0.8,
          adaptationSpeed: 0.3, // Conservative adaptation for high quality
          stabilityThreshold: 0.9
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
        adaptable: false, // Don't adapt accessibility settings automatically
        parameters: {
          segmentationThreshold: 0.8,
          diagramTypeConfidence: 0.85,
          layoutComplexity: 0.4,
          animationDensity: 0.1,
          adaptationSpeed: 0.2, // Very conservative for accessibility
          stabilityThreshold: 0.95
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
        adaptable: true,
        parameters: {
          segmentationThreshold: 0.8,
          diagramTypeConfidence: 0.85,
          layoutComplexity: 0.7,
          animationDensity: 0.6,
          adaptationSpeed: 0.5, // Moderate adaptation for specialized content
          stabilityThreshold: 0.85
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
   * Get enhanced adaptation performance metrics for Iteration 22
   */
  getAdaptationMetrics(): {
    realTimeResponseSpeed: number;
    parameterOptimizationAccuracy: number;
    adaptationStability: number;
    overallScore: number;
    details: any;
  } {
    const recentMetrics = this.realTimeMetrics.slice(-this.stabilityWindow);

    const responseSpeed = this.adaptationTimer ?
      Math.max(0, 1 - (2000 / 1000)) : 0; // 2 second response = 0 penalty

    const optimizationAccuracy = this.calculateAdaptationEffectiveness();

    const adaptationStability = recentMetrics.length > 0 ?
      this.calculateCurrentPerformance(recentMetrics).stabilityScore : 0;

    const overallScore = (
      responseSpeed * 0.3 +
      optimizationAccuracy * 0.4 +
      adaptationStability * 0.3
    );

    return {
      realTimeResponseSpeed: responseSpeed,
      parameterOptimizationAccuracy: optimizationAccuracy,
      adaptationStability,
      overallScore,
      details: {
        activeStrategies: this.strategies.filter(s => s.adaptable).length,
        totalOptimizations: Array.from(this.activeOptimizations.values())
          .reduce((sum, opts) => sum + opts.length, 0),
        metricsCollected: this.realTimeMetrics.length,
        learningRate: this.learningRate,
        stabilityWindow: this.stabilityWindow
      }
    };
  }

  /**
   * Cleanup and shutdown adaptive processor
   */
  shutdown(): void {
    if (this.adaptationTimer) {
      clearInterval(this.adaptationTimer);
      this.adaptationTimer = null;
    }

    this.realTimeMetrics = [];
    this.activeOptimizations.clear();
    console.log('✅ Adaptive Content Processor shutdown complete');
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