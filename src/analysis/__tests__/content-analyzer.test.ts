/**
 * Comprehensive tests for ContentAnalyzer (content-analyzer.ts)
 *
 * Covers:
 * - analyzeV1 (rule-based analysis)
 * - analyzeV2 (LLM-based analysis via LLMService)
 * - execute (delegates to analyzeV2)
 * - setLanguage
 * - getStats (delegated to LLMService)
 * - Constructor variations
 * - Edge cases: empty input, LLM disabled, invalid response structure
 */

import { ContentAnalyzer } from '../content-analyzer';
import { LLMService } from '../llm-service';
import type { DiagramData } from '../types';

// ---------------------------------------------------------------------------
// Mock LLMService
// ---------------------------------------------------------------------------

function createMockLLMService(options?: {
  enabled?: boolean;
  responseData?: DiagramData;
  shouldFail?: boolean;
}): LLMService {
  const enabled = options?.enabled ?? true;
  const responseData = options?.responseData ?? {
    title: 'Test Diagram',
    type: 'flowchart' as const,
    nodes: [
      { id: 'n1', label: 'Node 1' },
      { id: 'n2', label: 'Node 2' },
    ],
    edges: [{ from: 'n1', to: 'n2' }],
  };

  const mock = {
    isEnabled: vi.fn().mockReturnValue(enabled),
    execute: vi.fn().mockImplementation(async () => {
      if (options?.shouldFail) {
        return {
          success: false,
          error: 'LLM call failed',
          metadata: {
            model: 'none',
            responseTime: 0,
            fromCache: false,
            retryCount: 0,
            fallbackUsed: false,
          },
        };
      }
      return {
        success: true,
        data: responseData,
        metadata: {
          model: 'gemini-2.5-flash',
          responseTime: 100,
          fromCache: false,
          complexity: { score: 0.1, level: 'simple', recommendedModel: 'gemini-2.5-flash' },
          retryCount: 0,
          fallbackUsed: false,
        },
      };
    }),
    getStats: vi.fn().mockReturnValue({
      totalRequests: 1,
      cacheHits: 0,
      cacheMisses: 1,
      cacheHitRate: 0,
      modelUsage: { flash: 1, pro: 0, flashPercent: 100 },
      performance: { avgResponseTime: 100, avgFlashTime: 50, avgProTime: 0, p50: 100, p95: 100, p99: 100 },
      reliability: { successRate: 100, fallbackRate: 0, totalRetries: 0 },
      timeSavings: '0s',
    }),
  };
  return mock as unknown as LLMService;
}

// Suppress console output during tests
let consoleLogSpy: vi.SpyInstance;
let consoleWarnSpy: vi.SpyInstance;

