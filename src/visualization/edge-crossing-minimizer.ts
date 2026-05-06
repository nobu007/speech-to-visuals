/**
 * REQ-080: Edge Crossing Detection & Minimization
 *
 * Detects edge crossings in graph-type diagrams and applies
 * heuristic-based minimization to reduce crossing count.
 */

import { PositionedNode, LayoutEdge } from '@/types/diagram';

export interface Point {
  x: number;
  y: number;
}

export interface CrossingResult {
  /** Number of edge crossings detected */
  crossingCount: number;
  /** Number of crossings after minimization */
  minimizedCrossingCount: number;
  /** Whether minimization reduced crossings */
  improved: boolean;
}

/**
 * Detect edge crossings in a layout.
 * Uses orientation-based line segment intersection.
 */
export function detectEdgeCrossings(
  nodes: PositionedNode[],
  edges: LayoutEdge[]
): number {
  if (edges.length < 2) return 0;

  const positions = new Map<string, Point>();
  for (const n of nodes) {
    const w = n.w ?? n.width ?? 0;
    const h = n.h ?? n.height ?? 0;
    positions.set(n.id, { x: n.x + w / 2, y: n.y + h / 2 });
  }

  interface Segment {
    from: string;
    to: string;
    start: Point;
    end: Point;
  }

  const segments: Segment[] = [];
  for (const e of edges) {
    const fromId = e.from ?? e.source;
    const toId = e.to ?? e.target;
    const start = positions.get(fromId);
    const end = positions.get(toId);
    if (start && end) {
      segments.push({ from: fromId, to: toId, start, end });
    }
  }

  let count = 0;
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const a = segments[i];
      const b = segments[j];
      // Skip edges sharing a node
      if (
        a.from === b.from || a.from === b.to ||
        a.to === b.from || a.to === b.to
      ) continue;

      if (segmentsIntersect(a.start, a.end, b.start, b.end)) {
        count++;
      }
    }
  }
  return count;
}

/**
 * Attempt to minimize edge crossings by swapping node positions
 * that reduce the crossing count (barycenter heuristic).
 * Returns updated nodes and the new crossing count.
 */
export function minimizeEdgeCrossings(
  nodes: PositionedNode[],
  edges: LayoutEdge[],
  maxIterations: number = 10
): { nodes: PositionedNode[]; crossingCount: number } {
  if (edges.length < 2 || nodes.length < 2) {
    return { nodes: [...nodes], crossingCount: detectEdgeCrossings(nodes, edges) };
  }

  let current = nodes.map(n => ({ ...n }));
  let bestCount = detectEdgeCrossings(current, edges);
  let bestNodes = current.map(n => ({ ...n }));

  for (let iter = 0; iter < maxIterations; iter++) {
    let improved = false;

    // Try swapping each pair of non-adjacent nodes
    for (let i = 0; i < current.length; i++) {
      for (let j = i + 1; j < current.length; j++) {
        const swapped = current.map((n, idx) => {
          if (idx === i) return { ...current[j], id: current[i].id, label: current[i].label };
          if (idx === j) return { ...current[i], id: current[j].id, label: current[j].label };
          return { ...n };
        });

        const newCount = detectEdgeCrossings(swapped, edges);
        if (newCount < bestCount) {
          bestCount = newCount;
          bestNodes = swapped.map(n => ({ ...n }));
          current = swapped;
          improved = true;
        }
      }
    }

    if (!improved || bestCount === 0) break;
  }

  return { nodes: bestNodes, crossingCount: bestCount };
}

/**
 * Full crossing analysis with detection and minimization
 */
export function analyzeEdgeCrossings(
  nodes: PositionedNode[],
  edges: LayoutEdge[],
  maxIterations: number = 10
): CrossingResult {
  const originalCount = detectEdgeCrossings(nodes, edges);
  const { crossingCount: minimizedCount } = minimizeEdgeCrossings(nodes, edges, maxIterations);

  return {
    crossingCount: originalCount,
    minimizedCrossingCount: minimizedCount,
    improved: minimizedCount < originalCount,
  };
}

// --- Internal helpers ---

function segmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const o1 = orientation(p1, p2, p3);
  const o2 = orientation(p1, p2, p4);
  const o3 = orientation(p3, p4, p1);
  const o4 = orientation(p3, p4, p2);

  if (o1 !== o2 && o3 !== o4) return true;

  if (o1 === 0 && onSegment(p1, p3, p2)) return true;
  if (o2 === 0 && onSegment(p1, p4, p2)) return true;
  if (o3 === 0 && onSegment(p3, p1, p4)) return true;
  if (o4 === 0 && onSegment(p3, p2, p4)) return true;

  return false;
}

function orientation(p: Point, q: Point, r: Point): number {
  const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
  if (Math.abs(val) < 0.0001) return 0;
  return val > 0 ? 1 : 2;
}

function onSegment(p: Point, q: Point, r: Point): boolean {
  return (
    q.x <= Math.max(p.x, r.x) &&
    q.x >= Math.min(p.x, r.x) &&
    q.y <= Math.max(p.y, r.y) &&
    q.y >= Math.min(p.y, r.y)
  );
}
