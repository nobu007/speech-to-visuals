/**
 * VideoPreview Component
 * Remotion Player wrapper with playback controls, seekbar, resolution switching
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import { SpeechToVisualsVideo, calculateTotalFrames, DEFAULT_FPS } from '@/remotion/Video';
import type { SceneGraph } from '@/types/diagram';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ========================================
// Types
// ========================================

/** Preview resolution preset */
export type PreviewResolution = '360p' | '540p' | '720p' | '1080p';

/** Playback speed option */
export type PlaybackSpeed = 0.5 | 1 | 1.5 | 2;

/** Resolution presets mapping to pixel dimensions */
export const RESOLUTION_PRESETS: Record<PreviewResolution, { width: number; height: number }> = {
  '360p': { width: 640, height: 360 },
  '540p': { width: 960, height: 540 },
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
};

/** Available playback speed options */
export const PLAYBACK_SPEEDS: PlaybackSpeed[] = [0.5, 1, 1.5, 2];

/** Default preview resolution */
export const DEFAULT_RESOLUTION: PreviewResolution = '720p';

// ========================================
// Helpers
// ========================================

/**
 * Format frame number to MM:SS time string
 * @param frame - Current frame number
 * @param fps - Frames per second
 * @returns Formatted time string in MM:SS format
 */
