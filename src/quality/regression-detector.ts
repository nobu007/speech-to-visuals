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

import { LOWER_IS_BETTER_QUALITY_METRICS, QualityMetrics, QualityMonitor } from '../pipeline/quality-monitor';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '@stv/core/utils/logger';
import { QualityGateError } from '@/pipeline/pipeline-errors';
import { percentChange } from '@stv/core/lib/metrics-utils';

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

  // Minimum percentage change to qualify as an improvement
  private readonly improvementThresholdPercent = 5;

  // Polarity is NOT re-declared here: RegressionDetector shares the canonical
  // `LOWER_IS_BETTER_QUALITY_METRICS` registry exported from quality-monitor
  // (the cross-module single source of truth). An earlier private `lowerIsBetter`
  // array was a divergent duplicate that could drift out of sync whenever a
  // metric was added to one list but not the other — the duplicate-formula bug
  // class. See quality-monitor.ts for the closed-set partition contract.

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
      throw new QualityGateError('regression-baseline', 'No metrics available to establish baseline. Run system first.');
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

    return this.baseline;
  }

  /**
   * Load existing baseline from disk.
   *
   * Rejects payloads whose `timestamp` / `metrics.timestamp` resolve to an
   * Invalid Date — `JSON.parse("1e400")` returns `Infinity` and
   * `new Date(Infinity)` returns an Invalid Date (NaN `.getTime()`), which
   * silently breaks every downstream comparison with the baseline. The Lottie
   * export finiteness fix (c9216907) closed the same vector in the export
   * pipeline; this method is the matching guard for the regression baseline.
   */
  async loadBaseline(): Promise<BaselineData | null> {
    // Quarantine is AWAITED before loadBaseline resolves: a fire-and-forget
    // `void fs.promises.unlink` let the method return while the poisoned file
    // was still on disk (a caller re-reading the baseline could re-ingest it),
    // and the floating promise's ENOENT rejection surfaced as an unhandled
    // rejection attributed to unrelated code running at the time.
    const removeBadBaseline = async (reason: string): Promise<void> => {
      logger.warn(
        `Removing poisoned baseline at ${this.baselinePath}: ${reason}`,
      );
      try {
        if (fs.existsSync(this.baselinePath)) {
          await fs.promises.unlink(this.baselinePath);
        }
      } catch (removeErr) {
        logger.warn(`Failed to remove poisoned baseline ${this.baselinePath}: ${String(removeErr)}`);
      }
    };

    const coerceFiniteDate = async (raw: unknown, label: string): Promise<Date | null> => {
      if (raw === null || raw === undefined) {
        await removeBadBaseline(`${label} is ${raw}`);
        return null;
      }
      const d = raw instanceof Date ? raw : new Date(raw as number | string);
      if (!Number.isFinite(d.getTime())) {
        await removeBadBaseline(`${label} is not a valid date (got ${JSON.stringify(raw)})`);
        return null;
      }
      return d;
    };

    try {
      if (!fs.existsSync(this.baselinePath)) return null;
      const data = await fs.promises.readFile(this.baselinePath, 'utf-8');
      let parsed: unknown;
      try {
        parsed = JSON.parse(data);
      } catch (parseErr) {
        await removeBadBaseline(`JSON parse failure: ${String(parseErr)}`);
        return null;
      }
      if (!parsed || typeof parsed !== 'object') {
        await removeBadBaseline('payload is not a JSON object');
        return null;
      }
      const obj = parsed as Record<string, unknown>;

      const tsTop = await coerceFiniteDate(obj.timestamp, 'timestamp');
      if (tsTop === null) return null;

      const metricsObj = obj.metrics;
      if (!metricsObj || typeof metricsObj !== 'object') {
        await removeBadBaseline('metrics is missing or not an object');
        return null;
      }

      // Finiteness guard for metric MAGNITUDES — the missed sibling of
      // `coerceFiniteDate` above. A corrupted/tampered baseline whose metric
      // is a literal `1e400` survives JSON.parse as Infinity (the exact vector
      // the timestamp guard's own comment names) and is then spread verbatim
      // into the baseline below. In detectRegressions that Infinity reaches
      // `percentChange(current, baselineValue)`, which yields NaN, and every
      // NaN comparison (`> 0`, `< 0`, `>= threshold`) is false — so the metric
      // is silently classified as "stable" and regression detection for it is
      // disabled with no warning. The timestamp guard closed this Infinity
      // vector for dates (the c9216907 Lottie sibling); this loop closes it for
      // the numeric magnitudes that actually drive the comparison. It scans
      // EVERY present number-typed member (not a hand-picked list), so a
      // non-finite value in any metric — including ones added to
      // `metricsToCheck` later — is rejected, mirroring the structural
      // completeness of the boolean/finiteness tails elsewhere.
      const metricsRecord = metricsObj as Record<string, unknown>;
      for (const [key, value] of Object.entries(metricsRecord)) {
        if (typeof value === 'number' && !Number.isFinite(value)) {
          await removeBadBaseline(`metric "${key}" is non-finite (got ${value})`);
          return null;
        }
      }

      const tsMetrics = await coerceFiniteDate(
        (metricsObj as Record<string, unknown>).timestamp,
        'metrics.timestamp',
      );
      if (tsMetrics === null) return null;

      this.baseline = {
        ...(obj as unknown as BaselineData),
        timestamp: tsTop,
        metrics: {
          ...(metricsObj as unknown as QualityMetrics),
          timestamp: tsMetrics,
        },
      };
      return this.baseline;
    } catch (error) {
      logger.warn(`⚠️  Failed to load baseline: ${error}`);
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
    } catch (error) {
      logger.error(`❌ Failed to save baseline: ${error}`);
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
      throw new QualityGateError('regression-baseline', 'No baseline available. Run establishBaseline() first.');
    }

    const currentMetrics = this.qualityMonitor.getLatestMetrics();
    if (!currentMetrics) {
      throw new QualityGateError('regression-metrics', 'No current metrics available. Run system first.');
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
      const baselineValue = this.baseline.metrics[metric] as number | null | undefined;
      const currentValue = currentMetrics[metric] as number | null | undefined;

      // Skip undefined metrics, and null (REQ-375: unmeasured layoutOverlap —
      // a null slipping through would surface as a NaN-% change line)
      if (baselineValue === null || baselineValue === undefined) continue;
      if (currentValue === null || currentValue === undefined) continue;
      if (baselineValue === 0) continue; // Cannot compute meaningful % change from zero baseline

      // Calculate percentage change (canonical abs-denominator — see metrics-utils)
      const changePercent = percentChange(currentValue, baselineValue);

      // Determine if this is a regression or improvement
      const isReverseMetric = LOWER_IS_BETTER_QUALITY_METRICS.has(metric);
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
      } else if (!isRegression && absChangePercent >= this.improvementThresholdPercent) {
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
      }
    } catch (error) {
      logger.error(`❌ Failed to reset baseline: ${error}`);
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
