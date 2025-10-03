/**
 * 🎬 Advanced Scene Animator
 * Remotion統合による高品質動画アニメーション生成エンジン
 *
 * Features:
 * - Professional diagram animations with smooth transitions
 * - Dynamic scene composition with timing optimization
 * - Multi-layer animation system with depth and perspective
 * - Audio synchronization with visual elements
 * - Customizable animation styles and themes
 * - Real-time preview integration with Remotion
 */

import { AnalyzedScene, Entity, Relationship } from '../analysis/content-analyzer';

export interface AnimationConfig {
  fps: number;
  durationPerScene: number; // seconds
  transitionDuration: number; // seconds
  animationStyle: 'minimal' | 'professional' | 'dynamic' | 'cinematic';
  theme: 'light' | 'dark' | 'corporate' | 'academic';
  quality: 'draft' | 'preview' | 'production';
  autoSync: boolean;
  customBranding?: BrandingConfig;
}

export interface BrandingConfig {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  logoUrl?: string;
  watermark?: string;
}

export interface AnimatedScene {
  id: string;
  originalScene: AnalyzedScene;
  composition: RemotionComposition;
  timing: AnimationTiming;
  layers: AnimationLayer[];
  transitions: SceneTransition[];
  audio: AudioSync;
  metadata: AnimationMetadata;
}

export interface RemotionComposition {
  id: string;
  component: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  props: Record<string, any>;
  defaultCodec: string;
}

export interface AnimationTiming {
  startFrame: number;
  endFrame: number;
  duration: number; // seconds
  entryDelay: number;
  exitDelay: number;
  keyframes: Keyframe[];
}

export interface Keyframe {
  frame: number;
  properties: Record<string, any>;
  easing: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'bounce' | 'elastic';
}

export interface AnimationLayer {
  id: string;
  type: 'background' | 'diagram' | 'text' | 'entity' | 'relationship' | 'overlay';
  zIndex: number;
  visibility: VisibilityConfig;
  animation: LayerAnimation;
  styling: LayerStyling;
}

export interface VisibilityConfig {
  startFrame: number;
  endFrame: number;
  fadeIn: number; // duration in frames
  fadeOut: number; // duration in frames
  opacity: number; // 0-1
}

export interface LayerAnimation {
  entry: AnimationType;
  exit: AnimationType;
  during: AnimationType[];
  transforms: Transform[];
}

export interface Transform {
  type: 'translate' | 'scale' | 'rotate' | 'skew' | 'opacity';
  from: number | [number, number];
  to: number | [number, number];
  duration: number; // frames
  delay: number; // frames
  easing: string;
}

export interface LayerStyling {
  position: { x: number; y: number };
  size: { width: number; height: number };
  colors: {
    fill: string;
    stroke: string;
    text: string;
    background: string;
  };
  typography: {
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    lineHeight: number;
  };
  effects: Effect[];
}

export interface Effect {
  type: 'shadow' | 'glow' | 'blur' | 'gradient' | 'pattern';
  properties: Record<string, any>;
  intensity: number; // 0-1
}

export type AnimationType =
  | 'fade' | 'slide' | 'zoom' | 'bounce' | 'elastic'
  | 'spring' | 'rotate' | 'flip' | 'typewriter' | 'particle';

export interface SceneTransition {
  type: 'cut' | 'fade' | 'slide' | 'zoom' | 'wipe' | 'morph';
  duration: number; // frames
  direction?: 'left' | 'right' | 'up' | 'down' | 'in' | 'out';
  easing: string;
  overlay?: string; // Optional overlay color/pattern
}

export interface AudioSync {
  enabled: boolean;
  audioTrack?: string;
  syncPoints: SyncPoint[];
  waveformVisualization: boolean;
  speechHighlights: boolean;
}

export interface SyncPoint {
  frame: number;
  audioTime: number; // seconds
  event: 'word' | 'sentence' | 'pause' | 'emphasis';
  data: any;
}

export interface AnimationMetadata {
  totalFrames: number;
  renderTime: number; // estimated seconds
  complexity: 'low' | 'medium' | 'high';
  memoryUsage: number; // estimated MB
  quality: 'draft' | 'preview' | 'production';
  exportFormats: string[];
}

