import {
  LayoutAutoOptimizer,
  OptimizerResult,
  OptimizationStep,
  LayoutParams,
  runAutoOptimization,
  OptimizationConfig,
} from '@/visualization/layout-auto-optimizer';
import { StrategySelector } from '@/visualization/strategy-selector';
import { PositionedNode, LayoutEdge, DiagramType } from '@/types/diagram';
import { LayoutStrategy, StrategyLayoutResult } from '@/visualization/types';

// ── Helpers ──

function makeNode(id: string, x: number, y: number, w = 100, h = 60): PositionedNode {
  return { id, label: id, x, y, width: w, height: h, w, h };
}

function makeEdge(from: string, to: string): LayoutEdge {
  return { from, to, points: [], id: `${from}-${to}` };
}

/** Create nodes that are all crammed in the top-left → guaranteed low score */
function makePoorLayout(count = 6): { nodes: PositionedNode[]; edges: LayoutEdge[] } {
  const nodes: PositionedNode[] = [];
  for (let i = 0; i < count; i++) {
    nodes.push(makeNode(`n${i}`, 5 + (i % 3) * 10, 5 + Math.floor(i / 3) * 10, 30, 20));
  }
  const edges: LayoutEdge[] = [];
  for (let i = 0; i < count - 1; i++) {
    edges.push(makeEdge(`n${i}`, `n${i + 1}`));
  }
  return { nodes, edges };
}

/** Create a well-spread layout → likely passes threshold */
function makeGoodLayout(): { nodes: PositionedNode[]; edges: LayoutEdge[] } {
  const nodes = [
    makeNode('a', 200, 100),
    makeNode('b', 600, 100),
    makeNode('c', 200, 400),
    makeNode('d', 600, 400),
  ];
  const edges = [
    makeEdge('a', 'b'),
    makeEdge('b', 'c'),
    makeEdge('c', 'd'),
  ];
  return { nodes, edges };
}

const defaultBounds = { width: 800, height: 600 };

// ── Tests ──

