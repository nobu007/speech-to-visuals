/**
 * 🔄 Recursive Integration Pipeline
 *
 * Integrates the Recursive Development Framework with the existing MainPipeline
 * Following the custom instructions for iterative development and quality improvement
 */

import { MainPipeline } from './main-pipeline';
import { globalRecursiveFramework } from '../framework/recursive-development-framework';
import { qualityMonitor } from '@/quality';
import { PipelineInput, PipelineResult, PipelineConfig } from './types';

/**
 * Enhanced Pipeline with Recursive Development Integration
 */
export class RecursiveIntegrationPipeline extends MainPipeline {
  private recursiveFramework = globalRecursiveFramework;
  private iterationHistory: Map<string, any[]> = new Map();
  private qualityEvolution: number[] = [];

  constructor(config: Partial<PipelineConfig> = {}) {
    super(config);
    console.log('🔄 Initializing Recursive Integration Pipeline');
  }

  /**
   * Execute pipeline with recursive improvement framework
   */
  async executeWithRecursiveImprovement(input: PipelineInput): Promise<PipelineResult> {
    console.log('\n🚀 Starting Recursive Pipeline Execution');

    const cycleResult = await this.recursiveFramework.executeRecursiveCycle(
      // Implementation phase
      async () => {
        console.log('📋 Implementation Phase: Running main pipeline...');
        return await super.execute(input);
      },

      // Evaluation phase
      async (result: PipelineResult) => {
        console.log('🔍 Evaluation Phase: Assessing quality...');
        return await this.evaluateSystemQuality(result);
      },

      // Improvement phase
      async (result: PipelineResult) => {
        console.log('🔧 Improvement Phase: Optimizing configuration...');
        return await this.improveSystemConfiguration(result, input);
      }
    );

    if (cycleResult.success && cycleResult.result) {
      console.log(`✅ Recursive cycle completed successfully in ${cycleResult.iterations} iterations`);
      await this.recordSuccessfulCycle(cycleResult);
      return cycleResult.result;
    } else {
      console.log(`⚠️ Recursive cycle needs attention after ${cycleResult.iterations} iterations`);
      return await this.handleCycleFailure(input, cycleResult);
    }
  }

  /**
   * 品質評価フェーズ
   * Quality evaluation phase per custom instructions
   */
  private async evaluateSystemQuality(result: PipelineResult): Promise<boolean> {
    console.log('📊 Running comprehensive quality assessment...');

    const qualityAssessment = await this.recursiveFramework.assessQuality(result);

    // Log quality metrics
    console.log('Quality Scores:');
    Object.entries(qualityAssessment.scores).forEach(([metric, score]) => {
      const status = score >= 0.8 ? '✅' : score >= 0.6 ? '⚠️' : '❌';
      console.log(`  ${status} ${metric}: ${(score * 100).toFixed(1)}%`);
    });

    // Check success criteria per current phase
    const frameworkState = this.recursiveFramework.getCurrentState();
    const meetsCriteria = this.checkPhaseCriteria(frameworkState.phase, result, qualityAssessment.scores);

    if (qualityAssessment.recommendations.length > 0) {
      console.log('\n💡 Improvement Recommendations:');
      qualityAssessment.recommendations.forEach(rec => console.log(`  - ${rec}`));
    }

    // Record quality evolution
    this.qualityEvolution.push(frameworkState.qualityScore);

    return qualityAssessment.meetsThresholds && meetsCriteria;
  }

  /**
   * フェーズ別成功基準のチェック
   * Check phase-specific success criteria
   */
  private checkPhaseCriteria(phase: string, result: PipelineResult, scores: any): boolean {
    switch (phase) {
      case 'MVP構築':
        return result.success &&
               result.scenes.length > 0 &&
               result.audioUrl.length > 0;

      case '内容分析':
        return scores.sceneSegmentationPrecision >= 0.80 &&
               scores.diagramTypeDetection >= 0.70;

      case '図解生成':
        return scores.layoutGenerationSuccess >= 0.90 &&
               result.scenes.every((scene: any) => !scene.layout?.hasOverlaps);

      case '品質向上':
        return result.success &&
               result.processingTime < 60000 &&
               scores.overallSystemStability >= 0.90;

      default:
        return true;
    }
  }

  /**
   * システム設定の改善フェーズ
   * System configuration improvement phase
   */
  private async improveSystemConfiguration(result: PipelineResult, input: PipelineInput): Promise<PipelineResult> {
    console.log('🎯 Analyzing performance bottlenecks...');

    const improvements = await this.identifyImprovements(result);
    const updatedConfig = await this.applyImprovements(improvements);

    console.log('🔧 Applying configuration improvements...');

    // Create new pipeline instance with improved configuration
    const improvedPipeline = new MainPipeline(updatedConfig);

    // Re-execute with improved settings
    const improvedResult = await improvedPipeline.execute(input);

    // Compare results
    const performanceGain = this.calculatePerformanceGain(result, improvedResult);
    console.log(`📈 Performance gain: ${(performanceGain * 100).toFixed(1)}%`);

    return improvedResult;
  }

