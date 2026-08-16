/**
 * Canvas Calculator
 *
 * Computes optimal canvas size from positioned nodes and centers
 * the node group within the canvas. Maintains 16:9 aspect ratio
 * and scales down if nodes exceed 1920x1080.
 */

import { PositionedNode } from '@/types/diagram';
import { sanitizeFinite } from '@/utils/guards';
import { getNodeWidth, getNodeHeight } from './node-dimensions';
import { nodeExtentEdges, foldNodeExtents, NodeExtentEdges } from './layout-utils';
import { DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT, TARGET_ASPECT_RATIO } from './canvas-dimensions';

const PADDING_RATIO = 0.05;
const MIN_PADDING = 40;

/**
 * This module's extent READ policy (round 41): every coordinate and dimension
 * is sanitized (`NaN → 0`) BEFORE entering the fold, so a corrupted node can
 * never poison the canvas box. The fold itself delegates to
 * `foldNodeExtents`; only the read stays local, because sanitization is this
 * module's contract (pinned by
 * tests/guards/canvas-calculator-sanitizeFinite-migration-pinning.test.ts),
 * not the scan's.
 */
function sanitizedExtentEdges(node: PositionedNode): NodeExtentEdges {
  const left = sanitizeFinite(node.x, 0);
  const top = sanitizeFinite(node.y, 0);
  return {
    left,
    top,
    right: left + sanitizeFinite(getNodeWidth(node, 0), 0),
    bottom: top + sanitizeFinite(getNodeHeight(node, 0), 0),
  };
}

export interface CanvasCalcResult {
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
  scale: number;
}

export class CanvasCalculator {
  /**
   * Calculate optimal canvas size from positioned nodes.
   * 1. Compute bounding box of all nodes
   * 2. Add 5% padding (min 40px)
   * 3. Maintain 16:9 aspect ratio
   * 4. Scale down if exceeds 1920x1080
   * 5. Return result with scale factor
   */
  calculate(nodes: PositionedNode[]): CanvasCalcResult {
    // Compute bounding box (extent scan delegates to foldNodeExtents —
    // round 41 single source; the sanitized read is this module's policy).
    const extents = foldNodeExtents(nodes, sanitizedExtentEdges);
    if (extents === null) {
      return {
        width: DEFAULT_CANVAS_WIDTH,
        height: DEFAULT_CANVAS_HEIGHT,
        padding: { top: MIN_PADDING, right: MIN_PADDING, bottom: MIN_PADDING, left: MIN_PADDING },
        scale: 1,
      };
    }

    const { minX, minY, maxX, maxY } = extents;

    // Guard against degenerate (all-zero or all-NaN) bounding boxes
    const bboxWidth = Math.max(1, maxX - minX);
    const bboxHeight = Math.max(1, maxY - minY);

    // Add 5% padding (min 40px)
    const paddingH = Math.max(bboxWidth * PADDING_RATIO, MIN_PADDING);
    const paddingV = Math.max(bboxHeight * PADDING_RATIO, MIN_PADDING);

    const padding = {
      top: paddingV,
      right: paddingH,
      bottom: paddingV,
      left: paddingH,
    };

    let width = bboxWidth + paddingH * 2;
    let height = bboxHeight + paddingV * 2;

    // Maintain 16:9 aspect ratio
    const currentRatio = width / height;
    if (currentRatio < TARGET_ASPECT_RATIO) {
      width = height * TARGET_ASPECT_RATIO;
    } else {
      height = width / TARGET_ASPECT_RATIO;
    }

    // Scale down if exceeds 1920x1080
    let scale = 1;
    if (width > DEFAULT_CANVAS_WIDTH || height > DEFAULT_CANVAS_HEIGHT) {
      const scaleX = DEFAULT_CANVAS_WIDTH / width;
      const scaleY = DEFAULT_CANVAS_HEIGHT / height;
      scale = Math.min(scaleX, scaleY);
      width = width * scale;
      height = height * scale;
    }

    return {
      width: Math.round(width),
      height: Math.round(height),
      padding,
      scale,
    };
  }

  /**
   * Center nodes within the given canvas.
   * 1. Compute bounding box of nodes
   * 2. Calculate offset to center bbox in canvas
   * 3. Apply offset to all nodes
   * 4. Return repositioned nodes
   */
  center(nodes: PositionedNode[], canvas: CanvasCalcResult): PositionedNode[] {
    // Compute bounding box (extent scan delegates to foldNodeExtents —
    // round 41 single source; the sanitized read is this module's policy).
    const extents = foldNodeExtents(nodes, sanitizedExtentEdges);
    if (extents === null) {
      return [];
    }

    const { minX, minY } = extents;
    const bboxWidth = Math.max(1, extents.maxX - minX);
    const bboxHeight = Math.max(1, extents.maxY - minY);
    const bboxCenterX = minX + bboxWidth / 2;
    const bboxCenterY = minY + bboxHeight / 2;

    const canvasCenterX = canvas.width / 2;
    const canvasCenterY = canvas.height / 2;

    const offsetX = canvasCenterX - bboxCenterX;
    const offsetY = canvasCenterY - bboxCenterY;

    return nodes.map((node) => ({
      ...node,
      x: sanitizeFinite(node.x, 0) + offsetX,
      y: sanitizeFinite(node.y, 0) + offsetY,
    }));
  }
}
