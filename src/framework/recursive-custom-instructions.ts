/**
 * 🔄 Recursive Custom Instructions Integration Framework
 * 音声→図解動画自動生成システム開発 Claude Code用カスタムインストラクション
 *
 * ENHANCED IMPLEMENTATION following your detailed custom instructions:
 * - 段階的開発フロー（再帰的プロセス）
 * - 品質保証と継続的改善
 * - モジュール構成と依存関係管理
 * - 作業実行プロトコル完全準拠
 *
 * This module implements the complete recursive development framework
 * as specified in your comprehensive custom instructions document.
 */

import { logger } from '@stv/core/utils/logger';
import { safeMean } from '@stv/core/lib/metrics-utils';
import { DEVELOPMENT_CYCLES } from './iteration-manager';
import {
  DEFAULT_TRANSCRIPTION_ACCURACY_THRESHOLD,
  DEFAULT_SCENE_SEGMENTATION_F1_THRESHOLD,
  DEFAULT_LAYOUT_OVERLAP_THRESHOLD,
  DEFAULT_RENDER_TIME_THRESHOLD_MS,
  DEFAULT_MEMORY_USAGE_THRESHOLD_BYTES,
} from './quality-thresholds';

export interface DevelopmentCycle {
  phase: string;
  maxIterations: number;
  successCriteria: string[];
  failureRecovery: string;
  commitTrigger: 'on_success' | 'on_checkpoint' | 'on_review';
}

export interface QualityMetrics {
  transcriptionAccuracy: number;
  sceneSegmentationF1: number;
  layoutOverlap: number;
  renderTime: number;
  memoryUsage: number;
  timestamp: Date;
}

export interface IterationState {
  phase: string;
  iteration: number;
  status: 'planning' | 'implementing' | 'testing' | 'evaluating' | 'completed';
  metrics: QualityMetrics;
  improvements: string[];
  nextActions: string[];
}

/**
 * REQ-390: every module result below carries ONLY fields with a measured
 * source in `currentState.metrics` (populated by recordStageSuccess /
 * recordStageFailure — the live MainPipeline contract) plus the `issues`
 * derived from threshold violations. The pre-fix interfaces carried fields
 * no producer ever measured (`confidence`, `diagramDetection`,
 * `relationshipExtraction`, `labelReadability`, `renderPerformance`,
 * `pipelineFlow`, `errorHandling`) whose values were constant fixtures, and
 * a `duration: number` in SECONDS that calculateModuleScore averaged into
 * the 0-1 module mean (module score 1.4167, overallScore ≈ 1.0037 — a
 * "quality fraction" permanently above 1.0). Fields without a measurement
 * are REMOVED, not re-fabricated (the REQ-383 documentation-leg /
 * REQ-384 commitPhase move).
 */
interface TranscriptionQualityResult {
  /** 0-1 — `currentState.metrics.transcriptionAccuracy`. */
  accuracy: number;
  issues: string[];
}

interface AnalysisQualityResult {
  /** 0-1 — `currentState.metrics.sceneSegmentationF1`. */
  sceneSegmentation: number;
  issues: string[];
}

interface VisualizationQualityResult {
  /** 1 = measured zero-overlap layout; 0 = overlaps measured (count gate). */
  layoutQuality: number;
  issues: string[];
}

interface IntegrationQualityResult {
  /** 1 | 0.5 — measured `renderTime` vs the renderTime threshold. */
  timeBudget: number;
  /**
   * 1 | 0.5 — measured `memoryUsage` BYTES vs the bytes threshold. Named
   * `memoryBudget` (a 0-1 score) precisely because `QualityMetrics.memoryUsage`
   * is bytes: same-name-different-unit is the recurring ms/s-style trap.
   */
  memoryBudget: number;
  issues: string[];
}

interface QualityCheckResults {
  transcription: TranscriptionQualityResult;
  analysis: AnalysisQualityResult;
  visualization: VisualizationQualityResult;
  integration: IntegrationQualityResult;
}

interface EvaluationResult {
  passed: boolean;
  score: number;
  issues: string[];
  suggestions: string[];
}

export class RecursiveCustomInstructionsFramework {
  private currentState: IterationState;
  private developmentCycles: DevelopmentCycle[];
  private qualityThresholds: QualityMetrics;
  private config: Record<string, unknown>;

