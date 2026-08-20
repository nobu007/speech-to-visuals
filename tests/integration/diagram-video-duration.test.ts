/**
 * Integration test: DiagramVideo frame count vs scene durations
 *
 * Context: A previous bug in DiagramVideo.tsx divided durationMs by 1000
 * (treating ms as seconds), making scenes ~1000x shorter than intended.
 * This test verifies that:
 *
 * 1. calculateTotalFrames produces the correct frame count for known scene durations
 * 2. Every frame maps to the expected scene via the same ms-based time logic
 *    used in DiagramVideo (frame / fps * 1000 = currentTimeMs)
 * 3. The total frame count covers all scene durations without large gaps
 *
 * This catches time-unit regressions at the integration layer.
 */

import {
  calculateTotalFrames,
  findSceneAtTime,
  DEFAULT_FPS,
} from '@/remotion/Video';
import type { SceneGraph } from '@stv/core/types/diagram';

function makeScene(durationMs: number, title: string): SceneGraph {
  return {
    type: 'flow',
    title,
    nodes: [],
    edges: [],
    startMs: 0,
    durationMs,
    summary: '',
    keyphrases: [],
  };
}

describe('DiagramVideo time-unit integration', () => {
  describe('calculateTotalFrames matches expected scene durations at 30fps', () => {
    const testCases: Array<{
      name: string;
      scenes: SceneGraph[];
      expectedFrames: number;
    }> = [
      {
        name: 'single 5-second scene → 150 frames',
        scenes: [makeScene(5000, 'A')],
        expectedFrames: 150,
      },
      {
        name: 'two 3-second scenes → 180 frames',
        scenes: [makeScene(3000, 'A'), makeScene(3000, 'B')],
        expectedFrames: 180,
      },
      {
        name: 'three scenes: 2s + 4s + 1s → 210 frames',
        scenes: [makeScene(2000, 'A'), makeScene(4000, 'B'), makeScene(1000, 'C')],
        expectedFrames: 210,
      },
      {
        name: 'single 10-second scene → 300 frames',
        scenes: [makeScene(10000, 'Long')],
        expectedFrames: 300,
      },
    ];

    for (const tc of testCases) {
      it(tc.name, () => {
        const frames = calculateTotalFrames(tc.scenes, DEFAULT_FPS);
        expect(frames).toBe(tc.expectedFrames);
      });
    }
  });

  describe('every frame maps to the correct scene (ms-based time logic)', () => {
    it('2 scenes × 3 seconds each: frames 0-89 → scene 0, 90-179 → scene 1', () => {
      const scenes = [makeScene(3000, 'First'), makeScene(3000, 'Second')];
      const totalFrames = calculateTotalFrames(scenes, DEFAULT_FPS);
      expect(totalFrames).toBe(180);

      for (let frame = 0; frame < totalFrames; frame++) {
        // This is the same conversion used in DiagramVideo.tsx line 20:
        //   const currentTime = (frame / Math.max(fps, 1)) * 1000;
        const currentTimeMs = (frame / DEFAULT_FPS) * 1000;
        const result = findSceneAtTime(scenes, currentTimeMs);
        if (result === null) {
          throw new Error('findSceneAtTime returned null during the frame sweep');
        }

        const expectedIndex = frame < 90 ? 0 : 1;
        expect(result.index).toBe(expectedIndex);
      }
    });

    it('3 scenes with different durations: boundary frames are correct', () => {
      const scenes = [
        makeScene(2000, 'A'), // frames 0-59 (0-2000ms)
        makeScene(4000, 'B'), // frames 60-179 (2000-6000ms)
        makeScene(1000, 'C'),  // frames 180-209 (6000-7000ms)
      ];
      const totalFrames = calculateTotalFrames(scenes, DEFAULT_FPS);
      expect(totalFrames).toBe(210);

      // Check boundary frames
      const checks: Array<{ frame: number; expectedScene: number }> = [
        { frame: 0, expectedScene: 0 },
        { frame: 59, expectedScene: 0 }, // 59/30*1000 = 1966ms → scene A
        { frame: 60, expectedScene: 1 }, // 60/30*1000 = 2000ms → scene B (boundary)
        { frame: 179, expectedScene: 1 }, // 179/30*1000 = 5966ms → scene B
        { frame: 180, expectedScene: 2 }, // 180/30*1000 = 6000ms → scene C (boundary)
        { frame: 209, expectedScene: 2 }, // 209/30*1000 = 6966ms → scene C
      ];

      for (const { frame, expectedScene } of checks) {
        const currentTimeMs = (frame / DEFAULT_FPS) * 1000;
        const result = findSceneAtTime(scenes, currentTimeMs);
        if (result === null) {
          throw new Error('findSceneAtTime returned null during the frame sweep');
        }
        expect(result.index).toBe(expectedScene);
      }
    });
  });

  describe('regression guard: time-unit must be milliseconds (not seconds)', () => {
    /**
     * The old bug: DiagramVideo divided durationMs by 1000, effectively
     * treating ms as seconds. A 5000ms scene became 5 "seconds" → then
     * was treated as 5ms → only ~0.15 frames at 30fps.
     *
     * This test verifies that a 5000ms scene produces 150 frames (5 seconds
     * at 30fps), not approximately 0 frames.
     */
    it('5000ms scene must produce ~150 frames, not ~0', () => {
      const scenes = [makeScene(5000, 'Five Seconds')];
      const frames = calculateTotalFrames(scenes, DEFAULT_FPS);
      // Correct: 5000ms / 1000 * 30fps = 150 frames
      // Buggy: 5000ms / 1000 / 1000 * 30fps = 0.15 → rounds to 0 or 1
      expect(frames).toBeGreaterThanOrEqual(149);
      expect(frames).toBeLessThanOrEqual(150);
    });

    it('30000ms scene must produce ~900 frames (30 seconds at 30fps)', () => {
      const scenes = [makeScene(30000, 'Thirty Seconds')];
      const frames = calculateTotalFrames(scenes, DEFAULT_FPS);
      expect(frames).toBeGreaterThanOrEqual(899);
      expect(frames).toBeLessThanOrEqual(900);
    });
  });

  describe('findSceneAtTime at exact boundaries', () => {
    it('returns null for time beyond all scenes', () => {
      const scenes = [makeScene(3000, 'A')];
      // Exactly at the end
      expect(findSceneAtTime(scenes, 3000)).toBeNull();
      // Beyond the end
      expect(findSceneAtTime(scenes, 3001)).toBeNull();
    });

    it('returns first scene at time 0', () => {
      const scenes = [makeScene(3000, 'A'), makeScene(3000, 'B')];
      const result = findSceneAtTime(scenes, 0);
      if (result === null) {
        throw new Error('findSceneAtTime returned null at t=0 despite a scene starting at 0ms');
      }
      expect(result.index).toBe(0);
      expect(result.timeInScene).toBe(0);
    });
  });
});
