/**
 * Tests for AdaptiveQualityPresetsManager
 * Covers: setPreset, getCurrentPreset, setCustomOverrides, clearCustomOverrides,
 *         toPipelineOptions, autoSelectPreset, validateResult,
 *         getPresetComparison, getPresetSummary, QUALITY_PRESETS
 */

import {
  AdaptiveQualityPresetsManager,
  adaptiveQualityPresets,
  QUALITY_PRESETS,
  QualityPreset,
} from '../adaptive-quality-presets';

// Suppress console
beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
});

// Helper to create a mock File
function createMockFile(sizeInBytes: number, name: string = 'test.wav'): File {
  return new File(['x'.repeat(sizeInBytes)], name, { type: 'audio/wav' });
}

describe('QUALITY_PRESETS', () => {
  it('should have all four presets defined', () => {
    expect(QUALITY_PRESETS.fast).toBeDefined();
    expect(QUALITY_PRESETS.balanced).toBeDefined();
    expect(QUALITY_PRESETS.quality).toBeDefined();
    expect(QUALITY_PRESETS.custom).toBeDefined();
  });

  it('should have correct preset names', () => {
    expect(QUALITY_PRESETS.fast.name).toBe('fast');
    expect(QUALITY_PRESETS.balanced.name).toBe('balanced');
    expect(QUALITY_PRESETS.quality.name).toBe('quality');
    expect(QUALITY_PRESETS.custom.name).toBe('custom');
  });

  it('should have all required fields in each preset', () => {
    for (const preset of Object.values(QUALITY_PRESETS)) {
      expect(preset).toHaveProperty('name');
      expect(preset).toHaveProperty('description');
      expect(preset).toHaveProperty('targetProcessingTime');
      expect(preset).toHaveProperty('parameters');
      expect(preset).toHaveProperty('expectedMetrics');
      expect(preset.parameters).toHaveProperty('transcriptionModel');
      expect(preset.parameters).toHaveProperty('videoResolution');
      expect(preset.parameters).toHaveProperty('videoFps');
      expect(preset.parameters).toHaveProperty('videoQuality');
      expect(preset.expectedMetrics).toHaveProperty('processingTimeRange');
      expect(preset.expectedMetrics).toHaveProperty('qualityScoreMin');
      expect(preset.expectedMetrics).toHaveProperty('memoryUsageMax');
      expect(preset.expectedMetrics).toHaveProperty('accuracyMin');
    }
  });

  it('should have increasing processing time from fast to quality', () => {
    expect(QUALITY_PRESETS.fast.targetProcessingTime).toBeLessThan(QUALITY_PRESETS.balanced.targetProcessingTime);
    expect(QUALITY_PRESETS.balanced.targetProcessingTime).toBeLessThan(QUALITY_PRESETS.quality.targetProcessingTime);
  });

  it('should have increasing quality score minimums from fast to quality', () => {
    expect(QUALITY_PRESETS.fast.expectedMetrics.qualityScoreMin).toBeLessThan(QUALITY_PRESETS.balanced.expectedMetrics.qualityScoreMin);
    expect(QUALITY_PRESETS.balanced.expectedMetrics.qualityScoreMin).toBeLessThan(QUALITY_PRESETS.quality.expectedMetrics.qualityScoreMin);
  });
});

