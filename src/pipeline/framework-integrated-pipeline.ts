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
import { getHeapUsed } from '@stv/core/utils/memory-usage';
import { logger } from '@stv/core/utils/logger';
import * as qualityEstimators from './quality-estimators';
import { CappedArray } from '@stv/core/lib/capped-array';
import {
  IterationManager,
  createIterationManager,
  DEVELOPMENT_CYCLES
} from '@/framework/iteration-manager';
import {
  AutoImprovementEngine,
  createAutoImprovementEngine,
  QualityMetrics,
  QualityThresholds,
  QualityRecommendation,
  toQualityRecommendations
} from '@/framework/auto-improvement-engine';

/**
 * Serializable quality-analysis contract returned by execute() and consumed by
 * useFrameworkPipeline / the dashboard. Recommendations are projected here to
 * QualityRecommendation[] so the non-serializable ImprovementStrategy.execute
 * closure never crosses the engine→UI boundary. See A124.
 */
export interface QualityAnalysisResult {
  overallScore: number;
  needsImprovement: boolean;
  issues: string[];
  recommendations: QualityRecommendation[];
}

/**
 * Maximum pipeline results retained in `pipelineHistory`.
 *
 * useFrameworkPipeline holds a FrameworkIntegratedPipeline in a React useRef for
 * a dashboard session, and each execute() appends a full PipelineResult (scenes,
 * audio, metrics). Without a cap the history grew without bound over a long
 * session. FIFO-bounded via CappedArray so a future push site can never
 * reintroduce unbounded growth. Reads work unchanged — last-result selection and
 * the history export in executeWithImprovement — because CappedArray extends
 * Array (indexing, spread, .length, .map/.filter all behave as a plain array).
 */
export const MAX_PIPELINE_HISTORY = 20;

/**
 * Enhanced pipeline with framework integration
 */
export class FrameworkIntegratedPipeline {
  private pipeline: MainPipeline;
  private iterationManager?: IterationManager;
  private improvementEngine: AutoImprovementEngine;
  private currentPhase: keyof typeof DEVELOPMENT_CYCLES;
  private pipelineHistory = new CappedArray<PipelineResult>(MAX_PIPELINE_HISTORY);

  constructor(config?: Partial<PipelineConfig>, thresholds?: Partial<QualityThresholds>) {
    this.pipeline = new MainPipeline(config);
    this.improvementEngine = createAutoImprovementEngine(thresholds);
    this.currentPhase = 'MVP構築'; // Start with MVP phase

  }

  /**
   * Set current development phase
   */
  setPhase(phaseName: keyof typeof DEVELOPMENT_CYCLES): void {
    this.currentPhase = phaseName;
    this.iterationManager = createIterationManager(phaseName);

    // Link improvement engine with iteration manager
    this.improvementEngine.linkIterationManager(this.iterationManager);

  }

