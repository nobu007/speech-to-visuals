/**
 * Integration test: StrategySelector end-to-end dispatch wiring
 *
 * Verifies that every diagram type registered in registerDefaults() dispatches
 * to the correct LayoutStrategy and produces valid, overlap-free layouts through
 * the full executeLayout pipeline.
 */
import { DiagramType, NodeDatum, EdgeDatum, SceneGraph } from '@/types/diagram';
import { StrategySelector, executeLayout } from '@/visualization/strategy-selector';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** All diagram types that registerDefaults() is expected to register. */
const ALL_REGISTERED_TYPES: DiagramType[] = [
  'flow', 'tree', 'timeline', 'matrix', 'cycle',
  'mindmap', 'network', 'conceptmap', 'flowchart', 'comparison', 'general',
];

/** Expected strategy name for each diagram type (matches class → readonly name). */
const EXPECTED_STRATEGY_NAME: Record<DiagramType, string> = {
  flow: 'flow',
  tree: 'tree',
  timeline: 'timeline',
  matrix: 'matrix',
  cycle: 'cycle',
  mindmap: 'mindmap',
  network: 'network',
  conceptmap: 'conceptmap',
  flowchart: 'flowchart',
  comparison: 'comparison',
  general: 'general',
};

/** Build topology-appropriate nodes + edges for a given diagram type. */
function makeSceneData(
  type: DiagramType,
  nodeCount: number,
): { nodes: NodeDatum[]; edges: EdgeDatum[] } {
  const nodes: NodeDatum[] = Array.from({ length: nodeCount }, (_, i) => ({
    id: `n${i}`,
    label: `Node ${i}`,
  }));

  const edges: EdgeDatum[] = [];

  switch (type) {
    case 'mindmap': {
      // Radial: root → branches
      for (let i = 1; i < nodeCount; i++) {
        edges.push({ from: 'n0', to: `n${i}` });
      }
      break;
    }
    case 'comparison': {
      // Two groups: even → "left", odd → "right"
      const mid = Math.ceil(nodeCount / 2);
      for (let i = 0; i < mid - 1; i++) edges.push({ from: `n${i}`, to: `n${i + 1}` });
      for (let i = mid; i < nodeCount - 1; i++) edges.push({ from: `n${i}`, to: `n${i + 1}` });
      if (mid > 0 && mid < nodeCount) edges.push({ from: 'n0', to: `n${mid}` });
      break;
    }
    case 'network': {
      // Fully connected mesh
      for (let i = 0; i < nodeCount; i++) {
        for (let j = i + 1; j < nodeCount; j++) {
          edges.push({ from: `n${i}`, to: `n${j}` });
        }
      }
      break;
    }
    case 'conceptmap': {
      // Hierarchical with cross-links
      for (let i = 0; i < nodeCount - 1; i++) {
        edges.push({ from: `n${i}`, to: `n${i + 1}` });
      }
      if (nodeCount > 3) {
        edges.push({ from: 'n0', to: `n${nodeCount - 1}` });
      }
      break;
    }
    default: {
      // Linear chain (works for flow, tree, timeline, matrix, cycle, flowchart, general)
      for (let i = 0; i < nodeCount - 1; i++) {
        edges.push({ from: `n${i}`, to: `n${i + 1}` });
      }
      if (type === 'cycle' && nodeCount > 2) {
        edges.push({ from: `n${nodeCount - 1}`, to: 'n0' });
      }
      break;
    }
  }

  return { nodes, edges };
}

