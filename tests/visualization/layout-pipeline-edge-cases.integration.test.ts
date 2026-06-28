/**
 * Integration tests: Layout pipeline edge-case validation.
 *
 * Validates that NaN guards, mutation prevention, and overlap resolution
 * hold end-to-end, not just at the unit level.  Exercises the full
 * LayoutEngine → DagreLayoutStrategy → OverlapResolver → LayoutOptimizationPipeline
 * chain, as well as direct component-level edge-case inputs.
 */
import { LayoutEngine } from '@/visualization/layout-engine';
import { LayoutOptimizer } from '@/visualization/strategies/LayoutOptimizer';
import { OverlapResolver } from '@/visualization/strategies/OverlapResolver';
import { LayoutOptimizationPipeline } from '@/visualization/strategies/LayoutOptimizationPipeline';
import type { NodeDatum, EdgeDatum, PositionedNode, DiagramLayout, LayoutEdge } from '@/types/diagram';

// ─── helpers ──────────────────────────────────────────────
const config = {
  width: 1920,
  height: 1080,
  nodeWidth: 120,
  nodeHeight: 60,
  marginX: 50,
  marginY: 50,
  nodeSeparation: 50,
  edgeSeparation: 10,
  rankSeparation: 50,
  rankDirection: 'TB' as const,
};

function makeLayout(
  nodes: PositionedNode[],
  edges: LayoutEdge[] = [],
): DiagramLayout {
  return { nodes, edges };
}

function positionedNode(
  id: string,
  x: number,
  y: number,
  extra?: Partial<PositionedNode>,
): PositionedNode {
  return { id, label: id, x, y, ...extra };
}

/** Assert that every node coordinate is a finite number (not NaN / Infinity). */
function assertAllFinite(layout: DiagramLayout, label = 'layout'): void {
  for (const n of layout.nodes) {
    expect(Number.isFinite(n.x)).toBe(true);
    expect(Number.isFinite(n.y)).toBe(true);
  }
  for (const e of layout.edges) {
    for (const p of e.points) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
  }
}

