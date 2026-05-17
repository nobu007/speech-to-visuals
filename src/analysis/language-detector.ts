/**
 * Phase 32 / TASK-0014 / Phase 44: Language Detection for Adaptive Prompting
 *
 * Automatically detects the primary language of input text
 * to enable context-appropriate LLM prompts.
 *
 * Supported languages: Japanese, English, Chinese, Spanish, French, German, Auto
 *
 * Features:
 * - Unicode character-range based detection (Kana, CJK, Latin)
 * - Diacritical mark scoring for Latin-script languages (ES/FR/DE)
 * - Kuromoji morphological analyzer integration for improved Japanese detection
 * - Confidence scoring with text-length correction
 * - Mixed-language text segmentation
 * - Graceful fallback when Kuromoji is unavailable
 */

import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type Language = 'ja' | 'en' | 'zh' | 'es' | 'fr' | 'de' | 'auto';

/** A language-labeled segment within a mixed-language text */
export interface LanguageSegment {
  text: string;
  language: 'ja' | 'en' | 'zh' | 'es' | 'fr' | 'de';
  start: number;
  end: number;
}

/** Extended detection result (TASK-0014, Phase 44) */
export interface LanguageDetectionResult {
  language: Language;
  confidence: number;
  japaneseCharRatio: number;
  englishCharRatio: number;
  /** Phase 44: Chinese character ratio */
  chineseCharRatio: number;
  /** Phase 44: Spanish diacritical ratio */
  spanishCharRatio: number;
  /** Phase 44: French diacritical ratio */
  frenchCharRatio: number;
  /** Phase 44: German diacritical ratio */
  germanCharRatio: number;
  /** Language segments for mixed-language text */
  segments: LanguageSegment[];
}

/** Result of Kuromoji morphological analysis */
export interface JapaneseAnalysisResult {
  tokens: Array<{ surface_form: string; pos: string }>;
  wordCount: number;
  hasParticles: boolean;
}

// ---------------------------------------------------------------------------
// Internal character classification helpers
// ---------------------------------------------------------------------------

enum CharClass {
  JapaneseKana,   // Hiragana, Katakana
  CJK,            // CJK Ideographs (kanji/hanzi)
  English,        // Basic Latin A-Z, a-z
  Other,
}

function classifyChar(char: string): CharClass {
  const code = char.charCodeAt(0);

  // Japanese kana (hiragana, katakana)
  if (
    (code >= 0x3040 && code <= 0x309F) || // Hiragana
    (code >= 0x30A0 && code <= 0x30FF) || // Katakana
    (code >= 0x31F0 && code <= 0x31FF)    // Katakana Phonetic Extensions
  ) {
    return CharClass.JapaneseKana;
  }

  // CJK Ideographs (kanji/hanzi)
  if (
    (code >= 0x4E00 && code <= 0x9FFF) || // CJK Unified Ideographs
    (code >= 0x3400 && code <= 0x4DBF) || // CJK Extension A
    (code >= 0xF900 && code <= 0xFAFF)    // CJK Compatibility Ideographs
  ) {
    return CharClass.CJK;
  }

  // English alphabetic characters (basic Latin)
  if (
    (code >= 0x41 && code <= 0x5A) || // A-Z
    (code >= 0x61 && code <= 0x7A)    // a-z
  ) {
    return CharClass.English;
  }

  return CharClass.Other;
}

// ---------------------------------------------------------------------------
// Phase 44: Multilingual helpers
// ---------------------------------------------------------------------------

