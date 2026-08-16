/**
 * Shared members of the v1 layout-strategy family (round 31 single-source).
 *
 * Two method bodies were pasted across the CamelCase strategies
 * (Tree/Flowchart/Network/Timeline/ConceptMap/Comparison) and the engine base:
 *
 *   - `validateInputs` — byte-identical in all six strategies except the
 *     logger prefix (`'[Tree]'` … `'[Comparison]'`).
 *   - `calculateNodeWidth` — the label-driven tail was byte-identical in five
 *     strategies, but TreeLayoutStrategy had ALREADY drifted ahead of its
 *     siblings: it grows an explicit-dimension-first preamble
 *     (`node.width ?? node.w`, finite, > 0 → return it) that the other five
 *     lack, so a NodeDatum carrying `width` was silently clamped back to the
 *     label-driven estimate. The modern `getNodeWidth()` in
 *     `visualization/node-dimensions.ts` reads explicit `width`/`w` first —
 *     Tree's preamble is the correct direction, so the shared function adopts
 *     it (behavior change for the five lagging siblings + the
 *     `this.config`-wired engine copies, which also gain the
 *     `|| DEFAULT_NODE_WIDTH` fallback their raw `this.config.nodeWidth` pass
 *     lacked — NaN-producing only under a `{}` config cast, since
 *     `LayoutConfig.nodeWidth` is typed required and engine constructors
 *     default it).
 *
 * The label-width constants still single-source through `layout-utils.ts`
 * (round 10); this module only owns the explicit-dimension branch and the
 * delegation wiring. Guard: tests/guards/v1-strategy-shared-members-single-source.test.ts.
 */

import type { NodeDatum, EdgeDatum } from '@/types/diagram';
import type { LayoutConfig } from './types';
import { logger } from '../utils/logger';
import { DEFAULT_NODE_WIDTH } from './node-dimensions';
import {
  calculateNodeWidth as calculateNodeWidthUtil,
  DEFAULT_CHAR_WIDTH,
  DEFAULT_LABEL_PADDING,
} from './layout-utils';

/**
 * Shared `validateInputs` body of the v1 strategy family.
 *
 * @param logPrefix bracketed strategy tag used in every log message, e.g.
 *   `'[Tree]'` — must match the prefix the strategy used before delegation so
 *   log output is byte-identical.
 */
export function validateStrategyInputs(
  nodes: NodeDatum[],
  edges: EdgeDatum[],
  logPrefix: string
): boolean {
  if (nodes.length === 0) {
    logger.warn(`${logPrefix} No nodes to layout`);
    return false;
  }

  const nodeIds = new Set(nodes.map(n => n.id));
  if (nodeIds.size !== nodes.length) {
    logger.error(`${logPrefix} Duplicate node IDs detected`);
    return false;
  }

  const invalidEdges = edges.filter(
    edge => !nodeIds.has(edge.from) || !nodeIds.has(edge.to)
  );

  if (invalidEdges.length > 0) {
    logger.error(`${logPrefix} Invalid edges detected:`, invalidEdges);
    return false;
  }

  return true;
}

/**
 * Shared node-width estimate of the v1 strategy family: explicit finite
 * dimension first (Tree's semantics — see the module header), then the
 * label-driven `layout-utils` estimate clamped to [base, 2 × base].
 */
export function strategyNodeWidth(
  node: NodeDatum,
  config: Pick<LayoutConfig, 'nodeWidth' | 'nodeHeight'>
): number {
  // Respect explicit dimension if provided on the node
  const explicitWidth = node.width ?? (node as NodeDatum & { w?: number }).w;
  if (typeof explicitWidth === 'number' && isFinite(explicitWidth) && explicitWidth > 0) {
    return explicitWidth;
  }

  // Label-driven width delegates to the shared util (round 10 single-source
  // of charWidth 8 / padding 20 — see layout-utils.ts).
  const baseWidth = config.nodeWidth || DEFAULT_NODE_WIDTH;
  return calculateNodeWidthUtil(node, {
    nodeWidth: baseWidth,
    nodeHeight: config.nodeHeight,
    charWidth: DEFAULT_CHAR_WIDTH,
    padding: DEFAULT_LABEL_PADDING,
  });
}
