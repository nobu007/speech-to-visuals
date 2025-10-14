/**
 * Phase 27: Recursive Quality Improvement Framework
 *
 * Autonomous quality monitoring and self-correction system that implements
 * the recursive improvement cycle: measure → evaluate → improve → verify
 *
 * Based on Custom Instructions: development_philosophy.recursive
 */

export interface QualityMetrics {
  timestamp: Date;
  phase: string;
  iteration: number;

  // Performance Metrics
  processingTime: number; // ms
  memoryUsage: number; // MB
  cacheHitRate?: number; // 0-1

  // Accuracy Metrics
  transcriptionAccuracy?: number; // 0-1
  sceneSegmentationF1?: number; // 0-1
  entityExtractionF1?: number; // 0-1
  relationshipAccuracy?: number; // 0-1
  layoutOverlap: number; // count (0 is perfect)

  // Output Quality
  edgeCompleteness?: number; // 0-1
  edgeRatioQuality?: number; // actual/expected
  confidenceScore?: number; // 0-1

  // System Health
  errorCount: number;
  warningCount: number;
  fallbackTriggered: boolean;
}

export interface QualityThresholds {
  transcriptionAccuracy: number;
  sceneSegmentationF1: number;
  entityExtractionF1: number;
  relationshipAccuracy: number;
  layoutOverlap: number;
  renderTime: number; // ms
  memoryUsage: number; // MB
  edgeCompleteness: number;
  edgeRatioQuality: number;
}

export interface QualityReport {
  overallScore: number; // 0-100
  status: 'excellent' | 'good' | 'acceptable' | 'needs_improvement' | 'critical';
  metrics: QualityMetrics;
  thresholds: QualityThresholds;
  violations: QualityViolation[];
  recommendations: string[];
  improvementPotential: number; // 0-100, higher = more room for improvement
}

export interface QualityViolation {
  metric: string;
  actual: number;
  expected: number;
  severity: 'critical' | 'warning' | 'info';
  impact: string;
  recommendation: string;
}

export interface IterationLog {
  phaseId: string;
  iterationNumber: number;
  timestamp: Date;
  action: string;
  result: 'success' | 'partial' | 'failure';
  metrics: QualityMetrics;
  improvements: string[];
  nextSteps: string[];
}

/**
 * QualityMonitor - Autonomous quality assessment and improvement tracking
 *
 * Implements recursive improvement cycle:
 * 1. Measure: Collect real-time metrics
 * 2. Evaluate: Compare against thresholds and historical data
 * 3. Improve: Suggest optimizations based on violations
 * 4. Verify: Track improvement effectiveness
 */
export class QualityMonitor {
  private static instance: QualityMonitor;

  private thresholds: QualityThresholds = {
    transcriptionAccuracy: 0.85,
    sceneSegmentationF1: 0.75,
    entityExtractionF1: 0.80,
    relationshipAccuracy: 0.85,
    layoutOverlap: 0,
    renderTime: 30000, // 30 seconds
    memoryUsage: 512, // 512 MB
    edgeCompleteness: 0.70,
    edgeRatioQuality: 0.80,
  };

  private metricsHistory: QualityMetrics[] = [];
  private iterationHistory: IterationLog[] = [];
  private currentPhase: string = 'phase-27';
  private currentIteration: number = 1;

  private constructor() {}

  static getInstance(): QualityMonitor {
    if (!QualityMonitor.instance) {
      QualityMonitor.instance = new QualityMonitor();
    }
    return QualityMonitor.instance;
  }

  /**
   * Record metrics for the current processing run
   */
  recordMetrics(metrics: Partial<QualityMetrics>): void {
    const fullMetrics: QualityMetrics = {
      timestamp: new Date(),
      phase: this.currentPhase,
      iteration: this.currentIteration,
      processingTime: 0,
      memoryUsage: 0,
      layoutOverlap: 0,
      errorCount: 0,
      warningCount: 0,
      fallbackTriggered: false,
      ...metrics,
    };

    this.metricsHistory.push(fullMetrics);

    // Keep only last 100 metrics to prevent memory bloat
    if (this.metricsHistory.length > 100) {
      this.metricsHistory.shift();
    }
  }

  /**
   * Generate comprehensive quality report
   */
  generateReport(): QualityReport {
    const latestMetrics = this.getLatestMetrics();

    if (!latestMetrics) {
      return {
        overallScore: 0,
        status: 'critical',
        metrics: {} as QualityMetrics,
        thresholds: this.thresholds,
        violations: [],
        recommendations: ['No metrics available. Run system first.'],
        improvementPotential: 100,
      };
    }

    const violations = this.detectViolations(latestMetrics);
    const overallScore = this.calculateOverallScore(latestMetrics, violations);
    const status = this.determineStatus(overallScore);
    const recommendations = this.generateRecommendations(violations, latestMetrics);
    const improvementPotential = this.calculateImprovementPotential(violations);

    return {
      overallScore,
      status,
      metrics: latestMetrics,
      thresholds: this.thresholds,
      violations,
      recommendations,
      improvementPotential,
    };
  }

