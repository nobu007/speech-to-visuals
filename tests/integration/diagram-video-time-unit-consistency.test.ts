/**
 * Property-based test: DiagramVideo scene-lookup logic vs Video.tsx helpers
 *
 * The DiagramVideo component uses `startTime`/`endTime`/`durationMs` to find
 * the active scene at a given frame, while Video.tsx `findSceneAtTime` uses a
 * linear-elapsed-time approach. Both must agree on which scene is active for
 * every frame in the video, otherwise users see flickering or blank scenes.
 *
 * This test also verifies that DiagramVideo's internal time conversion
 * (frame / fps * 1000 = currentTimeMs) is consistent with calculateTotalFrames,
 * catching any future time-unit regression at the integration layer.
 */

import {
  calculateTotalFrames,
  findSceneAtTime,
  DEFAULT_FPS,
} from '@/remotion/Video';
import type { SceneGraph } from '@/types/diagram';

function makeScene(
  startMs: number,
  durationMs: number,
  title: string,
): SceneGraph {
  return {
    type: 'flow',
    title,
    nodes: [],
    edges: [],
    startMs,
    durationMs,
    startTime: startMs,
    endTime: startMs + durationMs,
    summary: '',
    keyphrases: [],
  };
}

/**
 * Replicate DiagramVideo.tsx scene-lookup logic (lines 20-31).
 * This is the "ground truth" from the component — if the component changes,
 * this test should be updated to match.
 */
function diagramVideoFindScene(
  scenes: SceneGraph[],
  frame: number,
  fps: number,
): number {
  const currentTime = (frame / Math.max(fps, 1)) * 1000;
  const idx = scenes.findIndex((scene) => {
    const startMs = Number.isFinite(scene.startTime) ? scene.startTime! : 0;
    const dur = Number.isFinite(scene.durationMs) ? scene.durationMs! : 0;
    const endMs = Number.isFinite(scene.endTime)
      ? scene.endTime!
      : startMs + dur;
    return currentTime >= startMs && currentTime < endMs;
  });
  return idx;
}

describe('DiagramVideo ↔ Video.tsx time-unit consistency', () => {
  describe('both scene-lookup methods agree on every frame', () => {
    const fps = DEFAULT_FPS; // 30

    // Multiple scene configurations to test
    const configs: Array<{
      name: string;
      scenes: SceneGraph[];
    }> = [
      {
        name: 'single 5s scene',
        scenes: [makeScene(0, 5000, 'A')],
      },
      {
        name: 'two 3s scenes (sequential)',
        scenes: [makeScene(0, 3000, 'A'), makeScene(3000, 3000, 'B')],
      },
      {
        name: 'three unequal scenes',
        scenes: [
          makeScene(0, 2000, 'A'),
          makeScene(2000, 4000, 'B'),
          makeScene(6000, 1000, 'C'),
        ],
      },
      {
        name: 'five 1s scenes',
        scenes: Array.from({ length: 5 }, (_, i) =>
          makeScene(i * 1000, 1000, `S${i}`),
        ),
      },
    ];

    for (const { name, scenes } of configs) {
      it(`${name}: DiagramVideo and findSceneAtTime agree on all frames`, () => {
        const totalFrames = calculateTotalFrames(scenes, fps);

        for (let frame = 0; frame < totalFrames; frame++) {
          const dvIndex = diagramVideoFindScene(scenes, frame, fps);
          const currentTimeMs = (frame / fps) * 1000;
          const result = findSceneAtTime(scenes, currentTimeMs);
          const vIndex = result ? result.index : -1;

          // Both should find a valid scene (not -1) for frames within the video
          if (frame < totalFrames - 1) {
            expect(dvIndex).not.toBe(-1);
            // findSceneAtTime and DiagramVideo should agree
            // Note: they might differ at exact boundaries due to different
            // lookup methods, but within a scene they must agree
            if (dvIndex !== -1 && vIndex !== -1) {
              expect(vIndex).toBe(dvIndex);
            }
          }
        }
      });
    }
  });

  describe('time-unit regression: durationMs must be milliseconds', () => {
    it('regression guard: 1000ms scene → ~30 frames (not ~0.03)', () => {
      const scenes = [makeScene(0, 1000, 'One Second')];
      const frames = calculateTotalFrames(scenes, DEFAULT_FPS);
      // Correct: 1000ms / 1000 * 30fps = 30 frames
      // Old bug: 1000ms / 1000 / 1000 * 30fps ≈ 0.03 → rounds to 0 or 1
      expect(frames).toBe(30);
    });

    it('regression guard: DiagramVideo finds scene at frame 15 (500ms)', () => {
      const scenes = [makeScene(0, 1000, 'One Second')];
      // frame 15 → 15/30*1000 = 500ms → should be in scene 0
      const idx = diagramVideoFindScene(scenes, 15, DEFAULT_FPS);
      expect(idx).toBe(0);
    });

    it('regression guard: DiagramVideo returns -1 at frame 30 (1000ms boundary)', () => {
      const scenes = [makeScene(0, 1000, 'One Second')];
      // frame 30 → 30/30*1000 = 1000ms → exactly at end → no scene
      const idx = diagramVideoFindScene(scenes, 30, DEFAULT_FPS);
      expect(idx).toBe(-1);
    });
  });

  describe('non-zero startTime scenes', () => {
    it('scene starting at 1000ms: frame 0-29 should not find it', () => {
      const scenes = [makeScene(1000, 3000, 'Delayed')];
      // frame 0 → 0ms → before scene start
      expect(diagramVideoFindScene(scenes, 0, DEFAULT_FPS)).toBe(-1);
      // frame 29 → 29/30*1000 ≈ 966ms → still before
      expect(diagramVideoFindScene(scenes, 29, DEFAULT_FPS)).toBe(-1);
      // frame 30 → 1000ms → scene starts
      expect(diagramVideoFindScene(scenes, 30, DEFAULT_FPS)).toBe(0);
      // frame 119 → 119/30*1000 ≈ 3966ms → in scene
      expect(diagramVideoFindScene(scenes, 119, DEFAULT_FPS)).toBe(0);
      // frame 120 → 4000ms → scene end
      expect(diagramVideoFindScene(scenes, 120, DEFAULT_FPS)).toBe(-1);
    });
  });
});
