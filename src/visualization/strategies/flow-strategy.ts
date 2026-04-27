import * as dagreLib from '@dagrejs/dagre';
const dagre = (dagreLib as any).default ?? dagreLib;
import { NodeDatum, EdgeDatum, PositionedNode, LayoutEdge } from '@/types/diagram';
import { LayoutStrategy, StrategyLayoutResult, CanvasSize, StrategyLayoutMetrics } from '../types';
import { calculateCanvasSize, calculateMetrics } from '../layout-engine-v2';

const DEFAULT_NODE_WIDTH = 120;
const DEFAULT_NODE_HEIGHT = 60;
const NODE_SEP = 50;
const RANK_SEP = 80;
const DEFAULT_CANVAS_WIDTH = 1920;
const DEFAULT_CANVAS_HEIGHT = 1080;
const TARGET_ASPECT_RATIO = 16 / 9;

export class FlowStrategy implements LayoutStrategy {
  readonly name = 'flow';
  readonly canEscapeLocalMinimum = true;

  apply(nodes: NodeDatum[], edges: EdgeDatum[]): StrategyLayoutResult {
    if (nodes.length === 0) {
      return {
        nodes: [],
        edges: [],
        canvas: { width: DEFAULT_CANVAS_WIDTH, height: DEFAULT_CANVAS_HEIGHT },
        metrics: { overlapCount: 0, edgeCrossings: 0, aspectRatio: TARGET_ASPECT_RATIO },
      };
    }

    const g = new dagre.graphlib.Graph();
    g.setGraph({
      rankdir: 'LR',
      nodesep: NODE_SEP,
      ranksep: RANK_SEP,
    });
    g.setDefaultEdgeLabel(() => ({}));

    for (const node of nodes) {
      const w = node.width ?? DEFAULT_NODE_WIDTH;
      const h = node.height ?? DEFAULT_NODE_HEIGHT;
      g.setNode(node.id, { width: w, height: h, label: node.label });
    }

    for (const edge of edges) {
      g.setEdge(edge.from, edge.to, { label: edge.label ?? '' });
    }

    dagre.layout(g);

    const positionedNodes: PositionedNode[] = nodes.map((node) => {
      const dagreNode = g.node(node.id);
      const w = node.width ?? DEFAULT_NODE_WIDTH;
      const h = node.height ?? DEFAULT_NODE_HEIGHT;
      return {
        ...node,
        x: dagreNode.x - w / 2,
        y: dagreNode.y - h / 2,
        width: w,
        height: h,
      };
    });

    const layoutEdges: LayoutEdge[] = edges.map((edge) => {
      const dagreEdge = g.edge(edge.from, edge.to);
      return {
        from: edge.from,
        to: edge.to,
        points: dagreEdge.points ?? [
          { x: g.node(edge.from).x, y: g.node(edge.from).y },
          { x: g.node(edge.to).x, y: g.node(edge.to).y },
        ],
        label: edge.label,
        id: edge.id,
      };
    });

    const canvas = calculateCanvasSize(positionedNodes);
    const metrics = calculateMetrics(positionedNodes, layoutEdges);

    if (metrics.overlapCount > 0) {
      return this.gridSnapFallback(nodes, edges, positionedNodes);
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
    const maxPerRow = Math.max(1, Math.ceil(Math.sqrt(originalNodes.length)));

    const positionedNodes: PositionedNode[] = originalNodes.map((node, index) => {
      const orderIndex = sorted.indexOf(node.id);
      const idx = orderIndex >= 0 ? orderIndex : index;
      const row = Math.floor(idx / maxPerRow);
      const col = idx % maxPerRow;
      const w = node.width ?? DEFAULT_NODE_WIDTH;
      const h = node.height ?? DEFAULT_NODE_HEIGHT;
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
