/**
 * Tests for AdaptiveContentProcessor — strategy selection and caching.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  AdaptiveContentProcessor,
  type ProcessingStrategy,
  type AdaptiveResult,
} from '@/optimization/adaptive-content-processor';
import type { AudioCharacteristics, ParameterSet } from '@/optimization/smart-parameter-tuner';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const defaultCharacteristics: AudioCharacteristics = {
  speechRate: 120,
  complexity: 'medium',
  domain: 'general',
  audioQuality: 0.8,
  keywordDensity: 0.3,
  diagramLikelihood: 0.5,
};

const fastParams: ParameterSet = {
  confidenceThreshold: 0.6,
  segmentMinLength: 50,
  segmentMaxLength: 500,
  keywordWeights: {},
  layoutDensity: 0.5,
  processingMode: 'fast',
};

const balancedParams: ParameterSet = {
  confidenceThreshold: 0.7,
  segmentMinLength: 40,
  segmentMaxLength: 400,
  keywordWeights: {},
  layoutDensity: 0.5,
  processingMode: 'balanced',
};

const accurateParams: ParameterSet = {
  confidenceThreshold: 0.8,
  segmentMinLength: 30,
  segmentMaxLength: 300,
  keywordWeights: {},
  layoutDensity: 0.5,
  processingMode: 'accurate',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AdaptiveContentProcessor', () => {
  let processor: AdaptiveContentProcessor;

  beforeEach(() => {
    processor = new AdaptiveContentProcessor();
  });

  describe('selectStrategy', () => {
    it('returns a result with fast strategy for fast processing mode', async () => {
      const result = await processor.selectStrategy(defaultCharacteristics, fastParams);
      expect(result.strategy).toBeDefined();
      expect(result.strategy.name).toContain('Fast');
      expect(result.confidence).toBeGreaterThanOrEqual(0.6);
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('returns balanced strategy for balanced processing mode', async () => {
      const result = await processor.selectStrategy(defaultCharacteristics, balancedParams);
      expect(result.strategy.name).toContain('Balanced');
    });

    it('returns accurate strategy for accurate processing mode', async () => {
      const result = await processor.selectStrategy(defaultCharacteristics, accurateParams);
      expect(result.strategy.name).toContain('High Accuracy');
    });

    it('customizes strategy for poor audio quality', async () => {
      const poorAudio: AudioCharacteristics = {
        ...defaultCharacteristics,
        audioQuality: 0.4,
      };
      const result = await processor.selectStrategy(poorAudio, fastParams);
      // Poor audio should trigger a larger transcription model
      expect(result.strategy.transcriptionConfig.model).toBe('medium');
      expect(result.strategy.transcriptionConfig.retryCount).toBeGreaterThanOrEqual(3);
    });

    it('customizes strategy for fast speech rate', async () => {
      const fastSpeech: AudioCharacteristics = {
        ...defaultCharacteristics,
        speechRate: 250,
      };
      const result = await processor.selectStrategy(fastSpeech, balancedParams);
      expect(result.strategy.transcriptionConfig.combineMs).toBeLessThanOrEqual(200);
    });

    it('customizes strategy for high complexity', async () => {
      const complex: AudioCharacteristics = {
        ...defaultCharacteristics,
        complexity: 'high',
      };
      const result = await processor.selectStrategy(complex, balancedParams);
      expect(result.strategy.analysisConfig.segmentationMode).toBe('adaptive');
      expect(result.strategy.analysisConfig.complexityThreshold).toBe(0.3);
    });

    it('customizes strategy for high diagram likelihood', async () => {
      const diagrammy: AudioCharacteristics = {
        ...defaultCharacteristics,
        diagramLikelihood: 0.9,
      };
      const result = await processor.selectStrategy(diagrammy, balancedParams);
      expect(result.strategy.layoutConfig.algorithm).toBe('hierarchical');
      expect(result.strategy.layoutConfig.iterations).toBeGreaterThanOrEqual(200);
    });

    it('generates reasoning for strategy selection', async () => {
      const result = await processor.selectStrategy(defaultCharacteristics, balancedParams);
      expect(result.reasoning.length).toBeGreaterThanOrEqual(1);
      expect(result.reasoning[0]).toContain(balancedParams.processingMode);
    });

    it('caches strategy for same fingerprint', async () => {
      const r1 = await processor.selectStrategy(defaultCharacteristics, balancedParams);
      const r2 = await processor.selectStrategy(defaultCharacteristics, balancedParams);
      // Second call should return cached strategy with higher confidence
      expect(r2.confidence).toBe(0.95);
      expect(r2.reasoning).toEqual(expect.arrayContaining([expect.stringContaining('similar content')]));
    });
  });

  describe('expectedImprovement', () => {
    it('estimates higher improvement for poor audio with appropriate model', async () => {
      const goodAudio: AudioCharacteristics = { ...defaultCharacteristics, audioQuality: 0.9 };
      const poorAudio: AudioCharacteristics = { ...defaultCharacteristics, audioQuality: 0.3 };

      const rGood = await processor.selectStrategy(goodAudio, balancedParams);
      processor.clearHistory();
      const rPoor = await processor.selectStrategy(poorAudio, balancedParams);

      expect(rPoor.expectedImprovement).toBeGreaterThan(rGood.expectedImprovement);
    });

    it('estimates higher improvement for complex content with adaptive mode', async () => {
      const simple: AudioCharacteristics = { ...defaultCharacteristics, complexity: 'low' };
      const complex: AudioCharacteristics = { ...defaultCharacteristics, complexity: 'high' };

      const rSimple = await processor.selectStrategy(simple, balancedParams);
      processor.clearHistory();
      const rComplex = await processor.selectStrategy(complex, balancedParams);

      expect(rComplex.expectedImprovement).toBeGreaterThan(rSimple.expectedImprovement);
    });
  });

  describe('getProcessingStats', () => {
    it('returns initial stats', () => {
      const stats = processor.getProcessingStats();
      expect(stats.version).toBe('1.0.0');
      expect(stats.cachedStrategies).toBe(0);
      expect(stats.availableStrategies).toBe(3);
    });

    it('increases cached strategies after selection', async () => {
      await processor.selectStrategy(defaultCharacteristics, balancedParams);
      const stats = processor.getProcessingStats();
      expect(stats.cachedStrategies).toBe(1);
    });
  });

  describe('clearHistory', () => {
    it('clears cached strategies', async () => {
      await processor.selectStrategy(defaultCharacteristics, balancedParams);
      expect(processor.getProcessingStats().cachedStrategies).toBe(1);
      processor.clearHistory();
      expect(processor.getProcessingStats().cachedStrategies).toBe(0);
    });
  });
});
