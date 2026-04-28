/**
 * Remotion Root Component
 * Composition registration and metadata definition
 * Default: 1920x1080 (1080p), 30fps
 */

import React from 'react';
import { Composition } from 'remotion';
import {
  SpeechToVisualsVideo,
  defaultVideoProps,
  calculateTotalFrames,
  DEFAULT_FPS,
  DEFAULT_WIDTH,
  DEFAULT_HEIGHT,
  type VideoProps,
} from './Video';

// Re-export VideoProps for backward compatibility
export type { VideoProps as DiagramVideoProps } from './Video';

/** Composition ID for the Speech-to-Visuals video */
export const COMPOSITION_ID = 'SpeechToVisualsVideo';

/** Remotion Root - registers the main Composition */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id={COMPOSITION_ID}
        component={SpeechToVisualsVideo}
        durationInFrames={calculateTotalFrames(defaultVideoProps.scenes)}
        fps={DEFAULT_FPS}
        width={DEFAULT_WIDTH}
        height={DEFAULT_HEIGHT}
        defaultProps={defaultVideoProps}
      />
    </>
  );
};
