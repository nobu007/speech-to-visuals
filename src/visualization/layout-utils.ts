import { DiagramType, NodeDatum, EdgeDatum, PositionedNode, LayoutEdge } from '@/types/diagram';
import { LayoutConfig, Point, NodeDimensionsConfig } from './types';
import { getNodeWidth, getNodeHeight } from './node-dimensions';

/**
 * Calculate node width based on label and config
 */
export function calculateNodeWidth(node: NodeDatum, config: NodeDimensionsConfig): number {
  const baseWidth = config.nodeWidth;
  const labelLength = node.label?.length || 0;
  const charWidth = config.charWidth ?? 8;   // 8px default per character
  const padding = config.padding ?? 16;       // 16px default padding

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