export interface AnimationResult {
  scenes: AnimatedScene[];
  totalDuration: number; // seconds
  totalFrames: number;
  composition: RemotionComposition;
  renderConfig: RenderConfig;
  preview: PreviewConfig;
  export: ExportConfig;
  performance: PerformanceMetrics;
}

export interface RenderConfig {
  codec: 'h264' | 'h265' | 'vp8' | 'vp9' | 'prores';
  quality: number; // 1-100
  bitrate: string;
  resolution: { width: number; height: number };
  frameRate: number;
  audioCodec: 'aac' | 'mp3' | 'wav';
}

export interface PreviewConfig {
  thumbnailCount: number;
  previewDuration: number; // seconds
  lowQualityPreview: boolean;
  realTimeGeneration: boolean;
}

export interface ExportConfig {
  formats: ('mp4' | 'webm' | 'gif' | 'mov')[];
  qualities: ('720p' | '1080p' | '4k')[];
  compressionLevels: ('low' | 'medium' | 'high')[];
  outputDirectory: string;
}

export interface PerformanceMetrics {
  preparationTime: number; // ms
  renderTime: number; // ms
  totalTime: number; // ms
  memoryPeak: number; // MB
  cpuUsage: number; // percentage
  efficiency: number; // frames per second
}

/**
 * Advanced Scene Animator with Remotion integration
 */
export class SceneAnimator {
  private config: AnimationConfig;
  private branding: BrandingConfig;
  private frameRate: number;
  private resolution: { width: number; height: number };

  constructor(config: Partial<AnimationConfig> = {}) {
    this.config = {
      fps: 30,
      durationPerScene: 6,
      transitionDuration: 1,
      animationStyle: 'professional',
      theme: 'light',
      quality: 'production',
      autoSync: true,
      ...config
    };

    this.branding = config.customBranding || this.getDefaultBranding();
    this.frameRate = this.config.fps;
    this.resolution = { width: 1920, height: 1080 };
  }

  /**
   * Generate animated scenes from analyzed content
   */
  async generateAnimations(scenes: AnalyzedScene[]): Promise<AnimationResult> {
    const startTime = performance.now();

    console.log(`🎬 Starting animation generation for ${scenes.length} scenes...`);
    console.log(`📐 Style: ${this.config.animationStyle}, Theme: ${this.config.theme}`);

    try {
      // Step 1: Prepare animation timing
      const sceneTimings = this.calculateSceneTimings(scenes);
      console.log(`⏱️ Calculated timing for ${sceneTimings.length} scenes`);

      // Step 2: Generate animated scenes
      const animatedScenes = await Promise.all(
        scenes.map((scene, index) =>
          this.animateScene(scene, sceneTimings[index], index)
        )
      );

      console.log(`✨ Generated ${animatedScenes.length} animated scenes`);

      // Step 3: Create master composition
      const masterComposition = await this.createMasterComposition(animatedScenes);

      // Step 4: Generate result
      const result = this.generateAnimationResult(
        animatedScenes,
        masterComposition,
        performance.now() - startTime
      );

      console.log(`🎯 Animation generation completed in ${result.performance.totalTime.toFixed(1)}ms`);
      console.log(`🎞️ Total duration: ${result.totalDuration.toFixed(1)}s (${result.totalFrames} frames)`);

      return result;

    } catch (error) {
      console.error('❌ Animation generation failed:', error);
      return this.generateFallbackResult(scenes, performance.now() - startTime);
    }
  }

  /**
   * Calculate optimal timing for all scenes
   */
  private calculateSceneTimings(scenes: AnalyzedScene[]): AnimationTiming[] {
    const timings: AnimationTiming[] = [];
    let currentFrame = 0;

    scenes.forEach((scene, index) => {
      // Calculate duration based on content complexity and configuration
      const baseDuration = this.config.durationPerScene;
      const complexityMultiplier = scene.complexity === 'complex' ? 1.5 :
                                  scene.complexity === 'moderate' ? 1.2 : 1.0;
      const entityMultiplier = 1 + (scene.entities.length * 0.1);

      const sceneDuration = Math.min(
        baseDuration * complexityMultiplier * entityMultiplier,
        15 // Max 15 seconds per scene
      );

      const durationInFrames = Math.round(sceneDuration * this.frameRate);
      const transitionFrames = Math.round(this.config.transitionDuration * this.frameRate);

      const timing: AnimationTiming = {
        startFrame: currentFrame,
        endFrame: currentFrame + durationInFrames,
        duration: sceneDuration,
        entryDelay: index === 0 ? 0 : transitionFrames / 2,
        exitDelay: transitionFrames / 2,
        keyframes: this.generateKeyframes(durationInFrames, scene)
      };

      timings.push(timing);
      currentFrame += durationInFrames;
    });

    return timings;
  }

