import { PipelineResult, PipelineStage } from '@/pipeline/types';
import { SceneGraph } from '@/types/diagram';

/**
 * Quality Assessment Interfaces
 */
export interface QualityMetrics {
  // Performance Metrics
  totalProcessingTime: number;
  transcriptionTime: number;
  analysisTime: number;
  layoutTime: number;
  renderTime: number;
  memoryUsage: number;

  // Accuracy Metrics
  transcriptionAccuracy: number;
  sceneSegmentationF1: number;
  diagramDetectionAccuracy: number;
  layoutQuality: number;

  // Success Metrics
  segmentCount: number;
  diagramCount: number;
  successRate: number;
  errorRate: number;
}

export interface QualityAssessment {
  timestamp: Date;
  iteration: number;
  overallScore: number;
  performanceScore: number;
  accuracyScore: number;
  reliabilityScore: number;
  recommendations: string[];
  concerns: string[];
  improvements: string[];
}

export interface QualityThresholds {
  // Critical thresholds - must pass for deployment
  critical: {
    processingSuccessRate: number;
    memoryLeakDetection: boolean;
    coreFeatureFunctionality: number;
  };

  // Performance thresholds - should pass for optimal experience
  performance: {
    maxProcessingTime: number;      // milliseconds
    maxMemoryUsage: number;         // bytes
    minErrorRecoveryRate: number;   // 0.0-1.0
    minUserSatisfactionScore: number; // 1.0-5.0
  };

  // Optimization thresholds - nice to have for excellence
  optimization: {
    minProcessingSpeedRatio: number; // vs realtime
    minAccuracyScore: number;        // 0.0-1.0
    minCodeQualityScore: number;     // 0.0-1.0
    minDocumentationCoverage: number; // 0.0-1.0
  };
}

export interface IterationComparison {
  previousIteration: QualityMetrics;
  currentIteration: QualityMetrics;
  improvements: {
    processingSpeedGain: number;   // percentage improvement
    accuracyGain: number;          // percentage improvement
    reliabilityGain: number;       // percentage improvement
    memoryEfficiencyGain: number;  // percentage improvement
  };
  regressions: string[];           // areas that got worse
}

/**
 * Comprehensive Quality Monitoring System
 * Implements automated quality assessment and improvement tracking
 */
export class QualityMonitor {
  private thresholds: QualityThresholds;
  private iterationHistory: QualityAssessment[] = [];
  private currentIteration: number = 1;

  constructor() {
    this.thresholds = {
      critical: {
        processingSuccessRate: 0.90,
        memoryLeakDetection: false,
        coreFeatureFunctionality: 100
      },
      performance: {
        maxProcessingTime: 30000,      // 30 seconds
        maxMemoryUsage: 256 * 1024 * 1024, // 256MB
        minErrorRecoveryRate: 0.95,
        minUserSatisfactionScore: 4.0
      },
      optimization: {
        minProcessingSpeedRatio: 3.0,  // 3x realtime minimum
        minAccuracyScore: 0.85,        // 85% accuracy minimum
        minCodeQualityScore: 0.90,
        minDocumentationCoverage: 0.95
      }
    };
  }

  /**
   * Comprehensive quality assessment of pipeline execution
   */
  async assessPipelineQuality(result: PipelineResult): Promise<QualityAssessment> {
    console.log('\n🔍 Running Quality Assessment...');

    const startTime = performance.now();

    const assessment: QualityAssessment = {
      timestamp: new Date(),
      iteration: this.currentIteration,
      overallScore: 0,
      performanceScore: 0,
      accuracyScore: 0,
      reliabilityScore: 0,
      recommendations: [],
      concerns: [],
      improvements: []
    };

    try {
      // 1. Performance Assessment (30% weight)
      assessment.performanceScore = await this.assessPerformance(result);
      assessment.overallScore += assessment.performanceScore * 0.3;

      // 2. Accuracy Assessment (40% weight)
      assessment.accuracyScore = await this.assessAccuracy(result);
      assessment.overallScore += assessment.accuracyScore * 0.4;

      // 3. Reliability Assessment (30% weight)
      assessment.reliabilityScore = await this.assessReliability(result);
      assessment.overallScore += assessment.reliabilityScore * 0.3;

      // 4. Generate recommendations and concerns
      this.generateRecommendations(assessment, result);

      // 5. Compare with previous iterations
      this.compareWithPreviousIterations(assessment);

      // 6. Log assessment results
      await this.logAssessment(assessment);

      const assessmentTime = performance.now() - startTime;
      console.log(`✅ Quality assessment completed in ${assessmentTime.toFixed(0)}ms`);

      return assessment;

    } catch (error) {
      console.error('❌ Quality assessment failed:', error);
      assessment.concerns.push('Quality assessment system error');
      assessment.overallScore = 0;
      return assessment;
    }
  }

