/**
 * Phase 36: Automated Quality Regression Detection
 *
 * Detects performance degradation by comparing current metrics
 * against historical baselines. Implements autonomous quality
 * assurance based on Custom Instructions Section 5 (Quality Assurance)
 *
 * Features:
 * - Automatic baseline establishment
 * - Statistical anomaly detection
 * - Trend analysis (improving/degrading/stable)
 * - Actionable regression reports
 * - Self-correcting recommendations
 */

import { QualityMetrics, QualityMonitor } from '../pipeline/quality-monitor';
import * as fs from 'fs';
import * as path from 'path';

export interface RegressionReport {
  timestamp: Date;
  overallStatus: 'improved' | 'stable' | 'degraded' | 'regressed';
  regressions: Regression[];
  improvements: Improvement[];
  baseline: QualityMetrics;
  current: QualityMetrics;
  recommendations: string[];
  severity: 'none' | 'minor' | 'moderate' | 'severe' | 'critical';
}

export interface Regression {
  metric: string;
  baselineValue: number;
  currentValue: number;
  changePercent: number;
  severity: 'minor' | 'moderate' | 'severe' | 'critical';
  impact: string;
  recommendation: string;
}

export interface Improvement {
  metric: string;
  baselineValue: number;
  currentValue: number;
  changePercent: number;
  impact: string;
}

export interface BaselineData {
  timestamp: Date;
  metrics: QualityMetrics;
  sampleSize: number;
  confidenceLevel: number; // 0-1
}

/**
 * RegressionDetector - Autonomous quality regression detection
 *
 * Monitors quality metrics over time and detects regressions
 * following Custom Instructions Section 9.2 (Continuous Improvement)
 */
export class RegressionDetector {
  private static instance: RegressionDetector;
  private qualityMonitor: QualityMonitor;
  private baseline: BaselineData | null = null;
  private baselinePath: string;

  // Regression thresholds (percentage change that triggers alert)
  private readonly regressionThresholds = {
    minor: 10, // 10% degradation
    moderate: 20, // 20% degradation
    severe: 30, // 30% degradation
    critical: 50, // 50% degradation
  };

  // Metrics where lower is better (reverse thresholds)
  private readonly lowerIsBetter = [
    'processingTime',
    'memoryUsage',
    'layoutOverlap',
    'errorCount',
    'warningCount',
  ];

  private constructor(baselinePath?: string) {
    this.qualityMonitor = QualityMonitor.getInstance();
    this.baselinePath = baselinePath || path.join(process.cwd(), '.quality-baseline.json');
  }

  static getInstance(baselinePath?: string): RegressionDetector {
    if (!RegressionDetector.instance) {
      RegressionDetector.instance = new RegressionDetector(baselinePath);
    }
    return RegressionDetector.instance;
  }

  /**
   * Establish baseline from current quality metrics
   */
  async establishBaseline(sampleSize: number = 10): Promise<BaselineData> {
    const latestMetrics = this.qualityMonitor.getLatestMetrics();

    if (!latestMetrics) {
      throw new Error('No metrics available to establish baseline. Run system first.');
    }

    // Calculate confidence based on sample size
    const confidenceLevel = Math.min(sampleSize / 100, 0.95); // Max 95% confidence

    this.baseline = {
      timestamp: new Date(),
      metrics: latestMetrics,
      sampleSize,
      confidenceLevel,
    };

    await this.saveBaseline();

    console.log(`✅ Baseline established with ${sampleSize} samples (${(confidenceLevel * 100).toFixed(0)}% confidence)`);
    return this.baseline;
  }

