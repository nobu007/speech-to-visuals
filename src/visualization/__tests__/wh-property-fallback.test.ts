/**
 * Tests for w/h property fallback across visualization modules.
 *
 * PositionedNode has optional width/height/w/h properties. Modules that
 * access these without a fallback produce NaN when properties are missing.
 * This suite verifies the fallback pattern (w ?? width ?? default) works.
 */
import { describe, it, expect } from '@jest/globals';
import { calculateCanvasSize } from '../layout-engine-v2';
import type { PositionedNode, NodeDatum, EdgeDatum } from '@/types/diagram';

describe('w/h property fallback — calculateCanvasSize', () => {
  it('handles nodes with only w/h (no width/height)', () => {
    const nodes: PositionedNode[] = [
      { id: 'a', label: 'A', x: 0, y: 0, w: 100, h: 50 },
      { id: 'b', label: 'B', x: 200, y: 100, w: 120, h: 60 },
    ];
    const canvas = calculateCanvasSize(nodes);
    expect(Number.isFinite(canvas.width)).toBe(true);
    expect(Number.isFinite(canvas.height)).toBe(true);
    expect(canvas.width).toBeGreaterThan(0);
    expect(canvas.height).toBeGreaterThan(0);
  });

  it('handles nodes with only width/height (no w/h)', () => {
    const nodes: PositionedNode[] = [
      { id: 'a', label: 'A', x: 0, y: 0, width: 100, height: 50 },
      { id: 'b', label: 'B', x: 200, y: 100, width: 120, height: 60 },
    ];
    const canvas = calculateCanvasSize(nodes);
    expect(Number.isFinite(canvas.width)).toBe(true);
    expect(Number.isFinite(canvas.height)).toBe(true);
    expect(canvas.width).toBeGreaterThan(0);
    expect(canvas.height).toBeGreaterThan(0);
  });

  it('handles nodes with neither w/h nor width/height without producing NaN', () => {
    const nodes: PositionedNode[] = [
      { id: 'a', label: 'A', x: 0, y: 0 },
      { id: 'b', label: 'B', x: 100, y: 50 },
    ];
    const canvas = calculateCanvasSize(nodes);
    expect(Number.isFinite(canvas.width)).toBe(true);
    expect(Number.isFinite(canvas.height)).toBe(true);
  });
});

describe('w/h property fallback — CycleLayoutStrategy', () => {
  it('lays out nodes that only have w/h without producing NaN', () => {
    const { CycleLayoutStrategy } = require('../strategies/cycle-strategy');
    const strategy = new CycleLayoutStrategy();

    const nodes: NodeDatum[] = [
      { id: 'a', label: 'A', w: 100, h: 50 } as NodeDatum,
      { id: 'b', label: 'B', w: 100, h: 50 } as NodeDatum,
      { id: 'c', label: 'C', w: 100, h: 50 } as NodeDatum,
    ];
    const edges: EdgeDatum[] = [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
      { from: 'c', to: 'a' },
    ];

    const result = strategy.apply(nodes, edges);

    for (const node of result.nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
    }

    // Edges should have finite points
    for (const edge of result.edges) {
      if (edge.points) {
        for (const pt of edge.points) {
          expect(Number.isFinite(pt.x)).toBe(true);
          expect(Number.isFinite(pt.y)).toBe(true);
        }
      }
    }
  });

  it('lays out nodes that have neither width/height nor w/h', () => {
    const { CycleLayoutStrategy } = require('../strategies/cycle-strategy');
    const strategy = new CycleLayoutStrategy();

    const nodes: NodeDatum[] = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C' },
    ];
    const edges: EdgeDatum[] = [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
      { from: 'c', to: 'a' },
    ];

    const result = strategy.apply(nodes, edges);

    for (const node of result.nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
    }
  });
});

