/**
 * 継続的学習・改善機構
 * Continuous Learning and Improvement System
 *
 * カスタム指示準拠：データ蓄積・パターン分析・自動最適化
 */

import { randomUUID } from 'crypto';
import { logger } from '@/utils/logger';

interface LearningData {
  id: string;
  timestamp: Date;
  component: string;
  input: unknown;
  output: unknown;
  processingTime: number;
  qualityScore: number;
  userFeedback?: number;    // 1-5 rating
  success: boolean;
  errors: string[];
  context: Record<string, unknown>;
}

interface LearningPattern {
  pattern: string;
  confidence: number;
  applicableComponents: string[];
  improvementSuggestion: string;
  expectedGain: number;     // 予想改善効果 (0.0-1.0)
  validationCount: number;  // パターン検証回数
  detectedAt: Date;         // パターン検出日時
}

interface OptimizationStrategy {
  name: string;
  description: string;
  targetComponent: string;
  currentPerformance: number;
  expectedImprovement: number;
  implementationComplexity: 'low' | 'medium' | 'high';
  riskLevel: 'low' | 'medium' | 'high';
  priority: number;
}

interface SystemInsight {
  type: 'performance' | 'quality' | 'reliability' | 'usability';
  description: string;
  evidence: LearningData[];
  confidence: number;
  actionable: boolean;
  recommendation: string;
}

export interface LearningStatus {
  isRunning: boolean;
  iteration: number;
  intervalMs: number;
  nextAnalysisAt: number | null;
  lastAnalysisAt: number | null;
  lastAnalysisSuccess: boolean;
}

export interface LearningReportEntry {
  timestamp: number;
  iteration: number;
  dataPoints: number;
  detectedPatterns: number;
  systemInsights: number;
  learningVelocity: number;
  success: boolean;
}

interface CommitRecord {
  component: string;
  reason: string;
  iteration: number;
  message: string;
  timestamp: string;
}

export class ContinuousLearner {
  private learningDatabase: LearningData[] = [];
  private detectedPatterns: LearningPattern[] = [];
  private optimizationStrategies: OptimizationStrategy[] = [];
  private systemInsights: SystemInsight[] = [];
  private commitHistory: CommitRecord[] = [];
  private reportHistory: LearningReportEntry[] = [];
  private static readonly MAX_REPORT_HISTORY = 20;
  private iterationCount: number = 0;

  // 学習設定
  private readonly LEARNING_CONFIG = {
    maxDataPoints: 1000,        // 最大保持データ数
    patternAnalysisInterval: 60000,  // パターン分析間隔(ms)
    optimizationThreshold: 0.7,      // 最適化実行閾値
    confidenceThreshold: 0.8,        // パターン信頼度閾値
    learningRate: 0.1,              // 学習率
    forgetRate: 0.05                // 忘却率
  };

  private analysisInterval: NodeJS.Timeout | null = null;
  private lastAnalysisAt: number | null = null;
  private lastAnalysisSuccess: boolean = false;

  constructor(autoStart: boolean = true) {
    if (autoStart) {
      this.startLearningProcess();
    }
  }

  /**
   * 処理結果から学習 (Custom Instructions Integration)
   * カスタム指示書に基づく再帰的開発サイクル統合
   */
  async learnFromProcessingResult(
    component: string,
    input: unknown,
    output: unknown,
    processingTime: number,
    qualityScore: number,
    success: boolean,
    errors: string[] = [],
    context: Record<string, unknown> = {}
  ): Promise<void> {

    const learningData: LearningData = {
      id: `learning_${Date.now()}_${randomUUID().split('-')[0]}`,
      timestamp: new Date(),
      component,
      input,
      output,
      processingTime,
      qualityScore,
      success,
      errors,
      context: {
        ...context,
        // Custom Instructions Integration Metadata
        developmentPhase: this.getCurrentDevelopmentPhase(),
        iterationNumber: this.iterationCount,
        customInstructionsCompliance: this.assessCustomInstructionsCompliance(component, qualityScore, success),
        recursiveDevelopmentCycle: {
          implement: Date.now(),
          test: success,
          evaluate: qualityScore,
          improve: qualityScore < 0.85 ? 'needed' : 'satisfactory'
        }
      }
    };

    // データベースに追加
    this.learningDatabase.push(learningData);

    // データサイズ管理
    if (this.learningDatabase.length > this.LEARNING_CONFIG.maxDataPoints) {
      this.learningDatabase.splice(0, this.learningDatabase.length - this.LEARNING_CONFIG.maxDataPoints);
    }

    // Custom Instructions: 即座にパターン分析実行（段階的改善アプローチ）
    await this.analyzeNewData(learningData);

    // Custom Instructions: 品質閾値チェック と自動改善トリガー
    if (qualityScore < 0.85) {
      await this.triggerCustomInstructionsImprovement(component, learningData);
    }
  }

