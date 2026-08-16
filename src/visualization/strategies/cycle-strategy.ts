/**
 * Cycle Layout Strategy
 *
 * Arranges nodes in a circle with equal angular spacing.
 * Uses Force-Directed fallback if overlaps are detected after initial placement.
 *
 * Algorithm:
 * 1. Calculate circle radius based on node count and max node size
 * 2. Position nodes equally spaced around the circle
 * 3. If overlaps persist, apply Force-Directed repulsion to resolve them
 */

import { NodeDatum, EdgeDatum, PositionedNode } from '@/types/diagram';
import {
  LayoutStrategy,
  StrategyLayoutResult,
  CanvasSize,
  StrategyLayoutMetrics,
} from '@/visualization/types';
import { calculateCanvasSize, calculateMetrics } from '@/visualization/layout-engine-v2';
import { getNodeWidth, getNodeHeight, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT } from '../node-dimensions';
import { DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT } from '../canvas-dimensions';
import { emptyLayoutResult } from '../empty-layout-result';
import { buildAnchoredLayoutEdges, centerToCenterAnchors } from '../strategy-edges';
// Canonical overlap predicate — single source of truth (see layout-utils.ts).
import { nodesOverlap, hasOverlapPairs, distance } from '../layout-utils';

const MIN_RADIUS = 200;
const OVERLAP_SPACING_FACTOR = 1.2;
const FORCE_DIRECTED_ITERATIONS = 50;
const FORCE_DIRECTED_STRENGTH = 100;

interface ForceNode {
  positioned: PositionedNode;
  vx: number;
  vy: number;
}

export class CycleLayoutStrategy implements LayoutStrategy {
  readonly name = 'cycle';
  readonly canEscapeLocalMinimum = true;

  apply(nodes: NodeDatum[], edges: EdgeDatum[]): StrategyLayoutResult {
    if (nodes.length === 0) {
      return emptyLayoutResult();
    }

    const positioned = this.positionNodesOnCircle(nodes);
    const hasOverlaps = this.detectOverlaps(positioned);

    let finalNodes: PositionedNode[];
    if (hasOverlaps) {
      finalNodes = this.applyForceDirectedFallback(positioned);
    } else {
      finalNodes = positioned;
    }

    const layoutEdges = buildAnchoredLayoutEdges(edges, finalNodes, centerToCenterAnchors);
    const canvas = calculateCanvasSize(finalNodes);
    const metrics = calculateMetrics(finalNodes, layoutEdges);

    return { nodes: finalNodes, edges: layoutEdges, canvas, metrics };
  }

  estimateComplexity(nodes: NodeDatum[]): number {
    const n = nodes.length;
    // Circle positioning is O(n), force-directed fallback is O(n^2 * iterations)
    return n * n * FORCE_DIRECTED_ITERATIONS;
  }

  private positionNodesOnCircle(nodes: NodeDatum[]): PositionedNode[] {
    const n = nodes.length;

    if (n === 1) {
      const node = nodes[0];
      const w = getNodeWidth(node, DEFAULT_NODE_WIDTH);
      const h = getNodeHeight(node, DEFAULT_NODE_HEIGHT);
      return [
        {
          ...node,
          x: DEFAULT_CANVAS_WIDTH / 2 - w / 2,
          y: DEFAULT_CANVAS_HEIGHT / 2 - h / 2,
          width: w,
          height: h,
        },
      ];
    }

    const maxNodeWidth = Math.max(...nodes.map((n) => getNodeWidth(n, DEFAULT_NODE_WIDTH)));
    const maxNodeHeight = Math.max(...nodes.map((n) => getNodeHeight(n, DEFAULT_NODE_HEIGHT)));
    const circumferenceNeeded = n * Math.max(maxNodeWidth, maxNodeHeight) * OVERLAP_SPACING_FACTOR;
    const minRadius = circumferenceNeeded / (2 * Math.PI);
    const radius = Math.max(minRadius, MIN_RADIUS);

    const centerX = DEFAULT_CANVAS_WIDTH / 2;
    const centerY = DEFAULT_CANVAS_HEIGHT / 2;

    const positioned: PositionedNode[] = [];
    for (let i = 0; i < n; i++) {
      const node = nodes[i];
      const w = getNodeWidth(node, DEFAULT_NODE_WIDTH);
      const h = getNodeHeight(node, DEFAULT_NODE_HEIGHT);
      const angle = (2 * Math.PI * i) / n;

      const x = centerX + radius * Math.cos(angle) - w / 2;
      const y = centerY + radius * Math.sin(angle) - h / 2;

      positioned.push({
        ...node,
        x,
        y,
        width: w,
        height: h,
      });
    }

    return positioned;
  }