// ─── Full pipeline integration (LayoutEngine) ────────────
describe('LayoutEngine edge-case integration', () => {
  let engine: LayoutEngine;

  beforeEach(() => {
    engine = new LayoutEngine(config);
  });

  describe('empty / minimal inputs', () => {
    it('handles empty nodes and empty edges gracefully', async () => {
      const result = await engine.generateLayout([], [], 'flow', 1);
      expect(result.success).toBe(true);
      expect(result.layout.nodes).toHaveLength(0);
      expect(result.layout.edges).toHaveLength(0);
      assertAllFinite(result.layout);
    });

    it('handles single node with no edges', async () => {
      const nodes: NodeDatum[] = [{ id: 'only', label: 'Only Node' }];
      const result = await engine.generateLayout(nodes, [], 'flow', 1);
      expect(result.success).toBe(true);
      expect(result.layout.nodes).toHaveLength(1);
      assertAllFinite(result.layout);
    });

    it('handles single node with self-referencing edge', async () => {
      const nodes: NodeDatum[] = [{ id: 'solo', label: 'Solo' }];
      const edges: EdgeDatum[] = [{ from: 'solo', to: 'solo' }];
      const result = await engine.generateLayout(nodes, edges, 'flow', 1);
      expect(result.success).toBe(true);
      assertAllFinite(result.layout);
    });

    it('handles two nodes with no edges', async () => {
      const nodes: NodeDatum[] = [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ];
      const result = await engine.generateLayout(nodes, [], 'flow', 1);
      expect(result.success).toBe(true);
      expect(result.layout.nodes).toHaveLength(2);
      assertAllFinite(result.layout);
    });
  });

  describe('circular references', () => {
    it('handles A→B, B→A circular edges', async () => {
      const nodes: NodeDatum[] = [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ];
      const edges: EdgeDatum[] = [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'a' },
      ];
      const result = await engine.generateLayout(nodes, edges, 'flow', 1);
      expect(result.success).toBe(true);
      assertAllFinite(result.layout);
    });

    it('handles larger cycle: A→B→C→D→A', async () => {
      const nodes: NodeDatum[] = ['a', 'b', 'c', 'd'].map(id => ({ id, label: id.toUpperCase() }));
      const edges: EdgeDatum[] = [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
        { from: 'c', to: 'd' },
        { from: 'd', to: 'a' },
      ];
      const result = await engine.generateLayout(nodes, edges, 'cycle', 1);
      expect(result.success).toBe(true);
      assertAllFinite(result.layout);
    });

    it('handles cycle with iteration 3 (advanced optimizations)', async () => {
      const nodes: NodeDatum[] = ['a', 'b', 'c'].map(id => ({ id, label: id.toUpperCase() }));
      const edges: EdgeDatum[] = [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
        { from: 'c', to: 'a' },
      ];
      const result = await engine.generateLayout(nodes, edges, 'cycle', 3);
      expect(result.success).toBe(true);
      assertAllFinite(result.layout);
    });
  });

  describe('disconnected / dangling references', () => {
    it('handles edges referencing non-existent nodes', async () => {
      const nodes: NodeDatum[] = [{ id: 'a', label: 'A' }];
      const edges: EdgeDatum[] = [
        { from: 'a', to: 'ghost' },
        { from: 'phantom', to: 'a' },
      ];
      const result = await engine.generateLayout(nodes, edges, 'flow', 1);
      expect(result.success).toBe(true);
      assertAllFinite(result.layout);
    });

    it('handles fully disconnected nodes (no edges)', async () => {
      const nodes: NodeDatum[] = Array.from({ length: 5 }, (_, i) => ({
        id: `n${i}`,
        label: `Node ${i}`,
      }));
      const result = await engine.generateLayout(nodes, [], 'flow', 1);
      expect(result.success).toBe(true);
      assertAllFinite(result.layout);
    });
  });

  describe('extreme node properties', () => {
    it('handles nodes with empty labels', async () => {
      const nodes: NodeDatum[] = [
        { id: 'a', label: '' },
        { id: 'b', label: '' },
      ];
      const result = await engine.generateLayout(nodes, [{ from: 'a', to: 'b' }], 'flow', 1);
      expect(result.success).toBe(true);
      assertAllFinite(result.layout);
    });

    it('handles nodes with very long unicode labels', async () => {
      const longLabel = 'あ'.repeat(500);
      const nodes: NodeDatum[] = [
        { id: 'a', label: longLabel },
        { id: 'b', label: longLabel },
      ];
      const result = await engine.generateLayout(nodes, [{ from: 'a', to: 'b' }], 'flow', 1);
      expect(result.success).toBe(true);
      assertAllFinite(result.layout);
    });

    it('handles nodes with extreme width/height values', async () => {
      const nodes: NodeDatum[] = [
        { id: 'a', label: 'A', width: 1e6, height: 1e6 },
        { id: 'b', label: 'B', width: 0.001, height: 0.001 },
      ];
      const result = await engine.generateLayout(nodes, [{ from: 'a', to: 'b' }], 'flow', 1);
      expect(result.success).toBe(true);
      assertAllFinite(result.layout);
    });

    it('handles nodes with NaN width/height in input', async () => {
      const nodes: NodeDatum[] = [
        { id: 'a', label: 'A', width: NaN, height: NaN },
        { id: 'b', label: 'B', width: Infinity, height: -Infinity },
      ];
      // Pipeline should not crash; Dagre mock / fallback should handle.
      const result = await engine.generateLayout(nodes, [{ from: 'a', to: 'b' }], 'flow', 1);
      expect(result.success).toBe(true);
      assertAllFinite(result.layout);
    });
  });

  describe('multi-iteration pipeline', () => {
    it('produces finite coordinates through iteration 2 (type-specific opt)', async () => {
      const nodes: NodeDatum[] = ['a', 'b', 'c', 'd'].map(id => ({
        id,
        label: id.toUpperCase(),
      }));
      const edges: EdgeDatum[] = [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
        { from: 'c', to: 'd' },
      ];
      const result = await engine.generateLayout(nodes, edges, 'timeline', 2);
      expect(result.success).toBe(true);
      assertAllFinite(result.layout);
    });

    it('produces finite coordinates through iteration 3 (advanced opt) for matrix', async () => {
      const nodes: NodeDatum[] = Array.from({ length: 9 }, (_, i) => ({
        id: `m${i}`,
        label: `M${i}`,
      }));
      const result = await engine.generateLayout(nodes, [], 'matrix', 3);
      expect(result.success).toBe(true);
      assertAllFinite(result.layout);
    });

    it('produces finite coordinates through iteration 3 (advanced opt) for tree', async () => {
      const nodes: NodeDatum[] = Array.from({ length: 7 }, (_, i) => ({
        id: `t${i}`,
        label: `T${i}`,
      }));
      const edges: EdgeDatum[] = [
        { from: 't0', to: 't1' },
        { from: 't0', to: 't2' },
        { from: 't1', to: 't3' },
        { from: 't1', to: 't4' },
        { from: 't2', to: 't5' },
        { from: 't2', to: 't6' },
      ];
      const result = await engine.generateLayout(nodes, edges, 'tree', 3);
      expect(result.success).toBe(true);
      assertAllFinite(result.layout);
    });
  });

  describe('mutation prevention', () => {
    it('does not mutate input NodeDatum array', async () => {
      const nodes: NodeDatum[] = [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ];
      const originalNodes = nodes.map(n => ({ ...n }));
      await engine.generateLayout(nodes, [{ from: 'a', to: 'b' }], 'flow', 3);
      // Input NodeDatum objects should not gain x/y/w/h properties
      expect(nodes).toEqual(originalNodes);
    });
  });
});

