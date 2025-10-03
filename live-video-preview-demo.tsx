import React, { useState, useEffect } from 'react';
import { Player } from '@remotion/player';

export const LiveVideoPreview: React.FC<{
  scenes: any[];
  onSceneChange?: (sceneIndex: number) => void;
}> = ({ scenes, onSceneChange }) => {
  const [currentScene, setCurrentScene] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);

  const handleSceneChange = (index: number) => {
    setCurrentScene(index);
    onSceneChange?.(index);
  };

  return (
    <div className="live-video-preview">
      <div className="video-player-container">
        <Player
          component={DiagramVideoComponent}
          inputProps={{ scenes, currentScene }}
          durationInFrames={540} // 18 seconds at 30fps
          compositionWidth={1920}
          compositionHeight={1080}
          fps={30}
          style={{ width: '100%', height: 'auto' }}
          controls
          loop
        />
      </div>

      <div className="scene-timeline">
        <h3>Scenes ({scenes.length})</h3>
        <div className="scene-list">
          {scenes.map((scene, index) => (
            <div
              key={index}
              className={`scene-item ${index === currentScene ? 'active' : ''}`}
              onClick={() => handleSceneChange(index)}
            >
              <span className="scene-number">{index + 1}</span>
              <span className="scene-type">{scene.type}</span>
              <span className="scene-duration">{scene.duration}s</span>
            </div>
          ))}
        </div>
      </div>

      <div className="preview-controls">
        <button onClick={() => setIsPlaying(!isPlaying)}>
          {isPlaying ? '⏸️ Pause' : '▶️ Play'}
        </button>
        <button onClick={() => setCurrentFrame(0)}>
          ⏮️ Reset
        </button>
        <span className="frame-counter">
          Frame: {currentFrame} / 540
        </span>
      </div>
    </div>
  );
};

const DiagramVideoComponent: React.FC<{ scenes: any[]; currentScene: number }> = ({
  scenes,
  currentScene
}) => {
  // This would be the actual video composition component
  // For now, return a placeholder
  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f0f0f0'
    }}>
      <div style={{ textAlign: 'center' }}>
        <h2>Scene {currentScene + 1}</h2>
        <p>{scenes[currentScene]?.type || 'flow'} diagram</p>
        <p>{scenes[currentScene]?.summary || 'Live video preview'}</p>
      </div>
    </div>
  );
};
