/**
 * Timeline Layout Strategy (Phase 3 - Strategy Architecture)
 *
 * Positions nodes vertically by timestamp (top=earliest, bottom=latest),
 * with X-axis optimized via force-directed method and grid-snap fallback.
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
const GRID_SNAP_SIZE = 20;
const FORCE_ITERATIONS = 50;
const REPULSION_STRENGTH = 200;
const CENTER_GRAVITY = 0.01;

/**
 * Determine node order from edges (topological / edge-following order).
 * Falls back to original array index if edges don't fully order the nodes.
 */
function determineNodeOrder(nodes: NodeDatum[], edges: EdgeDatum[]): NodeDatum[] {
  if (edges.length === 0 || nodes.length <= 1) {
    return [...nodes];
  }

  // Build adjacency: count incoming edges for each node
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  for (const edge of edges) {
    if (nodeMap.has(edge.from) && nodeMap.has(edge.to)) {
      adjacency.get(edge.from)!.push(edge.to);
      inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
    }
  }

  // Kahn's algorithm for topological sort
  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) {
      queue.push(id);
    }
  }

  const ordered: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    ordered.push(current);
    for (const neighbor of adjacency.get(current) ?? []) {
      const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) {
        queue.push(neighbor);
      }
    }
  }

  // Append any remaining nodes not connected by edges
  for (const node of nodes) {
    if (!ordered.includes(node.id)) {
      ordered.push(node.id);
    }
  }

  return ordered.map((id) => nodeMap.get(id)!);
}

function nodesOverlap(a: PositionedNode, b: PositionedNode): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/**
 * Grid-snap fallback: iteratively resolve all overlaps by snapping X to a grid
 * and nudging Y downward as needed. Preserves timeline order (Y stays increasing).
 */
function gridSnapResolve(
  positionedNodes: PositionedNode[],
  gridSnapSize: number,
  canvasWidth: number,
): PositionedNode[] {
  // Work on copies sorted by Y (timeline order)
  const result = positionedNodes
    .map((n) => ({ ...n }))
    .sort((a, b) => a.y - b.y || a.x - b.x);

  // Iterative overlap resolution
  const maxIterations = result.length * 2;
  for (let iter = 0; iter < maxIterations; iter++) {
    let foundOverlap = false;
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        if (!nodesOverlap(result[i], result[j])) continue;
        foundOverlap = true;

        // Try to resolve by spreading X first
        const xOverlap =
          Math.min(result[i].x + result[i].width, result[j].x + result[j].width) -
          Math.max(result[i].x, result[j].x);

        if (xOverlap > 0 && result[i].x !== result[j].x) {
          // Push apart horizontally
          const push = xOverlap / 2 + gridSnapSize;
          if (result[i].x < result[j].x) {
            result[i].x = Math.max(CANVAS_PADDING, snapToGrid(result[i].x - push, gridSnapSize));
            result[j].x = Math.min(
              canvasWidth - result[j].width - CANVAS_PADDING,
              snapToGrid(result[j].x + push, gridSnapSize),
            );
          } else {
            result[i].x = Math.min(
              canvasWidth - result[i].width - CANVAS_PADDING,
              snapToGrid(result[i].x + push, gridSnapSize),
            );
            result[j].x = Math.max(CANVAS_PADDING, snapToGrid(result[j].x - push, gridSnapSize));
          }
        } else {
          // Same X or purely vertical overlap: nudge the later node's Y downward
          const minYForJ = result[i].y + result[i].height + gridSnapSize;
          if (result[j].y < minYForJ) {
            result[j].y = snapToGrid(minYForJ, gridSnapSize);
          }
          // Also spread X for extra safety
          const push = (result[i].width + gridSnapSize) / 2;
          result[i].x = Math.max(CANVAS_PADDING, snapToGrid(result[i].x - push, gridSnapSize));
          result[j].x = Math.min(
            canvasWidth - result[j].width - CANVAS_PADDING,
            snapToGrid(result[j].x + push, gridSnapSize),
          );
        }
      }
    }
    if (!foundOverlap) break;
  }

  return result;
}

function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Simple force-directed X-axis optimization.
 * Y is fixed based on timeline order. Only X is adjusted.
 */