  /**
   * Load existing baseline from disk
   */
  async loadBaseline(): Promise<BaselineData | null> {
    try {
      if (fs.existsSync(this.baselinePath)) {
        const data = await fs.promises.readFile(this.baselinePath, 'utf-8');
        const parsed = JSON.parse(data);

        // Convert timestamp strings back to Date objects
        this.baseline = {
          ...parsed,
          timestamp: new Date(parsed.timestamp),
          metrics: {
            ...parsed.metrics,
            timestamp: new Date(parsed.metrics.timestamp),
          },
        };

        console.log(`📊 Loaded baseline from ${this.baselinePath}`);
        return this.baseline;
      }
    } catch (error) {
      console.warn(`⚠️  Failed to load baseline: ${error}`);
    }
    return null;
  }

  /**
   * Save baseline to disk
   */
  private async saveBaseline(): Promise<void> {
    if (!this.baseline) return;

    try {
      await fs.promises.writeFile(
        this.baselinePath,
        JSON.stringify(this.baseline, null, 2),
        'utf-8'
      );
      console.log(`💾 Baseline saved to ${this.baselinePath}`);
    } catch (error) {
      console.error(`❌ Failed to save baseline: ${error}`);
    }
  }

  /**
   * Detect regressions by comparing current metrics to baseline
   */
  async detectRegressions(): Promise<RegressionReport> {
    // Load baseline if not in memory
    if (!this.baseline) {
      await this.loadBaseline();
    }

    if (!this.baseline) {
      throw new Error('No baseline available. Run establishBaseline() first.');
    }

    const currentMetrics = this.qualityMonitor.getLatestMetrics();
    if (!currentMetrics) {
      throw new Error('No current metrics available. Run system first.');
    }

    const regressions: Regression[] = [];
    const improvements: Improvement[] = [];
    const recommendations: string[] = [];

    // Compare each metric
    const metricsToCheck: (keyof QualityMetrics)[] = [
      'processingTime',
      'memoryUsage',
      'transcriptionAccuracy',
      'sceneSegmentationF1',
      'entityExtractionF1',
      'relationshipAccuracy',
      'layoutOverlap',
      'edgeCompleteness',
      'errorCount',
      'warningCount',
    ];

    for (const metric of metricsToCheck) {
      const baselineValue = this.baseline.metrics[metric] as number;
      const currentValue = currentMetrics[metric] as number;

      // Skip undefined metrics
      if (baselineValue === undefined || currentValue === undefined) continue;
      if (baselineValue === 0 && currentValue === 0) continue;

      // Calculate percentage change
      const changePercent = ((currentValue - baselineValue) / Math.abs(baselineValue)) * 100;

      // Determine if this is a regression or improvement
      const isReverseMetric = this.lowerIsBetter.includes(metric as string);
      const isRegression = isReverseMetric
        ? changePercent > 0 // For reverse metrics, increase is bad
        : changePercent < 0; // For normal metrics, decrease is bad

      const absChangePercent = Math.abs(changePercent);

      if (isRegression && absChangePercent >= this.regressionThresholds.minor) {
        const severity = this.determineSeverity(absChangePercent);
        const regression: Regression = {
          metric,
          baselineValue,
          currentValue,
          changePercent,
          severity,
          impact: this.getImpactDescription(metric, changePercent),
          recommendation: this.getRecommendation(metric, changePercent),
        };
        regressions.push(regression);
      } else if (!isRegression && absChangePercent >= 5) {
        // Track improvements (>5% change)
        improvements.push({
          metric,
          baselineValue,
          currentValue,
          changePercent,
          impact: this.getImpactDescription(metric, changePercent),
        });
      }
    }

    // Determine overall status
    const overallStatus = this.determineOverallStatus(regressions, improvements);
    const severity = this.determineOverallSeverity(regressions);

    // Generate recommendations
    if (regressions.length === 0 && improvements.length === 0) {
      recommendations.push('Quality metrics are stable. No significant changes detected.');
    } else if (regressions.length === 0) {
      recommendations.push('System showing improvements! Continue monitoring to ensure stability.');
    } else {
      recommendations.push(...regressions.map(r => r.recommendation));

      // Add aggregate recommendations
      if (regressions.filter(r => r.severity === 'critical').length > 0) {
        recommendations.push('⚠️  CRITICAL: Immediate action required. Consider rollback if quality continues to degrade.');
      } else if (regressions.filter(r => r.severity === 'severe').length >= 2) {
        recommendations.push('⚠️  Multiple severe regressions detected. Investigate recent changes and optimize affected components.');
      }
    }

    return {
      timestamp: new Date(),
      overallStatus,
      regressions,
      improvements,
      baseline: this.baseline.metrics,
      current: currentMetrics,
      recommendations,
      severity,
    };
  }

