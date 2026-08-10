/**
 * Sentence/word splitters must NOT sever a decimal point.
 *
 * THE BUG (sibling of daebbc45). `extractKeyPhrases` in diagram-detector was
 * fixed in daebbc45 for splitting on a bare '.' inside a character class
 * (`/[。！？\n.!?;]+/` → every dot, including the decimal in "1.5", was a
 * boundary). That commit's own lesson — "when fixing a bug, grep ALL
 * same-module siblings sharing the pattern; one site's fix is NEVER
 * sufficient" — was not applied across the rest of src/analysis. The IDENTICAL
 * bare-'.'-in-a-character-class defect survived in FIVE more sentence splitters
 * and ONE word tokenizer, all feeding user-visible output:
 *
 *   - content-analyzer.analyzeV1            → DiagramData node LABELS
 *   - scene-segmenter.generateSummary       → ContentSegment.summary (UI)
 *   - diagram-detector.extractContext       → entity context snippets
 *   - complexity-detector (×2)              → sentence-count metrics
 *   - diagram-detector key-phrase fallback  → word-level node-label tokens
 *
 * Consequence: "The ratio is 1.5 to 1" produced node label "The ratio is 1"
 * (and orphan fragment "5 to 1"), summary "The growth rate is 2" instead of
 * "2.5", version "2.0" and IP "192.168.1.1" disintegrating into "2"/"192"/"168".
 *
 * THE FIX mirrors daebbc45 / scene-segmenter.splitTextAtSentenceBoundaries: an
 * English '.' is a boundary only via `\.(?:\s+|$)` so intra-token dots survive.
 * The word tokenizer simply drops '.' from its delimiter class (a decimal /
 * version / IP is a single token, not a delimiter).
 *
 * This file pins the two user-visible LIVE sites through their public methods.
 * The structural sweep guard (no bare '.' in any src/analysis split char-class)
 * lives in sentence-split-dot-sweep-guard.test.ts.
 */
import { describe, it, expect } from '@jest/globals';
import { ContentAnalyzer } from '../content-analyzer';
import { SceneSegmenter } from '../scene-segmenter';
import type { TranscriptionSegment } from '@/transcription/types';

describe('decimal-point preservation across analysis sentence/word splitters (siblings of daebbc45)', () => {
  // ── content-analyzer.analyzeV1 → node labels ─────────────────────────
  describe('ContentAnalyzer.analyzeV1 node labels', () => {
    it('preserves a decimal in a node label', () => {
      const analyzer = new ContentAnalyzer('test-key');
      const result = analyzer.analyzeV1('The ratio is 1.5 to 1. Growth is 2.5 times.');
      const joined = result.nodes.map(n => n.label).join(' ');

      // Bug: bare '.' in /[。.!?\n]+/ split on EVERY dot, so "1.5" → "1" + "5"
      // and the intact decimal never appeared in any node label.
      expect(joined).toContain('1.5');
      expect(joined).toContain('2.5');
    });

    it('preserves a version number and an IP address', () => {
      const analyzer = new ContentAnalyzer('test-key');
      const result = analyzer.analyzeV1('Deploy server 192.168.1.1. Upgrade to version 3.0 now.');
      const joined = result.nodes.map(n => n.label).join(' ');

      expect(joined).toContain('192.168.1.1');
      expect(joined).toContain('3.0');
    });

    it('still splits genuine English sentence boundaries', () => {
      const analyzer = new ContentAnalyzer('test-key');
      const result = analyzer.analyzeV1('Gather requirements. Design the system. Implement the build.');
      // Three sentences → three nodes (the dots between are real boundaries).
      expect(result.nodes.length).toBeGreaterThanOrEqual(3);
      expect(result.nodes.map(n => n.label).join(' ')).toContain('Gather requirements');
      expect(result.nodes.map(n => n.label).join(' ')).toContain('Design the system');
    });
  });

  // ── scene-segmenter.generateSummary → ContentSegment.summary ─────────
  describe('SceneSegmenter segment summary', () => {
    function seg(startMs: number, endMs: number, text: string): TranscriptionSegment {
      return { start: startMs, end: endMs, text };
    }

    it('preserves a decimal in the segment summary', async () => {
      const segmenter = new SceneSegmenter();
      const segments: TranscriptionSegment[] = [
        seg(0, 5000, 'The growth rate is 2.5 percent and rising.'),
      ];
      const result = await segmenter.segment(segments);

      // summary = first sentence of the segment text. Bug: bare '.' in
      // /[.!?。！？]+/ tore "2.5" so the summary read "The growth rate is 2".
      const summaries = result.map(s => s.summary).join(' ');
      expect(summaries).toContain('2.5');
      expect(summaries).not.toMatch(/\bris(?:es)?\b/); // orphan tail fragment must not leak
    });
  });
});
