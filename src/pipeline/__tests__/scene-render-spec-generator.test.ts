/**
 * Tests for SceneRenderSpecGenerator
 *
 * Verifies:
 * - Render plan generation from SceneGraph[]
 * - Frame timing calculations (startFrame, endFrame, totalFrames)
 * - Duration clamping (min/max scene duration)
 * - Content-ready frame calculation (transition + stagger + fade)
 * - Validation logic (contiguity, totals, duplicates)
 * - Edge cases (single scene, empty layout, missing fields)
 */
import { describe, it, expect } from '@jest/globals';
import {
  generateRenderPlan,
  validateRenderPlan,
  type RenderPlan,
  type SceneRenderSpec,
} from '../scene-render-spec-generator';
import type { SceneGraph, DiagramType } from '@/types/diagram';

// ---------- Helpers ----------

function makeScene(overrides: Partial<SceneGraph> = {}): SceneGraph {
  return {
    type: 'flowchart' as DiagramType,
    nodes: [
      { id: 'n1', label: 'Node 1' },
      { id: 'n2', label: 'Node 2' },
    ],
    edges: [{ from: 'n1', to: 'n2' }],
    startMs: 0,
    durationMs: 5000,
    summary: 'Test scene',
    keyphrases: ['test'],
    ...overrides,
  };
}

function makeScenes(count: number): SceneGraph[] {
  return Array.from({ length: count }, (_, i) =>
    makeScene({
      summary: `Scene ${i + 1}`,
      startMs: i * 5000,
      durationMs: 5000,
    }),
  );
}

// ---------- generateRenderPlan ----------

describe('generateRenderPlan — basic plan generation', () => {
  it('should generate a valid plan for a single scene', () => {
    const scenes = [makeScene()];
    const plan = generateRenderPlan(scenes);

    expect(plan.sceneCount).toBe(1);
    expect(plan.scenes).toHaveLength(1);
    expect(plan.fps).toBe(30); // DEFAULT_FPS
    expect(plan.totalDurationMs).toBe(5000);
  });

  it('should generate a valid plan for multiple scenes', () => {
    const scenes = makeScenes(3);
    const plan = generateRenderPlan(scenes);

    expect(plan.sceneCount).toBe(3);
    expect(plan.scenes).toHaveLength(3);
    expect(plan.totalDurationMs).toBe(15000);
  });

  it('should throw RenderingError for empty scenes array', () => {
    expect(() => generateRenderPlan([])).toThrow(/scenes array is empty/);
  });

  it('should throw RenderingError for null scenes', () => {
    expect(() => generateRenderPlan(null as unknown as SceneGraph[])).toThrow(
      /scenes array is empty/,
    );
  });
});

describe('generateRenderPlan — frame timing', () => {
  it('should calculate correct startFrame and endFrame for contiguous scenes', () => {
    const scenes = makeScenes(3);
    const plan = generateRenderPlan(scenes, { fps: 30 });

    // Each scene: 5000ms at 30fps = 150 frames
    expect(plan.scenes[0].startFrame).toBe(0);
    expect(plan.scenes[0].endFrame).toBe(150);
    expect(plan.scenes[1].startFrame).toBe(150);
    expect(plan.scenes[1].endFrame).toBe(300);
    expect(plan.scenes[2].startFrame).toBe(300);
    expect(plan.scenes[2].endFrame).toBe(450);
    expect(plan.totalFrames).toBe(450);
  });

  it('should calculate totalFrames from duration and fps', () => {
    const scenes = [makeScene({ durationMs: 2000 })];
    const plan = generateRenderPlan(scenes, { fps: 25 });

    // 2000ms at 25fps = 50 frames
    expect(plan.scenes[0].totalFrames).toBe(50);
  });

  it('should handle custom fps', () => {
    const scenes = makeScenes(2);
    const plan = generateRenderPlan(scenes, { fps: 60 });

    expect(plan.fps).toBe(60);
    // 5000ms at 60fps = 300 frames per scene
    expect(plan.scenes[0].totalFrames).toBe(300);
    expect(plan.totalFrames).toBe(600);
  });
});

