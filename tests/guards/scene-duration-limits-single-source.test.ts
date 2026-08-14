/**
 * Structural guard: pipeline scene-duration clamp boundaries have ONE source
 * (defect 08ae, partial closure).
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
 *   2. Both known consumers import the canonical module — neither carries a
 *      bare clamp literal of its own (the literal `= <number>;` shapes are
 *      banned in the timing functions).
 *   3. Behavioral pin: generateRenderPlan actually clamps to the shared floor
 *      and the renderer ceiling.
 *
 * Source anchors use import.meta.url, NOT process.cwd() — cwd-relative reads
 * flake under --maxWorkers>1 (TC-302/313, AGENTS.md テスト規約).
 *
 * Documented divergence (NOT pinned here): video-generator's legacy
 * [3000, 10000] conversion clamp — see scene-duration-limits.ts header.
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
import type { SceneGraph } from '@/types/diagram';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const CONSUMERS = [
  'src/pipeline/main-pipeline.ts',
  'src/pipeline/scene-render-spec-generator.ts',
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
