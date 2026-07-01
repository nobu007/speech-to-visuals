import {
  describe,
  it,
  expect,
} from '@jest/globals';

import { ProgressiveForceStrategy } from '../layout/strategies/ProgressiveForceStrategy';
import { PositionedNode, LayoutEdge } from '@/types/diagram';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function node(id: string, x: number, y: number): PositionedNode {
  return { id, label: id, x, y, width: 120, height: 60 };
}

function edge(from: string, to: string): LayoutEdge {
  return { id: `${from}-${to}`, from, to, points: [] };
}

const baseConfig = {
  width: 1920,
  height: 1080,
  diagramType: 'network' as const,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProgressiveForceStrategy — spatial repulsion zero-distance guard', () => {
  it('does not produce NaN velocities when two nodes start at identical positions', async () => {
    const strategy = new ProgressiveForceStrategy();
    const nodes = [
      node('a', 100, 100),
      node('b', 100, 100), // exact same position as 'a'
    ];
    const edges: LayoutEdge[] = [];

    const result = await strategy.performLayout(nodes, edges, baseConfig);

    for (const n of result.nodes) {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
    }
  });

  it('separates overlapping nodes after simulation (positions diverge)', async () => {
    const strategy = new ProgressiveForceStrategy();
    const nodes = [
      node('a', 200, 200),
      node('b', 200, 200),
      node('c', 200, 200), // three nodes at same position
    ];
    const edges: LayoutEdge[] = [
      edge('a', 'b'),
      edge('b', 'c'),
    ];

    const result = await strategy.performLayout(nodes, edges, baseConfig);

    // At least two nodes should have separated
    const positions = new Set(result.nodes.map(n => `${n.x.toFixed(1)},${n.y.toFixed(1)}`));
    expect(positions.size).toBeGreaterThan(1);
  });

  it('handles all nodes at origin without NaN', async () => {
    const strategy = new ProgressiveForceStrategy();
    const nodes = [
      node('a', 0, 0),
      node('b', 0, 0),
      node('c', 0, 0),
      node('d', 0, 0),
    ];
    const edges: LayoutEdge[] = [
      edge('a', 'b'),
      edge('b', 'c'),
      edge('c', 'd'),
    ];

    const result = await strategy.performLayout(nodes, edges, baseConfig);

    for (const n of result.nodes) {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
    }
  });
});
