/**
 * TASK-0016: Complexity Detection Module Tests
 *
 * Tests for content complexity detection that scores text on a 0-1 scale
 * and selects optimal LLM model (Flash for simple, Pro for complex).
 *
 * Test cases:
 * 1. Simple text score calculation
 * 2. Complex text score calculation
 * 3. Model selection logic (20% threshold)
 * 4. Complexity factor identification
 * 5. Environment variable model override
 * 6. Score range validation
 */

import {
  ComplexityDetector,
  type ComplexityAnalysis,
  type ComplexityFactor,
} from '../complexity-detector';
import { logger } from '@stv/core/utils/logger';

describe('TASK-0016: ComplexityDetector', () => {
  let detector: ComplexityDetector;

  beforeEach(() => {
    detector = new ComplexityDetector();
    // Clear environment variables before each test
    delete process.env.DISABLE_GEMINI;
    delete process.env.GEMINI_MODEL_OVERRIDE;
    delete process.env.COMPLEXITY_THRESHOLD;
  });

  afterEach(() => {
    // Clean up environment variables after each test
    delete process.env.DISABLE_GEMINI;
    delete process.env.GEMINI_MODEL_OVERRIDE;
    delete process.env.COMPLEXITY_THRESHOLD;
  });

  // -----------------------------------------------------------------------
  // Test case 1: Simple text score calculation
  // -----------------------------------------------------------------------
  describe('Test case 1: Simple text score calculation', () => {
    it('should return score < 0.2 for simple text "これは猫です。"', () => {
      const text = 'これは猫です。';
      const result: ComplexityAnalysis = detector.analyze(text);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThan(0.2);
    });

    it('should classify simple text as "simple" level', () => {
      const text = 'これは猫です。';
      const result: ComplexityAnalysis = detector.analyze(text);

      expect(result.level).toBe('simple');
    });

    it('should recommend flash model for simple text', () => {
      const text = 'これは猫です。';
      const result: ComplexityAnalysis = detector.analyze(text);

      expect(result.recommendedModel).toBe('gemini-2.5-flash');
    });
  });

  // -----------------------------------------------------------------------
  // Test case 2: Complex text score calculation
  // -----------------------------------------------------------------------
  describe('Test case 2: Complex text score calculation', () => {
    it('should return score >= 0.2 for complex technical text', () => {
      const text =
        '非同期プログラミングにおけるPromiseチェーンの例外伝播メカニズムは、マイクロタスクキューを介したイベントループの動作と密接に関連している';
      const result: ComplexityAnalysis = detector.analyze(text);

      expect(result.score).toBeGreaterThanOrEqual(0.2);
    });

    it('should classify complex text as "complex" level', () => {
      const text =
        '非同期プログラミングにおけるPromiseチェーンの例外伝播メカニズムは、マイクロタスクキューを介したイベントループの動作と密接に関連している';
      const result: ComplexityAnalysis = detector.analyze(text);

      expect(result.level).toBe('complex');
    });

    it('should recommend pro model for complex text', () => {
      const text =
        '非同期プログラミングにおけるPromiseチェーンの例外伝播メカニズムは、マイクロタスクキューを介したイベントループの動作と密接に関連している';
      const result: ComplexityAnalysis = detector.analyze(text);

      expect(result.recommendedModel).toBe('gemini-2.5-pro');
    });
  });

  // -----------------------------------------------------------------------
  // Test case 3: Model selection logic (20% threshold)
  // -----------------------------------------------------------------------
  describe('Test case 3: Model selection logic (20% threshold)', () => {
    it('should select flash for score 0.0', () => {
      expect(detector.selectModel(0.0)).toBe('gemini-2.5-flash');
    });

    it('should select flash for score 0.1', () => {
      expect(detector.selectModel(0.1)).toBe('gemini-2.5-flash');
    });

    it('should select flash for score 0.19', () => {
      expect(detector.selectModel(0.19)).toBe('gemini-2.5-flash');
    });

    it('should select pro for score 0.2', () => {
      expect(detector.selectModel(0.2)).toBe('gemini-2.5-pro');
    });

    it('should select pro for score 0.5', () => {
      expect(detector.selectModel(0.5)).toBe('gemini-2.5-pro');
    });

    it('should select pro for score 1.0', () => {
      expect(detector.selectModel(1.0)).toBe('gemini-2.5-pro');
    });

    it('should use threshold boundary correctly (< 0.2 = flash)', () => {
      expect(detector.selectModel(0.199)).toBe('gemini-2.5-flash');
    });

    it('should use threshold boundary correctly (>= 0.2 = pro)', () => {
      expect(detector.selectModel(0.2)).toBe('gemini-2.5-pro');
    });
  });

  // -----------------------------------------------------------------------
  // Test case 4: Complexity factor identification
  // -----------------------------------------------------------------------
  describe('Test case 4: Complexity factor identification', () => {
    it('should identify data_content factor for text with numerical data', () => {
      const text = '売上は前年比120%で、3四半期連続の増加です';
      const factors: ComplexityFactor[] = detector.identifyComplexityFactors(text);

      const dataFactor = factors.find((f) => f.type === 'data_content');
      expect(dataFactor).toBeDefined();
      expect(dataFactor!.contribution).toBeGreaterThan(0);
    });

    it('should return factors with correct structure', () => {
      const text = '売上は前年比120%で、3四半期連続の増加です';
      const factors: ComplexityFactor[] = detector.identifyComplexityFactors(text);

      expect(Array.isArray(factors)).toBe(true);
      expect(factors.length).toBeGreaterThan(0);

      for (const factor of factors) {
        expect(factor).toHaveProperty('type');
        expect(factor).toHaveProperty('weight');
        expect(factor).toHaveProperty('contribution');
        expect(factor).toHaveProperty('description');
        expect(typeof factor.type).toBe('string');
        expect(typeof factor.weight).toBe('number');
        expect(typeof factor.contribution).toBe('number');
        expect(typeof factor.description).toBe('string');
        expect(factor.weight).toBeGreaterThanOrEqual(0);
        expect(factor.weight).toBeLessThanOrEqual(1);
        expect(factor.contribution).toBeGreaterThanOrEqual(0);
        expect(factor.contribution).toBeLessThanOrEqual(1);
      }
    });

    it('should identify correct factor types', () => {
      const text = '売上は前年比120%で、3四半期連続の増加です';
      const factors: ComplexityFactor[] = detector.identifyComplexityFactors(text);

      const validTypes = [
        'text_length',
        'sentence_complexity',
        'technical_density',
        'data_content',
        'abstractness',
      ];
      for (const factor of factors) {
        expect(validTypes).toContain(factor.type);
      }
    });

    it('should have correct weights for each factor type', () => {
      const text = 'テストテキストです';
      const factors: ComplexityFactor[] = detector.identifyComplexityFactors(text);

      const weightMap: Record<string, number> = {
        text_length: 0.15,
        sentence_complexity: 0.25,
        technical_density: 0.30,
        data_content: 0.15,
        abstractness: 0.15,
      };

      for (const factor of factors) {
        expect(factor.weight).toBe(weightMap[factor.type]);
      }
    });

    it('should identify technical_density for complex technical text', () => {
      const text =
        '非同期プログラミングにおけるPromiseチェーンの例外伝播メカニズムは、マイクロタスクキューを介したイベントループの動作と密接に関連している';
      const factors: ComplexityFactor[] = detector.identifyComplexityFactors(text);

      const techFactor = factors.find((f) => f.type === 'technical_density');
      expect(techFactor).toBeDefined();
      expect(techFactor!.contribution).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------------------
  // Test case 5: Environment variable model override
  // -----------------------------------------------------------------------
  describe('Test case 5: Environment variable model override', () => {
    it('should override model when GEMINI_MODEL_OVERRIDE is set', () => {
      process.env.GEMINI_MODEL_OVERRIDE = 'gemini-2.5-pro';
      const model = detector.selectModel(0.1);
      expect(model).toBe('gemini-2.5-pro');
    });

    it('should override model even for simple text with GEMINI_MODEL_OVERRIDE', () => {
      process.env.GEMINI_MODEL_OVERRIDE = 'gemini-2.5-pro';
      // Score 0.1 would normally select flash, but override takes precedence
      const model = detector.selectModel(0.1);
      expect(model).toBe('gemini-2.5-pro');
    });

    it('should override model for complex text with different override value', () => {
      process.env.GEMINI_MODEL_OVERRIDE = 'gemini-2.5-flash';
      // Score 0.8 would normally select pro, but override takes precedence
      const model = detector.selectModel(0.8);
      expect(model).toBe('gemini-2.5-flash');
    });

    it('should return "rule-based" when DISABLE_GEMINI is set', () => {
      process.env.DISABLE_GEMINI = 'true';
      const model = detector.selectModel(0.5);
      expect(model).toBe('rule-based');
    });

    it('should prioritize GEMINI_MODEL_OVERRIDE over DISABLE_GEMINI', () => {
      process.env.DISABLE_GEMINI = 'true';
      process.env.GEMINI_MODEL_OVERRIDE = 'gemini-2.5-pro';
      const model = detector.selectModel(0.5);
      expect(model).toBe('gemini-2.5-pro');
    });

    it('should use default model selection when no override is set', () => {
      const flashModel = detector.selectModel(0.1);
      expect(flashModel).toBe('gemini-2.5-flash');

      const proModel = detector.selectModel(0.5);
      expect(proModel).toBe('gemini-2.5-pro');
    });
  });

  // -----------------------------------------------------------------------
  // Test case 6: Score range validation
  // -----------------------------------------------------------------------
  describe('Test case 6: Score range validation', () => {
    it('should return score in 0-1 range for empty string', () => {
      const result = detector.analyze('');
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });

    it('should return score in 0-1 range for single character', () => {
      const result = detector.analyze('a');
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });

    it('should return score in 0-1 range for long text', () => {
      const longText = 'これは非常に長いテキストです。'.repeat(50);
      const result = detector.analyze(longText);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });

    it('should return score in 0-1 range for special characters only', () => {
      const result = detector.analyze('!@#$%^&*()_+-={}[]|\\:";\'<>?,./');
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });

    it('should return score in 0-1 range for unicode characters', () => {
      const result = detector.analyze('😀🎉🎉🎉');
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });

    it('should return score in 0-1 range for whitespace only', () => {
      const result = detector.analyze('   \t\n  ');
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });
  });

  // -----------------------------------------------------------------------
  // Additional: analyze() returns correct structure
  // -----------------------------------------------------------------------
  describe('analyze() return structure', () => {
    it('should return all required fields', () => {
      const result = detector.analyze('テスト文章です。');

      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('level');
      expect(result).toHaveProperty('recommendedModel');
      expect(result).toHaveProperty('factors');
      expect(result).toHaveProperty('reasoning');
    });

    it('should return valid level values', () => {
      const validLevels = ['simple', 'moderate', 'complex'];
      const texts = ['猫', '非同期プログラミングの実装', 'これは普通の文章です。'];

      for (const text of texts) {
        const result = detector.analyze(text);
        expect(validLevels).toContain(result.level);
      }
    });
  });

  // -----------------------------------------------------------------------
  // Test case 7: COMPLEXITY_THRESHOLD env var + NaN guard
  // -----------------------------------------------------------------------
  describe('Test case 7: COMPLEXITY_THRESHOLD env var + NaN guard', () => {
    it('should use custom threshold from env var', () => {
      process.env.COMPLEXITY_THRESHOLD = '0.5';
      // Score 0.3 < 0.5 → flash
      expect(detector.selectModel(0.3)).toBe('gemini-2.5-flash');
      // Score 0.6 >= 0.5 → pro
      expect(detector.selectModel(0.6)).toBe('gemini-2.5-pro');
    });

    it('should fall back to default 0.2 when threshold is non-numeric ("abc")', () => {
      process.env.COMPLEXITY_THRESHOLD = 'abc';
      // parseFloat('abc') = NaN → guard falls back to 0.2
      expect(detector.selectModel(0.1)).toBe('gemini-2.5-flash');
      expect(detector.selectModel(0.3)).toBe('gemini-2.5-pro');
    });

    it('should fall back to default 0.2 when threshold is empty string', () => {
      process.env.COMPLEXITY_THRESHOLD = '';
      // parseFloat('') = NaN → guard falls back to 0.2
      expect(detector.selectModel(0.1)).toBe('gemini-2.5-flash');
      expect(detector.selectModel(0.3)).toBe('gemini-2.5-pro');
    });

    it('should parse partial numeric strings (parseFloat behavior)', () => {
      process.env.COMPLEXITY_THRESHOLD = '0.3extra';
      // parseFloat('0.3extra') = 0.3 → valid
      expect(detector.selectModel(0.2)).toBe('gemini-2.5-flash');
      expect(detector.selectModel(0.4)).toBe('gemini-2.5-pro');
    });

    it('should use threshold of 0 to always select pro', () => {
      process.env.COMPLEXITY_THRESHOLD = '0';
      // score < 0 is never true for non-negative scores → always pro
      expect(detector.selectModel(0)).toBe('gemini-2.5-pro');
      expect(detector.selectModel(0.01)).toBe('gemini-2.5-pro');
    });
  });

  // -----------------------------------------------------------------------
  // Test case 8: getComplexityStats() — previously untested
  // -----------------------------------------------------------------------
  describe('Test case 8: getComplexityStats()', () => {
    it('should return zero stats for empty array', () => {
      const stats = detector.getComplexityStats([]);
      expect(stats.avgComplexity).toBe(0);
      expect(stats.modelDistribution).toEqual({});
      expect(stats.levelDistribution).toEqual({});
    });

    it('should compute average complexity across analyses', () => {
      const analyses: ComplexityAnalysis[] = [
        { score: 0.1, level: 'simple', recommendedModel: 'flash', factors: {} as never, reasoning: '' },
        { score: 0.3, level: 'complex', recommendedModel: 'pro', factors: {} as never, reasoning: '' },
      ];
      const stats = detector.getComplexityStats(analyses);
      expect(stats.avgComplexity).toBeCloseTo(0.2, 5);
    });

    it('should count model distribution correctly', () => {
      const analyses: ComplexityAnalysis[] = [
        { score: 0.1, level: 'simple', recommendedModel: 'gemini-2.5-flash', factors: {} as never, reasoning: '' },
        { score: 0.1, level: 'simple', recommendedModel: 'gemini-2.5-flash', factors: {} as never, reasoning: '' },
        { score: 0.5, level: 'complex', recommendedModel: 'gemini-2.5-pro', factors: {} as never, reasoning: '' },
      ];
      const stats = detector.getComplexityStats(analyses);
      expect(stats.modelDistribution['gemini-2.5-flash']).toBe(2);
      expect(stats.modelDistribution['gemini-2.5-pro']).toBe(1);
    });

    it('should count level distribution correctly', () => {
      const analyses: ComplexityAnalysis[] = [
        { score: 0.1, level: 'simple', recommendedModel: 'm', factors: {} as never, reasoning: '' },
        { score: 0.15, level: 'moderate', recommendedModel: 'm', factors: {} as never, reasoning: '' },
        { score: 0.15, level: 'moderate', recommendedModel: 'm', factors: {} as never, reasoning: '' },
        { score: 0.5, level: 'complex', recommendedModel: 'm', factors: {} as never, reasoning: '' },
      ];
      const stats = detector.getComplexityStats(analyses);
      expect(stats.levelDistribution['simple']).toBe(1);
      expect(stats.levelDistribution['moderate']).toBe(2);
      expect(stats.levelDistribution['complex']).toBe(1);
    });

    it('should handle single analysis', () => {
      const analyses: ComplexityAnalysis[] = [
        { score: 0.42, level: 'complex', recommendedModel: 'gemini-2.5-pro', factors: {} as never, reasoning: '' },
      ];
      const stats = detector.getComplexityStats(analyses);
      expect(stats.avgComplexity).toBe(0.42);
      expect(stats.modelDistribution).toEqual({ 'gemini-2.5-pro': 1 });
      expect(stats.levelDistribution).toEqual({ 'complex': 1 });
    });

    it('should work with real analyze() output', () => {
      const a1 = detector.analyze('これは猫です。');
      const a2 = detector.analyze('非同期プログラミングにおけるPromiseチェーンの例外伝播メカニズム');
      const stats = detector.getComplexityStats([a1, a2]);
      expect(stats.avgComplexity).toBeGreaterThanOrEqual(0);
      expect(stats.avgComplexity).toBeLessThanOrEqual(1);
      expect(Object.keys(stats.modelDistribution).length).toBeGreaterThan(0);
      expect(Object.keys(stats.levelDistribution).length).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------------------
  // Test case 9: safeEnv error logging (silent catch → logger.warn)
  // -----------------------------------------------------------------------
  describe('Test case 9: safeEnv error logging', () => {
    it('should call logger.warn when process.env access throws', () => {
      const warnSpy = jest.spyOn(logger, 'warn').mockImplementation();
      const descriptor = Object.getOwnPropertyDescriptor(process, 'env');
      Object.defineProperty(process, 'env', {
        get() { throw new Error('env access denied'); },
        configurable: true,
      });

      try {
        // selectModel calls safeEnv internally — any model selection will trigger env access
        detector.selectModel(0.5);
        // selectModel calls safeEnv up to 3 times: GEMINI_MODEL_OVERRIDE, DISABLE_GEMINI, COMPLEXITY_THRESHOLD
        const complexityWarnings = warnSpy.mock.calls.filter(
          (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('complexity-detector')
        );
        expect(complexityWarnings.length).toBeGreaterThanOrEqual(1);
      } finally {
        if (descriptor) {
          Object.defineProperty(process, 'env', descriptor);
        }
      }

      warnSpy.mockRestore();
    });

    it('should not call logger.warn on normal env access', () => {
      const warnSpy = jest.spyOn(logger, 'warn').mockImplementation();
      detector.selectModel(0.5);
      // Normal access path should not log warnings from safeEnv
      const safeEnvCalls = warnSpy.mock.calls.filter(c =>
        typeof c[0] === 'string' && c[0].includes('complexity-detector')
      );
      expect(safeEnvCalls).toHaveLength(0);
      warnSpy.mockRestore();
    });
  });
});
