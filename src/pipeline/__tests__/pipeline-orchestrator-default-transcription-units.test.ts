/**
 * Time-unit contract test for the orchestrator's fallback transcription result.
 *
 * Bug being prevented: `createDefaultTranscriptionResult()` previously emitted
 * segment `start`/`end` and result `duration` in SECONDS (0/5/10) while the
 * `TranscriptionSegment` contract (src/transcription/types.ts) — and every other
 * producer (whisper, browser, TranscriptionPipeline fallback) — uses
 * MILLISECONDS. Downstream the segmenter treated those values as ms, collapsing
 * every fallback scene to a few-millisecond duration.
 *
 * This is the same recurring ×1000 unit-divergence class documented across
 * 6d8f99f / 0bee524 / 4caeba0 / 95f09ca; the guard here is a unit/cross-field
 * consistency test on the produced data.
 */
import { createDefaultTranscriptionResult } from '../pipeline-orchestrator';

describe('createDefaultTranscriptionResult — MILLISECONDS time-unit contract', () => {
  const result = createDefaultTranscriptionResult();

  it('emits every segment start/end in milliseconds (not seconds)', () => {
    expect(result.segments.length).toBeGreaterThan(0);
    for (const seg of result.segments) {
      // A real default transcription spans multiple seconds per segment.
      // If the value were in seconds this would be a single digit.
      expect(seg.end - seg.start).toBeGreaterThanOrEqual(1000);
    }
  });

  it('reports duration in milliseconds', () => {
    expect(result.duration).toBeGreaterThanOrEqual(1000);
  });

  it('keeps duration consistent with the last segment end', () => {
    const last = result.segments[result.segments.length - 1];
    expect(result.duration).toBe(last.end);
  });

  it('keeps segments non-negative, ordered, and start <= end', () => {
    let prevEnd = -Infinity;
    for (const seg of result.segments) {
      expect(seg.start).toBeGreaterThanOrEqual(0);
      expect(seg.end).toBeGreaterThanOrEqual(seg.start);
      expect(seg.start).toBeGreaterThanOrEqual(prevEnd);
      prevEnd = seg.end;
    }
  });
});
