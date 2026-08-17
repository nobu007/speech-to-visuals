import { NodeDatum, EdgeDatum, PositionedNode, LayoutEdge } from '@/types/diagram';
import { LayoutStrategy, StrategyLayoutResult, CanvasSize, StrategyLayoutMetrics } from '../types';
import { calculateCanvasSize, calculateMetrics } from '../layout-engine-v2';
import { defaultNodeExtent, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT } from '../node-dimensions';
import { emptyLayoutResult } from '../empty-layout-result';
import { runDagrePipeline } from '../dagre-pipeline';
import { squareGridColumns } from '../layout-utils';

const NODE_SEP = 50;
const RANK_SEP = 80;

export class FlowStrategy implements LayoutStrategy {
  readonly name = 'flow';
  readonly canEscapeLocalMinimum = true;

  apply(nodes: NodeDatum[], edges: EdgeDatum[]): StrategyLayoutResult {
    if (nodes.length === 0) {
      return emptyLayoutResult();
    }

    // Shared dagre pipeline (round 30): graph construction, TC-307 dangling
    // edge filter, center→top-left extraction — single-sourced in
    // dagre-pipeline.ts with the tree/flowchart strategies.
    const { positionedNodes, safeEdges, layoutEdges } = runDagrePipeline(nodes, edges, {
      rankdir: 'LR',
      nodesep: NODE_SEP,
      ranksep: RANK_SEP,
    });

    const canvas = calculateCanvasSize(positionedNodes);
    const metrics = calculateMetrics(positionedNodes, layoutEdges);

    if (metrics.overlapCount > 0) {
      return this.gridSnapFallback(nodes, safeEdges, positionedNodes);
    }

    return { nodes: positionedNodes, edges: layoutEdges, canvas, metrics };
  }

  estimateComplexity(nodes: NodeDatum[]): number {
    const n = nodes.length;
    return n * n;
  }

  private gridSnapFallback(
    originalNodes: NodeDatum[],
    originalEdges: EdgeDatum[],
    dagreNodes: PositionedNode[],
  ): StrategyLayoutResult {
    const nodeMap = new Map(dagreNodes.map((n) => [n.id, n]));
    const inDegree = new Map<string, number>();
    for (const node of originalNodes) {
      inDegree.set(node.id, 0);
    }
    for (const edge of originalEdges) {
      inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
    }

    const adjacency = new Map<string, string[]>();
    for (const node of originalNodes) {
      adjacency.set(node.id, []);
    }
    for (const edge of originalEdges) {
      adjacency.get(edge.from)?.push(edge.to);
    }

    // Kahn's algorithm for topological sort
    const sorted: string[] = [];
    const queue: string[] = [];
    const currentInDegree = new Map(inDegree);

    for (const [id, deg] of currentInDegree) {
      if (deg === 0) {
        queue.push(id);
      }
    }

    // Sort queue by dagre x position for stable ordering
    queue.sort((a, b) => {
      const na = nodeMap.get(a);
      const nb = nodeMap.get(b);
      return (na?.x ?? 0) - (nb?.x ?? 0);
    });

    while (queue.length > 0) {
      const current = queue.shift()!;
      sorted.push(current);
      const neighbors = adjacency.get(current) ?? [];
      for (const neighbor of neighbors) {
        const newDeg = (currentInDegree.get(neighbor) ?? 1) - 1;
        currentInDegree.set(neighbor, newDeg);
        if (newDeg === 0) {
          queue.push(neighbor);
        }
      }
      queue.sort((a, b) => {
        const na = nodeMap.get(a);
        const nb = nodeMap.get(b);
        return (na?.x ?? 0) - (nb?.x ?? 0);
      });
    }

    // Add remaining nodes that weren't sorted (cycles)
    for (const node of originalNodes) {
      if (!sorted.includes(node.id)) {
        sorted.push(node.id);
      }
    }

    const cellWidth = DEFAULT_NODE_WIDTH + NODE_SEP;
    const cellHeight = DEFAULT_NODE_HEIGHT + NODE_SEP;
    // Round 50 single source — square-grid column derivation (row capacity).
    const maxPerRow = squareGridColumns(originalNodes.length);

    const positionedNodes: PositionedNode[] = originalNodes.map((node, index) => {
      const orderIndex = sorted.indexOf(node.id);
      const idx = orderIndex >= 0 ? orderIndex : index;
      const row = Math.floor(idx / maxPerRow);
      const col = idx % maxPerRow;
      // Round 49 single source — the DEFAULT-fallback box resolution pair.
      const { width: w, height: h } = defaultNodeExtent(node);
      return {
        ...node,
        x: col * cellWidth,
        y: row * cellHeight,
        width: w,
        height: h,
      };
    });

    const layoutEdges: LayoutEdge[] = originalEdges.map((edge) => {
      const fromNode = positionedNodes.find((n) => n.id === edge.from);
      const toNode = positionedNodes.find((n) => n.id === edge.to);
      return {
        from: edge.from,
        to: edge.to,
        points: [
          { x: (fromNode?.x ?? 0) + (fromNode?.width ?? DEFAULT_NODE_WIDTH) / 2, y: (fromNode?.y ?? 0) + (fromNode?.height ?? DEFAULT_NODE_HEIGHT) / 2 },
          { x: (toNode?.x ?? 0) + (toNode?.width ?? DEFAULT_NODE_WIDTH) / 2, y: (toNode?.y ?? 0) + (toNode?.height ?? DEFAULT_NODE_HEIGHT) / 2 },
        ],
        label: edge.label,
        id: edge.id,
      };
    });

    const canvas = calculateCanvasSize(positionedNodes);
    const metrics = calculateMetrics(positionedNodes, layoutEdges);

    return { nodes: positionedNodes, edges: layoutEdges, canvas, metrics };
  }
}

export const flowStrategy = new FlowStrategy();
