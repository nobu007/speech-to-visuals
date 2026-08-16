/**
 * General Layout Strategy
 *
 * Adaptive layout for diagrams that don't fit a specific category.
 * Uses edge-aware grid placement: nodes with more connections get
 * centered, isolated nodes go to the periphery.
 */

import { NodeDatum, EdgeDatum, PositionedNode } from '@/types/diagram';
import { LayoutStrategy, StrategyLayoutResult } from '../types';
import { calculateCanvasSize, calculateMetrics } from '../layout-engine-v2';
import { getNodeWidth, getNodeHeight, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT } from '../node-dimensions';
import { DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT, TARGET_ASPECT_RATIO } from '../canvas-dimensions';
import { emptyLayoutResult } from '../empty-layout-result';
import { buildAnchoredLayoutEdges, centerToCenterAnchors } from '../strategy-edges';

const NODE_SEP = 40;

export class GeneralStrategy implements LayoutStrategy {
  readonly name = 'general';
  readonly canEscapeLocalMinimum = false;

  apply(nodes: NodeDatum[], edges: EdgeDatum[]): StrategyLayoutResult {
    if (nodes.length === 0) {
      return emptyLayoutResult();
    }

    // Sort nodes by connectivity (most connected first → center)
    const degreeMap = new Map<string, number>();
    for (const node of nodes) degreeMap.set(node.id, 0);
    for (const edge of edges) {
      degreeMap.set(edge.from, (degreeMap.get(edge.from) ?? 0) + 1);
      degreeMap.set(edge.to, (degreeMap.get(edge.to) ?? 0) + 1);
    }

    const sortedNodes = [...nodes].sort(
      (a, b) => (degreeMap.get(b.id) ?? 0) - (degreeMap.get(a.id) ?? 0),
    );

    const columns = Math.max(1, Math.ceil(Math.sqrt(sortedNodes.length * TARGET_ASPECT_RATIO)));
    const rows = Math.max(1, Math.ceil(sortedNodes.length / columns));

    const cellWidth = DEFAULT_NODE_WIDTH + NODE_SEP;
    const cellHeight = DEFAULT_NODE_HEIGHT + NODE_SEP;
    const gridWidth = columns * cellWidth;
    const gridHeight = rows * cellHeight;
    const offsetX = Math.max(40, (DEFAULT_CANVAS_WIDTH - gridWidth) / 2);
    const offsetY = Math.max(40, (DEFAULT_CANVAS_HEIGHT - gridHeight) / 2);

    // Place most-connected nodes near grid center using spiral ordering
    const positionedNodes: PositionedNode[] = this.spiralPlace(
      sortedNodes,
      columns,
      rows,
      cellWidth,
      cellHeight,
      offsetX,
      offsetY,
    );

    const layoutEdges = buildAnchoredLayoutEdges(edges, positionedNodes, centerToCenterAnchors);

    const canvas = calculateCanvasSize(positionedNodes);
    const metrics = calculateMetrics(positionedNodes, layoutEdges);

    return { nodes: positionedNodes, edges: layoutEdges, canvas, metrics };
  }

  estimateComplexity(nodes: NodeDatum[]): number {
    return nodes.length * Math.log2(nodes.length + 1);
  }

  private spiralPlace(
    nodes: NodeDatum[],
    columns: number,
    rows: number,
    cellWidth: number,
    cellHeight: number,
    offsetX: number,
    offsetY: number,
  ): PositionedNode[] {
    // Generate spiral order from center outward
    const centerCol = Math.floor(columns / 2);
    const centerRow = Math.floor(rows / 2);
    const positions: { col: number; row: number }[] = [];

    for (let dist = 0; positions.length < nodes.length; dist++) {
      for (let r = centerRow - dist; r <= centerRow + dist && positions.length < nodes.length; r++) {
        for (let c = centerCol - dist; c <= centerCol + dist && positions.length < nodes.length; c++) {
          if (r >= 0 && r < rows && c >= 0 && c < columns) {
            if (!positions.some((p) => p.col === c && p.row === r)) {
              positions.push({ col: c, row: r });
            }
          }
        }
      }
    }

    return nodes.map((node, i) => {
      const pos = positions[i] ?? { col: i % columns, row: Math.floor(i / columns) };
      const w = getNodeWidth(node, DEFAULT_NODE_WIDTH);
      const h = getNodeHeight(node, DEFAULT_NODE_HEIGHT);
      return {
        ...node,
        x: offsetX + pos.col * cellWidth + (cellWidth - w) / 2,
        y: offsetY + pos.row * cellHeight + (cellHeight - h) / 2,
        width: w,
        height: h,
      };
    });
  }
}

export const generalStrategy = new GeneralStrategy();
