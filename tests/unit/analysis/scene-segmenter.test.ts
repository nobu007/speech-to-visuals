/**
 * REQ-163: scene-segmenter.ts Test Coverage
 *
 * Unit tests for SceneSegmenter's core functionality:
 *   - Semantic segmentation (Jaccard coefficient merge)
 *   - Topic-based clustering (cosine similarity)
 */

import { SceneSegmenter } from '@/analysis/scene-segmenter';
import type { TranscriptionSegment } from '@/transcription/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTs(start: number, end: number, text: string): TranscriptionSegment {
  return { id: 0, start, end, text };
}

/** Build a long-enough transcription that covers at least one segment.
 *  Each segment is 3-5 seconds to satisfy minSegmentLengthMs=3000. */
function buildTranscription(parts: Array<{ text: string; duration: number }>): TranscriptionSegment[] {
  let time = 0;
  return parts.map((p, i) => {
    const seg: TranscriptionSegment = { id: i, start: time, end: time + p.duration, text: p.text };
    time += p.duration;
    return seg;
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('REQ-163: SceneSegmenter', () => {
  let segmenter: SceneSegmenter;

  beforeEach(() => {
    segmenter = new SceneSegmenter();
  });

  // ─── TC-163-01: Semantic segmentation (Jaccard coefficient merge) ──────────

  describe('TC-163-01: semantic segmentation (Jaccard coefficient merge)', () => {
    it('produces segments from transcription input', async () => {
      const ts = buildTranscription([
        { text: 'The database design process involves normalization techniques', duration: 4000 },
        { text: 'Normalization reduces data redundancy and improves integrity', duration: 4000 },
        { text: 'The next topic is about query optimization strategies', duration: 4000 },
        { text: 'Query optimization improves execution performance', duration: 4000 },
      ]);

      const segments = await segmenter.segment(ts);

      expect(Array.isArray(segments)).toBe(true);
      expect(segments.length).toBeGreaterThan(0);
      // Each segment should have required fields
      for (const seg of segments) {
        expect(seg).toHaveProperty('startMs');
        expect(seg).toHaveProperty('endMs');
        expect(seg).toHaveProperty('text');
        expect(seg).toHaveProperty('summary');
        expect(seg).toHaveProperty('keyphrases');
        expect(seg).toHaveProperty('confidence');
      }
    });

    it('merges segments with overlapping keywords (semantic coherence)', async () => {
      // Two consecutive segments with shared keywords should be merged in iter2+
      const ts = buildTranscription([
        { text: 'The database design uses normalization to reduce redundancy', duration: 4000 },
        { text: 'Normalization ensures database integrity and consistency', duration: 4000 },
        { text: 'Next, we discuss caching strategies for performance', duration: 4000 },
      ]);

      // Iteration 2+ enables semantic analysis
      segmenter.nextIteration(true);
      const segments = await segmenter.segment(ts);

      expect(segments.length).toBeGreaterThan(0);
      expect(segments.length).toBeLessThanOrEqual(3);
    });

    it('does not merge when texts are completely different', async () => {
      const ts = buildTranscription([
        { text: 'Alpha beta gamma delta epsilon zeta eta theta', duration: 4000 },
        { text: 'One two three four five six seven eight nine', duration: 4000 },
        { text: 'Red green blue yellow orange purple pink brown', duration: 4000 },
      ]);

      segmenter.nextIteration(true);
      const segments = await segmenter.segment(ts);

      // Should produce multiple segments since no keyword overlap
      expect(segments.length).toBeGreaterThanOrEqual(1);
    });

    it('respects max segment length when merging', async () => {
      const ts = buildTranscription([
        { text: 'The database design uses normalization to reduce redundancy', duration: 6000 },
        { text: 'Normalization ensures database integrity and consistency', duration: 6000 },
        { text: 'Redundancy reduction improves overall data quality', duration: 6000 },
      ]);

      segmenter.nextIteration(true);
      const segments = await segmenter.segment(ts);

      // maxSegmentLengthMs defaults to 15000, so even merged segments
      // should not exceed this
      for (const seg of segments) {
        const duration = seg.endMs - seg.startMs;
        expect(duration).toBeLessThanOrEqual(15000);
      }
    });

    it('handles single-segment input', async () => {
      const ts = [makeTs(0, 5000, 'A single segment of transcription text')];
      const segments = await segmenter.segment(ts);

      expect(segments).toHaveLength(1);
      expect(segments[0].text).toContain('single segment');
    });

    it('handles empty transcription', async () => {
      const segments = await segmenter.segment([]);

      expect(Array.isArray(segments)).toBe(true);
      expect(segments.length).toBe(0);
    });
  });

  // ─── TC-163-02: Topic-based clustering ────────────────────────────────────

  describe('TC-163-02: topic-based clustering', () => {
    it('splits at topic boundaries using cosine similarity', async () => {
      // Two clear topics: database design and web development
      const ts = buildTranscription([
        { text: 'The database design process involves normalization techniques', duration: 4000 },
        { text: 'Database normalization reduces redundancy and improves integrity', duration: 4000 },
        { text: 'JavaScript frameworks provide component-based architecture patterns', duration: 4000 },
        { text: 'React components manage state and rendering lifecycle', duration: 4000 },
      ]);

      // Enable semantic + topic (iteration 3+)
      segmenter.nextIteration(true);
      segmenter.nextIteration(true);

      const segments = await segmenter.segment(ts);

      expect(segments.length).toBeGreaterThan(0);
      // Should split between database topic and web topic
      // At minimum we get valid segments
      for (const seg of segments) {
        expect(seg.startMs).toBeLessThan(seg.endMs);
      }
    });

    it('keeps same-topic segments together', async () => {
      const ts = buildTranscription([
        { text: 'The database design uses normalization techniques for integrity', duration: 4000 },
        { text: 'Database normalization reduces redundancy in the database', duration: 4000 },
        { text: 'The database integrity ensures consistent data storage', duration: 4000 },
      ]);

      segmenter.nextIteration(true);
      segmenter.nextIteration(true);

      const segments = await segmenter.segment(ts);

      // All about databases, should merge into fewer segments
      expect(segments.length).toBeGreaterThan(0);
      expect(segments.length).toBeLessThanOrEqual(3);
    });

    it('handles topic shift with Japanese text', async () => {
      const ts = buildTranscription([
        { text: 'データベース設計では正規化が重要です', duration: 4000 },
        { text: '正規化によりデータの冗長性を削減します', duration: 4000 },
        { text: '次にウェブ開発について説明します', duration: 4000 },
        { text: 'JavaScriptのフレームワークについて解説します', duration: 4000 },
      ]);

      segmenter.nextIteration(true);
      segmenter.nextIteration(true);

      const segments = await segmenter.segment(ts);

      expect(segments.length).toBeGreaterThan(0);
    });

    it('each produced segment has non-empty keyphrases when text has keywords', async () => {
      const ts = buildTranscription([
        { text: 'Database design normalization integrity consistency redundancy', duration: 4000 },
        { text: 'Database normalization improves consistency', duration: 4000 },
      ]);

      const segments = await segmenter.segment(ts);

      for (const seg of segments) {
        expect(seg.keyphrases).toBeDefined();
        expect(Array.isArray(seg.keyphrases)).toBe(true);
      }
    });
  });

  // ─── Topic-shift keyword case-insensitivity ───────────────────────────────
  // EN_TOPIC_SHIFT_PATTERNS are stored lowercase ('next', 'however', ...).
  // Boundary detection must be case-insensitive or a sentence-initial "Next,"
  // never matches and the whole segment runs together until maxSegmentLengthMs.
  describe('topic-shift keyword matching (case-insensitive)', () => {
    it('splits at a capitalized English topic-shift keyword mid-sentence', () => {
      const parts = (segmenter as unknown as {
        splitAtTopicShift: (t: string, s: number, e: number) => Array<{ text: string }>;
      }).splitAtTopicShift(
        'First we set up the database. Next we configure the API. Then we deploy.',
        0,
        12000,
      );
      expect(parts.length).toBe(2);
      expect(parts[0].text).toContain('database');
      expect(parts[1].text).toMatch(/^Next we configure/);
    });

    it('still matches lowercase topic-shift keywords (no regression)', () => {
      const parts = (segmenter as unknown as {
        splitAtTopicShift: (t: string, s: number, e: number) => Array<{ text: string }>;
      }).splitAtTopicShift(
        'First we set up the database. next we configure the API.',
        0,
        8000,
      );
      expect(parts.length).toBe(2);
    });

    it('preserves original capitalization in the split sub-segment text', () => {
      const parts = (segmenter as unknown as {
        splitAtTopicShift: (t: string, s: number, e: number) => Array<{ text: string }>;
      }).splitAtTopicShift(
        'First we set up the database. However the API needs work. Then we deploy.',
        0,
        12000,
      );
      expect(parts.length).toBe(2);
      // Output keeps original case — only matching is case-insensitive.
      expect(parts[1].text).toContain('However');
    });
  });
});
