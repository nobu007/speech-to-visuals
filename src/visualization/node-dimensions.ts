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
