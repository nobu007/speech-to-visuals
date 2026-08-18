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
 *     derived from `calculateTotalDuration` (SUM of durationMs; matches the
 *     cumulative render path, which ignores absolute startMs)
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
import type { SceneGraph } from '@stv/core/types/diagram';
// Clamp boundaries are pinned to the single source (defect 08ae), not
// re-literalized here — the original [3000, 10000] pins went stale when the
// clamp moved to scene-duration-limits.ts and kept failing at 2000/15000.
import {
  MIN_SCENE_DURATION_MS,
  MAX_EDITORIAL_SCENE_DURATION_MS,
} from '@/pipeline/scene-duration-limits';

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

    it(`sub-floor segment clamps UP to the ${MIN_SCENE_DURATION_MS}ms minimum`, () => {
      // 1s = 1000ms < MIN (2000) → clamped up.
      const out = api.convertSceneToRemotionFormat(makeSceneSec(0, 1), 0);
      expect(out.durationMs).toBe(MIN_SCENE_DURATION_MS);
    });

    it(`over-cap segment clamps DOWN to the ${MAX_EDITORIAL_SCENE_DURATION_MS}ms maximum`, () => {
      // 20s = 20000ms > MAX (15000) → clamped down.
      const out = api.convertSceneToRemotionFormat(makeSceneSec(0, 20), 0);
      expect(out.durationMs).toBe(MAX_EDITORIAL_SCENE_DURATION_MS);
    });

    it('zero-length segment falls back to default 5000ms', () => {
      const out = api.convertSceneToRemotionFormat(makeSceneSec(5, 5), 0);
      // (5-5)=0 → falsy → defaultDuration 5000, clamped → 5000
      expect(out.durationMs).toBe(5000);
    });
  });

  describe('convertSceneToRemotionFormat preserves a legit-zero confidence signal', () => {
    // confidence is a 0-1 layout/detection score; 0.0 means "broke down".
    // `|| 0.8` would mask that breakdown signal to a HIGH-confidence value,
    // AND silence validateRemotionData's low-confidence warning (confidence < 0.5).
    // Same bug class as the fixed `layout.confidence || 1` (432060e).
    it('confidence: 0 is preserved, not masked to the 0.8 default', () => {
      const scene = { ...makeSceneSec(0, 5), confidence: 0 };
      const out = api.convertSceneToRemotionFormat(scene, 0);
      expect(out.confidence).toBe(0);
    });

    it('a missing confidence still falls back to the 0.8 default', () => {
      const out = api.convertSceneToRemotionFormat(makeSceneSec(0, 5), 0);
      expect(out.confidence).toBe(0.8);
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
      // 5000ms + 5000ms = 10000ms (SUM of durationMs — contiguous scenes where
      // the legacy max(startMs+dur) formula happened to agree).
      expect(total).toBe(10000);
    });
  });

  describe('calculateTotalDuration matches the cumulative render path (SUM, not max)', () => {
    // Regression for a real divergence: simple-pipeline emits scenes with
    // ABSOLUTE audio startMs and clamps durationMs to [3000, 10000] ms. The
    // render path plays scenes back-to-back via cumulative durationMs (SUM),
    // ignoring absolute startMs. The legacy max(startMs + durationMs) formula
    // therefore reported a duration that did NOT match the rendered video
    // whenever scenes were clamped up to the 3000 ms floor (short segments) or
    // non-contiguous. These cases assert SUM so reported duration ≡ real render.
    it(`three sub-floor segments clamped to ${MIN_SCENE_DURATION_MS}ms: SUM=${MIN_SCENE_DURATION_MS * 3}, not max(startMs+dur)`, () => {
      // Each 1s segment clamps to the 2000ms floor; absolute startMs are 0/1000/2000.
      const scenes = [
        api.convertSceneToRemotionFormat(makeSceneSec(0, 1, 'a'), 0),
        api.convertSceneToRemotionFormat(makeSceneSec(1, 2, 'b'), 1),
        api.convertSceneToRemotionFormat(makeSceneSec(2, 3, 'c'), 2),
      ];
      // Sanity: each scene was clamped to the floor.
      expect(scenes.map((s) => s.durationMs)).toEqual([
        MIN_SCENE_DURATION_MS,
        MIN_SCENE_DURATION_MS,
        MIN_SCENE_DURATION_MS,
      ]);
      // Legacy max(0+2000, 1000+2000, 2000+2000) = 4000 — wrong.
      // Correct SUM = 6000.
      expect(api.calculateTotalDuration(scenes)).toBe(MIN_SCENE_DURATION_MS * 3);
    });

    it('non-contiguous scenes (trailing gap): SUM of durationMs, startMs ignored', () => {
      // Scene A 0→5s (5000ms), Scene C 100→101s (clamped 2000ms). The huge
      // absolute gap (100s) must NOT inflate the reported duration: playback
      // is cumulative, so the real video is 5000+2000 = 7000ms.
      const scenes = [
        api.convertSceneToRemotionFormat(makeSceneSec(0, 5, 'a'), 0),
        api.convertSceneToRemotionFormat(makeSceneSec(100, 101, 'c'), 1),
      ];
      expect(api.calculateTotalDuration(scenes)).toBe(5000 + MIN_SCENE_DURATION_MS);
    });

    it('reported durationInFrames ≡ calculateTotalFrames for clamped scenes', async () => {
      // The decisive integration invariant: the frame count VideoGenerator
      // derives (from calculateTotalDuration) must equal the frame count the
      // real composition registers (calculateTotalFrames, which SUMs durationMs).
      // Pre-fix this failed for clamped scenes.
      const remotionScenes = [
        api.convertSceneToRemotionFormat(makeSceneSec(0, 1, 'a'), 0),
        api.convertSceneToRemotionFormat(makeSceneSec(1, 2, 'b'), 1),
        api.convertSceneToRemotionFormat(makeSceneSec(2, 3, 'c'), 2),
      ];
      const totalDuration = api.calculateTotalDuration(remotionScenes);
      const cfg = await api.prepareRenderConfiguration({
        scenes: remotionScenes,
        audioUrl: 'x',
        totalDuration,
      });
      const asGraph = remotionScenes.map((s) => ({
        ...makeSceneSec(0, 0),
        durationMs: s.durationMs,
      })) as SceneGraph[];
      const compositionFrames = calculateTotalFrames(asGraph, DEFAULT_FPS);
      // 6000ms → 180 frames on both sides.
      expect(cfg.config.durationInFrames).toBe(compositionFrames);
      expect(cfg.config.durationInFrames).toBe(
        (MIN_SCENE_DURATION_MS * 3 / 1000) * DEFAULT_FPS,
      );
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
