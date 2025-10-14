/**
 * Enhanced Video Preview Component with Timeline Scrubbing
 * Phase 15: UI/UX Improvements
 *
 * Features:
 * - Real-time video preview with playback controls
 * - Timeline scrubbing with scene markers
 * - Side-by-side diagram and video view
 * - Frame-accurate seeking
 * - Keyboard shortcuts for playback control
 * - Accessibility support
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Download,
  Eye,
  Layers
} from 'lucide-react';
import { SceneGraph } from '@/types/diagram';
import { toast } from 'sonner';

interface EnhancedVideoPreviewProps {
  videoUrl?: string;
  scenes?: SceneGraph[];
  audioUrl?: string;
  showDiagramPreview?: boolean;
  autoPlay?: boolean;
}

export const EnhancedVideoPreview: React.FC<EnhancedVideoPreviewProps> = ({
  videoUrl,
  scenes = [],
  audioUrl,
  showDiagramPreview = true,
  autoPlay = false
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (!isSeeking) {
        setCurrentTime(video.currentTime);
        updateCurrentScene(video.currentTime);
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('ended', handleEnded);

    if (autoPlay) {
      video.play().catch(console.error);
      setIsPlaying(true);
    }

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('ended', handleEnded);
    };
  }, [autoPlay, isSeeking]);

  // Update current scene based on playback time
  const updateCurrentScene = useCallback((time: number) => {
    if (scenes.length === 0) return;

    const sceneIndex = scenes.findIndex(
      (scene) => time >= scene.startTime && time <= scene.endTime
    );

    if (sceneIndex !== -1 && sceneIndex !== currentSceneIndex) {
      setCurrentSceneIndex(sceneIndex);
    }
  }, [scenes, currentSceneIndex]);

  // Playback controls
  const togglePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play().catch(console.error);
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const seekTo = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = time;
    setCurrentTime(time);
    updateCurrentScene(time);
  }, [updateCurrentScene]);

  const skipBackward = useCallback(() => {
    seekTo(Math.max(0, currentTime - 5));
  }, [currentTime, seekTo]);

  const skipForward = useCallback(() => {
    seekTo(Math.min(duration, currentTime + 5));
  }, [currentTime, duration, seekTo]);

  const handleVolumeChange = useCallback((value: number[]) => {
    const video = videoRef.current;
    if (!video) return;

    const newVolume = value[0];
    video.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isMuted) {
      video.volume = volume || 0.5;
      setIsMuted(false);
    } else {
      video.volume = 0;
      setIsMuted(true);
    }
  }, [isMuted, volume]);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!isFullscreen) {
      container.requestFullscreen?.().catch(console.error);
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(console.error);
      setIsFullscreen(false);
    }
  }, [isFullscreen]);

  const jumpToScene = useCallback((sceneIndex: number) => {
    if (sceneIndex < 0 || sceneIndex >= scenes.length) return;

    const scene = scenes[sceneIndex];
    seekTo(scene.startTime);
    setCurrentSceneIndex(sceneIndex);
  }, [scenes, seekTo]);

  const downloadVideo = useCallback(() => {
    if (!videoUrl) return;

    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = `diagram-video-${Date.now()}.mp4`;
    a.click();
    toast.success('動画のダウンロードを開始しました');
  }, [videoUrl]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skipBackward();
          break;
        case 'ArrowRight':
          e.preventDefault();
          skipForward();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlayPause, skipBackward, skipForward, toggleMute, toggleFullscreen]);

  // Format time display
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Calculate timeline position for scene markers
  const getSceneMarkerPosition = (sceneStartTime: number) => {
    if (duration === 0) return 0;
    return (sceneStartTime / duration) * 100;
  };

  if (!videoUrl) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Eye className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">動画を生成すると、ここでプレビューできます</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div ref={containerRef} className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Play className="w-5 h-5" />
                動画プレビュー
              </CardTitle>
              <CardDescription>
                {scenes.length > 0 && `${scenes.length}シーン • `}
                {formatTime(duration)}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={downloadVideo}>
              <Download className="w-4 h-4 mr-2" />
              ダウンロード
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Video and Diagram Side-by-Side */}
          <div className={`grid ${showDiagramPreview && scenes.length > 0 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'} gap-4`}>
            {/* Video Player */}
            <div className="space-y-3">
              <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="w-full h-full"
                  onClick={togglePlayPause}
                  aria-label="動画プレビュー"
                />

                {/* Play/Pause Overlay */}
                {!isPlaying && (
                  <button
                    onClick={togglePlayPause}
                    className="absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity hover:bg-black/40"
                    aria-label="再生"
                  >
                    <Play className="w-16 h-16 text-white" />
                  </button>
                )}
              </div>

              {/* Playback Controls */}
              <div className="space-y-3 bg-muted/30 p-4 rounded-lg">
                {/* Timeline with Scene Markers */}
                <div className="relative">
                  <Slider
                    value={[currentTime]}
                    max={duration || 100}
                    step={0.1}
                    onValueChange={(value) => {
                      setIsSeeking(true);
                      seekTo(value[0]);
                    }}
                    onValueCommit={() => setIsSeeking(false)}
                    className="cursor-pointer"
                    aria-label="動画タイムライン"
                  />

                  {/* Scene Markers */}
                  <div className="absolute top-0 left-0 right-0 h-full pointer-events-none">
                    {scenes.map((scene, index) => (
                      <div
                        key={scene.id}
                        className="absolute h-full w-0.5 bg-blue-500"
                        style={{ left: `${getSceneMarkerPosition(scene.startTime)}%` }}
                        title={`シーン ${index + 1}: ${scene.type}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Time Display */}
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>

                {/* Control Buttons */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={skipBackward}
                      aria-label="5秒戻る"
                    >
                      <SkipBack className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="default"
                      size="icon"
                      onClick={togglePlayPause}
                      aria-label={isPlaying ? '一時停止' : '再生'}
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={skipForward}
                      aria-label="5秒進む"
                    >
                      <SkipForward className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Volume Control */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleMute}
                        aria-label={isMuted ? 'ミュート解除' : 'ミュート'}
                      >
                        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      </Button>
                      <Slider
                        value={[isMuted ? 0 : volume]}
                        max={1}
                        step={0.01}
                        onValueChange={handleVolumeChange}
                        className="w-24"
                        aria-label="音量調整"
                      />
                    </div>

                    {/* Fullscreen */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={toggleFullscreen}
                      aria-label={isFullscreen ? 'フルスクリーン解除' : 'フルスクリーン'}
                    >
                      {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {/* Keyboard Shortcuts Hint */}
                <div className="text-xs text-muted-foreground text-center pt-2 border-t">
                  <kbd className="px-1.5 py-0.5 bg-muted rounded">Space</kbd> 再生/停止 •{' '}
                  <kbd className="px-1.5 py-0.5 bg-muted rounded">←</kbd> /{' '}
                  <kbd className="px-1.5 py-0.5 bg-muted rounded">→</kbd> スキップ •{' '}
                  <kbd className="px-1.5 py-0.5 bg-muted rounded">M</kbd> ミュート •{' '}
                  <kbd className="px-1.5 py-0.5 bg-muted rounded">F</kbd> フルスクリーン
                </div>
              </div>
            </div>

            {/* Current Scene Diagram Preview */}
            {showDiagramPreview && scenes.length > 0 && (
              <div className="space-y-3">
                <Card className="bg-muted/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Layers className="w-4 h-4" />
                      現在のシーン
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Current Scene Info */}
                    <div className="p-3 bg-background rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="default">
                          シーン {currentSceneIndex + 1} / {scenes.length}
                        </Badge>
                        <Badge variant="outline">{scenes[currentSceneIndex]?.type}</Badge>
                      </div>
                      <div className="text-sm">
                        {scenes[currentSceneIndex]?.content.substring(0, 150)}
                        {(scenes[currentSceneIndex]?.content.length || 0) > 150 && '...'}
                      </div>
                      <div className="text-xs text-muted-foreground mt-2">
                        信頼度: {((scenes[currentSceneIndex]?.confidence || 0) * 100).toFixed(0)}%
                      </div>
                    </div>

                    {/* Scene Timeline */}
                    <div className="space-y-2">
                      <div className="text-xs font-medium">シーンタイムライン</div>
                      <div className="space-y-1 max-h-64 overflow-y-auto">
                        {scenes.map((scene, index) => (
                          <button
                            key={scene.id}
                            onClick={() => jumpToScene(index)}
                            className={`w-full text-left p-2 rounded transition-all ${
                              index === currentSceneIndex
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'bg-background hover:bg-muted'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium">
                                シーン {index + 1}: {scene.type}
                              </span>
                              <span className="text-xs opacity-75">
                                {formatTime(scene.startTime)} - {formatTime(scene.endTime)}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EnhancedVideoPreview;
