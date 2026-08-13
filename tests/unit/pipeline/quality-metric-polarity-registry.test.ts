/**
 * Closed-set polarity contract for the QualityMetrics registry.
 *
 * `LOWER_IS_BETTER_QUALITY_METRICS` (src/pipeline/quality-monitor.ts) is the
 * cross-module single source of truth that BOTH QualityMonitor.compareToBaseline
 * AND RegressionDetector.detectRegressions derive their metric polarity from.
 * This file pins it as a complete, disjoint partition of every numeric
 * QualityMetrics field, so that:
 *
 *  - the registry cannot silently omit a genuinely-lower-is-better metric
 *    (the memoryUsage / layoutOverlap / errorCount / warningCount inversion
 *    class — a metric whose value rising is GOOD but is classified as bad, or
 *    vice versa), and
 *  - adding a new metric REQUIRES a polarity decision in exactly one place.
 *
 * This is the structural backstop for the recurring name-substring /
 * duplicate-formula polarity bug class (7ae31177, 4659753b).
 */

import { LOWER_IS_BETTER_QUALITY_METRICS, type QualityMetrics } from '@/pipeline/quality-monitor';

/**
 * The complete roster of NUMERIC quality-relevant fields on QualityMetrics.
 *
 * Typed `(keyof QualityMetrics)[]` so a typo or a key that is not a real
 * QualityMetrics field is a compile-time error. `iteration` is a run counter
 * (metadata, not a polarity-relevant metric) and `timestamp` / `phase` /
 * `fallbackTriggered` are non-numeric, so all four are deliberately excluded.
 */
const NUMERIC_METRIC_KEYS: (keyof QualityMetrics)[] = [
  'processingTime',
  'memoryUsage',
  'cacheHitRate',
  'transcriptionAccuracy',
  'sceneSegmentationF1',
  'entityExtractionF1',
  'relationshipAccuracy',
  'layoutOverlap',
  'edgeCompleteness',
  'edgeRatioQuality',
  'confidenceScore',
  'errorCount',
  'warningCount',
];

/** The complement: numeric metrics where a HIGHER value is better. */
const HIGHER_IS_BETTER = new Set<keyof QualityMetrics>([
  'cacheHitRate',
  'transcriptionAccuracy',
  'sceneSegmentationF1',
  'entityExtractionF1',
  'relationshipAccuracy',
  'edgeCompleteness',
  'edgeRatioQuality',
  'confidenceScore',
]);

describe('LOWER_IS_BETTER_QUALITY_METRICS (QualityMetrics polarity registry)', () => {
  it('partitions every numeric metric into exactly one polarity bucket', () => {
    const lower = [...LOWER_IS_BETTER_QUALITY_METRICS];

    // Disjoint: no metric is classified as both lower- and higher-is-better.
    for (const m of lower) {
      expect(HIGHER_IS_BETTER.has(m)).toBe(false);
    }

    // Complete: every numeric metric is classified.
    const classified = new Set<keyof QualityMetrics>([...lower, ...HIGHER_IS_BETTER]);
    for (const key of NUMERIC_METRIC_KEYS) {
      expect(classified.has(key)).toBe(true);
    }

    // No extras: every registry entry is a real numeric metric.
    for (const m of lower) {
      expect(NUMERIC_METRIC_KEYS).toContain(m);
    }
  });

  it('lists the count/health metrics as lower-is-better (0 is the good end)', () => {
    // layoutOverlap is documented "count (0 is perfect)"; error/warning counts
    // are System Health. An increase in any of these is a REGRESSION, so each
    // must be in the lower-is-better set. Omitting any one inverts its polarity
    // and reports a degradation as an improvement — the core bug class.
    expect(LOWER_IS_BETTER_QUALITY_METRICS.has('layoutOverlap')).toBe(true);
    expect(LOWER_IS_BETTER_QUALITY_METRICS.has('errorCount')).toBe(true);
    expect(LOWER_IS_BETTER_QUALITY_METRICS.has('warningCount')).toBe(true);
  });

  it('lists the core cost metrics as lower-is-better', () => {
    expect(LOWER_IS_BETTER_QUALITY_METRICS.has('processingTime')).toBe(true);
    expect(LOWER_IS_BETTER_QUALITY_METRICS.has('memoryUsage')).toBe(true);
  });

  it('does NOT list accuracy/coverage metrics as lower-is-better', () => {
    // These are 0-1 ratios where higher is better; they must be absent so the
    // default (higher-is-better) branch classifies a rise as an improvement.
    expect(LOWER_IS_BETTER_QUALITY_METRICS.has('transcriptionAccuracy')).toBe(false);
    expect(LOWER_IS_BETTER_QUALITY_METRICS.has('entityExtractionF1')).toBe(false);
    expect(LOWER_IS_BETTER_QUALITY_METRICS.has('edgeCompleteness')).toBe(false);
    expect(LOWER_IS_BETTER_QUALITY_METRICS.has('cacheHitRate')).toBe(false);
  });
});