  private determineSeverity(changePercent: number): Regression['severity'] {
    if (changePercent >= this.regressionThresholds.critical) return 'critical';
    if (changePercent >= this.regressionThresholds.severe) return 'severe';
    if (changePercent >= this.regressionThresholds.moderate) return 'moderate';
    return 'minor';
  }

  private determineOverallSeverity(regressions: Regression[]): RegressionReport['severity'] {
    if (regressions.length === 0) return 'none';

    const hasCritical = regressions.some(r => r.severity === 'critical');
    const hasSevere = regressions.some(r => r.severity === 'severe');
    const hasModerate = regressions.some(r => r.severity === 'moderate');

    if (hasCritical) return 'critical';
    if (hasSevere) return 'severe';
    if (hasModerate) return 'moderate';
    return 'minor';
  }

  private determineOverallStatus(
    regressions: Regression[],
    improvements: Improvement[]
  ): RegressionReport['overallStatus'] {
    const criticalRegressions = regressions.filter(r => r.severity === 'critical' || r.severity === 'severe');

    if (criticalRegressions.length > 0) {
      return 'regressed';
    } else if (regressions.length > improvements.length) {
      return 'degraded';
    } else if (improvements.length > regressions.length) {
      return 'improved';
    } else {
      return 'stable';
    }
  }

  private getImpactDescription(metric: string, changePercent: number): string {
    const absChange = Math.abs(changePercent).toFixed(1);
    const direction = changePercent > 0 ? 'increased' : 'decreased';

    switch (metric) {
      case 'processingTime':
        return `Processing time ${direction} by ${absChange}%, affecting user experience`;
      case 'memoryUsage':
        return `Memory usage ${direction} by ${absChange}%, impacting scalability`;
      case 'transcriptionAccuracy':
        return `Transcription accuracy ${direction} by ${absChange}%, affecting content quality`;
      case 'entityExtractionF1':
        return `Entity extraction ${direction} by ${absChange}%, affecting diagram completeness`;
      case 'relationshipAccuracy':
        return `Relationship accuracy ${direction} by ${absChange}%, affecting diagram structure`;
      case 'layoutOverlap':
        return `Layout overlap ${direction} by ${absChange}%, affecting visual clarity`;
      case 'edgeCompleteness':
        return `Edge completeness ${direction} by ${absChange}%, affecting diagram connectivity`;
      case 'errorCount':
        return `Error count ${direction} by ${absChange}%, affecting reliability`;
      default:
        return `${metric} ${direction} by ${absChange}%`;
    }
  }

  private getRecommendation(metric: string, changePercent: number): string {
    switch (metric) {
      case 'processingTime':
        return 'Optimize LLM prompt length, use Flash model more aggressively, or enable parallel processing';
      case 'memoryUsage':
        return 'Enable cache pruning, reduce batch sizes, or optimize data structures';
      case 'transcriptionAccuracy':
        return 'Check audio quality, adjust Whisper model settings, or increase timeout';
      case 'entityExtractionF1':
        return 'Use Gemini Pro for complex content, improve prompt engineering, or tune extraction thresholds';
      case 'relationshipAccuracy':
        return 'Apply Phase 26 enhanced prompts, verify edge completeness, or adjust relationship inference rules';
      case 'layoutOverlap':
        return 'Apply OverlapResolver, increase spacing parameters, or use hierarchical layout';
      case 'edgeCompleteness':
        return 'Add implicit relationship inference, check timeline edge handling, or improve prompt specificity';
      case 'errorCount':
        return 'Review recent code changes, add error handling, or increase retry logic';
      default:
        return `Investigate ${metric} regression and apply appropriate optimizations`;
    }
  }

