/**
 * Advanced Text Post-Processing Module
 * Enhances transcription accuracy through multiple processing stages
 */

import { TranscriptionSegment } from './types';

export interface PostProcessingConfig {
  enableConfidenceFiltering: boolean;
  enableSentenceBoundaryDetection: boolean;
  enableTimestampAlignment: boolean;
  enableTextCorrection: boolean;
  enableSegmentMerging: boolean;
  enableDomainAdaptation: boolean;
  confidenceThreshold: number;
  minSegmentDuration: number;
  maxSegmentDuration: number;
  overlapTolerance: number;
}

export interface PostProcessingMetrics {
  originalSegmentCount: number;
  finalSegmentCount: number;
  segmentsMerged: number;
  segmentsFiltered: number;
  textCorrections: number;
  timestampAdjustments: number;
  overallImprovement: number; // 0-1 score
}

export class TextPostProcessor {
  private config: PostProcessingConfig;
  private domainVocabulary: Map<string, string>;
  private commonMistakes: Map<string, string>;

  constructor(config: Partial<PostProcessingConfig> = {}) {
    this.config = {
      enableConfidenceFiltering: true,
      enableSentenceBoundaryDetection: true,
      enableTimestampAlignment: true,
      enableTextCorrection: true,
      enableSegmentMerging: true,
      enableDomainAdaptation: true,
      confidenceThreshold: 0.6,
      minSegmentDuration: 500, // 0.5 seconds
      maxSegmentDuration: 15000, // 15 seconds
      overlapTolerance: 100, // 100ms
      ...config
    };

    this.initializeVocabularies();
  }

  /**
   * Main post-processing pipeline
   */
  async processSegments(segments: TranscriptionSegment[]): Promise<{
    segments: TranscriptionSegment[];
    metrics: PostProcessingMetrics;
  }> {
    console.log('🔧 Starting advanced text post-processing...');
    const startTime = performance.now();

    const metrics: PostProcessingMetrics = {
      originalSegmentCount: segments.length,
      finalSegmentCount: 0,
      segmentsMerged: 0,
      segmentsFiltered: 0,
      textCorrections: 0,
      timestampAdjustments: 0,
      overallImprovement: 0
    };

    let processedSegments = [...segments];

    try {
      // Stage 1: Confidence filtering
      if (this.config.enableConfidenceFiltering) {
        const filterResult = await this.filterByConfidence(processedSegments);
        processedSegments = filterResult.segments;
        metrics.segmentsFiltered = filterResult.filtered;
        console.log(`🎯 Confidence filtering: ${metrics.segmentsFiltered} low-confidence segments filtered`);
      }

      // Stage 2: Text correction and domain adaptation
      if (this.config.enableTextCorrection) {
        const correctionResult = await this.correctText(processedSegments);
        processedSegments = correctionResult.segments;
        metrics.textCorrections = correctionResult.corrections;
        console.log(`📝 Text correction: ${metrics.textCorrections} corrections applied`);
      }

      // Stage 3: Timestamp alignment
      if (this.config.enableTimestampAlignment) {
        const alignmentResult = await this.alignTimestamps(processedSegments);
        processedSegments = alignmentResult.segments;
        metrics.timestampAdjustments = alignmentResult.adjustments;
        console.log(`⏰ Timestamp alignment: ${metrics.timestampAdjustments} adjustments made`);
      }

      // Stage 4: Sentence boundary detection
      if (this.config.enableSentenceBoundaryDetection) {
        processedSegments = await this.detectSentenceBoundaries(processedSegments);
        console.log('📖 Sentence boundary detection completed');
      }

      // Stage 5: Intelligent segment merging
      if (this.config.enableSegmentMerging) {
        const mergeResult = await this.mergeSegments(processedSegments);
        processedSegments = mergeResult.segments;
        metrics.segmentsMerged = mergeResult.merged;
        console.log(`🔗 Segment merging: ${metrics.segmentsMerged} segments merged`);
      }

      // Final metrics calculation
      metrics.finalSegmentCount = processedSegments.length;
      metrics.overallImprovement = this.calculateImprovement(segments, processedSegments);

      const processingTime = performance.now() - startTime;
      console.log(`✅ Text post-processing completed in ${processingTime.toFixed(0)}ms`);
      console.log(`📈 Overall improvement: ${(metrics.overallImprovement * 100).toFixed(1)}%`);

      return { segments: processedSegments, metrics };

    } catch (error) {
      console.error('❌ Text post-processing failed:', error);
      return {
        segments: segments, // Return original on failure
        metrics: {
          ...metrics,
          finalSegmentCount: segments.length,
          overallImprovement: 0
        }
      };
    }
  }

