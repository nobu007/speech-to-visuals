import type { FrozenLiteralRule } from '../freeze-guard';

// Family file of the frozen-literal registry (round 35 split). The original
// rule doc blocks below are verbatim moves from the single-file registry —
// the registry policy and the ordered aggregation live in
// tests/guards/frozen-literal-rules.ts.

export const RULES: FrozenLiteralRule[] = [
  /**
   * Round 27 (quality display tiers single-source): the 0–100 score→display
   * bars (90/70/50) lived as byte-identical getQualityColor twins in
   * FrameworkDashboard.tsx and PerformanceMetricsVisualization.tsx, plus the
   * same bars re-frozen in that file's getQualityBadge and its inline
   * `displayScore >= 90 ? 'Excellent' : …` label ternary (4 sites, 3 shapes).
   * A drifted bar at one site makes the two dashboards color the SAME score
   * differently. Canonical: src/lib/quality-display-tiers.ts. Banned shapes
   * are the bar+display-output COMBINATION — a bare `>= 90` is legitimate
   * elsewhere (pipeline-health-score / quality-monitor / continuous-learner
   * grade on intentionally different tuned bars; request-logger's is an HTTP
   * status code), and static tailwind tier classes without a score bar
   * (SimplePipelineInterface, EnhancedFileUploader) are unrelated styling.
   */
  {
    id: 'quality display tier bars (90/70/50) single-sourced in lib/quality-display-tiers (round 27)',
    roots: ['src'],
    exclude: {
      'src/lib/quality-display-tiers.ts': 'the canonical source itself',
    },
    patterns: [
      // score-bar → tailwind tier color class (getQualityColor shape, any bar).
      /(>=|<)\s*(90|70|50)\b[^'\n]*'text-(green|blue|yellow|red)-600/,
      // score-bar → badge variant (getQualityBadge shape, any bar).
      /(>=|<)\s*(90|70|50)\b[^'\n]*'(default|secondary|outline|destructive)'/,
      // score-bar → Excellent/Good label ternary.
      /(>=|<)\s*(90|70)\b[^'\n]*\?\s*'Excellent'/,
    ],
    minSweptFiles: 200,
  },
];
