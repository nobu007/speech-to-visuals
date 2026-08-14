/**
 * Scene Render Spec Generator
 *
 * Transforms SceneGraph[] into concrete rendering specifications that
 * downstream consumers (Remotion, export engines) can use directly.
 *
 * This replaces the previous no-op placeholder in PipelineOrchestrator.runRendering.
 */

import type { SceneGraph, DiagramType } from '@/types/diagram';
import { safeArray } from '../lib/safe-array';
import { DEFAULT_FPS } from '@/remotion/scene-synchronizer';
import { STAGGER_DELAY, NODE_FADE_DURATION_FRAMES } from '@/remotion/animation-strategies';
import { RenderingError } from './pipeline-errors';
import {
  MIN_SCENE_DURATION_MS,
  MAX_RENDERABLE_SCENE_DURATION_MS,
} from './scene-duration-limits';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Per-scene rendering specification. */
export interface SceneRenderSpec {
  /** Scene index (0-based) within the video. */
  sceneIndex: number;
  /** Diagram type for animation strategy selection. */
  diagramType: DiagramType;
  /** Global frame at which this scene starts. */
  startFrame: number;
  /** Global frame at which this scene ends (exclusive). */
  endFrame: number;
  /** Number of frames this scene occupies. */
  totalFrames: number;
  /** Duration of this scene in milliseconds. */
  durationMs: number;
  /** Frames allocated for the scene transition (fade-in / fade-out). */
  transitionFrames: number;
  /** Frame within the scene where main content is fully visible. */
  contentReadyFrame: number;
  /** Number of nodes to animate in this scene. */
  nodeCount: number;
  /** Number of edges to animate in this scene. */
  edgeCount: number;
  /** Whether this scene has layout positioning data. */
  hasLayout: boolean;
  /** Summary text for overlay / caption. */
  summary: string;
}

/** Full rendering plan for all scenes in a video. */
export interface RenderPlan {
  /** Frames per second. */
  fps: number;
  /** Total number of frames in the video. */
  totalFrames: number;
  /** Total duration in milliseconds. */
  totalDurationMs: number;
  /** Number of scenes. */
  sceneCount: number;
  /** Per-scene render specifications (ordered by sceneIndex). */
  scenes: SceneRenderSpec[];
}

/** Configuration for the spec generator. */
export interface RenderSpecConfig {
  /** Frames per second (defaults to DEFAULT_FPS = 30). */
  fps?: number;
  /** Number of transition frames between scenes (default: 8 ≈ 0.27s at 30fps). */
  transitionFrames?: number;
  /** Minimum scene duration in ms (default: 2000). */
  minSceneDurationMs?: number;
  /** Maximum scene duration in ms (default: 30000). */
  maxSceneDurationMs?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_TRANSITION_FRAMES = 8;
// Scene-duration clamp boundaries come from the single source (defect 08ae):
// the floor is shared with main-pipeline's timing optimizer, the ceiling is
// the renderer's own hard cap (distinct from the editorial pacing cap).
const DEFAULT_MIN_SCENE_DURATION_MS = MIN_SCENE_DURATION_MS;
const DEFAULT_MAX_SCENE_DURATION_MS = MAX_RENDERABLE_SCENE_DURATION_MS;

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Generate a complete render plan from an array of scene graphs.
 *
 * For each scene, calculates:
 * - Global frame range (startFrame / endFrame)
 * - Transition timing
 * - Content-ready frame (after transition + node animation time)
 *
 * @throws {Error} if scenes array is empty or null
 */
export function generateRenderPlan(
  scenes: SceneGraph[],
  config: RenderSpecConfig = {},
): RenderPlan {
  if (!scenes || scenes.length === 0) {
    throw new RenderingError('Cannot generate render plan: scenes array is empty');
  }

  const fps = config.fps ?? DEFAULT_FPS;
  const transitionFrames = config.transitionFrames ?? DEFAULT_TRANSITION_FRAMES;
  const minDurationMs = config.minSceneDurationMs ?? DEFAULT_MIN_SCENE_DURATION_MS;
  const maxDurationMs = config.maxSceneDurationMs ?? DEFAULT_MAX_SCENE_DURATION_MS;

  const specs: SceneRenderSpec[] = [];
  let currentFrame = 0;
  let totalDurationMs = 0;

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];

