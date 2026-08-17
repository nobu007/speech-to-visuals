import { DiagramType, NodeDatum, EdgeDatum, PositionedNode, LayoutEdge } from '@/types/diagram';
import { LayoutConfig, Point, NodeDimensionsConfig, OverlapPair } from './types';
import { getNodeWidth, getNodeHeight, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT } from './node-dimensions';

/**
 * px-per-character estimate for the label-driven node width (round 10
 * single-source; was independently frozen in 6 strategies + 2 engines).
 */
export const DEFAULT_CHAR_WIDTH = 8;

/**
 * Horizontal padding added to the label width by every strategy that sizes
 * nodes from text (round 10 single-source). Distinct from the omitted-field
 * default `?? 16` below — callers that omit padding get the tighter packing
 * pinned by layout-bug-fixes.test.ts, by design.
 */
export const DEFAULT_LABEL_PADDING = 20;

/**
 * Calculate node width based on label and config
 */
export function calculateNodeWidth(node: NodeDatum, config: NodeDimensionsConfig): number {
  const baseWidth = config.nodeWidth;
  const labelLength = node.label?.length || 0;
  const charWidth = config.charWidth ?? DEFAULT_CHAR_WIDTH;
  const padding = config.padding ?? 16;       // 16px default padding (see above)

  const textWidth = labelLength * charWidth + padding;
  return Math.max(baseWidth, Math.min(textWidth, baseWidth * 2));
}

/**
 * Calculate node height (currently fixed, but extensible)
 */
export function calculateNodeHeight(node: NodeDatum, config: NodeDimensionsConfig): number {
  return config.nodeHeight;
}

/**
 * Resolve a node's effective LAYOUT-TIME width (round 37 single source).
 *
 * Explicit finite positive `width` (or the layout-time `w` alias) wins;
 * otherwise fall through to the label-driven estimate. This is the
 * placement-side counterpart of `getNodeWidth()` (node-dimensions.ts), which
 * every measurement site (overlap predicates, edge anchoring, canvas
 * fitting) uses to read a positioned node's size. Round 31 adopted the
 * explicit-first branch for the v1 strategy family (`strategyNodeWidth`);
 * round 37 makes it the one canonical decision and closes the engine-level
 * missed sibling: `EnhancedZeroOverlapLayoutEngine` sized dagre boxes with
 * the raw label-driven estimate while everything downstream measured
 * width-first — a `width: 400` node was PLACED ≤ 240px but MEASURED 400px,
 * a genuine geometric overlap emitted by the "zero overlap guaranteed"
 * engine (pinned in tests/guards/layout-outcome-overlap-regression.test.ts
 * before this fix).
 *
 * Zero-delta contract for nodes WITHOUT explicit dimensions: the tail is
 * exactly `calculateNodeWidth(node, config)` — same omitted-padding (16)
 * packing, byte-identical result.
 */
export function resolveNodeWidth(node: NodeDatum, config: NodeDimensionsConfig): number {
  const explicit = node.width ?? (node as NodeDatum & { w?: number }).w;
  if (typeof explicit === 'number' && Number.isFinite(explicit) && explicit > 0) {
    return explicit;
  }
  return calculateNodeWidth(node, config);
}

/**
 * Resolve a node's effective LAYOUT-TIME height (round 37 single source).
 *
 * Same shape as {@link resolveNodeWidth}: explicit finite positive
 * `height`/`h` wins, else the configured height. The `|| DEFAULT_NODE_HEIGHT`
 * tail is the NaN-guard the round-31 strategy tail gained (a `{}`-cast
 * config would otherwise make the raw `config.nodeHeight` pass return
 * `undefined`); real configs always carry a finite height, so this is
 * delta-free for every actual caller.
 */
export function resolveNodeHeight(node: NodeDatum, config: NodeDimensionsConfig): number {
  const explicit = node.height ?? (node as NodeDatum & { h?: number }).h;
  if (typeof explicit === 'number' && Number.isFinite(explicit) && explicit > 0) {
    return explicit;
  }
  return config.nodeHeight || DEFAULT_NODE_HEIGHT;
}

