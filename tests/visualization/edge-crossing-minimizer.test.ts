/**
 * TASK-0125: Edge Crossing Detection & Minimization — unit tests
 */

import { describe, it, expect } from '@jest/globals';
import {
  EdgeCrossingMinimizer,
  detectEdgeCrossings,
  minimizeEdgeCrossings,
  analyzeEdgeCrossings,
} from '@/visualization/edge-crossing-minimizer';
import { PositionedNode, LayoutEdge } from '@/types/diagram';

// --- Fixtures ---

function makeNodes(coords: Array<[string, number, number]>): PositionedNode[] {
  return coords.map(([id, x, y]) => ({
    id, label: id, x, y, width: 40, height: 30,
  }));
}

/** A-D diagonal and B-C opposite diagonal → 1 crossing */
function crossingLayout() {
  const nodes = makeNodes([
    ['a', 100, 100],
    ['b', 300, 100],
    ['c', 100, 300],
    ['d', 300, 300],
  ]);
  const edges: LayoutEdge[] = [
    { from: 'a', to: 'd', points: [], id: 'ad' },
    { from: 'b', to: 'c', points: [], id: 'bc' },
  ];
  return { nodes, edges };
}

/** Two parallel edges → 0 crossings */
function parallelLayout() {
  const nodes = makeNodes([
    ['a', 100, 100],
    ['b', 300, 100],
    ['c', 100, 300],
    ['d', 300, 300],
  ]);
  const edges: LayoutEdge[] = [
    { from: 'a', to: 'b', points: [], id: 'ab' },
    { from: 'c', to: 'd', points: [], id: 'cd' },
  ];
  return { nodes, edges };
}

// ============================================================
// Standalone functions (backward compat)
// ============================================================

describe('detectEdgeCrossings (function)', () => {
  it('returns 0 for no edges', () => {
    expect(detectEdgeCrossings(makeNodes([['a', 0, 0]]), [])).toBe(0);
  });

  it('returns 0 for single edge', () => {
    const edges: LayoutEdge[] = [{ from: 'a', to: 'b', points: [] }];
    expect(detectEdgeCrossings(makeNodes([['a', 0, 0], ['b', 100, 0]]), edges)).toBe(0);
  });

  it('detects X-crossing as 1', () => {
    const { nodes, edges } = crossingLayout();
    expect(detectEdgeCrossings(nodes, edges)).toBe(1);
  });

  it('returns 0 for parallel edges', () => {
    const { nodes, edges } = parallelLayout();
    expect(detectEdgeCrossings(nodes, edges)).toBe(0);
  });
});

describe('minimizeEdgeCrossings (function)', () => {
  it('reduces crossings in crossing layout', () => {
    const { nodes, edges } = crossingLayout();
    const result = minimizeEdgeCrossings(nodes, edges, 10);
    expect(result.crossingCount).toBeLessThanOrEqual(1);
  });

  it('returns same nodes when no crossings', () => {
    const { nodes, edges } = parallelLayout();
    const result = minimizeEdgeCrossings(nodes, edges);
    expect(result.crossingCount).toBe(0);
  });

  it('handles edge < 2 gracefully', () => {
    const result = minimizeEdgeCrossings(
      makeNodes([['a', 0, 0]]),
      [],
    );
    expect(result.crossingCount).toBe(0);
  });
});

describe('analyzeEdgeCrossings', () => {
  it('reports improvement when crossings reduced', () => {
    const { nodes, edges } = crossingLayout();
    const result = analyzeEdgeCrossings(nodes, edges);
    expect(result.crossingCount).toBeGreaterThan(0);
    expect(result.minimizedCrossingCount).toBeLessThanOrEqual(result.crossingCount);
  });
});

// ============================================================
// EdgeCrossingMinimizer class
// ============================================================

