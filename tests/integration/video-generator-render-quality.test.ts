/**
 * Integration test: VideoGenerator propagates the configured quality to the
 * real renderer instead of hardcoding it.
 *
 * Bug: executeRemotionRender always called actualVideoRenderer.renderVideo with
 * `quality: 'medium'`, ignoring this.options.quality (default 'high'). So every
 * production render encoded at CRF 18 (medium) instead of the configured/default
 * CRF 15 (high). this.options.quality was consulted only for JPEG quality and the
 * file-size estimate — never for the actual encode CRF.
 *
 * ActualVideoRenderOptions.quality is typed 'low' | 'medium' | 'high' (no 'ultra'),
 * while VideoGenerationOptions.quality adds an 'ultra' tier, so 'ultra' must map
 * down to the renderer's highest real tier ('high').
 *
 * This test mocks @/lib/actualVideoRenderer and drives the REAL executeRemotionRender
 * (node env → non-browser branch → the dynamic import('@/lib/actualVideoRenderer')
 * is intercepted by unstable_mockModule), asserting the quality handed to renderVideo
 * reflects VideoGenerator's options.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { jest } from '@jest/globals';

const renderVideoMock = jest.fn();

jest.unstable_mockModule('@/lib/actualVideoRenderer', () => ({
  actualVideoRenderer: { renderVideo: renderVideoMock },
}));

const { VideoGenerator } = await import('@/pipeline/video-generator');
type VideoGeneratorInstance = InstanceType<typeof VideoGenerator>;

interface Internals {
  executeRemotionRender(
    config: unknown,
    onProgress?: (stage: string, progress: number) => void
  ): Promise<unknown>;
}

function internals(gen: VideoGeneratorInstance): Internals {
  return gen as unknown as Internals;
}

function renderConfig(): unknown {
  return {
    inputProps: { scenes: [], audioUrl: 'audio.mp3', totalDuration: 1000 },
    outputLocation: '/tmp/out.mp4',
    config: { width: 1920, height: 1080, fps: 30 },
  };
}

describe('VideoGenerator render quality propagation', () => {
  beforeEach(() => {
    renderVideoMock.mockReset();
    renderVideoMock.mockResolvedValue(undefined);
  });

  it('passes the configured quality to the renderer (default high, not hardcoded medium)', async () => {
    const gen = new VideoGenerator({ quality: 'high' });

    await internals(gen).executeRemotionRender(renderConfig());

    expect(renderVideoMock).toHaveBeenCalledTimes(1);
    const passedOptions = renderVideoMock.mock.calls[0][0] as { quality?: string };
    expect(passedOptions.quality).toBe('high');
  });

  it('passes explicit medium through', async () => {
    const gen = new VideoGenerator({ quality: 'medium' });

    await internals(gen).executeRemotionRender(renderConfig());

    const passedOptions = renderVideoMock.mock.calls[0][0] as { quality?: string };
    expect(passedOptions.quality).toBe('medium');
  });

  it('maps ultra down to the renderer high tier (renderer has no ultra)', async () => {
    const gen = new VideoGenerator({ quality: 'ultra' });

    await internals(gen).executeRemotionRender(renderConfig());

    const passedOptions = renderVideoMock.mock.calls[0][0] as { quality?: string };
    expect(passedOptions.quality).toBe('high');
  });
});

/**
 * fps propagation: executeRemotionRender must hand the configured fps to the
 * renderer instead of letting actualVideoRenderer hardcode 30.
 *
 * Bug: executeRemotionRender called renderVideo without an `fps` field, and
 * ActualVideoRenderer.getComposition used a hardcoded `const fps = 30`. So a
 * 60 fps (high-quality preset) or 24 fps (fast preset) request silently rendered
 * at 30 fps, and durationInFrames was computed at 30 fps (frame↔duration drift).
 */
describe('VideoGenerator render fps propagation', () => {
  beforeEach(() => {
    renderVideoMock.mockReset();
    renderVideoMock.mockResolvedValue(undefined);
  });

  it('passes the configured 60 fps to the renderer (not hardcoded 30)', async () => {
    const gen = new VideoGenerator({ fps: 60 });

    await internals(gen).executeRemotionRender(renderConfig());

    expect(renderVideoMock).toHaveBeenCalledTimes(1);
    const passedOptions = renderVideoMock.mock.calls[0][0] as { fps?: number };
    expect(passedOptions.fps).toBe(60);
  });

  it('passes 24 fps through', async () => {
    const gen = new VideoGenerator({ fps: 24 });

    await internals(gen).executeRemotionRender(renderConfig());

    const passedOptions = renderVideoMock.mock.calls[0][0] as { fps?: number };
    expect(passedOptions.fps).toBe(24);
  });

  it('defaults to 30 fps when fps is not configured', async () => {
    const gen = new VideoGenerator({ quality: 'high' }); // no fps

    await internals(gen).executeRemotionRender(renderConfig());

    const passedOptions = renderVideoMock.mock.calls[0][0] as { fps?: number };
    expect(passedOptions.fps).toBe(30);
  });
});
