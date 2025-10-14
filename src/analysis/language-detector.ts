/**
 * Phase 32: Language Detection for Adaptive Prompting
 *
 * Automatically detects the primary language of input text
 * to enable context-appropriate LLM prompts.
 *
 * Supported languages: Japanese, English, Auto
 */

export type Language = 'ja' | 'en' | 'auto';

export interface LanguageDetectionResult {
  language: Language;
  confidence: number;
  japaneseCharRatio: number;
  englishCharRatio: number;
}

/**
 * Detect the primary language of input text
 * Uses character-based heuristics for fast, offline detection
 */
export function detectLanguage(text: string): LanguageDetectionResult {
  const chars = text.split('');
  let japaneseCount = 0;
  let englishCount = 0;
  let totalCount = 0;

  for (const char of chars) {
    const code = char.charCodeAt(0);

    // Japanese character ranges (Hiragana, Katakana, Kanji)
    if (
      (code >= 0x3040 && code <= 0x309F) || // Hiragana
      (code >= 0x30A0 && code <= 0x30FF) || // Katakana
      (code >= 0x4E00 && code <= 0x9FFF) || // Kanji (CJK Unified Ideographs)
      (code >= 0x3400 && code <= 0x4DBF)    // Kanji Extension A
    ) {
      japaneseCount++;
      totalCount++;
    }
    // English alphabetic characters
    else if ((code >= 0x41 && code <= 0x5A) || (code >= 0x61 && code <= 0x7A)) {
      englishCount++;
      totalCount++;
    }
  }

  const japaneseRatio = totalCount > 0 ? japaneseCount / totalCount : 0;
  const englishRatio = totalCount > 0 ? englishCount / totalCount : 0;

  // Decision threshold: 20% for clear language detection
  let language: Language = 'auto';
  let confidence = 0.5;

  if (japaneseRatio > 0.2) {
    language = 'ja';
    confidence = Math.min(0.95, japaneseRatio + 0.2);
  } else if (englishRatio > 0.5) {
    language = 'en';
    confidence = Math.min(0.95, englishRatio);
  }

  console.log(`🌐 Language detection: ${language} (confidence: ${(confidence * 100).toFixed(1)}%, ja: ${(japaneseRatio * 100).toFixed(1)}%, en: ${(englishRatio * 100).toFixed(1)}%)`);

  return {
    language,
    confidence,
    japaneseCharRatio: japaneseRatio,
    englishCharRatio: englishRatio,
  };
}

/**
 * Phase 32: Override language detection with explicit language preference
 * Useful for testing or when user specifies language manually
 */
export function forceLanguage(preferredLanguage: Language): Language {
  if (preferredLanguage === 'auto') {
    // Auto will be detected per-text
    return 'auto';
  }
  console.log(`🌐 Language forced to: ${preferredLanguage}`);
  return preferredLanguage;
}
