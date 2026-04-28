/**
 * Scene Synchronizer
 * Synchronizes SRT captions with scene animations by converting timestamps
 * to frame numbers, splitting captions at scene boundaries, and detecting
 * synchronization drift.
 *
 * Sync precision target: ±50ms (±1.5 frames at 30fps, ±1 frame = ±33ms)
 */

import { SrtCaption } from './srt-parser';

/** Default FPS used throughout the project */
export const DEFAULT_FPS = 30;

/** Maximum acceptable drift in milliseconds */
export const MAX_DRIFT_MS = 50;

/**
 * Result of validating scene-caption synchronization
 */
export interface SyncValidationResult {
  /** Whether all captions are within acceptable sync tolerance */
  valid: boolean;
  /** List of issues found during validation */
  issues: string[];
}

/**
 * Per-caption drift information
 */
export interface CaptionDriftInfo {
  /** Caption index */
  index: number;
  /** Drift at start time in ms */
  startDriftMs: number;
  /** Drift at end time in ms */
  endDriftMs: number;
  /** Maximum drift (absolute) for this caption in ms */
  driftMs: number;
}

/**
 * Result of sync drift detection
 */
export interface SyncDriftResult {
  /** Maximum drift found across all captions in ms */
  maxDriftMs: number;
  /** Maximum drift in frames */
  maxDriftFrames: number;
  /** Whether all captions are within ±50ms tolerance */
  withinTolerance: boolean;
  /** Per-caption drift details */
  driftPerCaption: CaptionDriftInfo[];
}

/**
 * Convert milliseconds to frame number at a given FPS.
 * Uses rounding for the closest frame match.
 *
 * @param ms - Time in milliseconds
 * @param fps - Frames per second
 * @returns Frame number (rounded to nearest integer)
 */
export function msToFrame(ms: number, fps: number): number {
  return Math.round((ms / 1000) * fps);
}

/**
 * Convert a frame number to milliseconds at a given FPS.
 *
 * @param frame - Frame number
 * @param fps - Frames per second
 * @returns Time in milliseconds
 */
export function frameToMs(frame: number, fps: number): number {
  return (frame / fps) * 1000;
}

/**
 * Get the caption that should be displayed at a given frame.
 *
 * @param captions - Array of parsed SRT captions
 * @param frame - Current frame number
 * @returns The matching caption, or null if no caption is active
 */
export function getCaptionForFrame(
  captions: SrtCaption[],
  frame: number
): SrtCaption | null {
  for (const caption of captions) {
    if (frame >= caption.startFrame && frame <= caption.endFrame) {
      return caption;
    }
  }
  return null;
}

/**
 * Get scene boundary timestamps from an array of scenes.
 *
 * @param scenes - Array of SceneGraph objects
 * @returns Sorted array of boundary timestamps in ms (each scene start/end)
 */
function getSceneBoundaries(scenes: { durationMs: number }[]): number[] {
  const boundaries: number[] = [];
  let elapsed = 0;

  for (const scene of scenes) {
    boundaries.push(elapsed);
    elapsed += scene.durationMs;
    boundaries.push(elapsed);
  }

  return boundaries;
}

/**
 * Get scene start times as an array.
 *
 * @param scenes - Array of SceneGraph objects
 * @returns Array of cumulative start times in ms for each scene
 */
function getSceneStartTimes(scenes: { durationMs: number }[]): number[] {
  const starts: number[] = [];
  let elapsed = 0;

  for (const scene of scenes) {
    starts.push(elapsed);
    elapsed += scene.durationMs;
  }

  return starts;
}

/**
 * Split a caption at scene boundaries if it spans multiple scenes.
 * Each resulting segment retains the original text and gets updated frame numbers.
 *
 * @param caption - The caption to split
 * @param scenes - Array of scenes to use as boundaries
 * @param fps - Frames per second
 * @returns Array of caption segments (may be the original if no split needed)
 */
export function splitCaptionAtSceneBoundary(
  caption: SrtCaption,
  scenes: { durationMs: number }[],
  fps: number
): SrtCaption[] {
  if (scenes.length === 0) {
    return [caption];
  }

  // Collect all scene boundaries (cumulative start times + end)
  const boundaries: number[] = [0];
  let cumulative = 0;
  for (const scene of scenes) {
    cumulative += scene.durationMs;
    boundaries.push(cumulative);
  }

  // Find internal boundaries that fall within the caption's time range
  const splitPoints: number[] = [];
  for (const boundary of boundaries) {
    if (boundary > caption.startMs && boundary < caption.endMs) {
      splitPoints.push(boundary);
    }
  }

  // No split needed if no boundaries fall within the caption
  if (splitPoints.length === 0) {
    return [caption];
  }

  // Split the caption at each boundary
  const segments: SrtCaption[] = [];
  const times = [caption.startMs, ...splitPoints, caption.endMs];

  for (let i = 0; i < times.length - 1; i++) {
    segments.push({
      index: caption.index,
      startMs: times[i],
      endMs: times[i + 1],
      text: caption.text,
      startFrame: msToFrame(times[i], fps),
      endFrame: msToFrame(times[i + 1], fps),
    });
  }

  return segments;
}