  /**
   * Detect threshold violations
   */
  private detectViolations(metrics: QualityMetrics): QualityViolation[] {
    const violations: QualityViolation[] = [];

    // Transcription accuracy
    if (metrics.transcriptionAccuracy !== undefined &&
        metrics.transcriptionAccuracy < this.thresholds.transcriptionAccuracy) {
      violations.push({
        metric: 'transcriptionAccuracy',
        actual: metrics.transcriptionAccuracy,
        expected: this.thresholds.transcriptionAccuracy,
        severity: metrics.transcriptionAccuracy < 0.7 ? 'critical' : 'warning',
        impact: 'Poor transcription affects all downstream processing',
        recommendation: 'Check audio quality, consider noise reduction preprocessing',
      });
    }

    // Scene segmentation
    if (metrics.sceneSegmentationF1 !== undefined &&
        metrics.sceneSegmentationF1 < this.thresholds.sceneSegmentationF1) {
      violations.push({
        metric: 'sceneSegmentationF1',
        actual: metrics.sceneSegmentationF1,
        expected: this.thresholds.sceneSegmentationF1,
        severity: 'warning',
        impact: 'Suboptimal scene boundaries reduce diagram clarity',
        recommendation: 'Tune semantic similarity threshold or use LLM-based segmentation',
      });
    }

    // Entity extraction
    if (metrics.entityExtractionF1 !== undefined &&
        metrics.entityExtractionF1 < this.thresholds.entityExtractionF1) {
      violations.push({
        metric: 'entityExtractionF1',
        actual: metrics.entityExtractionF1,
        expected: this.thresholds.entityExtractionF1,
        severity: 'warning',
        impact: 'Missing entities lead to incomplete diagrams',
        recommendation: 'Use Gemini Pro for complex texts, improve prompt engineering',
      });
    }

    // Relationship accuracy (Phase 26 focus)
    if (metrics.relationshipAccuracy !== undefined &&
        metrics.relationshipAccuracy < this.thresholds.relationshipAccuracy) {
      violations.push({
        metric: 'relationshipAccuracy',
        actual: metrics.relationshipAccuracy,
        expected: this.thresholds.relationshipAccuracy,
        severity: 'warning',
        impact: 'Incorrect relationships confuse diagram structure',
        recommendation: 'Apply Phase 26 enhanced prompts, verify edge completeness',
      });
    }

    // Edge completeness (Phase 26)
    if (metrics.edgeCompleteness !== undefined &&
        metrics.edgeCompleteness < this.thresholds.edgeCompleteness) {
      violations.push({
        metric: 'edgeCompleteness',
        actual: metrics.edgeCompleteness,
        expected: this.thresholds.edgeCompleteness,
        severity: 'warning',
        impact: 'Sparse relationships result in disconnected diagrams',
        recommendation: 'Add implicit relationship inference, check timeline edge handling',
      });
    }

    // Layout overlap (critical)
    if (metrics.layoutOverlap > this.thresholds.layoutOverlap) {
      violations.push({
        metric: 'layoutOverlap',
        actual: metrics.layoutOverlap,
        expected: this.thresholds.layoutOverlap,
        severity: 'critical',
        impact: 'Visual overlap makes diagrams unreadable',
        recommendation: 'Apply OverlapResolver, increase spacing parameters',
      });
    }

    // Processing time
    if (metrics.processingTime > this.thresholds.renderTime) {
      violations.push({
        metric: 'processingTime',
        actual: metrics.processingTime,
        expected: this.thresholds.renderTime,
        severity: 'info',
        impact: 'Slow processing affects user experience',
        recommendation: 'Optimize LLM prompt length, use Flash model more aggressively',
      });
    }

    // Memory usage
    if (metrics.memoryUsage > this.thresholds.memoryUsage) {
      violations.push({
        metric: 'memoryUsage',
        actual: metrics.memoryUsage,
        expected: this.thresholds.memoryUsage,
        severity: 'warning',
        impact: 'High memory usage limits scalability',
        recommendation: 'Enable cache pruning, stream large files',
      });
    }

    return violations;
  }

