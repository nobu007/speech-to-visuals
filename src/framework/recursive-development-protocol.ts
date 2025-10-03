/**
 * 🔄 Recursive Development Protocol - Custom Instructions Implementation
 *
 * Implements the iterative improvement cycle directly in the system:
 * implement → test → evaluate → improve → commit
 */

export interface DevelopmentCycle {
  phase: string;
  maxIterations: number;
  successCriteria: string[];
  failureRecovery: string;
  commitTrigger: 'on_success' | 'on_checkpoint' | 'on_review';
}

export interface IterationMetrics {
  accuracy: number;
  performance: number;
  success_rate: number;
  processing_time: number;
  memory_usage: number;
  timestamp: Date;
}

export interface QualityThresholds {
  transcriptionAccuracy: number;
  sceneSegmentationF1: number;
  layoutOverlap: number;
  renderTime: number;
  memoryUsage: number;
}

/**
 * Development Cycles as defined in custom instructions
 */
export const DEVELOPMENT_CYCLES: DevelopmentCycle[] = [
  {
    phase: "MVP構築",
    maxIterations: 3,
    successCriteria: ["音声入力→字幕付き動画出力が動作"],
    failureRecovery: "最小構成に戻って再構築",
    commitTrigger: "on_success"
  },
  {
    phase: "内容分析",
    maxIterations: 5,
    successCriteria: ["シーン分割精度80%", "図解タイプ判定70%"],
    failureRecovery: "ルールベースにフォールバック",
    commitTrigger: "on_checkpoint"
  },
  {
    phase: "図解生成",
    maxIterations: 4,
    successCriteria: ["レイアウト破綻0", "ラベル可読性100%"],
    failureRecovery: "手動レイアウトテンプレート使用",
    commitTrigger: "on_review"
  },
  {
    phase: "品質最適化",
    maxIterations: 10,
    successCriteria: ["全体精度90%超", "処理速度5x", "成功率95%"],
    failureRecovery: "前バージョンに戻して段階的改善",
    commitTrigger: "on_checkpoint"
  }
];

export class RecursiveDevelopmentProtocol {
  private currentCycle: DevelopmentCycle;
  private iterationCount: number = 0;
  private qualityThresholds: QualityThresholds;
  private iterationHistory: IterationMetrics[] = [];

  constructor(qualityThresholds: QualityThresholds) {
    this.qualityThresholds = qualityThresholds;
    this.currentCycle = DEVELOPMENT_CYCLES[0]; // Start with MVP
  }

  /**
   * Execute development cycle: implement → test → evaluate → iterate
   */
  async executeCycle<T>(
    implementFn: () => Promise<T>,
    testFn: (result: T) => Promise<boolean>,
    evaluateFn: (result: T) => Promise<IterationMetrics>,
    improveFn: (result: T, metrics: IterationMetrics) => Promise<T>
  ): Promise<{ result: T; metrics: IterationMetrics; shouldCommit: boolean }> {

    console.log(`\n🔄 Starting ${this.currentCycle.phase} - Iteration ${this.iterationCount + 1}`);

    let result = await implementFn();
    let metrics: IterationMetrics;

    // Test → Evaluate → Improve loop
    for (let i = 0; i < this.currentCycle.maxIterations; i++) {
      this.iterationCount = i + 1;

      console.log(`   🧪 Testing iteration ${this.iterationCount}...`);
      const testPassed = await testFn(result);

      console.log(`   📊 Evaluating iteration ${this.iterationCount}...`);
      metrics = await evaluateFn(result);

      // Record metrics
      this.iterationHistory.push(metrics);

      console.log(`   📈 Metrics: accuracy=${metrics.accuracy.toFixed(1)}%, performance=${metrics.performance.toFixed(1)}x`);

      // Check success criteria
      const success = this.checkSuccessCriteria(metrics);

      if (success && testPassed) {
        console.log(`   ✅ Success criteria met at iteration ${this.iterationCount}`);
        return {
          result,
          metrics,
          shouldCommit: this.shouldCommit(metrics)
        };
      }

      if (i < this.currentCycle.maxIterations - 1) {
        console.log(`   🔧 Improving for iteration ${this.iterationCount + 1}...`);
        result = await improveFn(result, metrics);
      }
    }

    // Max iterations reached - apply failure recovery
    console.log(`   ⚠️  Max iterations reached. Applying failure recovery: ${this.currentCycle.failureRecovery}`);

    return {
      result,
      metrics: metrics!,
      shouldCommit: false
    };
  }