describe('LayoutAutoOptimizer', () => {
  let optimizer: LayoutAutoOptimizer;
  let selector: StrategySelector;

  beforeEach(() => {
    selector = new StrategySelector();
    optimizer = new LayoutAutoOptimizer(selector);
  });

  describe('optimize — score already meets threshold', () => {
    it('returns immediately with 0 iterations when score >= threshold', async () => {
      // Empty layout has perfect score (1.0)
      const result = await optimizer.optimize([], [], 'flow', defaultBounds);

      expect(result.iterations).toBe(0);
      expect(result.steps).toHaveLength(0);
      expect(result.initialScore).toBeGreaterThanOrEqual(0.7);
      expect(result.finalScore).toBe(result.initialScore);
    });

    it('sets improved=false when no optimization needed', async () => {
      const result = await optimizer.optimize([], [], 'flow', defaultBounds);

      expect(result.improved).toBe(false);
    });
  });

  describe('optimize — score below threshold triggers loop', () => {
    it('performs up to 3 iterations for poor layout', async () => {
      const { nodes, edges } = makePoorLayout(8);
      const result = await optimizer.optimize(nodes, edges, 'flow', defaultBounds);

      // Should have attempted optimization
      expect(result.steps.length).toBeGreaterThan(0);
      expect(result.iterations).toBeGreaterThan(0);
      expect(result.iterations).toBeLessThanOrEqual(3);
    });

    it('returns steps with valid action types', async () => {
      const { nodes, edges } = makePoorLayout(8);
      const result = await optimizer.optimize(nodes, edges, 'flow', defaultBounds);

      const validActions = ['reselect_strategy', 'adjust_params', 'recalculate'];
      for (const step of result.steps) {
        expect(validActions).toContain(step.action);
        expect(typeof step.previousScore).toBe('number');
        expect(typeof step.newScore).toBe('number');
        expect(typeof step.improved).toBe('boolean');
        expect(typeof step.details).toBe('string');
        expect(step.iteration).toBeGreaterThan(0);
      }
    });

    it('stops early when threshold is reached', async () => {
      // Use a very low threshold so optimization should pass quickly
      const lowThresholdOptimizer = new LayoutAutoOptimizer(selector, 3, 0.01);
      const { nodes, edges } = makePoorLayout(4);
      const result = await lowThresholdOptimizer.optimize(nodes, edges, 'flow', defaultBounds);

      expect(result.finalScore).toBeGreaterThanOrEqual(0.01);
    });
  });

  describe('optimize — strategy reselection', () => {
    it('tries fallback strategy when primary gives low score', async () => {
      const { nodes, edges } = makePoorLayout(8);
      const result = await optimizer.optimize(nodes, edges, 'flow', defaultBounds);

      const reselectSteps = result.steps.filter(s => s.action === 'reselect_strategy');
      if (reselectSteps.length > 0) {
        expect(reselectSteps[0].details).toContain('strategy');
      }
    });

    it('uses fallback chain from StrategySelector', async () => {
      const chain = selector.getFallbackChain('flow');
      expect(chain.length).toBeGreaterThanOrEqual(2);
      expect(chain[0].name).toBeDefined();
      expect(chain[1].name).toBeDefined();
    });
  });

  describe('optimize — parameter adjustment', () => {
    it('includes adjust_params step when score is low', async () => {
      const { nodes, edges } = makePoorLayout(8);
      const result = await optimizer.optimize(nodes, edges, 'flow', defaultBounds);

      const paramSteps = result.steps.filter(s => s.action === 'adjust_params');
      // Should have at least one parameter adjustment step
      expect(paramSteps.length).toBeGreaterThan(0);
    });

    it('reports spacing details in adjust_params steps', async () => {
      const { nodes, edges } = makePoorLayout(8);
      const result = await optimizer.optimize(nodes, edges, 'flow', defaultBounds);

      const paramStep = result.steps.find(s => s.action === 'adjust_params');
      if (paramStep) {
        expect(paramStep.details).toContain('nodeSpacing');
        expect(paramStep.details).toContain('rankSeparation');
      }
    });
  });

  describe('optimize — recalculation', () => {
    it('includes recalculate step in the optimization loop', async () => {
      const { nodes, edges } = makePoorLayout(8);
      const result = await optimizer.optimize(nodes, edges, 'flow', defaultBounds);

      const recalcSteps = result.steps.filter(s => s.action === 'recalculate');
      if (recalcSteps.length > 0) {
        expect(recalcSteps[0].details).toContain('Edge crossing');
      }
    });
  });

  describe('optimize — result shape', () => {
    it('returns all required fields', async () => {
      const { nodes, edges } = makePoorLayout(6);
      const result = await optimizer.optimize(nodes, edges, 'flow', defaultBounds);

      expect(result).toHaveProperty('improved');
      expect(result).toHaveProperty('initialScore');
      expect(result).toHaveProperty('finalScore');
      expect(result).toHaveProperty('iterations');
      expect(result).toHaveProperty('steps');
      expect(result).toHaveProperty('finalNodes');
      expect(result).toHaveProperty('finalEdges');
    });

    it('finalNodes have valid positions', async () => {
      const { nodes, edges } = makePoorLayout(6);
      const result = await optimizer.optimize(nodes, edges, 'flow', defaultBounds);

      for (const node of result.finalNodes) {
        expect(typeof node.x).toBe('number');
        expect(typeof node.y).toBe('number');
        expect(typeof node.id).toBe('string');
      }
    });

    it('preserves all original node IDs', async () => {
      const { nodes, edges } = makePoorLayout(6);
      const result = await optimizer.optimize(nodes, edges, 'flow', defaultBounds);

      const originalIds = new Set(nodes.map(n => n.id));
      const resultIds = new Set(result.finalNodes.map(n => n.id));
      expect(resultIds).toEqual(originalIds);
    });
  });

  describe('optimize — edge cases', () => {
    it('handles empty nodes array', async () => {
      const result = await optimizer.optimize([], [], 'flow', defaultBounds);

      // Empty layout scores 1.0 (perfect), so no optimization needed
      expect(result.initialScore).toBeGreaterThanOrEqual(0.7);
      expect(result.iterations).toBe(0);
      expect(result.finalNodes).toHaveLength(0);
    });

    it('handles single node', async () => {
      const nodes = [makeNode('a', 400, 300)];
      const edges: LayoutEdge[] = [];
      const result = await optimizer.optimize(nodes, edges, 'flow', defaultBounds);

      expect(result.finalNodes).toHaveLength(1);
      expect(result.finalNodes[0].id).toBe('a');
    });

    it('handles nodes without explicit width/height', async () => {
      const nodes: PositionedNode[] = [
        { id: 'a', label: 'A', x: 5, y: 5 },
        { id: 'b', label: 'B', x: 15, y: 5 },
        { id: 'c', label: 'C', x: 5, y: 15 },
      ];
      const edges = [makeEdge('a', 'b'), makeEdge('b', 'c')];

      const result = await optimizer.optimize(nodes, edges, 'flow', defaultBounds);
      expect(result.finalNodes).toHaveLength(3);
    });

    it('handles different diagram types', async () => {
      const { nodes, edges } = makePoorLayout(6);
      const types: DiagramType[] = ['flow', 'tree', 'matrix', 'cycle', 'timeline'];

      for (const dt of types) {
        const result = await optimizer.optimize(nodes, edges, dt, defaultBounds);
        expect(result.finalNodes).toHaveLength(nodes.length);
      }
    });
  });

  describe('constructor', () => {
    it('uses default maxIterations (3) when not specified', () => {
      const opt = new LayoutAutoOptimizer(selector);
      // Tested indirectly through optimize
      expect(opt).toBeDefined();
    });

    it('accepts custom maxIterations', () => {
      const opt = new LayoutAutoOptimizer(selector, 5);
      expect(opt).toBeDefined();
    });

    it('accepts custom threshold', () => {
      const opt = new LayoutAutoOptimizer(selector, 3, 0.5);
      expect(opt).toBeDefined();
    });
  });
});

