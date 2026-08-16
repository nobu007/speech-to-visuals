import type { FrozenLiteralRule } from '../freeze-guard';

// Family file of the frozen-literal registry (round 35 split). The original
// rule doc blocks below are verbatim moves from the single-file registry —
// the registry policy and the ordered aggregation live in
// tests/guards/frozen-literal-rules.ts.

export const RULES: FrozenLiteralRule[] = [
  /**
   * Round 36 (v1 dagre node extraction single-source): the v1
   * center→top-left conversion block — spread the input node, subtract half
   * the DAGRE-assigned extents from dagre's center coords, echo those extents
   * into the deprecated `w`/`h` fields — was pasted byte-identical into the
   * four v1 dagre sites (strategies/DagreLayoutStrategy.applyLayout,
   * strategies/FlowchartLayoutStrategy.generateLayout, and the
   * flowchart/tree paths of enhanced-zero-overlap-layout.ts). The ezo sites
   * are live render paths (the simple pipeline instantiates
   * EnhancedZeroOverlapLayoutEngine). A re-rolled copy at one site corrupts
   * only that site's diagram type — `- dagreNode.width` instead of
   * `- dagreNode.width / 2` offsets every node by half its extent — while
   * the other sites and every shared-fixture test stay green. Canonical:
   * positionedFromDagre in src/visualization/dagre-node-extraction.ts.
   * Behavioral pins (verbatim legacy oracle, per-site delegation equality,
   * contract witnesses) live in
   * tests/guards/dagre-node-extraction-single-source.test.ts.
   *
   * NOT banned (verified round 36): the v2 pipeline in dagre-pipeline.ts —
   * its conversion re-reads extents via node-dimensions locals
   * (`x: dagreNode.x - w / 2`), so the `dagreNode.width` operand patterns
   * below cannot match it (that shape is the round-30 family, and the
   * v1/v2 boundary is pinned in the guard's layer 4). Residual escape
   * hatch, documented as in rounds 33-35: a re-roll that renames the local
   * (`n.x - n.width / 2`) evades these patterns — it is behavior-equivalent
   * duplication only, and the guard's delegation-equality + source-anchor
   * layers are the layer that catches it.
   */
  {
    id: 'v1 dagre node extraction single-sourced in dagre-node-extraction (round 36)',
    roots: ['src/visualization'],
    exclude: {
      'src/visualization/dagre-node-extraction.ts': 'the canonical source itself',
    },
    patterns: [
      // center→top-left re-rolled against the dagre-assigned extent (the v2
      // local-operand shape `dagreNode.x - w / 2` does not match).
      /x:\s*dagreNode\.x\s*-\s*dagreNode\.width\s*\/\s*2/,
      /y:\s*dagreNode\.y\s*-\s*dagreNode\.height\s*\/\s*2/,
      // the deprecated extent echo re-rolled at a call site.
      /w:\s*dagreNode\.width\s*,/,
      /h:\s*dagreNode\.height\s*,/,
    ],
    minSweptFiles: 20,
  },
];
