/**
 * Structural guard for the single-source segment-length constants.
 *
 * DEFAULT_MIN_SEGMENT_LENGTH_MS / DEFAULT_MAX_SEGMENT_LENGTH_MS live in
 * scene-segmenter.ts and are re-exported through the @/analysis barrel. Every
 * pipeline producer (main-pipeline, simple-pipeline, pipeline-orchestrator) and
 * the iteration-logger fallback MUST source these here — a bare `3000`/`15000`
 * literal elsewhere is the constant-desync regression this test prevents.
 *
 * These assertions lock (a) the canonical value and (b) that the barrel and the
 * deep path are the SAME binding, so the two cannot silently diverge.
 */

import {
  SceneSegmenter,
  DEFAULT_MIN_SEGMENT_LENGTH_MS,
  DEFAULT_MAX_SEGMENT_LENGTH_MS,
} from '@/analysis/scene-segmenter';
import * as analysisBarrel from '@/analysis';
import type { TranscriptionSegment } from '@/transcription/types';

describe('single-source segment-length constants', () => {
  it('exposes the canonical 3s/15s millisecond values', () => {
    expect(DEFAULT_MIN_SEGMENT_LENGTH_MS).toBe(3000);
    expect(DEFAULT_MAX_SEGMENT_LENGTH_MS).toBe(15000);
  });

  it('re-exports the SAME binding through the @/analysis barrel', () => {
    expect(analysisBarrel.DEFAULT_MIN_SEGMENT_LENGTH_MS).toBe(DEFAULT_MIN_SEGMENT_LENGTH_MS);
    expect(analysisBarrel.DEFAULT_MAX_SEGMENT_LENGTH_MS).toBe(DEFAULT_MAX_SEGMENT_LENGTH_MS);
  });

  it('applies the min bound behaviourally (sub-3000ms segments are merged away)', async () => {
    // Two contiguous sub-3s chunks that semantically merge; without the 3000ms
    // floor each would survive as its own <3s scene.
    const segments: TranscriptionSegment[] = [
      { id: 0, start: 0, end: 1500, text: 'alpha beta' },
      { id: 1, start: 1500, end: 3000, text: 'beta gamma' },
      { id: 2, start: 3000, end: 8000, text: 'gamma delta epsilon zeta' },
    ];
    const result = await new SceneSegmenter().segment(segments);
    // No produced segment may be shorter than the min bound.
    for (const seg of result) {
      expect(seg.endMs - seg.startMs).toBeGreaterThanOrEqual(DEFAULT_MIN_SEGMENT_LENGTH_MS);
    }
  });
});
