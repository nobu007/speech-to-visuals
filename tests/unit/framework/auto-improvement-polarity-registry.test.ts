/**
 * Closed-set polarity contract for the AutoImprovementEngine registry.
 *
 * `AutoImprovementEngine.LOWER_IS_BETTER_METRICS` (src/framework/auto-improvement-engine.ts)
 * decides, per QualityMetrics field, whether createImprovementExecutor should
 * REDUCE the value (lower-is-better) or INCREASE it (higher-is-better), and
 * whether runImprovementCycle must flip the delta sign to read
 * positive-when-better. A misclassification inverts an "improvement" into a
 * regression: the executor moves the metric the wrong way AND the cycle reports
 * `success: true` while the metric got worse — the same polarity-inversion class
 * as the trend→health bug (7ae31177) and the two QualityMetrics registries
 * (4659753b, b955c93f).
 *
 * This third registry previously lived as an untyped `private static Set<string>`
 * with NO closed-set guard, so a new lower-is-better metric added to
 * QualityMetrics silently fell through to the higher-is-better default. This
 * file pins it as a complete, disjoint partition of every QualityMetrics field,
 * mirroring tests/unit/pipeline/quality-metric-polarity-registry.test.ts, so
 * adding a metric REQUIRES a polarity decision in exactly one place.
 */

import { AutoImprovementEngine, type QualityMetrics } from '@/framework/auto-improvement-engine';

/**
 * The complete roster of the engine's QualityMetrics fields. Unlike the pipeline
 * QualityMetrics, EVERY field here is numeric and polarity-relevant (there is no
 * `timestamp` / `phase` / `iteration` metadata field), so all twelve are
 * partitioned. Typed `(keyof QualityMetrics)[]` so a typo or a key that is not a
 * real field is a compile-time error.
 */
const NUMERIC_METRIC_KEYS: (keyof QualityMetrics)[] = [
  'processingTime',
  'memoryUsage',
  'throughput',
  'transcriptionAccuracy',
  'sceneSegmentationF1',
  'entityExtractionF1',
  'relationAccuracy',
  'layoutOverlap',
  'nodeOverflow',
  'danglingLayoutEdges',
  'errorRate',
  'successRate',
  'crashCount',
  'overallScore',
];

/** The complement: metrics where a HIGHER value is better. */
const HIGHER_IS_BETTER = new Set<keyof QualityMetrics>([
  'throughput',
  'transcriptionAccuracy',
  'sceneSegmentationF1',
  'entityExtractionF1',
  'relationAccuracy',
  'successRate',
  'overallScore',
]);

describe('AutoImprovementEngine.LOWER_IS_BETTER_METRICS (polarity registry)', () => {
  const LOWER = AutoImprovementEngine.LOWER_IS_BETTER_METRICS;

  it('partitions every QualityMetrics field into exactly one polarity bucket', () => {
    const lower = [...LOWER];

    // Disjoint: no metric is classified as both lower- and higher-is-better.
    for (const m of lower) {
      expect(HIGHER_IS_BETTER.has(m)).toBe(false);
    }

    // Complete: every field is classified.
    const classified = new Set<keyof QualityMetrics>([...lower, ...HIGHER_IS_BETTER]);
    for (const key of NUMERIC_METRIC_KEYS) {
      expect(classified.has(key)).toBe(true);
    }

    // No extras: every registry entry is a real QualityMetrics field.
    for (const m of lower) {
      expect(NUMERIC_METRIC_KEYS).toContain(m);
    }
  });

  it('lists the cost/health metrics as lower-is-better (0 is the good end)', () => {
    // processingTime/memoryUsage: less resource use is better.
    // layoutOverlap/nodeOverflow/danglingLayoutEdges: 0 = perfect; more layout
    // defects (overlaps, off-canvas nodes, dangling edges) is worse.
    // errorRate/crashCount: fewer failures is better. Omitting any one inverts
    // its "improvement" into a regression — the core bug class.
    expect(LOWER.has('processingTime')).toBe(true);
    expect(LOWER.has('memoryUsage')).toBe(true);
    expect(LOWER.has('layoutOverlap')).toBe(true);
    expect(LOWER.has('nodeOverflow')).toBe(true);
    expect(LOWER.has('danglingLayoutEdges')).toBe(true);
    expect(LOWER.has('errorRate')).toBe(true);
    expect(LOWER.has('crashCount')).toBe(true);
  });

  it('does NOT list accuracy/throughput/score metrics as lower-is-better', () => {
    // These are higher-is-better; they must be absent so the default branch
    // classifies an increase as an improvement.
    expect(LOWER.has('throughput')).toBe(false);
    expect(LOWER.has('transcriptionAccuracy')).toBe(false);
    expect(LOWER.has('successRate')).toBe(false);
    expect(LOWER.has('overallScore')).toBe(false);
  });
});
