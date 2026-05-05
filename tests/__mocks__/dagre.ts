/**
 * Mock for @dagrejs/dagre
 *
 * Dagre is a pure JS graph layout library with no DOM dependency.
 * This mock provides a minimal implementation that returns deterministic
 * node positions for testing purposes.
 */

import { jest } from '@jest/globals';

class MockGraph {
  private _nodes: Map<string, { label: string; width: number; height: number }> = new Map();
  private _edges: Array<{ v: string; w: string; label?: string }> = [];
  private _nodePositions: Map<string, { x: number; y: number; width: number; height: number; label: string }> = new Map();

  setDefaultEdgeLabel() { return this; }
  setGraph() { return this; }

  setNode(label: string, opts: { label?: string; width: number; height: number }) {
    this._nodes.set(label, { label: opts.label || label, width: opts.width, height: opts.height });
    return this;
  }

  setEdge(v: string, w: string, opts?: { label?: string }) {
    this._edges.push({ v, w, label: opts?.label });
    return this;
  }

  nodes() {
    return Array.from(this._nodes.keys());
  }

  edges() {
    return this._edges;
  }

  node(id: string) {
    return this._nodePositions.get(id);
  }

  edge(v: string, w: string) {
    const from = this._nodePositions.get(v);
    const to = this._nodePositions.get(w);
    return {
      points: [
        { x: from?.x ?? 0, y: from?.y ?? 0 },
        { x: to?.x ?? 0, y: to?.y ?? 0 },
      ],
    };
  }

  /**
   * Simulate dagre layout - assign positions in a grid pattern
   */
  layout() {
    let x = 50;
    let y = 50;
    for (const [id, opts] of this._nodes) {
      // Center positions (dagre returns center coordinates)
      this._nodePositions.set(id, {
        x: x + opts.width / 2,
        y: y + opts.height / 2,
        width: opts.width,
        height: opts.height,
        label: opts.label,
      });
      x += 150;
      if (x > 800) {
        x = 50;
        y += 100;
      }
    }
  }
}

export default {
  graphlib: {
    Graph: jest.fn(() => new MockGraph()),
  },
  layout: jest.fn((graph: MockGraph) => {
    graph.layout();
  }),
};
