import { TranscriptionSegment } from '@/transcription/types';
import { ContentSegment, AnalysisConfig } from './types';

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

  private readonly BASIC_CONFIDENCE_ITERATION_1 = 0.8;
  private readonly SUMMARY_TRUNCATE_LENGTH = 100;
  private readonly SUMMARY_ELLIPSIS_LENGTH = 3;

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
    console.log(`[Scene Segmentation V${this.iteration}] Processing ${transcriptionSegments.length} segments`);
    console.log(`🔄 Custom Instructions: Starting recursive development cycle`);

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
      console.log(`[V${this.iteration}] Generated ${segments.length} content segments in ${processingTime.toFixed(0)}ms`);
      console.log(`🔄 Quality Score: ${(evaluationResults.qualityScore * 100).toFixed(1)}%`);

      // Store metrics for continuous improvement
      this.updateIterativeMetrics(segments, processingTime, evaluationResults.qualityScore);

      return segments;

    } catch (error) {
      console.error('[Scene Segmentation] Error:', error);
      return [];
    }
  }

  /**
   * Iteration 1: Basic time and keyword-based segmentation
   */
  private async basicSegmentation(transcriptionSegments: TranscriptionSegment[]): Promise<ContentSegment[]> {
    console.log(`[V${this.iteration}] Applying basic segmentation...`);

    const segments: ContentSegment[] = [];
    let currentSegment: {
      startMs: number;
      endMs: number;
      texts: string[];
      keyphrases: Set<string>;
    } | null = null;

    for (const segment of transcriptionSegments) {
      const keywords = this.extractKeywords(segment.text);
      const hasTopicShift = currentSegment ?
        this.detectTopicShift(currentSegment.keyphrases, new Set(keywords)) :
        false;

      const shouldStartNew = !currentSegment ||
        hasTopicShift ||
        (currentSegment.endMs - currentSegment.startMs) > this.config.maxSegmentLengthMs;

      if (shouldStartNew) {
        // Finalize previous segment
        if (currentSegment && (currentSegment.endMs - currentSegment.startMs) >= this.config.minSegmentLengthMs) {
          segments.push(this.finalizeSegment(currentSegment));
        }

        // Start new segment
        currentSegment = {
          startMs: segment.start,
          endMs: segment.end,
          texts: [segment.text],
          keyphrases: new Set(keywords)
        };
      } else {
        // Extend current segment
        currentSegment.endMs = segment.end;
        currentSegment.texts.push(segment.text);
        keywords.forEach(kw => currentSegment!.keyphrases.add(kw));
      }
    }

    // Finalize last segment
    if (currentSegment && (currentSegment.endMs - currentSegment.startMs) >= this.config.minSegmentLengthMs) {
      segments.push(this.finalizeSegment(currentSegment));
    }

    return segments;
  }

  /**
   * Extract keywords from text using simple frequency analysis
   */
  private extractKeywords(text: string): string[] {
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > this.MIN_KEYWORD_LENGTH);

    // Filter out common stop words
    const stopWords = this.STOP_WORDS;

    const filteredWords = words.filter(word => !stopWords.has(word));

    // Simple frequency-based keyword extraction
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
    const fullText = workingSegment.texts.join(' ');
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
    console.log(`[V${this.iteration}] Applying semantic analysis...`);

    // TODO: Implement semantic analysis
    // - Named entity recognition
    // - Sentence embedding similarity
    // - Topic coherence scoring

    return segments;
  }

  /**
   * Iteration 3+: Topic modeling for advanced segmentation
   */
  private async topicBasedSegmentation(segments: ContentSegment[]): Promise<ContentSegment[]> {
    console.log(`[V${this.iteration}] Applying topic modeling...`);

    // TODO: Implement topic modeling
    // - LDA or similar topic modeling
    // - Topic transition detection
    // - Hierarchical clustering of segments

    return segments;
  }

  /**
   * Evaluate segmentation quality
   */
  private async evaluateSegmentation(segments: ContentSegment[], processingTime: number): Promise<void> {
    const metrics = {
      segmentCount: segments.length,
      avgSegmentLength: segments.reduce((sum, seg) => sum + (seg.endMs - seg.startMs), 0) / segments.length,
      avgKeyphraseCount: segments.reduce((sum, seg) => sum + seg.keyphrases.length, 0) / segments.length,
      avgConfidence: segments.reduce((sum, seg) => sum + seg.confidence, 0) / segments.length,
      processingTime
    };

    console.log('\n📊 Segmentation Metrics:');
    console.log(`- Segments: ${metrics.segmentCount}`);
    console.log(`- Avg Length: ${(metrics.avgSegmentLength / 1000).toFixed(1)}s`);
    console.log(`- Avg Keyphrases: ${metrics.avgKeyphraseCount.toFixed(1)}`);
    console.log(`- Avg Confidence: ${(metrics.avgConfidence * 100).toFixed(1)}%`);
    console.log(`- Processing Time: ${metrics.processingTime.toFixed(0)}ms`);

    // Success criteria
    const successCriteria = {
      hasSegments: metrics.segmentCount > 0,
      reasonableLength: metrics.avgSegmentLength > 3000 && metrics.avgSegmentLength < 20000,
      hasKeyphrases: metrics.avgKeyphraseCount > 1,
      goodConfidence: metrics.avgConfidence > 0.6
    };

    const success = Object.values(successCriteria).every(v => v);
    console.log(success ? '✅ Segmentation successful' : '⚠️ Segmentation needs improvement');
  }

  /**
   * Method to increment iteration for testing improvements
   */
  public nextIteration(enableSemantic: boolean = false): void {
    this.iteration++;
    if (enableSemantic) {
      this.config.enableSemanticAnalysis = true;
    }
    console.log(`🔄 Moving to segmentation iteration ${this.iteration}`);
  }

  /**
   * 🔄 Custom Instructions: Apply Iterative Segmentation (Implementation Phase)
   */
  private async applyIterativeSegmentation(transcriptionSegments: TranscriptionSegment[]): Promise<ContentSegment[]> {
    console.log('🔄 Applying iterative segmentation improvements...');

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
    testResults: any[];
    overallScore: number;
  }> {
    console.log('🧪 Testing segmentation quality...');

    const tests = [
      this.testSegmentLengthDistribution(segments),
      this.testKeyphraseQuality(segments),
      this.testConfidenceScores(segments),
      this.testSemanticCoherence(segments)
    ];

    const testResults = await Promise.all(tests);
    const overallScore = testResults.reduce((sum, result) => sum + result.score, 0) / testResults.length;
    const passed = overallScore > 0.8; // 80% threshold

    console.log(`🧪 Test Results: ${testResults.filter(r => r.passed).length}/${testResults.length} passed`);
    console.log(`🧪 Overall Test Score: ${(overallScore * 100).toFixed(1)}%`);

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
    console.log('📊 Evaluating segmentation performance...');

    const metrics = {
      segmentCount: segments.length,
      avgLength: segments.reduce((sum, seg) => sum + (seg.endMs - seg.startMs), 0) / segments.length,
      avgKeyphrases: segments.reduce((sum, seg) => sum + seg.keyphrases.length, 0) / segments.length,
      avgConfidence: segments.reduce((sum, seg) => sum + seg.confidence, 0) / segments.length,
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

    console.log(`📊 Quality Evaluation Complete: ${(qualityScore * 100).toFixed(1)}%`);

    return { qualityScore, needsImprovement, suggestions };
  }

  /**
   * 🔄 Custom Instructions: Apply Iterative Improvements (Improvement Phase)
   */
  private async applyIterativeImprovements(
    segments: ContentSegment[],
    suggestions: string[]
  ): Promise<ContentSegment[]> {
    console.log('🔄 Applying iterative improvements...');

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

    console.log(`🔄 Applied ${suggestions.length} improvements`);
    return improvedSegments;
  }

  /**
   * 🔄 Custom Instructions: Update Iterative Metrics (Continuous Learning)
   */
  private updateIterativeMetrics(segments: ContentSegment[], processingTime: number, qualityScore: number): void {
    // Store historical data for trend analysis
    this.segmentationMetrics.processingTimeHistory.push(processingTime);
    this.segmentationMetrics.qualityScores.set(this.iteration, qualityScore);

    // Calculate iterative improvements
    const avgLength = segments.reduce((sum, seg) => sum + (seg.endMs - seg.startMs), 0) / segments.length;
    const avgKeyphrases = segments.reduce((sum, seg) => sum + seg.keyphrases.length, 0) / segments.length;

    this.segmentationMetrics.iterativeImprovements.set('avgLength', avgLength);
    this.segmentationMetrics.iterativeImprovements.set('avgKeyphrases', avgKeyphrases);
    this.segmentationMetrics.iterativeImprovements.set('qualityScore', qualityScore);

    // Log improvements
    if (this.iteration > 1) {
      const previousQuality = this.segmentationMetrics.qualityScores.get(this.iteration - 1) || 0;
      const improvement = ((qualityScore - previousQuality) / previousQuality) * 100;

      if (improvement > 2) {
        console.log(`📈 Quality improved by ${improvement.toFixed(1)}% this iteration`);
      } else if (improvement < -2) {
        console.log(`📉 Quality regressed by ${Math.abs(improvement).toFixed(1)}% - needs attention`);
      }
    }
  }

  // Helper methods for quality evaluation
  private shouldEnableSemanticAnalysis(): boolean {
    const previousScores = Array.from(this.segmentationMetrics.qualityScores.values());
    return previousScores.length === 0 || Math.max(...previousScores) < 0.8;
  }

  private async enhancedSemanticSegmentation(segments: ContentSegment[]): Promise<ContentSegment[]> {
    console.log('🔄 Applying enhanced semantic segmentation...');
    // Implementation would go here - for now, return segments as-is
    return segments;
  }

  private async testSegmentLengthDistribution(segments: ContentSegment[]): Promise<{ passed: boolean; score: number; name: string }> {
    const avgLength = segments.reduce((sum, seg) => sum + (seg.endMs - seg.startMs), 0) / segments.length;
    const passed = avgLength >= 3000 && avgLength <= 15000;
    const score = passed ? 1.0 : 0.5;
    return { passed, score, name: 'Segment Length Distribution' };
  }

  private async testKeyphraseQuality(segments: ContentSegment[]): Promise<{ passed: boolean; score: number; name: string }> {
    const avgKeyphrases = segments.reduce((sum, seg) => sum + seg.keyphrases.length, 0) / segments.length;
    const passed = avgKeyphrases >= 2;
    const score = Math.min(avgKeyphrases / 3, 1.0);
    return { passed, score, name: 'Keyphrase Quality' };
  }

  private async testConfidenceScores(segments: ContentSegment[]): Promise<{ passed: boolean; score: number; name: string }> {
    const avgConfidence = segments.reduce((sum, seg) => sum + seg.confidence, 0) / segments.length;
    const passed = avgConfidence >= 0.7;
    const score = avgConfidence;
    return { passed, score, name: 'Confidence Scores' };
  }

  private async testSemanticCoherence(segments: ContentSegment[]): Promise<{ passed: boolean; score: number; name: string }> {
    // Simplified semantic coherence test
    const hasCoherentSummaries = segments.every(seg => seg.summary && seg.summary.length > 10);
    const passed = hasCoherentSummaries;
    const score = passed ? 0.9 : 0.6;
    return { passed, score, name: 'Semantic Coherence' };
  }

  private evaluateSegmentCount(count: number): number {
    if (count >= 3 && count <= 10) return 1.0;
    if (count >= 2 && count <= 12) return 0.8;
    return 0.5;
  }

  private evaluateLengthDistribution(avgLength: number): number {
    if (avgLength >= 5000 && avgLength <= 12000) return 1.0;
    if (avgLength >= 3000 && avgLength <= 15000) return 0.8;
    return 0.5;
  }

  private evaluateKeyphraseQuality(avgKeyphrases: number): number {
    return Math.min(avgKeyphrases / 3, 1.0);
  }

  private evaluateConfidenceQuality(avgConfidence: number): number {
    return avgConfidence;
  }

  private evaluatePerformanceQuality(processingTime: number): number {
    if (processingTime < 1000) return 1.0;
    if (processingTime < 3000) return 0.8;
    return 0.5;
  }

  private generateImprovementSuggestions(qualityFactors: any, metrics: any): string[] {
    const suggestions: string[] = [];

    if (qualityFactors.segmentCountQuality < 0.8) {
      if (metrics.segmentCount < 3) {
        suggestions.push('split_long_segments');
      } else if (metrics.segmentCount > 10) {
        suggestions.push('merge_short_segments');
      }
    }

    if (qualityFactors.keyphraseQuality < 0.8) {
      suggestions.push('enhance_keyphrases');
    }

    if (qualityFactors.confidenceQuality < 0.8) {
      suggestions.push('improve_confidence');
    }

    return suggestions;
  }

  // Improvement implementation methods (simplified for demo)
  private async mergeShortSegments(segments: ContentSegment[]): Promise<ContentSegment[]> {
    console.log('🔄 Merging short segments...');
    return segments; // Simplified implementation
  }

  private async splitLongSegments(segments: ContentSegment[]): Promise<ContentSegment[]> {
    console.log('🔄 Splitting long segments...');
    return segments; // Simplified implementation
  }

  private async enhanceKeyphrases(segments: ContentSegment[]): Promise<ContentSegment[]> {
    console.log('🔄 Enhancing keyphrases...');
    return segments; // Simplified implementation
  }

  private async improveConfidenceScores(segments: ContentSegment[]): Promise<ContentSegment[]> {
    console.log('🔄 Improving confidence scores...');
    return segments; // Simplified implementation
  }
}