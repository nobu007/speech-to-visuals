import type { FrozenLiteralRule } from '../freeze-guard';

// Family file of the frozen-literal registry (round 35 split; round 37
// family). The registry policy and the ordered aggregation live in
// tests/guards/frozen-literal-rules.ts.

export const RULES: FrozenLiteralRule[] = [
  {
    id: 'explicit-dimension sizing single-sourced in layout-utils (round 37)',
    roots: ['src/visualization'],
    exclude: {
      'src/visualization/layout-utils.ts': 'the canonical source itself',
    },
    patterns: [
      // The explicit-first preamble re-rolled outside resolveNodeWidth /
      // resolveNodeHeight. Round 31 froze the width variant for the strategy
      // family; round 37 promoted BOTH variants to the canonical in
      // layout-utils (ezo joined; Tree's height twin delegates).
      /node\.width \?\? \(node as NodeDatum/,
      /node\.height \?\? \(node as NodeDatum/,
      // The pre-round-37 ezo sizing call re-introduced at an engine site —
      // the exact call that placed width-400 nodes as ≤240px boxes.
      /calculateNodeWidth\(node, \{ nodeWidth: this\.config\.nodeWidth/,
      /calculateNodeHeight\(node, \{ nodeWidth: this\.config\.nodeWidth/,
    ],
    minSweptFiles: 20,
  },
];
