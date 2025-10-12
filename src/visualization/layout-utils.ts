import { DiagramType, NodeDatum, EdgeDatum, PositionedNode, LayoutEdge } from '@/types/diagram';
import { LayoutConfig, Point } from './types';

export interface NodeDimensionsConfig {
  nodeWidth: number;
  nodeHeight: number;
  charWidth: number;
  padding: number;
}

export class LayoutUtils {

  /**
   * Calculate node width based on label and config
   */
  static calculateNodeWidth(node: NodeDatum, config: NodeDimensionsConfig): number {
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
  static calculateNodeHeight(node: NodeDatum, config: NodeDimensionsConfig): number {
    return config.nodeHeight;
  }

  /**
   * Calculate center point of a node
   */
  static calculateNodeCenter(node: PositionedNode): Point {
    return {
      x: node.x + node.w / 2,
      y: node.y + node.h / 2
    };
  }

  /**
   * Calculate distance between two points
   */
  static calculateDistance(p1: Point, p2: Point): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calculate distance between two node centers
   */
  static calculateNodeDistance(node1: PositionedNode, node2: PositionedNode): number {
    const center1 = LayoutUtils.calculateNodeCenter(node1);
    const center2 = LayoutUtils.calculateNodeCenter(node2);
    return LayoutUtils.calculateDistance(center1, center2);
  }

  /**
   * Generate simple straight-line edge points
   * From node center to node center
   */
  static generateEdgePoints(
    source: PositionedNode,
    target: PositionedNode
  ): Point[] {
    const sourceCenter = LayoutUtils.calculateNodeCenter(source);
    const targetCenter = LayoutUtils.calculateNodeCenter(target);

    return [sourceCenter, targetCenter];
  }
}
