/**
 * Transcription language detection — the single source for
 * TranscriptionResult.language (single-source round 22).
 *
 * WHAT USED TO DRIFT. Three producers of TranscriptionResult.language each
 * decided "what language is this transcript in?" their own way:
 *
 *   - transcriber.ts delegated to analysis/language-detector (canonical);
 *   - whisper-transcriber.ts hand-rolled a [kana|kanji] character class, so a
 *     Chinese-only transcript (kanji, no kana) was labeled 'ja' — selecting a
 *     Japanese LLM prompt downstream — and Spanish/French/German collapsed to
 *     'en' (the class has no diacritical scoring at all);
 *   - streaming-transcriber.ts hardcoded 'ja' for every result, labeling its
 *     own English chunk-mock output 'ja'.
 *
 * THE CANONICAL BEHAVIOR: language is derived from the transcript text by
 * analysis/language-detector's detectLanguage() (kana→ja, kanji-only→zh,
 * diacritical scoring→es/fr/de, default en), sampled from the first
 * DETECTION_SAMPLE_SEGMENT_COUNT segments capped at DETECTION_SAMPLE_MAX_CHARS
 * (the sampling contract transcriber.ts already shipped). Producers whose
 * language is a PRIOR, not a detection, stay local — browser-transcriber pins
 * Web Speech recognition to lang='en-US' and reports 'en' by construction.
 *
 * Guarded by the frozen-literal registry (tests/guards/frozen-literal-rules.ts,
 * 'transcription language detection single-sourced' entry): no src/transcription
 * file may hand-roll the Japanese character class or hardcode a language code
 * in a result literal outside browser-transcriber's pinned-recognition site.
 */
import { detectLanguage, type Language } from '@/analysis/language-detector';
import type { TranscriptionSegment } from './types';

/** Language union → code stored in TranscriptionResult.language. */
const LANGUAGE_CODE_MAP: Record<Language, string> = {
  ja: 'ja',
  en: 'en',
  zh: 'zh',
  es: 'es',
  fr: 'fr',
  de: 'de',
  auto: 'unknown',
};

/** How many leading segments feed detection (leading text identifies the
 * track language; scanning everything buys nothing and costs on long runs). */
const DETECTION_SAMPLE_SEGMENT_COUNT = 3;

/** Character cap on the joined sample — same contract transcriber.ts shipped. */
const DETECTION_SAMPLE_MAX_CHARS = 500;

/**
 * Detect the language of a transcript from its segments. Returns the code for
 * TranscriptionResult.language ('ja'|'en'|'zh'|'es'|'fr'|'de', or 'unknown'
 * when the detector declines).
 */
export function detectTranscriptionLanguage(segments: TranscriptionSegment[]): string {
  // No segments → no text to detect from: decline rather than guess 'en'
  // (the contract transcriber.ts shipped; pinned by transcriber-pipeline tests).
  if (segments.length === 0) {
    return 'unknown';
  }

  const sampleText = segments
    .slice(0, DETECTION_SAMPLE_SEGMENT_COUNT)
    .map((s) => s.text)
    .join(' ')
    .substring(0, DETECTION_SAMPLE_MAX_CHARS);

  return LANGUAGE_CODE_MAP[detectLanguage(sampleText).language] ?? 'unknown';
}
