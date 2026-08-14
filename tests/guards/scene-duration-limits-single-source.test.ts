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
 * This guard pins:
 *   1. The canonical module exports the three boundaries and their ordering.
 *   2. All known consumers import the canonical module — none carries a
 *      bare clamp literal of its own (the literal `= <number>;` shapes are
 *      banned in the timing functions).
 *   3. Behavioral pin: generateRenderPlan actually clamps to the shared floor
 *      and the renderer ceiling.
 *   4. Behavioral pin: video-generator's scene conversion clamps to the same
 *      shared floor + editorial cap (the former legacy [3000, 10000] clamp
 *      truncated every 10–15 s simple-pipeline scene to 10 s, desyncing
 *      rendered video from its audio).
 *
 * Source anchors use import.meta.url, NOT process.cwd() — cwd-relative reads
 * flake under --maxWorkers>1 (TC-302/313, AGENTS.md テスト規約).
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { describe, it, expect } from '@jest/globals';
import {
  MIN_SCENE_DURATION_MS,
  MAX_EDITORIAL_SCENE_DURATION_MS,
  MAX_RENDERABLE_SCENE_DURATION_MS,
} from '@/pipeline/scene-duration-limits';
import { generateRenderPlan } from '@/pipeline/scene-render-spec-generator';
import { VideoGenerator } from '@/pipeline/video-generator';
import type { SceneGraph } from '@/types/diagram';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const CONSUMERS = [
  'src/pipeline/main-pipeline.ts',
  'src/pipeline/scene-render-spec-generator.ts',
  'src/pipeline/video-generator.ts',
];

function readSource(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), 'utf8');
}

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
      const src = readSource(rel);
      expect(src).toMatch(/from '\.\/scene-duration-limits'/);
    }
  });

  it('main-pipeline timing optimizer carries no bare clamp literal', () => {
    const src = readSource('src/pipeline/main-pipeline.ts');
    // The next-line shape of the old drift: local constants assigned from
    // numeric literals inside optimizeSceneTiming.
    expect(src).not.toMatch(/const minDuration = \d+;/);
    expect(src).not.toMatch(/const maxDuration = \d+;/);
  });

  it('render-spec defaults carry no bare clamp literal', () => {
    const src = readSource('src/pipeline/scene-render-spec-generator.ts');
    expect(src).not.toMatch(/DEFAULT_MIN_SCENE_DURATION_MS = \d+;/);
    expect(src).not.toMatch(/DEFAULT_MAX_SCENE_DURATION_MS = \d+;/);
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

  it('carries no legacy [3000, 10000] conversion clamp literal', () => {
    const src = readSource('src/pipeline/video-generator.ts');
    // The old shape: Math.min(10000, ...) / Math.max(3000, ...) inline clamp.
    expect(src).not.toMatch(/Math\.min\(10000,/);
    expect(src).not.toMatch(/Math\.max\(3000,/);
  });
});
