import {
  AdaptiveContentProcessor,
  adaptiveContentProcessor,
} from '../adaptive-content-processor';
import type { AudioCharacteristics, ParameterSet } from '../smart-parameter-tuner';

describe('AdaptiveContentProcessor', () => {
  let processor: AdaptiveContentProcessor;

  const baseCharacteristics: AudioCharacteristics = {
    speechRate: 150,
    complexity: 'medium',
    domain: 'technical',
    audioQuality: 0.8,
    keywordDensity: 0.5,
    diagramLikelihood: 0.5,
  };

  const baseParameters: ParameterSet = {
    confidenceThreshold: 0.7,
    segmentMinLength: 10,
    segmentMaxLength: 100,
    keywordWeights: { process: 1.5 },
    layoutDensity: 0.5,
    processingMode: 'balanced',
  };

  beforeEach(() => {
    processor = new AdaptiveContentProcessor();
  });

  describe('selectStrategy', () => {
    it('should select balanced strategy by default', async () => {
      const result = await processor.selectStrategy(baseCharacteristics, baseParameters);

      expect(result.strategy.name).toContain('Balanced');
      expect(result.confidence).toBeGreaterThanOrEqual(0.6);
      expect(result.confidence).toBeLessThanOrEqual(0.95);
      expect(result.reasoning.length).toBeGreaterThan(0);
      expect(result.expectedImprovement).toBeGreaterThanOrEqual(0);
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('should select fast strategy when processingMode is fast', async () => {
      const params = { ...baseParameters, processingMode: 'fast' as const };
      const result = await processor.selectStrategy(baseCharacteristics, params);

      expect(result.strategy.name).toContain('Fast');
      expect(result.strategy.transcriptionConfig.model).toBe('base');
      expect(result.strategy.transcriptionConfig.retryCount).toBe(2);
    });

    it('should select accurate strategy when processingMode is accurate', async () => {
      const params = { ...baseParameters, processingMode: 'accurate' as const };
      const result = await processor.selectStrategy(baseCharacteristics, params);

      expect(result.strategy.name).toContain('High Accuracy');
      expect(result.strategy.transcriptionConfig.model).toBe('medium');
      expect(result.strategy.transcriptionConfig.retryCount).toBe(4);
    });

    it('should use cached strategy on second call with similar characteristics', async () => {
      const chars1 = { ...baseCharacteristics, speechRate: 150 };
      const chars2 = { ...baseCharacteristics, speechRate: 160 }; // Same fingerprint bucket (150 round to 150, 160 rounds to 150)

      const result1 = await processor.selectStrategy(chars1, baseParameters);
      const result2 = await processor.selectStrategy(chars2, baseParameters);

      // Second call should hit cache (confidence 0.95)
      expect(result2.confidence).toBe(0.95);
      expect(result2.reasoning).toContain('Strategy from similar content analysis');
      expect(result2.expectedImprovement).toBe(20);
    });

    it('should customize for poor audio quality', async () => {
      const chars = { ...baseCharacteristics, audioQuality: 0.4 };
      const result = await processor.selectStrategy(chars, baseParameters);

      expect(result.strategy.transcriptionConfig.model).toBe('medium');
      expect(result.strategy.transcriptionConfig.retryCount).toBeGreaterThanOrEqual(3);
      expect(result.strategy.transcriptionConfig.combineMs).toBeLessThanOrEqual(200);
    });

    it('should customize for fast speech rate', async () => {
      const chars = { ...baseCharacteristics, speechRate: 250 };
      const result = await processor.selectStrategy(chars, baseParameters);

      expect(result.strategy.transcriptionConfig.combineMs).toBeLessThanOrEqual(200);
    });

    it('should customize for high complexity', async () => {
      const chars = { ...baseCharacteristics, complexity: 'high' as const };
      const result = await processor.selectStrategy(chars, baseParameters);

      expect(result.strategy.analysisConfig.segmentationMode).toBe('adaptive');
      expect(result.strategy.analysisConfig.complexityThreshold).toBe(0.3);
    });

    it('should customize for high diagram likelihood', async () => {
      const chars = { ...baseCharacteristics, diagramLikelihood: 0.9 };
      const result = await processor.selectStrategy(chars, baseParameters);

      expect(result.strategy.layoutConfig.algorithm).toBe('hierarchical');
      expect(result.strategy.layoutConfig.iterations).toBeGreaterThanOrEqual(200);
    });

    it('should calculate layout spacing from parameters', async () => {
      const params = { ...baseParameters, layoutDensity: 0.8 };
      const result = await processor.selectStrategy(baseCharacteristics, params);

      // spacing = round(50 + 0.8 * 100) = 130
      expect(result.strategy.layoutConfig.spacing).toBe(130);
    });

    it('should add "(Customized)" to strategy name when customizations are applied', async () => {
      const chars = { ...baseCharacteristics, audioQuality: 0.4 };
      const result = await processor.selectStrategy(chars, baseParameters);

      expect(result.strategy.name).toContain('Customized');
    });

    it('should provide appropriate reasoning for poor audio quality', async () => {
      const chars = { ...baseCharacteristics, audioQuality: 0.5 };
      const result = await processor.selectStrategy(chars, baseParameters);

      const audioReasoning = result.reasoning.find(r =>
        r.includes('Enhanced transcription model')
      );
      expect(audioReasoning).toBeDefined();
    });

    it('should provide reasoning for fast speech', async () => {
      const chars = { ...baseCharacteristics, speechRate: 250 };
      const result = await processor.selectStrategy(chars, baseParameters);

      const speechReasoning = result.reasoning.find(r =>
        r.includes('Reduced combine window')
      );
      expect(speechReasoning).toBeDefined();
    });

    it('should provide reasoning for complex content', async () => {
      const chars = { ...baseCharacteristics, complexity: 'high' as const };
      const result = await processor.selectStrategy(chars, baseParameters);

      const complexityReasoning = result.reasoning.find(r =>
        r.includes('Adaptive segmentation')
      );
      expect(complexityReasoning).toBeDefined();
    });

    it('should provide standard reasoning when characteristics are normal', async () => {
      const result = await processor.selectStrategy(baseCharacteristics, baseParameters);

      const standardReasoning = result.reasoning.find(r =>
        r.includes('Standard strategy configuration')
      );
      expect(standardReasoning).toBeDefined();
    });

    it('should estimate higher improvement for poor audio quality with appropriate model', async () => {
      const poorAudioChars = { ...baseCharacteristics, audioQuality: 0.4 };
      const resultPoor = await processor.selectStrategy(poorAudioChars, baseParameters);

      const goodAudioChars = { ...baseCharacteristics, audioQuality: 0.9 };
      // Clear cache to avoid hitting cached strategy
      processor.clearHistory();
      const resultGood = await processor.selectStrategy(goodAudioChars, baseParameters);

      expect(resultPoor.expectedImprovement).toBeGreaterThan(resultGood.expectedImprovement);
    });

    it('should estimate higher improvement for complex content with adaptive segmentation', async () => {
      const complexChars = { ...baseCharacteristics, complexity: 'high' as const };
      const resultComplex = await processor.selectStrategy(complexChars, baseParameters);

      processor.clearHistory();
      const simpleChars = { ...baseCharacteristics, complexity: 'low' as const };
      const resultSimple = await processor.selectStrategy(simpleChars, baseParameters);

      expect(resultComplex.expectedImprovement).toBeGreaterThanOrEqual(
        resultSimple.expectedImprovement
      );
    });

    it('should cap improvement at 60', async () => {
      const chars: AudioCharacteristics = {
        speechRate: 250,
        complexity: 'high',
        domain: 'technical',
        audioQuality: 0.3,
        keywordDensity: 0.8,
        diagramLikelihood: 0.9,
      };
      const result = await processor.selectStrategy(chars, baseParameters);

      expect(result.expectedImprovement).toBeLessThanOrEqual(60);
    });

    it('should cap confidence at 0.95', async () => {
      const result = await processor.selectStrategy(baseCharacteristics, baseParameters);

      expect(result.confidence).toBeLessThanOrEqual(0.95);
    });

    it('should floor confidence at 0.6', async () => {
      // Edge case: all characteristics at defaults, no history
      const result = await processor.selectStrategy(baseCharacteristics, baseParameters);

      expect(result.confidence).toBeGreaterThanOrEqual(0.6);
    });

    it('should handle missing audioQuality (undefined)', async () => {
      const chars = { ...baseCharacteristics, audioQuality: undefined as unknown as number };
      const result = await processor.selectStrategy(chars, baseParameters);

      expect(result.strategy).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0.6);
    });

    it('should handle missing diagramLikelihood (undefined)', async () => {
      const chars = { ...baseCharacteristics, diagramLikelihood: undefined as unknown as number };
      const result = await processor.selectStrategy(chars, baseParameters);

      expect(result.strategy).toBeDefined();
    });

    it('should handle different domains', async () => {
      const domains: Array<AudioCharacteristics['domain']> = [
        'technical', 'business', 'educational', 'general'
      ];

      for (const domain of domains) {
        processor.clearHistory();
        const chars = { ...baseCharacteristics, domain };
        const result = await processor.selectStrategy(chars, baseParameters);
        expect(result.strategy).toBeDefined();
      }
    });
  });

  describe('strategy caching', () => {
    it('should cache strategy by fingerprint', async () => {
      const chars = { ...baseCharacteristics, speechRate: 150 };

      await processor.selectStrategy(chars, baseParameters);
      const stats1 = processor.getProcessingStats();
      expect(stats1.cachedStrategies).toBe(1);

      // Different fingerprint (different speechRate bucket)
      const chars2 = { ...baseCharacteristics, speechRate: 300 };
      await processor.selectStrategy(chars2, baseParameters);
      const stats2 = processor.getProcessingStats();
      expect(stats2.cachedStrategies).toBe(2);
    });

    it('should group similar speech rates into same fingerprint', async () => {
      const chars1 = { ...baseCharacteristics, speechRate: 140 };
      const chars2 = { ...baseCharacteristics, speechRate: 155 };

      await processor.selectStrategy(chars1, baseParameters);
      await processor.selectStrategy(chars2, baseParameters);

      // Both should have same fingerprint (both round to 150)
      const stats = processor.getProcessingStats();
      expect(stats.cachedStrategies).toBe(1);
    });

    it('should clear history', async () => {
      await processor.selectStrategy(baseCharacteristics, baseParameters);
      expect(processor.getProcessingStats().cachedStrategies).toBe(1);

      processor.clearHistory();
      expect(processor.getProcessingStats().cachedStrategies).toBe(0);
    });
  });

  describe('getProcessingStats', () => {
    it('should return correct initial stats', () => {
      const stats = processor.getProcessingStats();

      expect(stats.version).toBe('1.0.0');
      expect(stats.cachedStrategies).toBe(0);
      expect(stats.availableStrategies).toBe(3); // fast, balanced, accurate
      expect(stats.customizationsApplied).toBe(0);
    });

    it('should reflect cached strategies after selection', async () => {
      await processor.selectStrategy(baseCharacteristics, baseParameters);

      const stats = processor.getProcessingStats();
      expect(stats.cachedStrategies).toBe(1);
      expect(stats.customizationsApplied).toBe(1);
    });
  });

  describe('singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(adaptiveContentProcessor).toBeInstanceOf(AdaptiveContentProcessor);
    });

    it('should maintain state across calls', async () => {
      const initialStats = adaptiveContentProcessor.getProcessingStats();
      const initialCached = initialStats.cachedStrategies;

      await adaptiveContentProcessor.selectStrategy(baseCharacteristics, baseParameters);

      const afterStats = adaptiveContentProcessor.getProcessingStats();
      expect(afterStats.cachedStrategies).toBeGreaterThan(initialCached);

      // Clean up
      adaptiveContentProcessor.clearHistory();
    });
  });

  describe('predefined strategies', () => {
    it('should have fast strategy with correct defaults', async () => {
      const params = { ...baseParameters, processingMode: 'fast' as const };
      const result = await processor.selectStrategy(
        { ...baseCharacteristics, speechRate: 100, audioQuality: 0.9 },
        params
      );

      expect(result.strategy.transcriptionConfig.model).toBe('base');
      expect(result.strategy.transcriptionConfig.combineMs).toBe(500);
      expect(result.strategy.analysisConfig.segmentationMode).toBe('fixed');
      expect(result.strategy.layoutConfig.algorithm).toBe('dagre');
      // spacing = round(50 + 0.5 * 100) = 100
      expect(result.strategy.layoutConfig.spacing).toBe(100);
    });

    it('should have accurate strategy with correct defaults', async () => {
      const params = { ...baseParameters, processingMode: 'accurate' as const };
      const result = await processor.selectStrategy(
        { ...baseCharacteristics, speechRate: 100, audioQuality: 0.9 },
        params
      );

      expect(result.strategy.transcriptionConfig.model).toBe('medium');
      expect(result.strategy.transcriptionConfig.combineMs).toBe(200);
      expect(result.strategy.analysisConfig.segmentationMode).toBe('adaptive');
      expect(result.strategy.layoutConfig.algorithm).toBe('hierarchical');
      expect(result.strategy.layoutConfig.spacing).toBe(100);
    });
  });

  describe('confidence calculation', () => {
    it('should give higher confidence for good audio quality', async () => {
      processor.clearHistory();
      const goodChars = { ...baseCharacteristics, audioQuality: 0.9 };
      const resultGood = await processor.selectStrategy(goodChars, baseParameters);

      processor.clearHistory();
      const lowChars = { ...baseCharacteristics, audioQuality: 0.5 };
      const resultLow = await processor.selectStrategy(lowChars, baseParameters);

      expect(resultGood.confidence).toBeGreaterThan(resultLow.confidence);
    });
  });
});
