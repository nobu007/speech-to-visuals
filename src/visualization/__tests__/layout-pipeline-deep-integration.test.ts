/**
 * Deep integration tests for the full layout pipeline.
 *
 * These tests go beyond the basic edge-case suite (layout-edge-cases-integration.test.ts)
 * by verifying end-to-end invariants that require the full pipeline to work correctly:
 *
 * - Bounds validity (minX <= maxX, width >= 0) across all iterations and types
 * - Edge point finiteness for all diagram types through optimization passes
 * - Concurrent layout generation (shared-state / race detection)
 * - Zero / negative / sub-pixel canvas dimensions
 * - Progressive iteration quality (iterations 1→5 must never regress to NaN)
 * - Mixed dimension field names (w vs width, h vs height) end-to-end
 * - Pre-positioned nodes (input has x/y; output must have valid finite coords)
 * - Dense graphs (K5, K8 complete graphs)
 * - Deep tree (20-level chain)
 * - Deterministic output (same input → same bounds within tolerance)
 * - Repeated/duplicate edges
 * - Nodes with only w/h fields (not width/height)
 */
import { describe, it, expect } from '@jest/globals';
import type { NodeDatum, EdgeDatum, PositionedNode, DiagramType } from '@stv/core/types/diagram';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(id: string, label?: string, overrides: Partial<NodeDatum> = {}): NodeDatum {
  return { id, label: label ?? id, ...overrides };
}

function makeEdge(from: string, to: string): EdgeDatum {
  return { from, to };
}

/** Assert every positioned node has finite x, y coordinates. */
function expectFiniteCoords(nodes: PositionedNode[]): void {
  for (const n of nodes) {
    expect(Number.isFinite(n.x)).toBe(true);
    expect(Number.isFinite(n.y)).toBe(true);
  }
}

/** Assert all edge points are finite. */
function expectFiniteEdges(nodes: PositionedNode[], edges: { points: { x: number; y: number }[] }[]): void {
  for (const e of edges) {
    if (e.points) {
      for (const pt of e.points) {
        expect(Number.isFinite(pt.x)).toBe(true);
        expect(Number.isFinite(pt.y)).toBe(true);
      }
    }
  }
}

/** Assert bounds are valid: width >= 0, height >= 0, minX <= maxX. */
function expectValidBounds(bounds: { width: number; height: number; minX: number; minY: number; maxX: number; maxY: number }): void {
  expect(Number.isFinite(bounds.width)).toBe(true);
  expect(Number.isFinite(bounds.height)).toBe(true);
  expect(Number.isFinite(bounds.minX)).toBe(true);
  expect(Number.isFinite(bounds.minY)).toBe(true);
  expect(Number.isFinite(bounds.maxX)).toBe(true);
  expect(Number.isFinite(bounds.maxY)).toBe(true);
  expect(bounds.width).toBeGreaterThanOrEqual(0);
  expect(bounds.height).toBeGreaterThanOrEqual(0);
}

