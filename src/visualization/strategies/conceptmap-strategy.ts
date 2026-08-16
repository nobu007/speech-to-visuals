/**
 * ConceptMap Layout Strategy
 *
 * Hierarchical layout with cross-connection support for concept map diagrams.
 * Unlike mind maps (radial) or networks (force-directed), concept maps use
 * a top-down hierarchy where cross-connections between branches are common.
 *
 * Algorithm:
 * 1. Identify root concept (highest combined degree + importance)
 * 2. Build BFS tree from root to establish hierarchy levels
 * 3. Position nodes top-down with horizontal spreading per level
 * 4. Cross-connections (non-tree edges) are preserved with edge labels
 * 5. Importance-aware node sizing and horizontal spacing
 */

import { NodeDatum, EdgeDatum, PositionedNode } from '@/types/diagram';
import { LayoutStrategy, StrategyLayoutResult } from '../types';
import { calculateCanvasSize, calculateMetrics } from '../layout-engine-v2';
import { getImportance, importanceSizeScale } from '../importance-scaler';
import { getNodeWidth, getNodeHeight, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT } from '../node-dimensions';
import { DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT } from '../canvas-dimensions';
import { emptyLayoutResult, emptyStrategyLayoutMetrics } from '../empty-layout-result';
import { buildAnchoredLayoutEdges, centerToCenterAnchors } from '../strategy-edges';


const LEVEL_SPACING = 160;
const TOP_MARGIN = 60;
const NODE_SEP_X = 40;

export class ConceptMapStrategy implements LayoutStrategy {
  readonly name = 'conceptmap';
  readonly canEscapeLocalMinimum = true;

  apply(nodes: NodeDatum[], edges: EdgeDatum[]): StrategyLayoutResult {
    if (nodes.length === 0) {
      return emptyLayoutResult();
    }

    if (nodes.length === 1) {
      const scale = importanceSizeScale(nodes[0]);
      const w = Math.round(getNodeWidth(nodes[0], DEFAULT_NODE_WIDTH) * scale);
      const h = Math.round(getNodeHeight(nodes[0], DEFAULT_NODE_HEIGHT) * scale);
      const positioned: PositionedNode[] = [{
        ...nodes[0],
        x: (DEFAULT_CANVAS_WIDTH - w) / 2,
        y: (DEFAULT_CANVAS_HEIGHT - h) / 2,
        width: w,
        height: h,
      }];
      const canvas = calculateCanvasSize(positioned);
      return {
        nodes: positioned,
        edges: [],
        canvas,
        metrics: emptyStrategyLayoutMetrics(),
      };
    }

    const root = this.findRoot(nodes, edges);
    const adjacency = this.buildAdjacency(nodes, edges);
    const { parentMap, levelMap } = this.buildHierarchy(root, adjacency, nodes);
    const positionedNodes = this.positionHierarchical(nodes, levelMap);
    const layoutEdges = buildAnchoredLayoutEdges(edges, positionedNodes, centerToCenterAnchors);

    const canvas = calculateCanvasSize(positionedNodes);
    const metrics = calculateMetrics(positionedNodes, layoutEdges);

    return { nodes: positionedNodes, edges: layoutEdges, canvas, metrics };
  }

  estimateComplexity(nodes: NodeDatum[]): number {
    return nodes.length * Math.log2(Math.max(nodes.length, 2));
  }

