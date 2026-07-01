import { TranscriptionSegment } from '@/transcription/types';
import { ContentSegment, AnalysisConfig } from './types';
import { logger } from '../utils/logger';
import { sanitizeFinite } from '@/utils/guards';

/**
 * Scene Segmentation Engine - Iterative Implementation
 * Converts transcription segments into meaningful content scenes
 * 🔄 Enhanced with Custom Instructions Recursive Development Framework
 */
export class SceneSegmenter {
  private config: AnalysisConfig;
  private iteration: number = 1;

  // 🔄 Custom Instructions Enhancement: Performance and Quality Tracking
  private segmentationMetrics = {
    accuracyHistory: [] as number[],
    processingTimeHistory: [] as number[],
    iterativeImprovements: new Map<string, number>(),
    qualityScores: new Map<number, number>() // iteration -> score
  };

  private readonly DEFAULT_MIN_SEGMENT_LENGTH_MS = 3000;
  private readonly DEFAULT_MAX_SEGMENT_LENGTH_MS = 15000;
  private readonly DEFAULT_CONFIDENCE_THRESHOLD = 0.7;
  private readonly DEFAULT_KEYWORD_DENSITY_THRESHOLD = 0.3;

  private readonly MIN_KEYWORD_LENGTH = 3;
  private readonly MIN_KEYWORD_FREQUENCY = 1;
  private readonly MAX_KEYWORDS_TO_EXTRACT = 5;
  private readonly STOP_WORDS = new Set(['this', 'that', 'with', 'have', 'will', 'from', 'they', 'been', 'were', 'said', 'each', 'which', 'their', 'time', 'about']);

  // Japanese topic-shift keywords that indicate a segment boundary
  private readonly JA_TOPIC_SHIFT_PATTERNS = ['次に', 'では', '一方', 'そして', 'また', 'さて', 'ところで', 'まとめると', '結論として', '最後に'];
  // English topic-shift keywords
  private readonly EN_TOPIC_SHIFT_PATTERNS = ['however', 'next', 'meanwhile', 'furthermore', 'moreover', 'in addition', 'on the other hand', 'in conclusion', 'finally', 'therefore'];
  // Japanese stop words for keyphrase extraction
  private readonly JA_STOP_WORDS = new Set(['について', 'では', 'です', 'ます', 'する', 'ある', 'なる', 'れる', 'られる', 'これ', 'それ', 'あれ', 'この', 'その', 'あの', 'が', 'を', 'に', 'は', 'で', 'と', 'も', 'の', 'から', 'まで', 'より', 'へ', 'や', 'など', 'いう', 'こと', 'もの', 'とき', 'さん', 'たち']);

  private readonly BASIC_CONFIDENCE_ITERATION_1 = 0.8;
  private readonly SUMMARY_TRUNCATE_LENGTH = 100;
  private readonly SUMMARY_ELLIPSIS_LENGTH = 3;

  private readonly MS_TO_SECONDS_DIVISOR = 1000;
  private readonly MIN_SEGMENTS_FOR_SUCCESS = 0;
  private readonly REASONABLE_LENGTH_MIN_MS = 3000;
  private readonly REASONABLE_LENGTH_MAX_MS = 20000;
  private readonly MIN_KEYPHRASES_FOR_SUCCESS = 1;
  private readonly GOOD_CONFIDENCE_THRESHOLD = 0.6;

  private readonly TEST_SEGMENT_LENGTH_MIN_MS = 3000;
  private readonly TEST_SEGMENT_LENGTH_MAX_MS = 15000;
  private readonly TEST_SEGMENT_LENGTH_SCORE_PASS = 1.0;
  private readonly TEST_SEGMENT_LENGTH_SCORE_FAIL = 0.5;

  private readonly TEST_KEYPHRASE_MIN_COUNT = 2;
  private readonly TEST_KEYPHRASE_DIVISOR = 3;
  private readonly TEST_KEYPHRASE_SCORE_CAP = 1.0;

  private readonly TEST_CONFIDENCE_MIN_SCORE = 0.7;

  private readonly TEST_SEMANTIC_COHERENCE_MIN_SUMMARY_LENGTH = 10;
  private readonly TEST_SEMANTIC_COHERENCE_SCORE_PASS = 0.9;
  private readonly TEST_SEMANTIC_COHERENCE_SCORE_FAIL = 0.6;

  private readonly EVAL_SEGMENT_COUNT_OPTIMAL_MIN = 3;
  private readonly EVAL_SEGMENT_COUNT_OPTIMAL_MAX = 10;
  private readonly EVAL_SEGMENT_COUNT_ACCEPTABLE_MIN = 2;
  private readonly EVAL_SEGMENT_COUNT_ACCEPTABLE_MAX = 12;
  private readonly EVAL_SEGMENT_COUNT_SCORE_HIGH = 1.0;
  private readonly EVAL_SEGMENT_COUNT_SCORE_MEDIUM = 0.8;
  private readonly EVAL_SEGMENT_COUNT_SCORE_LOW = 0.5;

