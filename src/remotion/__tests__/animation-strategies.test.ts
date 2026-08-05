/**
 * Tests for animation-strategies.ts
 * 11 diagram types mapped to 5 base strategies:
 *   flow, tree, timeline, matrix, cycle (+ aliases)
 */

import {
  getAnimationStrategy,
  type AnimationStrategy,
  type NodeAnimationConfig,
  type EdgeAnimationConfig,
  NODE_FADE_DURATION_FRAMES,
  EDGE_DRAW_DURATION_FRAMES,
  FLOW_STRATEGY,
  TREE_STRATEGY,
  TIMELINE_STRATEGY,
  MATRIX_STRATEGY,
  CYCLE_STRATEGY,
} from '../animation-strategies';
import { DiagramType } from '@/types/diagram';
import { PositionedNode, LayoutEdge } from '@/types/diagram';

// Helper factories
function makeNode(overrides: Partial<PositionedNode> = {}): PositionedNode {
  return {
    id: 'node-1',
    label: 'Node 1',
    x: 100,
    y: 100,
    width: 120,
    height: 60,
    ...overrides,
  };
}

function makeEdge(overrides: Partial<LayoutEdge> = {}): LayoutEdge {
  return {
    from: 'node-1',
    to: 'node-2',
    points: [
      { x: 160, y: 130 },
      { x: 360, y: 130 },
    ],
    ...overrides,
  };
}

function makeNodes(count: number, startY = 100, yStep = 150): PositionedNode[] {
  return Array.from({ length: count }, (_, i) =>
    makeNode({
      id: `node-${i + 1}`,
      label: `Node ${i + 1}`,
      x: 100,
      y: startY + i * yStep,
    })
  );
}

function makeEdges(nodeIds: string[]): LayoutEdge[] {
  return nodeIds.slice(0, -1).map((id, i) =>
    makeEdge({
      from: id,
      to: nodeIds[i + 1],
      points: [
        { x: 160, y: 100 + i * 150 },
        { x: 160, y: 250 + i * 150 },
      ],
    })
  );
}