  /**
   * Check if current metrics meet success criteria
   */
  private checkSuccessCriteria(metrics: IterationMetrics): boolean {
    const checks = [
      metrics.accuracy >= this.qualityThresholds.transcriptionAccuracy * 100,
      metrics.success_rate >= 0.9,
      metrics.processing_time <= this.qualityThresholds.renderTime,
      metrics.memory_usage <= this.qualityThresholds.memoryUsage
    ];

    return checks.every(check => check);
  }

  /**
   * Determine if current state should trigger a commit
   */
  private shouldCommit(metrics: IterationMetrics): boolean {
    const trigger = this.currentCycle.commitTrigger;

    switch (trigger) {
      case 'on_success':
        return this.checkSuccessCriteria(metrics);
      case 'on_checkpoint':
        return this.iterationCount % 3 === 0 || this.checkSuccessCriteria(metrics);
      case 'on_review':
        return this.iterationCount === this.currentCycle.maxIterations;
      default:
        return false;
    }
  }

  /**
   * Advance to next development phase
   */
  advancePhase(): boolean {
    const currentIndex = DEVELOPMENT_CYCLES.findIndex(cycle => cycle.phase === this.currentCycle.phase);

    if (currentIndex < DEVELOPMENT_CYCLES.length - 1) {
      this.currentCycle = DEVELOPMENT_CYCLES[currentIndex + 1];
      this.iterationCount = 0;
      console.log(`\n🚀 Advanced to phase: ${this.currentCycle.phase}`);
      return true;
    }

    console.log(`\n🏆 All development phases completed!`);
    return false;
  }

  /**
   * Get current development status
   */
  getStatus() {
    return {
      currentPhase: this.currentCycle.phase,
      iteration: this.iterationCount,
      maxIterations: this.currentCycle.maxIterations,
      successCriteria: this.currentCycle.successCriteria,
      history: this.iterationHistory
    };
  }

  /**
   * Generate improvement suggestions based on metrics
   */
  generateImprovementSuggestions(metrics: IterationMetrics): string[] {
    const suggestions: string[] = [];

    if (metrics.accuracy < this.qualityThresholds.transcriptionAccuracy * 100) {
      suggestions.push("音声前処理の改善: ノイズ除去、正規化");
      suggestions.push("Whisperモデルの変更: base → large");
    }

    if (metrics.performance < 3.0) {
      suggestions.push("並列処理の最適化");
      suggestions.push("キャッシュ機構の実装");
    }

    if (metrics.processing_time > this.qualityThresholds.renderTime) {
      suggestions.push("アルゴリズムの最適化");
      suggestions.push("不要な処理の削除");
    }

    if (metrics.memory_usage > this.qualityThresholds.memoryUsage) {
      suggestions.push("メモリ効率の改善");
      suggestions.push("ガベージコレクションの最適化");
    }

    return suggestions;
  }

  /**
   * Create iteration report for .module/ITERATION_LOG.md
   */
  createIterationReport(): string {
    const latestMetrics = this.iterationHistory[this.iterationHistory.length - 1];
    const improvements = this.generateImprovementSuggestions(latestMetrics);

    return `
## ${this.currentCycle.phase} - Iteration ${this.iterationCount} (${latestMetrics.timestamp.toISOString()})
- **実装**: ${this.currentCycle.phase}の改善実装
- **結果**: 精度 ${latestMetrics.accuracy.toFixed(1)}%, 成功率 ${(latestMetrics.success_rate * 100).toFixed(1)}%
- **パフォーマンス**: ${latestMetrics.performance.toFixed(1)}x realtime
- **問題**: ${improvements.length > 0 ? improvements[0] : 'なし'}
- **次回**: ${improvements.length > 1 ? improvements[1] : '次フェーズへ'}
`;
  }
}

/**
 * Global instance for use across the application
 */
export const globalRecursiveDevelopment = new RecursiveDevelopmentProtocol({
  transcriptionAccuracy: 0.85,
  sceneSegmentationF1: 0.75,
  layoutOverlap: 0,
  renderTime: 30000,
  memoryUsage: 512 * 1024 * 1024
});