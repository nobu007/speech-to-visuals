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

/**
 * Composition ID for the Speech-to-Visuals video.
 * Canonical definition lives in the side-effect-free `./composition-id` module
 * so the server-side render path can import the same contract without pulling
 * in React/Remotion. Re-exported here for existing consumers.
 */
import { COMPOSITION_ID } from './composition-id';
export { COMPOSITION_ID };

/** Remotion Root - registers the main Composition */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id={COMPOSITION_ID}
        component={SpeechToVisualsVideo as unknown as React.ComponentType<Record<string, unknown>>}
        durationInFrames={calculateTotalFrames(defaultVideoProps.scenes)}
        fps={DEFAULT_FPS}
        width={DEFAULT_WIDTH}
        height={DEFAULT_HEIGHT}
        defaultProps={defaultVideoProps}
      />
    </>
  );
};
