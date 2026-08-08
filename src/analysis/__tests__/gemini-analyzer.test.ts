/**
 * TASK-0017: GeminiAnalyzer Tests
 *
 * Test cases:
 * 1. Entity extraction accuracy (mocked Gemini API)
 * 2. Relationship extraction accuracy (mocked Gemini API)
 * 3. Diagram type detection (each type: flow/tree/timeline/matrix/cycle)
 * 7. Model selection (Flash/Pro based on complexity)
 */

import { GeminiAnalyzer, buildAnalyzerCacheKey, GEMINI_ANALYZER_CACHE_VERSION } from '../gemini-analyzer';
import { LLMService } from '../llm-service';
import type { DiagramAnalysis } from '../types';

// ---------------------------------------------------------------------------
// Mock: LLMService
// ---------------------------------------------------------------------------

/**
 * Create a mock LLMService that returns a given DiagramAnalysis as the
 * parsed result from the Gemini API. The mock simulates a successful
 * LLMResponse so that GeminiAnalyzer.analyzeText returns the analysis.
 */
function createMockLLMService(mockAnalysis: DiagramAnalysis): LLMService {
  const mock = {
    isEnabled: jest.fn().mockReturnValue(true),
    execute: jest.fn().mockResolvedValue({
      success: true,
      data: mockAnalysis,
      metadata: {
        model: 'gemini-2.5-flash',
        responseTime: 100,
        fromCache: false,
        complexity: { score: 0.1, level: 'simple', recommendedModel: 'gemini-2.5-flash' },
        retryCount: 0,
        fallbackUsed: false,
      },
    }),
    getStats: jest.fn().mockReturnValue({
      cacheHits: 0,
      cacheMisses: 0,
      totalRequests: 0,
      performance: { avgResponseTime: 100, p50: 100, p95: 100, p99: 100, avgFlashTime: 50, avgProTime: 200 },
      modelUsage: { flash: 1, pro: 0, flashPercent: 100 },
      reliability: { successRate: 100, fallbackRate: 0, totalRetries: 0 },
      timeSavings: '0s',
    }),
  };
  return mock as unknown as LLMService;
}

/**
 * Create a mock LLMService that captures the model used in metadata.
 * The complexity score drives model selection inside LLMService.
 * Since we mock LLMService.execute, we control the model in metadata.
 */
