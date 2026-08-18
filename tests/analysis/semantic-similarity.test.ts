/**
 * Tests for Semantic Similarity module
 * Covers: CJK tokenization, edge cases, threshold clamping, metrics tracking
 */

import {
  calculateSemanticSimilarity,
  findMostSimilar,
  areTextsSimilar,
  SemanticMetricsTracker,
} from '@/analysis/semantic-similarity';

// ========================================
// calculateSemanticSimilarity
// ========================================

describe('calculateSemanticSimilarity', () => {
  it('returns 1.0 for identical strings', () => {
    expect(calculateSemanticSimilarity('hello world', 'hello world')).toBe(1.0);
  });

  it('returns 1.0 for case-insensitive match', () => {
    expect(calculateSemanticSimilarity('Hello World', 'hello world')).toBe(1.0);
  });

  it('returns 1.0 for both empty strings', () => {
    expect(calculateSemanticSimilarity('', '')).toBe(1.0);
  });

  it('returns 1.0 for whitespace-only strings (both trim to empty)', () => {
    expect(calculateSemanticSimilarity('   ', '  ')).toBe(1.0);
  });

  it('returns 0 when one string is empty', () => {
    expect(calculateSemanticSimilarity('hello', '')).toBe(0);
    expect(calculateSemanticSimilarity('', 'hello')).toBe(0);
  });

  it('returns 0 when one string is whitespace-only after trim', () => {
    expect(calculateSemanticSimilarity('hello', '   ')).toBe(0);
  });

  it('returns 0 for texts with very different lengths', () => {
    expect(calculateSemanticSimilarity('hi', 'a very long sentence that goes on and on')).toBe(0);
  });

  it('returns high similarity for near-identical Latin text', () => {
    const score = calculateSemanticSimilarity(
      'the quick brown fox',
      'the quick brown fox jumps'
    );
    expect(score).toBeGreaterThan(0.5);
  });

  it('returns low similarity for completely different Latin text', () => {
    const score = calculateSemanticSimilarity(
      'database query optimization',
      'weather forecast tomorrow'
    );
    expect(score).toBeLessThan(0.5);
  });

  it('returns a value between 0 and 1 for partial matches', () => {
    const score = calculateSemanticSimilarity('hello world', 'hello earth');
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  // CJK (Japanese) tokenization tests

  it('returns 1.0 for identical Japanese text', () => {
    expect(calculateSemanticSimilarity('音声認識の結果', '音声認識の結果')).toBe(1.0);
  });

  it('returns high similarity for similar Japanese text', () => {
    const score = calculateSemanticSimilarity(
      '音声認識の結果について',
      '音声認識の結果を分析'
    );
    expect(score).toBeGreaterThan(0.3);
  });

  it('handles mixed Japanese and Latin text', () => {
    const score = calculateSemanticSimilarity(
      'React コンポーネント',
      'React コンポーネント'
    );
    expect(score).toBe(1.0);
  });

  it('returns similarity for katakana text', () => {
    const score = calculateSemanticSimilarity(
      'パイプライン処理',
      'パイプライン処理結果'
    );
    expect(score).toBeGreaterThan(0);
  });

  it('handles hiragana text', () => {
    const score = calculateSemanticSimilarity(
      'これはてすとです',
      'これはてすと'
    );
    expect(score).toBeGreaterThan(0);
  });

  it('handles kanji text', () => {
    const score = calculateSemanticSimilarity(
      '音声認識結果分析',
      '音声認識結果'
    );
    expect(score).toBeGreaterThan(0);
  });

  it('correctly compares CJK vs Latin text with different scripts', () => {
    // These should have low similarity - different character sets entirely
    const score = calculateSemanticSimilarity('hello world', 'こんにちは世界');
    // Length ratio check will cause early return if too different
    // Both are ~11 and ~6 chars, ratio = 6/11 = 0.545 > 0.5 so won't early return
    expect(score).toBeLessThan(0.5);
  });

  it('trims whitespace before comparison', () => {
    expect(calculateSemanticSimilarity('  hello  ', 'hello')).toBe(1.0);
  });
});

// ========================================
// findMostSimilar
// ========================================

describe('findMostSimilar', () => {
  const candidates = [
    { text: 'the quick brown fox', data: 'fox' },
    { text: 'the lazy dog', data: 'dog' },
    { text: 'a brown fox jumps', data: 'jump' },
  ];

  it('finds the best matching candidate', () => {
    const result = findMostSimilar('quick brown fox', candidates);
    expect(result).not.toBeNull();
    expect(result!.data).toBe('fox');
  });

  it('returns null when no candidate meets threshold', () => {
    const result = findMostSimilar('completely different query', candidates, 0.99);
    expect(result).toBeNull();
  });

  it('returns null for empty candidates array', () => {
    const result = findMostSimilar('hello', []);
    expect(result).toBeNull();
  });

  it('returns best match from multiple qualifying candidates', () => {
    const result = findMostSimilar('the quick brown fox', candidates);
    expect(result).not.toBeNull();
    expect(result!.similarity).toBeGreaterThan(0);
  });

  it('clamps negative threshold to 0', () => {
    // With threshold 0, even dissimilar texts should match the best one
    const result = findMostSimilar('xyz', [{ text: 'abc', data: 1 }], -1);
    expect(result).not.toBeNull();
  });

  it('clamps threshold above 1 to 1', () => {
    const result = findMostSimilar('hello', [{ text: 'hello', data: 1 }], 5);
    // Even exact match can't exceed threshold of 1 (clamped)
    expect(result).not.toBeNull();
    expect(result!.similarity).toBe(1.0);
  });

  it('uses default threshold of 0.75', () => {
    // A moderate match should pass default threshold
    const result = findMostSimilar('quick brown fox', candidates);
    expect(result).not.toBeNull();
  });
});

// ========================================
// areTextsSimilar
// ========================================

describe('areTextsSimilar', () => {
  it('returns true for identical text', () => {
    expect(areTextsSimilar('hello', 'hello')).toBe(true);
  });

  it('returns true for exact match with different case', () => {
    expect(areTextsSimilar('Hello', 'hello')).toBe(true);
  });

  it('returns false for completely different text', () => {
    expect(areTextsSimilar('database', 'weather')).toBe(false);
  });

  it('respects custom threshold', () => {
    const low = areTextsSimilar('hello world', 'hello earth', 0.3);
    const high = areTextsSimilar('hello world', 'hello earth', 0.99);
    expect(low).toBe(true);
    expect(high).toBe(false);
  });

  it('clamps threshold to valid range', () => {
    expect(areTextsSimilar('hello', 'hello', -1)).toBe(true);
    expect(areTextsSimilar('hello', 'hello', 5)).toBe(true);
  });
});

// ========================================
// SemanticMetricsTracker
// ========================================

describe('SemanticMetricsTracker', () => {
  it('starts with zero metrics', () => {
    const tracker = new SemanticMetricsTracker();
    const metrics = tracker.getMetrics();
    expect(metrics.exactHits).toBe(0);
    expect(metrics.semanticHits).toBe(0);
    expect(metrics.misses).toBe(0);
    expect(metrics.avgSimilarityScore).toBe(0);
    expect(metrics.totalComparisons).toBe(0);
  });

  it('tracks exact hits', () => {
    const tracker = new SemanticMetricsTracker();
    tracker.recordExactHit();
    tracker.recordExactHit();
    expect(tracker.getMetrics().exactHits).toBe(2);
  });

  it('tracks semantic hits with similarity scores', () => {
    const tracker = new SemanticMetricsTracker();
    tracker.recordSemanticHit(0.85);
    tracker.recordSemanticHit(0.92);
    const metrics = tracker.getMetrics();
    expect(metrics.semanticHits).toBe(2);
    expect(metrics.avgSimilarityScore).toBeCloseTo(0.885, 3);
  });

  it('tracks misses', () => {
    const tracker = new SemanticMetricsTracker();
    tracker.recordMiss();
    tracker.recordMiss();
    tracker.recordMiss();
    expect(tracker.getMetrics().misses).toBe(3);
  });

  it('tracks comparisons', () => {
    const tracker = new SemanticMetricsTracker();
    tracker.recordComparison();
    tracker.recordComparison();
    expect(tracker.getMetrics().totalComparisons).toBe(2);
  });

  it('resets all counters', () => {
    const tracker = new SemanticMetricsTracker();
    tracker.recordExactHit();
    tracker.recordSemanticHit(0.8);
    tracker.recordMiss();
    tracker.recordComparison();
    tracker.reset();
    const metrics = tracker.getMetrics();
    expect(metrics.exactHits).toBe(0);
    expect(metrics.semanticHits).toBe(0);
    expect(metrics.misses).toBe(0);
    expect(metrics.avgSimilarityScore).toBe(0);
    expect(metrics.totalComparisons).toBe(0);
  });

  it('prevents unbounded growth of similarity scores (memory safety)', () => {
    const tracker = new SemanticMetricsTracker();
    // Record more than MAX_SCORE_HISTORY entries
    for (let i = 0; i < 1100; i++) {
      tracker.recordSemanticHit(Math.random());
    }
    const metrics = tracker.getMetrics();
    // All hits should be counted
    expect(metrics.semanticHits).toBe(1100);
    // But the scores array should be capped for avg calculation
    expect(metrics.avgSimilarityScore).toBeGreaterThan(0);
    expect(metrics.avgSimilarityScore).toBeLessThanOrEqual(1);
  });

  it('returns 0 avgSimilarity when only misses and exact hits recorded', () => {
    const tracker = new SemanticMetricsTracker();
    tracker.recordExactHit();
    tracker.recordMiss();
    expect(tracker.getMetrics().avgSimilarityScore).toBe(0);
  });

  it('filters out NaN scores in getMetrics', () => {
    const tracker = new SemanticMetricsTracker();
    tracker.recordSemanticHit(NaN);
    tracker.recordSemanticHit(0.8);
    tracker.recordSemanticHit(0.9);
    const metrics = tracker.getMetrics();
    // avg should only include finite scores: (0.8 + 0.9) / 2 = 0.85
    expect(metrics.avgSimilarityScore).toBeCloseTo(0.85, 3);
    expect(Number.isFinite(metrics.avgSimilarityScore)).toBe(true);
  });

  it('returns 0 avgSimilarity when all scores are NaN', () => {
    const tracker = new SemanticMetricsTracker();
    tracker.recordSemanticHit(NaN);
    tracker.recordSemanticHit(NaN);
    const metrics = tracker.getMetrics();
    expect(metrics.avgSimilarityScore).toBe(0);
    expect(Number.isFinite(metrics.avgSimilarityScore)).toBe(true);
  });
});
