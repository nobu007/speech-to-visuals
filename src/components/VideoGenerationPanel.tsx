/**
 * Video Generation Panel Component - Iteration 66 Phase C
 * 動画生成フル機能化 (品質設定・カスタマイズ・アニメーション制御)
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Video, Settings, Palette, Sparkles, Film, Loader2,
  CheckCircle, AlertCircle, Sliders, Play, Wand2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import type { VideoQuality } from '@/export/enhanced-export-engine';

export interface VideoGenerationConfig {
  quality: VideoQuality;
  customization: CustomizationOptions;
  animations: AnimationOptions;
  audio: AudioOptions;
}

export interface CustomizationOptions {
  branding: boolean;
  brandingText?: string;
  colorTheme: 'light' | 'dark' | 'auto' | 'custom';
  customColors?: {
    primary: string;
    secondary: string;
    background: string;
    text: string;
  };
  fontFamily: string;
  fontSize: number;
  logo?: string;
}

export interface AnimationOptions {
  transitionEffect: 'fade' | 'slide' | 'zoom' | 'none';
  transitionDuration: number; // milliseconds
  diagramAnimation: 'sequential' | 'simultaneous' | 'none';
  diagramAnimationSpeed: number; // 0.5x - 2.0x
  textAnimation: 'typewriter' | 'fade' | 'slide' | 'none';
  textAnimationSpeed: number;
}

export interface AudioOptions {
  includeAudio: boolean;
  audioVolume: number; // 0-100
  backgroundMusic: boolean;
  backgroundMusicVolume: number;
  audioNormalization: boolean;
}

export interface VideoGenerationPanelProps {
  onGenerate: (config: VideoGenerationConfig) => void;
  isGenerating?: boolean;
  generationProgress?: number;
  defaultConfig?: Partial<VideoGenerationConfig>;
}

export const VideoGenerationPanel: React.FC<VideoGenerationPanelProps> = ({
  onGenerate,
  isGenerating = false,
  generationProgress = 0,
  defaultConfig
}) => {
  // Video generation configuration state
  const [config, setConfig] = useState<VideoGenerationConfig>({
    quality: {
      resolution: '1080p',
      fps: 30,
      bitrate: 'high',
      hdr: false,
      ...defaultConfig?.quality
    },
    customization: {
      branding: false,
      colorTheme: 'auto',
      fontFamily: 'Inter',
      fontSize: 16,
      ...defaultConfig?.customization
    },
    animations: {
      transitionEffect: 'fade',
      transitionDuration: 500,
      diagramAnimation: 'sequential',
      diagramAnimationSpeed: 1.0,
      textAnimation: 'fade',
      textAnimationSpeed: 1.0,
      ...defaultConfig?.animations
    },
    audio: {
      includeAudio: true,
      audioVolume: 100,
      backgroundMusic: false,
      backgroundMusicVolume: 30,
      audioNormalization: true,
      ...defaultConfig?.audio
    }
  });

  // Validation state
  const [validation, setValidation] = useState<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }>({
    isValid: true,
    errors: [],
    warnings: []
  });

  /**
   * Validate configuration
   */
  useEffect(() => {
    validateConfiguration();
  }, [config]);

  const validateConfiguration = useCallback(() => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Quality validation
    if (config.quality.resolution === '4k' && config.quality.fps > 30) {
      warnings.push('4K at high frame rate may result in very large files');
    }

    // Animation validation
    if (config.animations.diagramAnimationSpeed < 0.5 || config.animations.diagramAnimationSpeed > 2.0) {
      errors.push('Animation speed must be between 0.5x and 2.0x');
    }

    // Audio validation
    if (!config.audio.includeAudio && config.audio.backgroundMusic) {
      errors.push('Cannot enable background music without audio');
    }

    setValidation({
      isValid: errors.length === 0,
      errors,
      warnings
    });
  }, [config]);

  /**
   * Update configuration
   */
  const updateConfig = useCallback(<K extends keyof VideoGenerationConfig>(
    category: K,
    updates: Partial<VideoGenerationConfig[K]>
  ) => {
    setConfig(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        ...updates
      }
    }));
  }, []);

  /**
   * Handle video generation
   */
  const handleGenerate = useCallback(() => {
    if (!validation.isValid) {
      toast.error('Please fix configuration errors before generating');
      return;
    }

    if (validation.warnings.length > 0) {
      toast.warning(validation.warnings[0]);
    }

    console.log('🎬 Starting video generation with config:', config);
    onGenerate(config);
    toast.success('Video generation started');
  }, [config, validation, onGenerate]);

  /**
   * Render quality settings
   */
  const renderQualitySettings = () => (
    <div className="space-y-6">
      {/* Resolution */}
      <div className="space-y-2">
        <Label>Resolution</Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {(['720p', '1080p', '1440p', '4k'] as const).map((resolution) => (
            <Button
              key={resolution}
              variant={config.quality.resolution === resolution ? 'default' : 'outline'}
              onClick={() => updateConfig('quality', { resolution })}
              className="w-full"
            >
              {resolution}
              {resolution === '1080p' && (
                <Badge variant="secondary" className="ml-2 text-xs">Recommended</Badge>
              )}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Current: {config.quality.resolution} ({getResolutionDimensions(config.quality.resolution)})
        </p>
      </div>

      {/* Frame Rate */}
      <div className="space-y-2">
        <Label>Frame Rate</Label>
        <div className="grid grid-cols-3 gap-2">
          {([24, 30, 60] as const).map((fps) => (
            <Button
              key={fps}
              variant={config.quality.fps === fps ? 'default' : 'outline'}
              onClick={() => updateConfig('quality', { fps })}
            >
              {fps} FPS
            </Button>
          ))}
        </div>
      </div>

      {/* Bitrate */}
      <div className="space-y-2">
        <Label>Video Bitrate</Label>
        <Select
          value={config.quality.bitrate}
          onValueChange={(value) => updateConfig('quality', { bitrate: value as any })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto (Recommended)</SelectItem>
            <SelectItem value="low">Low (Smaller file size)</SelectItem>
            <SelectItem value="medium">Medium (Balanced)</SelectItem>
            <SelectItem value="high">High (Best quality)</SelectItem>
            <SelectItem value="lossless">Lossless (Largest file)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* HDR */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>HDR (High Dynamic Range)</Label>
          <p className="text-xs text-muted-foreground">
            Enhanced color range and brightness
          </p>
        </div>
        <Switch
          checked={config.quality.hdr}
          onCheckedChange={(checked) => updateConfig('quality', { hdr: checked })}
        />
      </div>
    </div>
  );

  /**
   * Render customization settings
   */
  const renderCustomizationSettings = () => (
    <div className="space-y-6">
      {/* Color Theme */}
      <div className="space-y-2">
        <Label>Color Theme</Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {(['light', 'dark', 'auto', 'custom'] as const).map((theme) => (
            <Button
              key={theme}
              variant={config.customization.colorTheme === theme ? 'default' : 'outline'}
              onClick={() => updateConfig('customization', { colorTheme: theme })}
            >
              {theme.charAt(0).toUpperCase() + theme.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Font Family */}
      <div className="space-y-2">
        <Label>Font Family</Label>
        <Select
          value={config.customization.fontFamily}
          onValueChange={(value) => updateConfig('customization', { fontFamily: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Inter">Inter (Modern)</SelectItem>
            <SelectItem value="Roboto">Roboto (Clean)</SelectItem>
            <SelectItem value="Open Sans">Open Sans (Friendly)</SelectItem>
            <SelectItem value="Lato">Lato (Professional)</SelectItem>
            <SelectItem value="Montserrat">Montserrat (Bold)</SelectItem>
            <SelectItem value="Source Sans Pro">Source Sans Pro (Technical)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Font Size */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Font Size: {config.customization.fontSize}px</Label>
        </div>
        <Slider
          value={[config.customization.fontSize]}
          onValueChange={([value]) => updateConfig('customization', { fontSize: value })}
          min={12}
          max={24}
          step={1}
        />
      </div>

      {/* Branding */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Custom Branding</Label>
            <p className="text-xs text-muted-foreground">
              Add your brand name or logo
            </p>
          </div>
          <Switch
            checked={config.customization.branding}
            onCheckedChange={(checked) => updateConfig('customization', { branding: checked })}
          />
        </div>

        {config.customization.branding && (
          <div className="space-y-2 ml-4 pl-4 border-l-2 border-muted">
            <Label>Branding Text</Label>
            <input
              type="text"
              value={config.customization.brandingText || ''}
              onChange={(e) => updateConfig('customization', { brandingText: e.target.value })}
              placeholder="Your Brand Name"
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
        )}
      </div>
    </div>
  );

  /**
   * Render animation settings
   */
  const renderAnimationSettings = () => (
    <div className="space-y-6">
      {/* Transition Effect */}
      <div className="space-y-2">
        <Label>Scene Transition</Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {(['fade', 'slide', 'zoom', 'none'] as const).map((effect) => (
            <Button
              key={effect}
              variant={config.animations.transitionEffect === effect ? 'default' : 'outline'}
              onClick={() => updateConfig('animations', { transitionEffect: effect })}
            >
              {effect.charAt(0).toUpperCase() + effect.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Transition Duration */}
      {config.animations.transitionEffect !== 'none' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Transition Duration: {config.animations.transitionDuration}ms</Label>
          </div>
          <Slider
            value={[config.animations.transitionDuration]}
            onValueChange={([value]) => updateConfig('animations', { transitionDuration: value })}
            min={100}
            max={2000}
            step={100}
          />
        </div>
      )}

      {/* Diagram Animation */}
      <div className="space-y-2">
        <Label>Diagram Animation Style</Label>
        <div className="grid grid-cols-3 gap-2">
          {(['sequential', 'simultaneous', 'none'] as const).map((style) => (
            <Button
              key={style}
              variant={config.animations.diagramAnimation === style ? 'default' : 'outline'}
              onClick={() => updateConfig('animations', { diagramAnimation: style })}
            >
              {style.charAt(0).toUpperCase() + style.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Diagram Animation Speed */}
      {config.animations.diagramAnimation !== 'none' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Diagram Animation Speed: {config.animations.diagramAnimationSpeed}x</Label>
          </div>
          <Slider
            value={[config.animations.diagramAnimationSpeed]}
            onValueChange={([value]) => updateConfig('animations', { diagramAnimationSpeed: value })}
            min={0.5}
            max={2.0}
            step={0.1}
          />
        </div>
      )}

      {/* Text Animation */}
      <div className="space-y-2">
        <Label>Text Animation Style</Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {(['typewriter', 'fade', 'slide', 'none'] as const).map((style) => (
            <Button
              key={style}
              variant={config.animations.textAnimation === style ? 'default' : 'outline'}
              onClick={() => updateConfig('animations', { textAnimation: style })}
            >
              {style.charAt(0).toUpperCase() + style.slice(1)}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );

  /**
   * Render audio settings
   */
  const renderAudioSettings = () => (
    <div className="space-y-6">
      {/* Include Audio */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>Include Original Audio</Label>
          <p className="text-xs text-muted-foreground">
            Include the transcribed audio in the video
          </p>
        </div>
        <Switch
          checked={config.audio.includeAudio}
          onCheckedChange={(checked) => updateConfig('audio', { includeAudio: checked })}
        />
      </div>

      {/* Audio Volume */}
      {config.audio.includeAudio && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Audio Volume: {config.audio.audioVolume}%</Label>
          </div>
          <Slider
            value={[config.audio.audioVolume]}
            onValueChange={([value]) => updateConfig('audio', { audioVolume: value })}
            min={0}
            max={100}
            step={5}
          />
        </div>
      )}

      {/* Background Music */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>Background Music</Label>
          <p className="text-xs text-muted-foreground">
            Add subtle background music to the video
          </p>
        </div>
        <Switch
          checked={config.audio.backgroundMusic}
          onCheckedChange={(checked) => updateConfig('audio', { backgroundMusic: checked })}
          disabled={!config.audio.includeAudio}
        />
      </div>

      {/* Background Music Volume */}
      {config.audio.backgroundMusic && config.audio.includeAudio && (
        <div className="space-y-2 ml-4 pl-4 border-l-2 border-muted">
          <div className="flex items-center justify-between">
            <Label>Background Music Volume: {config.audio.backgroundMusicVolume}%</Label>
          </div>
          <Slider
            value={[config.audio.backgroundMusicVolume]}
            onValueChange={([value]) => updateConfig('audio', { backgroundMusicVolume: value })}
            min={0}
            max={100}
            step={5}
          />
        </div>
      )}

      {/* Audio Normalization */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>Audio Normalization</Label>
          <p className="text-xs text-muted-foreground">
            Automatically adjust audio levels for consistency
          </p>
        </div>
        <Switch
          checked={config.audio.audioNormalization}
          onCheckedChange={(checked) => updateConfig('audio', { audioNormalization: checked })}
          disabled={!config.audio.includeAudio}
        />
      </div>
    </div>
  );

  /**
   * Render validation messages
   */
  const renderValidation = () => {
    if (validation.errors.length === 0 && validation.warnings.length === 0) {
      return null;
    }

    return (
      <div className="space-y-2">
        {validation.errors.map((error, index) => (
          <div key={`error-${index}`} className="flex items-start gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-950 p-3 rounded-md">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        ))}

        {validation.warnings.map((warning, index) => (
          <div key={`warning-${index}`} className="flex items-start gap-2 text-sm text-yellow-600 bg-yellow-50 dark:bg-yellow-950 p-3 rounded-md">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{warning}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Film className="w-5 h-5" />
              Video Generation Settings
            </CardTitle>
            <CardDescription>
              Customize video quality, appearance, and animations
            </CardDescription>
          </div>
          {isGenerating && (
            <Badge variant="default" className="animate-pulse">
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              Generating...
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Validation Messages */}
        {renderValidation()}

        {/* Settings Tabs */}
        <Tabs defaultValue="quality" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="quality">
              <Video className="w-4 h-4 mr-2" />
              Quality
            </TabsTrigger>
            <TabsTrigger value="customization">
              <Palette className="w-4 h-4 mr-2" />
              Style
            </TabsTrigger>
            <TabsTrigger value="animations">
              <Sparkles className="w-4 h-4 mr-2" />
              Animations
            </TabsTrigger>
            <TabsTrigger value="audio">
              <Sliders className="w-4 h-4 mr-2" />
              Audio
            </TabsTrigger>
          </TabsList>

          <TabsContent value="quality" className="space-y-4 mt-6">
            {renderQualitySettings()}
          </TabsContent>

          <TabsContent value="customization" className="space-y-4 mt-6">
            {renderCustomizationSettings()}
          </TabsContent>

          <TabsContent value="animations" className="space-y-4 mt-6">
            {renderAnimationSettings()}
          </TabsContent>

          <TabsContent value="audio" className="space-y-4 mt-6">
            {renderAudioSettings()}
          </TabsContent>
        </Tabs>

        {/* Generation Progress */}
        {isGenerating && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Generating video...</span>
              <span className="font-medium">{generationProgress.toFixed(0)}%</span>
            </div>
            <Progress value={generationProgress} />
          </div>
        )}

        {/* Generate Button */}
        <Button
          onClick={handleGenerate}
          disabled={!validation.isValid || isGenerating}
          className="w-full"
          size="lg"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating Video... {generationProgress.toFixed(0)}%
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4 mr-2" />
              Generate Video
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

/**
 * Helper function to get resolution dimensions
 */
function getResolutionDimensions(resolution: string): string {
  const dimensions = {
    '720p': '1280 × 720',
    '1080p': '1920 × 1080',
    '1440p': '2560 × 1440',
    '4k': '3840 × 2160'
  };
  return dimensions[resolution as keyof typeof dimensions] || resolution;
}

export default VideoGenerationPanel;
