import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock all dependencies - define mocks inside factory to avoid hoisting issues
jest.mock('@/transcription', () => {
  const mockTranscribe = jest.fn().mockResolvedValue({
    success: true,
    segments: [
      { start: 0, end: 5000, text: 'Hello world', confidence: 0.9 },
      { start: 5000, end: 10000, text: 'Second segment', confidence: 0.85 },
    ],
    language: 'en',
    duration: 10,
  });
  return {
    TranscriptionPipeline: jest.fn().mockImplementation(() => ({
      transcribe: mockTranscribe,
    })),
    __mockTranscribe: mockTranscribe,
  };
});

jest.mock('@/analysis', () => {
  const mockSegment = jest.fn().mockResolvedValue([
    {
      startMs: 0, endMs: 10000, text: 'Test content',
      summary: 'Summary', keyphrases: ['test'], confidence: 0.9,
    },
  ]);
  const mockAnalyze = jest.fn().mockResolvedValue({
    type: 'flow', confidence: 0.85,
    nodes: [{ id: 'n1', label: 'Node 1' }],
    edges: [],
    reasoning: 'Test',
  });
  return {
    SceneSegmenter: jest.fn().mockImplementation(() => ({
      segment: mockSegment,
    })),
    DiagramDetector: jest.fn().mockImplementation(() => ({
      analyze: mockAnalyze,
    })),
    __mockSegment: mockSegment,
    __mockAnalyze: mockAnalyze,
  };
});

jest.mock('@/visualization', () => {
  const mockGenerateLayout = jest.fn().mockResolvedValue({
    success: true,
    layout: {
      nodes: [{ id: 'n1', x: 100, y: 100, w: 120, h: 60, label: 'Node 1' }],
      edges: [],
    },
    confidence: 0.9,
  });
  return {
    LayoutEngine: jest.fn().mockImplementation(() => ({
      generateLayout: mockGenerateLayout,
    })),
    __mockGenerateLayout: mockGenerateLayout,
  };
});

jest.mock('@/visualization/enhanced-zero-overlap-layout', () => {
  const mockGenerateZeroOverlapLayout = jest.fn().mockResolvedValue({
    success: true,
    nodes: [{ id: 'n1', x: 100, y: 100 }],
    edges: [],
    qualityMetrics: { overlapCount: 0, aestheticScore: 0.9 },
  });
  return {
    EnhancedZeroOverlapLayoutEngine: jest.fn().mockImplementation(() => ({
      generateZeroOverlapLayout: mockGenerateZeroOverlapLayout,
    })),
    __mockGenerateZeroOverlapLayout: mockGenerateZeroOverlapLayout,
  };
});

jest.mock('@/pipeline/video-generator', () => {
  const mockGenerateVideo = jest.fn().mockResolvedValue({
    success: true,
    videoUrl: 'test-video.mp4',
    thumbnailUrl: 'test-thumb.jpg',
    duration: 10,
    processingTime: 1000,
  });
  return {
    VideoGenerator: jest.fn().mockImplementation(() => ({
      generateVideo: mockGenerateVideo,
    })),
    __mockGenerateVideo: mockGenerateVideo,
  };
});

