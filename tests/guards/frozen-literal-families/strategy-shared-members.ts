import type { FrozenLiteralRule } from '../freeze-guard';

// Family file of the frozen-literal registry (round 35 split). The original
// rule doc blocks below are verbatim moves from the single-file registry —
// the registry policy and the ordered aggregation live in
// tests/guards/frozen-literal-rules.ts.

export const RULES: FrozenLiteralRule[] = [
  {
    id: 'v1 strategy shared members single-sourced in strategy-common (round 31)',
    roots: ['src/visualization'],
    exclude: {
      'src/visualization/strategy-common.ts': 'the canonical source itself',
    },
    patterns: [
      // validateInputs re-rolled: the log literals are the family's only
      // stable anchor (everything else is generic control flow).
      /Duplicate node IDs detected/,
      /No nodes to layout/,
      // the label-width tail re-wired outside the canonical delegation
      // (round 10 froze the constants; round 31 froze the call shape).
      /charWidth:\s*DEFAULT_CHAR_WIDTH/,
      // the explicit-dimension-first preamble re-rolled at a strategy.
      // (Tree's height twin delegated to layout-utils resolveNodeHeight in
      // round 37 — see the explicit-dimension-sizing family for the
      // height-variant pattern.)
      /explicitWidth\s*=\s*node\.width/,
    ],
    minSweptFiles: 20,
  },
];
