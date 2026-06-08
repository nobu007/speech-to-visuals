/**
 * Animated Scene Renderer — extracted from EnhancedExportEngine
 *
 * REQ-218: Scene-driven animated SVG export with CSS keyframes
 * REQ-219: Scene-driven Lottie 5.7.4 compatible JSON export
 *
 * These pure functions take scene data and produce structured output,
 * making them independently testable without the full export pipeline.
 */

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
  const scenes = sceneData.scenes ?? [];
  const width = frames.width;
  const height = frames.height;

  if (scenes.length === 0) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="${width}" height="${height}" fill="#0a0a0a"/>
  <text x="${width / 2}" y="${height / 2}" text-anchor="middle" dominant-baseline="middle" fill="#e0e0e0" font-family="system-ui,sans-serif" font-size="24">No scene data</text>
</svg>`;
  }

  const totalDuration = scenes.reduce((acc, s) => acc + (s.duration ?? 2), 0);
  const keyframes: string[] = [];
  const sceneGroups: string[] = [];
  let offset = 0;

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const duration = scene.duration ?? 2;
    const startPct = roundPct((offset / totalDuration) * 100);
    const fadeInEnd = roundPct(Math.min(startPct + 3, ((offset + duration * 0.15) / totalDuration) * 100));
    const fadeOutStart = roundPct(((offset + duration * 0.85) / totalDuration) * 100);
    const endPct = roundPct(((offset + duration) / totalDuration) * 100);

    const animName = `s${i}`;
    keyframes.push(`@keyframes ${animName}{0%,${startPct}%{opacity:0}${fadeInEnd}%{opacity:1}${fadeOutStart}%{opacity:1}${endPct}%,100%{opacity:0}}`);

    const label = escapeXml(String(scene.label ?? scene.type ?? `Scene ${i + 1}`));
    const bgFill = scene.type === 'intro' ? '#1a1a2e' : scene.type === 'outro' ? '#0f3460' : '#16213e';
    const fontSize = scene.type === 'intro' ? 48 : scene.type === 'outro' ? 36 : 24;

    sceneGroups.push(`<g style="animation:${animName} ${totalDuration}s linear infinite;opacity:0"><rect width="${width}" height="${height}" fill="${bgFill}" rx="8"/><text x="${width / 2}" y="${height / 2}" text-anchor="middle" dominant-baseline="middle" fill="#e0e0e0" font-family="system-ui,sans-serif" font-size="${fontSize}" font-weight="bold">${label}</text><text x="${width / 2}" y="${height / 2 + fontSize + 20}" text-anchor="middle" fill="#a0a0a0" font-family="system-ui,sans-serif" font-size="16">${escapeXml(formatSceneSubtitle(scene))}</text></g>`);

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
  const scenes = sceneData.scenes ?? [];
  const fps = 30;
  const width = frames.width;
  const height = frames.height;
  let frameOffset = 0;

  const layers = scenes.map((scene, i) => {
    const duration = scene.duration ?? 2;
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
  };
}

// ---------------------------------------------------------------------------
// Shared helpers (exported for testability)
// ---------------------------------------------------------------------------

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatSceneSubtitle(scene: SceneItem): string {
  const d = scene.duration ?? 2;
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

function roundPct(n: number): number {
  return Math.round(n * 100) / 100;
}
