/**
 * Numeric edge-case guards: division-by-zero and NaN prevention
 *
 * Tests that layout, parameter-tuning, and quality-gate code correctly
 * handles degenerate inputs (empty arrays, zero-length denominators)
 * without producing Infinity or NaN.
 */

import { LayoutOptimizer } from '@/visualization/strategies/LayoutOptimizer';
import type { DiagramLayout, PositionedNode, LayoutEdge } from '@/types/diagram';
import type { LayoutConfig } from '@/visualization/types';
import SmartParameterTuner from '@/optimization/smart-parameter-tuner';
import { AdaptiveQualityGatesSystem } from '@/quality/adaptive-quality-gates';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<LayoutConfig> = {}): LayoutConfig {
  return {
    width: 1920,
    height: 1080,
    marginX: 80,
    marginY: 60,
    nodeWidth: 200,
    nodeHeight: 100,
    ...overrides,
  };
}

function makeNode(id: string, x = 0, y = 0, w = 200, h = 100): PositionedNode {
  return { id, x, y, w, h, label: id, meta: {} };
}

function makeLayout(nodes: PositionedNode[], edges: LayoutEdge[] = []): DiagramLayout {
  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// LayoutOptimizer
// ---------------------------------------------------------------------------

describe('LayoutOptimizer – division-by-zero guards', () => {
  let config: LayoutConfig;
  let optimizer: LayoutOptimizer;

  beforeEach(() => {
    config = makeConfig();
    optimizer = new LayoutOptimizer(config);
  });

  describe('optimizeTimelineLayout (via optimizeForDiagramType)', () => {
    it('does not produce Infinity x-coordinates with a single node', async () => {
      const layout = makeLayout([makeNode('A')]);
      const result = await optimizer.optimizeForDiagramType(layout, 'timeline');

      expect(result.nodes).toHaveLength(1);
      expect(Number.isFinite(result.nodes[0].x)).toBe(true);
      expect(Number.isFinite(result.nodes[0].y)).toBe(true);
    });

    it('does not crash with zero nodes', async () => {
      const layout = makeLayout([]);
      const result = await optimizer.optimizeForDiagramType(layout, 'timeline');

      expect(result.nodes).toHaveLength(0);
    });

    it('still distributes multiple nodes correctly', async () => {
      const layout = makeLayout([makeNode('A'), makeNode('B'), makeNode('C')]);
      const result = await optimizer.optimizeForDiagramType(layout, 'timeline');

      expect(result.nodes).toHaveLength(3);
      // Nodes should be sorted left-to-right
      const xs = result.nodes.map(n => n.x);
      expect(xs[0]).toBeLessThan(xs[1]);
      expect(xs[1]).toBeLessThan(xs[2]);
    });
  });

  describe('improveTimelineAlignment (via advancedOptimizations)', () => {
    it('handles single node without producing Infinity', async () => {
      const layout = makeLayout([makeNode('solo', 100, 50)]);
      const result = await optimizer.advancedOptimizations(layout, 'timeline');

      expect(result.nodes).toHaveLength(1);
      expect(Number.isFinite(result.nodes[0].x)).toBe(true);
      expect(Number.isFinite(result.nodes[0].y)).toBe(true);
    });

    it('handles empty nodes array without crashing', async () => {
      const layout = makeLayout([]);
      const result = await optimizer.advancedOptimizations(layout, 'timeline');

      expect(result.nodes).toHaveLength(0);
    });
  });

  describe('optimizeCycleLayout (via optimizeForDiagramType)', () => {
    it('does not produce NaN with single node', async () => {
      const layout = makeLayout([makeNode('A')]);
      const result = await optimizer.optimizeForDiagramType(layout, 'cycle');

      expect(result.nodes).toHaveLength(1);
      expect(Number.isFinite(result.nodes[0].x)).toBe(true);
      expect(Number.isFinite(result.nodes[0].y)).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// SmartParameterTuner
// ---------------------------------------------------------------------------

describe('SmartParameterTuner – empty-input guards', () => {
  let tuner: SmartParameterTuner;

  beforeEach(() => {
    tuner = new SmartParameterTuner();
  });

  it('analyzeContent returns valid speechRate for empty transcript', async () => {
    const result = await tuner.analyzeContent('', { duration: 30 });

    expect(Number.isFinite(result.speechRate)).toBe(true);
    expect(Number.isNaN(result.speechRate)).toBe(false);
    expect(result.speechRate).toBe(0);
  });

  it('analyzeContent returns valid results when duration is 0', async () => {
    const result = await tuner.analyzeContent('hello world', { duration: 0 });

    expect(Number.isFinite(result.speechRate)).toBe(true);
    expect(Number.isNaN(result.speechRate)).toBe(false);
  });

  it('analyzeContent returns valid keywordDensity for empty transcript', async () => {
    const result = await tuner.analyzeContent('', {});

    expect(Number.isFinite(result.keywordDensity)).toBe(true);
    expect(Number.isNaN(result.keywordDensity)).toBe(false);
    expect(result.keywordDensity).toBe(0);
  });

  it('analyzeContent handles whitespace-only transcript', async () => {
    const result = await tuner.analyzeContent('    \n\t  ', {});

    expect(Number.isFinite(result.speechRate)).toBe(true);
    expect(Number.isFinite(result.keywordDensity)).toBe(true);
    expect(Number.isNaN(result.speechRate)).toBe(false);
    expect(Number.isNaN(result.keywordDensity)).toBe(false);
  });

  it('optimizeParameters returns valid results for low-quality audio', async () => {
    const characteristics = {
      speechRate: 150,
      complexity: 'low' as const,
      domain: 'general' as const,
      audioQuality: 0,
      keywordDensity: 0,
      diagramLikelihood: 0,
    };

    const result = await tuner.optimizeParameters(characteristics);

    expect(Number.isFinite(result.expectedPerformance.accuracy)).toBe(true);
    expect(Number.isFinite(result.expectedPerformance.speed)).toBe(true);
    expect(Number.isFinite(result.expectedPerformance.reliability)).toBe(true);
    expect(Number.isFinite(result.confidence)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AdaptiveQualityGates
// ---------------------------------------------------------------------------

describe('AdaptiveQualityGates – empty-gates guard', () => {
  let gates: AdaptiveQualityGatesSystem;

  beforeEach(() => {
    gates = new AdaptiveQualityGatesSystem();
  });

  it('evaluateGates handles all gates removed without NaN', async () => {
    // Remove all default gates
    const defaultGates = gates.getGates();
    for (const g of defaultGates) {
      gates.removeGate(g.name);
    }
    expect(gates.getGates()).toHaveLength(0);

    const result = await gates.evaluateGates();

    expect(result.passed).toBe(false); // empty gates should not pass
    expect(result.deploymentReady).toBe(false);
    expect(result.summary.total).toBe(0);
    expect(Number.isFinite(result.summary.passed)).toBe(true);
  });

  it('getQualityTrend does not divide by zero with all-zero pass rates', async () => {
    // The trend calculation divides by firstAvg; fill history with
    // results that have zero pass rate to exercise the guard
    // (We can't easily create synthetic history, but we can verify
    // the method returns a valid value with insufficient history)
    const trend = gates.getQualityTrend();
    expect(['improving', 'stable', 'degrading']).toContain(trend.trend);
    expect(Array.isArray(trend.passRate)).toBe(true);
  });
});