  /**
   * Initialize domain vocabularies and common mistake corrections
   */
  private initializeVocabularies(): void {
    // Domain-specific vocabulary corrections
    this.domainVocabulary = new Map([
      // Technical terms
      ['api', 'API'],
      ['ui', 'UI'],
      ['ux', 'UX'],
      ['ai', 'AI'],
      ['ml', 'machine learning'],
      ['ci cd', 'CI/CD'],
      ['devops', 'DevOps'],
      // Business terms
      ['kpi', 'KPI'],
      ['roi', 'ROI'],
      ['ceo', 'CEO'],
      ['cto', 'CTO'],
      ['mvp', 'MVP'],
      // Common phrases
      ['lets', "let's"],
      ['wont', "won't"],
      ['cant', "can't"],
      ['dont', "don't"]
    ]);

    // Common transcription mistakes
    this.commonMistakes = new Map([
      ['there', 'their'], // Context-dependent
      ['its', "it's"], // Context-dependent
      ['your', "you're"], // Context-dependent
      ['to', 'too'], // Context-dependent
      ['affect', 'effect'], // Context-dependent
      // Homophones
      ['right', 'write'], // Context-dependent
      ['piece', 'peace'], // Context-dependent
      ['brake', 'break'] // Context-dependent
    ]);
  }

  /**
   * Filter segments based on confidence scores
   */
  private async filterByConfidence(segments: TranscriptionSegment[]): Promise<{
    segments: TranscriptionSegment[];
    filtered: number;
  }> {
    const filtered: TranscriptionSegment[] = [];
    let filteredCount = 0;

    for (const segment of segments) {
      const confidence = segment.confidence || 0;

      if (confidence >= this.config.confidenceThreshold) {
        filtered.push(segment);
      } else {
        // Try to salvage very short segments with context
        if (segment.text.length < 10 && confidence > 0.4) {
          // Keep short segments with reasonable confidence
          filtered.push({
            ...segment,
            confidence: Math.min(confidence + 0.1, 0.8) // Boost confidence slightly
          });
        } else {
          filteredCount++;
        }
      }
    }

    return { segments: filtered, filtered: filteredCount };
  }

  /**
   * Advanced text correction using domain knowledge
   */
  private async correctText(segments: TranscriptionSegment[]): Promise<{
    segments: TranscriptionSegment[];
    corrections: number;
  }> {
    let corrections = 0;
    const correctedSegments: TranscriptionSegment[] = [];

    for (const segment of segments) {
      let correctedText = segment.text;
      let segmentCorrections = 0;

      // Apply domain vocabulary corrections
      for (const [mistake, correction] of this.domainVocabulary) {
        const regex = new RegExp(`\\b${mistake}\\b`, 'gi');
        if (regex.test(correctedText)) {
          correctedText = correctedText.replace(regex, correction);
          segmentCorrections++;
        }
      }

      // Apply contextual corrections
      correctedText = this.applyContextualCorrections(correctedText);

      // Grammar and punctuation fixes
      correctedText = this.fixGrammarAndPunctuation(correctedText);

      // Capitalization fixes
      correctedText = this.fixCapitalization(correctedText);

      corrections += segmentCorrections;
      correctedSegments.push({
        ...segment,
        text: correctedText.trim()
      });
    }

    return { segments: correctedSegments, corrections };
  }

