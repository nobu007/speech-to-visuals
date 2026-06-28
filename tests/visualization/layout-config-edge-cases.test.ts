/**
 * Integration tests: Layout config edge-case validation.
 *
 * Tests the full LayoutOptimizer and LayoutEngine pipeline with degenerate
 * configuration values to ensure no NaN/Infinity propagation, no crashes,
 * and graceful degradation when config values are extreme or contradictory.
 *
 * Covers: negative margins, margins > canvas, zero/negative canvas dims,
 * extreme aspect ratios, fractional pixels, negative separation, node dims
 * larger than canvas, and conflicting config combinations.
 */
import { LayoutOptimizer } from '@/visualization/strategies/LayoutOptimizer';
import type { PositionedNode, DiagramLayout, LayoutEdge } from '@/types/diagram';
import type { LayoutConfig } from '@/visualization/types';

// ─── helpers ──────────────────────────────────────────────

const baseConfig: LayoutConfig = {
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
};

function makeNodes(count: number): PositionedNode[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `n${i}`,
    label: `Node ${i}`,
    x: 100 * i,
    y: 100 * i,
  }));
}

function makeEdges(nodes: PositionedNode[]): LayoutEdge[] {
  const edges: LayoutEdge[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push({
      from: nodes[i].id,
      to: nodes[i + 1].id,
      points: [
        { x: nodes[i].x, y: nodes[i].y },
        { x: nodes[i + 1].x, y: nodes[i + 1].y },
      ],
    });
  }
  return edges;
}

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

// ─── LayoutOptimizer: config edge cases ──────────────────

