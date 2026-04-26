/**
 * TASK-0017: PromptBuilder Tests
 *
 * Test case 5: Prompt construction
 * - Japanese language prompt generation
 * - English language prompt generation
 * - Flash model optimization (concise)
 * - Pro model optimization (detailed)
 */

import { PromptBuilder } from '../prompt-builder';

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('TASK-0017: PromptBuilder', () => {
  let builder: PromptBuilder;

  beforeEach(() => {
    builder = new PromptBuilder();
  });

  // -----------------------------------------------------------------------
  // Test case 5: Prompt construction (language and model optimization)
  // -----------------------------------------------------------------------
  describe('Test case 5: Prompt construction', () => {
    // --- Japanese prompt tests ---
    describe('Japanese language prompts', () => {
      it('should generate Japanese prompt for Japanese text with language="ja"', () => {
        const text = '田中さんがプロジェクトのリーダーです。';
        const prompt = builder.buildAnalysisPrompt(text, 'ja', 0.1);

        // Japanese prompt should contain Japanese instructions
        expect(prompt).toContain('構造化データ抽出');
        expect(prompt).toContain('ノード');
        expect(prompt).toContain('関係性');
        expect(prompt.length).toBeGreaterThan(100);
      });

      it('should include the input text in the prompt', () => {
        const text = 'これはテストテキストです。';
        const prompt = builder.buildAnalysisPrompt(text, 'ja', 0.1);

        expect(prompt).toContain(text);
      });

      it('should include JSON output format specification in Japanese prompt', () => {
        const text = 'テスト入力テキスト';
        const prompt = builder.buildAnalysisPrompt(text, 'ja', 0.1);

        // Japanese prompt specifies JSON format
        expect(prompt).toContain('JSON');
        expect(prompt).toContain('nodes');
        expect(prompt).toContain('edges');
      });

      it('should include diagram type options in Japanese prompt', () => {
        const text = 'テスト';
        const prompt = builder.buildAnalysisPrompt(text, 'ja', 0.1);

        expect(prompt).toContain('flowchart');
        expect(prompt).toContain('mindmap');
        expect(prompt).toContain('timeline');
      });
    });

    // --- English prompt tests ---
    describe('English language prompts', () => {
      it('should generate English prompt for English text with language="en"', () => {
        const text = 'The CEO manages the engineering department.';
        const prompt = builder.buildAnalysisPrompt(text, 'en', 0.1);

        // English prompt should contain English instructions
        expect(prompt).toContain('structured data extraction');
        expect(prompt).toContain('nodes');
        expect(prompt).toContain('relationships');
        expect(prompt.length).toBeGreaterThan(100);
      });

      it('should include the input text in the English prompt', () => {
        const text = 'This is a test text for analysis.';
        const prompt = builder.buildAnalysisPrompt(text, 'en', 0.1);

        expect(prompt).toContain(text);
      });

      it('should include JSON output format in English prompt', () => {
        const text = 'Test input text';
        const prompt = builder.buildAnalysisPrompt(text, 'en', 0.1);

        expect(prompt).toContain('JSON');
        expect(prompt).toContain('nodes');
        expect(prompt).toContain('edges');
      });

      it('should include diagram type selection guide in English prompt', () => {
        const text = 'Some text';
        const prompt = builder.buildAnalysisPrompt(text, 'en', 0.1);

        expect(prompt).toContain('flowchart');
        expect(prompt).toContain('mindmap');
        expect(prompt).toContain('timeline');
      });
    });

    // --- Auto-detection tests ---
    describe('Auto language detection', () => {
      it('should auto-detect Japanese and use Japanese prompt with language="auto"', () => {
        const text = '田中さんがプロジェクトを管理しています。';
        const prompt = builder.buildAnalysisPrompt(text, 'auto', 0.1);

        // Should detect Japanese and use Japanese prompt
        expect(prompt).toContain('構造化データ抽出');
      });

      it('should auto-detect English and use English prompt with language="auto"', () => {
        const text = 'The manager oversees the project development lifecycle.';
        const prompt = builder.buildAnalysisPrompt(text, 'auto', 0.1);

        // Should detect English and use English prompt
        expect(prompt).toContain('structured data extraction');
      });
    });

    // --- Model optimization tests ---
    describe('Model optimization (Flash/Pro)', () => {
      it('should add Flash optimization suffix for low complexity (0.1)', () => {
        const text = 'Simple test text.';
        const prompt = builder.buildAnalysisPrompt(text, 'en', 0.1);

        expect(prompt).toContain('Flash optimization');
        expect(prompt).toContain('concise');
      });

      it('should add Pro optimization suffix for high complexity (0.5)', () => {
        const text = 'Complex test text with multiple entities and relationships.';
        const prompt = builder.buildAnalysisPrompt(text, 'en', 0.5);

        expect(prompt).toContain('Pro optimization');
        expect(prompt).toContain('thorough');
      });

      it('should use Flash optimization for complexity exactly at boundary (0.19)', () => {
        const text = 'Test.';
        const prompt = builder.buildAnalysisPrompt(text, 'en', 0.19);

        expect(prompt).toContain('Flash optimization');
      });

      it('should use Pro optimization for complexity at threshold (0.2)', () => {
        const text = 'Test.';
        const prompt = builder.buildAnalysisPrompt(text, 'en', 0.2);

        expect(prompt).toContain('Pro optimization');
      });

      it('should use Flash optimization for complexity 0.0', () => {
        const text = 'Test.';
        const prompt = builder.buildAnalysisPrompt(text, 'en', 0.0);

        expect(prompt).toContain('Flash optimization');
      });

      it('should use Pro optimization for complexity 1.0', () => {
        const text = 'Test.';
        const prompt = builder.buildAnalysisPrompt(text, 'en', 1.0);

        expect(prompt).toContain('Pro optimization');
      });
    });

    // --- Combined tests ---
    describe('Combined language and model optimization', () => {
      it('should produce Japanese + Flash prompt for ja language + low complexity', () => {
        const text = 'テストテキスト';
        const prompt = builder.buildAnalysisPrompt(text, 'ja', 0.1);

        expect(prompt).toContain('構造化データ抽出');
        expect(prompt).toContain('Flash optimization');
      });

      it('should produce English + Pro prompt for en language + high complexity', () => {
        const text = 'Test text for analysis.';
        const prompt = builder.buildAnalysisPrompt(text, 'en', 0.8);

        expect(prompt).toContain('structured data extraction');
        expect(prompt).toContain('Pro optimization');
      });

      it('should produce Japanese + Pro prompt for ja language + high complexity', () => {
        const text = '複雑なテストテキスト';
        const prompt = builder.buildAnalysisPrompt(text, 'ja', 0.6);

        expect(prompt).toContain('構造化データ抽出');
        expect(prompt).toContain('Pro optimization');
      });
    });

    // --- Default parameters ---
    describe('Default parameters', () => {
      it('should work with only text parameter (defaults: auto language, 0 complexity)', () => {
        const text = 'Hello world';
        const prompt = builder.buildAnalysisPrompt(text);

        expect(prompt).toContain(text);
        expect(prompt).toContain('Flash optimization'); // default complexity 0.0 -> Flash
      });

      it('should produce non-empty prompt for any input', () => {
        const prompt = builder.buildAnalysisPrompt('x', 'en', 0.0);
        expect(prompt.length).toBeGreaterThan(50);
      });
    });
  });
});