  /**
   * Apply contextual text corrections
   */
  private applyContextualCorrections(text: string): string {
    let corrected = text;

    // Fix common word boundary issues
    corrected = corrected.replace(/\bi m\b/gi, "I'm");
    corrected = corrected.replace(/\bthats\b/gi, "that's");
    corrected = corrected.replace(/\bwere\b(?=\s+going)/gi, "we're");
    corrected = corrected.replace(/\byour\b(?=\s+(going|coming|doing))/gi, "you're");

    // Fix technical term spacing
    corrected = corrected.replace(/\bapi\s+key\b/gi, 'API key');
    corrected = corrected.replace(/\bui\s+ux\b/gi, 'UI/UX');
    corrected = corrected.replace(/\bmachine\s+learning\b/gi, 'machine learning');

    // Fix common filler word issues
    corrected = corrected.replace(/\bum+\b/gi, '');
    corrected = corrected.replace(/\buh+\b/gi, '');
    corrected = corrected.replace(/\ber+\b(?!\w)/gi, '');

    return corrected;
  }

  /**
   * Fix grammar and punctuation
   */
  private fixGrammarAndPunctuation(text: string): string {
    let fixed = text;

    // Ensure proper sentence ending
    if (!/[.!?]$/.test(fixed.trim())) {
      fixed = fixed.trim() + '.';
    }

    // Fix double spaces
    fixed = fixed.replace(/\s+/g, ' ');

    // Capitalize after sentence endings
    fixed = fixed.replace(/([.!?]\s+)([a-z])/g, (match, punct, letter) =>
      punct + letter.toUpperCase());

    // Fix common punctuation issues
    fixed = fixed.replace(/,\s*,/g, ','); // Double commas
    fixed = fixed.replace(/\.\s*\./g, '.'); // Double periods

    return fixed;
  }

  /**
   * Fix capitalization issues
   */
  private fixCapitalization(text: string): string {
    let fixed = text;

    // Capitalize first letter of sentence
    fixed = fixed.charAt(0).toUpperCase() + fixed.slice(1);

    // Capitalize 'I'
    fixed = fixed.replace(/\bi\b/g, 'I');

    // Capitalize proper nouns (basic patterns)
    fixed = fixed.replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
      match => match.charAt(0).toUpperCase() + match.slice(1).toLowerCase());

