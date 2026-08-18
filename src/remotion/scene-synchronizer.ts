/**
 * Scene Synchronizer
 * Synchronizes SRT captions with scene animations by converting timestamps
 * to frame numbers, splitting captions at scene boundaries, and detecting
 * synchronization drift.
 *
 * Sync precision target: ±50ms (±1.5 frames at 30fps, ±1 frame = ±33ms)
 */

import type { SrtCaption } from './srt-parser';
import { sanitizeFinite } from '@stv/core/utils/guards';

/**
 * Default FPS used throughout the project — the single source of truth.
 *
 * Previously this value (30) was independently redeclared in `Video.tsx` and
 * `srt-parser.ts`, and inlined as a bare `|| 30` fallback across the pipeline
 * and export layers. Every copy coincided, so a behavioral RED→GREEN was
 * impossible, but they were coupled only by coincidence: changing the default
 * frame rate here would silently desync frame math, the registered composition,
 * SRT parsing, and the export FPS-normalization. Every consumer imports this
 * constant (see __tests__/default-fps-coupling.test.ts). The `import type`
 * above keeps this module a runtime leaf so `srt-parser` may import the value
 * back without a cycle.
 */
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
 * @param ms - Time in milliseconds (negative values clamped to 0)
 * @param fps - Frames per second (must be a finite positive number, defaults to DEFAULT_FPS)
 * @returns Frame number (rounded to nearest integer, minimum 0)
 */
export function msToFrame(ms: number, fps: number = DEFAULT_FPS): number {
  // `<= 0` alone admits Infinity and NaN (both compare false to <= 0), which
  // would make `(ms / 1000) * fps` yield Infinity/NaN frame numbers and break
  // the caption binary-search. Callers pass `input.fps ?? DEFAULT_FPS`, which
  // only catches null/undefined — so a non-finite fps must fall back here.
  if (!Number.isFinite(fps) || fps <= 0) fps = DEFAULT_FPS;
  if (ms <= 0) return 0;
  return Math.round((ms / 1000) * fps);
}

/**
 * Convert a frame number to milliseconds at a given FPS.
 *
 * @param frame - Frame number (negative values clamped to 0)
 * @param fps - Frames per second (must be a finite positive number, defaults to DEFAULT_FPS)
 * @returns Time in milliseconds
 */
export function frameToMs(frame: number, fps: number = DEFAULT_FPS): number {
  if (!Number.isFinite(fps) || fps <= 0) fps = DEFAULT_FPS;
  if (frame <= 0) return 0;
  return (frame / fps) * 1000;
}

/**
 * Get the caption that should be displayed at a given frame.
 * Uses binary search (O(log n)) on sorted captions for efficient lookup.
 *
 * @param captions - Array of parsed SRT captions (should be sorted by startFrame)
 * @param frame - Current frame number
 * @returns The matching caption, or null if no caption is active
 */
export function getCaptionForFrame(
  captions: SrtCaption[],
  frame: number
): SrtCaption | null {
  if (captions.length === 0 || frame < 0) return null;

  // Binary search: find the last caption whose startFrame <= frame
  let lo = 0;
  let hi = captions.length - 1;
  let candidate: SrtCaption | null = null;

  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const cap = captions[mid];
    if (cap.startFrame <= frame) {
      candidate = cap;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  // Verify the candidate actually covers the frame
  if (candidate && frame <= candidate.endFrame) {
    return candidate;
  }
  return null;
}

/**
 * Get all captions that overlap with a given frame.
 * Useful when captions may intentionally overlap (e.g., bilingual subtitles).
 *
 * @param captions - Array of parsed SRT captions
 * @param frame - Current frame number
 * @returns Array of all matching captions
 */
export function getAllCaptionsForFrame(
  captions: SrtCaption[],
  frame: number
): SrtCaption[] {
  if (captions.length === 0 || frame < 0) return [];
  const result: SrtCaption[] = [];
  for (const caption of captions) {
    if (frame >= caption.startFrame && frame <= caption.endFrame) {
      result.push(caption);
    }
  }
  return result;
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
    elapsed += sanitizeFinite(scene.durationMs);
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
    elapsed += sanitizeFinite(scene.durationMs);
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
    cumulative += sanitizeFinite(scene.durationMs);
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
    // Skip degenerate segments (0ms duration)
    const segDuration = times[i + 1] - times[i];
    if (segDuration <= 0) continue;

    segments.push({
      index: caption.index,
      startMs: times[i],
      endMs: times[i + 1],
      text: caption.text,
      startFrame: msToFrame(times[i], fps),
      endFrame: msToFrame(times[i + 1], fps),
    });
  }

  // If all segments were degenerate, return the original caption
  if (segments.length === 0) {
    return [caption];
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
  const totalSceneMs = scenes.reduce((sum, s) => sum + sanitizeFinite(s.durationMs), 0);

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
    const startDriftMs = startFrameDiff * (1000 / Math.max(fps, 1));
    const endDriftMs = endFrameDiff * (1000 / Math.max(fps, 1));
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
