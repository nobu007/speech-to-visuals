/**
 * Tests for TASK-0018: Three-Layer Fallback Chain
 */

import {
  FallbackChain,
  type AnalysisRequest,
  type AnalysisResult,
  type FallbackStats,
} from '../fallback-chain';

// Helper to create a mock layer executor
function createMockExecutor(
  behavior: 'success' | 'fail',
  resultOverrides?: Partial<AnalysisResult>
): (request: AnalysisRequest) => Promise<AnalysisResult> {
  const baseResult: AnalysisResult = {
    diagramType: 'flow',
    entities: [{ id: 'node-0', label: 'Test' }],
    relations: [],
    summary: 'Test result',
    confidence: 0.9,
    metadata: {
      layer: 'primary',
      responseTime: 100,
      retriesUsed: 0,
    },
    ...resultOverrides,
  };

  return async () => {
    if (behavior === 'fail') {
      throw new Error('Layer failed');
    }
    return { ...baseResult, metadata: { ...baseResult.metadata } };
  };
}

// Helper to create a delayed executor
function createDelayedExecutor(
  delayMs: number,
  behavior: 'success' | 'fail'
): (request: AnalysisRequest) => Promise<AnalysisResult> {
  return async (request: AnalysisRequest) => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    if (behavior === 'fail') {
      throw new Error('Layer failed after delay');
    }
    return {
      diagramType: 'flow',
      entities: [{ id: 'node-0', label: 'Test' }],
      relations: [],
      summary: 'Test result',
      confidence: 0.9,
      metadata: {
        layer: 'primary',
        responseTime: delayMs,
        retriesUsed: 0,
      },
    };
  };
}

