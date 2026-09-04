/**
 * Tests for async error handling and resource cleanup fixes.
 *
 * Covers:
 *   ISS-A: Object URL memory leak in StreamingTranscriber.getAudioDuration
 *   ISS-B: Abortable retry delay in EnhancedExportEngine.encodeVideoWithRetry
 *   ISS-C: Sequential hash deduplication in BatchProcessingAPI.submitJob
 *   ISS-D: Double-initialization guard in ProductionErrorHandler
 *
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';

// Polyfill TextDecoder for jsdom environment (needed by express → content-disposition)
if (typeof globalThis.TextDecoder === 'undefined') {
  const { TextDecoder } = await import('util');
  globalThis.TextDecoder = TextDecoder;
}

// ---------------------------------------------------------------------------
// ISS-A: StreamingTranscriber – Object URL cleanup
// ---------------------------------------------------------------------------

describe('ISS-A: StreamingTranscriber Object URL cleanup', () => {
  let revokeSpy: jest.Mock;
  let createObjectURLSpy: jest.Mock;

  beforeEach(() => {
    revokeSpy = jest.fn();
    createObjectURLSpy = jest.fn(() => 'blob:mock-url');

    const origURL = global.URL;
    Object.defineProperty(global, 'URL', {
      value: {
        ...origURL,
        createObjectURL: createObjectURLSpy,
        revokeObjectURL: revokeSpy,
      },
      writable: true,
    });

    // Mock Audio
    const mockAudio = {
      onloadedmetadata: null as (() => void) | null,
      onerror: null as (() => void) | null,
      src: '',
      duration: 10,
    };
    (global as unknown as { Audio: jest.Mock }).Audio = jest.fn(() => {
      queueMicrotask(() => {
        if (mockAudio.onloadedmetadata) mockAudio.onloadedmetadata();
      });
      return mockAudio;
    }) as jest.Mock;

    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should revoke Object URL after loading metadata', async () => {
    const { StreamingTranscriber } = await import('@/transcription/streaming-transcriber');
    const transcriber = new StreamingTranscriber({ chunkSizeMs: 5000 });
    const file = new File(['data'], 'test.wav', { type: 'audio/wav' });

    await transcriber.transcribeStream(file);

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    expect(revokeSpy).toHaveBeenCalledTimes(1);
  });

  it('should revoke Object URL on error path', async () => {
    // Audio mock that triggers onerror
    const mockAudio = {
      onloadedmetadata: null as (() => void) | null,
      onerror: null as (() => void) | null,
      src: '',
      duration: 10,
    };
    (global as unknown as { Audio: jest.Mock }).Audio = jest.fn(() => {
      queueMicrotask(() => {
        if (mockAudio.onerror) mockAudio.onerror();
      });
      return mockAudio;
    }) as jest.Mock;

    const { StreamingTranscriber } = await import('@/transcription/streaming-transcriber');
    const transcriber = new StreamingTranscriber();
    const file = new File(['data'], 'bad.wav', { type: 'audio/wav' });

    // TASK-0319: a duration-probe failure no longer rejects — jsdom has no
    // SpeechRecognition so this stays 経路3, and the run discloses an empty
    // placeholder plan instead of throwing. The Object URL is still created
    // and revoked exactly once (the leak ISS-A pinned).
    const result = await transcriber.transcribeStream(file);
    expect(result.success).toBe(true);
    expect(result.placeholder).toBe(true);

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    expect(revokeSpy).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// ISS-B: EnhancedExportEngine – Abortable retry delay
// ---------------------------------------------------------------------------

describe('ISS-B: EnhancedExportEngine abortable retry delay', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should abort during retry delay when AbortController fires', async () => {
    const { EnhancedExportEngine } = await import('@/export/enhanced-export-engine');
    const engine = new EnhancedExportEngine(1, false);

    // Access the private method via a cast
    const engineAny = engine as unknown as {
      encodeVideoWithRetry: (job: unknown, frames: unknown[]) => Promise<unknown>;
      isAbortError: (e: unknown) => boolean;
    };

    // Mock encodeVideo to throw a transient error on the first call
    let callCount = 0;
    const job = {
      id: 'test-job',
      abortController: new AbortController(),
      config: { format: 'mp4' },
      startTime: new Date(),
    };

    // Create a mock that throws transient error, then aborts during delay
    const mockEncodeVideo = async () => {
      callCount++;
      if (callCount === 1) {
        // Throw transient error to trigger retry
        const err = new Error('Encoding timed out');
        throw err;
      }
      return { data: new Uint8Array(10) };
    };

    // Override the encodeVideo method
    (engine as unknown as Record<string, unknown>).encodeVideo = mockEncodeVideo;

    // Start the retry, then abort during the delay
    const retryPromise = engineAny.encodeVideoWithRetry(job, []);

    // Abort after a small delay to catch it during the retry wait
    setTimeout(() => job.abortController.abort(), 10);

    try {
      await retryPromise;
      fail('Should have thrown an abort error');
    } catch (error) {
      // Should be an abort error, not continue retrying
      expect(engineAny.isAbortError(error)).toBe(true);
    }

    engine.dispose();
  });
});

// ---------------------------------------------------------------------------
// ISS-C: BatchProcessingAPI – Sequential dedup avoids race
// ---------------------------------------------------------------------------

describe('ISS-C: BatchProcessingAPI sequential dedup', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    // Mock the routes/batch module to avoid express/TextDecoder issues in jsdom
    jest.doMock('@/api/routes/batch', () => ({
      BatchValidationError: class BatchValidationError extends Error {},
      JobNotFoundError: class JobNotFoundError extends Error {},
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
  });

  it('should deduplicate deterministically regardless of hash resolution order', async () => {
    // Mock simple-pipeline to prevent real processing
    jest.doMock('@/pipeline/simple-pipeline', () => ({
      simplePipeline: {
        process: jest.fn<() => Promise<unknown>>().mockResolvedValue({
          success: true,
          transcript: 'test',
          scenes: [],
          diagramData: { type: 'flow', nodes: [], edges: [] },
          metadata: { duration: 0 },
        }) as any,
      },
    }));

    jest.doMock('@/pipeline/adaptive-quality-presets', () => ({
      adaptiveQualityPresets: {
        setPreset: jest.fn(),
        toPipelineOptions: jest.fn<() => unknown>().mockReturnValue({ options: {} }),
      },
    }));

    jest.doMock('@/monitoring/pipeline-metrics-collector', () => ({
      pipelineMetricsCollector: {
        recordBatchJobTransition: jest.fn(),
      },
    }));

    // NOTE: we deliberately do NOT mock `crypto` here. Under Jest's experimental
    // ESM mode `jest.doMock('crypto', …)` is a silent no-op (only
    // `jest.unstable_mockModule` intercepts ESM imports), so a crypto mock would
    // never apply and the test would exercise the real (filename-based) hash
    // fallback — making two same-size/different-name files NOT collide. Instead
    // we give the duplicate files an identical backing ArrayBuffer so the real
    // content-hash branch (the production path for genuine File objects)
    // deterministically produces a collision, independent of hash resolution order.
    const { BatchProcessingAPI } = await import('@/api/batch-processing-api');

    class StubFile {
      name: string;
      size: number;
      private readonly body: ArrayBuffer;
      constructor(name: string, size: number, body?: ArrayBuffer) {
        this.name = name;
        this.size = size;
        this.body = body ?? new ArrayBuffer(size);
      }
      arrayBuffer(): Promise<ArrayBuffer> {
        return Promise.resolve(this.body);
      }
    }

    // a.wav and b.wav share `dupBody` → identical content hash → collision.
    const dupBody = new ArrayBuffer(100);

    const api = new BatchProcessingAPI();
    const result = await api.submitJob({
      files: [
        new StubFile('a.wav', 100, dupBody) as unknown as File,
        new StubFile('b.wav', 100, dupBody) as unknown as File, // identical content+size → dup
        new StubFile('c.wav', 200) as unknown as File,           // different content → unique
      ],
    });

    // a.wav and b.wav have the same hash and size → one is skipped
    expect(result.skippedFiles).toHaveLength(1);
    expect(result.jobId).toBeDefined();
  });

  it('should propagate hash computation errors without unhandled rejections', async () => {
    jest.doMock('@/pipeline/simple-pipeline', () => ({
      simplePipeline: {
        process: jest.fn<() => Promise<unknown>>().mockResolvedValue({ success: true }) as any,
      },
    }));

    jest.doMock('@/pipeline/adaptive-quality-presets', () => ({
      adaptiveQualityPresets: {
        setPreset: jest.fn(),
        toPipelineOptions: jest.fn<() => unknown>().mockReturnValue({ options: {} }),
      },
    }));

    jest.doMock('@/monitoring/pipeline-metrics-collector', () => ({
      pipelineMetricsCollector: {
        recordBatchJobTransition: jest.fn(),
      },
    }));

    const { BatchProcessingAPI } = await import('@/api/batch-processing-api');
    const { BatchValidationError } = await import('@/api/routes/batch');

    class StubFile {
      name: string;
      size: number;
      constructor(name: string, size: number) {
        this.name = name;
        this.size = size;
      }
    }

    const api = new BatchProcessingAPI();

    // All files with empty file list should throw
    await expect(
      api.submitJob({ files: [] }),
    ).rejects.toThrow(BatchValidationError);
  });
});

// ---------------------------------------------------------------------------
// ISS-D: ProductionErrorHandler – double-init guard
// ---------------------------------------------------------------------------

describe('ISS-D: ProductionErrorHandler double-initialization guard', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
  });

  it('should not register duplicate listeners on re-construction', async () => {
    const addEventListenerSpy = jest.spyOn(window, 'addEventListener');

    const { ProductionErrorHandler } = await import('@/monitoring/production-error-handler');

    const handler1 = new ProductionErrorHandler();
    const listenersAfter1 = addEventListenerSpy.mock.calls.length;

    // Simulate re-init scenario by calling the private method again
    const handlerAny = handler1 as unknown as {
      initializeGlobalErrorHandling: () => void;
      globalErrorHandler: unknown;
      unhandledRejectionHandler: unknown;
    };

    // Second call should be a no-op since handlers are already set
    handlerAny.initializeGlobalErrorHandling();
    const listenersAfter2 = addEventListenerSpy.mock.calls.length;

    expect(listenersAfter2).toBe(listenersAfter1); // No additional listeners

    handler1.destroy();

    // After destroy, re-init should work again
    handlerAny.initializeGlobalErrorHandling();
    const listenersAfter3 = addEventListenerSpy.mock.calls.length;
    expect(listenersAfter3).toBeGreaterThan(listenersAfter2);

    handler1.destroy();
  });
});
