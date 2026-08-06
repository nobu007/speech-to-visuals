/**
 * Diagram Video Composition
 * 図解アニメーション動画のメインコンポーネント
 */

import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Audio } from 'remotion';
import { DiagramVideoProps } from './Root';
import { DiagramScene } from './DiagramScene';
import { findSceneAtTime } from './Video';

export const DiagramVideo: React.FC<DiagramVideoProps> = ({
  scenes,
  audioUrl,
  backgroundColor = '#0f0f23',
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // 現在のフレームに対応するシーンを検索（ミリ秒）
  const currentTime = (frame / Math.max(fps, 1)) * 1000; // ミリ秒
  // Resolve the active scene from cumulative `durationMs` offsets via the same
  // helper SpeechToVisualsVideo (the registered composition) uses. This
  // deliberately does NOT read scene.startTime/endTime: simple-pipeline.ts
  // emits those in SECONDS (`startTime: segStartMs / 1000`) while
  // `currentTime` here is in milliseconds, so a direct comparison made every
  // scene fall through to the "準備中..." fallback a few seconds in. `durationMs`
  // is consistently milliseconds across the pipeline, so offset-based lookup is
  // unit-safe.
  const sceneInfo = findSceneAtTime(scenes, currentTime);
  const currentScene = sceneInfo?.scene ?? null;

  // シーンインデックス
  const sceneIndex = sceneInfo?.index ?? -1;

  // フェードイン/アウトアニメーション（durationInFrames ベースで動画長に追従）
  const FADE_FRAMES = 15;
  const safeDuration = Math.max(durationInFrames, FADE_FRAMES * 2);
  const opacity = interpolate(
    frame,
    [0, FADE_FRAMES, safeDuration - FADE_FRAMES, safeDuration],
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
            width: `${(Math.max(sceneIndex, 0) / Math.max(scenes.length - 1, 1)) * 100}%`,
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