  private detectOverlaps(nodes: PositionedNode[]): boolean {
    return hasOverlapPairs(nodes);
  }

  private applyForceDirectedFallback(nodes: PositionedNode[]): PositionedNode[] {
    const centerX = DEFAULT_CANVAS_WIDTH / 2;
    const centerY = DEFAULT_CANVAS_HEIGHT / 2;

    const forceNodes: ForceNode[] = nodes.map((n) => ({
      positioned: { ...n },
      vx: 0,
      vy: 0,
    }));

    for (let iter = 0; iter < FORCE_DIRECTED_ITERATIONS; iter++) {
      // Apply repulsive forces between overlapping nodes
      for (let i = 0; i < forceNodes.length; i++) {
        for (let j = i + 1; j < forceNodes.length; j++) {
          const a = forceNodes[i].positioned;
          const b = forceNodes[j].positioned;

          if (nodesOverlap(a, b)) {
            const aCx = a.x + getNodeWidth(a, 0) / 2;
            const aCy = a.y + getNodeHeight(a, 0) / 2;
            const bCx = b.x + getNodeWidth(b, 0) / 2;
            const bCy = b.y + getNodeHeight(b, 0) / 2;

            let dx = bCx - aCx;
            let dy = bCy - aCy;
            const dist = distance(dx, dy) || 1;

            dx = dx / dist;
            dy = dy / dist;

            const force = FORCE_DIRECTED_STRENGTH / (iter + 1);

            forceNodes[i].vx -= dx * force;
            forceNodes[i].vy -= dy * force;
            forceNodes[j].vx += dx * force;
            forceNodes[j].vy += dy * force;
          }
        }
      }

      // Apply light attraction toward circle position to keep circular shape
      for (let i = 0; i < forceNodes.length; i++) {
        const n = forceNodes[i].positioned;
        const ncx = n.x + getNodeWidth(n, 0) / 2;
        const ncy = n.y + getNodeHeight(n, 0) / 2;

        const angle = (2 * Math.PI * i) / forceNodes.length;
        const maxNodeWidth = Math.max(...nodes.map((nd) => getNodeWidth(nd, DEFAULT_NODE_WIDTH)));
        const maxNodeHeight = Math.max(...nodes.map((nd) => getNodeHeight(nd, DEFAULT_NODE_HEIGHT)));
        const circumferenceNeeded = forceNodes.length * Math.max(maxNodeWidth, maxNodeHeight) * OVERLAP_SPACING_FACTOR;
        const minRadius = circumferenceNeeded / (2 * Math.PI);
        const radius = Math.max(minRadius, MIN_RADIUS);

        const targetX = centerX + radius * Math.cos(angle);
        const targetY = centerY + radius * Math.sin(angle);

        forceNodes[i].vx += (targetX - ncx) * 0.01;
        forceNodes[i].vy += (targetY - ncy) * 0.01;
      }

      // Apply velocities
      for (const fn of forceNodes) {
        fn.positioned.x += fn.vx;
        fn.positioned.y += fn.vy;
        fn.vx *= 0.5; // damping
        fn.vy *= 0.5;
      }
    }

    return forceNodes.map((fn) => fn.positioned);
  }
}

/** Alias for StrategySelector compatibility */
export const CycleStrategy = CycleLayoutStrategy;