  /**
   * Generate keyframes for scene animation
   */
  private generateKeyframes(durationInFrames: number, scene: AnalyzedScene): Keyframe[] {
    const keyframes: Keyframe[] = [];
    const entityCount = scene.entities.length;

    // Entry keyframes
    keyframes.push({
      frame: 0,
      properties: { opacity: 0, scale: 0.8 },
      easing: 'easeOut'
    });

    keyframes.push({
      frame: Math.round(this.frameRate * 0.5), // 0.5s
      properties: { opacity: 1, scale: 1 },
      easing: 'easeOut'
    });

    // Entity reveal keyframes
    if (entityCount > 0) {
      const entityRevealDuration = Math.min(durationInFrames * 0.6, entityCount * this.frameRate * 0.3);
      const framesPerEntity = entityRevealDuration / entityCount;

      for (let i = 0; i < entityCount; i++) {
        keyframes.push({
          frame: Math.round(this.frameRate * 1 + i * framesPerEntity),
          properties: {
            [`entity-${i}-opacity`]: 1,
            [`entity-${i}-scale`]: 1
          },
          easing: 'easeOut'
        });
      }
    }

    // Relationship animation keyframes
    if (scene.relationships.length > 0) {
      const relationshipStartFrame = Math.round(durationInFrames * 0.4);
      keyframes.push({
        frame: relationshipStartFrame,
        properties: { relationshipsVisible: true },
        easing: 'easeInOut'
      });
    }

    // Exit keyframes
    keyframes.push({
      frame: durationInFrames - Math.round(this.frameRate * 0.5),
      properties: { opacity: 1, scale: 1 },
      easing: 'easeIn'
    });

    keyframes.push({
      frame: durationInFrames,
      properties: { opacity: 0, scale: 0.9 },
      easing: 'easeIn'
    });

    return keyframes;
  }

  /**
   * Animate a single scene with advanced features
   */
  private async animateScene(
    scene: AnalyzedScene,
    timing: AnimationTiming,
    index: number
  ): Promise<AnimatedScene> {
    console.log(`🎭 Animating scene ${index + 1}: ${scene.title}`);

    // Create layers for the scene
    const layers = await this.createSceneLayers(scene, timing);

    // Generate transitions
    const transitions = this.createSceneTransitions(scene, index);

    // Setup audio sync
    const audioSync = this.config.autoSync ?
      this.createAudioSync(scene, timing) :
      { enabled: false, syncPoints: [], waveformVisualization: false, speechHighlights: false };

    // Create Remotion composition
    const composition = this.createRemotionComposition(scene, timing, layers);

    // Calculate metadata
    const metadata = this.calculateAnimationMetadata(scene, timing, layers);

    return {
      id: `animated-${scene.id}`,
      originalScene: scene,
      composition,
      timing,
      layers,
      transitions,
      audio: audioSync,
      metadata
    };
  }

  /**
   * Create animation layers for a scene
   */
  private async createSceneLayers(scene: AnalyzedScene, timing: AnimationTiming): Promise<AnimationLayer[]> {
    const layers: AnimationLayer[] = [];

    // Background layer
    layers.push(this.createBackgroundLayer(timing));

    // Title layer
    layers.push(this.createTitleLayer(scene, timing));

    // Diagram base layer
    layers.push(this.createDiagramLayer(scene, timing));

    // Entity layers
    scene.entities.forEach((entity, index) => {
      layers.push(this.createEntityLayer(entity, index, scene, timing));
    });

    // Relationship layers
    scene.relationships.forEach((relationship, index) => {
      layers.push(this.createRelationshipLayer(relationship, index, scene, timing));
    });

    // Overlay layer (for branding/watermark)
    if (this.branding.watermark) {
      layers.push(this.createOverlayLayer(timing));
    }

    return layers.sort((a, b) => a.zIndex - b.zIndex);
  }

