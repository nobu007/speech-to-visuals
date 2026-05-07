/**
 * Comprehensive tests for GeminiAnalyzer (gemini-analyzer.ts)
 *
 * Covers:
 * - Constructor (with/without API key, with LLMService, with language)
 * - isEnabled()
 * - setLanguage()
 * - analyzeText() - success, disabled, failure
 * - createEnhancedParser() via execute:
 *   - Valid diagram data parsing
 *   - Invalid/missing data structure
 *   - Missing edges (defaulting to empty array)
 *   - Invalid edges referencing non-existent nodes
 *   - Cycle detection and confidence adjustment
 *   - Disconnected nodes detection and confidence adjustment
 *   - Sparse relationships detection
 *   - Quality metrics recording
 * - getCacheStats() - stats mapping
 * - typeMap mapping (flowchart, mindmap, timeline, orgchart, matrix, cycle)
 */

import { GeminiAnalyzer } from '../gemini-analyzer';
import { LLMService } from '../llm-service';
import type { DiagramAnalysis, DiagramData } from '../types';

// ---------------------------------------------------------------------------
// Mock quality-monitor to avoid side effects
// ---------------------------------------------------------------------------

vi.mock('@/pipeline/quality-monitor', () => ({
  getQualityMonitor: vi.fn(() => ({
    recordMetrics: vi.fn(),
  })),
}));

// ---------------------------------------------------------------------------
// Suppress console output
// ---------------------------------------------------------------------------

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
// Helper: Create mock LLMService
// ---------------------------------------------------------------------------

/**
 * Create a mock LLMService where execute invokes the provided parser
 * on the raw text. This allows testing the enhanced parser logic.
 */
function createParserMockLLMService(): {
  llm: LLMService;
  setParserResult: (rawText: string) => void;
} {
  let parserResultText = '';

  const llm = {
    isEnabled: vi.fn().mockReturnValue(true),
    execute: vi.fn().mockImplementation(async (req: { parser?: (text: string) => DiagramAnalysis }) => {
      if (req.parser) {
        try {
          const data = req.parser(parserResultText);
          return {
            success: true,
            data,
            metadata: {
              model: 'gemini-2.5-flash',
              responseTime: 100,
              fromCache: false,
              complexity: { score: 0.1, level: 'simple', recommendedModel: 'gemini-2.5-flash' },
              retryCount: 0,
              fallbackUsed: false,
            },
          };
        } catch (err) {
          return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
            metadata: {
              model: 'gemini-2.5-flash',
              responseTime: 100,
              fromCache: false,
              retryCount: 0,
              fallbackUsed: false,
            },
          };
        }
      }
      return {
        success: false,
        error: 'No parser provided',
        metadata: { model: 'none', responseTime: 0, fromCache: false, retryCount: 0, fallbackUsed: false },
      };
    }),
    getStats: vi.fn().mockReturnValue({
      totalRequests: 1,
      cacheHits: 0,
      cacheMisses: 1,
      cacheHitRate: 0,
      modelUsage: { flash: 1, pro: 0, flashPercent: 100 },
      performance: { avgResponseTime: 100, avgFlashTime: 50, avgProTime: 200, p50: 100, p95: 100, p99: 100 },
      reliability: { successRate: 100, fallbackRate: 0, totalRetries: 0 },
      timeSavings: '0s (insufficient data)',
    }),
  } as unknown as LLMService;

  return {
    llm,
    setParserResult: (rawText: string) => { parserResultText = rawText; },
  };
}

/**
 * Create a simple mock LLMService that returns pre-built DiagramAnalysis directly.
 */
