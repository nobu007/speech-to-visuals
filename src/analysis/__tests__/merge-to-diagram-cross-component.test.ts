/**
 * merge-to-diagram-cross-component.test.ts
 *
 * End-to-end lock on the cross-component interaction repaired INDEPENDENTLY by
 * two prior fixes, so that a regression in either — alone — is caught even
 * though each has its own unit test:
 *
 *   • mergeShortSegments summary regeneration (dda727c1). A short fragment
 *     merged into a neighbour used to COPY the first sub-segment's stale
 *     `summary`, dropping the merged-in content from the scene title/caption
 *     AND from the diagram-quality gates that read `segment.summary`. The fix
 *     regenerates `summary` from the merged text.
 *
 *   • generateEdgesForType('comparison') odd-node orphan (95c79335). For an ODD
 *     nodeCount the pairing loop dropped group A's extra member, leaving the
 *     middle node with zero edges — a floating, unconnected node. The fix
 *     clamps the overflow so every node participates in an edge.
 *
 * The interaction: a transcript with a SHORT trailing fragment merges into a
 * longer comparison segment; the merged segment then drives DiagramDetector.
 * The two fixes must hold TOGETHER — a concise title that reflects the merged
 * fragment, AND a fully-connected odd-node comparison diagram. This test runs
 * the real SceneSegmenter.mergeShortSegments straight into the real
 * DiagramDetector.analyze (rule-based path; no API key in the test env) and
 * asserts the combined outcome, so neither fix can silently regress while the
 * other stays green.
 *
 * mergeShortSegments is reached by the production rule-based pipeline
 * (basicSegmentation → mergeShortSegments); detector.analyze is the entry the
 * Simple/Main pipelines and Orchestrator all call. Determinism: the rule-based
 * path uses segment.text for keyword/node extraction (the gemini path is off
 * without GOOGLE_API_KEY), and mergeShortSegments is exercised directly (the
 * full segment() pipeline adds non-deterministic semantic/improvement passes
 * that can refrain from merging — see the scene-segmenter unit tests for the
 * same direct-call convention).
 */
import { SceneSegmenter } from '../scene-segmenter';
import { DiagramDetector } from '../diagram-detector';
import type { ContentSegment } from '../types';

describe('cross-component: short-fragment merge → odd-node comparison diagram', () => {
  const segmenter = new SceneSegmenter();
  const detector = new DiagramDetector();

  // Private helpers reached by cast, mirroring the scene-segmenter unit tests.
  const mergeShortSegments = (
    segmenter as unknown as {
      mergeShortSegments: (segs: ContentSegment[]) => Promise<ContentSegment[]>;
    }
  ).mergeShortSegments.bind(segmenter);
  const generateSummary = (
    segmenter as unknown as { generateSummary: (text: string) => string }
  ).generateSummary.bind(segmenter);

  /** Build a ContentSegment the way basicSegmentation/finalizeSegment would. */
  function cseg(startMs: number, endMs: number, text: string): ContentSegment {
    return {
      startMs,
      endMs,
      text,
      summary: generateSummary(text),
      keyphrases: [],
      confidence: 0.9,
    };
  }

  it('renders a fully-connected odd-node comparison diagram whose concise title reflects the merged fragment', async () => {
    // Fragment B (long, ≥ min 3000ms): the comparison body. The trailing space
    // keeps the no-space merge concat ("prev.text + current.text") at a word
    // boundary so node-label extraction stays clean.
    const longComparison = cseg(
      0,
      6500,
      'alpha versus beta, gamma, delta, epsilon, better ',
    );
    // Fragment A (short, < min 3000ms): a trailing fragment that MUST merge
    // backward into B. Its content ("end of talk") is the token the old
    // summary-copy bug dropped from the title.
    const shortTrailing = cseg(6500, 7500, 'end of talk');

    // --- (1) the merge fix: short fragment merges in, summary is regenerated --
    const merged = await mergeShortSegments([longComparison, shortTrailing]);
    expect(merged).toHaveLength(1);
    const scene = merged[0];
    // Both fragments' text survived the merge.
    expect(scene.text).toContain('versus');
    expect(scene.text).toContain('talk');
    // The summary is REGENERATED from the merged text (the dda727c1 invariant),
    // not copied from the long fragment's standalone summary.
    expect(scene.summary).toBe(generateSummary(scene.text));
    // The concise title reflects the merged-in fragment — "talk" would be
    // absent if the old code had copied longComparison.summary (B alone).
    expect(scene.summary).toContain('talk');

    // --- (2) the odd-node fix: the merged segment renders a connected diagram -
    const analysis = await detector.analyze(scene);

    // The comparison signal ("versus" + "better") beats the overlapping matrix
    // keywords, so the merged segment resolves to a comparison diagram.
    expect(analysis.type).toBe('comparison');

    // An ODD node count is what exercised the orphan bug (3/5/7 → middle node
    // dropped). This scenario yields 5 phrases → 5 nodes. Assert oddness (the
    // invariant the 95c79335 clamp protects), not a brittle exact count.
    expect(analysis.nodes.length).toBeGreaterThanOrEqual(3);
    expect(analysis.nodes.length % 2).toBe(1);

    // Every node participates in at least one edge — the fully-connected
    // property the odd-node fix restored. Before the clamp, the middle node
    // (index ⌈n/2⌉−1) had zero edges.
    expect(analysis.edges.length).toBeGreaterThan(0);
    const connected = new Set<string>();
    for (const edge of analysis.edges) {
      connected.add(edge.from);
      connected.add(edge.to);
      // No self-loop masquerading as connectivity.
      expect(edge.from).not.toBe(edge.to);
    }
    for (const node of analysis.nodes) {
      expect(connected.has(node.id)).toBe(true);
    }
  });

  it('contrast: the long fragment alone would already be an odd comparison, so the merge does not weaken topology', async () => {
    // Pinning that the UN-merged long fragment is itself an odd-node comparison
    // makes the cross-component assertion meaningful: the merge changes the
    // TITLE (adds the fragment) but must not break the diagram topology the
    // odd-node fix guarantees.
    const longComparison = cseg(
      0,
      6500,
      'alpha versus beta, gamma, delta, epsilon, better ',
    );
    const solo = await detector.analyze(longComparison);
    expect(solo.type).toBe('comparison');
    expect(solo.nodes.length % 2).toBe(1);
  });
});
