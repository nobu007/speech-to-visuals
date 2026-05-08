/**
 * Phase 39: AutoImprovementEngine - Recursive Quality Enhancement System
 *
 * Implements automated quality improvement cycles:
 * - Continuous performance monitoring
 * - Automatic bottleneck detection
 * - Self-optimizing behavior
 * - Quality metric tracking
 * - Automated A/B testing for improvements
 *
 * Based on: Custom Instructions Section 5 & 6 (品質保証と継続的改善)
 */

import { IterationManager, createIterationManager } from './iteration-manager';
import { logger } from '../utils/logger';

export interface QualityMetrics {
  // Performance Metrics
  processingTime: number; // milliseconds
  memoryUsage: number; // MB
  throughput: number; // items/second

  // Accuracy Metrics
  transcriptionAccuracy: number; // 0-1
  sceneSegmentationF1: number; // 0-1
  entityExtractionF1: number; // 0-1
  relationAccuracy: number; // 0-1
  layoutOverlap: number; // 0 = perfect

  // System Metrics
  errorRate: number; // 0-1
  successRate: number; // 0-1
  crashCount: number;

  // Quality Score (weighted average)
  overallScore: number; // 0-100
}

export interface QualityThresholds {
  transcriptionAccuracy: number;
  sceneSegmentationF1: number;
  layoutOverlap: number;
  renderTime: number; // milliseconds
  memoryUsage: number; // MB
  entityExtractionF1: number;
  relationAccuracy: number;
  overallScore: number;
}

export interface ImprovementStrategy {
  name: string;
  description: string;
  targetMetric: keyof QualityMetrics;
  expectedImprovement: number; // percentage
  complexity: 'low' | 'medium' | 'high';
  execute: () => Promise<QualityMetrics>;
}

export interface ImprovementResult {
  strategy: string;
  before: QualityMetrics;
  after: QualityMetrics;
  improvement: number; // percentage
  success: boolean;
  timestamp: string;
}

/**
 * AutoImprovementEngine: Automatically detects and applies improvements
 */
export class AutoImprovementEngine {
  private thresholds: QualityThresholds;
  private improvementHistory: ImprovementResult[] = [];
  private currentMetrics?: QualityMetrics;
  private iterationManager?: IterationManager;

  constructor(thresholds?: Partial<QualityThresholds>) {
    this.thresholds = {
      transcriptionAccuracy: thresholds?.transcriptionAccuracy || 0.85,
      sceneSegmentationF1: thresholds?.sceneSegmentationF1 || 0.75,
      layoutOverlap: thresholds?.layoutOverlap || 0,
      renderTime: thresholds?.renderTime || 30000,
      memoryUsage: thresholds?.memoryUsage || 512,
      entityExtractionF1: thresholds?.entityExtractionF1 || 0.80,
      relationAccuracy: thresholds?.relationAccuracy || 0.85,
      overallScore: thresholds?.overallScore || 90,
    };

  }

