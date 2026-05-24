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
 * 5. CJK (Chinese/Japanese/Korean) character-level tokenization
 */

/** Maximum number of similarity scores kept in memory */
const MAX_SCORE_HISTORY = 1000;

/**
 * Tokenize text into normalized tokens.
 * Handles both Latin (space-delimited words) and CJK (character-level) text.
 */
function tokenize(text: string): Set<string> {
  const tokens = new Set<string>();
  const lower = text.toLowerCase();

  // Extract CJK characters as individual tokens (each character is meaningful)
  const cjkChars = lower.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF\u3400-\u4DBF]/g);
  if (cjkChars) {
    for (const ch of cjkChars) {
      tokens.add(ch);
    }
  }

  // Extract Latin/alphanumeric tokens (space-delimited words)
  const latinTokens = lower
    .replace(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF\u3400-\u4DBF]/g, ' ') // Remove CJK
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .split(/\s+/)
    .filter(token => token.length > 1); // Remove single chars for Latin only

  for (const t of latinTokens) {
    tokens.add(t);
  }

  return tokens;
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

  // Both empty → identical
  if (t1.length === 0 && t2.length === 0) return 1.0;
  // One empty → no similarity
  if (t1.length === 0 || t2.length === 0) return 0;

  // Exact match shortcut
  if (t1.toLowerCase() === t2.toLowerCase()) {
    return 1.0;
  }

  // Length difference check (prevent matching very different length texts)
  const maxLen = Math.max(t1.length, t2.length);
  const minLen = Math.min(t1.length, t2.length);
  const lengthRatio = minLen / maxLen;
  if (lengthRatio < 0.5) {
    return 0; // Texts are too different in length
  }

  // Token-based similarity (word-level for Latin, character-level for CJK)
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
  // Clamp threshold to valid range
  const clampedThreshold = Math.max(0, Math.min(1, threshold));
  let bestMatch: { text: string; data: T; similarity: number } | null = null;

  for (const candidate of candidates) {
    const similarity = calculateSemanticSimilarity(query, candidate.text);

    if (similarity >= clampedThreshold && (!bestMatch || similarity > bestMatch.similarity)) {
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
  const clampedThreshold = Math.max(0, Math.min(1, threshold));
  return calculateSemanticSimilarity(text1, text2) >= clampedThreshold;
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
    // Prevent unbounded growth - keep only recent scores
    if (this.similarityScores.length > MAX_SCORE_HISTORY) {
      this.similarityScores = this.similarityScores.slice(-MAX_SCORE_HISTORY);
    }
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
