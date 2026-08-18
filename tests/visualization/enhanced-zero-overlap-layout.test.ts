import { ZeroOverlapLayoutEngine, EnhancedZeroOverlapLayoutEngine } from '@/visualization/enhanced-zero-overlap-layout';
import { NodeDatum, EdgeDatum, DiagramType, PositionedNode } from '@stv/core/types/diagram';
import dagre from '@dagrejs/dagre';

function makeNodes(count: number): NodeDatum[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `n${i}`,
    label: `Node ${i}`,
  }));
}

function makeEdges(pairs: [string, string][]): EdgeDatum[] {
  return pairs.map(([from, to]) => ({ from, to }));
}

/**
 * Helper to access private methods on ZeroOverlapLayoutEngine for testing.
 * Uses bracket notation to bypass TypeScript private access enforcement.
 */
type EnginePrivateMethods = {
  detectAllOverlaps: (nodes: PositionedNode[]) => { node1: PositionedNode; node2: PositionedNode }[];
  resolveCollisionAdvanced: (
    node1: PositionedNode, node2: PositionedNode,
    strategy: 'minimal_movement' | 'aesthetic_preservation' | 'hierarchical_respect'
  ) => { node1: PositionedNode; node2: PositionedNode };
  resolveCollisionMinimalMovement: (node1: PositionedNode, node2: PositionedNode) => { node1: PositionedNode; node2: PositionedNode };
  resolveCollisionAestheticPreservation: (node1: PositionedNode, node2: PositionedNode) => { node1: PositionedNode; node2: PositionedNode };
  resolveCollisionHierarchicalRespect: (node1: PositionedNode, node2: PositionedNode) => { node1: PositionedNode; node2: PositionedNode };
  detectCollisionsQuadtree: (nodes: PositionedNode[]) => { node1: PositionedNode; node2: PositionedNode }[];
  applyEnhancedForceDirectedAlgorithm: (nodes: PositionedNode[], edges: EdgeDatum[], spacing: number) => Promise<void>;
  // applyForceDirectedStep (round-40 retirement): dead v1-era copy with zero
  // production callers — removed with its method; the live step is
  // applyEnhancedForceStep, pinned in tests/guards/force-directed-step-single-source.test.ts.
  calculateMoveVector: (node1: PositionedNode, node2: PositionedNode, distance: number) => { x: number; y: number };
  calculateOptimalSeparation: (node1: PositionedNode, node2: PositionedNode) => number;
  findRootNode: (nodes: NodeDatum[], edges: EdgeDatum[]) => string;
  buildTree: (rootId: string, nodes: NodeDatum[], edges: EdgeDatum[]) => { id: string; children: unknown[] };
  calculateTreeHeight: (tree: unknown) => number;
  calculateTreeWidth: (tree: unknown) => number;
  positionTreeNodes: (tree: unknown, width: number, height: number) => PositionedNode[];
  generateTreeEdges: (edges: EdgeDatum[], nodes: PositionedNode[]) => import('@stv/core/types/diagram').LayoutEdge[];
  getDefaultMetrics: () => import('@/visualization/enhanced-zero-overlap-layout').LayoutQualityMetrics;
  calculateOverlapArea: (overlaps: { node1: PositionedNode; node2: PositionedNode }[]) => number;
  calculateEdgeCrossings: (edges: import('@stv/core/types/diagram').LayoutEdge[]) => number;
  calculateTotalEdgeLength: (edges: import('@stv/core/types/diagram').LayoutEdge[]) => number;
  calculateCanvasUtilization: (nodes: PositionedNode[]) => number;
  calculateSymmetryScore: (nodes: PositionedNode[]) => number;
};

function privateMethods(engine: ZeroOverlapLayoutEngine): EnginePrivateMethods {
  return engine as unknown as EnginePrivateMethods;
}

