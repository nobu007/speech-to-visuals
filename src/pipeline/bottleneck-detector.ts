/**
 * TASK-0143: Bottleneck Detector (REQ-097)
 *
 * Analyzes stage timing metrics to identify pipeline bottlenecks.
 * A stage consuming >= 40% of total processing time is flagged as a bottleneck.
 */

import { StageTimingRecord } from './stage-timing-metrics';

/** Severity of a detected bottleneck */
export type BottleneckSeverity = 'none' | 'warning' | 'critical';

/** Information about a detected bottleneck */
export interface BottleneckInfo {
  stageName: string;
  durationMs: number;
  percentOfTotal: number;
  severity: BottleneckSeverity;
  message: string;
}

/** Full bottleneck analysis report */
export interface BottleneckReport {
  timestamp: number;
  stages: BottleneckInfo[];
  /** The most severe bottleneck, or null if none */
  worstBottleneck: BottleneckInfo | null;
  hasBottleneck: boolean;
  summary: string;
}

/** Threshold (as fraction of total) above which a stage is considered a bottleneck */
const BOTTLENECK_THRESHOLD = 0.40;

/**
 * Classify bottleneck severity based on the percentage of total time.
 * - >= 60% → critical
 * - >= 40% → warning
 * - < 40% → none
 */
export function classifyBottleneck(percentOfTotal: number): BottleneckSeverity {
  if (percentOfTotal >= 0.60) return 'critical';
  if (percentOfTotal >= BOTTLENECK_THRESHOLD) return 'warning';
  return 'none';
}

/**
 * Analyze stage timing records and produce a bottleneck report.
 * Each stage's share of total time is computed, and stages above
 * the 40% threshold are flagged.
 */
export function detectBottlenecks(stages: StageTimingRecord[]): BottleneckReport {
  const totalDurationMs = stages.reduce((s, r) => s + (Number.isFinite(r.durationMs) ? r.durationMs : 0), 0);

  const stageInfos: BottleneckInfo[] = stages.map((stage) => {
    const percentOfTotal = totalDurationMs > 0 ? stage.durationMs / totalDurationMs : 0;
    const severity = classifyBottleneck(percentOfTotal);
    const message = severity === 'none'
      ? `${stage.stageName}: ${stage.durationMs}ms (${(percentOfTotal * 100).toFixed(1)}% of total)`
      : `BOTTLENECK ${severity.toUpperCase()}: ${stage.stageName} takes ${stage.durationMs}ms — ${(percentOfTotal * 100).toFixed(1)}% of total pipeline time`;

    return {
      stageName: stage.stageName,
      durationMs: stage.durationMs,
      percentOfTotal,
      severity,
      message,
    };
  });

  // Find the worst bottleneck (highest severity, then highest percentage)
  const bottlenecks = stageInfos.filter(s => s.severity !== 'none');
  const worstBottleneck = bottlenecks.length > 0
    ? bottlenecks.reduce((worst, current) =>
        current.percentOfTotal > worst.percentOfTotal ? current : worst,
      )
    : null;

  const hasBottleneck = bottlenecks.length > 0;

  const summary = hasBottleneck
    ? `Bottleneck detected: ${worstBottleneck!.stageName} at ${(worstBottleneck!.percentOfTotal * 100).toFixed(1)}% (${worstBottleneck!.severity})`
    : 'No bottleneck detected — all stages within acceptable thresholds';

  return {
    timestamp: Date.now(),
    stages: stageInfos,
    worstBottleneck,
    hasBottleneck,
    summary,
  };
}
