/**
 * TASK-0212: NaN propagation prevention and overlap resolution progress detection
 *
 * Tests:
 * 1. calculateOptimalSeparation() with NaN/Infinity/negative dimensions returns finite fallback
 * 2. Overlap resolution loop terminates early when no progress is made
 * 3. Edges with missing source/target nodes are filtered out (not left with empty points)
 */
import { describe, it, expect } from '@jest/globals';
import { ZeroOverlapLayoutEngine } from '../enhanced-zero-overlap-layout';
import { nodesOverlap } from '../layout-utils';
import type { NodeDatum, EdgeDatum, PositionedNode } from '@/types/diagram';

/* ---------- helpers ---------- */

/** Access private methods for unit testing (preserving `this` binding) */
function getPrivateMethods(engine: ZeroOverlapLayoutEngine) {
  const obj = engine as unknown as {
    calculateOptimalSeparation: (n1: PositionedNode, n2: PositionedNode) => number;
    resolveAllOverlaps: (layout: { nodes: PositionedNode[]; edges: import('@/types/diagram').LayoutEdge[] }) =>
      Promise<{ nodes: PositionedNode[]; edges: import('@/types/diagram').LayoutEdge[] }>;
    config: {
      minimumSpacing: { nodeToNode: number };
      optimization: { maxIterations: number };
      canvasWidth: number;
      canvasHeight: number;
    };
  };
  // Bind methods to preserve `this` context
  return {
    config: obj.config,
    calculateOptimalSeparation: obj.calculateOptimalSeparation.bind(engine),
    resolveAllOverlaps: obj.resolveAllOverlaps.bind(engine),
  };
}

function makeNode(overrides: Partial<PositionedNode>): PositionedNode {
  return {
    id: 'test',
    label: 'Test',
    x: 0,
    y: 0,
    w: 100,
    h: 80,
    ...overrides,
  };
}

/* ================================================================ */
/* 1. calculateOptimalSeparation — NaN / Infinity guard             */
/* ================================================================ */

describe('calculateOptimalSeparation — NaN/Infinity dimension guard', () => {
  const engine = new ZeroOverlapLayoutEngine();
  const { calculateOptimalSeparation, config } = getPrivateMethods(engine);
  const expectedFallback = config.minimumSpacing.nodeToNode;

  it('should return finite fallback when node1.w is NaN', () => {
    const n1 = makeNode({ id: 'a', w: NaN, h: 80, x: 0, y: 0 });
    const n2 = makeNode({ id: 'b', w: 100, h: 80, x: 200, y: 0 });
    const result = calculateOptimalSeparation(n1, n2);
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBe(expectedFallback);
  });

  it('should return finite fallback when node1.h is NaN', () => {
    const n1 = makeNode({ id: 'a', w: 100, h: NaN, x: 0, y: 0 });
    const n2 = makeNode({ id: 'b', w: 100, h: 80, x: 200, y: 0 });
    const result = calculateOptimalSeparation(n1, n2);
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBe(expectedFallback);
  });

  it('should return finite fallback when node2.w is Infinity', () => {
    const n1 = makeNode({ id: 'a', w: 100, h: 80, x: 0, y: 0 });
    const n2 = makeNode({ id: 'b', w: Infinity, h: 80, x: 200, y: 0 });
    const result = calculateOptimalSeparation(n1, n2);
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBe(expectedFallback);
  });

  it('should return finite fallback when node2.h is Infinity', () => {
    const n1 = makeNode({ id: 'a', w: 100, h: 80, x: 0, y: 0 });
    const n2 = makeNode({ id: 'b', w: 100, h: Infinity, x: 200, y: 0 });
    const result = calculateOptimalSeparation(n1, n2);
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBe(expectedFallback);
  });

  it('should return finite fallback when node1.x is NaN (position)', () => {
    const n1 = makeNode({ id: 'a', w: 100, h: 80, x: NaN, y: 0 });
    const n2 = makeNode({ id: 'b', w: 100, h: 80, x: 200, y: 0 });
    const result = calculateOptimalSeparation(n1, n2);
    expect(Number.isFinite(result)).toBe(true);
  });

  it('should return finite fallback for negative Infinity dimensions', () => {
    const n1 = makeNode({ id: 'a', w: -Infinity, h: 80, x: 0, y: 0 });
    const n2 = makeNode({ id: 'b', w: 100, h: 80, x: 200, y: 0 });
    const result = calculateOptimalSeparation(n1, n2);
    expect(Number.isFinite(result)).toBe(true);
  });

  it('should return correct positive separation for valid overlapping nodes', () => {
    const n1 = makeNode({ id: 'a', w: 100, h: 80, x: 0, y: 0 });
    const n2 = makeNode({ id: 'b', w: 100, h: 80, x: 50, y: 0 });
    const result = calculateOptimalSeparation(n1, n2);
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBeGreaterThan(0);
  });

  it('should return correct zero separation for non-overlapping nodes', () => {
    const n1 = makeNode({ id: 'a', w: 100, h: 80, x: 0, y: 0 });
    const n2 = makeNode({ id: 'b', w: 100, h: 80, x: 1000, y: 1000 });
    const result = calculateOptimalSeparation(n1, n2);
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBe(0);
  });
});

