/**
 * Diagram Video Composition
 * 図解アニメーション動画のメインコンポーネント
 */

import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Audio } from 'remotion';
import { DiagramVideoProps } from './Root';
import { DiagramScene } from './DiagramScene';

export const DiagramVideo: React.FC<DiagramVideoProps> = ({
  scenes,
  audioUrl,
  backgroundColor = '#0f0f23',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 現在のフレームに対応するシーンを検索
  const currentTime = (frame / fps) * 1000; // ミリ秒
  const currentScene = scenes.find(
    (scene) => currentTime >= scene.startTime * 1000 && currentTime < scene.endTime * 1000
  );

  // シーンインデックス
  const sceneIndex = currentScene ? scenes.indexOf(currentScene) : -1;

  // フェードイン/アウトアニメーション
  const opacity = interpolate(
    frame,
    [0, 15, 285, 300], // フェードイン15フレーム、フェードアウト15フレーム
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <AbsoluteFill style={{ backgroundColor }}>
      {/* 音声トラック */}
      {audioUrl && <Audio src={audioUrl} />}

      {/* メインコンテンツ */}
      <div style={{ opacity }}>
        {currentScene ? (
          <DiagramScene
            scene={currentScene}
            sceneIndex={sceneIndex}
            currentTime={currentTime}
          />
        ) : (
          <AbsoluteFill
            style={{
              justifyContent: 'center',
              alignItems: 'center',
              color: 'white',
              fontSize: 48,
              fontFamily: 'sans-serif',
            }}
          >
            <div>準備中...</div>
          </AbsoluteFill>
        )}
      </div>

      {/* プログレスバー */}
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          left: 40,
          right: 40,
          height: 4,
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            backgroundColor: '#3b82f6',
            width: `${(sceneIndex / Math.max(scenes.length - 1, 1)) * 100}%`,
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      {/* シーンカウンター */}
      <div
        style={{
          position: 'absolute',
          top: 20,
          right: 40,
          color: 'white',
          fontSize: 14,
          fontFamily: 'monospace',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          padding: '8px 12px',
          borderRadius: 4,
        }}
      >
        シーン {sceneIndex + 1} / {scenes.length}
      </div>
    </AbsoluteFill>
  );
};