  /**
   * Calculate overall quality score (0-100)
   */
  private calculateOverallScore(
    metrics: QualityMetrics,
    violations: QualityViolation[]
  ): number {
    let score = 100;

    // Deduct points for violations
    for (const violation of violations) {
      switch (violation.severity) {
        case 'critical':
          score -= 20;
          break;
        case 'warning':
          score -= 10;
          break;
        case 'info':
          score -= 5;
          break;
      }
    }

    // Bonus for excellent metrics
    if (metrics.edgeCompleteness && metrics.edgeCompleteness >= 0.9) {
      score += 5;
    }
    if (metrics.layoutOverlap === 0) {
      score += 5;
    }
    if (metrics.errorCount === 0) {
      score += 5;
    }

    // Penalty for system issues
    if (metrics.fallbackTriggered) {
      score -= 5;
    }
    if (metrics.errorCount > 0) {
      score -= metrics.errorCount * 2;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Determine status from score
   */
  private determineStatus(score: number): QualityReport['status'] {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'acceptable';
    if (score >= 40) return 'needs_improvement';
    return 'critical';
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(
    violations: QualityViolation[],
    metrics: QualityMetrics
  ): string[] {
    const recommendations = violations.map(v => v.recommendation);

    // Add proactive suggestions
    if (metrics.cacheHitRate !== undefined && metrics.cacheHitRate < 0.5) {
      recommendations.push('Low cache hit rate detected. Consider warming cache with common queries.');
    }

    if (metrics.edgeCompleteness &&
        metrics.edgeCompleteness < 0.8 &&
        metrics.edgeCompleteness > 0.7) {
      recommendations.push('Edge completeness is near threshold. Monitor timeline diagram handling.');
    }

    if (violations.length === 0) {
      recommendations.push('System performing excellently. No immediate action required.');
      recommendations.push('Consider: (1) Stress testing with complex inputs, (2) Monitoring long-term trends');
    }

    return recommendations;
  }

  /**
   * Calculate improvement potential (0-100)
   */
  private calculateImprovementPotential(violations: QualityViolation[]): number {
    if (violations.length === 0) return 10; // Minimal improvement needed

    let potential = 0;
    for (const violation of violations) {
      const gap = violation.expected - violation.actual;
      const normalizedGap = Math.abs(gap) / Math.max(violation.expected, 1);
      potential += normalizedGap * 20; // Each gap can contribute up to 20 points
    }

    return Math.min(100, potential);
  }

  /**
   * Get latest recorded metrics
   */
  getLatestMetrics(): QualityMetrics | null {
    return this.metricsHistory.length > 0
      ? this.metricsHistory[this.metricsHistory.length - 1]
      : null;
  }

  /**
   * Get historical trend for specific metric
   */
  getTrend(metricName: keyof QualityMetrics, windowSize: number = 10): number[] {
    return this.metricsHistory
      .slice(-windowSize)
      .map(m => (m[metricName] as number) || 0);
  }

  /**
   * Log iteration for development tracking
   */
  logIteration(log: Omit<IterationLog, 'timestamp'>): void {
    const fullLog: IterationLog = {
      ...log,
      timestamp: new Date(),
    };

    this.iterationHistory.push(fullLog);

    console.log(`\n${'='.repeat(70)}`);
    console.log(`📊 Phase ${log.phaseId} - Iteration ${log.iterationNumber}`);
    console.log(`Action: ${log.action}`);
    console.log(`Result: ${log.result.toUpperCase()}`);
    console.log(`Improvements: ${log.improvements.join(', ') || 'None'}`);
    console.log(`Next Steps: ${log.nextSteps.join(', ')}`);
    console.log(`${'='.repeat(70)}\n`);
  }

  /**
   * Export iteration history for .module/ITERATION_LOG.md
   */
  exportIterationHistory(): string {
    let output = '# Iteration History\n\n';
    output += `Last Updated: ${new Date().toISOString()}\n\n`;

    const phases = new Map<string, IterationLog[]>();
    for (const log of this.iterationHistory) {
      const logs = phases.get(log.phaseId) || [];
      logs.push(log);
      phases.set(log.phaseId, logs);
    }

    for (const [phaseId, logs] of phases.entries()) {
      output += `## ${phaseId}\n\n`;
      for (const log of logs) {
        output += `### Iteration ${log.iterationNumber} - ${log.result}\n`;
        output += `**Date**: ${log.timestamp.toISOString()}\n`;
        output += `**Action**: ${log.action}\n\n`;

        if (log.improvements.length > 0) {
          output += '**Improvements**:\n';
          log.improvements.forEach(imp => output += `- ${imp}\n`);
          output += '\n';
        }

        output += '**Metrics**:\n';
        output += `- Processing Time: ${log.metrics.processingTime}ms\n`;
        output += `- Memory Usage: ${log.metrics.memoryUsage}MB\n`;
        output += `- Errors: ${log.metrics.errorCount}\n`;
        output += `- Warnings: ${log.metrics.warningCount}\n`;
        output += `- Fallback: ${log.metrics.fallbackTriggered ? 'Yes' : 'No'}\n\n`;

        if (log.nextSteps.length > 0) {
          output += '**Next Steps**:\n';
          log.nextSteps.forEach(step => output += `- ${step}\n`);
          output += '\n';
        }

        output += '---\n\n';
      }
    }

    return output;
  }

  /**
   * Self-diagnostic check - identify areas for improvement
   */
  runDiagnostics(): { health: string; critical: string[]; warnings: string[] } {
    const report = this.generateReport();
    const critical: string[] = [];
    const warnings: string[] = [];

    for (const violation of report.violations) {
      if (violation.severity === 'critical') {
        critical.push(`${violation.metric}: ${violation.impact}`);
      } else if (violation.severity === 'warning') {
        warnings.push(`${violation.metric}: ${violation.impact}`);
      }
    }

    return {
      health: report.status,
      critical,
      warnings,
    };
  }

  /**
   * Compare current metrics against historical baseline
   */
  compareToBaseline(): { improved: string[]; regressed: string[]; stable: string[] } {
    const latest = this.getLatestMetrics();
    if (!latest || this.metricsHistory.length < 5) {
      return { improved: [], regressed: [], stable: [] };
    }

    const baseline = this.metricsHistory.slice(0, Math.min(5, this.metricsHistory.length - 1));
    const avgBaseline = (metric: keyof QualityMetrics): number => {
      const values = baseline
        .map(m => m[metric] as number)
        .filter(v => v !== undefined && !isNaN(v));
      return values.length > 0
        ? values.reduce((a, b) => a + b, 0) / values.length
        : 0;
    };

    const improved: string[] = [];
    const regressed: string[] = [];
    const stable: string[] = [];

    const metricsToCheck: (keyof QualityMetrics)[] = [
      'processingTime',
      'memoryUsage',
      'transcriptionAccuracy',
      'edgeCompleteness',
      'relationshipAccuracy',
    ];

    for (const metric of metricsToCheck) {
      const current = latest[metric] as number;
      const baseline_val = avgBaseline(metric);

      if (current === undefined || baseline_val === 0) continue;

      const change = ((current - baseline_val) / baseline_val) * 100;

      if (Math.abs(change) < 5) {
        stable.push(`${metric}: ${change.toFixed(1)}%`);
      } else if (
        (metric === 'processingTime' || metric === 'memoryUsage') ?
        change < 0 : change > 0
      ) {
        improved.push(`${metric}: ${change.toFixed(1)}% ${metric.includes('Time') || metric.includes('Usage') ? 'decrease' : 'increase'}`);
      } else {
        regressed.push(`${metric}: ${Math.abs(change).toFixed(1)}% ${metric.includes('Time') || metric.includes('Usage') ? 'increase' : 'decrease'}`);
      }
    }

    return { improved, regressed, stable };
  }

  /**
   * Set current phase/iteration for tracking
   */
  setPhaseIteration(phase: string, iteration: number): void {
    this.currentPhase = phase;
    this.currentIteration = iteration;
  }

  /**
   * Reset monitor (for testing)
   */
  reset(): void {
    this.metricsHistory = [];
    this.iterationHistory = [];
    this.currentIteration = 1;
  }
}

/**
 * Convenience function to get global monitor instance
 */
export function getQualityMonitor(): QualityMonitor {
  return QualityMonitor.getInstance();
}

/**
 * Helper to create quality report string for logging
 */
export function formatQualityReport(report: QualityReport): string {
  let output = '\n';
  output += '╔════════════════════════════════════════════════════════════════╗\n';
  output += '║           📊 QUALITY ASSESSMENT REPORT                        ║\n';
  output += '╚════════════════════════════════════════════════════════════════╝\n\n';

  output += `Overall Score: ${report.overallScore}/100 (${report.status.toUpperCase()})\n`;
  output += `Improvement Potential: ${report.improvementPotential}/100\n\n`;

  if (report.violations.length > 0) {
    output += 'Violations:\n';
    for (const v of report.violations) {
      const icon = v.severity === 'critical' ? '🔴' :
                   v.severity === 'warning' ? '⚠️' : 'ℹ️';
      output += `  ${icon} ${v.metric}: ${v.actual.toFixed(2)} (expected: ${v.expected.toFixed(2)})\n`;
      output += `     Impact: ${v.impact}\n`;
      output += `     Fix: ${v.recommendation}\n\n`;
    }
  }

  output += 'Recommendations:\n';
  for (const rec of report.recommendations) {
    output += `  • ${rec}\n`;
  }

  output += '\n' + '='.repeat(70) + '\n';

  return output;
}