  constructor(config: Record<string, unknown> = {}) {
    this.config = config;
    // Single source (round 24): derive from the canonical DEVELOPMENT_CYCLES
    // record. The previously inlined 3-phase copy had drifted from it —
    // 内容分析's successCriteria lost the entity/relation bars and gained an
    // alien diagram-type-accuracy criterion the canonical plan does not
    // carry, and E2E統合/品質向上 were missing entirely, so `evaluateIteration`'s
    // `.find()` missed those phases and fell through to the "partial success"
    // commit on iteration 1 instead of iterating.
    this.developmentCycles = Object.values(DEVELOPMENT_CYCLES);

    this.qualityThresholds = {
      transcriptionAccuracy: DEFAULT_TRANSCRIPTION_ACCURACY_THRESHOLD,
      sceneSegmentationF1: DEFAULT_SCENE_SEGMENTATION_F1_THRESHOLD,
      layoutOverlap: DEFAULT_LAYOUT_OVERLAP_THRESHOLD,
      renderTime: DEFAULT_RENDER_TIME_THRESHOLD_MS, // 30秒以内
      memoryUsage: DEFAULT_MEMORY_USAGE_THRESHOLD_BYTES, // 512MB以内 (bytes)
      timestamp: new Date()
    };

    this.currentState = {
      phase: "Recursive Custom Instructions Implementation",
      iteration: 1,
      status: 'implementing',
      metrics: this.getInitialMetrics(),
      improvements: [],
      nextActions: []
    };
  }

  private getInitialMetrics(): QualityMetrics {
    return {
      transcriptionAccuracy: 0,
      sceneSegmentationF1: 0,
      layoutOverlap: 0,
      renderTime: 0,
      memoryUsage: 0,
      timestamp: new Date()
    };
  }

  /**
   * 📋 Execute Development Cycle Following Custom Instructions
   */
  async executeDevelopmentCycle(
    phase: string,
    implementation: () => Promise<unknown>
  ): Promise<IterationState> {

    try {
      // 1. Implementation phase
      this.currentState.status = 'implementing';
      const startTime = performance.now();

      const result = await implementation();

      // 2. Testing phase
      this.currentState.status = 'testing';
      const testResults = await this.runQualityChecks();

      // 3. Evaluation phase
      this.currentState.status = 'evaluating';
      const evaluation = await this.evaluateResults(testResults);

      // 4. Update metrics
      this.currentState.metrics = {
        ...this.currentState.metrics,
        renderTime: performance.now() - startTime,
        timestamp: new Date()
      };

      // 5. Determine next actions
      if (evaluation.passed) {
        this.currentState.status = 'completed';
        await this.commitChanges(phase);
      } else {
        this.currentState.improvements.push(...evaluation.suggestions);
        this.currentState.iteration++;
      }

      return this.currentState;

    } catch (error) {
      logger.error(`Error in ${phase}:`, error);
      await this.handleFailure(error as Error, phase);
      return this.currentState;
    }
  }

  /**
   * 🔍 Quality Check System
   */
  private async runQualityChecks(): Promise<QualityCheckResults> {

    const checks = {
      transcription: await this.checkTranscriptionQuality(),
      analysis: await this.checkAnalysisQuality(),
      visualization: await this.checkVisualizationQuality(),
      integration: await this.checkIntegrationQuality()
    };

    return checks;
  }

  /**
   * REQ-390: scores the RECORDED measurement — the same
   * `currentState.metrics` fields `evaluateIteration` gates on — instead of
   * the previous constant fixture (a fixed accuracy plus a seconds-valued
   * duration averaged into the 0-1 mean) that made the module score a
   * run-independent constant above 1.0.
   */
  private async checkTranscriptionQuality(): Promise<TranscriptionQualityResult> {
    const accuracy = this.currentState.metrics.transcriptionAccuracy;
    const issues: string[] = [];
    if (accuracy < this.qualityThresholds.transcriptionAccuracy) {
      issues.push(
        `Transcription accuracy ${accuracy} below ${this.qualityThresholds.transcriptionAccuracy}`
      );
    }
    return { accuracy, issues };
  }

  private async checkAnalysisQuality(): Promise<AnalysisQualityResult> {
    const sceneSegmentation = this.currentState.metrics.sceneSegmentationF1;
    const issues: string[] = [];
    if (sceneSegmentation < this.qualityThresholds.sceneSegmentationF1) {
      issues.push(
        `Scene segmentation F1 ${sceneSegmentation} below ${this.qualityThresholds.sceneSegmentationF1}`
      );
    }
    return { sceneSegmentation, issues };
  }

