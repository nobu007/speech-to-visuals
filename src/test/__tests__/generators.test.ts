/**
 * Tests for src/test/generators.ts
 */

import type { NodeDatum, EdgeDatum, SceneGraph } from '@stv/core/types';
import {
  createTestNode,
  createTestEdge,
  createTestSceneGraph,
} from '../generators';

// ---------------------------------------------------------------------------
// createTestNode
// ---------------------------------------------------------------------------
describe('createTestNode', () => {
  test('returns a NodeDatum with a generated id and default label', () => {
    const node = createTestNode();
    expect(node.id).toMatch(/^node-[a-z0-9]+$/);
    expect(node.label).toBe('Test Node');
  });

  test('applies overrides', () => {
    const node = createTestNode({ id: 'custom-id', label: 'Custom' });
    expect(node.id).toBe('custom-id');
    expect(node.label).toBe('Custom');
  });

  test('preserves optional meta when provided', () => {
    const node = createTestNode({
      meta: { importance: 5, category: 'core', icon: 'star' },
    });
    expect(node.meta).toEqual({ importance: 5, category: 'core', icon: 'star' });
  });

  test('each call generates a different id by default', () => {
    const a = createTestNode();
    const b = createTestNode();
    expect(a.id).not.toBe(b.id);
  });
});

// ---------------------------------------------------------------------------
// createTestEdge
// ---------------------------------------------------------------------------
describe('createTestEdge', () => {
  test('returns an EdgeDatum with default from/to', () => {
    const edge = createTestEdge();
    expect(edge.from).toBe('node-1');
    expect(edge.to).toBe('node-2');
  });

  test('accepts custom from/to', () => {
    const edge = createTestEdge('a', 'b');
    expect(edge.from).toBe('a');
    expect(edge.to).toBe('b');
  });

  test('applies overrides (e.g. label, type)', () => {
    const edge = createTestEdge('x', 'y', { label: 'connects', type: 'arrow' });
    expect(edge.from).toBe('x');
    expect(edge.to).toBe('y');
    expect(edge.label).toBe('connects');
    expect(edge.type).toBe('arrow');
  });
});

// ---------------------------------------------------------------------------
// createTestSceneGraph
// ---------------------------------------------------------------------------
describe('createTestSceneGraph', () => {
  test('returns a SceneGraph with sensible defaults', () => {
    const sg = createTestSceneGraph();
    expect(sg.type).toBe('flow');
    expect(sg.startMs).toBe(0);
    expect(sg.durationMs).toBe(5000);
    expect(sg.summary).toBe('Test scene');
    expect(sg.keyphrases).toEqual(['test']);
  });

  test('contains two nodes and one edge by default', () => {
    const sg = createTestSceneGraph();
    expect(sg.nodes).toHaveLength(2);
    expect(sg.edges).toHaveLength(1);
    expect(sg.edges[0].from).toBe('node-1');
    expect(sg.edges[0].to).toBe('node-2');
  });

  test('node ids match the edge endpoints', () => {
    const sg = createTestSceneGraph();
    const ids = sg.nodes.map((n: NodeDatum) => n.id);
    expect(ids).toContain('node-1');
    expect(ids).toContain('node-2');
  });

  test('applies overrides', () => {
    const customNodes: NodeDatum[] = [
      { id: 'a', label: 'Alpha' },
      { id: 'b', label: 'Beta' },
      { id: 'c', label: 'Gamma' },
    ];
    const customEdges: EdgeDatum[] = [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
    ];
    const sg = createTestSceneGraph({
      type: 'tree',
      nodes: customNodes,
      edges: customEdges,
      durationMs: 10000,
      keyphrases: ['alpha', 'beta'],
    });
    expect(sg.type).toBe('tree');
    expect(sg.nodes).toHaveLength(3);
    expect(sg.edges).toHaveLength(2);
    expect(sg.durationMs).toBe(10000);
    expect(sg.keyphrases).toEqual(['alpha', 'beta']);
  });
});
