/**
 * WhisperTranscriber placeholder disclosure contract.
 *
 * README「音声認識の現状」: neither emitter behind WhisperTranscriber.transcribe()
 * runs ASR inference — `runRealWhisperTranscription` emits fixed sentences via
 * generateHighQualityTranscript() and `runEnhancedFallback` a hardcoded English
 * block. The result MUST say so:
 *
 * 1. `placeholder: true` on the TranscriptionResult — consumers
 *    (TranscriptionPipeline priority routing) must not treat the fabricated
 *    success as a real transcription.
 * 2. every placeholder segment carries the single-source
 *    PLACEHOLDER_SEGMENT_CONFIDENCE — the REQ-391 disclosed-constant
 *    convention. `runEnhancedFallback` used to freeze its own 0.92/0.89/0.94/
 *    0.87 ladder (a missed sibling of the REQ-391 random-jitter fix), so the
 *    confidence assertion below also pins that unify.
 *
 * Both assertions hold on either internal branch (isWhisperReady true or
 * false — its assignment races the un-awaited initializeWhisper()), so the
 * test does not need to force the race.
 */

import {
  WhisperTranscriber,
  PLACEHOLDER_SEGMENT_CONFIDENCE,
} from '../whisper-transcriber';

/** Minimal MP3-shaped File (sync word 0xFF 0xE0) that passes corruption checks */
function createValidMp3(): File {
  const buffer = new ArrayBuffer(64);
  const view = new Uint8Array(buffer);
  view[0] = 0xff;
  view[1] = 0xe0;
  return new File([buffer], 'placeholder-probe.mp3', { type: 'audio/mpeg' });
}

describe('WhisperTranscriber: placeholder disclosure', () => {
  it('marks the no-inference result with placeholder: true', async () => {
    const transcriber = new WhisperTranscriber();
    const result = await transcriber.transcribe(createValidMp3());

    expect(result.success).toBe(true);
    expect(result.placeholder).toBe(true);
  });

  it('stamps every placeholder segment with the single-source PLACEHOLDER_SEGMENT_CONFIDENCE', async () => {
    const transcriber = new WhisperTranscriber();
    const result = await transcriber.transcribe(createValidMp3());

    expect(result.segments.length).toBeGreaterThan(0);
    for (const segment of result.segments) {
      expect(segment.confidence).toBe(PLACEHOLDER_SEGMENT_CONFIDENCE);
    }
  });
});