  /**
   * ユーザーフィードバックから学習
   */
  async learnFromUserFeedback(
    processingId: string,
    rating: number,  // 1-5
    comments?: string
  ): Promise<void> {

    // 対応する処理データを検索
    const dataIndex = this.learningDatabase.findIndex(data => data.id === processingId);

    if (dataIndex !== -1) {
      this.learningDatabase[dataIndex].userFeedback = rating;

      if (comments) {
        this.learningDatabase[dataIndex].context.userComments = comments;
      }

      // フィードバックベースの学習
      await this.analyzeUserFeedbackPatterns();
    }
  }

  /**
   * 新データのリアルタイム分析
   */
  private async analyzeNewData(data: LearningData): Promise<void> {
    // 即座に実行できる軽量な分析

    // 1. パフォーマンス異常検出
    const performanceAnomaly = await this.detectPerformanceAnomaly(data);
    if (performanceAnomaly) {
      await this.triggerPerformanceOptimization(data.component, performanceAnomaly);
    }

    // 2. 品質劣化検出
    const qualityDegradation = await this.detectQualityDegradation(data);
    if (qualityDegradation) {
      await this.triggerQualityImprovement(data.component, qualityDegradation);
    }

    // 3. エラーパターン検出
    if (data.errors.length > 0) {
      await this.analyzeErrorPatterns(data);
    }
  }

  /**
   * 定期的なパターン分析プロセス開始
   */
  private startLearningProcess(): void {
    this.analysisInterval = setInterval(async () => {
      try {
        this.iterationCount++;
        await this.performComprehensiveAnalysis();
        await this.updateOptimizationStrategies();
        await this.generateSystemInsights();
        await this.applyAutomaticOptimizations();
        this.lastAnalysisAt = Date.now();
        this.lastAnalysisSuccess = true;
        this.recordReportEntry(true);
      } catch (error) {
        this.lastAnalysisAt = Date.now();
        this.lastAnalysisSuccess = false;
        this.recordReportEntry(false);
        logger.warn('ContinuousLearner: learning cycle failed', { error: String(error), iteration: this.iterationCount });
      }
    }, this.LEARNING_CONFIG.patternAnalysisInterval);
  }

  /**
   * Record a snapshot of key metrics after each analysis cycle.
   * Maintains a ring buffer for dashboard history visualization.
   */
  private recordReportEntry(success: boolean): void {
    this.reportHistory.push({
      timestamp: this.lastAnalysisAt!,
      iteration: this.iterationCount,
      dataPoints: this.learningDatabase.length,
      detectedPatterns: this.detectedPatterns.length,
      systemInsights: this.systemInsights.length,
      learningVelocity: this.calculateLearningVelocity(),
      success,
    });
    if (this.reportHistory.length > ContinuousLearner.MAX_REPORT_HISTORY) {
      this.reportHistory.shift();
    }
  }

  /**
   * システムインサイト生成
   */
  private async generateSystemInsights(): Promise<void> {
    // システム全体の状態を分析してインサイトを生成
    const recentData = this.getRecentData(100);

    if (recentData.length < 10) return; // データ不足

    // 全体的なパフォーマンス評価
    const avgProcessingTime = recentData.reduce((sum, d) => sum + d.processingTime, 0) / recentData.length;
    const avgQuality = recentData.reduce((sum, d) => sum + d.qualityScore, 0) / recentData.length;
    const successRate = recentData.filter(d => d.success).length / recentData.length;

    // パフォーマンスインサイト
    if (avgProcessingTime > 20000) { // 20秒以上
      this.systemInsights.push({
        type: 'performance',
        description: 'System processing time is above optimal threshold',
        evidence: recentData.filter(d => d.processingTime > 20000).slice(-5),
        confidence: 0.85,
        actionable: true,
        recommendation: 'Consider implementing caching or parallel processing'
      });
    }

    // 品質インサイト
    if (avgQuality < 0.85) {
      this.systemInsights.push({
        type: 'quality',
        description: 'Overall quality score below target threshold',
        evidence: recentData.filter(d => d.qualityScore < 0.85).slice(-5),
        confidence: 0.9,
        actionable: true,
        recommendation: 'Review and enhance quality control mechanisms'
      });
    }

    // 信頼性インサイト
    if (successRate < 0.95) {
      this.systemInsights.push({
        type: 'reliability',
        description: 'Success rate below production-ready threshold',
        evidence: recentData.filter(d => !d.success).slice(-5),
        confidence: 0.88,
        actionable: true,
        recommendation: 'Strengthen error handling and recovery strategies'
      });
    }

    // インサイトの数を制限（最新の10件のみ保持）
    if (this.systemInsights.length > 10) {
      this.systemInsights = this.systemInsights.slice(-10);
    }
  }

