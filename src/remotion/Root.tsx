/**
 * Remotion Root Component
 * 動画コンポジションの定義
 */

import React from 'react';
import { Composition } from 'remotion';
import { DiagramVideo } from './DiagramVideo';
import { SceneGraph } from '@/types/diagram';

export interface DiagramVideoProps {
  scenes: SceneGraph[];
  audioUrl?: string;
  backgroundColor?: string;
}

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="DiagramVideo"
        component={DiagramVideo}
        durationInFrames={300} // デフォルト10秒 (30fps)
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          scenes: [],
          backgroundColor: '#0f0f23',
        }}
      />
    </>
  );
};
