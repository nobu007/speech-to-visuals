import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { SceneGraph } from '@/types/diagram';
import { DiagramRenderer } from './DiagramRenderer';

interface DiagramSceneProps {
  scene: SceneGraph;
  sceneIndex: number;
}

export const DiagramScene: React.FC<DiagramSceneProps> = ({ scene, sceneIndex }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sceneDurationFrames = Math.floor((scene.durationMs / 1000) * fps);

  // Animation phases
  const titlePhase = Math.floor(sceneDurationFrames * 0.15); // 15% for title
  const diagramPhase = sceneDurationFrames - titlePhase; // 85% for diagram

  // Title animation
  const titleOpacity = interpolate(
    frame,
    [0, titlePhase * 0.5, titlePhase],
    [0, 1, 0.8],
    { extrapolateRight: 'clamp' }
  );

  const titleY = interpolate(
    frame,
    [0, titlePhase * 0.5],
    [100, 80],
    { extrapolateRight: 'clamp' }
  );

  // Diagram animation starts after title
  const diagramStartFrame = titlePhase;
  const diagramProgress = interpolate(
    frame,
    [diagramStartFrame, sceneDurationFrames],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Scene type colors
  const typeColors = {
    flow: '#3b82f6',
    tree: '#10b981',
    timeline: '#f59e0b',
    matrix: '#ef4444',
    cycle: '#8b5cf6',
  };

  const sceneColor = typeColors[scene.type] || '#3b82f6';

  return (
    <div style={{
      width: '100%',
      height: '100%',
      position: 'relative',
      color: 'white',
    }}>
      {/* Scene Title */}
      <div
        style={{
          position: 'absolute',
          top: titleY,
          left: 60,
          right: 60,
          textAlign: 'center',
          opacity: titleOpacity,
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: 'inline-block',
            padding: '20px 40px',
            backgroundColor: `${sceneColor}20`,
            border: `2px solid ${sceneColor}`,
            borderRadius: 16,
            backdropFilter: 'blur(10px)',
          }}
        >
          <h1
            style={{
              fontSize: 48,
              fontWeight: 'bold',
              margin: 0,
              color: sceneColor,
              textShadow: '0 4px 8px rgba(0,0,0,0.3)',
            }}
          >
            {scene.summary}
          </h1>
          <div
            style={{
              fontSize: 24,
              marginTop: 10,
              opacity: 0.8,
              color: 'white',
            }}
          >
            シーン {sceneIndex + 1}
          </div>
        </div>
      </div>

      {/* Diagram */}
      {frame >= diagramStartFrame && (
        <div
          style={{
            position: 'absolute',
            top: 200,
            left: 0,
            right: 0,
            bottom: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <DiagramRenderer
            scene={scene}
            progress={diagramProgress}
            color={sceneColor}
          />
        </div>
      )}

      {/* Key phrases (bottom overlay) */}
      {scene.keyphrases.length > 0 && frame >= diagramStartFrame && (
        <div
          style={{
            position: 'absolute',
            bottom: 120,
            left: 60,
            right: 60,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            justifyContent: 'center',
            opacity: interpolate(
              frame,
              [diagramStartFrame + 30, diagramStartFrame + 60],
              [0, 1],
              { extrapolateRight: 'clamp' }
            ),
          }}
        >
          {scene.keyphrases.slice(0, 3).map((phrase, idx) => (
            <div
              key={idx}
              style={{
                padding: '12px 24px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: 25,
                fontSize: 18,
                color: 'white',
                backdropFilter: 'blur(10px)',
                opacity: interpolate(
                  frame,
                  [diagramStartFrame + 60 + idx * 10, diagramStartFrame + 90 + idx * 10],
                  [0, 1],
                  { extrapolateRight: 'clamp' }
                ),
                transform: `translateY(${interpolate(
                  frame,
                  [diagramStartFrame + 60 + idx * 10, diagramStartFrame + 90 + idx * 10],
                  [20, 0],
                  { extrapolateRight: 'clamp' }
                )}px)`,
              }}
            >
              {phrase}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};