describe('generateRenderPlan — duration clamping', () => {
  it('should enforce minimum scene duration', () => {
    const scenes = [makeScene({ durationMs: 100 })]; // Below 2000ms minimum
    const plan = generateRenderPlan(scenes, { fps: 30, minSceneDurationMs: 2000 });

    expect(plan.scenes[0].durationMs).toBe(2000);
    // 2000ms at 30fps = 60 frames
    expect(plan.scenes[0].totalFrames).toBe(60);
  });

  it('should enforce maximum scene duration', () => {
    const scenes = [makeScene({ durationMs: 60000 })]; // Above 30000ms maximum
    const plan = generateRenderPlan(scenes, { fps: 30, maxSceneDurationMs: 30000 });

    expect(plan.scenes[0].durationMs).toBe(30000);
    // 30000ms at 30fps = 900 frames
    expect(plan.scenes[0].totalFrames).toBe(900);
  });

  it('should use default min/max when not specified', () => {
    const scenes = [makeScene({ durationMs: 0 })];
    const plan = generateRenderPlan(scenes);

    // durationMs=0 → falls back to minSceneDurationMs=2000
    expect(plan.scenes[0].durationMs).toBe(2000);
  });

  it('should use custom min/max duration', () => {
    const scenes = [
      makeScene({ durationMs: 500 }),
      makeScene({ durationMs: 100000 }),
    ];
    const plan = generateRenderPlan(scenes, {
      fps: 30,
      minSceneDurationMs: 1000,
      maxSceneDurationMs: 10000,
    });

    expect(plan.scenes[0].durationMs).toBe(1000); // clamped to min
    expect(plan.scenes[1].durationMs).toBe(10000); // clamped to max
  });
});

describe('generateRenderPlan — content-ready frame', () => {
  it('should calculate contentReadyFrame based on transition + stagger + fade', () => {
    const scene = makeScene({
      nodes: Array.from({ length: 5 }, (_, i) => ({
        id: `n${i}`,
        label: `Node ${i}`,
      })),
    });
    const plan = generateRenderPlan([scene], {
      fps: 30,
      transitionFrames: 8,
    });

    // contentReadyFrame = transition + (nodeCount-1)*stagger + nodeFade
    // = 8 + (5-1)*5 + 9 = 8 + 20 + 9 = 37
    expect(plan.scenes[0].contentReadyFrame).toBe(37);
  });

  it('should handle zero nodes in contentReadyFrame', () => {
    const scene = makeScene({ nodes: [] });
    const plan = generateRenderPlan([scene], {
      fps: 30,
      transitionFrames: 8,
    });

    // contentReadyFrame = 8 + 0 + 9 = 17
    expect(plan.scenes[0].contentReadyFrame).toBe(17);
  });

  it('should cap contentReadyFrame at totalFrames', () => {
    // Very short scene duration but many nodes
    const scene = makeScene({
      durationMs: 100, // will be clamped to 2000ms → 60 frames at 30fps
      nodes: Array.from({ length: 20 }, (_, i) => ({
        id: `n${i}`,
        label: `Node ${i}`,
      })),
    });
    const plan = generateRenderPlan([scene], { fps: 30 });

    // contentReadyFrame would be 8 + 19*5 + 9 = 112, but totalFrames = 60
    expect(plan.scenes[0].contentReadyFrame).toBe(60);
  });

  it('should use custom transitionFrames', () => {
    const scene = makeScene({
      nodes: [{ id: 'n1', label: 'A' }],
    });
    const plan = generateRenderPlan([scene], {
      fps: 30,
      transitionFrames: 15,
    });

    // contentReadyFrame = 15 + 0 + 9 = 24
    expect(plan.scenes[0].contentReadyFrame).toBe(24);
  });
});

