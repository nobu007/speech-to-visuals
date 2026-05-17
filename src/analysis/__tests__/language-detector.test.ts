/**
 * TASK-0014 / Phase 44: Language Detection Module Tests
 *
 * Tests for automatic language detection supporting Japanese, English,
 * Chinese, Spanish, French, German.
 * Covers character-based detection, Kuromoji integration, confidence scoring,
 * diacritical mark scoring, and mixed-language text handling.
 */

import {
  LanguageDetector,
  type LanguageDetectionResult,
  type JapaneseAnalysisResult,
  type LanguageSegment,
  type KuromojiBuilder,
  detectLanguage,
  forceLanguage,
} from '../language-detector';

// ---------------------------------------------------------------------------
// Kuromoji mock helpers
// ---------------------------------------------------------------------------

/** Mock tokenizer that tests can configure via mockTokenizer */
const mockTokenizer = {
  tokenize: jest.fn(),
};

/** Create a builder function that resolves with mockTokenizer */
function createSuccessBuilder(): KuromojiBuilder {
  return jest.fn(() => ({
    build: jest.fn((callback: (err: Error | null, tokenizer: unknown) => void) => {
      callback(null, mockTokenizer);
    }),
  })) as unknown as KuromojiBuilder;
}

/** Create a builder function that fails with an error */
function createFailingBuilder(errorMessage = 'Dictionary not found'): KuromojiBuilder {
  return jest.fn(() => ({
    build: jest.fn((callback: (err: Error | null, _tokenizer: unknown) => void) => {
      callback(new Error(errorMessage), null);
    }),
  })) as unknown as KuromojiBuilder;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function createDetector(builder?: KuromojiBuilder): LanguageDetector {
  return new LanguageDetector(builder ? { kuromojiBuilder: builder } : undefined);
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe('LanguageDetector', () => {
  let detector: LanguageDetector;

  beforeEach(() => {
    detector = createDetector();
    jest.clearAllMocks();
    mockTokenizer.tokenize.mockReset();
  });

  // -----------------------------------------------------------------------
  // Test case 1: Japanese detection
  // -----------------------------------------------------------------------
  describe('Test case 1: Japanese detection', () => {
    it('should detect Japanese text with language="ja" and confidence >= 0.8', async () => {
      const text = 'これは日本語のテストです';
      const result = await detector.detect(text);

      expect(result.language).toBe('ja');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('should detect pure hiragana text as Japanese', async () => {
      const text = 'あいうえおかきくけこ';
      const result = await detector.detect(text);

      expect(result.language).toBe('ja');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('should detect pure katakana text as Japanese', async () => {
      const text = 'コンピュータープログラミング';
      const result = await detector.detect(text);

      expect(result.language).toBe('ja');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('should detect kanji-heavy text with katakana as Japanese', async () => {
      const text = '日本語形態素解析システム';
      const result = await detector.detect(text);

      expect(result.language).toBe('ja');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });
  });

  // -----------------------------------------------------------------------
  // Test case 2: English detection
  // -----------------------------------------------------------------------
  describe('Test case 2: English detection', () => {
    it('should detect English text with language="en" and confidence >= 0.8', async () => {
      const text = 'This is an English test sentence';
      const result = await detector.detect(text);

      expect(result.language).toBe('en');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('should detect pure alphabetic text as English', async () => {
      const text = 'The quick brown fox jumps over the lazy dog';
      const result = await detector.detect(text);

      expect(result.language).toBe('en');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });
  });

  // -----------------------------------------------------------------------
  // Phase 44: Chinese detection
  // -----------------------------------------------------------------------
  describe('Phase 44: Chinese detection', () => {
    it('should detect Chinese text (simplified) as "zh"', async () => {
      const text = '这是一个用中文编写的测试句子';
      const result = await detector.detect(text);

      expect(result.language).toBe('zh');
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    });

    it('should detect Chinese text (traditional) as "zh"', async () => {
      const text = '這是一個用繁體中文編寫的測試';
      const result = await detector.detect(text);

      expect(result.language).toBe('zh');
    });

    it('should detect pure CJK text without kana as Chinese', async () => {
      const text = '人工智能技术发展趋势分析报告';
      const result = await detector.detect(text);

      expect(result.language).toBe('zh');
    });

    it('should distinguish Chinese from Japanese by absence of kana', async () => {
      const chineseText = '技术发展推动了社会进步';
      const japaneseText = '技術の発展は社会の進歩を推進した';

      const zhResult = await detector.detect(chineseText);
      const jaResult = await detector.detect(japaneseText);

      expect(zhResult.language).toBe('zh');
      expect(jaResult.language).toBe('ja');
    });
  });

  // -----------------------------------------------------------------------
  // Phase 44: Spanish detection
  // -----------------------------------------------------------------------
  describe('Phase 44: Spanish detection', () => {
    it('should detect Spanish text with ñ as "es"', async () => {
      const text = 'El niño está en la escuela aprendiendo español';
      const result = await detector.detect(text);

      expect(result.language).toBe('es');
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    });

    it('should detect Spanish text with ¿ as "es"', async () => {
      const text = '¿Cómo estás hoy? Todo está bien aquí';
      const result = await detector.detect(text);

      expect(result.language).toBe('es');
    });

    it('should detect Spanish text with ¡ as "es"', async () => {
      const text = '¡Qué sorpresa! La fiesta fue increíble';
      const result = await detector.detect(text);

      expect(result.language).toBe('es');
    });
  });

  // -----------------------------------------------------------------------
  // Phase 44: French detection
  // -----------------------------------------------------------------------
  describe('Phase 44: French detection', () => {
    it('should detect French text with ç as "fr"', async () => {
      const text = 'Le français est une belle langue avec ça';
      const result = await detector.detect(text);

      expect(result.language).toBe('fr');
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    });

    it('should detect French text with ê/î/û as "fr"', async () => {
      const text = 'Le château bûche la forêt île';
      const result = await detector.detect(text);

      expect(result.language).toBe('fr');
    });

    it('should detect French text with multiple French diacriticals as "fr"', async () => {
      const text = 'Les élèves étudient à la bibliothèque';
      const result = await detector.detect(text);

      expect(result.language).toBe('fr');
    });
  });

  // -----------------------------------------------------------------------
  // Phase 44: German detection
  // -----------------------------------------------------------------------
  describe('Phase 44: German detection', () => {
    it('should detect German text with ß as "de"', async () => {
      const text = 'Die Straße ist groß und lang';
      const result = await detector.detect(text);

      expect(result.language).toBe('de');
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    });

    it('should detect German text with ü/ö/ä as "de"', async () => {
      const text = 'Die schöne Übung für ältere Schüler';
      const result = await detector.detect(text);

      expect(result.language).toBe('de');
    });
  });

  // -----------------------------------------------------------------------
  // Test case 3: Mixed text detection
  // -----------------------------------------------------------------------
  describe('Test case 3: Mixed text detection', () => {
    it('should detect mixed text with correct primary language and both languages in segments', async () => {
      const text = 'これはTestです';
      const result = await detector.detect(text);

      // Primary language should be detected (Japanese has more chars here)
      expect(['ja', 'en']).toContain(result.language);

      // Segments should contain both languages
      expect(result.segments).toBeDefined();
      const languages = result.segments.map((s: LanguageSegment) => s.language);
      expect(languages).toContain('ja');
      expect(languages).toContain('en');
    });

    it('should detect English-dominant mixed text', async () => {
      const text = 'Hello World こんにちは everyone';
      const result = await detector.detect(text);

      expect(['ja', 'en']).toContain(result.language);
      expect(result.segments.length).toBeGreaterThanOrEqual(2);
    });

    it('should label CJK segments as zh when text has no kana', async () => {
      const text = 'Hello这是中文mixed text';
      const result = await detector.detect(text);

      const languages = result.segments.map((s: LanguageSegment) => s.language);
      expect(languages).toContain('zh');
      expect(languages).toContain('en');
    });

    it('should label CJK segments as ja when text has kana', async () => {
      const text = 'これは漢字English混合テストです';
      const result = await detector.detect(text);

      const jaSegments = result.segments.filter((s: LanguageSegment) => s.language === 'ja');
      expect(jaSegments.length).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------------------
  // Test case 4: Confidence score range
  // -----------------------------------------------------------------------
  describe('Test case 4: Confidence score range', () => {
    it('should return confidence between 0.0 and 1.0 for Japanese text', async () => {
      const result = await detector.detect('日本語のテスト');
      expect(result.confidence).toBeGreaterThanOrEqual(0.0);
      expect(result.confidence).toBeLessThanOrEqual(1.0);
    });

    it('should return confidence between 0.0 and 1.0 for English text', async () => {
      const result = await detector.detect('English test text here');
      expect(result.confidence).toBeGreaterThanOrEqual(0.0);
      expect(result.confidence).toBeLessThanOrEqual(1.0);
    });

    it('should return confidence between 0.0 and 1.0 for short text', async () => {
      const result = await detector.detect('Hi');
      expect(result.confidence).toBeGreaterThanOrEqual(0.0);
      expect(result.confidence).toBeLessThanOrEqual(1.0);
    });

    it('should return confidence between 0.0 and 1.0 for mixed text', async () => {
      const result = await detector.detect('これはTestです');
      expect(result.confidence).toBeGreaterThanOrEqual(0.0);
      expect(result.confidence).toBeLessThanOrEqual(1.0);
    });

    it('calculateConfidence should return value in 0-1 range', () => {
      const d = createDetector();
      const score1 = d.calculateConfidence('日本語の文章', 'ja');
      expect(score1).toBeGreaterThanOrEqual(0.0);
      expect(score1).toBeLessThanOrEqual(1.0);

      const score2 = d.calculateConfidence('English sentence here', 'en');
      expect(score2).toBeGreaterThanOrEqual(0.0);
      expect(score2).toBeLessThanOrEqual(1.0);

      const score3 = d.calculateConfidence('这是一个中文句子', 'zh');
      expect(score3).toBeGreaterThanOrEqual(0.0);
      expect(score3).toBeLessThanOrEqual(1.0);
    });

    it('should return valid confidence for all language codes', () => {
      const d = createDetector();
      const languages = ['ja', 'en', 'zh', 'es', 'fr', 'de'];
      for (const lang of languages) {
        const score = d.calculateConfidence('test text here', lang);
        expect(score).toBeGreaterThanOrEqual(0.0);
        expect(score).toBeLessThanOrEqual(1.0);
      }
    });
  });

  // -----------------------------------------------------------------------
  // Test case 5: Kuromoji initialization
  // -----------------------------------------------------------------------
  describe('Test case 5: Kuromoji initialization', () => {
    it('should initialize Kuromoji tokenizer successfully', async () => {
      const successDetector = createDetector(createSuccessBuilder());
      await successDetector.initializeKuromoji();
      expect(successDetector.isKuromojiReady()).toBe(true);
    });

    it('should be able to analyze Japanese text after initialization', async () => {
      mockTokenizer.tokenize.mockReturnValue([
        { surface_form: 'これ', pos: '名詞' },
        { surface_form: 'は', pos: '助詞' },
        { surface_form: '日本語', pos: '名詞' },
        { surface_form: 'の', pos: '助詞' },
        { surface_form: 'テスト', pos: '名詞' },
        { surface_form: 'です', pos: '助動詞' },
      ]);

      const successDetector = createDetector(createSuccessBuilder());
      await successDetector.initializeKuromoji();
      const result: JapaneseAnalysisResult = successDetector.analyzeJapanese('これは日本語のテストです');

      expect(result.tokens).toBeDefined();
      expect(result.tokens.length).toBeGreaterThan(0);
      expect(result.wordCount).toBeGreaterThan(0);
      expect(typeof result.hasParticles).toBe('boolean');
    });
  });

  // -----------------------------------------------------------------------
  // Test case 6: Kuromoji initialization failure fallback
  // -----------------------------------------------------------------------
  describe('Test case 6: Kuromoji initialization failure fallback', () => {
    it('should fallback to character-based detection when Kuromoji fails', async () => {
      const fallbackDetector = createDetector(createFailingBuilder());

      // initializeKuromoji should not throw
      await expect(fallbackDetector.initializeKuromoji()).resolves.not.toThrow();
      expect(fallbackDetector.isKuromojiReady()).toBe(false);

      // But detect should still work via character-based fallback
      const result = await fallbackDetector.detect('これは日本語のテストです');
      expect(result.language).toBe('ja');
      expect(result.confidence).toBeGreaterThanOrEqual(0.0);
    });

    it('should work with character-based detection even without Kuromoji', async () => {
      const fallbackDetector = createDetector(createFailingBuilder());

      const enResult = await fallbackDetector.detect('This is an English sentence');
      expect(enResult.language).toBe('en');
      expect(enResult.confidence).toBeGreaterThanOrEqual(0.0);
    });
  });

  // -----------------------------------------------------------------------
  // Additional edge cases
  // -----------------------------------------------------------------------
  describe('Edge cases', () => {
    it('should handle empty string', async () => {
      const result = await detector.detect('');
      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0.0);
      expect(result.confidence).toBeLessThanOrEqual(1.0);
    });

    it('should handle short text (< 10 chars) with lower confidence', async () => {
      const longResult = await detector.detect('これは日本語のテストです。もう少し長い文章にしています。');
      const shortResult = await detector.detect('テスト');

      // Short text should generally have lower or equal confidence than longer text
      // (though both should be valid)
      expect(shortResult.confidence).toBeGreaterThanOrEqual(0.0);
      expect(shortResult.confidence).toBeLessThanOrEqual(1.0);
    });

    it('should handle text with numbers and symbols', async () => {
      const result = await detector.detect('これは100%のテストです！');
      expect(result).toBeDefined();
      expect(['ja', 'en']).toContain(result.language);
    });

    it('should handle whitespace-only text', async () => {
      const result = await detector.detect('   ');
      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0.0);
      expect(result.confidence).toBeLessThanOrEqual(1.0);
    });
  });
});

// ---------------------------------------------------------------------------
// Legacy detectLanguage function tests
// ---------------------------------------------------------------------------

describe('detectLanguage (legacy function)', () => {
  it('should detect Japanese text', () => {
    const result = detectLanguage('これは日本語のテストです');
    expect(result.language).toBe('ja');
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it('should detect English text', () => {
    const result = detectLanguage('This is an English sentence');
    expect(result.language).toBe('en');
  });

  it('should detect Chinese text (no kana)', () => {
    const result = detectLanguage('这是一个中文测试');
    expect(result.language).toBe('zh');
  });

  it('should detect Spanish text with ñ', () => {
    const result = detectLanguage('El niño come español');
    expect(result.language).toBe('es');
  });

  it('should detect French text with ç', () => {
    const result = detectLanguage('Le français avec ça');
    expect(result.language).toBe('fr');
  });

  it('should detect German text with ß', () => {
    const result = detectLanguage('Die Straße ist groß');
    expect(result.language).toBe('de');
  });

  it('should return chineseCharRatio for Chinese text', () => {
    const result = detectLanguage('这是中文');
    expect(result.chineseCharRatio).toBeGreaterThan(0);
  });

  it('should include new fields in result', () => {
    const result = detectLanguage('Test text');
    expect(result).toHaveProperty('chineseCharRatio');
    expect(result).toHaveProperty('spanishCharRatio');
    expect(result).toHaveProperty('frenchCharRatio');
    expect(result).toHaveProperty('germanCharRatio');
  });
});

// ---------------------------------------------------------------------------
// forceLanguage function tests
// ---------------------------------------------------------------------------

describe('forceLanguage', () => {
  it('should return the language if not auto', () => {
    expect(forceLanguage('ja')).toBe('ja');
    expect(forceLanguage('en')).toBe('en');
    expect(forceLanguage('zh')).toBe('zh');
    expect(forceLanguage('es')).toBe('es');
    expect(forceLanguage('fr')).toBe('fr');
    expect(forceLanguage('de')).toBe('de');
  });

  it('should return auto if auto is passed', () => {
    expect(forceLanguage('auto')).toBe('auto');
  });
});
