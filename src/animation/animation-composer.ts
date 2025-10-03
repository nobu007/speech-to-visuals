/**
 * Animation Composer - Core animation component per custom instructions
 *
 * Handles the animation composition for diagram scenes
 * Following the modular architecture specified in custom instructions
 */

import { SceneGraph, DiagramNode, DiagramEdge } from '@/types/diagram';

export interface AnimationConfig {
  fps: number;
  duration: number;
  transitions: {
    nodeAppear: number;
    edgeAppear: number;
    sceneTransition: number;
  };
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

export interface AnimationSequence {
  id: string;
  startFrame: number;
  endFrame: number;
  type: 'node_appear' | 'edge_appear' | 'scene_transition' | 'highlight';
  target: string;
  properties: Record<string, any>;
}

export interface CompositionResult {
  sequences: AnimationSequence[];
  totalFrames: number;
  duration: number;
  fps: number;
  metadata: {
    sceneCount: number;
    nodeCount: number;
    edgeCount: number;
  };
}

/**
 * Animation Composer Class
 *
 * Implements animation composition requirements from custom instructions:
 * - Professional animated diagrams
 * - Smooth transitions between scenes
 * - Synchronized with audio narration
 */
export class AnimationComposer {
  private config: AnimationConfig;

  constructor(config: Partial<AnimationConfig> = {}) {
    this.config = {
      fps: 30,
      duration: 18, // Default 18 seconds per custom instructions
      transitions: {
        nodeAppear: 500, // 500ms for node appearance
        edgeAppear: 300, // 300ms for edge appearance
        sceneTransition: 800 // 800ms for scene transitions
      },
      easing: 'ease-out',
      ...config
    };
  }

  /**
   * Compose animation sequences for multiple scenes
   * Main entry point following custom instructions architecture
   */
  async composeScenes(scenes: SceneGraph[]): Promise<CompositionResult> {
    console.log(`🎬 Composing animation for ${scenes.length} scenes`);

    const totalFrames = this.config.duration * this.config.fps;
    const framesPerScene = Math.floor(totalFrames / scenes.length);

    const sequences: AnimationSequence[] = [];
    let currentFrame = 0;

    // Calculate metadata
    const metadata = {
      sceneCount: scenes.length,
      nodeCount: scenes.reduce((sum, scene) => sum + scene.nodes.length, 0),
      edgeCount: scenes.reduce((sum, scene) => sum + scene.edges.length, 0)
    };

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const sceneStartFrame = currentFrame;
      const sceneEndFrame = Math.min(currentFrame + framesPerScene, totalFrames);

      console.log(`  Scene ${i + 1}: frames ${sceneStartFrame}-${sceneEndFrame}`);

      // Add scene transition (except for first scene)
      if (i > 0) {
        sequences.push(this.createSceneTransition(
          scenes[i - 1],
          scene,
          sceneStartFrame,
          sceneStartFrame + this.framesToMs(this.config.transitions.sceneTransition)
        ));
      }

      // Compose individual scene animation
      const sceneSequences = await this.composeScene(
        scene,
        sceneStartFrame + (i > 0 ? this.framesToMs(this.config.transitions.sceneTransition) : 0),
        sceneEndFrame
      );

      sequences.push(...sceneSequences);
      currentFrame = sceneEndFrame;
    }

    const result: CompositionResult = {
      sequences,
      totalFrames,
      duration: this.config.duration,
      fps: this.config.fps,
      metadata
    };

    console.log(`✅ Animation composition complete: ${sequences.length} sequences`);
    return result;
  }