/** Check if text contains Japanese kana (hiragana or katakana) */
function hasKana(text: string): boolean {
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (
      (code >= 0x3040 && code <= 0x309F) ||
      (code >= 0x30A0 && code <= 0x30FF) ||
      (code >= 0x31F0 && code <= 0x31FF)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Score Latin-script languages based on diacritical marks.
 * Returns weighted scores for Spanish, French, and German.
 */
function scoreLatinLanguage(text: string): { es: number; fr: number; de: number } {
  let es = 0;
  let fr = 0;
  let de = 0;

  for (const char of text) {
    const code = char.charCodeAt(0);

    // Spanish-unique markers (high weight)
    if (code === 0x00F1 || code === 0x00D1) es += 3; // ñ/Ñ
    if (code === 0x00BF) es += 2; // ¿
    if (code === 0x00A1) es += 2; // ¡

    // German-unique marker
    if (code === 0x00DF) de += 3; // ß

    // French-unique markers
    if (code === 0x00E7 || code === 0x00C7) fr += 3; // ç/Ç
    if (code === 0x00EA || code === 0x00CA) fr += 2; // ê/Ê
    if (code === 0x00EB || code === 0x00CB) fr += 2; // ë/Ë
    if (code === 0x00EE || code === 0x00CE) fr += 2; // î/Î
    if (code === 0x00EF || code === 0x00CF) fr += 2; // ï/Ï
    if (code === 0x00FB || code === 0x00DB) fr += 2; // û/Û
    if (code === 0x00FF || code === 0x0178) fr += 2; // ÿ/Ÿ

    // Shared markers (lower weight)
    if (code === 0x00E9 || code === 0x00C9) { fr += 1; es += 1; } // é/É
    if (code === 0x00E8 || code === 0x00C8) fr += 1; // è/È
    if (code === 0x00E0 || code === 0x00C0) fr += 1; // à/À
    if (code === 0x00E2 || code === 0x00C2) fr += 1; // â/Â
    if (code === 0x00F4 || code === 0x00D4) fr += 1; // ô/Ô
    if (code === 0x00F9 || code === 0x00D9) fr += 1; // ù/Ù
    if (code === 0x00E4 || code === 0x00C4) de += 1; // ä/Ä
    if (code === 0x00F6 || code === 0x00D6) de += 1; // ö/Ö
    if (code === 0x00FC || code === 0x00DC) de += 1; // ü/Ü
  }

  return { es, fr, de };
}

/** Determine Latin-script language from diacritical scoring */
function detectLatinLanguage(text: string): 'en' | 'es' | 'fr' | 'de' {
  const scores = scoreLatinLanguage(text);
  const maxScore = Math.max(scores.es, scores.fr, scores.de);
  if (maxScore === 0) return 'en';
  if (scores.es >= scores.fr && scores.es >= scores.de) return 'es';
  if (scores.fr >= scores.es && scores.fr >= scores.de) return 'fr';
  return 'de';
}

/** Internal character analysis result */
interface CharacterAnalysis {
  kanaCount: number;
  cjkCount: number;
  latinCount: number;
  totalCount: number;
  kanaRatio: number;
  cjkRatio: number;
  latinRatio: number;
  latinScores: { es: number; fr: number; de: number };
}

// ---------------------------------------------------------------------------
// LanguageDetector class (TASK-0014, Phase 44)
// ---------------------------------------------------------------------------

/** Interface for a Kuromoji-like builder (for DI/testing) */
export interface KuromojiBuilder {
  (params: { dicPath: string }): {
    build(callback: (err: Error | null, tokenizer: unknown) => void): void;
  };
}

export class LanguageDetector {
  private kuromojiTokenizer: unknown | null = null;
  private kuromojiReady = false;
  private readonly kuromojiBuilderFactory: KuromojiBuilder | null;

  // -----------------------------------------------------------------------
  // Constructor
  // -----------------------------------------------------------------------

  /**
   * @param options Optional configuration. Pass `kuromojiBuilder` to inject
   *                a mock/custom builder for testing; omit to auto-detect.
   */
  constructor(options?: { kuromojiBuilder?: KuromojiBuilder }) {
    this.kuromojiBuilderFactory = options?.kuromojiBuilder ?? null;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Detect the primary language of input text.
   * Returns a LanguageDetectionResult with confidence score and segments.
   */
  async detect(text: string): Promise<LanguageDetectionResult> {
    const charAnalysis = this.analyzeCharacters(text);
    const language = this.determineLanguage(charAnalysis);
    const confidence = this.calculateConfidence(text, language);
    const segments = this.buildSegments(text);

    return {
      language,
      confidence,
      japaneseCharRatio: charAnalysis.kanaRatio + charAnalysis.cjkRatio,
      englishCharRatio: charAnalysis.latinRatio,
      chineseCharRatio: charAnalysis.cjkRatio,
      spanishCharRatio: 0,
      frenchCharRatio: 0,
      germanCharRatio: 0,
      segments,
    };
  }

  /**
   * Calculate the confidence score for a given language assignment.
   * Considers character ratios and text length.
   */
  calculateConfidence(text: string, language: string): number {
    const analysis = this.analyzeCharacters(text);

    let rawScore: number;

    switch (language) {
      case 'ja':
        rawScore = analysis.kanaRatio + analysis.cjkRatio * 0.5;
        break;
      case 'zh':
        rawScore = analysis.cjkRatio;
        break;
      case 'es':
      case 'fr':
      case 'de':
        rawScore = analysis.latinRatio;
        break;
      case 'en':
        rawScore = analysis.latinRatio;
        break;
      default:
        // 'auto' or unknown -> use max ratio
        rawScore = Math.max(analysis.kanaRatio, analysis.cjkRatio, analysis.latinRatio);
    }

    // Clamp to [0, 1]
    rawScore = Math.min(1.0, rawScore);

    // Boost: strong majority gets a bonus
    if (rawScore > 0.7) {
      rawScore = Math.min(1.0, rawScore + 0.15);
    } else if (rawScore > 0.5) {
      rawScore = Math.min(1.0, rawScore + 0.1);
    }

    // Text-length penalty: shorter texts are less reliable
    const lengthFactor = this.lengthCorrectionFactor(text);

    const score = rawScore * lengthFactor;
    return Math.max(0.0, Math.min(1.0, score));
  }

  // -----------------------------------------------------------------------
  // Kuromoji integration
  // -----------------------------------------------------------------------

  /**
   * Initialize the Kuromoji tokenizer asynchronously.
   * If initialization fails, the detector falls back to character-based detection.
   */
  async initializeKuromoji(): Promise<void> {
    try {
      let builder: KuromojiBuilder;

      if (this.kuromojiBuilderFactory) {
        builder = this.kuromojiBuilderFactory;
      } else {
        // Dynamic import -- may be mocked by jest.mock('kuromoji')
        const kuromoji = await import('kuromoji');
        // Handle both ESM default export and CJS-style export
        const mod = (kuromoji as Record<string, unknown>).default ?? kuromoji;
        builder = (mod as Record<string, KuromojiBuilder>).builder;
      }

      const dictPath = this.resolveDictPath();

      await new Promise<void>((resolve, _reject) => {
        builder({ dicPath: dictPath }).build(
          (err: Error | null, tokenizer: unknown) => {
            if (err) {
              logger.warn(
                `[LanguageDetector] Kuromoji initialization failed: ${err.message}. ` +
                  'Falling back to character-based detection.',
              );
              this.kuromojiReady = false;
              this.kuromojiTokenizer = null;
              resolve(); // resolve, not reject -- graceful fallback
            } else {
              this.kuromojiTokenizer = tokenizer;
              this.kuromojiReady = true;
              resolve();
            }
          },
        );
      });
    } catch (err) {
      // Module not available or other error
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(
        `[LanguageDetector] Kuromoji not available: ${message}. ` +
          'Using character-based detection only.',
      );
      this.kuromojiReady = false;
      this.kuromojiTokenizer = null;
    }
  }

  /**
   * Returns true when the Kuromoji tokenizer has been initialized.
   */
  isKuromojiReady(): boolean {
    return this.kuromojiReady;
  }

  /**
   * Perform morphological analysis on Japanese text using Kuromoji.
   * Throws if Kuromoji is not initialized.
   */
  analyzeJapanese(text: string): JapaneseAnalysisResult {
    if (!this.kuromojiReady || !this.kuromojiTokenizer) {
      throw new Error('Kuromoji tokenizer is not initialized. Call initializeKuromoji() first.');
    }

    const tokenizer = this.kuromojiTokenizer as {
      tokenize(input: string): Array<{ surface_form: string; pos: string }>;
    };

    const tokens = tokenizer.tokenize(text);

    return {
      tokens,
      wordCount: tokens.length,
      hasParticles: tokens.some((t) => t.pos === '助詞'),
    };
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  private resolveDictPath(): string {
    // Default: look for kuromoji dict relative to node_modules
    return 'node_modules/kuromoji/dict';
  }

  /**
   * Count characters by class and compute ratios.
   * Phase 44: Extended to track kana, CJK, and Latin separately.
   */
  private analyzeCharacters(text: string): CharacterAnalysis {
    let kanaCount = 0;
    let cjkCount = 0;
    let latinCount = 0;
    let totalCount = 0;

    for (const char of text) {
      const cls = classifyChar(char);
      if (cls === CharClass.JapaneseKana) {
        kanaCount++;
        totalCount++;
      } else if (cls === CharClass.CJK) {
        cjkCount++;
        totalCount++;
      } else if (cls === CharClass.English) {
        latinCount++;
        totalCount++;
      }
      // Other (spaces, numbers, punctuation, diacriticals) not counted for ratio
    }

    const kanaRatio = totalCount > 0 ? kanaCount / totalCount : 0;
    const cjkRatio = totalCount > 0 ? cjkCount / totalCount : 0;
    const latinRatio = totalCount > 0 ? latinCount / totalCount : 0;

    return {
      kanaCount,
      cjkCount,
      latinCount,
      totalCount,
      kanaRatio,
      cjkRatio,
      latinRatio,
      latinScores: scoreLatinLanguage(text),
    };
  }

  /**
   * Determine the primary language based on character analysis.
   * Phase 44: Extended with Chinese and Latin-script language detection.
   */
  private determineLanguage(analysis: CharacterAnalysis): Language {
    // No recognizable characters -> default to 'en'
    if (analysis.totalCount === 0) {
      return 'en';
    }

    // Japanese: has kana (hiragana/katakana)
    if (analysis.kanaCount > 0) {
      return 'ja';
    }

    // Chinese: has CJK but no kana
    if (analysis.cjkCount > 0) {
      return 'zh';
    }

    // Latin-script languages: score based on diacriticals
    const { es, fr, de } = analysis.latinScores;
    const maxScore = Math.max(es, fr, de);

    if (maxScore > 0) {
      if (es >= fr && es >= de) return 'es';
      if (fr >= es && fr >= de) return 'fr';
      return 'de';
    }

    // Default: English
    return 'en';
  }

  /**
   * Compute a correction factor based on text length.
   * Short texts (< 10 meaningful chars) get reduced confidence.
   */
  private lengthCorrectionFactor(text: string): number {
    // Count meaningful characters (exclude whitespace)
    const meaningfulLength = text.replace(/\s/g, '').length;

    if (meaningfulLength === 0) {
      return 0.3;
    }
    if (meaningfulLength < 5) {
      return 0.5;
    }
    if (meaningfulLength < 10) {
      return 0.7 + (meaningfulLength / 10) * 0.3; // 0.7 -> 0.99
    }
    return 1.0;
  }

  /**
   * Split text into language-labeled segments.
   * Phase 44: Uses kana presence and diacritical scoring for accurate labeling.
   */
  private buildSegments(text: string): LanguageSegment[] {
    if (text.length === 0) return [];

    const textHasKana = hasKana(text);
    const latinLang = detectLatinLanguage(text);

    const segments: LanguageSegment[] = [];
    let currentLang: LanguageSegment['language'] | null = null;
    let segStart = 0;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const cls = classifyChar(char);

      let lang: LanguageSegment['language'] | null = null;
      switch (cls) {
        case CharClass.JapaneseKana:
          lang = 'ja';
          break;
        case CharClass.CJK:
          lang = textHasKana ? 'ja' : 'zh';
          break;
        case CharClass.English:
          lang = latinLang;
          break;
        // Other characters inherit the current language context
      }

      if (lang !== null && lang !== currentLang) {
        // Flush previous segment
        if (currentLang !== null && i > segStart) {
          segments.push({
            text: text.slice(segStart, i),
            language: currentLang,
            start: segStart,
            end: i,
          });
        }
        segStart = i;
        currentLang = lang;
      }
    }

    // Flush last segment
    if (currentLang !== null && text.length > segStart) {
      segments.push({
        text: text.slice(segStart),
        language: currentLang,
        start: segStart,
        end: text.length,
      });
    }

    return segments;
  }
}

// ---------------------------------------------------------------------------
// Legacy function exports (backward compatibility)
// ---------------------------------------------------------------------------

/**
 * Detect the primary language of input text.
 * Uses character-based heuristics for fast, offline detection.
 *
 * Legacy function wrapper maintained for backward compatibility.
 */
export function detectLanguage(text: string): LanguageDetectionResult {
  const chars = text.split('');
  let kanaCount = 0;
  let cjkCount = 0;
  let latinCount = 0;
  let totalCount = 0;

  for (const char of chars) {
    const cls = classifyChar(char);
    if (cls === CharClass.JapaneseKana) {
      kanaCount++;
      totalCount++;
    } else if (cls === CharClass.CJK) {
      cjkCount++;
      totalCount++;
    } else if (cls === CharClass.English) {
      latinCount++;
      totalCount++;
    }
  }

  const kanaRatio = totalCount > 0 ? kanaCount / totalCount : 0;
  const cjkRatio = totalCount > 0 ? cjkCount / totalCount : 0;
  const latinRatio = totalCount > 0 ? latinCount / totalCount : 0;

  // Determine language
  let language: Language = 'en';
  let confidence = 0.5;

  if (kanaCount > 0) {
    // Japanese: has kana characters
    language = 'ja';
    confidence = Math.min(0.95, kanaRatio + cjkRatio * 0.3 + 0.2);
  } else if (cjkCount > 0) {
    // Chinese: has CJK but no kana
    language = 'zh';
    confidence = Math.min(0.95, cjkRatio);
  } else {
    // Latin-script languages: score based on diacriticals
    const scores = scoreLatinLanguage(text);
    const maxScore = Math.max(scores.es, scores.fr, scores.de);
    if (maxScore > 0) {
      if (scores.es >= scores.fr && scores.es >= scores.de) language = 'es';
      else if (scores.fr >= scores.es && scores.fr >= scores.de) language = 'fr';
      else language = 'de';
      confidence = Math.min(0.95, 0.5 + maxScore * 0.05);
    } else {
      language = 'en';
      confidence = Math.min(0.95, latinRatio);
    }
  }

  return {
    language,
    confidence,
    japaneseCharRatio: kanaRatio + cjkRatio,
    englishCharRatio: latinRatio,
    chineseCharRatio: cjkRatio,
    spanishCharRatio: 0,
    frenchCharRatio: 0,
    germanCharRatio: 0,
    segments: [],
  };
}

/**
 * Override language detection with explicit language preference.
 * Useful for testing or when user specifies language manually.
 */
export function forceLanguage(preferredLanguage: Language): Language {
  if (preferredLanguage === 'auto') {
    // Auto will be detected per-text
    return 'auto';
  }
  return preferredLanguage;
}
