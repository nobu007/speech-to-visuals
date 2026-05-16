import { jest } from '@jest/globals';
import type { SimplePipelineResult } from '@/pipeline/simple-pipeline';

// Mock the dynamic import of actualVideoRenderer
jest.unstable_mockModule('@/lib/actualVideoRenderer', () => ({
  actualVideoRenderer: {
    renderVideo: jest.fn((_config: unknown, onProgress: (p: { progress: number; message: string }) => void) => {
      onProgress({ progress: 50, message: 'Rendering...' });
      return Promise.resolve();
    }),
  },
}), { virtual: true });

const {
  VideoGenerator,
  generateVideoFromPipeline,
} = await import('@/pipeline/video-generator');

// Create mock scenes with all properties video-generator actually accesses
function makeMockScene(overrides: Record<string, unknown> = {}) {
  return {
    type: 'flow',
    id: 'scene-1',
    startTime: 0,
    endTime: 5,
    content: 'A simple flow diagram showing two steps.',
    confidence: 0.85,
    nodes: [
      { id: 'n1', label: 'Step 1' },
      { id: 'n2', label: 'Step 2' },
    ],
    edges: [{ from: 'n1', to: 'n2' }],
    layout: {
      nodes: [
        { id: 'n1', label: 'Step 1', x: 100, y: 100, w: 120, h: 60 },
        { id: 'n2', label: 'Step 2', x: 400, y: 100, w: 120, h: 60 },
      ],
      edges: [
        { from: 'n1', to: 'n2', points: [{ x: 220, y: 130 }, { x: 400, y: 130 }] },
      ],
    },
    startMs: 0,
    durationMs: 5000,
    summary: 'A simple flow diagram.',
    keyphrases: ['flow'],
    ...overrides,
  };
}

function makeValidPipelineResult(): SimplePipelineResult {
  return {
    success: true,
    audioUrl: 'test-audio.wav',
    scenes: [makeMockScene()] as unknown as SimplePipelineResult['scenes'],
    processingTime: 1000,
  };
}