/**
 * Validate that captions are properly synchronized with scene boundaries.
 * Checks for captions that extend beyond scene boundaries.
 *
 * @param scenes - Array of scenes
 * @param captions - Array of parsed captions
 * @param fps - Frames per second
 * @returns Validation result with issues list
 */
export function validateSceneCaptionSync(
  scenes: { durationMs: number }[],
  captions: SrtCaption[],
  fps: number
): SyncValidationResult {
  const issues: string[] = [];

  if (scenes.length === 0 || captions.length === 0) {
    return { valid: true, issues: [] };
  }

  // Calculate total scene duration
  const totalSceneMs = scenes.reduce((sum, s) => sum + s.durationMs, 0);

  // Get scene start times for boundary checking
  const sceneStarts = getSceneStartTimes(scenes);

  for (const caption of captions) {
    // Check if caption extends past the total scene duration
    if (caption.endMs > totalSceneMs) {
      issues.push(
        `Caption #${caption.index} ends at ${caption.endMs}ms but total scene duration is ${totalSceneMs}ms (extends ${caption.endMs - totalSceneMs}ms past end)`
      );
    }

    // Check if caption starts before the first scene
    if (caption.startMs < 0) {
      issues.push(
        `Caption #${caption.index} starts at ${caption.startMs}ms which is before the first scene`
      );
    }

    // Check if caption spans across scene boundaries without proper alignment
    for (let i = 0; i < sceneStarts.length - 1; i++) {
      const sceneStart = sceneStarts[i];
      const sceneEnd = sceneStarts[i + 1];

      // Caption starts in this scene and extends into the next
      if (
        caption.startMs >= sceneStart &&
        caption.startMs < sceneEnd &&
        caption.endMs > sceneEnd
      ) {
        // This is informational - captions CAN span scenes,
        // but it's worth noting for synchronization awareness
        // Only flag as issue if the overlap is significant (>100ms into next scene)
        const overlapMs = caption.endMs - sceneEnd;
        if (overlapMs > 100) {
          issues.push(
            `Caption #${caption.index} spans scene boundary at ${sceneEnd}ms (overlaps ${overlapMs}ms into next scene)`
          );
        }
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Detect synchronization drift between caption timestamps and frame numbers.
 * Compares the expected frame number (from ms) with the stored frame number.
 *
 * @param captions - Array of parsed captions
 * @param fps - Frames per second
 * @returns Drift analysis result
 */
export function detectSyncDrift(
  captions: SrtCaption[],
  fps: number
): SyncDriftResult {
  if (captions.length === 0) {
    return {
      maxDriftMs: 0,
      maxDriftFrames: 0,
      withinTolerance: true,
      driftPerCaption: [],
    };
  }

  let maxDriftMs = 0;
  let maxDriftFrames = 0;
  const driftPerCaption: CaptionDriftInfo[] = [];

  for (const caption of captions) {
    // Calculate expected frames from the ms timestamps
    const expectedStartFrame = msToFrame(caption.startMs, fps);
    const expectedEndFrame = msToFrame(caption.endMs, fps);

    // Calculate the drift between stored and expected frames
    const startFrameDiff = Math.abs(caption.startFrame - expectedStartFrame);
    const endFrameDiff = Math.abs(caption.endFrame - expectedEndFrame);

    // Convert frame differences to ms
    const startDriftMs = startFrameDiff * (1000 / fps);
    const endDriftMs = endFrameDiff * (1000 / fps);
    const captionDriftMs = Math.max(startDriftMs, endDriftMs);

    maxDriftMs = Math.max(maxDriftMs, captionDriftMs);
    maxDriftFrames = Math.max(maxDriftFrames, startFrameDiff, endFrameDiff);

    driftPerCaption.push({
      index: caption.index,
      startDriftMs,
      endDriftMs,
      driftMs: captionDriftMs,
    });
  }

  return {
    maxDriftMs,
    maxDriftFrames,
    withinTolerance: maxDriftMs <= MAX_DRIFT_MS,
    driftPerCaption,
  };
}