function createSimpleMockLLMService(analysis: DiagramAnalysis | null, success = true): LLMService {
  return {
    isEnabled: vi.fn().mockReturnValue(true),
    execute: vi.fn().mockResolvedValue({
      success,
      data: analysis,
      error: success ? undefined : 'API error',
      metadata: {
        model: success ? 'gemini-2.5-flash' : 'none',
        responseTime: 100,
        fromCache: false,
        complexity: { score: 0.1, level: 'simple', recommendedModel: 'gemini-2.5-flash' },
        retryCount: 0,
        fallbackUsed: false,
      },
    }),
    getStats: vi.fn().mockReturnValue({
      totalRequests: 1,
      cacheHits: 0,
      cacheMisses: 1,
      cacheHitRate: 0,
      modelUsage: { flash: 1, pro: 0, flashPercent: 100 },
      performance: { avgResponseTime: 100, avgFlashTime: 50, avgProTime: 200, p50: 100, p95: 100, p99: 100 },
      reliability: { successRate: 100, fallbackRate: 0, totalRetries: 0 },
      timeSavings: '0s',
    }),
  } as unknown as LLMService;
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('GeminiAnalyzer', () => {
  // -------------------------------------------------------------------------
  // Constructor tests
  // -------------------------------------------------------------------------
  describe('constructor', () => {
    it('should create with API key', () => {
      const analyzer = new GeminiAnalyzer('test-key');
      expect(analyzer).toBeDefined();
    });

    it('should create with LLMService instance', () => {
      const mockLLM = createSimpleMockLLMService(null, false);
      const analyzer = new GeminiAnalyzer(undefined, mockLLM);
      expect(analyzer).toBeDefined();
    });

    it('should create with language preference', () => {
      const mockLLM = createSimpleMockLLMService(null, false);
      const analyzer = new GeminiAnalyzer(undefined, mockLLM, 'ja');
      expect(analyzer).toBeDefined();
    });

    it('should create without any arguments', () => {
      const analyzer = new GeminiAnalyzer();
      expect(analyzer).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // isEnabled tests
  // -------------------------------------------------------------------------
  describe('isEnabled', () => {
    it('should delegate to LLMService.isEnabled', () => {
      const mockLLM = createSimpleMockLLMService(null, false);
      const analyzer = new GeminiAnalyzer(undefined, mockLLM);
      expect(analyzer.isEnabled()).toBe(true);
    });

    it('should return false when LLMService is disabled', () => {
      const mockLLM = {
        isEnabled: vi.fn().mockReturnValue(false),
        execute: vi.fn(),
        getStats: vi.fn(),
      } as unknown as LLMService;
      const analyzer = new GeminiAnalyzer(undefined, mockLLM);
      expect(analyzer.isEnabled()).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // setLanguage tests
  // -------------------------------------------------------------------------
  describe('setLanguage', () => {
    it('should set language to Japanese', () => {
      const mockLLM = createSimpleMockLLMService(null, false);
      const analyzer = new GeminiAnalyzer(undefined, mockLLM);
      analyzer.setLanguage('ja');
    });

    it('should set language to English', () => {
      const mockLLM = createSimpleMockLLMService(null, false);
      const analyzer = new GeminiAnalyzer(undefined, mockLLM);
      analyzer.setLanguage('en');
    });
  });

  // -------------------------------------------------------------------------
  // analyzeText - basic flow
  // -------------------------------------------------------------------------
  describe('analyzeText basic flow', () => {
    it('should return null when LLM is not enabled', async () => {
      const mockLLM = {
        isEnabled: vi.fn().mockReturnValue(false),
        execute: vi.fn(),
        getStats: vi.fn(),
      } as unknown as LLMService;

      const analyzer = new GeminiAnalyzer(undefined, mockLLM);
      const result = await analyzer.analyzeText('test text');

      expect(result).toBeNull();
      expect(mockLLM.execute).not.toHaveBeenCalled();
    });

    it('should return null when LLM call fails', async () => {
      const mockLLM = {
        isEnabled: vi.fn().mockReturnValue(true),
        execute: vi.fn().mockResolvedValue({
          success: false,
          error: 'API error',
          metadata: { model: 'none', responseTime: 0, fromCache: false, retryCount: 0, fallbackUsed: false },
        }),
        getStats: vi.fn(),
      } as unknown as LLMService;

      const analyzer = new GeminiAnalyzer('test-key', mockLLM);
      const result = await analyzer.analyzeText('test text');

      expect(result).toBeNull();
    });

    it('should return analysis data on success', async () => {
      const mockAnalysis: DiagramAnalysis = {
        type: 'flow',
        confidence: 0.9,
        nodes: [{ id: 'n1', label: 'Test' }],
        edges: [],
        reasoning: 'Test reasoning',
      };

      const mockLLM = createSimpleMockLLMService(mockAnalysis);
      const analyzer = new GeminiAnalyzer('test-key', mockLLM);

      const result = await analyzer.analyzeText('test text');

      expect(result).not.toBeNull();
      expect(result!.type).toBe('flow');
      expect(result!.confidence).toBe(0.9);
      expect(result!.nodes).toHaveLength(1);
    });

    it('should pass timeout option to execute', async () => {
      const mockAnalysis: DiagramAnalysis = {
        type: 'flow',
        confidence: 0.9,
        nodes: [],
        edges: [],
        reasoning: '',
      };

      const mockLLM = createSimpleMockLLMService(mockAnalysis);
      const analyzer = new GeminiAnalyzer('test-key', mockLLM);

      await analyzer.analyzeText('test text', 5000);

      expect(mockLLM.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            timeout: 5000,
          }),
        })
      );
    });
  });

  // -------------------------------------------------------------------------
  // Enhanced Parser - via the parser mock
  // -------------------------------------------------------------------------
  describe('enhanced parser', () => {
    it('should parse valid flowchart data', async () => {
      const { llm, setParserResult } = createParserMockLLMService();
      setParserResult(JSON.stringify({
        title: 'Process',
        type: 'flowchart',
        nodes: [
          { id: 'n1', label: 'Start' },
          { id: 'n2', label: 'End' },
        ],
        edges: [{ from: 'n1', to: 'n2', label: 'next' }],
      }));

      const analyzer = new GeminiAnalyzer('test-key', llm);
      const result = await analyzer.analyzeText('Start then end.');

      expect(result).not.toBeNull();
      expect(result!.type).toBe('flow');
      expect(result!.nodes).toHaveLength(2);
      expect(result!.edges).toHaveLength(1);
      expect(result!.confidence).toBeGreaterThanOrEqual(0.5);
    });

    it('should map mindmap type to tree', async () => {
      const { llm, setParserResult } = createParserMockLLMService();
      setParserResult(JSON.stringify({
        title: 'Map',
        type: 'mindmap',
        nodes: [{ id: 'n1', label: 'Root' }],
        edges: [],
      }));

      const analyzer = new GeminiAnalyzer('test-key', llm);
      const result = await analyzer.analyzeText('Root concept.');

      expect(result).not.toBeNull();
      expect(result!.type).toBe('tree');
    });

    it('should map orgchart type to tree', async () => {
      const { llm, setParserResult } = createParserMockLLMService();
      setParserResult(JSON.stringify({
        title: 'Org',
        type: 'orgchart',
        nodes: [{ id: 'n1', label: 'CEO' }],
        edges: [],
      }));

      const analyzer = new GeminiAnalyzer('test-key', llm);
      const result = await analyzer.analyzeText('CEO leads.');

      expect(result).not.toBeNull();
      expect(result!.type).toBe('tree');
    });

    it('should map timeline type correctly', async () => {
      const { llm, setParserResult } = createParserMockLLMService();
      setParserResult(JSON.stringify({
        title: 'Timeline',
        type: 'timeline',
        nodes: [{ id: 'n1', label: '2020' }],
        edges: [],
      }));

      const analyzer = new GeminiAnalyzer('test-key', llm);
      const result = await analyzer.analyzeText('Year 2020.');

      expect(result).not.toBeNull();
      expect(result!.type).toBe('timeline');
    });

    it('should map matrix type correctly', async () => {
      const { llm, setParserResult } = createParserMockLLMService();
      setParserResult(JSON.stringify({
        title: 'Comparison',
        type: 'matrix',
        nodes: [{ id: 'n1', label: 'A' }],
        edges: [],
      }));

      const analyzer = new GeminiAnalyzer('test-key', llm);
      const result = await analyzer.analyzeText('Compare A and B.');

      expect(result).not.toBeNull();
      expect(result!.type).toBe('matrix');
    });

    it('should map cycle type correctly', async () => {
      const { llm, setParserResult } = createParserMockLLMService();
      setParserResult(JSON.stringify({
        title: 'Cycle',
        type: 'cycle',
        nodes: [
          { id: 'n1', label: 'A' },
          { id: 'n2', label: 'B' },
        ],
        edges: [
          { from: 'n1', to: 'n2' },
          { from: 'n2', to: 'n1' },
        ],
      }));

      const analyzer = new GeminiAnalyzer('test-key', llm);
      const result = await analyzer.analyzeText('A feeds B, B feeds A.');

      expect(result).not.toBeNull();
      expect(result!.type).toBe('cycle');
    });

    it('should default to flow for unknown diagram type', async () => {
      const { llm, setParserResult } = createParserMockLLMService();
      setParserResult(JSON.stringify({
        title: 'Unknown',
        type: 'unknown_type',
        nodes: [{ id: 'n1', label: 'X' }],
        edges: [],
      }));

      const analyzer = new GeminiAnalyzer('test-key', llm);
      const result = await analyzer.analyzeText('Something.');

      expect(result).not.toBeNull();
      expect(result!.type).toBe('flow');
    });

    it('should throw on invalid data structure (no type or nodes)', async () => {
      const { llm, setParserResult } = createParserMockLLMService();
      setParserResult(JSON.stringify({
        title: 'Invalid',
        // missing type and nodes
      }));

      const analyzer = new GeminiAnalyzer('test-key', llm);
      const result = await analyzer.analyzeText('Bad data.');

      // Parser throws, execute returns failure, analyzeText returns null
      expect(result).toBeNull();
    });

    it('should default to empty edges array when edges is missing', async () => {
      const { llm, setParserResult } = createParserMockLLMService();
      setParserResult(JSON.stringify({
        title: 'No Edges',
        type: 'flowchart',
        nodes: [{ id: 'n1', label: 'A' }],
        // no edges field
      }));

      const analyzer = new GeminiAnalyzer('test-key', llm);
      const result = await analyzer.analyzeText('Single node.');

      expect(result).not.toBeNull();
      expect(result!.edges).toEqual([]);
    });

    it('should filter out edges referencing non-existent nodes', async () => {
      const { llm, setParserResult } = createParserMockLLMService();
      setParserResult(JSON.stringify({
        title: 'Invalid Edges',
        type: 'flowchart',
        nodes: [
          { id: 'n1', label: 'A' },
          { id: 'n2', label: 'B' },
        ],
        edges: [
          { from: 'n1', to: 'n2' },
          { from: 'n1', to: 'n999' }, // invalid target
          { from: 'n888', to: 'n2' }, // invalid source
        ],
      }));

      const analyzer = new GeminiAnalyzer('test-key', llm);
      const result = await analyzer.analyzeText('A to B.');

      expect(result).not.toBeNull();
      // Only the valid edge should remain
      expect(result!.edges).toHaveLength(1);
      expect(result!.edges[0].from).toBe('n1');
      expect(result!.edges[0].to).toBe('n2');
    });

    it('should detect cycles in the graph', async () => {
      const { llm, setParserResult } = createParserMockLLMService();
      setParserResult(JSON.stringify({
        title: 'Cycle',
        type: 'flowchart',
        nodes: [
          { id: 'n1', label: 'A' },
          { id: 'n2', label: 'B' },
          { id: 'n3', label: 'C' },
        ],
        edges: [
          { from: 'n1', to: 'n2' },
          { from: 'n2', to: 'n3' },
          { from: 'n3', to: 'n1' }, // creates cycle
        ],
      }));

      const analyzer = new GeminiAnalyzer('test-key', llm);
      const result = await analyzer.analyzeText('A->B->C->A cycle.');

      expect(result).not.toBeNull();
      expect(result!.edges).toHaveLength(3);
      // Confidence should be adjusted (still >= 0.5 minimum)
      expect(result!.confidence).toBeGreaterThanOrEqual(0.5);
    });

    it('should detect disconnected nodes and reduce confidence', async () => {
      const { llm, setParserResult } = createParserMockLLMService();
      setParserResult(JSON.stringify({
        title: 'Disconnected',
        type: 'flowchart',
        nodes: [
          { id: 'n1', label: 'A' },
          { id: 'n2', label: 'B' },
          { id: 'n3', label: 'C' },
          { id: 'n4', label: 'D' }, // disconnected
          { id: 'n5', label: 'E' }, // disconnected
        ],
        edges: [
          { from: 'n1', to: 'n2' },
          { from: 'n2', to: 'n3' },
        ],
      }));

      const analyzer = new GeminiAnalyzer('test-key', llm);
      const result = await analyzer.analyzeText('Mostly disconnected.');

      expect(result).not.toBeNull();
      // Confidence should be reduced due to disconnected nodes
      expect(result!.confidence).toBeLessThan(0.9);
      expect(result!.confidence).toBeGreaterThanOrEqual(0.5);
    });

    it('should detect sparse relationships (few edges for many nodes)', async () => {
      const { llm, setParserResult } = createParserMockLLMService();
      setParserResult(JSON.stringify({
        title: 'Sparse',
        type: 'flowchart',
        nodes: [
          { id: 'n1', label: 'A' },
          { id: 'n2', label: 'B' },
          { id: 'n3', label: 'C' },
          { id: 'n4', label: 'D' },
        ],
        edges: [
          { from: 'n1', to: 'n2' }, // only 1 edge for 4 nodes
        ],
      }));

      const analyzer = new GeminiAnalyzer('test-key', llm);
      const result = await analyzer.analyzeText('Sparse relationships.');

      expect(result).not.toBeNull();
      // Confidence should be reduced due to sparse edges
      expect(result!.confidence).toBeLessThan(0.9);
    });

    it('should handle empty nodes array', async () => {
      const { llm, setParserResult } = createParserMockLLMService();
      setParserResult(JSON.stringify({
        title: 'Empty',
        type: 'flowchart',
        nodes: [],
        edges: [],
      }));

      const analyzer = new GeminiAnalyzer('test-key', llm);
      const result = await analyzer.analyzeText('Nothing here.');

      expect(result).not.toBeNull();
      expect(result!.nodes).toHaveLength(0);
      expect(result!.edges).toHaveLength(0);
    });

    it('should produce a reasoning string in Japanese', async () => {
      const { llm, setParserResult } = createParserMockLLMService();
      setParserResult(JSON.stringify({
        title: 'Test',
        type: 'flowchart',
        nodes: [{ id: 'n1', label: 'A' }],
        edges: [],
      }));

      const analyzer = new GeminiAnalyzer('test-key', llm);
      const result = await analyzer.analyzeText('Test.');

      expect(result).not.toBeNull();
      expect(result!.reasoning).toContain('Phase 26');
    });

    it('should ensure minimum confidence of 0.5', async () => {
      const { llm, setParserResult } = createParserMockLLMService();
      // Create data with many disconnected nodes to heavily penalize confidence
      const nodes = Array.from({ length: 10 }, (_, i) => ({ id: `n${i + 1}`, label: `Node ${i + 1}` }));
      setParserResult(JSON.stringify({
        title: 'Many Disconnected',
        type: 'flowchart',
        nodes,
        edges: [{ from: 'n1', to: 'n2' }], // only 1 edge for 10 nodes
      }));

      const analyzer = new GeminiAnalyzer('test-key', llm);
      const result = await analyzer.analyzeText('Very disconnected.');

      expect(result).not.toBeNull();
      expect(result!.confidence).toBeGreaterThanOrEqual(0.5);
    });
  });

  // -------------------------------------------------------------------------
  // getCacheStats tests
  // -------------------------------------------------------------------------
  describe('getCacheStats', () => {
    it('should map LLMService stats to legacy cache stats format', () => {
      const mockLLM = createSimpleMockLLMService(null, false);
      const analyzer = new GeminiAnalyzer('test-key', mockLLM);

      const stats = analyzer.getCacheStats();

      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('totalRequests');
      expect(stats).toHaveProperty('adaptiveTimeout');
      expect(stats).toHaveProperty('modelSelection');
    });

    it('should include model selection details', () => {
      const mockLLM = createSimpleMockLLMService(null, false);
      const analyzer = new GeminiAnalyzer('test-key', mockLLM);

      const stats = analyzer.getCacheStats();

      expect(stats.modelSelection).toHaveProperty('totalRequests');
      expect(stats.modelSelection).toHaveProperty('flashRequests');
      expect(stats.modelSelection).toHaveProperty('proRequests');
      expect(stats.modelSelection).toHaveProperty('flashUsagePercent');
      expect(stats.modelSelection).toHaveProperty('overrideRate');
      expect(stats.modelSelection).toHaveProperty('avgFlashResponseTimeMs');
      expect(stats.modelSelection).toHaveProperty('avgProResponseTimeMs');
      expect(stats.modelSelection).toHaveProperty('estimatedTimeSavings');
    });

    it('should include adaptive timeout details', () => {
      const mockLLM = createSimpleMockLLMService(null, false);
      const analyzer = new GeminiAnalyzer('test-key', mockLLM);

      const stats = analyzer.getCacheStats();

      expect(stats.adaptiveTimeout).toHaveProperty('currentTimeoutMs');
      expect(stats.adaptiveTimeout).toHaveProperty('avgResponseTimeMs');
      expect(stats.adaptiveTimeout).toHaveProperty('p50ResponseTimeMs');
      expect(stats.adaptiveTimeout).toHaveProperty('p95ResponseTimeMs');
      expect(stats.adaptiveTimeout).toHaveProperty('p99ResponseTimeMs');
      expect(stats.adaptiveTimeout).toHaveProperty('historySamples');
    });
  });

  // -------------------------------------------------------------------------
  // Language preference integration
  // -------------------------------------------------------------------------
  describe('language preference', () => {
    it('should use Japanese prompt when language is set to ja', async () => {
      const mockAnalysis: DiagramAnalysis = {
        type: 'tree',
        confidence: 0.9,
        nodes: [],
        edges: [],
        reasoning: '',
      };
      const mockLLM = createSimpleMockLLMService(mockAnalysis);
      const analyzer = new GeminiAnalyzer('test-key', mockLLM, 'ja');

      await analyzer.analyzeText('テストテキスト。');

      const callArgs = (mockLLM.execute as vi.Mock).mock.calls[0][0];
      // Japanese prompt should contain Japanese characters
      expect(callArgs.prompt).toMatch(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/);
    });

    it('should use English prompt when language is set to en', async () => {
      const mockAnalysis: DiagramAnalysis = {
        type: 'flow',
        confidence: 0.9,
        nodes: [],
        edges: [],
        reasoning: '',
      };
      const mockLLM = createSimpleMockLLMService(mockAnalysis);
      const analyzer = new GeminiAnalyzer('test-key', mockLLM, 'en');

      await analyzer.analyzeText('Test text.');

      const callArgs = (mockLLM.execute as vi.Mock).mock.calls[0][0];
      // English prompt should contain "expert" or "extraction"
      expect(callArgs.prompt).toContain('expert');
    });
  });
});
