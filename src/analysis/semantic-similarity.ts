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

import { clamp01 } from '@/utils/guards';
import { CappedArray } from '@/lib/capped-array';
import { buildCharClassRegex, CJK_TOKEN_RANGES } from '@/lib/unicode-script-ranges';

/** Maximum number of similarity scores kept in memory */
const MAX_SCORE_HISTORY = 1000;

/**
 * Tokenize text into normalized tokens.
 * Handles both Latin (space-delimited words) and CJK (character-level) text.
 */
/**
 * Per-character meaningful script class (round 23 single source).
 * Behavior change vs the pre-round-23 hand-rolled class: CJK Compatibility
 * Ideographs and Katakana Phonetic Extensions now tokenize as CJK chars
 * instead of falling through to the Latin path and being stripped.
 */
const CJK_TOKEN_CLASS = buildCharClassRegex(CJK_TOKEN_RANGES, 'g');

function tokenize(text: string): Set<string> {
  const tokens = new Set<string>();
  const lower = text.toLowerCase();

  // Extract CJK characters as individual tokens (each character is meaningful)
  const cjkChars = lower.match(CJK_TOKEN_CLASS);
  if (cjkChars) {
    for (const ch of cjkChars) {
      tokens.add(ch);
    }
  }

  // Extract Latin/alphanumeric tokens (space-delimited words)
  const latinTokens = lower
    .replace(CJK_TOKEN_CLASS, ' ') // Remove CJK
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
  const clampedThreshold = clamp01(threshold);
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
  const clampedThreshold = clamp01(threshold);
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
  // CappedArray makes the MAX_SCORE_HISTORY cap STRUCTURAL: every push
  // auto-evicts the oldest score, so a future second push path can never grow
  // history past the cap (the recurring "no-cap sibling" defect class).
  private similarityScores = new CappedArray<number>(MAX_SCORE_HISTORY);
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
    const validScores = this.similarityScores.filter(s => Number.isFinite(s));
    const avgSimilarity = validScores.length > 0
      ? validScores.reduce((sum, s) => sum + s, 0) / validScores.length
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
    this.similarityScores.clear();
    this.totalComparisons = 0;
  }
}
