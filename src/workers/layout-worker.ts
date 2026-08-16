/**
 * Layout Worker - Handles CPU-intensive graph layout computation
 *
 * Offloads dagre layout calculation to a Web Worker.
 * dagre is a pure JS library with no DOM dependency,
 * making it ideal for worker execution.
 */

import type {
  WorkerMessage,
  WorkerResponse,
  LayoutWorkerPayload,
  LayoutWorkerResult,
} from './types';
import {
  DEFAULT_NODE_SEPARATION,
  DEFAULT_RANK_SEPARATION,
} from '../visualization/layout-spacing';
import { nodeExtentEdges, foldNodeExtents } from '../visualization/layout-utils';

/**
 * Compute graph layout using a simplified force-directed / grid algorithm.
 *
 * In the browser build, dagre is imported and used directly.
 * In the worker, we implement the core layout logic to avoid
 * complex module loading in worker context.
 */
export function computeLayout(
  payload: LayoutWorkerPayload,
): LayoutWorkerResult {
  const { nodes, edges, config } = payload;

  if (!nodes || nodes.length === 0) {
    return { nodes: [], edges: [], width: config.width, height: config.height };
  }

  // Build adjacency for level assignment (filter edges referencing non-existent nodes)
  const adjacency = new Map<string, Set<string>>();
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const nodeIds = new Set(nodes.map((n) => n.id));

  const validEdges = edges.filter(
    (e) => nodeIds.has(e.source) && nodeIds.has(e.target),
  );

  for (const node of nodes) {
    adjacency.set(node.id, new Set());
  }
  for (const edge of validEdges) {
    const srcSet = adjacency.get(edge.source);
    const tgtSet = adjacency.get(edge.target);
    if (srcSet) srcSet.add(edge.target);
    if (tgtSet) tgtSet.add(edge.source);
  }

  // Assign levels using BFS from root nodes
  const levels = new Map<string, number>();
  const inDegree = new Map<string, number>();

  for (const node of nodes) {
    inDegree.set(node.id, 0);
  }
  for (const edge of validEdges) {
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  }

  // Find root nodes (zero in-degree)
  const queue: string[] = [];
  for (const node of nodes) {
    if ((inDegree.get(node.id) || 0) === 0) {
      queue.push(node.id);
      levels.set(node.id, 0);
    }
  }

  // BFS to assign levels
  let head = 0;
  while (head < queue.length) {
    const current = queue[head++];
    const currentLevel = levels.get(current) || 0;

    for (const neighbor of adjacency.get(current) || []) {
      const edge = validEdges.find((e) => e.source === current && e.target === neighbor);
      if (edge && !levels.has(neighbor)) {
        levels.set(neighbor, currentLevel + 1);
        queue.push(neighbor);
      }
    }
  }

  // Assign unvisited nodes to level 0
  for (const node of nodes) {
    if (!levels.has(node.id)) {
      levels.set(node.id, 0);
    }
  }

  // Group nodes by level
  const levelGroups = new Map<number, string[]>();
  for (const [nodeId, level] of levels) {
    if (!levelGroups.has(level)) levelGroups.set(level, []);
    levelGroups.get(level)!.push(nodeId);
  }

  // Position nodes using rank direction
  const isHorizontal = config.rankDirection === 'LR' || config.rankDirection === 'RL';
  const nodeSep = config.nodeSeparation || DEFAULT_NODE_SEPARATION;
  const rankSep = config.rankSeparation || DEFAULT_RANK_SEPARATION;

  const positionedNodes: LayoutWorkerResult['nodes'] = [];
  const maxLevels = Math.max(...Array.from(levelGroups.keys()), 0);

  for (let level = 0; level <= maxLevels; level++) {
    const groupNodes = levelGroups.get(level) || [];
    const groupWidth = groupNodes.reduce(
      (sum, id) => sum + (nodeMap.get(id)?.width || 120),
      0,
    ) + (groupNodes.length - 1) * nodeSep;
    let offsetX = (config.width - groupWidth) / 2;

    for (const nodeId of groupNodes) {
      const nodeInfo = nodeMap.get(nodeId);
      const width = nodeInfo?.width || 120;
      const height = nodeInfo?.height || 60;

      const x = isHorizontal
        ? level * rankSep + rankSep
        : offsetX;
      const y = isHorizontal
        ? offsetX
        : level * rankSep + rankSep;

      positionedNodes.push({ id: nodeId, x, y, width, height });
      offsetX += width + nodeSep;
    }
  }

  // Pass valid edges through with computed layout
  const resultEdges = validEdges.map((edge) => ({
    source: edge.source,
    target: edge.target,
  }));

  // Compute final bounds. The node-extent scan delegates to foldNodeExtents
  // (round 41 single source); the canvas-width/height SEEDS stay here — this
  // site's box is "content extents floored at the requested canvas", a
  // different contract from the pure content box every other site computes.
  // Worker nodes always carry finite width/height (the `|| 120` / `|| 60`
  // defaults above), so the canonical read is value-identical to the retired
  // raw `n.x + n.width`.
  const extents = foldNodeExtents(positionedNodes, (n) => nodeExtentEdges(n, 0, 0));
  const maxX = Math.max(extents?.maxX ?? config.width, config.width);
  const maxY = Math.max(extents?.maxY ?? config.height, config.height);

  return {
    nodes: positionedNodes,
    edges: resultEdges,
    width: maxX,
    height: maxY,
  };
}

// Worker message handler
const handler = (e: MessageEvent<WorkerMessage<LayoutWorkerPayload>>): void => {
  const { id, type, payload } = e.data;

  try {
    const result = computeLayout(payload);
    const response: WorkerResponse<LayoutWorkerResult> = {
      id,
      type,
      payload: result,
    };
    self.postMessage(response);
  } catch (error) {
    const response: WorkerResponse = {
      id,
      type,
      error: {
        code: 'LAYOUT_ERROR',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    };
    self.postMessage(response);
  }
};

// Register handler in Worker context (guarded for Node.js test env)
if (typeof self !== 'undefined' && typeof self.onmessage !== 'undefined') {
  self.onmessage = handler;
}
