/**
 * Focused unit tests for buildMultiScenes sequential-timing logic.
 *
 * These tests exercise the internal scene-building helper directly,
 * independently of the full smoke-orchestrator integration pipeline,
 * to verify that sequential timing (non-zero startMs for scene 2+)
 * is correct for various diagram configurations.
 */

import { describe, it, expect } from '@jest/globals';
import {
  buildMultiScenes,
  buildSingleScene,
  type RawDiagram,
} from '@/pipeline/smoke-orchestrator';
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
  nodes: [{ id: 'r', label: 'Root' }, { id: 'c1', label: 'C1' }, { id: 'c2', label: 'C2' }],
  edges: [{ from: 'r', to: 'c1' }, { from: 'r', to: 'c2' }],
  summary: 'Tree diagram',
};

const DIAGRAM_SINGLE_NODE: RawDiagram = {
  type: 'flow',
  nodes: [{ id: 'only', label: 'Solo' }],
  edges: [],
  summary: 'Single node',
};

const DIAGRAM_EMPTY_NODES: RawDiagram = {
  type: 'timeline',
  nodes: [],
  edges: [],
  summary: 'Empty nodes',
};

// ===========================================================================
// buildSingleScene
// ===========================================================================

describe('buildSingleScene', () => {
  it('places the scene at the given startMs', () => {
    const { scene } = buildSingleScene(DIAGRAM_FLOW, 1234, DEFAULT_FPS);
    expect(scene.startMs).toBe(1234);
  });

  it('uses default duration of 5000ms', () => {
    const { scene } = buildSingleScene(DIAGRAM_FLOW, 0, DEFAULT_FPS);
    expect(scene.durationMs).toBe(5000);
  });

  it('distributes caption timing evenly across nodes from the given startMs', () => {
    const { captions } = buildSingleScene(DIAGRAM_FLOW, 1000, DEFAULT_FPS);
    // 2 nodes, 5000ms duration, starting at 1000ms
    // Node 0: 1000-3500, Node 1: 3500-6000
    expect(captions).toHaveLength(2);
    expect(captions[0].startMs).toBe(1000);
    expect(captions[0].endMs).toBe(3500);
    expect(captions[1].startMs).toBe(3500);
    expect(captions[1].endMs).toBe(6000);
  });
});

// ===========================================================================
// buildMultiScenes — sequential timing
// ===========================================================================

describe('buildMultiScenes sequential timing', () => {
  it('scene 1 starts at 0, scene 2 starts at non-zero (DEFAULT_SCENE_DURATION_MS)', () => {
    const { scenes } = buildMultiScenes([DIAGRAM_FLOW, DIAGRAM_TREE], DEFAULT_FPS);

    expect(scenes).toHaveLength(2);
    expect(scenes[0].startMs).toBe(0);
    expect(scenes[1].startMs).toBe(5000); // DEFAULT_SCENE_DURATION_MS
  });

  it('each subsequent scene starts where the previous one ended', () => {
    const diagrams: RawDiagram[] = [
      DIAGRAM_FLOW,
      DIAGRAM_TREE,
      DIAGRAM_SINGLE_NODE,
      DIAGRAM_EMPTY_NODES,
    ];
    const { scenes } = buildMultiScenes(diagrams, DEFAULT_FPS);

    expect(scenes).toHaveLength(4);

    // All scenes use the same DEFAULT_SCENE_DURATION_MS (5000)
    for (let i = 0; i < scenes.length; i++) {
      expect(scenes[i].startMs).toBe(i * 5000);
      expect(scenes[i].durationMs).toBe(5000);
    }

    // Verify contiguity: each startMs == previous startMs + previous durationMs
    for (let i = 1; i < scenes.length; i++) {
      expect(scenes[i].startMs).toBe(scenes[i - 1].startMs + scenes[i - 1].durationMs);
    }
  });

  it('produces correct total timeline span', () => {
    const { scenes } = buildMultiScenes(
      [DIAGRAM_FLOW, DIAGRAM_TREE, DIAGRAM_SINGLE_NODE],
      DEFAULT_FPS,
    );

    const lastScene = scenes[scenes.length - 1];
    const totalMs = lastScene.startMs + lastScene.durationMs;
    expect(totalMs).toBe(3 * 5000); // 15000ms for 3 scenes
  });

  it('auto-captions are placed within each scene\'s time range', () => {
    const { scenes, captions } = buildMultiScenes(
      [DIAGRAM_FLOW, DIAGRAM_TREE],
      DEFAULT_FPS,
    );

    // Scene 1: 2 nodes -> 2 captions in [0, 5000)
    // Scene 2: 3 nodes -> 3 captions in [5000, 10000)
    expect(captions).toHaveLength(5);

    const scene1Captions = captions.filter(
      (c) => c.startMs >= 0 && c.startMs < 5000,
    );
    const scene2Captions = captions.filter(
      (c) => c.startMs >= 5000 && c.startMs < 10000,
    );
    expect(scene1Captions).toHaveLength(2);
    expect(scene2Captions).toHaveLength(3);

    // All scene-2 captions must have non-zero startMs
    for (const c of scene2Captions) {
      expect(c.startMs).toBeGreaterThan(0);
    }
  });

  it('works with a single diagram (no sequential offset needed)', () => {
    const { scenes, captions } = buildMultiScenes([DIAGRAM_FLOW], DEFAULT_FPS);

    expect(scenes).toHaveLength(1);
    expect(scenes[0].startMs).toBe(0);
    expect(captions).toHaveLength(2);
    expect(captions[0].startMs).toBe(0);
  });

  it('handles empty diagrams array gracefully', () => {
    const { scenes, captions } = buildMultiScenes([], DEFAULT_FPS);

    expect(scenes).toHaveLength(0);
    expect(captions).toHaveLength(0);
  });

  it('preserves diagram type and node/edge structure per scene', () => {
    const { scenes } = buildMultiScenes([DIAGRAM_FLOW, DIAGRAM_TREE], DEFAULT_FPS);

    expect(scenes[0].type).toBe('flow');
    expect(scenes[0].nodes).toHaveLength(2);
    expect(scenes[0].edges).toHaveLength(1);

    expect(scenes[1].type).toBe('tree');
    expect(scenes[1].nodes).toHaveLength(3);
    expect(scenes[1].edges).toHaveLength(2);
  });

  it('caption frames are consistent with ms timing at given fps', () => {
    const fps = 24; // non-default fps
    const { captions } = buildMultiScenes([DIAGRAM_FLOW, DIAGRAM_TREE], fps);

    for (const c of captions) {
      // Frame boundaries should be derivable from ms values
      const expectedStartFrame = Math.round(c.startMs * fps / 1000);
      const expectedEndFrame = Math.round(c.endMs * fps / 1000);
      expect(c.startFrame).toBe(expectedStartFrame);
      expect(c.endFrame).toBe(expectedEndFrame);
    }
  });

  it('produces globally unique, sequential caption indices', () => {
    const { captions } = buildMultiScenes(
      [DIAGRAM_FLOW, DIAGRAM_TREE, DIAGRAM_SINGLE_NODE],
      DEFAULT_FPS,
    );

    // 2 + 3 + 1 = 6 captions total
    expect(captions).toHaveLength(6);

    // Indices must be 1..6 (globally unique and sequential)
    const indices = captions.map((c) => c.index);
    expect(indices).toEqual([1, 2, 3, 4, 5, 6]);

    // No duplicates
    expect(new Set(indices).size).toBe(indices.length);
  });
});