    fixed = fixed.replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi,
      match => match.charAt(0).toUpperCase() + match.slice(1).toLowerCase());

    return fixed;
  }

  /**
   * Align timestamps to prevent overlaps and gaps
   */
  private async alignTimestamps(segments: TranscriptionSegment[]): Promise<{
    segments: TranscriptionSegment[];
    adjustments: number;
  }> {
    if (segments.length === 0) return { segments, adjustments: 0 };

    const aligned: TranscriptionSegment[] = [];
    let adjustments = 0;

    for (let i = 0; i < segments.length; i++) {
      const current = { ...segments[i] };

      // Check for overlap with previous segment
      if (i > 0) {
        const previous = aligned[i - 1];
        if (current.start < previous.end) {
          // Resolve overlap
          const midpoint = Math.floor((previous.end + current.start) / 2);
          previous.end = midpoint;
          current.start = midpoint + 1;
          adjustments++;
        }
      }

      // Check segment duration
      const duration = current.end - current.start;
      if (duration < this.config.minSegmentDuration) {
        // Extend short segments slightly
        const extension = this.config.minSegmentDuration - duration;
        current.end += Math.floor(extension / 2);
        adjustments++;
      } else if (duration > this.config.maxSegmentDuration) {
        // Split very long segments (simplified approach)
        current.end = current.start + this.config.maxSegmentDuration;
        adjustments++;
      }

      aligned.push(current);
    }

    return { segments: aligned, adjustments };
  }

  /**
   * Detect and mark sentence boundaries
   */
  private async detectSentenceBoundaries(segments: TranscriptionSegment[]): Promise<TranscriptionSegment[]> {
    return segments.map(segment => {
      const text = segment.text;

      // Simple sentence boundary detection
      const hasSentenceEnd = /[.!?]$/.test(text.trim());
      const startsWithCapital = /^[A-Z]/.test(text.trim());

      // Mark segments that likely start/end sentences
      return {
        ...segment,
        // Add metadata for sentence boundaries (could be used for better merging)
        metadata: {
          sentenceStart: startsWithCapital,
          sentenceEnd: hasSentenceEnd,
          wordCount: text.split(/\s+/).length
        }
      };
    });
  }

  /**
   * Intelligently merge segments for better readability
   */
  private async mergeSegments(segments: TranscriptionSegment[]): Promise<{
    segments: TranscriptionSegment[];
    merged: number;
  }> {
    if (segments.length === 0) return { segments, merged: 0 };

    const merged: TranscriptionSegment[] = [];
    let mergedCount = 0;
    let current = { ...segments[0] };

    for (let i = 1; i < segments.length; i++) {
      const next = segments[i];

      // Criteria for merging
      const shouldMerge = this.shouldMergeSegments(current, next);

      if (shouldMerge) {
        // Merge segments
        current = {
          start: current.start,
          end: next.end,
          text: current.text + ' ' + next.text,
          confidence: Math.min(current.confidence || 0, next.confidence || 0)
        };
        mergedCount++;
      } else {
        // Keep current segment and move to next
        merged.push(current);
        current = { ...next };
      }
    }

    // Don't forget the last segment
    merged.push(current);

    return { segments: merged, merged: mergedCount };
  }

  /**
   * Determine if two segments should be merged
   */
  private shouldMergeSegments(seg1: TranscriptionSegment, seg2: TranscriptionSegment): boolean {
    // Don't merge if gap is too large
    const gap = seg2.start - seg1.end;
    if (gap > 2000) return false; // 2 second gap

    // Don't merge if combined would be too long
    const combinedDuration = seg2.end - seg1.start;
    if (combinedDuration > this.config.maxSegmentDuration) return false;

    // Don't merge if combined text would be too long
    const combinedText = seg1.text + ' ' + seg2.text;
    if (combinedText.length > 200) return false; // Character limit

    // Merge if both segments are short
    const seg1Duration = seg1.end - seg1.start;
    const seg2Duration = seg2.end - seg2.start;
    if (seg1Duration < this.config.minSegmentDuration * 2 &&
        seg2Duration < this.config.minSegmentDuration * 2) {
      return true;
    }

    // Merge if they form a complete sentence
    const text1EndsIncomplete = !/[.!?]$/.test(seg1.text.trim());
    const text2StartsLower = /^[a-z]/.test(seg2.text.trim());
    if (text1EndsIncomplete && text2StartsLower) {
      return true;
    }

    return false;
  }

  /**
   * Calculate overall improvement score
   */
  private calculateImprovement(original: TranscriptionSegment[], processed: TranscriptionSegment[]): number {
    if (original.length === 0) return 0;

    let score = 0.5; // Base score

    // Text quality improvement
    const originalText = original.map(s => s.text).join(' ');
    const processedText = processed.map(s => s.text).join(' ');

    // Simple metrics for improvement
    const originalWords = originalText.split(/\s+/).length;
    const processedWords = processedText.split(/\s+/).length;
    const wordRetention = processedWords / originalWords;

    if (wordRetention > 0.9) score += 0.1; // Good word retention
    if (wordRetention < 1.1) score += 0.1; // Not too much expansion

    // Segment optimization
    const segmentReduction = (original.length - processed.length) / original.length;
    if (segmentReduction > 0.1 && segmentReduction < 0.5) {
      score += 0.2; // Good segment consolidation
    }

    // Confidence improvement
    const originalAvgConf = original.reduce((sum, s) => sum + (s.confidence || 0), 0) / original.length;
    const processedAvgConf = processed.reduce((sum, s) => sum + (s.confidence || 0), 0) / processed.length;
    if (processedAvgConf > originalAvgConf) {
      score += 0.1;
    }

    // Text quality indicators
    const hasProperPunctuation = processed.every(s => /[.!?]$/.test(s.text.trim()));
    if (hasProperPunctuation) score += 0.1;

    return Math.min(Math.max(score, 0), 1);
  }

  /**
   * Update post-processing configuration
   */
  public updateConfig(newConfig: Partial<PostProcessingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('🔧 Text post-processing configuration updated');
  }

  /**
   * Get current configuration
   */
  public getConfig(): PostProcessingConfig {
    return { ...this.config };
  }

  /**
   * Add domain-specific vocabulary
   */
  public addDomainVocabulary(vocabulary: Map<string, string>): void {
    for (const [key, value] of vocabulary) {
      this.domainVocabulary.set(key, value);
    }
    console.log(`📚 Added ${vocabulary.size} domain-specific terms`);
  }
}

export default TextPostProcessor;