describe('AdaptiveQualityPresetsManager', () => {
  let manager: AdaptiveQualityPresetsManager;

  beforeEach(() => {
    manager = new AdaptiveQualityPresetsManager();
  });

  // --- setPreset ---

  describe('setPreset', () => {
    it('should set preset to fast', () => {
      expect(() => manager.setPreset('fast')).not.toThrow();
      expect(manager.getCurrentPreset().name).toBe('fast');
    });

    it('should set preset to balanced', () => {
      manager.setPreset('balanced');
      expect(manager.getCurrentPreset().name).toBe('balanced');
    });

    it('should set preset to quality', () => {
      manager.setPreset('quality');
      expect(manager.getCurrentPreset().name).toBe('quality');
    });

    it('should set preset to custom', () => {
      manager.setPreset('custom');
      expect(manager.getCurrentPreset().name).toBe('custom');
    });

    it('should throw for invalid preset', () => {
      expect(() => manager.setPreset('invalid' as QualityPreset)).toThrow('Invalid preset: invalid');
    });

    it('should throw for undefined preset', () => {
      expect(() => manager.setPreset(undefined as unknown as QualityPreset)).toThrow();
    });
  });

  // --- getCurrentPreset ---

  describe('getCurrentPreset', () => {
    it('should return balanced by default', () => {
      const preset = manager.getCurrentPreset();
      expect(preset.name).toBe('balanced');
    });

    it('should return the last set preset', () => {
      manager.setPreset('fast');
      expect(manager.getCurrentPreset().name).toBe('fast');

      manager.setPreset('quality');
      expect(manager.getCurrentPreset().name).toBe('quality');
    });
  });

  // --- setCustomOverrides ---

  describe('setCustomOverrides', () => {
    it('should apply custom overrides and switch to custom preset', () => {
      manager.setCustomOverrides({
        videoResolution: '4k',
        videoFps: 60,
        videoQuality: 'best',
      });

      expect(manager.getCurrentPreset().name).toBe('custom');
    });

    it('should merge overrides with current preset parameters in toPipelineOptions', () => {
      manager.setCustomOverrides({
        maxConcurrency: 8,
        videoResolution: '4k',
      });

      const file = createMockFile(1000);
      const options = manager.toPipelineOptions(file);
      expect(options.options.maxConcurrency).toBe(8);
    });

    it('should accept empty overrides', () => {
      manager.setCustomOverrides({});
      expect(manager.getCurrentPreset().name).toBe('custom');
    });
  });

  // --- clearCustomOverrides ---

  describe('clearCustomOverrides', () => {
    it('should clear overrides and revert to balanced from custom', () => {
      manager.setCustomOverrides({ videoResolution: '4k' });
      expect(manager.getCurrentPreset().name).toBe('custom');

      manager.clearCustomOverrides();
      expect(manager.getCurrentPreset().name).toBe('balanced');
    });

    it('should not change preset if not on custom', () => {
      manager.setPreset('fast');
      manager.clearCustomOverrides();
      expect(manager.getCurrentPreset().name).toBe('fast');
    });
  });

  // --- toPipelineOptions ---

  describe('toPipelineOptions', () => {
    it('should convert balanced preset to pipeline options', () => {
      const file = createMockFile(5000);
      const options = manager.toPipelineOptions(file);

      expect(options.audioFile).toBe(file);
      expect(options.options.language).toBe('auto');
      expect(options.options.layoutType).toBe('auto');
      expect(options.options.includeVideoGeneration).toBe(true);
      expect(options.options.videoOptions).toBeDefined();
      expect(options.options.videoOptions.outputFormat).toBe('mp4');
      expect(options.options.videoOptions.includeAudio).toBe(true);
    });

    it('should use fast preset settings', () => {
      manager.setPreset('fast');
      const file = createMockFile(500);
      const options = manager.toPipelineOptions(file);

      expect(options.options.maxConcurrency).toBe(QUALITY_PRESETS.fast.parameters.maxConcurrency);
      expect(options.options.enableParallelProcessing).toBe(true);
    });

    it('should use quality preset settings', () => {
      manager.setPreset('quality');
      const file = createMockFile(20000);
      const options = manager.toPipelineOptions(file);

      expect(options.options.maxConcurrency).toBe(QUALITY_PRESETS.quality.parameters.maxConcurrency);
    });

    it('should apply custom overrides on top of preset', () => {
      manager.setPreset('balanced');
      manager.setCustomOverrides({ maxConcurrency: 16, videoResolution: '4k' });
      const file = createMockFile(5000);
      const options = manager.toPipelineOptions(file);

      expect(options.options.maxConcurrency).toBe(16);
      expect(options.options.videoOptions.resolution).toBe('4k');
    });
  });

  // --- autoSelectPreset ---

  describe('autoSelectPreset', () => {
    it('should select fast for files < 1MB', () => {
      const file = createMockFile(500 * 1024); // 0.5 MB
      const preset = manager.autoSelectPreset(file);
      expect(preset).toBe('fast');
    });

    it('should select balanced for files 1-10MB', () => {
      const file = createMockFile(5 * 1024 * 1024); // 5 MB
      const preset = manager.autoSelectPreset(file);
      expect(preset).toBe('balanced');
    });

    it('should select quality for files >= 10MB', () => {
      const file = createMockFile(20 * 1024 * 1024); // 20 MB
      const preset = manager.autoSelectPreset(file);
      expect(preset).toBe('quality');
    });

    it('should select fast for very small files', () => {
      const file = createMockFile(100); // 100 bytes
      const preset = manager.autoSelectPreset(file);
      expect(preset).toBe('fast');
    });

    it('should select balanced for exactly 1MB', () => {
      // 1 MB file, boundary test: < 1 MB is fast, so exactly 1MB is balanced (< 10)
      const file = createMockFile(1 * 1024 * 1024);
      const preset = manager.autoSelectPreset(file);
      expect(preset).toBe('balanced');
    });

    it('should select quality for exactly 10MB', () => {
      // 10 MB file: not < 10, so falls to else -> quality
      const file = createMockFile(10 * 1024 * 1024);
      const preset = manager.autoSelectPreset(file);
      expect(preset).toBe('quality');
    });
  });

  // --- validateResult ---

  describe('validateResult', () => {
    it('should pass for results within expectations (balanced)', () => {
      manager.setPreset('balanced');
      const result = manager.validateResult(60, 90, 300);
      expect(result.meetsExpectations).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.suggestions).toHaveLength(0);
    });

    it('should fail for processing time exceeding max', () => {
      manager.setPreset('balanced');
      const result = manager.validateResult(100, 90, 300);
      expect(result.meetsExpectations).toBe(false);
      expect(result.violations.some(v => v.includes('Processing time'))).toBe(true);
      expect(result.suggestions.some(s => s.includes('fast'))).toBe(true);
    });

    it('should fail for quality score below minimum', () => {
      manager.setPreset('balanced');
      const result = manager.validateResult(60, 70, 300);
      expect(result.meetsExpectations).toBe(false);
      expect(result.violations.some(v => v.includes('Quality score'))).toBe(true);
      expect(result.suggestions.some(s => s.includes('quality'))).toBe(true);
    });

    it('should fail for memory usage exceeding max', () => {
      manager.setPreset('balanced');
      const result = manager.validateResult(60, 90, 700);
      expect(result.meetsExpectations).toBe(false);
      expect(result.violations.some(v => v.includes('Memory usage'))).toBe(true);
      expect(result.suggestions.some(s => s.includes('fast'))).toBe(true);
    });

    it('should report multiple violations simultaneously', () => {
      manager.setPreset('balanced');
      const result = manager.validateResult(120, 60, 800);
      expect(result.meetsExpectations).toBe(false);
      expect(result.violations.length).toBe(3);
    });

    it('should validate against fast preset thresholds', () => {
      manager.setPreset('fast');
      const result = manager.validateResult(15, 75, 200);
      expect(result.meetsExpectations).toBe(true);
    });

    it('should validate against quality preset thresholds', () => {
      manager.setPreset('quality');
      const result = manager.validateResult(100, 98, 800);
      expect(result.meetsExpectations).toBe(true);
    });
  });

  // --- getPresetComparison ---

  describe('getPresetComparison', () => {
    it('should return comparison for all four presets', () => {
      const comparison = manager.getPresetComparison();
      expect(comparison).toHaveLength(4);
      expect(comparison.map(c => c.preset)).toEqual(['fast', 'balanced', 'quality', 'custom']);
    });

    it('should include required fields in each comparison entry', () => {
      const comparison = manager.getPresetComparison();
      for (const entry of comparison) {
        expect(entry).toHaveProperty('preset');
        expect(entry).toHaveProperty('processingTime');
        expect(entry).toHaveProperty('quality');
        expect(entry).toHaveProperty('memory');
        expect(entry).toHaveProperty('useCase');
      }
    });
  });

  // --- getPresetSummary ---

  describe('getPresetSummary', () => {
    it('should return summary for default balanced preset', () => {
      const summary = manager.getPresetSummary();
      expect(summary).toContain('BALANCED');
      expect(summary).toContain('Optimal balance');
      expect(summary).toContain('Target Processing Time');
      expect(summary).toContain('Expected Quality');
      expect(summary).toContain('Memory Limit');
      expect(summary).toContain('Min Accuracy');
    });

    it('should return summary for fast preset', () => {
      manager.setPreset('fast');
      const summary = manager.getPresetSummary();
      expect(summary).toContain('FAST');
    });

    it('should return summary for quality preset', () => {
      manager.setPreset('quality');
      const summary = manager.getPresetSummary();
      expect(summary).toContain('QUALITY');
    });

    it('should include key settings section', () => {
      const summary = manager.getPresetSummary();
      expect(summary).toContain('Key Settings');
      expect(summary).toContain('Transcription');
      expect(summary).toContain('Layout');
      expect(summary).toContain('Video');
    });
  });
});

// --- Module-level singleton ---

describe('module-level singleton', () => {
  it('should export adaptiveQualityPresets instance', () => {
    expect(adaptiveQualityPresets).toBeDefined();
    expect(adaptiveQualityPresets).toBeInstanceOf(AdaptiveQualityPresetsManager);
  });

  it('singleton should be usable for preset operations', () => {
    adaptiveQualityPresets.setPreset('fast');
    expect(adaptiveQualityPresets.getCurrentPreset().name).toBe('fast');

    // Reset back to balanced for other tests
    adaptiveQualityPresets.setPreset('balanced');
  });
});
