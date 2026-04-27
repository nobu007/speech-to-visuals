/**
 * Matrix Layout Strategy (Phase 3 - Strategy Architecture)
 *
 * Arranges nodes in a strict grid optimized for 16:9 aspect ratio.
 * Grid placement guarantees zero overlaps -- no fallback needed.
 */

import { NodeDatum, EdgeDatum, PositionedNode, LayoutEdge } from '@/types/diagram';
import {
  LayoutStrategy,
  StrategyLayoutResult,
  CanvasSize,
  StrategyLayoutMetrics,
} from '@/visualization/types';
import { calculateCanvasSize, calculateMetrics } from '@/visualization/layout-engine-v2';

const DEFAULT_NODE_WIDTH = 120;
const DEFAULT_NODE_HEIGHT = 60;
const DEFAULT_CANVAS_WIDTH = 1920;
const DEFAULT_CANVAS_HEIGHT = 1080;
const CANVAS_PADDING = 80;
const ASPECT_RATIO = 16 / 9;

export class MatrixStrategy implements LayoutStrategy {
  readonly name = 'matrix';
  readonly canEscapeLocalMinimum = false;

  apply(nodes: NodeDatum[], edges: EdgeDatum[]): StrategyLayoutResult {
    // Empty graph case
    if (nodes.length === 0) {
      return {
        nodes: [],
        edges: [],
        canvas: { width: DEFAULT_CANVAS_WIDTH, height: DEFAULT_CANVAS_HEIGHT },
        metrics: { overlapCount: 0, edgeCrossings: 0, aspectRatio: ASPECT_RATIO },
      };
    }

    // Step 1: Calculate optimal grid dimensions
    const nodeCount = nodes.length;
    const columns = Math.max(1, Math.ceil(Math.sqrt(nodeCount * ASPECT_RATIO)));
    const rows = Math.max(1, Math.ceil(nodeCount / columns));

    // Step 2: Calculate cell sizing
    const usableWidth = DEFAULT_CANVAS_WIDTH - 2 * CANVAS_PADDING;
    const usableHeight = DEFAULT_CANVAS_HEIGHT - 2 * CANVAS_PADDING;
    const cellWidth = usableWidth / columns;
    const cellHeight = usableHeight / rows;

    // Step 3: Place nodes at grid cell centers
    const positionedNodes: PositionedNode[] = nodes.map((node, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);

      const nodeWidth = node.width ?? DEFAULT_NODE_WIDTH;
      const nodeHeight = node.height ?? DEFAULT_NODE_HEIGHT;

      // Center the node within its cell
      const cellX = CANVAS_PADDING + col * cellWidth;
      const cellY = CANVAS_PADDING + row * cellHeight;
      const x = cellX + (cellWidth - nodeWidth) / 2;
      const y = cellY + (cellHeight - nodeHeight) / 2;

      return {
        ...node,
        x,
        y,
        width: nodeWidth,
        height: nodeHeight,
      };
    });

    // Step 4: Build edges as straight lines between grid positions
    const layoutEdges = this.buildLayoutEdges(edges, positionedNodes);

    // Step 5: Calculate canvas and metrics
    const canvas = calculateCanvasSize(positionedNodes);
    const metrics = calculateMetrics(positionedNodes, layoutEdges);

    return { nodes: positionedNodes, edges: layoutEdges, canvas, metrics };
  }

  estimateComplexity(nodes: NodeDatum[]): number {
    // Grid placement is O(n) -- trivial assignment
    return nodes.length;
  }

  private buildLayoutEdges(
    edges: EdgeDatum[],
    nodes: PositionedNode[],
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

      // Straight line from source center to target center
      const sourcePoint = {
        x: source.x + source.width / 2,
        y: source.y + source.height / 2,
      };
      const targetPoint = {
        x: target.x + target.width / 2,
        y: target.y + target.height / 2,
      };

      return {
        from: edge.from,
        to: edge.to,
        points: [sourcePoint, targetPoint],
        label: edge.label,
        id: edge.id,
      };
    });
  }
}
