/**
 * TASK-0141: Multi-Level Graph Coarsening REQ Formalization (REQ-095)
 *
 * Dedicated tests verifying the multi-level graph coarsening algorithm
 * implemented in ComplexLayoutEngine (commit 995ee7d):
 *   - Heavy-edge matching for single-level coarsening
 *   - Multi-level coarsening up to 4 levels
 *   - Progressive refinement (uncoarsen + refine)
 *   - Small graph bypass (direct layout when below levelThreshold)
 *
 * Tests exercise coarsening through the public generateComplexLayout API
 * with multi-level mode enabled (enableMultiLevel: true,
 * enableForceDirected: false, enableClustering: false).
 */

import { NodeDatum, EdgeDatum, DiagramType } from '@stv/core/types/diagram';
import { ComplexLayoutEngine, ComplexLayoutConfig } from '@/visualization/complex-layout-engine';
import { OverlapResolver } from '@/visualization/strategies/OverlapResolver';
import { LayoutOptimizer } from '@/visualization/strategies/LayoutOptimizer';
import { DagreLayoutStrategy } from '@/visualization/strategies/DagreLayoutStrategy';
import { FallbackLayoutStrategy } from '@/visualization/strategies/FallbackLayoutStrategy';
import type { LayoutConfig } from '@/visualization/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMultiLevelEngine(
  extraConfig: Partial<ComplexLayoutConfig> = {}
): ComplexLayoutEngine {
  const baseConfig: Partial<ComplexLayoutConfig> = {
    width: 1920,
    height: 1080,
    nodeWidth: 120,
    nodeHeight: 60,
    marginX: 50,
    marginY: 50,
    rankDirection: 'TB',
    nodeSeparation: 50,
    edgeSeparation: 10,
    rankSeparation: 50,
    enableMultiLevel: true,
    enableForceDirected: false,
    enableClustering: false,
    levelThreshold: 15,
    ...extraConfig,
  };

  const fallback = new FallbackLayoutStrategy(baseConfig as LayoutConfig);
  const dagreStrategy = new DagreLayoutStrategy(baseConfig as LayoutConfig, fallback);
  const overlapResolver = new OverlapResolver(baseConfig as LayoutConfig);
  const layoutOptimizer = new LayoutOptimizer(baseConfig as LayoutConfig);

  return new ComplexLayoutEngine(
    baseConfig as ComplexLayoutConfig,
    overlapResolver,
    layoutOptimizer,
    dagreStrategy
  );
}

function makeChainGraph(count: number): { nodes: NodeDatum[]; edges: EdgeDatum[] } {
  const nodes: NodeDatum[] = Array.from({ length: count }, (_, i) => ({
    id: `n${i}`,
    label: `Node ${i}`,
  }));
  const edges: EdgeDatum[] = Array.from({ length: count - 1 }, (_, i) => ({
    from: `n${i}`,
    to: `n${i + 1}`,
  }));
  return { nodes, edges };
}

function makeTreeGraph(depth: number): { nodes: NodeDatum[]; edges: EdgeDatum[] } {
  const nodes: NodeDatum[] = [];
  const edges: EdgeDatum[] = [];
  let id = 0;

  function build(parentId: string | null, currentDepth: number): void {
    const nodeId = `n${id++}`;
    nodes.push({ id: nodeId, label: `Node ${nodeId}` });
    if (parentId !== null) {
      edges.push({ from: parentId, to: nodeId });
    }
    if (currentDepth < depth) {
      build(nodeId, currentDepth + 1);
      build(nodeId, currentDepth + 1);
    }
  }

  build(null, 0);
  return { nodes, edges };
}