describe('w/h property fallback — OverlapResolver', () => {
  it('initializes nodes with w/h fallback for width/height', async () => {
    const { OverlapResolver } = require('../layout/OverlapResolver');
    const resolver = new OverlapResolver();

    const nodes: NodeDatum[] = [
      { id: 'a', label: 'A', w: 100, h: 50 } as NodeDatum,
      { id: 'b', label: 'B', w: 100, h: 50 } as NodeDatum,
    ];
    const edges: EdgeDatum[] = [{ from: 'a', to: 'b' }];

    const config = {
      width: 1920,
      height: 1080,
      nodeWidth: 120,
      nodeHeight: 60,
      marginX: 50,
      marginY: 50,
      rankDirection: 'TB' as const,
      nodeSeparation: 50,
      edgeSeparation: 10,
      rankSeparation: 50,
    };

    const result = await resolver.resolve(nodes, edges, config);

    expect(result.success).toBe(true);
    for (const node of result.layout.nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
    }
  });

  it('does not produce NaN for nodes without any dimension properties', async () => {
    const { OverlapResolver } = require('../layout/OverlapResolver');
    const resolver = new OverlapResolver();

    const nodes: NodeDatum[] = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ];
    const edges: EdgeDatum[] = [{ from: 'a', to: 'b' }];

    const config = {
      width: 1920,
      height: 1080,
      nodeWidth: 120,
      nodeHeight: 60,
      marginX: 50,
      marginY: 50,
      rankDirection: 'TB' as const,
      nodeSeparation: 50,
      edgeSeparation: 10,
      rankSeparation: 50,
    };

    const result = await resolver.resolve(nodes, edges, config);

    for (const node of result.layout.nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
    }
  });
});

describe('w/h property fallback — BaseLayoutStrategy metrics & bounding box', () => {
  it('calculateMetrics produces finite results for w/h-only nodes', () => {
    const { BaseLayoutStrategy } = require('../layout/strategies/LayoutStrategy');

    // Create a minimal concrete subclass to test protected methods
    class TestStrategy extends BaseLayoutStrategy {
      readonly name = 'test';
      readonly canEscapeLocalMinimum = false;

      protected async performLayout(
        nodes: PositionedNode[],
        edges: import('@/types/diagram').LayoutEdge[],
      ) {
        return { nodes, edges };
      }
    }

    const strategy = new TestStrategy();
    const nodes: PositionedNode[] = [
      { id: 'a', label: 'A', x: 0, y: 0, w: 100, h: 50 },
      { id: 'b', label: 'B', x: 200, y: 100, w: 120, h: 60 },
    ];

    const metrics = strategy.calculateMetrics(nodes, []);
    expect(Number.isFinite(metrics.totalArea)).toBe(true);
    expect(metrics.totalArea).toBeGreaterThan(0);
  });

  it('calculateBoundingBox produces finite results for w/h-only nodes', () => {
    const { BaseLayoutStrategy } = require('../layout/strategies/LayoutStrategy');

    class TestStrategy extends BaseLayoutStrategy {
      readonly name = 'test';
      readonly canEscapeLocalMinimum = false;

      protected async performLayout(
        nodes: PositionedNode[],
        edges: import('@/types/diagram').LayoutEdge[],
      ) {
        return { nodes, edges };
      }
    }

    const strategy = new TestStrategy();
    const nodes: PositionedNode[] = [
      { id: 'a', label: 'A', x: 0, y: 0, w: 100, h: 50 },
      { id: 'b', label: 'B', x: 200, y: 100, w: 120, h: 60 },
    ];

    const bbox = strategy.calculateBoundingBox(nodes);
    expect(Number.isFinite(bbox.width)).toBe(true);
    expect(Number.isFinite(bbox.height)).toBe(true);
    expect(bbox.width).toBeGreaterThan(0);
    expect(bbox.height).toBeGreaterThan(0);
  });

  it('calculateMetrics handles nodes with no dimension properties', () => {
    const { BaseLayoutStrategy } = require('../layout/strategies/LayoutStrategy');

    class TestStrategy extends BaseLayoutStrategy {
      readonly name = 'test';
      readonly canEscapeLocalMinimum = false;

      protected async performLayout(
        nodes: PositionedNode[],
        edges: import('@/types/diagram').LayoutEdge[],
      ) {
        return { nodes, edges };
      }
    }

    const strategy = new TestStrategy();
    const nodes: PositionedNode[] = [
      { id: 'a', label: 'A', x: 0, y: 0 },
      { id: 'b', label: 'B', x: 200, y: 100 },
    ];

    const metrics = strategy.calculateMetrics(nodes, []);
    expect(Number.isFinite(metrics.totalArea)).toBe(true);
  });

  it('calculateBoundingBox handles nodes with no dimension properties', () => {
    const { BaseLayoutStrategy } = require('../layout/strategies/LayoutStrategy');

    class TestStrategy extends BaseLayoutStrategy {
      readonly name = 'test';
      readonly canEscapeLocalMinimum = false;

      protected async performLayout(
        nodes: PositionedNode[],
        edges: import('@/types/diagram').LayoutEdge[],
      ) {
        return { nodes, edges };
      }
    }

    const strategy = new TestStrategy();
    const nodes: PositionedNode[] = [
      { id: 'a', label: 'A', x: 0, y: 0 },
      { id: 'b', label: 'B', x: 200, y: 100 },
    ];

    const bbox = strategy.calculateBoundingBox(nodes);
    expect(Number.isFinite(bbox.width)).toBe(true);
    expect(Number.isFinite(bbox.height)).toBe(true);
  });
});