  private readonly EVAL_LENGTH_DISTRIBUTION_OPTIMAL_MIN = 5000;
  private readonly EVAL_LENGTH_DISTRIBUTION_OPTIMAL_MAX = 12000;
  private readonly EVAL_LENGTH_DISTRIBUTION_ACCEPTABLE_MIN = 3000;
  private readonly EVAL_LENGTH_DISTRIBUTION_ACCEPTABLE_MAX = 15000;
  private readonly EVAL_LENGTH_DISTRIBUTION_SCORE_HIGH = 1.0;
  private readonly EVAL_LENGTH_DISTRIBUTION_SCORE_MEDIUM = 0.8;
  private readonly EVAL_LENGTH_DISTRIBUTION_SCORE_LOW = 0.5;

  private readonly EVAL_KEYPHRASE_QUALITY_DIVISOR = 3;
  private readonly EVAL_KEYPHRASE_QUALITY_SCORE_CAP = 1.0;

  private readonly EVAL_PERFORMANCE_QUALITY_FAST_THRESHOLD = 1000;
  private readonly EVAL_PERFORMANCE_QUALITY_MEDIUM_THRESHOLD = 3000;
  private readonly EVAL_PERFORMANCE_QUALITY_SCORE_HIGH = 1.0;
  private readonly EVAL_PERFORMANCE_QUALITY_SCORE_MEDIUM = 0.8;
  private readonly EVAL_PERFORMANCE_QUALITY_SCORE_LOW = 0.5;

  private readonly SUGGESTION_QUALITY_THRESHOLD = 0.8;
  private readonly SUGGESTION_SEGMENT_COUNT_LOW_THRESHOLD = 3;
  private readonly SUGGESTION_SEGMENT_COUNT_HIGH_THRESHOLD = 10;

  private readonly SEMANTIC_ANALYSIS_ENABLE_THRESHOLD = 0.8;
  private readonly TEST_SEGMENTATION_OVERALL_SCORE_THRESHOLD = 0.8;

  private readonly ITERATIVE_IMPROVEMENT_POSITIVE_THRESHOLD = 2;
  private readonly ITERATIVE_IMPROVEMENT_NEGATIVE_THRESHOLD = -2;

  constructor(config: Partial<AnalysisConfig> = {}) {
    this.config = {
      minSegmentLengthMs: this.DEFAULT_MIN_SEGMENT_LENGTH_MS, // 3 seconds minimum
      maxSegmentLengthMs: this.DEFAULT_MAX_SEGMENT_LENGTH_MS, // 15 seconds maximum
      confidenceThreshold: this.DEFAULT_CONFIDENCE_THRESHOLD,
      keywordDensityThreshold: this.DEFAULT_KEYWORD_DENSITY_THRESHOLD,
      enableSemanticAnalysis: false, // Enable in iteration 2+
      ...config
    };
  }

  /**
   * Segment transcription into content scenes
   * 🔄 Enhanced with Custom Instructions: 実装→テスト→評価→改善→コミット
   */
  async segment(transcriptionSegments: TranscriptionSegment[]): Promise<ContentSegment[]> {
    const startTime = performance.now();

    try {
      // 🔄 実装段階: Apply iterative segmentation improvements
      let segments = await this.applyIterativeSegmentation(transcriptionSegments);

      // 🔄 テスト段階: Validate segmentation quality
      const testResults = await this.testSegmentationQuality(segments);

      // 🔄 評価段階: Assess segmentation performance
      const evaluationResults = await this.evaluateSegmentationPerformance(segments, startTime);

      // 🔄 改善段階: Apply improvements if needed
      if (evaluationResults.needsImprovement) {
        segments = await this.applyIterativeImprovements(segments, evaluationResults.suggestions);
      }

      const processingTime = performance.now() - startTime;

      // Store metrics for continuous improvement
      this.updateIterativeMetrics(segments, processingTime, evaluationResults.qualityScore);

      return segments;

    } catch (error) {
      logger.error('[Scene Segmentation] Error:', error);
      return [];
    }
  }

  /**
   * Iteration 1: Basic time and keyword-based segmentation
   * Enhanced with sentence boundary detection and topic-shift keyword splitting.
   */
  private async basicSegmentation(transcriptionSegments: TranscriptionSegment[]): Promise<ContentSegment[]> {
    const segments: ContentSegment[] = [];
    let currentSegment: {
      startMs: number;
      endMs: number;
      texts: string[];
      keyphrases: Set<string>;
    } | null = null;

    for (const segment of transcriptionSegments) {
      // Check for topic-shift keywords within this segment's text
      const splitParts = this.splitAtTopicShift(segment.text, segment.start, segment.end);

      for (const part of splitParts) {
        const keywords = this.extractKeywords(part.text);
        const hasKeywordTopicShift = currentSegment
          ? this.detectTopicShift(currentSegment.keyphrases, new Set(keywords))
          : false;

        const isOverMax = currentSegment &&
          (currentSegment.endMs - currentSegment.startMs) >= this.config.maxSegmentLengthMs;

        const shouldStartNew = !currentSegment || hasKeywordTopicShift || isOverMax;

        if (shouldStartNew) {
          // Finalize previous segment regardless of minimum length
          // (mergeShortSegments will handle too-short segments later)
          if (currentSegment) {
            segments.push(this.finalizeSegment(currentSegment));
          }

          currentSegment = {
            startMs: part.startMs,
            endMs: part.endMs,
            texts: [part.text],
            keyphrases: new Set(keywords),
          };
        } else {
          // Extend current segment
          currentSegment.endMs = part.endMs;
          currentSegment.texts.push(part.text);
          keywords.forEach(kw => currentSegment!.keyphrases.add(kw));
        }
      }
    }

    // Finalize last segment
    if (currentSegment) {
      segments.push(this.finalizeSegment(currentSegment));
    }

    return segments;
  }

