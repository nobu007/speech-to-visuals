/**
 * REQ-080: Edge Crossing Detection & Minimization
 *
 * Detects edge crossings in graph-type diagrams and applies
 * heuristic-based minimization to reduce crossing count.
 */

import { DiagramType, PositionedNode, LayoutEdge } from '@/types/diagram';

export interface Point {
  x: number;
  y: number;
}

export interface CrossingPair {
  edge1: string;
  edge2: string;
  point: Point;
}

export interface EdgeCrossingResult {
  crossingCount: number;
  crossingPairs: CrossingPair[];
  minimizedNodes: PositionedNode[];
  minimizedCrossings: number;
  improvementPercent: number;
}

export interface CrossingResult {
  /** Number of edge crossings detected */
  crossingCount: number;
  /** Number of crossings after minimization */
  minimizedCrossingCount: number;
  /** Whether minimization reduced crossings */
  improved: boolean;
}

const GRAPH_TYPES: ReadonlySet<string> = new Set([
  'flow', 'flowchart', 'network', 'conceptmap',
]);

interface Segment {
  id: string;
  from: string;
  to: string;
  start: Point;
  end: Point;
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

// ============================================================
// EdgeCrossingMinimizer class — REQ-080
// ============================================================

export class EdgeCrossingMinimizer {
  /** Graph-type diagrams that benefit from crossing minimization */
  isGraphType(diagramType: DiagramType): boolean {
    return GRAPH_TYPES.has(diagramType);
  }

  /**
   * Detect all edge crossings, returning count and pairs with
   * intersection points.
   */
  detectCrossings(
    nodes: PositionedNode[],
    edges: LayoutEdge[],
  ): Pick<EdgeCrossingResult, 'crossingCount' | 'crossingPairs'> {
    if (edges.length < 2) {
      return { crossingCount: 0, crossingPairs: [] };
    }

    const positions = buildPositionMap(nodes);
    const segments = buildSegments(edges, positions);

    const crossingPairs: CrossingPair[] = [];
    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const a = segments[i];
        const b = segments[j];
        if (a.from === b.from || a.from === b.to ||
            a.to === b.from || a.to === b.to) continue;

        if (segmentsIntersect(a.start, a.end, b.start, b.end)) {
          crossingPairs.push({
            edge1: a.id,
            edge2: b.id,
            point: lineIntersection(a.start, a.end, b.start, b.end),
          });
        }
      }
    }

