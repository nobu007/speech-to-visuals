/**
 * Shared helpers for reading node dimensions safely.
 *
 * `PositionedNode` has two parallel property pairs: `width`/`height` (from
 * `NodeDatum`) and `w`/`h` (added at layout time).  Historical modules checked
 * one pair or the other, leading to NaN propagation when the wrong pair was
 * set.  These helpers consolidate the fallback chain and add a `Number.isFinite`
 * guard so NaN values can never leak through.
 */

import type { PositionedNode } from '@/types/diagram';

/** Default fallback width when neither `width` nor `w` is a finite number. */
export const DEFAULT_NODE_WIDTH = 120;

/** Default fallback height when neither `height` nor `h` is a finite number. */
export const DEFAULT_NODE_HEIGHT = 60;

/**
 * Read a node's effective width with NaN-safe fallback.
 *
 * Checks `width` first (the canonical property on `NodeDatum`), then `w`
 * (the layout-time alias), then `fallback`.
 *
 * ```ts
 * const w = getNodeWidth(node);            // → number (default 120)
 * const w = getNodeWidth(node, 0);         // → number (fallback 0)
 * ```
 */
export function getNodeWidth(node: Pick<PositionedNode, 'width' | 'w'>, fallback: number = DEFAULT_NODE_WIDTH): number {
  const v = node.width;
  if (Number.isFinite(v)) return v!;
  const w = node.w;
  if (Number.isFinite(w)) return w!;
  return fallback;
}

/**
 * Read a node's effective height with NaN-safe fallback.
 *
 * Checks `height` first (the canonical property on `NodeDatum`), then `h`
 * (the layout-time alias), then `fallback`.
 *
 * ```ts
 * const h = getNodeHeight(node);           // → number (default 60)
 * const h = getNodeHeight(node, 0);        // → number (fallback 0)
 * ```
 */
export function getNodeHeight(node: Pick<PositionedNode, 'height' | 'h'>, fallback: number = DEFAULT_NODE_HEIGHT): number {
  const v = node.height;
  if (Number.isFinite(v)) return v!;
  const h = node.h;
  if (Number.isFinite(h)) return h!;
  return fallback;
}

// ─── Branded type for compile-time dimension safety ──────────────

/**
 * Unique symbol brand so `NodeDimensionsSafe` can only be created
 * by calling {@link withSafeDimensions}.
 */
declare const __safeDim: unique symbol;

/**
 * A `PositionedNode` whose effective dimensions have been resolved
 * to finite `width` and `height` values.  The `w` / `h` aliases are
 * set to `undefined` to prevent accidental use.
 *
 * Create via {@link withSafeDimensions}; verify via {@link hasSafeDimensions}.
 */
export type NodeDimensionsSafe = PositionedNode & {
  width: number;
  height: number;
  w: undefined;
  h: undefined;
  readonly [__safeDim]: true;
};

/**
 * Type guard: returns `true` when the node already has finite
 * `width` and `height` (the canonical pair) and therefore needs
 * no fallback resolution.
 */
export function hasSafeDimensions(node: PositionedNode): boolean {
  return Number.isFinite(node.width) && Number.isFinite(node.height);
}

/**
 * Resolve a node's dimensions to finite values and return a
 * {@link NodeDimensionsSafe} branded type.
 *
 * The returned object is the **same node reference** (mutated in place)
 * with:
 *   - `width` / `height` guaranteed finite
 *   - `w` / `h` set to `undefined` to prevent future divergence
 *
 * Use at function boundaries where downstream code should be
 * dimension-safe by construction.
 */
export function withSafeDimensions(node: PositionedNode): NodeDimensionsSafe {
  node.width = getNodeWidth(node);
  node.height = getNodeHeight(node);
  node.w = undefined;
  node.h = undefined;
  return node as unknown as NodeDimensionsSafe;
}