  private async checkVisualizationQuality(): Promise<VisualizationQualityResult> {
    // Count gate (DEFAULT_LAYOUT_OVERLAP_THRESHOLD = 0): a measured zero is
    // the product's zero-overlap quality bar → 1; any measured overlap → 0.
    const layoutQuality =
      this.currentState.metrics.layoutOverlap <= this.qualityThresholds.layoutOverlap ? 1 : 0;
    const issues: string[] = [];
    if (layoutQuality < 1) {
      issues.push(
        `Layout overlap count ${this.currentState.metrics.layoutOverlap} above ${this.qualityThresholds.layoutOverlap}`
      );
    }
    return { layoutQuality, issues };
  }

  private async checkIntegrationQuality(): Promise<IntegrationQualityResult> {
    // Budget legs follow calculateCurrentQualityScore's binary idiom
    // (in budget → 1, over → 0.5) over the MEASURED values every
    // recordStageSuccess call writes (renderTime ms, memoryUsage bytes).
    const timeBudget =
      this.currentState.metrics.renderTime <= this.qualityThresholds.renderTime ? 1 : 0.5;
    const memoryBudget =
      this.currentState.metrics.memoryUsage <= DEFAULT_MEMORY_USAGE_THRESHOLD_BYTES ? 1 : 0.5;
    const issues: string[] = [];
    if (timeBudget < 1) {
      issues.push(
        `Render time ${this.currentState.metrics.renderTime}ms exceeds ${this.qualityThresholds.renderTime}ms`
      );
    }
    if (memoryBudget < 1) {
      issues.push(
        `Memory usage ${this.currentState.metrics.memoryUsage} bytes exceeds ${DEFAULT_MEMORY_USAGE_THRESHOLD_BYTES}`
      );
    }
    return { timeBudget, memoryBudget, issues };
  }

  /**
   * 📊 Evaluation System
   */
  private async evaluateResults(testResults: QualityCheckResults): Promise<EvaluationResult> {
    const overallScore = this.calculateOverallScore(testResults);
    const passed = overallScore >= 0.8; // 80% threshold

    const evaluation = {
      passed,
      score: overallScore,
      issues: this.extractIssues(testResults),
      suggestions: this.generateSuggestions(testResults)
    };


    return evaluation;
  }

  private calculateOverallScore(testResults: QualityCheckResults): number {
    const weights = {
      transcription: 0.25,
      analysis: 0.30,
      visualization: 0.25,
      integration: 0.20
    };

    let totalScore = 0;
    Object.entries(weights).forEach(([module, weight]) => {
      const moduleResults = testResults[module as keyof QualityCheckResults];
      if (moduleResults) {
        const moduleScore = this.calculateModuleScore(moduleResults as unknown as Record<string, unknown>);
        totalScore += moduleScore * weight;
      }
    });

    return totalScore;
  }

  private calculateModuleScore(moduleResults: Record<string, unknown>): number {
    // Finite-safe aggregation (round 20): the previous validity filter used
    // `typeof v === 'number'`, which ADMITS NaN and ±Infinity — exactly the
    // samples a "valid metrics only" filter exists to reject. A single
    // non-finite metric made the module mean NaN, which propagated through
    // calculateOverallScore into the `passed = overallScore >= 0.8` gate (NaN
    // comparison → always false → silently failing evaluation). safeMean
    // applies `Number.isFinite` per element: non-numbers are excluded exactly
    // as before (Number.isFinite never coerces), and non-finite numbers are now
    // excluded too. Value-identical for all-finite metrics. The `as number[]`
    // is compiler-only: safeMean re-checks `Number.isFinite` per element at
    // runtime, which excludes every non-number exactly like the old filter.
    return safeMean(Object.values(moduleResults) as number[]);
  }

  private extractIssues(testResults: QualityCheckResults): string[] {
    const allIssues: string[] = [];
    Object.values(testResults).forEach((result: { issues: string[] }) => {
      if (result?.issues) {
        allIssues.push(...result.issues);
      }
    });
    return allIssues;
  }

