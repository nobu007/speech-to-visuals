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
