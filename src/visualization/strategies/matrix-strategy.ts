/**
 * Matrix Layout Strategy (Phase 3 - Strategy Architecture)
 *
 * Arranges nodes in a strict grid optimized for 16:9 aspect ratio.
 * Grid placement guarantees zero overlaps -- no fallback needed.
 */

import { NodeDatum, EdgeDatum, PositionedNode } from '@stv/core/types/diagram';
import {
  LayoutStrategy,
  StrategyLayoutResult,
  CanvasSize,
  StrategyLayoutMetrics,
} from '@/visualization/types';
import { calculateCanvasSize, calculateMetrics } from '@/visualization/layout-engine-v2';
import { defaultNodeExtent } from '../node-dimensions';
import { DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT, TARGET_ASPECT_RATIO } from '../canvas-dimensions';
import { emptyLayoutResult } from '../empty-layout-result';
import { buildAnchoredLayoutEdges, centerToCenterAnchors } from '../strategy-edges';
import { aspectGridColumns, squareGridRows, centerInCell } from '../layout-utils';

const CANVAS_PADDING = 80;

export class MatrixStrategy implements LayoutStrategy {
  readonly name = 'matrix';
  readonly canEscapeLocalMinimum = false;

  apply(nodes: NodeDatum[], edges: EdgeDatum[]): StrategyLayoutResult {
    // Empty graph case
    if (nodes.length === 0) {
      return emptyLayoutResult();
    }

    // Step 1: Calculate optimal grid dimensions
    // Round 50 single source — aspect-corrected packing + rows twin.
    const nodeCount = nodes.length;
    const columns = aspectGridColumns(nodeCount, TARGET_ASPECT_RATIO);
    const rows = squareGridRows(nodeCount, columns);

    // Step 2: Calculate cell sizing
    const usableWidth = DEFAULT_CANVAS_WIDTH - 2 * CANVAS_PADDING;
    const usableHeight = DEFAULT_CANVAS_HEIGHT - 2 * CANVAS_PADDING;
    const cellWidth = usableWidth / columns;
    const cellHeight = usableHeight / rows;

    // Step 3: Place nodes at grid cell centers
    const positionedNodes: PositionedNode[] = nodes.map((node, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);

      // Round 49 single source — the DEFAULT-fallback box resolution pair.
      const { width: nodeWidth, height: nodeHeight } = defaultNodeExtent(node);

      // Center the node within its cell (round 50 single source — the
      // cell-centered stamp with the canvas-padding origin folded in).
      const x = centerInCell(col, cellWidth, nodeWidth, CANVAS_PADDING);
      const y = centerInCell(row, cellHeight, nodeHeight, CANVAS_PADDING);

      return {
        ...node,
        x,
        y,
        width: nodeWidth,
        height: nodeHeight,
      };
    });

    // Step 4: Build edges as straight lines between grid positions
    const layoutEdges = buildAnchoredLayoutEdges(edges, positionedNodes, centerToCenterAnchors);

    // Step 5: Calculate canvas and metrics
    const canvas = calculateCanvasSize(positionedNodes);
    const metrics = calculateMetrics(positionedNodes, layoutEdges);

    return { nodes: positionedNodes, edges: layoutEdges, canvas, metrics };
  }

  estimateComplexity(nodes: NodeDatum[]): number {
    // Grid placement is O(n) -- trivial assignment
    return nodes.length;
  }
}