  private generateSuggestions(testResults: QualityCheckResults): string[] {
    const suggestions: string[] = [];

    if (testResults.transcription?.accuracy < DEFAULT_TRANSCRIPTION_ACCURACY_THRESHOLD) {
      suggestions.push("Improve audio preprocessing for better transcription accuracy");
    }

    // REQ-390: threshold constant (0.75) instead of the previously hardcoded
    // 0.8 — the same single-source rule as every other gate in this class.
    if (testResults.analysis?.sceneSegmentation < DEFAULT_SCENE_SEGMENTATION_F1_THRESHOLD) {
      suggestions.push("Enhance scene segmentation algorithm with better boundary detection");
    }

    if (testResults.visualization?.layoutQuality < 1) {
      suggestions.push("Optimize layout algorithm to prevent overlaps and improve readability");
    }

    if (testResults.integration?.timeBudget < 1) {
      suggestions.push("Implement performance optimization for faster rendering");
    }

    if (testResults.integration?.memoryBudget < 1) {
      suggestions.push("Implement memory optimization techniques for large file processing");
    }

    return suggestions;
  }

  /**
   * 🔧 Error Handling and Recovery
   */
  private async handleFailure(error: Error, context: string): Promise<void> {

    // 1. Save current state
    await this.saveIterationState();

    // 2. Categorize error
    const category = this.categorizeError(error);

    // 3. Apply recovery strategy
    switch(category) {
      case 'dependency':
        await this.fixDependencies();
        break;
      case 'logic':
        await this.rollbackAndRefactor();
        break;
      case 'performance':
        await this.optimizeBottleneck();
        break;
      case 'api_error':
        await this.handleApiFailure(error);
        break;
      default:
        await this.minimalFallback();
    }
  }

  private categorizeError(error: Error): string {
    if (error.message.includes('Module not found') || error.message.includes('Cannot resolve')) {
      return 'dependency';
    }
    if (error.message.includes('performance') || error.message.includes('timeout')) {
      return 'performance';
    }
    // API/Gemini related errors
    if (
      /quota|rate limit|429|api key|unauthorized|permission|network|ECONN|ENET|fetch failed|5\d{2}/i.test(
        error.message
      )
    ) {
      return 'api_error';
    }
    return 'logic';
  }

  private async fixDependencies(): Promise<void> {
    logger.warn('Dependency error detected — flagging for manual resolution');
    this.currentState.improvements.push('Resolve dependency issues before next iteration');
  }

  private async rollbackAndRefactor(): Promise<void> {
    logger.warn('Logic error detected — rolling back to last known good state');
    this.currentState.iteration = Math.max(1, this.currentState.iteration - 1);
    this.currentState.improvements.push('Rollback applied; refactor needed for logic error');
  }

  private async optimizeBottleneck(): Promise<void> {
    logger.warn('Performance bottleneck detected — reducing scope');
    this.currentState.improvements.push('Optimize performance bottleneck before next iteration');
  }

  private async minimalFallback(): Promise<void> {
    logger.warn('Unknown error — applying minimal fallback strategy');
    this.currentState.improvements.push('Minimal fallback applied; investigate root cause');
  }

  /**
   * API/LLM failure handler
   * - Disables Gemini-backed analysis for the current run
   * - Instructs the system to use rule-based fallback paths
   * - Can be extended to add exponential backoff / retry policies
   */
  private async handleApiFailure(error: Error): Promise<void> {
    // Disable Gemini-backed analysis via env flag for the remainder of the process
    // The analysis layer reads ANALYSIS_DISABLE_GEMINI to skip LLM calls
    (process as unknown as { env: Record<string, string> }).env.ANALYSIS_DISABLE_GEMINI = '1';

    // Optional: add simple backoff marker/state if needed in the future
    this.currentState.improvements.push('Switched to rule-based analysis due to API error');
  }

  /**
   * 💾 State Management
   */
  private async saveIterationState(): Promise<void> {
    const stateFile = `.module/iteration-state.json`;
    const state = {
      ...this.currentState,
      timestamp: new Date().toISOString(),
      framework: 'RecursiveCustomInstructions'
    };

    try {
      const { writeFileSync, mkdirSync } = await import('fs');
      mkdirSync('.module', { recursive: true });
      writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf-8');
    } catch (error) {
      logger.warn(`Failed to save iteration state: ${error}`);
    }
  }

  private async commitChanges(phase: string): Promise<void> {
    const commitMessage = `feat(${phase.toLowerCase().replace(/\s+/g, '-')}): Complete ${phase} [iteration-${this.currentState.iteration}]`;

    // In a real implementation, this would execute git commands
  }

