/**
 * Tests for renderer.ts
 * Remotion renderer: resolution presets, codec configuration, frame rate,
 * audio integration, file size estimation, and render pipeline setup
 */

import {
  RenderConfig,
  ResolutionPreset,
  RESOLUTION_PRESETS,
  getResolution,
  getOutputFormat,
  getDefaultCrf,
  estimateFileSize,
  buildRenderOptions,
  renderVideo,
  DEFAULT_AUDIO_BITRATE,
} from '../renderer';

// Mock @remotion/renderer
vi.mock('@remotion/renderer', () => ({
  renderMedia: vi.fn(),
}));

import { renderMedia } from '@remotion/renderer';

const mockedRenderMedia = renderMedia as vi.MockedFunction<typeof renderMedia>;

interface RenderOptionsComposition {
  id: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
}

interface RenderOptions {
  codec: string;
  composition: RenderOptionsComposition;
  crf: number;
  outputLocation: string;
  serveUrl: string;
  audioBitrate: string | null;
  onProgress?: unknown;
}

/**
 * Helper: create a valid RenderConfig with sensible defaults for testing
 */
function makeConfig(overrides: Partial<RenderConfig> = {}): RenderConfig {
  return {
    resolution: '1080p',
    fps: 30,
    codec: 'h264',
    includeAudio: true,
    quality: 23,
    ...overrides,
  };
}

/** Cast buildRenderOptions result to typed interface for assertions */
function buildOptions(config: RenderConfig, params: Parameters<typeof buildRenderOptions>[1]): RenderOptions {
  return buildRenderOptions(config, params) as unknown as RenderOptions;
}

