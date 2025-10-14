import { DiagramType, NodeDatum, EdgeDatum, PositionedNode, LayoutEdge } from '@/types/diagram';
import { LayoutConfig, Point, NodeDimensionsConfig } from './types';

/**
 * Calculate node width based on label and config
 */
export function calculateNodeWidth(node: NodeDatum, config: NodeDimensionsConfig): number {
  const baseWidth = config.nodeWidth;
  const labelLength = node.label?.length || 0;
  const charWidth = config.charWidth;
  const padding = config.padding;

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
    x: node.x + node.width / 2,
    y: node.y + node.height / 2
  };
}

/**
 * Calculate distance between two points
 */
export function calculateDistance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
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
  const left1 = node1.x - spacing / 2;
  const right1 = node1.x + node1.width + spacing / 2;
  const top1 = node1.y - spacing / 2;
  const bottom1 = node1.y + node1.height + spacing / 2;

  const left2 = node2.x - spacing / 2;
  const right2 = node2.x + node2.width + spacing / 2;
  const top2 = node2.y - spacing / 2;
  const bottom2 = node2.y + node2.height + spacing / 2;

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
    case 'flow':
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
