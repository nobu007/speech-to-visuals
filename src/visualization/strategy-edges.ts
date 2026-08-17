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
 *
 * Round 33 added the v1 flavor of the same skeleton (see
 * buildWarnedAnchoredEdges below): the six legacy engine sites warned on a
 * dangling edge and assembled the LayoutEdge WITHOUT `id` —
 *   - base/BaseLayoutEngine.ts        generateAllEdges (center→center via
 *                                     the overridable this.generateEdgePoints)
 *   - ComparisonLayoutStrategy.ts     generateComparisonEdges (side anchors)
 *   - ConceptMapLayoutStrategy.ts     generateConceptMapEdges (center→center)
 *   - NetworkLayoutStrategy.ts        generateNetworkEdges (center→center)
 *   - TimelineLayoutStrategy.ts       generateTimelineEdges (right→left)
 *   - TreeLayoutStrategy.ts           generateTreeEdges (bottom→top)
 * Still uniform at extraction time (no drift yet); frozen before one could
 * fork — a missing warn at one site would silence a dangling-edge diagnostic
 * for one diagram type only.
 *   - GridSnapFallbackStrategy (strategy-selector.ts) — deliberately emits
 *     NO geometry at all (every edge `points: []`, no anchors), not a
 *     per-pair anchored builder.
 *
 * Round 46 promoted the ANCHOR GEOMETRY itself into this module. At round 32
 * each side-anchor policy had a single site, so the geometry stayed in the
 * strategy files by design; by round 46 the bottom→top pair lived at three
 * sites (v2 timeline, v1 tree, FallbackLayoutStrategy flow), the right→left
 * pair at two (v1 timeline, FallbackLayoutStrategy timeline), and the
 * pair-dependent flanks at two (v1 + v2 comparison) — plus the Fallback
 * cycle/matrix, complex-layout-engine cluster, ezo edge/balance sites, and
 * the network-strategy force-math center reads re-deriving the center. The
 * point helpers (centerAnchor + four side anchors) and pair helpers
 * (verticalFlowAnchors, horizontalFlowAnchors, flankAnchors,
 * centerToCenterAnchors) below are now the single geometry; sites keep only
 * their edge-assembly skeleton (lookup + dangling policy).
 *
 * Guarded by tests/guards/v2-strategy-edge-builder-single-source.test.ts
 * (verbatim legacy-inline oracles, dangling-shape pins, source anchors) and
 * the round-32 entry in tests/guards/frozen-literal-rules.ts (no site
 * re-rolls the skeleton). The round-33 v1 flavor is guarded by
 * tests/guards/v1-engine-edge-builder-single-source.test.ts and the round-33
 * registry entry. The round-46 anchor geometry is guarded by
 * tests/guards/edge-anchor-geometry-single-source.test.ts and the round-46
 * registry entry.
 */

import { EdgeDatum, PositionedNode, LayoutEdge } from '@/types/diagram';
import { getNodeWidth, getNodeHeight, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT } from './node-dimensions';
import { calculateNodeCenter } from './layout-utils';
import { logger } from '@/utils/logger';

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
 * CENTER anchor of a positioned node — top-left corner plus half the extent:
 * `{x: node.x + getNodeWidth(node) / 2, y: node.y + getNodeHeight(node) / 2}`.
 *
 * Round 46: this half-extent expression was re-derived inline at every site
 * that needs "where is this node" for an edge endpoint or a balance metric —
 * the two v1 strategy anchor functions, the FallbackLayoutStrategy cycle and
 * matrix blocks, the complex-layout-engine cluster edges, the ezo timeline
 * edges and collision-balance centers — while only the v2 strategies received
 * it via `centerToCenterAnchors` above. Each independent copy could drop the
 * `+ node.x` origin term, halve the wrong axis, or read the extent off raw
 * `.width` (NaN-unsafe), and the edge endpoints of one engine would silently
 * disagree with another's about the same node. The anchor POINT helpers below
 * (center + the four side anchors) are the single geometry; the anchor PAIR
 * helpers compose them for the repeated endpoint policies.
 *
 * Extents are read through node-dimensions with its DEFAULT fallback (120/60)
 * — bit-identical to the retired bare `getNodeWidth(node)` calls, whose
 * default argument IS `DEFAULT_NODE_WIDTH`. Raw coordinates propagate NaN by
 * design (the retired forms did); callers that must not feed NaN keep their
 * pre-call guard at the site.
 */
export function centerAnchor(node: PositionedNode): EdgeAnchor {
  // Round 47: composed over layout-utils `calculateNodeCenter` with the
  // DEFAULT fallbacks passed explicitly (bit-identical to the retired bare
  // `getNodeWidth(node) / 2` / `getNodeHeight(node) / 2`, whose default
  // arguments ARE DEFAULT_NODE_WIDTH / DEFAULT_NODE_HEIGHT).
  return calculateNodeCenter(node, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT);
}

/** Bottom-center anchor: `{x + w/2, y + h}` — where a downward edge leaves. */
export function bottomCenterAnchor(node: PositionedNode): EdgeAnchor {
  return {
    x: node.x + getNodeWidth(node) / 2,
    y: node.y + getNodeHeight(node),
  };
}

/** Top-center anchor: `{x + w/2, y}` — where an upward edge arrives. */
export function topCenterAnchor(node: PositionedNode): EdgeAnchor {
  return {
    x: node.x + getNodeWidth(node) / 2,
    y: node.y,
  };
}

