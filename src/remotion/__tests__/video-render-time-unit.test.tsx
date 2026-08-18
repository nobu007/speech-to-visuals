/**
 * @jest-environment jsdom
 *
 * Integration test: actually RENDER the video components and verify the
 * active scene at each frame matches the scene durations.
 *
 * Why this file exists (distinct from diagram-video-duration.test.ts and
 * diagram-video-time-unit-consistency.test.ts): those tests replicate the
 * scene-lookup logic in a *separate* helper function and assert against that
 * copy. They cannot catch a regression introduced inside the component itself.
 *
 * This file mounts the REAL SpeechToVisualsVideo and DiagramVideo components
 * (only `remotion` is mocked so we can sweep the frame), renders them with
 * React Testing Library, and asserts which scene's content is visible at each
 * frame. If `durationMs` is ever misinterpreted as seconds again (the original
 * bug that made scenes ~1000x shorter), or if the seconds-based
 * startTime/endTime are compared against a ms `currentTime`, the wrong scene —
 * or the "Preparing..." / "準備中..." fallback — would render, failing these
 * tests at the integration layer. Test scenes are built in real pipeline units
 * (startTime/endTime in seconds) so both bug classes are caught here.
 */

import { jest } from '@jest/globals';
import * as React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import type { SceneGraph } from '@stv/core/types/diagram';

// --- Controllable remotion mock -------------------------------------------------
// `currentFrame` / `currentDuration` are mutated per render so we can sweep
// frames through the real component tree.
let currentFrame = 0;
let currentDuration = 300;
const MOCK_FPS = 30;

jest.unstable_mockModule('remotion', () => {
  const RealReact = jest.requireActual('react') as typeof React;

  const interpolate = (
    input: number,
    inputRange: number[],
    outputRange: number[],
    options: { extrapolateLeft?: string; extrapolateRight?: string } = {},
  ): number => {
    const clampLeft = options.extrapolateLeft === 'clamp';
    const clampRight = options.extrapolateRight === 'clamp';
    if (input <= inputRange[0]) {
      return clampLeft ? outputRange[0] : outputRange[0];
    }
    const last = inputRange.length - 1;
    if (input >= inputRange[last]) {
      return clampRight ? outputRange[last] : outputRange[last];
    }
    for (let i = 0; i < last; i++) {
      if (input >= inputRange[i] && input <= inputRange[i + 1]) {
        const span = inputRange[i + 1] - inputRange[i] || 1;
        const t = (input - inputRange[i]) / span;
        return outputRange[i] + t * (outputRange[i + 1] - outputRange[i]);
      }
    }
    return outputRange[last];
  };

  const AbsoluteFill = ({
    children,
    style,
  }: {
    children?: React.ReactNode;
    style?: React.CSSProperties;
  }) =>
    RealReact.createElement(
      'div',
      { style: { position: 'absolute', inset: 0, ...style } },
      children,
    );

  return {
    AbsoluteFill,
    useCurrentFrame: () => currentFrame,
    useVideoConfig: () => ({
      fps: MOCK_FPS,
      width: 1920,
      height: 1080,
      durationInFrames: currentDuration,
    }),
    interpolate,
    // spring is used by KeyphraseOverlay; a settled value (1) keeps rendering stable.
    spring: () => 1,
    Audio: ({ src }: { src?: string }) =>
      src ? RealReact.createElement('audio', { src }) : null,
    Sequence: ({ children }: { children?: React.ReactNode }) => children,
    Composition: () => null,
    registerRoot: () => undefined,
    staticFile: (p: string) => p,
    Img: (props: Record<string, unknown>) =>
      RealReact.createElement('img', props),
    delayRender: () => 'delay',
    continueRender: () => undefined,
    cancelRender: () => undefined,
  };
});

const { SpeechToVisualsVideo, calculateTotalFrames, DEFAULT_FPS } = await import(
  '../Video'
);
const { DiagramVideo } = await import('../DiagramVideo');

afterEach(() => {
  cleanup();
});

/**
 * Build a scene in the SAME units simple-pipeline.ts emits:
 *   startMs / durationMs  -> milliseconds
 *   startTime / endTime   -> SECONDS (segStartMs / 1000)
 * Constructing test data in these real units is precisely what lets these
 * component-level tests catch a regression where a ms-based `currentTime` is
 * compared against the seconds-based startTime/endTime — the bug class that
 * made every scene past the first few seconds render the fallback.
 */
function makeScene(
  startMs: number,
  durationMs: number,
  summary: string,
): SceneGraph {
  return {
    type: 'flow',
    title: summary,
    summary,
    nodes: [],
    edges: [],
    startMs,
    durationMs,
    startTime: startMs / 1000,
    endTime: (startMs + durationMs) / 1000,
    keyphrases: [],
  };
}

/** Render a component at a specific frame and return the screen for queries. */
function renderAtFrame(
  Component: React.ComponentType<Record<string, unknown>>,
  props: Record<string, unknown>,
  frame: number,
  duration: number,
) {
  currentFrame = frame;
  currentDuration = duration;
  const utils = render(React.createElement(Component, props));
  return utils;
}

describe('SpeechToVisualsVideo: rendered scene matches frame→duration mapping', () => {
  // Two 3-second scenes → 180 frames. scene A: frames 0-89, scene B: 90-179.
  const scenes = [
    makeScene(0, 3000, 'Alpha scene content'),
    makeScene(3000, 3000, 'Beta scene content'),
  ];
  const total = calculateTotalFrames(scenes, DEFAULT_FPS); // 180

  it('total frame count is ms-based (180 for 6s @ 30fps, not ~0.18)', () => {
    // If durationMs were treated as seconds: 6 / 1000 * 30 ≈ 0.18 → 1 frame.
    expect(total).toBe(180);
  });

  it.each([
    [0, 'Alpha scene content'],
    [45, 'Alpha scene content'],
    [89, 'Alpha scene content'], // 2966ms — still scene A
    [90, 'Beta scene content'], // 3000ms — boundary → scene B
    [134, 'Beta scene content'],
    [179, 'Beta scene content'], // 5966ms — last frame, scene B
  ])('frame %i renders the correct scene', (frame, expectedSummary) => {
    renderAtFrame(
      SpeechToVisualsVideo as unknown as React.ComponentType<Record<string, unknown>>,
      { scenes },
      frame,
      total,
    );
    expect(screen.queryByText(expectedSummary)).not.toBeNull();
  });

  it('scene A is NOT visible during scene B frames (and vice versa)', () => {
    renderAtFrame(
      SpeechToVisualsVideo as unknown as React.ComponentType<Record<string, unknown>>,
      { scenes },
      120,
      total,
    );
    expect(screen.queryByText('Beta scene content')).not.toBeNull();
    expect(screen.queryByText('Alpha scene content')).toBeNull();
  });
});

describe('SpeechToVisualsVideo: time-unit regression guard (ms, not seconds)', () => {
  // A single 5-second scene. The original bug divided durationMs by 1000,
  // so endMs became startMs + 5 (=5ms) and EVERY frame after ~0ms showed the
  // "Preparing..." fallback. With the fix, endMs = 0 + 5000 = 5000ms and the
  // scene stays visible through frame 149.
  const scene = makeScene(0, 5000, 'Five second payload');
  const total = calculateTotalFrames([scene], DEFAULT_FPS); // 150

  it('5000ms scene renders 150 frames', () => {
    expect(total).toBe(150);
  });

  it.each([
    [0],
    [50], // 1666ms
    [100], // 3333ms — under the old bug this was already past the 5ms end
    [149], // 4966ms — last in-scene frame
  ])('frame %i shows the scene content, not the fallback', (frame) => {
    renderAtFrame(
      SpeechToVisualsVideo as unknown as React.ComponentType<Record<string, unknown>>,
      { scenes: [scene] },
      frame,
      total,
    );
    expect(screen.queryByText('Five second payload')).not.toBeNull();
    expect(screen.queryByText('Preparing...')).toBeNull();
  });
});

