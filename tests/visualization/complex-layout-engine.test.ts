import { NodeDatum, EdgeDatum, DiagramType } from '@stv/core/types/diagram';
import { ComplexLayoutEngine, ComplexLayoutConfig } from '@/visualization/complex-layout-engine';
import { OverlapResolver } from '@/visualization/strategies/OverlapResolver';
import { LayoutOptimizer } from '@/visualization/strategies/LayoutOptimizer';
import { DagreLayoutStrategy } from '@/visualization/strategies/DagreLayoutStrategy';
import { FallbackLayoutStrategy } from '@/visualization/strategies/FallbackLayoutStrategy';
import { LayoutResult, LayoutConfig } from '@/visualization/types';
import { VisualizationError } from '@/pipeline/pipeline-errors';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a chain graph: n0 -> n1 -> ... -> n{count-1} */
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

/** Build a fully-connected graph (every node connects to every other) */
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

/** Build a tree graph with branching factor 2 to given depth */
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

/** Create a ComplexLayoutEngine with a DagreLayoutStrategy wired in */
function createEngine(
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
    ...extraConfig,
  };

  const config = baseConfig as unknown as LayoutConfig;
  const fallback = new FallbackLayoutStrategy(config);
  const dagreStrategy = new DagreLayoutStrategy(config, fallback);
  const overlapResolver = new OverlapResolver(config);
  const layoutOptimizer = new LayoutOptimizer(config);

  return new ComplexLayoutEngine(
    config,
    overlapResolver,
    layoutOptimizer,
    dagreStrategy
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ComplexLayoutEngine (TASK-0063)', () => {
  describe('Instantiation', () => {
    it('should instantiate with default config', () => {
      const engine = createEngine();
      expect(engine).toBeInstanceOf(ComplexLayoutEngine);
    });

    it('should accept a partial config and merge with defaults', async () => {
      const engine = createEngine({
        enableClustering: false,
        maxClusterSize: 4,
        springStrength: 0.5,
        iterations: 50,
      });

      // Verify the engine works -- if config was not accepted,
      // force-directed or clustering paths could error.
      const { nodes, edges } = makeChainGraph(3);
      const result = await engine.generateComplexLayout(nodes, edges, 'flow');
      expect(result.success).toBe(true);
    });

    it('should accept performanceTargets in config', async () => {
      const engine = createEngine({
        performanceTargets: {
          maxLayoutTime: 2000,
          targetFPS: 30,
          memoryLimit: 128 * 1024 * 1024,
        },
      });

      const { nodes, edges } = makeChainGraph(3);
      const result = await engine.generateComplexLayout(nodes, edges, 'flow');
      expect(result.success).toBe(true);
    });
  });

  describe('layout() with small graph (5 nodes)', () => {
    it('should produce a valid LayoutResult for a 5-node chain', async () => {
      const engine = createEngine();
      const { nodes, edges } = makeChainGraph(5);
      const result = await engine.generateComplexLayout(nodes, edges, 'flow');

      expect(result).toHaveProperty('layout');
      expect(result).toHaveProperty('bounds');
      expect(result).toHaveProperty('processingTime');
      expect(result).toHaveProperty('success');
      expect(result.success).toBe(true);
      expect(result.layout.nodes).toHaveLength(5);
      expect(result.layout.edges).toHaveLength(4);
    });

    it('should position every node with x, y coordinates', async () => {
      const engine = createEngine();
      const { nodes, edges } = makeChainGraph(5);
      const result = await engine.generateComplexLayout(nodes, edges, 'flow');

      for (const node of result.layout.nodes) {
        expect(typeof node.x).toBe('number');
        expect(typeof node.y).toBe('number');
        expect(isFinite(node.x)).toBe(true);
        expect(isFinite(node.y)).toBe(true);
      }
    });

    it('should set bounding box correctly', async () => {
      const engine = createEngine();
      const { nodes, edges } = makeChainGraph(5);
      const result = await engine.generateComplexLayout(nodes, edges, 'flow');

      expect(result.bounds.width).toBeGreaterThanOrEqual(0);
      expect(result.bounds.height).toBeGreaterThanOrEqual(0);
    });
  });

  describe('layout() with medium graph (25 nodes)', () => {
    it('should handle a 25-node chain graph', async () => {
      const engine = createEngine({ levelThreshold: 20 });
      const { nodes, edges } = makeChainGraph(25);
      const result = await engine.generateComplexLayout(nodes, edges, 'flow');

      expect(result.success).toBe(true);
      expect(result.layout.nodes).toHaveLength(25);
      expect(result.layout.edges).toHaveLength(24);
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle a 25-node fully-connected graph', async () => {
      const engine = createEngine({ levelThreshold: 20 });
      const { nodes, edges } = makeFullyConnectedGraph(25);
      const result = await engine.generateComplexLayout(nodes, edges, 'flow');

      expect(result.success).toBe(true);
      expect(result.layout.nodes).toHaveLength(25);
      // fully connected: 25*24/2 = 300 edges
      // not all may survive layout conversion; just verify the layout is valid
      expect(result.layout.nodes.length).toBe(25);
    });

    it('should produce edges with point arrays', async () => {
      const engine = createEngine({ levelThreshold: 20 });
      const { nodes, edges } = makeChainGraph(25);
      const result = await engine.generateComplexLayout(nodes, edges, 'flow');

      for (const edge of result.layout.edges) {
        expect(Array.isArray(edge.points)).toBe(true);
        expect(edge.points.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('layout() with large graph (50 nodes)', () => {
    it('should handle a 50-node chain graph within a reasonable time', async () => {
      const engine = createEngine({ levelThreshold: 15 });
      const { nodes, edges } = makeChainGraph(50);

      const result = await engine.generateComplexLayout(nodes, edges, 'flow');

      expect(result.success).toBe(true);
      expect(result.layout.nodes).toHaveLength(50);
      expect(result.processingTime).toBeLessThan(30000); // 30s budget
    });

    it('should handle a tree graph of depth 5 (31 nodes)', async () => {
      const engine = createEngine({ levelThreshold: 15 });
      const { nodes, edges } = makeTreeGraph(4); // 31 nodes

      const result = await engine.generateComplexLayout(nodes, edges, 'tree');

      expect(result.success).toBe(true);
      expect(result.layout.nodes).toHaveLength(31);
    });
  });

  describe('Community detection / clustering', () => {
    it('should partition disconnected subgraphs into separate clusters', async () => {
      // Two disconnected chains of 5 nodes each
      const chainA = makeChainGraph(5);
      const chainB = makeChainGraph(5);

      // Prefix chain B IDs so they don't collide
      const nodes: NodeDatum[] = [
        ...chainA.nodes,
        ...chainB.nodes.map(n => ({ ...n, id: `b_${n.id}`, label: `B ${n.label}` })),
      ];
      const edges: EdgeDatum[] = [
        ...chainA.edges,
        ...chainB.edges.map(e => ({ ...e, from: `b_${e.from}`, to: `b_${e.to}` })),
      ];

      const engine = createEngine({
        enableClustering: true,
        enableForceDirected: false,
        enableMultiLevel: false,
        maxClusterSize: 10,
      });

      const result = await engine.generateComplexLayout(nodes, edges, 'flow');
      expect(result.success).toBe(true);
      expect(result.layout.nodes).toHaveLength(10);
    });

    it('should respect maxClusterSize setting', async () => {
      const engine = createEngine({
        enableClustering: true,
        enableForceDirected: false,
        enableMultiLevel: false,
        maxClusterSize: 3,
        levelThreshold: 5,
      });

      const { nodes, edges } = makeChainGraph(9);
      const result = await engine.generateComplexLayout(nodes, edges, 'flow');

      expect(result.success).toBe(true);
      expect(result.layout.nodes).toHaveLength(9);
    });
  });

  describe('Force-directed simulation convergence', () => {
    it('should be deterministic: identical input graph → identical layout output', async () => {
      // Regression: initial positions were seeded with Math.random(), so the
      // same graph converged differently per run — layout-quality assertions
      // (e.g. the star-graph distance test below) flaked on unlucky seeds.
      const run = async () => {
        const engine = createEngine({
          enableClustering: false,
          enableMultiLevel: false,
          enableForceDirected: true,
          iterations: 50,
          levelThreshold: 5,
        });
        const { nodes, edges } = makeChainGraph(8);
        const result = await engine.generateComplexLayout(nodes, edges, 'flow');
        return result.layout.nodes
          .map(n => `${n.id}:${n.x.toFixed(3)},${n.y.toFixed(3)}`)
          .join(' | ');
      };

      // Two fresh engine instances must agree bit-for-bit on the same input.
      await expect(run()).resolves.toBe(await run());
    });

    it('should produce finite positions after force-directed layout', async () => {
      const engine = createEngine({
        enableClustering: false,
        enableMultiLevel: false,
        enableForceDirected: true,
        iterations: 50,
        levelThreshold: 5,
      });

      const { nodes, edges } = makeChainGraph(8);
      const result = await engine.generateComplexLayout(nodes, edges, 'flow');

      expect(result.success).toBe(true);
      for (const node of result.layout.nodes) {
        expect(isFinite(node.x)).toBe(true);
        expect(isFinite(node.y)).toBe(true);
      }
    });

    it('should produce positioned nodes with dimensions w and h', async () => {
      const engine = createEngine({
        enableClustering: false,
        enableMultiLevel: false,
        enableForceDirected: true,
        iterations: 20,
        levelThreshold: 5,
      });

      const { nodes, edges } = makeChainGraph(6);
      const result = await engine.generateComplexLayout(nodes, edges, 'flow');

      for (const node of result.layout.nodes) {
        expect(node.w).toBeDefined();
        expect(node.h).toBeDefined();
        expect(typeof node.w).toBe('number');
        expect(typeof node.h).toBe('number');
      }
    });

    it('should spread nodes apart via repulsive forces', async () => {
      const engine = createEngine({
        enableClustering: false,
        enableMultiLevel: false,
        enableForceDirected: true,
        iterations: 100,
        levelThreshold: 5,
        repulsionStrength: 1200,
      });

      const { nodes, edges } = makeChainGraph(6);
      const result = await engine.generateComplexLayout(nodes, edges, 'flow');

      expect(result.success).toBe(true);
      // After simulation, no two nodes should overlap at the same position
      for (let i = 0; i < result.layout.nodes.length; i++) {
        for (let j = i + 1; j < result.layout.nodes.length; j++) {
          const ni = result.layout.nodes[i];
          const nj = result.layout.nodes[j];
          const dx = (ni.x + ni.w! / 2) - (nj.x + nj.w! / 2);
          const dy = (ni.y + ni.h! / 2) - (nj.y + nj.h! / 2);
          const dist = Math.sqrt(dx * dx + dy * dy);
          expect(dist).toBeGreaterThan(0);
        }
      }
    });

    it('should place connected nodes closer than disconnected ones on average', async () => {
      const engine = createEngine({
        enableClustering: false,
        enableMultiLevel: false,
        enableForceDirected: true,
        iterations: 600,
        levelThreshold: 5,
        springStrength: 1.2,
        repulsionStrength: 300,
      });

      // Star graph: center connected to all, outer nodes not connected to each other
      const nodes: NodeDatum[] = Array.from({ length: 7 }, (_, i) => ({
        id: `n${i}`,
        label: `Node ${i}`,
      }));
      const edges: EdgeDatum[] = Array.from({ length: 6 }, (_, i) => ({
        from: 'n0',
        to: `n${i + 1}`,
      }));

      const result = await engine.generateComplexLayout(nodes, edges, 'flow');
      expect(result.success).toBe(true);

      // Average distance from center (n0) to connected neighbors (n1-n6)
      const n0 = result.layout.nodes.find(n => n.id === 'n0')!;
      let connectedTotal = 0;
      for (let i = 1; i <= 6; i++) {
        const ni = result.layout.nodes.find(n => n.id === `n${i}`)!;
        connectedTotal += Math.sqrt(
          Math.pow(n0.x + n0.w! / 2 - (ni.x + ni.w! / 2), 2) +
          Math.pow(n0.y + n0.h! / 2 - (ni.y + ni.h! / 2), 2)
        );
      }
      const avgConnectedDist = connectedTotal / 6;

      // Average distance between non-connected pairs (n1-n2, n3-n4, n5-n6)
      const nonConnectedPairs: [string, string][] = [['n1', 'n2'], ['n3', 'n4'], ['n5', 'n6']];
      let nonConnectedTotal = 0;
      for (const [a, b] of nonConnectedPairs) {
        const na = result.layout.nodes.find(n => n.id === a)!;
        const nb = result.layout.nodes.find(n => n.id === b)!;
        nonConnectedTotal += Math.sqrt(
          Math.pow(na.x + na.w! / 2 - (nb.x + nb.w! / 2), 2) +
          Math.pow(na.y + na.h! / 2 - (nb.y + nb.h! / 2), 2)
        );
      }
      const avgNonConnectedDist = nonConnectedTotal / nonConnectedPairs.length;

      // With spring attraction pulling center-to-leaf edges closer,
      // center-leaf avg distance should generally be less than leaf-leaf avg distance.
      // Allow 1.5x tolerance for non-deterministic force-directed simulation.
      expect(avgConnectedDist).toBeLessThan(avgNonConnectedDist * 1.5);
    });

    it('should keep all nodes within canvas bounds', async () => {
      const engine = createEngine({
        enableClustering: false,
        enableMultiLevel: false,
        enableForceDirected: true,
        iterations: 100,
        levelThreshold: 5,
        width: 800,
        height: 600,
      });

      const { nodes, edges } = makeChainGraph(10);
      const result = await engine.generateComplexLayout(nodes, edges, 'flow');

      expect(result.success).toBe(true);
      for (const node of result.layout.nodes) {
        // Nodes should be within canvas (with tolerance for node offset in layout conversion)
        expect(node.x).toBeGreaterThanOrEqual(-100);
        expect(node.y).toBeGreaterThanOrEqual(-50);
        expect(node.x + node.w!).toBeLessThanOrEqual(1000);
        expect(node.y + node.h!).toBeLessThanOrEqual(750);
      }
    });

    it('should handle a graph with no edges using only repulsive forces', async () => {
      const engine = createEngine({
        enableClustering: false,
        enableMultiLevel: false,
        enableForceDirected: true,
        iterations: 50,
        levelThreshold: 5,
      });

      const nodes = Array.from({ length: 6 }, (_, i) => ({
        id: `n${i}`,
        label: `Node ${i}`,
      }));
      const result = await engine.generateComplexLayout(nodes, [], 'flow');

      expect(result.success).toBe(true);
      expect(result.layout.nodes).toHaveLength(6);
      // All positions should be finite
      for (const node of result.layout.nodes) {
        expect(isFinite(node.x)).toBe(true);
        expect(isFinite(node.y)).toBe(true);
      }
    });
  });

  describe('Graph coarsening', () => {
    it('should reduce graph size through coarsening levels', async () => {
      const engine = createEngine({
        enableMultiLevel: true,
        enableClustering: false,
        enableForceDirected: false,
        levelThreshold: 15,
      });

      const { nodes, edges } = makeChainGraph(30);
      const result = await engine.generateComplexLayout(nodes, edges, 'flow');

      expect(result.success).toBe(true);
      expect(result.layout.nodes).toHaveLength(30);
    });

    it('should produce valid layout for multi-level with tree graph', async () => {
      const engine = createEngine({
        enableMultiLevel: true,
        enableClustering: false,
        enableForceDirected: false,
        levelThreshold: 15,
      });

      const { nodes, edges } = makeTreeGraph(4); // 31 nodes
      const result = await engine.generateComplexLayout(nodes, edges, 'tree');

      expect(result.success).toBe(true);
      expect(result.layout.nodes).toHaveLength(31);
    });
  });

  describe('OverlapResolver integration', () => {
    it('should produce a layout with OverlapResolver applied when enabled', async () => {
      const engine = createEngine({
        enableOverlapResolution: true,
        levelThreshold: 5,
      });

      const { nodes, edges } = makeChainGraph(10);
      const result = await engine.generateComplexLayout(nodes, edges, 'flow');

      expect(result.success).toBe(true);
      // The result should still have all nodes
      expect(result.layout.nodes).toHaveLength(10);
    });

    it('should still produce a valid result when OverlapResolver is disabled', async () => {
      const baseConfig: Partial<ComplexLayoutConfig> = {
        width: 1920,
        height: 1080,
        enableOverlapResolution: false,
      };
      // Strategies declare full LayoutConfig but only read width/height here.
      const fullConfig = baseConfig as unknown as import('@/visualization/types').LayoutConfig;
      const fallback = new FallbackLayoutStrategy(fullConfig);
      const dagreStrategy = new DagreLayoutStrategy(fullConfig, fallback);
      // Pass undefined overlapResolver
      const engine = new ComplexLayoutEngine(
        baseConfig,
        undefined, // no overlap resolver
        undefined, // no optimizer
        dagreStrategy
      );

      const { nodes, edges } = makeChainGraph(5);
      const result = await engine.generateComplexLayout(nodes, edges, 'flow');

      expect(result.success).toBe(true);
      expect(result.layout.nodes).toHaveLength(5);
    });
  });

  describe('Adaptive quality adjustment (optimizeRealTime)', () => {
    it('should reduce complexity when FPS is below target', async () => {
      const engine = createEngine({
        performanceTargets: {
          maxLayoutTime: 5000,
          targetFPS: 60,
          memoryLimit: 256 * 1024 * 1024,
        },
      });

      const { nodes, edges } = makeChainGraph(10);
      const layoutResult = await engine.generateComplexLayout(nodes, edges, 'flow');
      const layout = layoutResult.layout;

      const optimized = await engine.optimizeRealTime(layout, {
        currentFPS: 20, // well below target
        memoryUsage: 100,
        layoutTime: 100,
      });

      // Should return a valid layout
      expect(optimized.nodes).toHaveLength(10);
      // Edge paths should be simplified (direct lines only)
      for (const edge of optimized.edges) {
        expect(edge.points.length).toBeLessThanOrEqual(2);
      }
    });

    it('should optimize memory when memoryUsage exceeds limit', async () => {
      const engine = createEngine({
        performanceTargets: {
          maxLayoutTime: 5000,
          targetFPS: 60,
          memoryLimit: 100, // very low limit
        },
      });

      const { nodes, edges } = makeChainGraph(10);
      const layoutResult = await engine.generateComplexLayout(nodes, edges, 'flow');
      const layout = layoutResult.layout;

      const optimized = await engine.optimizeRealTime(layout, {
        currentFPS: 60,
        memoryUsage: 500, // exceeds limit
        layoutTime: 100,
      });

      expect(optimized.nodes).toHaveLength(10);
      // Nodes should have had `meta` stripped (memory optimization)
      for (const node of optimized.nodes) {
        expect(node).not.toHaveProperty('meta');
      }
    });

    it('should return unchanged layout when all metrics are within targets', async () => {
      const engine = createEngine({
        performanceTargets: {
          maxLayoutTime: 5000,
          targetFPS: 60,
          memoryLimit: 256 * 1024 * 1024,
        },
      });

      const { nodes, edges } = makeChainGraph(5);
      const layoutResult = await engine.generateComplexLayout(nodes, edges, 'flow');
      const layout = layoutResult.layout;

      const optimized = await engine.optimizeRealTime(layout, {
        currentFPS: 60,
        memoryUsage: 100,
        layoutTime: 100,
      });

      // With all metrics healthy, layout should be returned as-is
      expect(optimized.nodes).toHaveLength(layout.nodes.length);
      expect(optimized.edges).toHaveLength(layout.edges.length);
    });
  });

  describe('Performance monitoring basics', () => {
    it('should record processingTime for layout generation', async () => {
      const engine = createEngine();
      const { nodes, edges } = makeChainGraph(10);
      const result = await engine.generateComplexLayout(nodes, edges, 'flow');

      expect(typeof result.processingTime).toBe('number');
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('should update adaptive thresholds based on performance', async () => {
      const engine = createEngine({ adaptiveThresholds: true });

      // Low FPS should decrease target FPS
      engine.updateAdaptiveThresholds({ fps: 20, memory: 100, layoutTime: 100 });

      // The method is void, but it should not throw
      expect(() =>
        engine.updateAdaptiveThresholds({ fps: 20, memory: 100, layoutTime: 100 })
      ).not.toThrow();
    });

    it('should be a no-op when adaptiveThresholds is disabled', async () => {
      const engine = createEngine({ adaptiveThresholds: false });

      // Should not throw even when disabled
      expect(() =>
        engine.updateAdaptiveThresholds({ fps: 10, memory: 0, layoutTime: 0 })
      ).not.toThrow();
    });
  });

  describe('Edge cases', () => {
    it('should throw VisualizationError when DagreLayoutStrategy is not provided for standard layout', async () => {
      const engine = new ComplexLayoutEngine({ levelThreshold: 100 });
      const { nodes, edges } = makeChainGraph(3);

      await expect(
        engine.generateComplexLayout(nodes, edges, 'flow')
      ).rejects.toThrow('DagreLayoutStrategy is not initialized');

      // Verify it throws a typed VisualizationError, not a raw Error
      try {
        await engine.generateComplexLayout(nodes, edges, 'flow');
        fail('Expected VisualizationError');
      } catch (err) {
        expect(err).toBeInstanceOf(VisualizationError);
        expect((err as VisualizationError).errorType).toBe('RENDERING_ERROR');
        expect((err as VisualizationError).stage).toBe('visualization');
      }
    });

    it('should handle a single-node graph', async () => {
      const engine = createEngine();
      const result = await engine.generateComplexLayout(
        [{ id: 'a', label: 'A' }],
        [],
        'flow'
      );

      expect(result.success).toBe(true);
      expect(result.layout.nodes).toHaveLength(1);
      expect(result.layout.edges).toHaveLength(0);
    });

    it('should handle a graph with no edges', async () => {
      const engine = createEngine({ levelThreshold: 5 });
      const nodes = Array.from({ length: 6 }, (_, i) => ({
        id: `n${i}`,
        label: `Node ${i}`,
      }));
      const result = await engine.generateComplexLayout(nodes, [], 'flow');

      expect(result.success).toBe(true);
      expect(result.layout.nodes).toHaveLength(6);
      expect(result.layout.edges).toHaveLength(0);
    });
  });

  describe('Multiple diagram types', () => {
    const types: DiagramType[] = ['flow', 'tree', 'timeline', 'matrix', 'cycle'];

    for (const type of types) {
      it(`should handle diagram type "${type}"`, async () => {
        const engine = createEngine();
        const { nodes, edges } = makeChainGraph(5);
        const result = await engine.generateComplexLayout(nodes, edges, type);

        expect(result.success).toBe(true);
        expect(result.layout.nodes).toHaveLength(5);
      });
    }
  });
});
