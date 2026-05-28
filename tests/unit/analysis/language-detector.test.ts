/**
 * REQ-164: language-detector.ts Test Coverage
 *
 * Unit tests for LanguageDetector's core functionality:
 *   - Japanese/English language detection
 *   - Confidence scoring
 */

import {
  LanguageDetector,
  detectLanguage,
  forceLanguage,
} from '@/analysis/language-detector';
import type { LanguageDetectionResult, Language } from '@/analysis/language-detector';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('REQ-164: LanguageDetector', () => {
  let detector: LanguageDetector;

  beforeEach(() => {
    detector = new LanguageDetector();
  });

  // ─── TC-164-01: Japanese/English language detection ───────────────────────

  describe('TC-164-01: Japanese and English language detection', () => {
    it('detects Japanese text as "ja"', async () => {
      const result = await detector.detect('これは日本語のテキストです。');

      expect(result.language).toBe('ja');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('detects English text as "en"', async () => {
      const result = await detector.detect(
        'This is an English text about database design and normalization.',
      );

      expect(result.language).toBe('en');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('detects mixed Japanese/English text as Japanese (has kana)', async () => {
      const result = await detector.detect(
        'JavaScriptのフレームワークについて説明します',
      );

      // Japanese takes priority when kana is present
      expect(result.language).toBe('ja');
    });

    it('detects Chinese text (CJK without kana) as "zh"', async () => {
      const result = await detector.detect('数据库设计中的规范化技术');

      expect(result.language).toBe('zh');
    });

    it('detects Spanish text with ñ as "es"', async () => {
      const result = await detector.detect('El niño está en la educación');

      expect(result.language).toBe('es');
    });

    it('detects German text with ß as "de"', async () => {
      const result = await detector.detect(
        'Die Straße ist groß und wichtig',
      );

      expect(result.language).toBe('de');
    });

    it('detects French text with ç as "fr"', async () => {
      const result = await detector.detect(
        'La français est très bien reçu',
      );

      expect(result.language).toBe('fr');
    });

    it('returns empty string as English', async () => {
      const result = await detector.detect('');

      // No characters → defaults to 'en'
      expect(result.language).toBe('en');
      // empty text correction applies length factor 0.3 × rawScore
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it('returns segments for mixed-language text', async () => {
      const result = await detector.detect('Hello こんにちは World');

      expect(result.segments).toBeDefined();
      expect(Array.isArray(result.segments)).toBe(true);
      expect(result.segments.length).toBeGreaterThan(0);
    });

    it('legacy detectLanguage function works for Japanese', () => {
      const result = detectLanguage('これはテストです');

      expect(result.language).toBe('ja');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('legacy detectLanguage function works for English', () => {
      const result = detectLanguage('This is a test');

      expect(result.language).toBe('en');
    });

    it('forceLanguage returns the specified language', () => {
      expect(forceLanguage('ja')).toBe('ja');
      expect(forceLanguage('en')).toBe('en');
      expect(forceLanguage('zh')).toBe('zh');
    });

    it('forceLanguage returns "auto" for auto', () => {
      expect(forceLanguage('auto')).toBe('auto');
    });
  });

  // ─── TC-164-02: Confidence scoring ────────────────────────────────────────

  describe('TC-164-02: confidence scoring', () => {
    it('confidence is in range [0.0, 1.0]', async () => {
      const cases = [
        'Short text',
        'これは短いテキストです',
        'A longer English sentence about database normalization and design patterns',
        'データベース設計における正規化技法について説明します。正規化はデータの冗長性を削減し、整合性を向上させます。',
      ];

      for (const text of cases) {
        const result = await detector.detect(text);
        expect(result.confidence).toBeGreaterThanOrEqual(0.0);
        expect(result.confidence).toBeLessThanOrEqual(1.0);
      }
    });

    it('longer text gives higher confidence for clear language', async () => {
      const short = await detector.detect('Yes');
      const long = await detector.detect(
        'This is a longer English text about database design, normalization, and the importance of structured data management in modern applications.',
      );

      // Longer text should generally have higher or equal confidence
      expect(long.confidence).toBeGreaterThanOrEqual(short.confidence);
    });

    it('pure Japanese text has high confidence', async () => {
      const result = await detector.detect(
        'データベース設計における正規化技法について説明します。正規化はデータの冗長性を削減し、整合性を向上させます。',
      );

      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('pure English text has reasonable confidence', async () => {
      const result = await detector.detect(
        'Database design involves normalization techniques that reduce redundancy.',
      );

      expect(result.confidence).toBeGreaterThan(0.3);
    });

    it('very short text has reduced confidence', async () => {
      const result = await detector.detect('Hi');

      // Short text should have length correction applied
      expect(result.confidence).toBeLessThan(1.0);
    });

    it('empty text returns minimum confidence', async () => {
      const result = await detector.detect('');

      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it('calculateConfidence returns values in [0, 1] range', () => {
      const cases = [
        { text: 'Hello world', language: 'en' },
        { text: 'こんにちは世界', language: 'ja' },
        { text: '数据库', language: 'zh' },
        { text: 'a', language: 'en' },
      ];

      for (const { text, language } of cases) {
        const confidence = detector.calculateConfidence(text, language);
        expect(confidence).toBeGreaterThanOrEqual(0.0);
        expect(confidence).toBeLessThanOrEqual(1.0);
      }
    });

    it('result includes character ratios', async () => {
      const result = await detector.detect('こんにちは Hello');

      expect(result.japaneseCharRatio).toBeGreaterThanOrEqual(0);
      expect(result.englishCharRatio).toBeGreaterThanOrEqual(0);
      expect(result.chineseCharRatio).toBeGreaterThanOrEqual(0);
      expect(result.spanishCharRatio).toBe(0);
      expect(result.frenchCharRatio).toBe(0);
      expect(result.germanCharRatio).toBe(0);
    });

    it('kuromoji is not ready before initialization', () => {
      expect(detector.isKuromojiReady()).toBe(false);
    });
  });
});
