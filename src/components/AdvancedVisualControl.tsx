/**
 * 🎯 Iteration 53: Advanced Visual Control Panel
 * Professional-grade visual customization interface
 * Following custom instructions methodology for enhanced UX
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import {
  Palette,
  Settings,
  Play,
  Download,
  Eye,
  Sparkles,
  Zap,
  RotateCcw,
  Save,
  Brush,
  Layout,
  Film
} from 'lucide-react';
import {
  VisualStyle,
  RenderOptions,
  EnhancedSceneGraph,
  advancedVisualEngine
} from '@/visualization/advanced-visual-engine';
import { SceneGraph } from '@/types/diagram';
import { toast } from 'sonner';

export interface AdvancedVisualControlProps {
  scenes: SceneGraph[];
  onStyleChange?: (style: VisualStyle) => void;
  onRenderRequest?: (options: RenderOptions) => void;
  onPreview?: (enhancedScenes: EnhancedSceneGraph[]) => void;
  className?: string;
}

interface PresetStyle {
  name: string;
  description: string;
  style: VisualStyle;
  icon: string;
}

export const AdvancedVisualControl: React.FC<AdvancedVisualControlProps> = ({
  scenes,
  onStyleChange,
  onRenderRequest,
  onPreview,
  className
}) => {
  // Visual style state
  const [visualStyle, setVisualStyle] = useState<VisualStyle>({
    theme: 'modern',
    colorScheme: 'blue',
    animation: 'smooth',
    nodeStyle: 'rounded',
    edgeStyle: 'curved',
    fontSize: 'medium',
    spacing: 'normal'
  });

  // Render options state
  const [renderOptions, setRenderOptions] = useState<RenderOptions>({
    width: 1920,
    height: 1080,
    fps: 30,
    quality: 'high',
    format: 'mp4',
    includeAudio: true,
    exportCaption: true
  });

  // UI state
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [enhancedScenes, setEnhancedScenes] = useState<EnhancedSceneGraph[]>([]);
  const [activeTab, setActiveTab] = useState('style');

  // Professional style presets
  const stylePresets: PresetStyle[] = [
    {
      name: 'Modern Business',
      description: 'Clean, professional look for corporate presentations',
      icon: '💼',
      style: {
        theme: 'modern',
        colorScheme: 'blue',
        animation: 'smooth',
        nodeStyle: 'rounded',
        edgeStyle: 'curved',
        fontSize: 'medium',
        spacing: 'normal'
      }
    },
    {
      name: 'Creative Flow',
      description: 'Vibrant, dynamic style for creative projects',
      icon: '🎨',
      style: {
        theme: 'creative',
        colorScheme: 'gradient',
        animation: 'bounce',
        nodeStyle: 'circle',
        edgeStyle: 'bezier',
        fontSize: 'large',
        spacing: 'spacious'
      }
    },
    {
      name: 'Minimal Clean',
      description: 'Simple, distraction-free design',
      icon: '✨',
      style: {
        theme: 'minimal',
        colorScheme: 'monochrome',
        animation: 'fade',
        nodeStyle: 'square',
        edgeStyle: 'straight',
        fontSize: 'medium',
        spacing: 'compact'
      }
    },
    {
      name: 'Corporate Elite',
      description: 'Executive-level presentation style',
      icon: '🏢',
      style: {
        theme: 'corporate',
        colorScheme: 'purple',
        animation: 'slide',
        nodeStyle: 'rounded',
        edgeStyle: 'orthogonal',
        fontSize: 'large',
        spacing: 'normal'
      }
    }
  ];

  // Apply style changes
  const handleStyleChange = useCallback((newStyle: Partial<VisualStyle>) => {
    const updatedStyle = { ...visualStyle, ...newStyle };
    setVisualStyle(updatedStyle);
    onStyleChange?.(updatedStyle);
  }, [visualStyle, onStyleChange]);

  // Apply preset style
  const applyPreset = useCallback((preset: PresetStyle) => {
    setVisualStyle(preset.style);
    onStyleChange?.(preset.style);
    toast.success(`Applied ${preset.name} style`);
  }, [onStyleChange]);

  // Generate preview
  const generatePreview = useCallback(async () => {
    if (scenes.length === 0) {
      toast.error('No scenes available for preview');
      return;
    }

    setIsProcessing(true);
    try {
      console.log('🎨 Generating visual preview...');
      const enhanced = await advancedVisualEngine.enhanceMultipleScenes(scenes, visualStyle);
      setEnhancedScenes(enhanced);
      setIsPreviewMode(true);
      onPreview?.(enhanced);
      toast.success(`Preview generated for ${enhanced.length} scenes`);
    } catch (error) {
      console.error('Preview generation failed:', error);
      toast.error('Failed to generate preview');
    } finally {
      setIsProcessing(false);
    }
  }, [scenes, visualStyle, onPreview]);

  // Request render
  const requestRender = useCallback(() => {
    if (enhancedScenes.length === 0) {
      toast.error('Please generate preview first');
      return;
    }

    onRenderRequest?.(renderOptions);
    toast.info('Render request submitted');
  }, [enhancedScenes, renderOptions, onRenderRequest]);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    setVisualStyle({
      theme: 'modern',
      colorScheme: 'blue',
      animation: 'smooth',
      nodeStyle: 'rounded',
      edgeStyle: 'curved',
      fontSize: 'medium',
      spacing: 'normal'
    });
    setIsPreviewMode(false);
    setEnhancedScenes([]);
    toast.info('Reset to default settings');
  }, []);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Advanced Visual Control
            <Badge variant="outline" className="ml-auto">
              Iteration 53
            </Badge>
          </CardTitle>
          <CardDescription>
            Professional-grade visual customization for high-quality diagram rendering
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Quick Actions */}
          <div className="flex gap-2 mb-4">
            <Button
              onClick={generatePreview}
              disabled={isProcessing || scenes.length === 0}
              size="sm"
            >
              <Eye className="h-4 w-4 mr-2" />
              {isProcessing ? 'Generating...' : 'Preview'}
            </Button>
            <Button
              onClick={requestRender}
              disabled={enhancedScenes.length === 0}
              size="sm"
              variant="outline"
            >
              <Film className="h-4 w-4 mr-2" />
              Render Video
            </Button>
            <Button
              onClick={resetToDefaults}
              size="sm"
              variant="outline"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          </div>

          {/* Status */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                scenes.length > 0 ? 'bg-green-500' : 'bg-gray-400'
              }`} />
              <span className="text-sm font-medium">
                {scenes.length} scenes available
              </span>
            </div>
            <div className="flex gap-2">
              {isPreviewMode && (
                <Badge variant="default">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Preview Ready
                </Badge>
              )}
              {enhancedScenes.length > 0 && (
                <Badge variant="secondary">
                  {enhancedScenes.length} Enhanced
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Control Tabs */}
      <Card>
        <CardContent className="pt-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="presets">
                <Brush className="h-4 w-4 mr-2" />
                Presets
              </TabsTrigger>
              <TabsTrigger value="style">
                <Settings className="h-4 w-4 mr-2" />
                Style
              </TabsTrigger>
              <TabsTrigger value="layout">
                <Layout className="h-4 w-4 mr-2" />
                Layout
              </TabsTrigger>
              <TabsTrigger value="export">
                <Download className="h-4 w-4 mr-2" />
                Export
              </TabsTrigger>
            </TabsList>

            {/* Presets Tab */}
            <TabsContent value="presets" className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                {stylePresets.map((preset, index) => (
                  <Card
                    key={index}
                    className="cursor-pointer hover:border-primary transition-colors"
                    onClick={() => applyPreset(preset)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="text-2xl">{preset.icon}</div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-sm">{preset.name}</h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            {preset.description}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Style Tab */}
            <TabsContent value="style" className="space-y-4">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Theme & Colors */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-sm">Theme & Colors</h4>

                  <div className="space-y-2">
                    <Label>Theme</Label>
                    <Select
                      value={visualStyle.theme}
                      onValueChange={(value: any) => handleStyleChange({ theme: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="modern">Modern</SelectItem>
                        <SelectItem value="classic">Classic</SelectItem>
                        <SelectItem value="minimal">Minimal</SelectItem>
                        <SelectItem value="corporate">Corporate</SelectItem>
                        <SelectItem value="creative">Creative</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Color Scheme</Label>
                    <Select
                      value={visualStyle.colorScheme}
                      onValueChange={(value: any) => handleStyleChange({ colorScheme: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="blue">Blue</SelectItem>
                        <SelectItem value="green">Green</SelectItem>
                        <SelectItem value="purple">Purple</SelectItem>
                        <SelectItem value="orange">Orange</SelectItem>
                        <SelectItem value="gradient">Gradient</SelectItem>
                        <SelectItem value="monochrome">Monochrome</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Typography & Animation */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-sm">Typography & Animation</h4>

                  <div className="space-y-2">
                    <Label>Font Size</Label>
                    <Select
                      value={visualStyle.fontSize}
                      onValueChange={(value: any) => handleStyleChange({ fontSize: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">Small</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="large">Large</SelectItem>
                        <SelectItem value="xl">Extra Large</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Animation Style</Label>
                    <Select
                      value={visualStyle.animation}
                      onValueChange={(value: any) => handleStyleChange({ animation: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="smooth">Smooth</SelectItem>
                        <SelectItem value="bounce">Bounce</SelectItem>
                        <SelectItem value="fade">Fade</SelectItem>
                        <SelectItem value="slide">Slide</SelectItem>
                        <SelectItem value="zoom">Zoom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Layout Tab */}
            <TabsContent value="layout" className="space-y-4">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Node Style */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-sm">Node Style</h4>

                  <div className="space-y-2">
                    <Label>Node Shape</Label>
                    <Select
                      value={visualStyle.nodeStyle}
                      onValueChange={(value: any) => handleStyleChange({ nodeStyle: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rounded">Rounded</SelectItem>
                        <SelectItem value="square">Square</SelectItem>
                        <SelectItem value="circle">Circle</SelectItem>
                        <SelectItem value="hexagon">Hexagon</SelectItem>
                        <SelectItem value="diamond">Diamond</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Spacing</Label>
                    <Select
                      value={visualStyle.spacing}
                      onValueChange={(value: any) => handleStyleChange({ spacing: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="compact">Compact</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="spacious">Spacious</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Edge Style */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-sm">Edge Style</h4>

                  <div className="space-y-2">
                    <Label>Edge Type</Label>
                    <Select
                      value={visualStyle.edgeStyle}
                      onValueChange={(value: any) => handleStyleChange({ edgeStyle: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="straight">Straight</SelectItem>
                        <SelectItem value="curved">Curved</SelectItem>
                        <SelectItem value="orthogonal">Orthogonal</SelectItem>
                        <SelectItem value="bezier">Bezier</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Export Tab */}
            <TabsContent value="export" className="space-y-4">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Resolution & Quality */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-sm">Resolution & Quality</h4>

                  <div className="space-y-2">
                    <Label>Resolution</Label>
                    <Select
                      value={`${renderOptions.width}x${renderOptions.height}`}
                      onValueChange={(value) => {
                        const [width, height] = value.split('x').map(Number);
                        setRenderOptions(prev => ({ ...prev, width, height }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1920x1080">1920×1080 (HD)</SelectItem>
                        <SelectItem value="3840x2160">3840×2160 (4K)</SelectItem>
                        <SelectItem value="1280x720">1280×720 (HD)</SelectItem>
                        <SelectItem value="1600x900">1600×900</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Quality</Label>
                    <Select
                      value={renderOptions.quality}
                      onValueChange={(value: any) =>
                        setRenderOptions(prev => ({ ...prev, quality: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="ultra">Ultra</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Frame Rate: {renderOptions.fps} FPS</Label>
                    <Slider
                      value={[renderOptions.fps]}
                      onValueChange={([fps]) =>
                        setRenderOptions(prev => ({ ...prev, fps }))
                      }
                      min={24}
                      max={60}
                      step={6}
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Format & Options */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-sm">Format & Options</h4>

                  <div className="space-y-2">
                    <Label>Video Format</Label>
                    <Select
                      value={renderOptions.format}
                      onValueChange={(value: any) =>
                        setRenderOptions(prev => ({ ...prev, format: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mp4">MP4</SelectItem>
                        <SelectItem value="webm">WebM</SelectItem>
                        <SelectItem value="gif">GIF</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Include Audio</Label>
                    <Switch
                      checked={renderOptions.includeAudio}
                      onCheckedChange={(checked) =>
                        setRenderOptions(prev => ({ ...prev, includeAudio: checked }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Export Captions</Label>
                    <Switch
                      checked={renderOptions.exportCaption}
                      onCheckedChange={(checked) =>
                        setRenderOptions(prev => ({ ...prev, exportCaption: checked }))
                      }
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Preview Status */}
      {enhancedScenes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Enhanced Preview Ready
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {enhancedScenes.length}
                </div>
                <div className="text-xs text-blue-600">Enhanced Scenes</div>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {enhancedScenes.reduce((sum, scene) => sum + scene.animations.length, 0)}
                </div>
                <div className="text-xs text-green-600">Animations</div>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {renderOptions.quality.toUpperCase()}
                </div>
                <div className="text-xs text-purple-600">Quality</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdvancedVisualControl;