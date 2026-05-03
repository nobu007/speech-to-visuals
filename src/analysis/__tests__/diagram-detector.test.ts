/**
 * TASK-0021: Diagram Type Detection Module Tests
 *
 * Tests for detecting diagram types (flow/tree/timeline/matrix/cycle) from text.
 * Verifies confidence scoring, complex type handling, and hybrid detection.
 *
 * Test cases:
 * 1. Flow type detection (Japanese sequential keywords)
 * 2. Tree type detection (Japanese classification keywords)
 * 3. Timeline type detection (Japanese date/time keywords)
 * 4. Matrix type detection (Japanese comparison keywords)
 * 5. Cycle type detection (Japanese cycle keywords)
 * 6. Complex type processing (flow+timeline mixed features)
 * 7. Confidence score calculation (clear vs ambiguous text)
 */

import { DiagramDetector, DiagramDetectionResult, TextFeatures } from '../diagram-detector';
import type { ContentSegment, DiagramAnalysis } from '../types';
import type { DiagramType } from '@/types/diagram';

// Helper: create a ContentSegment from text
function makeSegment(text: string, keyphrases: string[] = []): ContentSegment {
  return {
    startMs: 0,
    endMs: 5000,
    text,
    summary: text.slice(0, 60),
    keyphrases,
    confidence: 0.9,
  };
}