describe('w/h property fallback — nodesOverlap consistency', () => {
  it('detects overlap correctly for nodes with only w/h', () => {
    const { nodesOverlap } = require('../layout-utils');

    const node1: PositionedNode = { id: 'a', label: 'A', x: 0, y: 0, w: 100, h: 50 };
    const node2: PositionedNode = { id: 'b', label: 'B', x: 50, y: 25, w: 100, h: 50 };
    const node3: PositionedNode = { id: 'c', label: 'C', x: 500, y: 500, w: 100, h: 50 };

    expect(nodesOverlap(node1, node2)).toBe(true);
    expect(nodesOverlap(node1, node3)).toBe(false);
  });

  it('detects overlap correctly for nodes with mixed w/h and width/height', () => {
    const { nodesOverlap } = require('../layout-utils');

    const node1: PositionedNode = { id: 'a', label: 'A', x: 0, y: 0, w: 100, h: 50 };
    const node2: PositionedNode = { id: 'b', label: 'B', x: 50, y: 25, width: 100, height: 50 };

    expect(nodesOverlap(node1, node2)).toBe(true);
  });
});

// ---------- Strategy edge-point w/h fallback ----------

describe('w/h property fallback — ComparisonStrategy edges', () => {
  it('produces finite edge points for nodes with only w/h', () => {
    const { ComparisonStrategy } = require('../strategies/comparison-strategy');
    const strategy = new ComparisonStrategy();

    const nodes: NodeDatum[] = [
      { id: 'a', label: 'A', w: 100, h: 50 } as NodeDatum,
      { id: 'b', label: 'B', w: 100, h: 50 } as NodeDatum,
    ];
    const edges: EdgeDatum[] = [
      { from: 'a', to: 'b' },
    ];

    const result = strategy.apply(nodes, edges);
    for (const edge of result.edges) {
      for (const pt of edge.points) {
        expect(Number.isFinite(pt.x)).toBe(true);
        expect(Number.isFinite(pt.y)).toBe(true);
      }
    }
  });

  it('produces finite edge points for nodes without any dimension', () => {
    const { ComparisonStrategy } = require('../strategies/comparison-strategy');
    const strategy = new ComparisonStrategy();

    const nodes: NodeDatum[] = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ];
    const edges: EdgeDatum[] = [{ from: 'a', to: 'b' }];

    const result = strategy.apply(nodes, edges);
    for (const edge of result.edges) {
      for (const pt of edge.points) {
        expect(Number.isFinite(pt.x)).toBe(true);
        expect(Number.isFinite(pt.y)).toBe(true);
      }
    }
  });
});

describe('w/h property fallback — MatrixStrategy edges', () => {
  it('produces finite edge points for nodes with only w/h', () => {
    const { MatrixStrategy } = require('../strategies/matrix-strategy');
    const strategy = new MatrixStrategy();

    const nodes: NodeDatum[] = [
      { id: 'a', label: 'A', w: 100, h: 50 } as NodeDatum,
      { id: 'b', label: 'B', w: 100, h: 50 } as NodeDatum,
    ];
    const edges: EdgeDatum[] = [{ from: 'a', to: 'b' }];

    const result = strategy.apply(nodes, edges);
    for (const edge of result.edges) {
      for (const pt of edge.points) {
        expect(Number.isFinite(pt.x)).toBe(true);
        expect(Number.isFinite(pt.y)).toBe(true);
      }
    }
  });
});