  /**
   * 📈 Progress Reporting
   */
  public generateProgressReport(): Record<string, unknown> {
    return {
      framework: 'Recursive Custom Instructions',
      currentPhase: this.currentState.phase,
      iteration: this.currentState.iteration,
      status: this.currentState.status,
      qualityScore: this.calculateCurrentQualityScore(),
      metrics: this.currentState.metrics,
      improvements: this.currentState.improvements,
      nextActions: this.currentState.nextActions,
      timestamp: new Date().toISOString()
    };
  }

  private calculateCurrentQualityScore(): number {
    const metrics = this.currentState.metrics;
    return (
      metrics.transcriptionAccuracy * 0.25 +
      metrics.sceneSegmentationF1 * 0.25 +
      (metrics.layoutOverlap === 0 ? 1 : 0) * 0.25 +
      (metrics.renderTime < this.qualityThresholds.renderTime ? 1 : 0.5) * 0.25
    );
  }

  /**
   * 🔄 Missing Methods Required by Main Pipeline
   */

  /**
   * Start a development cycle for a specific phase
   */
  async startCycle(phase: string, iteration: number): Promise<void> {

    this.currentState.phase = phase;
    this.currentState.iteration = iteration;
    this.currentState.status = 'planning';

    // Initialize phase-specific metrics
    this.currentState.metrics = {
      ...this.getInitialMetrics(),
      timestamp: new Date()
    };

  }

  /**
   * Evaluate current iteration and determine next steps
   */
  async evaluateIteration(qualityMetrics: QualityMetrics, performanceData: Record<string, unknown>): Promise<EvaluationResult & { shouldIterate: boolean; shouldAdvancePhase: boolean; shouldCommit: boolean; commitMessage: string; qualityScore: number; issues: string[]; improvements: string[] }> {

    // Update current metrics
    this.currentState.metrics = {
      ...qualityMetrics,
      timestamp: new Date()
    };

    // Check against quality thresholds
    const evaluation = {
      passed: false,
      score: 0,
      suggestions: [] as string[],
      shouldIterate: false,
      shouldAdvancePhase: false,
      shouldCommit: false,
      commitMessage: '',
      qualityScore: 0,
      issues: [] as string[],
      improvements: [] as string[]
    };

    // Calculate quality score
    evaluation.qualityScore = this.calculateCurrentQualityScore();
    evaluation.score = evaluation.qualityScore;

    // Check specific criteria
    const meetsTranscriptionThreshold = qualityMetrics.transcriptionAccuracy >= this.qualityThresholds.transcriptionAccuracy;
    const meetsSegmentationThreshold = qualityMetrics.sceneSegmentationF1 >= this.qualityThresholds.sceneSegmentationF1;
    const meetsLayoutThreshold = qualityMetrics.layoutOverlap <= this.qualityThresholds.layoutOverlap;
    const meetsPerformanceThreshold = qualityMetrics.renderTime <= this.qualityThresholds.renderTime;

    // Determine next actions based on current phase
    const currentPhaseConfig = this.developmentCycles.find(cycle => cycle.phase === this.currentState.phase);

    if (!meetsTranscriptionThreshold) {
      evaluation.issues.push('Transcription accuracy below threshold');
      evaluation.improvements.push('Improve audio preprocessing and model parameters');
    }

    if (!meetsSegmentationThreshold) {
      evaluation.issues.push('Scene segmentation F1 score below threshold');
      evaluation.improvements.push('Enhance segmentation algorithm with better boundary detection');
    }

    if (!meetsLayoutThreshold) {
      evaluation.issues.push('Layout overlap detected');
      evaluation.improvements.push('Optimize layout engine to prevent node overlaps');
    }

    if (!meetsPerformanceThreshold) {
      evaluation.issues.push('Render time exceeds threshold');
      evaluation.improvements.push('Implement performance optimization for faster rendering');
    }

    // Decision logic
    const allCriteriaMet = meetsTranscriptionThreshold && meetsSegmentationThreshold &&
                          meetsLayoutThreshold && meetsPerformanceThreshold;

    if (allCriteriaMet) {
      evaluation.shouldAdvancePhase = true;
      evaluation.shouldCommit = true;
      evaluation.passed = true;
      evaluation.commitMessage = `feat(${this.currentState.phase}): Complete phase with quality score ${(evaluation.qualityScore * 100).toFixed(1)}%`;
    } else if (currentPhaseConfig && this.currentState.iteration < currentPhaseConfig.maxIterations) {
      evaluation.shouldIterate = true;
      evaluation.suggestions = evaluation.improvements;
    } else {
      // Max iterations reached - apply failure recovery
      evaluation.shouldCommit = true;
      evaluation.commitMessage = `feat(${this.currentState.phase}): Complete phase with partial success (iteration ${this.currentState.iteration})`;
    }


    return evaluation;
  }

