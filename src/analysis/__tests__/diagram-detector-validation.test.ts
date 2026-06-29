/**
 * Tests for diagram-detector consensus scoring validation hardening.
 *
 * hybridAnalysis and statisticalAnalysis now guard against NaN confidence
 * and invalid DiagramType values in candidate results. These tests verify
 * that the output is always finite and doesn't crash when internal
 * data paths produce edge-case values.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { DiagramDetector } from '../diagram-detector';
import type { ContentSegment } from '../types';

function makeSegment(text: string): ContentSegment {
  return {
    startMs: 0,
    endMs: 5000,
    text,
    summary: text.slice(0, 60),
    keyphrases: [],
    confidence: 0.9,
  };
}

describe('DiagramDetector hybridAnalysis validation', () => {
  let detector: DiagramDetector;

  beforeEach(() => {
    detector = new DiagramDetector();
    // Move to iteration 3 to trigger hybridAnalysis path
    detector.nextIteration();
    detector.nextIteration();
  });

  it('produces finite confidence at iteration 3 (hybridAnalysis)', async () => {
    const segment = makeSegment('まず要件を定義します。次に設計を行います。最後に実装します。');
    const result = await detector.analyze(segment);

    expect(Number.isFinite(result.confidence)).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('produces valid diagram type at iteration 3', async () => {
    const segment = makeSegment('第一に、企画を行います。第二に、開発します。第三に、テストします。');
    const result = await detector.analyze(segment);

    expect(result.type).toBeDefined();
    expect(typeof result.type).toBe('string');
    expect(result.type.length).toBeGreaterThan(0);
  });

  it('produces finite confidence for ambiguous text at iteration 3', async () => {
    const segment = makeSegment('あいうえおかきくけこさしすせそ');
    const result = await detector.analyze(segment);

    expect(Number.isFinite(result.confidence)).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('produces finite confidence for empty text at iteration 3', async () => {
    const segment = makeSegment('');
    const result = await detector.analyze(segment);

    expect(Number.isFinite(result.confidence)).toBe(true);
  });

  it('produces finite nodes and edges at iteration 3', async () => {
    const segment = makeSegment('プロセスAの後にプロセスBを実行し、その後プロセスCに移行します。');
    const result = await detector.analyze(segment);

    expect(Array.isArray(result.nodes)).toBe(true);
    expect(Array.isArray(result.edges)).toBe(true);
  });
});

describe('DiagramDetector statisticalAnalysis NaN guard', () => {
  let detector: DiagramDetector;

  beforeEach(() => {
    detector = new DiagramDetector();
    // Move to iteration 2 to trigger statisticalAnalysis path
    detector.nextIteration();
  });

  it('produces finite confidence at iteration 2 (statisticalAnalysis)', async () => {
    const segment = makeSegment('まず設計して、次に実装します。');
    const result = await detector.analyze(segment);

    expect(Number.isFinite(result.confidence)).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});

describe('DiagramDetector consensus scoring robustness', () => {
  it('does not crash with very long text at iteration 3', async () => {
    const detector = new DiagramDetector();
    detector.nextIteration();
    detector.nextIteration();

    const longText = 'まず開始します。'.repeat(200);
    const segment = makeSegment(longText);
    const result = await detector.analyze(segment);

    expect(Number.isFinite(result.confidence)).toBe(true);
  });

  it('maintains confidence in valid range across multiple iterations', async () => {
    const detector = new DiagramDetector();
    const segment = makeSegment('最初に要件定義、次に設計、そして実装、最後にテストを実施します。');

    for (let i = 0; i < 5; i++) {
      if (i > 0) detector.nextIteration();
      const result = await detector.analyze(segment);
      expect(Number.isFinite(result.confidence)).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    }
  });
});
