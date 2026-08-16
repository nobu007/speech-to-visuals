import type { FrozenLiteralRule } from '../freeze-guard';

// Family file of the frozen-literal registry (round 42). Registry policy and
// the ordered aggregation live in tests/guards/frozen-literal-rules.ts.

export const RULES: FrozenLiteralRule[] = [
  /**
   * Round 42 (specs/speech-to-visuals round-42 record): the importance-tree
   * strategy PREAMBLE — undirected adjacency, importance-boosted root
   * selection, importance-scaled extents, the single-node centered epilogue —
   * must delegate to src/visualization/strategy-graph.ts
   * (buildUndirectedAdjacency / findImportanceRoot / scaledNodeExtent /
   * singleNodeCenteredLayout). The mindmap and conceptmap strategies carried
   * the first three as byte-identical copy-paste pairs (and network pasted
   * the sizing idiom), so one strategy's root rule or scale formula could
   * silently disagree with the other's on the SAME diagram — invisible to
   * per-strategy suites because each copy serves a different diagram type.
   *
   * Banned shapes are the retired inline tells: the undirected degree fold,
   * the reciprocal adjacency push, the epilogue's scale read on nodes[0],
   * and the 3-line sizing idiom's width line (height is the same shape one
   * line down; one tell suffices). Legitimate near-misses do NOT match:
   * conceptmap's level-width packing reads `getNodeWidth(node ?? { width: 0,
   * w: 0 }, …) * scale` (different argument shape), mindmap's branchWeights
   * is a bare `importanceSizeScale(n) : 1` weight (no Math.round, no
   * extent read), and the DIRECTED degree folds (flow-strategy in-degree,
   * tree-strategy hasIncoming) never touch `edge.to` twice. Delegation pins
   * per site live in strategy-graph-preamble-single-source.test.ts.
   */
  {
    id: 'strategy-graph preamble: no re-inlined adjacency/root/sizing outside strategy-graph',
    roots: ['src'],
    exclude: {
      'src/visualization/strategy-graph.ts':
        'canonical source — the four preamble shapes beside the extent-composition scaledDimensions wiring',
    },
    patterns: [
      /degree\.get\(edge\.to\)/,
      /adj\.get\(edge\.to\)\?\.push\(edge\.from\)/,
      /importanceSizeScale\(nodes\[0\]\)/,
      /Math\.round\(getNodeWidth\((node|nodes\[0\]), DEFAULT_NODE_WIDTH\) \* scale\)/,
    ],
    minSweptFiles: 300,
  },
];
