/**
 * Tests for VideoGenerator
 * Covers: constructor, generateVideo, getGenerationStats, nextIteration,
 *         edge cases, error handling, different quality/resolution settings
 */

import { jest } from '@jest/globals';
import type { SimplePipelineResult } from '../simple-pipeline';

// Mock the actualVideoRenderer to prevent import errors
jest.unstable_mockModule('@/lib/actualVideoRenderer', () => ({
  actualVideoRenderer: {
    renderVideo: jest.fn().mockImplementation(async (config: unknown, onProgress: (p: { progress: number; message: string }) => void) => {
      onProgress?.({ progress: 100, message: 'Rendered' });
    }),
  },
}), { virtual: true });

const {
  VideoGenerator,
  generateVideoFromPipeline,
} = await import('../video-generator');

// Suppress console
beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
});

// Helper to create a valid pipeline result
function createPipelineResult(overrides: Partial<SimplePipelineResult> = {}): SimplePipelineResult {
  return {
    success: true,
    audioUrl: 'file:///tmp/test-audio.wav',
    transcript: 'Test transcript',
    scenes: [
      {
        type: 'flow' as const,
        nodes: [
          { id: 'n1', label: 'Start' },
          { id: 'n2', label: 'End' },
        ],
        edges: [{ from: 'n1', to: 'n2', label: 'next' }],
        layout: {
          nodes: [
            { id: 'n1', label: 'Start', x: 0, y: 0 },
            { id: 'n2', label: 'End', x: 100, y: 100 },
          ],
          edges: [{ from: 'n1', to: 'n2', label: 'next', points: [{ x: 0, y: 0 }, { x: 100, y: 100 }] }],
        },
        startMs: 0,
        durationMs: 5000,
        startTime: 0,
        endTime: 5,
        id: 'scene-1',
        content: 'This is a test scene content for video generation',
        confidence: 0.9,
        summary: 'Test summary',
        keyphrases: ['test'],
      },
      {
        type: 'tree' as const,
        nodes: [
          { id: 'n3', label: 'Root' },
          { id: 'n4', label: 'Child' },
        ],
        edges: [{ from: 'n3', to: 'n4' }],
        layout: {
          nodes: [
            { id: 'n3', label: 'Root', x: 50, y: 0 },
            { id: 'n4', label: 'Child', x: 50, y: 100 },
          ],
          edges: [{ from: 'n3', to: 'n4', points: [{ x: 50, y: 0 }, { x: 50, y: 100 }] }],
        },
        startMs: 5000,
        durationMs: 5000,
        startTime: 5,
        endTime: 10,
        id: 'scene-2',
        content: 'Another test scene for tree diagram generation',
        confidence: 0.85,
        summary: 'Tree scene',
        keyphrases: ['tree'],
      },
    ],
    processingTime: 2000,
    ...overrides,
  };
}

