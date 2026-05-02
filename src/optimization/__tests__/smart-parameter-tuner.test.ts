/**
 * Tests for SmartParameterTuner - Content analysis, parameter optimization, and learning
 */

import SmartParameterTuner from '../smart-parameter-tuner';
import type { ContentCharacteristics, ParameterSet } from '../smart-parameter-tuner';

describe('SmartParameterTuner', () => {
  let tuner: SmartParameterTuner;

  beforeEach(() => {
    tuner = new SmartParameterTuner();
  });

  describe('analyzeContent', () => {
    it('should analyze basic transcript with default metadata', async () => {
      const result = await tuner.analyzeContent('Hello world this is a test', {});
      expect(result).toBeDefined();
      expect(result.speechRate).toBeGreaterThan(0);
      expect(result.complexity).toBeDefined();
      expect(result.domain).toBeDefined();
      expect(result.audioQuality).toBe(0.8); // default
      expect(result.keywordDensity).toBeGreaterThanOrEqual(0);
      expect(result.diagramLikelihood).toBeGreaterThanOrEqual(0);
      expect(result.diagramLikelihood).toBeLessThanOrEqual(1);
    });

    it('should calculate speech rate based on duration', async () => {
      const result = await tuner.analyzeContent('one two three four five', { duration: 60 });
      // 5 words / 60 seconds * 60 = 5 wpm
      expect(result.speechRate).toBe(5);
    });

    it('should use custom audio quality when provided', async () => {
      const result = await tuner.analyzeContent('test', { quality: 0.5 });
      expect(result.audioQuality).toBe(0.5);
    });

    it('should detect technical domain', async () => {
      const result = await tuner.analyzeContent(
        'The algorithm processes data through the API and stores it in the database using the framework.',
        { duration: 60 }
      );
      expect(result.domain).toBe('technical');
    });

    it('should detect business domain', async () => {
      const result = await tuner.analyzeContent(
        'Our market strategy focuses on customer revenue and profit growth through sales and investment.',
        { duration: 60 }
      );
      expect(result.domain).toBe('business');
    });

    it('should detect educational domain', async () => {
      const result = await tuner.analyzeContent(
        'In this lesson students will learn and understand the concept as we explain the topic.',
        { duration: 60 }
      );
      expect(result.domain).toBe('educational');
    });

    it('should default to general domain with no keywords', async () => {
      const result = await tuner.analyzeContent('hello world foo bar baz', { duration: 60 });
      expect(result.domain).toBe('general');
    });

    it('should assess high complexity for technical content', async () => {
      const technicalText = Array(5).fill(
        'The system algorithm processes the method structure through the framework implementation analysis.'
      ).join(' ');
      const result = await tuner.analyzeContent(technicalText, { duration: 60 });
      expect(result.complexity).toBe('high');
    });

    it('should assess low complexity for simple content', async () => {
      // Use enough repeated short words to get low vocabulary richness
      const result = await tuner.analyzeContent('the the the the. ok ok ok ok. yes yes yes yes.', { duration: 60 });
      expect(result.complexity).toBe('low');
    });

    it('should calculate keyword density for diagram keywords', async () => {
      const result = await tuner.analyzeContent(
        'flow process step tree hierarchy timeline cycle',
        { duration: 60 }
      );
      expect(result.keywordDensity).toBeGreaterThan(0);
    });

    it('should estimate diagram likelihood for sequential content', async () => {
      const result = await tuner.analyzeContent(
        'First we start. Then we proceed to the next step. Finally we complete the process flow.',
        { duration: 60 }
      );
      expect(result.diagramLikelihood).toBeGreaterThan(0);
    });

    it('should handle empty transcript', async () => {
      const result = await tuner.analyzeContent('', { duration: 60 });
      expect(result).toBeDefined();
      expect(result.speechRate).toBe(0);
    });
  });

  describe('optimizeParameters', () => {
    const baseCharacteristics: ContentCharacteristics = {
      speechRate: 150,
      complexity: 'medium',
      domain: 'general',
      audioQuality: 0.8,
      keywordDensity: 0.1,
      diagramLikelihood: 0.5,
    };

    it('should return optimization result with all fields', async () => {
      const result = await tuner.optimizeParameters(baseCharacteristics);
      expect(result).toBeDefined();
      expect(result.parameters).toBeDefined();
      expect(result.expectedPerformance).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should adjust for fast speech', async () => {
      const fastSpeech: ContentCharacteristics = {
        ...baseCharacteristics,
        speechRate: 200,
      };
      const result = await tuner.optimizeParameters(fastSpeech);
      expect(result.parameters.segmentMaxLength).toBeLessThanOrEqual(20000);
      expect(result.parameters.confidenceThreshold).toBeGreaterThanOrEqual(0.8);
      expect(result.parameters.processingMode).toBe('accurate');
    });

    it('should adjust for slow speech', async () => {
      const slowSpeech: ContentCharacteristics = {
        ...baseCharacteristics,
        speechRate: 100,
      };
      const result = await tuner.optimizeParameters(slowSpeech);
      expect(result.parameters.segmentMaxLength).toBeGreaterThanOrEqual(40000);
      expect(result.parameters.confidenceThreshold).toBeLessThanOrEqual(0.7);
    });

    it('should adjust for high complexity', async () => {
      const complex: ContentCharacteristics = {
        ...baseCharacteristics,
        complexity: 'high',
      };
      const result = await tuner.optimizeParameters(complex);
      expect(result.parameters.confidenceThreshold).toBeGreaterThanOrEqual(0.75);
      expect(result.parameters.processingMode).toBe('accurate');
      expect(result.parameters.layoutDensity).toBeLessThanOrEqual(0.6);
    });

    it('should adjust for low complexity', async () => {
      const simple: ContentCharacteristics = {
        ...baseCharacteristics,
        complexity: 'low',
      };
      const result = await tuner.optimizeParameters(simple);
      expect(result.parameters.processingMode).toBe('fast');
      expect(result.parameters.layoutDensity).toBeGreaterThanOrEqual(0.8);
    });

    it('should adjust for poor audio quality', async () => {
      const poorAudio: ContentCharacteristics = {
        ...baseCharacteristics,
        audioQuality: 0.4,
      };
      const result = await tuner.optimizeParameters(poorAudio);
      expect(result.parameters.confidenceThreshold).toBeGreaterThan(0.75);
      expect(result.parameters.segmentMinLength).toBeGreaterThanOrEqual(8000);
    });

    it('should use technical domain weights', async () => {
      const techContent: ContentCharacteristics = {
        ...baseCharacteristics,
        domain: 'technical',
      };
      const result = await tuner.optimizeParameters(techContent);
      expect(result.parameters.keywordWeights).toHaveProperty('system');
      expect(result.parameters.keywordWeights).toHaveProperty('architecture');
    });

    it('should use business domain weights', async () => {
      const bizContent: ContentCharacteristics = {
        ...baseCharacteristics,
        domain: 'business',
      };
      const result = await tuner.optimizeParameters(bizContent);
      expect(result.parameters.keywordWeights).toHaveProperty('strategy');
      expect(result.parameters.keywordWeights).toHaveProperty('market');
    });

    it('should use educational domain weights', async () => {
      const eduContent: ContentCharacteristics = {
        ...baseCharacteristics,
        domain: 'educational',
      };
      const result = await tuner.optimizeParameters(eduContent);
      expect(result.parameters.keywordWeights).toHaveProperty('concept');
      expect(result.parameters.keywordWeights).toHaveProperty('explain');
    });

    it('should predict performance within bounds', async () => {
      const result = await tuner.optimizeParameters(baseCharacteristics);
      const perf = result.expectedPerformance;
      expect(perf.accuracy).toBeGreaterThanOrEqual(0.7);
      expect(perf.accuracy).toBeLessThanOrEqual(0.98);
      expect(perf.speed).toBeGreaterThanOrEqual(1.0);
      expect(perf.reliability).toBeGreaterThanOrEqual(0.8);
      expect(perf.reliability).toBeLessThanOrEqual(0.99);
    });
  });

  describe('updateFromResults', () => {
    it('should store successful parameter sets', async () => {
      const characteristics: ContentCharacteristics = {
        speechRate: 150,
        complexity: 'medium',
        domain: 'general',
        audioQuality: 0.8,
        keywordDensity: 0.1,
        diagramLikelihood: 0.5,
      };
      const params: ParameterSet = {
        confidenceThreshold: 0.8,
        segmentMinLength: 5000,
        segmentMaxLength: 30000,
        keywordWeights: { flow: 1.2 },
        layoutDensity: 0.7,
        processingMode: 'balanced',
      };

      await tuner.updateFromResults(characteristics, params, {
        accuracy: 0.9,
        speed: 5.0,
        reliability: 0.95,
      });

      // Verify learning is applied by re-optimizing
      const result = await tuner.optimizeParameters(characteristics);
      // Confidence should be higher due to historical data
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should not store poor performance results', async () => {
      const characteristics: ContentCharacteristics = {
        speechRate: 150,
        complexity: 'medium',
        domain: 'general',
        audioQuality: 0.8,
        keywordDensity: 0.1,
        diagramLikelihood: 0.5,
      };
      const params: ParameterSet = {
        confidenceThreshold: 0.8,
        segmentMinLength: 5000,
        segmentMaxLength: 30000,
        keywordWeights: { flow: 1.2 },
        layoutDensity: 0.7,
        processingMode: 'balanced',
      };

      await tuner.updateFromResults(characteristics, params, {
        accuracy: 0.5,
        speed: 5.0,
        reliability: 0.6,
      });

      // The result should still work but without historical boost
      const result = await tuner.optimizeParameters(characteristics);
      expect(result).toBeDefined();
    });

    it('should track performance history', async () => {
      const characteristics: ContentCharacteristics = {
        speechRate: 150,
        complexity: 'medium',
        domain: 'general',
        audioQuality: 0.8,
        keywordDensity: 0.1,
        diagramLikelihood: 0.5,
      };
      const params: ParameterSet = {
        confidenceThreshold: 0.8,
        segmentMinLength: 5000,
        segmentMaxLength: 30000,
        keywordWeights: {},
        layoutDensity: 0.7,
        processingMode: 'balanced',
      };

      // Add multiple results
      for (let i = 0; i < 5; i++) {
        await tuner.updateFromResults(characteristics, params, {
          accuracy: 0.85,
          speed: 5.0,
          reliability: 0.92,
        });
      }

      const result = await tuner.optimizeParameters(characteristics);
      expect(result).toBeDefined();
    });
  });

  describe('learning integration', () => {
    it('should blend historical parameters with new optimization', async () => {
      const characteristics: ContentCharacteristics = {
        speechRate: 150,
        complexity: 'medium',
        domain: 'technical',
        audioQuality: 0.8,
        keywordDensity: 0.1,
        diagramLikelihood: 0.5,
      };

      // First, learn from a result
      const params: ParameterSet = {
        confidenceThreshold: 0.85,
        segmentMinLength: 6000,
        segmentMaxLength: 25000,
        keywordWeights: { flow: 1.0 },
        layoutDensity: 0.65,
        processingMode: 'accurate',
      };

      await tuner.updateFromResults(characteristics, params, {
        accuracy: 0.92,
        speed: 4.0,
        reliability: 0.96,
      });

      // Second optimization should blend historical data
      const result = await tuner.optimizeParameters(characteristics);
      expect(result.confidence).toBeGreaterThan(0.8);
    });
  });

  describe('edge cases', () => {
    it('should handle zero duration metadata', async () => {
      const result = await tuner.analyzeContent('test words', { duration: 0 });
      // With 0 duration, uses fallback of 60s
      expect(result.speechRate).toBeGreaterThanOrEqual(0);
    });

    it('should handle very long transcript', async () => {
      const longText = 'word '.repeat(10000);
      const result = await tuner.analyzeContent(longText, { duration: 600 });
      expect(result).toBeDefined();
      expect(result.speechRate).toBeGreaterThan(0);
    });

    it('should handle all processing modes', async () => {
      const modes: Array<'fast' | 'balanced' | 'accurate'> = ['fast', 'balanced', 'accurate'];
      for (const mode of modes) {
        const chars: ContentCharacteristics = {
          speechRate: 150,
          complexity: mode === 'fast' ? 'low' : mode === 'accurate' ? 'high' : 'medium',
          domain: 'general',
          audioQuality: 0.8,
          keywordDensity: 0.1,
          diagramLikelihood: 0.5,
        };
        const result = await tuner.optimizeParameters(chars);
        expect(result.parameters.processingMode).toBeDefined();
      }
    });
  });
});