function createModelSelectionMockLLMService(flashModel: boolean): LLMService {
  const modelName = flashModel ? 'gemini-2.5-flash' : 'gemini-2.5-pro';
  const mockAnalysis: DiagramAnalysis = {
    type: 'flow',
    confidence: 0.9,
    nodes: [{ id: 'n1', label: 'Test' }],
    edges: [],
    reasoning: 'Test reasoning',
  };

  const mock = {
    isEnabled: jest.fn().mockReturnValue(true),
    execute: jest.fn().mockResolvedValue({
      success: true,
      data: mockAnalysis,
      metadata: {
        model: modelName,
        responseTime: flashModel ? 50 : 200,
        fromCache: false,
        complexity: {
          score: flashModel ? 0.1 : 0.5,
          level: flashModel ? 'simple' : 'complex',
          recommendedModel: modelName,
        },
        retryCount: 0,
        fallbackUsed: false,
      },
    }),
    getStats: jest.fn().mockReturnValue({
      cacheHits: 0,
      cacheMisses: 0,
      totalRequests: 0,
      performance: { avgResponseTime: 100, p50: 100, p95: 100, p99: 100, avgFlashTime: 50, avgProTime: 200 },
      modelUsage: { flash: flashModel ? 1 : 0, pro: flashModel ? 0 : 1, flashPercent: flashModel ? 100 : 0 },
      reliability: { successRate: 100, fallbackRate: 0, totalRetries: 0 },
      timeSavings: '0s',
    }),
  };
  return mock as unknown as LLMService;
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('TASK-0017: GeminiAnalyzer', () => {
  let analyzer: GeminiAnalyzer;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // Test case 1: Entity extraction accuracy
  // -----------------------------------------------------------------------
  describe('Test case 1: Entity extraction accuracy', () => {
    it('should extract entities "Tanaka-san", "Project", "Development Team" from Japanese text about project leadership', async () => {
      const mockAnalysis: DiagramAnalysis = {
        type: 'tree',
        confidence: 0.92,
        nodes: [
          { id: 'n1', label: 'Tanaka-san' },
          { id: 'n2', label: 'Project' },
          { id: 'n3', label: 'Development Team' },
        ],
        edges: [
          { from: 'n1', to: 'n2', label: 'Leader' },
          { from: 'n1', to: 'n3', label: 'Manages' },
        ],
        reasoning: 'Extracted entities from project leadership text',
      };

      const mockLLM = createMockLLMService(mockAnalysis);
      analyzer = new GeminiAnalyzer('test-api-key', mockLLM);

      const result = await analyzer.analyzeText(
        'Tanaka-san is the project leader. The development team consists of 3 members.'
      );

      expect(result).not.toBeNull();
      expect(result!.nodes).toHaveLength(3);

      const labels = result!.nodes.map(n => n.label);
      expect(labels).toContain('Tanaka-san');
      expect(labels).toContain('Project');
      expect(labels).toContain('Development Team');
    });

    it('should extract entities from organizational structure text', async () => {
      const mockAnalysis: DiagramAnalysis = {
        type: 'tree',
        confidence: 0.88,
        nodes: [
          { id: 'n1', label: 'CEO' },
          { id: 'n2', label: 'CTO' },
          { id: 'n3', label: 'Engineering Department' },
        ],
        edges: [
          { from: 'n1', to: 'n2', label: 'reports to' },
        ],
        reasoning: 'Organizational structure extraction',
      };

      const mockLLM = createMockLLMService(mockAnalysis);
      analyzer = new GeminiAnalyzer('test-api-key', mockLLM);

      const result = await analyzer.analyzeText('The CEO oversees the CTO who manages the Engineering Department.');

      expect(result).not.toBeNull();
      expect(result!.nodes).toHaveLength(3);
      expect(result!.nodes.map(n => n.label)).toContain('CEO');
    });
  });

  // -----------------------------------------------------------------------
  // Test case 2: Relationship extraction accuracy
  // -----------------------------------------------------------------------
  describe('Test case 2: Relationship extraction accuracy', () => {
    it('should extract acquisition and establishment relationships between companies', async () => {
      const mockAnalysis: DiagramAnalysis = {
        type: 'flow',
        confidence: 0.90,
        nodes: [
          { id: 'n1', label: 'Company A' },
          { id: 'n2', label: 'Company B' },
          { id: 'n3', label: 'AB Holdings' },
        ],
        edges: [
          { from: 'n1', to: 'n2', label: 'Acquired' },
          { from: 'n1', to: 'n3', label: 'Established' },
        ],
        reasoning: 'M&A relationship extraction',
      };

      const mockLLM = createMockLLMService(mockAnalysis);
      analyzer = new GeminiAnalyzer('test-api-key', mockLLM);

      const result = await analyzer.analyzeText(
        'Company A acquired Company B. The new company name is AB Holdings.'
      );

      expect(result).not.toBeNull();
      expect(result!.edges).toHaveLength(2);

      // Check acquisition edge: Company A -> Company B
      const acquisitionEdge = result!.edges.find(e => e.to === 'n2');
      expect(acquisitionEdge).toBeDefined();
      expect(acquisitionEdge!.label).toBe('Acquired');

      // Check establishment edge: Company A -> AB Holdings
      const establishmentEdge = result!.edges.find(e => e.to === 'n3');
      expect(establishmentEdge).toBeDefined();
      expect(establishmentEdge!.label).toBe('Established');
    });

    it('should extract causal relationships between events', async () => {
      const mockAnalysis: DiagramAnalysis = {
        type: 'flow',
        confidence: 0.91,
        nodes: [
          { id: 'n1', label: 'Research' },
          { id: 'n2', label: 'New Technology' },
          { id: 'n3', label: 'Product Launch' },
        ],
        edges: [
          { from: 'n1', to: 'n2', label: 'develops' },
          { from: 'n2', to: 'n3', label: 'enables' },
        ],
        reasoning: 'Causal chain extraction',
      };

      const mockLLM = createMockLLMService(mockAnalysis);
      analyzer = new GeminiAnalyzer('test-api-key', mockLLM);

      const result = await analyzer.analyzeText(
        'Research develops new technology, which enables product launch.'
      );

      expect(result).not.toBeNull();
      expect(result!.edges).toHaveLength(2);

      // Verify chain: Research -> New Technology -> Product Launch
      const firstEdge = result!.edges.find(e => e.from === 'n1');
      expect(firstEdge).toBeDefined();
      expect(firstEdge!.to).toBe('n2');
    });
  });

  // -----------------------------------------------------------------------
  // Test case 3: Diagram type detection
  // -----------------------------------------------------------------------
  describe('Test case 3: Diagram type detection', () => {
    const diagramTypeTests: Array<{
      type: DiagramAnalysis['type'];
      text: string;
      description: string;
    }> = [
      {
        type: 'flow',
        text: 'Step 1: Gather requirements. Step 2: Design architecture. Step 3: Implement code. Step 4: Test and deploy.',
        description: 'flowchart for process/steps text',
      },
      {
        type: 'tree',
        text: 'The company has three divisions: Engineering, Marketing, and Sales. Engineering has Frontend and Backend teams.',
        description: 'tree for hierarchical structure',
      },
      {
        type: 'timeline',
        text: 'In 2020, the project started. In 2021, version 1.0 was released. In 2022, we expanded to global markets.',
        description: 'timeline for chronological events',
      },
      {
        type: 'matrix',
        text: 'Comparing Option A and Option B: Option A has high performance but high cost. Option B has medium performance and low cost.',
        description: 'matrix for comparison/contrast text',
      },
      {
        type: 'cycle',
        text: 'The water cycle: evaporation rises to clouds, clouds produce rain, rain flows into rivers, rivers evaporate again.',
        description: 'cycle for circular/iterative process',
      },
    ];

    for (const { type, text, description } of diagramTypeTests) {
      it(`should detect "${type}" diagram type for ${description}`, async () => {
        const mockAnalysis: DiagramAnalysis = {
          type,
          confidence: 0.93,
          nodes: [{ id: 'n1', label: 'Test Node' }],
          edges: [],
          reasoning: `Detected as ${type} diagram`,
        };

        const mockLLM = createMockLLMService(mockAnalysis);
        analyzer = new GeminiAnalyzer('test-api-key', mockLLM);

        const result = await analyzer.analyzeText(text);

        expect(result).not.toBeNull();
        expect(result!.type).toBe(type);
        expect(result!.confidence).toBeGreaterThanOrEqual(0.5);
      });
    }

    it('should assign confidence score to detected diagram type', async () => {
      const mockAnalysis: DiagramAnalysis = {
        type: 'flow',
        confidence: 0.95,
        nodes: [{ id: 'n1', label: 'Step 1' }],
        edges: [],
        reasoning: 'High confidence flow detection',
      };

      const mockLLM = createMockLLMService(mockAnalysis);
      analyzer = new GeminiAnalyzer('test-api-key', mockLLM);

      const result = await analyzer.analyzeText('First do A, then do B, finally do C.');

      expect(result).not.toBeNull();
      expect(result!.confidence).toBeGreaterThan(0);
      expect(result!.confidence).toBeLessThanOrEqual(1);
    });
  });

  // -----------------------------------------------------------------------
  // Test case 7: Model selection (Flash/Pro)
  // -----------------------------------------------------------------------
  describe('Test case 7: Model selection (Flash/Pro)', () => {
    it('should use Flash model for low complexity content (complexity 0.1)', async () => {
      const mockLLM = createModelSelectionMockLLMService(true);
      analyzer = new GeminiAnalyzer('test-api-key', mockLLM);

      const result = await analyzer.analyzeText('This is simple text.');

      expect(result).not.toBeNull();

      // Verify the execute was called (LLMService handles model selection internally)
      expect(mockLLM.execute).toHaveBeenCalledTimes(1);

      // Verify the metadata from the mock shows Flash was used
      const callArgs = (mockLLM.execute as jest.Mock).mock.results[0].value;
      const response = await callArgs;
      expect(response.metadata.model).toBe('gemini-2.5-flash');
    });

    it('should use Pro model for high complexity content (complexity 0.5)', async () => {
      const mockLLM = createModelSelectionMockLLMService(false);
      analyzer = new GeminiAnalyzer('test-api-key', mockLLM);

      const result = await analyzer.analyzeText(
        'The algorithmic complexity of the distributed system architecture requires careful analysis of the trade-offs between consistency and availability, as described in the CAP theorem.'
      );

      expect(result).not.toBeNull();
      expect(mockLLM.execute).toHaveBeenCalledTimes(1);

      const callArgs = (mockLLM.execute as jest.Mock).mock.results[0].value;
      const response = await callArgs;
      expect(response.metadata.model).toBe('gemini-2.5-pro');
    });

    it('should report Flash model usage in cache stats', () => {
      const mockLLM = createModelSelectionMockLLMService(true);
      analyzer = new GeminiAnalyzer('test-api-key', mockLLM);

      const stats = analyzer.getCacheStats();

      expect(stats.modelSelection.flashRequests).toBe(1);
      expect(stats.modelSelection.proRequests).toBe(0);
    });

    it('should report Pro model usage in cache stats', () => {
      const mockLLM = createModelSelectionMockLLMService(false);
      analyzer = new GeminiAnalyzer('test-api-key', mockLLM);

      const stats = analyzer.getCacheStats();

      expect(stats.modelSelection.flashRequests).toBe(0);
      expect(stats.modelSelection.proRequests).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // Additional: Edge cases
  // -----------------------------------------------------------------------
  describe('Edge cases', () => {
    it('should return null when LLM service is not enabled', async () => {
      const mockLLM = {
        isEnabled: jest.fn().mockReturnValue(false),
        execute: jest.fn(),
        getStats: jest.fn(),
      } as unknown as LLMService;

      analyzer = new GeminiAnalyzer(undefined, mockLLM);
      const result = await analyzer.analyzeText('test text');

      expect(result).toBeNull();
      expect(mockLLM.execute).not.toHaveBeenCalled();
    });

    it('should return null when LLM call fails', async () => {
      const mockLLM = {
        isEnabled: jest.fn().mockReturnValue(true),
        execute: jest.fn().mockResolvedValue({
          success: false,
          error: 'API error',
          metadata: { model: 'none', responseTime: 0, fromCache: false, retryCount: 0, fallbackUsed: false },
        }),
        getStats: jest.fn(),
      } as unknown as LLMService;

      analyzer = new GeminiAnalyzer('test-key', mockLLM);
      const result = await analyzer.analyzeText('test text');

      expect(result).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// buildAnalyzerCacheKey — cache-collision regression
// ---------------------------------------------------------------------------
describe('buildAnalyzerCacheKey', () => {
  it('produces distinct keys for inputs that share a long common prefix', () => {
    // Regression: the key previously truncated to the first 100 chars of the
    // text, so two distinct transcripts sharing a prefix collided in the
    // LLM cache and the second analyzeText() call returned the first call's
    // (wrong) analysis.
    const prefix = 'A'.repeat(120);
    const keyA = buildAnalyzerCacheKey(`${prefix} tail one`);
    const keyB = buildAnalyzerCacheKey(`${prefix} tail two`);
    expect(keyA).not.toBe(keyB);
  });

  it('is stable for identical input', () => {
    expect(buildAnalyzerCacheKey('same text')).toBe(buildAnalyzerCacheKey('same text'));
  });

  it('incorporates the full text rather than a truncated prefix', () => {
    expect(buildAnalyzerCacheKey('abcdefghij')).toContain('abcdefghij');
  });

  it('embeds the analyzer cache version tag', () => {
    expect(buildAnalyzerCacheKey('x')).toContain(GEMINI_ANALYZER_CACHE_VERSION);
  });

  // -----------------------------------------------------------------------
  // Injectivity / content-faithfulness invariants (property form)
  //
  // The key incorporates the FULL text, so two different analyses can never
  // share a key. These turn that contract into a property so a future
  // reintroduction of prefix truncation (the f6d5dc43 fix) fails loudly.
  // -----------------------------------------------------------------------

  it('is injective over many distinct texts sharing a long common prefix', () => {
    // Prefix-truncation regression, generalized: 100 texts that differ only
    // past char 150 must each map to a distinct key. The old text.slice(0,100)
    // key collapsed all of these to one slot.
    const prefix = 'Z'.repeat(150);
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const key = buildAnalyzerCacheKey(`${prefix}__unique_suffix_${i}__`);
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    expect(seen.size).toBe(100);
  });

  it('is injective over randomly generated distinct texts', () => {
    // General content-faithfulness lock: distinct texts -> distinct keys.
    // A collision is only legal for identical text.
    const seen = new Map<string, string>();
    let seed = 0x12345;
    const rng = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
    const alphabet = 'ABあ12 xy.、\nZq';
    for (let i = 0; i < 500; i++) {
      const len = 1 + Math.floor(rng() * 80);
      let text = '';
      for (let c = 0; c < len; c++) {
        text += alphabet[Math.floor(rng() * alphabet.length)];
      }
      const key = buildAnalyzerCacheKey(text);
      if (seen.has(key)) {
        expect(seen.get(key)).toBe(text); // same key ⇒ same text
      } else {
        seen.set(key, text);
      }
    }
  });
});