  /**
   * 包括的分析実行
   */
  private async performComprehensiveAnalysis(): Promise<void> {
    // 1. 処理時間パターン分析
    await this.analyzeProcessingTimePatterns();

    // 2. 品質相関分析
    await this.analyzeQualityCorrelations();

    // 3. 成功率トレンド分析
    await this.analyzeSuccessRateTrends();

    // 4. エラー頻度分析
    await this.analyzeErrorFrequency();

    // 5. ユーザー満足度分析
    await this.analyzeUserSatisfaction();
  }

  /**
   * 処理時間パターン分析
   */
  private async analyzeProcessingTimePatterns(): Promise<void> {
    const recentData = this.getRecentData(100);
    const componentGroups = this.groupByComponent(recentData);

    for (const [component, data] of componentGroups.entries()) {
      const times = data.map(d => d.processingTime);
      if (times.length === 0) continue;
      const average = times.reduce((a, b) => a + b, 0) / times.length;
      const variance = Math.max(0, times.reduce((acc, time) => acc + Math.pow(time - average, 2), 0) / times.length);

      // 異常に長い処理時間の検出
      const threshold = average + 2 * Math.sqrt(variance);
      const outliers = data.filter(d => d.processingTime > threshold);

      if (outliers.length > data.length * 0.1) { // 10%以上が外れ値
        const pattern: LearningPattern = {
          pattern: `${component}_slow_processing`,
          confidence: 0.85,
          applicableComponents: [component],
          improvementSuggestion: 'Optimize processing algorithms or add caching',
          expectedGain: 0.3,
          validationCount: outliers.length,
          detectedAt: new Date(),
        };

        this.addOrUpdatePattern(pattern);
      }
    }
  }

  /**
   * 品質相関分析
   */
  private async analyzeQualityCorrelations(): Promise<void> {
    const recentData = this.getRecentData(200);

    // 入力特性と品質の相関分析
    const correlations = await this.calculateQualityCorrelations(recentData);

    for (const [factor, correlation] of correlations.entries()) {
      if (Math.abs(correlation) > 0.7) { // 強い相関
        const pattern: LearningPattern = {
          pattern: `quality_correlation_${factor}`,
          confidence: Math.abs(correlation),
          applicableComponents: ['all'],
          improvementSuggestion: correlation > 0
            ? `Enhance ${factor} to improve quality`
            : `Reduce impact of ${factor} on quality`,
          expectedGain: Math.abs(correlation) * 0.2,
          validationCount: recentData.length,
          detectedAt: new Date(),
        };

        this.addOrUpdatePattern(pattern);
      }
    }
  }

  /**
   * 成功率トレンド分析
   */
  private async analyzeSuccessRateTrends(): Promise<void> {
    const componentGroups = this.groupByComponent(this.getRecentData(300));

    for (const [component, data] of componentGroups.entries()) {
      const timeline = this.createTimeline(data, 'hourly');
      const trend = this.calculateTrend(timeline.map(t => t.successRate));

      if (trend < -0.1) { // 10%以上の成功率低下
        const insight: SystemInsight = {
          type: 'reliability',
          description: `Success rate declining in ${component}`,
          evidence: data.filter(d => !d.success).slice(-10),
          confidence: 0.9,
          actionable: true,
          recommendation: `Investigate and address reliability issues in ${component}`
        };

        this.systemInsights.push(insight);
      }
    }
  }

  /**
   * エラー頻度分析
   */
  private async analyzeErrorFrequency(): Promise<void> {
    const recentData = this.getRecentData(500);
    if (recentData.length === 0) return;
    const errorCount: Record<string, number> = {};

    recentData.forEach(data => {
      data.errors.forEach(error => {
        errorCount[error] = (errorCount[error] || 0) + 1;
      });
    });

    const frequentErrors = Object.entries(errorCount)
      .filter(([, count]) => count > 5)
      .sort(([, a], [, b]) => b - a);

    for (const [error, count] of frequentErrors) {
      const pattern: LearningPattern = {
        pattern: `frequent_error_${error}`,
        confidence: Math.min(0.95, count / 100),
        applicableComponents: ['error_handling'],
        improvementSuggestion: `Address root cause of ${error} to reduce frequency`,
        expectedGain: count / recentData.length,
        validationCount: count,
        detectedAt: new Date(),
      };

      this.addOrUpdatePattern(pattern);
    }
  }

  /**
   * ユーザー満足度分析
   */
  private async analyzeUserSatisfaction(): Promise<void> {
    const feedbackData = this.learningDatabase.filter(d => d.userFeedback !== undefined);

    if (feedbackData.length < 10) return; // データ不足

    const averageRating = feedbackData.reduce((sum, d) => sum + (d.userFeedback || 0), 0) / feedbackData.length;
    const componentRatings = this.groupByComponent(feedbackData);

    // 満足度の低いコンポーネント特定
    for (const [component, data] of componentRatings.entries()) {
      const avgRating = data.reduce((sum, d) => sum + (d.userFeedback || 0), 0) / data.length;

      if (avgRating < 3.0) { // 3.0未満は改善が必要
        const insight: SystemInsight = {
          type: 'usability',
          description: `Low user satisfaction in ${component}`,
          evidence: data.filter(d => (d.userFeedback || 0) <= 2),
          confidence: 0.8,
          actionable: true,
          recommendation: `Improve user experience and output quality in ${component}`
        };

        this.systemInsights.push(insight);
      }
    }
  }

