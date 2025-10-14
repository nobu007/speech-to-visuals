/**
 * Semantic Similarity Calculator for LLM Cache
 *
 * Provides lightweight similarity matching to identify semantically similar queries
 * without requiring heavy ML models or external dependencies.
 *
 * Techniques used:
 * 1. Token-based Jaccard similarity (fast, no dependencies)
 * 2. N-gram overlap for capturing phrase-level similarity
 * 3. Length normalization to prevent false positives
 * 4. Configurable similarity threshold
 */

/**
 * Tokenize text into normalized tokens
 */
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .split(/\s+/)
      .filter(token => token.length > 1) // Remove single characters
  );
}

/**
 * Generate n-grams from text
 */
function generateNgrams(text: string, n: number): Set<string> {
  const normalized = text.toLowerCase().replace(/\s+/g, '');
  const ngrams = new Set<string>();

  for (let i = 0; i <= normalized.length - n; i++) {
    ngrams.add(normalized.slice(i, i + n));
  }

  return ngrams;
}

/**
 * Calculate Jaccard similarity between two sets
 * Returns value between 0 (completely different) and 1 (identical)
 */
function jaccardSimilarity<T>(set1: Set<T>, set2: Set<T>): number {
  if (set1.size === 0 && set2.size === 0) return 1;
  if (set1.size === 0 || set2.size === 0) return 0;

  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

/**
 * Calculate comprehensive semantic similarity score
 *
 * @param text1 - First text to compare
 * @param text2 - Second text to compare
 * @returns Similarity score between 0 and 1
 */
export function calculateSemanticSimilarity(text1: string, text2: string): number {
  // Normalize inputs
  const t1 = text1.trim();
  const t2 = text2.trim();

  // Exact match shortcut
  if (t1.toLowerCase() === t2.toLowerCase()) {
    return 1.0;
  }

  // Length difference check (prevent matching very different length texts)
  const lengthRatio = Math.min(t1.length, t2.length) / Math.max(t1.length, t2.length);
  if (lengthRatio < 0.5) {
    return 0; // Texts are too different in length
  }

  // Token-based similarity (word-level)
  const tokens1 = tokenize(t1);
  const tokens2 = tokenize(t2);
  const tokenSimilarity = jaccardSimilarity(tokens1, tokens2);

  // Character n-gram similarity (captures typos and variations)
  const bigrams1 = generateNgrams(t1, 2);
  const bigrams2 = generateNgrams(t2, 2);
  const bigramSimilarity = jaccardSimilarity(bigrams1, bigrams2);

  const trigrams1 = generateNgrams(t1, 3);
  const trigrams2 = generateNgrams(t2, 3);
  const trigramSimilarity = jaccardSimilarity(trigrams1, trigrams2);

  // Weighted combination (prioritize token similarity for semantic matching)
  const combinedScore = (
    tokenSimilarity * 0.6 +      // 60% weight on word-level similarity
    bigramSimilarity * 0.2 +      // 20% weight on character bigrams
    trigramSimilarity * 0.2        // 20% weight on character trigrams
  );

  return combinedScore;
}

/**
 * Find most similar text from a collection
 *
 * @param query - Query text to match
 * @param candidates - Array of candidate texts with metadata
 * @param threshold - Minimum similarity threshold (0-1)
 * @returns Best matching candidate and similarity score, or null if none meet threshold
 */
export function findMostSimilar<T>(
  query: string,
  candidates: Array<{ text: string; data: T }>,
  threshold: number = 0.75
): { text: string; data: T; similarity: number } | null {
  let bestMatch: { text: string; data: T; similarity: number } | null = null;

  for (const candidate of candidates) {
    const similarity = calculateSemanticSimilarity(query, candidate.text);

    if (similarity >= threshold && (!bestMatch || similarity > bestMatch.similarity)) {
      bestMatch = {
        text: candidate.text,
        data: candidate.data,
        similarity,
      };
    }
  }

  return bestMatch;
}

/**
 * Check if two texts are semantically similar above threshold
 *
 * @param text1 - First text
 * @param text2 - Second text
 * @param threshold - Similarity threshold (default 0.75)
 * @returns true if similarity meets or exceeds threshold
 */
export function areTextsSimilar(text1: string, text2: string, threshold: number = 0.75): boolean {
  return calculateSemanticSimilarity(text1, text2) >= threshold;
}

/**
 * Performance metrics for semantic similarity
 */
export interface SemanticCacheMetrics {
  exactHits: number;
  semanticHits: number;
  misses: number;
  avgSimilarityScore: number;
  totalComparisons: number;
}

/**
 * Semantic cache metrics tracker
 */
export class SemanticMetricsTracker {
  private exactHits = 0;
  private semanticHits = 0;
  private misses = 0;
  private similarityScores: number[] = [];
  private totalComparisons = 0;

  recordExactHit(): void {
    this.exactHits++;
  }

  recordSemanticHit(similarity: number): void {
    this.semanticHits++;
    this.similarityScores.push(similarity);
  }

  recordMiss(): void {
    this.misses++;
  }

  recordComparison(): void {
    this.totalComparisons++;
  }

  getMetrics(): SemanticCacheMetrics {
    const avgSimilarity = this.similarityScores.length > 0
      ? this.similarityScores.reduce((sum, s) => sum + s, 0) / this.similarityScores.length
      : 0;

    return {
      exactHits: this.exactHits,
      semanticHits: this.semanticHits,
      misses: this.misses,
      avgSimilarityScore: avgSimilarity,
      totalComparisons: this.totalComparisons,
    };
  }

  reset(): void {
    this.exactHits = 0;
    this.semanticHits = 0;
    this.misses = 0;
    this.similarityScores = [];
    this.totalComparisons = 0;
  }
}
