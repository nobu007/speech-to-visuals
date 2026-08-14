/**
 * 🎯 Iteration 53 → types-only: Advanced Visual Enhancement Engine (retired)
 *
 * The `AdvancedVisualEngine` class and its `advancedVisualEngine` singleton were
 * removed: they had ZERO production callers, and the singleton carried an
 * uncapped monotonic-key `qualityMetrics` Map (a latent memory leak). Only the
 * type contracts below remain — they are LIVE, consumed by
 * `src/export/production-exporter.ts` and its tests.
 *
 * Consumers that need enhanced-scene construction should build an
 * `EnhancedSceneGraph` directly (plain object literal) — the engine's styling
 * helpers were never wired into any pipeline.
 */

import { SceneGraph } from '@/types/diagram';

export interface VisualStyle {
  theme: 'modern' | 'classic' | 'minimal' | 'corporate' | 'creative';
  colorScheme: 'blue' | 'green' | 'purple' | 'orange' | 'gradient' | 'monochrome';
  animation: 'smooth' | 'bounce' | 'fade' | 'slide' | 'zoom';
  nodeStyle: 'rounded' | 'square' | 'circle' | 'hexagon' | 'diamond';
  edgeStyle: 'straight' | 'curved' | 'orthogonal' | 'bezier';
  fontSize: 'small' | 'medium' | 'large' | 'xl';
  spacing: 'compact' | 'normal' | 'spacious';
}

export interface EnhancedSceneGraph extends SceneGraph {
  visualStyle: VisualStyle;
  animations: AnimationSequence[];
  background: BackgroundConfig;
  watermark?: WatermarkConfig;
}

export interface AnimationSequence {
  type: 'entrance' | 'emphasis' | 'exit' | 'connection';
  target: string; // node or edge ID
  timing: {
    delay: number;
    duration: number;
    easing: string;
  };
  properties: Record<string, unknown>;
}

export interface BackgroundConfig {
  type: 'solid' | 'gradient' | 'pattern' | 'image';
  primary: string;
  secondary?: string;
  opacity: number;
  pattern?: 'grid' | 'dots' | 'lines' | 'waves';
}

export interface WatermarkConfig {
  text: string;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  opacity: number;
  fontSize: number;
}

export interface RenderOptions {
  width: number;
  height: number;
  fps: number;
  quality: 'draft' | 'standard' | 'high' | 'ultra';
  format: 'mp4' | 'webm' | 'gif';
  includeAudio: boolean;
  exportCaption: boolean;
}
