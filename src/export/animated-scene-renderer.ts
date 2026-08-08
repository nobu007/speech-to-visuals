/**
 * Animated Scene Renderer — extracted from EnhancedExportEngine
 *
 * REQ-218: Scene-driven animated SVG export with CSS keyframes
 * REQ-219: Scene-driven Lottie 5.7.4 compatible JSON export
 * REQ-221: Input validation for animated-scene-renderer functions
 *
 * These pure functions take scene data and produce structured output,
 * making them independently testable without the full export pipeline.
 */

import { escapeXml } from './xml-escape';
import { roundTo } from '../lib/metrics-utils';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SceneItem {
  duration?: number;
  label?: string;
  type?: string;
  [key: string]: unknown;
}

export interface SceneDataset {
  scenes?: SceneItem[];
  [key: string]: unknown;
}

export interface FrameInfo {
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// REQ-221: Input validation
// ---------------------------------------------------------------------------

const DEFAULT_WIDTH = 1920;
const DEFAULT_HEIGHT = 1080;
const MIN_DIMENSION = 1;
const MAX_DIMENSION = 7680; // 8K

export class SceneRendererValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
  ) {
    super(message);
    this.name = 'SceneRendererValidationError';
  }
}

/** Validate and normalise FrameInfo, clamping dimensions to sane bounds. */
export function validateFrameInfo(frames: FrameInfo): FrameInfo {
  let { width, height } = frames;

  if (typeof width !== 'number' || !Number.isFinite(width) || width <= 0) {
    width = DEFAULT_WIDTH;
  } else if (width < MIN_DIMENSION) {
    width = MIN_DIMENSION;
  } else if (width > MAX_DIMENSION) {
    width = MAX_DIMENSION;
  }

  if (typeof height !== 'number' || !Number.isFinite(height) || height <= 0) {
    height = DEFAULT_HEIGHT;
  } else if (height < MIN_DIMENSION) {
    height = MIN_DIMENSION;
  } else if (height > MAX_DIMENSION) {
    height = MAX_DIMENSION;
  }

  return { width: Math.round(width), height: Math.round(height) };
}

/** Clamp a scene's duration to a positive, finite value (default 2s). */
export function clampSceneDuration(duration: unknown): number {
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) {
    return 2;
  }
  return Math.min(duration, 3600); // cap at 1 hour
}

/**
 * Resolve a scene's duration in SECONDS for the export renderers.
 *
 * Two scene shapes reach these pure renderers:
 *   - ad-hoc `SceneItem` data carrying an explicit `duration` field (seconds);
 *   - pipeline `SceneGraph`, which carries `durationMs` (milliseconds) and NO
 *     `duration` field.
 * Reading only `scene.duration` made every pipeline-fed scene fall through to
 * the default, so the exported SVG/Lottie animation timing was unrelated to the
 * real scene lengths. Prefer the explicit seconds `duration`; otherwise convert
 * `durationMs`. Returns undefined when neither is a finite number (the caller's
 * clamp then applies its own default).
 */
