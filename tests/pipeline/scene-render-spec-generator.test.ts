/**
 * Tests for SceneRenderSpecGenerator
 *
 * Verifies that generateRenderPlan produces correct frame ranges,
 * contiguity, and validates render plan consistency.
 */

import { describe, it, expect } from '@jest/globals';
import {
  generateRenderPlan,
  validateRenderPlan,
  type SceneRenderSpec,
  type RenderPlan,
} from '@/pipeline/scene-render-spec-generator';
import type { SceneGraph } from '@stv/core/types/diagram';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeScene(overrides: Partial<SceneGraph> & { type?: SceneGraph['type'] } = {}): SceneGraph {
  return {
    type: overrides.type ?? 'flow',
    nodes: overrides.nodes ?? [
      { id: 'n1', label: 'Start' },
      { id: 'n2', label: 'End' },
    ],
    edges: overrides.edges ?? [{ from: 'n1', to: 'n2' }],
    startMs: overrides.startMs ?? 0,
    durationMs: overrides.durationMs ?? 5000,
    summary: overrides.summary ?? 'Test scene',
    keyphrases: overrides.keyphrases ?? [],
    ...overrides,
  };
}

// ===========================================================================
// generateRenderPlan
// ===========================================================================

describe('generateRenderPlan', () => {
  it('generates a valid plan for a single scene', () => {
    const scene = makeScene({ durationMs: 5000 });
    const plan = generateRenderPlan([scene]);

    expect(plan.sceneCount).toBe(1);
    expect(plan.fps).toBe(30);
    expect(plan.totalFrames).toBe(150); // 5s * 30fps
    expect(plan.totalDurationMs).toBe(5000);
    expect(plan.scenes).toHaveLength(1);

    const spec = plan.scenes[0];
    expect(spec.sceneIndex).toBe(0);
    expect(spec.startFrame).toBe(0);
    expect(spec.endFrame).toBe(150);
    expect(spec.totalFrames).toBe(150);
    expect(spec.nodeCount).toBe(2);
    expect(spec.edgeCount).toBe(1);
    expect(spec.summary).toBe('Test scene');
  });

  it('generates contiguous frame ranges for multiple scenes', () => {
    const scenes = [
      makeScene({ durationMs: 3000, summary: 'Scene A' }),
      makeScene({ durationMs: 4000, summary: 'Scene B' }),
      makeScene({ durationMs: 5000, summary: 'Scene C' }),
    ];
    const plan = generateRenderPlan(scenes);

    expect(plan.sceneCount).toBe(3);
    expect(plan.totalFrames).toBe(360); // (3+4+5)s * 30fps
    expect(plan.totalDurationMs).toBe(12000);

    // First scene
    expect(plan.scenes[0].startFrame).toBe(0);
    expect(plan.scenes[0].endFrame).toBe(90); // 3s * 30fps

    // Second scene starts where first ends
    expect(plan.scenes[1].startFrame).toBe(90);
    expect(plan.scenes[1].endFrame).toBe(210); // 90 + 4s * 30fps

    // Third scene starts where second ends
    expect(plan.scenes[2].startFrame).toBe(210);
    expect(plan.scenes[2].endFrame).toBe(360); // 210 + 5s * 30fps
  });

  it('respects custom fps', () => {
    const scene = makeScene({ durationMs: 2000 });
    const plan = generateRenderPlan([scene], { fps: 60 });

    expect(plan.fps).toBe(60);
    expect(plan.totalFrames).toBe(120); // 2s * 60fps
    expect(plan.scenes[0].totalFrames).toBe(120);
  });

  it('clamps scene duration to min/max bounds', () => {
    // Below minimum (default 2000ms)
    const shortScene = makeScene({ durationMs: 500 });
    const plan1 = generateRenderPlan([shortScene]);
    expect(plan1.scenes[0].durationMs).toBe(2000);

    // Above maximum (default 30000ms)
    const longScene = makeScene({ durationMs: 60000 });
    const plan2 = generateRenderPlan([longScene]);
    expect(plan2.scenes[0].durationMs).toBe(30000);
  });

  it('respects custom min/max duration', () => {
    const scene = makeScene({ durationMs: 500 });
    const plan = generateRenderPlan([scene], {
      minSceneDurationMs: 1000,
      maxSceneDurationMs: 10000,
    });
    expect(plan.scenes[0].durationMs).toBe(1000);
  });

  it('uses default duration when scene has no durationMs', () => {
    const scene = makeScene({ durationMs: 0 } as Partial<SceneGraph>);
    // durationMs: 0 is falsy, so it falls back to minSceneDurationMs (2000)
    const plan = generateRenderPlan([scene]);
    expect(plan.scenes[0].durationMs).toBe(2000);
  });

  it('detects layout presence', () => {
    const withLayout = makeScene({
      layout: {
        nodes: [{ id: 'n1', label: 'A', x: 100, y: 100 }],
        edges: [],
      },
    });
    const withoutLayout = makeScene();

    const plan = generateRenderPlan([withLayout, withoutLayout]);
    expect(plan.scenes[0].hasLayout).toBe(true);
    expect(plan.scenes[1].hasLayout).toBe(false);
  });

  it('computes contentReadyFrame based on node count', () => {
    const manyNodes = makeScene({
      nodes: Array.from({ length: 10 }, (_, i) => ({ id: `n${i}`, label: `Node ${i}` })),
      durationMs: 10000,
    });
    const plan = generateRenderPlan([manyNodes]);

    // contentReadyFrame = transitionFrames(8) + (10-1)*stagger(5) + fadeFrames(9) = 8+45+9 = 62
    expect(plan.scenes[0].contentReadyFrame).toBe(62);
  });

  it('clamps contentReadyFrame to totalFrames', () => {
    const fewFrames = makeScene({ durationMs: 200, nodes: [{ id: 'n1', label: 'A' }] });
    // duration clamped to 2000ms → 60 frames at 30fps
    const plan = generateRenderPlan([fewFrames]);
    // contentReadyFrame = 8 + 0 + 9 = 17, which is < 60
    expect(plan.scenes[0].contentReadyFrame).toBeLessThanOrEqual(plan.scenes[0].totalFrames);
  });

  it('throws on empty scenes array', () => {
    expect(() => generateRenderPlan([])).toThrow('scenes array is empty');
  });

  it('throws on null scenes', () => {
    expect(() => generateRenderPlan(null as unknown as SceneGraph[])).toThrow('scenes array is empty');
  });

  it('preserves diagram type per scene', () => {
    const scenes = [
      makeScene({ type: 'flow' }),
      makeScene({ type: 'tree' }),
      makeScene({ type: 'timeline' }),
    ];
    const plan = generateRenderPlan(scenes);

    expect(plan.scenes[0].diagramType).toBe('flow');
    expect(plan.scenes[1].diagramType).toBe('tree');
    expect(plan.scenes[2].diagramType).toBe('timeline');
  });
});

