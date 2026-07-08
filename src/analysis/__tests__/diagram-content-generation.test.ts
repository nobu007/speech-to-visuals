/**
 * Tests verifying that diagram content generation uses actual input text
 * instead of returning hardcoded generic templates.
 *
 * Bug: generateDiagramSpecificContent() previously ignored the input text
 * and returned hardcoded labels like "Organization", "Management", "Input",
 * "Process", etc. regardless of what the user said.
 *
 * Fix: generateContentFromText() now extracts key phrases from the input
 * text and creates nodes/edges from them.
 */
import { DiagramDetector } from '../diagram-detector';
import type { ContentSegment } from '../types';

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

describe('Diagram content generation from text', () => {
  let detector: DiagramDetector;

  beforeEach(() => {
    detector = new DiagramDetector();
  });

  // -----------------------------------------------------------------------
  // Hardcoded label regression guard: none of these labels should appear
  // in output when the input text doesn't contain them.
  // -----------------------------------------------------------------------
  const HARDCODED_LABELS = [
    'Organization', 'Management', 'Departments', 'Teams', 'Employees',
    '2020: Conception', '2021: Planning', '2022: Development',
    'Initial Stage', 'Processing', 'Evaluation', 'Feedback', 'Optimization',
    'Option A', 'Option B', 'Criteria 1', 'Criteria 2', 'Analysis',
    'Input', 'Transform', 'Validate', 'Output',
    'Start', 'Condition', 'Path A (Yes)', 'Path B (No)', 'Merge', 'End',
    'Subject A', 'Subject B', 'Strengths A', 'Weaknesses A',
    'Central Hub', 'Node A', 'Node B', 'Node C', 'Node D', 'Node E',
  ];

  describe('nodes reflect input text (not hardcoded)', () => {
    it('should generate nodes containing words from English input about databases', async () => {
      const segment = makeSegment(
        'The database optimization process involves indexing, query tuning, cache configuration, and partitioning. Each step improves overall system performance significantly.'
      );
      const result = await detector.analyze(segment);

      const allLabels = result.nodes.map(n => n.label).join(' ');
      expect(allLabels.length).toBeGreaterThan(0);

      // At least some node labels should contain words from the input
      const inputWords = ['database', 'optimization', 'indexing', 'query', 'cache', 'partitioning', 'performance'];
      const matchCount = inputWords.filter(w =>
        allLabels.toLowerCase().includes(w)
      ).length;
      expect(matchCount).toBeGreaterThanOrEqual(2);
    });

    it('should generate nodes containing phrases from Japanese input', async () => {
      const segment = makeSegment(
        'データベースの最適化では、インデックス設計、クエリチューニング、キャッシュ設定が重要です。各ステップで性能が向上します。'
      );
      const result = await detector.analyze(segment);

      const allLabels = result.nodes.map(n => n.label).join(' ');
      // Should contain at least some Japanese phrases from the input
      const jpWords = ['データベース', '最適化', 'インデックス', 'クエリ', 'キャッシュ'];
      const matchCount = jpWords.filter(w => allLabels.includes(w)).length;
      expect(matchCount).toBeGreaterThanOrEqual(1);
    });

    it('should NOT return hardcoded labels when input is about cooking', async () => {
      const segment = makeSegment(
        'To make pasta, first boil water, add salt, cook the noodles for eight minutes, drain, and serve with sauce.'
      );
      const result = await detector.analyze(segment);

      const allLabels = result.nodes.map(n => n.label).join(' ');
      for (const hardcoded of HARDCODED_LABELS) {
        expect(allLabels).not.toContain(hardcoded);
      }
    });

    it('should NOT return hardcoded labels when input is about space exploration', async () => {
      const segment = makeSegment(
        'The rocket launch sequence includes fueling, ignition, liftoff, staging, orbital insertion, and satellite deployment.'
      );
      const result = await detector.analyze(segment);

      const allLabels = result.nodes.map(n => n.label).join(' ');
      for (const hardcoded of HARDCODED_LABELS) {
        expect(allLabels).not.toContain(hardcoded);
      }
    });
  });

  describe('different inputs produce different outputs', () => {
    it('should produce different node labels for different inputs', async () => {
      const seg1 = makeSegment(
        'The hiring process starts with resume screening, phone interview, technical assessment, onsite interview, and offer.'
      );
      const seg2 = makeSegment(
        'Gardening involves soil preparation, seed selection, planting, watering, weeding, and harvesting.'
      );

      const result1 = await detector.analyze(seg1);
      const result2 = await detector.analyze(seg2);

      const labels1 = result1.nodes.map(n => n.label).sort().join('|');
      const labels2 = result2.nodes.map(n => n.label).sort().join('|');

      expect(labels1).not.toBe(labels2);
    });
  });

  describe('edge structure matches diagram type', () => {
    it('should create edges connecting all nodes in sequence for flow diagrams', async () => {
      const segment = makeSegment(
        'The data pipeline ingests raw data, validates schema, transforms records, enriches with metadata, and loads to warehouse.'
      );
      const result = await detector.analyze(segment);

      expect(result.edges.length).toBeGreaterThan(0);
      // Every edge should have from, to, and label
      for (const edge of result.edges) {
        expect(edge.from).toMatch(/^node_\d+$/);
        expect(edge.to).toMatch(/^node_\d+$/);
      }
    });

    it('should create a circular edge for cycle diagrams', async () => {
      // Use text that triggers cycle detection
      const segment = makeSegment(
        'The continuous improvement cycle rotates through planning, execution, measurement, analysis, and refinement repeatedly.'
      );
      const result = await detector.analyze(segment);

      if (result.type === 'cycle' && result.nodes.length > 2) {
        // Last edge should connect back to node_0 for cycle
        const hasReturnEdge = result.edges.some(e => e.to === 'node_0');
        expect(hasReturnEdge).toBe(true);
      }
    });
  });

  describe('graceful handling of edge cases', () => {
    it('should produce at least one node for very short text', async () => {
      const segment = makeSegment('Hello world.');
      const result = await detector.analyze(segment);

      expect(result.nodes.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle empty text without crashing', async () => {
      const segment = makeSegment('');
      const result = await detector.analyze(segment);

      expect(result).toBeDefined();
      expect(result.nodes).toBeDefined();
      expect(result.edges).toBeDefined();
    });

    it('should limit nodes to a reasonable count for very long text', async () => {
      const longText = Array.from({ length: 20 }, (_, i) =>
        `Step ${i + 1} involves task number ${i + 1} with specific requirements.`
      ).join('. ');
      const segment = makeSegment(longText);

      const result = await detector.analyze(segment);
      expect(result.nodes.length).toBeLessThanOrEqual(8);
    });
  });

  describe('node importance values', () => {
    it('should assign decreasing importance to subsequent nodes', async () => {
      const segment = makeSegment(
        'The workflow covers requirement gathering, design phase, implementation, testing, deployment, and maintenance.'
      );
      const result = await detector.analyze(segment);

      if (result.nodes.length >= 2) {
        // Check via meta.importance if available, or just verify nodes exist
        const importances = result.nodes.map(n => n.meta?.importance ?? 0);
        if (importances.every(i => i > 0)) {
          expect(importances[0]).toBeGreaterThanOrEqual(importances[importances.length - 1]);
        }
      }
    });
  });
});
