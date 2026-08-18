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

import { NodeDatum, EdgeDatum, PositionedNode } from '@stv/core/types/diagram';
import {
  LayoutStrategy,
  StrategyLayoutResult,
  CanvasSize,
  StrategyLayoutMetrics,
} from '@/visualization/types';
import { calculateCanvasSize, calculateMetrics } from '@/visualization/layout-engine-v2';
import { defaultNodeExtent } from '../node-dimensions';
import { DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT } from '../canvas-dimensions';
import { emptyLayoutResult } from '../empty-layout-result';
import { buildAnchoredLayoutEdges, centerToCenterAnchors } from '../strategy-edges';
// Canonical overlap predicate — single source of truth (see layout-utils.ts).
import { nodesOverlap, hasOverlapPairs, distance, calculateNodeCenter, ringAngle, pointOnCircle } from '../layout-utils';

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
      // Round 49 single source — the DEFAULT-fallback box resolution pair.
      const { width: w, height: h } = defaultNodeExtent(node);
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

    // Round 49 single source — both maxima resolve per node through the
    // canonical pair (the max-of-set fold itself stays here: 2 sites).
    const maxNodeWidth = Math.max(...nodes.map((n) => defaultNodeExtent(n).width));
    const maxNodeHeight = Math.max(...nodes.map((n) => defaultNodeExtent(n).height));
    const circumferenceNeeded = n * Math.max(maxNodeWidth, maxNodeHeight) * OVERLAP_SPACING_FACTOR;
    const minRadius = circumferenceNeeded / (2 * Math.PI);
    const radius = Math.max(minRadius, MIN_RADIUS);

    const centerX = DEFAULT_CANVAS_WIDTH / 2;
    const centerY = DEFAULT_CANVAS_HEIGHT / 2;

    const positioned: PositionedNode[] = [];
    for (let i = 0; i < n; i++) {
      const node = nodes[i];
      // Round 49 single source — the DEFAULT-fallback box resolution pair.
      const { width: w, height: h } = defaultNodeExtent(node);

      // Round 48 single-source — ring step + circle point in layout-utils;
      // the `- w / 2` top-left conversion stays here (grouping preserved).
      const p = pointOnCircle(centerX, centerY, ringAngle(i, n), radius);

      const x = p.x - w / 2;
      const y = p.y - h / 2;

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
            // Round 47 single source — node box-centers via layout-utils
            // `calculateNodeCenter` (fallback 0, bit-identical to the retired
            // `a.x + getNodeWidth(a, 0) / 2` locals).
            const aCenter = calculateNodeCenter(a);
            const bCenter = calculateNodeCenter(b);

            let dx = bCenter.x - aCenter.x;
            let dy = bCenter.y - aCenter.y;
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
        // Round 47 single source — node box-center via layout-utils.
        const nCenter = calculateNodeCenter(n);
        const ncx = nCenter.x;
        const ncy = nCenter.y;

        const maxNodeWidth = Math.max(...nodes.map((nd) => defaultNodeExtent(nd).width));
        const maxNodeHeight = Math.max(...nodes.map((nd) => defaultNodeExtent(nd).height));
        const circumferenceNeeded = forceNodes.length * Math.max(maxNodeWidth, maxNodeHeight) * OVERLAP_SPACING_FACTOR;
        const minRadius = circumferenceNeeded / (2 * Math.PI); // inverse concept: circumference → radius
        const radius = Math.max(minRadius, MIN_RADIUS);

        // Round 48 single-source — the attraction target is a CENTER-space
        // ring point (no top-left conversion).
        const target = pointOnCircle(centerX, centerY, ringAngle(i, forceNodes.length), radius);

        forceNodes[i].vx += (target.x - ncx) * 0.01;
        forceNodes[i].vy += (target.y - ncy) * 0.01;
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
