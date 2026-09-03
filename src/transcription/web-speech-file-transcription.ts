/**
 * Web Speech file transcription engine - TASK-0318 (REQ-424 / TC-408-02)
 *
 * The SINGLE-SOURCE mechanism for transcribing a File with the Web Speech
 * API: Object URL + Audio real-time playback + SpeechRecognition handlers.
 * BrowserTranscriber.transcribeWithWebSpeechAPI delegates here, and the
 * StreamingTranscriber browser route (TASK-0319) consumes the same engine —
 * a second copy of this mechanism anywhere is the duplicate-formula class.
 *
 * Engine contract (specs/streaming-real-asr-inference/dataflow.md 経路1):
 * - a FINAL result (utterance) fires `hooks.onFinalSegment` — progressive,
 *   real events only (no synthetic stagger, SD3)
 * - confidence: the measured Web Speech value wins (including a legit 0);
 *   only a missing reading falls back to FINAL_NO_CONFIDENCE_STANDIN
 * - an empty run resolves `[]` — the engine NEVER fabricates mock segments;
 *   the caller decides the fallback (BrowserTranscriber keeps its mock,
 *   StreamingTranscriber routes to the disclosed placeholder path)
 * - `URL.revokeObjectURL` runs on BOTH the onend and onerror paths
 * - onerror never throws: the run resolves with whatever final results
 *   arrived and reports the error through `hooks.onError` — the caller
 *   decides whether that outcome is a failure or a fallback (the legacy
 *   BrowserTranscriber surface re-throws to keep its pre-engine outcome)
 *
 * The only throw is the absent-API construction error: without a
 * SpeechRecognition constructor there is no run to report, so it fails loud.
 */

import { TranscriptionSegment, TranscriptionError } from './types';
import { FINAL_NO_CONFIDENCE_STANDIN } from './browser-transcriber';

export interface WebSpeechFileHooks {
  /** Fired for each FINAL result (utterance) — callers forward it to
   *  onSegment / onProgress as the real-event progress signal. */
  onFinalSegment?: (segment: TranscriptionSegment) => void;
  /** Fired when the recognition run ends in onerror. The engine still
   *  resolves (never throws) — this hook is the caller's only error signal,
   *  e.g. the legacy BrowserTranscriber surface re-throws to preserve its
   *  success:false outcome. */
  onError?: (error: string) => void;
}

export async function transcribeFileWithWebSpeech(
  audioFile: File,
  hooks?: WebSpeechFileHooks,
): Promise<TranscriptionSegment[]> {
  // globalThis lookup (not bare `window`): the module must stay importable
  // in Node — the browser-vs-Node routing decision belongs to the caller.
  const SpeechRecognitionAPI = ((globalThis as Record<string, unknown>).SpeechRecognition ||
    (globalThis as Record<string, unknown>).webkitSpeechRecognition) as
    | { new (): SpeechRecognition }
    | undefined;

  if (!SpeechRecognitionAPI) {
    throw new TranscriptionError('Speech recognition not available');
  }

  return new Promise((resolve) => {
    // The engine owns its file-run instance (not the caller's live-mic one)
    // with the same configuration the BrowserTranscriber constructor applies:
    // continuous final+interim capture over the played-back audio.
    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = 'en-US';

    const segments: TranscriptionSegment[] = [];
    let currentSegmentStart = 0;
    let settled = false;

    // Create audio element to play the file
    const audio = new Audio();
    const audioUrl = URL.createObjectURL(audioFile);
    audio.src = audioUrl;

    // First terminal event (onend OR onerror) settles the run exactly once —
    // a real onerror is usually followed by onend, and the Object URL must
    // be revoked on both paths without double-revoking.
    const finish = () => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(audioUrl);
      resolve(segments);
    };

    recognition.onstart = () => {
      audio.play();
    };

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];

        if (result.isFinal) {
          const text = result[0]?.transcript?.trim() ?? '';
          // Web Speech confidence is [0,1]; 0 is a legit "very uncertain"
          // final result. Use ?? so only undefined falls back — `||` would
          // invert a real 0 into the stand-in, backwards. REQ-393: the
          // stand-in for a MISSING final confidence is the disclosed
          // neutral 0.5 (same convention as interim chunks), not 0.9 — an
          // absent measurement must not claim near-certainty.
          const confidence = result[0]?.confidence ?? FINAL_NO_CONFIDENCE_STANDIN;
          const currentTime = audio.currentTime * 1000; // Convert to ms

          if (text) {
            const segment: TranscriptionSegment = {
              start: currentSegmentStart,
              end: currentTime,
              text,
              confidence
            };
            segments.push(segment);
            currentSegmentStart = currentTime;

            hooks?.onFinalSegment?.(segment);
          }
        }
      }
    };

    recognition.onerror = (event) => {
      // Never throw (dataflow.md error flow): report through the hook and
      // complete with the final results collected so far — whether that is
      // a failure or a placeholder-path fallback is the caller's decision.
      hooks?.onError?.(event.error);
      finish();
    };

    recognition.onend = () => {
      finish();
    };

    // Start recognition
    recognition.start();
  });
}
