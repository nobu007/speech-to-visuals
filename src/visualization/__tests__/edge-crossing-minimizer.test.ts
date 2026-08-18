/**
 * Tests for EdgeCrossingMinimizer (REQ-080)
 * Covers: detectEdgeCrossings, minimizeEdgeCrossings, analyzeEdgeCrossings,
 *         EdgeCrossingMinimizer class
 */

import {
  detectEdgeCrossings,
  minimizeEdgeCrossings,
  analyzeEdgeCrossings,
  EdgeCrossingMinimizer,
} from '../edge-crossing-minimizer';
import { PositionedNode, LayoutEdge } from '@stv/core/types/diagram';

function makeNode(id: string, x: number, y: number, w = 100, h = 100): PositionedNode {
  return { id, label: id, x, y, w, h };
}

function makeEdge(from: string, to: string): LayoutEdge {
  return { from, to, points: [] };
}

describe('detectEdgeCrossings', () => {
  it('returns 0 for fewer than 2 edges', () => {
    const nodes = [makeNode('a', 0, 0), makeNode('b', 200, 200)];
    expect(detectEdgeCrossings(nodes, [makeEdge('a', 'b')])).toBe(0);
  });

  it('returns 0 for non-crossing edges', () => {
    const nodes = [
      makeNode('a', 0, 0),
      makeNode('b', 200, 0),
      makeNode('c', 0, 200),
      makeNode('d', 200, 200),
    ];
    const edges = [
      makeEdge('a', 'b'), // horizontal top
      makeEdge('c', 'd'), // horizontal bottom
    ];
    expect(detectEdgeCrossings(nodes, edges)).toBe(0);
  });

  it('detects a single crossing (X pattern)', () => {
    const nodes = [
      makeNode('a', 0, 0),
      makeNode('b', 200, 200),
      makeNode('c', 200, 0),
      makeNode('d', 0, 200),
    ];
    const edges = [
      makeEdge('a', 'b'), // diagonal \
      makeEdge('c', 'd'), // diagonal /
    ];
    expect(detectEdgeCrossings(nodes, edges)).toBe(1);
  });

  it('skips edges sharing a node', () => {
    const nodes = [
      makeNode('a', 0, 0),
      makeNode('b', 200, 200),
      makeNode('c', 200, 0),
    ];
    const edges = [
      makeEdge('a', 'b'),
      makeEdge('a', 'c'), // shares node 'a'
    ];
    expect(detectEdgeCrossings(nodes, edges)).toBe(0);
  });

  it('handles edges with source/target instead of from/to', () => {
    const nodes = [
      makeNode('a', 0, 0),
      makeNode('b', 200, 200),
      makeNode('c', 200, 0),
      makeNode('d', 0, 200),
    ];
    const edges: LayoutEdge[] = [
      { source: 'a', target: 'b', points: [] },
      { source: 'c', target: 'd', points: [] },
    ];
    expect(detectEdgeCrossings(nodes, edges)).toBe(1);
  });

  it('detects multiple crossings', () => {
    // 6 nodes, 3 crossing edges
    const nodes = [
      makeNode('a', 0, 0),
      makeNode('b', 300, 300),
      makeNode('c', 0, 300),
      makeNode('d', 300, 0),
      makeNode('e', 150, 0),
      makeNode('f', 150, 300),
    ];
    const edges = [
      makeEdge('a', 'b'), // crosses c-d and e-f
      makeEdge('c', 'd'),
      makeEdge('e', 'f'),
    ];
    const count = detectEdgeCrossings(nodes, edges);
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

describe('minimizeEdgeCrossings', () => {
  it('returns original nodes when fewer than 2 edges or nodes', () => {
    const nodes = [makeNode('a', 0, 0)];
    const result = minimizeEdgeCrossings(nodes, [makeEdge('a', 'a')]);
    expect(result.nodes).toHaveLength(1);
    expect(result.crossingCount).toBe(0);
  });

  it('does not increase crossing count', () => {
    const nodes = [
      makeNode('a', 0, 0),
      makeNode('b', 200, 200),
      makeNode('c', 200, 0),
      makeNode('d', 0, 200),
    ];
    const edges = [makeEdge('a', 'b'), makeEdge('c', 'd')];

    const before = detectEdgeCrossings(nodes, edges);
    const result = minimizeEdgeCrossings(nodes, edges);
    expect(result.crossingCount).toBeLessThanOrEqual(before);
  });

  it('preserves node identities after swap', () => {
    const nodes = [
      makeNode('a', 0, 0),
      makeNode('b', 200, 200),
      makeNode('c', 200, 0),
      makeNode('d', 0, 200),
    ];
    const edges = [makeEdge('a', 'b'), makeEdge('c', 'd')];

    const result = minimizeEdgeCrossings(nodes, edges);
    const ids = result.nodes.map(n => n.id).sort();
    expect(ids).toEqual(['a', 'b', 'c', 'd']);
  });

  it('respects maxIterations parameter', () => {
    const nodes = [
      makeNode('a', 0, 0),
      makeNode('b', 200, 200),
      makeNode('c', 200, 0),
      makeNode('d', 0, 200),
    ];
    const edges = [makeEdge('a', 'b'), makeEdge('c', 'd')];

    // With 0 iterations, should not improve
    const result = minimizeEdgeCrossings(nodes, edges, 0);
    const originalCount = detectEdgeCrossings(nodes, edges);
    expect(result.crossingCount).toBe(originalCount);
  });
});

describe('analyzeEdgeCrossings', () => {
  it('returns improved=false when no crossings exist', () => {
    const nodes = [
      makeNode('a', 0, 0),
      makeNode('b', 200, 0),
      makeNode('c', 0, 200),
      makeNode('d', 200, 200),
    ];
    const edges = [makeEdge('a', 'b'), makeEdge('c', 'd')];

    const result = analyzeEdgeCrossings(nodes, edges);
    expect(result.crossingCount).toBe(0);
    expect(result.minimizedCrossingCount).toBe(0);
    expect(result.improved).toBe(false);
  });

  it('returns crossingCount and minimizedCrossingCount', () => {
    const nodes = [
      makeNode('a', 0, 0),
      makeNode('b', 200, 200),
      makeNode('c', 200, 0),
      makeNode('d', 0, 200),
    ];
    const edges = [makeEdge('a', 'b'), makeEdge('c', 'd')];

    const result = analyzeEdgeCrossings(nodes, edges);
    expect(result.crossingCount).toBeGreaterThanOrEqual(0);
    expect(result.minimizedCrossingCount).toBeLessThanOrEqual(result.crossingCount);
  });
});

describe('EdgeCrossingMinimizer class', () => {
  let minimizer: EdgeCrossingMinimizer;

  beforeEach(() => {
    minimizer = new EdgeCrossingMinimizer();
  });

  describe('isGraphType', () => {
    it('returns true for flow type', () => {
      expect(minimizer.isGraphType('flow')).toBe(true);
    });

    it('returns true for flowchart type', () => {
      expect(minimizer.isGraphType('flowchart')).toBe(true);
    });

    it('returns true for network type', () => {
      expect(minimizer.isGraphType('network')).toBe(true);
    });

    it('returns true for conceptmap type', () => {
      expect(minimizer.isGraphType('conceptmap')).toBe(true);
    });

    it('returns false for tree type', () => {
      expect(minimizer.isGraphType('tree')).toBe(false);
    });

    it('returns false for timeline type', () => {
      expect(minimizer.isGraphType('timeline')).toBe(false);
    });

    it('returns false for general type', () => {
      expect(minimizer.isGraphType('general')).toBe(false);
    });
  });

  describe('detectCrossings', () => {
    it('returns zero crossings for fewer than 2 edges', () => {
      const nodes = [makeNode('a', 0, 0), makeNode('b', 200, 200)];
      const result = minimizer.detectCrossings(nodes, [makeEdge('a', 'b')]);

      expect(result.crossingCount).toBe(0);
      expect(result.crossingPairs).toHaveLength(0);
    });

    it('detects crossing pairs with intersection points', () => {
      const nodes = [
        makeNode('a', 0, 0),
        makeNode('b', 200, 200),
        makeNode('c', 200, 0),
        makeNode('d', 0, 200),
      ];
      const edges = [
        { from: 'a', to: 'b', id: 'e1', points: [] },
        { from: 'c', to: 'd', id: 'e2', points: [] },
      ];

      const result = minimizer.detectCrossings(nodes, edges);
      expect(result.crossingCount).toBe(1);
      expect(result.crossingPairs).toHaveLength(1);
      expect(result.crossingPairs[0].edge1).toBe('e1');
      expect(result.crossingPairs[0].edge2).toBe('e2');
      // Nodes have w=h=100, so centers are at (50,50), (250,250), (250,50), (50,250)
      // Diagonals intersect at (150, 150)
      expect(result.crossingPairs[0].point.x).toBeCloseTo(150, 0);
      expect(result.crossingPairs[0].point.y).toBeCloseTo(150, 0);
    });
  });

  describe('minimizeCrossings', () => {
    it('returns improvementPercent=100 when no crossings exist', () => {
      const nodes = [
        makeNode('a', 0, 0),
        makeNode('b', 200, 0),
        makeNode('c', 0, 200),
        makeNode('d', 200, 200),
      ];
      const edges = [makeEdge('a', 'b'), makeEdge('c', 'd')];

      const result = minimizer.minimizeCrossings(nodes, edges);
      expect(result.crossingCount).toBe(0);
      expect(result.minimizedCrossings).toBe(0);
      expect(result.improvementPercent).toBe(100);
    });

    it('returns original crossing count and minimized nodes', () => {
      const nodes = [
        makeNode('a', 0, 0),
        makeNode('b', 200, 200),
        makeNode('c', 200, 0),
        makeNode('d', 0, 200),
      ];
      const edges = [makeEdge('a', 'b'), makeEdge('c', 'd')];

      const result = minimizer.minimizeCrossings(nodes, edges);
      expect(result.crossingCount).toBeGreaterThanOrEqual(1);
      expect(result.minimizedCrossings).toBeLessThanOrEqual(result.crossingCount);
      expect(result.improvementPercent).toBeGreaterThanOrEqual(0);
      expect(result.minimizedNodes).toHaveLength(nodes.length);
    });

    it('preserves node count in minimizedNodes', () => {
      const nodes = [
        makeNode('a', 0, 0),
        makeNode('b', 300, 300),
        makeNode('c', 0, 300),
        makeNode('d', 300, 0),
        makeNode('e', 150, 150),
      ];
      const edges = [
        makeEdge('a', 'b'),
        makeEdge('c', 'd'),
        makeEdge('a', 'c'),
      ];

      const result = minimizer.minimizeCrossings(nodes, edges, 5);
      expect(result.minimizedNodes).toHaveLength(5);
    });
  });
});
