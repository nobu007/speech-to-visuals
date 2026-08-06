/**
 * Main Video Component for Speech-to-Visuals
 * シーン配列を受け取りフレームに応じて適切なシーンをレンダリング
 * シーン間のトランジション処理を含む
 */

import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Audio } from 'remotion';
import { SceneGraph } from '@/types/diagram';
import { DiagramScene } from './DiagramScene';
import { KeyphraseOverlay, type KeyphraseScene } from './KeyphraseOverlay';
import { CaptionOverlay } from './CaptionOverlay';
import type { SrtCaption } from './srt-parser';

/** Video component props */
export interface VideoProps {
  scenes: SceneGraph[];
  audioUrl?: string;
  backgroundColor?: string;
  /** Optional SRT captions for subtitle overlay */
  captions?: SrtCaption[];
}

/**
 * Convert SceneGraph[] to KeyphraseScene[] for KeyphraseOverlay.
 * Computes absolute startMs for each scene from cumulative offsets.
 */
export function scenesToKeyphraseScenes(scenes: SceneGraph[]): KeyphraseScene[] {
  let offset = 0;
  return scenes.map((scene) => {
    const dur = Number.isFinite(scene.durationMs) ? scene.durationMs : 0;
    const entry: KeyphraseScene = {
      startMs: offset,
      durationMs: dur,
      keyphrases: scene.keyphrases ?? [],
    };
    offset += dur;
    return entry;
  });
}

/** Default video properties for Composition defaultProps */
export const defaultVideoProps: VideoProps = {
  scenes: [],
  backgroundColor: '#0f0f23',
  captions: [],
};

/** Default FPS for the composition */
export const DEFAULT_FPS = 30;

/** Default width for the composition (1080p) */
export const DEFAULT_WIDTH = 1920;

/** Default height for the composition (1080p) */
export const DEFAULT_HEIGHT = 1080;

/** Fade transition duration in frames */
const FADE_DURATION_FRAMES = 15;

/**
 * Calculate total frames needed for all scenes
 * @param scenes - Array of SceneGraph objects
 * @param fps - Frames per second (default: 30)
 * @returns Total number of frames across all scenes
 */
export function calculateTotalFrames(scenes: SceneGraph[], fps: number = DEFAULT_FPS): number {
  if (!scenes || scenes.length === 0) {
    return DEFAULT_FPS * 10; // Default 10 seconds at 30fps
  }

  const safeFps = Number.isFinite(fps) && fps > 0 ? fps : DEFAULT_FPS;
  const totalMs = scenes.reduce(
    (sum, scene) => sum + (Number.isFinite(scene.durationMs) ? Math.max(0, scene.durationMs) : 0),
    0,
  );
  const raw = Math.ceil((totalMs / 1000) * safeFps);
  // Guard against overflow when many scenes have extremely large durationMs
  return Number.isFinite(raw) ? Math.max(1, raw) : Number.MAX_SAFE_INTEGER;
}

/**
 * Find the scene that should be displayed at a given time (in ms)
 * @param scenes - Array of SceneGraph objects
 * @param currentTimeMs - Current time in milliseconds
 * @returns Object with the current scene, its index, and time within the scene
 */
export function findSceneAtTime(
  scenes: SceneGraph[],
  currentTimeMs: number
): { scene: SceneGraph; index: number; timeInScene: number } | null {
  let elapsed = 0;
  for (let i = 0; i < scenes.length; i++) {
    const dur = Number.isFinite(scenes[i].durationMs) ? scenes[i].durationMs : 0;
    const sceneEnd = elapsed + dur;
    if (currentTimeMs >= elapsed && currentTimeMs < sceneEnd) {
      return {
        scene: scenes[i],
        index: i,
        timeInScene: currentTimeMs - elapsed,
      };
    }
    elapsed = sceneEnd;
  }
  return null;
}

/**
 * Main Video Component
 * Renders scenes with transitions based on the current frame
 */
export const SpeechToVisualsVideo: React.FC<VideoProps> = ({
  scenes,
  audioUrl,
  backgroundColor = '#0f0f23',
  captions,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Calculate current time in milliseconds
  const currentTimeMs = (frame / Math.max(fps, 1)) * 1000;

  // Find the current scene
  const sceneInfo = findSceneAtTime(scenes, currentTimeMs);

  // Calculate fade in/out opacity.
  // Guard: when durationInFrames is very small (< 2 * FADE_DURATION_FRAMES),
  // the fade-out start point would precede the fade-in end, producing
  // non-monotonic input ranges that cause interpolate() to return NaN.
  const safeDuration = Math.max(durationInFrames, FADE_DURATION_FRAMES * 2);
  const opacity = interpolate(
    frame,
    [0, FADE_DURATION_FRAMES, safeDuration - FADE_DURATION_FRAMES, safeDuration],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Scene transition fade (fade between scenes)
  const SCENE_FADE_FRAMES = 5;
  let sceneTransitionOpacity = 1;
  if (sceneInfo) {
    const sceneStartFrame = Math.round((sceneInfo.timeInScene / 1000) * Math.max(fps, 1));
    const sceneRemainingFrames = Math.round(((Number.isFinite(sceneInfo.scene.durationMs) ? sceneInfo.scene.durationMs : 0) / 1000) * Math.max(fps, 1)) - sceneStartFrame;

    // Fade in at scene start
    const fadeIn = interpolate(sceneStartFrame, [0, SCENE_FADE_FRAMES], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });

    // Fade out at scene end
    const fadeOut = interpolate(sceneRemainingFrames, [0, SCENE_FADE_FRAMES], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });

    sceneTransitionOpacity = Math.min(fadeIn, fadeOut);
  }

  return (
    <AbsoluteFill style={{ backgroundColor }}>
      {/* Audio track */}
      {audioUrl && <Audio src={audioUrl} />}

      {/* Main content */}
      <div style={{ opacity }}>
        {sceneInfo ? (
          <div style={{ opacity: sceneTransitionOpacity }}>
            <DiagramScene
              scene={sceneInfo.scene}
              sceneIndex={sceneInfo.index}
              currentTime={sceneInfo.timeInScene}
            />
          </div>
        ) : (
          <AbsoluteFill
            style={{
              justifyContent: 'center',
              alignItems: 'center',
              color: 'white',
              fontSize: 48,
              fontFamily: 'sans-serif',
            }}
          >
            <div>Preparing...</div>
          </AbsoluteFill>
        )}
      </div>

      {/* Progress bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          left: 40,
          right: 40,
          height: 4,
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            backgroundColor: '#3b82f6',
            width: `${(frame / Math.max(durationInFrames - 1, 1)) * 100}%`,
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      {/* Scene counter */}
      {sceneInfo && scenes.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 20,
            right: 40,
            color: 'white',
            fontSize: 14,
            fontFamily: 'monospace',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            padding: '8px 12px',
            borderRadius: 4,
          }}
        >
          Scene {sceneInfo.index + 1} / {scenes.length}
        </div>
      )}

      {/* Keyphrase overlay — shows scene keyphrases at the top */}
      {scenes.length > 0 && (
        <KeyphraseOverlay scenes={scenesToKeyphraseScenes(scenes)} />
      )}

      {/* Caption overlay — shows SRT subtitles at the bottom */}
      {captions && captions.length > 0 && (
        <CaptionOverlay captions={captions} />
      )}
    </AbsoluteFill>
  );
};