describe('generateRenderPlan — scene metadata', () => {
  it('should extract node and edge counts', () => {
    const scene = makeScene({
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
      ],
    });
    const plan = generateRenderPlan([scene]);

    expect(plan.scenes[0].nodeCount).toBe(3);
    expect(plan.scenes[0].edgeCount).toBe(2);
  });

  it('should default nodeCount and edgeCount to 0 for missing arrays', () => {
    const scene = makeScene({ nodes: undefined, edges: undefined });
    const plan = generateRenderPlan([scene]);

    expect(plan.scenes[0].nodeCount).toBe(0);
    expect(plan.scenes[0].edgeCount).toBe(0);
  });

  it('should detect hasLayout from scene.layout', () => {
    const sceneWithLayout = makeScene({
      layout: {
        nodes: [{ id: 'n1', x: 10, y: 20, w: 100, h: 50 }],
        edges: [],
        width: 1920,
        height: 1080,
      } as SceneGraph['layout'],
    });
    const sceneWithoutLayout = makeScene({ layout: undefined });

    const plan = generateRenderPlan([sceneWithLayout, sceneWithoutLayout]);
    expect(plan.scenes[0].hasLayout).toBe(true);
    expect(plan.scenes[1].hasLayout).toBe(false);
  });

  it('should use scene.summary or fallback to Scene N', () => {
    const scenes = [
      makeScene({ summary: 'Custom summary' }),
      makeScene({ summary: '' }),
    ];
    const plan = generateRenderPlan(scenes);

    expect(plan.scenes[0].summary).toBe('Custom summary');
    expect(plan.scenes[1].summary).toBe('Scene 2');
  });

  it('should set diagramType from scene.type', () => {
    const scenes = [
      makeScene({ type: 'tree' }),
      makeScene({ type: 'timeline' }),
      makeScene({ type: 'network' }),
    ];
    const plan = generateRenderPlan(scenes);

    expect(plan.scenes[0].diagramType).toBe('tree');
    expect(plan.scenes[1].diagramType).toBe('timeline');
    expect(plan.scenes[2].diagramType).toBe('network');
  });

  it('should assign sequential sceneIndex', () => {
    const plan = generateRenderPlan(makeScenes(5));
    plan.scenes.forEach((spec, i) => {
      expect(spec.sceneIndex).toBe(i);
    });
  });
});

describe('generateRenderPlan — total duration', () => {
  it('should sum durations across all scenes', () => {
    const scenes = [
      makeScene({ durationMs: 3000 }),
      makeScene({ durationMs: 5000 }),
      makeScene({ durationMs: 7000 }),
    ];
    const plan = generateRenderPlan(scenes);
    expect(plan.totalDurationMs).toBe(15000);
  });

  it('should use clamped durations for total', () => {
    const scenes = [
      makeScene({ durationMs: 100 }), // → 2000
      makeScene({ durationMs: 5000 }), // → 5000
    ];
    const plan = generateRenderPlan(scenes);
    expect(plan.totalDurationMs).toBe(7000);
  });
});

// ---------- validateRenderPlan ----------

describe('validateRenderPlan — valid plans', () => {
  it('should return valid=true for a correctly generated plan', () => {
    const plan = generateRenderPlan(makeScenes(3));
    const result = validateRenderPlan(plan);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('should return valid=true for single-scene plan', () => {
    const plan = generateRenderPlan([makeScene()]);
    const result = validateRenderPlan(plan);
    expect(result.valid).toBe(true);
  });
});

describe('validateRenderPlan — frame contiguity', () => {
  it('should detect frame gaps between scenes', () => {
    const plan: RenderPlan = {
      fps: 30,
      totalFrames: 300,
      totalDurationMs: 10000,
      sceneCount: 2,
      scenes: [
        {
          sceneIndex: 0,
          diagramType: 'flowchart',
          startFrame: 0,
          endFrame: 100,
          totalFrames: 100,
          durationMs: 3333,
          transitionFrames: 8,
          contentReadyFrame: 17,
          nodeCount: 2,
          edgeCount: 1,
          hasLayout: false,
          summary: 'Scene 1',
        },
        {
          sceneIndex: 1,
          diagramType: 'flowchart',
          startFrame: 150, // Gap! Previous ends at 100
          endFrame: 300,
          totalFrames: 150,
          durationMs: 5000,
          transitionFrames: 8,
          contentReadyFrame: 17,
          nodeCount: 2,
          edgeCount: 1,
          hasLayout: false,
          summary: 'Scene 2',
        },
      ],
    };
    const result = validateRenderPlan(plan);
    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.includes('gap/overlap'))).toBe(true);
  });

  it('should detect overlapping scene frames', () => {
    const plan: RenderPlan = {
      fps: 30,
      totalFrames: 250,
      totalDurationMs: 8333,
      sceneCount: 2,
      scenes: [
        {
          sceneIndex: 0,
          diagramType: 'flowchart',
          startFrame: 0,
          endFrame: 200,
          totalFrames: 200,
          durationMs: 6666,
          transitionFrames: 8,
          contentReadyFrame: 17,
          nodeCount: 1,
          edgeCount: 0,
          hasLayout: false,
          summary: 'S1',
        },
        {
          sceneIndex: 1,
          diagramType: 'flowchart',
          startFrame: 100, // Overlap! Previous ends at 200
          endFrame: 250,
          totalFrames: 150,
          durationMs: 5000,
          transitionFrames: 8,
          contentReadyFrame: 17,
          nodeCount: 1,
          edgeCount: 0,
          hasLayout: false,
          summary: 'S2',
        },
      ],
    };
    const result = validateRenderPlan(plan);
    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.includes('gap/overlap'))).toBe(true);
  });
});