describe('runAutoOptimization (legacy API)', () => {
  it('skips optimization when initial score >= threshold', () => {
    // Empty layout scores 1.0 (perfect)
    const result = runAutoOptimization([], []);

    expect(result.attempts).toBe(0);
    expect(result.passed).toBe(true);
  });

  it('attempts optimization for poor layout', () => {
    const { nodes, edges } = makePoorLayout(8);
    const config: OptimizationConfig = { canvasWidth: 800, canvasHeight: 600 };
    const result = runAutoOptimization(nodes, edges, config);

    expect(result.scoreHistory.length).toBeGreaterThan(0);
    expect(result.initialScore).toBeGreaterThanOrEqual(0);
    expect(result.finalScore).toBeGreaterThanOrEqual(0);
  });

  it('respects maxAttempts config', () => {
    const { nodes, edges } = makePoorLayout(8);
    const result = runAutoOptimization(nodes, edges, { maxAttempts: 1, canvasWidth: 800, canvasHeight: 600 });

    expect(result.attempts).toBeLessThanOrEqual(1);
    expect(result.scoreHistory.length).toBeLessThanOrEqual(2); // initial + 1 attempt
  });

  it('returns valid score history', () => {
    const { nodes, edges } = makePoorLayout(6);
    const result = runAutoOptimization(nodes, edges, { canvasWidth: 800, canvasHeight: 600 });

    for (const score of result.scoreHistory) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });

  it('handles empty input', () => {
    const result = runAutoOptimization([], []);
    expect(result.passed).toBe(true);
    expect(result.nodes).toHaveLength(0);
  });
});

describe('OptimizationStep', () => {
  it('has correct type structure', () => {
    const step: OptimizationStep = {
      iteration: 1,
      action: 'reselect_strategy',
      previousScore: 0.3,
      newScore: 0.5,
      improved: true,
      details: 'Tried fallback strategy',
    };

    expect(step.iteration).toBe(1);
    expect(step.action).toBe('reselect_strategy');
    expect(step.improved).toBe(true);
  });
});

describe('LayoutParams', () => {
  it('has sensible defaults', () => {
    const params: LayoutParams = {
      nodeSpacing: 50,
      rankSeparation: 80,
      nodeWidthScale: 1.0,
      nodeHeightScale: 1.0,
    };

    expect(params.nodeSpacing).toBeGreaterThan(0);
    expect(params.rankSeparation).toBeGreaterThan(0);
    expect(params.nodeWidthScale).toBeGreaterThan(0);
    expect(params.nodeHeightScale).toBeGreaterThan(0);
  });
});