describe('VideoGenerator', () => {
  // --- Constructor ---

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const gen = new VideoGenerator();
      expect(gen).toBeDefined();
    });

    it('should accept custom options', () => {
      const gen = new VideoGenerator({
        outputFormat: 'webm',
        quality: 'low',
        resolution: '720p',
        fps: 24,
        includeAudio: false,
        animationStyle: 'instant',
      });
      expect(gen).toBeDefined();
    });

    it('should accept partial options', () => {
      const gen = new VideoGenerator({ quality: 'ultra' });
      expect(gen).toBeDefined();
    });

    it('should handle 4k resolution', () => {
      const gen = new VideoGenerator({ resolution: '4k' });
      expect(gen).toBeDefined();
    });

    it('should handle different fps values', () => {
      const gen24 = new VideoGenerator({ fps: 24 });
      const gen30 = new VideoGenerator({ fps: 30 });
      const gen60 = new VideoGenerator({ fps: 60 });
      expect(gen24).toBeDefined();
      expect(gen30).toBeDefined();
      expect(gen60).toBeDefined();
    });
  });

  // --- generateVideo ---

  describe('generateVideo', () => {
    it('should generate video from valid pipeline result', async () => {
      const gen = new VideoGenerator({ concurrency: 1 });
      const result = await gen.generateVideo(createPipelineResult());
      expect(result.success).toBe(true);
      expect(result.videoUrl).toBeDefined();
      expect(result.thumbnailUrl).toBeDefined();
      expect(result.duration).toBeDefined();
      expect(result.fileSize).toBeDefined();
      expect(result.resolution).toBeDefined();
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should call onProgress callback during generation', async () => {
      const gen = new VideoGenerator({ concurrency: 1 });
      const progressCalls: Array<{ stage: string; progress: number }> = [];
      const onProgress = (stage: string, progress: number) => {
        progressCalls.push({ stage, progress });
      };

      await gen.generateVideo(createPipelineResult(), onProgress);
      expect(progressCalls.length).toBeGreaterThan(0);
      expect(progressCalls[0].progress).toBe(0);
      expect(progressCalls[progressCalls.length - 1].progress).toBe(100);
    });

    it('should fail for invalid pipeline result (no success)', async () => {
      const gen = new VideoGenerator();
      const result = await gen.generateVideo(
        createPipelineResult({ success: false })
      );
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should fail for pipeline result with no scenes', async () => {
      const gen = new VideoGenerator();
      const result = await gen.generateVideo(
        createPipelineResult({ scenes: [] })
      );
      expect(result.success).toBe(false);
    });

    it('should fail for pipeline result with no audioUrl', async () => {
      const gen = new VideoGenerator();
      const result = await gen.generateVideo(
        createPipelineResult({ audioUrl: undefined })
      );
      expect(result.success).toBe(false);
    });

    it('should handle different quality settings', async () => {
      for (const quality of ['low', 'medium', 'high', 'ultra'] as const) {
        const gen = new VideoGenerator({ quality, concurrency: 1 });
        const result = await gen.generateVideo(createPipelineResult());
        expect(result.success).toBe(true);
      }
    });

    it('should handle different resolution settings', async () => {
      for (const resolution of ['720p', '1080p', '4k'] as const) {
        const gen = new VideoGenerator({ resolution, concurrency: 1 });
        const result = await gen.generateVideo(createPipelineResult());
        expect(result.success).toBe(true);
      }
    });

    it('should handle pipeline result with scenes without layout', async () => {
      const gen = new VideoGenerator({ concurrency: 1 });
      const noLayoutResult = createPipelineResult({
        scenes: [
          {
            type: 'flow' as const,
            nodes: [{ id: 'n1', label: 'Node 1' }],
            edges: [],
            startMs: 0,
            durationMs: 5000,
            startTime: 0,
            endTime: 5,
            id: 'scene-no-layout',
            content: 'Scene without layout data for testing fallback behavior',
            confidence: 0.75,
            summary: 'No layout',
            keyphrases: [],
          },
        ],
      });

      const result = await gen.generateVideo(noLayoutResult);
      expect(result.success).toBe(true);
    });

    it('should handle scenes with different diagram types', async () => {
      const gen = new VideoGenerator({ concurrency: 1 });
      const types = ['flow', 'tree', 'timeline', 'matrix', 'cycle'] as const;
      const scenes = types.map((type, i) => ({
        type,
        nodes: [{ id: `n-${i}`, label: `Node ${i}` }],
        edges: [],
        layout: {
          nodes: [{ id: `n-${i}`, label: `Node ${i}`, x: i * 50, y: i * 50 }],
          edges: [],
        },
        startMs: i * 5000,
        durationMs: 5000,
        startTime: i * 5,
        endTime: (i + 1) * 5,
        id: `scene-${type}-${i}`,
        content: `Scene for ${type} diagram type testing content`,
        confidence: 0.8,
        summary: `${type} diagram`,
        keyphrases: [type],
      }));

      const result = await gen.generateVideo(
        createPipelineResult({ scenes })
      );
      expect(result.success).toBe(true);
    });

    it('should handle scenes with very short duration', async () => {
      const gen = new VideoGenerator({ concurrency: 1 });
      const shortSceneResult = createPipelineResult({
        scenes: [
          {
            type: 'flow' as const,
            nodes: [{ id: 'n1', label: 'Quick' }],
            edges: [],
            layout: {
              nodes: [{ id: 'n1', label: 'Quick', x: 0, y: 0 }],
              edges: [],
            },
            startMs: 0,
            durationMs: 500,
            startTime: 0,
            endTime: 0.5,
            id: 'short-scene',
            content: 'Very short scene content',
            confidence: 0.6,
            summary: 'Short',
            keyphrases: [],
          },
        ],
      });

      const result = await gen.generateVideo(shortSceneResult);
      expect(result.success).toBe(true);
    });

    it('should record error patterns on failure', async () => {
      const gen = new VideoGenerator();
      const result = await gen.generateVideo(
        createPipelineResult({ success: false })
      );
      expect(result.success).toBe(false);

      // Failed generations are not counted in totalGenerations (only successful ones update metrics)
      const stats = gen.getGenerationStats();
      expect(stats.totalGenerations).toBe(0);
    });
  });

  // --- getGenerationStats ---

  describe('getGenerationStats', () => {
    it('should return initial stats', () => {
      const gen = new VideoGenerator();
      const stats = gen.getGenerationStats();
      expect(stats.totalGenerations).toBe(0);
      expect(stats.successRate).toBe(0);
      expect(stats.averageProcessingTime).toBe(0);
      expect(stats.qualityScores).toEqual([]);
      expect(stats.commonErrors).toEqual([]);
    });

    it('should track stats after successful generation', async () => {
      const gen = new VideoGenerator({ concurrency: 1 });
      await gen.generateVideo(createPipelineResult());
      const stats = gen.getGenerationStats();
      expect(stats.totalGenerations).toBe(1);
      expect(stats.successRate).toBe(1);
      expect(stats.averageProcessingTime).toBeGreaterThan(0);
      expect(stats.qualityScores.length).toBe(1);
    });

    it('should track stats after failed generation', async () => {
      const gen = new VideoGenerator();
      await gen.generateVideo(createPipelineResult({ success: false }));
      // Failed generations don't increment totalGenerations (metrics only updated on success)
      const stats = gen.getGenerationStats();
      expect(stats.totalGenerations).toBe(0);
      expect(stats.successRate).toBe(0);
      expect(stats.qualityScores.length).toBe(0);
    });

    it('should track average processing time over multiple runs', async () => {
      const gen = new VideoGenerator({ concurrency: 1 });
      await gen.generateVideo(createPipelineResult());
      await gen.generateVideo(createPipelineResult());
      const stats = gen.getGenerationStats();
      expect(stats.totalGenerations).toBe(2);
      expect(stats.successRate).toBe(1);
      expect(stats.averageProcessingTime).toBeGreaterThan(0);
    });
  });

  // --- nextIteration ---

  describe('nextIteration', () => {
    it('should increment iteration counter', () => {
      const gen = new VideoGenerator();
      gen.nextIteration();
      // No public getter for iteration, but we verify no throw
    });

    it('should allow multiple iteration increments', () => {
      const gen = new VideoGenerator();
      gen.nextIteration();
      gen.nextIteration();
      gen.nextIteration();
    });
  });

  // --- Edge cases ---

  describe('edge cases', () => {
    it('should handle generation with includeAudio false', async () => {
      const gen = new VideoGenerator({ includeAudio: false, concurrency: 1 });
      const result = await gen.generateVideo(createPipelineResult());
      expect(result.success).toBe(true);
    });

    it('should handle different animation styles', async () => {
      for (const style of ['smooth', 'instant', 'bounce'] as const) {
        const gen = new VideoGenerator({ animationStyle: style, concurrency: 1 });
        const result = await gen.generateVideo(createPipelineResult());
        expect(result.success).toBe(true);
      }
    });

    it('should handle custom backgroundColor', async () => {
      const gen = new VideoGenerator({ backgroundColor: '#ffffff', concurrency: 1 });
      const result = await gen.generateVideo(createPipelineResult());
      expect(result.success).toBe(true);
    });

    it('should handle output format webm', async () => {
      const gen = new VideoGenerator({ outputFormat: 'webm', concurrency: 1 });
      const result = await gen.generateVideo(createPipelineResult());
      expect(result.success).toBe(true);
    });

    it('should handle output format gif', async () => {
      const gen = new VideoGenerator({ outputFormat: 'gif', concurrency: 1 });
      const result = await gen.generateVideo(createPipelineResult());
      expect(result.success).toBe(true);
    });

    it('should handle scene with low confidence', async () => {
      const gen = new VideoGenerator({ concurrency: 1 });
      const lowConfidenceResult = createPipelineResult({
        scenes: [
          {
            type: 'flow' as const,
            nodes: [{ id: 'n1', label: 'Test' }],
            edges: [],
            layout: {
              nodes: [{ id: 'n1', label: 'Test', x: 0, y: 0 }],
              edges: [],
            },
            startMs: 0,
            durationMs: 3000,
            startTime: 0,
            endTime: 3,
            id: 'low-conf',
            content: 'Low confidence scene content',
            confidence: 0.3,
            summary: 'Low conf',
            keyphrases: [],
          },
        ],
      });

      const result = await gen.generateVideo(lowConfidenceResult);
      expect(result.success).toBe(true);
    });
  });
});

// --- generateVideoFromPipeline convenience function ---

describe('generateVideoFromPipeline', () => {
  it('should generate video using convenience function', async () => {
    const result = await generateVideoFromPipeline(
      createPipelineResult(),
      { concurrency: 1 }
    );
    expect(result.success).toBe(true);
  });

  it('should pass options to the generator', async () => {
    const result = await generateVideoFromPipeline(
      createPipelineResult(),
      { quality: 'low', concurrency: 1 }
    );
    expect(result.success).toBe(true);
  });

  it('should accept onProgress callback', async () => {
    const progressCalls: Array<{ stage: string; progress: number }> = [];
    const result = await generateVideoFromPipeline(
      createPipelineResult(),
      { concurrency: 1 },
      (stage, progress) => progressCalls.push({ stage, progress })
    );
    expect(result.success).toBe(true);
    expect(progressCalls.length).toBeGreaterThan(0);
  });
});

// --- Module-level singleton ---

describe('module-level singleton', () => {
  it('should export a videoGenerator instance', async () => {
    const mod = await import('../video-generator');
    expect(mod.videoGenerator).toBeDefined();
  });
});