describe('DiagramVideo: rendered scene matches frame→duration mapping', () => {
  // DiagramVideo resolves its active scene via findSceneAtTime (durationMs
  // offsets), the same path SpeechToVisualsVideo uses. Because makeScene now
  // emits startTime/endTime in seconds (pipeline units), any reversion to
  // comparing a ms `currentTime` against startTime/endTime would surface here
  // as the "準備中..." fallback instead of the expected scene.
  const scenes = [
    makeScene(0, 3000, 'Gamma scene content'),
    makeScene(3000, 3000, 'Delta scene content'),
  ];
  const total = calculateTotalFrames(scenes, DEFAULT_FPS); // 180

  it.each([
    [0, 'Gamma scene content'],
    [89, 'Gamma scene content'],
    [90, 'Delta scene content'],
    [179, 'Delta scene content'],
  ])('frame %i renders the correct scene', (frame, expectedSummary) => {
    renderAtFrame(
      DiagramVideo as unknown as React.ComponentType<Record<string, unknown>>,
      { scenes },
      frame,
      total,
    );
    expect(screen.queryByText(expectedSummary)).not.toBeNull();
  });

  it('regression guard: 5000ms scene shows content (not 準備中...) at frame 100', () => {
    const scene = makeScene(0, 5000, 'Epsilon five second');
    renderAtFrame(
      DiagramVideo as unknown as React.ComponentType<Record<string, unknown>>,
      { scenes: [scene] },
      100, // 3333ms — would be past a 5ms (buggy) end
      150,
    );
    expect(screen.queryByText('Epsilon five second')).not.toBeNull();
    expect(screen.queryByText('準備中...')).toBeNull();
  });
});

/**
 * Per-scene intro-animation timing must be SCENE-RELATIVE, not derived from the
 * scene's absolute audio startMs.
 *
 * Scenes reach the composition in mixed units: startMs = the ABSOLUTE audio
 * timestamp, durationMs = the (clamped) length. video-generator's
 * convertSceneToRemotionFormat clamps every segment to [3000, 10000] ms, so a
 * 1 s utterance becomes a 3000 ms scene while
 * its startMs keeps the original audio position. Playback concatenates scenes by
 * cumulative durationMs (findSceneAtTime), so a later scene's cumulative
 * playback start diverges from its absolute startMs whenever any earlier scene
 * was clamped.
 *
 * DiagramScene drives its title fade-in (and node/edge entrance) off a
 * scene-local frame. Deriving that offset from scene.startMs (absolute) made
 * every scene after the first begin its intro animations already-completed
 * (title at full opacity 1). Deriving it from the scene-relative timeInScene
 * makes the title fade in from opacity 0 at the scene boundary. Reading the
 * rendered title <h1> container's inline opacity distinguishes the two.
 */
describe('per-scene intro animation is scene-relative (not absolute startMs)', () => {
  // Scene B's absolute startMs (1000) intentionally ≠ its cumulative playback
  // start (3000). This is the exact divergence clamping produces in production.
  const scenes = [
    makeScene(0, 3000, 'Alpha clamped scene'),
    makeScene(1000, 3000, 'Beta clamped scene'),
  ];
  const total = calculateTotalFrames(scenes, DEFAULT_FPS); // 180

  /** Read the DiagramScene title container's opacity for the rendered scene. */
  function titleOpacity(container: HTMLElement): string {
    const h1 = container.querySelector('h1');
    expect(h1).not.toBeNull();
    // The <h1> lives inside DiagramScene's title <div style={{ opacity: titleOpacity }}>.
    return (h1 as HTMLElement).parentElement!.style.opacity;
  }

  it('SpeechToVisualsVideo: scene B title fades in from opacity 0 at its boundary (frame 90)', () => {
    // frame 90 = 3000 ms = scene B's cumulative playback start.
    // timeInScene = 0 → frameInScene = 0 → titleOpacity = 0.
    // Under the startMs bug: frameInScene = 90 - 30 = 60 → titleOpacity = 1.
    const { container } = renderAtFrame(
      SpeechToVisualsVideo as unknown as React.ComponentType<Record<string, unknown>>,
      { scenes },
      90,
      total,
    );
    expect(titleOpacity(container)).toBe('0');
  });

  it('SpeechToVisualsVideo: scene B title is mid-fade shortly after its boundary (frame 95)', () => {
    // frame 95 → 3166 ms → scene B, timeInScene ≈ 166 ms → frameInScene ≈ 5 → opacity ≈ 0.17
    const { container } = renderAtFrame(
      SpeechToVisualsVideo as unknown as React.ComponentType<Record<string, unknown>>,
      { scenes },
      95,
      total,
    );
    const opacity = parseFloat(titleOpacity(container));
    expect(opacity).toBeGreaterThan(0);
    expect(opacity).toBeLessThan(0.5);
  });

  it('DiagramVideo: scene B title fades in from opacity 0 at its boundary (frame 90)', () => {
    const { container } = renderAtFrame(
      DiagramVideo as unknown as React.ComponentType<Record<string, unknown>>,
      { scenes },
      90,
      total,
    );
    expect(titleOpacity(container)).toBe('0');
  });
});
