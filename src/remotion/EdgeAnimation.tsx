/**
 * Edge Animation Component
 * Edge drawing animation: 0.5s = 15 frames at 30fps
 * Uses SVG stroke-dasharray/dashoffset technique for path drawing effect
 */

import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { LayoutEdge } from '@/types/diagram';
import { EDGE_DRAW_DURATION_FRAMES } from './animation-strategies';

/** Edge drawing duration in seconds */
export const EDGE_DRAW_DURATION_SEC = 0.5;

interface EdgeAnimationProps {
  edge: LayoutEdge;
  edgeIndex: number;
  /** Delay before animation starts (in frames) */
  delayFrames: number;
  /** Duration of the drawing animation (in frames) */
  durationFrames: number;
  /** Total length of the edge path (for stroke-dasharray) */
  pathLength: number;
}

/**
 * Calculate the progress of edge drawing (0 to 1)
 * @param currentFrame - The current frame number
 * @param delayFrames - Delay before animation starts
 * @param fps - Frames per second
 * @param durationFrames - Duration in frames (default: EDGE_DRAW_DURATION_FRAMES)
 * @returns Progress value between 0 and 1
 */
export function calculateEdgeProgress(
  currentFrame: number,
  delayFrames: number,
  fps: number,
  durationFrames: number = EDGE_DRAW_DURATION_FRAMES
): number {
  return interpolate(
    currentFrame - delayFrames,
    [0, durationFrames],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
}

/**
 * Calculate the total Euclidean length of a path defined by points
 */
export function calculatePathLength(points: { x: number; y: number }[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    length += Math.sqrt(dx * dx + dy * dy);
  }
  return length;
}

/**
 * Generate an SVG path 'd' attribute from an array of points
 */
export function generatePathD(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M${points[0].x},${points[0].y}`;

  return points
    .map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`))
    .join(' ');
}

/**
 * EdgeAnimation component
 * Renders an SVG path with stroke-dasharray/dashoffset animation for drawing effect
 */
export const EdgeAnimation: React.FC<EdgeAnimationProps> = ({
  edge,
  edgeIndex,
  delayFrames,
  durationFrames,
  pathLength,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = calculateEdgeProgress(frame, delayFrames, fps, durationFrames);

  // Calculate bounding box from points for SVG viewBox
  const points = edge.points;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const pad = 10;
  const minX = (xs.length > 0 ? Math.min(...xs) : 0) - pad;
  const minY = (ys.length > 0 ? Math.min(...ys) : 0) - pad;
  const maxX = (xs.length > 0 ? Math.max(...xs) : 0) + pad;
  const maxY = (ys.length > 0 ? Math.max(...ys) : 0) + pad;
  const width = maxX - minX;
  const height = maxY - minY;

  // stroke-dashoffset goes from pathLength (fully hidden) to 0 (fully drawn)
  const dashOffset = interpolate(progress, [0, 1], [pathLength, 0]);

  const pathD = generatePathD(points);

  return (
    <svg
      style={{
        position: 'absolute',
        left: minX,
        top: minY,
        width,
        height,
        overflow: 'visible',
        pointerEvents: 'none',
      }}
      viewBox={`${minX} ${minY} ${width} ${height}`}
    >
      <path
        d={pathD}
        stroke="rgba(255, 255, 255, 0.5)"
        strokeWidth={2}
        fill="none"
        strokeDasharray={pathLength}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
      />
    </svg>
  );
};
