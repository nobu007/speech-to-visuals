/**
 * KeyphraseOverlay Component
 * Displays scene keyphrases overlaid on the video at the top, with fade-in/fade-out
 * animations timed to the scene duration. Keyphrases are extracted by SceneSegmenter
 * and flow through the pipeline via RemotionSceneData.keyphrases.
 */

import React from 'react';
import { useCurrentFrame, useVideoConfig, AbsoluteFill, interpolate, spring } from 'remotion';

/** Number of frames for fade-in animation */
export const KEYPHRASE_FADE_IN_FRAMES = 8;

/** Number of frames for fade-out animation */
export const KEYPHRASE_FADE_OUT_FRAMES = 8;

/** Default font size for keyphrase tags (in pixels) */
export const KEYPHRASE_FONT_SIZE = 20;

/** Top margin for keyphrase positioning (in pixels) */
export const KEYPHRASE_TOP_MARGIN = 40;

/** Maximum keyphrases to display per scene */
export const MAX_KEYPHRASES_DISPLAY = 5;

/** Tag background color */
const TAG_BG_COLOR = 'rgba(59, 130, 246, 0.75)';

/** Tag border radius */
const TAG_BORDER_RADIUS = 12;

/** Tag padding */
const TAG_PADDING = '6px 14px';

/** Gap between tags */
const TAG_GAP = 8;

/** Props for a single timed keyphrase scene entry */
export interface KeyphraseScene {
  /** Scene start time in milliseconds */
  startMs: number;
  /** Scene duration in milliseconds */
  durationMs: number;
  /** Keyphrases for this scene */
  keyphrases: string[];
}

/** Props for the KeyphraseOverlay component */
export interface KeyphraseOverlayProps {
  /** Array of scenes with their keyphrases and timing */
  scenes: KeyphraseScene[];
  /** Custom styles to apply to the overlay container */
  style?: React.CSSProperties;
  /** Font size override (default: 20px) */
  fontSize?: number;
  /** Tag background color override */
  tagColor?: string;
  /** Text color for tags (default: white) */
  color?: string;
}

/**
 * Convert milliseconds to frame number given fps.
 */
export function msToFrame(ms: number, fps: number): number {
  return Math.round((ms / 1000) * fps);
}

/**
 * Calculate the opacity for keyphrase tags at a given frame.
 * Applies fade-in at the start and fade-out at the end of the scene.
 */
export function calculateKeyphraseOpacity(
  frame: number,
  sceneStartFrame: number,
  sceneEndFrame: number
): number {
  const totalDuration = sceneEndFrame - sceneStartFrame;

  if (frame < sceneStartFrame || frame > sceneEndFrame) {
    return 0;
  }

  const fadeInEnd = sceneStartFrame + KEYPHRASE_FADE_IN_FRAMES;
  const fadeOutStart = sceneEndFrame - KEYPHRASE_FADE_OUT_FRAMES;

  const fadeIn = interpolate(
    frame,
    [sceneStartFrame, fadeInEnd],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const fadeOut = interpolate(
    frame,
    [fadeOutStart, sceneEndFrame],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // For short scenes, ensure visibility at midpoint
  if (totalDuration <= KEYPHRASE_FADE_IN_FRAMES + KEYPHRASE_FADE_OUT_FRAMES) {
    const midpoint = (sceneStartFrame + sceneEndFrame) / 2;
    if (frame >= midpoint - 1 && frame <= midpoint + 1) {
      return Math.min(fadeIn, fadeOut);
    }
  }

  return Math.min(fadeIn, fadeOut);
}

/**
 * Find the active scene for the current frame.
 */
export function getActiveScene(
  scenes: KeyphraseScene[],
  frame: number,
  fps: number
): { scene: KeyphraseScene; startFrame: number; endFrame: number } | null {
  for (const scene of scenes) {
    if (scene.keyphrases.length === 0) continue;
    const startFrame = msToFrame(scene.startMs, fps);
    const endFrame = msToFrame(scene.startMs + scene.durationMs, fps);
    if (frame >= startFrame && frame <= endFrame) {
      return { scene, startFrame, endFrame };
    }
  }
  return null;
}

/**
 * KeyphraseOverlay Component
 * Renders scene keyphrases as styled tags at the top of the video with fade animations.
 */
export const KeyphraseOverlay: React.FC<KeyphraseOverlayProps> = ({
  scenes,
  style,
  fontSize = KEYPHRASE_FONT_SIZE,
  tagColor = TAG_BG_COLOR,
  color = 'white',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const active = getActiveScene(scenes, frame, fps);

  if (!active) {
    return <></>;
  }

  const { scene, startFrame, endFrame } = active;
  const opacity = calculateKeyphraseOpacity(frame, startFrame, endFrame);

  // Stagger animation: each tag fades in slightly after the previous
  const displayKeyphrases = scene.keyphrases.slice(0, MAX_KEYPHRASES_DISPLAY);

  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingTop: KEYPHRASE_TOP_MARGIN,
        ...style,
      }}
    >
      <div
        style={{
          opacity,
          display: 'flex',
          flexWrap: 'wrap',
          gap: TAG_GAP,
          justifyContent: 'center',
          maxWidth: '80%',
        }}
      >
        {displayKeyphrases.map((keyphrase, index) => {
          // Stagger: each tag appears 2 frames after the previous
          const staggerDelay = index * 2;
          const tagStartFrame = startFrame + KEYPHRASE_FADE_IN_FRAMES * 0.5 + staggerDelay;
          const tagOpacity = interpolate(
            frame,
            [tagStartFrame, tagStartFrame + 4],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
          );

          return (
            <span
              key={`${keyphrase}-${index}`}
              style={{
                backgroundColor: tagColor,
                color,
                fontSize,
                fontFamily: 'sans-serif',
                fontWeight: 600,
                padding: TAG_PADDING,
                borderRadius: TAG_BORDER_RADIUS,
                opacity: Math.min(opacity, tagOpacity),
                whiteSpace: 'nowrap',
                letterSpacing: '0.02em',
              }}
            >
              {keyphrase}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
