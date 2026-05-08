/**
 * Phase 32 / TASK-0014: Language Detection for Adaptive Prompting
 *
 * Automatically detects the primary language of input text
 * to enable context-appropriate LLM prompts.
 *
 * Supported languages: Japanese, English, Auto
 *
 * Features:
 * - Unicode character-range based detection (Hiragana, Katakana, Kanji, Alphabet)
 * - Kuromoji morphological analyzer integration for improved Japanese detection
 * - Confidence scoring with text-length correction
 * - Mixed-language text segmentation
 * - Graceful fallback when Kuromoji is unavailable
 */

import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type Language = 'ja' | 'en' | 'auto';

/** A language-labeled segment within a mixed-language text */
export interface LanguageSegment {
  text: string;
  language: 'ja' | 'en';
  start: number;
  end: number;
}

/** Extended detection result (TASK-0014) */
export interface LanguageDetectionResult {
  language: Language;
  confidence: number;
  japaneseCharRatio: number;
  englishCharRatio: number;
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
  Japanese,
  English,
  Other,
}

function classifyChar(char: string): CharClass {
  const code = char.charCodeAt(0);

  // Japanese character ranges
  if (
    (code >= 0x3040 && code <= 0x309F) || // Hiragana
    (code >= 0x30A0 && code <= 0x30FF) || // Katakana
    (code >= 0x31F0 && code <= 0x31FF) || // Katakana Phonetic Extensions
    (code >= 0x4E00 && code <= 0x9FFF) || // Kanji (CJK Unified Ideographs)
    (code >= 0x3400 && code <= 0x4DBF) || // Kanji Extension A
    (code >= 0xF900 && code <= 0xFAFF)    // CJK Compatibility Ideographs
  ) {
    return CharClass.Japanese;
  }

  // English alphabetic characters
  if (
    (code >= 0x41 && code <= 0x5A) || // A-Z
    (code >= 0x61 && code <= 0x7A)    // a-z
  ) {
    return CharClass.English;
  }

  return CharClass.Other;
}

// ---------------------------------------------------------------------------
// LanguageDetector class (TASK-0014)
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
    const segments = this.buildSegments(text);

    const language = this.determineLanguage(charAnalysis);
    const confidence = this.calculateConfidence(text, language);

    return {
      language,
      confidence,
      japaneseCharRatio: charAnalysis.japaneseRatio,
      englishCharRatio: charAnalysis.englishRatio,
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

    if (language === 'ja') {
      rawScore = analysis.japaneseRatio;
    } else if (language === 'en') {
      rawScore = analysis.englishRatio;
    } else {
      // 'auto' or unknown -> use max of the two
      rawScore = Math.max(analysis.japaneseRatio, analysis.englishRatio);
    }

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
   */
  private analyzeCharacters(text: string): {
    japaneseCount: number;
    englishCount: number;
    totalCount: number;
    japaneseRatio: number;
    englishRatio: number;
  } {
    let japaneseCount = 0;
    let englishCount = 0;
    let totalCount = 0;

    for (const char of text) {
      const cls = classifyChar(char);
      if (cls === CharClass.Japanese) {
        japaneseCount++;
        totalCount++;
      } else if (cls === CharClass.English) {
        englishCount++;
        totalCount++;
      }
      // Other (spaces, numbers, punctuation) are not counted for ratio
    }

    const japaneseRatio = totalCount > 0 ? japaneseCount / totalCount : 0;
    const englishRatio = totalCount > 0 ? englishCount / totalCount : 0;

    return { japaneseCount, englishCount, totalCount, japaneseRatio, englishRatio };
  }

  /**
   * Determine the primary language based on character analysis.
   */
  private determineLanguage(analysis: {
    japaneseRatio: number;
    englishRatio: number;
    totalCount: number;
  }): Language {
    // No recognizable characters -> default to 'auto'
    if (analysis.totalCount === 0) {
      return 'en'; // default fallback
    }

    // Threshold-based decision
    if (analysis.japaneseRatio > 0.2) {
      return 'ja';
    }

    if (analysis.englishRatio > 0.5) {
      return 'en';
    }

    // Ambiguous: pick the dominant one
    if (analysis.japaneseRatio >= analysis.englishRatio) {
      return 'ja';
    }

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
   */
  private buildSegments(text: string): LanguageSegment[] {
    if (text.length === 0) return [];

    const segments: LanguageSegment[] = [];
    let currentLang: 'ja' | 'en' | null = null;
    let segStart = 0;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const cls = classifyChar(char);

      let lang: 'ja' | 'en' | null = null;
      if (cls === CharClass.Japanese) {
        lang = 'ja';
      } else if (cls === CharClass.English) {
        lang = 'en';
      }
      // Other characters inherit the current language context

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
  let japaneseCount = 0;
  let englishCount = 0;
  let totalCount = 0;

  for (const char of chars) {
    const cls = classifyChar(char);
    if (cls === CharClass.Japanese) {
      japaneseCount++;
      totalCount++;
    } else if (cls === CharClass.English) {
      englishCount++;
      totalCount++;
    }
  }

  const japaneseRatio = totalCount > 0 ? japaneseCount / totalCount : 0;
  const englishRatio = totalCount > 0 ? englishCount / totalCount : 0;

  // Decision threshold: 20% for clear language detection
  let language: Language = 'en';
  let confidence = 0.5;

  if (japaneseRatio > 0.2) {
    language = 'ja';
    confidence = Math.min(0.95, japaneseRatio + 0.2);
  } else if (englishRatio > 0.5) {
    language = 'en';
    confidence = Math.min(0.95, englishRatio);
  }

  return {
    language,
    confidence,
    japaneseCharRatio: japaneseRatio,
    englishCharRatio: englishRatio,
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