// ─── LayoutOptimizer NaN guard tests ─────────────────────
describe('LayoutOptimizer NaN prevention for missing w/h', () => {
  let optimizer: LayoutOptimizer;

  beforeEach(() => {
    optimizer = new LayoutOptimizer(config);
  });

  it('cycle layout: finite coords when w/h are undefined', async () => {
    const nodes = ['a', 'b', 'c'].map((id, i) =>
      positionedNode(id, 100 + i * 200, 100 + i * 150),
    );
    // Deliberately omit w/h
    const result = await optimizer.optimizeForDiagramType(makeLayout(nodes), 'cycle');
    assertAllFinite(result);
  });

  it('timeline layout: finite coords when w/h are undefined', async () => {
    const nodes = ['a', 'b', 'c'].map((id, i) =>
      positionedNode(id, 100 + i * 200, 100),
    );
    const result = await optimizer.optimizeForDiagramType(makeLayout(nodes), 'timeline');
    assertAllFinite(result);
  });

  it('matrix layout: finite coords when w/h are undefined', async () => {
    const nodes = Array.from({ length: 4 }, (_, i) =>
      positionedNode(`n${i}`, 100 + i * 150, 100 + i * 100),
    );
    const result = await optimizer.optimizeForDiagramType(makeLayout(nodes), 'matrix');
    assertAllFinite(result);
  });

  it('advancedOptimizations cycle: finite coords when w/h are undefined', async () => {
    const nodes = ['a', 'b', 'c', 'd'].map((id, i) =>
      positionedNode(id, 100 + i * 200, 100 + i * 150),
    );
    const edges: LayoutEdge[] = [
      { from: 'a', to: 'b', points: [] },
      { from: 'b', to: 'c', points: [] },
      { from: 'c', to: 'd', points: [] },
      { from: 'd', to: 'a', points: [] },
    ];
    const result = await optimizer.advancedOptimizations(makeLayout(nodes, edges), 'cycle');
    assertAllFinite(result);
  });

  it('advancedOptimizations timeline: finite coords when w/h are undefined', async () => {
    const nodes = ['a', 'b', 'c'].map((id, i) =>
      positionedNode(id, 100 + i * 300, 200),
    );
    const result = await optimizer.advancedOptimizations(makeLayout(nodes), 'timeline');
    assertAllFinite(result);
  });

  it('advancedOptimizations matrix: finite coords when w/h are undefined', async () => {
    const nodes = Array.from({ length: 6 }, (_, i) =>
      positionedNode(`n${i}`, 100 + i * 150, 100 + (i % 2) * 200),
    );
    const result = await optimizer.advancedOptimizations(makeLayout(nodes), 'matrix');
    assertAllFinite(result);
  });

  it('minimizeEdgeCrossings: finite edge points when w/h are undefined', async () => {
    const nodes = [
      positionedNode('a', 100, 100),
      positionedNode('b', 300, 300),
    ];
    const edges: LayoutEdge[] = [
      { from: 'a', to: 'b', points: [] },
    ];
    const result = await optimizer.minimizeEdgeCrossings(makeLayout(nodes, edges));
    assertAllFinite(result);
  });

  it('does not produce NaN even when config has unusual values', async () => {
    const weirdConfig = {
      width: 0,
      height: 0,
      nodeWidth: 0,
      nodeHeight: 0,
      marginX: 0,
      marginY: 0,
      nodeSeparation: 0,
      edgeSeparation: 0,
      rankSeparation: 0,
      rankDirection: 'TB' as const,
    };
    const opt = new LayoutOptimizer(weirdConfig);
    const nodes = ['a', 'b', 'c'].map(id => positionedNode(id, 0, 0));
    const result = await opt.optimizeForDiagramType(makeLayout(nodes), 'cycle');
    // With zero config, coords should still be finite (0 is a valid finite number)
    assertAllFinite(result);
  });
});

