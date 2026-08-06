/**
 * Regression tests for NaN/Infinity guards in src/remotion/
 *
 * Covers:
 *   - EdgeAnimation.calculatePathLength with NaN/Infinity/empty inputs
 *   - Video.findSceneAtTime / calculateTotalFrames / scenesToKeyphraseScenes with NaN durationMs
 *   - scene-synchronizer boundary calculations with NaN durationMs
 *   - renderer.estimateFileSize with NaN quality
 */

import { calculatePathLength } from '@/remotion/EdgeAnimation';
import {
  findSceneAtTime,
  calculateTotalFrames,
  scenesToKeyphraseScenes,
} from '@/remotion/Video';
import type { SceneGraph } from '@/types/diagram';
import {
  splitCaptionAtSceneBoundary,
  validateSceneCaptionSync,
} from '@/remotion/scene-synchronizer';
import type { SrtCaption } from '@/remotion/srt-parser';
import { estimateFileSize } from '@/remotion/renderer';
import type { RenderConfig } from '@/remotion/renderer';

// ---------------------------------------------------------------------------
// EdgeAnimation.calculatePathLength
// ---------------------------------------------------------------------------

describe('calculatePathLength – NaN/Infinity/empty guards', () => {
  it('returns 0 for empty array', () => {
    expect(calculatePathLength([])).toBe(0);
  });

  it('returns 0 for null/undefined input', () => {
    expect(calculatePathLength(null as unknown as never[])).toBe(0);
    expect(calculatePathLength(undefined as unknown as never[])).toBe(0);
  });

  it('returns 0 for single point', () => {
    expect(calculatePathLength([{ x: 10, y: 20 }])).toBe(0);
  });

  it('treats NaN coordinates as 0', () => {
    const length = calculatePathLength([
      { x: NaN, y: 0 },
      { x: 3, y: 4 },
    ]);
    expect(Number.isFinite(length)).toBe(true);
    // NaN→0, so distance from (0,0) to (3,4) = 5
    expect(length).toBe(5);
  });

  it('treats Infinity coordinates as 0', () => {
    const length = calculatePathLength([
      { x: Infinity, y: 0 },
      { x: 0, y: 0 },
    ]);
    expect(Number.isFinite(length)).toBe(true);
    expect(length).toBe(0);
  });

  it('returns 0 when all coordinates are NaN', () => {
    const length = calculatePathLength([
      { x: NaN, y: NaN },
      { x: NaN, y: NaN },
    ]);
    expect(length).toBe(0);
  });

  it('calculates correct length for valid points', () => {
    const length = calculatePathLength([
      { x: 0, y: 0 },
      { x: 3, y: 4 },
    ]);
    expect(length).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Video.findSceneAtTime – NaN durationMs guard
// ---------------------------------------------------------------------------

function makeScene(overrides: Partial<SceneGraph> = {}): SceneGraph {
  return {
    id: 'scene-1',
    type: 'flow',
    durationMs: 5000,
    startMs: 0,
    summary: 'Test scene',
    layout: { nodes: [], edges: [] },
    ...overrides,
  } as SceneGraph;
}

describe('findSceneAtTime – NaN durationMs guard', () => {
  it('handles NaN durationMs without producing NaN timeInScene', () => {
    const scenes = [
      makeScene({ id: 's1', durationMs: NaN, startMs: 0 }),
    ];
    const result = findSceneAtTime(scenes, 1000);
    // With NaN→0, scene has 0 duration so no frame matches
    expect(result).toBeNull();
  });

  it('handles mixed NaN and valid durationMs', () => {
    const scenes = [
      makeScene({ id: 's1', durationMs: NaN, startMs: 0 }),
      makeScene({ id: 's2', durationMs: 5000, startMs: 0 }),
    ];
    const result = findSceneAtTime(scenes, 2000);
    // Should find s2 because s1 has 0 duration (NaN→0)
    expect(result).not.toBeNull();
    expect(result!.scene.id).toBe('s2');
    expect(Number.isFinite(result!.timeInScene)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Video.calculateTotalFrames – NaN durationMs guard
// ---------------------------------------------------------------------------

describe('calculateTotalFrames – NaN durationMs guard', () => {
  it('returns finite result with NaN durationMs in scenes', () => {
    const scenes = [
      makeScene({ durationMs: NaN }),
      makeScene({ durationMs: 3000 }),
    ];
    const result = calculateTotalFrames(scenes, 30);
    expect(Number.isFinite(result)).toBe(true);
    // Only the valid 3000ms counts → 90 frames
    expect(result).toBe(90);
  });

  it('returns finite result with all NaN durations', () => {
    const scenes = [makeScene({ durationMs: NaN })];
    const result = calculateTotalFrames(scenes, 30);
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Video.scenesToKeyphraseScenes – NaN durationMs guard
// ---------------------------------------------------------------------------

describe('scenesToKeyphraseScenes – NaN durationMs guard', () => {
  it('handles NaN durationMs without producing NaN offset', () => {
    const scenes = [
      makeScene({ durationMs: NaN, keyphrases: ['a'] }),
      makeScene({ durationMs: 2000, keyphrases: ['b'] }),
    ];
    const result = scenesToKeyphraseScenes(scenes);
    expect(result).toHaveLength(2);
    expect(Number.isFinite(result[0].durationMs)).toBe(true);
    expect(result[0].durationMs).toBe(0);
    expect(Number.isFinite(result[1].startMs)).toBe(true);
    expect(result[1].startMs).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// scene-synchronizer.splitCaptionAtSceneBoundary – NaN durationMs guard
// ---------------------------------------------------------------------------

describe('splitCaptionAtSceneBoundary – NaN durationMs guard', () => {
  const caption: SrtCaption = {
    index: 1,
    startMs: 0,
    endMs: 5000,
    text: 'Test',
    startFrame: 0,
    endFrame: 150,
  };

  it('handles NaN durationMs in scenes without producing NaN boundaries', () => {
    const scenes = [{ durationMs: NaN }, { durationMs: 3000 }];
    const result = splitCaptionAtSceneBoundary(caption, scenes, 30);
    expect(result.length).toBeGreaterThan(0);
    // None of the result timestamps should be NaN
    for (const seg of result) {
      expect(Number.isFinite(seg.startMs)).toBe(true);
      expect(Number.isFinite(seg.endMs)).toBe(true);
      expect(Number.isFinite(seg.startFrame)).toBe(true);
      expect(Number.isFinite(seg.endFrame)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// scene-synchronizer.validateSceneCaptionSync – NaN durationMs guard
// ---------------------------------------------------------------------------

describe('validateSceneCaptionSync – NaN durationMs guard', () => {
  const captions: SrtCaption[] = [
    { index: 1, startMs: 0, endMs: 3000, text: 'A', startFrame: 0, endFrame: 90 },
  ];

  it('handles NaN durationMs without producing NaN totalSceneMs', () => {
    const scenes = [{ durationMs: NaN }, { durationMs: 5000 }];
    const result = validateSceneCaptionSync(scenes, captions, 30);
    expect(result).toBeDefined();
    // Should not crash and valid should be boolean
    expect(typeof result.valid).toBe('boolean');
  });
});

// ---------------------------------------------------------------------------
// renderer.estimateFileSize – NaN quality guard
// ---------------------------------------------------------------------------

const baseConfig: RenderConfig = {
  resolution: '1080p',
  fps: 30,
  codec: 'h264',
  quality: 23,
  includeAudio: false,
};

describe('estimateFileSize – NaN quality guard', () => {
  it('returns finite result for NaN quality', () => {
    const size = estimateFileSize(
      { ...baseConfig, quality: NaN },
      60,
    );
    expect(Number.isFinite(size)).toBe(true);
    expect(Number.isNaN(size)).toBe(false);
  });

  it('returns finite result for Infinity quality', () => {
    const size = estimateFileSize(
      { ...baseConfig, quality: Infinity },
      60,
    );
    expect(Number.isFinite(size)).toBe(true);
    expect(Number.isNaN(size)).toBe(false);
  });

  it('returns finite result for quality=0', () => {
    const size = estimateFileSize(
      { ...baseConfig, quality: 0 },
      60,
    );
    expect(Number.isFinite(size)).toBe(true);
    expect(size).toBeGreaterThan(0);
  });
});
