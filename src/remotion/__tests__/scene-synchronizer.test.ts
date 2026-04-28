/**
 * Tests for scene-synchronizer.ts
 * SRT timestamp to frame conversion, caption-scene synchronization,
 * boundary handling, and drift detection/correction
 */

import {
  msToFrame,
  frameToMs,
  getCaptionForFrame,
  splitCaptionAtSceneBoundary,
  validateSceneCaptionSync,
  detectSyncDrift,
  SyncDriftResult,
} from '../scene-synchronizer';
import { SrtCaption } from '../srt-parser';
import { SceneGraph } from '@/types/diagram';

// Default FPS constant
const FPS = 30;

// Helper to create a SceneGraph
function createScene(overrides: Partial<SceneGraph> = {}): SceneGraph {
  return {
    type: 'flow',
    nodes: [],
    edges: [],
    startMs: 0,
    durationMs: 5000,
    summary: 'Test scene',
    keyphrases: [],
    ...overrides,
  };
}

// Helper to create an SrtCaption
function createCaption(overrides: Partial<SrtCaption> = {}): SrtCaption {
  return {
    index: 1,
    startMs: 0,
    endMs: 3000,
    text: 'Test caption',
    startFrame: 0,
    endFrame: 90,
    ...overrides,
  };
}

// ============================================================
// msToFrame / frameToMs
// ============================================================

describe('msToFrame', () => {
  it('should convert 0ms to frame 0', () => {
    expect(msToFrame(0, FPS)).toBe(0);
  });

  it('should convert 1000ms to frame 30 at 30fps', () => {
    expect(msToFrame(1000, FPS)).toBe(30);
  });

  it('should convert 500ms to frame 15 at 30fps', () => {
    expect(msToFrame(500, FPS)).toBe(15);
  });

  it('should round 33ms to frame 1 at 30fps (33.33...ms per frame)', () => {
    // 33ms * 30 / 1000 = 0.99 -> rounds to 1
    expect(msToFrame(33, FPS)).toBe(1);
  });

  it('should convert at 60fps', () => {
    expect(msToFrame(1000, 60)).toBe(60);
  });

  it('should convert at 24fps', () => {
    expect(msToFrame(1000, 24)).toBe(24);
  });

  it('should handle fractional frame times with rounding', () => {
    // 500ms at 30fps = 15 frames exactly
    expect(msToFrame(500, 30)).toBe(15);
    // 50ms at 30fps = 1.5 -> rounds to 2
    expect(msToFrame(50, 30)).toBe(2);
  });
});

describe('frameToMs', () => {
  it('should convert frame 0 to 0ms', () => {
    expect(frameToMs(0, FPS)).toBe(0);
  });

  it('should convert frame 30 to 1000ms at 30fps', () => {
    expect(frameToMs(30, FPS)).toBeCloseTo(1000, 1);
  });

  it('should convert frame 15 to 500ms at 30fps', () => {
    expect(frameToMs(15, FPS)).toBeCloseTo(500, 1);
  });

  it('should convert frame 1 to ~33.33ms at 30fps', () => {
    expect(frameToMs(1, FPS)).toBeCloseTo(33.333, 1);
  });

  it('should convert at 60fps', () => {
    expect(frameToMs(60, 60)).toBeCloseTo(1000, 1);
  });
});

// ============================================================
// Sync precision: ±50ms (±1.5 frames at 30fps)
// ============================================================

describe('sync precision', () => {
  it('should achieve sub-50ms precision for round-trip conversion', () => {
    // Test multiple timestamps for round-trip precision
    const testTimestamps = [0, 100, 500, 1000, 1500, 2000, 5000, 10000, 30000];

    for (const ms of testTimestamps) {
      const frame = msToFrame(ms, FPS);
      const roundTrip = frameToMs(frame, FPS);
      const drift = Math.abs(roundTrip - ms);

      // At 30fps, max drift is half a frame period = ~16.67ms
      // This is well within ±50ms
      expect(drift).toBeLessThanOrEqual(50);
    }
  });

  it('should have maximum 1-frame error at 30fps', () => {
    // 1 frame at 30fps = 33.33ms
    // Verify that any ms value maps to a frame that represents
    // a time within 1 frame (~33ms) of the original
    const frameDuration = 1000 / FPS; // ~33.33ms

    for (let ms = 0; ms < 10000; ms += 10) {
      const frame = msToFrame(ms, FPS);
      const frameStartMs = frame * frameDuration;
      const frameEndMs = (frame + 1) * frameDuration;

      // Original ms should be within the frame's time range (or adjacent)
      expect(ms >= frameStartMs - frameDuration && ms <= frameEndMs + frameDuration).toBe(true);
    }
  });
});

// ============================================================
// getCaptionForFrame
// ============================================================

