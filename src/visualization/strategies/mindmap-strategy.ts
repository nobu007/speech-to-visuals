import { NodeDatum, EdgeDatum, PositionedNode, LayoutEdge } from '@/types/diagram';
import { LayoutStrategy, StrategyLayoutResult } from '../types';
import { calculateCanvasSize, calculateMetrics } from '../layout-engine-v2';
import { getImportance, importanceSizeScale } from '../importance-scaler';
import { getNodeWidth, getNodeHeight, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT } from '../node-dimensions';

const DEFAULT_CANVAS_WIDTH = 1920;
const DEFAULT_CANVAS_HEIGHT = 1080;
const TARGET_ASPECT_RATIO = 16 / 9;
const CENTER_MARGIN = 200;
const BRANCH_SPACING = 160;
const LEVEL_SPACING = 180;

/**
 * MindMap Layout Strategy
 *
 * Radial layout algorithm optimized for mind map diagrams.
 * Places the root node at center and radiates branches outward.
 *
 * Algorithm:
 * 1. Identify root node (most connections, or first node)
 * 2. Build adjacency tree from root via BFS
 * 3. Assign angular sectors to each main branch
 * 4. Position children at increasing radial distances
 * 5. Ensure zero overlap through sector-based spacing
 */
export class MindMapStrategy implements LayoutStrategy {
  readonly name = 'mindmap';
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
      return { nodes: positioned, edges: [], canvas, metrics: { overlapCount: 0, edgeCrossings: 0, aspectRatio: TARGET_ASPECT_RATIO } };
    }

    const root = this.findRoot(nodes, edges);
    const adjacency = this.buildAdjacency(nodes, edges);
    const tree = this.buildTree(root, adjacency);
    const positionedNodes = this.positionRadially(tree, nodes);
    const layoutEdges = this.generateEdges(edges, positionedNodes);

    const canvas = calculateCanvasSize(positionedNodes);
    const metrics = calculateMetrics(positionedNodes, layoutEdges);

    return { nodes: positionedNodes, edges: layoutEdges, canvas, metrics };
  }

  estimateComplexity(nodes: NodeDatum[]): number {
    return nodes.length * Math.log2(Math.max(nodes.length, 2));
  }

  /** Find the root node: highest combined degree + importance score, or first node. */
  private findRoot(nodes: NodeDatum[], edges: EdgeDatum[]): string {
    const degree = new Map<string, number>();
    for (const node of nodes) {
      degree.set(node.id, 0);
    }
    for (const edge of edges) {
      degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1);
      degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1);
    }

    // Combined score: degree * importance weight (importance range 0.5-1.0 acts as multiplier)
    let best = nodes[0].id;
    let bestScore = -1;
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    for (const [id, d] of degree) {
      const node = nodeMap.get(id);
      const imp = node ? getImportance(node) : 0.5;
      const score = d * (0.5 + imp); // importance boosts degree
      if (score > bestScore) { bestScore = score; best = id; }
    }
    return best;
  }

  /** Build undirected adjacency list from edges. */
  private buildAdjacency(nodes: NodeDatum[], edges: EdgeDatum[]): Map<string, string[]> {
    const adj = new Map<string, string[]>();
    for (const node of nodes) {
      adj.set(node.id, []);
    }
    for (const edge of edges) {
      adj.get(edge.from)?.push(edge.to);
      adj.get(edge.to)?.push(edge.from);
    }
    return adj;
  }

  /** Build a tree via BFS from root; returns children map. */
  private buildTree(root: string, adjacency: Map<string, string[]>): Map<string, string[]> {
    const children = new Map<string, string[]>();
    const visited = new Set<string>();
    const queue = [root];
    visited.add(root);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const kids: string[] = [];
      for (const neighbor of adjacency.get(current) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          kids.push(neighbor);
          queue.push(neighbor);
        }
      }
      children.set(current, kids);
    }

    return children;
  }

  /** Position nodes radially around the root. */
  private positionRadially(tree: Map<string, string[]>, nodes: NodeDatum[]): PositionedNode[] {
    const positions = new Map<string, { x: number; y: number }>();
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const root = this.findRootFromTree(tree, nodes);

    // Place root at center
    const center = { x: DEFAULT_CANVAS_WIDTH / 2, y: DEFAULT_CANVAS_HEIGHT / 2 };
    positions.set(root, center);

    const rootChildren = tree.get(root) ?? [];
    if (rootChildren.length === 0) {
      // Only root node, but there are other nodes not connected via edges
      return this.positionFallback(nodes, positions);
    }

    // Assign angular sectors to each branch, weighted by importance
    const totalBranches = rootChildren.length;
    const nodeMap2 = new Map(nodes.map(n => [n.id, n]));
    const branchWeights = rootChildren.map(id => {
      const n = nodeMap2.get(id);
      return n ? importanceSizeScale(n) : 1;
    });
    const totalWeight = branchWeights.reduce((a, b) => a + b, 0);

    let angleCursor = -Math.PI / 2; // Start from top
    for (let i = 0; i < totalBranches; i++) {
      const branchRoot = rootChildren[i];
      const sectorAngle = (2 * Math.PI * branchWeights[i]) / totalWeight;
      const baseAngle = angleCursor + sectorAngle / 2;
      angleCursor += sectorAngle;

      const branchDescendants = this.countDescendants(branchRoot, tree);
      const branchRadius = CENTER_MARGIN + Math.sqrt(branchDescendants + 1) * BRANCH_SPACING;

      // Position branch root
      const bx = center.x + Math.cos(baseAngle) * branchRadius;
      const by = center.y + Math.sin(baseAngle) * branchRadius;
      positions.set(branchRoot, { x: bx, y: by });

      // Position sub-children
      this.positionSubtree(branchRoot, tree, positions, center, baseAngle, branchRadius, 1, sectorAngle * 0.4);
    }

    // Assign remaining unvisited nodes
    for (const node of nodes) {
      if (!positions.has(node.id)) {
        positions.set(node.id, {
          x: center.x + (Math.random() - 0.5) * 400,
          y: center.y + (Math.random() - 0.5) * 400,
        });
      }
    }

    return nodes.map(node => {
      const pos = positions.get(node.id)!;
      const scale = importanceSizeScale(node);
      const w = Math.round(getNodeWidth(node, DEFAULT_NODE_WIDTH) * scale);
      const h = Math.round(getNodeHeight(node, DEFAULT_NODE_HEIGHT) * scale);
      return { ...node, x: pos.x - w / 2, y: pos.y - h / 2, width: w, height: h };
    });
  }

  /** Recursively position sub-tree nodes. */
  private positionSubtree(
    parentId: string,
    tree: Map<string, string[]>,
    positions: Map<string, { x: number; y: number }>,
    center: { x: number; y: number },
    parentAngle: number,
    parentRadius: number,
    level: number,
    availableSpread: number,
  ): void {
    const children = tree.get(parentId) ?? [];
    if (children.length === 0) return;

    const childRadius = parentRadius + LEVEL_SPACING;
    const childSpread = availableSpread / children.length;

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const angleOffset = (i - (children.length - 1) / 2) * childSpread;
      const angle = parentAngle + angleOffset;

      const cx = center.x + Math.cos(angle) * childRadius;
      const cy = center.y + Math.sin(angle) * childRadius;
      positions.set(child, { x: cx, y: cy });

      this.positionSubtree(child, tree, positions, center, angle, childRadius, level + 1, childSpread);
    }
  }

  /** Count total descendants of a node in the tree. */
  private countDescendants(nodeId: string, tree: Map<string, string[]>): number {
    const children = tree.get(nodeId) ?? [];
    let count = children.length;
    for (const child of children) {
      count += this.countDescendants(child, tree);
    }
    return count;
  }

  /** Find root from tree structure (node with most children at top level). */
  private findRootFromTree(tree: Map<string, string[]>, nodes: NodeDatum[]): string {
    // The root is the first node that appears as a key but not as a child of anyone
    const isChild = new Set<string>();
    for (const [, children] of tree) {
      for (const child of children) {
        isChild.add(child);
      }
    }
    for (const [id] of tree) {
      if (!isChild.has(id)) return id;
    }
    if (nodes.length === 0) return '';
    return nodes[0].id;
  }

  /** Fallback for disconnected nodes. */
  private positionFallback(
    nodes: NodeDatum[],
    positions: Map<string, { x: number; y: number }>,
  ): PositionedNode[] {
    const cx = DEFAULT_CANVAS_WIDTH / 2;
    const cy = DEFAULT_CANVAS_HEIGHT / 2;
    return nodes.map((node, i) => {
      if (positions.has(node.id)) {
        const pos = positions.get(node.id)!;
        const w = getNodeWidth(node, DEFAULT_NODE_WIDTH);
        const h = getNodeHeight(node, DEFAULT_NODE_HEIGHT);
        return { ...node, x: pos.x - w / 2, y: pos.y - h / 2, width: w, height: h };
      }
      const angle = (2 * Math.PI * i) / nodes.length;
      const radius = CENTER_MARGIN + i * 20;
      const w = getNodeWidth(node, DEFAULT_NODE_WIDTH);
      const h = getNodeHeight(node, DEFAULT_NODE_HEIGHT);
      return {
        ...node,
        x: cx + Math.cos(angle) * radius - w / 2,
        y: cy + Math.sin(angle) * radius - h / 2,
        width: w,
        height: h,
      };
    });
  }

  /** Generate layout edges with straight-line points. */
  private generateEdges(edges: EdgeDatum[], nodes: PositionedNode[]): LayoutEdge[] {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    return edges.map(edge => {
      const source = nodeMap.get(edge.from);
      const target = nodeMap.get(edge.to);
      return {
        from: edge.from,
        to: edge.to,
        points: [
          { x: (source?.x ?? 0) + (source?.width ?? DEFAULT_NODE_WIDTH) / 2, y: (source?.y ?? 0) + (source?.height ?? DEFAULT_NODE_HEIGHT) / 2 },
          { x: (target?.x ?? 0) + (target?.width ?? DEFAULT_NODE_WIDTH) / 2, y: (target?.y ?? 0) + (target?.height ?? DEFAULT_NODE_HEIGHT) / 2 },
        ],
        label: edge.label,
        id: edge.id,
      };
    });
  }
}

export const mindmapStrategy = new MindMapStrategy();