  /**
   * Create background layer
   */
  private createBackgroundLayer(timing: AnimationTiming): AnimationLayer {
    const bgColor = this.config.theme === 'dark' ? '#1a1a1a' : '#ffffff';
    const gradientColor = this.config.theme === 'dark' ? '#2d2d2d' : '#f8f9fa';

    return {
      id: 'background',
      type: 'background',
      zIndex: 0,
      visibility: {
        startFrame: timing.startFrame,
        endFrame: timing.endFrame,
        fadeIn: 0,
        fadeOut: 0,
        opacity: 1
      },
      animation: {
        entry: 'fade',
        exit: 'fade',
        during: [],
        transforms: []
      },
      styling: {
        position: { x: 0, y: 0 },
        size: { width: this.resolution.width, height: this.resolution.height },
        colors: {
          fill: bgColor,
          stroke: 'transparent',
          text: this.config.theme === 'dark' ? '#ffffff' : '#333333',
          background: `linear-gradient(135deg, ${bgColor} 0%, ${gradientColor} 100%)`
        },
        typography: {
          fontFamily: this.branding.fontFamily,
          fontSize: 16,
          fontWeight: 400,
          lineHeight: 1.5
        },
        effects: []
      }
    };
  }

  /**
   * Create title layer
   */
  private createTitleLayer(scene: AnalyzedScene, timing: AnimationTiming): AnimationLayer {
    return {
      id: 'title',
      type: 'text',
      zIndex: 10,
      visibility: {
        startFrame: timing.startFrame + timing.entryDelay,
        endFrame: timing.startFrame + Math.round(this.frameRate * 2), // Show for 2 seconds
        fadeIn: Math.round(this.frameRate * 0.3),
        fadeOut: Math.round(this.frameRate * 0.3),
        opacity: 1
      },
      animation: {
        entry: 'slide',
        exit: 'fade',
        during: [],
        transforms: [
          {
            type: 'translate',
            from: [0, -50],
            to: [0, 0],
            duration: Math.round(this.frameRate * 0.5),
            delay: 0,
            easing: 'easeOut'
          }
        ]
      },
      styling: {
        position: { x: 80, y: 80 },
        size: { width: this.resolution.width - 160, height: 120 },
        colors: {
          fill: 'transparent',
          stroke: 'transparent',
          text: this.branding.primaryColor,
          background: 'transparent'
        },
        typography: {
          fontFamily: this.branding.fontFamily,
          fontSize: 48,
          fontWeight: 700,
          lineHeight: 1.2
        },
        effects: [
          {
            type: 'shadow',
            properties: {
              offsetX: 2,
              offsetY: 2,
              blur: 4,
              color: 'rgba(0,0,0,0.2)'
            },
            intensity: 0.8
          }
        ]
      }
    };
  }

  /**
   * Create diagram layer
   */
  private createDiagramLayer(scene: AnalyzedScene, timing: AnimationTiming): AnimationLayer {
    return {
      id: 'diagram',
      type: 'diagram',
      zIndex: 5,
      visibility: {
        startFrame: timing.startFrame + Math.round(this.frameRate * 0.5),
        endFrame: timing.endFrame - timing.exitDelay,
        fadeIn: Math.round(this.frameRate * 0.5),
        fadeOut: Math.round(this.frameRate * 0.3),
        opacity: 1
      },
      animation: {
        entry: 'zoom',
        exit: 'fade',
        during: ['pulse'],
        transforms: [
          {
            type: 'scale',
            from: 0.3,
            to: 1,
            duration: Math.round(this.frameRate * 0.8),
            delay: 0,
            easing: 'easeOut'
          }
        ]
      },
      styling: {
        position: { x: 200, y: 200 },
        size: { width: this.resolution.width - 400, height: this.resolution.height - 400 },
        colors: {
          fill: this.branding.secondaryColor,
          stroke: this.branding.primaryColor,
          text: this.config.theme === 'dark' ? '#ffffff' : '#333333',
          background: 'transparent'
        },
        typography: {
          fontFamily: this.branding.fontFamily,
          fontSize: 18,
          fontWeight: 500,
          lineHeight: 1.4
        },
        effects: [
          {
            type: 'glow',
            properties: {
              color: this.branding.accentColor,
              blur: 8
            },
            intensity: 0.3
          }
        ]
      }
    };
  }

