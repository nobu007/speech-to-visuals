/**
 * Integration test: VideoGenerator scene-duration time-unit correctness.
 *
 * Context (feedback): "The DiagramVideo time-unit fix is high-impact — verify
 * that scene transitions now have correct durations... add an integration test
 * that asserts frame count matches expected scene durations, catching
 * time-unit regressions at the integration layer."
 *
 * Two production frame/duration code paths must agree for the normal pipeline
 * output, and per-scene durationMs must reflect the real segment length:
 *
 *   - @/remotion/Video `calculateTotalFrames(scenes, fps)`  → SUM of durationMs
 *   - video-generator `prepareRenderConfiguration`           → durationInFrames
 *     derived from `calculateTotalDuration` (max of startMs+durationMs)
 *
 * A latent time-unit bug existed in `convertSceneToRemotionFormat`: it derived
 * `durationMs` from `(endTime - startTime)` where startTime/endTime are in
 * SECONDS (see simple-pipeline.ts: `startTime: segStartMs / 1000`), but then
 * clamped that seconds-value against the [3000, 10000] MILLISECOND range.
 * Result: nearly every scene collapsed to exactly 3000 ms regardless of real
 * length, so the rendered video was N×3s instead of matching the audio.
 *
 * This test exercises the REAL production methods (via cast on the exported
 * VideoGenerator class — NOT a local mirror of the logic), which is why it can
 * actually catch the regression, unlike a tautological re-implementation.
 */

import { describe, it, expect } from '@jest/globals';
import { VideoGenerator } from '@/pipeline/video-generator';
import type { RemotionSceneData } from '@/pipeline/video-generator';
import { calculateTotalFrames, DEFAULT_FPS } from '@/remotion/Video';
import type { SceneGraph } from '@/types/diagram';

// ---------------------------------------------------------------------------
// Cast helpers: reach the real private methods so we test production code,
// not a re-implementation. If the method signatures change, these casts are
// the single place to update.
// ---------------------------------------------------------------------------
interface VideoGeneratorInternals {
  convertSceneToRemotionFormat(scene: SceneGraph, index: number): RemotionSceneData;
  calculateTotalDuration(scenes: RemotionSceneData[]): number;
  prepareRenderConfiguration(data: unknown): Promise<{
    config: { fps: number; durationInFrames: number };
    inputProps: { scenes: RemotionSceneData[]; totalDuration: number };
  }>;
}

function internals(gen: VideoGenerator): VideoGeneratorInternals {
  return gen as unknown as VideoGeneratorInternals;
}

/** Build a SceneGraph whose startTime/endTime are in SECONDS (pipeline truth). */
function makeSceneSec(
  startSec: number,
  endSec: number,
  id = 'scene',
): SceneGraph {
  return {
    type: 'flow',
    id,
    title: id,
    nodes: [],
    edges: [],
    // Pipeline produces these (see simple-pipeline.ts):
    startMs: startSec * 1000,
    durationMs: (endSec - startSec) * 1000,
    startTime: startSec, // seconds
    endTime: endSec, // seconds
    content: '',
    summary: '',
    keyphrases: [],
  };
}

describe('VideoGenerator scene-duration time-unit correctness (real methods)', () => {
  const gen = new VideoGenerator({ fps: DEFAULT_FPS });
  const api = internals(gen);

  describe('convertSceneToRemotionFormat durationMs reflects real segment length', () => {
    it('5-second segment → durationMs ≈ 5000 (not collapsed to 3000)', () => {
      const scene = makeSceneSec(0, 5);
      const out = api.convertSceneToRemotionFormat(scene, 0);
      // Pre-fix bug: (5-0)=5 clamped to [3000,10000]ms → 3000.
      // Correct: (5-0)*1000 = 5000ms.
      expect(out.durationMs).toBe(5000);
      // startMs must be in ms: 0s → 0ms.
      expect(out.startMs).toBe(0);
    });

    it('7-second segment → durationMs ≈ 7000', () => {
      const out = api.convertSceneToRemotionFormat(makeSceneSec(10, 17), 0);
      expect(out.durationMs).toBe(7000);
      // 10s → 10000ms
      expect(out.startMs).toBe(10000);
    });

    it('2-second segment clamps UP to the 3000ms minimum', () => {
      const out = api.convertSceneToRemotionFormat(makeSceneSec(0, 2), 0);
      expect(out.durationMs).toBe(3000);
    });

    it('15-second segment clamps DOWN to the 10000ms maximum', () => {
      const out = api.convertSceneToRemotionFormat(makeSceneSec(0, 15), 0);
      expect(out.durationMs).toBe(10000);
    });

    it('zero-length segment falls back to default 5000ms', () => {
      const out = api.convertSceneToRemotionFormat(makeSceneSec(5, 5), 0);
      // (5-5)=0 → falsy → defaultDuration 5000, clamped → 5000
      expect(out.durationMs).toBe(5000);
    });
  });

  describe('calculateTotalDuration never yields NaN/Infinity', () => {
    it('finite for normal sequential scenes', () => {
      const scenes = [
        api.convertSceneToRemotionFormat(makeSceneSec(0, 5, 'a'), 0),
        api.convertSceneToRemotionFormat(makeSceneSec(5, 10, 'b'), 1),
      ];
      const total = api.calculateTotalDuration(scenes);
      expect(Number.isFinite(total)).toBe(true);
      // max(5000, 10000) = 10000
      expect(total).toBe(10000);
    });
  });

  describe('durationInFrames matches expected scene durations (integration)', () => {
    it('render-config durationInFrames is finite and positive', async () => {
      const scenes = [
        api.convertSceneToRemotionFormat(makeSceneSec(0, 5, 'a'), 0),
        api.convertSceneToRemotionFormat(makeSceneSec(5, 10, 'b'), 1),
      ];
      const totalDuration = api.calculateTotalDuration(scenes);
      const cfg = await api.prepareRenderConfiguration({
        scenes,
        audioUrl: 'x',
        totalDuration,
      });
      expect(Number.isFinite(cfg.config.durationInFrames)).toBe(true);
      expect(cfg.config.durationInFrames).toBeGreaterThan(0);
      // 10000ms / 1000 * 30fps = 300 frames
      expect(cfg.config.durationInFrames).toBe(300);
    });

    it('durationInFrames equals calculateTotalFrames for sequential scenes', async () => {
      // For well-formed sequential scenes, the two production frame paths
      // (Video.tsx sum-based vs video-generator max-based) MUST agree.
      const sceneGraphs: SceneGraph[] = [
        makeSceneSec(0, 4, 'a'),
        makeSceneSec(4, 9, 'b'),
        makeSceneSec(9, 12, 'c'),
      ];
      const remotionScenes = sceneGraphs.map((s, i) =>
        api.convertSceneToRemotionFormat(s, i),
      );
      const totalDuration = api.calculateTotalDuration(remotionScenes);
      const cfg = await api.prepareRenderConfiguration({
        scenes: remotionScenes,
        audioUrl: 'x',
        totalDuration,
      });

      // Build a SceneGraph view whose durationMs mirrors the RemotionSceneData
      // so calculateTotalFrames (which sums durationMs) is comparable.
      const asGraph = remotionScenes.map((s) => ({
        ...sceneGraphs[0],
        durationMs: s.durationMs,
      })) as SceneGraph[];
      const compositionFrames = calculateTotalFrames(asGraph, DEFAULT_FPS);

      // Both must agree: this is the integration invariant. A time-unit
      // regression (e.g. ms treated as seconds) breaks the equality.
      expect(cfg.config.durationInFrames).toBe(compositionFrames);
    });
  });
});
