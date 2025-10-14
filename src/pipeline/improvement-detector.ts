/**
 * Phase 27: Incremental Improvement Detector
 *
 * Autonomous system for detecting opportunities for improvement based on
 * quality metrics trends and historical performance data.
 *
 * Implements Custom Instructions principle: "動作→評価→改善→コミットの繰り返し"
 */

import { QualityMonitor, getQualityMonitor } from './quality-monitor';

export interface ImprovementOpportunity {
  area: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  currentValue: number;
  targetValue: number;
  confidence: number; // 0-1, how confident we are this is a real issue
  impact: string;
  suggestedActions: string[];
  estimatedEffort: 'minimal' | 'low' | 'moderate' | 'high';
  evidence: string[];
}

export interface ImprovementReport {
  timestamp: Date;
  overallHealth: 'excellent' | 'good' | 'needs_attention' | 'critical';
  opportunities: ImprovementOpportunity[];
  trends: {
    improving: string[];
    stable: string[];
    degrading: string[];
  };
  nextIterationFocus: string[];
}

/**
 * ImprovementDetector - Analyzes quality trends and suggests improvements
 *
 * Key capabilities:
 * 1. Trend Analysis: Detects performance degradation or improvement
 * 2. Bottleneck Detection: Identifies system bottlenecks
 * 3. Priority Scoring: Ranks improvement opportunities by impact
 * 4. Actionable Recommendations: Provides specific next steps
 */
export class ImprovementDetector {
  private qualityMonitor: QualityMonitor;

  constructor(qualityMonitor?: QualityMonitor) {
    this.qualityMonitor = qualityMonitor || getQualityMonitor();
  }

  /**
   * Generate comprehensive improvement report
   */
  generateReport(): ImprovementReport {
    const qualityReport = this.qualityMonitor.generateReport();
    const baseline = this.qualityMonitor.compareToBaseline();
    const opportunities = this.detectOpportunities();
    const trends = this.analyzeTrends();
    const overallHealth = this.assessOverallHealth(qualityReport, trends);

    const nextIterationFocus = this.prioritizeNextSteps(opportunities, trends);

    return {
      timestamp: new Date(),
      overallHealth,
      opportunities: opportunities.sort((a, b) => {
        // Sort by priority (critical > high > medium > low)
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        // Then by impact (confidence-weighted)
        return (b.confidence * 10) - (a.confidence * 10);
      }),
      trends,
      nextIterationFocus,
    };
  }

