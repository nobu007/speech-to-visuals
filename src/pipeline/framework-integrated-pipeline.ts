/**
 * Phase 40: Framework-Integrated Pipeline
 *
 * Integrates IterationManager and AutoImprovementEngine into MainPipeline
 * for complete autonomous development cycle support
 *
 * Features:
 * - Automatic iteration tracking with ITERATION_LOG.md logging
 * - Autonomous quality improvement cycles
 * - Success criteria evaluation
 * - Auto-commit trigger decisions
 * - Recovery strategy management
 *
 * Based on: Custom Instructions (音声→図解動画自動生成システム)
 */

import { MainPipeline } from './main-pipeline';
import { PipelineInput, PipelineResult, PipelineConfig } from './types';
import {
  IterationManager,
  createIterationManager,
  DEVELOPMENT_CYCLES
} from '@/framework/iteration-manager';
import {
  AutoImprovementEngine,
  createAutoImprovementEngine,
  QualityMetrics,
  QualityThresholds
} from '@/framework/auto-improvement-engine';

/**
 * Enhanced pipeline with framework integration
 */
export class FrameworkIntegratedPipeline {
  private pipeline: MainPipeline;
  private iterationManager?: IterationManager;
  private improvementEngine: AutoImprovementEngine;
  private currentPhase: keyof typeof DEVELOPMENT_CYCLES;
  private pipelineHistory: PipelineResult[] = [];

  constructor(config?: Partial<PipelineConfig>, thresholds?: Partial<QualityThresholds>) {
    this.pipeline = new MainPipeline(config);
    this.improvementEngine = createAutoImprovementEngine(thresholds);
    this.currentPhase = 'MVP構築'; // Start with MVP phase

    console.log('🎯 Framework-Integrated Pipeline initialized');
    console.log(`📋 Starting Phase: ${this.currentPhase}`);
  }

  /**
   * Set current development phase
   */
  setPhase(phaseName: keyof typeof DEVELOPMENT_CYCLES): void {
    this.currentPhase = phaseName;
    this.iterationManager = createIterationManager(phaseName);

    // Link improvement engine with iteration manager
    this.improvementEngine.linkIterationManager(this.iterationManager);

    console.log(`\n🔄 Phase changed to: ${phaseName}`);
    console.log(`📊 Max iterations: ${DEVELOPMENT_CYCLES[phaseName].maxIterations}`);
    console.log(`✓ Success criteria: ${DEVELOPMENT_CYCLES[phaseName].successCriteria.join(', ')}`);
  }

