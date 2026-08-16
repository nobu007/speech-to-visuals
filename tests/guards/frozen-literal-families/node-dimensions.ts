import type { FrozenLiteralRule } from '../freeze-guard';

// Family file of the frozen-literal registry (round 35 split). The original
// rule doc blocks below are verbatim moves from the single-file registry —
// the registry policy and the ordered aggregation live in
// tests/guards/frozen-literal-rules.ts.

export const RULES: FrozenLiteralRule[] = [
  /**
   * Round 6: DEFAULT_NODE_WIDTH/HEIGHT (120/60) live only in
   * node-dimensions.ts. Banned sibling shapes: object literal
   * (`nodeHeight: 60`), local const, and `||` fallback. Per-diagram-type
   * tuned dimensions (advanced-layouts 100/50, 140/70; FallbackLayoutStrategy
   * 140/line-47 80) and `nodeSeparation: 60` are different concepts and do
   * NOT match these shapes.
   */
  {
    id: 'node dimensions (120/60) single-sourced in node-dimensions',
    roots: ['src/visualization'],
    exclude: {
      'src/visualization/node-dimensions.ts': 'the canonical source itself',
    },
    patterns: [/nodeWidth\s*(:|=|\|\|)\s*120\b/, /nodeHeight\s*(:|=|\|\|)\s*60\b/],
  },
];