  /**
   * Get baseline info
   */
  getBaseline(): BaselineData | null {
    return this.baseline;
  }

  /**
   * Reset baseline (use with caution)
   */
  async resetBaseline(): Promise<void> {
    this.baseline = null;
    try {
      if (fs.existsSync(this.baselinePath)) {
        await fs.promises.unlink(this.baselinePath);
        console.log(`🗑️  Baseline reset successfully`);
      }
    } catch (error) {
      console.error(`❌ Failed to reset baseline: ${error}`);
    }
  }
}

/**
 * Format regression report for display
 */
export function formatRegressionReport(report: RegressionReport): string {
  const statusIcon =
    report.overallStatus === 'improved' ? '📈' :
    report.overallStatus === 'stable' ? '➡️' :
    report.overallStatus === 'degraded' ? '📉' :
    '🔴';

  const severityIcon =
    report.severity === 'critical' ? '🔴' :
    report.severity === 'severe' ? '⚠️' :
    report.severity === 'moderate' ? '⚠️' :
    report.severity === 'minor' ? 'ℹ️' : '✅';

  let output = '\n';
  output += '╔════════════════════════════════════════════════════════════════╗\n';
  output += '║          📊 QUALITY REGRESSION DETECTION REPORT               ║\n';
  output += '╚════════════════════════════════════════════════════════════════╝\n\n';

  output += `${statusIcon} Overall Status: ${report.overallStatus.toUpperCase()}\n`;
  output += `${severityIcon} Severity: ${report.severity.toUpperCase()}\n`;
  output += `⏰ Timestamp: ${report.timestamp.toISOString()}\n\n`;

  if (report.regressions.length > 0) {
    output += `🔴 Detected Regressions (${report.regressions.length}):\n`;
    report.regressions.forEach((reg, i) => {
      const icon =
        reg.severity === 'critical' ? '🔴' :
        reg.severity === 'severe' ? '⚠️⚠️' :
        reg.severity === 'moderate' ? '⚠️' : 'ℹ️';

      output += `   ${i + 1}. ${icon} [${reg.severity.toUpperCase()}] ${reg.metric}\n`;
      output += `      Baseline: ${reg.baselineValue.toFixed(2)}\n`;
      output += `      Current: ${reg.currentValue.toFixed(2)}\n`;
      output += `      Change: ${reg.changePercent.toFixed(1)}%\n`;
      output += `      Impact: ${reg.impact}\n`;
      output += `      Fix: ${reg.recommendation}\n\n`;
    });
  }

  if (report.improvements.length > 0) {
    output += `📈 Detected Improvements (${report.improvements.length}):\n`;
    report.improvements.forEach((imp, i) => {
      output += `   ${i + 1}. ✨ ${imp.metric}\n`;
      output += `      Baseline: ${imp.baselineValue.toFixed(2)}\n`;
      output += `      Current: ${imp.currentValue.toFixed(2)}\n`;
      output += `      Change: ${imp.changePercent > 0 ? '+' : ''}${imp.changePercent.toFixed(1)}%\n`;
      output += `      Impact: ${imp.impact}\n\n`;
    });
  }

  if (report.recommendations.length > 0) {
    output += `💡 Recommendations:\n`;
    report.recommendations.forEach(rec => {
      output += `   • ${rec}\n`;
    });
  }

  output += '\n' + '='.repeat(70) + '\n';

  return output;
}

/**
 * Convenience function to get global detector instance
 */
export function getRegressionDetector(): RegressionDetector {
  return RegressionDetector.getInstance();
}