/** Right-center anchor: `{x + w, y + h/2}` — where a rightward edge leaves. */
export function rightCenterAnchor(node: PositionedNode): EdgeAnchor {
  return {
    x: node.x + getNodeWidth(node),
    y: node.y + getNodeHeight(node) / 2,
  };
}

/** Left-center anchor: `{x, y + h/2}` — where a leftward edge arrives. */
export function leftCenterAnchor(node: PositionedNode): EdgeAnchor {
  return {
    x: node.x,
    y: node.y + getNodeHeight(node) / 2,
  };
}

/**
 * Center-to-center anchors — the geometry shared by the grid/matrix,
 * general, cycle, conceptmap, network, and mindmap strategies (v2), the
 * FallbackLayoutStrategy cycle/matrix blocks, the complex-layout-engine
 * cluster edges, and the ezo timeline edges. Extents are read through
 * node-dimensions (NaN-safe), never off raw `.width`; composed from
 * {@link centerAnchor} since round 46 so the half-extent arithmetic exists
 * exactly once.
 */
export function centerToCenterAnchors(
  source: PositionedNode,
  target: PositionedNode,
): EdgeAnchorPair {
  return [centerAnchor(source), centerAnchor(target)];
}

/**
 * Vertical-flow anchors — source BOTTOM-center to target TOP-center, so the
 * edge reads as top→bottom flow. Shared by the v2 timeline strategy
 * (verticalFlowAnchors), the v1 tree strategy, and the FallbackLayoutStrategy
 * flow block. Verbatim lift of the three retired inline copies (round 46).
 */
export function verticalFlowAnchors(
  source: PositionedNode,
  target: PositionedNode,
): EdgeAnchorPair {
  return [bottomCenterAnchor(source), topCenterAnchor(target)];
}

/**
 * Horizontal-flow anchors — source RIGHT-center to target LEFT-center, so the
 * edge reads as left→right flow. Shared by the v1 timeline strategy and the
 * FallbackLayoutStrategy timeline block. Verbatim lift (round 46).
 */
export function horizontalFlowAnchors(
  source: PositionedNode,
  target: PositionedNode,
): EdgeAnchorPair {
  return [rightCenterAnchor(source), leftCenterAnchor(target)];
}

/**
 * Flank anchors — pair-dependent sides: the edge leaves whichever flank of
 * the source faces the target and arrives on the facing flank of the target
 * (`source.x < target.x` → right→left, else left→right; a tie takes the
 * else-branch exactly like the retired inline `sourceIsLeft` forms). Shared
 * by the v1 and v2 comparison strategies. Verbatim lift (round 46).
 */
export function flankAnchors(
  source: PositionedNode,
  target: PositionedNode,
): EdgeAnchorPair {
  return source.x < target.x
    ? [rightCenterAnchor(source), leftCenterAnchor(target)]
    : [leftCenterAnchor(source), rightCenterAnchor(target)];
}

/**
 * The v1 engine flavor of the anchored-edge skeleton (round 33).
 *
 * Same concept as buildAnchoredLayoutEdges — anchored edges get the points
 * the anchor function supplies, dangling edges get `points: []` — under the
 * legacy engine contract:
 *
 *   - a dangling edge WARNS (`${warnPrefix}Edge <from> -> <to> missing
 *     nodes`) before falling back, so each engine keeps its `[Strategy]`
 *     diagnostic prefix;
 *   - the assembled LayoutEdge carries `from`/`to`/`points`/`label` but NOT
 *     `id` (all six legacy sites omitted it — unlike the v2 majority);
 *   - endpoint lookup keeps first-match-wins semantics: a malformed node
 *     list with duplicate ids resolves to the FIRST node, exactly like the
 *     `nodes.find(...)` it replaces.
 *
 * Zero behavior delta by construction — verbatim extraction of the six
 * former inline builders.
 */
export function buildWarnedAnchoredEdges(
  edges: EdgeDatum[],
  nodes: PositionedNode[],
  // Round 46: accepts BOTH the round-46 anchor pairs (the readonly
  // EdgeAnchorPair tuple) and legacy point-array anchors — the BaseLayoutEngine
  // seam keeps its overridable `generateEdgePoints`, whose historical contract
  // is a plain Point[]. The assembly spreads either into the mutable points
  // array LayoutEdge requires, so a pair helper slots in without an adapter.
  pointsOf: (source: PositionedNode, target: PositionedNode) => EdgeAnchor[] | EdgeAnchorPair,
  warnPrefix: string,
): LayoutEdge[] {
  // First-match-wins map: preserves `nodes.find(n => n.id === ...)` for
  // duplicate-id node lists (the plain `new Map(nodes.map(...))` used by the
  // v2 builder would silently switch to last-match).
  const nodeMap = new Map<string, PositionedNode>();
  for (const node of nodes) {
    if (!nodeMap.has(node.id)) {
      nodeMap.set(node.id, node);
    }
  }

  return edges.map((edge) => {
    const source = nodeMap.get(edge.from);
    const target = nodeMap.get(edge.to);

    if (!source || !target) {
      logger.warn(`${warnPrefix}Edge ${edge.from} -> ${edge.to} missing nodes`);
      return {
        from: edge.from,
        to: edge.to,
        points: [],
        label: edge.label,
      };
    }

    return {
      from: edge.from,
      to: edge.to,
      // Round 46: pointsOf now returns the readonly EdgeAnchorPair (same
      // "exactly two anchors" contract as the v2 builder); spread into the
      // mutable points array LayoutEdge requires. Same two elements, fresh
      // array — bit-identical to the previous direct assignment.
      points: [...pointsOf(source, target)],
      label: edge.label,
    };
  });
}