// ===========================================================================
// buildSingleScene — variable duration
// ===========================================================================

describe('buildSingleScene variable duration', () => {
  it('uses custom durationMs when provided', () => {
    const diagram: RawDiagram = {
      type: 'flow',
      nodes: [{ id: 'a', label: 'A' }],
      edges: [],
      summary: 'Custom duration',
      durationMs: 8000,
    };
    const { scene } = buildSingleScene(diagram, 0, DEFAULT_FPS);
    expect(scene.durationMs).toBe(8000);
  });

  it('falls back to default when durationMs is omitted', () => {
    const { scene } = buildSingleScene(DIAGRAM_FLOW, 0, DEFAULT_FPS);
    expect(scene.durationMs).toBe(5000);
  });

  it('distributes captions over the custom duration', () => {
    const diagram: RawDiagram = {
      type: 'flow',
      nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
      edges: [],
      summary: 'Custom duration',
      durationMs: 10000,
    };
    const { captions } = buildSingleScene(diagram, 0, DEFAULT_FPS);
    // 2 nodes over 10000ms: each gets 5000ms
    expect(captions[0].startMs).toBe(0);
    expect(captions[0].endMs).toBe(5000);
    expect(captions[1].startMs).toBe(5000);
    expect(captions[1].endMs).toBe(10000);
  });
});

// ===========================================================================
// buildMultiScenes — variable duration
// ===========================================================================

describe('buildMultiScenes variable duration', () => {
  it('respects per-diagram durationMs for sequential timing', () => {
    const diagrams: RawDiagram[] = [
      { type: 'flow', nodes: [{ id: 'a', label: 'A' }], edges: [], summary: 'S1', durationMs: 3000 },
      { type: 'tree', nodes: [{ id: 'b', label: 'B' }], edges: [], summary: 'S2', durationMs: 7000 },
      { type: 'flow', nodes: [{ id: 'c', label: 'C' }], edges: [], summary: 'S3' }, // default 5000
    ];
    const { scenes } = buildMultiScenes(diagrams, DEFAULT_FPS);

    expect(scenes).toHaveLength(3);
    expect(scenes[0].startMs).toBe(0);
    expect(scenes[0].durationMs).toBe(3000);
    expect(scenes[1].startMs).toBe(3000);
    expect(scenes[1].durationMs).toBe(7000);
    expect(scenes[2].startMs).toBe(10000); // 3000 + 7000
    expect(scenes[2].durationMs).toBe(5000); // default
  });

  it('total timeline span sums variable durations correctly', () => {
    const diagrams: RawDiagram[] = [
      { type: 'flow', nodes: [{ id: 'a', label: 'A' }], edges: [], summary: 'S1', durationMs: 2000 },
      { type: 'tree', nodes: [{ id: 'b', label: 'B' }], edges: [], summary: 'S2', durationMs: 4000 },
    ];
    const { scenes } = buildMultiScenes(diagrams, DEFAULT_FPS);

    const last = scenes[scenes.length - 1];
    expect(last.startMs + last.durationMs).toBe(6000);
  });
});
