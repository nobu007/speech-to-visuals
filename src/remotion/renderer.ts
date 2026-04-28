/**
 * Remotion Video Renderer
 * Handles MP4/WebM video output with configurable resolution, frame rate, codec,
 * and optional audio track integration.
 *
 * Supports: 720p / 1080p / 4K, 30/60 fps, H.264/H.265/VP9 codecs.
 * Uses Remotion 4.0 renderMedia() API.
 */

import { renderMedia, type RenderMediaOnProgress } from '@remotion/renderer';

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

/** Render configuration passed by the caller */
export interface RenderConfig {
  /** Target resolution preset */
  resolution: '720p' | '1080p' | '4k';
  /** Frames per second */
  fps: 30 | 60;
  /** Video codec */
  codec: 'h264' | 'h265' | 'vp9';
  /** Whether to include an audio track */
  includeAudio: boolean;
  /** Audio bitrate string (e.g. '256k'). Default: '256k' */
  audioBitrate?: string;
  /** CRF quality value (1-100; lower = better quality). Typical: 18-28 */
  quality: number;
}

/** A single resolution preset */
export interface ResolutionPreset {
  width: number;
  height: number;
}

/** Parameters required to execute a render */
export interface RenderParams {
  /** URL where the Remotion bundle is served */
  serveUrl: string;
  /** Remotion composition ID */
  compositionId: string;
  /** Total duration in frames */
  durationInFrames: number;
  /** Output file path */
  outputLocation: string;
  /** Optional progress callback */
  onProgress?: RenderMediaOnProgress;
}

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------

/** Default audio bitrate (AAC) */
export const DEFAULT_AUDIO_BITRATE = '256k';

/** Resolution presets mapping */
export const RESOLUTION_PRESETS: Record<RenderConfig['resolution'], ResolutionPreset> = {
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
  '4k': { width: 3840, height: 2160 },
};

/**
 * Default CRF values per codec, chosen to target approximately 5-10 MB/min
 * at 1080p 30fps.
 */
const DEFAULT_CRF: Record<RenderConfig['codec'], number> = {
  h264: 23,
  h265: 28,
  vp9: 31,
};

/** Output container format per codec */
const CODEC_FORMAT: Record<RenderConfig['codec'], string> = {
  h264: 'mp4',
  h265: 'mp4',
  vp9: 'webm',
};

/**
 * Base bitrate (bits per second) estimates for each resolution at CRF 23 / 30fps.
 * These are used by estimateFileSize() to produce a rough size prediction.
 * Values are derived from empirical H.264 encoding data.
 */
const BASE_BITRATE_BPS: Record<RenderConfig['resolution'], number> = {
  '720p': 700_000,    // ~0.7 Mbps -> ~5 MB/min with audio
  '1080p': 1_100_000, // ~1.1 Mbps -> ~8 MB/min with audio
  '4k': 4_400_000,    // ~4.4 Mbps -> ~33 MB/min with audio
};

/** Default audio bitrate in bits per second (256 kbps) */
const AUDIO_BPS = 256_000;

/** CRF reference point for bitrate scaling */
const CRF_REFERENCE = 23;

// ----------------------------------------------------------------
// Helper functions
// ----------------------------------------------------------------

/**
 * Get the resolution preset for a given resolution name.
 */
export function getResolution(resolution: RenderConfig['resolution']): ResolutionPreset {
  return RESOLUTION_PRESETS[resolution];
}

/**
 * Get the output file format (container) for a given codec.
 */
export function getOutputFormat(codec: RenderConfig['codec']): string {
  return CODEC_FORMAT[codec];
}

/**
 * Get the default CRF value for a given codec.
 */
export function getDefaultCrf(codec: RenderConfig['codec']): number {
  return DEFAULT_CRF[codec];
}

/**
 * Estimate the output file size in bytes for a given configuration and duration.
 *
 * Uses a simple exponential model: as CRF increases, bitrate decreases
 * roughly by a factor of ~1.4x per 6 CRF units (based on x264 empirical data).
 *
 * @param config - Render configuration
 * @param durationSeconds - Video duration in seconds
 * @returns Estimated file size in bytes
 */
export function estimateFileSize(config: RenderConfig, durationSeconds: number): number {
  // Base video bitrate for resolution at CRF 23 / 30fps
  let videoBitrate = BASE_BITRATE_BPS[config.resolution];

  // Scale bitrate with CRF: every +6 CRF roughly halves bitrate
  // Using exponential factor: 2^((crf - 23) / 6)
  const crfFactor = Math.pow(2, (config.quality - CRF_REFERENCE) / 6);
  videoBitrate = videoBitrate / crfFactor;

  // Scale with fps (higher fps = proportionally more data)
  const fpsFactor = config.fps / 30;
  videoBitrate = videoBitrate * fpsFactor;

  // Codec efficiency adjustments
  // H.265 is ~40% more efficient than H.264 at same quality
  // VP9 is ~30% more efficient than H.264
  if (config.codec === 'h265') {
    videoBitrate = videoBitrate * 0.6;
  } else if (config.codec === 'vp9') {
    videoBitrate = videoBitrate * 0.7;
  }

  // Total bitrate including optional audio
  let totalBitrate = videoBitrate;
  if (config.includeAudio) {
    totalBitrate += AUDIO_BPS;
  }

  // Size in bytes = bitrate * duration / 8
  return Math.round((totalBitrate * durationSeconds) / 8);
}

/**
 * Build the options object expected by Remotion's renderMedia().
 *
 * @param config - Render configuration
 * @param params - Render parameters
 * @returns Options for renderMedia()
 */
export function buildRenderOptions(
  config: RenderConfig,
  params: RenderParams,
): Record<string, unknown> {
  const resolution = getResolution(config.resolution);

  return {
    codec: config.codec,
    composition: {
      id: params.compositionId,
      width: resolution.width,
      height: resolution.height,
      fps: config.fps,
      durationInFrames: params.durationInFrames,
    },
    crf: config.quality,
    outputLocation: params.outputLocation,
    serveUrl: params.serveUrl,
    audioBitrate: config.includeAudio
      ? (config.audioBitrate ?? DEFAULT_AUDIO_BITRATE)
      : null,
    onProgress: params.onProgress,
  };
}

/**
 * Execute the video render using Remotion's renderMedia().
 *
 * @param config - Render configuration
 * @param params - Render parameters
 * @returns Render result with buffer and slowest frame info
 */
export async function renderVideo(
  config: RenderConfig,
  params: RenderParams,
): Promise<{ buffer: Buffer | null; slowestFrames: Array<{ frame: number; time: number }> }> {
  const options = buildRenderOptions(config, params);
  const result = await renderMedia(options as Parameters<typeof renderMedia>[0]);
  return {
    buffer: result.buffer,
    slowestFrames: result.slowestFrames,
  };
}