  /**
   * Create entity layer
   */
  private createEntityLayer(
    entity: Entity,
    index: number,
    scene: AnalyzedScene,
    timing: AnimationTiming
  ): AnimationLayer {
    const delayPerEntity = Math.round(this.frameRate * 0.2);
    const entityDelay = index * delayPerEntity;

    return {
      id: `entity-${entity.id}`,
      type: 'entity',
      zIndex: 20 + index,
      visibility: {
        startFrame: timing.startFrame + Math.round(this.frameRate * 1) + entityDelay,
        endFrame: timing.endFrame - timing.exitDelay,
        fadeIn: Math.round(this.frameRate * 0.3),
        fadeOut: Math.round(this.frameRate * 0.2),
        opacity: entity.importance
      },
      animation: {
        entry: 'bounce',
        exit: 'fade',
        during: this.getEntityAnimations(entity),
        transforms: [
          {
            type: 'scale',
            from: 0,
            to: entity.importance,
            duration: Math.round(this.frameRate * 0.4),
            delay: entityDelay,
            easing: 'bounce'
          }
        ]
      },
      styling: this.getEntityStyling(entity, index)
    };
  }

  /**
   * Create relationship layer
   */
  private createRelationshipLayer(
    relationship: Relationship,
    index: number,
    scene: AnalyzedScene,
    timing: AnimationTiming
  ): AnimationLayer {
    const relationshipDelay = Math.round(this.frameRate * 2) + index * Math.round(this.frameRate * 0.3);

    return {
      id: `relationship-${relationship.id}`,
      type: 'relationship',
      zIndex: 15 + index,
      visibility: {
        startFrame: timing.startFrame + relationshipDelay,
        endFrame: timing.endFrame - timing.exitDelay,
        fadeIn: Math.round(this.frameRate * 0.4),
        fadeOut: Math.round(this.frameRate * 0.2),
        opacity: relationship.strength
      },
      animation: {
        entry: 'slide',
        exit: 'fade',
        during: ['pulse'],
        transforms: [
          {
            type: 'opacity',
            from: 0,
            to: relationship.strength,
            duration: Math.round(this.frameRate * 0.6),
            delay: 0,
            easing: 'easeInOut'
          }
        ]
      },
      styling: this.getRelationshipStyling(relationship, index)
    };
  }

  /**
   * Create overlay layer for branding
   */
  private createOverlayLayer(timing: AnimationTiming): AnimationLayer {
    return {
      id: 'overlay',
      type: 'overlay',
      zIndex: 100,
      visibility: {
        startFrame: timing.startFrame,
        endFrame: timing.endFrame,
        fadeIn: 0,
        fadeOut: 0,
        opacity: 0.7
      },
      animation: {
        entry: 'fade',
        exit: 'fade',
        during: [],
        transforms: []
      },
      styling: {
        position: { x: this.resolution.width - 250, y: this.resolution.height - 80 },
        size: { width: 200, height: 50 },
        colors: {
          fill: 'transparent',
          stroke: 'transparent',
          text: this.branding.primaryColor,
          background: 'transparent'
        },
        typography: {
          fontFamily: this.branding.fontFamily,
          fontSize: 14,
          fontWeight: 400,
          lineHeight: 1.4
        },
        effects: []
      }
    };
  }

  /**
   * Get entity-specific animations
   */
  private getEntityAnimations(entity: Entity): AnimationType[] {
    switch (entity.type) {
      case 'person':
        return ['bounce'];
      case 'system':
        return ['pulse'];
      case 'process':
        return ['slide'];
      case 'data':
        return ['fade'];
      case 'event':
        return ['zoom'];
      default:
        return ['elastic'];
    }
  }

  /**
   * Get entity-specific styling
   */
  private getEntityStyling(entity: Entity, index: number): LayerStyling {
    const baseSize = 80 + entity.importance * 40;
    const colors = this.getEntityColors(entity.type);

    return {
      position: this.calculateEntityPosition(index, entity.importance),
      size: { width: baseSize, height: baseSize },
      colors,
      typography: {
        fontFamily: this.branding.fontFamily,
        fontSize: 14 + entity.importance * 6,
        fontWeight: entity.importance > 0.7 ? 600 : 400,
        lineHeight: 1.3
      },
      effects: [
        {
          type: 'shadow',
          properties: {
            offsetX: 2,
            offsetY: 2,
            blur: 6,
            color: 'rgba(0,0,0,0.15)'
          },
          intensity: entity.importance
        }
      ]
    };
  }

