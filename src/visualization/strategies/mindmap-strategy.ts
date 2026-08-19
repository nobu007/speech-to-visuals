import { NodeDatum, EdgeDatum, PositionedNode } from '@stv/core/types/diagram';
import { LayoutStrategy, StrategyLayoutResult } from '../types';
import { createLayoutRng } from '../layout-rng';
import { calculateCanvasSize, calculateMetrics } from '../layout-engine-v2';
import { importanceSizeScale } from '../importance-scaler';
import { defaultNodeExtent } from '../node-dimensions';
import { DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT } from '../canvas-dimensions';
import { emptyLayoutResult } from '../empty-layout-result';
import { ringAngle, pointOnCircle } from '../layout-utils';
import { buildAnchoredLayoutEdges, centerToCenterAnchors } from '../strategy-edges';
import {
  buildUndirectedAdjacency,
  findImportanceRoot,
  scaledNodeExtent,
  singleNodeCenteredLayout,
} from '../strategy-graph';

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
      return emptyLayoutResult();
    }

    if (nodes.length === 1) {
      // Shared single-node epilogue (round 42): importance-scaled extent,
      // centered on the default canvas, no edges, empty metrics.
      return singleNodeCenteredLayout(nodes);
    }

    const root = findImportanceRoot(nodes, edges);
    const adjacency = buildUndirectedAdjacency(nodes, edges);
    const tree = this.buildTree(root, adjacency);
    // Seeded per-generate (round 17): rng lives in a local, never on `this` —
    // strategy instances are reused across diagrams and a stored rng would
    // leak the previous diagram's sequence.
    const rng = createLayoutRng(nodes.map(n => n.id).join('|'));
    const positionedNodes = this.positionRadially(tree, nodes, rng);
    const layoutEdges = buildAnchoredLayoutEdges(edges, positionedNodes, centerToCenterAnchors);

    const canvas = calculateCanvasSize(positionedNodes);
    const metrics = calculateMetrics(positionedNodes, layoutEdges);

    return { nodes: positionedNodes, edges: layoutEdges, canvas, metrics };
  }

  estimateComplexity(nodes: NodeDatum[]): number {
    return nodes.length * Math.log2(Math.max(nodes.length, 2));
  }

  // Root selection + undirected adjacency are shared single sources since
  // round 42 (strategy-graph findImportanceRoot / buildUndirectedAdjacency)
  // — the conceptmap strategy uses the same two, byte-identical before the
  // extraction.

  /** Build a tree via BFS from root; returns children map. */
  private buildTree(root: string, adjacency: Map<string, string[]>): Map<string, string[]> {
    const children = new Map<string, string[]>();
    const visited = new Set<string>();
    const queue = [root];
    visited.add(root);

    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined) break; // unreachable while the length guard holds
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
  private positionRadially(
    tree: Map<string, string[]>,
    nodes: NodeDatum[],
    rng: () => number,
  ): PositionedNode[] {
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

      // Position branch root — round 48 single-source circle point.
      positions.set(branchRoot, pointOnCircle(center.x, center.y, baseAngle, branchRadius));

      // Position sub-children
      this.positionSubtree(branchRoot, tree, positions, center, baseAngle, branchRadius, 1, sectorAngle * 0.4);
    }

    // Assign remaining unvisited nodes
    for (const node of nodes) {
      if (!positions.has(node.id)) {
        positions.set(node.id, {
          x: center.x + (rng() - 0.5) * 400,
          y: center.y + (rng() - 0.5) * 400,
        });
      }
    }

    return nodes.map(node => {
      const pos = positions.get(node.id);
      if (pos === undefined) {
        throw new Error(`[MindMap] radial placement missing node ${node.id}`);
      }
      // Shared importance-scaled extent (round 42) — identical Math.round(
      // extent * importanceSizeScale) both axes, via strategy-graph.
      const { width: w, height: h } = scaledNodeExtent(node);
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

      // Round 48 single-source — circle point in layout-utils (polar tree:
      // arbitrary parent-relative angle, per-level radius).
      const pos = pointOnCircle(center.x, center.y, angle, childRadius);
      positions.set(child, pos);

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
      const pos = positions.get(node.id);
      if (pos !== undefined) {
        // Round 49 single source — the DEFAULT-fallback box resolution pair.
        const { width: w, height: h } = defaultNodeExtent(node);
        return { ...node, x: pos.x - w / 2, y: pos.y - h / 2, width: w, height: h };
      }
      const radius = CENTER_MARGIN + i * 20;
      // Round 49 single source — the DEFAULT-fallback box resolution pair.
      const { width: w, height: h } = defaultNodeExtent(node);
      // Round 48 single-source — ring step + circle point in layout-utils
      // (per-index spiral radius threads through the seam); the `- w / 2`
      // top-left conversion stays here.
      const p = pointOnCircle(cx, cy, ringAngle(i, nodes.length), radius);
      return {
        ...node,
        x: p.x - w / 2,
        y: p.y - h / 2,
        width: w,
        height: h,
      };
    });
  }
}

export const mindmapStrategy = new MindMapStrategy();