// ─── LayoutOptimizer input immutability with missing w/h ─
describe('LayoutOptimizer immutability with missing w/h', () => {
  let optimizer: LayoutOptimizer;

  beforeEach(() => {
    optimizer = new LayoutOptimizer(config);
  });

  it('cycle: does not mutate input nodes lacking w/h', async () => {
    const nodes = ['a', 'b', 'c'].map(id => positionedNode(id, 100, 100));
    const original = nodes.map(n => ({ ...n }));
    await optimizer.optimizeForDiagramType(makeLayout(nodes), 'cycle');
    expect(nodes.map(n => ({ x: n.x, y: n.y }))).toEqual(original.map(n => ({ x: n.x, y: n.y })));
  });

  it('matrix: does not mutate input nodes lacking w/h', async () => {
    const nodes = Array.from({ length: 4 }, (_, i) =>
      positionedNode(`n${i}`, i * 100, i * 100),
    );
    const original = nodes.map(n => ({ ...n }));
    await optimizer.optimizeForDiagramType(makeLayout(nodes), 'matrix');
    expect(nodes.map(n => ({ x: n.x, y: n.y }))).toEqual(original.map(n => ({ x: n.x, y: n.y })));
  });
});

// ─── OverlapResolver edge cases ──────────────────────────
describe('OverlapResolver edge-case handling', () => {
  let resolver: OverlapResolver;

  beforeEach(() => {
    resolver = new OverlapResolver(config);
  });

  it('handles empty layout', async () => {
    const result = await resolver.ensureZeroOverlaps(makeLayout([]), 'flow');
    expect(result.nodes).toHaveLength(0);
  });

  it('handles single node', async () => {
    const result = await resolver.ensureZeroOverlaps(
      makeLayout([positionedNode('solo', 100, 100, { w: 120, h: 60 })]),
      'flow',
    );
    expect(result.nodes).toHaveLength(1);
    assertAllFinite(result);
  });

  it('separates nodes at identical positions', async () => {
    const nodes = [
      positionedNode('a', 100, 100, { w: 120, h: 60 }),
      positionedNode('b', 100, 100, { w: 120, h: 60 }),
    ];
    const result = await resolver.ensureZeroOverlaps(makeLayout(nodes), 'flow');
    assertAllFinite(result);
    // After resolution, nodes should have different positions
    const [a, b] = result.nodes;
    expect(a.x === b.x && a.y === b.y).toBe(false);
  });

  it('separates multiple nodes at identical positions', async () => {
    const nodes = Array.from({ length: 5 }, (_, i) =>
      positionedNode(`n${i}`, 200, 200, { w: 100, h: 50 }),
    );
    const result = await resolver.ensureZeroOverlaps(makeLayout(nodes), 'flow');
    assertAllFinite(result);
  });

  it('handles nodes with undefined w/h', async () => {
    const nodes = [
      positionedNode('a', 100, 100),
      positionedNode('b', 100, 100),
    ];
    const result = await resolver.ensureZeroOverlaps(makeLayout(nodes), 'flow');
    assertAllFinite(result);
  });

  it('finalOverlapResolution: handles nodes at identical positions', async () => {
    const nodes = [
      positionedNode('a', 500, 500, { w: 120, h: 60 }),
      positionedNode('b', 500, 500, { w: 120, h: 60 }),
    ];
    const result = await resolver.finalOverlapResolution(makeLayout(nodes));
    assertAllFinite(result);
    const [a, b] = result.nodes;
    expect(a.x === b.x && a.y === b.y).toBe(false);
  });

  it('finalOverlapResolution: empty layout is a no-op', async () => {
    const result = await resolver.finalOverlapResolution(makeLayout([]));
    expect(result.nodes).toHaveLength(0);
  });
});

