/**
 * CaptionOverlay Component
 * Displays SRT captions overlaid on the video at the correct timing.
 * Handles fade-in/fade-out animation, multi-line support, and bottom-center positioning.
 */

import React from 'react';
import { useCurrentFrame, useVideoConfig, AbsoluteFill, interpolate } from 'remotion';
import { SrtCaption } from './srt-parser';

/** Maximum characters per line for readability */
export const MAX_CHARS_PER_LINE = 42;

/** Maximum number of lines recommended for captions */
export const MAX_LINES = 2;

/** Number of frames for fade-in animation */
const FADE_IN_FRAMES = 5;

/** Number of frames for fade-out animation */
const FADE_OUT_FRAMES = 5;

/** Default background opacity for caption background */
const CAPTION_BG_OPACITY = 0.7;

/** Default font size for captions (in pixels) */
const CAPTION_FONT_SIZE = 36;

/** Bottom margin for caption positioning (in pixels) */
const CAPTION_BOTTOM_MARGIN = 60;

/** Props for the CaptionOverlay component */
export interface CaptionOverlayProps {
  /** Array of parsed SRT captions */
  captions: SrtCaption[];
  /** Custom styles to apply to the overlay container */
  style?: React.CSSProperties;
  /** Font size override (default: 36px) */
  fontSize?: number;
  /** Caption text color (default: white) */
  color?: string;
  /** Background color for the caption area (default: semi-transparent black) */
  backgroundColor?: string;
}

/**
 * Calculate the opacity of a caption at a given frame.
 * Applies fade-in at the start and fade-out at the end.
 *
 * @param frame - Current frame number
 * @param caption - The caption to calculate opacity for
 * @returns Opacity value between 0 and 1
 */
export function calculateCaptionOpacity(
  frame: number,
  caption: SrtCaption
): number {
  const { startFrame, endFrame } = caption;
  const totalDuration = endFrame - startFrame;

  // Before start: invisible
  if (frame < startFrame) {
    return 0;
  }

  // After end: invisible
  if (frame > endFrame) {
    return 0;
  }

  // Calculate fade-in (start to start + FADE_IN_FRAMES)
  const fadeInEnd = startFrame + FADE_IN_FRAMES;
  const fadeIn = interpolate(
    frame,
    [startFrame, fadeInEnd],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Calculate fade-out (end - FADE_OUT_FRAMES to end)
  const fadeOutStart = endFrame - FADE_OUT_FRAMES;
  const fadeOut = interpolate(
    frame,
    [fadeOutStart, endFrame],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // For very short captions, ensure we don't get stuck at 0
  if (totalDuration <= FADE_IN_FRAMES + FADE_OUT_FRAMES) {
    // Simple approach: just use the minimum of fade-in and fade-out
    // but ensure we can still see the caption in the middle
    const midpoint = (startFrame + endFrame) / 2;
    if (frame >= midpoint - 1 && frame <= midpoint + 1) {
      return Math.min(fadeIn, fadeOut);
    }
  }

  return Math.min(fadeIn, fadeOut);
}

/**
 * Get the active caption text for a given frame.
 *
 * @param captions - Array of SRT captions
 * @param frame - Current frame number
 * @returns The active caption text, or null if no caption is active
 */
export function getActiveCaptionText(
  captions: SrtCaption[],
  frame: number
): string | null {
  for (const caption of captions) {
    if (frame >= caption.startFrame && frame <= caption.endFrame) {
      return caption.text;
    }
  }
  return null;
}

/**
 * Split caption text into lines that fit within MAX_CHARS_PER_LINE.
 *
 * @param text - Caption text (may contain newlines)
 * @returns Array of lines
 */
function splitCaptionLines(text: string): string[] {
  // First split by existing newlines
  const existingLines = text.split('\n');

  const result: string[] = [];
  for (const line of existingLines) {
    if (line.length <= MAX_CHARS_PER_LINE) {
      result.push(line);
    } else {
      // Split long lines at word boundaries
      const words = line.split(' ');
      let currentLine = '';

      for (const word of words) {
        if (currentLine.length === 0) {
          currentLine = word;
        } else if (currentLine.length + 1 + word.length <= MAX_CHARS_PER_LINE) {
          currentLine += ' ' + word;
        } else {
          result.push(currentLine);
          currentLine = word;
        }
      }

      if (currentLine.length > 0) {
        result.push(currentLine);
      }
    }
  }

  // Limit to MAX_LINES
  return result.slice(0, MAX_LINES);
}

/**
 * CaptionOverlay Component
 * Renders SRT captions at the correct timing with fade animations.
 * Positioned at the bottom center of the video.
 */
export const CaptionOverlay: React.FC<CaptionOverlayProps> = ({
  captions,
  style,
  fontSize = CAPTION_FONT_SIZE,
  color = 'white',
  backgroundColor = `rgba(0, 0, 0, ${CAPTION_BG_OPACITY})`,
}) => {
  const frame = useCurrentFrame();

  // Find the active caption
  const activeCaption = captions.find(
    (c) => frame >= c.startFrame && frame <= c.endFrame
  ) ?? null;

  // If no active caption, render nothing
  if (!activeCaption) {
    return <></>;
  }

  // Calculate opacity with fade-in/fade-out
  const opacity = calculateCaptionOpacity(frame, activeCaption);

  // Split text into lines
  const lines = splitCaptionLines(activeCaption.text);

  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-end',
        paddingBottom: CAPTION_BOTTOM_MARGIN,
        ...style,
      }}
    >
      <div
        style={{
          opacity,
          backgroundColor,
          color,
          fontSize,
          fontFamily: 'sans-serif',
          fontWeight: 'bold',
          textAlign: 'center',
          padding: '8px 16px',
          borderRadius: 8,
          maxWidth: '80%',
          lineHeight: 1.4,
        }}
      >
        {lines.join('\n')}
      </div>
    </AbsoluteFill>
  );
};