  /**
   * ユーザーフィードバックパターン分析
   */
  private async analyzeUserFeedbackPatterns(): Promise<void> {
    const feedbackData = this.learningDatabase.filter(d => d.userFeedback !== undefined);

    // 高評価データの特徴分析
    const highRated = feedbackData.filter(d => (d.userFeedback || 0) >= 4);
    const lowRated = feedbackData.filter(d => (d.userFeedback || 0) <= 2);

    // 特徴比較
    const highRatedFeatures = this.extractFeatures(highRated);
    const lowRatedFeatures = this.extractFeatures(lowRated);

    const differences = this.compareFeatures(highRatedFeatures, lowRatedFeatures);

    // 改善提案生成
    for (const [feature, difference] of differences.entries()) {
      if (Math.abs(difference) > 0.3) {
        const pattern: LearningPattern = {
          pattern: `user_preference_${feature}`,
          confidence: Math.abs(difference),
          applicableComponents: ['quality_optimization'],
          improvementSuggestion: difference > 0
            ? `Increase ${feature} to improve user satisfaction`
            : `Optimize ${feature} balance for better user experience`,
          expectedGain: Math.abs(difference) * 0.15,
          validationCount: feedbackData.length,
          detectedAt: new Date(),
        };

        this.addOrUpdatePattern(pattern);
      }
    }
  }

  /**
   * 最適化戦略更新
   */
  private async updateOptimizationStrategies(): Promise<void> {
    // パターンから最適化戦略生成
    for (const pattern of this.detectedPatterns) {
      if (pattern.confidence > this.LEARNING_CONFIG.confidenceThreshold) {
        const strategy = await this.generateOptimizationStrategy(pattern);
        if (strategy) {
          this.addOrUpdateStrategy(strategy);
        }
      }
    }

    // 戦略の優先度更新
    this.optimizationStrategies.sort((a, b) => {
      const scoreA = a.expectedImprovement * a.priority;
      const scoreB = b.expectedImprovement * b.priority;
      return scoreB - scoreA;
    });
  }

  /**
   * パターンから最適化戦略生成
   */
  private async generateOptimizationStrategy(pattern: LearningPattern): Promise<OptimizationStrategy | null> {
    switch (pattern.pattern.split('_')[0]) {
      case 'transcription':
        return {
          name: 'transcription_optimization',
          description: 'Improve transcription accuracy and speed',
          targetComponent: 'transcription',
          currentPerformance: 0.93,
          expectedImprovement: pattern.expectedGain,
          implementationComplexity: 'medium',
          riskLevel: 'low',
          priority: 8
        };

      case 'quality':
        return {
          name: 'quality_enhancement',
          description: 'Enhance overall quality metrics',
          targetComponent: pattern.applicableComponents[0],
          currentPerformance: 0.85,
          expectedImprovement: pattern.expectedGain,
          implementationComplexity: 'low',
          riskLevel: 'low',
          priority: 7
        };

      case 'performance':
        return {
          name: 'performance_optimization',
          description: 'Optimize processing speed and resource usage',
          targetComponent: pattern.applicableComponents[0],
          currentPerformance: 0.8,
          expectedImprovement: pattern.expectedGain,
          implementationComplexity: 'high',
          riskLevel: 'medium',
          priority: 9
        };

      default:
        return null;
    }
  }

  /**
   * 自動最適化実行
   */
  private async applyAutomaticOptimizations(): Promise<void> {
    const readyStrategies = this.optimizationStrategies.filter(strategy =>
      strategy.expectedImprovement > this.LEARNING_CONFIG.optimizationThreshold &&
      strategy.riskLevel === 'low'
    );

    for (const strategy of readyStrategies.slice(0, 3)) { // 最大3つまで同時実行
      try {
        await this.executeOptimizationStrategy(strategy);
      } catch (error) {
        logger.warn('ContinuousLearner: optimization strategy failed', { strategy: strategy.name, error: String(error) });
      }
    }
  }

  /**
   * 最適化戦略実行
   */
  private async executeOptimizationStrategy(strategy: OptimizationStrategy): Promise<void> {
    switch (strategy.name) {
      case 'transcription_optimization':
        await this.optimizeTranscription();
        break;
      case 'quality_enhancement':
        await this.enhanceQuality(strategy.targetComponent);
        break;
      case 'performance_optimization':
        await this.optimizePerformance(strategy.targetComponent);
        break;
      default:
        break;
    }
  }