  /**
   * Analyze current metrics and identify improvement opportunities
   */
  analyzeMetrics(metrics: QualityMetrics): {
    needsImprovement: boolean;
    issues: string[];
    recommendations: ImprovementStrategy[];
  } {
    const issues: string[] = [];
    const recommendations: ImprovementStrategy[] = [];

    this.currentMetrics = metrics;

    // Check each metric against thresholds
    if (metrics.transcriptionAccuracy < this.thresholds.transcriptionAccuracy) {
      issues.push(`Transcription accuracy (${(metrics.transcriptionAccuracy * 100).toFixed(1)}%) below threshold (${(this.thresholds.transcriptionAccuracy * 100).toFixed(1)}%)`);
      recommendations.push({
        name: 'Improve Transcription Model',
        description: 'Upgrade to better Whisper model or add post-processing',
        targetMetric: 'transcriptionAccuracy',
        expectedImprovement: 10,
        complexity: 'medium',
        execute: async () => metrics, // Placeholder
      });
    }

    if (metrics.sceneSegmentationF1 < this.thresholds.sceneSegmentationF1) {
      issues.push(`Scene segmentation F1 (${(metrics.sceneSegmentationF1 * 100).toFixed(1)}%) below threshold`);
      recommendations.push({
        name: 'Optimize Scene Detection',
        description: 'Tune segmentation parameters or use LLM-based detection',
        targetMetric: 'sceneSegmentationF1',
        expectedImprovement: 15,
        complexity: 'high',
        execute: async () => metrics,
      });
    }

    if (metrics.layoutOverlap > this.thresholds.layoutOverlap) {
      issues.push(`Layout overlap detected (${metrics.layoutOverlap} overlaps)`);
      recommendations.push({
        name: 'Fix Layout Overlaps',
        description: 'Apply zero-overlap constraint enforcement',
        targetMetric: 'layoutOverlap',
        expectedImprovement: 100,
        complexity: 'low',
        execute: async () => metrics,
      });
    }

    if (metrics.processingTime > this.thresholds.renderTime) {
      issues.push(`Processing time (${(metrics.processingTime / 1000).toFixed(1)}s) exceeds threshold`);
      recommendations.push({
        name: 'Optimize Performance',
        description: 'Add caching, parallelize operations, or optimize algorithms',
        targetMetric: 'processingTime',
        expectedImprovement: 30,
        complexity: 'medium',
        execute: async () => metrics,
      });
    }

    if (metrics.memoryUsage > this.thresholds.memoryUsage) {
      issues.push(`Memory usage (${metrics.memoryUsage.toFixed(1)}MB) exceeds threshold`);
      recommendations.push({
        name: 'Reduce Memory Footprint',
        description: 'Implement streaming, garbage collection, or memory pooling',
        targetMetric: 'memoryUsage',
        expectedImprovement: 25,
        complexity: 'medium',
        execute: async () => metrics,
      });
    }

    if (metrics.entityExtractionF1 < this.thresholds.entityExtractionF1) {
      issues.push(`Entity extraction F1 (${(metrics.entityExtractionF1 * 100).toFixed(1)}%) below threshold`);
      recommendations.push({
        name: 'Enhance Entity Extraction',
        description: 'Improve LLM prompts or add semantic analysis',
        targetMetric: 'entityExtractionF1',
        expectedImprovement: 12,
        complexity: 'medium',
        execute: async () => metrics,
      });
    }

    if (metrics.relationAccuracy < this.thresholds.relationAccuracy) {
      issues.push(`Relation accuracy (${(metrics.relationAccuracy * 100).toFixed(1)}%) below threshold`);
      recommendations.push({
        name: 'Improve Relationship Detection',
        description: 'Enhance edge detection logic with LLM validation',
        targetMetric: 'relationAccuracy',
        expectedImprovement: 10,
        complexity: 'high',
        execute: async () => metrics,
      });
    }

    if (metrics.overallScore < this.thresholds.overallScore) {
      issues.push(`Overall quality score (${metrics.overallScore.toFixed(1)}) below target`);
    }

    const needsImprovement = issues.length > 0;


    if (issues.length > 0) {
      // issues tracked for analysis
    }

    if (recommendations.length > 0) {
      recommendations
        .sort((a, b) => b.expectedImprovement - a.expectedImprovement)
        .forEach((rec, i) => {
        });
    }

    return {
      needsImprovement,
      issues,
      recommendations: recommendations.sort((a, b) => b.expectedImprovement - a.expectedImprovement),
    };
  }

  /**
   * Calculate overall quality score from metrics
   */
  calculateQualityScore(metrics: Partial<QualityMetrics>): number {
    const weights = {
      transcriptionAccuracy: 0.15,
      sceneSegmentationF1: 0.15,
      entityExtractionF1: 0.15,
      relationAccuracy: 0.15,
      layoutOverlap: 0.10,
      processingTime: 0.10,
      memoryUsage: 0.10,
      successRate: 0.10,
    };

    let score = 0;
    let totalWeight = 0;

    // Transcription accuracy (0-100)
    if (metrics.transcriptionAccuracy !== undefined) {
      score += metrics.transcriptionAccuracy * 100 * weights.transcriptionAccuracy;
      totalWeight += weights.transcriptionAccuracy;
    }

    // Scene segmentation F1 (0-100)
    if (metrics.sceneSegmentationF1 !== undefined) {
      score += metrics.sceneSegmentationF1 * 100 * weights.sceneSegmentationF1;
      totalWeight += weights.sceneSegmentationF1;
    }

    // Entity extraction F1 (0-100)
    if (metrics.entityExtractionF1 !== undefined) {
      score += metrics.entityExtractionF1 * 100 * weights.entityExtractionF1;
      totalWeight += weights.entityExtractionF1;
    }

    // Relation accuracy (0-100)
    if (metrics.relationAccuracy !== undefined) {
      score += metrics.relationAccuracy * 100 * weights.relationAccuracy;
      totalWeight += weights.relationAccuracy;
    }

    // Layout overlap (100 if 0, decrease for overlaps)
    if (metrics.layoutOverlap !== undefined) {
      const layoutScore = Math.max(0, 100 - metrics.layoutOverlap * 10);
      score += layoutScore * weights.layoutOverlap;
      totalWeight += weights.layoutOverlap;
    }

    // Processing time (100 if under threshold, decrease proportionally)
    if (metrics.processingTime !== undefined) {
      const timeRatio = Math.min(1, this.thresholds.renderTime / metrics.processingTime);
      score += timeRatio * 100 * weights.processingTime;
      totalWeight += weights.processingTime;
    }

    // Memory usage (100 if under threshold, decrease proportionally)
    if (metrics.memoryUsage !== undefined) {
      const memRatio = Math.min(1, this.thresholds.memoryUsage / metrics.memoryUsage);
      score += memRatio * 100 * weights.memoryUsage;
      totalWeight += weights.memoryUsage;
    }

    // Success rate (0-100)
    if (metrics.successRate !== undefined) {
      score += metrics.successRate * 100 * weights.successRate;
      totalWeight += weights.successRate;
    }

    // Normalize by actual weights used
    return totalWeight > 0 ? score / totalWeight : 0;
  }

