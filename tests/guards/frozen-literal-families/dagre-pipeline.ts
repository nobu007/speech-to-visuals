import type { FrozenLiteralRule } from '../freeze-guard';

// Family file of the frozen-literal registry (round 35 split). The original
// rule doc blocks below are verbatim moves from the single-file registry —
// the registry policy and the ordered aggregation live in
// tests/guards/frozen-literal-rules.ts.

export const RULES: FrozenLiteralRule[] = [
  /**
   * Round 30 (dagre pipeline single-source): the ENTIRE dagre pipeline —
   * graph construction, TC-307 dangling-edge filter, layout run,
   * center→top-left node extraction, edge extraction with its straight-line
   * `??` fallback — was pasted byte-identical (modulo per-diagram graph
   * config) into the three dagre-based registered strategies
   * (flow LR 50/80, tree TB 60/100, flowchart TB 50/70). A drift at ONE
   * site corrupts only that diagram type — `dagreNode.x - w` instead of
   * `- w / 2` offsets every node by half its extent; a dropped `??` emits
   * `points: undefined` — while the other diagram types and every
   * shared-fixture test stay green. Canonical: runDagrePipeline in
   * src/visualization/dagre-pipeline.ts. Behavioral pins (verbatim legacy
   * oracle, delegation equality per strategy config, fallback-branch
   * coverage) live in tests/guards/dagre-pipeline-single-source.test.ts.
   *
   * NOT banned (legitimate other shapes, verified round 30): the v1 dagre
   * family — DagreLayoutStrategy.ts, FlowchartLayoutStrategy.ts, and the
   * flowchart/tree paths in enhanced-zero-overlap-layout.ts — reads extents
   * back from dagre (`dagreNode.x - dagreNode.width / 2`, no bare-local
   * operand), uses `||`/`?.points ||` instead of `??` for the points
   * fallback, and `edge.label || ''` for setEdge labels, so none of the
   * patterns below can match them; and test files (the walk skips
   * __tests__ and *.test.*, which is where the frozen verbatim oracle
   * lives). (Round 36 update: the v1 sites now DELEGATE that extraction to
   * dagre-node-extraction.ts — the shape note above documents why the v1
   * operand never matched, and the v1 re-roll ban is the round-36 family.)
   */
  {
    id: 'dagre pipeline extraction single-sourced in dagre-pipeline (round 30)',
    roots: ['src/visualization'],
    exclude: {
      'src/visualization/dagre-pipeline.ts': 'the canonical source itself',
    },
    patterns: [
      // center→top-left conversion re-rolled with a bare-local extent (the
      // v1 family's `dagreNode.width` operand does not match).
      /dagreNode\.x\s*-\s*w\s*\/\s*2/,
      /dagreNode\.y\s*-\s*h\s*\/\s*2/,
      // the `??` straight-line fallback for missing dagre points (v1 uses ||).
      /points:\s*dagreEdge\.points\s*\?\?/,
      // the `?? ''` label normalization on setEdge (v1 uses || '').
      /label:\s*edge\.label\s*\?\?\s*''/,
    ],
    minSweptFiles: 20,
  },
];