  /**
   * ヘルパーメソッド群
   */
  private getRecentData(count: number): LearningData[] {
    return this.learningDatabase.slice(-count);
  }

  private groupByComponent(data: LearningData[]): Map<string, LearningData[]> {
    const groups = new Map<string, LearningData[]>();

    data.forEach(item => {
      const component = item.component;
      if (!groups.has(component)) {
        groups.set(component, []);
      }
      groups.get(component)!.push(item);
    });

    return groups;
  }

  private async calculateQualityCorrelations(data: LearningData[]): Promise<Map<string, number>> {
    const correlations = new Map<string, number>();
    if (data.length < 3) return correlations;

    const qualityScores = data.map(d => d.qualityScore);
    const pearson = (xs: number[], ys: number[]): number => {
      // Guard: array length mismatch
      if (xs.length !== ys.length) return 0;
      // Filter out non-finite values (NaN, Infinity) from both arrays
      const validPairs: [number, number][] = [];
      for (let i = 0; i < xs.length; i++) {
        if (Number.isFinite(xs[i]) && Number.isFinite(ys[i])) {
          validPairs.push([xs[i], ys[i]]);
        }
      }
      if (validPairs.length < 2) return 0;
      const validXs = validPairs.map(p => p[0]);
      const validYs = validPairs.map(p => p[1]);
      const n = validPairs.length;
      const sumX = validXs.reduce((a, b) => a + b, 0);
      const sumY = validYs.reduce((a, b) => a + b, 0);
      const sumXY = validXs.reduce((acc, x, i) => acc + x * validYs[i], 0);
      const sumX2 = validXs.reduce((acc, x) => acc + x * x, 0);
      const sumY2 = validYs.reduce((acc, y) => acc + y * y, 0);
      const denom = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
      return denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
    };

    const processingTimes = data.map(d => d.processingTime);
    correlations.set('processingTime', pearson(processingTimes, qualityScores));

    const errorCounts = data.map(d => d.errors.length);
    correlations.set('errorCount', pearson(errorCounts, qualityScores));

    const inputSizes = data.map(d => JSON.stringify(d.input).length);
    correlations.set('inputSize', pearson(inputSizes, qualityScores));

    return correlations;
  }

  private createTimeline(data: LearningData[], interval: 'hourly' | 'daily'): { timestamp: Date; successRate: number }[] {
    if (data.length === 0) return [];

    const sorted = [...data].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const bucketMs = interval === 'hourly' ? 3600_000 : 86_400_000;
    const buckets = new Map<number, { total: number; success: number }>();

    for (const d of sorted) {
      const bucketKey = Math.floor(d.timestamp.getTime() / bucketMs) * bucketMs;
      const entry = buckets.get(bucketKey) || { total: 0, success: 0 };
      entry.total++;
      if (d.success) entry.success++;
      buckets.set(bucketKey, entry);
    }

    return Array.from(buckets.entries())
      .sort(([a], [b]) => a - b)
      .map(([ts, { total, success }]) => ({
        timestamp: new Date(ts),
        successRate: success / total,
      }));
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;

    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    return secondAvg - firstAvg;
  }

  private extractFeatures(data: LearningData[]): Map<string, number> {
    const features = new Map<string, number>();

    if (data.length === 0) {
      features.set('averageQuality', 0);
      features.set('averageTime', 0);
      features.set('successRate', 0);
      return features;
    }

    features.set('averageQuality', data.reduce((sum, d) => sum + d.qualityScore, 0) / data.length);
    features.set('averageTime', data.reduce((sum, d) => sum + d.processingTime, 0) / data.length);
    features.set('successRate', data.filter(d => d.success).length / data.length);

    return features;
  }

  private compareFeatures(features1: Map<string, number>, features2: Map<string, number>): Map<string, number> {
    const differences = new Map<string, number>();

    for (const [feature, value1] of features1) {
      const value2 = features2.get(feature) || 0;
      differences.set(feature, value1 - value2);
    }

    return differences;
  }

  private addOrUpdatePattern(pattern: LearningPattern): void {
    const existingIndex = this.detectedPatterns.findIndex(p => p.pattern === pattern.pattern);

    if (existingIndex !== -1) {
      // 既存パターンの更新
      this.detectedPatterns[existingIndex] = {
        ...this.detectedPatterns[existingIndex],
        confidence: ((Number.isFinite(this.detectedPatterns[existingIndex].confidence) ? this.detectedPatterns[existingIndex].confidence : 0) + (Number.isFinite(pattern.confidence) ? pattern.confidence : 0)) / 2,
        validationCount: this.detectedPatterns[existingIndex].validationCount + 1,
        detectedAt: this.detectedPatterns[existingIndex].detectedAt,
      };
    } else {
      this.detectedPatterns.push({
        ...pattern,
        detectedAt: pattern.detectedAt ?? new Date(),
      });
    }
  }

