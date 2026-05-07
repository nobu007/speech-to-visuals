/**
 * Comprehensive tests for LLMService class (llm-service.ts)
 *
 * Covers:
 * - Constructor (with/without API key, with options)
 * - isEnabled()
 * - execute() - model selection, retry, fallback, error handling
 * - getStats()
 * - clearCache()
 * - resetMetrics()
 * - Streaming support
 */

import { LLMService } from '../llm-service';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

// Mock the Google Generative AI SDK
const mockGenerateContent = vi.fn();
const mockGenerateContentStream = vi.fn();
const mockGetGenerativeModel = vi.fn(() => ({
  generateContent: mockGenerateContent,
  generateContentStream: mockGenerateContentStream,
}));

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}));

// Mock LLMCache - each instance gets its own isolated storage
vi.mock('../llm-cache', () => {
  return {
    LLMCache: vi.fn().mockImplementation(() => {
      const store = new Map<string, unknown>();
      return {
        get: vi.fn((key: string) => store.get(key) ?? null),
        set: vi.fn((key: string, data: unknown) => { store.set(key, data); }),
        getStats: vi.fn(() => ({
          size: store.size,
          validEntries: store.size,
          totalHits: 0,
          avgHitsPerEntry: 0,
          hitRate: 0,
          semantic: {
            enabled: true,
            threshold: 0.8,
            exactHits: 0,
            semanticHits: 0,
            misses: 0,
            overallHitRate: 0,
            avgSimilarityScore: 0,
            totalComparisons: 0,
          },
        })),
        clear: vi.fn(() => store.clear()),
      };
    }),
  };
});

// Mock console to reduce noise
let consoleLogSpy: vi.SpyInstance;
let consoleWarnSpy: vi.SpyInstance;
let consoleErrorSpy: vi.SpyInstance;

