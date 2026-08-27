/**
 * REQ-304 TC-304-04: behavioral pin for the `?? DEFAULT_RETRY_OPTIONS.maxRetries`
 * fallback in LLMService.execute (src/analysis/llm-service.ts).
 *
 * Round 9 (bc73ebde) replaced the `|| 3` fallback with `??` so an explicit
 * `maxRetries: 0` ("fail fast, never retry") is no longer coerced back to 3.
 * This file pins that BEHAVIOR — the round-9 guard test
 * (tests/guards/analysis-retry-defaults-single-source.test.ts) pins the
 * value/import wiring, not the zero-passthrough.
 *
 * Mutation check: reverting `??` to `||` at the fallback site must fail the
 * first test (0 attempts becomes 3) — verified RED during authoring.
 */

import { jest } from '@jest/globals';
// NOTE: LLMService is imported dynamically (below, AFTER jest.unstable_mockModule)
// because under native ESM `jest.mock()` is a no-op and static imports are
// hoisted above the mock registration. See [[jest-esm-mock-pattern]].

const mockGenerateContent = jest.fn<() => Promise<unknown>>();
const mockGetGenerativeModel = jest.fn(() => ({
  generateContent: mockGenerateContent,
  generateContentStream: jest.fn(),
}));

jest.unstable_mockModule('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn<(...args: unknown[]) => unknown>().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}));

jest.unstable_mockModule('@/analysis/llm-cache', () => ({
  // llm-service imports this named export alongside LLMCache — ESM mock
  // must re-export it or the SUT import fails hard.
  LLM_SERVICE_CACHE_NAMESPACE: 'unified-llm-service',
  LLMCache: jest.fn<(...args: unknown[]) => unknown>().mockImplementation(() => {
    const store = new Map<string, unknown>();
    return {
      get: jest.fn(() => store.get('k') ?? null),
      set: jest.fn((key: string, data: unknown) => { store.set(key, data); }),
      getStats: jest.fn(() => ({ size: 0, validEntries: 0, totalHits: 0, avgHitsPerEntry: 0, hitRate: 0 })),
      clear: jest.fn(() => store.clear()),
    };
  }),
}));

const { LLMService } = await import('@/analysis/llm-service');
// Import the real default so the "omitted" case is pinned against the SAME
// source the production fallback reads — not a duplicated literal.
const { DEFAULT_RETRY_OPTIONS } = await import('@/analysis/retry-strategy');

function createRateLimitError(): Error {
  const err = new Error('Rate limit exceeded');
  (err as unknown as Record<string, unknown>).status = 429;
  return err;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('LLMService.execute maxRetries fallback semantics (`??`, not `||`)', () => {
  it('explicit maxRetries: 0 makes ZERO API calls and fails immediately (zero is a legit value)', async () => {
    const service = new LLMService('test-key');
    // Persistent rate-limit: if the request were attempted, it would retry.
    mockGenerateContent.mockRejectedValue(createRateLimitError());

    const response = await service.execute({
      prompt: 'fail-fast',
      context: 'max-retries-zero-1',
      options: { maxRetries: 0, timeout: 1000 },
    });

    // The `??` semantics: 0 is not replaced by the default 3. Both the
    // primary loop AND the fallback loop are skipped entirely.
    expect(mockGenerateContent).not.toHaveBeenCalled();
    expect(response.success).toBe(false);
    expect(response.error).toContain('retries exhausted');
    expect(response.metadata.retryCount).toBe(0);
  });

  it('omitted maxRetries falls back to DEFAULT_RETRY_OPTIONS.maxRetries (3 primary + 3 fallback attempts)', async () => {
    const service = new LLMService('test-key');
    mockGenerateContent.mockRejectedValue(createRateLimitError());

    const response = await service.execute({
      prompt: 'default-retries',
      context: 'max-retries-zero-2',
      options: { timeout: 1000 },
    });

    expect(response.success).toBe(false);
    expect(DEFAULT_RETRY_OPTIONS.maxRetries).toBe(3);
    // primary 3 attempts + fallback 3 attempts
    expect(mockGenerateContent).toHaveBeenCalledTimes(6);
    expect(response.metadata.retryCount).toBe(6);
  });
});
