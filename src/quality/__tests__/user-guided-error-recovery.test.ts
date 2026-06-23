import {
  UserGuidedErrorRecovery,
  type ErrorGuidance,
} from '../user-guided-error-recovery';

describe('UserGuidedErrorRecovery', () => {
  let recovery: UserGuidedErrorRecovery;

  beforeEach(() => {
    recovery = new UserGuidedErrorRecovery();
  });

  describe('analyzeError', () => {
    it('should categorize file size errors correctly', () => {
      const error = new Error('File size exceeds maximum size of 50MB');
      const guidance = recovery.analyzeError(error);
      expect(guidance.category).toBe('file_size');
      expect(guidance.severity).toBe('low');
    });

    it('should categorize file format errors correctly', () => {
      const error = new Error('Unsupported file format: .flac');
      const guidance = recovery.analyzeError(error);
      expect(guidance.category).toBe('file_format');
    });

    it('should categorize transcription errors', () => {
      const error = new Error('Whisper transcription failed');
      const guidance = recovery.analyzeError(error);
      expect(guidance.category).toBe('transcription');
      expect(guidance.severity).toBe('high');
    });

    it('should categorize analysis errors', () => {
      const error = new Error('LLM analysis timeout');
      const guidance = recovery.analyzeError(error);
      expect(guidance.category).toBe('analysis');
      expect(guidance.severity).toBe('high');
    });

    it('should categorize layout errors', () => {
      const error = new Error('Layout overlap detected');
      const guidance = recovery.analyzeError(error);
      expect(guidance.category).toBe('layout');
      expect(guidance.severity).toBe('medium');
    });

    it('should categorize rendering errors', () => {
      const error = new Error('Video render failed');
      const guidance = recovery.analyzeError(error);
      expect(guidance.category).toBe('rendering');
      expect(guidance.severity).toBe('medium');
    });

    it('should categorize API errors as critical', () => {
      const error = new Error('API key invalid');
      const guidance = recovery.analyzeError(error);
      expect(guidance.category).toBe('api');
      expect(guidance.severity).toBe('critical');
    });

    it('should categorize network errors', () => {
      const error = new Error('Network connection failed');
      const guidance = recovery.analyzeError(error);
      expect(guidance.category).toBe('network');
    });

    it('should categorize memory errors as critical', () => {
      const error = new Error('Out of memory: heap allocation failed');
      const guidance = recovery.analyzeError(error);
      expect(guidance.category).toBe('memory');
      expect(guidance.severity).toBe('critical');
    });

    it('should categorize timeout errors', () => {
      const error = new Error('Operation timed out');
      const guidance = recovery.analyzeError(error);
      expect(guidance.category).toBe('timeout');
      expect(guidance.severity).toBe('medium');
    });

    it('should categorize unknown errors', () => {
      const error = new Error('Something unexpected happened');
      const guidance = recovery.analyzeError(error);
      expect(guidance.category).toBe('unknown');
    });

    it('should prioritize file_size over file_format for size-related messages', () => {
      const error = new Error('File too large for this format');
      const guidance = recovery.analyzeError(error);
      expect(guidance.category).toBe('file_size');
    });

    it('should include user-friendly message', () => {
      const error = new Error('API quota exceeded');
      const guidance = recovery.analyzeError(error);
      expect(guidance.userMessage).toContain('API');
    });

    it('should include technical details with stack trace', () => {
      const error = new Error('Test error');
      const guidance = recovery.analyzeError(error, { userId: 123 });
      expect(guidance.technicalDetails).toContain('Test error');
      expect(guidance.technicalDetails).toContain('userId');
    });

    it('should include recovery strategies', () => {
      const error = new Error('Network connection failed');
      const guidance = recovery.analyzeError(error);
      expect(guidance.recoveryStrategies.length).toBeGreaterThan(0);
    });

    it('should include prevention tips', () => {
      const error = new Error('Memory heap exhausted');
      const guidance = recovery.analyzeError(error);
      expect(guidance.preventionTips.length).toBeGreaterThan(0);
    });

    it('should include documentation links', () => {
      const error = new Error('Test error');
      const guidance = recovery.analyzeError(error);
      expect(guidance.documentationLinks.length).toBe(3);
      expect(guidance.documentationLinks[0]).toContain('/docs/troubleshooting/');
    });

    it('should record error in history', () => {
      const error = new Error('Test error');
      recovery.analyzeError(error);
      const stats = recovery.getErrorStatistics();
      expect(stats.total).toBe(1);
    });
  });

  describe('attemptRecovery', () => {
    it('should return failure when no automated strategies exist', async () => {
      const error = new Error('Unsupported format');
      const guidance = recovery.analyzeError(error);
      // file_format has no automated strategies
      const result = await recovery.attemptRecovery(guidance, async () => 1);
      expect(result.success).toBe(false);
    });

    it('should succeed when retry function works', async () => {
      const error = new Error('Network connection failed');
      const guidance = recovery.analyzeError(error);
      const result = await recovery.attemptRecovery(guidance, async () => 'ok');
      expect(result.success).toBe(true);
      expect(result.result).toBe('ok');
    });

    it('should mark error as recovered in history on success', async () => {
      const error = new Error('Layout overlap detected');
      recovery.analyzeError(error);
      const guidance = recovery.analyzeError(new Error('Layout overlap detected'));
      await recovery.attemptRecovery(guidance, async () => 'ok');
      const stats = recovery.getErrorStatistics();
      expect(stats.recoveryRate).toBeGreaterThan(0);
    });

    it('should fail when single automated strategy fails', async () => {
      const error = new Error('Memory heap exhausted');
      const guidance = recovery.analyzeError(error);
      // memory category has only 1 automated strategy
      const result = await recovery.attemptRecovery(guidance, async () => {
        throw new Error('still failing');
      });
      expect(result.success).toBe(false);
    });

    it('should return failure when all strategies fail', async () => {
      const error = new Error('Network error');
      const guidance = recovery.analyzeError(error);
      const result = await recovery.attemptRecovery(guidance, async () => {
        throw new Error('permanent failure');
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should log errors when strategies fail (not silently swallow)', async () => {
      const error = new Error('Network connection failed');
      const guidance = recovery.analyzeError(error);
      const loggerSpy = jest.spyOn(require('@/utils/logger').logger, 'error');

      await recovery.attemptRecovery(guidance, async () => {
        throw new Error('strategy failed');
      });

      expect(loggerSpy).toHaveBeenCalled();
      expect(loggerSpy.mock.calls[0][0]).toContain('[UserGuidedRecovery]');
      loggerSpy.mockRestore();
    });
  });

  describe('selectRecoveryStrategy', () => {
    it('should return undefined for empty strategies', () => {
      const guidance: ErrorGuidance = {
        error: new Error('test'),
        category: 'unknown',
        severity: 'low',
        userMessage: '',
        technicalDetails: '',
        recoveryStrategies: [],
        preventionTips: [],
        documentationLinks: [],
      };
      expect(recovery.selectRecoveryStrategy(guidance)).toBeUndefined();
    });

    it('should select automated strategy in auto mode', () => {
      const error = new Error('Network connection failed');
      const guidance = recovery.analyzeError(error);
      const selected = recovery.selectRecoveryStrategy(guidance, 'auto');
      expect(selected?.automated).toBe(true);
    });

    it('should select manual strategy in manual mode', () => {
      const error = new Error('Unsupported file format');
      const guidance = recovery.analyzeError(error);
      const selected = recovery.selectRecoveryStrategy(guidance, 'manual');
      expect(selected?.automated).toBe(false);
    });

    it('should select highest success rate in best mode', () => {
      const error = new Error('File is too large');
      const guidance = recovery.analyzeError(error);
      const selected = recovery.selectRecoveryStrategy(guidance, 'best');
      // compress_audio has 0.90, split_audio has 0.85
      expect(selected?.successRate).toBe(0.90);
    });

    it('should fall back to all strategies when filter yields nothing', () => {
      const error = new Error('Unsupported file format');
      const guidance = recovery.analyzeError(error);
      // file_format has only manual strategies, so auto filter yields nothing
      const selected = recovery.selectRecoveryStrategy(guidance, 'auto');
      expect(selected).toBeDefined();
    });
  });

  describe('getErrorStatistics', () => {
    it('should return zero stats for fresh instance', () => {
      const stats = recovery.getErrorStatistics();
      expect(stats.total).toBe(0);
      expect(stats.recoveryRate).toBe(0);
      expect(stats.mostCommon).toBe('unknown');
    });

    it('should count errors by category', () => {
      recovery.analyzeError(new Error('Network error'));
      recovery.analyzeError(new Error('Network fetch failed'));
      recovery.analyzeError(new Error('API key invalid'));
      const stats = recovery.getErrorStatistics();
      expect(stats.total).toBe(3);
      expect(stats.byCategory['network']).toBe(2);
      expect(stats.byCategory['api']).toBe(1);
      expect(stats.mostCommon).toBe('network');
    });

    it('should calculate recovery rate', async () => {
      const guidance1 = recovery.analyzeError(new Error('Layout overlap detected'));
      await recovery.attemptRecovery(guidance1, async () => 'ok');
      recovery.analyzeError(new Error('Another layout overlap'));
      const stats = recovery.getErrorStatistics();
      expect(stats.total).toBe(2);
      expect(stats.recoveryRate).toBe(0.5);
    });
  });

  describe('severity assessment', () => {
    it('should assign critical to memory errors', () => {
      const guidance = recovery.analyzeError(new Error('heap overflow'));
      expect(guidance.severity).toBe('critical');
    });

    it('should assign critical to api errors', () => {
      const guidance = recovery.analyzeError(new Error('API quota exceeded'));
      expect(guidance.severity).toBe('critical');
    });

    it('should assign high to transcription errors', () => {
      const guidance = recovery.analyzeError(new Error('transcription service unavailable'));
      expect(guidance.severity).toBe('high');
    });

    it('should assign high to analysis errors', () => {
      const guidance = recovery.analyzeError(new Error('gemini model error'));
      expect(guidance.severity).toBe('high');
    });

    it('should assign medium to rendering errors', () => {
      const guidance = recovery.analyzeError(new Error('render pipeline crashed'));
      expect(guidance.severity).toBe('medium');
    });

    it('should assign medium to timeout errors', () => {
      const guidance = recovery.analyzeError(new Error('Request timed out'));
      expect(guidance.severity).toBe('medium');
    });

    it('should assign low to file_format errors', () => {
      const guidance = recovery.analyzeError(new Error('unsupported format'));
      expect(guidance.severity).toBe('low');
    });

    it('should assign low to file_size errors', () => {
      const guidance = recovery.analyzeError(new Error('file size exceeds limit'));
      expect(guidance.severity).toBe('low');
    });

    it('should assign low to unknown errors', () => {
      const guidance = recovery.analyzeError(new Error('something completely weird'));
      expect(guidance.severity).toBe('low');
    });
  });

  describe('recovery strategies coverage', () => {
    const categories: Array<{ keyword: string; expectedCategory: string }> = [
      { keyword: 'file format unsupported', expectedCategory: 'file_format' },
      { keyword: 'file size too large', expectedCategory: 'file_size' },
      { keyword: 'transcription whisper error', expectedCategory: 'transcription' },
      { keyword: 'gemini analysis failed', expectedCategory: 'analysis' },
      { keyword: 'layout overlap', expectedCategory: 'layout' },
      { keyword: 'video render error', expectedCategory: 'rendering' },
      { keyword: 'api key invalid', expectedCategory: 'api' },
      { keyword: 'network connection failed', expectedCategory: 'network' },
      { keyword: 'memory heap exhausted', expectedCategory: 'memory' },
      { keyword: 'operation timed out', expectedCategory: 'timeout' },
    ];

    categories.forEach(({ keyword, expectedCategory }) => {
      it(`should provide at least one recovery strategy for ${expectedCategory}`, () => {
        const guidance = recovery.analyzeError(new Error(keyword));
        expect(guidance.recoveryStrategies.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('user message format', () => {
    it('should include emoji prefix in all messages', () => {
      const categories = [
        'unsupported format',
        'file size exceeds',
        'whisper transcription failed',
        'gemini analysis error',
        'layout overlap',
        'render video failed',
        'api key error',
        'network connection error',
        'memory heap error',
        'timed out',
        'something weird',
      ];
      categories.forEach((msg) => {
        const guidance = recovery.analyzeError(new Error(msg));
        expect(guidance.userMessage).toMatch(/^❌/);
      });
    });

    it('should include original error message for unknown category', () => {
      const error = new Error('quantum decoherence');
      const guidance = recovery.analyzeError(error);
      expect(guidance.userMessage).toContain('quantum decoherence');
    });
  });
});
