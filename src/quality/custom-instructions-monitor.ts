/**
 * 🎯 Custom Instructions Quality Monitor
 *
 * Implements automatic quality checks and improvement suggestions
 * as defined in the custom instructions recursive development protocol
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface QualityReport {
  timestamp: Date;
  phase: string;
  iteration: number;
  checks: QualityCheck[];
  overallScore: number;
  shouldCommit: boolean;
  improvements: ImprovementSuggestion[];
}

export interface QualityCheck {
  module: string;
  passed: boolean;
  score: number;
  issues: Issue[];
  metrics: Record<string, number>;
}

export interface Issue {
  severity: 'critical' | 'warning' | 'info';
  description: string;
  suggestion: string;
  estimatedImpact: number; // 0-1 scale
}

export interface ImprovementSuggestion {
  priority: 'high' | 'medium' | 'low';
  category: 'accuracy' | 'performance' | 'usability' | 'stability';
  description: string;
  implementation: string;
  expectedGain: number; // percentage improvement
}

/**
 * Quality thresholds as defined in custom instructions
 */
const QUALITY_THRESHOLDS = {
  transcriptionAccuracy: 0.85,
  sceneSegmentationF1: 0.75,
  layoutOverlap: 0,
  renderTime: 30000, // 30秒以内
  memoryUsage: 512 * 1024 * 1024, // 512MB以内
  overallSuccess: 0.9 // 90%以上
};

export class CustomInstructionsQualityMonitor {
  private projectPath: string;
  private reportHistory: QualityReport[] = [];

  constructor(projectPath: string = process.cwd()) {
    this.projectPath = projectPath;
    this.loadReportHistory();
  }

  /**
   * Run comprehensive quality checks as per custom instructions
   */
  async runQualityChecks(
    transcriptionResult?: any,
    analysisResult?: any,
    layoutResult?: any,
    pipelineMetrics?: any
  ): Promise<QualityReport> {
    console.log('\n🔍 Running Custom Instructions Quality Checks...');

    const checks: QualityCheck[] = [];

    // 1. Transcription Quality Check
    if (transcriptionResult) {
      checks.push(await this.checkTranscriptionQuality(transcriptionResult));
    }

    // 2. Analysis Pipeline Check
    if (analysisResult) {
      checks.push(await this.checkAnalysisQuality(analysisResult));
    }

    // 3. Layout Generation Check
    if (layoutResult) {
      checks.push(await this.checkLayoutQuality(layoutResult));
    }

    // 4. Overall Pipeline Performance
    if (pipelineMetrics) {
      checks.push(await this.checkPipelinePerformance(pipelineMetrics));
    }

    // Calculate overall score
    const overallScore = checks.reduce((acc, check) => acc + check.score, 0) / checks.length;

    // Generate improvement suggestions
    const improvements = this.generateImprovementSuggestions(checks);

    // Determine if should commit based on custom instructions criteria
    const shouldCommit = this.shouldCommitBasedOnQuality(overallScore, checks);

    const report: QualityReport = {
      timestamp: new Date(),
      phase: 'Quality Assessment',
      iteration: this.reportHistory.length + 1,
      checks,
      overallScore,
      shouldCommit,
      improvements
    };

    // Save report
    this.saveReport(report);

    this.logQualityReport(report);

    return report;
  }

  /**
   * Check transcription quality (accuracy, confidence, processing time)
   */
  private async checkTranscriptionQuality(result: any): Promise<QualityCheck> {
    const issues: Issue[] = [];
    let score = 1.0;

    // Check accuracy
    const accuracy = result.averageConfidence || 0;
    if (accuracy < QUALITY_THRESHOLDS.transcriptionAccuracy) {
      issues.push({
        severity: 'critical',
        description: `転写精度が低い: ${(accuracy * 100).toFixed(1)}%`,
        suggestion: 'Whisperモデルをbaseからlargeに変更、または音声前処理を追加',
        estimatedImpact: 0.3
      });
      score -= 0.3;
    }

    // Check processing time
    const processingTime = result.processingTimeMs || 0;
    if (processingTime > 10000) { // 10秒以上
      issues.push({
        severity: 'warning',
        description: `処理時間が長い: ${(processingTime / 1000).toFixed(1)}s`,
        suggestion: 'チャンク処理の最適化または並列処理の実装',
        estimatedImpact: 0.2
      });
      score -= 0.2;
    }

    return {
      module: 'transcription',
      passed: issues.filter(i => i.severity === 'critical').length === 0,
      score: Math.max(0, score),
      issues,
      metrics: {
        accuracy,
        processingTime,
        segmentCount: result.segments?.length || 0
      }
    };
  }