  /**
   * Compose animation for a single scene
   */
  private async composeScene(
    scene: SceneGraph,
    startFrame: number,
    endFrame: number
  ): Promise<AnimationSequence[]> {

    const sequences: AnimationSequence[] = [];
    const availableFrames = endFrame - startFrame;
    const nodeAppearDuration = this.framesToMs(this.config.transitions.nodeAppear);
    const edgeAppearDuration = this.framesToMs(this.config.transitions.edgeAppear);

    let currentFrame = startFrame;

    // 1. Animate nodes appearing
    const nodeSequences = this.createNodeAnimations(
      scene.nodes,
      currentFrame,
      nodeAppearDuration
    );
    sequences.push(...nodeSequences);
    currentFrame += Math.max(nodeAppearDuration, nodeSequences.length * 5); // Stagger nodes

    // 2. Animate edges appearing
    const edgeSequences = this.createEdgeAnimations(
      scene.edges,
      currentFrame,
      edgeAppearDuration
    );
    sequences.push(...edgeSequences);
    currentFrame += Math.max(edgeAppearDuration, edgeSequences.length * 3); // Stagger edges

    // 3. Add highlights for important elements
    const highlightSequences = this.createHighlightAnimations(
      scene,
      currentFrame,
      endFrame - currentFrame
    );
    sequences.push(...highlightSequences);

    return sequences;
  }

  /**
   * Create node appearance animations
   */
  private createNodeAnimations(
    nodes: DiagramNode[],
    startFrame: number,
    duration: number
  ): AnimationSequence[] {

    return nodes.map((node, index) => ({
      id: `node_appear_${node.id}`,
      startFrame: startFrame + index * 5, // Stagger by 5 frames
      endFrame: startFrame + index * 5 + duration,
      type: 'node_appear',
      target: node.id,
      properties: {
        opacity: { from: 0, to: 1 },
        scale: { from: 0.3, to: 1 },
        easing: this.config.easing
      }
    }));
  }

  /**
   * Create edge appearance animations
   */
  private createEdgeAnimations(
    edges: DiagramEdge[],
    startFrame: number,
    duration: number
  ): AnimationSequence[] {

    return edges.map((edge, index) => ({
      id: `edge_appear_${edge.id}`,
      startFrame: startFrame + index * 3, // Stagger by 3 frames
      endFrame: startFrame + index * 3 + duration,
      type: 'edge_appear',
      target: edge.id,
      properties: {
        opacity: { from: 0, to: 0.8 },
        strokeDasharray: { from: '10,10', to: 'none' }, // Animated stroke
        easing: this.config.easing
      }
    }));
  }

  /**
   * Create highlight animations for important elements
   */
  private createHighlightAnimations(
    scene: SceneGraph,
    startFrame: number,
    duration: number
  ): AnimationSequence[] {

    const sequences: AnimationSequence[] = [];

    // Highlight key nodes (those with high importance or centrality)
    const keyNodes = scene.nodes.filter(node =>
      node.importance && node.importance > 0.7
    );

    keyNodes.forEach((node, index) => {
      const highlightStart = startFrame + index * 30; // Spread highlights
      const highlightDuration = Math.min(60, duration / keyNodes.length);

      sequences.push({
        id: `highlight_${node.id}`,
        startFrame: highlightStart,
        endFrame: highlightStart + highlightDuration,
        type: 'highlight',
        target: node.id,
        properties: {
          glow: { from: 0, to: 8, to_final: 0 }, // Glow effect
          borderColor: { from: '#333', to: '#FFD700', to_final: '#333' }, // Gold highlight
          easing: 'ease-in-out'
        }
      });
    });

    return sequences;
  }

  /**
   * Create scene transition animation
   */
  private createSceneTransition(
    fromScene: SceneGraph,
    toScene: SceneGraph,
    startFrame: number,
    endFrame: number
  ): AnimationSequence {

    return {
      id: `scene_transition_${fromScene.id}_to_${toScene.id}`,
      startFrame,
      endFrame,
      type: 'scene_transition',
      target: 'canvas',
      properties: {
        opacity: { from: 1, to: 0, to_final: 1 },
        scale: { from: 1, to: 0.9, to_final: 1 },
        blur: { from: 0, to: 2, to_final: 0 },
        easing: this.config.easing
      }
    };
  }

  /**
   * Convert milliseconds to frames
   */
  private framesToMs(ms: number): number {
    return Math.round((ms / 1000) * this.config.fps);
  }

  /**
   * Convert frames to milliseconds
   */
  private msToFrames(frames: number): number {
    return (frames / this.config.fps) * 1000;
  }