  /** Find root: highest combined degree + importance score. */
  private findRoot(nodes: NodeDatum[], edges: EdgeDatum[]): string {
    const degree = new Map<string, number>();
    for (const node of nodes) degree.set(node.id, 0);
    for (const edge of edges) {
      degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1);
      degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1);
    }

    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    if (nodes.length === 0) return '';
    let best = nodes[0].id;
    let bestScore = -1;
    for (const [id, d] of degree) {
      const node = nodeMap.get(id);
      const imp = node ? getImportance(node) : 0.5;
      const score = d * (0.5 + imp);
      if (score > bestScore) { bestScore = score; best = id; }
    }
    return best;
  }

  /** Build undirected adjacency list. */
  private buildAdjacency(nodes: NodeDatum[], edges: EdgeDatum[]): Map<string, string[]> {
    const adj = new Map<string, string[]>();
    for (const node of nodes) adj.set(node.id, []);
    for (const edge of edges) {
      adj.get(edge.from)?.push(edge.to);
      adj.get(edge.to)?.push(edge.from);
    }
    return adj;
  }

  /** BFS from root to assign hierarchy levels. Returns parent map and level map. */
  private buildHierarchy(
    root: string,
    adjacency: Map<string, string[]>,
    nodes: NodeDatum[],
  ): { parentMap: Map<string, string | null>; levelMap: Map<string, number> } {
    const parentMap = new Map<string, string | null>();
    const levelMap = new Map<string, number>();
    const visited = new Set<string>();
    const queue: Array<{ id: string; level: number; parent: string | null }> = [
      { id: root, level: 0, parent: null },
    ];
    visited.add(root);

    while (queue.length > 0) {
      const { id, level, parent } = queue.shift()!;
      parentMap.set(id, parent);
      levelMap.set(id, level);

      // Sort neighbors by importance (descending) for deterministic ordering
      const neighbors = (adjacency.get(id) ?? [])
        .filter(n => !visited.has(n))
        .sort((a, b) => {
          const nodeA = nodes.find(n => n.id === a);
          const nodeB = nodes.find(n => n.id === b);
          return (nodeB ? getImportance(nodeB) : 0.5) - (nodeA ? getImportance(nodeA) : 0.5);
        });

      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push({ id: neighbor, level: level + 1, parent: id });
        }
      }
    }

    // Assign disconnected nodes to the deepest level + 1
    const maxLevel = Math.max(0, ...levelMap.values());
    for (const node of nodes) {
      if (!visited.has(node.id)) {
        levelMap.set(node.id, maxLevel + 1);
        parentMap.set(node.id, null);
      }
    }

    return { parentMap, levelMap };
  }

  /** Position nodes in a top-down hierarchical layout. */
  private positionHierarchical(
    nodes: NodeDatum[],
    levelMap: Map<string, number>,
  ): PositionedNode[] {
    const maxLevel = Math.max(0, ...levelMap.values());
    const levelGroups: Map<number, string[]> = new Map();
    for (let l = 0; l <= maxLevel; l++) levelGroups.set(l, []);
    for (const [id, level] of levelMap) {
      levelGroups.get(level)?.push(id);
    }

    // Compute positions per level
    const positions = new Map<string, { x: number; y: number }>();
    const cx = DEFAULT_CANVAS_WIDTH / 2;

    for (let level = 0; level <= maxLevel; level++) {
      const ids = levelGroups.get(level) ?? [];
      if (ids.length === 0) continue;

      // Compute total width needed for this level (importance-scaled)
      const nodeMap = new Map(nodes.map(n => [n.id, n]));
      const widths = ids.map(id => {
        const node = nodeMap.get(id);
        const scale = node ? importanceSizeScale(node) : 1;
        return Math.round(getNodeWidth(node ?? { width: 0, w: 0 }, DEFAULT_NODE_WIDTH) * scale);
      });

      const totalWidth = widths.reduce((sum, w) => sum + w, 0) + (ids.length - 1) * NODE_SEP_X;
      let cursor = cx - totalWidth / 2;
      const y = TOP_MARGIN + level * LEVEL_SPACING;

      for (let i = 0; i < ids.length; i++) {
        const w = widths[i];
        positions.set(ids[i], { x: cursor, y });
        cursor += w + NODE_SEP_X;
      }
    }

    // Build positioned nodes
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    return nodes.map(node => {
      const pos = positions.get(node.id)!;
      const scale = importanceSizeScale(node);
      const w = Math.round(getNodeWidth(node, DEFAULT_NODE_WIDTH) * scale);
      const h = Math.round(getNodeHeight(node, DEFAULT_NODE_HEIGHT) * scale);
      return { ...node, x: pos.x, y: pos.y, width: w, height: h };
    });
  }
}

export const conceptmapStrategy = new ConceptMapStrategy();