/**
 * Calculate center point of a node.
 *
 * Round 47 single source for the node box-center geometry
 * (`{x: node.x + width/2, y: node.y + height/2}`, `node.x/y` being the
 * top-LEFT corner): previously the same fold was re-derived inline at ~19
 * sites across edge-crossing-minimizer, cycle-strategy, layout-auto-optimizer,
 * LayoutOptimizer, force-directed-params, complex-layout-engine,
 * visual-balance-scorer, ezo and multi-format-exporter — each copy free to
 * drop the origin term, halve the wrong axis, or drift its dimension
 * fallback. `strategy-edges.ts#centerAnchor` (round 46) composes this
 * helper instead of carrying a second center definition.
 *
 * `widthFallback` / `heightFallback` are the per-site policy seam (round 45
 * pattern): the dimension assumed per axis when the node carries NO finite
 * dimension. `0` (the default, and the original behavior of this helper) is
 * the geometry-neutral read — a dimensionless node's center is its corner;
 * `DEFAULT_NODE_WIDTH`/`DEFAULT_NODE_HEIGHT` is the render-default read;
 * callers with configured sizes pass their config values. The seam is
 * PER-AXIS because the retired sites were: e.g. the render-default forms
 * read `getNodeWidth(node)` (fallback 120) for x but `getNodeHeight(node)`
 * (fallback 60) for y — one shared number would shift the y axis by 30.
 * Passing explicit fallbacks is bit-identical to the retired site-local
 * `getNodeWidth(node, F) / 2` forms.
 *
 * Raw coordinates propagate NaN by design (the retired forms did); callers
 * that must not feed NaN keep their pre-call guard at the site
 * (visual-balance-scorer's `sanitizeFinite` chokepoint).
 */
export function calculateNodeCenter(node: PositionedNode, widthFallback: number = 0, heightFallback: number = 0): Point {
  return {
    x: node.x + getNodeWidth(node, widthFallback) / 2,
    y: node.y + getNodeHeight(node, heightFallback) / 2
  };
}

/**
 * Centroid (arithmetic mean) of the node box-centers — round 47 single
 * source for the "sum every `node.x + width/2`, divide by count" scan that
 * layout-auto-optimizer (x3: applyParams / recenter / module recenter) and
 * LayoutOptimizer (adjustSpacingByImportance) each re-implemented inline.
 * Same accumulation order as the retired folds (`sum += center.x` starting
 * from 0), so delegation is bit-identical, and the same per-axis fallback
 * seam as {@link calculateNodeCenter}.
 *
 * Empty input returns `{x: 0, y: 0}` (the `calculateClusterCentroid`
 * precedent) — every migrated call site early-returns on empty BEFORE the
 * fold, so the branch is unreachable for them and exists only to keep the
 * helper from synthesizing NaN.
 */
export function nodesCentroid(nodes: readonly PositionedNode[], widthFallback: number = 0, heightFallback: number = 0): Point {
  if (nodes.length === 0) {
    return { x: 0, y: 0 };
  }
  let sumX = 0;
  let sumY = 0;
  for (const node of nodes) {
    const center = calculateNodeCenter(node, widthFallback, heightFallback);
    sumX += center.x;
    sumY += center.y;
  }
  return { x: sumX / nodes.length, y: sumY / nodes.length };
}

/**
 * Angle of the i-th of `count` evenly spaced points on a ring, measured from
 * the +x axis: `(2π · index) / count`. Round 48 single source for the ring
 * step — cycle-strategy, network-strategy, mindmap-strategy (fallback ring),
 * FallbackLayoutStrategy, LayoutOptimizer (×2), advanced-layouts,
 * complex-layout-engine (clusters + within-cluster) and
 * ProgressiveForceStrategy each re-derived it inline, three text forms
 * (`(2 * Math.PI * i) / n`, `(i * 2 * Math.PI) / nodes.length`, and
 * LayoutOptimizer's `/ Math.max(1, nodes.length)`).
 *
 * The `Math.max(1, …)` guard is retired as DEAD: every retired site computed
 * the angle inside a per-element iteration (`map`/`forEach`/index-loop), where
 * `index < count` implies `count >= 1` — the clamp only ever saw counts it
 * did not change. `count: 0` produces NaN by contract (matches the retired
 * in-loop forms); callers that early-return on empty keep that guard at the
 * site.
 */