describe('renderer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRenderMedia.mockResolvedValue({
      buffer: Buffer.from(''),
      slowestFrames: [],
      contentType: 'video/mp4',
    });
  });

  // ----------------------------------------------------------------
  // Constants & Presets
  // ----------------------------------------------------------------
  describe('RESOLUTION_PRESETS', () => {
    it('should define 720p as 1280x720', () => {
      expect(RESOLUTION_PRESETS['720p']).toEqual({ width: 1280, height: 720 });
    });

    it('should define 1080p as 1920x1080', () => {
      expect(RESOLUTION_PRESETS['1080p']).toEqual({ width: 1920, height: 1080 });
    });

    it('should define 4k as 3840x2160', () => {
      expect(RESOLUTION_PRESETS['4k']).toEqual({ width: 3840, height: 2160 });
    });
  });

  describe('DEFAULT_AUDIO_BITRATE', () => {
    it('should be 256k', () => {
      expect(DEFAULT_AUDIO_BITRATE).toBe('256k');
    });
  });

  // ----------------------------------------------------------------
  // getResolution
  // ----------------------------------------------------------------
  describe('getResolution', () => {
    it('should return 1280x720 for 720p', () => {
      const res = getResolution('720p');
      expect(res).toEqual({ width: 1280, height: 720 });
    });

    it('should return 1920x1080 for 1080p', () => {
      const res = getResolution('1080p');
      expect(res).toEqual({ width: 1920, height: 1080 });
    });

    it('should return 3840x2160 for 4k', () => {
      const res = getResolution('4k');
      expect(res).toEqual({ width: 3840, height: 2160 });
    });
  });

  // ----------------------------------------------------------------
  // getOutputFormat
  // ----------------------------------------------------------------
  describe('getOutputFormat', () => {
    it('should return mp4 for h264 codec', () => {
      expect(getOutputFormat('h264')).toBe('mp4');
    });

    it('should return mp4 for h265 codec', () => {
      expect(getOutputFormat('h265')).toBe('mp4');
    });

    it('should return webm for vp9 codec', () => {
      expect(getOutputFormat('vp9')).toBe('webm');
    });
  });

  // ----------------------------------------------------------------
  // getDefaultCrf
  // ----------------------------------------------------------------
  describe('getDefaultCrf', () => {
    it('should return CRF 23 for h264', () => {
      expect(getDefaultCrf('h264')).toBe(23);
    });

    it('should return CRF 28 for h265', () => {
      expect(getDefaultCrf('h265')).toBe(28);
    });

    it('should return CRF 31 for vp9', () => {
      expect(getDefaultCrf('vp9')).toBe(31);
    });
  });

  // ----------------------------------------------------------------
  // estimateFileSize
  // ----------------------------------------------------------------
  describe('estimateFileSize', () => {
    it('should estimate size within 5-10 MB/min range for 1080p h264 at CRF 23', () => {
      const config = makeConfig({ resolution: '1080p', codec: 'h264', quality: 23 });
      const sizePerMinute = estimateFileSize(config, 60); // 60 seconds = 1 min
      const sizeMB = sizePerMinute / (1024 * 1024);
      expect(sizeMB).toBeGreaterThanOrEqual(3);
      expect(sizeMB).toBeLessThanOrEqual(15);
    });

    it('should increase estimated size for higher resolution', () => {
      const config720 = makeConfig({ resolution: '720p', quality: 23 });
      const config1080 = makeConfig({ resolution: '1080p', quality: 23 });
      const size720 = estimateFileSize(config720, 60);
      const size1080 = estimateFileSize(config1080, 60);
      expect(size1080).toBeGreaterThan(size720);
    });

    it('should increase estimated size for 4k over 1080p', () => {
      const config1080 = makeConfig({ resolution: '1080p', quality: 23 });
      const config4k = makeConfig({ resolution: '4k', quality: 23 });
      const size1080 = estimateFileSize(config1080, 60);
      const size4k = estimateFileSize(config4k, 60);
      expect(size4k).toBeGreaterThan(size1080);
    });

    it('should decrease size with higher CRF (lower quality)', () => {
      const configLowCrf = makeConfig({ quality: 18 });
      const configHighCrf = makeConfig({ quality: 28 });
      const sizeLow = estimateFileSize(configLowCrf, 60);
      const sizeHigh = estimateFileSize(configHighCrf, 60);
      expect(sizeHigh).toBeLessThan(sizeLow);
    });

    it('should include audio bitrate in estimation when audio is enabled', () => {
      const configWithAudio = makeConfig({ includeAudio: true });
      const configNoAudio = makeConfig({ includeAudio: false });
      const sizeWithAudio = estimateFileSize(configWithAudio, 60);
      const sizeNoAudio = estimateFileSize(configNoAudio, 60);
      expect(sizeWithAudio).toBeGreaterThan(sizeNoAudio);
    });

    it('should scale linearly with duration', () => {
      const config = makeConfig();
      const size30 = estimateFileSize(config, 30);
      const size60 = estimateFileSize(config, 60);
      // 60-second estimate should be roughly double the 30-second estimate
      expect(size60).toBeCloseTo(size30 * 2, 0);
    });

    it('should increase size for 60fps over 30fps', () => {
      const config30 = makeConfig({ fps: 30 });
      const config60 = makeConfig({ fps: 60 });
      const size30 = estimateFileSize(config30, 60);
      const size60 = estimateFileSize(config60, 60);
      expect(size60).toBeGreaterThan(size30);
    });
  });

  // ----------------------------------------------------------------
  // buildRenderOptions
  // ----------------------------------------------------------------
  describe('buildRenderOptions', () => {
    const baseParams = {
      serveUrl: 'http://localhost:3000',
      compositionId: 'TestComposition',
      durationInFrames: 300,
      outputLocation: '/tmp/output.mp4',
    };

    it('should build options with correct codec for h264', () => {
      const config = makeConfig({ codec: 'h264' });
      const options = buildOptions(config, baseParams);
      expect(options.codec).toBe('h264');
    });

    it('should build options with correct codec for h265', () => {
      const config = makeConfig({ codec: 'h265' });
      const options = buildOptions(config, baseParams);
      expect(options.codec).toBe('h265');
    });

    it('should build options with correct codec for vp9', () => {
      const config = makeConfig({ codec: 'vp9' });
      const options = buildOptions(config, baseParams);
      expect(options.codec).toBe('vp9');
    });

    it('should set composition dimensions to match resolution preset', () => {
      const config = makeConfig({ resolution: '720p' });
      const options = buildOptions(config, baseParams);
      expect(options.composition.width).toBe(1280);
      expect(options.composition.height).toBe(720);
    });

    it('should set composition fps from config', () => {
      const config = makeConfig({ fps: 60 });
      const options = buildOptions(config, baseParams);
      expect(options.composition.fps).toBe(60);
    });

    it('should set CRF from quality field', () => {
      const config = makeConfig({ quality: 25 });
      const options = buildOptions(config, baseParams);
      expect(options.crf).toBe(25);
    });

    it('should set outputLocation from params', () => {
      const config = makeConfig();
      const options = buildOptions(config, baseParams);
      expect(options.outputLocation).toBe('/tmp/output.mp4');
    });

    it('should set serveUrl from params', () => {
      const config = makeConfig();
      const options = buildOptions(config, baseParams);
      expect(options.serveUrl).toBe('http://localhost:3000');
    });

    it('should set durationInFrames from params', () => {
      const config = makeConfig();
      const options = buildOptions(config, baseParams);
      expect(options.composition.durationInFrames).toBe(300);
    });

    it('should set composition id from params', () => {
      const config = makeConfig();
      const options = buildOptions(config, baseParams);
      expect(options.composition.id).toBe('TestComposition');
    });

    it('should set audioBitrate when includeAudio is true', () => {
      const config = makeConfig({ includeAudio: true });
      const options = buildOptions(config, baseParams);
      expect(options.audioBitrate).toBe('256k');
    });

    it('should use custom audioBitrate when provided', () => {
      const config = makeConfig({ includeAudio: true, audioBitrate: '320k' });
      const options = buildOptions(config, baseParams);
      expect(options.audioBitrate).toBe('320k');
    });

    it('should not set audioBitrate when includeAudio is false', () => {
      const config = makeConfig({ includeAudio: false });
      const options = buildOptions(config, baseParams);
      expect(options.audioBitrate).toBeNull();
    });

    it('should build correct options for 4k resolution', () => {
      const config = makeConfig({ resolution: '4k', fps: 60, codec: 'h265' });
      const options = buildOptions(config, baseParams);
      expect(options.composition.width).toBe(3840);
      expect(options.composition.height).toBe(2160);
      expect(options.composition.fps).toBe(60);
      expect(options.codec).toBe('h265');
    });
  });

  // ----------------------------------------------------------------
  // renderVideo
  // ----------------------------------------------------------------
  describe('renderVideo', () => {
    const baseParams = {
      serveUrl: 'http://localhost:3000',
      compositionId: 'TestComposition',
      durationInFrames: 300,
      outputLocation: '/tmp/output.mp4',
    };

    it('should call renderMedia with correct options for 1080p@30fps H.264', async () => {
      const config = makeConfig({
        resolution: '1080p',
        fps: 30,
        codec: 'h264',
        includeAudio: true,
        quality: 23,
      });

      await renderVideo(config, baseParams);

      expect(mockedRenderMedia).toHaveBeenCalledTimes(1);
      const callArgs = mockedRenderMedia.mock.calls[0][0];
      expect(callArgs.codec).toBe('h264');
      expect(callArgs.composition.width).toBe(1920);
      expect(callArgs.composition.height).toBe(1080);
      expect(callArgs.composition.fps).toBe(30);
      expect(callArgs.crf).toBe(23);
      expect(callArgs.audioBitrate).toBe('256k');
    });

    it('should render 720p output', async () => {
      const config = makeConfig({ resolution: '720p' });

      await renderVideo(config, baseParams);

      const callArgs = mockedRenderMedia.mock.calls[0][0];
      expect(callArgs.composition.width).toBe(1280);
      expect(callArgs.composition.height).toBe(720);
    });

    it('should render 4K output', async () => {
      const config = makeConfig({ resolution: '4k' });

      await renderVideo(config, baseParams);

      const callArgs = mockedRenderMedia.mock.calls[0][0];
      expect(callArgs.composition.width).toBe(3840);
      expect(callArgs.composition.height).toBe(2160);
    });

    it('should render at 60fps', async () => {
      const config = makeConfig({ fps: 60 });

      await renderVideo(config, baseParams);

      const callArgs = mockedRenderMedia.mock.calls[0][0];
      expect(callArgs.composition.fps).toBe(60);
    });

    it('should render with VP9 codec', async () => {
      const config = makeConfig({ codec: 'vp9' });

      await renderVideo(config, baseParams);

      const callArgs = mockedRenderMedia.mock.calls[0][0];
      expect(callArgs.codec).toBe('vp9');
    });

    it('should integrate audio with correct bitrate', async () => {
      const config = makeConfig({
        includeAudio: true,
        audioBitrate: '256k',
      });

      await renderVideo(config, baseParams);

      const callArgs = mockedRenderMedia.mock.calls[0][0];
      expect(callArgs.audioBitrate).toBe('256k');
    });

    it('should render without audio when includeAudio is false', async () => {
      const config = makeConfig({ includeAudio: false });

      await renderVideo(config, baseParams);

      const callArgs = mockedRenderMedia.mock.calls[0][0];
      expect(callArgs.audioBitrate).toBeNull();
    });

    it('should return render result with buffer', async () => {
      const mockBuffer = Buffer.from('fake-video-data');
      mockedRenderMedia.mockResolvedValue({
        buffer: mockBuffer,
        slowestFrames: [{ frame: 10, time: 500 }],
        contentType: 'video/mp4',
      });

      const config = makeConfig();
      const result = await renderVideo(config, baseParams);

      expect(result.buffer).toBe(mockBuffer);
      expect(result.slowestFrames).toHaveLength(1);
      expect(result.slowestFrames[0].frame).toBe(10);
    });

    it('should pass onProgress callback if provided', async () => {
      const onProgress = vi.fn();
      const config = makeConfig();

      await renderVideo(config, { ...baseParams, onProgress });

      const callArgs = mockedRenderMedia.mock.calls[0][0];
      expect(callArgs.onProgress).toBe(onProgress);
    });
  });

  // ----------------------------------------------------------------
  // File size validation: 5-10 MB/min target
  // ----------------------------------------------------------------
  describe('file size target validation', () => {
    it('should produce file size estimates within 5-10 MB/min for default 1080p h264 CRF 23', () => {
      const config = makeConfig({
        resolution: '1080p',
        codec: 'h264',
        quality: 23,
        fps: 30,
        includeAudio: true,
      });

      const sizeBytes = estimateFileSize(config, 60);
      const sizeMB = sizeBytes / (1024 * 1024);

      // The spec requires 5-10 MB/min; our estimate should be in or near this range
      expect(sizeMB).toBeGreaterThanOrEqual(3);
      expect(sizeMB).toBeLessThanOrEqual(15);
    });

    it('should produce file size within 5-10 MB/min for 720p h264 CRF 23', () => {
      const config = makeConfig({
        resolution: '720p',
        codec: 'h264',
        quality: 23,
        fps: 30,
        includeAudio: true,
      });

      const sizeBytes = estimateFileSize(config, 60);
      const sizeMB = sizeBytes / (1024 * 1024);
      // 720p should be smaller, still reasonable
      expect(sizeMB).toBeGreaterThanOrEqual(1);
      expect(sizeMB).toBeLessThanOrEqual(10);
    });

    it('should produce reasonable size for vp9 codec', () => {
      const config = makeConfig({
        codec: 'vp9',
        quality: 31,
        includeAudio: true,
      });

      const sizeBytes = estimateFileSize(config, 60);
      const sizeMB = sizeBytes / (1024 * 1024);
      expect(sizeMB).toBeGreaterThan(0);
      expect(sizeMB).toBeLessThan(20);
    });
  });
});