function forceDirectedX(
  positionedNodes: PositionedNode[],
  canvasWidth: number,
): PositionedNode[] {
  const xs = positionedNodes.map((n) => n.x);

  for (let iter = 0; iter < FORCE_ITERATIONS; iter++) {
    const forces = new Array(xs.length).fill(0);

    for (let i = 0; i < xs.length; i++) {
      // Center gravity: pull toward canvas center
      const centerX = canvasWidth / 2;
      forces[i] += (centerX - xs[i]) * CENTER_GRAVITY;

      // Repulsion from other nodes
      for (let j = 0; j < xs.length; j++) {
        if (i === j) continue;

        const yDiff = Math.abs(positionedNodes[i].y - positionedNodes[j].y);
        // Only repel if Y levels are close enough for potential overlap
        if (yDiff < DEFAULT_NODE_HEIGHT) {
          const dx = xs[i] - xs[j];
          const minDist = DEFAULT_NODE_WIDTH + 20; // Minimum horizontal separation
          if (Math.abs(dx) < minDist) {
            const sign = dx === 0 ? (i < j ? -1 : 1) : Math.sign(dx);
            const magnitude = REPULSION_STRENGTH / Math.max(Math.abs(dx), 1);
            forces[i] += sign * magnitude;
          }
        }
      }
    }

    // Apply forces with damping
    const damping = 0.5;
    for (let i = 0; i < xs.length; i++) {
      xs[i] += forces[i] * damping;
      // Clamp to canvas bounds
      xs[i] = Math.max(CANVAS_PADDING, Math.min(canvasWidth - DEFAULT_NODE_WIDTH - CANVAS_PADDING, xs[i]));
    }
  }

  return positionedNodes.map((node, i) => ({
    ...node,
    x: xs[i],
  }));
}

export class TimelineStrategy implements LayoutStrategy {
  readonly name = 'timeline';
  readonly canEscapeLocalMinimum = true;

  apply(nodes: NodeDatum[], edges: EdgeDatum[]): StrategyLayoutResult {
    // Empty graph case
    if (nodes.length === 0) {
      return {
        nodes: [],
        edges: [],
        canvas: { width: DEFAULT_CANVAS_WIDTH, height: DEFAULT_CANVAS_HEIGHT },
        metrics: { overlapCount: 0, edgeCrossings: 0, aspectRatio: 16 / 9 },
      };
    }

    // Step 1: Determine node order (by edge topology or fallback to index)
    const orderedNodes = determineNodeOrder(nodes, edges);

    // Step 2: Assign Y positions - evenly spaced vertically
    const usableHeight = DEFAULT_CANVAS_HEIGHT - 2 * CANVAS_PADDING;
    const ySpacing = nodes.length > 1 ? usableHeight / (nodes.length - 1) : 0;
    const startY = CANVAS_PADDING;

    // Step 3: Initial X positions centered
    const centerX = DEFAULT_CANVAS_WIDTH / 2 - DEFAULT_NODE_WIDTH / 2;

    const positionedNodes: PositionedNode[] = orderedNodes.map((node, index) => ({
      ...node,
      x: centerX,
      y: startY + index * ySpacing,
      width: node.width ?? DEFAULT_NODE_WIDTH,
      height: node.height ?? DEFAULT_NODE_HEIGHT,
    }));

    // Single node: no need for force-directed or grid-snap
    if (nodes.length === 1) {
      const canvas = calculateCanvasSize(positionedNodes);
      const layoutEdges = this.buildLayoutEdges(edges, positionedNodes);
      const metrics = calculateMetrics(positionedNodes, layoutEdges);
      return { nodes: positionedNodes, edges: layoutEdges, canvas, metrics };
    }

    // Step 4: Force-directed X optimization
    let optimizedNodes = forceDirectedX(positionedNodes, DEFAULT_CANVAS_WIDTH);

    // Step 5: Check for remaining overlaps and apply grid-snap fallback
    let hasOverlaps = false;
    for (let i = 0; i < optimizedNodes.length && !hasOverlaps; i++) {
      for (let j = i + 1; j < optimizedNodes.length; j++) {
        if (nodesOverlap(optimizedNodes[i], optimizedNodes[j])) {
          hasOverlaps = true;
          break;
        }
      }
    }

    if (hasOverlaps) {
      optimizedNodes = gridSnapResolve(optimizedNodes, GRID_SNAP_SIZE, DEFAULT_CANVAS_WIDTH);
    }

    // Step 6: Build edges and calculate final metrics
    const layoutEdges = this.buildLayoutEdges(edges, optimizedNodes);
    const canvas = calculateCanvasSize(optimizedNodes);
    const metrics = calculateMetrics(optimizedNodes, layoutEdges);

    return { nodes: optimizedNodes, edges: layoutEdges, canvas, metrics };
  }

  estimateComplexity(nodes: NodeDatum[]): number {
    const n = nodes.length;
    // Force-directed iterations * node interactions + topological sort
    return FORCE_ITERATIONS * n * n + n;
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

      // Vertical connection: source bottom-center to target top-center
      const sourcePoint = {
        x: source.x + source.width / 2,
        y: source.y + source.height,
      };
      const targetPoint = {
        x: target.x + target.width / 2,
        y: target.y,
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
