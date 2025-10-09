/**
 * Interactive Result Viewer Component - Iteration 66 Phase B
 * インタラクティブ結果表示システム (シーンプレビュー・図解操作・エクスポート設定)
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  ZoomIn, ZoomOut, Download, Play, Pause, SkipBack, SkipForward,
  Maximize, Eye, Edit3, Share2, Settings, Grid, List, Image as ImageIcon,
  FileVideo, Loader2, CheckCircle, ChevronLeft, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import type { ProcessingResult } from '@/pipeline/simple-pipeline';
import type { ExportConfiguration, ExportFormat, VideoQuality } from '@/export/enhanced-export-engine';
import { EnhancedExportEngine } from '@/export/enhanced-export-engine';

export interface InteractiveResultViewerProps {
  result: ProcessingResult;
  onExport?: (config: ExportConfiguration) => void;
  onEdit?: (sceneIndex: number) => void;
  onShare?: () => void;
}

interface SceneThumbnail {
  sceneIndex: number;
  title: string;
  diagramType: string;
  timestamp: number;
  duration: number;
  thumbnail?: string; // Base64 encoded thumbnail
}

interface ViewState {
  zoom: number;
  pan: { x: number; y: number };
  selectedScene: number;
  viewMode: 'grid' | 'list' | 'detail';
  isPlaying: boolean;
  playbackTime: number;
}

interface ExportState {
  format: ExportFormat;
  quality: VideoQuality;
  isExporting: boolean;
  progress: number;
}

export const InteractiveResultViewer: React.FC<InteractiveResultViewerProps> = ({
  result,
  onExport,
  onEdit,
  onShare
}) => {
  // View state
  const [viewState, setViewState] = useState<ViewState>({
    zoom: 100,
    pan: { x: 0, y: 0 },
    selectedScene: 0,
    viewMode: 'detail',
    isPlaying: false,
    playbackTime: 0
  });

  // Export state
  const [exportState, setExportState] = useState<ExportState>({
    format: 'mp4',
    quality: {
      resolution: '1080p',
      fps: 30,
      bitrate: 'high',
      hdr: false
    },
    isExporting: false,
    progress: 0
  });

  // Scene thumbnails
  const [thumbnails, setThumbnails] = useState<SceneThumbnail[]>([]);
  const [isGeneratingThumbnails, setIsGeneratingThumbnails] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const exportEngineRef = useRef<EnhancedExportEngine>(new EnhancedExportEngine());

  /**
   * Generate scene thumbnails on mount
   */
  useEffect(() => {
    generateThumbnails();
  }, [result]);

  /**
   * Generate thumbnails for all scenes
   */
  const generateThumbnails = useCallback(async () => {
    if (!result.scenes || result.scenes.length === 0) return;

    console.log('🖼️ Generating scene thumbnails...');
    setIsGeneratingThumbnails(true);

    try {
      const generatedThumbnails: SceneThumbnail[] = [];
      let cumulativeTime = 0;

      for (let i = 0; i < result.scenes.length; i++) {
        const scene = result.scenes[i];
        const duration = 3; // Default 3 seconds per scene

        // Generate thumbnail (simplified - would use actual rendering in production)
        const thumbnail = await generateSceneThumbnail(scene, i);

        generatedThumbnails.push({
          sceneIndex: i,
          title: scene.title || `Scene ${i + 1}`,
          diagramType: scene.diagramType || 'unknown',
          timestamp: cumulativeTime,
          duration,
          thumbnail
        });

        cumulativeTime += duration;
      }

      setThumbnails(generatedThumbnails);
      console.log(`✅ Generated ${generatedThumbnails.length} thumbnails`);
      toast.success(`${generatedThumbnails.length} scene previews generated`);

    } catch (error) {
      console.error('❌ Thumbnail generation failed:', error);
      toast.error('Failed to generate scene previews');
    } finally {
      setIsGeneratingThumbnails(false);
    }
  }, [result]);

  /**
   * Generate thumbnail for a single scene
   */
  const generateSceneThumbnail = async (scene: any, index: number): Promise<string> => {
    // Simplified thumbnail generation
    // In production, this would render the actual scene to a canvas
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 180;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // Background
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Diagram type indicator
      ctx.fillStyle = '#3b82f6';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(scene.diagramType || 'Diagram', canvas.width / 2, canvas.height / 2);

      // Scene number
      ctx.fillStyle = '#666';
      ctx.font = '12px sans-serif';
      ctx.fillText(`Scene ${index + 1}`, canvas.width / 2, canvas.height / 2 + 30);
    }

    return canvas.toDataURL('image/png');
  };

  /**
   * Zoom controls
   */
  const handleZoomIn = useCallback(() => {
    setViewState(prev => ({
      ...prev,
      zoom: Math.min(prev.zoom + 25, 200)
    }));
  }, []);

  const handleZoomOut = useCallback(() => {
    setViewState(prev => ({
      ...prev,
      zoom: Math.max(prev.zoom - 25, 50)
    }));
  }, []);

  const handleResetZoom = useCallback(() => {
    setViewState(prev => ({
      ...prev,
      zoom: 100,
      pan: { x: 0, y: 0 }
    }));
  }, []);

  /**
   * Scene navigation
   */
  const handleSceneSelect = useCallback((sceneIndex: number) => {
    setViewState(prev => ({
      ...prev,
      selectedScene: sceneIndex,
      playbackTime: thumbnails[sceneIndex]?.timestamp || 0
    }));
  }, [thumbnails]);

  const handlePreviousScene = useCallback(() => {
    setViewState(prev => ({
      ...prev,
      selectedScene: Math.max(0, prev.selectedScene - 1)
    }));
  }, []);

  const handleNextScene = useCallback(() => {
    setViewState(prev => ({
      ...prev,
      selectedScene: Math.min(thumbnails.length - 1, prev.selectedScene + 1)
    }));
  }, [thumbnails]);

  /**
   * Playback controls
   */
  const handlePlayPause = useCallback(() => {
    setViewState(prev => ({
      ...prev,
      isPlaying: !prev.isPlaying
    }));

    if (!viewState.isPlaying) {
      toast.info('Preview playback started');
    }
  }, [viewState.isPlaying]);

  /**
   * Export handling
   */
  const handleExport = useCallback(async () => {
    if (!onExport) {
      toast.error('Export handler not configured');
      return;
    }

    setExportState(prev => ({ ...prev, isExporting: true, progress: 0 }));
    toast.info(`Exporting as ${exportState.format.toUpperCase()}...`);

    try {
      const config: ExportConfiguration = {
        format: exportState.format,
        quality: exportState.quality,
        settings: {
          loop: false,
          includeAudio: true,
          watermark: false,
          compression: 'medium',
          optimization: 'balanced'
        }
      };

      // Call export handler with progress tracking
      const exportResult = await exportEngineRef.current.exportVideo(
        result,
        config,
        (progress) => {
          setExportState(prev => ({
            ...prev,
            progress: progress.progress
          }));
        }
      );

      if (exportResult.success) {
        toast.success(`Export completed: ${exportResult.outputPath}`);
        onExport(config);
      } else {
        toast.error(`Export failed: ${exportResult.error}`);
      }

    } catch (error) {
      console.error('❌ Export failed:', error);
      toast.error('Export failed');
    } finally {
      setExportState(prev => ({ ...prev, isExporting: false, progress: 0 }));
    }
  }, [exportState, result, onExport]);

  /**
   * Edit scene handler
   */
  const handleEditScene = useCallback(() => {
    if (onEdit) {
      onEdit(viewState.selectedScene);
      toast.info(`Editing Scene ${viewState.selectedScene + 1}`);
    }
  }, [viewState.selectedScene, onEdit]);

  /**
   * Render scene thumbnails grid
   */
  const renderThumbnailsGrid = () => {
    if (isGeneratingThumbnails) {
      return (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-2 text-muted-foreground">Generating previews...</span>
        </div>
      );
    }

    if (thumbnails.length === 0) {
      return (
        <div className="text-center text-muted-foreground py-8">
          No scenes available
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {thumbnails.map((thumbnail, index) => (
          <Card
            key={index}
            className={`cursor-pointer transition-all hover:shadow-lg ${
              viewState.selectedScene === index ? 'ring-2 ring-blue-500' : ''
            }`}
            onClick={() => handleSceneSelect(index)}
          >
            <CardContent className="p-3">
              {/* Thumbnail image */}
              <div className="aspect-video bg-muted rounded-md overflow-hidden mb-2">
                {thumbnail.thumbnail ? (
                  <img
                    src={thumbnail.thumbnail}
                    alt={thumbnail.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Scene info */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate">{thumbnail.title}</span>
                  {viewState.selectedScene === index && (
                    <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="text-xs">
                    {thumbnail.diagramType}
                  </Badge>
                  <span>{thumbnail.duration}s</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  /**
   * Render main preview area
   */
  const renderPreview = () => {
    const selectedThumbnail = thumbnails[viewState.selectedScene];

    return (
      <div className="space-y-4">
        {/* Preview canvas */}
        <div
          ref={containerRef}
          className="relative bg-muted rounded-lg overflow-hidden"
          style={{ aspectRatio: '16/9' }}
        >
          {selectedThumbnail?.thumbnail ? (
            <img
              src={selectedThumbnail.thumbnail}
              alt={selectedThumbnail.title}
              className="w-full h-full object-contain"
              style={{
                transform: `scale(${viewState.zoom / 100}) translate(${viewState.pan.x}px, ${viewState.pan.y}px)`
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <FileVideo className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Select a scene to preview</p>
              </div>
            </div>
          )}

          {/* Scene overlay info */}
          {selectedThumbnail && (
            <div className="absolute top-4 left-4 bg-black/70 text-white px-3 py-2 rounded-md">
              <div className="text-sm font-medium">{selectedThumbnail.title}</div>
              <div className="text-xs text-gray-300">
                Scene {viewState.selectedScene + 1} of {thumbnails.length}
              </div>
            </div>
          )}

          {/* Zoom level indicator */}
          <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-2 rounded-md text-sm">
            {viewState.zoom}%
          </div>
        </div>

        {/* Playback controls */}
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreviousScene}
            disabled={viewState.selectedScene === 0}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handlePlayPause}
          >
            {viewState.isPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleNextScene}
            disabled={viewState.selectedScene === thumbnails.length - 1}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>

          <Separator orientation="vertical" className="h-6 mx-2" />

          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomOut}
            disabled={viewState.zoom <= 50}
          >
            <ZoomOut className="w-4 h-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleResetZoom}
          >
            {viewState.zoom}%
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomIn}
            disabled={viewState.zoom >= 200}
          >
            <ZoomIn className="w-4 h-4" />
          </Button>

          {onEdit && (
            <>
              <Separator orientation="vertical" className="h-6 mx-2" />
              <Button
                variant="outline"
                size="sm"
                onClick={handleEditScene}
              >
                <Edit3 className="w-4 h-4 mr-2" />
                Edit
              </Button>
            </>
          )}
        </div>
      </div>
    );
  };

  /**
   * Render export options
   */
  const renderExportOptions = () => {
    return (
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Export Format</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {(['mp4', 'webm', 'gif', 'interactive-html'] as ExportFormat[]).map((format) => (
              <Button
                key={format}
                variant={exportState.format === format ? 'default' : 'outline'}
                onClick={() => setExportState(prev => ({ ...prev, format }))}
                className="w-full"
              >
                {format.toUpperCase()}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Video Quality</label>
          <div className="grid grid-cols-2 gap-2">
            {(['720p', '1080p', '1440p', '4k'] as const).map((resolution) => (
              <Button
                key={resolution}
                variant={exportState.quality.resolution === resolution ? 'default' : 'outline'}
                onClick={() => setExportState(prev => ({
                  ...prev,
                  quality: { ...prev.quality, resolution }
                }))}
              >
                {resolution}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Frame Rate</label>
          <div className="grid grid-cols-3 gap-2">
            {([24, 30, 60] as const).map((fps) => (
              <Button
                key={fps}
                variant={exportState.quality.fps === fps ? 'default' : 'outline'}
                onClick={() => setExportState(prev => ({
                  ...prev,
                  quality: { ...prev.quality, fps }
                }))}
              >
                {fps} FPS
              </Button>
            ))}
          </div>
        </div>

        <Button
          onClick={handleExport}
          disabled={exportState.isExporting}
          className="w-full"
          size="lg"
        >
          {exportState.isExporting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Exporting... {exportState.progress.toFixed(0)}%
            </>
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              Export Video
            </>
          )}
        </Button>
      </div>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Interactive Results</CardTitle>
          <div className="flex items-center gap-2">
            {onShare && (
              <Button variant="outline" size="sm" onClick={onShare}>
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="preview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="preview">
              <Eye className="w-4 h-4 mr-2" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="scenes">
              <Grid className="w-4 h-4 mr-2" />
              Scenes
            </TabsTrigger>
            <TabsTrigger value="export">
              <Download className="w-4 h-4 mr-2" />
              Export
            </TabsTrigger>
          </TabsList>

          <TabsContent value="preview" className="space-y-4">
            {renderPreview()}
          </TabsContent>

          <TabsContent value="scenes" className="space-y-4">
            <ScrollArea className="h-[500px]">
              {renderThumbnailsGrid()}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="export" className="space-y-4">
            {renderExportOptions()}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default InteractiveResultViewer;