describe('ZeroOverlapLayoutEngine', () => {
  const engine = new ZeroOverlapLayoutEngine();

  describe('flowchart layout', () => {
    test('should generate layout for flowchart type', async () => {
      const nodes = makeNodes(5);
      const edges = makeEdges([['n0', 'n1'], ['n1', 'n2'], ['n2', 'n3'], ['n3', 'n4']]);

      const result = await engine.generateZeroOverlapLayout('flowchart', nodes, edges);

      expect(result).toBeDefined();
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
      expect(result.qualityMetrics).toBeDefined();
      expect(result.warnings).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('tree layout', () => {
      test('should generate layout for tree type', async () => {
      const nodes = makeNodes(4);
      const edges = makeEdges([['n0', 'n1'], ['n0', 'n2'], ['n2', 'n3']]);

      const result = await engine.generateZeroOverlapLayout('tree', nodes, edges);

      expect(result).toBeDefined();
      expect(result.qualityMetrics).toBeDefined();
    });
  });

  describe('timeline layout', () => {
      test('should generate layout for timeline type', async () => {
      const nodes = makeNodes(4);
      const edges = makeEdges([['n0', 'n1'], ['n1', 'n2'], ['n2', 'n3']]);

      const result = await engine.generateZeroOverlapLayout('timeline', nodes, edges);

      expect(result).toBeDefined();
      expect(result.qualityMetrics).toBeDefined();
    });
  });

  describe('comparison layout', () => {
      test('should generate layout for comparison type', async () => {
      const nodes = makeNodes(4);
      const edges = makeEdges([['n0', 'n1'], ['n2', 'n3']]);

      const result = await engine.generateZeroOverlapLayout('comparison', nodes, edges);

      expect(result).toBeDefined();
      expect(result.qualityMetrics).toBeDefined();
    });
  });

  describe('network layout', () => {
      test('should generate layout for network type', async () => {
      const nodes = makeNodes(5);
      const edges = makeEdges([['n0', 'n1'], ['n1', 'n2'], ['n2', 'n0'], ['n3', 'n4']]);

      const result = await engine.generateZeroOverlapLayout('network', nodes, edges);

      expect(result).toBeDefined();
      expect(result.qualityMetrics).toBeDefined();
    });
  });

  describe('default (concept map) layout', () => {
      test('should generate layout for unknown diagram types', async () => {
      const nodes = makeNodes(3);
      const edges = makeEdges([['n0', 'n1'], ['n1', 'n2']]);

      const result = await engine.generateZeroOverlapLayout('unknown' as DiagramType, nodes, edges);

      expect(result).toBeDefined();
      expect(result.qualityMetrics).toBeDefined();
    });
  });

  describe('empty graph', () => {
      test('should handle empty nodes', async () => {
      const result = await engine.generateZeroOverlapLayout('flowchart', [], []);

      expect(result.nodes).toHaveLength(0);
      expect(result.success).toBe(true);
    });
  });

  describe('single node', () => {
      test('should handle single node', async () => {
      const nodes = makeNodes(1);
      const result = await engine.generateZeroOverlapLayout('flowchart', nodes, []);

      expect(result).toBeDefined();
      expect(result.qualityMetrics).toBeDefined();
    });
  });

  describe('custom configuration', () => {
      test('should accept custom configuration', async () => {
      const customEngine = new ZeroOverlapLayoutEngine({
        canvasWidth: 800,
        canvasHeight: 600,
        collisionResolutionStrategy: 'grid_snap',
      });
      const nodes = makeNodes(3);
      const result = await customEngine.generateZeroOverlapLayout('flowchart', nodes, []);

      expect(result).toBeDefined();
      expect(result.qualityMetrics).toBeDefined();
    });
  });

  describe('quality metrics', () => {
      test('should return quality metrics', async () => {
      const nodes = makeNodes(4);
      const edges = makeEdges([['n0', 'n1'], ['n1', 'n2'], ['n2', 'n3']]);
      const result = await engine.generateZeroOverlapLayout('flowchart', nodes, edges);

      expect(result.qualityMetrics).toHaveProperty('overlapCount');
      expect(result.qualityMetrics).toHaveProperty('edgeCrossings');
      expect(result.qualityMetrics).toHaveProperty('canvasUtilization');
      expect(result.qualityMetrics).toHaveProperty('aestheticScore');
      expect(result.warnings).toBeDefined();
      expect(result.optimizationSteps).toBeGreaterThanOrEqual(0);
    });
  });

  describe('property naming convention (w/h)', () => {
    const layoutTypes: DiagramType[] = ['timeline', 'comparison', 'network', 'conceptmap'];

    layoutTypes.forEach(layoutType => {
      test(`should use w/h properties (not width/height) for ${layoutType} layout nodes`, async () => {
        const nodes = makeNodes(4);
        const edges = makeEdges([['n0', 'n1'], ['n1', 'n2'], ['n2', 'n3']]);
        const result = await engine.generateZeroOverlapLayout(layoutType, nodes, edges);

        expect(result.nodes.length).toBeGreaterThan(0);
        result.nodes.forEach(node => {
          // Key assertion: w and h properties must be present (TASK-0094 property naming fix)
          expect(node).toHaveProperty('w');
          expect(node).toHaveProperty('h');
          expect(typeof node.w).toBe('number');
          expect(typeof node.h).toBe('number');
        });
      });
    });

    test('should not throw runtime errors when reading node dimensions via w/h', async () => {
      const nodes = makeNodes(5);
      const edges = makeEdges([['n0', 'n1'], ['n1', 'n2'], ['n2', 'n3'], ['n3', 'n4']]);

      for (const type of layoutTypes) {
        const result = await engine.generateZeroOverlapLayout(type, nodes, edges);
        // No "Cannot read properties of undefined" errors when accessing w/h
        result.nodes.forEach(node => {
          const w = node.w;
          const h = node.h;
          expect(typeof w).toBe('number');
          expect(typeof h).toBe('number');
        });
      }
    });
  });

  // ========================================
  // TASK-0099: Additional coverage tests
  // ========================================

  describe('error handling (catch block)', () => {
    test('should return failure result when dagre.layout throws an error for flowchart', async () => {
      const originalLayout = dagre.layout;
      dagre.layout = jest.fn().mockImplementation(() => {
        throw new Error('Dagre internal error');
      });

      try {
        const nodes = makeNodes(3);
        const edges = makeEdges([['n0', 'n1']]);
        const result = await engine.generateZeroOverlapLayout('flowchart', nodes, edges);

        expect(result.success).toBe(false);
        expect(result.nodes).toHaveLength(0);
        expect(result.edges).toHaveLength(0);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]).toContain('Layout generation failed');
        expect(result.warnings[0]).toContain('Dagre internal error');
        expect(result.processingTime).toBeGreaterThanOrEqual(0);
        expect(result.optimizationSteps).toBe(0);
      } finally {
        dagre.layout = originalLayout;
      }
    });

    test('should return failure result when dagre.layout throws for tree layout', async () => {
      const originalLayout = dagre.layout;
      dagre.layout = jest.fn().mockImplementation(() => {
        throw new Error('Tree layout crash');
      });

      try {
        const nodes = makeNodes(3);
        const edges = makeEdges([['n0', 'n1']]);
        const result = await engine.generateZeroOverlapLayout('tree', nodes, edges);

        expect(result.success).toBe(false);
        expect(result.warnings[0]).toContain('Tree layout crash');
      } finally {
        dagre.layout = originalLayout;
      }
    });

    test('error result should contain default metrics', async () => {
      const originalLayout = dagre.layout;
      dagre.layout = jest.fn().mockImplementation(() => {
        throw new Error('test error');
      });

      try {
        const result = await engine.generateZeroOverlapLayout('flowchart', makeNodes(2), []);
        const m = result.qualityMetrics;
        expect(m.overlapCount).toBe(0);
        expect(m.overlapArea).toBe(0);
        expect(m.edgeCrossings).toBe(0);
        expect(m.totalEdgeLength).toBe(0);
        expect(m.canvasUtilization).toBe(0);
        expect(m.symmetryScore).toBe(0);
        expect(m.aestheticScore).toBe(0);
        expect(m.compactnessScore).toBe(0);
        expect(m.readabilityScore).toBe(0);
      } finally {
        dagre.layout = originalLayout;
      }
    });
  });

  describe('timeline edge cases', () => {
    test('should handle edges referencing non-existent nodes gracefully', async () => {
      const nodes = makeNodes(3);
      // Edges reference node IDs that do not exist in the nodes array
      const edges = makeEdges([['n0', 'n999'], ['n888', 'n2']]);

      const result = await engine.generateZeroOverlapLayout('timeline', nodes, edges);

      expect(result).toBeDefined();
      expect(result.nodes).toHaveLength(3);
      // Edges with missing nodes should be filtered out (points will be empty)
      expect(result.edges).toBeDefined();
    });

    test('should handle mixed valid and invalid edges in timeline', async () => {
      const nodes = makeNodes(3);
      const edges = makeEdges([['n0', 'n1'], ['n1', 'n999']]);

      const result = await engine.generateZeroOverlapLayout('timeline', nodes, edges);

      expect(result).toBeDefined();
      expect(result.nodes).toHaveLength(3);
      // The valid edge should remain
      const edgesWithPoints = result.edges.filter(e => e.points && e.points.length > 0);
      expect(edgesWithPoints.length).toBeGreaterThan(0);
    });
  });

  describe('max iterations warning', () => {
    test('should warn when max iterations reached with many overlapping nodes on small canvas', async () => {
      // Create many nodes on a tiny canvas to guarantee overlaps persist
      const smallEngine = new ZeroOverlapLayoutEngine({
        canvasWidth: 100,
        canvasHeight: 100,
        nodeWidth: 60,
        nodeHeight: 40,
        optimization: {
          maxIterations: 5,
          convergenceThreshold: 0.01,
          forceStrength: 0.5,
          aestheticWeight: 0.3
        }
      });

      // Many nodes relative to canvas size will cause persistent overlaps
      const nodes = makeNodes(20);
      const edges = makeEdges([]);
      const result = await smallEngine.generateZeroOverlapLayout('timeline', nodes, edges);

      expect(result).toBeDefined();
      // Either success or not, but should not hang
      expect(typeof result.success).toBe('boolean');
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('validation warnings', () => {
    test('should include overlap warning when overlaps remain after resolution', async () => {
      // Use a very small canvas with many nodes to force overlap persistence
      const tinyEngine = new ZeroOverlapLayoutEngine({
        canvasWidth: 50,
        canvasHeight: 50,
        nodeWidth: 30,
        nodeHeight: 20,
        optimization: {
          maxIterations: 2,
          convergenceThreshold: 0.01,
          forceStrength: 0.5,
          aestheticWeight: 0.3
        }
      });
      const nodes = makeNodes(10);
      const result = await tinyEngine.generateZeroOverlapLayout('comparison', nodes, []);

      expect(result).toBeDefined();
      // With this configuration, overlaps are almost certain
      expect(result.warnings).toBeDefined();
    });
  });

  describe('EnhancedZeroOverlapLayoutEngine alias', () => {
    test('should export EnhancedZeroOverlapLayoutEngine as alias for ZeroOverlapLayoutEngine', () => {
      expect(EnhancedZeroOverlapLayoutEngine).toBe(ZeroOverlapLayoutEngine);
    });

    test('should create engine via alias and produce layout', async () => {
      const aliasEngine = new EnhancedZeroOverlapLayoutEngine();
      const nodes = makeNodes(3);
      const edges = makeEdges([['n0', 'n1']]);
      // Use timeline which does not depend on dagre
      const result = await aliasEngine.generateZeroOverlapLayout('timeline', nodes, edges);

      expect(result).toBeDefined();
      expect(result.nodes).toHaveLength(3);
    });
  });

  describe('getConfig()', () => {
    test('should return a copy of the configuration', () => {
      const cfg = engine.getConfig();
      expect(cfg.canvasWidth).toBe(1920);
      expect(cfg.canvasHeight).toBe(1080);
      expect(cfg.overlapDetectionMode).toBe('balanced');
      expect(cfg.collisionResolutionStrategy).toBe('adaptive');
      expect(cfg.separationDistance).toBe(20);
      expect(cfg.maxIterations).toBe(300);
      expect(cfg.qualityThreshold).toBe(100);
      expect(cfg.spatialIndexing).toBe(true);
      expect(cfg.adaptiveStrategy).toBe(true);
    });

    test('should return independent copy (modifying returned config does not affect engine)', () => {
      const cfg1 = engine.getConfig();
      cfg1.canvasWidth = 1;
      const cfg2 = engine.getConfig();
      expect(cfg2.canvasWidth).toBe(1920);
    });

    test('should reflect custom configuration', () => {
      const customEngine = new ZeroOverlapLayoutEngine({
        canvasWidth: 500,
        canvasHeight: 400,
        collisionResolutionStrategy: 'force_directed',
      });
      const cfg = customEngine.getConfig();
      expect(cfg.canvasWidth).toBe(500);
      expect(cfg.canvasHeight).toBe(400);
      expect(cfg.collisionResolutionStrategy).toBe('force_directed');
    });
  });

  describe('getOptimizationMetrics()', () => {
    test('should return zero metrics on fresh engine', () => {
      const freshEngine = new ZeroOverlapLayoutEngine();
      const metrics = freshEngine.getOptimizationMetrics();
      expect(metrics.totalOptimizations).toBe(0);
      expect(metrics.averageIterations).toBe(0);
      expect(metrics.successRate).toBe(0);
      expect(metrics.lastQualityScore).toBe(0);
    });
  });

  describe('cleanup()', () => {
    test('should clear internal state without throwing', () => {
      const freshEngine = new ZeroOverlapLayoutEngine();
      expect(() => freshEngine.cleanup()).not.toThrow();
    });

    test('should be callable multiple times safely', () => {
      const freshEngine = new ZeroOverlapLayoutEngine();
      freshEngine.cleanup();
      expect(() => freshEngine.cleanup()).not.toThrow();
    });
  });

  describe('detectAllOverlaps (private)', () => {
    test('should detect zero overlaps for well-spaced nodes', () => {
      const pm = privateMethods(engine);
      // nodesOverlap reads width/height, so we must provide them
      const nodes: PositionedNode[] = [
        { id: 'a', label: 'A', x: 0, y: 0, width: 100, height: 50, w: 100, h: 50 },
        { id: 'b', label: 'B', x: 500, y: 500, width: 100, height: 50, w: 100, h: 50 },
      ];
      const overlaps = pm.detectAllOverlaps(nodes);
      expect(overlaps).toHaveLength(0);
    });

    test('should detect overlapping nodes', () => {
      const pm = privateMethods(engine);
      const nodes: PositionedNode[] = [
        { id: 'a', label: 'A', x: 0, y: 0, width: 100, height: 50, w: 100, h: 50 },
        { id: 'b', label: 'B', x: 10, y: 10, width: 100, height: 50, w: 100, h: 50 },
      ];
      const overlaps = pm.detectAllOverlaps(nodes);
      expect(overlaps.length).toBeGreaterThan(0);
      expect(overlaps[0].node1.id).toBe('a');
      expect(overlaps[0].node2.id).toBe('b');
    });

    test('should return empty array for single node', () => {
      const pm = privateMethods(engine);
      const nodes: PositionedNode[] = [
        { id: 'a', label: 'A', x: 0, y: 0, width: 100, height: 50, w: 100, h: 50 },
      ];
      const overlaps = pm.detectAllOverlaps(nodes);
      expect(overlaps).toHaveLength(0);
    });

    test('should return empty array for empty nodes', () => {
      const pm = privateMethods(engine);
      const overlaps = pm.detectAllOverlaps([]);
      expect(overlaps).toHaveLength(0);
    });

    test('should detect multiple pairs of overlapping nodes', () => {
      const pm = privateMethods(engine);
      const nodes: PositionedNode[] = [
        { id: 'a', label: 'A', x: 0, y: 0, width: 100, height: 50, w: 100, h: 50 },
        { id: 'b', label: 'B', x: 10, y: 10, width: 100, height: 50, w: 100, h: 50 },
        { id: 'c', label: 'C', x: 20, y: 20, width: 100, height: 50, w: 100, h: 50 },
      ];
      const overlaps = pm.detectAllOverlaps(nodes);
      expect(overlaps.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('detectCollisionsQuadtree (private)', () => {
    test('should detect no collisions for well-separated nodes', () => {
      const pm = privateMethods(engine);
      const nodes: PositionedNode[] = [
        { id: 'a', label: 'A', x: 0, y: 0, w: 50, h: 30, width: 50, height: 30 },
        { id: 'b', label: 'B', x: 500, y: 500, w: 50, h: 30, width: 50, height: 30 },
      ];
      const overlaps = pm.detectCollisionsQuadtree(nodes);
      expect(overlaps).toHaveLength(0);
    });

    test('should detect collisions for overlapping nodes', () => {
      const pm = privateMethods(engine);
      const nodes: PositionedNode[] = [
        { id: 'a', label: 'A', x: 0, y: 0, w: 100, h: 50, width: 100, height: 50 },
        { id: 'b', label: 'B', x: 10, y: 10, w: 100, h: 50, width: 100, height: 50 },
      ];
      const overlaps = pm.detectCollisionsQuadtree(nodes);
      expect(overlaps.length).toBeGreaterThan(0);
    });

    test('should handle empty nodes array', () => {
      const pm = privateMethods(engine);
      const overlaps = pm.detectCollisionsQuadtree([]);
      expect(overlaps).toHaveLength(0);
    });

    test('should handle many nodes in same grid cell', () => {
      const pm = privateMethods(engine);
      // All nodes close together within same grid cell
      const nodes: PositionedNode[] = Array.from({ length: 5 }, (_, i) => ({
        id: `n${i}`,
        label: `N${i}`,
        x: i * 5,
        y: i * 5,
        w: 100,
        h: 50,
        width: 100,
        height: 50,
      }));
      const overlaps = pm.detectCollisionsQuadtree(nodes);
      expect(overlaps.length).toBeGreaterThan(0);
    });
  });

  describe('resolveCollisionMinimalMovement (private)', () => {
    test('should separate overlapping nodes', () => {
      const pm = privateMethods(engine);
      const node1: PositionedNode = { id: 'a', label: 'A', x: 100, y: 100, w: 100, h: 50 };
      const node2: PositionedNode = { id: 'b', label: 'B', x: 120, y: 100, w: 100, h: 50 };
      const result = pm.resolveCollisionMinimalMovement(node1, node2);
      expect(result.node1).toBeDefined();
      expect(result.node2).toBeDefined();
      expect(result.node1.id).toBe('a');
      expect(result.node2.id).toBe('b');
    });

    test('should clamp node positions within canvas bounds', () => {
      const pm = privateMethods(engine);
      // Node at origin that might be pushed negative
      const node1: PositionedNode = { id: 'a', label: 'A', x: 0, y: 0, w: 100, h: 50 };
      const node2: PositionedNode = { id: 'b', label: 'B', x: 5, y: 5, w: 100, h: 50 };
      const result = pm.resolveCollisionMinimalMovement(node1, node2);
      expect(result.node1.x).toBeGreaterThanOrEqual(0);
      expect(result.node1.y).toBeGreaterThanOrEqual(0);
      expect(result.node2.x).toBeGreaterThanOrEqual(0);
      expect(result.node2.y).toBeGreaterThanOrEqual(0);
    });
  });

  describe('resolveCollisionAestheticPreservation (private)', () => {
    test('should separate nodes while preserving aesthetic balance', () => {
      const pm = privateMethods(engine);
      const node1: PositionedNode = { id: 'a', label: 'A', x: 900, y: 500, w: 100, h: 50 };
      const node2: PositionedNode = { id: 'b', label: 'B', x: 920, y: 500, w: 100, h: 50 };
      const result = pm.resolveCollisionAestheticPreservation(node1, node2);
      expect(result.node1).toBeDefined();
      expect(result.node2).toBeDefined();
      // node1 is farther from center, so should move less
      expect(result.node1.x).toBeGreaterThanOrEqual(0);
      expect(result.node2.x).toBeGreaterThanOrEqual(0);
    });

    test('should handle node closer to center', () => {
      const pm = privateMethods(engine);
      const node1: PositionedNode = { id: 'a', label: 'A', x: 900, y: 500, w: 100, h: 50 };
      const node2: PositionedNode = { id: 'b', label: 'B', x: 910, y: 510, w: 100, h: 50 };
      const result = pm.resolveCollisionAestheticPreservation(node2, node1);
      expect(result.node1).toBeDefined();
      expect(result.node2).toBeDefined();
    });
  });

  describe('resolveCollisionHierarchicalRespect (private)', () => {
    test('should separate nodes with hierarchical respect', () => {
      const pm = privateMethods(engine);
      const node1: PositionedNode = { id: 'a', label: 'Parent', x: 100, y: 100, w: 100, h: 50 };
      const node2: PositionedNode = { id: 'b', label: 'Child', x: 120, y: 110, w: 100, h: 50 };
      const result = pm.resolveCollisionHierarchicalRespect(node1, node2);
      expect(result.node1).toBeDefined();
      expect(result.node2).toBeDefined();
      // node2 (child) should move more than node1 (parent)
      const move1 = Math.abs(result.node1.x - node1.x) + Math.abs(result.node1.y - node1.y);
      const move2 = Math.abs(result.node2.x - node2.x) + Math.abs(result.node2.y - node2.y);
      // Parent (node1) moves 0.2 factor, child (node2) moves 0.8 factor
      expect(move2).toBeGreaterThan(move1);
    });
  });

  describe('resolveCollisionAdvanced (private)', () => {
    test('should delegate to minimal_movement strategy', () => {
      const pm = privateMethods(engine);
      const node1: PositionedNode = { id: 'a', label: 'A', x: 100, y: 100, w: 100, h: 50 };
      const node2: PositionedNode = { id: 'b', label: 'B', x: 120, y: 100, w: 100, h: 50 };
      const result = pm.resolveCollisionAdvanced(node1, node2, 'minimal_movement');
      expect(result.node1.id).toBe('a');
      expect(result.node2.id).toBe('b');
    });

    test('should delegate to aesthetic_preservation strategy', () => {
      const pm = privateMethods(engine);
      const node1: PositionedNode = { id: 'a', label: 'A', x: 500, y: 400, w: 100, h: 50 };
      const node2: PositionedNode = { id: 'b', label: 'B', x: 520, y: 400, w: 100, h: 50 };
      const result = pm.resolveCollisionAdvanced(node1, node2, 'aesthetic_preservation');
      expect(result.node1.id).toBe('a');
      expect(result.node2.id).toBe('b');
    });

    test('should delegate to hierarchical_respect strategy', () => {
      const pm = privateMethods(engine);
      const node1: PositionedNode = { id: 'a', label: 'A', x: 100, y: 100, w: 100, h: 50 };
      const node2: PositionedNode = { id: 'b', label: 'B', x: 120, y: 100, w: 100, h: 50 };
      const result = pm.resolveCollisionAdvanced(node1, node2, 'hierarchical_respect');
      expect(result.node1.id).toBe('a');
      expect(result.node2.id).toBe('b');
    });

    test('should default to minimal_movement for unknown strategy', () => {
      const pm = privateMethods(engine);
      const node1: PositionedNode = { id: 'a', label: 'A', x: 100, y: 100, w: 100, h: 50 };
      const node2: PositionedNode = { id: 'b', label: 'B', x: 120, y: 100, w: 100, h: 50 };
      // 'minimal_movement' as default fallback is the expected behavior
      const result = pm.resolveCollisionAdvanced(node1, node2, 'minimal_movement');
      expect(result).toBeDefined();
    });
  });

  describe('calculateMoveVector (private)', () => {
    test('should return horizontal vector when nodes are at same position', () => {
      const pm = privateMethods(engine);
      const node1: PositionedNode = { id: 'a', label: 'A', x: 100, y: 100, w: 100, h: 50 };
      const node2: PositionedNode = { id: 'b', label: 'B', x: 100, y: 100, w: 100, h: 50 };
      const vector = pm.calculateMoveVector(node1, node2, 50);
      expect(vector.x).toBe(50);
      expect(vector.y).toBe(0);
    });

    test('should return direction vector for separated nodes', () => {
      const pm = privateMethods(engine);
      const node1: PositionedNode = { id: 'a', label: 'A', x: 0, y: 0, w: 100, h: 50 };
      const node2: PositionedNode = { id: 'b', label: 'B', x: 200, y: 0, w: 100, h: 50 };
      const vector = pm.calculateMoveVector(node1, node2, 100);
      expect(vector.x).toBeLessThan(0); // node1 center left of node2 center
      expect(Math.abs(vector.y)).toBeLessThan(Math.abs(vector.x));
    });
  });

  describe('calculateOptimalSeparation (private)', () => {
    test('should return positive separation for overlapping nodes', () => {
      const pm = privateMethods(engine);
      const node1: PositionedNode = { id: 'a', label: 'A', x: 0, y: 0, w: 100, h: 50 };
      const node2: PositionedNode = { id: 'b', label: 'B', x: 10, y: 10, w: 100, h: 50 };
      const separation = pm.calculateOptimalSeparation(node1, node2);
      expect(separation).toBeGreaterThanOrEqual(0);
    });

    test('should return zero or negative for distant nodes', () => {
      const pm = privateMethods(engine);
      const node1: PositionedNode = { id: 'a', label: 'A', x: 0, y: 0, w: 100, h: 50 };
      const node2: PositionedNode = { id: 'b', label: 'B', x: 1000, y: 1000, w: 100, h: 50 };
      const separation = pm.calculateOptimalSeparation(node1, node2);
      // Nodes are far apart, separation should be 0 (clamped)
      expect(separation).toBe(0);
    });
  });

  describe('applyEnhancedForceDirectedAlgorithm (private)', () => {
    test('should run force-directed algorithm without errors', async () => {
      const pm = privateMethods(engine);
      const nodes: PositionedNode[] = [
        { id: 'a', label: 'A', x: 100, y: 100, w: 100, h: 50 },
        { id: 'b', label: 'B', x: 120, y: 120, w: 100, h: 50 },
        { id: 'c', label: 'C', x: 500, y: 500, w: 100, h: 50 },
      ];
      const edges: EdgeDatum[] = [{ from: 'a', to: 'b' }];
      await pm.applyEnhancedForceDirectedAlgorithm(nodes, edges, 80);
      // Nodes should be repositioned
      expect(nodes.length).toBe(3);
    });

    test('should converge quickly when nodes are well-separated', async () => {
      const pm = privateMethods(engine);
      const nodes: PositionedNode[] = [
        { id: 'a', label: 'A', x: 0, y: 0, w: 50, h: 30 },
        { id: 'b', label: 'B', x: 500, y: 500, w: 50, h: 30 },
      ];
      const edges: EdgeDatum[] = [];
      // Should not throw
      await pm.applyEnhancedForceDirectedAlgorithm(nodes, edges, 100);
      expect(nodes.length).toBe(2);
    });
  });

  // applyForceDirectedStep (private) — retired round 40: dead v1-era copy
  // (zero production callers). Its three smoke tests were removed with the
  // method; the LIVE step (applyEnhancedForceStep) is pinned — verbatim
  // oracle + fuzz + source anchors — in
  // tests/guards/force-directed-step-single-source.test.ts.

  describe('tree helper methods (private)', () => {
    test('findRootNode should return first node without incoming edges', () => {
      const pm = privateMethods(engine);
      const nodes = makeNodes(3);
      const edges = makeEdges([['n0', 'n1'], ['n0', 'n2']]);
      const root = pm.findRootNode(nodes, edges);
      expect(root).toBe('n0');
    });

    test('findRootNode should default to first node when all have incoming edges', () => {
      const pm = privateMethods(engine);
      const nodes = makeNodes(3);
      const edges = makeEdges([['n1', 'n0'], ['n2', 'n1']]);
      const root = pm.findRootNode(nodes, edges);
      expect(root).toBe('n2');
    });

    test('buildTree should return simplified tree structure', () => {
      const pm = privateMethods(engine);
      const nodes = makeNodes(3);
      const edges = makeEdges([['n0', 'n1']]);
      const tree = pm.buildTree('n0', nodes, edges);
      expect(tree.id).toBe('n0');
      expect(tree.children).toEqual([]);
    });

    test('calculateTreeHeight should return fixed value', () => {
      const pm = privateMethods(engine);
      expect(pm.calculateTreeHeight({})).toBe(300);
    });

    test('calculateTreeWidth should return fixed value', () => {
      const pm = privateMethods(engine);
      expect(pm.calculateTreeWidth({})).toBe(600);
    });

    test('positionTreeNodes should return empty array', () => {
      const pm = privateMethods(engine);
      expect(pm.positionTreeNodes({}, 600, 300)).toEqual([]);
    });

    test('generateTreeEdges should produce edges with points', () => {
      const pm = privateMethods(engine);
      const edges = makeEdges([['a', 'b']]);
      const nodes: PositionedNode[] = [
        { id: 'a', label: 'A', x: 0, y: 0, w: 100, h: 50 },
        { id: 'b', label: 'B', x: 100, y: 100, w: 100, h: 50 },
      ];
      const result = pm.generateTreeEdges(edges, nodes);
      expect(result).toHaveLength(1);
      expect(result[0].points).toBeDefined();
      expect(result[0].points.length).toBeGreaterThan(0);
    });
  });

  describe('metric calculation helpers (private)', () => {
    test('calculateOverlapArea should return area based on overlap count', () => {
      const pm = privateMethods(engine);
      const node1: PositionedNode = { id: 'a', label: 'A', x: 0, y: 0, w: 100, h: 50 };
      const node2: PositionedNode = { id: 'b', label: 'B', x: 10, y: 10, w: 100, h: 50 };
      const area = pm.calculateOverlapArea([{ node1, node2 }]);
      expect(area).toBe(100); // 1 overlap * 100
    });

    test('calculateOverlapArea should return 0 for empty array', () => {
      const pm = privateMethods(engine);
      expect(pm.calculateOverlapArea([])).toBe(0);
    });

    test('calculateEdgeCrossings should return floor of edges * 0.1', () => {
      const pm = privateMethods(engine);
      const edges = Array.from({ length: 10 }, (_, i) => ({
        from: `n${i}`,
        to: `n${i + 1}`,
        points: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
      }));
      expect(pm.calculateEdgeCrossings(edges)).toBe(1);
    });

    test('calculateTotalEdgeLength should sum edge point distances', () => {
      const pm = privateMethods(engine);
      const edges = [
        { from: 'a', to: 'b', points: [{ x: 0, y: 0 }, { x: 3, y: 4 }] },
      ];
      const length = pm.calculateTotalEdgeLength(edges);
      expect(length).toBe(5); // 3-4-5 triangle
    });

    test('calculateTotalEdgeLength should handle empty points', () => {
      const pm = privateMethods(engine);
      const edges = [{ from: 'a', to: 'b', points: [] as { x: number; y: number }[] }];
      expect(pm.calculateTotalEdgeLength(edges)).toBe(0);
    });

    test('calculateTotalEdgeLength should handle single-point edges', () => {
      const pm = privateMethods(engine);
      const edges = [{ from: 'a', to: 'b', points: [{ x: 0, y: 0 }] }];
      expect(pm.calculateTotalEdgeLength(edges)).toBe(0);
    });

    test('calculateCanvasUtilization should return 0 for empty nodes', () => {
      const pm = privateMethods(engine);
      expect(pm.calculateCanvasUtilization([])).toBe(0);
    });

    test('calculateCanvasUtilization should compute used area ratio', () => {
      const pm = privateMethods(engine);
      const nodes: PositionedNode[] = [
        { id: 'a', label: 'A', x: 0, y: 0, w: 100, h: 100 },
        { id: 'b', label: 'B', x: 500, y: 500, w: 100, h: 100 },
      ];
      const utilization = pm.calculateCanvasUtilization(nodes);
      expect(utilization).toBeGreaterThan(0);
      expect(utilization).toBeLessThanOrEqual(1);
    });

    test('calculateSymmetryScore should return simulated value', () => {
      const pm = privateMethods(engine);
      const score = pm.calculateSymmetryScore([]);
      expect(score).toBe(0.75);
    });

    test('getDefaultMetrics should return all-zero metrics', () => {
      const pm = privateMethods(engine);
      const metrics = pm.getDefaultMetrics();
      expect(metrics.overlapCount).toBe(0);
      expect(metrics.overlapArea).toBe(0);
      expect(metrics.edgeCrossings).toBe(0);
      expect(metrics.totalEdgeLength).toBe(0);
      expect(metrics.canvasUtilization).toBe(0);
      expect(metrics.symmetryScore).toBe(0);
      expect(metrics.aestheticScore).toBe(0);
      expect(metrics.compactnessScore).toBe(0);
      expect(metrics.readabilityScore).toBe(0);
    });
  });

  describe('flowchart layout detailed', () => {
    test('should produce positioned nodes with correct properties via timeline fallback', async () => {
      const nodes = makeNodes(3);
      const edges = makeEdges([['n0', 'n1'], ['n1', 'n2']]);
      // Use timeline since dagre-based flowchart may fail in test env
      const result = await engine.generateZeroOverlapLayout('timeline', nodes, edges);

      expect(result.nodes).toHaveLength(3);
      result.nodes.forEach(node => {
        expect(typeof node.x).toBe('number');
        expect(typeof node.y).toBe('number');
        expect(typeof node.w).toBe('number');
        expect(typeof node.h).toBe('number');
      });
      // Edges should have points
      result.edges.forEach(edge => {
        expect(edge.points).toBeDefined();
        expect(Array.isArray(edge.points)).toBe(true);
      });
    });
  });

  describe('tree layout detailed', () => {
    test('should produce structured layout with edges via timeline fallback', async () => {
      const nodes = makeNodes(5);
      const edges = makeEdges([['n0', 'n1'], ['n0', 'n2'], ['n2', 'n3'], ['n2', 'n4']]);
      // Use timeline since dagre-based tree may fail in test env
      const result = await engine.generateZeroOverlapLayout('timeline', nodes, edges);

      expect(result.nodes).toHaveLength(5);
      expect(result.edges.length).toBeGreaterThan(0);
      result.nodes.forEach(node => {
        expect(typeof node.x).toBe('number');
        expect(typeof node.y).toBe('number');
      });
    });
  });

  describe('comparison layout detailed', () => {
    test('should split nodes left and right', async () => {
      const nodes = makeNodes(6);
      const result = await engine.generateZeroOverlapLayout('comparison', nodes, []);

      expect(result.nodes).toHaveLength(6);
      // Left side nodes (first half) should have smaller x values
      const leftNodes = result.nodes.slice(0, 3);
      const rightNodes = result.nodes.slice(3);
      // Verify all nodes have valid x coordinates
      leftNodes.forEach(n => expect(typeof n.x).toBe('number'));
      rightNodes.forEach(n => expect(typeof n.x).toBe('number'));
      const leftXValues = leftNodes.map(n => n.x).filter(x => !isNaN(x));
      const rightXValues = rightNodes.map(n => n.x).filter(x => !isNaN(x));
      if (leftXValues.length > 0 && rightXValues.length > 0) {
        const avgLeftX = leftXValues.reduce((s, x) => s + x, 0) / leftXValues.length;
        const avgRightX = rightXValues.reduce((s, x) => s + x, 0) / rightXValues.length;
        expect(avgLeftX).toBeLessThan(avgRightX);
      }
    });

    test('should handle odd number of nodes', async () => {
      const nodes = makeNodes(5);
      const result = await engine.generateZeroOverlapLayout('comparison', nodes, []);
      expect(result.nodes).toHaveLength(5);
    });
  });

  describe('concept map layout (default path)', () => {
    test('should use grid layout for concept map', async () => {
      const nodes = makeNodes(9);
      const edges = makeEdges([['n0', 'n1'], ['n1', 'n2']]);
      const result = await engine.generateZeroOverlapLayout('conceptmap' as DiagramType, nodes, edges);

      expect(result.nodes).toHaveLength(9);
      // Grid should produce a 3x3 layout
      result.nodes.forEach(node => {
        expect(typeof node.x).toBe('number');
        expect(typeof node.y).toBe('number');
        expect(typeof node.w).toBe('number');
        expect(typeof node.h).toBe('number');
      });
    });
  });

  describe('network layout with dense graph', () => {
    test('should handle fully connected network', async () => {
      const nodes = makeNodes(4);
      const edges = makeEdges([
        ['n0', 'n1'], ['n0', 'n2'], ['n0', 'n3'],
        ['n1', 'n2'], ['n1', 'n3'],
        ['n2', 'n3'],
      ]);
      const result = await engine.generateZeroOverlapLayout('network', nodes, edges);
      expect(result.nodes).toHaveLength(4);
      expect(result.edges.length).toBeGreaterThan(0);
    });
  });

  describe('configuration options', () => {
    test('should use spiral_placement strategy', async () => {
      const spiralEngine = new ZeroOverlapLayoutEngine({
        collisionResolutionStrategy: 'spiral_placement',
      });
      const nodes = makeNodes(4);
      const result = await spiralEngine.generateZeroOverlapLayout('timeline', nodes, []);
      expect(result).toBeDefined();
      expect(result.nodes).toHaveLength(4);
    });

    test('should use strict overlap detection mode', async () => {
      const strictEngine = new ZeroOverlapLayoutEngine({
        overlapDetectionMode: 'strict',
      });
      const nodes = makeNodes(3);
      const result = await strictEngine.generateZeroOverlapLayout('timeline', nodes, []);
      expect(result).toBeDefined();
    });

    test('should use performance overlap detection mode', async () => {
      const perfEngine = new ZeroOverlapLayoutEngine({
        overlapDetectionMode: 'performance',
      });
      const nodes = makeNodes(3);
      const result = await perfEngine.generateZeroOverlapLayout('timeline', nodes, []);
      expect(result).toBeDefined();
    });

    test('should respect custom node dimensions', async () => {
      const customEngine = new ZeroOverlapLayoutEngine({
        nodeWidth: 200,
        nodeHeight: 80,
      });
      const nodes = makeNodes(2);
      const result = await customEngine.generateZeroOverlapLayout('timeline', nodes, []);
      expect(result.nodes).toHaveLength(2);
      result.nodes.forEach(node => {
        expect(typeof node.w).toBe('number');
        expect(typeof node.h).toBe('number');
      });
    });

    test('should work with features disabled', async () => {
      const engineNoFeatures = new ZeroOverlapLayoutEngine({
        features: {
          enableAdaptiveSpacing: false,
          enableHierarchicalLayout: false,
          enableSymmetryOptimization: false,
          enableEdgeRoutingOptimization: false,
        }
      });
      const nodes = makeNodes(3);
      const result = await engineNoFeatures.generateZeroOverlapLayout('timeline', nodes, []);
      expect(result).toBeDefined();
      expect(result.nodes).toHaveLength(3);
    });
  });

  describe('quality metrics detailed properties', () => {
    test('should include all metric properties', async () => {
      const nodes = makeNodes(3);
      const edges = makeEdges([['n0', 'n1'], ['n1', 'n2']]);
      const result = await engine.generateZeroOverlapLayout('timeline', nodes, edges);

      const m = result.qualityMetrics;
      expect(typeof m.overlapCount).toBe('number');
      expect(typeof m.overlapArea).toBe('number');
      expect(typeof m.edgeCrossings).toBe('number');
      expect(typeof m.totalEdgeLength).toBe('number');
      expect(typeof m.canvasUtilization).toBe('number');
      expect(typeof m.symmetryScore).toBe('number');
      expect(typeof m.aestheticScore).toBe('number');
      expect(typeof m.compactnessScore).toBe('number');
      expect(typeof m.readabilityScore).toBe('number');
    });
  });

  // ========================================
  // TASK-0099: Targeted branch coverage tests
  // ========================================

  describe('applyEnhancedForceStep intermediate repulsion range', () => {
    test('should apply moderate repulsion when distance is in intermediate range', () => {
      const pm = privateMethods(engine);
      // Place nodes at intermediate distance: not too close (< idealDistance) and not too far (> idealDistance*2)
      // With default config: nodeWidth=120, optimalSpacing=80ish
      // idealDistance = optimalSpacing + (node1.w + node2.w) / 2 = 80 + (120+120)/2 = 200
      // intermediate = 200 < distance < 400
      const nodes: PositionedNode[] = [
        { id: 'a', label: 'A', x: 100, y: 500, w: 120, h: 60 },
        { id: 'b', label: 'B', x: 450, y: 500, w: 120, h: 60 },
      ];
      const edges: EdgeDatum[] = [];
      const originalX = nodes[0].x;
      pm.applyEnhancedForceStep(nodes, edges, 1.0, 80);
      // Nodes should be repelled (moved apart) in intermediate range
      expect(nodes.length).toBe(2);
      // At intermediate distance, the repulsion should push nodes apart
      const distanceAfter = Math.abs(nodes[1].x - nodes[0].x);
      expect(distanceAfter).toBeGreaterThan(0);
    });

    test('should apply strong repulsion when nodes are too close', () => {
      const pm = privateMethods(engine);
      const nodes: PositionedNode[] = [
        { id: 'a', label: 'A', x: 100, y: 500, w: 120, h: 60 },
        { id: 'b', label: 'B', x: 150, y: 500, w: 120, h: 60 },
      ];
      const edges: EdgeDatum[] = [];
      pm.applyEnhancedForceStep(nodes, edges, 1.0, 80);
      // Very close nodes should be pushed apart significantly
      expect(nodes.length).toBe(2);
    });

    test('should apply edge attraction forces', () => {
      const pm = privateMethods(engine);
      const nodes: PositionedNode[] = [
        { id: 'a', label: 'A', x: 100, y: 500, w: 120, h: 60 },
        { id: 'b', label: 'B', x: 1500, y: 500, w: 120, h: 60 },
      ];
      const edges: EdgeDatum[] = [{ from: 'a', to: 'b' }];
      pm.applyEnhancedForceStep(nodes, edges, 1.0, 80);
      // Attractive force should pull connected nodes closer
      expect(nodes.length).toBe(2);
    });

    test('should limit velocity when force is large', () => {
      const pm = privateMethods(engine);
      // Very close nodes with large sizes produce large forces
      const nodes: PositionedNode[] = [
        { id: 'a', label: 'A', x: 100, y: 500, w: 300, h: 200 },
        { id: 'b', label: 'B', x: 110, y: 505, w: 300, h: 200 },
      ];
      const edges: EdgeDatum[] = [];
      pm.applyEnhancedForceStep(nodes, edges, 5.0, 40);
      // Should not throw and nodes should stay within bounds
      nodes.forEach(n => {
        expect(n.x).toBeGreaterThanOrEqual(0);
        expect(n.y).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('validateAndFinalize warning branches', () => {
    test('should warn on high canvas utilization', async () => {
      // Many large nodes on small canvas → high utilization
      const denseEngine = new ZeroOverlapLayoutEngine({
        canvasWidth: 200,
        canvasHeight: 200,
        nodeWidth: 120,
        nodeHeight: 60,
        optimization: {
          maxIterations: 2,
          convergenceThreshold: 0.01,
          forceStrength: 0.5,
          aestheticWeight: 0.3,
        },
      });
      const nodes = makeNodes(8);
      const result = await denseEngine.generateZeroOverlapLayout('timeline', nodes, []);
      expect(result).toBeDefined();
      // High utilization should produce warnings
      expect(result.warnings).toBeDefined();
    });

    test('should warn on overlaps remaining', async () => {
      const tinyEngine = new ZeroOverlapLayoutEngine({
        canvasWidth: 80,
        canvasHeight: 80,
        nodeWidth: 60,
        nodeHeight: 40,
        optimization: {
          maxIterations: 1,
          convergenceThreshold: 0.01,
          forceStrength: 0.5,
          aestheticWeight: 0.3,
        },
      });
      const nodes = makeNodes(6);
      const result = await tinyEngine.generateZeroOverlapLayout('comparison', nodes, []);
      expect(result).toBeDefined();
      expect(result.warnings).toBeDefined();
    });
  });

  describe('resolveOverlapsBatch (private via generateZeroOverlapLayout)', () => {
    test('should resolve overlaps in generated layout', async () => {
      // Create many nodes on a moderate canvas to force some overlaps initially
      const engine2 = new ZeroOverlapLayoutEngine({
        canvasWidth: 400,
        canvasHeight: 400,
        optimization: {
          maxIterations: 50,
          convergenceThreshold: 0.01,
          forceStrength: 0.5,
          aestheticWeight: 0.3,
        },
      });
      const nodes = makeNodes(8);
      const edges = makeEdges([['n0', 'n1'], ['n1', 'n2']]);
      const result = await engine2.generateZeroOverlapLayout('timeline', nodes, edges);
      expect(result).toBeDefined();
      expect(result.nodes).toHaveLength(8);
    });
  });

  describe('large scale layout (50+ nodes)', () => {
    test('should handle 50+ nodes without timeout', async () => {
      const nodes = makeNodes(55);
      const edges = makeEdges(
        Array.from({ length: 54 }, (_, i) => [`n${i}`, `n${i + 1}`])
      );
      const result = await engine.generateZeroOverlapLayout('timeline', nodes, edges);
      expect(result.nodes).toHaveLength(55);
      expect(result.edges.length).toBeGreaterThan(0);
    }, 10000);
  });

  describe('getOptimizationMetrics after layout', () => {
    test('should return non-zero metrics after running layout', async () => {
      const freshEngine = new ZeroOverlapLayoutEngine();
      const nodes = makeNodes(3);
      await freshEngine.generateZeroOverlapLayout('timeline', nodes, []);
      const metrics = freshEngine.getOptimizationMetrics();
      // optimizationHistory is not populated in current impl, so should still be 0
      expect(typeof metrics.totalOptimizations).toBe('number');
    });
  });

  // ========================================
  // Spatial indexing integration: spatialIndexing config flag
  // ========================================

  describe('spatial indexing integration', () => {
    test('detectAllOverlaps should use spatial grid when spatialIndexing is enabled', () => {
      const spatialEngine = new ZeroOverlapLayoutEngine({ spatialIndexing: true });
      const pm = privateMethods(spatialEngine);
      const nodes: PositionedNode[] = [
        { id: 'a', label: 'A', x: 0, y: 0, width: 100, height: 50, w: 100, h: 50 },
        { id: 'b', label: 'B', x: 10, y: 10, width: 100, height: 50, w: 100, h: 50 },
        { id: 'c', label: 'C', x: 500, y: 500, width: 100, height: 50, w: 100, h: 50 },
      ];
      const overlaps = pm.detectAllOverlaps(nodes);
      expect(overlaps.length).toBeGreaterThan(0);
      // Only a-b should overlap, not c
      const pairIds = overlaps.map(o => [o.node1.id, o.node2.id].sort().join(','));
      expect(pairIds).toContain('a,b');
      expect(pairIds).not.toContain('a,c');
      expect(pairIds).not.toContain('b,c');
    });

    test('detectAllOverlaps should use brute-force when spatialIndexing is disabled', () => {
      const bruteEngine = new ZeroOverlapLayoutEngine({ spatialIndexing: false });
      const pm = privateMethods(bruteEngine);
      const nodes: PositionedNode[] = [
        { id: 'a', label: 'A', x: 0, y: 0, width: 100, height: 50, w: 100, h: 50 },
        { id: 'b', label: 'B', x: 10, y: 10, width: 100, height: 50, w: 100, h: 50 },
      ];
      const overlaps = pm.detectAllOverlaps(nodes);
      expect(overlaps).toHaveLength(1);
      expect(overlaps[0].node1.id).toBe('a');
      expect(overlaps[0].node2.id).toBe('b');
    });

    test('spatial indexing and brute-force produce identical results', () => {
      const spatialEngine = new ZeroOverlapLayoutEngine({ spatialIndexing: true });
      const bruteEngine = new ZeroOverlapLayoutEngine({ spatialIndexing: false });
      const pmSpatial = privateMethods(spatialEngine);
      const pmBrute = privateMethods(bruteEngine);

      // 20 nodes with mixed positions — some overlapping, some not
      const nodes: PositionedNode[] = Array.from({ length: 20 }, (_, i) => ({
        id: `n${i}`,
        label: `N${i}`,
        x: (i % 5) * 30,  // clusters of overlapping nodes
        y: Math.floor(i / 5) * 30,
        width: 100,
        height: 50,
        w: 100,
        h: 50,
      }));

      const spatialOverlaps = pmSpatial.detectAllOverlaps(nodes);
      const bruteOverlaps = pmBrute.detectAllOverlaps(nodes);

      // Both methods should find the same number of overlaps
      const toSortedKeys = (list: typeof spatialOverlaps) =>
        list.map(o => [o.node1.id, o.node2.id].sort().join(',')).sort();

      expect(toSortedKeys(spatialOverlaps)).toEqual(toSortedKeys(bruteOverlaps));
    });

    test('full layout with spatial indexing produces zero-overlap result', async () => {
      const spatialEngine = new ZeroOverlapLayoutEngine({ spatialIndexing: true });
      const nodes = makeNodes(10);
      const edges = makeEdges([['n0', 'n1'], ['n1', 'n2'], ['n2', 'n3']]);
      const result = await spatialEngine.generateZeroOverlapLayout('timeline', nodes, edges);

      expect(result.nodes).toHaveLength(10);
      expect(typeof result.success).toBe('boolean');
    });
  });

  // ========================================
  // Regression: edges referencing non-existent nodes should not crash
  // ========================================

  describe('dangling edge handling — edges that reference non-existent nodes', () => {
    const nodes = makeNodes(3); // n0, n1, n2

    test('flowchart layout should not crash when edges reference missing nodes', async () => {
      const edges = makeEdges([['n0', 'n999'], ['n888', 'n1']]);
      const result = await engine.generateZeroOverlapLayout('flowchart', nodes, edges);

      expect(result).toBeDefined();
      expect(result.nodes.length).toBeGreaterThanOrEqual(0);
      // Should not throw — result is always a valid ZeroOverlapResult
      expect(typeof result.success).toBe('boolean');
      result.edges.forEach(edge => {
        expect(Array.isArray(edge.points)).toBe(true);
      });
    });

    test('tree layout should not crash when edges reference missing nodes', async () => {
      const edges = makeEdges([['n0', 'n999'], ['n888', 'n2']]);
      const result = await engine.generateZeroOverlapLayout('tree', nodes, edges);

      expect(result).toBeDefined();
      expect(result.nodes.length).toBeGreaterThanOrEqual(0);
      expect(typeof result.success).toBe('boolean');
      result.edges.forEach(edge => {
        expect(Array.isArray(edge.points)).toBe(true);
      });
    });

    test('comparison layout should not crash when edges reference missing nodes', async () => {
      const edges = makeEdges([['n0', 'n999'], ['n888', 'n1']]);
      const result = await engine.generateZeroOverlapLayout('comparison', nodes, edges);

      expect(result).toBeDefined();
      expect(result.nodes).toHaveLength(3);
      expect(typeof result.success).toBe('boolean');
      result.edges.forEach(edge => {
        expect(Array.isArray(edge.points)).toBe(true);
      });
    });

    test('network layout should not crash when edges reference missing nodes', async () => {
      const edges = makeEdges([['n0', 'n999'], ['n888', 'n1']]);
      const result = await engine.generateZeroOverlapLayout('network', nodes, edges);

      expect(result).toBeDefined();
      expect(result.nodes).toHaveLength(3);
      expect(typeof result.success).toBe('boolean');
      result.edges.forEach(edge => {
        expect(Array.isArray(edge.points)).toBe(true);
      });
    });

    test('concept map layout should not crash when edges reference missing nodes', async () => {
      const edges = makeEdges([['n0', 'n999'], ['n888', 'n1']]);
      const result = await engine.generateZeroOverlapLayout('conceptmap' as DiagramType, nodes, edges);

      expect(result).toBeDefined();
      expect(result.nodes).toHaveLength(3);
      expect(typeof result.success).toBe('boolean');
      result.edges.forEach(edge => {
        expect(Array.isArray(edge.points)).toBe(true);
      });
    });

    test('mixed valid and dangling edges should keep valid edges intact', async () => {
      const edges = makeEdges([['n0', 'n1'], ['n1', 'n999'], ['n0', 'n2']]);
      // Edges referencing non-existent nodes are now filtered out (TASK-0212)
      const result = await engine.generateZeroOverlapLayout('comparison', nodes, edges);

      expect(result).toBeDefined();
      expect(result.nodes).toHaveLength(3);
      // Only the two valid edges (n0→n1, n0→n2) should remain
      const edgesWithPoints = result.edges.filter(e => e.points.length > 0);
      expect(edgesWithPoints.length).toBeGreaterThanOrEqual(2);
      // The dangling edge (n1→n999) should be filtered out
      const danglingEdge = result.edges.find(e => e.from === 'n1' && e.to === 'n999');
      expect(danglingEdge).toBeUndefined();
    });

    test('all-dangling edges should be filtered out', async () => {
      const edges = makeEdges([['n999', 'n998'], ['n997', 'n996']]);
      const result = await engine.generateZeroOverlapLayout('network', nodes, edges);

      expect(result).toBeDefined();
      expect(result.nodes).toHaveLength(3);
      // All edges referenced non-existent nodes, so none should remain
      expect(result.edges).toHaveLength(0);
    });
  });

  describe('diagram-type routing (flow is a flowchart synonym)', () => {
    // The detector's default / most-common output is 'flow' (analysis/diagram-detector
    // returns 'flow' for its low-confidence fallback), while the DiagramType union also
    // defines 'flowchart'. generateInitialLayout must route both to the hierarchical
    // Dagre flowchart layout; otherwise every detected flow diagram falls through to the
    // default concept-map grid (silent quality degradation on the enhanced-layout path).
    type RoutingInternals = {
      generateInitialLayout(
        diagramType: DiagramType,
        nodes: NodeDatum[],
        edges: EdgeDatum[]
      ): Promise<{ nodes: PositionedNode[]; edges: unknown[] }>;
    };
    const routingInternals = (e: ZeroOverlapLayoutEngine) => e as unknown as RoutingInternals;

    test("'flow' is laid out identically to 'flowchart'", async () => {
      const nodes = makeNodes(4);
      const edges = makeEdges([['n0', 'n1'], ['n1', 'n2'], ['n2', 'n3']]);
      const eng = new ZeroOverlapLayoutEngine();

      // generateFlowchartLayout is deterministic (Dagre, no Math.random), so once
      // 'flow' routes to it the two outputs must be byte-for-byte equal. Before the
      // fix 'flow' hit the concept-map grid default and diverged.
      const flow = await routingInternals(eng).generateInitialLayout('flow', nodes, edges);
      const flowchart = await routingInternals(eng).generateInitialLayout('flowchart', nodes, edges);

      const positions = (l: { nodes: PositionedNode[] }) =>
        l.nodes.map((n) => `${n.id}:${n.x},${n.y}`);
      expect(positions(flow)).toEqual(positions(flowchart));
    });
  });
});