/** Build a minimal SceneGraph for a given diagram type. */
function makeSceneGraph(type: DiagramType, nodeCount: number): SceneGraph {
  const { nodes, edges } = makeSceneData(type, nodeCount);
  return {
    type,
    nodes,
    edges,
    startMs: 0,
    durationMs: 5000,
    summary: `Test scene for ${type}`,
    keyphrases: ['test'],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StrategySelector integration — end-to-end dispatch wiring', () => {
  let selector: StrategySelector;

  beforeEach(() => {
    selector = new StrategySelector();
  });

  // ---- 1. Registry completeness ----

  describe('Registry completeness', () => {
    it('should register exactly 11 strategies', () => {
      const registry = selector.getRegistry();
      expect(registry.getAllStrategies().size).toBe(11);
    });

    for (const type of ALL_REGISTERED_TYPES) {
      it(`should have strategy registered for "${type}"`, () => {
        expect(selector.getRegistry().hasStrategy(type)).toBe(true);
      });
    }
  });

  // ---- 2. Dispatch correctness ----

  describe('Dispatch correctness — strategy name per type', () => {
    for (const type of ALL_REGISTERED_TYPES) {
      it(`should dispatch "${type}" to strategy "${EXPECTED_STRATEGY_NAME[type]}"`, () => {
        const strategy = selector.select(type);
        expect(strategy.name).toBe(EXPECTED_STRATEGY_NAME[type]);
      });
    }
  });

  // ---- 3. executeLayout pipeline for every registered type ----

  describe('executeLayout pipeline — all registered types', () => {
    for (const type of ALL_REGISTERED_TYPES) {
      it(`should produce valid zero-overlap layout for "${type}"`, async () => {
        const { nodes, edges } = makeSceneData(type, 6);
        const result = await executeLayout(nodes, edges, type);

        // Every input node is positioned
        expect(result.nodes).toHaveLength(6);
        for (const node of result.nodes) {
          expect(typeof node.x).toBe('number');
          expect(typeof node.y).toBe('number');
          expect(Number.isFinite(node.x)).toBe(true);
          expect(Number.isFinite(node.y)).toBe(true);
        }

        // Canvas is non-degenerate
        expect(result.canvas.width).toBeGreaterThan(0);
        expect(result.canvas.height).toBeGreaterThan(0);

        // Zero overlaps after resolution
        expect(result.metrics.overlapCount).toBe(0);
      });
    }
  });

  // ---- 4. SceneGraph-driven end-to-end ----

  describe('SceneGraph-driven end-to-end', () => {
    for (const type of ALL_REGISTERED_TYPES) {
      it(`should lay out SceneGraph with type="${type}"`, async () => {
        const sg = makeSceneGraph(type, 8);
        const result = await executeLayout(sg.nodes, sg.edges, sg.type);

        expect(result.nodes).toHaveLength(sg.nodes.length);
        expect(result.metrics.overlapCount).toBe(0);

        // All positioned nodes have valid (finite) coordinates
        for (const node of result.nodes) {
          expect(Number.isFinite(node.x)).toBe(true);
          expect(Number.isFinite(node.y)).toBe(true);
        }
      });
    }
  });

  // ---- 5. Edge cases ----

  describe('Edge cases', () => {
    for (const type of ALL_REGISTERED_TYPES) {
      it(`should handle empty input for "${type}"`, async () => {
        const result = await executeLayout([], [], type);
        expect(result.nodes).toHaveLength(0);
        expect(result.metrics.overlapCount).toBe(0);
      });

      it(`should handle single node for "${type}"`, async () => {
        const result = await executeLayout(
          [{ id: 'only', label: 'Only' }],
          [],
          type,
        );
        expect(result.nodes).toHaveLength(1);
        expect(result.metrics.overlapCount).toBe(0);
      });
    }
  });

  // ---- 6. Fallback behavior ----

  describe('Fallback behavior', () => {
    it('should return grid-snap-fallback for unknown type via select()', () => {
      // Use type assertion to pass an unregistered string
      const strategy = selector.select('unknown-foo' as DiagramType);
      expect(strategy.name).toBe('grid-snap-fallback');
    });
  });

  // ---- 7. Complexity estimation for all types ----

  describe('Complexity estimation', () => {
    for (const type of ALL_REGISTERED_TYPES) {
      it(`should return positive complexity for "${type}"`, () => {
        const c = selector.estimateComplexity(type, 10);
        expect(typeof c).toBe('number');
        expect(c).toBeGreaterThan(0);
      });
    }
  });
});