  /**
   * Get relationship-specific styling
   */
  private getRelationshipStyling(relationship: Relationship, index: number): LayerStyling {
    const colors = this.getRelationshipColors(relationship.type);

    return {
      position: { x: 0, y: 0 }, // Will be calculated based on connected entities
      size: { width: 2 + relationship.strength * 3, height: 2 },
      colors,
      typography: {
        fontFamily: this.branding.fontFamily,
        fontSize: 12,
        fontWeight: 400,
        lineHeight: 1.2
      },
      effects: [
        {
          type: 'glow',
          properties: {
            color: colors.stroke,
            blur: 4
          },
          intensity: relationship.strength * 0.5
        }
      ]
    };
  }

  /**
   * Calculate entity position based on layout
   */
  private calculateEntityPosition(index: number, importance: number): { x: number; y: number } {
    const centerX = this.resolution.width / 2;
    const centerY = this.resolution.height / 2;
    const radius = 200 + importance * 100;
    const angle = (index * 2 * Math.PI) / 8; // Distribute around circle

    return {
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius
    };
  }

  /**
   * Get colors for entity type
   */
  private getEntityColors(entityType: Entity['type']): LayerStyling['colors'] {
    const colorMap = {
      person: { fill: '#3b82f6', stroke: '#1d4ed8', text: '#ffffff', background: '#eff6ff' },
      system: { fill: '#10b981', stroke: '#047857', text: '#ffffff', background: '#ecfdf5' },
      process: { fill: '#f59e0b', stroke: '#d97706', text: '#ffffff', background: '#fffbeb' },
      data: { fill: '#8b5cf6', stroke: '#7c3aed', text: '#ffffff', background: '#f3f4f6' },
      event: { fill: '#ef4444', stroke: '#dc2626', text: '#ffffff', background: '#fef2f2' },
      concept: { fill: '#6b7280', stroke: '#4b5563', text: '#ffffff', background: '#f9fafb' }
    };

    return colorMap[entityType] || colorMap.concept;
  }

  /**
   * Get colors for relationship type
   */
  private getRelationshipColors(relationshipType: Relationship['type']): LayerStyling['colors'] {
    const colorMap = {
      flows_to: { fill: 'transparent', stroke: '#3b82f6', text: '#1d4ed8', background: 'transparent' },
      contains: { fill: 'transparent', stroke: '#10b981', text: '#047857', background: 'transparent' },
      depends_on: { fill: 'transparent', stroke: '#f59e0b', text: '#d97706', background: 'transparent' },
      triggers: { fill: 'transparent', stroke: '#ef4444', text: '#dc2626', background: 'transparent' },
      relates_to: { fill: 'transparent', stroke: '#6b7280', text: '#4b5563', background: 'transparent' }
    };

    return colorMap[relationshipType] || colorMap.relates_to;
  }

  /**
   * Create scene transitions
   */
  private createSceneTransitions(scene: AnalyzedScene, index: number): SceneTransition[] {
    const transitions: SceneTransition[] = [];

    // Entry transition
    if (index > 0) {
      transitions.push({
        type: this.getTransitionType(scene.diagramType),
        duration: Math.round(this.config.transitionDuration * this.frameRate),
        direction: 'in',
        easing: 'easeInOut'
      });
    }

    // Exit transition
    transitions.push({
      type: 'fade',
      duration: Math.round(this.config.transitionDuration * this.frameRate * 0.5),
      direction: 'out',
      easing: 'easeIn'
    });

    return transitions;
  }

  /**
   * Get transition type based on diagram type
   */
  private getTransitionType(diagramType: string): SceneTransition['type'] {
    const transitionMap = {
      flow: 'slide',
      timeline: 'wipe',
      tree: 'zoom',
      cycle: 'morph',
      matrix: 'fade',
      network: 'zoom'
    };

    return transitionMap[diagramType as keyof typeof transitionMap] || 'fade';
  }

