/**
 * Tests: ZeroOverlapLayoutEngine canvas/utilization NaN guards.
 *
 * Validates that calculateCanvasUtilization and the full layout pipeline
 * do not produce NaN/Infinity when canvas dimensions are degenerate
 * (zero, negative, sub-pixel).  Also exercises force-directed code
 * paths with nodes at identical positions.
 */
import {
  ZeroOverlapLayoutEngine,
  type ZeroOverlapConfig,
} from '@/visualization/enhanced-zero-overlap-layout';
import type { NodeDatum, EdgeDatum } from '@stv/core/types/diagram';

// ─── helpers ──────────────────────────────────────────────

function makeNodes(count: number): NodeDatum[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `n${i}`,
    label: `Node ${i}`,
  }));
}

function makeEdges(): EdgeDatum[] {
  return [
    { from: 'n0', to: 'n1' },
    { from: 'n1', to: 'n2' },
  ];
}

function assertFiniteMetrics(
  result: { qualityMetrics: Record<string, number> },
  label = 'metrics',
): void {
  for (const [key, val] of Object.entries(result.qualityMetrics)) {
    expect(Number.isFinite(val)).toBe(true);
    void key; void label;
  }
}

const baseConfig: Partial<ZeroOverlapConfig> = {
  maxIterations: 10, // Keep iterations low for speed
  optimization: {
    maxIterations: 10,
    convergenceThreshold: 0.5,
    forceStrength: 0.5,
    aestheticWeight: 0.3,
  },
};

// ─── Tests ────────────────────────────────────────────────

describe('ZeroOverlapLayoutEngine canvas NaN guards', () => {
  describe('zero canvas dimensions', () => {
    it('does not produce NaN in qualityMetrics with zero canvas', async () => {
      const engine = new ZeroOverlapLayoutEngine({
        ...baseConfig,
        canvasWidth: 0,
        canvasHeight: 0,
      } as ZeroOverlapConfig);
      const result = await engine.generateZeroOverlapLayout(
        'flow',
        makeNodes(3),
        makeEdges(),
      );
      assertFiniteMetrics(result, 'zero canvas');
    });

    it('does not produce NaN with zero width only', async () => {
      const engine = new ZeroOverlapLayoutEngine({
        ...baseConfig,
        canvasWidth: 0,
        canvasHeight: 1080,
      } as ZeroOverlapConfig);
      const result = await engine.generateZeroOverlapLayout(
        'flow',
        makeNodes(3),
        makeEdges(),
      );
      assertFiniteMetrics(result, 'zero width');
    });

    it('does not produce NaN with zero height only', async () => {
      const engine = new ZeroOverlapLayoutEngine({
        ...baseConfig,
        canvasWidth: 1920,
        canvasHeight: 0,
      } as ZeroOverlapConfig);
      const result = await engine.generateZeroOverlapLayout(
        'flow',
        makeNodes(3),
        makeEdges(),
      );
      assertFiniteMetrics(result, 'zero height');
    });
  });

  describe('negative canvas dimensions', () => {
    it('does not produce NaN with negative canvas', async () => {
      const engine = new ZeroOverlapLayoutEngine({
        ...baseConfig,
        canvasWidth: -100,
        canvasHeight: -200,
      } as ZeroOverlapConfig);
      const result = await engine.generateZeroOverlapLayout(
        'flow',
        makeNodes(3),
        makeEdges(),
      );
      assertFiniteMetrics(result, 'negative canvas');
    });
  });

  describe('sub-pixel canvas dimensions', () => {
    it('does not produce NaN with very small canvas', async () => {
      const engine = new ZeroOverlapLayoutEngine({
        ...baseConfig,
        canvasWidth: 0.001,
        canvasHeight: 0.001,
      } as ZeroOverlapConfig);
      const result = await engine.generateZeroOverlapLayout(
        'flow',
        makeNodes(2),
        [{ from: 'n0', to: 'n1' }],
      );
      assertFiniteMetrics(result, 'sub-pixel canvas');
    });
  });

  describe('empty / minimal inputs', () => {
    it('handles empty nodes gracefully', async () => {
      const engine = new ZeroOverlapLayoutEngine(baseConfig as ZeroOverlapConfig);
      const result = await engine.generateZeroOverlapLayout('flow', [], []);
      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(0);
      assertFiniteMetrics(result, 'empty nodes');
    });

    it('handles single node', async () => {
      const engine = new ZeroOverlapLayoutEngine(baseConfig as ZeroOverlapConfig);
      const result = await engine.generateZeroOverlapLayout(
        'flow',
        [{ id: 'only', label: 'Only' }],
        [],
      );
      assertFiniteMetrics(result, 'single node');
    });
  });

  describe('all node coordinates are finite', () => {
    it('produces finite node positions with standard config', async () => {
      const engine = new ZeroOverlapLayoutEngine(baseConfig as ZeroOverlapConfig);
      const result = await engine.generateZeroOverlapLayout(
        'flow',
        makeNodes(5),
        makeEdges(),
      );
      for (const n of result.nodes) {
        expect(Number.isFinite(n.x)).toBe(true);
        expect(Number.isFinite(n.y)).toBe(true);
      }
    });

    it('produces finite node positions with zero canvas', async () => {
      const engine = new ZeroOverlapLayoutEngine({
        ...baseConfig,
        canvasWidth: 0,
        canvasHeight: 0,
      } as ZeroOverlapConfig);
      const result = await engine.generateZeroOverlapLayout(
        'flow',
        makeNodes(3),
        [{ from: 'n0', to: 'n1' }],
      );
      for (const n of result.nodes) {
        expect(Number.isFinite(n.x)).toBe(true);
        expect(Number.isFinite(n.y)).toBe(true);
      }
    });
  });
});
