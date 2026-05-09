/**
 * REQ-098: LLM Monitoring Integration Tests
 *
 * Verifies that token-usage-tracker, cost-estimator, and budget-alert
 * are correctly wired into the Gemini API call paths in LLMService.
 *
 * Covers:
 *  1. Token usage is recorded from Gemini API usageMetadata
 *  2. Cost is calculated and accumulated per request
 *  3. Budget alerts fire when session threshold is exceeded
 *  4. Response metadata includes tokenUsage and estimatedCost
 *  5. Streaming responses also capture usage metadata
 *  6. Cache hits do NOT record token usage
 *  7. Fallback responses are recorded with 'fallback' stage
 *  8. Accessor methods (getTokenSummary, getCostEstimate, etc.) return correct data
 */

import { LLMService } from '@/analysis/llm-service';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

const mockGenerateContent = jest.fn();
const mockGenerateContentStream = jest.fn();
const mockGetGenerativeModel = jest.fn(() => ({
  generateContent: mockGenerateContent,
  generateContentStream: mockGenerateContentStream,
}));

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}));

jest.mock('@/analysis/llm-cache', () => {
  return {
    LLMCache: jest.fn().mockImplementation(() => {
      const store = new Map<string, unknown>();
      return {
        get: jest.fn((key: string) => store.get(key) ?? null),
        set: jest.fn((key: string, data: unknown) => { store.set(key, data); }),
        getStats: jest.fn(() => ({
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
        clear: jest.fn(() => store.clear()),
      };
    }),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createGeminiResponse(text: string, usage?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number }) {
  return {
    response: {
      text: () => text,
      usageMetadata: usage,
    },
  };
}

function createStreamResponse(chunks: string[], usage?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number }) {
  const mockStream = (async function* () {
    for (const chunk of chunks) {
      yield { text: () => chunk };
    }
  })();

  // The streaming result has both .stream and .response
  const responsePromise = Promise.resolve({
    text: () => chunks.join(''),
    usageMetadata: usage,
  });

  return { stream: mockStream, response: responsePromise };
}

let contextCounter = 0;
function uniqueContext(prefix = 'ctx') {
  return `${prefix}-${++contextCounter}-${Date.now()}`;
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockGenerateContent.mockReset();
  mockGenerateContentStream.mockReset();
  mockGetGenerativeModel.mockClear();
});

afterEach(() => {
  delete process.env.ANALYSIS_DISABLE_GEMINI;
  delete process.env.GOOGLE_API_KEY;
});

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('REQ-098: LLM Monitoring Integration', () => {
  // -------------------------------------------------------------------------
  // Test 1: Token usage recorded from Gemini API usageMetadata
  // -------------------------------------------------------------------------
  describe('Token usage recording', () => {
    it('records input/output tokens from Gemini API response', async () => {
      const service = new LLMService('test-key');

      mockGenerateContent.mockResolvedValue(
        createGeminiResponse('{"result":"ok"}', {
          promptTokenCount: 1500,
          candidatesTokenCount: 500,
          totalTokenCount: 2000,
        })
      );

      await service.execute({
        prompt: 'test prompt',
        context: uniqueContext(),
        parser: (t: string) => t,
      });

      const summary = service.getTokenSummary();
      expect(summary.totalInputTokens).toBe(1500);
      expect(summary.totalOutputTokens).toBe(500);
      expect(summary.totalTokens).toBe(2000);
      expect(summary.recordCount).toBe(1);
    });

    it('records tokens by model type (flash vs pro)', async () => {
      const service = new LLMService('test-key');

      // Flash call
      mockGenerateContent.mockResolvedValueOnce(
        createGeminiResponse('{"result":"ok"}', {
          promptTokenCount: 1000,
          candidatesTokenCount: 200,
          totalTokenCount: 1200,
        })
      );

      await service.execute({
        prompt: 'simple prompt',
        context: uniqueContext(),
        options: { forceModel: 'gemini-2.5-flash' },
        parser: (t: string) => t,
      });

      // Pro call
      mockGenerateContent.mockResolvedValueOnce(
        createGeminiResponse('{"result":"ok"}', {
          promptTokenCount: 5000,
          candidatesTokenCount: 1000,
          totalTokenCount: 6000,
        })
      );

      await service.execute({
        prompt: 'complex prompt',
        context: uniqueContext(),
        options: { forceModel: 'gemini-2.5-pro' },
        parser: (t: string) => t,
      });

      const summary = service.getTokenSummary();
      expect(summary.byModel['gemini-2.5-flash'].totalTokens).toBe(1200);
      expect(summary.byModel['gemini-2.5-pro'].totalTokens).toBe(6000);
      expect(summary.recordCount).toBe(2);
    });

    it('records tokens by stage', async () => {
      const service = new LLMService('test-key');

      // Analysis stage
      mockGenerateContent.mockResolvedValueOnce(
        createGeminiResponse('{"result":"ok"}', {
          promptTokenCount: 1000,
          candidatesTokenCount: 200,
          totalTokenCount: 1200,
        })
      );

      await service.execute({
        prompt: 'analyze',
        context: uniqueContext(),
        stage: 'analysis',
        parser: (t: string) => t,
      });

      // Cache-warmup stage
      mockGenerateContent.mockResolvedValueOnce(
        createGeminiResponse('{"result":"ok"}', {
          promptTokenCount: 500,
          candidatesTokenCount: 100,
          totalTokenCount: 600,
        })
      );

      await service.execute({
        prompt: 'warmup',
        context: uniqueContext(),
        stage: 'cache-warmup',
        parser: (t: string) => t,
      });

      const summary = service.getTokenSummary();
      expect(summary.byStage.analysis.totalTokens).toBe(1200);
      expect(summary.byStage['cache-warmup'].totalTokens).toBe(600);
    });
  });

  // -------------------------------------------------------------------------
  // Test 2: Cost calculation and accumulation
  // -------------------------------------------------------------------------
  describe('Cost estimation', () => {
    it('calculates cost per request', async () => {
      const service = new LLMService('test-key');

      // Flash: 10K input, 2K output => $0.00135
      mockGenerateContent.mockResolvedValue(
        createGeminiResponse('{"result":"ok"}', {
          promptTokenCount: 10000,
          candidatesTokenCount: 2000,
          totalTokenCount: 12000,
        })
      );

      await service.execute({
        prompt: 'test',
        context: uniqueContext(),
        options: { forceModel: 'gemini-2.5-flash' },
        parser: (t: string) => t,
      });

      const estimate = service.getCostEstimate();
      expect(estimate.flashCost).toBeCloseTo(0.00135, 8);
      expect(estimate.totalCost).toBeCloseTo(0.00135, 8);
    });

    it('accumulates costs across multiple calls', async () => {
      const service = new LLMService('test-key');

      // Call 1: Flash 10K/2K => $0.00135
      mockGenerateContent.mockResolvedValueOnce(
        createGeminiResponse('{"r":"ok"}', {
          promptTokenCount: 10000,
          candidatesTokenCount: 2000,
        })
      );
      await service.execute({
        prompt: 'test1',
        context: uniqueContext(),
        options: { forceModel: 'gemini-2.5-flash' },
        parser: (t: string) => t,
      });

      // Call 2: Pro 1K/500 => $0.00375
      mockGenerateContent.mockResolvedValueOnce(
        createGeminiResponse('{"r":"ok"}', {
          promptTokenCount: 1000,
          candidatesTokenCount: 500,
        })
      );
      await service.execute({
        prompt: 'test2',
        context: uniqueContext(),
        options: { forceModel: 'gemini-2.5-pro' },
        parser: (t: string) => t,
      });

      const totals = service.getCostTotals();
      expect(totals.session).toBeCloseTo(0.00135 + 0.00375, 8);
    });
  });

  // -------------------------------------------------------------------------
  // Test 3: Budget alerts
  // -------------------------------------------------------------------------
  describe('Budget alerts', () => {
    it('fires budget alert callback when threshold exceeded', async () => {
      const service = new LLMService('test-key');

      const receivedAlerts: unknown[] = [];
      service.onBudgetAlert((alert) => receivedAlerts.push(alert));

      // Make enough calls to exceed the default $1.00 session budget at 80% = $0.80
      // Pro: 1M input / 400K output = $1.25 + $2.00 = $3.25 per call
      mockGenerateContent.mockResolvedValue(
        createGeminiResponse('{"r":"ok"}', {
          promptTokenCount: 1_000_000,
          candidatesTokenCount: 400_000,
        })
      );

      await service.execute({
        prompt: 'big call',
        context: uniqueContext(),
        options: { forceModel: 'gemini-2.5-pro' },
        parser: (t: string) => t,
      });

      // A single call with 1M input + 400K output at Pro pricing = $3.25
      // This exceeds $0.80 (80% of $1.00) so alert should fire
      expect(receivedAlerts.length).toBeGreaterThanOrEqual(1);

      const alerts = service.getBudgetAlerts();
      expect(alerts.session.length).toBeGreaterThanOrEqual(1);
      expect(alerts.session[0].type).toBe('session');
    });
  });

  // -------------------------------------------------------------------------
  // Test 4: Response metadata includes tokenUsage and estimatedCost
  // -------------------------------------------------------------------------
  describe('Response metadata', () => {
    it('includes tokenUsage in response metadata', async () => {
      const service = new LLMService('test-key');

      mockGenerateContent.mockResolvedValue(
        createGeminiResponse('{"result":"ok"}', {
          promptTokenCount: 1500,
          candidatesTokenCount: 500,
          totalTokenCount: 2000,
        })
      );

      const response = await service.execute({
        prompt: 'test',
        context: uniqueContext(),
        parser: (t: string) => t,
      });

      expect(response.metadata.tokenUsage).toBeDefined();
      expect(response.metadata.tokenUsage?.inputTokens).toBe(1500);
      expect(response.metadata.tokenUsage?.outputTokens).toBe(500);
      expect(response.metadata.tokenUsage?.totalTokens).toBe(2000);
    });

    it('includes estimatedCost in response metadata', async () => {
      const service = new LLMService('test-key');

      mockGenerateContent.mockResolvedValue(
        createGeminiResponse('{"result":"ok"}', {
          promptTokenCount: 10000,
          candidatesTokenCount: 2000,
        })
      );

      const response = await service.execute({
        prompt: 'test',
        context: uniqueContext(),
        options: { forceModel: 'gemini-2.5-flash' },
        parser: (t: string) => t,
      });

      expect(response.metadata.estimatedCost).toBeDefined();
      expect(response.metadata.estimatedCost?.totalCost).toBeCloseTo(0.00135, 8);
    });

    it('omits tokenUsage when API does not return usageMetadata', async () => {
      const service = new LLMService('test-key');

      // Response without usageMetadata
      mockGenerateContent.mockResolvedValue({
        response: { text: () => '{"result":"ok"}' },
      });

      const response = await service.execute({
        prompt: 'test',
        context: uniqueContext(),
        parser: (t: string) => t,
      });

      expect(response.metadata.tokenUsage).toBeUndefined();
      expect(response.metadata.estimatedCost).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Test 5: Streaming responses capture usage metadata
  // -------------------------------------------------------------------------
  describe('Streaming monitoring', () => {
    it('records token usage from streaming responses', async () => {
      const service = new LLMService('test-key');

      mockGenerateContentStream.mockReturnValue(
        createStreamResponse(['{"res', 'ult":"ok"}'], {
          promptTokenCount: 2000,
          candidatesTokenCount: 800,
          totalTokenCount: 2800,
        })
      );

      await service.execute({
        prompt: 'stream test',
        context: uniqueContext(),
        options: { enableStreaming: true, onStream: jest.fn() },
        parser: (t: string) => t,
      });

      const summary = service.getTokenSummary();
      expect(summary.totalInputTokens).toBe(2000);
      expect(summary.totalOutputTokens).toBe(800);
      expect(summary.recordCount).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Test 6: Cache hits do NOT record token usage
  // -------------------------------------------------------------------------
  describe('Cache behavior', () => {
    it('does not record tokens on cache hit', async () => {
      const service = new LLMService('test-key');

      const ctx = uniqueContext('cache');

      // First call: actual API call
      mockGenerateContent.mockResolvedValueOnce(
        createGeminiResponse('{"result":"ok"}', {
          promptTokenCount: 1000,
          candidatesTokenCount: 300,
        })
      );

      await service.execute({
        prompt: 'cache test',
        context: ctx,
        parser: (t: string) => t,
      });

      // Second call with same context: cache hit
      const response = await service.execute({
        prompt: 'cache test',
        context: ctx,
        parser: (t: string) => t,
      });

      expect(response.metadata.fromCache).toBe(true);
      expect(response.metadata.tokenUsage).toBeUndefined();

      const summary = service.getTokenSummary();
      expect(summary.recordCount).toBe(1); // Only the first call recorded
    });
  });

  // -------------------------------------------------------------------------
  // Test 7: Fallback responses recorded with 'fallback' stage
  // -------------------------------------------------------------------------
  describe('Fallback monitoring', () => {
    it('records fallback calls with fallback stage', async () => {
      const service = new LLMService('test-key');

      // Primary model fails with rate limit, fallback succeeds
      const rateLimitErr = new Error('Rate limit');
      (rateLimitErr as unknown as Record<string, unknown>).status = 429;

      // All primary attempts fail
      mockGenerateContent
        .mockRejectedValueOnce(rateLimitErr)
        .mockRejectedValueOnce(rateLimitErr)
        .mockRejectedValueOnce(rateLimitErr)
        // Fallback succeeds with usage metadata
        .mockResolvedValueOnce(
          createGeminiResponse('{"result":"fallback"}', {
            promptTokenCount: 3000,
            candidatesTokenCount: 1000,
          })
        );

      const response = await service.execute({
        prompt: 'fallback test',
        context: uniqueContext(),
        options: {
          forceModel: 'gemini-2.5-pro',
          maxRetries: 3,
        },
        parser: (t: string) => t,
      });

      expect(response.success).toBe(true);
      expect(response.metadata.fallbackUsed).toBe(true);

      const summary = service.getTokenSummary();
      expect(summary.recordCount).toBe(1);
      expect(summary.byStage.fallback.totalTokens).toBe(4000);
    });
  });

  // -------------------------------------------------------------------------
  // Test 8: resetMetrics clears monitoring state
  // -------------------------------------------------------------------------
  describe('Reset behavior', () => {
    it('resets token tracker and budget on resetMetrics', async () => {
      const service = new LLMService('test-key');

      mockGenerateContent.mockResolvedValue(
        createGeminiResponse('{"r":"ok"}', {
          promptTokenCount: 1000,
          candidatesTokenCount: 200,
        })
      );

      await service.execute({
        prompt: 'test',
        context: uniqueContext(),
        parser: (t: string) => t,
      });

      expect(service.getTokenSummary().recordCount).toBe(1);

      service.resetMetrics();

      expect(service.getTokenSummary().recordCount).toBe(0);
      expect(service.getCostTotals().session).toBe(0);
    });
  });
});
