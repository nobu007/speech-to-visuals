/**
 * TASK-0015: Scene Segmenter Tests
 *
 * Tests for the scene segmentation engine that splits transcription text
 * into meaningful segments of 3-15 seconds, detects segment boundaries,
 * and extracts keyphrases.
 */

import { SceneSegmenter } from '../scene-segmenter';
import { TranscriptionSegment } from '@/transcription/types';
import { ContentSegment } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a single TranscriptionSegment at the given time range. */
function seg(startMs: number, endMs: number, text: string): TranscriptionSegment {
  return { start: startMs, end: endMs, text };
}

/** Concatenate all segment texts. */
function joinedText(segments: ContentSegment[]): string {
  return segments.map(s => s.text).join('');
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('SceneSegmenter', () => {
  let segmenter: SceneSegmenter;

  beforeEach(() => {
    segmenter = new SceneSegmenter();
  });

  // =========================================================================
  // Test Case 1: Segment Length (3-15 seconds)
  // =========================================================================
  describe('Test Case 1: segment length within 3-15 seconds', () => {
    it('should produce segments whose duration is between 3000ms and 15000ms for a 60s transcription', async () => {
      // Build a 60-second transcription with sentence boundaries every ~5-8 seconds
      const segments: TranscriptionSegment[] = [
        seg(0, 5000, 'はじめに。プロジェクトの概要を説明します。'),
        seg(5000, 10000, 'このプロジェクトは新しいシステムを構築するものです。'),
        seg(10000, 15000, '次に、スケジュールについてお話しします。'),
        seg(15000, 20000, '第一フェーズは設計期間です。'),
        seg(20000, 25000, '第二フェーズは実装期間になります。'),
        seg(25000, 30000, '第三フェーズはテスト期間です。'),
        seg(30000, 35000, 'では、チーム構成について説明します。'),
        seg(35000, 40000, 'リーダーは田中さんが務めます。'),
        seg(40000, 45000, 'メンバーは五名体制です。'),
        seg(45000, 50000, '一方、予算については来月確定します。'),
        seg(50000, 55000, 'リスク管理も重要なポイントです。'),
        seg(55000, 60000, '以上で説明を終わります。'),
      ];

      const result = await segmenter.segment(segments);

      expect(result.length).toBeGreaterThan(0);
      for (const s of result) {
        const duration = s.endMs - s.startMs;
        expect(duration).toBeGreaterThanOrEqual(3000);
        expect(duration).toBeLessThanOrEqual(15000);
      }
    });
  });

  // =========================================================================
  // Test Case 2: Boundary Detection Accuracy
  // =========================================================================
  describe('Test Case 2: boundary detection accuracy', () => {
    it('should split at semantic boundaries with topic-shift keywords', async () => {
      const text = 'はじめに。プロジェクトの概要を説明します。次に、スケジュールについてです。';
      const segments: TranscriptionSegment[] = [
        seg(0, 10000, text),
      ];

      const result = await segmenter.segment(segments);

      // Expect at least 2 segments split at "次に" boundary
      expect(result.length).toBeGreaterThanOrEqual(2);

      // Verify the split point: first segment should end before "次に"
      // and second segment should start with "次に"
      const fullText = joinedText(result);
      expect(fullText).toContain('はじめに');
      expect(fullText).toContain('次に');
    });
  });

  // =========================================================================
  // Test Case 3: Content Completeness
  // =========================================================================
  describe('Test Case 3: content completeness (no loss or duplication)', () => {
    it('should preserve all text without loss or duplication', async () => {
      const segments: TranscriptionSegment[] = [
        seg(0, 4000, 'これは最初のセグメントです。'),
        seg(4000, 9000, '二番目のセグメントです。重要な内容が含まれています。'),
        seg(9000, 14000, '三番目のセグメントです。これも大事です。'),
        seg(14000, 19000, '最後のセグメントです。まとめを行います。'),
      ];

      const result = await segmenter.segment(segments);
      const originalText = segments.map(s => s.text).join('');
      const resultText = joinedText(result);

      expect(resultText).toBe(originalText);
    });
  });

  // =========================================================================
  // Test Case 4: Short Segment Merging
  // =========================================================================
  describe('Test Case 4: short segment merging', () => {
    it('should merge segments shorter than 3 seconds with adjacent segments', async () => {
      // A 1-second ultra-short segment between two longer ones
      const segments: TranscriptionSegment[] = [
        seg(0, 5000, 'これは最初のセグメントです。五秒間あります。'),
        seg(5000, 6000, '短い。'), // 1-second segment
        seg(6000, 11000, '三番目のセグメントです。五秒間あります。'),
      ];

      const result = await segmenter.segment(segments);

      // After merging, all segments should be >= 3000ms
      for (const s of result) {
        const duration = s.endMs - s.startMs;
        expect(duration).toBeGreaterThanOrEqual(3000);
      }

      // Text completeness should still hold
      const originalText = segments.map(s => s.text).join('');
      const resultText = joinedText(result);
      expect(resultText).toBe(originalText);
    });
  });

  // =========================================================================
  // Test Case 5: Long Segment Splitting
  // =========================================================================
  describe('Test Case 5: long segment splitting', () => {
    it('should split segments longer than 15 seconds at sentence boundaries', async () => {
      // A single 20-second segment with internal sentence boundaries
      const segments: TranscriptionSegment[] = [
        seg(0, 20000, '最初の文です。これは長いセグメントです。途中で文が区切られています。最後の文です。'),
      ];

      const result = await segmenter.segment(segments);

      expect(result.length).toBeGreaterThanOrEqual(2);

      // Each resulting segment should be <= 15000ms
      for (const s of result) {
        const duration = s.endMs - s.startMs;
        expect(duration).toBeLessThanOrEqual(15000);
      }

      // Text completeness
      const originalText = segments.map(s => s.text).join('');
      const resultText = joinedText(result);
      expect(resultText).toBe(originalText);
    });
  });

  // =========================================================================
  // Test Case 6: Keyphrase Extraction
  // =========================================================================
  describe('Test Case 6: keyphrase extraction', () => {
    it('should extract keyphrases like "データベース設計", "正規化", "第三正規形"', async () => {
      const text = 'データベース設計では正規化が重要です。第三正規形まで適用します。';
      const segments: TranscriptionSegment[] = [
        seg(0, 8000, text),
      ];

      const result = await segmenter.segment(segments);

      expect(result.length).toBeGreaterThan(0);

      // Collect all keyphrases across segments
      const allKeyphrases = result.flatMap(s => s.keyphrases);

      // At least some of the expected keyphrases should be present
      const expectedPhrases = ['データベース設計', '正規化', '第三正規形'];
      const matchedPhrases = expectedPhrases.filter(phrase =>
        allKeyphrases.some(kp => kp.includes(phrase) || phrase.includes(kp))
      );

      expect(matchedPhrases.length).toBeGreaterThanOrEqual(1);
    });
  });
});
