import {
  SimpleDiagramDetector,
  type DiagramType,
  type TextSegment,
} from '../simple-diagram-detector';

describe('SimpleDiagramDetector', () => {
  let detector: SimpleDiagramDetector;

  beforeEach(() => {
    detector = new SimpleDiagramDetector();
  });

  const makeSegment = (text: string, startMs = 0, endMs = 5000): TextSegment => ({
    text,
    startMs,
    endMs,
  });

  // ─── analyze() — diagram type detection ───

  describe('analyze() — keyword-based type detection', () => {
    test('detects flow type for process/step keywords', async () => {
      const result = await detector.analyze(
        makeSegment('First we start the process, then we proceed to the next step and finally finish the workflow.')
      );
      expect(result.type).toBe('flow');
      expect(result.confidence).toBeGreaterThan(0);
    });

    test('detects tree type for hierarchy/structure keywords', async () => {
      const result = await detector.analyze(
        makeSegment('The organization has a clear hierarchy with parent departments and child branches.')
      );
      expect(result.type).toBe('tree');
      expect(result.confidence).toBeGreaterThan(0);
    });

    test('detects timeline type for year/time keywords', async () => {
      const result = await detector.analyze(
        makeSegment('In 2020 we started, in 2021 we developed, and in 2022 we launched.')
      );
      expect(result.type).toBe('timeline');
      expect(result.confidence).toBeGreaterThan(0);
    });

    test('detects cycle type for loop/repeat keywords', async () => {
      const result = await detector.analyze(
        makeSegment('This cycle repeats continuously. It loops back and iterates again and again.')
      );
      expect(result.type).toBe('cycle');
      expect(result.confidence).toBeGreaterThan(0);
    });

    test('detects network type for connection/relationship keywords', async () => {
      const result = await detector.analyze(
        makeSegment('The network of interconnected nodes has many relationships and linked edges.')
      );
      expect(result.type).toBe('network');
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  // ─── analyze() — confidence scoring ───

  describe('analyze() — confidence scoring', () => {
    test('confidence is capped at 0.95', async () => {
      const result = await detector.analyze(
        makeSegment('process step process step process step process step process step process step')
      );
      expect(result.confidence).toBeLessThanOrEqual(0.95);
    });

    test('confidence is between 0 and 0.95', async () => {
      const result = await detector.analyze(
        makeSegment('We process the step then finish.')
      );
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(0.95);
    });

    test('confidence is 0 when no keywords match', async () => {
      const result = await detector.analyze(
        makeSegment('asdf jklp qwerty zxcv')
      );
      expect(result.confidence).toBe(0);
    });

    test('higher keyword density yields higher confidence', async () => {
      // 25 words, only 1 keyword match → lower confidence
      const lowDensity = await detector.analyze(
        makeSegment('The team gathered for a process review session to discuss quarterly results, market trends, operational improvements, customer feedback, and strategic planning initiatives across all divisions.')
      );
      // 5 words, all keyword matches → hits confidence cap
      const highDensity = await detector.analyze(
        makeSegment('process step workflow procedure finally')
      );
      expect(highDensity.confidence).toBeGreaterThan(lowDensity.confidence);
    });
  });

  // ─── analyze() — element generation ───

  describe('analyze() — element generation per type', () => {
    test('flow type generates flow elements with start/process/decision/end nodes', async () => {
      const result = await detector.analyze(
        makeSegment('process step workflow procedure')
      );
      expect(result.type).toBe('flow');
      expect(result.nodes.length).toBe(5);
      expect(result.edges.length).toBe(5);
      const nodeIds = result.nodes.map(n => n.id);
      expect(nodeIds).toContain('start');
      expect(nodeIds).toContain('end');
      expect(nodeIds).toContain('decision');
    });

    test('tree type generates hierarchy nodes with root/branch/leaf', async () => {
      const result = await detector.analyze(
        makeSegment('hierarchy parent child branch root leaf')
      );
      expect(result.type).toBe('tree');
      expect(result.nodes.length).toBe(5);
      expect(result.edges.length).toBe(4);
      const nodeTypes = result.nodes.map(n => n.type);
      expect(nodeTypes).toContain('root');
      expect(nodeTypes).toContain('branch');
      expect(nodeTypes).toContain('leaf');
    });

    test('timeline type generates sequential event nodes with timeline edges', async () => {
      const result = await detector.analyze(
        makeSegment('timeline 2020 2021 2022 chronology')
      );
      expect(result.type).toBe('timeline');
      expect(result.nodes.length).toBe(4);
      expect(result.edges.length).toBe(3);
      expect(result.edges.every(e => e.type === 'timeline')).toBe(true);
    });

    test('cycle type generates cyclic structure with back-edge', async () => {
      const result = await detector.analyze(
        makeSegment('cycle loop repeat iterate recurring')
      );
      expect(result.type).toBe('cycle');
      expect(result.nodes.length).toBe(4);
      expect(result.edges.length).toBe(4);
      // Last edge should cycle back to step1
      const backEdge = result.edges[3];
      expect(backEdge.to).toBe('step1');
    });

    test('network type generates interconnected nodes', async () => {
      const result = await detector.analyze(
        makeSegment('network connection linked relationship interconnected')
      );
      expect(result.type).toBe('network');
      expect(result.nodes.length).toBe(4);
      expect(result.edges.length).toBe(4);
    });

    test('all nodes have id and label', async () => {
      const result = await detector.analyze(
        makeSegment('process step workflow')
      );
      for (const node of result.nodes) {
        expect(typeof node.id).toBe('string');
        expect(typeof node.label).toBe('string');
        expect(node.id.length).toBeGreaterThan(0);
        expect(node.label.length).toBeGreaterThan(0);
      }
    });

    test('all edges have id, from, and to', async () => {
      const result = await detector.analyze(
        makeSegment('process step workflow')
      );
      for (const edge of result.edges) {
        expect(typeof edge.id).toBe('string');
        expect(typeof edge.from).toBe('string');
        expect(typeof edge.to).toBe('string');
      }
    });

    test('all edge from/to reference existing node ids', async () => {
      const result = await detector.analyze(
        makeSegment('process step workflow')
      );
      const nodeIds = new Set(result.nodes.map(n => n.id));
      for (const edge of result.edges) {
        expect(nodeIds.has(edge.from)).toBe(true);
        expect(nodeIds.has(edge.to)).toBe(true);
      }
    });
  });

  // ─── Bug fix: unrecognized text uses default elements ───

  describe('analyze() — unrecognized text handling', () => {
    test('returns default single-node elements when no keywords match', async () => {
      const result = await detector.analyze(
        makeSegment('asdf jklp qwerty zxcv')
      );
      // Confidence is 0, should use default elements
      expect(result.confidence).toBe(0);
      expect(result.nodes.length).toBe(1);
      expect(result.nodes[0].id).toBe('concept');
      expect(result.edges.length).toBe(0);
    });

    test('does not generate hardcoded flow elements for unrecognized text', async () => {
      const result = await detector.analyze(
        makeSegment('zzzz zzzz zzzz zzzz')
      );
      expect(result.nodes.length).not.toBe(5);
    });
  });

  // ─── analyze() — reasoning explanation ───

  describe('analyze() — reasoning', () => {
    test('includes keyword score in reasoning', async () => {
      const result = await detector.analyze(
        makeSegment('process step workflow')
      );
      expect(result.reasoning).toMatch(/キーワード一致スコア/);
      expect(result.reasoning).toMatch(/%/);
    });

    test('includes type-specific reasoning for flow', async () => {
      const result = await detector.analyze(
        makeSegment('process step workflow procedure then next')
      );
      expect(result.type).toBe('flow');
      expect(result.reasoning).toContain('プロセス');
    });

    test('includes type-specific reasoning for timeline with year pattern', async () => {
      const result = await detector.analyze(
        makeSegment('timeline 2020 2021 year month')
      );
      expect(result.type).toBe('timeline');
      expect(result.reasoning).toContain('時系列');
    });

    test('includes type-specific reasoning for cycle', async () => {
      const result = await detector.analyze(
        makeSegment('cycle loop repeat')
      );
      expect(result.type).toBe('cycle');
      expect(result.reasoning).toContain('循環');
    });
  });

  // ─── analyze() — case insensitivity ───

  describe('analyze() — case insensitivity', () => {
    test('matches keywords regardless of case', async () => {
      const upper = await detector.analyze(
        makeSegment('PROCESS STEP WORKFLOW PROCEDURE')
      );
      const lower = await detector.analyze(
        makeSegment('process step workflow procedure')
      );
      expect(upper.type).toBe(lower.type);
      expect(upper.confidence).toBe(lower.confidence);
    });

    test('matches keywords in mixed case', async () => {
      const result = await detector.analyze(
        makeSegment('ProCeSS StEp WoRkFlOw')
      );
      expect(result.type).toBe('flow');
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  // ─── analyze() — edge cases ───

  describe('analyze() — edge cases', () => {
    test('handles empty text', async () => {
      const result = await detector.analyze(makeSegment(''));
      expect(result.confidence).toBe(0);
      expect(result.nodes.length).toBe(1);
    });

    test('handles whitespace-only text', async () => {
      const result = await detector.analyze(makeSegment('   '));
      expect(result.confidence).toBe(0);
    });

    test('handles very long text with keywords', async () => {
      const longText = 'process '.repeat(100) + 'step '.repeat(100);
      const result = await detector.analyze(makeSegment(longText, 0, 60000));
      expect(result.type).toBe('flow');
      expect(result.confidence).toBeLessThanOrEqual(0.95);
    });

    test('handles Japanese text without English keywords', async () => {
      const result = await detector.analyze(
        makeSegment('これは日本語のテキストです。キーワードが含まれていません。')
      );
      expect(result.confidence).toBe(0);
      expect(result.nodes.length).toBe(1); // default elements
    });

    test('handles text with special regex characters safely', async () => {
      const result = await detector.analyze(
        makeSegment('process (step) [workflow] {procedure} step*')
      );
      expect(result.type).toBe('flow');
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  // ─── analyze() — text segment metadata ───

  describe('analyze() — preserves segment metadata', () => {
    test('works with summary field in segment', async () => {
      const segment: TextSegment = {
        text: 'process step workflow',
        startMs: 1000,
        endMs: 5000,
        summary: 'A simple process description',
      };
      const result = await detector.analyze(segment);
      expect(result.type).toBe('flow');
    });
  });

  // ─── ReDoS safety ───

  describe('analyze() — ReDoS safety', () => {
    test('handles keyword-like input without regex errors', async () => {
      // The keywords are escaped before building regex, so these should be safe
      const malicious = 'process.step*workflow?procedure+step';
      const result = await detector.analyze(makeSegment(malicious));
      expect(result).toBeDefined();
      expect(result.type).toBeDefined();
    });
  });

  // ─── getCapabilities() ───

  describe('getCapabilities()', () => {
    test('returns all 5 supported types', () => {
      const caps = detector.getCapabilities();
      expect(caps.supportedTypes).toEqual([
        'flow', 'tree', 'timeline', 'cycle', 'network'
      ]);
      expect(caps.supportedTypes).toHaveLength(5);
    });

    test('reports keyword-based detection method', () => {
      const caps = detector.getCapabilities();
      expect(caps.detectionMethod).toBe('keyword-based');
    });

    test('supports Japanese and English', () => {
      const caps = detector.getCapabilities();
      expect(caps.language).toBe('ja/en');
    });

    test('includes feature list', () => {
      const caps = detector.getCapabilities();
      expect(caps.features).toContain('Simple keyword matching');
      expect(caps.features).toContain('Confidence scoring');
      expect(caps.features).toContain('Basic element generation');
      expect(caps.features).toContain('Reasoning explanation');
    });
  });

  // ─── testDetector() — built-in self-test ───

  describe('testDetector() — built-in self-test', () => {
    test('returns result summary with total and passed counts', async () => {
      const result = await detector.testDetector();
      expect(result.total).toBe(4);
      expect(typeof result.passed).toBe('number');
      expect(result.passed).toBeGreaterThanOrEqual(0);
      expect(result.passed).toBeLessThanOrEqual(result.total);
    });

    test('returns failures array (may be empty)', async () => {
      const result = await detector.testDetector();
      expect(Array.isArray(result.failures)).toBe(true);
      for (const failure of result.failures) {
        expect(failure).toHaveProperty('text');
        expect(failure).toHaveProperty('expected');
        expect(failure).toHaveProperty('got');
      }
    });

    test('passes at least 2 of 4 built-in test cases', async () => {
      const result = await detector.testDetector();
      expect(result.passed).toBeGreaterThanOrEqual(2);
    });

    test('does not silently pass when detections fail', async () => {
      const result = await detector.testDetector();
      // If any test failed, failures array should be non-empty
      if (result.passed < result.total) {
        expect(result.failures.length).toBe(result.total - result.passed);
      }
    });
  });

  // ─── Keyword competition / tie-breaking ───

  describe('analyze() — keyword competition', () => {
    test('selects highest-scoring type when multiple types have matches', async () => {
      // Text with flow keywords dominating
      const result = await detector.analyze(
        makeSegment('process step workflow procedure first then finally start end')
      );
      expect(result.type).toBe('flow');
    });

    test('handles text with competing timeline and cycle keywords', async () => {
      const result = await detector.analyze(
        makeSegment('The cycle loop repeats in 2020 and 2021, iterating back again.')
      );
      // Either cycle or timeline should win — both have strong signals
      expect(['cycle', 'timeline']).toContain(result.type);
    });
  });

  // ─── exported singleton ───

  describe('exported singleton', () => {
    test('simpleDiagramDetector is an instance of SimpleDiagramDetector', async () => {
      const { simpleDiagramDetector } = await import('../simple-diagram-detector');
      expect(simpleDiagramDetector).toBeInstanceOf(SimpleDiagramDetector);
    });
  });
});