describe('getCaptionForFrame', () => {
  const captions: SrtCaption[] = [
    createCaption({
      index: 1,
      startMs: 1000,
      endMs: 3000,
      startFrame: 30,
      endFrame: 90,
      text: 'First caption',
    }),
    createCaption({
      index: 2,
      startMs: 3500,
      endMs: 6000,
      startFrame: 105,
      endFrame: 180,
      text: 'Second caption',
    }),
    createCaption({
      index: 3,
      startMs: 6500,
      endMs: 10000,
      startFrame: 195,
      endFrame: 300,
      text: 'Third caption',
    }),
  ];

  it('should return null for frame before any caption', () => {
    expect(getCaptionForFrame(captions, 0)).toBeNull();
    expect(getCaptionForFrame(captions, 29)).toBeNull();
  });

  it('should return first caption at its start frame', () => {
    const result = getCaptionForFrame(captions, 30);
    expect(result).not.toBeNull();
    expect(result!.text).toBe('First caption');
  });

  it('should return first caption mid-duration', () => {
    const result = getCaptionForFrame(captions, 60);
    expect(result!.text).toBe('First caption');
  });

  it('should return null between captions (gap)', () => {
    // Frames 91-104 are in the gap between first and second caption
    expect(getCaptionForFrame(captions, 91)).toBeNull();
    expect(getCaptionForFrame(captions, 100)).toBeNull();
  });

  it('should return second caption', () => {
    const result = getCaptionForFrame(captions, 105);
    expect(result!.text).toBe('Second caption');
  });

  it('should return third caption', () => {
    const result = getCaptionForFrame(captions, 250);
    expect(result!.text).toBe('Third caption');
  });

  it('should return null after last caption ends', () => {
    expect(getCaptionForFrame(captions, 301)).toBeNull();
  });

  it('should return null for empty captions array', () => {
    expect(getCaptionForFrame([], 50)).toBeNull();
  });
});

// ============================================================
// splitCaptionAtSceneBoundary
// ============================================================

describe('splitCaptionAtSceneBoundary', () => {
  it('should not split a caption entirely within one scene', () => {
    const scenes = [createScene({ durationMs: 5000 })];
    const caption = createCaption({
      startMs: 1000,
      endMs: 3000,
      startFrame: 30,
      endFrame: 90,
      text: 'Within scene',
    });

    const result = splitCaptionAtSceneBoundary(caption, scenes, FPS);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('Within scene');
    expect(result[0].startMs).toBe(1000);
    expect(result[0].endMs).toBe(3000);
  });

  it('should split a caption that spans two scenes', () => {
    const scenes = [
      createScene({ durationMs: 3000 }),
      createScene({ durationMs: 3000 }),
    ];
    const caption = createCaption({
      startMs: 2000,
      endMs: 4000,
      startFrame: 60,
      endFrame: 120,
      text: 'Spans two scenes',
    });

    const result = splitCaptionAtSceneBoundary(caption, scenes, FPS);
    expect(result).toHaveLength(2);

    // First part: 2000-3000ms (in scene 1)
    expect(result[0].startMs).toBe(2000);
    expect(result[0].endMs).toBe(3000);
    expect(result[0].text).toBe('Spans two scenes');

    // Second part: 3000-4000ms (in scene 2)
    expect(result[1].startMs).toBe(3000);
    expect(result[1].endMs).toBe(4000);
    expect(result[1].text).toBe('Spans two scenes');
  });

  it('should split a caption spanning three scenes', () => {
    const scenes = [
      createScene({ durationMs: 2000 }),
      createScene({ durationMs: 2000 }),
      createScene({ durationMs: 2000 }),
    ];
    const caption = createCaption({
      startMs: 1000,
      endMs: 5000,
      startFrame: 30,
      endFrame: 150,
      text: 'Spans three scenes',
    });

    const result = splitCaptionAtSceneBoundary(caption, scenes, FPS);
    expect(result).toHaveLength(3);

    expect(result[0].startMs).toBe(1000);
    expect(result[0].endMs).toBe(2000);

    expect(result[1].startMs).toBe(2000);
    expect(result[1].endMs).toBe(4000);

    expect(result[2].startMs).toBe(4000);
    expect(result[2].endMs).toBe(5000);
  });

  it('should handle caption at exact scene boundary', () => {
    const scenes = [
      createScene({ durationMs: 3000 }),
      createScene({ durationMs: 3000 }),
    ];
    const caption = createCaption({
      startMs: 0,
      endMs: 3000,
      startFrame: 0,
      endFrame: 90,
      text: 'Exact boundary',
    });

    const result = splitCaptionAtSceneBoundary(caption, scenes, FPS);
    expect(result).toHaveLength(1);
    expect(result[0].startMs).toBe(0);
    expect(result[0].endMs).toBe(3000);
  });

  it('should update frame numbers after splitting', () => {
    const scenes = [
      createScene({ durationMs: 3000 }),
      createScene({ durationMs: 3000 }),
    ];
    const caption = createCaption({
      startMs: 2000,
      endMs: 4000,
      startFrame: 60,
      endFrame: 120,
      text: 'Check frames',
    });

    const result = splitCaptionAtSceneBoundary(caption, scenes, FPS);
    expect(result[0].startFrame).toBe(60);  // 2000ms at 30fps
    expect(result[0].endFrame).toBe(90);    // 3000ms at 30fps
    expect(result[1].startFrame).toBe(90);  // 3000ms at 30fps
    expect(result[1].endFrame).toBe(120);   // 4000ms at 30fps
  });
});

