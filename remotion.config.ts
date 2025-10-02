import { Config } from '@remotion/cli/config';

Config.setEntryPoint('./src/remotion/index.ts');

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);

// Performance settings
Config.setConcurrency(2);
Config.setFrameRange([0, 1500]);

// Quality settings
Config.setPixelFormat('yuv420p');
Config.setCodec('h264');

// Enable browser features for complex animations
Config.setChromiumOpenGlRenderer('egl');
Config.setBrowserExecutable(null);

export {};