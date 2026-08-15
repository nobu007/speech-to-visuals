/**
 * sentence-boundary-consistency.test.ts — round 21 (single-source campaign)
 *
 * THE DRIFT. Seven sentence splitters across src/analysis each hand-rolled
 * their own terminator class. TC-309 (sentence-split-dot-sweep) pinned the
 * decimal-safe '.' shape — `\.(?:\s+|$)` — but was structurally blind to
 * TERMINATOR MEMBERSHIP, which drifted four independent ways:
 *
 *   content-analyzer.ts:54        [。!?\n]            — no full-width ！？
 *   complexity-detector.ts:144    [。!?]              — no \n (same file as :448!)
 *   complexity-detector.ts:448    [。!?\n]            — no full-width ！？
 *   rule-based-analyzer.ts:44     [!！?？\n] + 。      — full set
 *   scene-segmenter.ts:437        [!?。！？]          — no \n
 *   diagram-detector.ts:578       [。！？\n!?;]       — full set (+ ; for phrases)
 *   diagram-detector.ts:847       [!?]                — no 。, no full-width, no \n
 *
 * Consequences this file pins (all RED against the drifted code):
 *  1. complexity-detector computed its legacy `structuralComplexity` factor
 *     (:144) and its score-driving `sentence_complexity` factor (:448) with
 *     DIFFERENT sentence definitions — multi-line text without terminal
 *     punctuation (typical raw transcription) was 1 sentence to one factor
 *     and N sentences to the other.
 *  2. content-analyzer.analyzeV1 — the rule-based fallback that decides NODE
 *     LABELS — never split Japanese exclamatory text ("良い！安い？買う。"
 *     → ONE truncated node label instead of three).
 *  3. scene-segmenter summaries did not honor newlines.
 *
 * The canonical membership lives in ../sentence-boundaries.ts:
 *   [。！？!?\n] + decimal-safe dot. Phrase extraction may additionally
 * break on ';' (PHRASE_BOUNDARY_REGEX).
 */
import { describe, it, expect } from '@jest/globals';
import { ContentAnalyzer } from '../content-analyzer';
import { ComplexityDetector } from '../complexity-detector';
import { splitSentences } from '../rule-based-analyzer';
import { SceneSegmenter } from '../scene-segmenter';
import type { TranscriptionSegment } from '@/transcription/types';

describe('sentence-boundary consistency across src/analysis splitters', () => {
  // -------------------------------------------------------------------------
  // content-analyzer.analyzeV1 — full-width terminators must split node labels
  // -------------------------------------------------------------------------
  describe('content-analyzer.analyzeV1 (node labels)', () => {
    it('splits Japanese exclamatory text into one node per sentence', () => {
      const analyzer = new ContentAnalyzer('test-key');
      const result = analyzer.analyzeV1('良い！安い？買う。');

      expect(result.nodes.map((n) => n.label)).toEqual(['良い', '安い', '買う']);
    });

    it('keeps ASCII and full-width terminators equivalent for labels', () => {
      const analyzer = new ContentAnalyzer('test-key');
      const ascii = analyzer.analyzeV1('Good! Cheap? Buy.');
      const full = analyzer.analyzeV1('良い！安い？買う。');

      expect(ascii.nodes).toHaveLength(full.nodes.length);
    });
  });

  // -------------------------------------------------------------------------
  // complexity-detector — the two sentence factors must share ONE definition
  // -------------------------------------------------------------------------
  describe('complexity-detector sentence factors', () => {
    it('structural factor counts each unpunctuated line as a sentence', () => {
      const detector = new ComplexityDetector();
      // 10 lines, no terminal punctuation. Canonical: 10 sentences →
      //   avg = 19/10 = 1.9 → lengthScore 0.0095; countScore 1.0
      //   0.0095*0.3 + 1.0*0.2 = 0.20285
      // Drifted (:144, no \n): 1 sentence → 0.095*0.3 + 0.1*0.2 = 0.0485.
      const result = detector.analyze('a\nb\nc\nd\ne\nf\ng\nh\ni\nj');

      expect(result.factors.structuralComplexity).toBeCloseTo(0.20285, 5);
    });

    it('structural factor splits on full-width ！ like the score-driving factor does', () => {
      const detector = new ComplexityDetector();
      // 'すごい！すごい！すごい！' (12 chars). Canonical: 3 sentences →
      //   avg 4 → 0.02*0.3 + 0.3*0.2 = 0.066
      // Drifted (:144, no ！): 1 sentence → 0.06*0.3 + 0.1*0.2 = 0.038.
      const result = detector.analyze('すごい！すごい！すごい！');

      expect(result.factors.structuralComplexity).toBeCloseTo(0.066, 5);
    });

    it('full-width ！ carries the same boundary weight as 。 (delta evidence)', () => {
      const detector = new ComplexityDetector();
      const exclam = detector.analyze('すごい！すごい！すごい！');
      const period = detector.analyze('すごい。すごい。すごい。');

      // 。 was already a member of every shape; ！ was not. After the fix the
      // two texts produce the SAME structural factor (identical sentence
      // counts). Before: 0.038 (1 sentence) vs 0.066 (3 sentences).
      expect(exclam.factors.structuralComplexity).toBeCloseTo(
        period.factors.structuralComplexity,
        10
      );
    });
  });

  // -------------------------------------------------------------------------
  // rule-based-analyzer.splitSentences — already full-set; pin equivalence
  // -------------------------------------------------------------------------
  describe('rule-based-analyzer.splitSentences (full-set regression)', () => {
    it('splits full-width terminators and newlines', () => {
      expect(splitSentences('すごいですね！安いですね？買います。')).toEqual([
        'すごいですね',
        '安いですね',
        '買います',
      ]);
      expect(splitSentences('一行目です\n二行目です')).toEqual(['一行目です', '二行目です']);
    });
  });

  // -------------------------------------------------------------------------
  // scene-segmenter — summaries honor newlines
  // -------------------------------------------------------------------------
  describe('scene-segmenter summary', () => {
    it('summarizes with the first LINE when the segment has no terminal punctuation', async () => {
      const segmenter = new SceneSegmenter();
      const segments: TranscriptionSegment[] = [
        { start: 0, end: 5000, text: '最初の行です\n次の行です\n三行目です' },
      ];

      const result = await segmenter.segment(segments);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].summary).toBe('最初の行です');
    });
  });
});