export function ringAngle(index: number, count: number): number {
  return (2 * Math.PI * index) / count;
}

/**
 * Point on a circle of `radius` around (`centerX`, `centerY`) at `angle`
 * (radians, from the +x axis): `{x: cx + r·cos, y: cy + r·sin}`. Round 48
 * single source — compose with {@link ringAngle} for even ring placement.
 * Covers the fixed-radius rings (cycle/fallback/cluster layouts), the
 * per-node-radius rings (network importance scaling, mindmap spiral
 * fallback), and the polar-tree reads (mindmap positionSubtree's
 * `center.x + cos(angle) · childRadius`). The commuted operand order some
 * retired sites used (`Math.cos(angle) * radius`) is bit-identical (IEEE
 * multiplication is commutative), and `centerX = 0` is the identity on every
 * value except a `-0` x-flip that ring angles cannot produce.
 *
 * The returned point is a CENTER point; sites whose node x/y is the top-LEFT
 * corner keep their own `- width / 2` conversion applied to the result
 * (left-associative in every retired site: `(cx + r·cos) - w/2` — the
 * delegation preserves that grouping exactly).
 */
export function pointOnCircle(centerX: number, centerY: number, angle: number, radius: number): Point {
  return {
    x: centerX + radius * Math.cos(angle),
    y: centerY + radius * Math.sin(angle)
  };
}

/**
 * Euclidean length of a (dx, dy) delta: `sqrt(dx² + dy²)`.
 *
 * This is the single source of truth for the 2-D distance arithmetic.
 * Previously every layout / overlap / edge-crossing / visual-balance module
 * inlined its own `Math.sqrt(dx * dx + dy * dy)` (plus a `** 2` variant) —
 * each an independent copy that could silently drift, the duplicate-formula
 * hazard that repeatedly bit this codebase (see {@link nodesOverlap} for the
 * same consolidation of the AABB predicate). Delegating here guarantees one
 * definition; callers that need a non-zero floor before dividing keep their
 * OWN guard (`Math.max(_, 1)` / `|| 1`) applied to the result, because that
 * guard is a deliberate invariant-split (div-by-zero avoidance), not part of
 * the distance formula.
 *
 * @param dx  x-component of the delta (or a vector's x).
 * @param dy  y-component of the delta (or a vector's y).
 */