describe('w/h property fallback — GeneralStrategy edges', () => {
  it('produces finite edge points for nodes with only w/h', () => {
    const { GeneralStrategy } = require('../strategies/general-strategy');
    const strategy = new GeneralStrategy();

    const nodes: NodeDatum[] = [
      { id: 'a', label: 'A', w: 100, h: 50 } as NodeDatum,
      { id: 'b', label: 'B', w: 100, h: 50 } as NodeDatum,
    ];
    const edges: EdgeDatum[] = [{ from: 'a', to: 'b' }];

    const result = strategy.apply(nodes, edges);
    for (const edge of result.edges) {
      for (const pt of edge.points) {
        expect(Number.isFinite(pt.x)).toBe(true);
        expect(Number.isFinite(pt.y)).toBe(true);
      }
    }
  });
});

describe('w/h property fallback — TimelineStrategy edges and overlap', () => {
  it('produces finite edge points for nodes with only w/h', () => {
    const { TimelineStrategy } = require('../strategies/timeline-strategy');
    const strategy = new TimelineStrategy();

    const nodes: NodeDatum[] = [
      { id: 'a', label: 'A', w: 100, h: 50 } as NodeDatum,
      { id: 'b', label: 'B', w: 100, h: 50 } as NodeDatum,
    ];
    const edges: EdgeDatum[] = [{ from: 'a', to: 'b' }];

    const result = strategy.apply(nodes, edges);

    // All node positions should be finite
    for (const node of result.nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
    }

    // All edge points should be finite
    for (const edge of result.edges) {
      for (const pt of edge.points) {
        expect(Number.isFinite(pt.x)).toBe(true);
        expect(Number.isFinite(pt.y)).toBe(true);
      }
    }
  });

  it('produces finite edge points for nodes without any dimension', () => {
    const { TimelineStrategy } = require('../strategies/timeline-strategy');
    const strategy = new TimelineStrategy();

    const nodes: NodeDatum[] = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C' },
    ];
    const edges: EdgeDatum[] = [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
    ];

    const result = strategy.apply(nodes, edges);

    for (const node of result.nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
    }
    for (const edge of result.edges) {
      for (const pt of edge.points) {
        expect(Number.isFinite(pt.x)).toBe(true);
        expect(Number.isFinite(pt.y)).toBe(true);
      }
    }
  });

  it('resolves overlaps without NaN for overlapping w/h-only nodes', () => {
    const { TimelineStrategy } = require('../strategies/timeline-strategy');
    const strategy = new TimelineStrategy();

    // Create many nodes to force overlap resolution
    const nodes: NodeDatum[] = Array.from({ length: 8 }, (_, i) =>
      ({ id: `n${i}`, label: `N${i}`, w: 200, h: 80 }) as NodeDatum
    );
    const edges: EdgeDatum[] = nodes.slice(1).map((n, i) => ({
      from: `n${i}`, to: n.id,
    }));

    const result = strategy.apply(nodes, edges);

    // After grid-snap resolution, all positions should still be finite
    for (const node of result.nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
    }
  });
});

// ---------- CanvasCalculator w/h fallback ----------

