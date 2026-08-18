/**
 * Test data generators for domain types.
 *
 * Re-uses the canonical types from @/types so factory output is
 * always structurally compatible with the rest of the codebase.
 */

import type {
  NodeDatum,
  EdgeDatum,
  SceneGraph,
  DiagramType,
} from '@stv/core/types';

/**
 * Generate a random short id suitable for tests.
 */
function randomId(): string {
  return `node-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Create a test NodeDatum with sensible defaults.
 */
export function createTestNode(
  overrides: Partial<NodeDatum> = {},
): NodeDatum {
  return {
    id: randomId(),
    label: 'Test Node',
    ...overrides,
  };
}

/**
 * Create a test EdgeDatum with sensible defaults.
 */
export function createTestEdge(
  from: string = 'node-1',
  to: string = 'node-2',
  overrides: Partial<EdgeDatum> = {},
): EdgeDatum {
  return {
    from,
    to,
    ...overrides,
  };
}

/**
 * Create a test SceneGraph with two nodes and one edge by default.
 */
export function createTestSceneGraph(
  overrides: Partial<SceneGraph> = {},
): SceneGraph {
  const nodes: NodeDatum[] = [
    createTestNode({ id: 'node-1', label: 'Node 1' }),
    createTestNode({ id: 'node-2', label: 'Node 2' }),
  ];

  return {
    type: 'flow' as DiagramType,
    nodes,
    edges: [createTestEdge('node-1', 'node-2')],
    startMs: 0,
    durationMs: 5000,
    summary: 'Test scene',
    keyphrases: ['test'],
    ...overrides,
  };
}
