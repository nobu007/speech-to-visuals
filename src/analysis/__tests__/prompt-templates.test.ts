/**
 * Tests for prompt-templates.ts
 *
 * Covers:
 * - getGeminiAnalyzerPrompt() with auto/en/ja/zh language selection
 * - getContentAnalyzerPrompt() with auto/en/ja/zh language selection
 * - Prompt content verification (contains expected instructions)
 * - Text truncation for long inputs (text.slice(0, 1000))
 * - Language detection integration including Phase 44 languages
 */

import { getGeminiAnalyzerPrompt, getContentAnalyzerPrompt, type PromptTemplate } from '../prompt-templates';
import { detectLanguage } from '../language-detector';

// Suppress console output
let consoleLogSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  consoleLogSpy.mockRestore();
});

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('prompt-templates', () => {
  // -------------------------------------------------------------------------
  // getGeminiAnalyzerPrompt
  // -------------------------------------------------------------------------
  describe('getGeminiAnalyzerPrompt', () => {
    it('should return Japanese prompt for Japanese text when language is auto', () => {
      const prompt = getGeminiAnalyzerPrompt('これは日本語のテストテキストです。', 'auto');
      expect(prompt).toContain('専門家');
      expect(prompt).toContain('関係性');
    });

    it('should return English prompt for English text when language is auto', () => {
      const prompt = getGeminiAnalyzerPrompt('This is an English test text.', 'auto');
      expect(prompt).toContain('expert');
      expect(prompt).toContain('extraction');
    });

    it('should return Japanese prompt when language is explicitly ja', () => {
      const prompt = getGeminiAnalyzerPrompt('English text but force Japanese prompt.', 'ja');
      expect(prompt).toContain('専門家');
    });

    it('should return English prompt when language is explicitly en', () => {
      const prompt = getGeminiAnalyzerPrompt('日本語テキストでも英語プロンプト', 'en');
      expect(prompt).toContain('expert');
    });

    it('should default to auto when no language specified', () => {
      const prompt = getGeminiAnalyzerPrompt('Hello world.');
      // English text with no language specified should detect as English
      expect(prompt).toContain('expert');
    });

    it('should include JSON format instructions in Japanese prompt', () => {
      const prompt = getGeminiAnalyzerPrompt('テスト', 'ja');
      expect(prompt).toContain('nodes');
      expect(prompt).toContain('edges');
      expect(prompt).toContain('JSON');
    });

    it('should include JSON format instructions in English prompt', () => {
      const prompt = getGeminiAnalyzerPrompt('Test', 'en');
      expect(prompt).toContain('nodes');
      expect(prompt).toContain('edges');
      expect(prompt).toContain('JSON');
    });

    it('should include the input text in the prompt', () => {
      const testText = 'This is a specific test input.';
      const prompt = getGeminiAnalyzerPrompt(testText, 'en');
      expect(prompt).toContain(testText);
    });

    it('should truncate long input text to 1000 characters', () => {
      const longText = 'A'.repeat(2000);
      const prompt = getGeminiAnalyzerPrompt(longText, 'en');
      // The prompt should contain the first 1000 characters of the text
      expect(prompt).toContain('A'.repeat(1000));
      expect(prompt).not.toContain('A'.repeat(1001));
    });

    it('should include diagram type options in Japanese prompt', () => {
      const prompt = getGeminiAnalyzerPrompt('テスト', 'ja');
      expect(prompt).toContain('flowchart');
      expect(prompt).toContain('mindmap');
      expect(prompt).toContain('timeline');
      expect(prompt).toContain('orgchart');
      expect(prompt).toContain('matrix');
      expect(prompt).toContain('cycle');
    });

    it('should include diagram type options in English prompt', () => {
      const prompt = getGeminiAnalyzerPrompt('test', 'en');
      expect(prompt).toContain('flowchart');
      expect(prompt).toContain('mindmap');
      expect(prompt).toContain('timeline');
    });

    it('should include relationship extraction examples in Japanese prompt', () => {
      const prompt = getGeminiAnalyzerPrompt('テスト', 'ja');
      expect(prompt).toContain('因果関係');
      expect(prompt).toContain('時系列');
    });

    it('should include relationship extraction examples in English prompt', () => {
      const prompt = getGeminiAnalyzerPrompt('test', 'en');
      expect(prompt).toContain('Causal');
      expect(prompt).toContain('Sequential');
    });
  });

  // -------------------------------------------------------------------------
  // Phase 44: Chinese prompt tests
  // -------------------------------------------------------------------------
  describe('Phase 44: Chinese prompt (getGeminiAnalyzerPrompt)', () => {
    it('should return Chinese prompt when language is explicitly zh', () => {
      const prompt = getGeminiAnalyzerPrompt('这是一个测试', 'zh');
      expect(prompt).toContain('结构化数据');
      expect(prompt).toContain('关系');
    });

    it('should return Chinese prompt for auto-detected Chinese text', () => {
      const prompt = getGeminiAnalyzerPrompt('这是一个人工智能技术发展的测试文本', 'auto');
      expect(prompt).toContain('结构化数据');
    });

    it('should include JSON format instructions in Chinese prompt', () => {
      const prompt = getGeminiAnalyzerPrompt('测试', 'zh');
      expect(prompt).toContain('nodes');
      expect(prompt).toContain('edges');
      expect(prompt).toContain('JSON');
    });

    it('should include diagram type options in Chinese prompt', () => {
      const prompt = getGeminiAnalyzerPrompt('测试', 'zh');
      expect(prompt).toContain('flowchart');
      expect(prompt).toContain('mindmap');
      expect(prompt).toContain('timeline');
    });

    it('should include relationship extraction examples in Chinese prompt', () => {
      const prompt = getGeminiAnalyzerPrompt('测试', 'zh');
      expect(prompt).toContain('因果关系');
    });
  });

  // -------------------------------------------------------------------------
  // Phase 44: Latin-script language prompt tests (es/fr/de use English base)
  // -------------------------------------------------------------------------
  describe('Phase 44: Latin-script language prompts', () => {
    it('should return English prompt for Spanish text (es uses English base)', () => {
      const prompt = getGeminiAnalyzerPrompt('El niño está aquí', 'es');
      expect(prompt).toContain('expert');
      expect(prompt).toContain('extraction');
    });

    it('should return English prompt for French text (fr uses English base)', () => {
      const prompt = getGeminiAnalyzerPrompt('Le français avec ça', 'fr');
      expect(prompt).toContain('expert');
    });

    it('should return English prompt for German text (de uses English base)', () => {
      const prompt = getGeminiAnalyzerPrompt('Die Straße ist groß', 'de');
      expect(prompt).toContain('expert');
    });

    it('should auto-detect Spanish and use English prompt', () => {
      const prompt = getGeminiAnalyzerPrompt('El niño pequeño corre rápidamente por la calle', 'auto');
      // Spanish is detected, but uses English prompt base
      expect(prompt).toContain('expert');
    });
  });

  // -------------------------------------------------------------------------
  // getContentAnalyzerPrompt
  // -------------------------------------------------------------------------
  describe('getContentAnalyzerPrompt', () => {
    it('should return Japanese prompt for Japanese text when language is auto', () => {
      const prompt = getContentAnalyzerPrompt('これは日本語のテキストです。', 'auto');
      expect(prompt).toContain('分析');
      expect(prompt).toContain('図解');
    });

    it('should return English prompt for English text when language is auto', () => {
      const prompt = getContentAnalyzerPrompt('This is English text.', 'auto');
      expect(prompt).toContain('Analyze');
      expect(prompt).toContain('diagram');
    });

    it('should return Japanese prompt when language is explicitly ja', () => {
      const prompt = getContentAnalyzerPrompt('Force Japanese.', 'ja');
      expect(prompt).toContain('分析');
    });

    it('should return English prompt when language is explicitly en', () => {
      const prompt = getContentAnalyzerPrompt('日本語テキスト.', 'en');
      expect(prompt).toContain('Analyze');
    });

    it('should default to auto when no language specified', () => {
      const prompt = getContentAnalyzerPrompt('Hello world.');
      expect(prompt).toContain('Analyze');
    });

    it('should include the input text in the prompt', () => {
      const testText = 'Specific test content.';
      const prompt = getContentAnalyzerPrompt(testText, 'en');
      expect(prompt).toContain(testText);
    });

    it('should include JSON format instructions in Japanese prompt', () => {
      const prompt = getContentAnalyzerPrompt('テスト', 'ja');
      expect(prompt).toContain('JSON');
      expect(prompt).toContain('nodes');
      expect(prompt).toContain('edges');
    });

    it('should include JSON format instructions in English prompt', () => {
      const prompt = getContentAnalyzerPrompt('test', 'en');
      expect(prompt).toContain('JSON');
      expect(prompt).toContain('nodes');
      expect(prompt).toContain('edges');
    });

    it('should include diagram type options in Japanese prompt', () => {
      const prompt = getContentAnalyzerPrompt('テスト', 'ja');
      expect(prompt).toContain('flowchart');
      expect(prompt).toContain('mindmap');
      expect(prompt).toContain('timeline');
    });

    it('should include diagram type options in English prompt', () => {
      const prompt = getContentAnalyzerPrompt('test', 'en');
      expect(prompt).toContain('flowchart');
      expect(prompt).toContain('mindmap');
    });

    it('should include relationship extraction instructions in Japanese prompt', () => {
      const prompt = getContentAnalyzerPrompt('テスト', 'ja');
      expect(prompt).toContain('関係性');
    });

    it('should include relationship extraction instructions in English prompt', () => {
      const prompt = getContentAnalyzerPrompt('test', 'en');
      expect(prompt).toContain('relationships');
    });
  });

  // -------------------------------------------------------------------------
  // Phase 44: Chinese content analyzer prompt
  // -------------------------------------------------------------------------
  describe('Phase 44: Chinese content analyzer prompt', () => {
    it('should return Chinese prompt when language is explicitly zh', () => {
      const prompt = getContentAnalyzerPrompt('这是一个测试', 'zh');
      expect(prompt).toContain('分析');
      expect(prompt).toContain('图表');
    });

    it('should include JSON format in Chinese prompt', () => {
      const prompt = getContentAnalyzerPrompt('测试', 'zh');
      expect(prompt).toContain('JSON');
      expect(prompt).toContain('nodes');
      expect(prompt).toContain('edges');
    });
  });

  // -------------------------------------------------------------------------
  // Language detection integration
  // -------------------------------------------------------------------------
  describe('language detection integration', () => {
    it('should auto-detect Japanese for text with Japanese characters', () => {
      const prompt = getGeminiAnalyzerPrompt('プロジェクトの進捗状況について報告します。', 'auto');
      // Should select Japanese prompt
      expect(prompt).toContain('専門家');
    });

    it('should auto-detect English for text with English characters', () => {
      const prompt = getGeminiAnalyzerPrompt('The quick brown fox jumps over the lazy dog.', 'auto');
      // Should select English prompt
      expect(prompt).toContain('expert');
    });

    it('should use Japanese prompt for mixed text with Japanese majority', () => {
      const prompt = getContentAnalyzerPrompt('日本語の文章が主体で English is mixed in.', 'auto');
      // With kana present, should select Japanese
      expect(prompt).toContain('分析');
    });

    it('should auto-detect Chinese for CJK-only text', () => {
      const prompt = getGeminiAnalyzerPrompt('人工智能技术发展推动了社会进步和产业变革', 'auto');
      expect(prompt).toContain('结构化数据');
    });

    it('should handle undefined language parameter', () => {
      const prompt = getGeminiAnalyzerPrompt('Test text.', undefined);
      expect(prompt).toBeDefined();
      expect(prompt.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------
  describe('edge cases', () => {
    it('should handle empty text input', () => {
      const prompt = getGeminiAnalyzerPrompt('', 'en');
      expect(prompt).toBeDefined();
      expect(prompt.length).toBeGreaterThan(0);
    });

    it('should handle very short text input', () => {
      const prompt = getContentAnalyzerPrompt('Hi', 'en');
      expect(prompt).toBeDefined();
      expect(prompt).toContain('Hi');
    });

    it('should handle text with special characters', () => {
      const specialText = 'Text with "quotes" and <brackets> and {braces}';
      const prompt = getGeminiAnalyzerPrompt(specialText, 'en');
      expect(prompt).toContain(specialText);
    });

    it('should handle text with unicode characters', () => {
      const unicodeText = 'Text with emoji 🎉 and symbols → ← ↑ ↓';
      const prompt = getContentAnalyzerPrompt(unicodeText, 'en');
      expect(prompt).toContain(unicodeText);
    });

    it('should handle text exactly at 1000 character boundary', () => {
      const text = 'A'.repeat(1000);
      const prompt = getGeminiAnalyzerPrompt(text, 'en');
      expect(prompt).toContain(text);
    });

    it('should handle text just over 1000 characters', () => {
      const text = 'A'.repeat(1001);
      const prompt = getGeminiAnalyzerPrompt(text, 'en');
      // Should only include first 1000 characters
      expect(prompt).toContain('A'.repeat(1000));
    });
  });
});