describe('w/h property fallback — CanvasCalculator', () => {
  it('calculate() produces finite canvas for nodes with only w/h', () => {
    const { CanvasCalculator } = require('../canvas-calculator');
    const calc = new CanvasCalculator();

    const nodes: PositionedNode[] = [
      { id: 'a', label: 'A', x: 0, y: 0, w: 200, h: 100 },
      { id: 'b', label: 'B', x: 300, y: 200, w: 150, h: 80 },
    ];

    const result = calc.calculate(nodes);
    expect(Number.isFinite(result.width)).toBe(true);
    expect(Number.isFinite(result.height)).toBe(true);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

  it('calculate() produces finite canvas for nodes without any dimension', () => {
    const { CanvasCalculator } = require('../canvas-calculator');
    const calc = new CanvasCalculator();

    const nodes: PositionedNode[] = [
      { id: 'a', label: 'A', x: 0, y: 0 },
      { id: 'b', label: 'B', x: 100, y: 50 },
    ];

    const result = calc.calculate(nodes);
    expect(Number.isFinite(result.width)).toBe(true);
    expect(Number.isFinite(result.height)).toBe(true);
  });

  it('center() produces finite positions for w/h-only nodes', () => {
    const { CanvasCalculator } = require('../canvas-calculator');
    const calc = new CanvasCalculator();

    const nodes: PositionedNode[] = [
      { id: 'a', label: 'A', x: 0, y: 0, w: 200, h: 100 },
      { id: 'b', label: 'B', x: 300, y: 200, w: 150, h: 80 },
    ];

    const canvas = calc.calculate(nodes);
    const centered = calc.center(nodes, canvas);

    for (const node of centered) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
    }
  });

  it('center() produces finite positions for nodes without any dimension', () => {
    const { CanvasCalculator } = require('../canvas-calculator');
    const calc = new CanvasCalculator();

    const nodes: PositionedNode[] = [
      { id: 'a', label: 'A', x: 0, y: 0 },
      { id: 'b', label: 'B', x: 100, y: 50 },
    ];

    const canvas = calc.calculate(nodes);
    const centered = calc.center(nodes, canvas);

    for (const node of centered) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
    }
  });
});

// ---------- GridSnapStrategy w/h fallback ----------

describe('w/h property fallback — GridSnapStrategy', () => {
  it('lays out w/h-only nodes without producing NaN', async () => {
    const { GridSnapStrategy } = require('../layout/strategies/GridSnapStrategy');
    const strategy = new GridSnapStrategy();

    const config = {
      width: 1920,
      height: 1080,
      nodeWidth: 120,
      nodeHeight: 60,
      marginX: 50,
      marginY: 50,
      rankDirection: 'TB' as const,
      nodeSeparation: 50,
      edgeSeparation: 10,
      rankSeparation: 50,
    };

    const nodes: PositionedNode[] = [
      { id: 'a', label: 'A', x: 0, y: 0, w: 200, h: 100 } as PositionedNode,
      { id: 'b', label: 'B', x: 0, y: 0, w: 150, h: 80 } as PositionedNode,
      { id: 'c', label: 'C', x: 0, y: 0, w: 100, h: 50 } as PositionedNode,
    ];

    const result = await strategy.performLayout(nodes, [], config);

    for (const node of result.nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
    }
  });

  it('lays out nodes without any dimension without producing NaN', async () => {
    const { GridSnapStrategy } = require('../layout/strategies/GridSnapStrategy');
    const strategy = new GridSnapStrategy();

    const config = {
      width: 1920,
      height: 1080,
      nodeWidth: 120,
      nodeHeight: 60,
      marginX: 50,
      marginY: 50,
      rankDirection: 'TB' as const,
      nodeSeparation: 50,
      edgeSeparation: 10,
      rankSeparation: 50,
    };

    const nodes: PositionedNode[] = [
      { id: 'a', label: 'A', x: 0, y: 0 } as PositionedNode,
      { id: 'b', label: 'B', x: 0, y: 0 } as PositionedNode,
      { id: 'c', label: 'C', x: 0, y: 0 } as PositionedNode,
    ];

    const result = await strategy.performLayout(nodes, [], config);

    for (const node of result.nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
    }
  });
});

// ---------- StrategySelector GridSnapFallbackStrategy w/h fallback ----------

describe('w/h property fallback — GridSnapFallbackStrategy', () => {
  it('positions w/h-only nodes with correct dimensions', async () => {
    const { executeLayout } = require('../strategy-selector');

    const nodes: NodeDatum[] = [
      { id: 'a', label: 'A', w: 150, h: 75 } as NodeDatum,
      { id: 'b', label: 'B', w: 120, h: 60 } as NodeDatum,
    ];
    const edges: EdgeDatum[] = [{ from: 'a', to: 'b' }];

    // Use a diagram type that triggers fallback
    const result = await executeLayout(nodes, edges, 'general');

    for (const node of result.nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
      expect(Number.isFinite(node.w ?? node.width ?? 0)).toBe(true);
      expect(Number.isFinite(node.h ?? node.height ?? 0)).toBe(true);
    }
  });
});