  /**
   * Check analysis quality (scene segmentation, diagram detection)
   */
  private async checkAnalysisQuality(result: any): Promise<QualityCheck> {
    const issues: Issue[] = [];
    let score = 1.0;

    // Check scene segmentation F1 score
    const f1Score = result.segmentationF1 || 0;
    if (f1Score < QUALITY_THRESHOLDS.sceneSegmentationF1) {
      issues.push({
        severity: 'critical',
        description: `シーン分割精度が低い: F1=${(f1Score * 100).toFixed(1)}%`,
        suggestion: '分割アルゴリズムの改善、または機械学習モデルの導入',
        estimatedImpact: 0.25
      });
      score -= 0.25;
    }

    // Check diagram detection confidence
    const diagramConfidence = result.averageDiagramConfidence || 0;
    if (diagramConfidence < 0.7) {
      issues.push({
        severity: 'warning',
        description: `図解タイプ判定の信頼度が低い: ${(diagramConfidence * 100).toFixed(1)}%`,
        suggestion: 'キーワード辞書の拡充、または統計的手法の追加',
        estimatedImpact: 0.2
      });
      score -= 0.2;
    }

    return {
      module: 'analysis',
      passed: issues.filter(i => i.severity === 'critical').length === 0,
      score: Math.max(0, score),
      issues,
      metrics: {
        f1Score,
        diagramConfidence,
        segmentCount: result.segments?.length || 0
      }
    };
  }

  /**
   * Check layout quality (overlap, readability, efficiency)
   */
  private async checkLayoutQuality(result: any): Promise<QualityCheck> {
    const issues: Issue[] = [];
    let score = 1.0;

    // Check layout overlap (must be 0 per custom instructions)
    const layoutOverlap = result.layoutOverlap || 0;
    if (layoutOverlap > QUALITY_THRESHOLDS.layoutOverlap) {
      issues.push({
        severity: 'critical',
        description: `レイアウト重複が発生: ${layoutOverlap}箇所`,
        suggestion: 'レイアウトアルゴリズムの改善、または衝突検出の実装',
        estimatedImpact: 0.4
      });
      score -= 0.4;
    }

    // Check label readability
    const readability = result.labelReadability || 1.0;
    if (readability < 1.0) {
      issues.push({
        severity: 'warning',
        description: `ラベル可読性が低い: ${(readability * 100).toFixed(1)}%`,
        suggestion: 'フォントサイズの調整、または背景色の最適化',
        estimatedImpact: 0.15
      });
      score -= 0.15;
    }

    return {
      module: 'layout',
      passed: issues.filter(i => i.severity === 'critical').length === 0,
      score: Math.max(0, score),
      issues,
      metrics: {
        layoutOverlap,
        readability,
        efficiency: result.layoutEfficiency || 0
      }
    };
  }

  /**
   * Check overall pipeline performance
   */
  private async checkPipelinePerformance(metrics: any): Promise<QualityCheck> {
    const issues: Issue[] = [];
    let score = 1.0;

    // Check render time
    const renderTime = metrics.totalProcessingTime || 0;
    if (renderTime > QUALITY_THRESHOLDS.renderTime) {
      issues.push({
        severity: 'critical',
        description: `処理時間が長すぎる: ${(renderTime / 1000).toFixed(1)}s`,
        suggestion: 'パイプライン全体の最適化、または並列処理の実装',
        estimatedImpact: 0.3
      });
      score -= 0.3;
    }

    // Check memory usage
    const memoryUsage = metrics.peakMemoryUsage || 0;
    if (memoryUsage > QUALITY_THRESHOLDS.memoryUsage) {
      issues.push({
        severity: 'warning',
        description: `メモリ使用量が多い: ${(memoryUsage / (1024 * 1024)).toFixed(1)}MB`,
        suggestion: 'メモリ効率の改善、またはストリーミング処理の実装',
        estimatedImpact: 0.2
      });
      score -= 0.2;
    }

    // Check success rate
    const successRate = metrics.successRate || 0;
    if (successRate < QUALITY_THRESHOLDS.overallSuccess) {
      issues.push({
        severity: 'critical',
        description: `成功率が低い: ${(successRate * 100).toFixed(1)}%`,
        suggestion: 'エラーハンドリングの改善、またはフォールバック機構の実装',
        estimatedImpact: 0.4
      });
      score -= 0.4;
    }

    return {
      module: 'pipeline',
      passed: issues.filter(i => i.severity === 'critical').length === 0,
      score: Math.max(0, score),
      issues,
      metrics: {
        renderTime,
        memoryUsage,
        successRate,
        throughput: metrics.throughput || 0
      }
    };
  }

