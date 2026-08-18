/**
 * Node Animation Component
 * Fade-in animation for diagram nodes: 0.3s = 9 frames at 30fps
 */

import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { PositionedNode } from '@stv/core/types/diagram';
import { NODE_FADE_DURATION_FRAMES } from './animation-strategies';

/** Node fade-in duration in seconds */
export const NODE_FADE_DURATION_SEC = 0.3;

interface NodeAnimationProps {
  node: PositionedNode;
  /** Delay before animation starts (in frames) */
  delayFrames: number;
  /** Duration of the fade-in (in frames) */
  durationFrames: number;
  /**
   * Frame to animate against. When a parent scene passes its scene-local frame,
   * entrance animations correctly restart at each scene boundary. Defaults to
   * the composition's global frame for standalone use.
   */
  currentFrame?: number;
  children: React.ReactNode;
}

/**
 * Calculate node opacity based on current frame, delay, and fps
 * @param currentFrame - The current frame number
 * @param delayFrames - Delay before animation starts
 * @param fps - Frames per second
 * @param durationFrames - Duration of fade-in in frames (default: NODE_FADE_DURATION_FRAMES)
 * @returns Opacity value between 0 and 1
 */
export function calculateNodeOpacity(
  currentFrame: number,
  delayFrames: number,
  fps: number,
  durationFrames: number = NODE_FADE_DURATION_FRAMES
): number {
  return interpolate(
    currentFrame - delayFrames,
    [0, durationFrames],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
}

/**
 * Calculate node scale based on current frame, delay, and fps
 * @param currentFrame - The current frame number
 * @param delayFrames - Delay before animation starts
 * @param fps - Frames per second
 * @param durationFrames - Duration of scale-in in frames (default: NODE_FADE_DURATION_FRAMES)
 * @returns Scale value between 0 and 1
 */
export function calculateNodeScale(
  currentFrame: number,
  delayFrames: number,
  fps: number,
  durationFrames: number = NODE_FADE_DURATION_FRAMES
): number {
  return interpolate(
    currentFrame - delayFrames,
    [0, durationFrames],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
}

/**
 * NodeAnimation component
 * Wraps children with fade-in and scale animation for a diagram node
 */
export const NodeAnimation: React.FC<NodeAnimationProps> = ({
  node,
  delayFrames,
  durationFrames,
  currentFrame,
  children,
}) => {
  const globalFrame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const frame = currentFrame ?? globalFrame;

  const opacity = calculateNodeOpacity(frame, delayFrames, fps, durationFrames);
  const scale = calculateNodeScale(frame, delayFrames, fps, durationFrames);

  return (
    <div
      style={{
        position: 'absolute',
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height,
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      {children}
    </div>
  );
};