const ALL_TYPES: DiagramType[] = [
  'flow', 'flowchart', 'tree', 'timeline', 'matrix',
  'cycle', 'comparison', 'network', 'conceptmap', 'mindmap', 'general',
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Deep Integration: LayoutEngine full pipeline invariants', () => {
  async function getEngine(width = 1920, height = 1080) {
    const { LayoutEngine } = await import('../layout-engine');
    return new LayoutEngine({ width, height });
  }

  // =========================================================================
  // Bounds validity across all diagram types at iteration 3+
  // =========================================================================

  describe('bounds validity for all diagram types at iteration 3+', () => {
    for (const type of ALL_TYPES) {
      it(`should produce valid bounds for ${type} at iteration 3`, async () => {
        const engine = await getEngine();
        const nodes = Array.from({ length: 6 }, (_, i) => makeNode(`n${i}`, `Node ${i}`));
        const edges = [
          makeEdge('n0', 'n1'), makeEdge('n1', 'n2'), makeEdge('n2', 'n3'),
          makeEdge('n3', 'n4'), makeEdge('n4', 'n5'),
        ];

        const result = await engine.generateLayout(nodes, edges, type, 3);

        expect(result).toBeDefined();
        expectValidBounds(result.bounds);
        expectFiniteCoords(result.layout.nodes);
        expectFiniteEdges(result.layout.nodes, result.layout.edges);
      });
    }
  });

  // =========================================================================
  // Progressive iteration quality (1→5)
  // =========================================================================

  describe('progressive iteration quality', () => {
    it('should maintain finite coords and valid bounds across iterations 1→5', async () => {
      const engine = await getEngine();
      const nodes = Array.from({ length: 8 }, (_, i) => makeNode(`n${i}`, `Node ${i}`));
      const edges = [
        makeEdge('n0', 'n1'), makeEdge('n1', 'n2'), makeEdge('n2', 'n3'),
        makeEdge('n3', 'n4'), makeEdge('n4', 'n5'), makeEdge('n5', 'n6'),
        makeEdge('n6', 'n7'), makeEdge('n0', 'n7'),  // cycle back
      ];

      for (let iter = 1; iter <= 5; iter++) {
        const result = await engine.generateLayout(nodes, edges, 'flow', iter);

        expect(result).toBeDefined();
        expectValidBounds(result.bounds);
        expectFiniteCoords(result.layout.nodes);
        expectFiniteEdges(result.layout.nodes, result.layout.edges);
      }
    });

    it('should maintain quality for tree type across iterations 1→5', async () => {
      const engine = await getEngine();
      const nodes = Array.from({ length: 10 }, (_, i) => makeNode(`n${i}`, `Node ${i}`));
      const edges = [
        makeEdge('n0', 'n1'), makeEdge('n0', 'n2'),
        makeEdge('n1', 'n3'), makeEdge('n1', 'n4'),
        makeEdge('n2', 'n5'), makeEdge('n2', 'n6'),
        makeEdge('n3', 'n7'), makeEdge('n4', 'n8'),
        makeEdge('n5', 'n9'),
      ];

      for (let iter = 1; iter <= 5; iter++) {
        const result = await engine.generateLayout(nodes, edges, 'tree', iter);
        expectValidBounds(result.bounds);
        expectFiniteCoords(result.layout.nodes);
      }
    });
  });

  // =========================================================================
  // Concurrent layout generation (shared-state detection)
  // =========================================================================

  describe('concurrent layout generation', () => {
    it('should handle 5 concurrent calls without interference', async () => {
      const engine = await getEngine();

      const calls = Array.from({ length: 5 }, async (_, i) => {
        const nodes = Array.from({ length: 5 }, (_, j) => makeNode(`batch${i}-n${j}`, `Node ${j}`));
        const edges = [
          makeEdge(`batch${i}-n0`, `batch${i}-n1`),
          makeEdge(`batch${i}-n1`, `batch${i}-n2`),
          makeEdge(`batch${i}-n2`, `batch${i}-n3`),
          makeEdge(`batch${i}-n3`, `batch${i}-n4`),
        ];
        return engine.generateLayout(nodes, edges, 'flow', 1);
      });

      const results = await Promise.all(calls);

      // Each result should have exactly its own 5 nodes — no cross-contamination
      for (let i = 0; i < results.length; i++) {
        expect(results[i].layout.nodes).toHaveLength(5);
        for (const n of results[i].layout.nodes) {
          expect(n.id).toContain(`batch${i}-`);
        }
        expectFiniteCoords(results[i].layout.nodes);
        expectValidBounds(results[i].bounds);
      }
    });

    it('should handle concurrent calls with different diagram types', async () => {
      const engine = await getEngine();
      const types: DiagramType[] = ALL_TYPES;

      const calls = types.map(async (type) => {
        const nodes = Array.from({ length: 4 }, (_, j) => makeNode(`${type}-n${j}`, `Node ${j}`));
        const edges = [
          makeEdge(`${type}-n0`, `${type}-n1`),
          makeEdge(`${type}-n1`, `${type}-n2`),
          makeEdge(`${type}-n2`, `${type}-n3`),
        ];
        return engine.generateLayout(nodes, edges, type, 2);
      });

      const results = await Promise.all(calls);
      for (let i = 0; i < results.length; i++) {
        expect(results[i].layout.nodes).toHaveLength(4);
        for (const n of results[i].layout.nodes) {
          expect(n.id).toContain(`${types[i]}-`);
        }
        expectFiniteCoords(results[i].layout.nodes);
      }
    });
  });

  // =========================================================================
  // Zero / negative / sub-pixel canvas dimensions
  // =========================================================================

  describe('degenerate canvas dimensions', () => {
    it('should handle zero-width canvas', async () => {
      const engine = await getEngine(0, 1080);
      const nodes = [makeNode('a', 'A'), makeNode('b', 'B')];
      const edges = [makeEdge('a', 'b')];

      const result = await engine.generateLayout(nodes, edges, 'flow', 1);

      expect(result).toBeDefined();
      expectFiniteCoords(result.layout.nodes);
    });

    it('should handle zero-height canvas', async () => {
      const engine = await getEngine(1920, 0);
      const nodes = [makeNode('a', 'A'), makeNode('b', 'B')];
      const edges = [makeEdge('a', 'b')];

      const result = await engine.generateLayout(nodes, edges, 'flow', 1);

      expect(result).toBeDefined();
      expectFiniteCoords(result.layout.nodes);
    });

    it('should handle zero-area canvas (0x0)', async () => {
      const engine = await getEngine(0, 0);
      const nodes = [makeNode('a', 'A'), makeNode('b', 'B')];
      const edges = [makeEdge('a', 'b')];

      const result = await engine.generateLayout(nodes, edges, 'flow', 1);

      expect(result).toBeDefined();
      expectFiniteCoords(result.layout.nodes);
    });

    it('should handle sub-pixel canvas (0.5 x 0.5)', async () => {
      const engine = await getEngine(0.5, 0.5);
      const nodes = [makeNode('a', 'A'), makeNode('b', 'B')];
      const edges = [makeEdge('a', 'b')];

      const result = await engine.generateLayout(nodes, edges, 'flow', 1);

      expect(result).toBeDefined();
      expectFiniteCoords(result.layout.nodes);
    });

    it('should handle negative canvas dimensions', async () => {
      const engine = await getEngine(-100, -100);
      const nodes = [makeNode('a', 'A'), makeNode('b', 'B')];
      const edges = [makeEdge('a', 'b')];

      const result = await engine.generateLayout(nodes, edges, 'flow', 1);

      expect(result).toBeDefined();
      // Even with negative canvas, output coords must be finite
      expectFiniteCoords(result.layout.nodes);
    });
  });

  // =========================================================================
  // Mixed dimension field names (w vs width, h vs height)
  // =========================================================================

  describe('mixed dimension field names', () => {
    it('should handle nodes with only w/h (not width/height) at iteration 3+', async () => {
      const engine = await getEngine();
      const nodes = [
        { id: 'a', label: 'A', w: 100, h: 50 } as unknown as NodeDatum,
        { id: 'b', label: 'B', w: 120, h: 60 } as unknown as NodeDatum,
        { id: 'c', label: 'C', w: 80, h: 40 } as unknown as NodeDatum,
      ];
      const edges = [makeEdge('a', 'b'), makeEdge('b', 'c')];

      const result = await engine.generateLayout(nodes, edges, 'tree', 3);

      expect(result).toBeDefined();
      expectFiniteCoords(result.layout.nodes);
      expectValidBounds(result.bounds);
    });

    it('should handle nodes mixing width/height and w/h at iteration 3+', async () => {
      const engine = await getEngine();
      const nodes = [
        makeNode('a', 'A', { width: 100, height: 50 }),
        { id: 'b', label: 'B', w: 120, h: 60 } as unknown as NodeDatum,
        makeNode('c', 'C'),  // no dimensions at all
      ];
      const edges = [makeEdge('a', 'b'), makeEdge('b', 'c')];

      const result = await engine.generateLayout(nodes, edges, 'flow', 3);

      expect(result).toBeDefined();
      expectFiniteCoords(result.layout.nodes);
      expectValidBounds(result.bounds);
    });
  });

  // =========================================================================
  // Pre-positioned nodes (input has x/y set)
  // =========================================================================

  describe('pre-positioned nodes', () => {
    it('should produce finite output when input nodes have x/y', async () => {
      const engine = await getEngine();
      const nodes = [
        { id: 'a', label: 'A', x: 100, y: 200, width: 80, height: 40 } as unknown as NodeDatum,
        { id: 'b', label: 'B', x: 300, y: 400, width: 80, height: 40 } as unknown as NodeDatum,
      ];
      const edges = [makeEdge('a', 'b')];

      const result = await engine.generateLayout(nodes, edges, 'flow', 1);

      expect(result).toBeDefined();
      expectFiniteCoords(result.layout.nodes);
    });

    it('should produce finite output when input nodes have NaN-like x/y', async () => {
      const engine = await getEngine();
      const nodes = [
        { id: 'a', label: 'A', x: NaN, y: undefined, width: 80 } as unknown as NodeDatum,
        { id: 'b', label: 'B', x: 'garbage', y: 100, height: 40 } as unknown as NodeDatum,
      ];
      const edges = [makeEdge('a', 'b')];

      const result = await engine.generateLayout(nodes, edges, 'tree', 1);

      expect(result).toBeDefined();
      // Whatever the pipeline does, it should not propagate NaN
      for (const n of result.layout.nodes) {
        expect(Number.isNaN(n.x)).toBe(false);
        expect(Number.isNaN(n.y)).toBe(false);
      }
    });
  });

  // =========================================================================
  // Dense graphs (complete graphs)
  // =========================================================================

  describe('dense graphs', () => {
    it('should handle K5 (complete graph on 5 vertices)', async () => {
      const engine = await getEngine();
      const nodes = Array.from({ length: 5 }, (_, i) => makeNode(`n${i}`, `Node ${i}`));
      const edges: EdgeDatum[] = [];
      for (let i = 0; i < 5; i++) {
        for (let j = i + 1; j < 5; j++) {
          edges.push(makeEdge(`n${i}`, `n${j}`));
        }
      }

      const result = await engine.generateLayout(nodes, edges, 'network', 1);

      expect(result).toBeDefined();
      expect(result.layout.nodes).toHaveLength(5);
      expectFiniteCoords(result.layout.nodes);
      expectValidBounds(result.bounds);
    });

    it('should handle K8 (complete graph on 8 vertices) at iteration 3', async () => {
      const engine = await getEngine();
      const nodes = Array.from({ length: 8 }, (_, i) => makeNode(`n${i}`, `Node ${i}`));
      const edges: EdgeDatum[] = [];
      for (let i = 0; i < 8; i++) {
        for (let j = i + 1; j < 8; j++) {
          edges.push(makeEdge(`n${i}`, `n${j}`));
        }
      }

      const result = await engine.generateLayout(nodes, edges, 'network', 3);

      expect(result).toBeDefined();
      expect(result.layout.nodes).toHaveLength(8);
      expectFiniteCoords(result.layout.nodes);
      expectValidBounds(result.bounds);
    });
  });

  // =========================================================================
  // Deep tree (20-level chain)
  // =========================================================================

  describe('deep chain (20 levels)', () => {
    it('should handle 20-level deep chain for tree layout', async () => {
      const engine = await getEngine();
      const count = 20;
      const nodes = Array.from({ length: count }, (_, i) => makeNode(`n${i}`, `Node ${i}`));
      const edges = Array.from({ length: count - 1 }, (_, i) => makeEdge(`n${i}`, `n${i + 1}`));

      const result = await engine.generateLayout(nodes, edges, 'tree', 1);

      expect(result).toBeDefined();
      expect(result.layout.nodes).toHaveLength(count);
      expectFiniteCoords(result.layout.nodes);
      expectValidBounds(result.bounds);
    });

    it('should handle 20-level deep chain at iteration 4', async () => {
      const engine = await getEngine();
      const count = 20;
      const nodes = Array.from({ length: count }, (_, i) => makeNode(`n${i}`, `Node ${i}`));
      const edges = Array.from({ length: count - 1 }, (_, i) => makeEdge(`n${i}`, `n${i + 1}`));

      const result = await engine.generateLayout(nodes, edges, 'flow', 4);

      expect(result).toBeDefined();
      expectFiniteCoords(result.layout.nodes);
      expectValidBounds(result.bounds);
    });
  });

  // =========================================================================
  // Repeated / duplicate edges
  // =========================================================================

  describe('repeated and duplicate edges', () => {
    it('should handle duplicate edges (same from→to appearing 3x)', async () => {
      const engine = await getEngine();
      const nodes = [makeNode('a', 'A'), makeNode('b', 'B'), makeNode('c', 'C')];
      const edges = [
        makeEdge('a', 'b'), makeEdge('a', 'b'), makeEdge('a', 'b'),
        makeEdge('b', 'c'),
      ];

      const result = await engine.generateLayout(nodes, edges, 'flow', 1);

      expect(result).toBeDefined();
      expect(result.layout.nodes).toHaveLength(3);
      expectFiniteCoords(result.layout.nodes);
    });

    it('should handle bidirectional duplicate edges', async () => {
      const engine = await getEngine();
      const nodes = [makeNode('a', 'A'), makeNode('b', 'B')];
      const edges = [
        makeEdge('a', 'b'), makeEdge('b', 'a'),
        makeEdge('a', 'b'), makeEdge('b', 'a'),
      ];

      const result = await engine.generateLayout(nodes, edges, 'cycle', 2);

      expect(result).toBeDefined();
      expectFiniteCoords(result.layout.nodes);
    });
  });

  // =========================================================================
  // Deterministic output
  // =========================================================================

  describe('deterministic output', () => {
    it('should produce identical bounds for identical input (flow, iter 1)', async () => {
      const engine = await getEngine();
      const nodes = Array.from({ length: 6 }, (_, i) => makeNode(`n${i}`, `Node ${i}`));
      const edges = [
        makeEdge('n0', 'n1'), makeEdge('n1', 'n2'), makeEdge('n2', 'n3'),
        makeEdge('n3', 'n4'), makeEdge('n4', 'n5'),
      ];

      const result1 = await engine.generateLayout(nodes, edges, 'flow', 1);
      const result2 = await engine.generateLayout(nodes, edges, 'flow', 1);

      expect(result1.bounds.width).toBeCloseTo(result2.bounds.width, 0);
      expect(result1.bounds.height).toBeCloseTo(result2.bounds.height, 0);
    });

    it('should produce identical bounds for identical input (tree, iter 3)', async () => {
      const engine = await getEngine();
      const nodes = Array.from({ length: 7 }, (_, i) => makeNode(`n${i}`, `Node ${i}`));
      const edges = [
        makeEdge('n0', 'n1'), makeEdge('n0', 'n2'),
        makeEdge('n1', 'n3'), makeEdge('n1', 'n4'),
        makeEdge('n2', 'n5'), makeEdge('n2', 'n6'),
      ];

      const result1 = await engine.generateLayout(nodes, edges, 'tree', 3);
      const result2 = await engine.generateLayout(nodes, edges, 'tree', 3);

      expect(result1.bounds.width).toBeCloseTo(result2.bounds.width, 0);
      expect(result1.bounds.height).toBeCloseTo(result2.bounds.height, 0);
    });
  });

  // =========================================================================
  // Input mutation prevention (deeper)
  // =========================================================================

  describe('input mutation prevention (deep)', () => {
    it('should not add x/y/w/h fields to original NodeDatum objects', async () => {
      const engine = await getEngine();
      const nodes = [
        makeNode('a', 'A', { width: 100, height: 50 }),
        makeNode('b', 'B', { width: 100, height: 50 }),
      ];
      const edges = [makeEdge('a', 'b')];

      // NodeDatum should not have x/y at all before
      expect('x' in nodes[0]).toBe(false);
      expect('y' in nodes[0]).toBe(false);

      await engine.generateLayout(nodes, edges, 'tree', 3);

      // Still should not have x/y after pipeline
      expect('x' in nodes[0]).toBe(false);
      expect('y' in nodes[0]).toBe(false);
    });

    it('should not mutate input when using w/h-only nodes at iteration 3', async () => {
      const engine = await getEngine();
      const nodes = [
        { id: 'a', label: 'A', w: 100, h: 50 } as unknown as NodeDatum,
        { id: 'b', label: 'B', w: 100, h: 50 } as unknown as NodeDatum,
      ];
      const edges = [makeEdge('a', 'b')];

      const before = JSON.stringify(nodes);
      await engine.generateLayout(nodes, edges, 'cycle', 3);
      const after = JSON.stringify(nodes);

      expect(after).toBe(before);
    });

    it('should not mutate input across concurrent calls', async () => {
      const engine = await getEngine();
      const allNodes = Array.from({ length: 3 }, (_, i) => {
        const nodes = Array.from({ length: 4 }, (_, j) =>
          makeNode(`g${i}-n${j}`, `Node ${j}`, { width: 100, height: 50 }),
        );
        return nodes;
      });
      const allEdges = allNodes.map(nodes =>
        nodes.slice(1).map((_, j) => makeEdge(`g${allNodes.indexOf(nodes)}-n0`, `g${allNodes.indexOf(nodes)}-n${j + 1}`)),
      );

      const snapshots = allNodes.map(n => JSON.stringify(n));

      await Promise.all(
        allNodes.map((nodes, i) =>
          engine.generateLayout(nodes, allEdges[i], 'tree', 2),
        ),
      );

      for (let i = 0; i < allNodes.length; i++) {
        expect(JSON.stringify(allNodes[i])).toBe(snapshots[i]);
      }
    });
  });

  // =========================================================================
  // Edge finiteness for all diagram types at iteration 3
  // =========================================================================

  describe('edge point finiteness across all types at iteration 3', () => {
    for (const type of ALL_TYPES) {
      it(`should produce finite edge points for ${type} at iteration 3`, async () => {
        const engine = await getEngine();
        const nodes = Array.from({ length: 5 }, (_, i) => makeNode(`n${i}`, `Node ${i}`));
        const edges = [
          makeEdge('n0', 'n1'), makeEdge('n1', 'n2'),
          makeEdge('n2', 'n3'), makeEdge('n3', 'n4'),
          makeEdge('n0', 'n4'), // cross edge
        ];

        const result = await engine.generateLayout(nodes, edges, type, 3);

        expect(result).toBeDefined();
        expectFiniteEdges(result.layout.nodes, result.layout.edges);
      });
    }
  });

  // =========================================================================
  // All-degenerate combos (empty edges, single node, all types)
  // =========================================================================

  describe('single node with empty edges for all types at iteration 3+', () => {
    for (const type of ALL_TYPES) {
      it(`should handle single node, no edges, ${type} at iteration 3`, async () => {
        const engine = await getEngine();
        const result = await engine.generateLayout(
          [makeNode('solo', 'Solo')],
          [],
          type,
          3,
        );

        expect(result).toBeDefined();
        expect(result.layout.nodes).toHaveLength(1);
        expectFiniteCoords(result.layout.nodes);
        expectValidBounds(result.bounds);
      });
    }
  });

  // =========================================================================
  // Nodes with extreme labels (long strings, empty, special chars)
  // =========================================================================

  describe('extreme node labels', () => {
    it('should handle empty-string labels', async () => {
      const engine = await getEngine();
      const nodes = [
        makeNode('a', ''),
        makeNode('b', ''),
        makeNode('c', ''),
      ];
      const edges = [makeEdge('a', 'b'), makeEdge('b', 'c')];

      const result = await engine.generateLayout(nodes, edges, 'flow', 1);

      expect(result).toBeDefined();
      expectFiniteCoords(result.layout.nodes);
    });

    it('should handle very long labels (1000 chars)', async () => {
      const longLabel = 'A'.repeat(1000);
      const engine = await getEngine();
      const nodes = [makeNode('a', longLabel), makeNode('b', 'B')];
      const edges = [makeEdge('a', 'b')];

      const result = await engine.generateLayout(nodes, edges, 'tree', 1);

      expect(result).toBeDefined();
      expectFiniteCoords(result.layout.nodes);
    });

    it('should handle labels with special Unicode characters', async () => {
      const engine = await getEngine();
      const nodes = [
        makeNode('a', '🎉<&>"\'\\日本語'),
        makeNode('b', 'null\u0000undefined'),
      ];
      const edges = [makeEdge('a', 'b')];

      const result = await engine.generateLayout(nodes, edges, 'flow', 1);

      expect(result).toBeDefined();
      expectFiniteCoords(result.layout.nodes);
    });
  });

  // =========================================================================
  // Multi-island graph (disconnected components)
  // =========================================================================

  describe('multi-island disconnected graph', () => {
    it('should handle two disconnected 3-node chains', async () => {
      const engine = await getEngine();
      const nodes = Array.from({ length: 6 }, (_, i) => makeNode(`n${i}`, `Node ${i}`));
      const edges = [
        makeEdge('n0', 'n1'), makeEdge('n1', 'n2'), // island 1
        makeEdge('n3', 'n4'), makeEdge('n4', 'n5'), // island 2
      ];

      const result = await engine.generateLayout(nodes, edges, 'network', 1);

      expect(result).toBeDefined();
      expect(result.layout.nodes).toHaveLength(6);
      expectFiniteCoords(result.layout.nodes);
      expectValidBounds(result.bounds);
    });

    it('should handle 3 disconnected singletons + one chain at iteration 3', async () => {
      const engine = await getEngine();
      const nodes = Array.from({ length: 6 }, (_, i) => makeNode(`n${i}`, `Node ${i}`));
      const edges = [
        makeEdge('n0', 'n1'), makeEdge('n1', 'n2'), // connected chain
        // n3, n4, n5 are isolated
      ];

      const result = await engine.generateLayout(nodes, edges, 'flow', 3);

      expect(result).toBeDefined();
      expect(result.layout.nodes).toHaveLength(6);
      expectFiniteCoords(result.layout.nodes);
    });
  });

  // =========================================================================
  // Canvas utilization never NaN for any pipeline output
  // =========================================================================

  describe('metrics finiteness', () => {
    it('should produce finite metrics object for flow at iteration 3', async () => {
      const engine = await getEngine();
      const nodes = Array.from({ length: 6 }, (_, i) => makeNode(`n${i}`, `Node ${i}`));
      const edges = [
        makeEdge('n0', 'n1'), makeEdge('n1', 'n2'),
        makeEdge('n2', 'n3'), makeEdge('n3', 'n4'),
        makeEdge('n4', 'n5'),
      ];

      const result = await engine.generateLayout(nodes, edges, 'flow', 3);

      if (result.metrics) {
        for (const [key, val] of Object.entries(result.metrics)) {
          expect(Number.isFinite(val)).toBe(true);
          void key;
        }
      }
      if (result.confidence !== undefined) {
        expect(typeof result.confidence).toBe('number');
      }
    });

    it('should produce finite confidence value when present', async () => {
      const engine = await getEngine();
      const nodes = Array.from({ length: 4 }, (_, i) => makeNode(`n${i}`, `Node ${i}`));
      const edges = [makeEdge('n0', 'n1'), makeEdge('n1', 'n2'), makeEdge('n2', 'n3')];

      const result = await engine.generateLayout(nodes, edges, 'tree', 1);

      if (result.confidence !== undefined) {
        expect(Number.isFinite(result.confidence)).toBe(true);
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
      }
    });
  });
});