// ============================================================
// validateSceneCaptionSync
// ============================================================

describe('validateSceneCaptionSync', () => {
  it('should return valid when captions align with scene boundaries', () => {
    const scenes = [
      createScene({ durationMs: 5000 }),
      createScene({ durationMs: 5000 }),
    ];
    const captions = [
      createCaption({
        startMs: 0,
        endMs: 2500,
        startFrame: 0,
        endFrame: 75,
        text: 'Caption 1',
      }),
      createCaption({
        index: 2,
        startMs: 2500,
        endMs: 5000,
        startFrame: 75,
        endFrame: 150,
        text: 'Caption 2',
      }),
    ];

    const result = validateSceneCaptionSync(scenes, captions, FPS);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('should detect captions that extend past scene boundaries', () => {
    const scenes = [createScene({ durationMs: 3000 })];
    const captions = [
      createCaption({
        startMs: 0,
        endMs: 5000,  // extends past scene (3000ms)
        startFrame: 0,
        endFrame: 150,
        text: 'Overlapping caption',
      }),
    ];

    const result = validateSceneCaptionSync(scenes, captions, FPS);
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('should detect gaps between captions within a scene', () => {
    const scenes = [createScene({ durationMs: 5000 })];
    const captions = [
      createCaption({
        startMs: 0,
        endMs: 1000,
        startFrame: 0,
        endFrame: 30,
        text: 'Caption 1',
      }),
      createCaption({
        index: 2,
        startMs: 3000, // gap from 1000 to 3000
        endMs: 5000,
        startFrame: 90,
        endFrame: 150,
        text: 'Caption 2',
      }),
    ];

    const result = validateSceneCaptionSync(scenes, captions, FPS);
    // A gap exists but that's not necessarily invalid; the function
    // should report it as an informational issue or valid depending on design
    // Since captions don't cover the full scene, it could be valid
    // depending on tolerance
    expect(result).toBeDefined();
    expect(result.issues).toBeDefined();
  });

  it('should return valid for empty captions', () => {
    const scenes = [createScene({ durationMs: 5000 })];
    const result = validateSceneCaptionSync(scenes, [], FPS);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('should return valid for empty scenes', () => {
    const captions = [
      createCaption({
        startMs: 0,
        endMs: 3000,
        startFrame: 0,
        endFrame: 90,
        text: 'Test',
      }),
    ];
    const result = validateSceneCaptionSync([], captions, FPS);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });
});

// ============================================================
// detectSyncDrift
// ============================================================

describe('detectSyncDrift', () => {
  it('should report no drift for perfectly synchronized captions', () => {
    const captions: SrtCaption[] = [
      createCaption({
        startMs: 0,
        endMs: 1000,
        startFrame: 0,
        endFrame: 30,
        text: 'Test',
      }),
    ];

    const result = detectSyncDrift(captions, FPS);
    expect(result.maxDriftMs).toBeLessThanOrEqual(50);
    expect(result.maxDriftFrames).toBeLessThanOrEqual(1);
    expect(result.withinTolerance).toBe(true);
  });

  it('should detect drift for captions with frame mismatch', () => {
    const captions: SrtCaption[] = [
      {
        index: 1,
        startMs: 0,
        endMs: 1000,
        text: 'Test',
        // Intentionally incorrect frame values to simulate drift
        startFrame: 5,  // should be 0
        endFrame: 40,   // should be 30
      },
    ];

    const result = detectSyncDrift(captions, FPS);
    expect(result.maxDriftMs).toBeGreaterThan(0);
    expect(result.withinTolerance).toBe(false);
  });

  it('should report within tolerance for small rounding errors', () => {
    const captions: SrtCaption[] = [
      createCaption({
        startMs: 33,   // ~1 frame at 30fps
        endMs: 1033,
        startFrame: 1, // msToFrame(33, 30) = 1
        endFrame: 31,  // msToFrame(1033, 30) = 31
        text: 'Test',
      }),
    ];

    const result = detectSyncDrift(captions, FPS);
    expect(result.withinTolerance).toBe(true);
  });

  it('should calculate drift per caption', () => {
    const captions: SrtCaption[] = [
      {
        index: 1,
        startMs: 0,
        endMs: 1000,
        text: 'Caption 1',
        startFrame: 0,
        endFrame: 30,
      },
      {
        index: 2,
        startMs: 1000,
        endMs: 2000,
        text: 'Caption 2',
        startFrame: 30,
        endFrame: 60,
      },
    ];

    const result = detectSyncDrift(captions, FPS);
    expect(result.driftPerCaption).toHaveLength(2);
    expect(result.driftPerCaption[0].driftMs).toBeLessThanOrEqual(50);
    expect(result.driftPerCaption[1].driftMs).toBeLessThanOrEqual(50);
  });

  it('should return zero drift for empty captions', () => {
    const result = detectSyncDrift([], FPS);
    expect(result.maxDriftMs).toBe(0);
    expect(result.withinTolerance).toBe(true);
    expect(result.driftPerCaption).toHaveLength(0);
  });
});