  /**
   * Execute pipeline with full framework support
   */
  async execute(input: PipelineInput): Promise<{
    result: PipelineResult;
    iterationMetrics: unknown;
    qualityAnalysis: QualityAnalysisResult;
    shouldCommit: boolean;
    commitMessage?: string;
  }> {
    // Initialize iteration manager if not set
    if (!this.iterationManager) {
      this.setPhase(this.currentPhase);
    }


    // Start iteration
    await this.iterationManager!.startIteration();

    try {
      // Execute main pipeline
      const result = await this.pipeline.execute(input);

      // Store result in history
      this.pipelineHistory.push(result);

      // Convert pipeline result to quality metrics
      const qualityMetrics = this.extractQualityMetrics(result);

      // Analyze quality with improvement engine, then project recommendations to
      // the serializable UI shape. analyzeMetrics returns ImprovementStrategy[]
      // (each carrying a non-serializable `execute` closure for runImprovementCycle);
      // that closure cannot cross the dashboard / JSON-API boundary, so we project
      // to QualityRecommendation[] here. See A124.
      const rawAnalysis = this.improvementEngine.analyzeMetrics(qualityMetrics);
      const qualityAnalysis: QualityAnalysisResult = {
        overallScore: rawAnalysis.overallScore,
        needsImprovement: rawAnalysis.needsImprovement,
        issues: rawAnalysis.issues,
        recommendations: toQualityRecommendations(rawAnalysis.recommendations),
      };

      // Evaluate success criteria
      const metricsForEvaluation = {
        success: result.success,
        sceneCount: result.scenes?.length ?? 0,
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

    let cycle = 0;
    let bestResult: PipelineResult | null = null;
    let bestScore = 0;

    while (cycle < maxCycles) {
      cycle++;

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


        // Check if target achieved
        if (currentScore >= targetScore) {

          // Auto-commit if criteria met
          if (execution.shouldCommit && execution.commitMessage) {
            // Intentionally empty: auto-commit placeholder, commit logic not yet implemented
          }

          break;
        }

        // Run improvement cycle if needed
        if (execution.qualityAnalysis.needsImprovement) {

          const improvementResult = await this.improvementEngine.runImprovementCycle(
            async () => this.extractQualityMetrics(execution.result)
          );

          if (improvementResult.improved) {
            // Intentionally empty: improvement applied, will be reflected in next iteration's score
          }
        }

        // Move to next iteration
        this.pipeline.nextIteration();

      } catch (error) {
        logger.error(`Cycle ${cycle} failed:`, error);

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
    const memoryUsage = getHeapUsed() / (1024 * 1024); // Convert to MB, returns 0 in unsupported envs

    // Calculate various metrics from result
    const transcriptionAccuracy = this.estimateTranscriptionAccuracy(result);
    const sceneSegmentationF1 = this.estimateSegmentationQuality(result);
    const entityExtractionF1 = this.estimateEntityExtractionQuality(result);
    const relationAccuracy = this.estimateRelationAccuracy(result);
    const layoutOverlap = this.detectLayoutOverlaps(result);
    const nodeOverflow = this.detectNodeOverflow(result);
    const danglingLayoutEdges = this.detectDanglingLayoutEdges(result);
    const labelReadability = this.estimateLabelReadability(result);

    const metrics: QualityMetrics = {
      // Performance Metrics
      processingTime: result.processingTime,
      memoryUsage,
      throughput: result.processingTime > 0 ? (result.scenes?.length ?? 0) / (result.processingTime / 1000) : 0,

      // Accuracy Metrics
      transcriptionAccuracy,
      sceneSegmentationF1,
      entityExtractionF1,
      relationAccuracy,
      layoutOverlap,
      nodeOverflow,
      danglingLayoutEdges,
      labelReadability,

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

  // NOTE: the five estimators below are thin delegates to the canonical
  // `qualityEstimators` module (single source of truth). They are kept as
  // private methods so the existing white-box tests (PipelinePrivateMethods)
  // and internal callers (`extractQualityMetrics`) resolve to ONE
  // implementation shared with MainPipeline.buildQualityMetrics — previously
  // MainPipeline re-derived these from dead fields and diverged.

  /** Estimate transcription accuracy — delegates to the canonical module. */
  private estimateTranscriptionAccuracy(result: PipelineResult): number {
    return qualityEstimators.estimateTranscriptionAccuracy(result);
  }

  /** Estimate segmentation quality — delegates to the canonical module. */
  private estimateSegmentationQuality(result: PipelineResult): number {
    return qualityEstimators.estimateSegmentationQuality(result);
  }

  /** Estimate entity-extraction quality — delegates to the canonical module. */
  private estimateEntityExtractionQuality(result: PipelineResult): number {
    return qualityEstimators.estimateEntityExtractionQuality(result);
  }

  /** Estimate relation accuracy — delegates to the canonical module. */
  private estimateRelationAccuracy(result: PipelineResult): number {
    return qualityEstimators.estimateRelationAccuracy(result);
  }

  /**
   * Detect layout overlaps — delegates to `countLayoutOverlaps` in the canonical
   * module, which in turn delegates to `nodesOverlap` (the layout-engine
   * predicate, spacing 0). Touching nodes are NOT overlaps. See
   * framework-overlap-cross-invariant-fuzz.test.ts.
   */
  private detectLayoutOverlaps(result: PipelineResult): number {
    return qualityEstimators.countLayoutOverlaps(result);
  }

  /**
   * Count off-canvas / unpositioned nodes — delegates to `countNodeOverflow` in
   * the canonical module (single source of truth: DEFAULT_CANVAS_* bounds +
   * getNodeWidth/getNodeHeight). Exposed as a defect metric so the iteration
   * criteria reject a layout that overflows even when nothing overlaps.
   */
  private detectNodeOverflow(result: PipelineResult): number {
    return qualityEstimators.countNodeOverflow(result);
  }

  /**
   * Count layout edges whose endpoints are absent from the positioned node set
   * — delegates to `countDanglingLayoutEdges` in the canonical module. Exposed
   * as a defect metric so the iteration criteria reject a layout whose edges
   * point at nodes that were never placed.
   */
  private detectDanglingLayoutEdges(result: PipelineResult): number {
    return qualityEstimators.countDanglingLayoutEdges(result);
  }

  /**
   * Estimate label readability — delegates to `estimateLabelReadability` in the
   * canonical module (single source of truth: the same `sizeLabel` predicate the
   * renderer uses). Exposed as a higher-is-better quality metric so the
   * iteration criteria reject a layout whose node labels truncate.
   */
  private estimateLabelReadability(result: PipelineResult): number {
    return qualityEstimators.estimateLabelReadability(result);
  }

  /**
   * Display execution summary
   */
  private displayExecutionSummary(
    result: PipelineResult,
    metrics: QualityMetrics,
    evaluation: unknown,
    shouldCommit: boolean
  ): void {



    if (shouldCommit) {
      // Intentionally empty: commit decision placeholder, summary displayed via return value
    }

  }

  /**
   * Apply recovery strategy
   */
  private async applyRecoveryStrategy(strategy: string): Promise<void> {

    switch (strategy) {
      case 'retry':
        // Could adjust pipeline config here
        break;

      case 'fallback':
        // Could switch to simpler processing mode
        break;

      case 'minimal':
        // Could reset to basic configuration
        break;

      case 'manual':
        break;
    }

    // Small delay before continuing
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  /**
   * Get iteration summary
   */
  getIterationSummary(): unknown {
    return this.iterationManager?.getSummary();
  }

  /**
   * Get improvement history
   */
  getImprovementHistory(): unknown[] {
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
