import { Composition } from 'remotion';
import { DiagramVideo } from './DiagramVideo';
import { SceneGraph } from '@/types/diagram';

export interface VideoProps {
  scenes: SceneGraph[];
  audioUrl: string;
  totalDuration: number;
}

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="DiagramVideo"
        component={DiagramVideo}
        durationInFrames={1500} // 30fps * 50 seconds default
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          scenes: [],
          audioUrl: '',
          totalDuration: 50000,
        } as VideoProps}
      />
    </>
  );
};