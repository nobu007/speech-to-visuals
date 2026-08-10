/**
 * extractKeyPhrases must NOT split on a decimal point.
 *
 * THE BUG. `extractKeyPhrases` split its input on `/[。！？\n.!?;]+/`. Inside a
 * character class the `.` is a literal dot, so the regex split on EVERY dot —
 * including the decimal point in "1.5", the version in "2.0", an IP
 * "192.168.1.1", a percentage "99.9%". Decimal-bearing text tore across node
 * labels: "The ratio is 1.5 to 1." produced node labels "The ratio is 1" and
 * "5 to 1" (the "1.5" severed). extractKeyPhrases feeds
 * generateContentFromText → extractEntitiesAndRelationships →
 * ruleBasedDetection → analyze, i.e. it decides the diagram's NODE LABELS in
 * the rule-based (no-LLM) detection path.
 *
 * THE SIBLING. The identical sentence-split bug was already fixed in
 * `scene-segmenter.ts:splitTextAtSentenceBoundaries`, which treats a '.' as a
 * boundary only when followed by whitespace or end-of-string (pinned by
 * scene-segmenter.test.ts "does NOT split a decimal point (e.g. 3.14)"). This
 * site — a same-module consumer of the same sentence-split idea — was missed
 * when that fix landed. This test closes the sibling gap.
 */
import { describe, it, expect } from '@jest/globals';
import { DiagramDetector } from '../diagram-detector';
import type { ContentSegment } from '../types';

function makeSegment(text: string): ContentSegment {
  return {
    startMs: 0,
    endMs: 5000,
    text,
    summary: text.slice(0, 60),
    keyphrases: [],
    confidence: 0.9,
  };
}

describe('extractKeyPhrases preserves decimal points (sibling of scene-segmenter fix)', () => {
  it('does not sever "1.5" / "2.5" across node labels', async () => {
    const detector = new DiagramDetector();
    // Force the rule-based path (LLM off) so extractKeyPhrases drives labels.
    (detector as unknown as { gemini: unknown }).gemini = { isEnabled: () => false };

    const result = await detector.analyze(
      makeSegment('The ratio is 1.5 to 1. Growth is 2.5 times.'),
    );
    const labels = (result.nodes ?? []).map((n) => n.label);
    const joined = labels.join(' ');

    // Bug: the regex treated every '.' as a sentence boundary, so "1.5" → "1"
    // + "5" and "2.5" → "2" + "5"; no node label contained the intact decimal.
    expect(joined).toContain('1.5');
    expect(joined).toContain('2.5');
    // The torn fragment must not surface as its own node label.
    expect(labels).not.toContain('5 to 1');
    expect(labels).not.toContain('5 times');
  });

  it('keeps an IP address and version number intact', async () => {
    const detector = new DiagramDetector();
    (detector as unknown as { gemini: unknown }).gemini = { isEnabled: () => false };

    const result = await detector.analyze(
      makeSegment('Server 192.168.1.1 is down. Upgrade to version 3.0 now.'),
    );
    const joined = (result.nodes ?? []).map((n) => n.label).join(' ');

    expect(joined).toContain('192.168.1.1');
    expect(joined).toContain('3.0');
  });

  it('still splits genuine English sentence boundaries', async () => {
    const detector = new DiagramDetector();
    (detector as unknown as { gemini: unknown }).gemini = { isEnabled: () => false };

    const result = await detector.analyze(
      makeSegment('Gather requirements. Design the system. Implement the build.'),
    );
    const labels = (result.nodes ?? []).map((n) => n.label);

    // Three distinct sentences → at least 2 distinct node labels (not one
    // merged blob), and each clause survives intact.
    expect(labels.length).toBeGreaterThanOrEqual(2);
    expect(labels.join(' ')).toContain('Gather requirements');
    expect(labels.join(' ')).toContain('Design the system');
  });
});
