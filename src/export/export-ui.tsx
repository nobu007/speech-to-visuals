/**
 * 🎬 Enhanced Export UI Components
 * Iteration 37 - Phase 3: Export Interface
 *
 * Advanced export interface with format selection and preview
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import {
  Download,
  Settings,
  Play,
  Film,
  Image,
  FileText,
  Globe,
  Sparkles,
  Clock,
  HardDrive,
  Zap
} from 'lucide-react';

import {
  EnhancedExportEngine,
  ExportConfiguration,
  ExportFormat,
  VideoQuality,
  ExportSettings,
  ExportProgress,
  ExportResult
} from './enhanced-export-engine';

interface ExportPanelProps {
  sceneData: any;
  onExportComplete?: (result: ExportResult) => void;
  className?: string;
}

export const ExportPanel: React.FC<ExportPanelProps> = ({
  sceneData,
  onExportComplete,
  className = ''
}) => {
  const [exportEngine] = useState(() => new EnhancedExportEngine());
  const [config, setConfig] = useState<ExportConfiguration>({
    format: 'mp4',
    quality: {
      resolution: '1080p',
      fps: 30,
      bitrate: 'auto',
      hdr: false
    },
    settings: {
      loop: false,
      includeAudio: true,
      watermark: false,
      compression: 'medium',
      optimization: 'balanced'
    }
  });

  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleExport = async () => {
    if (!sceneData || isExporting) return;

    setIsExporting(true);
    setExportProgress(null);
    setExportResult(null);

    try {
      const result = await exportEngine.exportVideo(
        sceneData,
        config,
        (progress) => setExportProgress(progress)
      );

      setExportResult(result);
      if (result.success && onExportComplete) {
        onExportComplete(result);
      }
    } catch (error) {
      console.error('Export failed:', error);
      setExportResult({
        success: false,
        format: config.format,
        quality: config.quality,
        error: error instanceof Error ? error.message : 'Export failed'
      });
    } finally {
      setIsExporting(false);
    }
  };

  const updateConfig = (updates: Partial<ExportConfiguration>) => {
    setConfig(prev => ({
      ...prev,
      ...updates,
      quality: { ...prev.quality, ...updates.quality },
      settings: { ...prev.settings, ...updates.settings }
    }));
  };

  const formatOptions = [
    { value: 'mp4', label: 'MP4 Video', icon: Film, description: 'Universal video format' },
    { value: 'webm', label: 'WebM Video', icon: Film, description: 'Web-optimized format' },
    { value: 'gif', label: 'Animated GIF', icon: Image, description: 'For social media' },
    { value: 'interactive-html', label: 'Interactive HTML', icon: Globe, description: 'Web interactive' },
    { value: 'pdf-animated', label: 'Animated PDF', icon: FileText, description: 'Presentation format' },
    { value: 'svg-animated', label: 'Animated SVG', icon: Sparkles, description: 'Vector animation' },
    { value: 'json-lottie', label: 'Lottie JSON', icon: Sparkles, description: 'After Effects export' }
  ];

  const resolutionOptions = [
    { value: '720p', label: '720p HD', size: '1280x720' },
    { value: '1080p', label: '1080p Full HD', size: '1920x1080' },
    { value: '1440p', label: '1440p QHD', size: '2560x1440' },
    { value: '4k', label: '4K UHD', size: '3840x2160' }
  ];

  const getEstimatedFileSize = (): string => {
    const duration = sceneData?.duration || 10;
    const { resolution, fps, bitrate } = config.quality;

    let baseSizeMB = 1;
    if (resolution === '720p') baseSizeMB = 0.5;
    if (resolution === '1080p') baseSizeMB = 1;
    if (resolution === '1440p') baseSizeMB = 2;
    if (resolution === '4k') baseSizeMB = 4;

    if (fps === 60) baseSizeMB *= 1.5;
    if (bitrate === 'high') baseSizeMB *= 1.8;
    if (bitrate === 'lossless') baseSizeMB *= 3;

    const totalMB = baseSizeMB * duration;
    return totalMB > 1000 ? `${(totalMB / 1000).toFixed(1)}GB` : `${totalMB.toFixed(0)}MB`;
  };

  const getEstimatedTime = (): string => {
    const duration = sceneData?.duration || 10;
    let processingRatio = 0.5; // 50% of video duration

    if (config.quality.resolution === '4k') processingRatio *= 3;
    if (config.quality.fps === 60) processingRatio *= 1.5;
    if (config.format === 'interactive-html') processingRatio *= 0.5;

    const estimatedSeconds = duration * processingRatio;
    return estimatedSeconds > 60
      ? `${Math.ceil(estimatedSeconds / 60)}m`
      : `${Math.ceil(estimatedSeconds)}s`;
  };

  return (
    <Card className={`w-full max-w-2xl ${className}`}>
      <CardHeader>
        <CardTitle className=\"flex items-center gap-2\">
          <Download className=\"h-5 w-5\" />
          Export Video
          {exportResult?.success && (
            <Badge variant=\"secondary\" className=\"ml-auto\">
              Ready
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className=\"space-y-6\">
        <Tabs defaultValue=\"format\" className=\"w-full\">
          <TabsList className=\"grid w-full grid-cols-3\">
            <TabsTrigger value=\"format\">Format</TabsTrigger>
            <TabsTrigger value=\"quality\">Quality</TabsTrigger>
            <TabsTrigger value=\"advanced\">Advanced</TabsTrigger>
          </TabsList>

          {/* Format Selection */}
          <TabsContent value=\"format\" className=\"space-y-4\">
            <div className=\"grid grid-cols-1 gap-3\">
              {formatOptions.map((format) => {
                const Icon = format.icon;
                return (
                  <div
                    key={format.value}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
                      config.format === format.value ? 'border-primary bg-primary/5' : ''
                    }`}
                    onClick={() => updateConfig({ format: format.value as ExportFormat })}
                  >
                    <div className=\"flex items-center gap-3\">
                      <Icon className=\"h-5 w-5\" />
                      <div className=\"flex-1\">
                        <div className=\"font-medium\">{format.label}</div>
                        <div className=\"text-sm text-muted-foreground\">{format.description}</div>
                      </div>
                      {config.format === format.value && (
                        <Badge variant=\"default\">Selected</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* Quality Settings */}
          <TabsContent value=\"quality\" className=\"space-y-4\">
            <div className=\"space-y-4\">
              {/* Resolution */}
              <div className=\"space-y-2\">
                <Label>Resolution</Label>
                <Select
                  value={config.quality.resolution}
                  onValueChange={(value) => updateConfig({
                    quality: { resolution: value as VideoQuality['resolution'] }
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {resolutionOptions.map((res) => (
                      <SelectItem key={res.value} value={res.value}>
                        <div className=\"flex items-center justify-between w-full\">
                          <span>{res.label}</span>
                          <span className=\"text-muted-foreground ml-2\">{res.size}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Frame Rate */}
              <div className=\"space-y-2\">
                <Label>Frame Rate</Label>
                <Select
                  value={config.quality.fps.toString()}
                  onValueChange={(value) => updateConfig({
                    quality: { fps: parseInt(value) as VideoQuality['fps'] }
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value=\"24\">24 FPS (Cinema)</SelectItem>
                    <SelectItem value=\"30\">30 FPS (Standard)</SelectItem>
                    <SelectItem value=\"60\">60 FPS (Smooth)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Bitrate */}
              <div className=\"space-y-2\">
                <Label>Quality</Label>
                <Select
                  value={config.quality.bitrate}
                  onValueChange={(value) => updateConfig({
                    quality: { bitrate: value as VideoQuality['bitrate'] }
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value=\"auto\">Auto (Recommended)</SelectItem>
                    <SelectItem value=\"low\">Low (Smaller file)</SelectItem>
                    <SelectItem value=\"medium\">Medium</SelectItem>
                    <SelectItem value=\"high\">High (Better quality)</SelectItem>
                    <SelectItem value=\"lossless\">Lossless (Largest file)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* HDR */}
              {['mp4', 'webm'].includes(config.format) && (
                <div className=\"flex items-center justify-between\">
                  <div className=\"space-y-0.5\">
                    <Label>HDR (High Dynamic Range)</Label>
                    <div className=\"text-sm text-muted-foreground\">
                      Enhanced color and brightness
                    </div>
                  </div>
                  <Switch
                    checked={config.quality.hdr}
                    onCheckedChange={(checked) => updateConfig({
                      quality: { hdr: checked }
                    })}
                  />
                </div>
              )}
            </div>
          </TabsContent>

          {/* Advanced Settings */}
          <TabsContent value=\"advanced\" className=\"space-y-4\">
            <div className=\"space-y-4\">
              {/* Audio */}
              <div className=\"flex items-center justify-between\">
                <div className=\"space-y-0.5\">
                  <Label>Include Audio</Label>
                  <div className=\"text-sm text-muted-foreground\">
                    Include original audio track
                  </div>
                </div>
                <Switch
                  checked={config.settings.includeAudio}
                  onCheckedChange={(checked) => updateConfig({
                    settings: { includeAudio: checked }
                  })}
                />
              </div>

              {/* Loop */}
              <div className=\"flex items-center justify-between\">
                <div className=\"space-y-0.5\">
                  <Label>Loop Video</Label>
                  <div className=\"text-sm text-muted-foreground\">
                    Automatically restart when finished
                  </div>
                </div>
                <Switch
                  checked={config.settings.loop}
                  onCheckedChange={(checked) => updateConfig({
                    settings: { loop: checked }
                  })}
                />
              </div>

              {/* Watermark */}
              <div className=\"flex items-center justify-between\">
                <div className=\"space-y-0.5\">
                  <Label>Add Watermark</Label>
                  <div className=\"text-sm text-muted-foreground\">
                    Include branding watermark
                  </div>
                </div>
                <Switch
                  checked={config.settings.watermark}
                  onCheckedChange={(checked) => updateConfig({
                    settings: { watermark: checked }
                  })}
                />
              </div>

              {/* Compression */}
              <div className=\"space-y-2\">
                <Label>Compression Level</Label>
                <Select
                  value={config.settings.compression}
                  onValueChange={(value) => updateConfig({
                    settings: { compression: value as ExportSettings['compression'] }
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value=\"none\">None (Largest)</SelectItem>
                    <SelectItem value=\"low\">Low</SelectItem>
                    <SelectItem value=\"medium\">Medium (Recommended)</SelectItem>
                    <SelectItem value=\"high\">High</SelectItem>
                    <SelectItem value=\"maximum\">Maximum (Smallest)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Optimization */}
              <div className=\"space-y-2\">
                <Label>Optimization Priority</Label>
                <Select
                  value={config.settings.optimization}
                  onValueChange={(value) => updateConfig({
                    settings: { optimization: value as ExportSettings['optimization'] }
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value=\"speed\">Speed (Faster export)</SelectItem>
                    <SelectItem value=\"balanced\">Balanced (Recommended)</SelectItem>
                    <SelectItem value=\"quality\">Quality (Better output)</SelectItem>
                    <SelectItem value=\"size\">Size (Smaller file)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <Separator />

        {/* Export Summary */}
        <div className=\"space-y-3\">
          <h3 className=\"font-medium\">Export Summary</h3>
          <div className=\"grid grid-cols-3 gap-4 text-sm\">
            <div className=\"flex items-center gap-2\">
              <HardDrive className=\"h-4 w-4 text-muted-foreground\" />
              <div>
                <div className=\"font-medium\">{getEstimatedFileSize()}</div>
                <div className=\"text-muted-foreground\">Estimated size</div>
              </div>
            </div>
            <div className=\"flex items-center gap-2\">
              <Clock className=\"h-4 w-4 text-muted-foreground\" />
              <div>
                <div className=\"font-medium\">{getEstimatedTime()}</div>
                <div className=\"text-muted-foreground\">Processing time</div>
              </div>
            </div>
            <div className=\"flex items-center gap-2\">
              <Zap className=\"h-4 w-4 text-muted-foreground\" />
              <div>
                <div className=\"font-medium\">{config.quality.resolution}</div>
                <div className=\"text-muted-foreground\">{config.quality.fps} FPS</div>
              </div>
            </div>
          </div>
        </div>

        {/* Export Progress */}
        {isExporting && exportProgress && (
          <div className=\"space-y-3\">
            <div className=\"flex items-center justify-between\">
              <span className=\"font-medium\">Exporting...</span>
              <span className=\"text-sm text-muted-foreground\">
                {exportProgress.progress.toFixed(0)}%
              </span>
            </div>
            <Progress value={exportProgress.progress} className=\"w-full\" />
            <div className=\"text-sm text-muted-foreground\">
              {exportProgress.details || `Stage: ${exportProgress.stage}`}
            </div>
          </div>
        )}

        {/* Export Result */}
        {exportResult && !isExporting && (
          <div className={`p-4 rounded-lg ${
            exportResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            <div className=\"flex items-center gap-2\">
              {exportResult.success ? (
                <>
                  <Download className=\"h-5 w-5 text-green-600\" />
                  <div className=\"flex-1\">
                    <div className=\"font-medium text-green-900\">Export Complete!</div>
                    <div className=\"text-sm text-green-700\">
                      File size: {exportResult.outputSize ? `${(exportResult.outputSize / 1024 / 1024).toFixed(1)}MB` : 'Unknown'}
                      {exportResult.duration && ` • Duration: ${exportResult.duration.toFixed(1)}s`}
                    </div>
                  </div>
                  <Button size=\"sm\" className=\"bg-green-600 hover:bg-green-700\">
                    Download
                  </Button>
                </>
              ) : (
                <>
                  <div className=\"flex-1\">
                    <div className=\"font-medium text-red-900\">Export Failed</div>
                    <div className=\"text-sm text-red-700\">{exportResult.error}</div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Export Button */}
        <Button
          onClick={handleExport}
          disabled={isExporting || !sceneData}
          className=\"w-full\"
          size=\"lg\"
        >
          {isExporting ? (
            <>
              <div className=\"w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2\" />
              Exporting...
            </>
          ) : (
            <>
              <Download className=\"h-4 w-4 mr-2\" />
              Export Video
            </>
          )}
        </Button>

        {/* Format Info */}
        <div className=\"text-xs text-muted-foreground text-center\">
          Exporting as {config.format.toUpperCase()} • {config.quality.resolution} @ {config.quality.fps}fps
        </div>
      </CardContent>
    </Card>
  );
};