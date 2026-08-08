/**
 * Animation Strategies for Diagram Types
 * 11 diagram type strategies mapped to 5 base animation patterns:
 *   flow, tree, timeline, matrix, cycle (+ aliases for extended types)
 * Each strategy defines how nodes and edges animate based on diagram type.
 */

import { DiagramType, PositionedNode, LayoutEdge } from '@/types/diagram';
import { distance } from '@/visualization/layout-utils';

/** Node fade-in duration: 0.3s = 9 frames at 30fps */
export const NODE_FADE_DURATION_FRAMES = 9;

/** Edge drawing duration: 0.5s = 15 frames at 30fps */
export const EDGE_DRAW_DURATION_FRAMES = 15;

/**
 * Stagger delay between animation groups (in frames).
 *
 * Exported so the render-plan producer (scene-render-spec-generator) can import
 * the single source of truth for contentReadyFrame timing instead of
 * re-hard-coding the value with a "matches" comment — which silently desyncs
 * the moment this constant changes.
 */
export const STAGGER_DELAY = 5;

/**
 * Configuration for a single node's animation
 */
export interface NodeAnimationConfig {
  nodeId: string;
  /** Delay before animation starts (in frames from scene start) */
  delayFrames: number;
  /** Duration of the fade-in animation (in frames) */
  durationFrames: number;
}

/**
 * Configuration for a single edge's animation
 */
export interface EdgeAnimationConfig {
  edgeIndex: number;
  /** Delay before animation starts (in frames from scene start) */
  delayFrames: number;
  /** Duration of the drawing animation (in frames) */
  durationFrames: number;
  /** Total length of the edge path (for stroke-dasharray) */
  pathLength: number;
}

/**
 * Strategy interface for diagram type-specific animations
 */
export interface AnimationStrategy {
  /** Get animation configs for all nodes */
  getNodeAnimations(nodes: PositionedNode[]): NodeAnimationConfig[];
  /** Get animation configs for all edges */
  getEdgeAnimations(edges: LayoutEdge[], nodes: PositionedNode[]): EdgeAnimationConfig[];
}

/**
 * Calculate the Euclidean path length from an array of points
 */
function calculatePathLength(points: { x: number; y: number }[]): number {
  if (!points || points.length === 0) return 0;
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    length += distance(dx, dy);
  }
  return length;
}

/**
 * FLOW strategy: top-to-bottom staggered fade-in, edges animate along the flow
 */
export const FLOW_STRATEGY: AnimationStrategy = {
  getNodeAnimations(nodes: PositionedNode[]): NodeAnimationConfig[] {
    // Sort by y position (top to bottom) then by x (left to right)
    const sorted = [...nodes].sort((a, b) => a.y - b.y || a.x - b.x);
    return sorted.map((node, index) => ({
      nodeId: node.id,
      delayFrames: index * STAGGER_DELAY,
      durationFrames: NODE_FADE_DURATION_FRAMES,
    }));
  },

  getEdgeAnimations(edges: LayoutEdge[], nodes: PositionedNode[]): EdgeAnimationConfig[] {
    // Edges start after the nodes begin, staggered along the flow
    const nodeCount = nodes.length;
    return edges.map((edge, index) => ({
      edgeIndex: index,
      delayFrames: nodeCount * STAGGER_DELAY + index * STAGGER_DELAY,
      durationFrames: EDGE_DRAW_DURATION_FRAMES,
      pathLength: calculatePathLength(edge.points),
    }));
  },
};

/**
 * TREE strategy: hierarchical appearance (root -> children -> grandchildren)
 * Uses y-position to determine depth level
 */
export const TREE_STRATEGY: AnimationStrategy = {
  getNodeAnimations(nodes: PositionedNode[]): NodeAnimationConfig[] {
    // Group nodes by y-level (round to nearest 50px to handle minor alignment differences)
    const levelMap = new Map<number, PositionedNode[]>();
    for (const node of nodes) {
      const level = Math.round(node.y / 50) * 50;
      if (!levelMap.has(level)) {
        levelMap.set(level, []);
      }
      levelMap.get(level)!.push(node);
    }

    // Sort levels by y position
    const levels = [...levelMap.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, nodesInLevel]) => nodesInLevel);

    const configs: NodeAnimationConfig[] = [];
    for (let levelIdx = 0; levelIdx < levels.length; levelIdx++) {
      for (const node of levels[levelIdx]) {
        configs.push({
          nodeId: node.id,
          delayFrames: levelIdx * STAGGER_DELAY,
          durationFrames: NODE_FADE_DURATION_FRAMES,
        });
      }
    }
    return configs;
  },

  getEdgeAnimations(edges: LayoutEdge[], nodes: PositionedNode[]): EdgeAnimationConfig[] {
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    // Sort edges by the y-position of the source node (higher = earlier)
    const indexed = edges.map((edge, index) => ({ edge, index }));
    indexed.sort((a, b) => {
      const aY = nodeMap.get(a.edge.from ?? '')?.y ?? 0;
      const bY = nodeMap.get(b.edge.from ?? '')?.y ?? 0;
      return aY - bY;
    });

    return indexed.map(({ edge, index: origIndex }, sortedIdx) => ({
      edgeIndex: origIndex,
      delayFrames: (sortedIdx + 1) * STAGGER_DELAY + NODE_FADE_DURATION_FRAMES,
      durationFrames: EDGE_DRAW_DURATION_FRAMES,
      pathLength: calculatePathLength(edge.points),
    }));
  },
};

