/**
 * Layout Worker tests
 *
 * Tests the computeLayout function for graph layout computation.
 */

/* globals are provided by Jest via @types/jest */
import { computeLayout } from '../layout-worker';
import type { LayoutWorkerPayload } from '../types';

const makePayload = (
  overrides: Partial<LayoutWorkerPayload> = {},
): LayoutWorkerPayload => ({
  nodes: [
    { id: 'A', width: 120, height: 60 },
    { id: 'B', width: 120, height: 60 },
    { id: 'C', width: 120, height: 60 },
  ],
  edges: [
    { source: 'A', target: 'B' },
    { source: 'B', target: 'C' },
  ],
  config: {
    width: 1920,
    height: 1080,
    rankDirection: 'TB',
    nodeSeparation: 50,
    rankSeparation: 50,
  },
  ...overrides,
});

describe('computeLayout', () => {
  it('should position nodes in hierarchical levels', () => {
    const result = computeLayout(makePayload());

    expect(result.nodes).toHaveLength(3);
    expect(result.edges).toHaveLength(2);

    // Node A should be at level 0 (root)
    const nodeA = result.nodes.find((n) => n.id === 'A');
    const nodeB = result.nodes.find((n) => n.id === 'B');
    const nodeC = result.nodes.find((n) => n.id === 'C');

    expect(nodeA).toBeDefined();
    expect(nodeB).toBeDefined();
    expect(nodeC).toBeDefined();

    // B should be below A (higher Y in TB layout)
    expect(nodeB!.y).toBeGreaterThan(nodeA!.y);
    // C should be below B
    expect(nodeC!.y).toBeGreaterThan(nodeB!.y);
  });

  it('should handle empty nodes', () => {
    const result = computeLayout(
      makePayload({ nodes: [], edges: [] }),
    );

    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);
  });

  it('should handle single node', () => {
    const result = computeLayout(
      makePayload({
        nodes: [{ id: 'only', width: 100, height: 50 }],
        edges: [],
      }),
    );

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].id).toBe('only');
  });

  it('should handle disconnected nodes', () => {
    const result = computeLayout(
      makePayload({
        nodes: [
          { id: 'X', width: 100, height: 40 },
          { id: 'Y', width: 100, height: 40 },
        ],
        edges: [],
      }),
    );

    // Disconnected nodes should both be at level 0
    expect(result.nodes).toHaveLength(2);
    const nodeX = result.nodes.find((n) => n.id === 'X');
    const nodeY = result.nodes.find((n) => n.id === 'Y');
    expect(nodeX).toBeDefined();
    expect(nodeY).toBeDefined();
  });

  it('should respect LR (left-to-right) rank direction', () => {
    const result = computeLayout(
      makePayload({
        config: {
          width: 1920,
          height: 1080,
          rankDirection: 'LR',
          nodeSeparation: 50,
          rankSeparation: 50,
        },
      }),
    );

    const nodeA = result.nodes.find((n) => n.id === 'A');
    const nodeB = result.nodes.find((n) => n.id === 'B');

    // In LR mode, levels go along X axis
    expect(nodeB!.x).toBeGreaterThan(nodeA!.x);
  });

  it('should handle diamond-shaped graph', () => {
    const result = computeLayout(
      makePayload({
        nodes: [
          { id: 'A', width: 80, height: 40 },
          { id: 'B', width: 80, height: 40 },
          { id: 'C', width: 80, height: 40 },
          { id: 'D', width: 80, height: 40 },
        ],
        edges: [
          { source: 'A', target: 'B' },
          { source: 'A', target: 'C' },
          { source: 'B', target: 'D' },
          { source: 'C', target: 'D' },
        ],
      }),
    );

    expect(result.nodes).toHaveLength(4);
    expect(result.edges).toHaveLength(4);

    // D should be at the bottom (level 2)
    const nodeD = result.nodes.find((n) => n.id === 'D');
    const nodeA = result.nodes.find((n) => n.id === 'A');
    expect(nodeD!.y).toBeGreaterThan(nodeA!.y);
  });

  it('should preserve node dimensions', () => {
    const result = computeLayout(
      makePayload({
        nodes: [{ id: 'big', width: 200, height: 100 }],
        edges: [],
      }),
    );

    expect(result.nodes[0].width).toBe(200);
    expect(result.nodes[0].height).toBe(100);
  });
});