  /**
   * Prepare for next iteration in current phase
   */
  async prepareNextIteration(phase: string, iteration: number): Promise<void> {

    this.currentState.iteration = iteration;
    this.currentState.status = 'planning';

    // Apply improvements from previous iteration
    if (this.currentState.improvements.length > 0) {
      this.currentState.improvements.forEach((improvement) => {
        this.currentState.nextActions.push(improvement);
      });
      logger.info(`Applied ${this.currentState.improvements.length} improvements to next iteration`);
    }
  }

  /**
   * Advance to next development phase
   */
  async advanceToPhase(newPhase: string): Promise<void> {

    this.currentState.phase = newPhase;
    this.currentState.iteration = 1;
    this.currentState.status = 'planning';
    this.currentState.improvements = [];
    this.currentState.nextActions = [];

    // Reset metrics for new phase
    this.currentState.metrics = this.getInitialMetrics();

  }

  /**
   * Commit current iteration changes
   */
  async commitIteration(phase: string, iteration: number, commitMessage: string): Promise<void> {

    // In a real implementation, this would execute git commands
    // For now, we'll simulate the commit process

    const commitData = {
      phase,
      iteration,
      message: commitMessage,
      timestamp: new Date().toISOString(),
      metrics: this.currentState.metrics,
      qualityScore: this.calculateCurrentQualityScore()
    };


    // Update state
    this.currentState.status = 'completed';
  }

  /**
   * Handle iteration failure
   */
  async handleIterationFailure(phase: string, iteration: number, error: Error): Promise<void> {
    logger.error(`Iteration ${iteration} failed in phase "${phase}":`, error.message);

    // Save failure state
    await this.saveIterationState();

    // Apply recovery strategy
    await this.handleFailure(error, `${phase} - Iteration ${iteration}`);

    // Update state
    this.currentState.status = 'evaluating';
    this.currentState.improvements.push(`Address failure: ${error.message}`);
  }

  /**
   * Record stage success
   */
  async recordStageSuccess(stageName: string, metrics: Record<string, number>): Promise<void> {

    // Update relevant metrics based on stage
    switch (stageName) {
      case 'transcription':
        // Fail-loud on ABSENT accuracy, mirroring buildQualityMetrics'
        // sanitizeFinite(_, 0) contract. The previous `?? 0.85` only looked safe:
        // `??` (not `||`) does preserve an EXPLICIT accuracy of 0 (a real 0% run),
        // but an ABSENT accuracy fell back to 0.85 — exactly the
        // `qualityThresholds.transcriptionAccuracy` bar — so `>= 0.85` silently
        // passed an unmeasured stage. `?? 0` puts absent below every threshold so
        // the gate fails loudly and forces iteration, exactly like buildQualityMetrics.
        this.currentState.metrics.transcriptionAccuracy = metrics.accuracy ?? 0;
        break;
      case 'analysis':
        // Same fail-loud contract: absent accuracy → 0 (below the 0.75 threshold),
        // never the 0.75 default that would satisfy `>= 0.75` for an unmeasured stage.
        this.currentState.metrics.sceneSegmentationF1 = metrics.accuracy ?? 0;
        break;
      case 'layout':
        this.currentState.metrics.layoutOverlap = 0; // Success means no overlap
        break;
    }

    this.currentState.metrics.renderTime = metrics.duration || 0;
    this.currentState.metrics.memoryUsage = metrics.memoryUsage || 0;
    this.currentState.metrics.timestamp = new Date();
  }

  /**
   * Record stage failure
   */
  async recordStageFailure(stageName: string, error: Error, duration: number): Promise<void> {
    logger.error(`Stage "${stageName}" failed:`, error.message);

    // Record failure metrics
    this.currentState.metrics.renderTime = duration;
    this.currentState.metrics.timestamp = new Date();

    // Add to improvements list
    this.currentState.improvements.push(`Fix ${stageName} stage: ${error.message}`);
  }

  /**
   * Record quality issue
   */
  async recordQualityIssue(stageName: string, issueType: string, details: string): Promise<void> {

    this.currentState.improvements.push(`Quality improvement for ${stageName}: ${details}`);
  }
}

export default RecursiveCustomInstructionsFramework;
