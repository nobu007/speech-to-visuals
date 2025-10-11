/**
 * Diagram Scene Component
 * 個別シーンの図解表示
 */

import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { SceneGraph } from '@/types/diagram';

interface DiagramSceneProps {
  scene: SceneGraph;
  sceneIndex: number;
  currentTime: number;
}

export const DiagramScene: React.FC<DiagramSceneProps> = ({ scene, sceneIndex, currentTime }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // シーン開始からの経過フレーム
  const sceneStartFrame = (scene.startTime * fps) / 1000;
  const frameInScene = frame - sceneStartFrame;

  // ノードのアニメーション
  const renderNodes = () => {
    if (!scene.layout?.nodes) return null;

    return scene.layout.nodes.map((node, index) => {
      // ノード表示のスタッガーアニメーション
      const delay = index * 5; // 各ノード5フレーム遅れて表示
      const nodeProgress = spring({
        frame: frameInScene - delay,
        fps,
        config: {
          damping: 12,
          stiffness: 100,
        },
      });

      const scale = interpolate(nodeProgress, [0, 1], [0, 1]);
      const opacity = interpolate(nodeProgress, [0, 1], [0, 1]);

      return (
        <div
          key={node.id}
          style={{
            position: 'absolute',
            left: node.x,
            top: node.y,
            width: node.width || 120,
            height: node.height || 60,
            transform: `scale(${scale})`,
            opacity,
          }}
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
        </div>
      );
    });
  };

  // エッジ (矢印) の描画
  const renderEdges = () => {
    if (!scene.layout?.edges || !scene.layout?.nodes) return null;

    return scene.layout.edges.map((edge, index) => {
      const fromNode = scene.layout.nodes.find((n) => n.id === edge.from);
      const toNode = scene.layout.nodes.find((n) => n.id === edge.to);

      if (!fromNode || !toNode) return null;

      // エッジ描画のアニメーション (ノードより後に表示)
      const delay = scene.layout.nodes.length * 5 + index * 3;
      const edgeProgress = spring({
        frame: frameInScene - delay,
        fps,
        config: {
          damping: 10,
          stiffness: 80,
        },
      });

      const opacity = interpolate(edgeProgress, [0, 1], [0, 1]);

      // 線の始点と終点
      const fromX = fromNode.x + (fromNode.width || 120) / 2;
      const fromY = fromNode.y + (fromNode.height || 60) / 2;
      const toX = toNode.x + (toNode.width || 120) / 2;
      const toY = toNode.y + (toNode.height || 60) / 2;

      // 角度計算
      const angle = Math.atan2(toY - fromY, toX - fromX);
      const length = Math.sqrt(Math.pow(toX - fromX, 2) + Math.pow(toY - fromY, 2));

      return (
        <div
          key={edge.id || `edge-${index}`}
          style={{
            position: 'absolute',
            left: fromX,
            top: fromY,
            width: length,
            height: 2,
            backgroundColor: 'rgba(255, 255, 255, 0.5)',
            transformOrigin: '0 0',
            transform: `rotate(${angle}rad)`,
            opacity,
          }}
        >
          {/* 矢印ヘッド */}
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: -4,
              width: 0,
              height: 0,
              borderLeft: '8px solid rgba(255, 255, 255, 0.5)',
              borderTop: '5px solid transparent',
              borderBottom: '5px solid transparent',
            }}
          />
        </div>
      );
    });
  };

  // タイトルアニメーション
  const titleOpacity = interpolate(frameInScene, [0, 30], [0, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill>
      {/* タイトル */}
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
          {scene.type === 'flow' && 'プロセスフロー'}
          {scene.type === 'tree' && '階層構造'}
          {scene.type === 'timeline' && 'タイムライン'}
          {scene.type === 'matrix' && '比較表'}
          {scene.type === 'cycle' && '循環プロセス'}
          {!['flow', 'tree', 'timeline', 'matrix', 'cycle'].includes(scene.type) && 'ダイアグラム'}
        </h1>
        <p
          style={{
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: 16,
            maxWidth: 800,
            fontFamily: 'sans-serif',
          }}
        >
          {scene.content.substring(0, 150)}
          {scene.content.length > 150 ? '...' : ''}
        </p>
      </div>

      {/* 図解エリア */}
      <div
        style={{
          position: 'absolute',
          top: 200,
          left: 80,
          right: 80,
          bottom: 100,
        }}
      >
        {/* エッジ (背景レイヤー) */}
        {renderEdges()}

        {/* ノード (前景レイヤー) */}
        {renderNodes()}
      </div>

      {/* 信頼度インジケーター */}
      <div
        style={{
          position: 'absolute',
          bottom: 60,
          left: 40,
          fontSize: 12,
          color: 'rgba(255, 255, 255, 0.5)',
          fontFamily: 'monospace',
        }}
      >
        信頼度: {Math.round((scene.confidence || 0) * 100)}%
      </div>
    </AbsoluteFill>
  );
};
