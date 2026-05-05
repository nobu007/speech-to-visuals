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
  private _graphOpts: { rankdir?: string; nodesep?: number; ranksep?: number } = {};

  setDefaultEdgeLabel() { return this; }
  setGraph(opts?: { rankdir?: string; nodesep?: number; ranksep?: number }) {
    if (opts) this._graphOpts = opts;
    return this;
  }

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
   * Simulate dagre layout - assign positions respecting edge hierarchy.
   * Root nodes (no incoming edges) at top, children below, with proper
   * level-based vertical spacing and horizontal spreading within levels.
   */
  layout() {
    // Build adjacency and identify root nodes (no incoming edges)
    const hasIncoming = new Set<string>();
    for (const e of this._edges) {
      hasIncoming.add(e.w);
    }

    const roots: string[] = [];
    for (const id of this._nodes.keys()) {
      if (!hasIncoming.has(id)) {
        roots.push(id);
      }
    }

    // If all nodes have incoming edges (cycle), treat first node as root
    if (roots.length === 0 && this._nodes.size > 0) {
      roots.push(this._nodes.keys().next().value);
    }

    // BFS to assign levels
    const levels = new Map<string, number>();
    const visited = new Set<string>();
    const queue: Array<{ id: string; level: number }> = roots.map(id => ({ id, level: 0 }));
    for (const r of roots) {
      visited.add(r);
    }

    const adjacency = new Map<string, string[]>();
    for (const id of this._nodes.keys()) {
      adjacency.set(id, []);
    }
    for (const e of this._edges) {
      adjacency.get(e.v)?.push(e.w);
    }

    while (queue.length > 0) {
      const { id, level } = queue.shift()!;
      levels.set(id, level);
      for (const neighbor of adjacency.get(id) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push({ id: neighbor, level: level + 1 });
        }
      }
    }

    // Assign unvisited nodes to level 0
    for (const id of this._nodes.keys()) {
      if (!visited.has(id)) {
        levels.set(id, 0);
      }
    }

    // Group nodes by level
    const levelGroups = new Map<number, string[]>();
    for (const [id, level] of levels) {
      if (!levelGroups.has(level)) {
        levelGroups.set(level, []);
      }
      levelGroups.get(level)!.push(id);
    }

    // Position nodes: direction depends on rankdir
    const nodeSep = this._graphOpts.nodesep ?? 60;
    const rankSep = this._graphOpts.ranksep ?? 100;
    const isLR = this._graphOpts.rankdir === 'LR';

    for (const [level, group] of levelGroups) {
      for (let i = 0; i < group.length; i++) {
        const id = group[i];
        const opts = this._nodes.get(id)!;

        if (isLR) {
          // LR: level determines x (left to right), spread vertically within level
          this._nodePositions.set(id, {
            x: 50 + level * (opts.width + rankSep) + opts.width / 2,
            y: 50 + i * (opts.height + nodeSep) + opts.height / 2,
            width: opts.width,
            height: opts.height,
            label: opts.label,
          });
        } else {
          // TB (default): level determines y (top to bottom), spread horizontally within level
          this._nodePositions.set(id, {
            x: 50 + i * (opts.width + nodeSep) + opts.width / 2,
            y: 50 + level * (opts.height + rankSep) + opts.height / 2,
            width: opts.width,
            height: opts.height,
            label: opts.label,
          });
        }
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
