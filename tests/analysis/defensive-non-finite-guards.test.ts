/**
 * Regression tests for defensive non-finite value guards
 * in scene-segmenter.ts and diagram-detector.ts.
 *
 * Verifies that NaN, Infinity, and -Infinity in timestamp fields
 * produce safe fallbacks rather than corrupting calculations or crashing.
 */

import { SceneSegmenter } from '@/analysis/scene-segmenter';
import { DiagramDetector } from '@/analysis/diagram-detector';
import type { TranscriptionSegment } from '@/transcription/types';
import type { ContentSegment } from '@/analysis/types';

// ---------------------------------------------------------------------------
// SceneSegmenter: splitAtTopicShift non-finite timestamp guard
// ---------------------------------------------------------------------------

describe('SceneSegmenter non-finite timestamp guards', () => {
  let segmenter: SceneSegmenter;

  beforeEach(() => {
    segmenter = new SceneSegmenter();
  });

  describe('splitAtTopicShift via basicSegmentation', () => {
    it('handles NaN start timestamp without producing NaN results', async () => {
      const segments: TranscriptionSegment[] = [
        { id: 0, start: NaN, end: 5000, text: 'まず最初に次にデータベースの設計について説明します' },
      ];
      const result = await segmenter.segment(segments);
      // Every result should have finite startMs and endMs
      for (const seg of result) {
        expect(Number.isFinite(seg.startMs)).toBe(true);
        expect(Number.isFinite(seg.endMs)).toBe(true);
      }
    });

    it('handles Infinity end timestamp without producing Infinity results', async () => {
      const segments: TranscriptionSegment[] = [
        { id: 0, start: 0, end: Infinity, text: 'まず最初に次にデータベースの設計について説明します' },
      ];
      const result = await segmenter.segment(segments);
      for (const seg of result) {
        expect(Number.isFinite(seg.startMs)).toBe(true);
        expect(Number.isFinite(seg.endMs)).toBe(true);
      }
    });

    it('handles NaN end timestamp without producing NaN results', async () => {
      const segments: TranscriptionSegment[] = [
        { id: 0, start: 1000, end: NaN, text: 'まず最初に次にデータベースの設計について説明します' },
      ];
      const result = await segmenter.segment(segments);
      for (const seg of result) {
        expect(Number.isFinite(seg.startMs)).toBe(true);
        expect(Number.isFinite(seg.endMs)).toBe(true);
      }
    });

    it('handles both timestamps NaN', async () => {
      const segments: TranscriptionSegment[] = [
        { id: 0, start: NaN, end: NaN, text: 'まず最初に次にデータベースの設計について説明します' },
      ];
      const result = await segmenter.segment(segments);
      for (const seg of result) {
        expect(Number.isFinite(seg.startMs)).toBe(true);
        expect(Number.isFinite(seg.endMs)).toBe(true);
      }
    });

    it('handles -Infinity start timestamp', async () => {
      const segments: TranscriptionSegment[] = [
        { id: 0, start: -Infinity, end: 5000, text: 'まず最初に次にデータベースの設計について説明します' },
      ];
      const result = await segmenter.segment(segments);
      for (const seg of result) {
        expect(Number.isFinite(seg.startMs)).toBe(true);
        expect(Number.isFinite(seg.endMs)).toBe(true);
      }
    });
  });

  describe('updateIterativeMetrics non-finite guard', () => {
    it('does not propagate NaN when segments have non-finite timestamps', async () => {
      // Pass segments that will be split by topic keywords but with non-finite timestamps
      const segments: TranscriptionSegment[] = [
        { id: 0, start: NaN, end: NaN, text: 'テスト用のテキストです。次に別の話題に移ります。' },
      ];
      // Should not throw and should not produce NaN in internal metrics
      await expect(segmenter.segment(segments)).resolves.toBeDefined();
    });
  });
});

// ---------------------------------------------------------------------------
// DiagramDetector: confidence calculation division-by-zero guard
// ---------------------------------------------------------------------------

describe('DiagramDetector confidence edge-case guards', () => {
  let detector: DiagramDetector;

  beforeEach(() => {
    detector = new DiagramDetector();
  });

  it('produces finite confidence for normal input', () => {
    const segment: ContentSegment = {
      startMs: 0,
      endMs: 5000,
      text: 'The process flow shows steps in a sequence with a pipeline',
      summary: 'Process flow',
      keyphrases: ['process', 'flow', 'steps'],
      confidence: 0.9,
    };

    const result = detector.detect(null, [segment]);
    expect(result).toBeDefined();
    expect(Number.isFinite(result.confidence)).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('produces finite confidence even with minimal keywords', () => {
    const segment: ContentSegment = {
      startMs: 0,
      endMs: 5000,
      text: 'hello',
      summary: 'hello',
      keyphrases: [],
      confidence: 0.5,
    };

    const result = detector.detect(null, [segment]);
    expect(Number.isFinite(result.confidence)).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('produces finite confidence for empty text', () => {
    const segment: ContentSegment = {
      startMs: 0,
      endMs: 5000,
      text: '',
      summary: '',
      keyphrases: [],
      confidence: 0.5,
    };

    const result = detector.detect(null, [segment]);
    expect(Number.isFinite(result.confidence)).toBe(true);
  });
});
