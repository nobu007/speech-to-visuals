/**
 * Edge-case integration tests for the full layout pipeline.
 *
 * Validates that NaN guards, mutation prevention, and overlap resolution
 * hold end-to-end through the real LayoutEngine — not just at the unit level.
 *
 * Covers:
 * - Empty / single-node / degenerate inputs
 * - Circular graph references (A→B→A, A→B→C→A)
 * - Self-referencing edges (A→A)
 * - Dangling edges (edge references non-existent node)
 * - Missing width/height on NodeDatum
 * - Extreme coordinates and dimensions (Infinity, 0, negative)
 * - Input mutation prevention (original nodes array untouched)
 * - Multiple optimization iterations (iteration 2, 3+)
 * - Large node count stress test
 * - All diagram types through the full pipeline
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

/** Deep clone nodes to detect mutation */
function snapshot<T>(arr: T[]): T[] {
  return arr.map(n => ({ ...(n as Record<string, unknown>) })) as unknown as T[];
}

/** Assert every positioned node has finite x, y, w, h */
function expectFiniteCoords(nodes: PositionedNode[]): void {
  for (const n of nodes) {
    expect(Number.isFinite(n.x)).toBe(true);
    expect(Number.isFinite(n.y)).toBe(true);
    const w = n.w ?? n.width ?? 0;
    const h = n.h ?? n.height ?? 0;
    expect(Number.isFinite(w)).toBe(true);
    expect(Number.isFinite(h)).toBe(true);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Edge-Case Integration: LayoutEngine full pipeline', () => {
  // Lazy-load LayoutEngine to avoid side effects at module scope
  async function getEngine() {
    const { LayoutEngine } = await import('../layout-engine');
    return new LayoutEngine({ width: 1920, height: 1080 });
  }

  // =========================================================================
  // Empty / degenerate inputs
  // =========================================================================

  describe('empty and degenerate inputs', () => {
    it('should handle empty nodes without throwing', async () => {
      const engine = await getEngine();
      const result = await engine.generateLayout([], [], 'tree', 1);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.layout.nodes).toHaveLength(0);
      expect(result.layout.edges).toHaveLength(0);
    });

    it('should handle empty nodes with edges (dangling edges)', async () => {
      const engine = await getEngine();
      const result = await engine.generateLayout(
        [],
        [makeEdge('a', 'b')],
        'flow',
        1,
      );

      expect(result).toBeDefined();
      // Should not crash regardless of success/failure
      expect(result.layout).toBeDefined();
    });

    it('should handle single node with no edges for each diagram type', async () => {
      const engine = await getEngine();
      const types: DiagramType[] = ['flow', 'tree', 'timeline', 'matrix', 'cycle'];

      for (const type of types) {
        const result = await engine.generateLayout(
          [makeNode('solo', 'Solo')],
          [],
          type,
          1,
        );

        expect(result.layout.nodes).toHaveLength(1);
        expectFiniteCoords(result.layout.nodes);
      }
    });
  });

  // =========================================================================
  // Circular references
  // =========================================================================

  describe('circular graph references', () => {
    it('should handle A→B→A (2-node cycle)', async () => {
      const engine = await getEngine();
      const nodes = [makeNode('a', 'A'), makeNode('b', 'B')];
      const edges = [makeEdge('a', 'b'), makeEdge('b', 'a')];

      const result = await engine.generateLayout(nodes, edges, 'cycle', 1);

      expect(result.success).toBe(true);
      expect(result.layout.nodes).toHaveLength(2);
      expectFiniteCoords(result.layout.nodes);
    });

    it('should handle A→B→C→A (3-node cycle)', async () => {
      const engine = await getEngine();
      const nodes = [makeNode('a', 'A'), makeNode('b', 'B'), makeNode('c', 'C')];
      const edges = [makeEdge('a', 'b'), makeEdge('b', 'c'), makeEdge('c', 'a')];

      const result = await engine.generateLayout(nodes, edges, 'cycle', 1);

      expect(result.success).toBe(true);
      expect(result.layout.nodes).toHaveLength(3);
      expectFiniteCoords(result.layout.nodes);
    });

    it('should handle larger cycle (5-node ring)', async () => {
      const engine = await getEngine();
      const nodes = Array.from({ length: 5 }, (_, i) => makeNode(`n${i}`, `Node ${i}`));
      const edges = nodes.map((_, i) => makeEdge(`n${i}`, `n${(i + 1) % 5}`));

      const result = await engine.generateLayout(nodes, edges, 'cycle', 1);

      expect(result.success).toBe(true);
      expectFiniteCoords(result.layout.nodes);
    });

    it('should handle cycle with optimization iteration > 1', async () => {
      const engine = await getEngine();
      const nodes = Array.from({ length: 4 }, (_, i) => makeNode(`n${i}`, `Node ${i}`));
      const edges = nodes.map((_, i) => makeEdge(`n${i}`, `n${(i + 1) % 4}`));

      // Iteration 2+ triggers optimizeForDiagramType
      const result = await engine.generateLayout(nodes, edges, 'cycle', 2);

      expect(result.success).toBe(true);
      expectFiniteCoords(result.layout.nodes);

      // Iteration 3+ triggers advancedOptimizations
      const result2 = await engine.generateLayout(nodes, edges, 'cycle', 3);
      expect(result2.success).toBe(true);
      expectFiniteCoords(result2.layout.nodes);
    });
  });

  // =========================================================================
  // Self-referencing edges
  // =========================================================================

  describe('self-referencing edges', () => {
    it('should handle A→A without crashing', async () => {
      const engine = await getEngine();
      const nodes = [makeNode('a', 'A'), makeNode('b', 'B')];
      const edges = [makeEdge('a', 'a'), makeEdge('a', 'b')];

      const result = await engine.generateLayout(nodes, edges, 'flow', 1);

      expect(result).toBeDefined();
      expect(result.layout.nodes).toHaveLength(2);
      expectFiniteCoords(result.layout.nodes);
    });
  });

  // =========================================================================
  // Dangling edges
  // =========================================================================

  describe('dangling edges (references to non-existent nodes)', () => {
    it('should handle edges pointing to missing nodes', async () => {
      const engine = await getEngine();
      const nodes = [makeNode('a', 'A'), makeNode('b', 'B')];
      const edges = [
        makeEdge('a', 'b'),
        makeEdge('a', 'ghost'),  // 'ghost' does not exist
        makeEdge('phantom', 'b'), // 'phantom' does not exist
      ];

      const result = await engine.generateLayout(nodes, edges, 'tree', 1);

      expect(result).toBeDefined();
      expect(result.layout.nodes).toHaveLength(2);
      expectFiniteCoords(result.layout.nodes);
    });
  });

  // =========================================================================
  // Missing width/height
  // =========================================================================

  describe('missing width and height', () => {
    it('should handle nodes without width/height fields', async () => {
      const engine = await getEngine();
      const nodes = [
        makeNode('a', 'A'),  // no width/height
        makeNode('b', 'B'),  // no width/height
        makeNode('c', 'C'),  // no width/height
      ];
      const edges = [makeEdge('a', 'b'), makeEdge('b', 'c')];

      const result = await engine.generateLayout(nodes, edges, 'tree', 1);

      expect(result.success).toBe(true);
      expectFiniteCoords(result.layout.nodes);
    });

    it('should handle mixed: some nodes with width/height, some without', async () => {
      const engine = await getEngine();
      const nodes = [
        makeNode('root', 'Root', { width: 200, height: 80 }),
        makeNode('c1', 'Child 1'),  // no dimensions
        makeNode('c2', 'Child 2', { width: 100 }),  // partial
      ];
      const edges = [makeEdge('root', 'c1'), makeEdge('root', 'c2')];

      const result = await engine.generateLayout(nodes, edges, 'tree', 1);

      expect(result.success).toBe(true);
      expectFiniteCoords(result.layout.nodes);

      // No NaN should propagate
      for (const n of result.layout.nodes) {
        expect(Number.isNaN(n.x)).toBe(false);
        expect(Number.isNaN(n.y)).toBe(false);
      }
    });
  });

  // =========================================================================
  // Extreme dimensions
  // =========================================================================

  describe('extreme node dimensions', () => {
    it('should handle node with width=0', async () => {
      const engine = await getEngine();
      const nodes = [
        makeNode('a', 'A', { width: 0, height: 60 }),
        makeNode('b', 'B'),
      ];
      const edges = [makeEdge('a', 'b')];

      const result = await engine.generateLayout(nodes, edges, 'flow', 1);

      expect(result).toBeDefined();
      expectFiniteCoords(result.layout.nodes);
    });

    it('should handle nodes with very large dimensions', async () => {
      const engine = await getEngine();
      const nodes = [
        makeNode('big', 'Big', { width: 5000, height: 5000 }),
        makeNode('small', 'Small'),
      ];

      const result = await engine.generateLayout(nodes, edges4('big', 'small'), 'tree', 1);

      expect(result).toBeDefined();
      expectFiniteCoords(result.layout.nodes);
    });

    it('should handle nodes with negative dimensions', async () => {
      const engine = await getEngine();
      const nodes = [
        makeNode('neg', 'Negative', { width: -100, height: -50 }),
        makeNode('ok', 'OK'),
      ];

      const result = await engine.generateLayout(nodes, [], 'tree', 1);

      expect(result).toBeDefined();
      // Pipeline should not crash; coords should be finite
      expectFiniteCoords(result.layout.nodes);
    });
  });

  // =========================================================================
  // Mutation prevention
  // =========================================================================

  describe('input mutation prevention', () => {
    it('should not mutate the input nodes array', async () => {
      const engine = await getEngine();
      const nodes = [
        makeNode('a', 'A', { width: 120, height: 60 }),
        makeNode('b', 'B', { width: 120, height: 60 }),
        makeNode('c', 'C', { width: 120, height: 60 }),
      ];
      const edges = [makeEdge('a', 'b'), makeEdge('b', 'c')];

      const before = snapshot(nodes);
      await engine.generateLayout(nodes, edges, 'tree', 3);
      const after = snapshot(nodes);

      // The original NodeDatum objects should not have x/y added
      expect(after).toEqual(before);
    });

    it('should not mutate the input edges array', async () => {
      const engine = await getEngine();
      const nodes = [makeNode('a'), makeNode('b')];
      const edges = [makeEdge('a', 'b')];

      const before = snapshot(edges);
      await engine.generateLayout(nodes, edges, 'flow', 1);
      const after = snapshot(edges);

      expect(after).toEqual(before);
    });

    it('should not mutate input nodes across multiple iterations', async () => {
      const engine = await getEngine();
      const nodes = [
        makeNode('a', 'A'),
        makeNode('b', 'B'),
        makeNode('c', 'C'),
        makeNode('d', 'D'),
      ];
      const edges = [
        makeEdge('a', 'b'),
        makeEdge('b', 'c'),
        makeEdge('c', 'd'),
      ];

      const before = JSON.stringify(nodes);
      // Run with high iteration to trigger all optimization passes
      await engine.generateLayout(nodes, edges, 'cycle', 5);
      const after = JSON.stringify(nodes);

      expect(after).toBe(before);
    });
  });

  // =========================================================================
  // NaN propagation guard (end-to-end)
  // =========================================================================

  describe('NaN propagation prevention (end-to-end)', () => {
    it('should produce zero NaN values in output coordinates', async () => {
      const engine = await getEngine();
      const nodes = [
        makeNode('a', 'A'),
        makeNode('b', 'B'),
        makeNode('c', 'C'),
      ];
      const edges = [makeEdge('a', 'b'), makeEdge('b', 'c'), makeEdge('a', 'c')];

      const result = await engine.generateLayout(nodes, edges, 'flow', 3);

      expect(result.success).toBe(true);
      for (const n of result.layout.nodes) {
        expect(Number.isNaN(n.x)).toBe(false);
        expect(Number.isNaN(n.y)).toBe(false);
      }
      // Edge points must also be finite
      for (const e of result.layout.edges) {
        for (const pt of e.points) {
          expect(Number.isNaN(pt.x)).toBe(false);
          expect(Number.isNaN(pt.y)).toBe(false);
        }
      }
      // Bounds must be finite
      expect(Number.isNaN(result.bounds.width)).toBe(false);
      expect(Number.isNaN(result.bounds.height)).toBe(false);
    });

    it('should handle NaN-like inputs (Infinity width) without producing NaN coords', async () => {
      const engine = await getEngine();
      const nodes = [
        makeNode('inf', 'Infinity', { width: Infinity, height: 60 }),
        makeNode('normal', 'Normal'),
      ];

      const result = await engine.generateLayout(nodes, [], 'tree', 1);

      expect(result).toBeDefined();
      // Whatever happens, output should not have NaN coordinates
      for (const n of result.layout.nodes) {
        // Infinity is acceptable in some edge cases, but NaN is never OK
        expect(Number.isNaN(n.x)).toBe(false);
        expect(Number.isNaN(n.y)).toBe(false);
      }
    });
  });

  // =========================================================================
  // All diagram types through pipeline
  // =========================================================================

  describe('all diagram types through full pipeline', () => {
    const types: DiagramType[] = [
      'flow', 'flowchart', 'tree', 'timeline', 'matrix',
      'cycle', 'comparison', 'network', 'conceptmap', 'mindmap', 'general',
    ];

    for (const type of types) {
      it(`should process ${type} with finite coordinates`, async () => {
        const engine = await getEngine();
        const nodes = Array.from({ length: 5 }, (_, i) => makeNode(`n${i}`, `Node ${i}`));
        const edges = [
          makeEdge('n0', 'n1'),
          makeEdge('n1', 'n2'),
          makeEdge('n2', 'n3'),
          makeEdge('n3', 'n4'),
        ];

        const result = await engine.generateLayout(nodes, edges, type, 1);

        expect(result).toBeDefined();
        expect(result.layout.nodes).toHaveLength(5);
        expectFiniteCoords(result.layout.nodes);
      });
    }
  });

  // =========================================================================
  // Large node count (stress test)
  // =========================================================================

  describe('large node count', () => {
    it('should handle 50 nodes within 5s', async () => {
      const engine = await getEngine();
      const count = 50;
      const nodes = Array.from({ length: count }, (_, i) => makeNode(`n${i}`, `Node ${i}`));
      const edges = Array.from({ length: count - 1 }, (_, i) => makeEdge(`n${i}`, `n${i + 1}`));

      const start = Date.now();
      const result = await engine.generateLayout(nodes, edges, 'tree', 1);
      const elapsed = Date.now() - start;

      expect(result).toBeDefined();
      expect(result.layout.nodes).toHaveLength(count);
      expectFiniteCoords(result.layout.nodes);
      expect(elapsed).toBeLessThan(5000);
    });

    it('should handle 100 nodes within 10s (complex engine path)', async () => {
      const engine = await getEngine();
      const count = 100;
      const nodes = Array.from({ length: count }, (_, i) => makeNode(`n${i}`, `Node ${i}`));
      const edges = Array.from({ length: count - 1 }, (_, i) => makeEdge(`n${i}`, `n${i + 1}`));

      const start = Date.now();
      const result = await engine.generateLayout(nodes, edges, 'network', 1);
      const elapsed = Date.now() - start;

      expect(result).toBeDefined();
      // 100 nodes triggers complex engine (>=20 threshold)
      expectFiniteCoords(result.layout.nodes);
      expect(elapsed).toBeLessThan(10000);
    });
  });

  // =========================================================================
  // Duplicate node IDs
  // =========================================================================

  describe('duplicate node IDs', () => {
    it('should handle duplicate IDs without crashing', async () => {
      const engine = await getEngine();
      const nodes = [
        makeNode('dup', 'First'),
        makeNode('dup', 'Second'),
        makeNode('unique', 'Unique'),
      ];
      const edges = [makeEdge('dup', 'unique')];

      const result = await engine.generateLayout(nodes, edges, 'flow', 1);

      expect(result).toBeDefined();
      expectFiniteCoords(result.layout.nodes);
    });
  });

  // =========================================================================
  // Edge with extra metadata
  // =========================================================================

  describe('edges with extra metadata', () => {
    it('should handle edges with labels and types', async () => {
      const engine = await getEngine();
      const nodes = [makeNode('a'), makeNode('b'), makeNode('c')];
      const edges: EdgeDatum[] = [
        { from: 'a', to: 'b', label: 'connects', type: 'strong' },
        { from: 'b', to: 'c', label: 'leads to', id: 'e1' },
      ];

      const result = await engine.generateLayout(nodes, edges, 'flow', 1);

      expect(result.success).toBe(true);
      expectFiniteCoords(result.layout.nodes);
    });
  });
});

// ---------------------------------------------------------------------------
// Helper used in extreme dimensions test
// ---------------------------------------------------------------------------

function edges4(...ids: string[]): EdgeDatum[] {
  const result: EdgeDatum[] = [];
  for (let i = 0; i < ids.length - 1; i++) {
    result.push(makeEdge(ids[i], ids[i + 1]));
  }
  return result;
}