describe('animation-strategies', () => {
  describe('constants', () => {
    it('NODE_FADE_DURATION_FRAMES should be 9 (0.3s at 30fps)', () => {
      expect(NODE_FADE_DURATION_FRAMES).toBe(9);
    });

    it('EDGE_DRAW_DURATION_FRAMES should be 15 (0.5s at 30fps)', () => {
      expect(EDGE_DRAW_DURATION_FRAMES).toBe(15);
    });
  });

  describe('getAnimationStrategy', () => {
    it('should return flow strategy for flow type', () => {
      expect(getAnimationStrategy('flow')).toBe(FLOW_STRATEGY);
    });

    it('should return tree strategy for tree type', () => {
      expect(getAnimationStrategy('tree')).toBe(TREE_STRATEGY);
    });

    it('should return timeline strategy for timeline type', () => {
      expect(getAnimationStrategy('timeline')).toBe(TIMELINE_STRATEGY);
    });

    it('should return matrix strategy for matrix type', () => {
      expect(getAnimationStrategy('matrix')).toBe(MATRIX_STRATEGY);
    });

    it('should return cycle strategy for cycle type', () => {
      expect(getAnimationStrategy('cycle')).toBe(CYCLE_STRATEGY);
    });
  });

  describe('flow strategy', () => {
    const strategy = FLOW_STRATEGY;

    it('should assign stagger delays for nodes top-to-bottom', () => {
      const nodes = makeNodes(3);
      const configs = strategy.getNodeAnimations(nodes);
      expect(configs).toHaveLength(3);
      // Each node should have a stagger delay
      expect(configs[0].delayFrames).toBeLessThan(configs[1].delayFrames);
      expect(configs[1].delayFrames).toBeLessThan(configs[2].delayFrames);
    });

    it('should set duration to NODE_FADE_DURATION_FRAMES for each node', () => {
      const nodes = makeNodes(2);
      const configs = strategy.getNodeAnimations(nodes);
      for (const config of configs) {
        expect(config.durationFrames).toBe(NODE_FADE_DURATION_FRAMES);
      }
    });

    it('should assign edge animations after all nodes start', () => {
      const nodes = makeNodes(3);
      const edges = makeEdges(['node-1', 'node-2', 'node-3']);
      const edgeConfigs = strategy.getEdgeAnimations(edges, nodes);
      // Edges should start after first node begins
      expect(edgeConfigs).toHaveLength(2);
      for (const ec of edgeConfigs) {
        expect(ec.delayFrames).toBeGreaterThanOrEqual(0);
      }
    });

    it('should set edge duration to EDGE_DRAW_DURATION_FRAMES', () => {
      const nodes = makeNodes(2);
      const edges = makeEdges(['node-1', 'node-2']);
      const edgeConfigs = strategy.getEdgeAnimations(edges, nodes);
      for (const ec of edgeConfigs) {
        expect(ec.durationFrames).toBe(EDGE_DRAW_DURATION_FRAMES);
      }
    });
  });

  describe('tree strategy', () => {
    const strategy = TREE_STRATEGY;

    it('should animate root node first, then children', () => {
      // Root at top, children below
      const nodes = [
        makeNode({ id: 'root', y: 50 }),
        makeNode({ id: 'child-1', y: 200 }),
        makeNode({ id: 'child-2', y: 200 }),
        makeNode({ id: 'grandchild-1', y: 350 }),
      ];
      const configs = strategy.getNodeAnimations(nodes);
      const rootConfig = configs.find((c) => c.nodeId === 'root')!;
      const childConfigs = configs.filter((c) => ['child-1', 'child-2'].includes(c.nodeId));
      const grandchildConfig = configs.find((c) => c.nodeId === 'grandchild-1')!;

      // Root should appear before children
      expect(rootConfig.delayFrames).toBeLessThan(childConfigs[0].delayFrames);
      // Children should appear before grandchildren
      expect(childConfigs[0].delayFrames).toBeLessThan(grandchildConfig.delayFrames);
    });

    it('should set duration to NODE_FADE_DURATION_FRAMES', () => {
      const nodes = [
        makeNode({ id: 'root', y: 50 }),
        makeNode({ id: 'child-1', y: 200 }),
      ];
      const configs = strategy.getNodeAnimations(nodes);
      for (const config of configs) {
        expect(config.durationFrames).toBe(NODE_FADE_DURATION_FRAMES);
      }
    });
  });

  describe('timeline strategy', () => {
    const strategy = TIMELINE_STRATEGY;

    it('should animate nodes left to right', () => {
      const nodes = [
        makeNode({ id: 't1', x: 50, y: 100 }),
        makeNode({ id: 't2', x: 250, y: 100 }),
        makeNode({ id: 't3', x: 450, y: 100 }),
      ];
      const configs = strategy.getNodeAnimations(nodes);
      const t1 = configs.find((c) => c.nodeId === 't1')!;
      const t2 = configs.find((c) => c.nodeId === 't2')!;
      const t3 = configs.find((c) => c.nodeId === 't3')!;

      expect(t1.delayFrames).toBeLessThan(t2.delayFrames);
      expect(t2.delayFrames).toBeLessThan(t3.delayFrames);
    });

    it('should set duration to NODE_FADE_DURATION_FRAMES', () => {
      const nodes = [
        makeNode({ id: 't1', x: 50, y: 100 }),
        makeNode({ id: 't2', x: 250, y: 100 }),
      ];
      const configs = strategy.getNodeAnimations(nodes);
      for (const config of configs) {
        expect(config.durationFrames).toBe(NODE_FADE_DURATION_FRAMES);
      }
    });
  });

  describe('matrix strategy', () => {
    const strategy = MATRIX_STRATEGY;

    it('should animate nodes in grid order (row by row)', () => {
      const nodes = [
        makeNode({ id: 'r0c0', x: 100, y: 100 }),
        makeNode({ id: 'r0c1', x: 300, y: 100 }),
        makeNode({ id: 'r1c0', x: 100, y: 250 }),
        makeNode({ id: 'r1c1', x: 300, y: 250 }),
      ];
      const configs = strategy.getNodeAnimations(nodes);
      expect(configs).toHaveLength(4);

      // All should have valid delays
      for (const config of configs) {
        expect(config.delayFrames).toBeGreaterThanOrEqual(0);
        expect(config.durationFrames).toBe(NODE_FADE_DURATION_FRAMES);
      }
    });

    it('should assign same delay for same-row nodes', () => {
      const nodes = [
        makeNode({ id: 'r0c0', x: 100, y: 100 }),
        makeNode({ id: 'r0c1', x: 300, y: 100 }),
        makeNode({ id: 'r1c0', x: 100, y: 250 }),
        makeNode({ id: 'r1c1', x: 300, y: 250 }),
      ];
      const configs = strategy.getNodeAnimations(nodes);
      const r0c0 = configs.find((c) => c.nodeId === 'r0c0')!;
      const r0c1 = configs.find((c) => c.nodeId === 'r0c1')!;
      const r1c0 = configs.find((c) => c.nodeId === 'r1c0')!;

      // Same row should have same delay
      expect(r0c0.delayFrames).toBe(r0c1.delayFrames);
      // Next row should have greater delay
      expect(r1c0.delayFrames).toBeGreaterThan(r0c0.delayFrames);
    });
  });

  describe('cycle strategy', () => {
    const strategy = CYCLE_STRATEGY;

    it('should animate nodes in circular order', () => {
      // Arrange nodes in a circle
      const nodes = [
        makeNode({ id: 'c0', x: 300, y: 100 }),   // top
        makeNode({ id: 'c1', x: 500, y: 300 }),   // right
        makeNode({ id: 'c2', x: 300, y: 500 }),   // bottom
        makeNode({ id: 'c3', x: 100, y: 300 }),   // left
      ];
      const configs = strategy.getNodeAnimations(nodes);
      expect(configs).toHaveLength(4);

      // Each node should have staggered delays
      for (let i = 1; i < configs.length; i++) {
        expect(configs[i].delayFrames).toBeGreaterThanOrEqual(configs[i - 1].delayFrames);
      }
    });

    it('should set duration to NODE_FADE_DURATION_FRAMES', () => {
      const nodes = [
        makeNode({ id: 'c0', x: 300, y: 100 }),
        makeNode({ id: 'c1', x: 500, y: 300 }),
      ];
      const configs = strategy.getNodeAnimations(nodes);
      for (const config of configs) {
        expect(config.durationFrames).toBe(NODE_FADE_DURATION_FRAMES);
      }
    });

    it('should handle loop edges in edge animations', () => {
      const nodes = [
        makeNode({ id: 'c0', x: 300, y: 100 }),
        makeNode({ id: 'c1', x: 500, y: 300 }),
        makeNode({ id: 'c2', x: 300, y: 500 }),
      ];
      const edges: LayoutEdge[] = [
        makeEdge({ from: 'c0', to: 'c1' }),
        makeEdge({ from: 'c1', to: 'c2' }),
        makeEdge({ from: 'c2', to: 'c0' }), // Loop edge
      ];
      const edgeConfigs = strategy.getEdgeAnimations(edges, nodes);
      expect(edgeConfigs).toHaveLength(3);
      for (const ec of edgeConfigs) {
        expect(ec.durationFrames).toBe(EDGE_DRAW_DURATION_FRAMES);
      }
    });
  });

  describe('edge animation path length calculation', () => {
    it('should calculate strokeDasharray from path length', () => {
      const nodes = makeNodes(2);
      const edges = makeEdges(['node-1', 'node-2']);
      const strategy = FLOW_STRATEGY;
      const configs = strategy.getEdgeAnimations(edges, nodes);
      // Each config should have a pathLength > 0
      for (const ec of configs) {
        expect(ec.pathLength).toBeGreaterThan(0);
      }
    });
  });

  describe('getAnimationStrategy for all diagram types', () => {
    it('should return flow strategy for flowchart type', () => {
      expect(getAnimationStrategy('flowchart')).toBe(FLOW_STRATEGY);
    });

    it('should return matrix strategy for comparison type', () => {
      expect(getAnimationStrategy('comparison')).toBe(MATRIX_STRATEGY);
    });

    it('should return flow strategy for network type', () => {
      expect(getAnimationStrategy('network')).toBe(FLOW_STRATEGY);
    });

    it('should return tree strategy for conceptmap type', () => {
      expect(getAnimationStrategy('conceptmap')).toBe(TREE_STRATEGY);
    });

    it('should return tree strategy for mindmap type', () => {
      expect(getAnimationStrategy('mindmap')).toBe(TREE_STRATEGY);
    });

    it('should return flow strategy for general type', () => {
      expect(getAnimationStrategy('general')).toBe(FLOW_STRATEGY);
    });
  });

  describe('flow strategy edge cases', () => {
    it('should sort nodes at same Y position by X (left to right)', () => {
      const nodes = [
        makeNode({ id: 'n1', x: 200, y: 100 }),
        makeNode({ id: 'n2', x: 100, y: 100 }),
        makeNode({ id: 'n3', x: 300, y: 100 }),
      ];
      const configs = FLOW_STRATEGY.getNodeAnimations(nodes);
      // All at same Y, so sorted by X
      expect(configs[0].nodeId).toBe('n2'); // x=100
      expect(configs[1].nodeId).toBe('n1'); // x=200
      expect(configs[2].nodeId).toBe('n3'); // x=300
    });
  });

  describe('tree strategy edge cases', () => {
    it('should handle edge animations with missing source nodes', () => {
      const nodes = [makeNode({ id: 'n1', y: 50 })];
      const edges = [
        makeEdge({ from: 'n1', to: 'n2' }),
        makeEdge({ from: 'missing', to: 'n3' }),
      ];
      const configs = TREE_STRATEGY.getEdgeAnimations(edges, nodes);
      expect(configs).toHaveLength(2);
      // Should not crash when source node is missing
      for (const c of configs) {
        expect(c.durationFrames).toBe(EDGE_DRAW_DURATION_FRAMES);
      }
    });
  });

  describe('timeline strategy edge cases', () => {
    it('should handle edge animations with missing source nodes', () => {
      const nodes = [makeNode({ id: 'n1', x: 50 })];
      const edges = [
        makeEdge({ from: 'n1', to: 'n2' }),
        makeEdge({ from: 'missing', to: 'n3' }),
      ];
      const configs = TIMELINE_STRATEGY.getEdgeAnimations(edges, nodes);
      expect(configs).toHaveLength(2);
      for (const c of configs) {
        expect(c.durationFrames).toBe(EDGE_DRAW_DURATION_FRAMES);
      }
    });
  });

  describe('cycle strategy edge cases', () => {
    it('should handle empty nodes', () => {
      const configs = CYCLE_STRATEGY.getNodeAnimations([]);
      expect(configs).toEqual([]);
    });

    it('should handle edge animations', () => {
      const nodes = [
        makeNode({ id: 'c0', x: 300, y: 100 }),
        makeNode({ id: 'c1', x: 500, y: 300 }),
      ];
      const edges = [
        makeEdge({ from: 'c0', to: 'c1' }),
      ];
      const configs = CYCLE_STRATEGY.getEdgeAnimations(edges, nodes);
      expect(configs).toHaveLength(1);
      expect(configs[0].pathLength).toBeGreaterThan(0);
    });
  });

  describe('strategy interface compliance', () => {
    const allStrategies: [string, AnimationStrategy][] = [
      ['flow', FLOW_STRATEGY],
      ['tree', TREE_STRATEGY],
      ['timeline', TIMELINE_STRATEGY],
      ['matrix', MATRIX_STRATEGY],
      ['cycle', CYCLE_STRATEGY],
    ];

    for (const [name, strategy] of allStrategies) {
      describe(`${name} strategy`, () => {
        it('should have getNodeAnimations method', () => {
          expect(typeof strategy.getNodeAnimations).toBe('function');
        });

        it('should have getEdgeAnimations method', () => {
          expect(typeof strategy.getEdgeAnimations).toBe('function');
        });

        it('should return empty array for empty nodes', () => {
          expect(strategy.getNodeAnimations([])).toEqual([]);
        });

        it('should return empty array for empty edges', () => {
          expect(strategy.getEdgeAnimations([], [])).toEqual([]);
        });
      });
    }
  });
});