export function distance(dx: number, dy: number): number {
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate distance between two points
 */
export function calculateDistance(p1: Point, p2: Point): number {
  return distance(p2.x - p1.x, p2.y - p1.y);
}

/**
 * Calculate distance between two node centers
 */
export function calculateNodeDistance(node1: PositionedNode, node2: PositionedNode): number {
  const center1 = calculateNodeCenter(node1);
  const center2 = calculateNodeCenter(node2);
  return calculateDistance(center1, center2);
}

/**
 * Generate simple straight-line edge points
 * From node center to node center
 */
export function generateEdgePoints(
  source: PositionedNode,
  target: PositionedNode
): Point[] {
  const sourceCenter = calculateNodeCenter(source);
  const targetCenter = calculateNodeCenter(target);

  return [sourceCenter, targetCenter];
}

/**
 * Check if two nodes overlap
 * Includes minimum spacing requirement
 */
export function nodesOverlap(
  node1: PositionedNode,
  node2: PositionedNode,
  spacing: number = 0
): boolean {
  const w1 = getNodeWidth(node1, 0);
  const h1 = getNodeHeight(node1, 0);
  const w2 = getNodeWidth(node2, 0);
  const h2 = getNodeHeight(node2, 0);

  const left1 = node1.x - spacing / 2;
  const right1 = node1.x + w1 + spacing / 2;
  const top1 = node1.y - spacing / 2;
  const bottom1 = node1.y + h1 + spacing / 2;

  const left2 = node2.x - spacing / 2;
  const right2 = node2.x + w2 + spacing / 2;
  const top2 = node2.y - spacing / 2;
  const bottom2 = node2.y + h2 + spacing / 2;

  return !(
    right1 <= left2 ||
    left1 >= right2 ||
    bottom1 <= top2 ||
    top1 >= bottom2
  );
}

/**
 * Full pairwise overlap scan — round 39 single source.
 *
 * The `for i / for j = i+1 / nodesOverlap / accumulate` double loop was
 * independently inlined at 9 sites (quality-estimators, layout-engine-v2,
 * NetworkLayoutStrategy, cycle-strategy, timeline-strategy, quality-monitor,
 * LayoutEvaluator, BaseLayoutEngine, enhanced-zero-overlap-layout), so a scan
 * written for one engine could silently diverge from the judge's scan (the
 * invariant-split / hardcoded-constant-desync class). Every site now delegates
 * here; the pair predicate stays `nodesOverlap` above — the ONE definition.
 *
 * Semantics frozen by the migrating sites:
 * - pairs are visited in i<j index order, node1 = nodes[i], node2 = nodes[j]
 * - `minSpacing` defaults to 0 (plain geometric overlap; touching edges are
 *   NOT an overlap) and expands each box by spacing/2 exactly like the predicate
 * - sites that need a nonzero default pass it explicitly (e.g. BaseLayoutEngine
 *   passes `this.config.nodeSeparation`, ezo its `minimumSpacing.nodeToNode`)
 */
export function detectOverlapPairs(
  nodes: PositionedNode[],
  minSpacing: number = 0
): OverlapPair[] {
  const pairs: OverlapPair[] = [];

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (nodesOverlap(nodes[i], nodes[j], minSpacing)) {
        pairs.push({ node1: nodes[i], node2: nodes[j] });
      }
    }
  }

  return pairs;
}

/**
 * Count overlapping pairs — `detectOverlapPairs(nodes, minSpacing).length`
 * (round 39 single source; see above).
 */
export function countOverlapPairs(
  nodes: PositionedNode[],
  minSpacing: number = 0
): number {
  return detectOverlapPairs(nodes, minSpacing).length;
}

/**
 * Early-exit "any overlapping pair?" probe — same predicate and pair order as
 * `detectOverlapPairs` but returns at the first hit (round 39 single source).
 */