beforeEach(() => {
  vi.clearAllMocks();
  mockGenerateContent.mockReset();
  mockGenerateContentStream.mockReset();
  mockGetGenerativeModel.mockClear();
  consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleLogSpy.mockRestore();
  consoleWarnSpy.mockRestore();
  consoleErrorSpy.mockRestore();
  delete process.env.ANALYSIS_DISABLE_GEMINI;
  delete process.env.GOOGLE_API_KEY;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRateLimitError(): Error {
  const err = new Error('Rate limit exceeded');
  (err as unknown as Record<string, unknown>).status = 429;
  return err;
}

function createQuotaError(): Error {
  const err = new Error('Resource exhausted');
  (err as unknown as Record<string, unknown>).errorDetails = [
    { '@type': 'type.googleapis.com/google.rpc.QuotaFailure' },
  ];
  return err;
}

function createLLMResponse(text: string) {
  return {
    response: { text: () => text },
  };
}

function createStreamResponse(chunks: string[]) {
  const mockStream = (async function* () {
    for (const chunk of chunks) {
      yield { text: () => chunk };
    }
  })();
  return { stream: mockStream };
}

// Use unique context strings per test to avoid cache collisions
let contextCounter = 0;
function uniqueContext(prefix = 'ctx') {
  return `${prefix}-${++contextCounter}-${Date.now()}`;
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('LLMService', () => {
  // -------------------------------------------------------------------------
  // Constructor tests
  // -------------------------------------------------------------------------
  describe('constructor', () => {
    it('should create service with API key', () => {
      const service = new LLMService('test-api-key');
      expect(service.isEnabled()).toBe(true);
    });

    it('should create service without API key (disabled)', () => {
      const service = new LLMService();
      expect(service.isEnabled()).toBe(false);
    });

    it('should create service with GOOGLE_API_KEY env var', () => {
      process.env.GOOGLE_API_KEY = 'env-api-key';
      const service = new LLMService();
      expect(service.isEnabled()).toBe(true);
    });

    it('should prefer explicit key over env var', () => {
      process.env.GOOGLE_API_KEY = 'env-key';
      const service = new LLMService('explicit-key');
      expect(service.isEnabled()).toBe(true);
    });

    it('should accept cache options', () => {
      const service = new LLMService('test-key', {
        cacheSize: 50,
        cacheTTL: 60,
      });
      expect(service.isEnabled()).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // isEnabled tests
  // -------------------------------------------------------------------------
  describe('isEnabled', () => {
    it('should return false when no API key provided', () => {
      const service = new LLMService();
      expect(service.isEnabled()).toBe(false);
    });

    it('should return true when API key is provided', () => {
      const service = new LLMService('valid-key');
      expect(service.isEnabled()).toBe(true);
    });

    it('should return false when ANALYSIS_DISABLE_GEMINI=1 even with key', () => {
      process.env.ANALYSIS_DISABLE_GEMINI = '1';
      const service = new LLMService('valid-key');
      expect(service.isEnabled()).toBe(false);
    });

    it('should return true when ANALYSIS_DISABLE_GEMINI is not "1"', () => {
      process.env.ANALYSIS_DISABLE_GEMINI = '0';
      const service = new LLMService('valid-key');
      expect(service.isEnabled()).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // execute - disabled service
  // -------------------------------------------------------------------------
  describe('execute when disabled', () => {
    it('should return error response when LLM is not enabled', async () => {
      const service = new LLMService();
      const response = await service.execute({
        prompt: 'test',
        context: uniqueContext(),
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain('not enabled');
      expect(response.metadata.model).toBe('none');
      expect(response.metadata.fromCache).toBe(false);
      expect(response.metadata.retryCount).toBe(0);
      expect(response.metadata.fallbackUsed).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // execute - successful API call
  // -------------------------------------------------------------------------
  describe('execute successful API call', () => {
    it('should return parsed JSON data on success', async () => {
      const service = new LLMService('test-key');
      const responseData = { title: 'Test Diagram', type: 'flowchart', nodes: [{ id: 'n1', label: 'A' }], edges: [] };

      mockGenerateContent.mockResolvedValueOnce(createLLMResponse(JSON.stringify(responseData)));

      const response = await service.execute({
        prompt: 'Analyze this text',
        context: uniqueContext(),
      });

      expect(response.success).toBe(true);
      expect(response.data).toEqual(responseData);
      expect(response.metadata.fromCache).toBe(false);
      expect(response.metadata.retryCount).toBe(0);
      expect(response.metadata.fallbackUsed).toBe(false);
      expect(response.metadata.model).toBeDefined();
      expect(typeof response.metadata.responseTime).toBe('number');
    });

    it('should use custom parser when provided', async () => {
      const service = new LLMService('test-key');
      const rawText = 'custom response text';
      const parsedResult = { custom: 'parsed' };

      mockGenerateContent.mockResolvedValueOnce(createLLMResponse(rawText));

      const customParser = vi.fn().mockReturnValue(parsedResult);

      const response = await service.execute({
        prompt: 'test',
        context: uniqueContext(),
        parser: customParser,
      });

      expect(response.success).toBe(true);
      expect(customParser).toHaveBeenCalledWith(rawText);
      expect(response.data).toEqual(parsedResult);
    });

    it('should use default parser (parseJsonFromLLMText) when no custom parser', async () => {
      const service = new LLMService('test-key');
      const responseData = { key: 'value' };

      mockGenerateContent.mockResolvedValueOnce(createLLMResponse(JSON.stringify(responseData)));

      const response = await service.execute({
        prompt: 'test',
        context: uniqueContext(),
      });

      expect(response.success).toBe(true);
      expect(response.data).toEqual(responseData);
    });

    it('should pass temperature and maxOutputTokens options', async () => {
      const service = new LLMService('test-key');

      mockGenerateContent.mockResolvedValueOnce(
        createLLMResponse(JSON.stringify({ ok: true }))
      );

      await service.execute({
        prompt: 'test',
        context: uniqueContext(),
        options: { temperature: 0.5, maxOutputTokens: 4096 },
      });

      expect(mockGetGenerativeModel).toHaveBeenCalledWith(
        expect.objectContaining({
          generationConfig: expect.objectContaining({
            temperature: 0.5,
            maxOutputTokens: 4096,
          }),
        })
      );
    });

    it('should use forced model when forceModel is specified', async () => {
      const service = new LLMService('test-key');

      mockGenerateContent.mockResolvedValueOnce(
        createLLMResponse(JSON.stringify({ ok: true }))
      );

      const response = await service.execute({
        prompt: 'test',
        context: uniqueContext(),
        options: { forceModel: 'gemini-2.5-pro' },
      });

      expect(response.success).toBe(true);
      expect(response.metadata.model).toBe('gemini-2.5-pro');
    });
  });

  // -------------------------------------------------------------------------
  // execute - error handling
  // -------------------------------------------------------------------------
  describe('execute error handling', () => {
    it('should return failure on generic error', async () => {
      const service = new LLMService('test-key');

      mockGenerateContent.mockRejectedValueOnce(new Error('Something went wrong'));

      const response = await service.execute({
        prompt: 'test',
        context: uniqueContext(),
      });

      expect(response.success).toBe(false);
      expect(response.error).toBe('Something went wrong');
      expect(response.metadata.fallbackUsed).toBe(false);
    });

    it('should handle non-Error thrown values', async () => {
      const service = new LLMService('test-key');

      mockGenerateContent.mockRejectedValueOnce('string error');

      const response = await service.execute({
        prompt: 'test',
        context: uniqueContext(),
      });

      expect(response.success).toBe(false);
      expect(response.error).toBe('string error');
    });

    it('should return default error message for falsy error', async () => {
      const service = new LLMService('test-key');

      mockGenerateContent.mockRejectedValueOnce('');

      const response = await service.execute({
        prompt: 'test',
        context: uniqueContext(),
      });

      expect(response.success).toBe(false);
      expect(response.error).toBe('LLM request failed');
    });

    it('should handle empty response from LLM', async () => {
      const service = new LLMService('test-key');

      mockGenerateContent.mockResolvedValueOnce(createLLMResponse(''));

      const response = await service.execute({
        prompt: 'test',
        context: uniqueContext(),
      });

      expect(response.success).toBe(false);
    });

    it('should handle whitespace-only response from LLM', async () => {
      const service = new LLMService('test-key');

      mockGenerateContent.mockResolvedValueOnce(createLLMResponse('   \n\t  '));

      const response = await service.execute({
        prompt: 'test',
        context: uniqueContext(),
      });

      expect(response.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // execute - retry with rate limiting
  // -------------------------------------------------------------------------
  describe('execute retry logic', () => {
    it('should retry on rate limit error (429) and succeed', async () => {
      const service = new LLMService('test-key');
      const responseData = { ok: true };

      mockGenerateContent
        .mockRejectedValueOnce(createRateLimitError())
        .mockResolvedValueOnce(createLLMResponse(JSON.stringify(responseData)));

      const response = await service.execute({
        prompt: 'test',
        context: uniqueContext(),
        options: { maxRetries: 2, timeout: 5000 },
      });

      expect(response.success).toBe(true);
      expect(response.metadata.retryCount).toBe(1);
    }, 15000);

    it('should retry on timeout error', async () => {
      const service = new LLMService('test-key');
      const responseData = { ok: true };

      mockGenerateContent
        .mockRejectedValueOnce(new Error('Request timeout'))
        .mockResolvedValueOnce(createLLMResponse(JSON.stringify(responseData)));

      const response = await service.execute({
        prompt: 'test',
        context: uniqueContext(),
        options: { maxRetries: 2, timeout: 5000 },
      });

      expect(response.success).toBe(true);
    }, 15000);

    it('should fall back to alternative model after exhausting retries on rate limit', async () => {
      const service = new LLMService('test-key');

      // All primary model attempts fail with rate limit
      mockGenerateContent
        .mockRejectedValueOnce(createRateLimitError())
        .mockRejectedValueOnce(createRateLimitError())
        // Fallback model succeeds
        .mockResolvedValueOnce(createLLMResponse(JSON.stringify({ ok: true })));

      const response = await service.execute({
        prompt: 'test',
        context: uniqueContext(),
        options: { maxRetries: 2, timeout: 5000 },
      });

      expect(response.success).toBe(true);
      expect(response.metadata.fallbackUsed).toBe(true);
    }, 15000);

    it('should return failure when all retries and fallback are exhausted', async () => {
      const service = new LLMService('test-key');

      mockGenerateContent.mockRejectedValue(createRateLimitError());

      const response = await service.execute({
        prompt: 'test',
        context: uniqueContext(),
        options: { maxRetries: 1, timeout: 5000 },
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain('retries exhausted');
      expect(response.metadata.fallbackUsed).toBe(true);
    }, 15000);
  });

  // -------------------------------------------------------------------------
  // execute - fallback model logic
  // -------------------------------------------------------------------------
  describe('execute fallback model', () => {
    it('should use flash as fallback when pro is primary', async () => {
      const service = new LLMService('test-key');

      // Primary pro fails, fallback flash succeeds
      mockGenerateContent
        .mockRejectedValueOnce(createRateLimitError())
        .mockResolvedValueOnce(createLLMResponse(JSON.stringify({ ok: true })));

      const response = await service.execute({
        prompt: 'test',
        context: uniqueContext(),
        options: { forceModel: 'gemini-2.5-pro', maxRetries: 1, timeout: 5000 },
      });

      expect(response.success).toBe(true);
      expect(response.metadata.fallbackUsed).toBe(true);
      expect(response.metadata.model).toBe('gemini-2.5-flash');
    }, 15000);

    it('should use pro as fallback when flash is primary', async () => {
      const service = new LLMService('test-key');

      mockGenerateContent
        .mockRejectedValueOnce(createRateLimitError())
        .mockResolvedValueOnce(createLLMResponse(JSON.stringify({ ok: true })));

      const response = await service.execute({
        prompt: 'test',
        context: uniqueContext(),
        options: { forceModel: 'gemini-2.5-flash', maxRetries: 1, timeout: 5000 },
      });

      expect(response.success).toBe(true);
      expect(response.metadata.fallbackUsed).toBe(true);
      expect(response.metadata.model).toBe('gemini-2.5-pro');
    }, 15000);
  });

  // -------------------------------------------------------------------------
  // execute - streaming support
  // -------------------------------------------------------------------------
  describe('execute streaming', () => {
    it('should call streaming API when enableStreaming and onStream are set', async () => {
      const service = new LLMService('test-key');
      const streamCallback = vi.fn();

      mockGenerateContentStream.mockResolvedValueOnce(
        createStreamResponse(['{"title":', '"Test"}'])
      );

      const response = await service.execute({
        prompt: 'test',
        context: uniqueContext(),
        options: {
          enableStreaming: true,
          onStream: streamCallback,
          timeout: 10000,
        },
      });

      expect(response.success).toBe(true);
      expect(mockGenerateContentStream).toHaveBeenCalled();
      expect(streamCallback).toHaveBeenCalled();
    }, 15000);

    it('should handle empty streaming response as failure', async () => {
      const service = new LLMService('test-key');
      const streamCallback = vi.fn();

      // Empty stream
      mockGenerateContentStream.mockResolvedValueOnce(
        createStreamResponse([''])
      );

      const response = await service.execute({
        prompt: 'test',
        context: uniqueContext(),
        options: {
          enableStreaming: true,
          onStream: streamCallback,
          timeout: 10000,
        },
      });

      expect(response.success).toBe(false);
    }, 15000);
  });

  // -------------------------------------------------------------------------
  // getStats tests
  // -------------------------------------------------------------------------
  describe('getStats', () => {
    it('should return default stats for fresh service', () => {
      const service = new LLMService('test-key');
      const stats = service.getStats();

      expect(stats.totalRequests).toBe(0);
      expect(stats.cacheHits).toBe(0);
      expect(stats.cacheMisses).toBe(0);
      expect(stats.cacheHitRate).toBe(0);
      expect(stats.modelUsage.flash).toBe(0);
      expect(stats.modelUsage.pro).toBe(0);
      expect(stats.modelUsage.flashPercent).toBe(0);
      expect(stats.performance.avgResponseTime).toBe(0);
      expect(stats.performance.avgFlashTime).toBe(0);
      expect(stats.performance.avgProTime).toBe(0);
      expect(stats.performance.p50).toBe(0);
      expect(stats.performance.p95).toBe(0);
      expect(stats.performance.p99).toBe(0);
      expect(stats.reliability.successRate).toBe(0);
      expect(stats.reliability.fallbackRate).toBe(0);
      expect(stats.reliability.totalRetries).toBe(0);
      expect(typeof stats.timeSavings).toBe('string');
    });

    it('should track totalRequests after successful execution', async () => {
      const service = new LLMService('test-key');

      mockGenerateContent.mockResolvedValueOnce(
        createLLMResponse(JSON.stringify({ ok: true }))
      );

      await service.execute({
        prompt: 'test',
        context: uniqueContext(),
      });

      const stats = service.getStats();
      expect(stats.totalRequests).toBe(1);
    });

    it('should track model usage when using forceModel', async () => {
      const service = new LLMService('test-key');

      // Flash request
      mockGenerateContent.mockResolvedValueOnce(
        createLLMResponse(JSON.stringify({ ok: true }))
      );
      await service.execute({
        prompt: 'test',
        context: uniqueContext(),
        options: { forceModel: 'gemini-2.5-flash' },
      });

      // Pro request
      mockGenerateContent.mockResolvedValueOnce(
        createLLMResponse(JSON.stringify({ ok: true }))
      );
      await service.execute({
        prompt: 'test',
        context: uniqueContext(),
        options: { forceModel: 'gemini-2.5-pro' },
      });

      const stats = service.getStats();
      expect(stats.totalRequests).toBe(2);
      expect(stats.modelUsage.flash).toBe(1);
      expect(stats.modelUsage.pro).toBe(1);
      expect(stats.modelUsage.flashPercent).toBe(50);
    });

    it('should track fallback metrics', async () => {
      const service = new LLMService('test-key');

      // Primary fails, fallback succeeds
      mockGenerateContent
        .mockRejectedValueOnce(createRateLimitError())
        .mockResolvedValueOnce(createLLMResponse(JSON.stringify({ ok: true })));

      await service.execute({
        prompt: 'test',
        context: uniqueContext(),
        options: { forceModel: 'gemini-2.5-flash', maxRetries: 1, timeout: 5000 },
      });

      const stats = service.getStats();
      expect(stats.reliability.fallbackRate).toBeGreaterThan(0);
    }, 15000);

    it('should return "insufficient data" for time savings with only flash requests', async () => {
      const service = new LLMService('test-key');

      mockGenerateContent.mockResolvedValueOnce(
        createLLMResponse(JSON.stringify({ ok: true }))
      );
      await service.execute({
        prompt: 'test',
        context: uniqueContext(),
        options: { forceModel: 'gemini-2.5-flash' },
      });

      const stats = service.getStats();
      expect(stats.timeSavings).toContain('insufficient data');
    });
  });

  // -------------------------------------------------------------------------
  // clearCache tests
  // -------------------------------------------------------------------------
  describe('clearCache', () => {
    it('should clear cache without error', () => {
      const service = new LLMService('test-key');
      expect(() => service.clearCache()).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // resetMetrics tests
  // -------------------------------------------------------------------------
  describe('resetMetrics', () => {
    it('should reset all metrics to zero', async () => {
      const service = new LLMService('test-key');

      // Make a request first
      mockGenerateContent.mockResolvedValueOnce(
        createLLMResponse(JSON.stringify({ ok: true }))
      );
      await service.execute({
        prompt: 'test',
        context: uniqueContext(),
      });

      // Verify stats are non-zero
      const beforeReset = service.getStats();
      expect(beforeReset.totalRequests).toBeGreaterThan(0);

      // Reset
      service.resetMetrics();

      const afterReset = service.getStats();
      expect(afterReset.totalRequests).toBe(0);
      expect(afterReset.modelUsage.flash).toBe(0);
      expect(afterReset.modelUsage.pro).toBe(0);
      expect(afterReset.reliability.totalRetries).toBe(0);
      expect(afterReset.performance.avgResponseTime).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // QuotaFailure detection
  // -------------------------------------------------------------------------
  describe('QuotaFailure detection', () => {
    it('should detect QuotaFailure in error details and retry', async () => {
      const service = new LLMService('test-key');

      mockGenerateContent
        .mockRejectedValueOnce(createQuotaError())
        .mockResolvedValueOnce(createLLMResponse(JSON.stringify({ ok: true })));

      const response = await service.execute({
        prompt: 'test',
        context: uniqueContext(),
        options: { maxRetries: 2, timeout: 5000 },
      });

      expect(response.success).toBe(true);
    }, 15000);
  });

  // -------------------------------------------------------------------------
  // Fallback retry logic
  // -------------------------------------------------------------------------
  describe('fallback retry logic', () => {
    it('should retry fallback model on rate limit error before succeeding', async () => {
      const service = new LLMService('test-key');

      // Primary fails with rate limit
      mockGenerateContent
        .mockRejectedValueOnce(createRateLimitError())
        // Fallback first attempt fails
        .mockRejectedValueOnce(createRateLimitError())
        // Fallback second attempt succeeds
        .mockResolvedValueOnce(createLLMResponse(JSON.stringify({ ok: true })));

      const response = await service.execute({
        prompt: 'test',
        context: uniqueContext(),
        options: { maxRetries: 2, timeout: 5000 },
      });

      expect(response.success).toBe(true);
      expect(response.metadata.fallbackUsed).toBe(true);
    }, 15000);

    it('should fail immediately on generic error (no retry, no fallback)', async () => {
      const service = new LLMService('test-key');

      mockGenerateContent.mockRejectedValueOnce(new Error('Network error'));

      const response = await service.execute({
        prompt: 'test',
        context: uniqueContext(),
        options: { maxRetries: 3, timeout: 5000 },
      });

      expect(response.success).toBe(false);
      expect(response.error).toBe('Network error');
      expect(response.metadata.fallbackUsed).toBe(false);
    }, 10000);
  });

  // -------------------------------------------------------------------------
  // Multiple sequential requests
  // -------------------------------------------------------------------------
  describe('sequential requests', () => {
    it('should handle multiple sequential requests', async () => {
      const service = new LLMService('test-key');

      mockGenerateContent
        .mockResolvedValueOnce(createLLMResponse(JSON.stringify({ r: 1 })))
        .mockResolvedValueOnce(createLLMResponse(JSON.stringify({ r: 2 })));

      const r1 = await service.execute({ prompt: 'p1', context: uniqueContext() });
      const r2 = await service.execute({ prompt: 'p2', context: uniqueContext() });

      expect(r1.success).toBe(true);
      expect(r2.success).toBe(true);
    });
  });
});