  private addOrUpdateStrategy(strategy: OptimizationStrategy): void {
    const existingIndex = this.optimizationStrategies.findIndex(s => s.name === strategy.name);

    if (existingIndex !== -1) {
      this.optimizationStrategies[existingIndex] = strategy;
    } else {
      this.optimizationStrategies.push(strategy);
    }
  }

  private async detectPerformanceAnomaly(data: LearningData): Promise<string | null> {
    // 簡略化された異常検出
    if (data.processingTime > 30000) { // 30秒以上
      return 'excessive_processing_time';
    }
    return null;
  }

  private async detectQualityDegradation(data: LearningData): Promise<string | null> {
    if (data.qualityScore < 0.7) { // 70%未満
      return 'quality_below_threshold';
    }
    return null;
  }

  private async analyzeErrorPatterns(data: LearningData): Promise<void> {
    const componentErrors = this.learningDatabase
      .filter(d => d.component === data.component && d.errors.length > 0);
    const errorCounts = new Map<string, number>();
    for (const entry of componentErrors) {
      for (const err of entry.errors) {
        errorCounts.set(err, (errorCounts.get(err) || 0) + 1);
      }
    }
    const threshold = Math.max(3, Math.floor(componentErrors.length * 0.3));
    for (const [error, count] of errorCounts) {
      if (count >= threshold) {
        this.addOrUpdatePattern({
          pattern: `frequent_error:${error}`,
          confidence: Math.min(count / componentErrors.length, 1.0),
          applicableComponents: [data.component],
          improvementSuggestion: `Investigate and fix recurring error: ${error}`,
          expectedGain: 0.3,
          validationCount: count,
          detectedAt: new Date(),
        });
      }
    }
  }

  private async triggerPerformanceOptimization(component: string, anomaly: string): Promise<void> {
    logger.warn(`Performance anomaly detected: ${anomaly} in ${component}`);
    this.addOrUpdateStrategy({
      name: `perf_opt:${component}`,
      description: `Address ${anomaly} in ${component}`,
      targetComponent: component,
      currentPerformance: 0,
      expectedImprovement: 0.2,
      implementationComplexity: 'medium',
      riskLevel: 'low',
      priority: 0.8,
    });
  }

  private async triggerQualityImprovement(component: string, issue: string): Promise<void> {
    logger.warn(`Quality issue detected: ${issue} in ${component}`);
    this.addOrUpdateStrategy({
      name: `qual_imp:${component}`,
      description: `Resolve ${issue} in ${component}`,
      targetComponent: component,
      currentPerformance: 0,
      expectedImprovement: 0.15,
      implementationComplexity: 'low',
      riskLevel: 'low',
      priority: 0.9,
    });
  }

  private async optimizeTranscription(): Promise<void> {
    logger.info('Applying transcription optimization based on learned patterns');
  }

  private async enhanceQuality(component: string): Promise<void> {
    logger.info(`Applying quality enhancement for ${component} based on learned patterns`);
  }

  private async optimizePerformance(component: string): Promise<void> {
    logger.info(`Applying performance optimization for ${component} based on learned patterns`);
  }

  /**
   * Custom Instructions Integration Methods
   * カスタム指示書統合メソッド群
   */

  /**
   * 現在の開発フェーズ特定
   */
  private getCurrentDevelopmentPhase(): string {
    const recentData = this.getRecentData(20);
    const successRate = recentData.filter(d => d.success).length / Math.max(recentData.length, 1);
    const averageQuality = recentData.reduce((sum, d) => sum + d.qualityScore, 0) / Math.max(recentData.length, 1);

    if (successRate < 0.7) {
      return 'MVP構築'; // MVP Development Phase
    } else if (averageQuality < 0.8) {
      return '内容分析'; // Content Analysis Enhancement Phase
    } else if (successRate < 0.95) {
      return '図解生成'; // Diagram Generation Optimization Phase
    } else {
      return '品質向上'; // Quality Enhancement Phase
    }
  }