  /**
   * Create audio synchronization
   */
  private createAudioSync(scene: AnalyzedScene, timing: AnimationTiming): AudioSync {
    const syncPoints: SyncPoint[] = [];
    const words = scene.content.split(/\s+/);
    const wordsPerSecond = words.length / scene.duration;

    // Create sync points for major words
    words.forEach((word, index) => {
      if (word.length > 4 || scene.keywords.includes(word.toLowerCase())) {
        const timeOffset = index / wordsPerSecond;
        const frame = timing.startFrame + Math.round(timeOffset * this.frameRate);

        syncPoints.push({
          frame,
          audioTime: scene.startTime + timeOffset,
          event: 'word',
          data: { word, emphasis: scene.keywords.includes(word.toLowerCase()) }
        });
      }
    });

    return {
      enabled: true,
      syncPoints,
      waveformVisualization: this.config.animationStyle === 'dynamic',
      speechHighlights: true
    };
  }

  /**
   * Create Remotion composition
   */
  private createRemotionComposition(
    scene: AnalyzedScene,
    timing: AnimationTiming,
    layers: AnimationLayer[]
  ): RemotionComposition {
    return {
      id: `composition-${scene.id}`,
      component: 'DiagramScene',
      width: this.resolution.width,
      height: this.resolution.height,
      fps: this.frameRate,
      durationInFrames: timing.endFrame - timing.startFrame,
      props: {
        scene,
        timing,
        layers,
        config: this.config,
        branding: this.branding
      },
      defaultCodec: 'h264'
    };
  }

  /**
   * Calculate animation metadata
   */
  private calculateAnimationMetadata(
    scene: AnalyzedScene,
    timing: AnimationTiming,
    layers: AnimationLayer[]
  ): AnimationMetadata {
    const frameCount = timing.endFrame - timing.startFrame;
    const complexity = this.assessAnimationComplexity(scene, layers);
    const estimatedRenderTime = this.estimateRenderTime(frameCount, complexity);
    const estimatedMemoryUsage = this.estimateMemoryUsage(layers, frameCount);

    return {
      totalFrames: frameCount,
      renderTime: estimatedRenderTime,
      complexity,
      memoryUsage: estimatedMemoryUsage,
      quality: this.config.quality,
      exportFormats: ['mp4', 'webm']
    };
  }

  /**
   * Assess animation complexity
   */
  private assessAnimationComplexity(scene: AnalyzedScene, layers: AnimationLayer[]): 'low' | 'medium' | 'high' {
    const layerCount = layers.length;
    const effectCount = layers.reduce((sum, layer) => sum + layer.styling.effects.length, 0);
    const transformCount = layers.reduce((sum, layer) => sum + layer.animation.transforms.length, 0);

    const complexityScore = layerCount + effectCount * 2 + transformCount;

    if (complexityScore < 10) return 'low';
    if (complexityScore < 25) return 'medium';
    return 'high';
  }

  /**
   * Estimate render time
   */
  private estimateRenderTime(frameCount: number, complexity: 'low' | 'medium' | 'high'): number {
    const baseTimePerFrame = {
      low: 0.1,
      medium: 0.25,
      high: 0.5
    };

    return frameCount * baseTimePerFrame[complexity];
  }

  /**
   * Estimate memory usage
   */
  private estimateMemoryUsage(layers: AnimationLayer[], frameCount: number): number {
    const baseMB = 50; // Base composition memory
    const layerMB = layers.length * 5; // 5MB per layer
    const frameMB = frameCount * 0.1; // 0.1MB per frame

    return baseMB + layerMB + frameMB;
  }

  /**
   * Create master composition for all scenes
   */
  private async createMasterComposition(scenes: AnimatedScene[]): Promise<RemotionComposition> {
    const totalFrames = scenes.reduce((sum, scene) => sum + scene.timing.endFrame - scene.timing.startFrame, 0);

    return {
      id: 'master-composition',
      component: 'MasterComposition',
      width: this.resolution.width,
      height: this.resolution.height,
      fps: this.frameRate,
      durationInFrames: totalFrames,
      props: {
        scenes,
        config: this.config,
        branding: this.branding
      },
      defaultCodec: 'h264'
    };
  }

