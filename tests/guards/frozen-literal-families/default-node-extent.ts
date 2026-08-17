import type { FrozenLiteralRule } from '../freeze-guard';

// Family file of the frozen-literal registry (round 49). Registry policy and
// the ordered aggregation live in tests/guards/frozen-literal-rules.ts.

export const RULES: FrozenLiteralRule[] = [
  {
    id: 'default-fallback dimension resolution single-sourced in node-dimensions (round 49)',
    roots: ['src'],
    exclude: {
      'src/visualization/node-dimensions.ts':
        'canonical source — defaultNodeExtent (and getNodeWidth/getNodeHeight themselves)',
    },
    patterns: [
      // The DEFAULT-literal-argument resolution call re-rolled outside
      // defaultNodeExtent — in any of its retired spellings: the two-const
      // preamble, inline stamp property reads, or the per-node maxima
      // `Math.max(...nodes.map((n) => getNodeWidth(n, DEFAULT_NODE_WIDTH)))`.
      /getNodeWidth\([^()]*,\s*DEFAULT_NODE_WIDTH\)/,
      /getNodeHeight\([^()]*,\s*DEFAULT_NODE_HEIGHT\)/,
    ],
    minSweptFiles: 300,
  },
];
