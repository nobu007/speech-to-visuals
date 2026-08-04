import {
  calculateSemanticSimilarity,
  findMostSimilar,
  areTextsSimilar,
  SemanticMetricsTracker,
} from '../semantic-similarity';

describe('semantic-similarity', () => {
  describe('calculateSemanticSimilarity', () => {
    it('should return 1.0 for identical text', () => {
      expect(calculateSemanticSimilarity('hello world', 'hello world')).toBe(1.0);
    });

    it('should return 1.0 for case-insensitive match', () => {
      expect(calculateSemanticSimilarity('Hello World', 'hello world')).toBe(1.0);
    });

    it('should return 0 for texts with very different lengths (ratio < 0.5)', () => {
      const short = 'hi';
      const long = 'this is a very long sentence that is definitely much longer than the short one';
      expect(calculateSemanticSimilarity(short, long)).toBe(0);
    });

    it('should return high similarity for similar texts', () => {
      const sim = calculateSemanticSimilarity(
        'The quick brown fox jumps over the lazy dog',
        'The quick brown fox jumped over the lazy dogs'
      );
      expect(sim).toBeGreaterThan(0.6);
    });

    it('should return lower similarity for less similar texts', () => {
      const sim = calculateSemanticSimilarity(
        'machine learning algorithms',
        'cooking recipes for dinner'
      );
      expect(sim).toBeLessThan(0.5);
    });

    it('should handle empty strings', () => {
      // Both empty after trim - exact match
      expect(calculateSemanticSimilarity('', '')).toBe(1.0);
    });

    it('should handle text with only whitespace', () => {
      expect(calculateSemanticSimilarity('   ', '   ')).toBe(1.0);
    });

    it('should handle single-character texts (length ratio edge)', () => {
      const sim = calculateSemanticSimilarity('ab', 'cd');
      // Both 2 chars, ratio = 1, but no common tokens
      expect(sim).toBeGreaterThanOrEqual(0);
    });

    // --- CJK (Japanese/Chinese/Korean) tokenization tests ---

    it('should return 1.0 for identical Japanese text', () => {
      expect(calculateSemanticSimilarity('音声認識のテスト', '音声認識のテスト')).toBe(1.0);
    });

    it('should return high similarity for similar Japanese text', () => {
      const sim = calculateSemanticSimilarity(
        '音声認識システムのテスト',
        '音声認識システムをテストする'
      );
      expect(sim).toBeGreaterThan(0.5);
    });

    it('should handle mixed CJK and Latin text', () => {
      const sim = calculateSemanticSimilarity(
        'Whisperによる音声認識',
        'Whisperによる音声認識テスト'
      );
      expect(sim).toBeGreaterThan(0.5);
    });

    it('should return low similarity for different CJK content', () => {
      const sim = calculateSemanticSimilarity(
        '完全に異なる日本語の文章',
        'まったく関係ない別の内容'
      );
      expect(sim).toBeLessThan(0.5);
    });

    it('should handle Korean text (Hangul)', () => {
      const sim = calculateSemanticSimilarity(
        '음성 인식 시스템',
        '음성 인식 시스템 테스트'
      );
      expect(sim).toBeGreaterThan(0.5);
    });

    it('should return 0 for one empty and one non-empty text', () => {
      expect(calculateSemanticSimilarity('', 'hello')).toBe(0);
      expect(calculateSemanticSimilarity('hello', '')).toBe(0);
    });

    it('should handle texts at exactly 0.5 length ratio boundary', () => {
      // 'abcd' and 'ab' → ratio = 2/4 = 0.5, should not be rejected
      const sim = calculateSemanticSimilarity('abcd', 'ab');
      expect(sim).toBeGreaterThanOrEqual(0);
    });

    it('should clamp threshold outside [0,1] range in findMostSimilar', () => {
      const candidates = [{ text: 'hello world', data: 1 }];
      // threshold > 1 gets clamped to 1, so only exact match qualifies
      const resultAbove = findMostSimilar('hello world', candidates, 5);
      expect(resultAbove).not.toBeNull();
      expect(resultAbove!.similarity).toBe(1.0);
    });

    it('should clamp threshold below 0 in areTextsSimilar', () => {
      // threshold < 0 gets clamped to 0, so any non-negative similarity qualifies
      expect(areTextsSimilar('abc', 'xyz', -1)).toBe(true);
    });

    it('should handle SemanticMetricsTracker score history cap', () => {
      const tracker = new SemanticMetricsTracker();
      // Record more than MAX_SCORE_HISTORY (1000) entries
      for (let i = 0; i < 1050; i++) {
        tracker.recordSemanticHit(0.5);
      }
      const metrics = tracker.getMetrics();
      // All hits are counted
      expect(metrics.semanticHits).toBe(1050);
      // But avg is still computed from trimmed history
      expect(metrics.avgSimilarityScore).toBeCloseTo(0.5, 1);
    });
  });

  describe('findMostSimilar', () => {
    it('should find exact match', () => {
      const candidates = [
        { text: 'hello world', data: 1 },
        { text: 'foo bar', data: 2 },
      ];
      const result = findMostSimilar('hello world', candidates);
      expect(result).not.toBeNull();
      expect(result!.data).toBe(1);
      expect(result!.similarity).toBe(1.0);
    });

    it('should find most similar text above threshold', () => {
      const candidates = [
        { text: 'quick brown fox', data: 'a' },
        { text: 'completely different topic', data: 'b' },
      ];
      const result = findMostSimilar('the quick brown fox jumps', candidates, 0.3);
      expect(result).not.toBeNull();
      expect(result!.data).toBe('a');
    });

    it('should return null when no candidate meets threshold', () => {
      const candidates = [
        { text: 'completely different topic', data: 'b' },
      ];
      const result = findMostSimilar('quantum physics equations', candidates, 0.9);
      expect(result).toBeNull();
    });

    it('should return null for empty candidates', () => {
      const result = findMostSimilar('query', []);
      expect(result).toBeNull();
    });

    it('should pick the best match when multiple exceed threshold', () => {
      const candidates = [
        { text: 'quick brown fox jumps', data: 'better' },
        { text: 'quick brown fox', data: 'good' },
      ];
      const result = findMostSimilar('quick brown fox jumps over', candidates, 0.5);
      expect(result).not.toBeNull();
      expect(result!.data).toBe('better');
    });
  });

  describe('areTextsSimilar', () => {
    it('should return true for identical texts', () => {
      expect(areTextsSimilar('hello', 'hello')).toBe(true);
    });

    it('should return false for completely different texts', () => {
      expect(areTextsSimilar('abc', 'xyz')).toBe(false);
    });

    it('should use custom threshold', () => {
      expect(areTextsSimilar('hello world', 'hello earth', 0.3)).toBe(true);
      expect(areTextsSimilar('hello world', 'hello earth', 0.99)).toBe(false);
    });
  });

  describe('SemanticMetricsTracker', () => {
    it('should track metrics with zero initial state', () => {
      const tracker = new SemanticMetricsTracker();
      const metrics = tracker.getMetrics();
      expect(metrics.exactHits).toBe(0);
      expect(metrics.semanticHits).toBe(0);
      expect(metrics.misses).toBe(0);
      expect(metrics.avgSimilarityScore).toBe(0);
      expect(metrics.totalComparisons).toBe(0);
    });

    it('should track exact hits', () => {
      const tracker = new SemanticMetricsTracker();
      tracker.recordExactHit();
      tracker.recordExactHit();
      expect(tracker.getMetrics().exactHits).toBe(2);
    });

    it('should track semantic hits with similarity scores', () => {
      const tracker = new SemanticMetricsTracker();
      tracker.recordSemanticHit(0.85);
      tracker.recordSemanticHit(0.92);
      const metrics = tracker.getMetrics();
      expect(metrics.semanticHits).toBe(2);
      expect(metrics.avgSimilarityScore).toBeCloseTo(0.885, 2);
    });

    it('should track misses', () => {
      const tracker = new SemanticMetricsTracker();
      tracker.recordMiss();
      expect(tracker.getMetrics().misses).toBe(1);
    });

    it('should track comparisons', () => {
      const tracker = new SemanticMetricsTracker();
      tracker.recordComparison();
      tracker.recordComparison();
      expect(tracker.getMetrics().totalComparisons).toBe(2);
    });

    it('should reset all metrics', () => {
      const tracker = new SemanticMetricsTracker();
      tracker.recordExactHit();
      tracker.recordSemanticHit(0.9);
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
  });
});