describe('validateRenderPlan — total frames mismatch', () => {
  it('should detect when totalFrames does not match sum of scene frames', () => {
    const plan = generateRenderPlan(makeScenes(2));
    // Corrupt the total
    const corrupted: RenderPlan = {
      ...plan,
      totalFrames: plan.totalFrames + 100,
    };
    const result = validateRenderPlan(corrupted);
    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.includes('Total frames mismatch'))).toBe(
      true,
    );
  });
});

describe('validateRenderPlan — duplicate scene indices', () => {
  it('should detect duplicate scene indices', () => {
    const plan = generateRenderPlan(makeScenes(2));
    const corrupted: RenderPlan = {
      ...plan,
      scenes: plan.scenes.map((s, i) => ({ ...s, sceneIndex: 0 })) as SceneRenderSpec[],
    };
    const result = validateRenderPlan(corrupted);
    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.includes('Duplicate scene indices'))).toBe(
      true,
    );
  });
});

describe('validateRenderPlan — scene count mismatch', () => {
  it('should detect when sceneCount does not match scenes.length', () => {
    const plan = generateRenderPlan(makeScenes(3));
    const corrupted: RenderPlan = {
      ...plan,
      sceneCount: 5,
    };
    const result = validateRenderPlan(corrupted);
    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.includes('Scene count mismatch'))).toBe(
      true,
    );
  });
});

describe('validateRenderPlan — multiple issues', () => {
  it('should report all issues simultaneously', () => {
    const plan: RenderPlan = {
      fps: 30,
      totalFrames: 999,
      totalDurationMs: 10000,
      sceneCount: 99,
      scenes: [
        {
          sceneIndex: 0,
          diagramType: 'flowchart',
          startFrame: 0,
          endFrame: 100,
          totalFrames: 100,
          durationMs: 5000,
          transitionFrames: 8,
          contentReadyFrame: 17,
          nodeCount: 1,
          edgeCount: 0,
          hasLayout: false,
          summary: 'S1',
        },
        {
          sceneIndex: 0, // Duplicate
          diagramType: 'flowchart',
          startFrame: 50, // Overlap
          endFrame: 150,
          totalFrames: 100,
          durationMs: 5000,
          transitionFrames: 8,
          contentReadyFrame: 17,
          nodeCount: 1,
          edgeCount: 0,
          hasLayout: false,
          summary: 'S2',
        },
      ],
    };
    const result = validateRenderPlan(plan);
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThanOrEqual(4);
    expect(result.issues.some(i => i.includes('Total frames mismatch'))).toBe(true);
    expect(result.issues.some(i => i.includes('gap/overlap'))).toBe(true);
    expect(result.issues.some(i => i.includes('Duplicate scene indices'))).toBe(true);
    expect(result.issues.some(i => i.includes('Scene count mismatch'))).toBe(true);
  });
});
