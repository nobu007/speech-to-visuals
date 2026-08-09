/**
 * Regression: per-model response-time arrays must be capped at MAX_HISTORY_SIZE.
 *
 * `modelMetrics.flashResponseTimes` / `proResponseTimes` are pushed once per
 * Gemini call on the module-level `llmService` singleton (imported by the API
 * server). Their sibling `responseTimeHistory` is capped at MAX_HISTORY_SIZE
 * (=20) via `recordResponseTime`, but the per-model arrays were not — they grew
 * unboundedly on a long-lived process. Same "missed sibling" capacity class as
 * LLMCache vs IntelligentCache.
 *
 * This test is RED-on-revert: without the cap, avgFlashTime reflects all 25
 * samples (400); with the cap, only the last 20 (250).
 *
 * See [[jest-esm-mock-pattern]]: under native ESM `jest.mock()` is a no-op, so
 * we register module mocks with `jest.unstable_mockModule` BEFORE importing the
 * SUT dynamically.
 */
import { jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// Mock dependencies (must precede the dynamic SUT import)
// ---------------------------------------------------------------------------

const mockGenerateContent = jest.fn();
const mockGetGenerativeModel = jest.fn(() => ({
  generateContent: mockGenerateContent,
  generateContentStream: jest.fn(),
}));

jest.unstable_mockModule('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}));

jest.unstable_mockModule('@/analysis/llm-cache', () => ({
  LLMCache: jest.fn().mockImplementation(() => {
    const store = new Map<string, unknown>();
    return {
      get: jest.fn((key: string) => store.get(key) ?? null),
      set: jest.fn((key: string, data: unknown) => {
        store.set(key, data);
      }),
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
}));

const { LLMService } = await import('../llm-service');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createLLMResponse(text: string) {
  return { response: { text: () => text } };
}

describe('LLMService per-model response-time cap', () => {
  let dateNowSpy: jest.SpyInstance;
  let currentTime: number;
  let consoleInfoSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerateContent.mockReset();
    mockGetGenerativeModel.mockClear();

    // Drive `responseTime = Date.now() - startTime` deterministically. The
    // generateContent mock advances `currentTime` by a per-call delta before
    // resolving, so each call's recorded responseTime equals that delta.
    currentTime = 5_000_000;
    dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => currentTime);

    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    delete process.env.ANALYSIS_DISABLE_GEMINI;
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    delete process.env.ANALYSIS_DISABLE_GEMINI;
    delete process.env.GOOGLE_API_KEY;
  });

  it('caps flashResponseTimes at MAX_HISTORY_SIZE, mirroring responseTimeHistory', async () => {
    const service = new LLMService('test-key');

    // 5 large then 20 small = 25 calls (> MAX_HISTORY_SIZE = 20).
    // SMALL (250ms) >= MIN_REQUEST_INTERVAL (200ms) so the rate limiter never
    // waits; the deltas only differ enough to separate the capped vs uncapped
    // averages.
    const BIG = 1000;
    const SMALL = 250;
    const deltas = [
      ...Array.from({ length: 5 }, () => BIG),
      ...Array.from({ length: 20 }, () => SMALL),
    ];

    let callIdx = 0;
    mockGenerateContent.mockImplementation(() => {
      currentTime += deltas[callIdx++] ?? SMALL;
      return Promise.resolve(createLLMResponse(JSON.stringify({ ok: true })));
    });

    for (let i = 0; i < deltas.length; i++) {
      const res = await service.execute({
        prompt: 'p',
        // Unique context per call -> cache miss -> generateContent runs -> push.
        context: `ctx-cap-${i}`,
        options: { forceModel: 'gemini-2.5-flash' },
      });
      expect(res.success).toBe(true);
    }

    const stats = service.getStats();

    // Capped (last 20, all SMALL=250): avgFlashTime = 250.
    // Revert (all 25: 5*1000 + 20*250 = 10000 / 25): avgFlashTime = 400.
    expect(stats.performance.avgFlashTime).toBe(250);
  });

  it('caps proResponseTimes at MAX_HISTORY_SIZE (symmetric branch)', async () => {
    const service = new LLMService('test-key');

    const BIG = 1000;
    const SMALL = 250;
    const deltas = [
      ...Array.from({ length: 5 }, () => BIG),
      ...Array.from({ length: 20 }, () => SMALL),
    ];

    let callIdx = 0;
    mockGenerateContent.mockImplementation(() => {
      currentTime += deltas[callIdx++] ?? SMALL;
      return Promise.resolve(createLLMResponse(JSON.stringify({ ok: true })));
    });

    for (let i = 0; i < deltas.length; i++) {
      const res = await service.execute({
        prompt: 'p',
        context: `ctx-pro-cap-${i}`,
        options: { forceModel: 'gemini-2.5-pro' },
      });
      expect(res.success).toBe(true);
    }

    const stats = service.getStats();
    // Same reasoning as the flash case — pro branch uses the identical cap.
    expect(stats.performance.avgProTime).toBe(250);
  });
});