  /**
   * Split a single transcription segment at topic-shift keyword boundaries.
   * Proportionally distributes the time range across the sub-segments.
   */
  private splitAtTopicShift(
    text: string,
    startMs: number,
    endMs: number,
  ): Array<{ text: string; startMs: number; endMs: number }> {
    // Guard non-finite timestamps to prevent NaN propagation
    const safeStart = Number.isFinite(startMs) ? startMs : 0;
    const safeEnd = Number.isFinite(endMs) ? endMs : safeStart;
    const totalDuration = safeEnd - safeStart;
    if (text.length === 0) return [{ text, startMs: safeStart, endMs: safeEnd }];

    // Find all topic-shift keyword positions
    const boundaries: number[] = [];
    for (const keyword of [...this.JA_TOPIC_SHIFT_PATTERNS, ...this.EN_TOPIC_SHIFT_PATTERNS]) {
      let searchFrom = 0;
      while (true) {
        const idx = text.indexOf(keyword, searchFrom);
        if (idx === -1) break;
        // Only add as boundary if keyword is not at the very beginning
        if (idx > 0) {
          boundaries.push(idx);
        }
        searchFrom = idx + keyword.length;
      }
    }

    if (boundaries.length === 0) {
      return [{ text, startMs, endMs }];
    }

    // Sort boundaries and split
    boundaries.sort((a, b) => a - b);

    // Remove duplicates that are very close together
    const uniqueBoundaries: number[] = [];
    for (const b of boundaries) {
      if (uniqueBoundaries.length === 0 || b - uniqueBoundaries[uniqueBoundaries.length - 1] > 2) {
        uniqueBoundaries.push(b);
      }
    }

    const results: Array<{ text: string; startMs: number; endMs: number }> = [];
    let prevIdx = 0;

    for (const boundaryIdx of uniqueBoundaries) {
      const partText = text.slice(prevIdx, boundaryIdx);
      if (partText.length > 0) {
        const ratio = prevIdx / text.length;
        const duration = totalDuration * (partText.length / text.length);
        results.push({
          text: partText,
          startMs: safeStart + totalDuration * ratio,
          endMs: safeStart + totalDuration * ratio + duration,
        });
      }
      prevIdx = boundaryIdx;
    }

    // Last part
    const lastPart = text.slice(prevIdx);
    if (lastPart.length > 0) {
      const ratio = prevIdx / text.length;
      results.push({
        text: lastPart,
        startMs: safeStart + totalDuration * ratio,
        endMs: safeEnd,
      });
    }

    // Ensure at least one result
    if (results.length === 0) {
      return [{ text, startMs: safeStart, endMs: safeEnd }];
    }

    return results;
  }

  /**
   * Extract keywords from text using frequency analysis and Japanese noun extraction.
   */
  private extractKeywords(text: string): string[] {
    // First try Japanese keyword extraction
    const jaKeywords = this.extractJapaneseKeywords(text);
    if (jaKeywords.length > 0) {
      return jaKeywords;
    }

    // Fall back to English-style extraction
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > this.MIN_KEYWORD_LENGTH);

    const stopWords = this.STOP_WORDS;
    const filteredWords = words.filter(word => !stopWords.has(word));

    const wordCount = new Map<string, number>();
    filteredWords.forEach(word => {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    });