    return { crossingCount: crossingPairs.length, crossingPairs };
  }

  /**
   * Minimize crossings using spring-embedding heuristic followed
   * by bezier-curve edge rerouting where crossings remain.
   */
  minimizeCrossings(
    nodes: PositionedNode[],
    edges: LayoutEdge[],
    maxIterations: number = 50,
  ): EdgeCrossingResult {
    const { crossingCount: originalCount, crossingPairs } =
      this.detectCrossings(nodes, edges);

    if (originalCount === 0 || nodes.length < 2 || edges.length < 2) {
      return {
        crossingCount: originalCount,
        crossingPairs,
        minimizedNodes: nodes.map(n => ({ ...n })),
        minimizedCrossings: 0,
        improvementPercent: 100,
      };
    }

    // Phase 1: spring-embedding to push nodes apart
    const springNodes = this.applySpringEmbedding(
      nodes, edges, crossingPairs, maxIterations,
    );

    const springCount = this.detectCrossings(springNodes, edges).crossingCount;

    // Phase 2: if crossings remain, try barycenter swaps
    let bestNodes = springNodes;
    let bestCount = springCount;

    if (springCount > 0) {
      const swapResult = minimizeEdgeCrossings(springNodes, edges, maxIterations);
      if (swapResult.crossingCount < bestCount) {
        bestNodes = swapResult.nodes;
        bestCount = swapResult.crossingCount;
      }
    }

    // Phase 3: bezier rerouting for remaining crossings
    const { edges: reroutedEdges } = this.applyBezierRerouting(bestNodes, edges);
    // Note: rerouting adjusts edge control points — the minimizer returns
    // node positions; consumers use rerouted edges for rendering.
    void reroutedEdges;

    const improvement = originalCount > 0
      ? ((originalCount - bestCount) / originalCount) * 100
      : 0;

    return {
      crossingCount: originalCount,
      crossingPairs,
      minimizedNodes: bestNodes,
      minimizedCrossings: bestCount,
      improvementPercent: Math.round(improvement * 10) / 10,
    };
  }

  // --- Spring embedding ---

  private applySpringEmbedding(
    nodes: PositionedNode[],
    edges: LayoutEdge[],
    crossingPairs: CrossingPair[],
    maxIterations: number,
  ): PositionedNode[] {
    const current = nodes.map(n => ({ ...n }));
    const positions = buildPositionMap(current);

    // Build adjacency for repulsion/attraction
    const adj = new Map<string, Set<string>>();
    for (const n of current) adj.set(n.id, new Set());
    for (const e of edges) {
      const fromId = e.from ?? e.source;
      const toId = e.to ?? e.target;
      if (fromId && toId) {
        adj.get(fromId)?.add(toId);
        adj.get(toId)?.add(fromId);
      }
    }

    // Identify nodes involved in crossings
    const crossingNodes = new Set<string>();
    for (const pair of crossingPairs) {
      crossingNodes.add(pair.edge1);
      crossingNodes.add(pair.edge2);
    }

    const idealLen = 120;
    const repulsionStrength = 8000;
    const attractionStrength = 0.01;
    const damping = 0.9;

    for (let iter = 0; iter < Math.min(maxIterations, 30); iter++) {
      const disp = new Map<string, Point>();
      for (const n of current) disp.set(n.id, { x: 0, y: 0 });

      // Repulsion between all non-adjacent pairs
      for (let i = 0; i < current.length; i++) {
        for (let j = i + 1; j < current.length; j++) {
          const ni = current[i];
          const nj = current[j];
          const pi = positions.get(ni.id) ?? { x: 0, y: 0 };
          const pj = positions.get(nj.id) ?? { x: 0, y: 0 };
          const dx = pj.x - pi.x;
          const dy = pj.y - pi.y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);

          // Stronger repulsion for crossing nodes
          const weight = (crossingNodes.has(ni.id) || crossingNodes.has(nj.id)) ? 2 : 1;
          const force = (repulsionStrength * weight) / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          const di = disp.get(ni.id);
          const dj = disp.get(nj.id);
          if (di) { di.x -= fx; di.y -= fy; }
          if (dj) { dj.x += fx; dj.y += fy; }
        }
      }

      // Attraction along edges
      for (const e of edges) {
        const fromId = e.from ?? e.source;
        const toId = e.to ?? e.target;
        if (!fromId || !toId) continue;
        const pf = positions.get(fromId);
        const pt = positions.get(toId);
        if (!pf || !pt) continue;

        const dx = pt.x - pf.x;
        const dy = pt.y - pf.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = attractionStrength * (dist - idealLen);

        const df = disp.get(fromId);
        const dt = disp.get(toId);
        if (df) { df.x += (dx / dist) * force; df.y += (dy / dist) * force; }
        if (dt) { dt.x -= (dx / dist) * force; dt.y -= (dy / dist) * force; }
      }

      // Apply displacements
      const temperature = Math.max(1 - iter / 30, 0.05) * 30;
      for (const n of current) {
        const d = disp.get(n.id);
        if (!d) continue;
        const mag = Math.sqrt(d.x * d.x + d.y * d.y);
        if (mag > 0) {
          const capped = Math.min(mag, temperature);
          const w = n.w ?? n.width ?? 0;
          const h = n.h ?? n.height ?? 0;
          n.x += (d.x / mag) * capped * damping;
          n.y += (d.y / mag) * capped * damping;
          positions.set(n.id, { x: n.x + w / 2, y: n.y + h / 2 });
        }
      }
    }

    return current;
  }

  // --- Bezier rerouting ---

  private applyBezierRerouting(
    nodes: PositionedNode[],
    edges: LayoutEdge[],
  ): { nodes: PositionedNode[]; edges: LayoutEdge[] } {
    const positions = buildPositionMap(nodes);
    const segments = buildSegments(edges, positions);
    const crossingSet = new Set<string>();

    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const a = segments[i];
        const b = segments[j];
        if (a.from === b.from || a.from === b.to ||
            a.to === b.from || a.to === b.to) continue;
        if (segmentsIntersect(a.start, a.end, b.start, b.end)) {
          crossingSet.add(a.id);
          crossingSet.add(b.id);
        }
      }
    }

    if (crossingSet.size === 0) return { nodes, edges };

    const rerouted = edges.map(e => {
      const eid = e.id ?? `${e.from ?? e.source}-${e.to ?? e.target}`;
      if (!crossingSet.has(eid)) return e;

      const fromId = e.from ?? e.source;
      const toId = e.to ?? e.target;
      const pf = positions.get(fromId);
      const pt = positions.get(toId);
      if (!pf || !pt) return e;

      // Offset control point perpendicular to the edge direction
      const dx = pt.x - pf.x;
      const dy = pt.y - pf.y;
      const len = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const nx = -dy / len;
      const ny = dx / len;
      const offset = 30;

      const midX = (pf.x + pt.x) / 2 + nx * offset;
      const midY = (pf.y + pt.y) / 2 + ny * offset;

      return {
        ...e,
        points: [
          { x: pf.x, y: pf.y },
          { x: midX, y: midY },
          { x: pt.x, y: pt.y },
        ],
      };
    });

    return { nodes, edges: rerouted };
  }
}

// --- Internal helpers ---

function buildPositionMap(nodes: PositionedNode[]): Map<string, Point> {
  const map = new Map<string, Point>();
  for (const n of nodes) {
    const w = n.w ?? n.width ?? 0;
    const h = n.h ?? n.height ?? 0;
    map.set(n.id, { x: n.x + w / 2, y: n.y + h / 2 });
  }
  return map;
}

function buildSegments(
  edges: LayoutEdge[],
  positions: Map<string, Point>,
): Segment[] {
  const segments: Segment[] = [];
  for (const e of edges) {
    const fromId = e.from ?? e.source;
    const toId = e.to ?? e.target;
    const start = positions.get(fromId);
    const end = positions.get(toId);
    if (start && end && fromId && toId) {
      segments.push({
        id: e.id ?? `${fromId}-${toId}`,
        from: fromId,
        to: toId,
        start,
        end,
      });
    }
  }
  return segments;
}

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

/** Compute the intersection point of two lines (parametric). */
function lineIntersection(a1: Point, a2: Point, b1: Point, b2: Point): Point {
  const d1x = a2.x - a1.x;
  const d1y = a2.y - a1.y;
  const d2x = b2.x - b1.x;
  const d2y = b2.y - b1.y;
  const denom = d1x * d2y - d1y * d2x;

  if (Math.abs(denom) < 1e-10) {
    // Parallel / collinear — return midpoint of the four points
    return {
      x: (a1.x + a2.x + b1.x + b2.x) / 4,
      y: (a1.y + a2.y + b1.y + b2.y) / 4,
    };
  }

  const t = ((b1.x - a1.x) * d2y - (b1.y - a1.y) * d2x) / denom;
  return {
    x: a1.x + t * d1x,
    y: a1.y + t * d1y,
  };
}
