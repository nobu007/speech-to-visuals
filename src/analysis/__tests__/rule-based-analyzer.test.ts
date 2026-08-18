/**
 * Tests for TASK-0022: Rule-Based V1 Fallback Analyzer
 */

import {
  splitSentences,
  createNodesFromSentences,
  generateSequentialDiagram,
  isDisabledGemini,
  RuleBasedAnalyzer,
  type SceneSegment,
} from '../rule-based-analyzer';
import { logger } from '@stv/core/utils/logger';

describe('RuleBasedAnalyzer', () => {
  // === Test Case 1: Always returns a result ===

  describe('analyze - always returns result', () => {
    const analyzer = new RuleBasedAnalyzer();

    it('should return result for empty string', () => {
      const result = analyzer.analyze('');
      expect(result).toBeDefined();
      expect(result.diagramType).toBe('flow');
      expect(result.entities).toEqual([]);
      expect(result.relations).toEqual([]);
    });

    it('should return result for single character', () => {
      const result = analyzer.analyze('a');
      expect(result).toBeDefined();
      expect(result.diagramType).toBe('flow');
    });

    it('should return result for long text', () => {
      const longText = 'これは長いテキストです。'.repeat(100);
      const result = analyzer.analyze(longText);
      expect(result).toBeDefined();
      expect(result.entities.length).toBeGreaterThan(0);
    });

    it('should return result for special characters', () => {
      const result = analyzer.analyze('!@#$%^&*()');
      expect(result).toBeDefined();
      expect(result.diagramType).toBe('flow');
    });
  });

  // === Test Case 2: Sequential Diagram Generation ===

  describe('analyze - sequential diagram', () => {
    const analyzer = new RuleBasedAnalyzer();

    it('should generate flow diagram with entities and relations', () => {
      const result = analyzer.analyze('手順1です。手順2です。手順3です。');

      expect(result.diagramType).toBe('flow');
      expect(result.entities).toHaveLength(3);
      expect(result.relations).toHaveLength(2);

      // Check relations: node-0→node-1, node-1→node-2
      expect(result.relations[0].from).toBe('node-0');
      expect(result.relations[0].to).toBe('node-1');
      expect(result.relations[1].from).toBe('node-1');
      expect(result.relations[1].to).toBe('node-2');
    });

    it('should set confidence to 0.5', () => {
      const result = analyzer.analyze('テスト文です。');
      expect(result.confidence).toBe(0.5);
    });

    it('should set summary to first entity label', () => {
      const result = analyzer.analyze('最初の文です。次の文です。');
      expect(result.summary).toBe(result.entities[0].label);
    });
  });

  // === Test Case 3 & 4: DISABLE_GEMINI ===

  describe('isDisabledGemini', () => {
    const originalEnv = process.env.ANALYSIS_DISABLE_GEMINI;

    afterEach(() => {
      if (originalEnv !== undefined) {
        process.env.ANALYSIS_DISABLE_GEMINI = originalEnv;
      } else {
        delete process.env.ANALYSIS_DISABLE_GEMINI;
      }
    });

    it('should return true when ANALYSIS_DISABLE_GEMINI=1', () => {
      process.env.ANALYSIS_DISABLE_GEMINI = '1';
      expect(isDisabledGemini()).toBe(true);
    });

    it('should return false when ANALYSIS_DISABLE_GEMINI is not set', () => {
      delete process.env.ANALYSIS_DISABLE_GEMINI;
      expect(isDisabledGemini()).toBe(false);
    });

    it('should return false when ANALYSIS_DISABLE_GEMINI=0', () => {
      process.env.ANALYSIS_DISABLE_GEMINI = '0';
      expect(isDisabledGemini()).toBe(false);
    });

    it('should call logger.warn when process.env access throws', () => {
      const warnSpy = jest.spyOn(logger, 'warn').mockImplementation();

      // Make process.env getter throw
      const descriptor = Object.getOwnPropertyDescriptor(process, 'env');
      Object.defineProperty(process, 'env', {
        get() { throw new Error('env access denied'); },
        configurable: true,
      });

      try {
        const result = isDisabledGemini();
        expect(result).toBe(false);
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy.mock.calls[0][0]).toContain('isDisabledGemini');
      } finally {
        // Restore original process.env
        if (descriptor) {
          Object.defineProperty(process, 'env', descriptor);
        }
      }

      warnSpy.mockRestore();
    });

    it('should not call logger.warn on normal access', () => {
      const warnSpy = jest.spyOn(logger, 'warn').mockImplementation();
      process.env.ANALYSIS_DISABLE_GEMINI = '0';

      const result = isDisabledGemini();
      expect(result).toBe(false);
      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
    });
  });

  // === Test Case 5: Sentence Splitting ===

  describe('splitSentences', () => {
    it('should split on Japanese periods', () => {
      const result = splitSentences('最初の文です。次の文です。最後の文です。');
      expect(result).toEqual(['最初の文です', '次の文です', '最後の文です']);
    });

    it('should split on English periods with space', () => {
      const result = splitSentences('First sentence. Second sentence. Third sentence.');
      expect(result).toEqual(['First sentence', 'Second sentence', 'Third sentence']);
    });

    it('should filter out sentences shorter than 3 characters', () => {
      const result = splitSentences('短。これは十分な長さの文です。');
      expect(result).toEqual(['これは十分な長さの文です']);
    });

    it('should split on newlines', () => {
      const result = splitSentences('行1の内容\n行2の内容\n行3の内容');
      expect(result).toEqual(['行1の内容', '行2の内容', '行3の内容']);
    });

    it('should return empty array for empty string', () => {
      expect(splitSentences('')).toEqual([]);
    });
  });

  // === Test Case 6: Segment Array Input ===

  describe('analyze - segment array input', () => {
    const analyzer = new RuleBasedAnalyzer();

    it('should combine segment texts and generate diagram', () => {
      const segments: SceneSegment[] = [
        { text: 'セグメント1の内容', startMs: 0, endMs: 5000 },
        { text: 'セグメント2の内容', startMs: 5000, endMs: 10000 },
        { text: 'セグメント3の内容', startMs: 10000, endMs: 15000 },
      ];

      const result = analyzer.analyze(segments);

      expect(result.diagramType).toBe('flow');
      expect(result.entities.length).toBeGreaterThan(0);
    });
  });

  // === Node Label Truncation ===

  describe('createNodesFromSentences', () => {
    it('should truncate labels longer than 20 characters', () => {
      const longSentence = 'この文は二十文字を確実に超える非常に長い文のテストケースです';
      const nodes = createNodesFromSentences([longSentence]);

      expect(nodes[0].label.length).toBeLessThanOrEqual(23); // 20 + '...'
      expect(nodes[0].label).toContain('...');
    });

    it('should not truncate short labels', () => {
      const shortSentence = '短い文';
      const nodes = createNodesFromSentences([shortSentence]);

      expect(nodes[0].label).toBe('短い文');
      expect(nodes[0].label).not.toContain('...');
    });

    it('should assign sequential node IDs', () => {
      const sentences = ['文1です', '文2です', '文3です'];
      const nodes = createNodesFromSentences(sentences);

      expect(nodes[0].id).toBe('node-0');
      expect(nodes[1].id).toBe('node-1');
      expect(nodes[2].id).toBe('node-2');
    });
  });
});
