import { useCurrentFrame, useVideoConfig, Audio, interpolate, Sequence } from 'remotion';
import { VideoProps } from './Root';
import { DiagramScene } from './DiagramScene';

export const DiagramVideo: React.FC<VideoProps> = ({ scenes, audioUrl, totalDuration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Calculate total frames
  const totalFrames = Math.ceil((totalDuration / 1000) * fps);

  return (
    <div style={{
      width: '100%',
      height: '100%',
      backgroundColor: '#0f0f23',
      position: 'relative'
    }}>
      {/* Background Audio */}
      {audioUrl && (
        <Audio src={audioUrl} />
      )}

      {/* Animated Background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a3a 50%, #2d1b69 100%)',
          opacity: interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' }),
        }}
      />

      {/* Render each scene as a sequence */}
      {scenes.map((scene, index) => {
        const startFrame = Math.floor((scene.startMs / 1000) * fps);
        const durationFrames = Math.floor((scene.durationMs / 1000) * fps);

        return (
          <Sequence
            key={index}
            from={startFrame}
            durationInFrames={durationFrames}
            name={`Scene-${index + 1}`}
          >
            <DiagramScene scene={scene} sceneIndex={index} />
          </Sequence>
        );
      })}

      {/* Progress indicator */}
      <div
        style={{
          position: 'absolute',
          bottom: 40,
          left: 40,
          right: 40,
          height: 6,
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            backgroundColor: '#3b82f6',
            width: `${interpolate(frame, [0, totalFrames], [0, 100])}%`,
            borderRadius: 3,
            transition: 'width 0.1s ease',
          }}
        />
      </div>
    </div>
  );
};