export function formatTime(frame: number, fps: number): string {
  const totalSeconds = Math.floor(frame / fps);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// ========================================
// Component Props
// ========================================

export interface VideoPreviewProps {
  /** Array of scene data to render */
  scenes: SceneGraph[];
  /** Optional audio URL */
  audioUrl?: string;
  /** Background color for the video */
  backgroundColor?: string;
  /** Initial preview resolution (default: 720p) */
  initialResolution?: PreviewResolution;
  /** CSS class name for the outer container */
  className?: string;
}

// ========================================
// Component
// ========================================

export const VideoPreview: React.FC<VideoPreviewProps> = ({
  scenes,
  audioUrl,
  backgroundColor = '#0f0f23',
  initialResolution = DEFAULT_RESOLUTION,
  className,
}) => {
  const playerRef = useRef<PlayerRef>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [resolution, setResolution] = useState<PreviewResolution>(initialResolution);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);
  const [loop, setLoop] = useState(true);

  // Computed values
  const totalFrames = useMemo(() => calculateTotalFrames(scenes, DEFAULT_FPS), [scenes]);
  const resolutionSize = RESOLUTION_PRESETS[resolution];

  // Derived aspect ratio for responsive sizing
  const aspectRatio = resolutionSize.width / resolutionSize.height;

  // Subscribe to player events
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onFrameUpdate = (e: { detail: { frame: number } }) => {
      setCurrentFrame(e.detail.frame);
    };
    const onSeeked = (e: { detail: { frame: number } }) => {
      setCurrentFrame(e.detail.frame);
    };
    const onEnded = () => {
      setIsPlaying(false);
    };

    player.addEventListener('play', onPlay);
    player.addEventListener('pause', onPause);
    player.addEventListener('frameupdate', onFrameUpdate);
    player.addEventListener('seeked', onSeeked);
    player.addEventListener('ended', onEnded);

    return () => {
      player.removeEventListener('play', onPlay);
      player.removeEventListener('pause', onPause);
      player.removeEventListener('frameupdate', onFrameUpdate);
      player.removeEventListener('seeked', onSeeked);
      player.removeEventListener('ended', onEnded);
    };
  }, []);

  // Handlers
  const handlePlayPause = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
  }, [isPlaying]);

  const handleSeek = useCallback(
    (value: number[]) => {
      const player = playerRef.current;
      if (!player) return;
      const targetFrame = value[0];
      player.seekTo(targetFrame);
      setCurrentFrame(targetFrame);
    },
    []
  );

  const handleFrameForward = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    const nextFrame = Math.min(currentFrame + 1, totalFrames - 1);
    player.seekTo(nextFrame);
    setCurrentFrame(nextFrame);
  }, [currentFrame, totalFrames]);

  const handleFrameBackward = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    const prevFrame = Math.max(currentFrame - 1, 0);
    player.seekTo(prevFrame);
    setCurrentFrame(prevFrame);
  }, [currentFrame]);

  const handleResolutionChange = useCallback((value: string) => {
    setResolution(value as PreviewResolution);
  }, []);

  const handleSpeedChange = useCallback((value: string) => {
    setPlaybackSpeed(Number(value) as PlaybackSpeed);
  }, []);

  const handleLoopToggle = useCallback(() => {
    setLoop((prev) => !prev);
  }, []);

  // Empty scenes fallback
  if (!scenes || scenes.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-muted rounded-lg ${className ?? ''}`}
        style={{ aspectRatio }}
        data-testid="video-preview-empty"
      >
        <p className="text-muted-foreground text-sm">No scene data available for preview</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-3 ${className ?? ''}`} data-testid="video-preview">
      {/* Player Container */}
      <div className="relative w-full overflow-hidden rounded-lg bg-black">
        <Player
          ref={playerRef}
          component={SpeechToVisualsVideo as unknown as React.ComponentType<Record<string, unknown>>}
          durationInFrames={totalFrames}
          compositionWidth={resolutionSize.width}
          compositionHeight={resolutionSize.height}
          fps={DEFAULT_FPS}
          loop={loop}
          playbackRate={playbackSpeed}
          style={{ width: '100%' }}
          inputProps={{
            scenes,
            audioUrl,
            backgroundColor,
          }}
        />
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-2" data-testid="video-preview-controls">
        {/* Seekbar */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono w-12 text-right" data-testid="time-current">
            {formatTime(currentFrame, DEFAULT_FPS)}
          </span>
          <Slider
            value={[currentFrame]}
            min={0}
            max={Math.max(totalFrames - 1, 1)}
            step={1}
            onValueChange={handleSeek}
            className="flex-1"
            data-testid="seekbar"
          />
          <span className="text-xs font-mono w-12" data-testid="time-total">
            {formatTime(totalFrames, DEFAULT_FPS)}
          </span>
        </div>

        {/* Control buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {/* Frame backward */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleFrameBackward}
              disabled={currentFrame <= 0}
              data-testid="btn-frame-backward"
              aria-label="Previous frame"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="19 20 9 12 19 4 19 20" />
                <line x1="5" y1="19" x2="5" y2="5" />
              </svg>
            </Button>

            {/* Play/Pause */}
            <Button
              variant="default"
              size="icon"
              onClick={handlePlayPause}
              data-testid="btn-play-pause"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  stroke="none"
                >
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  stroke="none"
                >
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              )}
            </Button>

            {/* Frame forward */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleFrameForward}
              disabled={currentFrame >= totalFrames - 1}
              data-testid="btn-frame-forward"
              aria-label="Next frame"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="5 4 15 12 5 20 5 4" />
                <line x1="19" y1="5" x2="19" y2="19" />
              </svg>
            </Button>

            {/* Loop toggle */}
            <Button
              variant={loop ? 'default' : 'ghost'}
              size="sm"
              onClick={handleLoopToggle}
              data-testid="btn-loop"
              aria-label={loop ? 'Disable loop' : 'Enable loop'}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="17 1 21 5 17 9" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <polyline points="7 23 3 19 7 15" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {/* Playback speed */}
            <Select value={String(playbackSpeed)} onValueChange={handleSpeedChange}>
              <SelectTrigger className="w-20 h-8 text-xs" data-testid="select-speed">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLAYBACK_SPEEDS.map((speed) => (
                  <SelectItem key={speed} value={String(speed)}>
                    {speed}x
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Resolution */}
            <Select value={resolution} onValueChange={handleResolutionChange}>
              <SelectTrigger className="w-24 h-8 text-xs" data-testid="select-resolution">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(RESOLUTION_PRESETS) as PreviewResolution[]).map((res) => (
                  <SelectItem key={res} value={res}>
                    {res}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPreview;