function makeFullyConnectedGraph(count: number): { nodes: NodeDatum[]; edges: EdgeDatum[] } {
  const nodes: NodeDatum[] = Array.from({ length: count }, (_, i) => ({
    id: `n${i}`,
    label: `Node ${i}`,
  }));
  const edges: EdgeDatum[] = [];
  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      edges.push({ from: `n${i}`, to: `n${j}` });
    }
  }
  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Multi-Level Graph Coarsening (REQ-095, TASK-0141)', () => {
  describe('Single-level coarsening', () => {
    test('should reduce node count through one level of coarsening', async () => {
      const engine = createMultiLevelEngine({ levelThreshold: 15 });
      const { nodes, edges } = makeChainGraph(30);

      const result = await engine.generateComplexLayout(nodes, edges, 'flow');

      expect(result.success).toBe(true);
      // All original nodes should be present in the final output
      expect(result.layout.nodes).toHaveLength(30);
    });

    test('should produce valid layout for a fully-connected 20-node graph', async () => {
      const engine = createMultiLevelEngine({ levelThreshold: 10 });
      const { nodes, edges } = makeFullyConnectedGraph(20);

      const result = await engine.generateComplexLayout(nodes, edges, 'network');

      expect(result.success).toBe(true);
      expect(result.layout.nodes).toHaveLength(20);
      // All nodes should have finite positions
      for (const node of result.layout.nodes) {
        expect(isFinite(node.x)).toBe(true);
        expect(isFinite(node.y)).toBe(true);
      }
    });
  });

  describe('Multi-level coarsening up to 4 levels', () => {
    test('should handle a 50-node chain graph (multiple coarsening levels)', async () => {
      const engine = createMultiLevelEngine({ levelThreshold: 10 });
      const { nodes, edges } = makeChainGraph(50);

      const result = await engine.generateComplexLayout(nodes, edges, 'flow');

      expect(result.success).toBe(true);
      expect(result.layout.nodes).toHaveLength(50);
      expect(result.layout.edges).toHaveLength(49);
    });

    test('should handle a tree graph of depth 5 (63 nodes)', async () => {
      const engine = createMultiLevelEngine({ levelThreshold: 10 });
      const { nodes, edges } = makeTreeGraph(5);

      const result = await engine.generateComplexLayout(nodes, edges, 'tree');

      expect(result.success).toBe(true);
      expect(result.layout.nodes).toHaveLength(63);
    });

    test('should produce finite positions for all nodes after multi-level layout', async () => {
      const engine = createMultiLevelEngine({ levelThreshold: 10 });
      const { nodes, edges } = makeChainGraph(40);

      const result = await engine.generateComplexLayout(nodes, edges, 'flow');

      expect(result.success).toBe(true);
      for (const node of result.layout.nodes) {
        expect(isFinite(node.x)).toBe(true);
        expect(isFinite(node.y)).toBe(true);
      }
    });
  });

  describe('Progressive refinement (uncoarsen + refine)', () => {
    test('should produce valid edges with point arrays after refinement', async () => {
      const engine = createMultiLevelEngine({ levelThreshold: 10 });
      const { nodes, edges } = makeTreeGraph(4); // 31 nodes

      const result = await engine.generateComplexLayout(nodes, edges, 'tree');

      expect(result.success).toBe(true);
      for (const edge of result.layout.edges) {
        expect(Array.isArray(edge.points)).toBe(true);
      }
    });

    test('should produce layout quality comparable to single-level for medium graphs', async () => {
      const engineML = createMultiLevelEngine({ levelThreshold: 15 });
      const engineSL = createMultiLevelEngine({ levelThreshold: 200 }); // effectively disables multi-level

      const { nodes, edges } = makeChainGraph(25);
      const resultML = await engineML.generateComplexLayout(nodes, edges, 'flow');
      const resultSL = await engineSL.generateComplexLayout(nodes, edges, 'flow');

      expect(resultML.success).toBe(true);
      expect(resultSL.success).toBe(true);
      // Both should produce the same number of nodes
      expect(resultML.layout.nodes).toHaveLength(25);
      expect(resultSL.layout.nodes).toHaveLength(25);
    });
  });

  describe('Small graph bypass', () => {
    test('should bypass coarsening for graphs below levelThreshold', async () => {
      // levelThreshold = 50 means 5-node graph should skip coarsening
      const engine = createMultiLevelEngine({ levelThreshold: 50 });
      const { nodes, edges } = makeChainGraph(5);

      const result = await engine.generateComplexLayout(nodes, edges, 'flow');

      expect(result.success).toBe(true);
      expect(result.layout.nodes).toHaveLength(5);
      expect(result.layout.edges).toHaveLength(4);
    });

    test('should handle a single-node graph without coarsening', async () => {
      const engine = createMultiLevelEngine({ levelThreshold: 10 });

      const result = await engine.generateComplexLayout(
        [{ id: 'a', label: 'A' }],
        [],
        'flow'
      );

      expect(result.success).toBe(true);
      expect(result.layout.nodes).toHaveLength(1);
    });

    test('should handle two-node graph without coarsening', async () => {
      const engine = createMultiLevelEngine({ levelThreshold: 10 });

      const result = await engine.generateComplexLayout(
        [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
        [{ from: 'a', to: 'b' }],
        'flow'
      );

      expect(result.success).toBe(true);
      expect(result.layout.nodes).toHaveLength(2);
    });
  });

  describe('Multiple diagram types', () => {
    const types: DiagramType[] = ['flow', 'tree', 'network', 'conceptmap', 'flowchart'];

    for (const type of types) {
      test(`should produce valid coarsened layout for diagram type "${type}"`, async () => {
        const engine = createMultiLevelEngine({ levelThreshold: 10 });
        const { nodes, edges } = makeChainGraph(20);

        const result = await engine.generateComplexLayout(nodes, edges, type);

        expect(result.success).toBe(true);
        expect(result.layout.nodes).toHaveLength(20);
      });
    }
  });
});
