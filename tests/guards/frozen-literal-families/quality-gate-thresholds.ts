import type { FrozenLiteralRule } from '../freeze-guard';

// Family file of the frozen-literal registry (round 35 split). The original
// rule doc blocks below are verbatim moves from the single-file registry —
// the registry policy and the ordered aggregation live in
// tests/guards/frozen-literal-rules.ts.

export const THRESHOLD_DEFAULTS: FrozenLiteralRule[] = [
  /**
   * Round 7: quality-gate threshold defaults (ratios 0.85/0.75/0.80/0.70,
   * renderTime 30000, memoryUsage 512) live only in quality-thresholds.ts.
   * Patterns are scoped per KEY so metric-shaped lines do not false-positive
   * (`memoryUsage: 0.85` is a stubbed score, not a byte budget — round 7
   * lesson). `layoutOverlap: 0` is the documented disable sentinel and is
   * intentionally not swept (0 is indistinguishable from metric-zero).
   * Both field-NAME spellings of the relation variant are covered.
   */
  {
    id: 'quality-gate threshold defaults single-sourced in quality-thresholds',
    roots: ['src'],
    exclude: {
      'src/framework/quality-thresholds.ts': 'the canonical source itself',
    },
    patterns: [
      /^\s*(?:transcriptionAccuracy|sceneSegmentationF1|entityExtractionF1|relationAccuracy|relationshipAccuracy|edgeCompleteness|edgeRatioQuality)\s*:\s*(?:0\.85|0\.75|0\.80|0\.70)\s*[,})]/,
      /^\s*renderTime\s*:\s*30000\s*[,})]/,
      /^\s*memoryUsage\s*:\s*512\s*[,})*/]/,
    ],
  },
];

export const THRESHOLD_BARS: FrozenLiteralRule[] = [
  /**
   * Round 25 (quality-gate threshold BARS at consumer sites): round 7 froze
   * the threshold defaults' DECLARATION shape (`KEY: VALUE`) — guards go
   * stale by SHAPE, and the comparison sites kept re-freezing the same bars
   * as bare literals. improvement-detector reads the very QualityMonitor
   * whose threshold table delegates to quality-thresholds, yet re-froze all
   * five bars; recursive-custom-instructions:310 hardcoded the bar its own
   * constant import was sitting next to; main-pipeline's stage gates and
   * continuous-learner's anomaly bar did the same. Banned shapes: the
   * metric-vs-literal comparisons, the adaptive-gate `threshold: 0.85`
   * object member, the `minAccuracy` stage-gate members, and the
   * evidence-string/targetValue echoes (30000ms / 512MB / 85%).
   *
   * NOT banned (different concepts, verified round 25): severity TIERS above
   * the bars (`> 60000`, `> 1024`), aspiration targetValues (`0.9`, `0.85`,
   * `25000`, `0`), main-pipeline's stage `maxTime` timeouts (30000/15000/
   * 10000/20000 ms budgets, not the render-time bar), the layout/preparation
   * stage minAccuracy literals (1.0 / 0.9 — no canonical counterpart), and
   * recursive-custom-instructions' stubbed QualityCheckResults heuristic
   * cutoffs (0.8/0.9). The `// 85%`-style trailing comments were removed
   * with the literals — the freeze-guard skips comment-only lines, so
   * comment-quoting a banned value would be invisible to the sweep.
   */
  {
    id: 'quality-gate threshold bars single-sourced in quality-thresholds (round 25)',
    roots: ['src'],
    exclude: {
      'src/framework/quality-thresholds.ts': 'the canonical source itself',
    },
    patterns: [
      // Metric-vs-literal comparison shape (improvement-detector + learner).
      /\bprocessingTime\s*>\s*30000\b/,
      /\bmemoryUsage\s*>\s*512\b/,
      /\bedgeCompleteness\s*<\s*0\.7\b/,
      /\brelationshipAccuracy\s*<\s*0\.85\b/,
      /\blayoutOverlap\s*>\s*0\b/,
      /\baccuracy\s*<\s*0\.85\b/,
      // Adaptive-gate object member (src/quality).
      /threshold:\s*0\.85\b/,
      // Stage-gate object members (main-pipeline).
      /\bminAccuracy\s*:\s*0\.85\b/,
      /\bminAccuracy\s*:\s*0\.75\b/,
      // Evidence-string / targetValue echoes of the same bars.
      /Target: <30000ms/,
      /Target: <512MB/,
      /Target: >85%/,
      /\btargetValue:\s*512\b/,
    ],
    minSweptFiles: 200,
  },
];