  /**
   * Execute pipeline with full framework support
   */
  async execute(input: PipelineInput): Promise<{
    result: PipelineResult;
    iterationMetrics: any;
    qualityAnalysis: any;
    shouldCommit: boolean;
    commitMessage?: string;
  }> {
    // Initialize iteration manager if not set
    if (!this.iterationManager) {
      this.setPhase(this.currentPhase);
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🚀 Framework-Integrated Pipeline Execution`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    // Start iteration
    await this.iterationManager!.startIteration();

    try {
      // Execute main pipeline
      const result = await this.pipeline.execute(input);

      // Store result in history
      this.pipelineHistory.push(result);

      // Convert pipeline result to quality metrics
      const qualityMetrics = this.extractQualityMetrics(result);

      // Analyze quality with improvement engine
      const qualityAnalysis = this.improvementEngine.analyzeMetrics(qualityMetrics);

      // Evaluate success criteria
      const metricsForEvaluation = {
        success: result.success,
        processingTime: result.processingTime,
        sceneCount: result.scenes.length,
        overallScore: qualityMetrics.overallScore,
        ...qualityMetrics
      };

      const evaluation = this.iterationManager!.evaluateSuccessCriteria(metricsForEvaluation);

      // Complete iteration
      const iterationMetrics = await this.iterationManager!.completeIteration(
        evaluation.allMet ? 'success' : 'failure',
        metricsForEvaluation,
        result.error
      );

      // Determine if commit should be triggered
      const shouldCommit = this.iterationManager!.shouldCommit();
      const commitMessage = shouldCommit ? this.iterationManager!.generateCommitMessage() : undefined;

      // Display results
      this.displayExecutionSummary(result, qualityMetrics, evaluation, shouldCommit);

      return {
        result,
        iterationMetrics,
        qualityAnalysis,
        shouldCommit,
        commitMessage
      };

    } catch (error) {
      // Handle failure
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await this.iterationManager!.completeIteration('failure', {
        error: errorMessage,
        success: false
      }, errorMessage);

      // Determine recovery strategy
      const recoveryStrategy = this.iterationManager!.determineRecoveryStrategy();
      console.log(`\n🛡️ Recovery Strategy: ${recoveryStrategy}`);

      throw error;
    }
  }

  /**
   * Execute with autonomous improvement cycles
   */
  async executeWithImprovement(
    input: PipelineInput,
    targetScore: number = 95,
    maxCycles: number = 5
  ): Promise<{
    finalResult: PipelineResult;
    improvementCycles: number;
    finalScore: number;
    history: PipelineResult[];
  }> {
    console.log(`\n🤖 Starting Autonomous Improvement Mode`);
    console.log(`   Target Quality Score: ${targetScore}`);
    console.log(`   Max Improvement Cycles: ${maxCycles}\n`);

    let cycle = 0;
    let bestResult: PipelineResult | null = null;
    let bestScore = 0;

    while (cycle < maxCycles) {
      cycle++;
      console.log(`\n━━━ Improvement Cycle ${cycle}/${maxCycles} ━━━`);

      try {
        // Execute pipeline with framework
        const execution = await this.execute(input);
        const currentScore = this.improvementEngine.calculateQualityScore(
          this.extractQualityMetrics(execution.result)
        );

        // Track best result
        if (currentScore > bestScore) {
          bestScore = currentScore;
          bestResult = execution.result;
        }

        console.log(`📊 Current Score: ${currentScore.toFixed(1)}/100`);

        // Check if target achieved
        if (currentScore >= targetScore) {
          console.log(`\n🎉 Target score achieved!`);

          // Auto-commit if criteria met
          if (execution.shouldCommit && execution.commitMessage) {
            console.log(`\n📝 Auto-commit recommended:`);
            console.log(execution.commitMessage);
          }

          break;
        }

        // Run improvement cycle if needed
        if (execution.qualityAnalysis.needsImprovement) {
          console.log(`\n🔧 Running improvement recommendations...`);

          const improvementResult = await this.improvementEngine.runImprovementCycle(
            async () => this.extractQualityMetrics(execution.result),
            execution.qualityAnalysis.recommendations.slice(0, 2) // Top 2 recommendations
          );

          if (improvementResult.improved) {
            console.log(`✅ Improvements applied successfully`);
          }
        }

        // Move to next iteration
        this.pipeline.nextIteration();

      } catch (error) {
        console.error(`❌ Cycle ${cycle} failed:`, error);

        // Apply recovery strategy
        const strategy = this.iterationManager!.determineRecoveryStrategy();
        await this.applyRecoveryStrategy(strategy);
      }
    }

    return {
      finalResult: bestResult || this.pipelineHistory[this.pipelineHistory.length - 1],
      improvementCycles: cycle,
      finalScore: bestScore,
      history: this.pipelineHistory
    };
  }

  /**
   * Extract quality metrics from pipeline result
   */
  private extractQualityMetrics(result: PipelineResult): QualityMetrics {
    const memoryUsage = typeof process !== 'undefined' && process.memoryUsage
      ? process.memoryUsage().heapUsed / (1024 * 1024) // Convert to MB
      : 100;

    // Calculate various metrics from result
    const transcriptionAccuracy = this.estimateTranscriptionAccuracy(result);
    const sceneSegmentationF1 = this.estimateSegmentationQuality(result);
    const entityExtractionF1 = this.estimateEntityExtractionQuality(result);
    const relationAccuracy = this.estimateRelationAccuracy(result);
    const layoutOverlap = this.detectLayoutOverlaps(result);

    const metrics: QualityMetrics = {
      // Performance Metrics
      processingTime: result.processingTime,
      memoryUsage,
      throughput: result.scenes.length / (result.processingTime / 1000),

      // Accuracy Metrics
      transcriptionAccuracy,
      sceneSegmentationF1,
      entityExtractionF1,
      relationAccuracy,
      layoutOverlap,

      // System Metrics
      errorRate: result.success ? 0 : 1,
      successRate: result.success ? 1 : 0,
      crashCount: 0,

      // Calculate overall score
      overallScore: 0 // Will be calculated below
    };

    // Calculate overall quality score
    metrics.overallScore = this.improvementEngine.calculateQualityScore(metrics);

    return metrics;
  }

  /**
   * Estimate transcription accuracy (placeholder - would need ground truth)
   */
  private estimateTranscriptionAccuracy(result: PipelineResult): number {
    // In production, this would compare against ground truth
    // For now, estimate based on success and scene count
    if (!result.success) return 0;
    return result.scenes.length > 0 ? 0.90 : 0.50;
  }

  /**
   * Estimate segmentation quality
   */
  private estimateSegmentationQuality(result: PipelineResult): number {
    if (!result.success || result.scenes.length === 0) return 0;

    // Good segmentation: 2-10 scenes, reasonable duration
    const sceneCount = result.scenes.length;
    const avgDuration = result.duration / sceneCount;

    let score = 0.7; // Base score

    // Bonus for good scene count
    if (sceneCount >= 2 && sceneCount <= 10) score += 0.15;

    // Bonus for reasonable scene durations (2-15 seconds)
    if (avgDuration >= 2000 && avgDuration <= 15000) score += 0.15;

    return Math.min(1.0, score);
  }

  /**
   * Estimate entity extraction quality
   */
  private estimateEntityExtractionQuality(result: PipelineResult): number {
    if (!result.success || result.scenes.length === 0) return 0;

    const scenesWithNodes = result.scenes.filter(s => s.nodes.length > 0);
    const avgNodesPerScene = scenesWithNodes.reduce((sum, s) => sum + s.nodes.length, 0) / Math.max(scenesWithNodes.length, 1);

    // Good extraction: 2-10 nodes per scene
    if (avgNodesPerScene >= 2 && avgNodesPerScene <= 10) return 0.90;
    if (avgNodesPerScene >= 1 && avgNodesPerScene < 2) return 0.70;
    return 0.50;
  }

  /**
   * Estimate relation accuracy
   */
  private estimateRelationAccuracy(result: PipelineResult): number {
    if (!result.success || result.scenes.length === 0) return 0;

    const scenesWithEdges = result.scenes.filter(s => s.edges.length > 0);
    const avgEdgesPerScene = scenesWithEdges.reduce((sum, s) => sum + s.edges.length, 0) / Math.max(scenesWithEdges.length, 1);

    // Good relations: at least some edges, reasonable ratio
    if (avgEdgesPerScene >= 1) return 0.85;
    return 0.60;
  }

  /**
   * Detect layout overlaps
   */
  private detectLayoutOverlaps(result: PipelineResult): number {
    let totalOverlaps = 0;

    for (const scene of result.scenes) {
      if (!scene.layout?.nodes) continue;

      const nodes = scene.layout.nodes;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const n1 = nodes[i];
          const n2 = nodes[j];

          // Check for overlap (assuming nodes have x, y, width, height or w, h)
          const w1 = ('width' in n1 ? n1.width : 'w' in n1 ? n1.w : 120) as number;
          const h1 = ('height' in n1 ? n1.height : 'h' in n1 ? n1.h : 60) as number;
          const w2 = ('width' in n2 ? n2.width : 'w' in n2 ? n2.w : 120) as number;
          const h2 = ('height' in n2 ? n2.height : 'h' in n2 ? n2.h : 60) as number;

          const overlaps = !(
            n1.x + w1 < n2.x ||
            n2.x + w2 < n1.x ||
            n1.y + h1 < n2.y ||
            n2.y + h2 < n1.y
          );

          if (overlaps) totalOverlaps++;
        }
      }
    }

    return totalOverlaps;
  }

  /**
   * Display execution summary
   */
  private displayExecutionSummary(
    result: PipelineResult,
    metrics: QualityMetrics,
    evaluation: any,
    shouldCommit: boolean
  ): void {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📊 Execution Summary`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    console.log(`✓ Status: ${result.success ? '✅ Success' : '❌ Failed'}`);
    console.log(`✓ Overall Quality Score: ${metrics.overallScore.toFixed(1)}/100`);
    console.log(`✓ Processing Time: ${(result.processingTime / 1000).toFixed(2)}s`);
    console.log(`✓ Scenes Generated: ${result.scenes.length}`);
    console.log(`✓ Memory Usage: ${metrics.memoryUsage.toFixed(1)}MB`);
    console.log(`✓ Layout Overlaps: ${metrics.layoutOverlap}`);

    console.log(`\n📋 Success Criteria: ${evaluation.allMet ? '✅ All Met' : '⚠️ Some Failed'}`);

    if (shouldCommit) {
      console.log(`\n📝 Commit Recommended: Yes`);
      console.log(`   Phase: ${this.currentPhase}`);
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  }

  /**
   * Apply recovery strategy
   */
  private async applyRecoveryStrategy(strategy: string): Promise<void> {
    console.log(`\n🔄 Applying recovery strategy: ${strategy}`);

    switch (strategy) {
      case 'retry':
        console.log('   Preparing for retry with adjusted parameters...');
        // Could adjust pipeline config here
        break;

      case 'fallback':
        console.log('   Switching to fallback approach...');
        // Could switch to simpler processing mode
        break;

      case 'minimal':
        console.log('   Returning to minimal viable implementation...');
        // Could reset to basic configuration
        break;

      case 'manual':
        console.log('   Manual intervention required');
        console.log('   Please review logs and metrics');
        break;
    }

    // Small delay before continuing
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  /**
   * Get iteration summary
   */
  getIterationSummary(): any {
    return this.iterationManager?.getSummary();
  }

  /**
   * Get improvement history
   */
  getImprovementHistory(): any[] {
    return this.improvementEngine.getImprovementHistory();
  }

  /**
   * Generate comprehensive report
   */
  generateReport(): string {
    let report = '# Framework-Integrated Pipeline Report\n\n';

    report += `## Phase: ${this.currentPhase}\n\n`;

    // Iteration summary
    if (this.iterationManager) {
      const summary = this.iterationManager.getSummary();
      report += '## Iteration Summary\n\n';
      report += `- Total Iterations: ${summary.totalIterations}\n`;
      report += `- Successful: ${summary.successfulIterations}\n`;
      report += `- Failed: ${summary.failedIterations}\n`;
      report += `- Final Status: ${summary.finalStatus}\n\n`;

      if (summary.insights.length > 0) {
        report += '### Insights\n\n';
        summary.insights.forEach(insight => {
          report += `- ${insight}\n`;
        });
        report += '\n';
      }
    }

    // Improvement history
    report += this.improvementEngine.generateReport();

    return report;
  }
}

/**
 * Create framework-integrated pipeline with default settings
 */
export function createFrameworkIntegratedPipeline(
  config?: Partial<PipelineConfig>,
  thresholds?: Partial<QualityThresholds>
): FrameworkIntegratedPipeline {
  return new FrameworkIntegratedPipeline(config, thresholds);
}
