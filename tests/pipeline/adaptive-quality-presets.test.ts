import {
  AdaptiveQualityPresetsManager,
  QUALITY_PRESETS,
  type QualityPreset,
} from '@/pipeline/adaptive-quality-presets';

// ---------------------------------------------------------------------------
// QUALITY_PRESETS constant
// ---------------------------------------------------------------------------

describe('QUALITY_PRESETS', () => {
  const presets: QualityPreset[] = ['fast', 'balanced', 'quality', 'custom'];

  it('defines all four presets', () => {
    for (const p of presets) {
      expect(QUALITY_PRESETS[p]).toBeDefined();
      expect(QUALITY_PRESETS[p].name).toBe(p);
    }
  });

  it('each preset has expected parameter fields', () => {
    for (const p of presets) {
      const params = QUALITY_PRESETS[p].parameters;
      expect(typeof params.transcriptionModel).toBe('string');
      expect(typeof params.maxConcurrency).toBe('number');
      expect(typeof params.videoFps).toBe('number');
      expect(typeof params.enableParallelProcessing).toBe('boolean');
    }
  });

  it('each preset has expected metrics fields', () => {
    for (const p of presets) {
      const m = QUALITY_PRESETS[p].expectedMetrics;
      expect(m.processingTimeRange).toHaveLength(2);
      expect(m.processingTimeRange[0]).toBeLessThanOrEqual(m.processingTimeRange[1]);
      expect(m.qualityScoreMin).toBeGreaterThan(0);
      expect(m.memoryUsageMax).toBeGreaterThan(0);
      expect(m.accuracyMin).toBeGreaterThan(0);
      expect(m.accuracyMin).toBeLessThanOrEqual(1);
    }
  });

  it('fast preset is faster than quality preset', () => {
    expect(QUALITY_PRESETS.fast.targetProcessingTime)
      .toBeLessThan(QUALITY_PRESETS.quality.targetProcessingTime);
  });

  it('quality preset demands higher accuracy than fast preset', () => {
    expect(QUALITY_PRESETS.quality.expectedMetrics.accuracyMin)
      .toBeGreaterThan(QUALITY_PRESETS.fast.expectedMetrics.accuracyMin);
  });
});

// ---------------------------------------------------------------------------
// AdaptiveQualityPresetsManager
// ---------------------------------------------------------------------------

describe('AdaptiveQualityPresetsManager', () => {
  let manager: AdaptiveQualityPresetsManager;

  beforeEach(() => {
    manager = new AdaptiveQualityPresetsManager();
  });

  // --- setPreset / getCurrentPreset ---

  describe('setPreset / getCurrentPreset', () => {
    it('defaults to balanced', () => {
      expect(manager.getCurrentPreset().name).toBe('balanced');
    });

    it('switches to each valid preset', () => {
      for (const p of ['fast', 'quality', 'custom'] as QualityPreset[]) {
        manager.setPreset(p);
        expect(manager.getCurrentPreset().name).toBe(p);
      }
    });

    it('throws for invalid preset name', () => {
      expect(() => manager.setPreset('invalid' as QualityPreset)).toThrow('Invalid preset');
    });
  });

  // --- setCustomOverrides ---

  describe('setCustomOverrides', () => {
    it('switches to custom preset', () => {
      manager.setCustomOverrides({ maxConcurrency: 2 });
      expect(manager.getCurrentPreset().name).toBe('custom');
    });

    it('custom preset returns correct parameter base values', () => {
      manager.setCustomOverrides({ maxConcurrency: 2 });
      const preset = manager.getCurrentPreset();
      // getCurrentPreset returns the static QUALITY_PRESETS.custom entry
      expect(preset.name).toBe('custom');
      expect(preset.parameters.maxConcurrency).toBe(4); // static default, not the override
    });
  });

  // --- clearCustomOverrides ---

  describe('clearCustomOverrides', () => {
    it('resets to balanced when current preset is custom', () => {
      manager.setCustomOverrides({ maxConcurrency: 1 });
      expect(manager.getCurrentPreset().name).toBe('custom');
      manager.clearCustomOverrides();
      expect(manager.getCurrentPreset().name).toBe('balanced');
    });

    it('does not change preset when current is not custom', () => {
      manager.setPreset('fast');
      manager.clearCustomOverrides();
      expect(manager.getCurrentPreset().name).toBe('fast');
    });
  });

  // --- autoSelectPreset ---

  describe('autoSelectPreset', () => {
    function mockFile(sizeBytes: number): File {
      return { size: sizeBytes } as File;
    }

    it('selects fast for files under 1 MB', () => {
      expect(manager.autoSelectPreset(mockFile(500 * 1024))).toBe('fast');
    });

    it('selects balanced for files between 1 MB and 10 MB', () => {
      expect(manager.autoSelectPreset(mockFile(5 * 1024 * 1024))).toBe('balanced');
    });

    it('selects quality for files over 10 MB', () => {
      expect(manager.autoSelectPreset(mockFile(20 * 1024 * 1024))).toBe('quality');
    });
  });

  // --- validateResult ---

  describe('validateResult', () => {
    it('passes when metrics are within expected ranges', () => {
      manager.setPreset('balanced');
      const result = manager.validateResult(50, 90, 300);
      expect(result.meetsExpectations).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('reports processing time violation', () => {
      manager.setPreset('balanced');
      const result = manager.validateResult(200, 90, 300);
      expect(result.meetsExpectations).toBe(false);
      expect(result.violations.some(v => v.includes('Processing time'))).toBe(true);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('reports quality score violation', () => {
      manager.setPreset('balanced');
      const result = manager.validateResult(50, 50, 300);
      expect(result.meetsExpectations).toBe(false);
      expect(result.violations.some(v => v.includes('Quality score'))).toBe(true);
    });

    it('reports memory usage violation', () => {
      manager.setPreset('balanced');
      const result = manager.validateResult(50, 90, 999);
      expect(result.meetsExpectations).toBe(false);
      expect(result.violations.some(v => v.includes('Memory usage'))).toBe(true);
    });

    it('reports multiple violations at once', () => {
      manager.setPreset('balanced');
      const result = manager.validateResult(200, 50, 999);
      expect(result.violations.length).toBeGreaterThanOrEqual(2);
    });
  });

  // --- getPresetComparison ---

  describe('getPresetComparison', () => {
    it('returns comparison for all 4 presets', () => {
      const table = manager.getPresetComparison();
      expect(table).toHaveLength(4);
      const names = table.map(r => r.preset).sort();
      expect(names).toEqual(['balanced', 'custom', 'fast', 'quality']);
    });

    it('each entry has all display fields', () => {
      for (const entry of manager.getPresetComparison()) {
        expect(entry.processingTime).toBeDefined();
        expect(entry.quality).toBeDefined();
        expect(entry.memory).toBeDefined();
        expect(entry.useCase).toBeDefined();
      }
    });
  });

  // --- getPresetSummary ---

  describe('getPresetSummary', () => {
    it('includes the preset name in uppercase', () => {
      manager.setPreset('fast');
      const summary = manager.getPresetSummary();
      expect(summary).toContain('FAST');
    });

    it('includes target processing time', () => {
      const summary = manager.getPresetSummary();
      expect(summary).toContain('Target Processing Time');
    });
  });
});
