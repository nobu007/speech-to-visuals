/**
 * Network Layout Strategy
 *
 * Force-directed layout for network diagrams.
 * Places connected nodes near each other while keeping all nodes separated.
 *
 * Algorithm: Deterministic force-directed positioning
 * - Circular initial placement (no randomness)
 * - Repulsive forces between all node pairs
 * - Attractive forces along edges
 * - Multi-phase convergence
 */

import { NodeDatum, EdgeDatum, PositionedNode, LayoutEdge } from '@/types/diagram';
import { LayoutStrategy, StrategyLayoutResult } from '../types';
import { calculateCanvasSize, calculateMetrics } from '../layout-engine-v2';
import { getImportance, importanceSizeScale } from '../importance-scaler';

const DEFAULT_NODE_WIDTH = 120;
const DEFAULT_NODE_HEIGHT = 60;
const NODE_SEP = 80;
const DEFAULT_CANVAS_WIDTH = 1920;
const DEFAULT_CANVAS_HEIGHT = 1080;
const TARGET_ASPECT_RATIO = 16 / 9;

const PHASES = [
  { iterations: 25, repulsion: 300, attraction: 0.05, damping: 0.3 },
  { iterations: 30, repulsion: 200, attraction: 0.08, damping: 0.2 },
  { iterations: 20, repulsion: 100, attraction: 0.12, damping: 0.1 },
] as const;

export class NetworkStrategy implements LayoutStrategy {
  readonly name = 'network';
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

    const positioned = this.initializeCircle(nodes);
    this.runForceDirected(positioned, edges);

    const layoutEdges = this.buildEdges(edges, positioned);
    const canvas = calculateCanvasSize(positioned);
    const metrics = calculateMetrics(positioned, layoutEdges);

    return { nodes: positioned, edges: layoutEdges, canvas, metrics };
  }

  estimateComplexity(nodes: NodeDatum[]): number {
    return nodes.length * nodes.length;
  }

  /** Place nodes on a circle centred on the canvas.
   *  High-importance nodes are placed closer to center (smaller radius). */
  private initializeCircle(nodes: NodeDatum[]): PositionedNode[] {
    const cx = DEFAULT_CANVAS_WIDTH / 2;
    const cy = DEFAULT_CANVAS_HEIGHT / 2;
    const maxRadius = Math.min(cx, cy) * 0.6;

    return nodes.map((node, i) => {
      const angle = (2 * Math.PI * i) / nodes.length;
      // Important nodes get a smaller radius (closer to center)
      const imp = getImportance(node);
      const radius = maxRadius * (1.2 - imp * 0.5); // 0.7–1.2 multiplier
      const scale = importanceSizeScale(node);
      const w = Math.round((node.width ?? DEFAULT_NODE_WIDTH) * scale);
      const h = Math.round((node.height ?? DEFAULT_NODE_HEIGHT) * scale);
      return {
        ...node,
        x: cx + radius * Math.cos(angle) - w / 2,
        y: cy + radius * Math.sin(angle) - h / 2,
        width: w,
        height: h,
      };
    });
  }

  /** Multi-phase force-directed optimisation (deterministic). */
  private runForceDirected(nodes: PositionedNode[], edges: EdgeDatum[]): void {
    for (const phase of PHASES) {
      for (let iter = 0; iter < phase.iterations; iter++) {
        const forces = this.computeForces(nodes, edges, phase.repulsion, phase.attraction);
        this.applyForces(nodes, forces, phase.damping);
      }
    }
  }

  private computeForces(
    nodes: PositionedNode[],
    edges: EdgeDatum[],
    repulsionK: number,
    attractionK: number,
  ): Map<string, { x: number; y: number }> {
    const forces = new Map<string, { x: number; y: number }>();
    for (const n of nodes) forces.set(n.id, { x: 0, y: 0 });

    // Repulsive forces between every pair (importance-weighted)
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const ax = a.x + (a.width ?? DEFAULT_NODE_WIDTH) / 2;
        const ay = a.y + (a.height ?? DEFAULT_NODE_HEIGHT) / 2;
        const bx = b.x + (b.width ?? DEFAULT_NODE_WIDTH) / 2;
        const by = b.y + (b.height ?? DEFAULT_NODE_HEIGHT) / 2;
        const dx = bx - ax;
        const dy = by - ay;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        // Important nodes repel more strongly
        const impScale = 0.7 + 0.6 * (getImportance(a) + getImportance(b)) / 2;
        const force = (repulsionK * impScale) / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        forces.get(a.id)!.x -= fx;
        forces.get(a.id)!.y -= fy;
        forces.get(b.id)!.x += fx;
        forces.get(b.id)!.y += fy;
      }
    }

    // Attractive forces along edges (importance-weighted)
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    for (const edge of edges) {
      const src = nodeMap.get(edge.from);
      const tgt = nodeMap.get(edge.to);
      if (!src || !tgt) continue;
      const sx = src.x + (src.width ?? DEFAULT_NODE_WIDTH) / 2;
      const sy = src.y + (src.height ?? DEFAULT_NODE_HEIGHT) / 2;
      const tx = tgt.x + (tgt.width ?? DEFAULT_NODE_WIDTH) / 2;
      const ty = tgt.y + (tgt.height ?? DEFAULT_NODE_HEIGHT) / 2;
      const dx = tx - sx;
      const dy = ty - sy;
      const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      // Edges involving important nodes attract more strongly
      const impScale = 0.8 + 0.4 * Math.max(getImportance(src), getImportance(tgt));
      const force = attractionK * impScale * (dist - NODE_SEP * 2);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      forces.get(src.id)!.x += fx;
      forces.get(src.id)!.y += fy;
      forces.get(tgt.id)!.x -= fx;
      forces.get(tgt.id)!.y -= fy;
    }

    return forces;
  }

  private applyForces(
    nodes: PositionedNode[],
    forces: Map<string, { x: number; y: number }>,
    damping: number,
  ): void {
    for (const node of nodes) {
      const f = forces.get(node.id)!;
      const maxV = NODE_SEP * 2;
      const v = Math.sqrt(f.x * f.x + f.y * f.y);
      const scale = v > maxV ? maxV / v : 1;
      node.x += f.x * damping * scale;
      node.y += f.y * damping * scale;
      // Keep within bounds
      const w = node.width ?? DEFAULT_NODE_WIDTH;
      const h = node.height ?? DEFAULT_NODE_HEIGHT;
      node.x = Math.max(20, Math.min(DEFAULT_CANVAS_WIDTH - w - 20, node.x));
      node.y = Math.max(20, Math.min(DEFAULT_CANVAS_HEIGHT - h - 20, node.y));
    }
  }

  private buildEdges(edges: EdgeDatum[], nodes: PositionedNode[]): LayoutEdge[] {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    return edges.map(edge => {
      const src = nodeMap.get(edge.from);
      const tgt = nodeMap.get(edge.to);
      if (!src || !tgt) {
        return { from: edge.from, to: edge.to, points: [] as { x: number; y: number }[], label: edge.label };
      }
      return {
        from: edge.from,
        to: edge.to,
        points: [
          { x: src.x + (src.width ?? DEFAULT_NODE_WIDTH) / 2, y: src.y + (src.height ?? DEFAULT_NODE_HEIGHT) / 2 },
          { x: tgt.x + (tgt.width ?? DEFAULT_NODE_WIDTH) / 2, y: tgt.y + (tgt.height ?? DEFAULT_NODE_HEIGHT) / 2 },
        ],
        label: edge.label,
        id: edge.id,
      };
    });
  }
}

export const networkStrategy = new NetworkStrategy();