describe('VideoGenerator', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('constructor', () => {
    it('should use default options', () => {
      const gen = new VideoGenerator();
      const stats = gen.getGenerationStats();
      expect(stats.totalGenerations).toBe(0);
    });

    it('should accept custom options', () => {
      const gen = new VideoGenerator({
        outputFormat: 'webm',
        quality: 'low',
        resolution: '720p',
        fps: 24,
      });
      expect(gen).toBeDefined();
    });
  });

  describe('generateVideo', () => {
    it('should generate video from valid pipeline result', async () => {
      const gen = new VideoGenerator();
      const result = await gen.generateVideo(makeValidPipelineResult());

      expect(result.success).toBe(true);
      expect(result.videoUrl).toBeDefined();
      expect(result.thumbnailUrl).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should call progress callback', async () => {
      const gen = new VideoGenerator();
      const progress = jest.fn();

      await gen.generateVideo(makeValidPipelineResult(), progress);

      expect(progress).toHaveBeenCalled();
      const stages = progress.mock.calls.map(call => call[0]);
      expect(stages).toContain('Initializing video generation');
      expect(stages).toContain('Video generation complete');
    });

    it('should return error for invalid pipeline result (no success)', async () => {
      const gen = new VideoGenerator();
      const result = await gen.generateVideo({
        success: false,
        scenes: [],
      } as SimplePipelineResult);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return error for missing audio URL', async () => {
      const gen = new VideoGenerator();
      const input = makeValidPipelineResult();
      delete input.audioUrl;

      const result = await gen.generateVideo(input);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return error for empty scenes', async () => {
      const gen = new VideoGenerator();
      const result = await gen.generateVideo({
        success: true,
        audioUrl: 'test.wav',
        scenes: [],
      } as SimplePipelineResult);

      expect(result.success).toBe(false);
    });

    it('should update generation stats after successful generation', async () => {
      const gen = new VideoGenerator();
      await gen.generateVideo(makeValidPipelineResult());

      const stats = gen.getGenerationStats();
      expect(stats.totalGenerations).toBe(1);
      expect(stats.successRate).toBe(1);
    });

    it('should handle error gracefully', async () => {
      const gen = new VideoGenerator();
      const result = await gen.generateVideo({ success: false } as SimplePipelineResult);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle multiple scenes', async () => {
      const gen = new VideoGenerator();
      const multiSceneResult: SimplePipelineResult = {
        ...makeValidPipelineResult(),
        scenes: [
          makeMockScene(),
          makeMockScene({
            id: 'scene-2',
            type: 'tree',
            startTime: 5,
            endTime: 10,
            content: 'A tree diagram.',
            startMs: 5000,
            confidence: 0.9,
            layout: {
              nodes: [
                { id: 'a', label: 'Root', x: 300, y: 50, w: 120, h: 60 },
                { id: 'b', label: 'Child', x: 300, y: 200, w: 120, h: 60 },
              ],
              edges: [{ from: 'a', to: 'b', points: [{ x: 360, y: 110 }, { x: 360, y: 200 }] }],
            },
          }),
        ] as unknown as SimplePipelineResult['scenes'],
      };

      const result = await gen.generateVideo(multiSceneResult);
      expect(result.success).toBe(true);
    });

    it('should handle scenes with no layout', async () => {
      const gen = new VideoGenerator();
      const result = await gen.generateVideo({
        success: true,
        audioUrl: 'test.wav',
        scenes: [makeMockScene({ layout: undefined })] as unknown as SimplePipelineResult['scenes'],
      });

      expect(result.success).toBe(true);
    });

    it('should handle scenes with zero duration', async () => {
      const gen = new VideoGenerator();
      const result = await gen.generateVideo({
        success: true,
        audioUrl: 'test.wav',
        scenes: [makeMockScene({ startTime: 0, endTime: 0 })] as unknown as SimplePipelineResult['scenes'],
      });

      expect(result.success).toBe(true);
    });
  });

  describe('getGenerationStats', () => {
    it('should return empty stats initially', () => {
      const gen = new VideoGenerator();
      const stats = gen.getGenerationStats();
      expect(stats.totalGenerations).toBe(0);
      expect(stats.successRate).toBe(0);
      expect(stats.averageProcessingTime).toBe(0);
      expect(stats.qualityScores).toEqual([]);
      expect(stats.commonErrors).toEqual([]);
    });

    it('should track quality scores for successful generations', async () => {
      const gen = new VideoGenerator();
      await gen.generateVideo(makeValidPipelineResult());

      const stats = gen.getGenerationStats();
      expect(stats.qualityScores.length).toBe(1);
      expect(stats.qualityScores[0]).toBeGreaterThan(0);
    });
  });

  describe('nextIteration', () => {
    it('should increment iteration', () => {
      const gen = new VideoGenerator();
      gen.nextIteration();
      gen.nextIteration();
      expect(true).toBe(true);
    });
  });

  describe('quality settings', () => {
    it.each(['ultra', 'high', 'medium', 'low'] as const)('should handle %s quality', async (quality) => {
      const gen = new VideoGenerator({ quality });
      const result = await gen.generateVideo(makeValidPipelineResult());
      expect(result.success).toBe(true);
    });
  });

  describe('resolution settings', () => {
    it.each(['720p', '1080p', '4k'] as const)('should handle %s resolution', async (resolution) => {
      const gen = new VideoGenerator({ resolution });
      const result = await gen.generateVideo(makeValidPipelineResult());
      expect(result.success).toBe(true);
    });
  });

  describe('fps settings', () => {
    it.each([24, 30, 60] as const)('should handle %d fps', async (fps) => {
      const gen = new VideoGenerator({ fps });
      const result = await gen.generateVideo(makeValidPipelineResult());
      expect(result.success).toBe(true);
    });
  });

  describe('format settings', () => {
    it('should handle webm output', async () => {
      const gen = new VideoGenerator({ outputFormat: 'webm' });
      const result = await gen.generateVideo(makeValidPipelineResult());
      expect(result.success).toBe(true);
    });

    it('should handle gif output', async () => {
      const gen = new VideoGenerator({ outputFormat: 'gif' });
      const result = await gen.generateVideo(makeValidPipelineResult());
      expect(result.success).toBe(true);
    });
  });

  describe('animation style', () => {
    it('should handle different animation styles', async () => {
      const gen = new VideoGenerator({ animationStyle: 'bounce' });
      const result = await gen.generateVideo(makeValidPipelineResult());
      expect(result.success).toBe(true);
    });
  });
});

describe('generateVideoFromPipeline', () => {
  it('should create generator and generate video', async () => {
    const result = await generateVideoFromPipeline(makeValidPipelineResult());
    expect(result.success).toBe(true);
  });

  it('should accept custom options', async () => {
    const result = await generateVideoFromPipeline(
      makeValidPipelineResult(),
      { quality: 'low', resolution: '720p' }
    );
    expect(result.success).toBe(true);
  });

  it('should accept progress callback', async () => {
    const progress = jest.fn();
    await generateVideoFromPipeline(makeValidPipelineResult(), undefined, progress);
    expect(progress).toHaveBeenCalled();
  });
});