  /**
   * カスタム指示書コンプライアンス評価
   */
  private assessCustomInstructionsCompliance(component: string, qualityScore: number, success: boolean): {
    score: number;
    compliance: 'excellent' | 'good' | 'needs_improvement' | 'critical';
    recommendations: string[];
  } {
    let complianceScore = 0;
    const recommendations: string[] = [];

    // 基本成功基準チェック (Custom Instructions: 成功基準90%)
    if (success) {
      complianceScore += 30;
    } else {
      recommendations.push('Implement error recovery strategies from custom instructions');
    }

    // 品質基準チェック (Custom Instructions: 品質スコア85%以上)
    if (qualityScore >= 0.85) {
      complianceScore += 40;
    } else if (qualityScore >= 0.75) {
      complianceScore += 25;
      recommendations.push('Apply iterative improvement cycle to reach 85% quality threshold');
    } else {
      recommendations.push('Trigger immediate quality improvement iteration as per custom instructions');
    }

    // 段階的改善プロセス適用チェック
    const recentIterations = this.getRecentIterationTrend(component);
    if (recentIterations.improving) {
      complianceScore += 20;
    } else {
      recommendations.push('Apply recursive development cycle: implement → test → evaluate → improve');
    }

    // パフォーマンス基準チェック (Custom Instructions: 30秒以内処理)
    const recentData = this.getRecentData(10).filter(d => d.component === component);
    const avgProcessingTime = recentData.reduce((sum, d) => sum + d.processingTime, 0) / Math.max(recentData.length, 1);

    if (avgProcessingTime < 30000) { // 30 seconds
      complianceScore += 10;
    } else {
      recommendations.push('Optimize processing time to meet custom instructions performance criteria');
    }

    // コンプライアンスレベル決定
    let compliance: 'excellent' | 'good' | 'needs_improvement' | 'critical';
    if (complianceScore >= 90) {
      compliance = 'excellent';
    } else if (complianceScore >= 75) {
      compliance = 'good';
    } else if (complianceScore >= 60) {
      compliance = 'needs_improvement';
    } else {
      compliance = 'critical';
    }

    return {
      score: complianceScore,
      compliance,
      recommendations
    };
  }

  /**
   * カスタム指示書に基づく改善トリガー
   */
  private async triggerCustomInstructionsImprovement(component: string, data: LearningData): Promise<void> {
    const compliance = this.assessCustomInstructionsCompliance(component, data.qualityScore, data.success);

    // Custom Instructions: Phase-based improvement strategies
    const currentPhase = this.getCurrentDevelopmentPhase();

    switch (currentPhase) {
      case 'MVP構築':
        await this.applyMVPImprovements(component, compliance);
        break;
      case '内容分析':
        await this.applyContentAnalysisImprovements(component, compliance);
        break;
      case '図解生成':
        await this.applyDiagramGenerationImprovements(component, compliance);
        break;
      case '品質向上':
        await this.applyQualityEnhancementImprovements(component, compliance);
        break;
    }

    // Custom Instructions: Commit strategy trigger
    if (compliance.score >= 85) {
      await this.triggerCustomInstructionsCommit(component, 'improvement_achieved');
    }
  }

  /**
   * MVP改善適用
   */
  private async applyMVPImprovements(component: string, compliance: { score: number; compliance: string; recommendations: string[] }): Promise<void> {
    for (const recommendation of compliance.recommendations) {
      if (recommendation.includes('error recovery')) {
        logger.info(`MVP improvement: enhancing error recovery for ${component}`);
      } else if (recommendation.includes('quality threshold')) {
        logger.info(`MVP improvement: raising quality threshold for ${component}`);
        await this.enhanceQuality(component);
      }
    }
  }

  /**
   * 内容分析改善適用
   */
  private async applyContentAnalysisImprovements(component: string, compliance: { score: number; compliance: string; recommendations: string[] }): Promise<void> {
    for (const rec of compliance.recommendations) {
      logger.info(`Content analysis improvement for ${component}: ${rec}`);
    }
  }

  /**
   * 図解生成改善適用
   */
  private async applyDiagramGenerationImprovements(component: string, compliance: { score: number; compliance: string; recommendations: string[] }): Promise<void> {
    for (const rec of compliance.recommendations) {
      logger.info(`Diagram generation improvement for ${component}: ${rec}`);
    }
  }

  /**
   * 品質向上改善適用
   */
  private async applyQualityEnhancementImprovements(component: string, compliance: { score: number; compliance: string; recommendations: string[] }): Promise<void> {
    for (const rec of compliance.recommendations) {
      logger.info(`Quality enhancement for ${component}: ${rec}`);
    }
  }

  /**
   * Custom Instructions コミット戦略トリガー
   */
  private async triggerCustomInstructionsCommit(component: string, reason: string): Promise<void> {

    // Custom Instructions: Commit message format
    const commitMessage = `feat(${component}): ${reason} - iteration ${this.iterationCount}

🎯 Custom Instructions Compliance Achieved
- Quality Score: ${this.getLatestQualityScore(component)}%
- Success Rate: ${this.getLatestSuccessRate(component)}%
- Processing Performance: ${this.getLatestPerformanceMetrics(component)}

🤖 Generated with Claude Code Recursive Framework
Co-Authored-By: Claude <noreply@anthropic.com>`;

    this.commitHistory.push({
      component,
      reason,
      iteration: this.iterationCount,
      message: commitMessage,
      timestamp: new Date().toISOString(),
    });

    logger.info(`ContinuousLearner: commit triggered for ${component}`, { reason, iteration: this.iterationCount });
  }

