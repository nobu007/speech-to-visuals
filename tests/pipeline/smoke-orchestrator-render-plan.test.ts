/**
 * Focused unit test: render-plan consistency with buildMultiScenes output.
 *
 * Bridges the gap between scene-building (buildMultiScenes) and render-plan
 * generation (generateRenderPlan), verifying that sequential timing from
 * buildMultiScenes produces valid, contiguous render plans without going
 * through the full smoke-orchestrator integration pipeline.
 */

import { describe, it, expect } from '@jest/globals';
import {
  buildMultiScenes,
  type RawDiagram,
} from '@/pipeline/smoke-orchestrator';
import {
  generateRenderPlan,
  validateRenderPlan,
} from '@/pipeline/scene-render-spec-generator';
import { DEFAULT_FPS } from '@/remotion/scene-synchronizer';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DIAGRAM_FLOW: RawDiagram = {
  type: 'flow',
  nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
  edges: [{ from: 'a', to: 'b' }],
  summary: 'Flow diagram',
};

const DIAGRAM_TREE: RawDiagram = {
  type: 'tree',
  nodes: [
    { id: 'r', label: 'Root' },
    { id: 'c1', label: 'C1' },
    { id: 'c2', label: 'C2' },
  ],
  edges: [{ from: 'r', to: 'c1' }, { from: 'r', to: 'c2' }],
  summary: 'Tree diagram',
};

const DIAGRAM_CYCLE: RawDiagram = {
  type: 'cycle',
  nodes: [
    { id: 'x', label: 'X' },
    { id: 'y', label: 'Y' },
    { id: 'z', label: 'Z' },
    { id: 'w', label: 'W' },
  ],
  edges: [
    { from: 'x', to: 'y' },
    { from: 'y', to: 'z' },
    { from: 'z', to: 'w' },
    { from: 'w', to: 'x' },
  ],
  summary: 'Cycle diagram',
};

const DIAGRAM_SINGLE_NODE: RawDiagram = {
  type: 'general',
  nodes: [{ id: 'solo', label: 'Solo' }],
  edges: [],
  summary: 'Single node',
};

// ===========================================================================
// render-plan consistency: buildMultiScenes → generateRenderPlan
// ===========================================================================