describe('TASK-0021: DiagramDetector', () => {
  let detector: DiagramDetector;

  beforeEach(() => {
    detector = new DiagramDetector();
  });

  // -----------------------------------------------------------------------
  // Test case 1: flow type detection
  // -----------------------------------------------------------------------
  describe('Test case 1: flow type detection', () => {
    it('should detect flow type from Japanese sequential text', () => {
      const segments = [
        makeSegment('まず要件を定義します。次に設計を行います。最後に実装します。'),
      ];

      const result = detector.detect(null, segments);

      expect(result.primaryType).toBe('flow');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('should detect flow type from English sequential text', () => {
      const segments = [
        makeSegment('First we gather requirements. Next we design the system. Then we implement. Finally we test.'),
      ];

      const result = detector.detect(null, segments);

      expect(result.primaryType).toBe('flow');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });
  });

  // -----------------------------------------------------------------------
  // Test case 2: tree type detection
  // -----------------------------------------------------------------------
  describe('Test case 2: tree type detection', () => {
    it('should detect tree type from Japanese classification text', () => {
      const segments = [
        makeSegment('動物は哺乳類と爬虫類に分類されます。哺乳類には犬、猫が属します。'),
      ];

      const result = detector.detect(null, segments);

      expect(result.primaryType).toBe('tree');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('should detect tree type from English hierarchy text', () => {
      const segments = [
        makeSegment('The organization has a hierarchy with CEO at the top. Directors report to the VP. Teams are under each department.'),
      ];

      const result = detector.detect(null, segments);

      expect(result.primaryType).toBe('tree');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });
  });

  // -----------------------------------------------------------------------
  // Test case 3: timeline type detection
  // -----------------------------------------------------------------------
  describe('Test case 3: timeline type detection', () => {
    it('should detect timeline type from Japanese date-based text', () => {
      const segments = [
        makeSegment('2020年にプロジェクトが開始され、2022年にリリース、2024年に次期バージョンを予定しています。'),
      ];

      const result = detector.detect(null, segments);

      expect(result.primaryType).toBe('timeline');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('should detect timeline type from English date-based text', () => {
      const segments = [
        makeSegment('The project started in January 2023. By April we completed the first phase. The final milestone is in June.'),
      ];

      const result = detector.detect(null, segments);

      expect(result.primaryType).toBe('timeline');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });
  });

  // -----------------------------------------------------------------------
  // Test case 4: matrix type detection
  // -----------------------------------------------------------------------
  describe('Test case 4: matrix type detection', () => {
    it('should detect matrix type from Japanese comparison text', () => {
      const segments = [
        makeSegment('A案とB案を比較すると、コストはA案が優位ですが、機能はB案が上回ります。'),
      ];

      const result = detector.detect(null, segments);

      expect(result.primaryType).toBe('matrix');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('should detect matrix type from English comparison text', () => {
      const segments = [
        makeSegment('Comparing Option A versus Option B: Option A has better cost but Option B has more features.'),
      ];

      const result = detector.detect(null, segments);

      expect(result.primaryType).toBe('matrix');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });
  });

  // -----------------------------------------------------------------------
  // Test case 5: cycle type detection
  // -----------------------------------------------------------------------
  describe('Test case 5: cycle type detection', () => {
    it('should detect cycle type from Japanese cycle text', () => {
      const segments = [
        makeSegment('PDCAサイクルでは、計画→実行→評価→改善のプロセスを繰り返します。'),
      ];

      const result = detector.detect(null, segments);

      expect(result.primaryType).toBe('cycle');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('should detect cycle type from English cycle text', () => {
      const segments = [
        makeSegment('The continuous cycle involves planning, executing, reviewing, and improving. This loop repeats iteratively with feedback.'),
      ];

      const result = detector.detect(null, segments);

      expect(result.primaryType).toBe('cycle');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });
  });

  // -----------------------------------------------------------------------
  // Test case 6: complex type processing
  // -----------------------------------------------------------------------
  describe('Test case 6: complex type processing', () => {
    it('should detect complex type when flow+timeline features are present', () => {
      // Text with both flow (sequential) and timeline (dates) features
      const segments = [
        makeSegment('開発プロセスは2020年に開始し、要件定義→設計→実装の順で進みました。'),
      ];

      const result = detector.detect(null, segments);

      expect(result.isComplex).toBe(true);
      expect(result.secondaryTypes.length).toBeGreaterThanOrEqual(1);
      expect(result.fusionStrategy).not.toBe('single');
    });

    it('should NOT mark as complex when only one type dominates', () => {
      // Text with strong flow-only features
      const segments = [
        makeSegment('まずデータを収集し、次に分析を行い、最後に結果を出力します。手順に沿って進めます。'),
      ];

      const result = detector.detect(null, segments);

      // This should be primarily flow with high confidence
      expect(result.primaryType).toBe('flow');
      // Not complex because only flow has high confidence
      expect(result.isComplex).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Test case 7: confidence score calculation
  // -----------------------------------------------------------------------
  describe('Test case 7: confidence score calculation', () => {
    it('should return high confidence (>=0.8) for clear flow text', () => {
      const clearText = 'まず要件を定義します。次に設計を行います。最後に実装します。そしてテストを実行します。ステップごとに進めます。手順に従います。';
      const segments = [makeSegment(clearText)];
      const result = detector.detect(null, segments);

      expect(result.primaryType).toBe('flow');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('should return low confidence (<0.5) for ambiguous text', () => {
      const ambiguousText = '今日は天気が良いですね。散歩に行きたいです。';
      const segments = [makeSegment(ambiguousText)];
      const result = detector.detect(null, segments);

      expect(result.confidence).toBeLessThan(0.5);
    });

    it('calculateConfidence returns 0 for features with no keyword hits', () => {
      const features: TextFeatures = {
        keywordHits: {
          flow: [],
          flowchart: [],
          tree: [],
          timeline: [],
          matrix: [],
          cycle: [],
          comparison: [],
          network: [],
          conceptmap: [],
          mindmap: [],
          general: [],
        },
        keywordFrequency: {
          flow: 0,
          flowchart: 0,
          tree: 0,
          timeline: 0,
          matrix: 0,
          cycle: 0,
          comparison: 0,
          network: 0,
          conceptmap: 0,
          mindmap: 0,
          general: 0,
        },
        totalKeywords: 0,
        relationPatterns: {
          flow: 0,
          flowchart: 0,
          tree: 0,
          timeline: 0,
          matrix: 0,
          cycle: 0,
          comparison: 0,
          network: 0,
          conceptmap: 0,
          mindmap: 0,
          general: 0,
        },
      };

      const confidence = detector.calculateConfidence('flow', features);
      expect(confidence).toBe(0);
    });

    it('calculateConfidence returns higher score for more keyword hits', () => {
      const sparseFeatures: TextFeatures = {
        keywordHits: {
          flow: ['まず'],
          flowchart: [],
          tree: [],
          timeline: [],
          matrix: [],
          cycle: [],
          comparison: [],
          network: [],
          conceptmap: [],
          mindmap: [],
          general: [],
        },
        keywordFrequency: {
          flow: 1,
          flowchart: 0,
          tree: 0,
          timeline: 0,
          matrix: 0,
          cycle: 0,
          comparison: 0,
          network: 0,
          conceptmap: 0,
          mindmap: 0,
          general: 0,
        },
        totalKeywords: 1,
        relationPatterns: {
          flow: 0,
          flowchart: 0,
          tree: 0,
          timeline: 0,
          matrix: 0,
          cycle: 0,
          comparison: 0,
          network: 0,
          conceptmap: 0,
          mindmap: 0,
          general: 0,
        },
      };

      const richFeatures: TextFeatures = {
        keywordHits: {
          flow: ['まず', '次に', '最後に', '手順', 'ステップ'],
          flowchart: [],
          tree: [],
          timeline: [],
          matrix: [],
          cycle: [],
          comparison: [],
          network: [],
          conceptmap: [],
          mindmap: [],
          general: [],
        },
        keywordFrequency: {
          flow: 10,
          flowchart: 0,
          tree: 0,
          timeline: 0,
          matrix: 0,
          cycle: 0,
          comparison: 0,
          network: 0,
          conceptmap: 0,
          mindmap: 0,
          general: 0,
        },
        totalKeywords: 10,
        relationPatterns: {
          flow: 2,
          flowchart: 0,
          tree: 0,
          timeline: 0,
          matrix: 0,
          cycle: 0,
          comparison: 0,
          network: 0,
          conceptmap: 0,
          mindmap: 0,
          general: 0,
        },
      };

      const sparseConfidence = detector.calculateConfidence('flow', sparseFeatures);
      const richConfidence = detector.calculateConfidence('flow', richFeatures);

      expect(richConfidence).toBeGreaterThan(sparseConfidence);
    });
  });

  // -----------------------------------------------------------------------
  // Additional edge case tests
  // -----------------------------------------------------------------------
  describe('Edge cases', () => {
    it('should handle empty segments gracefully', () => {
      const result = detector.detect(null, []);
      expect(result).toBeDefined();
      expect(result.primaryType).toBeDefined();
      expect(typeof result.confidence).toBe('number');
    });

    it('should handle segments with empty text', () => {
      const segments = [makeSegment('')];
      const result = detector.detect(null, segments);
      expect(result).toBeDefined();
    });

    it('should boost confidence when LLM recommendation matches rule-based detection', () => {
      const segments = [
        makeSegment('まず要件を定義します。次に設計を行います。最後に実装します。'),
      ];

      const llmResult: DiagramAnalysis = {
        type: 'flow',
        confidence: 0.9,
        nodes: [],
        edges: [],
        reasoning: 'LLM detected flow',
      };

      const resultWithoutLLM = detector.detect(null, segments);
      const resultWithLLM = detector.detect(llmResult, segments);

      // With LLM match, confidence should be at least as high
      expect(resultWithLLM.primaryType).toBe('flow');
      expect(resultWithLLM.confidence).toBeGreaterThanOrEqual(resultWithoutLLM.confidence);
    });

    it('should handle multiple segments combined', () => {
      const segments = [
        makeSegment('動物は哺乳類と爬虫類に分類されます。'),
        makeSegment('哺乳類には犬、猫が属します。爬虫類にはトカゲ、ヘビが含まれます。'),
      ];

      const result = detector.detect(null, segments);
      expect(result.primaryType).toBe('tree');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('should always return valid DiagramDetectionResult structure', () => {
      const segments = [makeSegment('任意のテキスト')];
      const result = detector.detect(null, segments);

      expect(result).toHaveProperty('primaryType');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('alternatives');
      expect(result).toHaveProperty('isComplex');
      expect(result).toHaveProperty('secondaryTypes');
      expect(result).toHaveProperty('fusionStrategy');
      expect(result).toHaveProperty('reasoning');
      expect(typeof result.isComplex).toBe('boolean');
      expect(Array.isArray(result.secondaryTypes)).toBe(true);
      expect(Array.isArray(result.alternatives)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // TASK-0101: analyze() method tests for branch coverage
  // -----------------------------------------------------------------------
  describe('TASK-0101: analyze() method', () => {
    it('should return analysis with nodes and edges for flow text', async () => {
      const segment = makeSegment('First we gather requirements. Next we design the system. Then we implement. Finally we test.');
      const result = await detector.analyze(segment);

      expect(result).toBeDefined();
      expect(result.type).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.nodes.length).toBeGreaterThan(0);
      expect(result.edges.length).toBeGreaterThan(0);
      expect(result.reasoning).toBeDefined();
    });

    it('should return analysis for tree text', async () => {
      const segment = makeSegment('The organization has a hierarchy with CEO at the top. Directors report to the VP. Teams are under each department.');
      const result = await detector.analyze(segment);

      expect(result).toBeDefined();
      expect(result.nodes.length).toBeGreaterThan(0);
    });

    it('should return analysis for timeline text', async () => {
      const segment = makeSegment('The project started in January 2023. By April we completed the first phase. The final milestone is in June.');
      const result = await detector.analyze(segment);

      expect(result).toBeDefined();
      expect(result.nodes.length).toBeGreaterThan(0);
    });

    it('should return analysis for cycle text', async () => {
      const segment = makeSegment('The continuous cycle involves planning, executing, reviewing, and improving. This loop repeats iteratively with feedback.');
      const result = await detector.analyze(segment);

      expect(result).toBeDefined();
      expect(result.nodes.length).toBeGreaterThan(0);
    });

    it('should return analysis for matrix/comparison text', async () => {
      const segment = makeSegment('Comparing Option A versus Option B: Option A has better cost but Option B has more features.');
      const result = await detector.analyze(segment);

      expect(result).toBeDefined();
      expect(result.nodes.length).toBeGreaterThan(0);
    });

    it('should handle error gracefully and return fallback analysis', async () => {
      const segment = makeSegment('');
      // Force an error by passing a segment with problematic content
      const result = await detector.analyze(segment);

      expect(result).toBeDefined();
      expect(result.type).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // TASK-0101: nextIteration / statistical / hybrid analysis paths
  // -----------------------------------------------------------------------
  describe('TASK-0101: iterative analysis paths', () => {
    it('should apply statistical analysis at iteration 2', async () => {
      detector.nextIteration(); // move to iteration 2
      const segment = makeSegment('First we gather requirements. Next we design the system. Then we implement.');
      const result = await detector.analyze(segment);

      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should apply hybrid analysis at iteration 3', async () => {
      detector.nextIteration();
      detector.nextIteration(); // move to iteration 3
      const segment = makeSegment('The cycle of planning, executing, and reviewing repeats continuously.');
      const result = await detector.analyze(segment);

      expect(result).toBeDefined();
      expect(result.type).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // TASK-0101: extractTextFeatures edge cases
  // -----------------------------------------------------------------------
  describe('TASK-0101: extractTextFeatures edge cases', () => {
    it('should handle text with arrow relation patterns', () => {
      const features = detector.extractTextFeatures('A → B leads to C', []);
      expect(features.relationPatterns.flow).toBeGreaterThan(0);
    });

    it('should handle text with Japanese relation patterns', () => {
      const features = detector.extractTextFeatures('AからBまで属する含まれる分類', []);
      expect(features.relationPatterns.tree).toBeGreaterThan(0);
    });

    it('should handle text with cycle relation patterns', () => {
      const features = detector.extractTextFeatures('returns to and cycles back and repeats', []);
      expect(features.relationPatterns.cycle).toBeGreaterThan(0);
    });

    it('should return zero features for text with no keywords', () => {
      const features = detector.extractTextFeatures('', []);
      expect(features.totalKeywords).toBe(0);
      expect(Object.values(features.keywordFrequency).every(v => v === 0)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // TASK-0101: calculateConfidence edge cases
  // -----------------------------------------------------------------------
  describe('TASK-0101: calculateConfidence edge cases', () => {
    it('should return 0 when frequency and relation patterns are both 0', () => {
      const features: TextFeatures = {
        keywordHits: { flow: [], flowchart: [], tree: [], timeline: [], matrix: [], cycle: [], comparison: [], network: [], conceptmap: [], mindmap: [], general: [] },
        keywordFrequency: { flow: 0, flowchart: 0, tree: 0, timeline: 0, matrix: 0, cycle: 0, comparison: 0, network: 0, conceptmap: 0, mindmap: 0, general: 0 },
        totalKeywords: 0,
        relationPatterns: { flow: 0, flowchart: 0, tree: 0, timeline: 0, matrix: 0, cycle: 0, comparison: 0, network: 0, conceptmap: 0, mindmap: 0, general: 0 },
      };
      expect(detector.calculateConfidence('cycle', features)).toBe(0);
      expect(detector.calculateConfidence('tree', features)).toBe(0);
    });

    it('should return high confidence with many hits and frequency', () => {
      const features: TextFeatures = {
        keywordHits: { flow: ['a', 'b', 'c'], flowchart: [], tree: [], timeline: [], matrix: [], cycle: [], comparison: [], network: [], conceptmap: [], mindmap: [], general: [] },
        keywordFrequency: { flow: 6, flowchart: 0, tree: 0, timeline: 0, matrix: 0, cycle: 0, comparison: 0, network: 0, conceptmap: 0, mindmap: 0, general: 0 },
        totalKeywords: 6,
        relationPatterns: { flow: 1, flowchart: 0, tree: 0, timeline: 0, matrix: 0, cycle: 0, comparison: 0, network: 0, conceptmap: 0, mindmap: 0, general: 0 },
      };
      const conf = detector.calculateConfidence('flow', features);
      expect(conf).toBeGreaterThanOrEqual(0.7);
    });

    it('should dampen confidence for single hit with low frequency', () => {
      const features: TextFeatures = {
        keywordHits: { flow: ['a'], flowchart: [], tree: [], timeline: [], matrix: [], cycle: [], comparison: [], network: [], conceptmap: [], mindmap: [], general: [] },
        keywordFrequency: { flow: 1, flowchart: 0, tree: 0, timeline: 0, matrix: 0, cycle: 0, comparison: 0, network: 0, conceptmap: 0, mindmap: 0, general: 0 },
        totalKeywords: 1,
        relationPatterns: { flow: 0, flowchart: 0, tree: 0, timeline: 0, matrix: 0, cycle: 0, comparison: 0, network: 0, conceptmap: 0, mindmap: 0, general: 0 },
      };
      const conf = detector.calculateConfidence('flow', features);
      expect(conf).toBeLessThanOrEqual(0.45);
    });
  });
});
