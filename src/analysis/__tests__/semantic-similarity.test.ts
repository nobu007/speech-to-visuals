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