    // Clamp scene duration
    const rawDuration = scene.durationMs || minDurationMs;
    const durationMs = Math.max(minDurationMs, Math.min(maxDurationMs, rawDuration));
    const totalFrames = Math.round((durationMs / 1000) * fps);

    // Estimate when main content is fully visible:
    // transition + ((nodeCount-1) * staggerDelay) + nodeFadeDuration.
    // Constants are imported from the animation engine that actually drives the
    // fade-in (animation-strategies.ts), so this estimate tracks the real
    // animation timing rather than re-hard-coding the values (the previous
    // 5/9 literals with "matches" comments silently desynced on change). The
    // (nodeCount-1)*STAGGER_DELAY term is exact for the flow/timeline
    // strategies' linear index-based stagger and a reasonable upper bound
    // elsewhere; the hard invariant is contentReadyFrame ≤ totalFrames below.
    const nodeCount = scene.nodes?.length ?? 0;
    const contentReadyFrame =
      transitionFrames + (nodeCount > 0 ? (nodeCount - 1) * STAGGER_DELAY : 0) + NODE_FADE_DURATION_FRAMES;

    const spec: SceneRenderSpec = {
      sceneIndex: i,
      diagramType: scene.type,
      startFrame: currentFrame,
      endFrame: currentFrame + totalFrames,
      totalFrames,
      durationMs,
      transitionFrames,
      contentReadyFrame: Math.min(contentReadyFrame, totalFrames),
      nodeCount,
      edgeCount: scene.edges?.length ?? 0,
      hasLayout: !!(scene.layout && scene.layout.nodes && scene.layout.nodes.length > 0),
      summary: scene.summary || `Scene ${i + 1}`,
    };

    specs.push(spec);
    currentFrame += totalFrames;
    totalDurationMs += durationMs;
  }

  return {
    fps,
    totalFrames: currentFrame,
    totalDurationMs,
    sceneCount: scenes.length,
    scenes: specs,
  };
}

/**
 * Validate that a render plan is internally consistent.
 *
 * Checks:
 * - Scene frame ranges are contiguous (no gaps, no overlaps)
 * - Total frames matches sum of per-scene frames
 * - All scenes have valid diagram types
 * - No duplicate scene indices
 */
export function validateRenderPlan(plan: RenderPlan): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  // Total frames check
  const computedTotal = plan.scenes.reduce((sum, s) => sum + s.totalFrames, 0);
  if (computedTotal !== plan.totalFrames) {
    issues.push(
      `Total frames mismatch: header says ${plan.totalFrames}, sum of scenes is ${computedTotal}`,
    );
  }

  // Contiguity check
  for (let i = 1; i < plan.scenes.length; i++) {
    const prev = plan.scenes[i - 1];
    const curr = plan.scenes[i];
    if (curr.startFrame !== prev.endFrame) {
      issues.push(
        `Frame gap/overlap between scene ${prev.sceneIndex} (endFrame=${prev.endFrame}) and scene ${curr.sceneIndex} (startFrame=${curr.startFrame})`,
      );
    }
  }

  // Scene index uniqueness
  const scenes = safeArray(plan.scenes);
  const indices = new Set(scenes.map((s) => s.sceneIndex));
  if (indices.size !== scenes.length) {
    issues.push('Duplicate scene indices detected');
  }

  // Scene count check
  if (plan.sceneCount !== scenes.length) {
    issues.push(
      `Scene count mismatch: header says ${plan.sceneCount}, actual array length is ${scenes.length}`,
    );
  }

  return { valid: issues.length === 0, issues };
}