  /**
   * Generate final animation result
   */
  private generateAnimationResult(
    scenes: AnimatedScene[],
    masterComposition: RemotionComposition,
    processingTime: number
  ): AnimationResult {
    const totalDuration = scenes.reduce((sum, scene) => sum + scene.timing.duration, 0);
    const totalFrames = masterComposition.durationInFrames;

    const performance: PerformanceMetrics = {
      preparationTime: processingTime,
      renderTime: scenes.reduce((sum, scene) => sum + scene.metadata.renderTime, 0) * 1000,
      totalTime: processingTime,
      memoryPeak: Math.max(...scenes.map(s => s.metadata.memoryUsage)),
      cpuUsage: 75, // Estimated
      efficiency: totalFrames / (processingTime / 1000)
    };

    return {
      scenes,
      totalDuration,
      totalFrames,
      composition: masterComposition,
      renderConfig: {
        codec: 'h264',
        quality: this.config.quality === 'production' ? 95 :
                this.config.quality === 'preview' ? 75 : 50,
        bitrate: '5M',
        resolution: this.resolution,
        frameRate: this.frameRate,
        audioCodec: 'aac'
      },
      preview: {
        thumbnailCount: scenes.length,
        previewDuration: Math.min(totalDuration, 30),
        lowQualityPreview: true,
        realTimeGeneration: false
      },
      export: {
        formats: ['mp4', 'webm'],
        qualities: ['1080p'],
        compressionLevels: ['medium'],
        outputDirectory: './output'
      },
      performance
    };
  }

  /**
   * Generate fallback result when animation fails
   */
  private generateFallbackResult(scenes: AnalyzedScene[], processingTime: number): AnimationResult {
    console.log('🔄 Generating fallback animation result...');

    const fallbackScene: AnimatedScene = {
      id: 'fallback-animated-scene',
      originalScene: scenes[0] || {
        id: 'fallback',
        startTime: 0,
        endTime: 10,
        duration: 10,
        title: 'Fallback Scene',
        content: 'Basic animated content',
        diagramType: 'flow',
        confidence: 0.5,
        entities: [],
        relationships: [],
        complexity: 'low',
        keywords: [],
        summary: 'Fallback animation'
      },
      composition: {
        id: 'fallback-composition',
        component: 'FallbackScene',
        width: this.resolution.width,
        height: this.resolution.height,
        fps: this.frameRate,
        durationInFrames: this.frameRate * 10,
        props: {},
        defaultCodec: 'h264'
      },
      timing: {
        startFrame: 0,
        endFrame: this.frameRate * 10,
        duration: 10,
        entryDelay: 0,
        exitDelay: 0,
        keyframes: []
      },
      layers: [],
      transitions: [],
      audio: { enabled: false, syncPoints: [], waveformVisualization: false, speechHighlights: false },
      metadata: {
        totalFrames: this.frameRate * 10,
        renderTime: 5,
        complexity: 'low',
        memoryUsage: 50,
        quality: 'draft',
        exportFormats: ['mp4']
      }
    };

    return {
      scenes: [fallbackScene],
      totalDuration: 10,
      totalFrames: this.frameRate * 10,
      composition: fallbackScene.composition,
      renderConfig: {
        codec: 'h264',
        quality: 50,
        bitrate: '2M',
        resolution: this.resolution,
        frameRate: this.frameRate,
        audioCodec: 'aac'
      },
      preview: {
        thumbnailCount: 1,
        previewDuration: 10,
        lowQualityPreview: true,
        realTimeGeneration: true
      },
      export: {
        formats: ['mp4'],
        qualities: ['1080p'],
        compressionLevels: ['low'],
        outputDirectory: './output'
      },
      performance: {
        preparationTime: processingTime,
        renderTime: 5000,
        totalTime: processingTime,
        memoryPeak: 50,
        cpuUsage: 30,
        efficiency: (this.frameRate * 10) / (processingTime / 1000)
      }
    };
  }

  /**
   * Get default branding configuration
   */
  private getDefaultBranding(): BrandingConfig {
    return {
      primaryColor: '#3b82f6',
      secondaryColor: '#e5e7eb',
      accentColor: '#10b981',
      fontFamily: 'Inter, system-ui, sans-serif',
      watermark: 'Generated with AutoDiagram'
    };
  }
}