    return Array.from(wordCount.entries())
      .filter(([_, count]) => count >= this.MIN_KEYWORD_FREQUENCY)
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.MAX_KEYWORDS_TO_EXTRACT)
      .map(([word]) => word);
  }

  /**
   * Extract Japanese keywords (noun phrases) from text.
   * Uses character-range heuristics to identify meaningful Japanese noun compounds.
   */
  private extractJapaneseKeywords(text: string): string[] {
    // Check if text contains Japanese characters
    const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(text);
    if (!hasJapanese) return [];

    const phrases: string[] = [];

    // Pattern 1: Extract compounds of Kanji characters (2+ consecutive kanji)
    // e.g., データベース設計, 正規化, 第三正規形
    const kanjiCompoundRegex = /[\u4E00-\u9FFF\u30A0-\u30FF\d]+[\u4E00-\u9FFF\u30A0-\u30FF]+/g;
    let match: RegExpExecArray | null;
    while ((match = kanjiCompoundRegex.exec(text)) !== null) {
      const phrase = match[0];
      if (phrase.length >= 2 && !this.JA_STOP_WORDS.has(phrase)) {
        phrases.push(phrase);
      }
    }

    // Pattern 2: Katakana words (technical terms)
    const katakanaRegex = /[\u30A0-\u30FF]{2,}/g;
    while ((match = katakanaRegex.exec(text)) !== null) {
      const phrase = match[0];
      if (!this.JA_STOP_WORDS.has(phrase)) {
        phrases.push(phrase);
      }
    }

    // Pattern 3: Number + Kanji compounds like 第三正規形
    const numKanjiRegex = /第[\u4E00-\u9FFF\d]+[\u4E00-\u9FFF]+/g;
    while ((match = numKanjiRegex.exec(text)) !== null) {
      const phrase = match[0];
      if (!this.JA_STOP_WORDS.has(phrase)) {
        phrases.push(phrase);
      }
    }

    // Deduplicate and limit
    const unique = [...new Set(phrases)];
    return unique.slice(0, this.MAX_KEYWORDS_TO_EXTRACT);
  }

  /**
   * Detect topic shift between segments
   */
  private detectTopicShift(prevKeyphrases: Set<string>, currentKeyphrases: Set<string>): boolean {
    if (prevKeyphrases.size === 0) return false;

    const overlap = Array.from(prevKeyphrases).filter(kw => currentKeyphrases.has(kw)).length;
    const totalUnique = new Set([...prevKeyphrases, ...currentKeyphrases]).size;
    const similarity = overlap / totalUnique;

    return similarity < this.config.keywordDensityThreshold;
  }

  /**
   * Convert working segment to final ContentSegment
   */
  private finalizeSegment(workingSegment: {
    startMs: number;
    endMs: number;
    texts: string[];
    keyphrases: Set<string>;
  }): ContentSegment {
    const fullText = workingSegment.texts.join('');
    const summary = this.generateSummary(fullText);

    return {
      startMs: workingSegment.startMs,
      endMs: workingSegment.endMs,
      text: fullText,
      summary,
      keyphrases: Array.from(workingSegment.keyphrases),
      confidence: this.BASIC_CONFIDENCE_ITERATION_1 // Basic confidence for iteration 1
    };
  }

  /**
   * Generate simple summary (iteration 1: first sentence or truncated text)
   */
  private generateSummary(text: string): string {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

    if (sentences.length > 0) {
      const firstSentence = sentences[0].trim();
      return firstSentence.length > this.SUMMARY_TRUNCATE_LENGTH ?
        firstSentence.substring(0, this.SUMMARY_TRUNCATE_LENGTH - this.SUMMARY_ELLIPSIS_LENGTH) + '...' :
        firstSentence;
    }

    return text.length > this.SUMMARY_TRUNCATE_LENGTH ? text.substring(0, this.SUMMARY_TRUNCATE_LENGTH - this.SUMMARY_ELLIPSIS_LENGTH) + '...' : text;
  }

  /**
   * Iteration 2+: Semantic analysis for better segmentation
   */
  private async semanticSegmentation(segments: ContentSegment[]): Promise<ContentSegment[]> {
    if (segments.length <= 1) return segments;

    // Compute keyword-based similarity between adjacent segments and merge
    // those that are semantically coherent (high keyword overlap).
    const result: ContentSegment[] = [];
    let i = 0;

    while (i < segments.length) {
      let current = { ...segments[i] };

      // Try to merge with next segment if semantically similar
      while (i + 1 < segments.length) {
        const next = segments[i + 1];
        const similarity = this.computeTextSimilarity(current.text, next.text);

        const mergedDuration = next.endMs - current.startMs;
        const isSimilar = similarity > this.config.keywordDensityThreshold;
        const fitsMaxLength = mergedDuration <= this.config.maxSegmentLengthMs;

        if (isSimilar && fitsMaxLength) {
          // Merge next into current
          current = {
            startMs: current.startMs,
            endMs: next.endMs,
            text: current.text + next.text,
            summary: this.generateSummary(current.text + next.text),
            keyphrases: [...new Set([...current.keyphrases, ...next.keyphrases])],
            confidence: Math.max(Number.isFinite(current.confidence) ? current.confidence : 0, Number.isFinite(next.confidence) ? next.confidence : 0),
          };
          i++;
        } else {
          break;
        }
      }

      result.push(current);
      i++;
    }

    return result;
  }

  /**
   * Compute a simple text similarity score between two texts based on
   * shared keyword overlap (Jaccard-like coefficient).
   */
  private computeTextSimilarity(textA: string, textB: string): number {
    const keywordsA = new Set(this.extractKeywords(textA));
    const keywordsB = new Set(this.extractKeywords(textB));

    if (keywordsA.size === 0 && keywordsB.size === 0) return 0;

    const intersection = Array.from(keywordsA).filter(kw => keywordsB.has(kw)).length;
    const union = new Set([...keywordsA, ...keywordsB]).size;

    return union === 0 ? 0 : intersection / union;
  }

  /**
   * Iteration 3+: Topic modeling for advanced segmentation
   */
  private async topicBasedSegmentation(segments: ContentSegment[]): Promise<ContentSegment[]> {
    if (segments.length <= 1) return segments;

    // Build a topic vector for each segment based on keyword frequency,
    // then detect topic transitions and split at boundaries.
    const topicVectors = segments.map(seg => this.buildTopicVector(seg.text));

    const result: ContentSegment[] = [];
    let segStart = 0;

    for (let i = 1; i < segments.length; i++) {
      const similarity = this.cosineSimilarity(topicVectors[segStart], topicVectors[i]);
      const isTopicShift = similarity < this.config.keywordDensityThreshold;

      if (isTopicShift) {
        // Collect segments[segStart..i-1] into one merged segment
        const group = segments.slice(segStart, i);
        result.push(this.mergeSegmentGroup(group));
        segStart = i;
      }
    }

    // Flush remaining segments
    if (segStart < segments.length) {
      const group = segments.slice(segStart);
      result.push(this.mergeSegmentGroup(group));
    }

    return result;
  }

  /**
   * Build a simple term-frequency vector for the given text.
   */
  private buildTopicVector(text: string): Map<string, number> {
    const keywords = this.extractKeywords(text);
    const vec = new Map<string, number>();
    for (const kw of keywords) {
      vec.set(kw, (vec.get(kw) || 0) + 1);
    }
    return vec;
  }

  /**
   * Compute cosine similarity between two sparse term-frequency vectors.
   */
  private cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
    let dot = 0;
    let magA = 0;
    let magB = 0;

    for (const [key, val] of a) {
      magA += val * val;
      if (b.has(key)) {
        dot += val * b.get(key)!;
      }
    }
    for (const val of b.values()) {
      magB += val * val;
    }

    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    return denom === 0 ? 0 : dot / denom;
  }

  /**
   * Merge a contiguous group of segments into a single ContentSegment.
   */
  private mergeSegmentGroup(group: ContentSegment[]): ContentSegment {
    if (group.length === 1) return group[0];

    const text = group.map(s => s.text).join('');
    return {
      startMs: group[0].startMs,
      endMs: group[group.length - 1].endMs,
      text,
      summary: this.generateSummary(text),
      keyphrases: [...new Set(group.flatMap(s => s.keyphrases))],
      confidence: Math.max(...group.map(s => Number.isFinite(s.confidence) ? s.confidence : 0)),
    };
  }

  /**
   * Evaluate segmentation quality
   */
  private async evaluateSegmentation(segments: ContentSegment[], processingTime: number): Promise<void> {
    const metrics = {
      segmentCount: segments.length,
      avgSegmentLength: segments.length > 0 ? segments.reduce((sum, seg) => sum + (seg.endMs - seg.startMs), 0) / segments.length : 0,
      avgKeyphraseCount: segments.length > 0 ? segments.reduce((sum, seg) => sum + seg.keyphrases.length, 0) / segments.length : 0,
      avgConfidence: segments.length > 0 ? segments.reduce((sum, seg) => sum + (Number.isFinite(seg.confidence) ? seg.confidence : 0), 0) / segments.length : 0,
      processingTime
    };

    // Success criteria
    const successCriteria = {
      hasSegments: metrics.segmentCount > this.MIN_SEGMENTS_FOR_SUCCESS,
      reasonableLength: metrics.avgSegmentLength > this.REASONABLE_LENGTH_MIN_MS && metrics.avgSegmentLength < this.REASONABLE_LENGTH_MAX_MS,
      hasKeyphrases: metrics.avgKeyphraseCount > this.MIN_KEYPHRASES_FOR_SUCCESS,
      goodConfidence: metrics.avgConfidence > this.GOOD_CONFIDENCE_THRESHOLD
    };

    Object.values(successCriteria).every(v => v);
  }

  /**
   * Method to increment iteration for testing improvements
   */
  public nextIteration(enableSemantic: boolean = false): void {
    this.iteration++;
    if (enableSemantic) {
      this.config.enableSemanticAnalysis = true;
    }
  }

  /**
   * 🔄 Custom Instructions: Apply Iterative Segmentation (Implementation Phase)
   */
  private async applyIterativeSegmentation(transcriptionSegments: TranscriptionSegment[]): Promise<ContentSegment[]> {
    // Iteration 1: Basic segmentation
    let segments = await this.basicSegmentation(transcriptionSegments);

    // Iteration 2+: Add semantic analysis based on learned improvements
    if (this.iteration > 1 && this.shouldEnableSemanticAnalysis()) {
      segments = await this.enhancedSemanticSegmentation(segments);
    }

    // Iteration 3+: Add topic modeling
    if (this.iteration > 2) {
      segments = await this.topicBasedSegmentation(segments);
    }

    return segments;
  }

  /**
   * 🔄 Custom Instructions: Test Segmentation Quality (Testing Phase)
   */
  private async testSegmentationQuality(segments: ContentSegment[]): Promise<{
    passed: boolean;
    testResults: Array<{ name: string; passed: boolean; score: number }>;
    overallScore: number;
  }> {
    const tests = [
      this.testSegmentLengthDistribution(segments),
      this.testKeyphraseQuality(segments),
      this.testConfidenceScores(segments),
      this.testSemanticCoherence(segments)
    ];

    const testResults = await Promise.all(tests);
    const overallScore = testResults.length > 0
      ? testResults.reduce((sum, result) => sum + sanitizeFinite(result.score, 0), 0) / testResults.length
      : 0;
    const passed = overallScore > this.TEST_SEGMENTATION_OVERALL_SCORE_THRESHOLD; // 80% threshold

    return { passed, testResults, overallScore };
  }

  /**
   * 🔄 Custom Instructions: Evaluate Segmentation Performance (Evaluation Phase)
   */
  private async evaluateSegmentationPerformance(
    segments: ContentSegment[],
    startTime: number
  ): Promise<{
    qualityScore: number;
    needsImprovement: boolean;
    suggestions: string[];
  }> {
    const segCount = segments.length;
    const metrics = {
      segmentCount: segCount,
      avgLength: segCount > 0
        ? segments.reduce((sum, seg) => sum + (seg.endMs - seg.startMs), 0) / segCount
        : 0,
      avgKeyphrases: segCount > 0
        ? segments.reduce((sum, seg) => sum + seg.keyphrases.length, 0) / segCount
        : 0,
      avgConfidence: segCount > 0
        ? segments.reduce((sum, seg) => sum + sanitizeFinite(seg.confidence, 0), 0) / segCount
        : 0,
      processingTime: performance.now() - startTime
    };

    // Calculate quality score based on multiple factors
    const qualityFactors = {
      segmentCountQuality: this.evaluateSegmentCount(metrics.segmentCount),
      lengthQuality: this.evaluateLengthDistribution(metrics.avgLength),
      keyphraseQuality: this.evaluateKeyphraseQuality(metrics.avgKeyphrases),
      confidenceQuality: this.evaluateConfidenceQuality(metrics.avgConfidence),
      performanceQuality: this.evaluatePerformanceQuality(metrics.processingTime)
    };

    const qualityScore = Object.values(qualityFactors).reduce((a, b) => a + b, 0) / Object.keys(qualityFactors).length;

    // Generate improvement suggestions
    const suggestions = this.generateImprovementSuggestions(qualityFactors, metrics);
    const needsImprovement = qualityScore < 0.85; // 85% threshold for improvement

    return { qualityScore, needsImprovement, suggestions };
  }

  /**
   * 🔄 Custom Instructions: Apply Iterative Improvements (Improvement Phase)
   */
  private async applyIterativeImprovements(
    segments: ContentSegment[],
    suggestions: string[]
  ): Promise<ContentSegment[]> {
    let improvedSegments = [...segments];

    for (const suggestion of suggestions) {
      if (suggestion.includes('merge_short_segments')) {
        improvedSegments = await this.mergeShortSegments(improvedSegments);
      } else if (suggestion.includes('split_long_segments')) {
        improvedSegments = await this.splitLongSegments(improvedSegments);
      } else if (suggestion.includes('enhance_keyphrases')) {
        improvedSegments = await this.enhanceKeyphrases(improvedSegments);
      } else if (suggestion.includes('improve_confidence')) {
        improvedSegments = await this.improveConfidenceScores(improvedSegments);
      }
    }

    return improvedSegments;
  }

  /**
   * 🔄 Custom Instructions: Update Iterative Metrics (Continuous Learning)
   */
  private updateIterativeMetrics(segments: ContentSegment[], processingTime: number, qualityScore: number): void {
    if (segments.length === 0) return;
    // Store historical data for trend analysis
    this.segmentationMetrics.processingTimeHistory.push(processingTime);
    this.segmentationMetrics.qualityScores.set(this.iteration, qualityScore);

    // Calculate iterative improvements (guard non-finite timestamps)
    const avgLength = segments.reduce((sum, seg) => {
      const dur = seg.endMs - seg.startMs;
      return sum + (Number.isFinite(dur) ? dur : 0);
    }, 0) / segments.length;
    const avgKeyphrases = segments.reduce((sum, seg) => sum + seg.keyphrases.length, 0) / segments.length;

    this.segmentationMetrics.iterativeImprovements.set('avgLength', Number.isFinite(avgLength) ? avgLength : 0);
    this.segmentationMetrics.iterativeImprovements.set('avgKeyphrases', avgKeyphrases);
    this.segmentationMetrics.iterativeImprovements.set('qualityScore', qualityScore);

    // Log improvements
    if (this.iteration > 1) {
      const previousQuality = this.segmentationMetrics.qualityScores.get(this.iteration - 1) || 0;
      void previousQuality; // quality delta available for future logging
    }
  }

  // Helper methods for quality evaluation
  private shouldEnableSemanticAnalysis(): boolean {
    const previousScores = Array.from(this.segmentationMetrics.qualityScores.values());
    return previousScores.length === 0 || Math.max(...previousScores) < this.SEMANTIC_ANALYSIS_ENABLE_THRESHOLD;
  }

  private async enhancedSemanticSegmentation(segments: ContentSegment[]): Promise<ContentSegment[]> {
    // Implementation would go here - for now, return segments as-is
    return segments;
  }

  private async testSegmentLengthDistribution(segments: ContentSegment[]): Promise<{ passed: boolean; score: number; name: string }> {
    if (segments.length === 0) return { passed: false, score: 0, name: 'Segment Length Distribution' };
    const avgLength = segments.reduce((sum, seg) => sum + (seg.endMs - seg.startMs), 0) / segments.length;
    const passed = avgLength >= this.TEST_SEGMENT_LENGTH_MIN_MS && avgLength <= this.TEST_SEGMENT_LENGTH_MAX_MS;
    const score = passed ? this.TEST_SEGMENT_LENGTH_SCORE_PASS : this.TEST_SEGMENT_LENGTH_SCORE_FAIL;
    return { passed, score, name: 'Segment Length Distribution' };
  }

  private async testKeyphraseQuality(segments: ContentSegment[]): Promise<{ passed: boolean; score: number; name: string }> {
    if (segments.length === 0) return { passed: false, score: 0, name: 'Keyphrase Quality' };
    const avgKeyphrases = segments.reduce((sum, seg) => sum + seg.keyphrases.length, 0) / segments.length;
    const passed = avgKeyphrases >= this.TEST_KEYPHRASE_MIN_COUNT;
    const score = Math.min(avgKeyphrases / this.TEST_KEYPHRASE_DIVISOR, this.TEST_KEYPHRASE_SCORE_CAP);
    return { passed, score, name: 'Keyphrase Quality' };
  }

  private async testConfidenceScores(segments: ContentSegment[]): Promise<{ passed: boolean; score: number; name: string }> {
    if (segments.length === 0) return { passed: false, score: 0, name: 'Confidence Scores' };
    const avgConfidence = segments.reduce((sum, seg) => sum + sanitizeFinite(seg.confidence, 0), 0) / segments.length;
    const passed = avgConfidence >= this.TEST_CONFIDENCE_MIN_SCORE;
    const score = avgConfidence;
    return { passed, score, name: 'Confidence Scores' };
  }

  private async testSemanticCoherence(segments: ContentSegment[]): Promise<{ passed: boolean; score: number; name: string }> {
    // Simplified semantic coherence test
    const hasCoherentSummaries = segments.every(seg => seg.summary && seg.summary.length > this.TEST_SEMANTIC_COHERENCE_MIN_SUMMARY_LENGTH);
    const passed = hasCoherentSummaries;
    const score = passed ? this.TEST_SEMANTIC_COHERENCE_SCORE_PASS : this.TEST_SEMANTIC_COHERENCE_SCORE_FAIL;
    return { passed, score, name: 'Semantic Coherence' };
  }

  private evaluateSegmentCount(count: number): number {
    if (count >= this.EVAL_SEGMENT_COUNT_OPTIMAL_MIN && count <= this.EVAL_SEGMENT_COUNT_OPTIMAL_MAX) return this.EVAL_SEGMENT_COUNT_SCORE_HIGH;
    if (count >= this.EVAL_SEGMENT_COUNT_ACCEPTABLE_MIN && count <= this.EVAL_SEGMENT_COUNT_ACCEPTABLE_MAX) return this.EVAL_SEGMENT_COUNT_SCORE_MEDIUM;
    return this.EVAL_SEGMENT_COUNT_SCORE_LOW;
  }

  private evaluateLengthDistribution(avgLength: number): number {
    if (avgLength >= this.EVAL_LENGTH_DISTRIBUTION_OPTIMAL_MIN && avgLength <= this.EVAL_LENGTH_DISTRIBUTION_OPTIMAL_MAX) return this.EVAL_LENGTH_DISTRIBUTION_SCORE_HIGH;
    if (avgLength >= this.EVAL_LENGTH_DISTRIBUTION_ACCEPTABLE_MIN && avgLength <= this.EVAL_LENGTH_DISTRIBUTION_ACCEPTABLE_MAX) return this.EVAL_LENGTH_DISTRIBUTION_SCORE_MEDIUM;
    return this.EVAL_LENGTH_DISTRIBUTION_SCORE_LOW;
  }

  private evaluateKeyphraseQuality(avgKeyphrases: number): number {
    return Math.min(avgKeyphrases / this.EVAL_KEYPHRASE_QUALITY_DIVISOR, this.EVAL_KEYPHRASE_QUALITY_SCORE_CAP);
  }

  private evaluateConfidenceQuality(avgConfidence: number): number {
    return avgConfidence;
  }

  private evaluatePerformanceQuality(processingTime: number): number {
    if (processingTime < this.EVAL_PERFORMANCE_QUALITY_FAST_THRESHOLD) return this.EVAL_PERFORMANCE_QUALITY_SCORE_HIGH;
    if (processingTime < this.EVAL_PERFORMANCE_QUALITY_MEDIUM_THRESHOLD) return this.EVAL_PERFORMANCE_QUALITY_SCORE_MEDIUM;
    return this.EVAL_PERFORMANCE_QUALITY_SCORE_LOW;
  }

  private generateImprovementSuggestions(qualityFactors: Record<string, number>, metrics: Record<string, number>): string[] {
    const suggestions: string[] = [];

    if (qualityFactors.segmentCountQuality < this.SUGGESTION_QUALITY_THRESHOLD) {
      if (metrics.segmentCount < this.SUGGESTION_SEGMENT_COUNT_LOW_THRESHOLD) {
        suggestions.push('split_long_segments');
      } else if (metrics.segmentCount > this.SUGGESTION_SEGMENT_COUNT_HIGH_THRESHOLD) {
        suggestions.push('merge_short_segments');
      }
    }

    if (qualityFactors.keyphraseQuality < this.SUGGESTION_QUALITY_THRESHOLD) {
      suggestions.push('enhance_keyphrases');
    }

    if (qualityFactors.confidenceQuality < this.SUGGESTION_QUALITY_THRESHOLD) {
      suggestions.push('improve_confidence');
    }

    return suggestions;
  }

  // Improvement implementation methods
  private async mergeShortSegments(segments: ContentSegment[]): Promise<ContentSegment[]> {
    if (segments.length === 0) return segments;

    const result: ContentSegment[] = [];
    let i = 0;

    while (i < segments.length) {
      let current = { ...segments[i] };

      // If current segment is too short, merge with adjacent segments
      while (
        (current.endMs - current.startMs) < this.config.minSegmentLengthMs &&
        result.length > 0
      ) {
        // Merge with previous segment
        const prev = result.pop()!;
        current = {
          startMs: prev.startMs,
          endMs: current.endMs,
          text: prev.text + current.text,
          summary: prev.summary,
          keyphrases: [...new Set([...prev.keyphrases, ...current.keyphrases])],
          confidence: Math.max(prev.confidence, current.confidence),
        };
      }

      // Check if still too short and can merge with next
      while (
        (current.endMs - current.startMs) < this.config.minSegmentLengthMs &&
        i + 1 < segments.length
      ) {
        i++;
        const next = segments[i];
        current = {
          startMs: current.startMs,
          endMs: next.endMs,
          text: current.text + next.text,
          summary: current.summary,
          keyphrases: [...new Set([...current.keyphrases, ...next.keyphrases])],
          confidence: Math.max(current.confidence, next.confidence),
        };
      }

      result.push(current);
      i++;
    }

    // Final pass: merge any remaining too-short last segment with previous
    if (result.length >= 2) {
      const last = result[result.length - 1];
      if ((last.endMs - last.startMs) < this.config.minSegmentLengthMs) {
        const prev = result[result.length - 2];
        result[result.length - 2] = {
          startMs: prev.startMs,
          endMs: last.endMs,
          text: prev.text + last.text,
          summary: prev.summary,
          keyphrases: [...new Set([...prev.keyphrases, ...last.keyphrases])],
          confidence: Math.max(Number.isFinite(prev.confidence) ? prev.confidence : 0, Number.isFinite(last.confidence) ? last.confidence : 0),
        };
        result.pop();
      }
    }

    return result;
  }

  private async splitLongSegments(segments: ContentSegment[]): Promise<ContentSegment[]> {
    const result: ContentSegment[] = [];

    for (const segment of segments) {
      const duration = segment.endMs - segment.startMs;
      if (duration <= this.config.maxSegmentLengthMs) {
        result.push(segment);
        continue;
      }

      // Split at sentence boundaries (。or . followed by text)
      const splitTexts = this.splitTextAtSentenceBoundaries(segment.text);
      if (splitTexts.length <= 1) {
        // No sentence boundary found; cannot split meaningfully
        result.push(segment);
        continue;
      }

      // Distribute time proportionally across split parts
      const totalLen = segment.text.length;
      let currentStartMs = segment.startMs;

      for (let i = 0; i < splitTexts.length; i++) {
        const partLen = splitTexts[i].length;
        const partDuration = totalLen > 0 ? (partLen / totalLen) * duration : duration / splitTexts.length;
        const endMs = Math.min(currentStartMs + partDuration, segment.endMs);

        result.push({
          startMs: currentStartMs,
          endMs,
          text: splitTexts[i],
          summary: this.generateSummary(splitTexts[i]),
          keyphrases: this.extractKeywords(splitTexts[i]),
          confidence: segment.confidence,
        });

        currentStartMs = endMs;
      }

      // Ensure last segment ends at the original endMs
      if (result.length > 0) {
        result[result.length - 1] = { ...result[result.length - 1], endMs: segment.endMs };
      }
    }

    return result;
  }

  /**
   * Split text at sentence boundaries (Japanese "。" and English ".").
   */
  private splitTextAtSentenceBoundaries(text: string): string[] {
    // Split on Japanese period or English period followed by non-whitespace
    const parts: string[] = [];
    let current = '';

    for (let i = 0; i < text.length; i++) {
      current += text[i];

      const isJapanesePeriod = text[i] === '\u3002'; // "。"
      const isEnglishPeriod = text[i] === '.' && i + 1 < text.length && /\S/.test(text[i + 1]);

      if (isJapanesePeriod || isEnglishPeriod) {
        const trimmed = current.trim();
        if (trimmed.length > 0) {
          parts.push(trimmed);
        }
        current = '';
      }
    }

    // Add remaining text
    const remaining = current.trim();
    if (remaining.length > 0) {
      if (parts.length > 0) {
        // Merge last part with remaining if remaining is very short
        parts[parts.length - 1] += remaining;
      } else {
        parts.push(remaining);
      }
    }

    return parts;
  }

  private async enhanceKeyphrases(segments: ContentSegment[]): Promise<ContentSegment[]> {
    return segments.map(seg => {
      const jaKeywords = this.extractJapaneseKeywords(seg.text);
      const enKeywords = this.extractKeywords(seg.text);
      // Merge and deduplicate, preferring Japanese keywords
      const merged = [...new Set([...jaKeywords, ...seg.keyphrases, ...enKeywords])];
      return {
        ...seg,
        keyphrases: merged.slice(0, this.MAX_KEYWORDS_TO_EXTRACT),
      };
    });
  }

  private async improveConfidenceScores(segments: ContentSegment[]): Promise<ContentSegment[]> {
    return segments; // Simplified implementation
  }
}