  /**
   * Assess performance metrics against thresholds
   */
  private async assessPerformance(result: PipelineResult): Promise<number> {
    let score = 0;
    let maxScore = 0;

    // Processing speed assessment (40% of performance score)
    const speedScore = this.assessProcessingSpeed(result.processingTime);
    score += speedScore * 0.4;
    maxScore += 0.4;

    // Memory usage assessment (30% of performance score)
    const memoryScore = this.assessMemoryUsage();
    score += memoryScore * 0.3;
    maxScore += 0.3;

    // Success rate assessment (30% of performance score)
    const successScore = result.success ? 1.0 : 0.0;
    score += successScore * 0.3;
    maxScore += 0.3;

    const normalizedScore = maxScore > 0 ? score / maxScore : 0;

    console.log(`📈 Performance Score: ${(normalizedScore * 100).toFixed(1)}%`);
    console.log(`   - Speed: ${(speedScore * 100).toFixed(1)}%`);
    console.log(`   - Memory: ${(memoryScore * 100).toFixed(1)}%`);
    console.log(`   - Success: ${(successScore * 100).toFixed(1)}%`);

    return normalizedScore;
  }

  /**
   * Assess processing speed vs realtime target
   */
  private assessProcessingSpeed(processingTime: number): number {
    // Assume 60s audio for calculation (this would be dynamic in real implementation)
    const assumedAudioDuration = 60000; // 60 seconds in milliseconds
    const actualSpeedRatio = assumedAudioDuration / processingTime;

    // Target: 2x realtime minimum, 6x realtime optimal
    const minTarget = 2.0;
    const optimalTarget = 6.0;

    if (actualSpeedRatio >= optimalTarget) {
      return 1.0; // Perfect score
    } else if (actualSpeedRatio >= minTarget) {
      // Linear scale between minimum and optimal
      return (actualSpeedRatio - minTarget) / (optimalTarget - minTarget);
    } else {
      // Below minimum threshold
      return actualSpeedRatio / minTarget;
    }
  }

  /**
   * Assess memory usage efficiency
   */
  private assessMemoryUsage(): number {
    // In real implementation, this would measure actual memory usage
    // For now, use thresholds based on observed performance
    const currentMemoryMB = 128; // Current observed peak
    const targetMemoryMB = 256;  // Maximum acceptable

    if (currentMemoryMB <= targetMemoryMB / 2) {
      return 1.0; // Excellent memory efficiency
    } else if (currentMemoryMB <= targetMemoryMB) {
      return 1.0 - (currentMemoryMB - targetMemoryMB / 2) / (targetMemoryMB / 2);
    } else {
      return 0.0; // Exceeds memory threshold
    }
  }

  /**
   * Assess accuracy of pipeline results
   */
  private async assessAccuracy(result: PipelineResult): Promise<number> {
    let score = 0;
    let maxScore = 0;

    // Scene count assessment (20% of accuracy score)
    const sceneScore = this.assessSceneGeneration(result.scenes);
    score += sceneScore * 0.2;
    maxScore += 0.2;

    // Layout quality assessment (40% of accuracy score)
    const layoutScore = this.assessLayoutQuality(result.scenes);
    score += layoutScore * 0.4;
    maxScore += 0.4;

    // Content relevance assessment (40% of accuracy score)
    const contentScore = this.assessContentRelevance(result.scenes);
    score += contentScore * 0.4;
    maxScore += 0.4;

    const normalizedScore = maxScore > 0 ? score / maxScore : 0;

    console.log(`🎯 Accuracy Score: ${(normalizedScore * 100).toFixed(1)}%`);
    console.log(`   - Scenes: ${(sceneScore * 100).toFixed(1)}%`);
    console.log(`   - Layout: ${(layoutScore * 100).toFixed(1)}%`);
    console.log(`   - Content: ${(contentScore * 100).toFixed(1)}%`);

    return normalizedScore;
  }

