/**
 * Comparison Layout Strategy
 *
 * Side-by-side two-column layout for comparing items.
 * Splits nodes into left and right columns with balanced vertical distribution.
 * Zero overlap guarantee through column separation.
 */

import { NodeDatum, EdgeDatum, PositionedNode } from '@/types/diagram';
import { LayoutStrategy, StrategyLayoutResult } from '../types';
import { calculateCanvasSize, calculateMetrics } from '../layout-engine-v2';
import { defaultNodeExtent, DEFAULT_NODE_HEIGHT } from '../node-dimensions';
import { DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT } from '../canvas-dimensions';
import { emptyLayoutResult } from '../empty-layout-result';
import { buildAnchoredLayoutEdges, flankAnchors } from '../strategy-edges';

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

    const layoutEdges = buildAnchoredLayoutEdges(edges, positionedNodes, flankAnchors);

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
      // Round 49 single source — the DEFAULT-fallback box resolution pair.
      const { width: w, height: h } = defaultNodeExtent(node);
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

/**
 * Side anchors (pair-dependent flanks) moved to strategy-edges.ts in round 46
 * as `flankAnchors` — shared with v1 comparison. The local `sideAnchorPair`
 * is retired; the import above supplies the canonical pair. The edge
 * skeleton (nodeMap, dangling fallback, LayoutEdge assembly) single-sources
 * through strategy-edges.ts since round 32.
 */

export const comparisonStrategy = new ComparisonStrategy();