  /**
   * Generate improvement suggestions based on quality check results
   */
  private generateImprovementSuggestions(checks: QualityCheck[]): ImprovementSuggestion[] {
    const suggestions: ImprovementSuggestion[] = [];

    // Collect all issues and prioritize
    const allIssues = checks.flatMap(check =>
      check.issues.map(issue => ({ ...issue, module: check.module }))
    );

    // Sort by impact and severity
    allIssues.sort((a, b) => {
      const severityWeight = { critical: 3, warning: 2, info: 1 };
      return (severityWeight[b.severity] + b.estimatedImpact) - (severityWeight[a.severity] + a.estimatedImpact);
    });

    // Generate targeted suggestions
    allIssues.slice(0, 5).forEach((issue, index) => {
      suggestions.push({
        priority: index < 2 ? 'high' : index < 4 ? 'medium' : 'low',
        category: this.categorizeIssue(issue.description),
        description: issue.description,
        implementation: issue.suggestion,
        expectedGain: issue.estimatedImpact * 100
      });
    });

    return suggestions;
  }

  /**
   * Categorize issue for better organization
   */
  private categorizeIssue(description: string): 'accuracy' | 'performance' | 'usability' | 'stability' {
    if (description.includes('精度') || description.includes('信頼度')) return 'accuracy';
    if (description.includes('時間') || description.includes('メモリ')) return 'performance';
    if (description.includes('可読性') || description.includes('重複')) return 'usability';
    return 'stability';
  }

  /**
   * Determine if current quality should trigger a commit
   */
  private shouldCommitBasedOnQuality(overallScore: number, checks: QualityCheck[]): boolean {
    const criticalIssues = checks.flatMap(c => c.issues).filter(i => i.severity === 'critical').length;

    return overallScore >= 0.8 && criticalIssues === 0;
  }

  /**
   * Save quality report to file
   */
  private saveReport(report: QualityReport): void {
    const reportPath = join(this.projectPath, '.module', 'quality-reports.json');
    this.reportHistory.push(report);

    try {
      writeFileSync(reportPath, JSON.stringify(this.reportHistory, null, 2));
    } catch (error) {
      console.warn('Failed to save quality report:', error);
    }
  }

  /**
   * Load previous quality reports
   */
  private loadReportHistory(): void {
    const reportPath = join(this.projectPath, '.module', 'quality-reports.json');

    if (existsSync(reportPath)) {
      try {
        const data = readFileSync(reportPath, 'utf-8');
        this.reportHistory = JSON.parse(data);
      } catch (error) {
        console.warn('Failed to load quality report history:', error);
        this.reportHistory = [];
      }
    }
  }

  /**
   * Log quality report to console
   */
  private logQualityReport(report: QualityReport): void {
    console.log('\n📊 Quality Assessment Results');
    console.log('================================');
    console.log(`Overall Score: ${(report.overallScore * 100).toFixed(1)}%`);
    console.log(`Should Commit: ${report.shouldCommit ? '✅ Yes' : '❌ No'}`);

    report.checks.forEach(check => {
      console.log(`\n${check.module.toUpperCase()}:`);
      console.log(`  Status: ${check.passed ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`  Score: ${(check.score * 100).toFixed(1)}%`);

      if (check.issues.length > 0) {
        console.log('  Issues:');
        check.issues.forEach(issue => {
          console.log(`    ${issue.severity === 'critical' ? '🔴' : issue.severity === 'warning' ? '🟡' : '🔵'} ${issue.description}`);
          console.log(`       💡 ${issue.suggestion}`);
        });
      }
    });

    if (report.improvements.length > 0) {
      console.log('\n🔧 Top Improvement Recommendations:');
      report.improvements.slice(0, 3).forEach((improvement, index) => {
        console.log(`  ${index + 1}. [${improvement.priority.toUpperCase()}] ${improvement.description}`);
        console.log(`     Implementation: ${improvement.implementation}`);
        console.log(`     Expected Gain: +${improvement.expectedGain.toFixed(1)}%`);
      });
    }
  }

  /**
   * Get quality trend analysis
   */
  getTrend(metric: string, lastN: number = 5): { trend: 'improving' | 'stable' | 'declining'; change: number } {
    if (this.reportHistory.length < 2) {
      return { trend: 'stable', change: 0 };
    }

    const recentReports = this.reportHistory.slice(-lastN);
    const scores = recentReports.map(r => r.overallScore);

    const firstScore = scores[0];
    const lastScore = scores[scores.length - 1];
    const change = ((lastScore - firstScore) / firstScore) * 100;

    if (Math.abs(change) < 2) return { trend: 'stable', change };
    return { trend: change > 0 ? 'improving' : 'declining', change };
  }
}

/**
 * Global instance for use across the application
 */
export const customInstructionsMonitor = new CustomInstructionsQualityMonitor();