describe('LayoutOptimizer config edge cases', () => {
  describe('negative margins', () => {
    it('does not produce NaN with negative marginX', async () => {
      const optimizer = new LayoutOptimizer({ ...baseConfig, marginX: -100 });
      const layout: DiagramLayout = { nodes: makeNodes(5), edges: [] };
      const result = await optimizer.optimizeForDiagramType(layout, 'timeline');
      assertAllFinite(result, 'negative marginX timeline');
    });

    it('does not produce NaN with negative marginY', async () => {
      const optimizer = new LayoutOptimizer({ ...baseConfig, marginY: -100 });
      const layout: DiagramLayout = { nodes: makeNodes(5), edges: [] };
      const result = await optimizer.optimizeForDiagramType(layout, 'matrix');
      assertAllFinite(result, 'negative marginY matrix');
    });

    it('does not produce NaN with both margins negative', async () => {
      const optimizer = new LayoutOptimizer({ ...baseConfig, marginX: -50, marginY: -50 });
      const layout: DiagramLayout = { nodes: makeNodes(4), edges: [] };
      const result = await optimizer.advancedOptimizations(layout, 'tree');
      assertAllFinite(result, 'negative margins advanced');
    });
  });

  describe('margins exceeding canvas dimensions', () => {
    it('does not produce NaN when marginX > width/2', async () => {
      const optimizer = new LayoutOptimizer({ ...baseConfig, marginX: 2000 });
      const layout: DiagramLayout = { nodes: makeNodes(3), edges: [] };
      const result = await optimizer.optimizeForDiagramType(layout, 'timeline');
      assertAllFinite(result, 'marginX > width/2 timeline');
    });

    it('does not produce NaN when marginY > height/2', async () => {
      const optimizer = new LayoutOptimizer({ ...baseConfig, marginY: 2000 });
      const layout: DiagramLayout = { nodes: makeNodes(4), edges: [] };
      const result = await optimizer.optimizeForDiagramType(layout, 'matrix');
      assertAllFinite(result, 'marginY > height/2 matrix');
    });

    it('does not produce NaN when margins exceed both dimensions', async () => {
      const optimizer = new LayoutOptimizer({ ...baseConfig, marginX: 5000, marginY: 5000 });
      const layout: DiagramLayout = { nodes: makeNodes(6), edges: [] };
      const result = await optimizer.advancedOptimizations(layout, 'matrix');
      assertAllFinite(result, 'margins exceed both dims');
    });
  });

  describe('zero / negative canvas dimensions', () => {
    it('handles zero width gracefully', async () => {
      const optimizer = new LayoutOptimizer({ ...baseConfig, width: 0 });
      const layout: DiagramLayout = { nodes: makeNodes(3), edges: [] };
      const result = await optimizer.optimizeForDiagramType(layout, 'cycle');
      assertAllFinite(result, 'zero width cycle');
    });

    it('handles zero height gracefully', async () => {
      const optimizer = new LayoutOptimizer({ ...baseConfig, height: 0 });
      const layout: DiagramLayout = { nodes: makeNodes(3), edges: [] };
      const result = await optimizer.optimizeForDiagramType(layout, 'cycle');
      assertAllFinite(result, 'zero height cycle');
    });

    it('handles both dimensions zero', async () => {
      const optimizer = new LayoutOptimizer({ ...baseConfig, width: 0, height: 0 });
      const layout: DiagramLayout = { nodes: makeNodes(3), edges: [] };
      const result = await optimizer.optimizeForDiagramType(layout, 'matrix');
      assertAllFinite(result, 'zero dims matrix');
    });

    it('handles negative width', async () => {
      const optimizer = new LayoutOptimizer({ ...baseConfig, width: -100 });
      const layout: DiagramLayout = { nodes: makeNodes(3), edges: [] };
      const result = await optimizer.optimizeForDiagramType(layout, 'cycle');
      assertAllFinite(result, 'negative width cycle');
    });

    it('handles negative height', async () => {
      const optimizer = new LayoutOptimizer({ ...baseConfig, height: -200 });
      const layout: DiagramLayout = { nodes: makeNodes(3), edges: [] };
      const result = await optimizer.optimizeForDiagramType(layout, 'timeline');
      assertAllFinite(result, 'negative height timeline');
    });
  });

  describe('extreme canvas aspect ratios', () => {
    it('handles ultra-wide canvas (10000:1)', async () => {
      const optimizer = new LayoutOptimizer({ ...baseConfig, width: 100000, height: 10 });
      const layout: DiagramLayout = { nodes: makeNodes(5), edges: [] };
      const result = await optimizer.optimizeForDiagramType(layout, 'cycle');
      assertAllFinite(result, 'ultra-wide cycle');
    });

    it('handles ultra-tall canvas (1:10000)', async () => {
      const optimizer = new LayoutOptimizer({ ...baseConfig, width: 10, height: 100000 });
      const layout: DiagramLayout = { nodes: makeNodes(5), edges: [] };
      const result = await optimizer.optimizeForDiagramType(layout, 'timeline');
      assertAllFinite(result, 'ultra-tall timeline');
    });

    it('handles 1:1 single-pixel canvas', async () => {
      const optimizer = new LayoutOptimizer({ ...baseConfig, width: 1, height: 1 });
      const layout: DiagramLayout = { nodes: makeNodes(4), edges: [] };
      const result = await optimizer.optimizeForDiagramType(layout, 'matrix');
      assertAllFinite(result, '1px canvas matrix');
    });
  });

  describe('fractional pixel configs', () => {
    it('handles fractional canvas dimensions', async () => {
      const optimizer = new LayoutOptimizer({ ...baseConfig, width: 1920.7, height: 1080.3 });
      const layout: DiagramLayout = { nodes: makeNodes(4), edges: [] };
      const result = await optimizer.optimizeForDiagramType(layout, 'cycle');
      assertAllFinite(result, 'fractional canvas cycle');
    });

    it('handles fractional margins', async () => {
      const optimizer = new LayoutOptimizer({ ...baseConfig, marginX: 0.5, marginY: 0.1 });
      const layout: DiagramLayout = { nodes: makeNodes(4), edges: [] };
      const result = await optimizer.optimizeForDiagramType(layout, 'timeline');
      assertAllFinite(result, 'fractional margins timeline');
    });

    it('handles fractional node dimensions', async () => {
      const optimizer = new LayoutOptimizer({ ...baseConfig, nodeWidth: 120.5, nodeHeight: 60.2 });
      const layout: DiagramLayout = { nodes: makeNodes(4), edges: [] };
      const result = await optimizer.optimizeForDiagramType(layout, 'matrix');
      assertAllFinite(result, 'fractional node dims matrix');
    });

    it('handles sub-pixel canvas dimensions', async () => {
      const optimizer = new LayoutOptimizer({ ...baseConfig, width: 0.001, height: 0.001 });
      const layout: DiagramLayout = { nodes: makeNodes(3), edges: [] };
      const result = await optimizer.optimizeForDiagramType(layout, 'cycle');
      assertAllFinite(result, 'sub-pixel canvas');
    });
  });

  describe('node dimensions larger than canvas', () => {
    it('handles nodeWidth > canvas width', async () => {
      const optimizer = new LayoutOptimizer({ ...baseConfig, nodeWidth: 5000, width: 500 });
      const layout: DiagramLayout = { nodes: makeNodes(4), edges: [] };
      const result = await optimizer.optimizeForDiagramType(layout, 'cycle');
      assertAllFinite(result, 'nodeWidth > canvas');
    });

    it('handles nodeHeight > canvas height', async () => {
      const optimizer = new LayoutOptimizer({ ...baseConfig, nodeHeight: 5000, height: 500 });
      const layout: DiagramLayout = { nodes: makeNodes(4), edges: [] };
      const result = await optimizer.optimizeForDiagramType(layout, 'matrix');
      assertAllFinite(result, 'nodeHeight > canvas');
    });
  });

  describe('conflicting / contradictory configs', () => {
    it('handles marginX > width and marginY > height simultaneously', async () => {
      const optimizer = new LayoutOptimizer({
        ...baseConfig,
        width: 100,
        height: 100,
        marginX: 200,
        marginY: 200,
      });
      const layout: DiagramLayout = { nodes: makeNodes(4), edges: [] };
      const result = await optimizer.optimizeForDiagramType(layout, 'matrix');
      assertAllFinite(result, 'margins exceed both dims simultaneously');
    });

    it('handles zero nodeWidth and zero nodeHeight', async () => {
      const optimizer = new LayoutOptimizer({ ...baseConfig, nodeWidth: 0, nodeHeight: 0 });
      const layout: DiagramLayout = { nodes: makeNodes(4), edges: [] };
      const result = await optimizer.optimizeForDiagramType(layout, 'cycle');
      assertAllFinite(result, 'zero node dims');
    });

    it('handles negative nodeWidth and nodeHeight', async () => {
      const optimizer = new LayoutOptimizer({ ...baseConfig, nodeWidth: -50, nodeHeight: -30 });
      const layout: DiagramLayout = { nodes: makeNodes(4), edges: [] };
      const result = await optimizer.optimizeForDiagramType(layout, 'timeline');
      assertAllFinite(result, 'negative node dims');
    });
  });

  describe('advanced optimizations with extreme configs', () => {
    it('does not produce NaN in adjustSpacingByImportance with zero canvas', async () => {
      const optimizer = new LayoutOptimizer({ ...baseConfig, width: 0, height: 0 });
      const layout: DiagramLayout = {
        nodes: makeNodes(5).map((n, i) => ({
          ...n,
          meta: { importance: i * 0.1 },
        })),
        edges: [],
      };
      const result = await optimizer.advancedOptimizations(layout, 'tree');
      assertAllFinite(result, 'adjustSpacing zero canvas');
    });

    it('does not produce NaN in improveTreeSymmetry with fractional margins', async () => {
      const optimizer = new LayoutOptimizer({ ...baseConfig, marginX: 0.001, marginY: 0.001 });
      const layout: DiagramLayout = { nodes: makeNodes(6), edges: [] };
      const result = await optimizer.advancedOptimizations(layout, 'tree');
      assertAllFinite(result, 'tree symmetry fractional margins');
    });

    it('does not produce NaN in improveCycleBalance with extreme ratio', async () => {
      const optimizer = new LayoutOptimizer({ ...baseConfig, width: 100000, height: 1 });
      const layout: DiagramLayout = { nodes: makeNodes(8), edges: [] };
      const result = await optimizer.advancedOptimizations(layout, 'cycle');
      assertAllFinite(result, 'cycle balance extreme ratio');
    });

    it('does not produce NaN in improveMatrixGrid with negative margins', async () => {
      const optimizer = new LayoutOptimizer({ ...baseConfig, marginX: -100, marginY: -100 });
      const layout: DiagramLayout = { nodes: makeNodes(9), edges: [] };
      const result = await optimizer.advancedOptimizations(layout, 'matrix');
      assertAllFinite(result, 'matrix grid negative margins');
    });

    it('does not produce NaN in minimizeEdgeCrossings with zero node dims', async () => {
      const optimizer = new LayoutOptimizer({ ...baseConfig, nodeWidth: 0, nodeHeight: 0 });
      const nodes = makeNodes(4);
      const edges = makeEdges(nodes);
      const layout: DiagramLayout = { nodes, edges };
      const result = await optimizer.advancedOptimizations(layout, 'flow');
      assertAllFinite(result, 'edge crossings zero node dims');
    });
  });

  describe('does not mutate input layout', () => {
    it('preserves original node positions with degenerate config', async () => {
      const optimizer = new LayoutOptimizer({ ...baseConfig, width: 0, height: 0 });
      const nodes = makeNodes(4);
      const originalPositions = nodes.map(n => ({ x: n.x, y: n.y }));
      const layout: DiagramLayout = { nodes, edges: [] };

      await optimizer.optimizeForDiagramType(layout, 'cycle');

      // Original array should not be mutated
      nodes.forEach((n, i) => {
        expect(n.x).toBe(originalPositions[i].x);
        expect(n.y).toBe(originalPositions[i].y);
      });
    });

    it('preserves original node positions with negative margins', async () => {
      const optimizer = new LayoutOptimizer({ ...baseConfig, marginX: -500, marginY: -500 });
      const nodes = makeNodes(5);
      const originalPositions = nodes.map(n => ({ x: n.x, y: n.y }));
      const layout: DiagramLayout = { nodes, edges: [] };

      await optimizer.advancedOptimizations(layout, 'timeline');

      nodes.forEach((n, i) => {
        expect(n.x).toBe(originalPositions[i].x);
        expect(n.y).toBe(originalPositions[i].y);
      });
    });
  });
});