  /**
   * Detect improvement opportunities from quality metrics
   */
  private detectOpportunities(): ImprovementOpportunity[] {
    const opportunities: ImprovementOpportunity[] = [];
    const latestMetrics = this.qualityMonitor.getLatestMetrics();

    if (!latestMetrics) {
      return [];
    }

    // Check processing time
    if (latestMetrics.processingTime > 30000) {
      const severity = latestMetrics.processingTime > 60000 ? 'high' : 'medium';
      opportunities.push({
        area: 'Processing Speed',
        priority: severity,
        currentValue: latestMetrics.processingTime,
        targetValue: 25000,
        confidence: 0.9,
        impact: `Current processing time ${(latestMetrics.processingTime / 1000).toFixed(1)}s exceeds target 25s`,
        suggestedActions: [
          'Profile bottlenecks with performance.mark()',
          'Optimize LLM prompt length (Phase 26)',
          'Use Flash model more aggressively for simple content',
          'Enable parallel scene processing (Phase 14)',
        ],
        estimatedEffort: 'moderate',
        evidence: [
          `Last processing time: ${latestMetrics.processingTime}ms`,
          'Target: <30000ms (ideally <25000ms)',
        ],
      });
    }

    // Check memory usage
    if (latestMetrics.memoryUsage > 512) {
      opportunities.push({
        area: 'Memory Optimization',
        priority: latestMetrics.memoryUsage > 1024 ? 'high' : 'medium',
        currentValue: latestMetrics.memoryUsage,
        targetValue: 512,
        confidence: 0.85,
        impact: `High memory usage (${latestMetrics.memoryUsage.toFixed(0)}MB) may affect scalability`,
        suggestedActions: [
          'Implement cache size limits',
          'Stream large audio files instead of loading entirely',
          'Clear unused references after processing',
          'Use WeakMap for temporary data structures',
        ],
        estimatedEffort: 'moderate',
        evidence: [
          `Current memory: ${latestMetrics.memoryUsage.toFixed(0)}MB`,
          'Target: <512MB',
        ],
      });
    }

    // Check edge completeness (Phase 26 metric)
    if (latestMetrics.edgeCompleteness !== undefined && latestMetrics.edgeCompleteness < 0.7) {
      opportunities.push({
        area: 'Relationship Extraction',
        priority: latestMetrics.edgeCompleteness < 0.5 ? 'critical' : 'high',
        currentValue: latestMetrics.edgeCompleteness,
        targetValue: 0.85,
        confidence: 0.95,
        impact: `Low edge completeness (${(latestMetrics.edgeCompleteness * 100).toFixed(0)}%) results in incomplete diagrams`,
        suggestedActions: [
          'Review Phase 26 prompt for timeline edge inference',
          'Add few-shot examples for implicit relationships',
          'Implement two-pass extraction (entities first, then relationships)',
          'Use Gemini Pro for complex relationship texts',
        ],
        estimatedEffort: 'low',
        evidence: [
          `Current edge completeness: ${(latestMetrics.edgeCompleteness * 100).toFixed(0)}%`,
          'Phase 26 target: 88%+ (achieved in 4/5 tests)',
        ],
      });
    }

    // Check relationship accuracy (Phase 26)
    if (latestMetrics.relationshipAccuracy !== undefined && latestMetrics.relationshipAccuracy < 0.85) {
      opportunities.push({
        area: 'Relationship Accuracy',
        priority: 'medium',
        currentValue: latestMetrics.relationshipAccuracy,
        targetValue: 0.9,
        confidence: 0.8,
        impact: 'Inaccurate relationships confuse diagram interpretation',
        suggestedActions: [
          'Add validation step for extracted edges',
          'Cross-reference with knowledge base',
          'Implement confidence-based filtering',
        ],
        estimatedEffort: 'moderate',
        evidence: [
          `Current accuracy: ${(latestMetrics.relationshipAccuracy * 100).toFixed(0)}%`,
          'Target: >85%',
        ],
      });
    }

    // Check layout overlap (critical metric)
    if (latestMetrics.layoutOverlap > 0) {
      opportunities.push({
        area: 'Layout Quality',
        priority: 'critical',
        currentValue: latestMetrics.layoutOverlap,
        targetValue: 0,
        confidence: 1.0,
        impact: 'Visual overlap makes diagrams unreadable',
        suggestedActions: [
          'Debug Enhanced Zero Overlap Layout Engine',
          'Increase separation distance parameter',
          'Apply OverlapResolver as post-processing',
          'Check for edge cases in collision detection',
        ],
        estimatedEffort: 'high',
        evidence: [
          `Overlap count: ${latestMetrics.layoutOverlap}`,
          'Target: 0 (zero tolerance)',
        ],
      });
    }

    // Check error rate
    if (latestMetrics.errorCount > 0) {
      opportunities.push({
        area: 'Error Handling',
        priority: latestMetrics.errorCount >= 3 ? 'critical' : 'high',
        currentValue: latestMetrics.errorCount,
        targetValue: 0,
        confidence: 1.0,
        impact: 'Errors disrupt user experience and indicate system instability',
        suggestedActions: [
          'Review error logs for patterns',
          'Add more specific error handling',
          'Implement graceful degradation',
          'Add telemetry for error tracking',
        ],
        estimatedEffort: 'moderate',
        evidence: [
          `Error count: ${latestMetrics.errorCount}`,
          'Target: 0 errors',
        ],
      });
    }

    // Check cache hit rate
    if (latestMetrics.cacheHitRate !== undefined && latestMetrics.cacheHitRate < 0.5) {
      opportunities.push({
        area: 'Caching Efficiency',
        priority: 'low',
        currentValue: latestMetrics.cacheHitRate,
        targetValue: 0.7,
        confidence: 0.7,
        impact: 'Low cache hit rate increases LLM API costs and latency',
        suggestedActions: [
          'Analyze cache key strategy (Phase 26 uses v26 prefix)',
          'Implement semantic similarity-based cache lookup',
          'Pre-warm cache with common queries',
          'Increase cache TTL for stable content',
        ],
        estimatedEffort: 'low',
        evidence: [
          `Cache hit rate: ${(latestMetrics.cacheHitRate * 100).toFixed(0)}%`,
          'Target: >70%',
        ],
      });
    }

    // Check fallback usage
    if (latestMetrics.fallbackTriggered) {
      opportunities.push({
        area: 'System Reliability',
        priority: 'medium',
        currentValue: 1,
        targetValue: 0,
        confidence: 0.9,
        impact: 'Fallback indicates primary system failure',
        suggestedActions: [
          'Investigate root cause of fallback trigger',
          'Improve primary system robustness',
          'Add monitoring for fallback patterns',
          'Consider hybrid approach (primary + fallback voting)',
        ],
        estimatedEffort: 'moderate',
        evidence: [
          'Fallback was triggered in last execution',
          'Indicates primary analyzer/LLM failure',
        ],
      });
    }

    return opportunities;
  }

  /**
   * Analyze trends from historical metrics
   */
  private analyzeTrends(): {
    improving: string[];
    stable: string[];
    degrading: string[];
  } {
    const baseline = this.qualityMonitor.compareToBaseline();

    return {
      improving: baseline.improved.map(i => `${i} (trending up)`),
      stable: baseline.stable.map(s => `${s} (consistent)`),
      degrading: baseline.regressed.map(r => `${r} (needs attention)`),
    };
  }

