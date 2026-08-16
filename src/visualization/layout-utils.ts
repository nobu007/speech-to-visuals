import { DiagramType, NodeDatum, EdgeDatum, PositionedNode, LayoutEdge } from '@/types/diagram';
import { LayoutConfig, Point, NodeDimensionsConfig } from './types';
import { getNodeWidth, getNodeHeight, DEFAULT_NODE_HEIGHT } from './node-dimensions';

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
 * Calculate center point of a node
 */
export function calculateNodeCenter(node: PositionedNode): Point {
  return {
    x: node.x + getNodeWidth(node, 0) / 2,
    y: node.y + getNodeHeight(node, 0) / 2
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