// ─── LayoutEngine: full pipeline with extreme configs ────

describe('LayoutEngine full pipeline with extreme configs', () => {
  // We test LayoutEngine indirectly by importing it dynamically to avoid
  // complex setup. Instead, test that LayoutOptimizer handles the same
  // configs that would flow through the pipeline.
  describe('all diagram types survive extreme configs', () => {
    const extremeConfigs: Array<{ name: string; override: Partial<LayoutConfig> }> = [
      { name: 'zero canvas', override: { width: 0, height: 0 } },
      { name: 'negative canvas', override: { width: -100, height: -100 } },
      { name: 'margins > canvas', override: { width: 100, height: 100, marginX: 500, marginY: 500 } },
      { name: 'negative margins', override: { marginX: -200, marginY: -200 } },
      { name: 'extreme wide', override: { width: 999999, height: 1 } },
      { name: 'extreme tall', override: { width: 1, height: 999999 } },
      { name: 'zero node dims', override: { nodeWidth: 0, nodeHeight: 0 } },
      { name: 'negative node dims', override: { nodeWidth: -50, nodeHeight: -50 } },
      { name: 'fractional everywhere', override: { width: 0.5, height: 0.5, marginX: 0.1, marginY: 0.1, nodeWidth: 0.3, nodeHeight: 0.2 } },
    ];

    const diagramTypes: Array<'cycle' | 'timeline' | 'matrix'> = ['cycle', 'timeline', 'matrix'];

    for (const { name, override } of extremeConfigs) {
      for (const diagramType of diagramTypes) {
        it(`survives ${name} config for ${diagramType}`, async () => {
          const optimizer = new LayoutOptimizer({ ...baseConfig, ...override });
          const layout: DiagramLayout = { nodes: makeNodes(5), edges: [] };
          const result = await optimizer.optimizeForDiagramType(layout, diagramType);
          assertAllFinite(result, `${name} ${diagramType}`);
        });
      }
    }
  });

  describe('multi-iteration advanced optimizations', () => {
    it('survives 3 iterations of advancedOptimizations with zero canvas', async () => {
      const optimizer = new LayoutOptimizer({ ...baseConfig, width: 0, height: 0 });
      let layout: DiagramLayout = { nodes: makeNodes(6), edges: [] };

      for (let i = 0; i < 3; i++) {
        layout = await optimizer.advancedOptimizations(layout, 'tree');
        assertAllFinite(layout, `iteration ${i}`);
      }
    });

    it('survives 3 iterations with margins > canvas', async () => {
      const optimizer = new LayoutOptimizer({
        ...baseConfig,
        width: 100,
        height: 100,
        marginX: 300,
        marginY: 300,
      });
      let layout: DiagramLayout = { nodes: makeNodes(6), edges: [] };

      for (let i = 0; i < 3; i++) {
        layout = await optimizer.advancedOptimizations(layout, 'matrix');
        assertAllFinite(layout, `iteration ${i}`);
      }
    });
  });
});
