/**
 * Comparison Layout Strategy
 *
 * Side-by-side two-column layout for comparing items.
 * Splits nodes into left and right columns with balanced vertical distribution.
 * Zero overlap guarantee through column separation.
 */

import { NodeDatum, EdgeDatum, PositionedNode, LayoutEdge } from '@/types/diagram';
import { LayoutStrategy, StrategyLayoutResult } from '../types';
import { calculateCanvasSize, calculateMetrics } from '../layout-engine-v2';
import { getNodeWidth, getNodeHeight, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT } from '../node-dimensions';
import { DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT } from '../canvas-dimensions';
import { emptyLayoutResult } from '../empty-layout-result';

const NODE_VERTICAL_SEP = 70;
const COLUMN_GAP = 300;

export class ComparisonStrategy implements LayoutStrategy {
  readonly name = 'comparison';
  readonly canEscapeLocalMinimum = false;

  apply(nodes: NodeDatum[], edges: EdgeDatum[]): StrategyLayoutResult {
    if (nodes.length === 0) {
      return emptyLayoutResult();
    }

    const midpoint = Math.ceil(nodes.length / 2);
    const leftNodes = nodes.slice(0, midpoint);
    const rightNodes = nodes.slice(midpoint);

    const leftCenterX = DEFAULT_CANVAS_WIDTH / 2 - COLUMN_GAP / 2;
    const rightCenterX = DEFAULT_CANVAS_WIDTH / 2 + COLUMN_GAP / 2;

    const leftPositioned = this.positionColumn(leftNodes, leftCenterX);
    const rightPositioned = this.positionColumn(rightNodes, rightCenterX);

    const positionedNodes = [...leftPositioned, ...rightPositioned];

    const nodeMap = new Map(positionedNodes.map((n) => [n.id, n]));
    const layoutEdges: LayoutEdge[] = edges.map((edge) => {
      const source = nodeMap.get(edge.from);
      const target = nodeMap.get(edge.to);
      if (!source || !target) {
        return { from: edge.from, to: edge.to, points: [], label: edge.label, id: edge.id };
      }
      const sourceIsLeft = source.x < target.x;
      const sw = getNodeWidth(source, DEFAULT_NODE_WIDTH);
      const sh = getNodeHeight(source, DEFAULT_NODE_HEIGHT);
      const tw = getNodeWidth(target, DEFAULT_NODE_WIDTH);
      const th = getNodeHeight(target, DEFAULT_NODE_HEIGHT);
      return {
        from: edge.from,
        to: edge.to,
        points: [
          { x: sourceIsLeft ? source.x + sw : source.x, y: source.y + sh / 2 },
          { x: sourceIsLeft ? target.x : target.x + tw, y: target.y + th / 2 },
        ],
        label: edge.label,
        id: edge.id,
      };
    });

    const canvas = calculateCanvasSize(positionedNodes);
    const metrics = calculateMetrics(positionedNodes, layoutEdges);

    return { nodes: positionedNodes, edges: layoutEdges, canvas, metrics };
  }

  estimateComplexity(nodes: NodeDatum[]): number {
    return nodes.length;
  }

  private positionColumn(nodes: NodeDatum[], centerX: number): PositionedNode[] {
    if (nodes.length === 0) return [];

    const totalHeight = nodes.length * DEFAULT_NODE_HEIGHT + (nodes.length - 1) * NODE_VERTICAL_SEP;
    const startY = Math.max(40, (DEFAULT_CANVAS_HEIGHT - totalHeight) / 2);

    return nodes.map((node, i) => {
      const w = getNodeWidth(node, DEFAULT_NODE_WIDTH);
      const h = getNodeHeight(node, DEFAULT_NODE_HEIGHT);
      return {
        ...node,
        x: centerX - w / 2,
        y: startY + i * (DEFAULT_NODE_HEIGHT + NODE_VERTICAL_SEP),
        width: w,
        height: h,
      };
    });
  }
}

export const comparisonStrategy = new ComparisonStrategy();
