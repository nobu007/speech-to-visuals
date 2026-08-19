/**
 * Tests for Video overlay integration
 * Validates the scenesToKeyphraseScenes mapper and VideoProps extension
 * for KeyphraseOverlay and CaptionOverlay wiring.
 */

import { scenesToKeyphraseScenes, calculateTotalFrames } from '@/remotion/Video';
import type { SceneGraph } from '@stv/core/types/diagram';

function makeScene(overrides: Partial<SceneGraph> & { durationMs: number }): SceneGraph {
  return {
    type: 'flow',
    title: 'Test Scene',
    nodes: [],
    edges: [],
    startMs: 0,
    summary: '',
    keyphrases: [],
    ...overrides,
  };
}

describe('scenesToKeyphraseScenes', () => {
  it('converts empty array', () => {
    expect(scenesToKeyphraseScenes([])).toEqual([]);
  });

  it('maps single scene with keyphrases', () => {
    const scenes: SceneGraph[] = [
      makeScene({ durationMs: 5000, keyphrases: ['AI', 'pipeline'] }),
    ];
    const result = scenesToKeyphraseScenes(scenes);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      startMs: 0,
      durationMs: 5000,
      keyphrases: ['AI', 'pipeline'],
    });
  });

  it('computes cumulative startMs across scenes', () => {
    const scenes: SceneGraph[] = [
      makeScene({ durationMs: 3000, keyphrases: ['first'] }),
      makeScene({ durationMs: 4000, keyphrases: ['second'] }),
      makeScene({ durationMs: 2000, keyphrases: ['third'] }),
    ];
    const result = scenesToKeyphraseScenes(scenes);

    expect(result).toEqual([
      { startMs: 0, durationMs: 3000, keyphrases: ['first'] },
      { startMs: 3000, durationMs: 4000, keyphrases: ['second'] },
      { startMs: 7000, durationMs: 2000, keyphrases: ['third'] },
    ]);
  });

  it('handles scenes with undefined keyphrases gracefully', () => {
    const scenes = [
      makeScene({ durationMs: 2000 }),
    ];
    // Force keyphrases to undefined
    scenes[0].keyphrases = undefined as unknown as string[];

    const result = scenesToKeyphraseScenes(scenes);
    expect(result[0].keyphrases).toEqual([]);
  });

  it('preserves empty keyphrases arrays', () => {
    const scenes: SceneGraph[] = [
      makeScene({ durationMs: 1000, keyphrases: [] }),
      makeScene({ durationMs: 2000, keyphrases: ['hello'] }),
    ];
    const result = scenesToKeyphraseScenes(scenes);

    expect(result[0].keyphrases).toEqual([]);
    expect(result[1].keyphrases).toEqual(['hello']);
  });

  it('handles scenes with undefined durationMs without producing NaN', () => {
    const scenes = [
      makeScene({ durationMs: 3000 }),
      makeScene({ durationMs: 0 }),
    ];
    // Force durationMs to undefined on second scene
    (scenes[1] as Record<string, unknown>).durationMs = undefined;

    const result = scenesToKeyphraseScenes(scenes as SceneGraph[]);
    expect(result).toHaveLength(2);
    expect(result[0].startMs).toBe(0);
    expect(result[0].durationMs).toBe(3000);
    // Second scene should have durationMs 0, startMs 3000 (no NaN propagation)
    expect(result[1].durationMs).toBe(0);
    expect(result[1].startMs).toBe(3000);
    expect(Number.isNaN(result[1].startMs)).toBe(false);
    expect(Number.isNaN(result[1].durationMs)).toBe(false);
  });
});

describe('calculateTotalFrames NaN guard', () => {
  it('handles scenes with undefined durationMs', () => {
    const scenes: SceneGraph[] = [
      {
        type: 'flow',
        title: 'Test',
        nodes: [],
        edges: [],
        startMs: 0,
        durationMs: 5000,
        summary: '',
        keyphrases: [],
      },
    ];
    // Force durationMs to undefined
    (scenes[0] as Record<string, unknown>).durationMs = undefined;

    const frames = calculateTotalFrames(scenes as SceneGraph[], 30);
    expect(Number.isNaN(frames)).toBe(false);
    // calculateTotalFrames uses Math.max(1, raw) to guarantee at least 1 frame
    expect(frames).toBe(1); // undefined durationMs → totalMs=0 → Math.max(1, 0) = 1
  });

  it('handles mix of valid and undefined durationMs', () => {
    const scenes = [
      { type: 'flow', title: 'A', nodes: [], edges: [], startMs: 0, durationMs: 3000, summary: '', keyphrases: [] },
      { type: 'flow', title: 'B', nodes: [], edges: [], startMs: 0, durationMs: undefined, summary: '', keyphrases: [] },
      { type: 'flow', title: 'C', nodes: [], edges: [], startMs: 0, durationMs: 2000, summary: '', keyphrases: [] },
    ];

    const frames = calculateTotalFrames(scenes as unknown as SceneGraph[], 30);
    expect(Number.isNaN(frames)).toBe(false);
    // (3000 + 0 + 2000) / 1000 * 30 = 150
    expect(frames).toBe(150);
  });
});