// ─── Pipeline-level NaN propagation prevention ──────────
describe('LayoutOptimizationPipeline NaN propagation prevention', () => {
  let pipeline: LayoutOptimizationPipeline;
  let optimizer: LayoutOptimizer;

  beforeEach(() => {
    optimizer = new LayoutOptimizer(config);
    pipeline = new LayoutOptimizationPipeline(optimizer);
  });

  it('iteration 2 cycle: no NaN with nodes missing w/h', async () => {
    const nodes = ['a', 'b', 'c'].map((id, i) =>
      positionedNode(id, 200 + i * 250, 300 + i * 200),
    );
    const result = await pipeline.applyOptimizations(makeLayout(nodes), 'cycle', 2);
    assertAllFinite(result);
  });

  it('iteration 3 matrix: no NaN with nodes missing w/h', async () => {
    const nodes = Array.from({ length: 9 }, (_, i) =>
      positionedNode(`n${i}`, 100 + (i % 3) * 300, 100 + Math.floor(i / 3) * 200),
    );
    const result = await pipeline.applyOptimizations(makeLayout(nodes), 'matrix', 3);
    assertAllFinite(result);
  });

  it('iteration 3 timeline: no NaN with nodes missing w/h', async () => {
    const nodes = ['a', 'b', 'c', 'd'].map((id, i) =>
      positionedNode(id, 100 + i * 400, 400),
    );
    const result = await pipeline.applyOptimizations(makeLayout(nodes), 'timeline', 3);
    assertAllFinite(result);
  });

  it('iteration 1: passes through without optimization (no NaN)', async () => {
    const nodes = ['a', 'b'].map(id => positionedNode(id, 0, 0));
    const result = await pipeline.applyOptimizations(makeLayout(nodes), 'flow', 1);
    assertAllFinite(result);
    // Iteration 1 = no optimization, positions unchanged
    expect(result.nodes[0].x).toBe(0);
    expect(result.nodes[1].x).toBe(0);
  });
});

// ─── Stress: 19-node pipeline (under complex engine threshold) ──
describe('LayoutEngine stress: 19 nodes', () => {
  it('flow layout with 19 nodes and 18 edges: all finite, no crash', async () => {
    const engine = new LayoutEngine(config);
    const nodes: NodeDatum[] = Array.from({ length: 19 }, (_, i) => ({
      id: `n${i}`,
      label: `Node ${i}`,
    }));
    const edges: EdgeDatum[] = Array.from({ length: 18 }, (_, i) => ({
      from: `n${i}`,
      to: `n${i + 1}`,
    }));
    const result = await engine.generateLayout(nodes, edges, 'flow', 3);
    expect(result.success).toBe(true);
    expect(result.layout.nodes).toHaveLength(19);
    assertAllFinite(result.layout);
  });

  it('timeline layout with 15 nodes: all finite through iteration 3', async () => {
    const engine = new LayoutEngine(config);
    const nodes: NodeDatum[] = Array.from({ length: 15 }, (_, i) => ({
      id: `t${i}`,
      label: `Step ${i + 1}`,
    }));
    const edges: EdgeDatum[] = Array.from({ length: 14 }, (_, i) => ({
      from: `t${i}`,
      to: `t${i + 1}`,
    }));
    const result = await engine.generateLayout(nodes, edges, 'timeline', 3);
    expect(result.success).toBe(true);
    assertAllFinite(result.layout);
  });
});