  /**
   * 改善点の特定
   * Identify improvement opportunities
   */
  private async identifyImprovements(result: PipelineResult): Promise<{
    transcription?: any;
    analysis?: any;
    layout?: any;
    output?: any;
  }> {
    const improvements: any = {};

    // Analyze stage performance
    const stages = result.stages || [];

    // Transcription improvements
    const transcriptionStage = stages.find(s => s.name === 'transcription');
    if (transcriptionStage && transcriptionStage.endTime && transcriptionStage.startTime) {
      const transcriptionTime = transcriptionStage.endTime - transcriptionStage.startTime;
      if (transcriptionTime > 15000) { // > 15 seconds
        improvements.transcription = {
          model: 'base', // Could be upgraded to 'small' for better speed/accuracy balance
          chunkSize: 'smaller' // Process in smaller chunks
        };
      }
    }

    // Analysis improvements
    const analysisStage = stages.find(s => s.name === 'analysis');
    if (analysisStage && result.scenes) {
      const lowConfidenceScenes = result.scenes.filter(
        (scene: any) => (scene.confidence || 0.8) < 0.7
      );

      if (lowConfidenceScenes.length > result.scenes.length * 0.3) {
        improvements.analysis = {
          confidenceThreshold: 0.6, // Lower threshold for more inclusive analysis
          segmentationStrategy: 'aggressive' // More detailed segmentation
        };
      }
    }

    // Layout improvements
    if (result.scenes) {
      const layoutIssues = result.scenes.filter(
        (scene: any) => scene.layout?.hasOverlaps || !scene.layout?.nodes?.length
      );

      if (layoutIssues.length > 0) {
        improvements.layout = {
          algorithmPriority: 'quality', // Prioritize quality over speed
          spacing: 'increased', // More space between elements
          iterations: 'extended' // More layout optimization iterations
        };
      }
    }

    return improvements;
  }

  /**
   * 改善設定の適用
   * Apply identified improvements to configuration
   */
  private async applyImprovements(improvements: any): Promise<Partial<PipelineConfig>> {
    const baseConfig = this.getConfig();
    const updatedConfig: Partial<PipelineConfig> = { ...baseConfig };

    if (improvements.transcription) {
      updatedConfig.transcription = {
        ...baseConfig.transcription,
        model: improvements.transcription.model || baseConfig.transcription.model
      };
    }

    if (improvements.analysis) {
      updatedConfig.analysis = {
        ...baseConfig.analysis,
        confidenceThreshold: improvements.analysis.confidenceThreshold ||
                             baseConfig.analysis.confidenceThreshold
      };
    }

    if (improvements.layout) {
      updatedConfig.layout = {
        ...baseConfig.layout,
        nodeWidth: improvements.layout.spacing === 'increased' ?
                   baseConfig.layout.nodeWidth * 1.2 : baseConfig.layout.nodeWidth,
        nodeHeight: improvements.layout.spacing === 'increased' ?
                    baseConfig.layout.nodeHeight * 1.2 : baseConfig.layout.nodeHeight
      };
    }

    return updatedConfig;
  }

  /**
   * パフォーマンス向上の計算
   * Calculate performance improvement
   */
  private calculatePerformanceGain(original: PipelineResult, improved: PipelineResult): number {
    const factors = [];

    // Processing time improvement
    if (original.processingTime && improved.processingTime) {
      const timeImprovement = (original.processingTime - improved.processingTime) / original.processingTime;
      factors.push(timeImprovement * 0.4);
    }

    // Quality improvement (scene count and success rate)
    const originalScenes = original.scenes?.length || 0;
    const improvedScenes = improved.scenes?.length || 0;
    if (originalScenes > 0) {
      const sceneImprovement = (improvedScenes - originalScenes) / originalScenes;
      factors.push(sceneImprovement * 0.3);
    }

    // Success rate improvement
    const originalSuccess = original.success ? 1 : 0;
    const improvedSuccess = improved.success ? 1 : 0;
    factors.push((improvedSuccess - originalSuccess) * 0.3);

    return factors.reduce((sum, factor) => sum + factor, 0);
  }

  /**
   * 成功サイクルの記録
   * Record successful recursive cycle
   */
  private async recordSuccessfulCycle(cycleResult: any): Promise<void> {
    const frameworkState = this.recursiveFramework.getCurrentState();
    const timestamp = new Date().toISOString();

    const cycleRecord = {
      phase: frameworkState.phase,
      iteration: frameworkState.iteration,
      qualityScore: frameworkState.qualityScore,
      iterations: cycleResult.iterations,
      timestamp,
      status: 'success'
    };

    // Store in iteration history
    const phaseHistory = this.iterationHistory.get(frameworkState.phase) || [];
    phaseHistory.push(cycleRecord);
    this.iterationHistory.set(frameworkState.phase, phaseHistory);

    console.log(`📝 Recorded successful cycle for phase: ${frameworkState.phase}`);
  }