  /**
   * Generate Remotion-compatible animation data
   */
  async generateRemotionSequences(composition: CompositionResult): Promise<any[]> {
    console.log('🎭 Generating Remotion-compatible sequences...');

    const remotionSequences = composition.sequences.map(sequence => ({
      id: sequence.id,
      from: sequence.startFrame,
      durationInFrames: sequence.endFrame - sequence.startFrame,
      type: sequence.type,
      target: sequence.target,
      style: this.convertPropertiesToRemotionStyle(sequence.properties),
      layout: sequence.type.includes('node') ? 'absolute' : undefined
    }));

    return remotionSequences;
  }

  /**
   * Convert animation properties to Remotion-compatible styles
   */
  private convertPropertiesToRemotionStyle(properties: Record<string, any>): Record<string, string> {
    const style: Record<string, string> = {};

    Object.entries(properties).forEach(([key, value]) => {
      switch (key) {
        case 'opacity':
          style.opacity = typeof value === 'object' ? value.to.toString() : value.toString();
          break;
        case 'scale':
          const scaleValue = typeof value === 'object' ? value.to : value;
          style.transform = `scale(${scaleValue})`;
          break;
        case 'glow':
          const glowValue = typeof value === 'object' ? value.to : value;
          style.filter = `drop-shadow(0 0 ${glowValue}px rgba(255, 215, 0, 0.8))`;
          break;
        case 'borderColor':
          style.borderColor = typeof value === 'object' ? value.to : value;
          break;
        case 'blur':
          const blurValue = typeof value === 'object' ? value.to : value;
          style.filter = (style.filter || '') + ` blur(${blurValue}px)`;
          break;
      }
    });

    return style;
  }

  /**
   * Create animation timeline for debugging/preview
   */
  generateTimeline(composition: CompositionResult): {
    frame: number;
    time: string;
    activeSequences: string[];
  }[] {

    const timeline = [];
    const totalFrames = composition.totalFrames;

    for (let frame = 0; frame < totalFrames; frame += 5) { // Sample every 5 frames
      const time = `${(frame / this.config.fps).toFixed(2)}s`;
      const activeSequences = composition.sequences
        .filter(seq => frame >= seq.startFrame && frame <= seq.endFrame)
        .map(seq => seq.id);

      timeline.push({ frame, time, activeSequences });
    }

    return timeline;
  }

  /**
   * Update animation configuration
   */
  updateConfig(updates: Partial<AnimationConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get current configuration
   */
  getConfig(): AnimationConfig {
    return { ...this.config };
  }

  /**
   * Validate animation sequences for potential issues
   */
  validateComposition(composition: CompositionResult): {
    valid: boolean;
    warnings: string[];
    errors: string[];
  } {

    const warnings: string[] = [];
    const errors: string[] = [];

    // Check for overlapping sequences of same type on same target
    const targetSequences = new Map<string, AnimationSequence[]>();

    composition.sequences.forEach(seq => {
      const key = `${seq.target}_${seq.type}`;
      if (!targetSequences.has(key)) {
        targetSequences.set(key, []);
      }
      targetSequences.get(key)!.push(seq);
    });

    targetSequences.forEach((sequences, key) => {
      if (sequences.length > 1) {
        // Check for overlaps
        for (let i = 0; i < sequences.length - 1; i++) {
          const seq1 = sequences[i];
          const seq2 = sequences[i + 1];

          if (seq1.endFrame > seq2.startFrame) {
            warnings.push(`Overlapping sequences detected for ${key}: ${seq1.id} and ${seq2.id}`);
          }
        }
      }
    });

    // Check frame bounds
    composition.sequences.forEach(seq => {
      if (seq.startFrame < 0) {
        errors.push(`Sequence ${seq.id} starts before frame 0`);
      }
      if (seq.endFrame > composition.totalFrames) {
        errors.push(`Sequence ${seq.id} extends beyond total frames`);
      }
    });

    return {
      valid: errors.length === 0,
      warnings,
      errors
    };
  }
}

// Export default instance
export const animationComposer = new AnimationComposer();