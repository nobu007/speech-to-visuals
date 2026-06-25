/**
 * Tests for layout bug fixes:
 * 1. calculateNodeWidth returns NaN when charWidth/padding not provided → defaults added
 * 2. ZeroOverlapLayoutEngine network layout now applies force-directed algorithm (was dead code)
 * 3. LayoutOptimizer.adjustSpacingByImportance scales from centroid, not origin
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { calculateNodeWidth, calculateNodeHeight } from '../layout-utils';
import { ZeroOverlapLayoutEngine } from '../enhanced-zero-overlap-layout';
import { LayoutOptimizer } from '../strategies/LayoutOptimizer';
import type { NodeDatum, EdgeDatum } from '@/types/diagram';
import type { LayoutConfig } from '../types';

function makeNodes(count: number): NodeDatum[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `n${i}`,
    label: `Node ${i}`,
  }));
}

function makeChainEdges(count: number): EdgeDatum[] {
  return Array.from({ length: count - 1 }, (_, i) => ({
    from: `n${i}`,
    to: `n${i + 1}`,
  }));
}

const STANDARD_CONFIG: LayoutConfig = {
  width: 1920,
  height: 1080,
  nodeWidth: 120,
  nodeHeight: 60,
  marginX: 80,
  marginY: 80,
  rankDirection: 'LR',
  nodeSeparation: 40,
  edgeSeparation: 20,
  rankSeparation: 80,
};

describe('calculateNodeWidth — NaN guard for optional config fields', () => {
  it('should return a valid number when charWidth and padding are not provided', () => {
    const node: NodeDatum = { id: 'a', label: 'Hello World' };
    const width = calculateNodeWidth(node, { nodeWidth: 120, nodeHeight: 60 });
    expect(Number.isFinite(width)).toBe(true);
    expect(width).toBeGreaterThanOrEqual(120);
  });

  it('should return a valid number for empty label', () => {
    const node: NodeDatum = { id: 'a', label: '' };
    const width = calculateNodeWidth(node, { nodeWidth: 120, nodeHeight: 60 });
    expect(Number.isFinite(width)).toBe(true);
  });

  it('should return baseWidth for undefined label', () => {
    const node: NodeDatum = { id: 'a', label: undefined as unknown as string };
    const width = calculateNodeWidth(node, { nodeWidth: 100, nodeHeight: 50 });
    expect(Number.isFinite(width)).toBe(true);
    expect(width).toBe(100); // labelLength=0, textWidth=16(padding), min(16, 200)=16, max(100,16)=100
  });

  it('should cap at 2x baseWidth for long labels', () => {
    const node: NodeDatum = { id: 'a', label: 'A'.repeat(100) };
    const width = calculateNodeWidth(node, { nodeWidth: 120, nodeHeight: 60 });
    expect(width).toBe(240); // 120 * 2
  });

  it('should respect explicit charWidth and padding when provided', () => {
    const node: NodeDatum = { id: 'a', label: 'AB' }; // 2 chars
    const width = calculateNodeWidth(node, {
      nodeWidth: 50,
      nodeHeight: 30,
      charWidth: 10,
      padding: 20,
    });
    // textWidth = 2 * 10 + 20 = 40; min(40, 100) = 40; max(50, 40) = 50
    expect(width).toBe(50);
  });
});

describe('ZeroOverlapLayoutEngine — network layout force-directed fix', () => {
  let engine: ZeroOverlapLayoutEngine;

  beforeEach(() => {
    engine = new ZeroOverlapLayoutEngine();
  });

  it('should produce finite (non-NaN) node positions for network layout', async () => {
    const nodes = makeNodes(6);
    const edges: EdgeDatum[] = [
      { from: 'n0', to: 'n1' },
      { from: 'n0', to: 'n2' },
      { from: 'n1', to: 'n3' },
      { from: 'n2', to: 'n4' },
      { from: 'n3', to: 'n5' },
    ];

    const result = await engine.generateZeroOverlapLayout('network', nodes, edges);

    expect(result.nodes).toHaveLength(6);
    result.nodes.forEach(node => {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
      expect(node.w).toBeDefined();
      expect(node.h).toBeDefined();
      expect(Number.isFinite(node.w as number)).toBe(true);
      expect(Number.isFinite(node.h as number)).toBe(true);
    });
  });

  it('should produce finite node positions for all diagram types', async () => {
    const types = ['flowchart', 'tree', 'timeline', 'comparison', 'network'] as const;

    for (const type of types) {
      const nodes = makeNodes(5);
      const edges = makeChainEdges(5);
      const result = await engine.generateZeroOverlapLayout(type, nodes, edges);

      result.nodes.forEach(node => {
        expect(Number.isFinite(node.x)).toBe(true);
        expect(Number.isFinite(node.y)).toBe(true);
        expect(Number.isFinite(node.w as number)).toBe(true);
        expect(Number.isFinite(node.h as number)).toBe(true);
      });
    }
  });

  it('should keep nodes within canvas bounds for network layout', async () => {
    const nodes = makeNodes(8);
    const edges = makeChainEdges(8);

    const result = await engine.generateZeroOverlapLayout('network', nodes, edges);

    result.nodes.forEach(node => {
      const w = node.w ?? 120;
      const h = node.h ?? 60;
      expect(node.x).toBeGreaterThanOrEqual(-5); // small tolerance for rounding
      expect(node.y).toBeGreaterThanOrEqual(-5);
      expect(node.x + w).toBeLessThanOrEqual(1925);
      expect(node.y + h).toBeLessThanOrEqual(1085);
    });
  });

  it('should produce valid edges with at least 2 points each for network', async () => {
    const nodes = makeNodes(4);
    const edges: EdgeDatum[] = [
      { from: 'n0', to: 'n1' },
      { from: 'n1', to: 'n2' },
      { from: 'n2', to: 'n3' },
    ];

    const result = await engine.generateZeroOverlapLayout('network', nodes, edges);

    expect(result.edges).toHaveLength(3);
    result.edges.forEach(edge => {
      expect(edge.points).toBeDefined();
      expect(edge.points.length).toBeGreaterThanOrEqual(2);
      edge.points.forEach(pt => {
        expect(Number.isFinite(pt.x)).toBe(true);
        expect(Number.isFinite(pt.y)).toBe(true);
      });
    });
  });

  it('should handle empty edges for network layout', async () => {
    const nodes = makeNodes(3);
    const edges: EdgeDatum[] = [];

    const result = await engine.generateZeroOverlapLayout('network', nodes, edges);

    expect(result.nodes).toHaveLength(3);
    expect(result.edges).toHaveLength(0);
  });

  it('should handle single-node network', async () => {
    const nodes = makeNodes(1);
    const edges: EdgeDatum[] = [];

    const result = await engine.generateZeroOverlapLayout('network', nodes, edges);

    expect(result.nodes).toHaveLength(1);
    expect(Number.isFinite(result.nodes[0].x)).toBe(true);
    expect(Number.isFinite(result.nodes[0].y)).toBe(true);
  });
});

describe('LayoutOptimizer — adjustSpacingByImportance centroid fix', () => {
  let optimizer: LayoutOptimizer;

  beforeEach(() => {
    optimizer = new LayoutOptimizer(STANDARD_CONFIG);
  });

  it('should scale from centroid, preserving relative center', async () => {
    // Two nodes symmetric around 960
    const layout = {
      nodes: [
        { id: 'a', label: 'A', x: 840, y: 510, w: 120, h: 60, meta: { importance: 0.5 } },
        { id: 'b', label: 'B', x: 960, y: 510, w: 120, h: 60, meta: { importance: 0.5 } },
      ],
      edges: [],
    };

    const origCenterA = layout.nodes[0].x + 60; // 900
    const origCenterB = layout.nodes[1].x + 60; // 1020
    const origMid = (origCenterA + origCenterB) / 2; // 960

    const result = await optimizer.advancedOptimizations(layout, 'general');

    const newCenterA = result.nodes[0].x + 60;
    const newCenterB = result.nodes[1].x + 60;
    const newMid = (newCenterA + newCenterB) / 2;

    // Centroid should stay near original (within tolerance due to downstream adjustments)
    expect(Math.abs(newMid - origMid)).toBeLessThan(100);
  });

  it('should not push all nodes toward origin (the old bug)', async () => {
    // Nodes far from origin — old bug would shrink positions toward (0,0)
    const layout = {
      nodes: [
        { id: 'a', label: 'A', x: 1500, y: 800, w: 120, h: 60, meta: { importance: 0.5 } },
        { id: 'b', label: 'B', x: 1600, y: 800, w: 120, h: 60, meta: { importance: 0.5 } },
      ],
      edges: [],
    };

    const result = await optimizer.advancedOptimizations(layout, 'general');

    // With old bug: x*1.25 would move 1500→1875 (closer to edge) and 1600→2000 (off canvas)
    // With fix: scaling from centroid keeps them near their relative positions
    result.nodes.forEach(node => {
      // Should not be pushed wildly toward origin or off canvas
      expect(node.x).toBeGreaterThan(1000);
    });
  });

  it('should preserve relative order for equal-importance nodes', async () => {
    const layout = {
      nodes: [
        { id: 'left', label: 'L', x: 200, y: 540, w: 120, h: 60, meta: { importance: 0.5 } },
        { id: 'mid', label: 'M', x: 600, y: 540, w: 120, h: 60, meta: { importance: 0.5 } },
        { id: 'right', label: 'R', x: 1000, y: 540, w: 120, h: 60, meta: { importance: 0.5 } },
      ],
      edges: [],
    };

    const result = await optimizer.advancedOptimizations(layout, 'general');

    // Equal importance → same multiplier → relative order preserved
    const sorted = [...result.nodes].sort((a, b) => a.x - b.x);
    expect(sorted[0].id).toBe('left');
    expect(sorted[2].id).toBe('right');
  });

  it('should handle empty node list', async () => {
    const layout = { nodes: [], edges: [] };
    const result = await optimizer.advancedOptimizations(layout, 'general');
    expect(result.nodes).toHaveLength(0);
  });

  it('should handle single node (centroid = node position, no displacement)', async () => {
    const layout = {
      nodes: [
        { id: 'solo', label: 'S', x: 500, y: 500, w: 120, h: 60, meta: { importance: 0.9 } },
      ],
      edges: [],
    };

    const result = await optimizer.advancedOptimizations(layout, 'general');
    expect(result.nodes).toHaveLength(1);
    // Single node IS the centroid → distance from centroid = 0 → stays in place
    expect(Math.abs(result.nodes[0].x - 500)).toBeLessThan(5);
    expect(Math.abs(result.nodes[0].y - 500)).toBeLessThan(5);
  });
});
