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
 * (round 10); since round 37 the explicit-dimension-first branch ALSO lives
 * there (`resolveNodeWidth`/`resolveNodeHeight`, shared with the ezo engine),
 * and this module only owns the strategy-family delegation wiring.
 * Guard: tests/guards/v1-strategy-shared-members-single-source.test.ts.
 */

import type { NodeDatum, EdgeDatum } from '@stv/core/types/diagram';
import type { LayoutConfig } from './types';
import { logger } from '@stv/core/utils/logger';
import { DEFAULT_NODE_WIDTH } from './node-dimensions';
import {
  resolveNodeWidth,
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
 *
 * Round 37: the explicit-dimension-first branch moved into
 * `resolveNodeWidth` (layout-utils.ts) so the ezo engine shares the SAME
 * canonical decision — this wrapper now only carries the strategy family's
 * padding-20 label-tail wiring. Output is byte-identical to the inline form
 * (pinned by tests/guards/ezo-explicit-dimension-sizing.test.ts).
 */
export function strategyNodeWidth(
  node: NodeDatum,
  config: Pick<LayoutConfig, 'nodeWidth' | 'nodeHeight'>
): number {
  return resolveNodeWidth(node, {
    // Label-driven tail wiring: `|| DEFAULT_NODE_WIDTH` fallback + the
    // round-10 single-sourced charWidth 8 / padding 20 (layout-utils.ts).
    nodeWidth: config.nodeWidth || DEFAULT_NODE_WIDTH,
    nodeHeight: config.nodeHeight,
    charWidth: DEFAULT_CHAR_WIDTH,
    padding: DEFAULT_LABEL_PADDING,
  });
}