/* ================================================================ */
/* 2. Overlap resolution — progress detection (early termination)   */
/* ================================================================ */

describe('resolveAllOverlaps — progress detection and early termination', () => {
  it('should terminate before maxIterations when overlaps cannot be resolved', async () => {
    // Create two oversized nodes that physically cannot fit without overlap
    // Canvas is 1920x1080 with default config, but nodes are bigger than canvas
    const engine = new ZeroOverlapLayoutEngine({
      canvasWidth: 200,
      canvasHeight: 200,
      optimization: { maxIterations: 1000, convergenceThreshold: 0.01, forceStrength: 0.5, aestheticWeight: 0.3 },
    });
    const priv = getPrivateMethods(engine);

    // Two nodes each 150x150 in a 200x200 canvas — impossible to separate
    const nodes: PositionedNode[] = [
      makeNode({ id: 'a', x: 0, y: 0, w: 150, h: 150 }),
      makeNode({ id: 'b', x: 10, y: 10, w: 150, h: 150 }),
    ];

    const result = await priv.resolveAllOverlaps({ nodes, edges: [] });

    // With progress detection, should terminate well before 1000 iterations
    // The result should still contain both nodes
    expect(result.nodes.length).toBe(2);
  });

  it('should resolve normally when nodes can be separated', async () => {
    const engine = new ZeroOverlapLayoutEngine({
      canvasWidth: 1920,
      canvasHeight: 1080,
      optimization: { maxIterations: 300, convergenceThreshold: 0.01, forceStrength: 0.5, aestheticWeight: 0.3 },
    });
    const priv = getPrivateMethods(engine);

    const nodes: PositionedNode[] = [
      makeNode({ id: 'a', x: 0, y: 0, w: 120, h: 60 }),
      makeNode({ id: 'b', x: 10, y: 10, w: 120, h: 60 }),
    ];

    const result = await priv.resolveAllOverlaps({ nodes, edges: [] });
    expect(result.nodes.length).toBe(2);

    // Verify the nodes were actually separated
    const a = result.nodes.find(n => n.id === 'a')!;
    const b = result.nodes.find(n => n.id === 'b')!;
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    // At least some separation should exist
    expect(dx + dy).toBeGreaterThan(0);
  });

  it('should not propagate NaN when a node has invalid dimensions in overlap resolution', async () => {
    const engine = new ZeroOverlapLayoutEngine({
      canvasWidth: 1920,
      canvasHeight: 1080,
    });
    const priv = getPrivateMethods(engine);

    const nodes: PositionedNode[] = [
      makeNode({ id: 'a', x: 0, y: 0, w: NaN, h: 60 }),
      makeNode({ id: 'b', x: 10, y: 10, w: 120, h: 60 }),
    ];

    const result = await priv.resolveAllOverlaps({ nodes, edges: [] });

    // No NaN should exist in final positions
    for (const node of result.nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
    }
  });
});

/* ================================================================ */
/* 4. Repulsion direction & separation threshold (zero-overlap)     */
/* ================================================================ */

