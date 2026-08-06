/**
 * Dangling-edge hardening for the dagre-based layout strategies.
 *
 * Recurring bug class (commit f178cbf hardened the enhanced-zero-overlap
 * flowchart/tree path): feeding edges whose endpoints are not in the input
 * node set to dagre makes dagre AUTO-CREATE phantom nodes for those endpoints.
 * That corrupts the layout and emits edges pointing at non-existent nodes.
 *
 * This file pins the same hardening for the strategy-selector strategies that
 * are registered for real diagram types ('flow' → FlowStrategy, 'tree' →
 * TreeStrategy, 'flowchart' → FlowchartStrategy) and reached via
 * executeLayout() / layout-auto-optimizer (production path).
 */

import { describe, it, expect } from '@jest/globals';
import type { LayoutStrategy } from '@/visualization/types';

interface StrategyCtor {
  new (): LayoutStrategy;
  readonly name: string;
}

const { FlowStrategy } = await import('@/visualization/strategies/flow-strategy');
const { TreeStrategy } = await import('@/visualization/strategies/tree-strategy');
const { FlowchartStrategy } = await import('@/visualization/strategies/flowchart-strategy');

const FlowStrategyCtor = FlowStrategy as unknown as StrategyCtor;
const TreeStrategyCtor = TreeStrategy as unknown as StrategyCtor;
const FlowchartStrategyCtor = FlowchartStrategy as unknown as StrategyCtor;

const NODES = [
  { id: 'a', label: 'A' },
  { id: 'b', label: 'B' },
  { id: 'c', label: 'C' },
];

// One valid edge plus two dangling edges (endpoints not in NODES).
const EDGES = [
  { id: 'e1', from: 'a', to: 'b', label: 'valid' },
  { id: 'e2', from: 'b', to: 'ghost', label: 'dangling-target' },
  { id: 'e3', from: 'ghost2', to: 'c', label: 'dangling-source' },
];

function assertNoPhantomNodes(strategy: LayoutStrategy, diagramName: string) {
  it(`${diagramName}: drops dangling edges, no phantom nodes, finite node coords`, () => {
    const result = strategy.apply(NODES as never, EDGES as never);

    // All real nodes are laid out with finite coordinates.
    expect(result.nodes.map((n) => n.id).sort()).toEqual(['a', 'b', 'c']);
    for (const n of result.nodes) {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
    }

    // Only the valid edge survives; no output edge references a phantom node.
    expect(result.edges).toHaveLength(1);
    const e = result.edges[0];
    expect(e.from).toBe('a');
    expect(e.to).toBe('b');
    for (const edge of result.edges) {
      expect(edge.from).not.toBe('ghost');
      expect(edge.from).not.toBe('ghost2');
      expect(edge.to).not.toBe('ghost');
      expect(edge.to).not.toBe('ghost2');
    }
  });
}

describe('dagre strategies: dangling-edge hardening', () => {
  const strategies: Array<{ name: string; ctor: StrategyCtor }> = [
    { name: 'flow', ctor: FlowStrategyCtor },
    { name: 'tree', ctor: TreeStrategyCtor },
    { name: 'flowchart', ctor: FlowchartStrategyCtor },
  ];

  for (const { name, ctor } of strategies) {
    assertNoPhantomNodes(new ctor(), name);
  }
});