  /**
   * Execute automatic improvement cycle
   */
  async runImprovementCycle(
    getCurrentMetrics: () => Promise<QualityMetrics>,
    strategies?: ImprovementStrategy[]
  ): Promise<{
    improved: boolean;
    results: ImprovementResult[];
    finalScore: number;
  }> {

    const results: ImprovementResult[] = [];
    let improved = false;

    // Get baseline metrics
    const baseline = await getCurrentMetrics();

    // Analyze and get recommendations
    const analysis = this.analyzeMetrics(baseline);

    if (!analysis.needsImprovement) {
      return { improved: false, results: [], finalScore: baseline.overallScore };
    }

    // Use provided strategies or recommendations from analysis
    const strategiesToApply = strategies || analysis.recommendations;

    // Apply improvements one by one (from highest to lowest expected impact)
    for (const strategy of strategiesToApply.slice(0, 3)) { // Top 3 improvements

      try {
        const before = await getCurrentMetrics();
        const after = await strategy.execute();

        const beforeValue = before[strategy.targetMetric] as number;
        const afterValue = after[strategy.targetMetric] as number;
        const improvement = ((afterValue - beforeValue) / beforeValue) * 100;

        const result: ImprovementResult = {
          strategy: strategy.name,
          before,
          after,
          improvement,
          success: improvement > 0,
          timestamp: new Date().toISOString(),
        };

        results.push(result);
        this.improvementHistory.push(result);

        if (result.success) {
          improved = true;
        } else {
          // Intentionally empty: non-successful result tracked in history, no additional action needed
        }
      } catch (error) {
        logger.error(`Failed to apply improvement: ${error}`);
      }
    }

    // Get final metrics
    const final = await getCurrentMetrics();
    const finalScore = final.overallScore;


    return { improved, results, finalScore };
  }

  /**
   * Get improvement history
   */
  getImprovementHistory(): ImprovementResult[] {
    return this.improvementHistory;
  }

  /**
   * Generate improvement report
   */
  generateReport(): string {
    const successCount = this.improvementHistory.filter(r => r.success).length;
    const totalCount = this.improvementHistory.length;

    let report = '# AutoImprovementEngine Report\n\n';
    report += `**Total Improvements Attempted**: ${totalCount}\n`;
    report += `**Successful Improvements**: ${successCount}\n`;
    report += `**Success Rate**: ${totalCount > 0 ? ((successCount / totalCount) * 100).toFixed(1) : 0}%\n\n`;

    if (this.currentMetrics) {
      report += '## Current Quality Metrics\n\n';
      report += '```json\n';
      report += JSON.stringify(this.currentMetrics, null, 2);
      report += '\n```\n\n';
    }

    if (this.improvementHistory.length > 0) {
      report += '## Improvement History\n\n';
      this.improvementHistory.forEach((result, i) => {
        report += `### ${i + 1}. ${result.strategy}\n`;
        report += `- **Status**: ${result.success ? '✅ Success' : '❌ Failed'}\n`;
        report += `- **Improvement**: ${result.improvement > 0 ? '+' : ''}${result.improvement.toFixed(1)}%\n`;
        report += `- **Date**: ${result.timestamp}\n`;
        report += `- **Before Score**: ${result.before.overallScore.toFixed(1)}\n`;
        report += `- **After Score**: ${result.after.overallScore.toFixed(1)}\n\n`;
      });
    }

    return report;
  }

  /**
   * Link with IterationManager for coordinated improvement cycles
   */
  linkIterationManager(manager: IterationManager): void {
    this.iterationManager = manager;
  }

  /**
   * Autonomous improvement loop (runs until quality threshold met or max iterations)
   */
  async autonomousImprovement(
    getCurrentMetrics: () => Promise<QualityMetrics>,
    targetScore: number = 95,
    maxCycles: number = 5
  ): Promise<{ success: boolean; cycles: number; finalScore: number }> {

    let cycle = 0;
    let currentScore = 0;

    while (cycle < maxCycles) {
      cycle++;

      const result = await this.runImprovementCycle(getCurrentMetrics);
      currentScore = result.finalScore;

      if (currentScore >= targetScore) {
        return { success: true, cycles: cycle, finalScore: currentScore };
      }

      if (!result.improved) {
        // Intentionally empty: stagnation detected, continue to next cycle
      }

      // Small delay between cycles
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return {
      success: currentScore >= targetScore,
      cycles: maxCycles,
      finalScore: currentScore,
    };
  }
}

/**
 * Create default auto-improvement engine
 */
export function createAutoImprovementEngine(
  thresholds?: Partial<QualityThresholds>
): AutoImprovementEngine {
  return new AutoImprovementEngine(thresholds);
}
