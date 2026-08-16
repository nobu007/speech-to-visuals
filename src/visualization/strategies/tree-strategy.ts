import * as dagreLib from '@dagrejs/dagre';
const dagre = (dagreLib as unknown as { default?: typeof dagreLib }).default ?? dagreLib;
import { NodeDatum, EdgeDatum, PositionedNode, LayoutEdge } from '@/types/diagram';
import { LayoutStrategy, StrategyLayoutResult, CanvasSize, StrategyLayoutMetrics } from '../types';
import { calculateCanvasSize, calculateMetrics } from '../layout-engine-v2';
import { getNodeWidth, getNodeHeight, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT } from '../node-dimensions';
import { emptyLayoutResult } from '../empty-layout-result';

const NODE_SEP = 60;
const RANK_SEP = 100;

export class TreeStrategy implements LayoutStrategy {
  readonly name = 'tree';
  readonly canEscapeLocalMinimum = true;

  apply(nodes: NodeDatum[], edges: EdgeDatum[]): StrategyLayoutResult {
    if (nodes.length === 0) {
      return emptyLayoutResult();
    }

    const g = new dagre.graphlib.Graph();
    g.setGraph({
      rankdir: 'TB',
      nodesep: NODE_SEP,
      ranksep: RANK_SEP,
    });
    g.setDefaultEdgeLabel(() => ({}));

    for (const node of nodes) {
      const w = getNodeWidth(node, DEFAULT_NODE_WIDTH);
      const h = getNodeHeight(node, DEFAULT_NODE_HEIGHT);
      g.setNode(node.id, { width: w, height: h, label: node.label });
    }

    // Filter edges whose endpoints are not in the input node set BEFORE handing
    // them to dagre. dagre auto-creates phantom nodes for unknown edge
    // endpoints, corrupting the layout and emitting edges that point at
    // non-existent nodes. Mirrors the f178cbf hardening in
    // enhanced-zero-overlap-layout.ts.
    const nodeIds = new Set(nodes.map((node) => node.id));
    const safeEdges = edges.filter(
      (edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to)
    );

    for (const edge of safeEdges) {
      g.setEdge(edge.from, edge.to, { label: edge.label ?? '' });
    }

    dagre.layout(g);

    const positionedNodes: PositionedNode[] = nodes.map((node) => {
      const dagreNode = g.node(node.id);
      const w = getNodeWidth(node, DEFAULT_NODE_WIDTH);
      const h = getNodeHeight(node, DEFAULT_NODE_HEIGHT);
      return {
        ...node,
        x: dagreNode.x - w / 2,
        y: dagreNode.y - h / 2,
        width: w,
        height: h,
      };
    });

    const layoutEdges: LayoutEdge[] = safeEdges.map((edge) => {
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
    const nodeMap = new Map<string, PositionedNode>();

    // Identify root nodes (no incoming edges)
    const hasIncoming = new Set<string>();
    for (const edge of originalEdges) {
      hasIncoming.add(edge.to);
    }
    const roots = originalNodes.filter((n) => !hasIncoming.has(n.id));

    // BFS from roots to establish parent-child vertical order
    const visited = new Set<string>();
    const levels = new Map<string, number>();
    const queue: Array<{ id: string; level: number }> = [];

    // Sort roots by dagre y for stable ordering
    const sortedRoots = roots.sort((a, b) => {
      const na = nodeMap.get(a.id);
      const nb = nodeMap.get(b.id);
      return (na?.y ?? 0) - (nb?.y ?? 0);
    });

    for (const root of sortedRoots) {
      queue.push({ id: root.id, level: 0 });
      visited.add(root.id);
    }

    const adjacency = new Map<string, string[]>();
    for (const node of originalNodes) {
      adjacency.set(node.id, []);
    }
    for (const edge of originalEdges) {
      adjacency.get(edge.from)?.push(edge.to);
    }

    while (queue.length > 0) {
      const { id, level } = queue.shift()!;
      levels.set(id, level);
      const neighbors = adjacency.get(id) ?? [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push({ id: neighbor, level: level + 1 });
        }
      }
    }

    // Assign remaining unvisited nodes
    for (const node of originalNodes) {
      if (!visited.has(node.id)) {
        levels.set(node.id, 0);
      }
    }

    // Group by level and maintain horizontal order within each level
    const levelGroups = new Map<number, string[]>();
    for (const [id, level] of levels) {
      if (!levelGroups.has(level)) {
        levelGroups.set(level, []);
      }
      levelGroups.get(level)!.push(id);
    }

    // Sort within each level by dagre x
    for (const [, group] of levelGroups) {
      group.sort((a, b) => {
        const na = nodeMap.get(a);
        const nb = nodeMap.get(b);
        return (na?.x ?? 0) - (nb?.x ?? 0);
      });
    }

    const cellWidth = DEFAULT_NODE_WIDTH + NODE_SEP;
    const cellHeight = DEFAULT_NODE_HEIGHT + RANK_SEP;
    const maxLevel = Math.max(...levels.values(), 0);

    // Count max nodes per level for centering
    let maxPerLevel = 0;
    for (const [, group] of levelGroups) {
      if (group.length > maxPerLevel) {
        maxPerLevel = group.length;
      }
    }

    const positionedNodes: PositionedNode[] = originalNodes.map((node) => {
      const level = levels.get(node.id) ?? 0;
      const group = levelGroups.get(level) ?? [];
      const colIndex = group.indexOf(node.id);
      const w = getNodeWidth(node, DEFAULT_NODE_WIDTH);
      const h = getNodeHeight(node, DEFAULT_NODE_HEIGHT);

      // Center nodes within each level
      const levelWidth = group.length * cellWidth;
      const totalWidth = maxPerLevel * cellWidth;
      const offset = (totalWidth - levelWidth) / 2;

      return {
        ...node,
        x: offset + colIndex * cellWidth,
        y: level * cellHeight,
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

export const treeStrategy = new TreeStrategy();