jest.mock('@/framework/continuous-learner', () => ({
  continuousLearner: {
    learnFromProcessingResult: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@/pipeline/quality-monitor', () => ({
  getQualityMonitor: jest.fn().mockReturnValue({
    setPhaseIteration: jest.fn(),
    recordMetrics: jest.fn(),
    generateReport: jest.fn().mockReturnValue({
      phase: 'test',
      metrics: [],
      recommendations: [],
    }),
    getLatestMetrics: jest.fn().mockReturnValue({}),
    logIteration: jest.fn(),
  }),
  formatQualityReport: jest.fn().mockReturnValue('Test report'),
}));

import { SimplePipeline } from '@/pipeline/simple-pipeline';

const mockTranscribe = (jest.requireMock('@/transcription') as Record<string, jest.Mock>).__mockTranscribe;
const mockSegment = (jest.requireMock('@/analysis') as Record<string, jest.Mock>).__mockSegment;
const mockAnalyze = (jest.requireMock('@/analysis') as Record<string, jest.Mock>).__mockAnalyze;
const mockGenerateLayout = (jest.requireMock('@/visualization') as Record<string, jest.Mock>).__mockGenerateLayout;
const mockGenerateZeroOverlapLayout = (jest.requireMock('@/visualization/enhanced-zero-overlap-layout') as Record<string, jest.Mock>).__mockGenerateZeroOverlapLayout;
const mockGenerateVideo = (jest.requireMock('@/pipeline/video-generator') as Record<string, jest.Mock>).__mockGenerateVideo;

// Mock URL.createObjectURL / revokeObjectURL
beforeEach(() => {
  globalThis.URL.createObjectURL = jest.fn(() => 'blob:test');
  globalThis.URL.revokeObjectURL = jest.fn();
});

function createMockFile(): File {
  return new File(['audio data'], 'test.wav', { type: 'audio/wav' });
}

function resetMocks() {
  mockTranscribe.mockResolvedValue({
    success: true,
    segments: [
      { start: 0, end: 5000, text: 'Hello world', confidence: 0.9 },
      { start: 5000, end: 10000, text: 'Second segment', confidence: 0.85 },
    ],
    language: 'en',
    duration: 10,
  });
  mockSegment.mockResolvedValue([
    {
      startMs: 0, endMs: 10000, text: 'Test content',
      summary: 'Summary', keyphrases: ['test'], confidence: 0.9,
    },
  ]);
  mockAnalyze.mockResolvedValue({
    type: 'flow', confidence: 0.85,
    nodes: [{ id: 'n1', label: 'Node 1' }],
    edges: [],
    reasoning: 'Test',
  });
  mockGenerateZeroOverlapLayout.mockResolvedValue({
    success: true,
    nodes: [{ id: 'n1', x: 100, y: 100 }],
    edges: [],
    qualityMetrics: { overlapCount: 0, aestheticScore: 0.9 },
  });
  mockGenerateLayout.mockResolvedValue({
    success: true,
    layout: {
      nodes: [{ id: 'n1', x: 100, y: 100, w: 120, h: 60, label: 'Node 1' }],
      edges: [],
    },
    confidence: 0.9,
  });
  mockGenerateVideo.mockResolvedValue({
    success: true,
    videoUrl: 'test-video.mp4',
    thumbnailUrl: 'test-thumb.jpg',
    duration: 10,
    processingTime: 1000,
  });
}

describe('SimplePipeline', () => {
  let pipeline: SimplePipeline;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    resetMocks();
    pipeline = new SimplePipeline();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('process', () => {
    it('should process audio file successfully with enhanced layout', async () => {
      const result = await pipeline.process({
        audioFile: createMockFile(),
        options: { includeVideoGeneration: false, useEnhancedLayout: true },
      });

      expect(result.success).toBe(true);
      expect(result.scenes).toBeDefined();
      expect(result.transcript).toBeDefined();
    });

    it('should use standard layout engine when useEnhancedLayout is false', async () => {
      const result = await pipeline.process({
        audioFile: createMockFile(),
        options: { includeVideoGeneration: false, useEnhancedLayout: false },
      });

      expect(result.success).toBe(true);
      expect(mockGenerateLayout).toHaveBeenCalled();
    });

    it('should use standard layout engine when layoutQuality is standard', async () => {
      const result = await pipeline.process({
        audioFile: createMockFile(),
        options: { includeVideoGeneration: false, layoutQuality: 'standard' },
      });

      expect(result.success).toBe(true);
      expect(mockGenerateLayout).toHaveBeenCalled();
    });

    it('should process sequentially when enableParallelProcessing is false', async () => {
      const result = await pipeline.process({
        audioFile: createMockFile(),
        options: { includeVideoGeneration: false, enableParallelProcessing: false },
      });

      expect(result.success).toBe(true);
    });

    it('should include video URL when video generation succeeds', async () => {
      const result = await pipeline.process({
        audioFile: createMockFile(),
        options: { includeVideoGeneration: true },
      });

      expect(result.success).toBe(true);
      expect(result.videoUrl).toBe('test-video.mp4');
    });

    it('should handle video generation failure gracefully', async () => {
      mockGenerateVideo.mockResolvedValue({
        success: false,
        error: 'Video generation failed',
      });

      const result = await pipeline.process({
        audioFile: createMockFile(),
        options: { includeVideoGeneration: true },
      });

      expect(result.success).toBe(true);
      expect(result.videoUrl).toBeUndefined();
    });

    it('should call onProgress callback', async () => {
      const onProgress = jest.fn();

      await pipeline.process({
        audioFile: createMockFile(),
        options: { includeVideoGeneration: false },
      }, onProgress);

      expect(onProgress).toHaveBeenCalled();
    });

    it('should handle transcription failure', async () => {
      mockTranscribe.mockResolvedValue({
        success: false,
        segments: [],
        error: 'Transcription failed',
      });

      const result = await pipeline.process({
        audioFile: createMockFile(),
        options: { includeVideoGeneration: false },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Pipeline failed');
    });

    it('should handle null transcription segments', async () => {
      mockTranscribe.mockResolvedValue({
        success: true,
        segments: null,
      });

      const result = await pipeline.process({
        audioFile: createMockFile(),
        options: { includeVideoGeneration: false },
      });

      expect(result.success).toBe(false);
    });

    it('should handle empty segmentation result', async () => {
      mockSegment.mockResolvedValue([]);

      const result = await pipeline.process({
        audioFile: createMockFile(),
        options: { includeVideoGeneration: false },
      });

      expect(result.success).toBe(false);
    });

    it('should handle layout failure returning null scene', async () => {
      mockGenerateZeroOverlapLayout.mockResolvedValue({
        success: false,
        nodes: [],
        edges: [],
        qualityMetrics: { overlapCount: 0, aestheticScore: 0 },
      });

      const result = await pipeline.process({
        audioFile: createMockFile(),
        options: { includeVideoGeneration: false, useEnhancedLayout: true },
      });

      expect(result.success).toBe(true);
      expect(result.scenes?.length).toBe(0);
    });

    it('should handle scene processing error', async () => {
      mockAnalyze.mockRejectedValue(new Error('Analysis failed'));

      const result = await pipeline.process({
        audioFile: createMockFile(),
        options: { includeVideoGeneration: false },
      });

      expect(result.success).toBe(true);
      expect(result.scenes?.length).toBe(0);
    });

    it('should handle unexpected error in process', async () => {
      mockTranscribe.mockRejectedValue(new Error('Unexpected error'));

      const result = await pipeline.process({
        audioFile: createMockFile(),
        options: { includeVideoGeneration: false },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unexpected error');
    });

    it('should use maxConcurrency option', async () => {
      mockSegment.mockResolvedValue([
        { startMs: 0, endMs: 2000, text: 'Seg 1', confidence: 0.9 },
        { startMs: 2000, endMs: 4000, text: 'Seg 2', confidence: 0.9 },
        { startMs: 4000, endMs: 6000, text: 'Seg 3', confidence: 0.9 },
      ]);

      const result = await pipeline.process({
        audioFile: createMockFile(),
        options: { includeVideoGeneration: false, maxConcurrency: 2 },
      });

      expect(result.success).toBe(true);
    });
  });

  describe('processWithRetry', () => {
    it('should retry on failure and eventually succeed', async () => {
      mockTranscribe
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockResolvedValue({
          success: true,
          segments: [{ start: 0, end: 5000, text: 'Hello', confidence: 0.9 }],
          language: 'en',
          duration: 5,
        });

      const result = await pipeline.processWithRetry(
        { audioFile: createMockFile() },
        undefined,
        3
      );

      expect(result.success).toBe(true);
    });

    it('should return failure after all retries exhausted', async () => {
      mockTranscribe.mockResolvedValue({
        success: false,
        segments: [],
        error: 'Always fails',
      });

      const result = await pipeline.processWithRetry(
        { audioFile: createMockFile() },
        undefined,
        2
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('attempts failed');
    });
  });

  describe('getProgressiveMetrics', () => {
    it('should return initial metrics with no history', () => {
      const metrics = pipeline.getProgressiveMetrics();

      expect(metrics.iterationCount).toBe(0);
      expect(metrics.performanceHistory).toEqual([]);
      expect(metrics.averageQuality).toBe(0);
      expect(metrics.successRate).toBe(0);
    });

    it('should track metrics after processing', async () => {
      await pipeline.process({
        audioFile: createMockFile(),
        options: { includeVideoGeneration: false },
      });

      const metrics = pipeline.getProgressiveMetrics();
      expect(metrics.iterationCount).toBe(1);
      expect(metrics.performanceHistory.length).toBe(1);
      expect(metrics.successRate).toBe(100);
      expect(metrics.averageQuality).toBeGreaterThan(0);
    });

    it('should track failure metrics', async () => {
      mockTranscribe.mockResolvedValue({
        success: false,
        segments: [],
        error: 'Failed',
      });

      await pipeline.process({
        audioFile: createMockFile(),
      });

      const metrics = pipeline.getProgressiveMetrics();
      expect(metrics.iterationCount).toBe(1);
      expect(metrics.successRate).toBe(0);
    });
  });

  describe('getCapabilities', () => {
    it('should return capability information', () => {
      const caps = pipeline.getCapabilities();

      expect(caps.transcription).toBeDefined();
      expect(caps.analysis).toBeDefined();
      expect(caps.visualization).toBeDefined();
      expect(caps.progressiveEnhancement).toBeDefined();
      expect(caps.progressiveEnhancement.enabled).toBe(true);
    });
  });
});
