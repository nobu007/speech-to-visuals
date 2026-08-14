/**
 * Diagram Scene Component
 * Renders diagram scenes with type-specific animation strategies
 * Supports 5 diagram types: flow, tree, timeline, matrix, cycle
 */

import React from 'react';
import { AbsoluteFill, useVideoConfig, interpolate } from 'remotion';
import { SceneGraph } from '@/types/diagram';
import { getAnimationStrategy } from './animation-strategies';
import { NodeAnimation } from './NodeAnimation';
import { EdgeAnimation } from './EdgeAnimation';
import { calculatePathLength } from './EdgeAnimation';

interface DiagramSceneProps {
  scene: SceneGraph;
  sceneIndex: number;
  /**
   * Time elapsed within THIS scene, in milliseconds. Drives all scene-local
   * animations (title fade-in, node/edge entrance). Callers must pass the
   * scene-relative time — Video.findSceneAtTime().timeInScene — NOT the global
   * playback time and NOT scene.startMs. scene.startMs is the scene's ABSOLUTE
   * audio timestamp; playback instead concatenates scenes at cumulative
   * durationMs offsets, so the two diverge whenever a scene's duration is
   * clamped (video-generator's convertSceneToRemotionFormat clamps to
   * [3000, 10000] ms) or segments are
   * non-contiguous. Deriving the offset from startMs previously made every
   * scene after the first begin its intro animations already-completed.
   */
  currentTime: number;
}

/** Map diagram types to Japanese titles */
const DIAGRAM_TITLES: Record<SceneGraph['type'], string> = {
  flow: 'プロセスフロー',
  flowchart: 'フローチャート',
  tree: '階層構造',
  timeline: 'タイムライン',
  matrix: '比較表',
  cycle: '循環プロセス',
  comparison: '比較',
  network: 'ネットワーク',
  conceptmap: 'コンセプトマップ',
  mindmap: 'マインドマップ',
  general: '一般',
};

export const DiagramScene: React.FC<DiagramSceneProps> = ({ scene, sceneIndex, currentTime }) => {
  const { fps } = useVideoConfig();

  // Scene-local frame: frames elapsed since THIS scene began playing.
  // Playback concatenates scenes by cumulative durationMs (see findSceneAtTime),
  // so the local frame must come from the scene-relative `currentTime`, never
  // from the absolute audio startMs.
  const safeCurrentTime = Number.isFinite(currentTime) ? currentTime : 0;
  const frameInScene = (safeCurrentTime * Math.max(fps, 1)) / 1000;

  // Get animation strategy for this diagram type
  const strategy = getAnimationStrategy(scene.type);

  // Get node and edge animation configs
  const nodeConfigs = scene.layout?.nodes
    ? strategy.getNodeAnimations(scene.layout.nodes)
    : [];
  const edgeConfigs = scene.layout?.edges && scene.layout?.nodes
    ? strategy.getEdgeAnimations(scene.layout.edges, scene.layout.nodes)
    : [];

  // Title animation
  const titleOpacity = interpolate(frameInScene, [0, 30], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Render nodes using NodeAnimation component
  const renderNodes = () => {
    if (!scene.layout?.nodes) return null;

    return scene.layout.nodes.map((node) => {
      const config = nodeConfigs.find((c) => c.nodeId === node.id);
      if (!config) return null;

      return (
        <NodeAnimation
          key={node.id}
          node={node}
          delayFrames={config.delayFrames}
          durationFrames={config.durationFrames}
          currentFrame={frameInScene}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: '#3b82f6',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: 14,
              fontWeight: 'bold',
              padding: 10,
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              textAlign: 'center',
              fontFamily: 'sans-serif',
            }}
          >
            {node.label}
          </div>
        </NodeAnimation>
      );
    });
  };

  // Render edges using EdgeAnimation component
  const renderEdges = () => {
    if (!scene.layout?.edges || !scene.layout?.nodes) return null;

    return scene.layout.edges.map((edge, index) => {
      const config = edgeConfigs.find((c) => c.edgeIndex === index);
      if (!config) return null;

      // Calculate path length if not already provided
      const pathLength =
        config.pathLength > 0
          ? config.pathLength
          : calculatePathLength(edge.points);

      return (
        <EdgeAnimation
          key={edge.id || `edge-${index}`}
          edge={edge}
          edgeIndex={index}
          delayFrames={config.delayFrames}
          durationFrames={config.durationFrames}
          pathLength={pathLength}
          currentFrame={frameInScene}
        />
      );
    });
  };

  // Get the title for this diagram type
  const title = DIAGRAM_TITLES[scene.type] || 'ダイアグラム';

  return (
    <AbsoluteFill>
      {/* Title */}
      <div
        style={{
          position: 'absolute',
          top: 80,
          left: 40,
          right: 40,
          opacity: titleOpacity,
        }}
      >
        <h1
          style={{
            color: 'white',
            fontSize: 36,
            fontWeight: 'bold',
            marginBottom: 10,
            fontFamily: 'sans-serif',
          }}
        >
          {title}
        </h1>
        <p
          style={{
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: 16,
            maxWidth: 800,
            fontFamily: 'sans-serif',
          }}
        >
          {(scene.summary ?? '').substring(0, 150)}
          {(scene.summary ?? '').length > 150 ? '...' : ''}
        </p>
      </div>

      {/* Diagram area */}
      <div
        style={{
          position: 'absolute',
          top: 200,
          left: 80,
          right: 80,
          bottom: 100,
        }}
      >
        {/* Edges (background layer) */}
        {renderEdges()}

        {/* Nodes (foreground layer) */}
        {renderNodes()}
      </div>
    </AbsoluteFill>
  );
};
