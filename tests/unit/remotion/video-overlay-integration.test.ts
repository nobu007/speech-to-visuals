/**
 * Tests for Video overlay integration
 * Validates the scenesToKeyphraseScenes mapper and VideoProps extension
 * for KeyphraseOverlay and CaptionOverlay wiring.
 */

import { describe, it, expect } from '@jest/globals';
import { scenesToKeyphraseScenes } from '@/remotion/Video';
import type { SceneGraph } from '@/types/diagram';

function makeScene(overrides: Partial<SceneGraph> & { durationMs: number }): SceneGraph {
  return {
    type: 'flow',
    title: 'Test Scene',
    nodes: [],
    edges: [],
    startMs: 0,
    durationMs: overrides.durationMs,
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
});
