import type { FrozenLiteralRule } from '../freeze-guard';

// Family file of the frozen-literal registry (round 35 split). The original
// rule doc blocks below are verbatim moves from the single-file registry —
// the registry policy and the ordered aggregation live in
// tests/guards/frozen-literal-rules.ts.

export const RULES: FrozenLiteralRule[] = [
  /**
   * Round 11: default layout spacing values (nodeSeparation 50,
   * edgeSeparation 10, rankSeparation 50, margin 50) live only in
   * layout-spacing.ts. Banned shapes cover default-config object literals,
   * local consts, and the `|| 50` / `|| 10` partial-config fallbacks in dagre
   * setup, the network sizer, the timeline margins, and the layout worker.
   * NOT swept (different concepts, stay literal): per-diagram-type TUNED
   * separations (Tree/Timeline 80, Comparison 70, Network 60, Flowchart rank
   * 70, Tree rank 100/`|| 100`), and the src/visualization/layout strategy
   * system's own base config — that system deliberately defaults
   * nodeSeparation to 30 (pinned by src/test/layout/LayoutStrategy.test.ts),
   * so its equal-valued 10/50s belong to a different default set.
   */
  {
    id: 'layout spacing defaults (50/10/50/50) single-sourced in layout-spacing',
    roots: ['src/visualization', 'src/workers'],
    exclude: {
      'src/visualization/layout-spacing.ts': 'the canonical source itself',
      'src/visualization/layout/strategies/LayoutStrategy.ts':
        'separate default-config system (nodeSeparation 30, pinned by src/test/layout/LayoutStrategy.test.ts)',
    },
    patterns: [
      /\b(nodeSeparation|edgeSeparation|rankSeparation|marginX|marginY)\s*(:|=)\s*(50|10)\b/,
      /\b(nodeSeparation|edgeSeparation|rankSeparation|marginX|marginY)\s*\|\|\s*(50|10)\b/,
    ],
    minSweptFiles: 30,
  },
];