describe('FallbackChain', () => {
  const request: AnalysisRequest = {
    text: 'テスト用テキストです。',
  };

  // === Test Case 1: Layer 1 Success ===

  describe('Layer 1 (Primary) success', () => {
    it('should return Layer 1 result when Primary succeeds', async () => {
      const chain = new FallbackChain(
        createMockExecutor('success', { metadata: { layer: 'primary', responseTime: 50, retriesUsed: 0 } }),
        createMockExecutor('success', { metadata: { layer: 'fallback', responseTime: 50, retriesUsed: 0 } }),
        createMockExecutor('success', { metadata: { layer: 'rule-based', responseTime: 5, retriesUsed: 0 } }),
        { maxRetries: 1, baseDelay: 1, maxDelay: 10 }
      );

      const result = await chain.execute(request);

      expect(result.metadata.layer).toBe('primary');
    });
  });

  // === Test Case 2: Layer 1 → Layer 2 Fallback ===

  describe('Layer 1 → Layer 2 fallback', () => {
    it('should fallback to Layer 2 when Layer 1 fails', async () => {
      const chain = new FallbackChain(
        createMockExecutor('fail'),
        createMockExecutor('success', { metadata: { layer: 'fallback', responseTime: 50, retriesUsed: 0 } }),
        createMockExecutor('success', { metadata: { layer: 'rule-based', responseTime: 5, retriesUsed: 0 } }),
        { maxRetries: 0, baseDelay: 1, maxDelay: 10 }
      );

      const result = await chain.execute(request);

      expect(result.metadata.layer).toBe('fallback');
    });
  });

  // === Test Case 3: Full Fallback (L1 → L2 → L3) ===

  describe('Layer 1 → Layer 2 → Layer 3 fallback', () => {
    it('should fallback to Layer 3 when L1 and L2 fail', async () => {
      const chain = new FallbackChain(
        createMockExecutor('fail'),
        createMockExecutor('fail'),
        createMockExecutor('success', { metadata: { layer: 'rule-based', responseTime: 5, retriesUsed: 0 } }),
        { maxRetries: 0, baseDelay: 1, maxDelay: 10 }
      );

      const result = await chain.execute(request);

      expect(result.metadata.layer).toBe('rule-based');
    });
  });

  // === Test Case 4: 100% Success Rate ===

  describe('100% success rate guarantee', () => {
    it('should always return a result even when all LLM layers fail', async () => {
      const chain = new FallbackChain(
        createMockExecutor('fail'),
        createMockExecutor('fail'),
        createMockExecutor('success', {
          diagramType: 'flow',
          entities: [{ id: 'node-0', label: 'Fallback result' }],
          relations: [],
          summary: 'Rule-based fallback',
          confidence: 0.5,
          metadata: { layer: 'rule-based', responseTime: 1, retriesUsed: 0 },
        }),
        { maxRetries: 0, baseDelay: 1, maxDelay: 10 }
      );

      const result = await chain.execute(request);

      expect(result).toBeDefined();
      expect(result.diagramType).toBe('flow');
      expect(result.entities.length).toBeGreaterThan(0);
    });
  });

  // === Test Case 5: Retry Limit ===

  describe('Retry limit handling', () => {
    it('should respect retry limits before falling back', async () => {
      let primaryCallCount = 0;

      const primaryWithRetryableError = async () => {
        primaryCallCount++;
        const err = new Error('Rate limited');
        (err as any).status = 429;
        throw err;
      };

      const chain = new FallbackChain(
        primaryWithRetryableError,
        createMockExecutor('success', { metadata: { layer: 'fallback', responseTime: 50, retriesUsed: 0 } }),
        createMockExecutor('success', { metadata: { layer: 'rule-based', responseTime: 5, retriesUsed: 0 } }),
        { maxRetries: 2, baseDelay: 1, maxDelay: 10 }
      );

      const result = await chain.execute(request);

      // Primary should be called maxRetries + 1 times (initial + retries)
      expect(primaryCallCount).toBe(3); // 1 initial + 2 retries
      expect(result.metadata.layer).toBe('fallback');
    });
  });

  // === Test Case 6: Statistics ===

  describe('Statistics tracking', () => {
    it('should track stats across multiple requests', async () => {
      const chain = new FallbackChain(
        createMockExecutor('success', { metadata: { layer: 'primary', responseTime: 50, retriesUsed: 0 } }),
        createMockExecutor('success', { metadata: { layer: 'fallback', responseTime: 50, retriesUsed: 0 } }),
        createMockExecutor('success', { metadata: { layer: 'rule-based', responseTime: 5, retriesUsed: 0 } }),
        { maxRetries: 0, baseDelay: 1, maxDelay: 10 }
      );

      // Execute 10 requests - 7 primary, 2 fallback, 1 rule-based
      const primaryCount = 0;
      const fallbackCount = 0;

      for (let i = 0; i < 10; i++) {
        // Create a chain with specific behavior per iteration
        const testChain = new FallbackChain(
          i < 7
            ? createMockExecutor('success', { metadata: { layer: 'primary', responseTime: 50, retriesUsed: 0 } })
            : createMockExecutor('fail'),
          i >= 7 && i < 9
            ? createMockExecutor('success', { metadata: { layer: 'fallback', responseTime: 50, retriesUsed: 0 } })
            : i < 7
              ? createMockExecutor('success', { metadata: { layer: 'fallback', responseTime: 50, retriesUsed: 0 } })
              : createMockExecutor('fail'),
          createMockExecutor('success', { metadata: { layer: 'rule-based', responseTime: 5, retriesUsed: 0 } }),
          { maxRetries: 0, baseDelay: 1, maxDelay: 10 }
        );

        await testChain.execute(request);
      }

      // The stats are per-chain, so test individual chains
      const statsChain = new FallbackChain(
        createMockExecutor('success', { metadata: { layer: 'primary', responseTime: 50, retriesUsed: 0 } }),
        createMockExecutor('success', { metadata: { layer: 'fallback', responseTime: 50, retriesUsed: 0 } }),
        createMockExecutor('success', { metadata: { layer: 'rule-based', responseTime: 5, retriesUsed: 0 } }),
        { maxRetries: 0, baseDelay: 1, maxDelay: 10 }
      );

      // Execute 3 primary successes
      for (let i = 0; i < 3; i++) {
        await statsChain.execute(request);
      }

      const stats = statsChain.getStats();
      expect(stats.totalRequests).toBe(3);
      expect(stats.primarySuccess).toBe(3);
      expect(stats.successRate).toBe(100);
    });

    it('should reset stats', async () => {
      const chain = new FallbackChain(
        createMockExecutor('success', { metadata: { layer: 'primary', responseTime: 50, retriesUsed: 0 } }),
        createMockExecutor('success', { metadata: { layer: 'fallback', responseTime: 50, retriesUsed: 0 } }),
        createMockExecutor('success', { metadata: { layer: 'rule-based', responseTime: 5, retriesUsed: 0 } }),
        { maxRetries: 0, baseDelay: 1, maxDelay: 10 }
      );

      await chain.execute(request);
      chain.resetStats();

      const stats = chain.getStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.primarySuccess).toBe(0);
      expect(stats.successRate).toBe(0);
    });
  });

  // === DISABLE_GEMINI Integration ===

  describe('DISABLE_GEMINI environment variable', () => {
    const originalEnv = process.env.ANALYSIS_DISABLE_GEMINI;

    afterEach(() => {
      if (originalEnv !== undefined) {
        process.env.ANALYSIS_DISABLE_GEMINI = originalEnv;
      } else {
        delete process.env.ANALYSIS_DISABLE_GEMINI;
      }
    });

    it('should use rule-based directly when DISABLE_GEMINI=1', async () => {
      process.env.ANALYSIS_DISABLE_GEMINI = '1';

      let primaryCalled = false;
      const trackPrimary = async () => {
        primaryCalled = true;
        return createMockExecutor('success')({ text: '' });
      };

      const chain = new FallbackChain(
        trackPrimary,
        createMockExecutor('success'),
        createMockExecutor('success', { metadata: { layer: 'rule-based', responseTime: 5, retriesUsed: 0 } }),
        { maxRetries: 0, baseDelay: 1, maxDelay: 10 }
      );

      await chain.execute(request);
      expect(primaryCalled).toBe(false);

      delete process.env.ANALYSIS_DISABLE_GEMINI;
    });
  });
});