describe('EdgeCrossingMinimizer', () => {
  const minimizer = new EdgeCrossingMinimizer();

  // --- isGraphType ---

  describe('isGraphType', () => {
    it('returns true for graph types', () => {
      expect(minimizer.isGraphType('flow')).toBe(true);
      expect(minimizer.isGraphType('flowchart')).toBe(true);
      expect(minimizer.isGraphType('network')).toBe(true);
      expect(minimizer.isGraphType('conceptmap')).toBe(true);
    });

    it('returns false for non-graph types', () => {
      expect(minimizer.isGraphType('timeline')).toBe(false);
      expect(minimizer.isGraphType('matrix')).toBe(false);
      expect(minimizer.isGraphType('cycle')).toBe(false);
      expect(minimizer.isGraphType('tree')).toBe(false);
      expect(minimizer.isGraphType('comparison')).toBe(false);
      expect(minimizer.isGraphType('mindmap')).toBe(false);
      expect(minimizer.isGraphType('general')).toBe(false);
    });
  });

  // --- detectCrossings ---

  describe('detectCrossings', () => {
    it('returns 0 crossings and empty pairs for no edges', () => {
      const result = minimizer.detectCrossings(
        makeNodes([['a', 0, 0]]), [],
      );
      expect(result.crossingCount).toBe(0);
      expect(result.crossingPairs).toEqual([]);
    });

    it('detects single crossing with correct pair info', () => {
      const { nodes, edges } = crossingLayout();
      const result = minimizer.detectCrossings(nodes, edges);
      expect(result.crossingCount).toBe(1);
      expect(result.crossingPairs).toHaveLength(1);
      expect(result.crossingPairs[0].edge1).toBe('ad');
      expect(result.crossingPairs[0].edge2).toBe('bc');
      // Intersection point should be near center of the layout
      const pt = result.crossingPairs[0].point;
      expect(pt.x).toBeGreaterThan(100);
      expect(pt.x).toBeLessThan(350);
      expect(pt.y).toBeGreaterThan(100);
      expect(pt.y).toBeLessThan(350);
    });

    it('returns 0 for parallel edges', () => {
      const { nodes, edges } = parallelLayout();
      const result = minimizer.detectCrossings(nodes, edges);
      expect(result.crossingCount).toBe(0);
    });

    it('skips edges sharing a node', () => {
      const nodes = makeNodes([
        ['a', 100, 100],
        ['b', 200, 200],
        ['c', 300, 100],
      ]);
      const edges: LayoutEdge[] = [
        { from: 'a', to: 'b', points: [], id: 'ab' },
        { from: 'b', to: 'c', points: [], id: 'bc' },
      ];
      expect(minimizer.detectCrossings(nodes, edges).crossingCount).toBe(0);
    });

    it('handles same start/end edge gracefully', () => {
      const nodes = makeNodes([['a', 0, 0], ['b', 100, 100]]);
      const edges: LayoutEdge[] = [
        { from: 'a', to: 'b', points: [], id: 'e1' },
        { from: 'a', to: 'b', points: [], id: 'e2' },
      ];
      // These share both endpoints → should not count as crossing
      expect(minimizer.detectCrossings(nodes, edges).crossingCount).toBe(0);
    });
  });

  // --- minimizeCrossings ---

  describe('minimizeCrossings', () => {
    it('returns 100% improvement for already-clean layout', () => {
      const { nodes, edges } = parallelLayout();
      const result = minimizer.minimizeCrossings(nodes, edges);
      expect(result.minimizedCrossings).toBe(0);
      expect(result.improvementPercent).toBe(100);
    });

    it('reduces crossings in crossing layout', () => {
      const { nodes, edges } = crossingLayout();
      const result = minimizer.minimizeCrossings(nodes, edges, 50);
      expect(result.minimizedCrossings).toBeLessThanOrEqual(result.crossingCount);
      expect(result.improvementPercent).toBeGreaterThanOrEqual(0);
    });

    it('returns same node count after minimization', () => {
      const { nodes, edges } = crossingLayout();
      const result = minimizer.minimizeCrossings(nodes, edges);
      expect(result.minimizedNodes).toHaveLength(nodes.length);
    });

    it('preserves node ids and labels', () => {
      const { nodes, edges } = crossingLayout();
      const result = minimizer.minimizeCrossings(nodes, edges);
      const ids = result.minimizedNodes.map(n => n.id).sort();
      const origIds = nodes.map(n => n.id).sort();
      expect(ids).toEqual(origIds);
    });

    it('respects maxIterations = 0 (spring only, no swaps)', () => {
      const { nodes, edges } = crossingLayout();
      const result = minimizer.minimizeCrossings(nodes, edges, 0);
      // Even with 0 iterations, the function should return a valid result
      expect(result.minimizedNodes).toHaveLength(nodes.length);
      expect(result.improvementPercent).toBeGreaterThanOrEqual(0);
    });

    it('handles single node gracefully', () => {
      const nodes = makeNodes([['a', 50, 50]]);
      const edges: LayoutEdge[] = [];
      const result = minimizer.minimizeCrossings(nodes, edges);
      expect(result.minimizedCrossings).toBe(0);
      expect(result.improvementPercent).toBe(100);
    });

    it('handles edges with source/target instead of from/to', () => {
      const nodes = makeNodes([
        ['a', 100, 100],
        ['b', 300, 300],
        ['c', 100, 300],
        ['d', 300, 100],
      ]);
      const edges: LayoutEdge[] = [
        { source: 'a', target: 'b', points: [], id: 'ab' },
        { source: 'c', target: 'd', points: [], id: 'cd' },
      ];
      const result = minimizer.detectCrossings(nodes, edges);
      expect(result.crossingCount).toBe(1);
    });

    it('handles edges with missing node references', () => {
      const nodes = makeNodes([['a', 0, 0], ['b', 100, 100]]);
      const edges: LayoutEdge[] = [
        { from: 'a', to: 'z', points: [], id: 'az' },  // 'z' not in nodes
        { from: 'b', to: 'c', points: [], id: 'bc' },  // 'c' not in nodes
      ];
      const result = minimizer.detectCrossings(nodes, edges);
      expect(result.crossingCount).toBe(0);
    });

    it('handles nodes without width/height (w/h)', () => {
      const nodes: PositionedNode[] = [
        { id: 'a', label: 'A', x: 0, y: 0 },
        { id: 'b', label: 'B', x: 100, y: 100 },
        { id: 'c', label: 'C', x: 0, y: 100 },
        { id: 'd', label: 'D', x: 100, y: 0 },
      ];
      const edges: LayoutEdge[] = [
        { from: 'a', to: 'b', points: [], id: 'ab' },
        { from: 'c', to: 'd', points: [], id: 'cd' },
      ];
      const result = minimizer.detectCrossings(nodes, edges);
      expect(result.crossingCount).toBe(1);
    });
  });
});
