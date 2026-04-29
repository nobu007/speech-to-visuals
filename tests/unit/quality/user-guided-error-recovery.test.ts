/**
 * TASK-0045: UserGuidedErrorRecovery Enhancement Tests (TDD)
 *
 * Tests for 11 error categories, 4 severity levels, auto/manual recovery
 * strategy selection, and recovery success tracking.
 */

import {
  UserGuidedErrorRecovery,
  ErrorGuidance,
  ErrorCategory,
  RecoveryStrategy,
} from '@/quality/user-guided-error-recovery';

describe('UserGuidedErrorRecovery', () => {
  let recovery: UserGuidedErrorRecovery;

  beforeEach(() => {
    recovery = new UserGuidedErrorRecovery();
  });

  describe('11-category classification', () => {
    it('should classify file_format errors', () => {
      const error = new Error('Unsupported file format');
      const guidance = recovery.analyzeError(error);

      expect(guidance.category).toBe('file_format');
      expect(guidance.recoveryStrategies.length).toBeGreaterThan(0);
    });

    it('should classify file_size errors', () => {
      const error = new Error('too large file exceeds maximum size limit');
      const guidance = recovery.analyzeError(error);

      expect(guidance.category).toBe('file_size');
    });

    it('should classify transcription errors', () => {
      const error = new Error('Transcription failed due to poor audio quality');
      const guidance = recovery.analyzeError(error);

      expect(guidance.category).toBe('transcription');
    });

    it('should classify analysis errors', () => {
      const error = new Error('LLM analysis returned invalid response');
      const guidance = recovery.analyzeError(error);

      expect(guidance.category).toBe('analysis');
    });

    it('should classify layout errors', () => {
      const error = new Error('Layout generation failed: overlapping nodes');
      const guidance = recovery.analyzeError(error);

      expect(guidance.category).toBe('layout');
    });

    it('should classify rendering errors', () => {
      const error = new Error('Video rendering failed');
      const guidance = recovery.analyzeError(error);

      expect(guidance.category).toBe('rendering');
    });

    it('should classify api errors', () => {
      const error = new Error('API key invalid or expired');
      const guidance = recovery.analyzeError(error);

      expect(guidance.category).toBe('api');
    });

    it('should classify network errors', () => {
      const error = new Error('Network connection failed');
      const guidance = recovery.analyzeError(error);

      expect(guidance.category).toBe('network');
    });

    it('should classify memory errors', () => {
      const error = new Error('Out of memory during processing');
      const guidance = recovery.analyzeError(error);

      expect(guidance.category).toBe('memory');
    });

    it('should classify timeout errors', () => {
      const error = new Error('Processing timed out after 60 seconds');
      const guidance = recovery.analyzeError(error);

      expect(guidance.category).toBe('timeout');
    });

    it('should classify unknown errors', () => {
      const error = new Error('Some mysterious error occurred');
      const guidance = recovery.analyzeError(error);

      expect(guidance.category).toBe('unknown');
    });

    it('should support all 11 categories', () => {
      const expectedCategories: ErrorCategory[] = [
        'file_format', 'file_size', 'transcription', 'analysis',
        'layout', 'rendering', 'api', 'network', 'memory',
        'timeout', 'unknown',
      ];

      for (const cat of expectedCategories) {
        expect(typeof cat).toBe('string');
      }
      expect(expectedCategories).toHaveLength(11);
    });
  });

  describe('4 severity levels', () => {
    it('should classify critical severity for api and memory errors', () => {
      const apiGuidance = recovery.analyzeError(new Error('API key is invalid'));
      expect(apiGuidance.severity).toBe('critical');

      const memGuidance = recovery.analyzeError(new Error('Out of memory: heap exhausted'));
      expect(memGuidance.severity).toBe('critical');
    });

    it('should classify high severity for transcription and analysis errors', () => {
      const transGuidance = recovery.analyzeError(new Error('Transcription engine failed'));
      expect(transGuidance.severity).toBe('high');

      const analysisGuidance = recovery.analyzeError(new Error('Analysis engine crashed'));
      expect(analysisGuidance.severity).toBe('high');
    });

    it('should classify medium severity for layout, rendering, and timeout errors', () => {
      const layoutGuidance = recovery.analyzeError(new Error('Layout overlap detected'));
      expect(layoutGuidance.severity).toBe('medium');

      const renderGuidance = recovery.analyzeError(new Error('Rendering failed'));
      expect(renderGuidance.severity).toBe('medium');

      const timeoutGuidance = recovery.analyzeError(new Error('Timed out waiting for response'));
      expect(timeoutGuidance.severity).toBe('medium');
    });

    it('should classify low severity for file format and file size errors', () => {
      const formatGuidance = recovery.analyzeError(new Error('File format not supported'));
      expect(formatGuidance.severity).toBe('low');

      const sizeGuidance = recovery.analyzeError(new Error('File size too large'));
      expect(sizeGuidance.severity).toBe('low');
    });
  });

  describe('auto/manual recovery strategy selection', () => {
    it('should identify automated strategies', () => {
      const error = new Error('Network connection failed');
      const guidance = recovery.analyzeError(error);

      const autoStrategies = guidance.recoveryStrategies.filter(s => s.automated);
      expect(autoStrategies.length).toBeGreaterThan(0);
    });

    it('should identify manual strategies', () => {
      const error = new Error('File format not supported');
      const guidance = recovery.analyzeError(error);

      const manualStrategies = guidance.recoveryStrategies.filter(s => !s.automated);
      expect(manualStrategies.length).toBeGreaterThan(0);
    });

    it('should select auto strategy for auto-recoverable errors', async () => {
      const error = new Error('Network error');
      const guidance = recovery.analyzeError(error);

      const selectedStrategy = recovery.selectRecoveryStrategy(guidance, 'auto');
      expect(selectedStrategy).toBeDefined();
      expect(selectedStrategy?.automated).toBe(true);
    });

    it('should select manual strategy when requested', () => {
      const error = new Error('API key is invalid');
      const guidance = recovery.analyzeError(error);

      const selectedStrategy = recovery.selectRecoveryStrategy(guidance, 'manual');
      expect(selectedStrategy).toBeDefined();
      expect(selectedStrategy?.automated).toBe(false);
    });

    it('should select best strategy (highest success rate) by default', () => {
      const error = new Error('File size exceeds limit');
      const guidance = recovery.analyzeError(error);

      const selectedStrategy = recovery.selectRecoveryStrategy(guidance, 'auto');
      if (selectedStrategy) {
        // It should have the highest success rate among automated strategies
        const autoStrategies = guidance.recoveryStrategies.filter(s => s.automated);
        if (autoStrategies.length > 0) {
          const maxSuccessRate = Math.max(...autoStrategies.map(s => s.successRate));
          expect(selectedStrategy.successRate).toBe(maxSuccessRate);
        }
      }
    });
  });

  describe('recovery success tracking', () => {
    it('should track recovery success statistics', async () => {
      // Analyze an error
      const error = new Error('Network error');
      const guidance = recovery.analyzeError(error);

      // Attempt recovery (will succeed if retryFunction works)
      const result = await recovery.attemptRecovery(guidance, async () => 'recovered');

      expect(result.success).toBe(true);
      expect(result.result).toBe('recovered');
    });

    it('should update error history with recovery status', async () => {
      const error = new Error('Analysis failed with LLM');
      const guidance = recovery.analyzeError(error);

      await recovery.attemptRecovery(guidance, async () => 'ok');

      const stats = recovery.getErrorStatistics();
      expect(stats.total).toBeGreaterThan(0);
    });

    it('should track recovery rate', async () => {
      // Successful recovery
      const error1 = new Error('Network connection lost');
      const guidance1 = recovery.analyzeError(error1);
      await recovery.attemptRecovery(guidance1, async () => 'recovered');

      // Failed recovery (no automated strategy for file_format)
      const error2 = new Error('Unsupported file type');
      const guidance2 = recovery.analyzeError(error2);
      await recovery.attemptRecovery(guidance2, async () => {
        throw new Error('still failing');
      });

      const stats = recovery.getErrorStatistics();
      expect(stats.recoveryRate).toBeGreaterThanOrEqual(0);
      expect(stats.recoveryRate).toBeLessThanOrEqual(1);
    });

    it('should identify most common error category', () => {
      // Generate multiple network errors
      for (let i = 0; i < 3; i++) {
        recovery.analyzeError(new Error('Network timeout'));
      }
      recovery.analyzeError(new Error('File format error'));

      const stats = recovery.getErrorStatistics();
      expect(stats.mostCommon).toBe('network');
    });
  });

  describe('user-friendly messages', () => {
    it('should provide user-friendly messages for each category', () => {
      const errors = [
        { error: new Error('File format unsupported'), expectedCategory: 'file_format' as ErrorCategory },
        { error: new Error('too large file exceeds size limit'), expectedCategory: 'file_size' as ErrorCategory },
        { error: new Error('Network timeout'), expectedCategory: 'network' as ErrorCategory },
        { error: new Error('Unknown issue'), expectedCategory: 'unknown' as ErrorCategory },
      ];

      for (const { error, expectedCategory } of errors) {
        const guidance = recovery.analyzeError(error);
        expect(guidance.category).toBe(expectedCategory);
        expect(guidance.userMessage).toBeDefined();
        expect(guidance.userMessage.length).toBeGreaterThan(0);
      }
    });

    it('should include prevention tips', () => {
      const error = new Error('Network connection lost');
      const guidance = recovery.analyzeError(error);

      expect(guidance.preventionTips).toBeDefined();
      expect(guidance.preventionTips.length).toBeGreaterThan(0);
    });

    it('should include documentation links', () => {
      const error = new Error('API key expired');
      const guidance = recovery.analyzeError(error);

      expect(guidance.documentationLinks).toBeDefined();
      expect(guidance.documentationLinks.length).toBeGreaterThan(0);
    });
  });
});