export function hasOverlapPairs(
  nodes: PositionedNode[],
  minSpacing: number = 0
): boolean {
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (nodesOverlap(nodes[i], nodes[j], minSpacing)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Minimal structural input for extent scanning: a position plus the optional
 * dimension fields `getNodeWidth`/`getNodeHeight` read. Positioned nodes
 * satisfy it structurally, and so do leaner node shapes (e.g. the layout
 * worker's `{id, x, y, width, height}` result nodes) — the scan only needs
 * where a node sits and how big it is, never its identity.
 */
export type ExtentNode = Pick<PositionedNode, 'x' | 'y' | 'width' | 'w' | 'height' | 'h'>;

/**
 * One node's four box edges in the TOP-LEFT CORNER convention every v1/ezo
 * engine uses: `left = x`, `top = y`, `right = x + width`, `bottom = y + height`.
 */
export interface NodeExtentEdges {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Min/max extents over a node set — the content bounding box in the same
 * corner convention. `width`/`height` are deliberately NOT included: sites
 * derive them with site-specific guards (`Math.max(1, …)` canvas floors,
 * plain `maxX - minX`), which are their contracts, not the scan's.
 */
export interface NodeExtents {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Read one node's four edges — round 41 single source for "where does this
 * node's box sit".
 *
 * The `x + getNodeWidth(node, fallback)` right-edge (and its top-left sibling)
 * was previously re-derived inline at 11 extent-scan sites (see
 * {@link foldNodeExtents}); a copy that drops the `+ width` term, swaps the
 * fallback, or reads the deprecated `w` alias directly silently shrinks or
 * inflates the box every canvas-fit / centering / utilization decision is
 * made from. Delegating the read here keeps the width term and its
 * `getNodeWidth` fallback chain (width → w → fallback) in exactly one place.
 *
 * The fallback args make the two legitimate historical policies explicit
 * instead of drifting apart silently: measurement sites that must not invent
 * dimensions for a dimension-less node pass `0` (BaseLayoutEngine bounds,
 * canvas fitting); utilization/bounds sites that assume a default-sized node
 * pass nothing (`DEFAULT_NODE_WIDTH` / `DEFAULT_NODE_HEIGHT`).
 */
export function nodeExtentEdges(
  node: ExtentNode,
  fallbackWidth: number = DEFAULT_NODE_WIDTH,
  fallbackHeight: number = DEFAULT_NODE_HEIGHT
): NodeExtentEdges {
  return {
    left: node.x,
    top: node.y,
    right: node.x + getNodeWidth(node, fallbackWidth),
    bottom: node.y + getNodeHeight(node, fallbackHeight),
  };
}

/**
 * Fold per-node edges into min/max extents — round 41 single source for the
 * extent scan itself.
 *
 * The fold body was previously inlined at 11 sites in two idioms — the spread
 * form `Math.min(...nodes.map(n => n.x))` (BaseLayoutEngine bounds, ezo
 * canvas-utilization, complex-layout-engine bounds ×2, CulturalLayoutAdapter
 * bounds, layout-worker result size) and the seeded-accumulator loop
 * `let minX = Infinity … if (right > maxX) maxX = right` (canvas-calculator
 * calculate/center, layout-engine-v2 canvas size, strategy-selector bounding
 * box, ezo fitNodesToCanvas) — each an independent copy where a flipped
 * comparison, a swapped ±Infinity seed, or a dropped width term could not
 * propagate to the others. The duplicate-formula / invariant-split hazard,
 * on the box every canvas-fit and centering decision reads.
 *
 * Semantics frozen by the migrating sites:
 * - accumulation is `Math.min`/`Math.max` pairwise-in-order, so the fold is
 *   bit-identical to the spread form (NaN propagates, `-0` resolves per spec)
 *   and value-identical to the comparison loops on their finite reads;
 * - an EMPTY (or all-filtered) input returns `null`, never a ±Infinity box —
 *   every migrated site carries its own empty policy (zero box / default
 *   canvas / early return) and now branches on `null` instead of a length
 *   check that the scan body no longer shares.
 *
 * The `read` seam keeps each site's coordinate policy AT the site (the
 * contract difference between them): raw `node.x` (`nodeExtentEdges` bare or
 * with explicit fallbacks), `sanitizeFinite(node.x, 0)` (canvas-calculator),
 * `node.x || 0` (complex-layout-engine cluster bounds over NodeDatum). The
 * fold — seeds, comparisons, width term — is what must never diverge again.
 */
export function foldNodeExtents(
  nodes: readonly ExtentNode[],
  read: (node: ExtentNode) => NodeExtentEdges
): NodeExtents | null {
  if (nodes.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    const edges = read(node);
    minX = Math.min(minX, edges.left);
    minY = Math.min(minY, edges.top);
    maxX = Math.max(maxX, edges.right);
    maxY = Math.max(maxY, edges.bottom);
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Clamp one node coordinate so the node's extent stays inside the canvas
 * band `[margin, canvasSize - nodeSize - margin]` — round 45 single source
 * for the canvas clamp of a positioned node's top-left coordinate.
 *
 * The clamp was previously inlined — verbatim — at 17 x/y coordinate-pair
 * sites in three margin policies: the zero-margin form
 * `Math.max(0, Math.min(canvas - size, v))` (ezo grid+jitter placement,
 * post-resolver clamp, NaN-guarded force application, jitter candidates,
 * and the eight collision-resolution moves; NetworkLayoutStrategy grid
 * placement), the margin form `Math.max(m, Math.min(canvas - size - m, v))`
 * (force-directed-params keepInView, network-strategy keep-within-bounds
 * at literal 20, strategies/OverlapResolver constrainNodeToBounds at
 * default-10 margin via a double-guarded maxX), and the point-clamp
 * degenerate `size = 0` (complex-layout-engine velocity integration, which
 * clamps the point and ignores the node extent by design). Each copy could
 * drop the `- nodeSize` term (the node's right/bottom edge slides off
 * canvas), swap the margin into the wrong side, or diverge on the
 * oversized-node case — one engine pulling nodes to `margin`, another
 * returning the inverted `hi < lo` band. That is the duplicate-formula /
 * invariant-split class, on every "keep the node on the canvas" decision.
 *
 * Semantics frozen by the migrating sites (bit-identical delegation, no
 * behavior change — zero-delta round like 30/34):
 * - `Math.max`/`Math.min` composition is the retired expression itself, so
 *   NaN propagates to NaN exactly as the inline copies did. Sites that must
 *   not propagate NaN guard BEFORE the call (ezo force application's
 *   `Number.isFinite` ternary is the precedent — the guard stays at the site
 *   because it is a site policy, not part of the clamp);
 * - an oversized node (`canvasSize - nodeSize - margin < margin`, i.e. the
 *   node cannot fit in the band) resolves to the LOWER bound `margin`: the
 *   `Math.max(margin, …)` outer wrap guarantees it, matching what both
 *   retired margin idioms produced (the direct form collapses the same way;
 *   constrainNodeToBounds's pre-clamped `maxX` did the identical collapse);
 * - the size argument is read AT the site (`getNodeWidth(node, fallback)`
 *   vs a precomputed local vs a literal `0`) — the dimension fallback chain
 *   is a site policy, exactly like the `read` seam of
 *   {@link foldNodeExtents}. What must never diverge again is the band
 *   itself: lower bound, upper bound, and the outer-lower wrap.
 */
export function clampNodeCoordinate(
  value: number,
  canvasSize: number,
  nodeSize: number,
  margin: number = 0
): number {
  return Math.max(margin, Math.min(canvasSize - nodeSize - margin, value));
}

/**
 * Get Dagre configuration based on diagram type
 */
export function getGraphConfig(diagramType: DiagramType, config: LayoutConfig) {
  const baseConfig = {
    nodesep: config.nodeSeparation,
    edgesep: config.edgeSeparation,
    ranksep: config.rankSeparation,
    marginx: config.marginX,
    marginy: config.marginY
  };

  switch (diagramType) {
    // 'flowchart' is a distinct canonical DiagramType (see DIAGRAM_TYPES) but is
    // semantically a flow diagram; in the legacy LayoutEngine→DagreLayoutStrategy
    // path there is no flowchart-specific config, so it must share flow's rank
    // direction + alignment rather than fall through to the bare baseConfig.
    case 'flow':
    case 'flowchart':
      return {
        ...baseConfig,
        rankdir: 'TB', // Top to bottom for flow diagrams
        align: 'UL'
      };
    case 'tree':
      return {
        ...baseConfig,
        rankdir: 'TB', // Top to bottom for hierarchies
        ranker: 'longest-path'
      };
    case 'timeline':
      return {
        ...baseConfig,
        rankdir: 'LR', // Left to right for timelines
        ranker: 'tight-tree'
      };
    case 'matrix':
      return {
        ...baseConfig,
        rankdir: 'TB',
        ranker: 'network-simplex'
      };
    case 'cycle':
      return {
        ...baseConfig,
        rankdir: 'TB',
        ranker: 'longest-path'
      };
    default:
      return baseConfig;
  }
}
