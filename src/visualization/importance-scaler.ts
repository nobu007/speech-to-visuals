/**
 * Importance Scaler
 *
 * Derives visual properties from node.meta.importance (0-1) to create
 * visual hierarchy in layout output. Nodes with higher importance get
 * larger dimensions and stronger positioning weight.
 *
 * Importance values come from keyphrase extraction during scene analysis:
 * - Keyphrase-derived nodes receive importance 0.7-1.0
 * - Template-generated nodes have predefined importance values
 * - Nodes without importance default to 0.5
 */

import { NodeDatum } from '@/types/diagram';
import { VisualizationError } from '@/pipeline/pipeline-errors';
import { clamp01 } from '@/utils/guards';

/** Minimum importance value (assigned when no importance is specified) */
const DEFAULT_IMPORTANCE = 0.5;

/** Importance values below this are considered "low importance" */
const LOW_IMPORTANCE_THRESHOLD = 0.3;

/** Scale range: importance 0 → this multiplier, importance 1 → 1.0 */
const MIN_SCALE = 0.75;
const MAX_SCALE = 1.5;

/**
 * Get the importance value of a node, defaulting to DEFAULT_IMPORTANCE.
 */
export function getImportance(node: NodeDatum): number {
  const raw = node.meta?.importance;
  if (raw === undefined || raw === null || Number.isNaN(raw)) {
    return DEFAULT_IMPORTANCE;
  }
  return clamp01(raw);
}

/**
 * Compute a size multiplier (0.75 – 1.5) based on importance.
 * Higher importance → larger node.
 */
export function importanceSizeScale(node: NodeDatum): number {
  const imp = getImportance(node);
  return MIN_SCALE + (MAX_SCALE - MIN_SCALE) * imp;
}

/**
 * Compute a positioning weight (0.5 – 2.0) based on importance.
 * Higher importance → more influence on layout positioning.
 *
 * Used by:
 * - MindMap: angular spread allocation for branches
 * - Network: force-directed attraction/repulsion multiplier
 */
export function importanceWeight(node: NodeDatum): number {
  const imp = getImportance(node);
  return 0.5 + 1.5 * imp;
}

/**
 * Scale a node's dimensions by its importance.
 * Returns new width/height without mutating the input.
 */
export function scaledDimensions(
  node: NodeDatum,
  baseWidth: number,
  baseHeight: number,
): { width: number; height: number } {
  const scale = importanceSizeScale(node);
  return {
    width: Math.round(baseWidth * scale),
    height: Math.round(baseHeight * scale),
  };
}

/**
 * Check if a node has high importance (above DEFAULT_IMPORTANCE).
 * Useful for root selection in mindmap layouts.
 */
export function isHighImportance(node: NodeDatum): boolean {
  return getImportance(node) > DEFAULT_IMPORTANCE;
}

/**
 * Check if a node has low importance (below threshold).
 * Useful for deprioritizing nodes in layout.
 */
export function isLowImportance(node: NodeDatum): boolean {
  return getImportance(node) < LOW_IMPORTANCE_THRESHOLD;
}

/**
 * Among a set of nodes, pick the one with the highest importance.
 * Falls back to the first node if all have equal importance.
 */
export function pickHighestImportance(nodes: NodeDatum[]): NodeDatum {
  if (nodes.length === 0) {
    throw new VisualizationError('Cannot pick from empty node list');
  }
  let best = nodes[0];
  let bestImp = getImportance(best);
  for (let i = 1; i < nodes.length; i++) {
    const imp = getImportance(nodes[i]);
    if (imp > bestImp) {
      best = nodes[i];
      bestImp = imp;
    }
  }
  return best;
}
