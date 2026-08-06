
import { jest } from '@jest/globals';

// Mock all dependencies - define mocks inside factory to avoid hoisting issues
jest.unstable_mockModule('@/transcription', () => {
  const mockTranscribe = jest.fn().mockResolvedValue({
    success: true,
    segments: [
      { start: 0, end: 5000, text: 'Hello world', confidence: 0.9 },
      { start: 5000, end: 10000, text: 'Second segment', confidence: 0.85 },
    ],
    language: 'en',
    duration: 10,
  } as never);
  return {
    TranscriptionPipeline: jest.fn().mockImplementation(() => ({
      transcribe: mockTranscribe,
    })),
    __mockTranscribe: mockTranscribe,
  };
});

jest.unstable_mockModule('@/analysis', () => {
  const mockSegment = jest.fn().mockResolvedValue([
    {
      startMs: 0, endMs: 10000, text: 'Test content',
      summary: 'Summary', keyphrases: ['test'], confidence: 0.9,
    },
  ] as never);
  const mockAnalyze = jest.fn().mockResolvedValue({
    type: 'flow', confidence: 0.85,
    nodes: [{ id: 'n1', label: 'Node 1' }],
    edges: [],
    reasoning: 'Test',
  } as never);
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

jest.unstable_mockModule('@/visualization', () => {
  const mockGenerateLayout = jest.fn().mockResolvedValue({
    success: true,
    layout: {
      nodes: [{ id: 'n1', x: 100, y: 100, w: 120, h: 60, label: 'Node 1' }],
      edges: [],
    },
    confidence: 0.9,
  } as never);
  return {
    LayoutEngine: jest.fn().mockImplementation(() => ({
      generateLayout: mockGenerateLayout,
    })),
    __mockGenerateLayout: mockGenerateLayout,
  };
});

jest.unstable_mockModule('@/visualization/enhanced-zero-overlap-layout', () => {
  const mockGenerateZeroOverlapLayout = jest.fn().mockResolvedValue({
    success: true,
    nodes: [{ id: 'n1', x: 100, y: 100 }],
    edges: [],
    qualityMetrics: { overlapCount: 0, aestheticScore: 0.9 },
  } as never);
  return {
    EnhancedZeroOverlapLayoutEngine: jest.fn().mockImplementation(() => ({
      generateZeroOverlapLayout: mockGenerateZeroOverlapLayout,
    })),
    __mockGenerateZeroOverlapLayout: mockGenerateZeroOverlapLayout,
  };
});

jest.unstable_mockModule('@/pipeline/video-generator', () => {
  const mockGenerateVideo = jest.fn().mockResolvedValue({
    success: true,
    videoUrl: 'test-video.mp4',
    thumbnailUrl: 'test-thumb.jpg',
    duration: 10,
    processingTime: 1000,
  } as never);
  return {
    VideoGenerator: jest.fn().mockImplementation(() => ({
      generateVideo: mockGenerateVideo,
    })),
    __mockGenerateVideo: mockGenerateVideo,
  };
});

jest.unstable_mockModule('@/framework/continuous-learner', () => ({
  continuousLearner: {
    learnFromProcessingResult: jest.fn().mockResolvedValue(undefined as never),
  },
}));

jest.unstable_mockModule('@/pipeline/quality-monitor', () => ({
  getQualityMonitor: jest.fn().mockReturnValue({
    setPhaseIteration: jest.fn(),
    recordMetrics: jest.fn(),
    generateReport: jest.fn().mockReturnValue({
      phase: 'test',
      metrics: [],
      recommendations: [],
    } as never),
    getLatestMetrics: jest.fn().mockReturnValue({} as never),
    logIteration: jest.fn(),
  } as never),
  formatQualityReport: jest.fn().mockReturnValue('Test report' as never),
}));

const { SimplePipeline } = await import('@/pipeline/simple-pipeline');
const { __mockTranscribe } = await import('@/transcription') as { __mockTranscribe: jest.Mock };
const analysisMock = await import('@/analysis') as {
  __mockSegment: jest.Mock;
  __mockAnalyze: jest.Mock;
  SceneSegmenter: jest.Mock;
};
const { __mockGenerateLayout } = await import('@/visualization') as { __mockGenerateLayout: jest.Mock };
const { __mockGenerateZeroOverlapLayout } = await import('@/visualization/enhanced-zero-overlap-layout') as { __mockGenerateZeroOverlapLayout: jest.Mock };
const { __mockGenerateVideo } = await import('@/pipeline/video-generator') as { __mockGenerateVideo: jest.Mock };

const mockTranscribe = __mockTranscribe;
const mockSegment = analysisMock.__mockSegment;
const mockAnalyze = analysisMock.__mockAnalyze;
const mockGenerateLayout = __mockGenerateLayout;
const mockGenerateZeroOverlapLayout = __mockGenerateZeroOverlapLayout;
const mockGenerateVideo = __mockGenerateVideo;

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
  let pipeline: InstanceType<typeof SimplePipeline>;

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

    it('should populate startMs and durationMs on scenes (regression)', async () => {
      const result = await pipeline.process({
        audioFile: createMockFile(),
        options: { includeVideoGeneration: false, useEnhancedLayout: true },
      });

      expect(result.success).toBe(true);
      expect(result.scenes).toBeDefined();
      expect(result.scenes!.length).toBeGreaterThan(0);

      const scene = result.scenes![0];
      expect(scene.startMs).toBeDefined();
      expect(typeof scene.startMs).toBe('number');
      expect(scene.durationMs).toBeDefined();
      expect(typeof scene.durationMs).toBe('number');
      expect(scene.durationMs).toBeGreaterThan(0);
      // Verify summary and keyphrases are also populated
      expect(scene.summary).toBeDefined();
      expect(Array.isArray(scene.keyphrases)).toBe(true);
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
      // ErrorClassifier maps TranscriptionError → LLM_API_ERROR (recoverable),
      // producing a user-friendly message without the "Pipeline failed" prefix
      expect(result.error).toBeTruthy();
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
      } as never);

      const result = await pipeline.process({
        audioFile: createMockFile(),
        options: { includeVideoGeneration: false, useEnhancedLayout: true },
      });

      expect(result.success).toBe(true);
      expect(result.scenes?.length).toBe(0);
    });

    it('should handle scene processing error', async () => {
      mockAnalyze.mockRejectedValue(new Error('Analysis failed') as never);

      const result = await pipeline.process({
        audioFile: createMockFile(),
        options: { includeVideoGeneration: false },
      });

      expect(result.success).toBe(true);
      expect(result.scenes?.length).toBe(0);
    });

    it('should handle unexpected error in process', async () => {
      mockTranscribe.mockRejectedValue(new Error('Unexpected error') as never);

      const result = await pipeline.process({
        audioFile: createMockFile(),
        options: { includeVideoGeneration: false },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('unexpected error');
    });

    it('should use maxConcurrency option', async () => {
      mockSegment.mockResolvedValue([
        { startMs: 0, endMs: 2000, text: 'Seg 1', confidence: 0.9 },
        { startMs: 2000, endMs: 4000, text: 'Seg 2', confidence: 0.9 },
        { startMs: 4000, endMs: 6000, text: 'Seg 3', confidence: 0.9 },
      ] as never);

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
        .mockRejectedValueOnce(new Error('LLM API error'))
        .mockResolvedValue({
          success: true,
          segments: [{ start: 0, end: 5000, text: 'Hello', confidence: 0.9 }],
          language: 'en',
          duration: 5,
        } as never);

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
      } as never);

      const result = await pipeline.processWithRetry(
        { audioFile: createMockFile() },
        3,
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
      } as never);

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

  describe('segmenter thresholds', () => {
    // Regression: SceneSegmenter thresholds are MILLISECONDS (compared against
    // endMs - startMs in src/analysis/scene-segmenter.ts). Every other producer
    // (scene-segmenter defaults 3000/15000, main-pipeline 3000/15000,
    // pipeline-orchestrator 3000/15000, iteration-logger fallback 3000/15000)
    // uses 3s/15s. A prior value of 30/180 was 100x too small — splitting every
    // segment longer than 180ms and producing sub-second scenes.
    it('configures SceneSegmenter with millisecond-scale thresholds (3000/15000)', () => {
      expect(analysisMock.SceneSegmenter).toHaveBeenCalledTimes(1);
      const config = analysisMock.SceneSegmenter.mock.calls[0][0] as {
        minSegmentLengthMs: number;
        maxSegmentLengthMs: number;
        confidenceThreshold: number;
      };
      expect(config.minSegmentLengthMs).toBe(3000);
      expect(config.maxSegmentLengthMs).toBe(15000);
      expect(config.confidenceThreshold).toBe(0.6);
    });
  });
});