/**
 * TIMELINE strategy: left-to-right sequential appearance
 */
export const TIMELINE_STRATEGY: AnimationStrategy = {
  getNodeAnimations(nodes: PositionedNode[]): NodeAnimationConfig[] {
    // Sort by x position (left to right), then by y
    const sorted = [...nodes].sort((a, b) => a.x - b.x || a.y - b.y);
    return sorted.map((node, index) => ({
      nodeId: node.id,
      delayFrames: index * STAGGER_DELAY,
      durationFrames: NODE_FADE_DURATION_FRAMES,
    }));
  },

  getEdgeAnimations(edges: LayoutEdge[], nodes: PositionedNode[]): EdgeAnimationConfig[] {
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    // Sort edges by x of source node (left to right)
    const indexed = edges.map((edge, index) => ({ edge, index }));
    indexed.sort((a, b) => {
      const aX = nodeMap.get(a.edge.from ?? '')?.x ?? 0;
      const bX = nodeMap.get(b.edge.from ?? '')?.x ?? 0;
      return aX - bX;
    });

    return indexed.map(({ edge, index: origIndex }, sortedIdx) => ({
      edgeIndex: origIndex,
      delayFrames: (sortedIdx + 1) * STAGGER_DELAY + NODE_FADE_DURATION_FRAMES,
      durationFrames: EDGE_DRAW_DURATION_FRAMES,
      pathLength: calculatePathLength(edge.points),
    }));
  },
};

/**
 * MATRIX strategy: grid appearance, row by row
 * Nodes in the same row appear simultaneously
 */
export const MATRIX_STRATEGY: AnimationStrategy = {
  getNodeAnimations(nodes: PositionedNode[]): NodeAnimationConfig[] {
    // Group by y-level (same row)
    const rowMap = new Map<number, PositionedNode[]>();
    for (const node of nodes) {
      const row = Math.round(node.y / 50) * 50;
      if (!rowMap.has(row)) {
        rowMap.set(row, []);
      }
      rowMap.get(row)!.push(node);
    }

    // Sort rows by y position
    const rows = [...rowMap.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, nodesInRow]) => nodesInRow);

    const configs: NodeAnimationConfig[] = [];
    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      for (const node of rows[rowIdx]) {
        configs.push({
          nodeId: node.id,
          delayFrames: rowIdx * STAGGER_DELAY,
          durationFrames: NODE_FADE_DURATION_FRAMES,
        });
      }
    }
    return configs;
  },

  getEdgeAnimations(edges: LayoutEdge[], nodes: PositionedNode[]): EdgeAnimationConfig[] {
    // Simple staggered edge drawing
    return edges.map((edge, index) => ({
      edgeIndex: index,
      delayFrames: Math.ceil(nodes.length / 2) * STAGGER_DELAY + index * STAGGER_DELAY,
      durationFrames: EDGE_DRAW_DURATION_FRAMES,
      pathLength: calculatePathLength(edge.points),
    }));
  },
};

/**
 * CYCLE strategy: circular sequential appearance
 * Nodes are ordered by angle from center, loop edges animate last
 */
export const CYCLE_STRATEGY: AnimationStrategy = {
  getNodeAnimations(nodes: PositionedNode[]): NodeAnimationConfig[] {
    if (nodes.length === 0) return [];

    // Calculate center point
    const cx = nodes.reduce((sum, n) => sum + n.x, 0) / nodes.length;
    const cy = nodes.reduce((sum, n) => sum + n.y, 0) / nodes.length;

    // Sort by angle from center (atan2, starting from top going clockwise)
    const sorted = [...nodes].sort((a, b) => {
      const angleA = Math.atan2(a.y - cy, a.x - cx);
      const angleB = Math.atan2(b.y - cy, b.x - cx);
      return angleA - angleB;
    });

    return sorted.map((node, index) => ({
      nodeId: node.id,
      delayFrames: index * STAGGER_DELAY,
      durationFrames: NODE_FADE_DURATION_FRAMES,
    }));
  },

  getEdgeAnimations(edges: LayoutEdge[], nodes: PositionedNode[]): EdgeAnimationConfig[] {
    const nodeCount = nodes.length;
    // Separate loop edges (edges that go back to start) from regular edges
    const nodeIds = new Set(nodes.map((n) => n.id));

    // Identify edges and check for loops
    return edges.map((edge, index) => ({
      edgeIndex: index,
      // Loop edges (closing edges) appear after all other edges
      delayFrames: (nodeCount + index) * STAGGER_DELAY,
      durationFrames: EDGE_DRAW_DURATION_FRAMES,
      pathLength: calculatePathLength(edge.points),
    }));
  },
};

/** Map of all strategies by diagram type */
const STRATEGY_MAP: Record<DiagramType, AnimationStrategy> = {
  flow: FLOW_STRATEGY,
  flowchart: FLOW_STRATEGY,
  tree: TREE_STRATEGY,
  timeline: TIMELINE_STRATEGY,
  matrix: MATRIX_STRATEGY,
  cycle: CYCLE_STRATEGY,
  comparison: MATRIX_STRATEGY,
  network: FLOW_STRATEGY,
  conceptmap: TREE_STRATEGY,
  mindmap: TREE_STRATEGY,
  general: FLOW_STRATEGY,
};

/**
 * Get the animation strategy for a given diagram type
 */
export function getAnimationStrategy(type: DiagramType): AnimationStrategy {
  return STRATEGY_MAP[type];
}