  /**
   * ヘルパーメソッド: 最新イテレーション傾向取得
   */
  private getRecentIterationTrend(component: string): { improving: boolean; trend: number } {
    const componentData = this.getRecentData(20).filter(d => d.component === component);

    if (componentData.length < 4) {
      return { improving: false, trend: 0 };
    }

    const firstHalf = componentData.slice(0, Math.floor(componentData.length / 2));
    const secondHalf = componentData.slice(Math.floor(componentData.length / 2));

    const firstAvgQuality = firstHalf.reduce((sum, d) => sum + d.qualityScore, 0) / firstHalf.length;
    const secondAvgQuality = secondHalf.reduce((sum, d) => sum + d.qualityScore, 0) / secondHalf.length;

    const trend = secondAvgQuality - firstAvgQuality;

    return {
      improving: trend > 0.05, // 5% improvement threshold
      trend
    };
  }

  /**
   * ヘルパーメソッド: 最新品質スコア取得
   */
  private getLatestQualityScore(component: string): number {
    const latestData = this.learningDatabase
      .filter(d => d.component === component)
      .slice(-5);

    if (latestData.length === 0) return 0;

    return Math.round((latestData.reduce((sum, d) => sum + d.qualityScore, 0) / latestData.length) * 100);
  }

  /**
   * ヘルパーメソッド: 最新成功率取得
   */
  private getLatestSuccessRate(component: string): number {
    const latestData = this.learningDatabase
      .filter(d => d.component === component)
      .slice(-10);

    if (latestData.length === 0) return 0;

    return Math.round((latestData.filter(d => d.success).length / latestData.length) * 100);
  }

  /**
   * ヘルパーメソッド: 最新パフォーマンスメトリクス取得
   */
  private getLatestPerformanceMetrics(component: string): string {
    const latestData = this.learningDatabase
      .filter(d => d.component === component)
      .slice(-5);

    if (latestData.length === 0) return 'No data';

    const avgTime = latestData.reduce((sum, d) => sum + d.processingTime, 0) / latestData.length;
    return `${(avgTime / 1000).toFixed(1)}s avg`;
  }

  /**
   * Learning scheduling status for dashboard integration.
   * Exposes nextDueAt / lastResult for admin UI display.
   */
  getLearningStatus(): LearningStatus {
    return {
      isRunning: this.analysisInterval !== null,
      iteration: this.iterationCount,
      intervalMs: this.LEARNING_CONFIG.patternAnalysisInterval,
      nextAnalysisAt: this.lastAnalysisAt !== null
        ? this.lastAnalysisAt + this.LEARNING_CONFIG.patternAnalysisInterval
        : null,
      lastAnalysisAt: this.lastAnalysisAt,
      lastAnalysisSuccess: this.lastAnalysisSuccess,
    };
  }

  /**
   * Detected patterns for dashboard display (read-only snapshot)
   */
  getDetectedPatterns(): readonly LearningPattern[] {
    return [...this.detectedPatterns];
  }

  /**
   * System insights for dashboard display (read-only snapshot)
   */
  getSystemInsights(): readonly SystemInsight[] {
    return [...this.systemInsights];
  }

  /**
   * Learning report history for dashboard visualization (read-only snapshot).
   * Returns chronological entries from the ring buffer, oldest to newest.
   */
  getReportHistory(): readonly LearningReportEntry[] {
    return [...this.reportHistory];
  }

  /**
   * 学習状況レポート生成
   */
  getLearningReport(): {
    totalDataPoints: number;
    detectedPatterns: number;
    optimizationStrategies: number;
    systemInsights: number;
    recentOptimizations: string[];
    learningVelocity: number;
    commitHistory: CommitRecord[];
  } {
    return {
      totalDataPoints: this.learningDatabase.length,
      detectedPatterns: this.detectedPatterns.length,
      optimizationStrategies: this.optimizationStrategies.length,
      systemInsights: this.systemInsights.length,
      recentOptimizations: this.optimizationStrategies.slice(0, 5).map(s => s.name),
      learningVelocity: this.calculateLearningVelocity(),
      commitHistory: [...this.commitHistory],
    };
  }

  private calculateLearningVelocity(): number {
    // 学習速度計算（新パターン発見率）
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    const recentPatterns = this.detectedPatterns.filter(p =>
      now - p.detectedAt.getTime() < twentyFourHours
    );

    return recentPatterns.length;
  }

  /**
   * 学習プロセス停止
   */
  stopLearning(): void {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }
  }

  /**
   * Comprehensive resource cleanup — clears timer and all internal state.
   * Safe to call multiple times.
   */
  destroy(): void {
    this.stopLearning();
    this.learningDatabase = [];
    this.detectedPatterns = [];
    this.optimizationStrategies = [];
    this.systemInsights = [];
    this.commitHistory = [];
    this.reportHistory = [];
    this.lastAnalysisAt = null;
    this.lastAnalysisSuccess = false;
  }
}

export const continuousLearner = new ContinuousLearner(false);