/**
 * Single source for the v1 dagre center→top-left node extraction (round 36).
 *
 * Before this module, the conversion block below was pasted byte-identical
 * into the four v1 dagre sites:
 *   - strategies/DagreLayoutStrategy.ts   (applyLayout — v1 engine path)
 *   - strategies/FlowchartLayoutStrategy.ts (generateLayout)
 *   - enhanced-zero-overlap-layout.ts generateFlowchartLayout
 *   - enhanced-zero-overlap-layout.ts generateTreeLayout
 *
 * Round 30 single-sourced the *v2* pipeline (dagre-pipeline.ts) and
 * deliberately left these four alone: the v1 family returns DiagramLayout,
 * reads extents back from dagre (`dagreNode.width`, not a node-dimensions
 * re-read), and emits the deprecated `w`/`h` fields — a genuinely different
 * conversion shape that must NOT be merged into the v2 one. Round 36 now
 * single-sources the v1 shape on its own terms.
 *
 * The block is the SAME concept at all four sites: identical laid-out graphs
 * must convert to identical top-left PositionedNodes. A re-rolled copy at one
 * site corrupts only that site's diagram type — `dagreNode.x - dagreNode.width`
 * instead of `- dagreNode.width / 2` offsets every node by half its extent
 * while the other sites and every shared-fixture test stay green. That is the
 * latent-desync shape this campaign freezes.
 *
 * Zero-delta extraction: the body moved VERBATIM; only the four call sites
 * changed. The EnhancedZeroOverlapLayoutEngine alias is the layout engine the
 * simple pipeline instantiates (src/pipeline/simple-pipeline.ts), so the ezo
 * sites are live render paths, not dead code.
 *
 * Guarded by tests/guards/dagre-node-extraction-single-source.test.ts
 * (verbatim legacy oracle, delegation equality per site graph, contract
 * witnesses, source anchors) and the round-36 entry in
 * tests/guards/frozen-literal-families/dagre-node-extraction.ts.
 */

import { NodeDatum, PositionedNode } from '@/types/diagram';

/**
 * The slice of a laid-out dagre graph that the extraction reads. Structural
 * on purpose: a real `dagre.graphlib.Graph` (node(): any) satisfies it, and
 * the oracle tests can drive it with a plain stub.
 */
export interface DagreGraphGeometry {
  node(id: string): { x: number; y: number; width: number; height: number };
}

/**
 * Convert dagre's CENTER coordinates to the top-left convention and echo the
 * extents DAGRE assigned — the input node's own `width`/`height` fields are
 * NOT consulted for `w`/`h` (that re-read is the v2 contract, do not unify).
 */
export function positionedFromDagre(
  g: DagreGraphGeometry,
  nodes: NodeDatum[],
): PositionedNode[] {
  return nodes.map(node => {
    const dagreNode = g.node(node.id);
    return {
      ...node,
      x: dagreNode.x - dagreNode.width / 2,
      y: dagreNode.y - dagreNode.height / 2,
      w: dagreNode.width,
      h: dagreNode.height
    };
  });
}