  /**
   * サイクル失敗の処理
   * Handle cycle failure
   */
  private async handleCycleFailure(input: PipelineInput, cycleResult: any): Promise<PipelineResult> {
    console.log('🔧 Handling cycle failure with recovery strategy...');

    // Apply framework's failure recovery
    // This would implement the specific recovery strategies from custom instructions

    // Fallback to basic pipeline execution
    console.log('⚡ Executing fallback pipeline...');
    const fallbackResult = await super.execute(input);

    // Mark as partial success if basic pipeline works
    if (fallbackResult.success) {
      fallbackResult.qualityAssessment = {
        ...fallbackResult.qualityAssessment,
        recursiveFrameworkStatus: 'fallback_success',
        improvementPotential: 'high'
      };
    }

    return fallbackResult;
  }

  /**
   * 品質進化の分析
   * Analyze quality evolution over iterations
   */
  public analyzeQualityEvolution(): {
    trend: 'improving' | 'stable' | 'declining';
    averageImprovement: number;
    recommendations: string[];
  } {
    if (this.qualityEvolution.length < 2) {
      return {
        trend: 'stable',
        averageImprovement: 0,
        recommendations: ['需要更多迭代数据来分析趋势']
      };
    }

    const improvements = [];
    for (let i = 1; i < this.qualityEvolution.length; i++) {
      improvements.push(this.qualityEvolution[i] - this.qualityEvolution[i - 1]);
    }

    const averageImprovement = improvements.reduce((sum, imp) => sum + imp, 0) / improvements.length;

    let trend: 'improving' | 'stable' | 'declining';
    if (averageImprovement > 0.05) trend = 'improving';
    else if (averageImprovement > -0.05) trend = 'stable';
    else trend = 'declining';

    const recommendations = this.generateEvolutionRecommendations(trend, averageImprovement);

    return { trend, averageImprovement, recommendations };
  }

  /**
   * 進化分析に基づく推奨事項
   * Generate recommendations based on evolution analysis
   */
  private generateEvolutionRecommendations(
    trend: 'improving' | 'stable' | 'declining',
    averageImprovement: number
  ): string[] {
    const recommendations: string[] = [];

    switch (trend) {
      case 'improving':
        recommendations.push('继续当前的改进策略');
        recommendations.push('考虑增加迭代频率以加快改进速度');
        break;

      case 'stable':
        recommendations.push('探索新的优化方向');
        recommendations.push('考虑调整质量阈值或成功标准');
        break;

      case 'declining':
        recommendations.push('回滚到上一个稳定版本');
        recommendations.push('重新评估当前的改进策略');
        recommendations.push('可能需要更基础的系统重构');
        break;
    }

    return recommendations;
  }

  /**
   * 次のフェーズへの移行
   * Transition to next development phase
   */
  public async moveToNextPhase(): Promise<boolean> {
    const moved = this.recursiveFramework.moveToNextPhase();

    if (moved) {
      // Reset iteration-specific state
      this.qualityEvolution = [];

      // Log phase transition
      const currentState = this.recursiveFramework.getCurrentState();
      console.log(`\n🎯 Transitioned to phase: ${currentState.phase}`);

      return true;
    }

    return false;
  }

  /**
   * フレームワーク統合状態の取得
   * Get integrated framework status
   */
  public getIntegratedStatus(): {
    framework: any;
    pipeline: any;
    evolution: any;
    recommendations: any;
  } {
    return {
      framework: this.recursiveFramework.getCurrentState(),
      pipeline: {
        lastRunStages: this.getLastRunStages(),
        config: this.getConfig()
      },
      evolution: this.analyzeQualityEvolution(),
      recommendations: this.generateSystemRecommendations()
    };
  }

  /**
   * システム推奨事項の生成
   * Generate system-wide recommendations
   */
  private generateSystemRecommendations(): string[] {
    const frameworkState = this.recursiveFramework.getCurrentState();
    const evolution = this.analyzeQualityEvolution();

    const recommendations: string[] = [];

    // Phase-specific recommendations
    switch (frameworkState.phase) {
      case 'MVP構築':
        recommendations.push('Focus on core functionality stability');
        recommendations.push('Ensure basic audio-to-video pipeline works reliably');
        break;

      case '内容分析':
        recommendations.push('Optimize scene segmentation algorithms');
        recommendations.push('Improve diagram type detection accuracy');
        break;

      case '図解生成':
        recommendations.push('Enhance layout generation quality');
        recommendations.push('Eliminate layout overlaps and improve readability');
        break;

      case '品質向上':
        recommendations.push('Focus on overall system performance');
        recommendations.push('Optimize processing speed and memory usage');
        break;
    }

    // Evolution-based recommendations
    recommendations.push(...evolution.recommendations);

    return recommendations;
  }
}

/**
 * Export configured recursive integration pipeline
 */
export const recursiveIntegrationPipeline = new RecursiveIntegrationPipeline();