// ===========================================================================
// validateRenderPlan
// ===========================================================================

describe('validateRenderPlan', () => {
  function makeValidPlan(overrides: Partial<RenderPlan> = {}): RenderPlan {
    const scenes: SceneRenderSpec[] = overrides.scenes ?? [
      {
        sceneIndex: 0,
        diagramType: 'flow',
        startFrame: 0,
        endFrame: 150,
        totalFrames: 150,
        durationMs: 5000,
        transitionFrames: 8,
        contentReadyFrame: 17,
        nodeCount: 2,
        edgeCount: 1,
        hasLayout: false,
        summary: 'Scene 1',
      },
    ];
    const totalFrames = scenes.reduce((s, sc) => s + sc.totalFrames, 0);
    return {
      fps: 30,
      totalFrames,
      totalDurationMs: scenes.reduce((s, sc) => s + sc.durationMs, 0),
      sceneCount: scenes.length,
      scenes,
      ...overrides,
    };
  }

  it('returns valid for a correctly generated plan', () => {
    const scene = makeScene({ durationMs: 5000 });
    const plan = generateRenderPlan([scene]);
    const result = validateRenderPlan(plan);

    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('detects total frames mismatch', () => {
    const plan = makeValidPlan({ totalFrames: 999 }); // wrong
    const result = validateRenderPlan(plan);

    expect(result.valid).toBe(false);
    expect(result.issues[0]).toContain('Total frames mismatch');
  });

  it('detects frame gaps between scenes', () => {
    const scenes: SceneRenderSpec[] = [
      {
        sceneIndex: 0, diagramType: 'flow', startFrame: 0, endFrame: 100,
        totalFrames: 100, durationMs: 3333, transitionFrames: 8,
        contentReadyFrame: 17, nodeCount: 1, edgeCount: 0, hasLayout: false, summary: 'A',
      },
      {
        sceneIndex: 1, diagramType: 'flow', startFrame: 105, endFrame: 200, // gap at 100→105
        totalFrames: 95, durationMs: 3167, transitionFrames: 8,
        contentReadyFrame: 17, nodeCount: 1, edgeCount: 0, hasLayout: false, summary: 'B',
      },
    ];
    const plan = makeValidPlan({ scenes, totalFrames: 195 });
    const result = validateRenderPlan(plan);

    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('gap/overlap'))).toBe(true);
  });

  it('detects duplicate scene indices', () => {
    const scenes: SceneRenderSpec[] = [
      {
        sceneIndex: 0, diagramType: 'flow', startFrame: 0, endFrame: 100,
        totalFrames: 100, durationMs: 3333, transitionFrames: 8,
        contentReadyFrame: 17, nodeCount: 1, edgeCount: 0, hasLayout: false, summary: 'A',
      },
      {
        sceneIndex: 0, diagramType: 'tree', startFrame: 100, endFrame: 200, // duplicate index
        totalFrames: 100, durationMs: 3333, transitionFrames: 8,
        contentReadyFrame: 17, nodeCount: 1, edgeCount: 0, hasLayout: false, summary: 'B',
      },
    ];
    const plan = makeValidPlan({ scenes, totalFrames: 200 });
    const result = validateRenderPlan(plan);

    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('Duplicate scene indices'))).toBe(true);
  });

  it('detects scene count mismatch', () => {
    const scenes: SceneRenderSpec[] = [
      {
        sceneIndex: 0, diagramType: 'flow', startFrame: 0, endFrame: 100,
        totalFrames: 100, durationMs: 3333, transitionFrames: 8,
        contentReadyFrame: 17, nodeCount: 1, edgeCount: 0, hasLayout: false, summary: 'A',
      },
    ];
    const plan = makeValidPlan({ scenes, sceneCount: 5, totalFrames: 100 }); // wrong sceneCount
    const result = validateRenderPlan(plan);

    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('Scene count mismatch'))).toBe(true);
  });

  it('validates a multi-scene plan generated by generateRenderPlan', () => {
    const scenes = [
      makeScene({ durationMs: 3000, type: 'flow' }),
      makeScene({ durationMs: 4000, type: 'tree' }),
      makeScene({ durationMs: 5000, type: 'timeline' }),
    ];
    const plan = generateRenderPlan(scenes);
    const result = validateRenderPlan(plan);

    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });
});