  /**
   * Assess overall system health
   */
  private assessOverallHealth(
    qualityReport: any,
    trends: any
  ): ImprovementReport['overallHealth'] {
    const criticalViolations = qualityReport.violations.filter((v: any) => v.severity === 'critical');
    const degradingCount = trends.degrading.length;

    if (criticalViolations.length > 0 || degradingCount > 3) {
      return 'critical';
    }
    if (qualityReport.overallScore < 60 || degradingCount > 1) {
      return 'needs_attention';
    }
    if (qualityReport.overallScore < 85 || degradingCount > 0) {
      return 'good';
    }
    return 'excellent';
  }

  /**
   * Prioritize next steps for the next iteration
   */
  private prioritizeNextSteps(
    opportunities: ImprovementOpportunity[],
    trends: any
  ): string[] {
    const nextSteps: string[] = [];

    // Focus on critical issues first
    const critical = opportunities.filter(o => o.priority === 'critical');
    if (critical.length > 0) {
      nextSteps.push(`🚨 Address ${critical.length} critical issue(s): ${critical.map(c => c.area).join(', ')}`);
      critical.forEach(c => {
        nextSteps.push(`  → ${c.suggestedActions[0]}`); // Add top action for each critical issue
      });
    }

    // Then high-priority issues with quick wins
    const quickWins = opportunities.filter(
      o => o.priority === 'high' && o.estimatedEffort === 'low'
    );
    if (quickWins.length > 0) {
      nextSteps.push(`⚡ Quick wins available: ${quickWins.map(q => q.area).join(', ')}`);
    }

    // Monitor degrading trends
    if (trends.degrading.length > 0) {
      nextSteps.push(`📉 Monitor degrading metrics: ${trends.degrading.slice(0, 3).join(', ')}`);
    }

    // Continue improving areas
    if (trends.improving.length > 0) {
      nextSteps.push(`✅ Continue optimizing: ${trends.improving.slice(0, 2).join(', ')}`);
    }

    // If no issues, suggest proactive improvements
    if (nextSteps.length === 0) {
      nextSteps.push('✨ System performing well. Consider:');
      nextSteps.push('  → Stress testing with edge cases');
      nextSteps.push('  → Performance benchmarking');
      nextSteps.push('  → Documentation updates');
    }

    return nextSteps;
  }

  /**
   * Export report to markdown format
   */
  exportToMarkdown(report: ImprovementReport): string {
    let md = '# Improvement Detection Report\n\n';
    md += `**Generated**: ${report.timestamp.toISOString()}\n`;
    md += `**Overall Health**: ${report.overallHealth.toUpperCase()}\n\n`;

    md += '## Improvement Opportunities\n\n';
    if (report.opportunities.length === 0) {
      md += '*No significant improvement opportunities detected. System performing well.*\n\n';
    } else {
      for (const opp of report.opportunities) {
        const icon = opp.priority === 'critical' ? '🔴' :
                     opp.priority === 'high' ? '🟠' :
                     opp.priority === 'medium' ? '🟡' : '🟢';
        md += `### ${icon} ${opp.area} (${opp.priority.toUpperCase()})\n\n`;
        md += `**Impact**: ${opp.impact}\n\n`;
        md += `**Current**: ${opp.currentValue} | **Target**: ${opp.targetValue} | **Confidence**: ${(opp.confidence * 100).toFixed(0)}%\n\n`;
        md += '**Suggested Actions**:\n';
        for (const action of opp.suggestedActions) {
          md += `- ${action}\n`;
        }
        md += `\n**Estimated Effort**: ${opp.estimatedEffort}\n\n`;
        md += '**Evidence**:\n';
        for (const ev of opp.evidence) {
          md += `- ${ev}\n`;
        }
        md += '\n---\n\n';
      }
    }

    md += '## Trends\n\n';
    if (report.trends.improving.length > 0) {
      md += '### ✅ Improving\n';
      report.trends.improving.forEach(t => md += `- ${t}\n`);
      md += '\n';
    }
    if (report.trends.stable.length > 0) {
      md += '### ⚖️ Stable\n';
      report.trends.stable.forEach(t => md += `- ${t}\n`);
      md += '\n';
    }
    if (report.trends.degrading.length > 0) {
      md += '### 📉 Degrading\n';
      report.trends.degrading.forEach(t => md += `- ${t}\n`);
      md += '\n';
    }

    md += '## Next Iteration Focus\n\n';
    for (const step of report.nextIterationFocus) {
      md += `${step}\n`;
    }
    md += '\n';

    md += '---\n\n';
    md += '*Generated by Phase 27: Recursive Quality Improvement Framework*\n';

    return md;
  }
}

/**
 * Convenience function to get improvement detector
 */
export function getImprovementDetector(): ImprovementDetector {
  return new ImprovementDetector();
}