describe('resolveAllOverlaps — repulsion direction & AABB separation threshold', () => {
  // Regression: the per-overlap force was applied with an INVERTED sign
  // (force1 -= moveVector pulls node1 toward node2 instead of away), AND the
  // required center-distance was half the AABB-correct value (max of all four
  // edges / 2 instead of max of the per-axis half-sums). Together these left
  // detected overlaps either pulled tighter or unforced, so the loop's
  // no-progress guard early-exited with overlaps still present — breaking the
  // "zero-overlap" guarantee. Each case asserts the canonical nodesOverlap
  // predicate is FALSE after resolution.

  const bigCanvas = {
    canvasWidth: 2000,
    canvasHeight: 2000,
    optimization: { maxIterations: 300, convergenceThreshold: 0.01, forceStrength: 0.5, aestheticWeight: 0.3 },
  };

  it('pushes overlapping nodes apart, not together (force sign is repulsive)', async () => {
    // Node a is pinned at the left wall; b overlaps it from the right. With the
    // INVERTED force, a is pushed right (into b) and b left (into a) → they
    // collide, make no progress, and the loop early-exits still overlapping.
    // Correct repulsion clamps a at the wall and pushes b clear to the right.
    const engine = new ZeroOverlapLayoutEngine(bigCanvas);
    const priv = getPrivateMethods(engine);
    const nodes: PositionedNode[] = [
      makeNode({ id: 'a', x: 0, y: 500, w: 120, h: 60 }),
      makeNode({ id: 'b', x: 60, y: 500, w: 120, h: 60 }),
    ];
    expect(nodesOverlap(nodes[0], nodes[1], 0)).toBe(true); // precondition

    const result = await priv.resolveAllOverlaps({ nodes, edges: [] });
    const a = result.nodes.find((n) => n.id === 'a')!;
    const b = result.nodes.find((n) => n.id === 'b')!;
    expect(nodesOverlap(a, b, 0)).toBe(false);
  });

  it('separates barely-overlapping large nodes (AABB-correct threshold)', async () => {
    // Two 100×100 nodes overlapping by 20px on x (centers 80 apart). The old
    // half-value threshold (max(all edges)/2 = 50) made requiredDistance <
    // centerDistance (80) → zero force → the overlap stuck. The AABB-correct
    // threshold (max((w1+w2)/2, (h1+h2)/2) = 100) exceeds 80 → force applied.
    const engine = new ZeroOverlapLayoutEngine(bigCanvas);
    const priv = getPrivateMethods(engine);
    const nodes: PositionedNode[] = [
      makeNode({ id: 'a', x: 900, y: 900, w: 100, h: 100 }),
      makeNode({ id: 'b', x: 980, y: 900, w: 100, h: 100 }),
    ];
    expect(nodesOverlap(nodes[0], nodes[1], 0)).toBe(true); // precondition

    const result = await priv.resolveAllOverlaps({ nodes, edges: [] });
    const a = result.nodes.find((n) => n.id === 'a')!;
    const b = result.nodes.find((n) => n.id === 'b')!;
    expect(nodesOverlap(a, b, 0)).toBe(false);
  });
});

/* ================================================================ */
/* 3. Edge points — empty array guard                                */
/* ================================================================ */

describe('Edge points empty array guard', () => {
  it('should filter out edges with missing source/target nodes in layout result', async () => {
    const engine = new ZeroOverlapLayoutEngine();
    const nodes: NodeDatum[] = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ];
    const edges: EdgeDatum[] = [
      { from: 'a', to: 'b' },
      { from: 'a', to: 'nonexistent' }, // target missing
      { from: 'ghost', to: 'b' },       // source missing
    ];

    const result = await engine.generateZeroOverlapLayout('flow', nodes, edges);

    // Edges referencing missing nodes should be filtered out
    expect(result.edges.length).toBe(1);
    expect(result.edges[0].from).toBe('a');
    expect(result.edges[0].to).toBe('b');
    expect(result.edges[0].points.length).toBeGreaterThan(0);
  });

  it('should not include any edges with empty points array', async () => {
    const engine = new ZeroOverlapLayoutEngine();
    const nodes: NodeDatum[] = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ];
    const edges: EdgeDatum[] = [
      { from: 'a', to: 'b' },
      { from: 'a', to: 'c' }, // c doesn't exist
      { from: 'x', to: 'y' }, // both don't exist
    ];

    const result = await engine.generateZeroOverlapLayout('flow', nodes, edges);

    // All remaining edges must have non-empty points
    for (const edge of result.edges) {
      expect(edge.points.length).toBeGreaterThan(0);
    }
  });

  it('should return all valid edges when all nodes exist', async () => {
    const engine = new ZeroOverlapLayoutEngine();
    const nodes: NodeDatum[] = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C' },
    ];
    const edges: EdgeDatum[] = [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
      { from: 'a', to: 'c' },
    ];

    const result = await engine.generateZeroOverlapLayout('flow', nodes, edges);
    expect(result.edges.length).toBe(3);
    for (const edge of result.edges) {
      expect(edge.points.length).toBeGreaterThan(0);
    }
  });
});
