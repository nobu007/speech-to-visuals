import { TranscriptionSegment } from '@/transcription/types';
import { ContentSegment, AnalysisConfig } from './types';

/**
 * Scene Segmentation Engine - Iterative Implementation
 * Converts transcription segments into meaningful content scenes
 */
export class SceneSegmenter {
  private config: AnalysisConfig;
  private iteration: number = 1;

  constructor(config: Partial<AnalysisConfig> = {}) {
    this.config = {
      minSegmentLengthMs: 3000, // 3 seconds minimum
      maxSegmentLengthMs: 15000, // 15 seconds maximum
      confidenceThreshold: 0.7,
      keywordDensityThreshold: 0.3,
      enableSemanticAnalysis: false, // Enable in iteration 2+
      ...config
    };
  }

  /**
   * Segment transcription into content scenes
   */
  async segment(transcriptionSegments: TranscriptionSegment[]): Promise<ContentSegment[]> {
    const startTime = performance.now();
    console.log(`[Scene Segmentation V${this.iteration}] Processing ${transcriptionSegments.length} segments`);

    try {
      // Iteration 1: Simple time-based and keyword-based segmentation
      let segments = await this.basicSegmentation(transcriptionSegments);

      // Iteration 2+: Add semantic analysis
      if (this.iteration > 1 && this.config.enableSemanticAnalysis) {
        segments = await this.semanticSegmentation(segments);
      }

      // Iteration 3+: Add topic modeling
      if (this.iteration > 2) {
        segments = await this.topicBasedSegmentation(segments);
      }

      const processingTime = performance.now() - startTime;
      console.log(`[V${this.iteration}] Generated ${segments.length} content segments in ${processingTime.toFixed(0)}ms`);

      await this.evaluateSegmentation(segments, processingTime);
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
      .filter(word => word.length > 3);

    // Filter out common stop words
    const stopWords = new Set(['this', 'that', 'with', 'have', 'will', 'from', 'they', 'been', 'were', 'said', 'each', 'which', 'their', 'time', 'about']);

    const filteredWords = words.filter(word => !stopWords.has(word));

    // Simple frequency-based keyword extraction
    const wordCount = new Map<string, number>();
    filteredWords.forEach(word => {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    });

    return Array.from(wordCount.entries())
      .filter(([_, count]) => count >= 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
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
      confidence: 0.8 // Basic confidence for iteration 1
    };
  }

  /**
   * Generate simple summary (iteration 1: first sentence or truncated text)
   */
  private generateSummary(text: string): string {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

    if (sentences.length > 0) {
      const firstSentence = sentences[0].trim();
      return firstSentence.length > 100 ?
        firstSentence.substring(0, 97) + '...' :
        firstSentence;
    }

    return text.length > 100 ? text.substring(0, 97) + '...' : text;
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
}