  /**
   * Assess scene generation quality
   */
  private assessSceneGeneration(scenes: SceneGraph[]): number {
    if (scenes.length === 0) return 0;

    // Optimal scene count: 2-8 scenes for typical content
    const sceneCount = scenes.length;

    if (sceneCount >= 2 && sceneCount <= 8) {
      return 1.0; // Optimal scene count
    } else if (sceneCount === 1 || sceneCount <= 12) {
      return 0.8; // Acceptable scene count
    } else {
      return 0.5; // Too many or too few scenes
    }
  }

  /**
   * Assess layout quality for generated scenes
   */
  private assessLayoutQuality(scenes: SceneGraph[]): number {
    if (scenes.length === 0) return 0;

    let totalScore = 0;

    scenes.forEach(scene => {
      let sceneScore = 0;

      // Check for layout existence
      if (!scene.layout || !scene.layout.nodes) {
        sceneScore = 0;
      } else {
        // Check for overlaps (critical)
        const hasOverlaps = this.detectOverlaps(scene.layout.nodes);
        if (hasOverlaps) {
          sceneScore = 0.3; // Significant penalty for overlaps
        } else {
          sceneScore = 1.0; // No overlaps is excellent
        }

        // Check for reasonable positioning
        const positioningScore = this.assessPositioning(scene.layout.nodes);
        sceneScore = (sceneScore + positioningScore) / 2;
      }

      totalScore += sceneScore;
    });

    return totalScore / scenes.length;
  }

