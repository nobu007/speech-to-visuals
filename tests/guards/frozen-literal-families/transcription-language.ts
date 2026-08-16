import type { FrozenLiteralRule } from '../freeze-guard';

// Family file of the frozen-literal registry (round 35 split). The original
// rule doc blocks below are verbatim moves from the single-file registry —
// the registry policy and the ordered aggregation live in
// tests/guards/frozen-literal-rules.ts.

export const RULES: FrozenLiteralRule[] = [
  /**
   * Round 22 (transcription language single-source): TranscriptionResult
   * language is decided ONLY by src/transcription/language-detection.ts
   * (which delegates to analysis' detectLanguage). whisper-transcriber
   * hand-rolled a [kana|kanji] class that labeled Chinese-only transcripts
   * 'ja' and collapsed es/fr/de to 'en'; streaming-transcriber hardcoded
   * 'ja' for every result — including its own English chunk-mock output.
   * browser-transcriber's 'en' stays local: Web Speech recognition is
   * pinned to lang='en-US' there, so the language is a PRIOR, not a
   * detection. The banned char-class pattern is the class BODY (rename- and
   * flag-resistant); the literal-shape pattern catches a result-level
   * hardcoded code in the two migrated files.
   */
  {
    id: 'transcription language detection single-sourced in src/transcription/language-detection',
    roots: ['src/transcription'],
    exclude: {
      'src/transcription/language-detection.ts': 'the canonical source itself',
      'src/transcription/browser-transcriber.ts':
        "Web Speech recognition is pinned to lang='en-US' — language is a recognition-config prior, not a text detection (different concept)",
    },
    patterns: [
      // A hand-rolled Japanese character class, in any partial-variant shape:
      // matching the RANGE ESCAPES (not the whole regex) catches katakana-only
      // or kanji-only re-freezes too, and survives identifier renames.
      /\\u3040-\\u309F/,
      /\\u30A0-\\u30FF/,
      /\\u4E00-\\u9FFF/,
      /\/\[[^\]\n]*[぀-ヿ一-鿿]\s*-\s*[぀-ヿ一-鿿]/,
      // Result-level hardcoded language codes in the migrated result shapes.
      /language:\s*'(ja|en|zh|es|fr|de)'\s*[,}]/,
    ],
    minSweptFiles: 8,
  },
];
