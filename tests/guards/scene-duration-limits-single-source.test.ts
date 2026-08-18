/**
 * Structural guard: pipeline scene-duration clamp boundaries have ONE source
 * (defect 08ae, full closure).
 *
 * Before 08ae, main-pipeline's `optimizeSceneTiming` hardcoded 2000/15000 as
 * bare literals while scene-render-spec-generator carried its own 2000/30000
 * defaults — the shared 2000ms floor existed twice with no link, so changing
 * one silently left the other behind (a raised floor in the optimizer would
 * no longer match the render plan's floor, and the reported video length
 * would diverge from the clamped scene data).
 *
 * This file pins VALUES and BEHAVIOR (generateRenderPlan and
 * video-generator's scene conversion actually clamp to the shared
 * boundaries). The literal-shape discovery sweeps live in the shared
 * registry since round 8 — tests/guards/frozen-literal-registry.test.ts:
 *   - rule 'scene-duration clamp literals banned in the three consumers'
 *     (local min/max consts, legacy DEFAULT_MIN/MAX redefinitions, the
 *     [3000, 10000] inline conversion clamp),
 *   - rule 'default scene duration (5000ms) …' (any src/pipeline file
 *     re-freezing the 5000ms default under either local name).
 */

import { describe, it, expect } from '@jest/globals';
import { readSource } from './freeze-guard';
import {
  MIN_SCENE_DURATION_MS,
  MAX_EDITORIAL_SCENE_DURATION_MS,
  MAX_RENDERABLE_SCENE_DURATION_MS,
  DEFAULT_SCENE_DURATION_MS,
} from '@/pipeline/scene-duration-limits';
import { generateRenderPlan } from '@/pipeline/scene-render-spec-generator';
import { VideoGenerator } from '@/pipeline/video-generator';
import type { SceneGraph } from '@stv/core/types/diagram';

const CONSUMERS = [
  'src/pipeline/main-pipeline.ts',
  'src/pipeline/scene-render-spec-generator.ts',
  'src/pipeline/video-generator.ts',
];

const DEFAULT_CONSUMERS = [
  'src/pipeline/pipeline-orchestrator.ts',
  'src/pipeline/smoke-orchestrator.ts',
  'src/pipeline/video-generator.ts',
];

function makeScene(durationMs: number): SceneGraph {
  return {
    id: 'scene-1',
    type: 'flow',
    title: 't',
    content: 'c',
    nodes: [],
    edges: [],
    startTime: 0,
    endTime: durationMs / 1000,
    startMs: 0,
    durationMs,
  } as unknown as SceneGraph;
}

describe('scene-duration limits single source (08ae)', () => {
  it('exports the documented boundaries and ordering', () => {
    expect(MIN_SCENE_DURATION_MS).toBe(2000);
    expect(MAX_EDITORIAL_SCENE_DURATION_MS).toBe(15000);
    expect(MAX_RENDERABLE_SCENE_DURATION_MS).toBe(30000);
    // Pacing cap must stay inside what the renderer can schedule.
    expect(MIN_SCENE_DURATION_MS).toBeLessThan(MAX_EDITORIAL_SCENE_DURATION_MS);
    expect(MAX_EDITORIAL_SCENE_DURATION_MS).toBeLessThanOrEqual(
      MAX_RENDERABLE_SCENE_DURATION_MS,
    );
  });

  it('every consumer imports the canonical module', () => {
    for (const rel of CONSUMERS) {
      expect(readSource(rel)).toMatch(/from '\.\/scene-duration-limits'/);
    }
  });

  it('generateRenderPlan clamps to the shared floor and renderer ceiling', () => {
    const short = generateRenderPlan([makeScene(500)]);
    // 500ms * 30fps / 1000 = 15 frames if unclamped; 2000ms floor → 60 frames.
    expect(short.scenes[0].durationMs).toBe(MIN_SCENE_DURATION_MS);
    expect(short.scenes[0].totalFrames).toBe((MIN_SCENE_DURATION_MS / 1000) * 30);

    const long = generateRenderPlan([makeScene(120000)]);
    expect(long.scenes[0].durationMs).toBe(MAX_RENDERABLE_SCENE_DURATION_MS);
  });
});

describe('video-generator scene conversion uses the shared boundaries (08ae closure)', () => {
  /**
   * AC for closing the last 08ae divergence:
   *   - A scene whose real span is 2–15 s keeps its FULL duration — no
   *     truncation to a 10 s legacy ceiling (that made 10–15 s simple-pipeline
   *     scenes end before their audio segment did).
   *   - A scene shorter than the shared floor is raised to MIN_SCENE_DURATION_MS
   *     (same floor the main-pipeline timing optimizer applies).
   *   - A scene longer than the editorial cap is shortened to
   *     MAX_EDITORIAL_SCENE_DURATION_MS.
   *   - A zero/NaN span still falls back to the 5 s default.
   */
  type Convert = (scene: SceneGraph, index: number) => { durationMs: number };

  const convert = (() => {
    const vg = new VideoGenerator({});
    return (vg as unknown as { convertSceneToRemotionFormat: Convert })
      .convertSceneToRemotionFormat.bind(vg);
  })();

  it.each([
    [12000, 12000], // in-range 12 s span: NOT truncated to the legacy 10 000
    [15000, 15000], // editorial cap boundary: preserved exactly
    [1500, 2000],   // sub-floor span raised to the shared floor
    [20000, 15000], // over-cap span shortened to the editorial cap
    [5000, 5000],   // in-range span preserved
  ])('span %d ms → durationMs %d', (spanMs, expected) => {
    expect(convert(makeScene(spanMs), 0).durationMs).toBe(expected);
  });

  it('zero/NaN span falls back to the 5 s default, not the floor', () => {
    expect(convert(makeScene(0), 0).durationMs).toBe(5000);
    const nan = { ...makeScene(5000), endTime: Number.NaN };
    expect(convert(nan as SceneGraph, 0).durationMs).toBe(5000);
  });
});

/**
 * The 4th scene-duration concept: the DEFAULT span used when a scene carries
 * no usable timing. Before this block, `5000` was frozen in THREE places —
 * pipeline-orchestrator (`DEFAULT_SCENE_DURATION_MS = 5000`, replaces a
 * non-positive durationMs), smoke-orchestrator (same local const, diagram
 * durationMs fallback), and video-generator (`const defaultDuration = 5000`,
 * zero/NaN span fallback in scene conversion). The 08ae closure guard above
 * already pins the 5 s fallback BEHAVIOR; this block pins that all three
 * consumers import the canonical value — the registry sweep pins that none of
 * them (or any NEW src/pipeline file) re-freezes it under a local name.
 */
describe('default scene duration single source (08ae follow-up)', () => {
  it('canonical module exports the 5000ms default, in-range of the clamps', () => {
    expect(DEFAULT_SCENE_DURATION_MS).toBe(5000);
    expect(MIN_SCENE_DURATION_MS).toBeLessThan(DEFAULT_SCENE_DURATION_MS);
    expect(DEFAULT_SCENE_DURATION_MS).toBeLessThanOrEqual(
      MAX_EDITORIAL_SCENE_DURATION_MS,
    );
  });

  it.each(DEFAULT_CONSUMERS)('%s imports the canonical default', (rel) => {
    const src = readSource(rel);
    expect(src).toMatch(/from '\.\/scene-duration-limits'/);
    expect(src).toMatch(/DEFAULT_SCENE_DURATION_MS/);
  });
});