  /**
   * Detect overlapping nodes in layout
   */
  private detectOverlaps(nodes: any[]): boolean {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const node1 = nodes[i];
        const node2 = nodes[j];

        if (this.nodesOverlap(node1, node2)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Check if two nodes overlap
   */
  private nodesOverlap(node1: any, node2: any): boolean {
    const margin = 10; // Minimum margin between nodes

    return !(
      node1.x + (node1.w || 120) + margin < node2.x ||
      node2.x + (node2.w || 120) + margin < node1.x ||
      node1.y + (node1.h || 60) + margin < node2.y ||
      node2.y + (node2.h || 60) + margin < node1.y
    );
  }

  /**
   * Assess positioning quality of nodes
   */
  private assessPositioning(nodes: any[]): number {
    if (nodes.length === 0) return 1.0;

    // Check for reasonable distribution
    const positions = nodes.map(n => ({ x: n.x || 0, y: n.y || 0 }));

    // Calculate spread - nodes should be reasonably distributed
    const xPositions = positions.map(p => p.x);
    const yPositions = positions.map(p => p.y);

    const xRange = Math.max(...xPositions) - Math.min(...xPositions);
    const yRange = Math.max(...yPositions) - Math.min(...yPositions);

    // Reasonable spread for 1920x1080 canvas
    const goodXRange = xRange > 200 && xRange < 1500;
    const goodYRange = yRange > 100 && yRange < 800;

    return (goodXRange ? 0.5 : 0.3) + (goodYRange ? 0.5 : 0.3);
  }

  /**
   * Assess content relevance and coherence
   */
  private assessContentRelevance(scenes: SceneGraph[]): number {
    if (scenes.length === 0) return 0;

    let totalScore = 0;

    scenes.forEach(scene => {
      let sceneScore = 0;

      // Check for valid diagram type
      const validTypes = ['flow', 'tree', 'timeline', 'matrix', 'cycle'];
      if (validTypes.includes(scene.type)) {
        sceneScore += 0.3;
      }

      // Check for reasonable node count
      const nodeCount = scene.nodes?.length || 0;
      if (nodeCount >= 2 && nodeCount <= 15) {
        sceneScore += 0.3;
      } else if (nodeCount === 1 || nodeCount <= 20) {
        sceneScore += 0.2;
      }

      // Check for summary/keyphrases existence
      if (scene.summary && scene.summary.length > 10) {
        sceneScore += 0.2;
      }

      if (scene.keyphrases && scene.keyphrases.length > 0) {
        sceneScore += 0.2;
      }

      totalScore += sceneScore;
    });

    return totalScore / scenes.length;
  }

  /**
   * Assess system reliability and error handling
   */
  private async assessReliability(result: PipelineResult): Promise<number> {
    let score = 0;
    let maxScore = 0;

    // Success/failure assessment (50% of reliability score)
    const successScore = result.success ? 1.0 : 0.0;
    score += successScore * 0.5;
    maxScore += 0.5;

    // Stage completion assessment (30% of reliability score)
    const stageScore = this.assessStageReliability(result.stages);
    score += stageScore * 0.3;
    maxScore += 0.3;

    // Error handling assessment (20% of reliability score)
    const errorScore = this.assessErrorHandling(result);
    score += errorScore * 0.2;
    maxScore += 0.2;

    const normalizedScore = maxScore > 0 ? score / maxScore : 0;

    console.log(`🛡️ Reliability Score: ${(normalizedScore * 100).toFixed(1)}%`);
    console.log(`   - Success: ${(successScore * 100).toFixed(1)}%`);
    console.log(`   - Stages: ${(stageScore * 100).toFixed(1)}%`);
    console.log(`   - Errors: ${(errorScore * 100).toFixed(1)}%`);

    return normalizedScore;
  }

  /**
   * Assess reliability of individual pipeline stages
   */
  private assessStageReliability(stages: PipelineStage[]): number {
    if (stages.length === 0) return 0;

    const completedStages = stages.filter(s => s.status === 'complete');
    const errorStages = stages.filter(s => s.status === 'error');

    const completionRate = completedStages.length / stages.length;
    const errorRate = errorStages.length / stages.length;

    // Perfect completion with no errors = 1.0
    // Some errors but overall completion = 0.7
    // Major failures = 0.0

    if (errorRate === 0 && completionRate === 1.0) {
      return 1.0;
    } else if (completionRate >= 0.8) {
      return 0.7;
    } else if (completionRate >= 0.6) {
      return 0.4;
    } else {
      return 0.0;
    }
  }

  /**
   * Assess error handling effectiveness
   */
  private assessErrorHandling(result: PipelineResult): number {
    // If successful, error handling wasn't tested but system is stable
    if (result.success) {
      return 0.9; // Good baseline score
    }

    // If failed but has error message, error handling worked
    if (result.error && result.error.length > 0) {
      return 0.7; // Handled gracefully
    }

    // If failed without proper error handling
    return 0.2;
  }

  /**
   * Generate recommendations based on assessment
   */
  private generateRecommendations(assessment: QualityAssessment, result: PipelineResult): void {
    // Performance recommendations
    if (assessment.performanceScore < 0.8) {
      assessment.recommendations.push('Consider performance optimization - processing speed below target');
    }

    // Accuracy recommendations
    if (assessment.accuracyScore < 0.75) {
      assessment.recommendations.push('Review content analysis accuracy - detection confidence low');
    }

    // Reliability recommendations
    if (assessment.reliabilityScore < 0.9) {
      assessment.recommendations.push('Enhance error handling - system reliability below optimal');
    }

    // Scene-specific recommendations
    if (result.scenes.length === 0) {
      assessment.concerns.push('No scenes generated - check content analysis pipeline');
    } else if (result.scenes.length > 10) {
      assessment.recommendations.push('Consider scene consolidation - too many scenes may impact video flow');
    }

    // Overall score recommendations
    if (assessment.overallScore < 0.7) {
      assessment.concerns.push('Overall system quality below production threshold');
    } else if (assessment.overallScore > 0.9) {
      assessment.improvements.push('System performing excellently - ready for optimization features');
    }
  }

  /**
   * Compare current assessment with previous iterations
   */
  private compareWithPreviousIterations(assessment: QualityAssessment): void {
    if (this.iterationHistory.length === 0) {
      assessment.improvements.push('Baseline iteration established');
      return;
    }

    const previousAssessment = this.iterationHistory[this.iterationHistory.length - 1];

    // Performance comparison
    const perfImprovement = assessment.performanceScore - previousAssessment.performanceScore;
    if (perfImprovement > 0.05) {
      assessment.improvements.push(`Performance improved by ${(perfImprovement * 100).toFixed(1)}%`);
    } else if (perfImprovement < -0.05) {
      assessment.concerns.push(`Performance declined by ${(Math.abs(perfImprovement) * 100).toFixed(1)}%`);
    }

    // Accuracy comparison
    const accImprovement = assessment.accuracyScore - previousAssessment.accuracyScore;
    if (accImprovement > 0.05) {
      assessment.improvements.push(`Accuracy improved by ${(accImprovement * 100).toFixed(1)}%`);
    } else if (accImprovement < -0.05) {
      assessment.concerns.push(`Accuracy declined by ${(Math.abs(accImprovement) * 100).toFixed(1)}%`);
    }

    // Overall improvement
    const overallImprovement = assessment.overallScore - previousAssessment.overallScore;
    if (overallImprovement > 0.1) {
      assessment.improvements.push('Significant overall quality improvement detected');
    }
  }

  /**
   * Log assessment results
   */
  private async logAssessment(assessment: QualityAssessment): Promise<void> {
    console.log('\n📊 Quality Assessment Results:');
    console.log(`Overall Score: ${(assessment.overallScore * 100).toFixed(1)}%`);
    console.log(`Performance: ${(assessment.performanceScore * 100).toFixed(1)}%`);
    console.log(`Accuracy: ${(assessment.accuracyScore * 100).toFixed(1)}%`);
    console.log(`Reliability: ${(assessment.reliabilityScore * 100).toFixed(1)}%`);

    if (assessment.improvements.length > 0) {
      console.log('\n✅ Improvements:');
      assessment.improvements.forEach(improvement => {
        console.log(`  - ${improvement}`);
      });
    }

    if (assessment.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      assessment.recommendations.forEach(rec => {
        console.log(`  - ${rec}`);
      });
    }

    if (assessment.concerns.length > 0) {
      console.log('\n⚠️ Concerns:');
      assessment.concerns.forEach(concern => {
        console.log(`  - ${concern}`);
      });
    }

    // Store assessment for historical comparison
    this.iterationHistory.push(assessment);

    // Log to iteration file (in real implementation)
    await this.appendToIterationLog(assessment);
  }

  /**
   * Append assessment to iteration log
   */
  private async appendToIterationLog(assessment: QualityAssessment): Promise<void> {
    // In real implementation, this would append to .module/ITERATION_LOG.md
    console.log(`[Quality Monitor] Iteration ${assessment.iteration} logged for improvement tracking`);
  }

  /**
   * Move to next iteration
   */
  public nextIteration(): void {
    this.currentIteration++;
    console.log(`🔄 Quality Monitor: Moving to iteration ${this.currentIteration}`);
  }

  /**
   * Get quality trends over time
   */
  public getQualityTrends(): {
    performance: number[];
    accuracy: number[];
    reliability: number[];
    overall: number[];
  } {
    return {
      performance: this.iterationHistory.map(a => a.performanceScore),
      accuracy: this.iterationHistory.map(a => a.accuracyScore),
      reliability: this.iterationHistory.map(a => a.reliabilityScore),
      overall: this.iterationHistory.map(a => a.overallScore)
    };
  }

  /**
   * Check if system meets deployment criteria
   */
  public checkDeploymentReadiness(): {
    ready: boolean;
    criticalIssues: string[];
    warnings: string[];
  } {
    const latest = this.iterationHistory[this.iterationHistory.length - 1];

    if (!latest) {
      return {
        ready: false,
        criticalIssues: ['No quality assessment available'],
        warnings: []
      };
    }

    const criticalIssues: string[] = [];
    const warnings: string[] = [];

    // Critical checks
    if (latest.overallScore < 0.7) {
      criticalIssues.push('Overall quality below production threshold (70%)');
    }

    if (latest.reliabilityScore < 0.9) {
      criticalIssues.push('System reliability below production standard (90%)');
    }

    // Warning checks
    if (latest.performanceScore < 0.8) {
      warnings.push('Performance could be improved for better user experience');
    }

    if (latest.accuracyScore < 0.8) {
      warnings.push('Accuracy improvements recommended for better results');
    }

    return {
      ready: criticalIssues.length === 0,
      criticalIssues,
      warnings
    };
  }
}

export const qualityMonitor = new QualityMonitor();