beforeEach(() => {
  vi.clearAllMocks();
  consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  consoleLogSpy.mockRestore();
  consoleWarnSpy.mockRestore();
});

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('ContentAnalyzer', () => {
  // -------------------------------------------------------------------------
  // Constructor tests
  // -------------------------------------------------------------------------
  describe('constructor', () => {
    it('should create analyzer with API key', () => {
      const analyzer = new ContentAnalyzer('test-api-key');
      expect(analyzer).toBeDefined();
    });

    it('should create analyzer with provided LLMService instance', () => {
      const mockLLM = createMockLLMService();
      const analyzer = new ContentAnalyzer(undefined, mockLLM);
      expect(analyzer).toBeDefined();
    });

    it('should create analyzer with language preference', () => {
      const mockLLM = createMockLLMService();
      const analyzer = new ContentAnalyzer(undefined, mockLLM, 'ja');
      expect(analyzer).toBeDefined();
    });

    it('should default to auto language when not specified', () => {
      const mockLLM = createMockLLMService();
      const analyzer = new ContentAnalyzer(undefined, mockLLM);
      expect(analyzer).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // setLanguage tests
  // -------------------------------------------------------------------------
  describe('setLanguage', () => {
    it('should set language to Japanese', () => {
      const mockLLM = createMockLLMService();
      const analyzer = new ContentAnalyzer(undefined, mockLLM);
      analyzer.setLanguage('ja');
      // No error thrown
    });

    it('should set language to English', () => {
      const mockLLM = createMockLLMService();
      const analyzer = new ContentAnalyzer(undefined, mockLLM);
      analyzer.setLanguage('en');
    });

    it('should set language to auto', () => {
      const mockLLM = createMockLLMService();
      const analyzer = new ContentAnalyzer(undefined, mockLLM);
      analyzer.setLanguage('auto');
    });
  });

  // -------------------------------------------------------------------------
  // analyzeV1 (rule-based) tests
  // -------------------------------------------------------------------------
  describe('analyzeV1', () => {
    it('should split text by sentence delimiters', () => {
      const analyzer = new ContentAnalyzer('test-key');
      const result = analyzer.analyzeV1('First sentence. Second sentence. Third sentence.');

      expect(result.type).toBe('flowchart');
      expect(result.title).toBe('Auto-generated (rule-based)');
      expect(result.nodes).toHaveLength(3);
      expect(result.nodes[0].label).toBe('First sentence');
      expect(result.nodes[1].label).toBe('Second sentence');
      expect(result.nodes[2].label).toBe('Third sentence');
    });

    it('should create sequential edges between nodes', () => {
      const analyzer = new ContentAnalyzer('test-key');
      const result = analyzer.analyzeV1('Step A. Step B. Step C.');

      expect(result.edges).toHaveLength(2);
      expect(result.edges[0]).toEqual({ from: 'n1', to: 'n2' });
      expect(result.edges[1]).toEqual({ from: 'n2', to: 'n3' });
    });

    it('should handle Japanese text with Japanese period delimiter', () => {
      const analyzer = new ContentAnalyzer('test-key');
      const result = analyzer.analyzeV1('最初の文。二番目の文。三番目の文。');

      expect(result.nodes).toHaveLength(3);
      expect(result.nodes[0].label).toBe('最初の文');
    });

    it('should handle newline delimiters', () => {
      const analyzer = new ContentAnalyzer('test-key');
      const result = analyzer.analyzeV1('Line one\nLine two\nLine three');

      expect(result.nodes).toHaveLength(3);
    });

    it('should handle mixed delimiters', () => {
      const analyzer = new ContentAnalyzer('test-key');
      const result = analyzer.analyzeV1('First. Second\nThird? Fourth!');

      expect(result.nodes).toHaveLength(4);
    });

    it('should limit to 10 sentences', () => {
      const analyzer = new ContentAnalyzer('test-key');
      const text = Array.from({ length: 15 }, (_, i) => `Sentence ${i + 1}`).join('. ');
      const result = analyzer.analyzeV1(text);

      expect(result.nodes).toHaveLength(10);
    });

    it('should truncate long sentences to 60 characters', () => {
      const analyzer = new ContentAnalyzer('test-key');
      const longSentence = 'A'.repeat(100);
      const result = analyzer.analyzeV1(longSentence);

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].label.length).toBeLessThanOrEqual(60);
      // Should end with ellipsis
      expect(result.nodes[0].label).toContain('\u2026'); // ellipsis character
    });

    it('should keep short sentences unchanged', () => {
      const analyzer = new ContentAnalyzer('test-key');
      const result = analyzer.analyzeV1('Short text.');

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].label).toBe('Short text');
    });

    it('should handle empty string', () => {
      const analyzer = new ContentAnalyzer('test-key');
      const result = analyzer.analyzeV1('');

      expect(result.nodes).toHaveLength(0);
      expect(result.edges).toHaveLength(0);
    });

    it('should handle whitespace-only string', () => {
      const analyzer = new ContentAnalyzer('test-key');
      const result = analyzer.analyzeV1('   \n\t  ');

      expect(result.nodes).toHaveLength(0);
    });

    it('should produce correct node IDs (n1, n2, etc)', () => {
      const analyzer = new ContentAnalyzer('test-key');
      const result = analyzer.analyzeV1('A. B. C.');

      expect(result.nodes[0].id).toBe('n1');
      expect(result.nodes[1].id).toBe('n2');
      expect(result.nodes[2].id).toBe('n3');
    });

    it('should handle single sentence with no edges', () => {
      const analyzer = new ContentAnalyzer('test-key');
      const result = analyzer.analyzeV1('Only one sentence.');

      expect(result.nodes).toHaveLength(1);
      expect(result.edges).toHaveLength(0);
    });

    it('should filter out empty sentences from splitting', () => {
      const analyzer = new ContentAnalyzer('test-key');
      const result = analyzer.analyzeV1('Hello... World');

      // Multiple dots create empty strings after split, which are filtered
      expect(result.nodes.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // analyzeV2 (LLM-based) tests
  // -------------------------------------------------------------------------
  describe('analyzeV2', () => {
    it('should fall back to analyzeV1 when LLM is not enabled', async () => {
      const mockLLM = createMockLLMService({ enabled: false });
      const analyzer = new ContentAnalyzer(undefined, mockLLM);

      const result = await analyzer.analyzeV2('Hello world. This is a test.');

      // Should use rule-based (analyzeV1) since LLM is not enabled
      expect(result.title).toBe('Auto-generated (rule-based)');
      expect(result.type).toBe('flowchart');
      expect(mockLLM.execute).not.toHaveBeenCalled();
    });

    it('should use LLM when enabled and return parsed data', async () => {
      const mockData: DiagramData = {
        title: 'LLM Result',
        type: 'mindmap',
        nodes: [
          { id: 'n1', label: 'Root' },
          { id: 'n2', label: 'Child' },
        ],
        edges: [{ from: 'n1', to: 'n2', label: 'contains' }],
      };
      const mockLLM = createMockLLMService({ responseData: mockData });
      const analyzer = new ContentAnalyzer(undefined, mockLLM);

      const result = await analyzer.analyzeV2('Some text to analyze.');

      expect(result.title).toBe('LLM Result');
      expect(result.type).toBe('mindmap');
      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toHaveLength(1);
      expect(mockLLM.execute).toHaveBeenCalledTimes(1);
    });

    it('should fall back to analyzeV1 when LLM returns invalid nodes', async () => {
      const mockLLM = createMockLLMService({
        responseData: {
          title: 'Bad Data',
          type: 'flowchart',
          nodes: 'not-an-array' as unknown as DiagramData['nodes'],
          edges: [],
        },
      });
      const analyzer = new ContentAnalyzer(undefined, mockLLM);

      const result = await analyzer.analyzeV2('Test text.');

      // Should fall back to rule-based
      expect(result.title).toBe('Auto-generated (rule-based)');
    });

    it('should add empty edges array when LLM response has missing edges', async () => {
      const mockData = {
        title: 'No Edges',
        type: 'flowchart' as const,
        nodes: [{ id: 'n1', label: 'A' }],
        // edges is missing entirely
      };
      // Need to explicitly handle this since our mock sends the data through
      const mock = {
        isEnabled: vi.fn().mockReturnValue(true),
        execute: vi.fn().mockResolvedValue({
          success: true,
          data: { ...mockData },
          metadata: {
            model: 'gemini-2.5-flash',
            responseTime: 50,
            fromCache: false,
            retryCount: 0,
            fallbackUsed: false,
          },
        }),
        getStats: vi.fn().mockReturnValue({
          totalRequests: 1, cacheHits: 0, cacheMisses: 1, cacheHitRate: 0,
          modelUsage: { flash: 1, pro: 0, flashPercent: 100 },
          performance: { avgResponseTime: 50, avgFlashTime: 50, avgProTime: 0, p50: 50, p95: 50, p99: 50 },
          reliability: { successRate: 100, fallbackRate: 0, totalRetries: 0 },
          timeSavings: '0s',
        }),
      };

      const analyzer = new ContentAnalyzer(undefined, mock as unknown as LLMService);
      const result = await analyzer.analyzeV2('Test text.');

      // The result should have an edges array (even if empty)
      expect(Array.isArray(result.edges)).toBe(true);
    });

    it('should add empty edges array when LLM response has non-array edges', async () => {
      const mockData = {
        title: 'Bad Edges',
        type: 'flowchart' as const,
        nodes: [{ id: 'n1', label: 'A' }],
        edges: 'not-an-array',
      };
      const mock = {
        isEnabled: vi.fn().mockReturnValue(true),
        execute: vi.fn().mockResolvedValue({
          success: true,
          data: mockData,
          metadata: {
            model: 'gemini-2.5-flash', responseTime: 50, fromCache: false, retryCount: 0, fallbackUsed: false,
          },
        }),
        getStats: vi.fn().mockReturnValue({
          totalRequests: 1, cacheHits: 0, cacheMisses: 1, cacheHitRate: 0,
          modelUsage: { flash: 1, pro: 0, flashPercent: 100 },
          performance: { avgResponseTime: 50, avgFlashTime: 50, avgProTime: 0, p50: 50, p95: 50, p99: 50 },
          reliability: { successRate: 100, fallbackRate: 0, totalRetries: 0 },
          timeSavings: '0s',
        }),
      };

      const analyzer = new ContentAnalyzer(undefined, mock as unknown as LLMService);
      const result = await analyzer.analyzeV2('Test text.');

      expect(result.edges).toEqual([]);
    });

    it('should fall back to analyzeV1 when LLM fails', async () => {
      const mockLLM = createMockLLMService({ shouldFail: true });
      const analyzer = new ContentAnalyzer(undefined, mockLLM);

      const result = await analyzer.analyzeV2('Hello world. Test sentence.');

      expect(result.title).toBe('Auto-generated (rule-based)');
    });

    it('should pass correct options to LLMService execute', async () => {
      const mockLLM = createMockLLMService();
      const analyzer = new ContentAnalyzer(undefined, mockLLM, 'en');

      await analyzer.analyzeV2('Test input text.');

      expect(mockLLM.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          context: 'Test input text.',
          options: expect.objectContaining({
            temperature: 0.1,
            maxOutputTokens: 2048,
          }),
        })
      );
    });

    it('should use preferred language for prompt generation', async () => {
      const mockLLM = createMockLLMService();
      const analyzer = new ContentAnalyzer(undefined, mockLLM, 'ja');

      await analyzer.analyzeV2('テストテキスト。');

      expect(mockLLM.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.any(String),
        })
      );

      // The prompt should contain Japanese text
      const callArgs = (mockLLM.execute as vi.Mock).mock.calls[0][0];
      expect(callArgs.prompt).toContain('分析');
    });

    it('should handle empty text input', async () => {
      const mockLLM = createMockLLMService({ enabled: false });
      const analyzer = new ContentAnalyzer(undefined, mockLLM);

      const result = await analyzer.analyzeV2('');

      // Falls back to analyzeV1 with empty string
      expect(result.nodes).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // execute tests
  // -------------------------------------------------------------------------
  describe('execute', () => {
    it('should delegate to analyzeV2', async () => {
      const mockData: DiagramData = {
        title: 'Executed',
        type: 'flowchart',
        nodes: [{ id: 'n1', label: 'A' }],
        edges: [],
      };
      const mockLLM = createMockLLMService({ responseData: mockData });
      const analyzer = new ContentAnalyzer(undefined, mockLLM);

      const result = await analyzer.execute('Some text.');

      expect(result.title).toBe('Executed');
      expect(mockLLM.execute).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // getStats tests
  // -------------------------------------------------------------------------
  describe('getStats', () => {
    it('should delegate to LLMService getStats', () => {
      const mockLLM = createMockLLMService();
      const analyzer = new ContentAnalyzer(undefined, mockLLM);

      const stats = analyzer.getStats();

      expect(mockLLM.getStats).toHaveBeenCalledTimes(1);
      expect(stats.totalRequests).toBe(1);
    });

    it('should return LLMService stats', () => {
      const mockLLM = createMockLLMService();
      const analyzer = new ContentAnalyzer(undefined, mockLLM);

      const stats = analyzer.getStats();

      expect(stats).toHaveProperty('totalRequests');
      expect(stats).toHaveProperty('modelUsage');
      expect(stats).toHaveProperty('performance');
      expect(stats).toHaveProperty('reliability');
    });
  });
});