describe('render-plan consistency with buildMultiScenes sequential timing', () => {
  it('buildMultiScenes output produces a valid render plan', () => {
    const { scenes } = buildMultiScenes(
      [DIAGRAM_FLOW, DIAGRAM_TREE, DIAGRAM_CYCLE],
      DEFAULT_FPS,
    );

    const plan = generateRenderPlan(scenes);
    const validation = validateRenderPlan(plan);

    expect(validation.valid).toBe(true);
    expect(validation.issues).toHaveLength(0);
  });

  it('render plan frame ranges are contiguous across multi-scene output', () => {
    const { scenes } = buildMultiScenes(
      [DIAGRAM_FLOW, DIAGRAM_TREE],
      DEFAULT_FPS,
    );
    const plan = generateRenderPlan(scenes);

    // Each scene's startFrame must equal the previous scene's endFrame
    for (let i = 1; i < plan.scenes.length; i++) {
      expect(plan.scenes[i].startFrame).toBe(plan.scenes[i - 1].endFrame);
    }
  });

  it('total frames equals sum of per-scene frames', () => {
    const { scenes } = buildMultiScenes(
      [DIAGRAM_FLOW, DIAGRAM_TREE, DIAGRAM_SINGLE_NODE],
      DEFAULT_FPS,
    );
    const plan = generateRenderPlan(scenes);

    const sumPerScene = plan.scenes.reduce((sum, s) => sum + s.totalFrames, 0);
    expect(plan.totalFrames).toBe(sumPerScene);
  });

  it('total duration matches sum of scene durations', () => {
    const { scenes } = buildMultiScenes(
      [DIAGRAM_FLOW, DIAGRAM_TREE],
      DEFAULT_FPS,
    );
    const plan = generateRenderPlan(scenes);

    // buildMultiScenes assigns DEFAULT_SCENE_DURATION_MS (5000) to each scene
    // generateRenderPlan uses the same duration (within min/max bounds)
    expect(plan.totalDurationMs).toBe(scenes.length * 5000);
    expect(plan.totalDurationMs).toBe(plan.scenes.reduce((s, sc) => s + sc.durationMs, 0));
  });

  it('scene count in render plan matches buildMultiScenes output', () => {
    const diagrams: RawDiagram[] = [
      DIAGRAM_FLOW,
      DIAGRAM_TREE,
      DIAGRAM_CYCLE,
      DIAGRAM_SINGLE_NODE,
    ];
    const { scenes } = buildMultiScenes(diagrams, DEFAULT_FPS);
    const plan = generateRenderPlan(scenes);

    expect(plan.sceneCount).toBe(diagrams.length);
    expect(plan.scenes).toHaveLength(diagrams.length);
  });

  it('node and edge counts in render spec match the original diagrams', () => {
    const { scenes } = buildMultiScenes(
      [DIAGRAM_FLOW, DIAGRAM_CYCLE],
      DEFAULT_FPS,
    );
    const plan = generateRenderPlan(scenes);

    // DIAGRAM_FLOW: 2 nodes, 1 edge
    expect(plan.scenes[0].nodeCount).toBe(2);
    expect(plan.scenes[0].edgeCount).toBe(1);

    // DIAGRAM_CYCLE: 4 nodes, 4 edges
    expect(plan.scenes[1].nodeCount).toBe(4);
    expect(plan.scenes[1].edgeCount).toBe(4);
  });

  it('diagram types are preserved in render specs', () => {
    const { scenes } = buildMultiScenes(
      [DIAGRAM_FLOW, DIAGRAM_TREE, DIAGRAM_CYCLE],
      DEFAULT_FPS,
    );
    const plan = generateRenderPlan(scenes);

    expect(plan.scenes[0].diagramType).toBe('flow');
    expect(plan.scenes[1].diagramType).toBe('tree');
    expect(plan.scenes[2].diagramType).toBe('cycle');
  });

  it('summaries are preserved in render specs', () => {
    const { scenes } = buildMultiScenes(
      [DIAGRAM_FLOW, DIAGRAM_TREE],
      DEFAULT_FPS,
    );
    const plan = generateRenderPlan(scenes);

    expect(plan.scenes[0].summary).toBe('Flow diagram');
    expect(plan.scenes[1].summary).toBe('Tree diagram');
  });

  it('single-scene buildMultiScenes output produces valid render plan', () => {
    const { scenes } = buildMultiScenes([DIAGRAM_FLOW], DEFAULT_FPS);
    const plan = generateRenderPlan(scenes);
    const validation = validateRenderPlan(plan);

    expect(validation.valid).toBe(true);
    expect(plan.sceneCount).toBe(1);
    expect(plan.scenes[0].startFrame).toBe(0);
  });

  it('works with non-default fps', () => {
    const fps = 24;
    const { scenes } = buildMultiScenes(
      [DIAGRAM_FLOW, DIAGRAM_TREE],
      fps,
    );
    const plan = generateRenderPlan(scenes, { fps });
    const validation = validateRenderPlan(plan);

    expect(validation.valid).toBe(true);
    expect(plan.fps).toBe(24);

    // Verify frame calculations: 5s * 24fps = 120 frames per scene
    expect(plan.scenes[0].totalFrames).toBe(120);
    expect(plan.scenes[1].startFrame).toBe(120);
    expect(plan.scenes[1].totalFrames).toBe(120);
    expect(plan.totalFrames).toBe(240);
  });

  it('contentReadyFrame is consistent across scenes with varying node counts', () => {
    const { scenes } = buildMultiScenes(
      [DIAGRAM_FLOW, DIAGRAM_TREE, DIAGRAM_CYCLE, DIAGRAM_SINGLE_NODE],
      DEFAULT_FPS,
    );
    const plan = generateRenderPlan(scenes);

    // Node counts: 2, 3, 4, 1
    // contentReadyFrame = transitionFrames(8) + (nodeCount-1)*stagger(5) + fadeFrames(9)
    // Scene 0: 8 + 1*5 + 9 = 22
    expect(plan.scenes[0].contentReadyFrame).toBe(22);
    // Scene 1: 8 + 2*5 + 9 = 27
    expect(plan.scenes[1].contentReadyFrame).toBe(27);
    // Scene 2: 8 + 3*5 + 9 = 32
    expect(plan.scenes[2].contentReadyFrame).toBe(32);
    // Scene 3: 8 + 0*5 + 9 = 17
    expect(plan.scenes[3].contentReadyFrame).toBe(17);

    // All contentReadyFrame values must be <= totalFrames
    for (const spec of plan.scenes) {
      expect(spec.contentReadyFrame).toBeLessThanOrEqual(spec.totalFrames);
    }
  });

  it('render plan validation detects if scene timing is tampered', () => {
    const { scenes } = buildMultiScenes(
      [DIAGRAM_FLOW, DIAGRAM_TREE],
      DEFAULT_FPS,
    );
    const plan = generateRenderPlan(scenes);

    // Tamper: shift second scene's startFrame to create a gap
    const tamperedPlan = {
      ...plan,
      scenes: plan.scenes.map((s, i) =>
        i === 1 ? { ...s, startFrame: s.startFrame + 10 } : s,
      ),
    };

    const validation = validateRenderPlan(tamperedPlan);
    expect(validation.valid).toBe(false);
    expect(validation.issues.some((i) => i.includes('gap/overlap'))).toBe(true);
  });

  it('frame-to-ms roundtrip is consistent across the multi-scene timeline', () => {
    const fps = 30;
    const { scenes } = buildMultiScenes(
      [DIAGRAM_FLOW, DIAGRAM_TREE, DIAGRAM_CYCLE],
      fps,
    );
    const plan = generateRenderPlan(scenes);

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const spec = plan.scenes[i];

      // Each scene's duration should match between scene and render spec
      expect(spec.durationMs).toBe(scene.durationMs);

      // Frame count derived from duration
      const expectedFrames = Math.round((scene.durationMs / 1000) * fps);
      expect(spec.totalFrames).toBe(expectedFrames);
    }
  });

  it('buildMultiScenes startMs aligns with render plan startFrame', () => {
    const { scenes } = buildMultiScenes(
      [DIAGRAM_FLOW, DIAGRAM_TREE, DIAGRAM_CYCLE],
      DEFAULT_FPS,
    );
    const plan = generateRenderPlan(scenes);

    for (let i = 0; i < scenes.length; i++) {
      const expectedStartFrame = Math.round(
        (scenes[i].startMs / 1000) * DEFAULT_FPS,
      );
      expect(plan.scenes[i].startFrame).toBe(expectedStartFrame);
    }
  });
});