export function sceneDurationSeconds(scene: {
  duration?: unknown;
  durationMs?: unknown;
}): number | undefined {
  if (typeof scene.duration === 'number' && Number.isFinite(scene.duration)) {
    return scene.duration;
  }
  if (typeof scene.durationMs === 'number' && Number.isFinite(scene.durationMs)) {
    return scene.durationMs / 1000;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// REQ-218: Animated SVG
// ---------------------------------------------------------------------------

/**
 * Generate an animated SVG string from scene data.
 *
 * Each scene becomes a `<g>` group with a CSS `@keyframes` opacity animation
 * that fades in, holds, then fades out according to its proportional duration.
 */
export function generateAnimatedSVG(
  sceneData: SceneDataset,
  frames: FrameInfo,
): string {
  const scenes = sceneData?.scenes ?? [];
  const { width, height } = validateFrameInfo(frames);

  if (scenes.length === 0) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="${width}" height="${height}" fill="#0a0a0a"/>
  <text x="${width / 2}" y="${height / 2}" text-anchor="middle" dominant-baseline="middle" fill="#e0e0e0" font-family="system-ui,sans-serif" font-size="24">No scene data</text>
</svg>`;
  }

  const totalDuration = scenes.length > 0
    ? scenes.reduce((acc, s) => acc + clampSceneDuration(sceneDurationSeconds(s)), 0)
    : 0;
  const safeDuration = totalDuration > 0 ? totalDuration : scenes.length;
  const keyframes: string[] = [];
  const sceneGroups: string[] = [];
  let offset = 0;

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const duration = clampSceneDuration(sceneDurationSeconds(scene));
    const startPct = roundTo((offset / safeDuration) * 100, 2);
    const fadeInEnd = roundTo(Math.min(startPct + 3, ((offset + duration * 0.15) / safeDuration) * 100), 2);
    const fadeOutStart = roundTo(((offset + duration * 0.85) / safeDuration) * 100, 2);
    const endPct = roundTo(((offset + duration) / safeDuration) * 100, 2);

    const animName = `s${i}`;
    keyframes.push(`@keyframes ${animName}{0%,${startPct}%{opacity:0}${fadeInEnd}%{opacity:1}${fadeOutStart}%{opacity:1}${endPct}%,100%{opacity:0}}`);

    const label = escapeXml(String(scene.label ?? scene.type ?? `Scene ${i + 1}`));
    const bgFill = scene.type === 'intro' ? '#1a1a2e' : scene.type === 'outro' ? '#0f3460' : '#16213e';
    const fontSize = scene.type === 'intro' ? 48 : scene.type === 'outro' ? 36 : 24;

    sceneGroups.push(`<g style="animation:${animName} ${safeDuration}s linear infinite;opacity:0"><rect width="${width}" height="${height}" fill="${bgFill}" rx="8"/><text x="${width / 2}" y="${height / 2}" text-anchor="middle" dominant-baseline="middle" fill="#e0e0e0" font-family="system-ui,sans-serif" font-size="${fontSize}" font-weight="bold">${label}</text><text x="${width / 2}" y="${height / 2 + fontSize + 20}" text-anchor="middle" fill="#a0a0a0" font-family="system-ui,sans-serif" font-size="16">${escapeXml(formatSceneSubtitle(scene))}</text></g>`);

    offset += duration;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
<style>${keyframes.join('')}</style>
<rect width="${width}" height="${height}" fill="#0a0a0a"/>
${sceneGroups.join('\n')}
</svg>`;
}

// ---------------------------------------------------------------------------
// REQ-219: Lottie JSON
// ---------------------------------------------------------------------------

/**
 * Generate a Lottie 5.7.4 compatible JSON animation from scene data.
 *
 * Each scene maps to a shape layer (ty=4) with opacity keyframes for
 * fade-in / hold / fade-out and sequential frame offsets.
 */
export function generateLottieAnimation(
  sceneData: SceneDataset,
  frames: FrameInfo,
  fallbackFrameCount = 0,
): Record<string, unknown> {
  const scenes = sceneData?.scenes ?? [];
  const fps = 30;
  const { width, height } = validateFrameInfo(frames);
  let frameOffset = 0;

  const layers = scenes.map((scene, i) => {
    const duration = clampSceneDuration(sceneDurationSeconds(scene));
    const totalFrames = Math.round(duration * fps);
    const label = String(scene.label ?? scene.type ?? `Scene ${i + 1}`);
    const layer: Record<string, unknown> = {
      ddd: 0,
      ind: i,
      ty: 4, // shape layer
      nm: label,
      sr: 1,
      ks: {
        o: { a: 1, k: [
          { t: frameOffset, s: [0], e: [100] },
          { t: frameOffset + Math.round(fps * 0.3), s: [100], e: [100] },
          { t: frameOffset + totalFrames - Math.round(fps * 0.3), s: [100], e: [0] },
          { t: frameOffset + totalFrames, s: [0] },
        ] },
        p: { a: 0, k: [width / 2, height / 2, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [100, 100, 100] },
        r: { a: 0, k: 0 },
      },
      ip: frameOffset,
      op: frameOffset + totalFrames,
      st: frameOffset,
      shapes: buildLayerShapes(scene, width, height),
    };
    frameOffset += totalFrames;
    return layer;
  });

  return {
    v: "5.7.4",
    fr: fps,
    ip: 0,
    op: frameOffset || fallbackFrameCount,
    w: width,
    h: height,
    nm: "AudioDiagramAnimation",
    layers,
    meta: { g: "Speech-to-Visuals", d: `${layers.length} layer(s)` },
  };
}

// ---------------------------------------------------------------------------
// Shared helpers (exported for testability)
// ---------------------------------------------------------------------------
//
// escapeXml is the canonical XML/SVG escaper and lives in ./xml-escape so every
// SVG emitter shares one definition (previously this file and
// multi-format-exporter.ts each kept a private byte-identical copy that could
// drift apart). It is imported at the top of this module for local use and
// re-exported here to preserve the existing public surface used by the XSS /
// escape fuzz suites.
export { escapeXml };

export function formatSceneSubtitle(scene: SceneItem): string {
  const d = clampSceneDuration(scene.duration);
  const mins = Math.floor(d / 60);
  const secs = Math.round(d % 60);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

// ---------------------------------------------------------------------------
// REQ-219: Lottie shape helpers
// ---------------------------------------------------------------------------

/** Map scene type to Lottie fill color (0–1 RGBA range). */
export function sceneTypeToFillColor(sceneType?: string): number[] {
  switch (sceneType) {
    case 'intro':  return [0.102, 0.102, 0.180, 1]; // #1a1a2e
    case 'outro':  return [0.059, 0.204, 0.376, 1]; // #0f3460
    default:       return [0.086, 0.129, 0.243, 1]; // #16213e
  }
}

/** Build the `shapes` array for a Lottie shape layer. */
export function buildLayerShapes(
  scene: SceneItem,
  width: number,
  height: number,
): Record<string, unknown>[] {
  const fill = sceneTypeToFillColor(scene.type);
  return [
    {
      ty: 'gr',
      it: [
        {
          ty: 'rc',
          d: 1,
          s: { a: 0, k: [width, height] },
          p: { a: 0, k: [0, 0] },
          r: { a: 0, k: 8 },
          nm: 'Background Rect',
        },
        {
          ty: 'fl',
          c: { a: 0, k: fill },
          o: { a: 0, k: 100 },
          r: 1,
          nm: 'Background Fill',
        },
        {
          ty: 'tr',
          p: { a: 0, k: [0, 0] },
          a: { a: 0, k: [0, 0] },
          s: { a: 0, k: [100, 100] },
          r: { a: 0, k: 0 },
          o: { a: 0, k: 100 },
        },
      ],
      nm: 'Background Group',
    },
  ];
}
