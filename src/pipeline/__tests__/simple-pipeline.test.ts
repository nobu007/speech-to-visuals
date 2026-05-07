
// Mock all dependencies - define mocks inside factory to avoid hoisting issues
vi.mock('@/transcription', () => {
  const mockTranscribe = vi.fn().mockResolvedValue({
    success: true,
    segments: [
      { start: 0, end: 5000, text: 'Hello world', confidence: 0.9 },
      { start: 5000, end: 10000, text: 'Second segment', confidence: 0.85 },
    ],
    language: 'en',
    duration: 10,
  } as never);
  return {
    TranscriptionPipeline: vi.fn().mockImplementation(() => ({
      transcribe: mockTranscribe,
    })),
    __mockTranscribe: mockTranscribe,
  };
});

vi.mock('@/analysis', () => {
  const mockSegment = vi.fn().mockResolvedValue([
    {
      startMs: 0, endMs: 10000, text: 'Test content',
      summary: 'Summary', keyphrases: ['test'], confidence: 0.9,
    },
  ] as never);
  const mockAnalyze = vi.fn().mockResolvedValue({
    type: 'flow', confidence: 0.85,
    nodes: [{ id: 'n1', label: 'Node 1' }],
    edges: [],
    reasoning: 'Test',
  } as never);
  return {
    SceneSegmenter: vi.fn().mockImplementation(() => ({
      segment: mockSegment,
    })),
    DiagramDetector: vi.fn().mockImplementation(() => ({
      analyze: mockAnalyze,
    })),
    __mockSegment: mockSegment,
    __mockAnalyze: mockAnalyze,
  };
});

vi.mock('@/visualization', () => {
  const mockGenerateLayout = vi.fn().mockResolvedValue({
    success: true,
    layout: {
      nodes: [{ id: 'n1', x: 100, y: 100, w: 120, h: 60, label: 'Node 1' }],
      edges: [],
    },
    confidence: 0.9,
  } as never);
  return {
    LayoutEngine: vi.fn().mockImplementation(() => ({
      generateLayout: mockGenerateLayout,
    })),
    __mockGenerateLayout: mockGenerateLayout,
  };
});

vi.mock('@/visualization/enhanced-zero-overlap-layout', () => {
  const mockGenerateZeroOverlapLayout = vi.fn().mockResolvedValue({
    success: true,
    nodes: [{ id: 'n1', x: 100, y: 100 }],
    edges: [],
    qualityMetrics: { overlapCount: 0, aestheticScore: 0.9 },
  } as never);
  return {
    EnhancedZeroOverlapLayoutEngine: vi.fn().mockImplementation(() => ({
      generateZeroOverlapLayout: mockGenerateZeroOverlapLayout,
    })),
    __mockGenerateZeroOverlapLayout: mockGenerateZeroOverlapLayout,
  };
});

vi.mock('@/pipeline/video-generator', () => {
  const mockGenerateVideo = vi.fn().mockResolvedValue({
    success: true,
    videoUrl: 'test-video.mp4',
    thumbnailUrl: 'test-thumb.jpg',
    duration: 10,
    processingTime: 1000,
  } as never);
  return {
    VideoGenerator: vi.fn().mockImplementation(() => ({
      generateVideo: mockGenerateVideo,
    })),
    __mockGenerateVideo: mockGenerateVideo,
  };
});

vi.mock('@/framework/continuous-learner', () => ({
  continuousLearner: {
    learnFromProcessingResult: vi.fn().mockResolvedValue(undefined as never),
  },
}));

vi.mock('@/pipeline/quality-monitor', () => ({
  getQualityMonitor: vi.fn().mockReturnValue({
    setPhaseIteration: vi.fn(),
    recordMetrics: vi.fn(),
    generateReport: vi.fn().mockReturnValue({
      phase: 'test',
      metrics: [],
      recommendations: [],
    } as never),
    getLatestMetrics: vi.fn().mockReturnValue({} as never),
    logIteration: vi.fn(),
  } as never),
  formatQualityReport: vi.fn().mockReturnValue('Test report' as never),
}));

import { SimplePipeline } from '@/pipeline/simple-pipeline';

const mockTranscribe = (vi.requireMock('@/transcription') as { __mockTranscribe: vi.Mock<() => Promise<unknown>> }).__mockTranscribe;
const mockSegment = (vi.requireMock('@/analysis') as { __mockSegment: vi.Mock<() => Promise<unknown>> }).__mockSegment;
const mockAnalyze = (vi.requireMock('@/analysis') as { __mockAnalyze: vi.Mock<() => Promise<unknown>> }).__mockAnalyze;
const mockGenerateLayout = (vi.requireMock('@/visualization') as { __mockGenerateLayout: vi.Mock<() => Promise<unknown>> }).__mockGenerateLayout;
const mockGenerateZeroOverlapLayout = (vi.requireMock('@/visualization/enhanced-zero-overlap-layout') as { __mockGenerateZeroOverlapLayout: vi.Mock<() => Promise<unknown>> }).__mockGenerateZeroOverlapLayout;
const mockGenerateVideo = (vi.requireMock('@/pipeline/video-generator') as { __mockGenerateVideo: vi.Mock<() => Promise<unknown>> }).__mockGenerateVideo;

// Mock URL.createObjectURL / revokeObjectURL
beforeEach(() => {
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:test');
  globalThis.URL.revokeObjectURL = vi.fn();
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
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    resetMocks();
    pipeline = new SimplePipeline();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
      const onProgress = vi.fn();

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

    it('should cap performanceHistory at MAX_HISTORY (ISS-009)', async () => {
      // Simulate pushing more than MAX_HISTORY (100) entries via internal array
      const history = (pipeline as unknown as { performanceHistory: Array<unknown> }).performanceHistory;
      for (let i = 0; i < 110; i++) {
        history.push({ timestamp: new Date().toISOString(), processingTime: 100, success: true, qualityScore: 50 });
      }
      expect(history.length).toBe(110);

      // Process one more to trigger trim
      await pipeline.process({
        audioFile: createMockFile(),
        options: { includeVideoGeneration: false },
      });

      // After trim, should be capped at MAX_HISTORY
      const finalMetrics = pipeline.getProgressiveMetrics();
      expect(finalMetrics.performanceHistory.length).toBeLessThanOrEqual(101); // MAX_HISTORY + 1 new entry before second trim
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
