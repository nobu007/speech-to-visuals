/**
 * Single source for the v2 strategy edge builders (round 32).
 *
 * Before this module, every non-dagre registered strategy hand-rolled the
 * SAME edge-construction skeleton — nodeMap over the positioned nodes, a
 * dangling-endpoint fallback, and the LayoutEdge assembly — with only the
 * anchor geometry varying:
 *
 *   - matrix-strategy.ts    buildLayoutEdges  (center→center)
 *   - general-strategy.ts   inline in apply   (center→center)
 *   - cycle-strategy.ts     generateEdges     (center→center, width fallback 0)
 *   - conceptmap-strategy.ts buildEdges       (center→center, fallback lost `id`)
 *   - network-strategy.ts   buildEdges        (center→center, fallback lost `id`)
 *   - mindmap-strategy.ts   generateEdges     (center anchors, NO fallback branch)
 *   - timeline-strategy.ts  buildLayoutEdges  (bottom-center→top-center)
 *   - comparison-strategy.ts inline in apply  (side anchors, pair-dependent)
 *
 * The skeleton is the SAME concept at all eight sites: an edge whose
 * endpoints survive positioning must get exactly two anchor points, and an
 * edge referencing an unknown node must get `points: []`. The copies had
 * already drifted in exactly that invariant — three divergences this round
 * freezes (behavior changes, pinned by the guard's delta oracles):
 *
 *   1. conceptmap/network dangling edges DROPPED `edge.id` (six of eight
 *      sites preserve it), so a dangling edge lost its identity in two
 *      diagram types while keeping it in the rest.
 *   2. mindmap had NO fallback branch: a dangling edge got PHANTOM geometry
 *      (near the canvas origin via `?? 0` + half a default node) instead of
 *      `points: []` — a bogus line to nowhere, the same shape TC-307 killed
 *      on the dagre path.
 *   3. cycle's anchors read `getNodeWidth(node, 0)` (fallback 0, not
 *      DEFAULT_NODE_WIDTH) — dead for cycle's own positioned nodes (always
 *      finite), but NaN-unsafe as a shared shape.
 *
 * What is intentionally NOT here (different concepts, do not merge):
 *   - The dagre edge extraction (runDagrePipeline) — dagre supplies its own
 *     points; only its straight-line fallback shares the `??` spirit.
 *   - The `{ ...edge, points: [] }` spread fallbacks in the v1 engine family
 *     (GridSnap/SimulatedAnnealing/ProgressiveForce/enhanced-zero-overlap)
 *     — they COPY the input edge and blank the points, preserving arbitrary
 *     extra fields; a different contract from constructing a LayoutEdge.
 *   - GridSnapFallbackStrategy (strategy-selector.ts) — deliberately emits
 *     NO geometry at all (every edge `points: []`, no anchors), not a
 *     per-pair anchored builder.
 *   - The anchor geometry itself when it is strategy-specific: timeline's
 *     vertical anchors and comparison's side anchors stay in their strategy
 *     files as anchor functions; only the repeated center→center anchor
 *     (6 sites) lives here.
 *
 * Guarded by tests/guards/v2-strategy-edge-builder-single-source.test.ts
 * (verbatim legacy-inline oracles, dangling-shape pins, source anchors) and
 * the round-32 entry in tests/guards/frozen-literal-rules.ts (no site
 * re-rolls the skeleton).
 */

import { EdgeDatum, PositionedNode, LayoutEdge } from '@/types/diagram';
import { getNodeWidth, getNodeHeight, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT } from './node-dimensions';

/** One endpoint of an edge polyline; anchored geometry is caller-supplied. */
export type EdgeAnchor = { x: number; y: number };

/** The two anchor points an anchored edge contributes. */
export type EdgeAnchorPair = readonly [EdgeAnchor, EdgeAnchor];

/**
 * Build LayoutEdges over positioned nodes with caller-supplied anchors.
 *
 * Edges whose `from`/`to` do not match a positioned node get `points: []`
 * (no geometry — never phantom coordinates) while keeping `from`/`to`/
 * `label`/`id` verbatim. Anchored edges get exactly `[source, target]`
 * points from `anchorPair`.
 */
export function buildAnchoredLayoutEdges(
  edges: EdgeDatum[],
  nodes: PositionedNode[],
  anchorPair: (source: PositionedNode, target: PositionedNode) => EdgeAnchorPair,
): LayoutEdge[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return edges.map((edge) => {
    const source = nodeMap.get(edge.from);
    const target = nodeMap.get(edge.to);

    if (!source || !target) {
      return {
        from: edge.from,
        to: edge.to,
        points: [],
        label: edge.label,
        id: edge.id,
      };
    }

    const [sourcePoint, targetPoint] = anchorPair(source, target);

    return {
      from: edge.from,
      to: edge.to,
      points: [sourcePoint, targetPoint],
      label: edge.label,
      id: edge.id,
    };
  });
}

/**
 * Center-to-center anchors — the geometry shared by the grid/matrix,
 * general, cycle, conceptmap, network, and mindmap strategies. Extents are
 * read through node-dimensions (NaN-safe), never off raw `.width`.
 */
export function centerToCenterAnchors(
  source: PositionedNode,
  target: PositionedNode,
): EdgeAnchorPair {
  return [
    {
      x: source.x + getNodeWidth(source, DEFAULT_NODE_WIDTH) / 2,
      y: source.y + getNodeHeight(source, DEFAULT_NODE_HEIGHT) / 2,
    },
    {
      x: target.x + getNodeWidth(target, DEFAULT_NODE_WIDTH) / 2,
      y: target.y + getNodeHeight(target, DEFAULT_NODE_HEIGHT) / 2,
    },
  ];
}
