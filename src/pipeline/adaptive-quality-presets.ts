/**
 * Phase 37: Adaptive Quality Presets System
 *
 * Provides intelligent quality/speed tradeoffs for different use cases:
 * - Fast: Quick processing for rapid prototyping
 * - Balanced: Optimal quality/speed ratio (default)
 * - Quality: Maximum quality for production outputs
 * - Custom: User-defined parameters
 *
 * Custom Instructions Alignment:
 * - Section 5.1: Quality Metrics - Configurable thresholds
 * - Section 8: Performance Optimization - Adaptive processing
 * - Section 9.2: Continuous Improvement - User flexibility
 */

import type { SimplePipelineInput } from './simple-pipeline';

export type QualityPreset = 'fast' | 'balanced' | 'quality' | 'custom';

export interface PresetConfiguration {
  name: QualityPreset;
  description: string;
  targetProcessingTime: number; // seconds
  parameters: {
    // Transcription settings
    transcriptionModel: 'tiny' | 'base' | 'small' | 'medium';
    combineSegmentsMs: number;

    // Analysis settings
    minSceneLength: number;
    maxSceneLength: number;
    confidenceThreshold: number;
    enableParallelProcessing: boolean;
    maxConcurrency: number;

    // LLM settings
    llmTemperature: number;
    llmMaxTokens: number;
    llmTimeout: number;
    enableLLMCache: boolean;

    // Layout settings
    layoutQuality: 'standard' | 'enhanced' | 'zero_overlap';
    layoutMaxIterations: number;
    overlapTolerance: 'strict' | 'balanced' | 'performance';

    // Video settings
    videoResolution: '720p' | '1080p' | '4k';
    videoFps: 24 | 30 | 60;
    videoQuality: 'draft' | 'good' | 'high' | 'best';
  };
  expectedMetrics: {
    processingTimeRange: [number, number]; // [min, max] in seconds
    qualityScoreMin: number;
    memoryUsageMax: number; // MB
    accuracyMin: number;
  };
}

/**
 * Predefined quality presets
 */
export const QUALITY_PRESETS: Record<QualityPreset, PresetConfiguration> = {
  fast: {
    name: 'fast',
    description: 'Quick processing for rapid prototyping and testing',
    targetProcessingTime: 20,
    parameters: {
      transcriptionModel: 'tiny',
      combineSegmentsMs: 500,
      minSceneLength: 20,
      maxSceneLength: 120,
      confidenceThreshold: 0.5,
      enableParallelProcessing: true,
      maxConcurrency: 8,
      llmTemperature: 0.2,
      llmMaxTokens: 1024,
      llmTimeout: 5000,
      enableLLMCache: true,
      layoutQuality: 'standard',
      layoutMaxIterations: 5,
      overlapTolerance: 'performance',
      videoResolution: '720p',
      videoFps: 24,
      videoQuality: 'draft',
    },
    expectedMetrics: {
      processingTimeRange: [10, 30],
      qualityScoreMin: 70,
      memoryUsageMax: 256,
      accuracyMin: 0.75,
    },
  },

  balanced: {
    name: 'balanced',
    description: 'Optimal balance between quality and speed (recommended)',
    targetProcessingTime: 60,
    parameters: {
      transcriptionModel: 'base',
      combineSegmentsMs: 200,
      minSceneLength: 30,
      maxSceneLength: 180,
      confidenceThreshold: 0.6,
      enableParallelProcessing: true,
      maxConcurrency: 4,
      llmTemperature: 0.1,
      llmMaxTokens: 2048,
      llmTimeout: 10000,
      enableLLMCache: true,
      layoutQuality: 'enhanced',
      layoutMaxIterations: 10,
      overlapTolerance: 'balanced',
      videoResolution: '1080p',
      videoFps: 30,
      videoQuality: 'good',
    },
    expectedMetrics: {
      processingTimeRange: [40, 80],
      qualityScoreMin: 85,
      memoryUsageMax: 512,
      accuracyMin: 0.85,
    },
  },

  quality: {
    name: 'quality',
    description: 'Maximum quality for production outputs',
    targetProcessingTime: 120,
    parameters: {
      transcriptionModel: 'small',
      combineSegmentsMs: 100,
      minSceneLength: 40,
      maxSceneLength: 240,
      confidenceThreshold: 0.7,
      enableParallelProcessing: true,
      maxConcurrency: 2,
      llmTemperature: 0.05,
      llmMaxTokens: 4096,
      llmTimeout: 20000,
      enableLLMCache: true,
      layoutQuality: 'zero_overlap',
      layoutMaxIterations: 20,
      overlapTolerance: 'strict',
      videoResolution: '1080p',
      videoFps: 60,
      videoQuality: 'best',
    },
    expectedMetrics: {
      processingTimeRange: [90, 180],
      qualityScoreMin: 95,
      memoryUsageMax: 1024,
      accuracyMin: 0.92,
    },
  },

  custom: {
    name: 'custom',
    description: 'User-defined custom parameters',
    targetProcessingTime: 60,
    parameters: {
      transcriptionModel: 'base',
      combineSegmentsMs: 200,
      minSceneLength: 30,
      maxSceneLength: 180,
      confidenceThreshold: 0.6,
      enableParallelProcessing: true,
      maxConcurrency: 4,
      llmTemperature: 0.1,
      llmMaxTokens: 2048,
      llmTimeout: 10000,
      enableLLMCache: true,
      layoutQuality: 'enhanced',
      layoutMaxIterations: 10,
      overlapTolerance: 'balanced',
      videoResolution: '1080p',
      videoFps: 30,
      videoQuality: 'high',
    },
    expectedMetrics: {
      processingTimeRange: [30, 120],
      qualityScoreMin: 80,
      memoryUsageMax: 768,
      accuracyMin: 0.80,
    },
  },
};

/**
 * Adaptive Quality Presets Manager
 */
export class AdaptiveQualityPresetsManager {
  private currentPreset: QualityPreset = 'balanced';
  private customOverrides: Partial<PresetConfiguration['parameters']> = {};

  /**
   * Set quality preset
   */
  setPreset(preset: QualityPreset): void {
    if (!QUALITY_PRESETS[preset]) {
      throw new Error(`Invalid preset: ${preset}`);
    }
    this.currentPreset = preset;
    console.log(`🎯 Phase 37: Quality preset set to "${preset}"`);
    console.log(`   Target processing time: ${QUALITY_PRESETS[preset].targetProcessingTime}s`);
    console.log(`   Expected quality score: ≥${QUALITY_PRESETS[preset].expectedMetrics.qualityScoreMin}`);
  }

  /**
   * Get current preset configuration
   */
  getCurrentPreset(): PresetConfiguration {
    return QUALITY_PRESETS[this.currentPreset];
  }

  /**
   * Override specific parameters (for custom preset)
   */
  setCustomOverrides(overrides: Partial<PresetConfiguration['parameters']>): void {
    this.customOverrides = overrides;
    this.currentPreset = 'custom';
    console.log(`🔧 Phase 37: Custom overrides applied:`, Object.keys(overrides));
  }

  /**
   * Clear custom overrides
   */
  clearCustomOverrides(): void {
    this.customOverrides = {};
    if (this.currentPreset === 'custom') {
      this.currentPreset = 'balanced';
    }
  }

  /**
   * Convert preset to SimplePipelineInput options
   */
  toPipelineOptions(audioFile: File): SimplePipelineInput {
    const preset = QUALITY_PRESETS[this.currentPreset];
    const params = { ...preset.parameters, ...this.customOverrides };

    return {
      audioFile,
      options: {
        language: 'auto',
        layoutType: 'auto',
        includeVideoGeneration: true,
        maxConcurrency: params.maxConcurrency,
        enableParallelProcessing: params.enableParallelProcessing,
        layoutQuality: params.layoutQuality,
        videoOptions: {
          outputFormat: 'mp4',
          quality: params.videoQuality,
          resolution: params.videoResolution,
          fps: params.videoFps,
          includeAudio: true,
        },
      },
    };
  }

  /**
   * Auto-select preset based on file characteristics
   */
  autoSelectPreset(audioFile: File): QualityPreset {
    const fileSizeMB = audioFile.size / (1024 * 1024);

    // Auto-selection logic based on file size
    if (fileSizeMB < 1) {
      console.log(`🤖 Phase 37: Auto-selected "fast" preset (file size: ${fileSizeMB.toFixed(2)} MB)`);
      return 'fast';
    } else if (fileSizeMB < 10) {
      console.log(`🤖 Phase 37: Auto-selected "balanced" preset (file size: ${fileSizeMB.toFixed(2)} MB)`);
      return 'balanced';
    } else {
      console.log(`🤖 Phase 37: Auto-selected "quality" preset (file size: ${fileSizeMB.toFixed(2)} MB)`);
      return 'quality';
    }
  }

  /**
   * Validate if processing meets preset expectations
   */
  validateResult(
    processingTime: number,
    qualityScore: number,
    memoryUsageMB: number
  ): {
    meetsExpectations: boolean;
    violations: string[];
    suggestions: string[];
  } {
    const preset = QUALITY_PRESETS[this.currentPreset];
    const violations: string[] = [];
    const suggestions: string[] = [];

    // Check processing time
    const [minTime, maxTime] = preset.expectedMetrics.processingTimeRange;
    if (processingTime > maxTime) {
      violations.push(`Processing time ${processingTime}s exceeded expected max ${maxTime}s`);
      suggestions.push('Consider switching to "fast" preset for quicker results');
    }

    // Check quality score
    if (qualityScore < preset.expectedMetrics.qualityScoreMin) {
      violations.push(
        `Quality score ${qualityScore.toFixed(1)} below expected min ${preset.expectedMetrics.qualityScoreMin}`
      );
      suggestions.push('Consider switching to "quality" preset for better results');
    }

    // Check memory usage
    if (memoryUsageMB > preset.expectedMetrics.memoryUsageMax) {
      violations.push(
        `Memory usage ${memoryUsageMB.toFixed(1)}MB exceeded expected max ${preset.expectedMetrics.memoryUsageMax}MB`
      );
      suggestions.push('Consider processing smaller audio files or using "fast" preset');
    }

    return {
      meetsExpectations: violations.length === 0,
      violations,
      suggestions,
    };
  }

  /**
   * Get preset comparison table
   */
  getPresetComparison(): Array<{
    preset: QualityPreset;
    processingTime: string;
    quality: string;
    memory: string;
    useCase: string;
  }> {
    return [
      {
        preset: 'fast',
        processingTime: '10-30s',
        quality: '70+ (Good)',
        memory: '<256MB',
        useCase: 'Rapid prototyping, testing',
      },
      {
        preset: 'balanced',
        processingTime: '40-80s',
        quality: '85+ (Excellent)',
        memory: '<512MB',
        useCase: 'General use (recommended)',
      },
      {
        preset: 'quality',
        processingTime: '90-180s',
        quality: '95+ (Outstanding)',
        memory: '<1024MB',
        useCase: 'Production outputs',
      },
      {
        preset: 'custom',
        processingTime: 'Variable',
        quality: 'Variable',
        memory: 'Variable',
        useCase: 'Fine-tuned control',
      },
    ];
  }

  /**
   * Get current preset summary
   */
  getPresetSummary(): string {
    const preset = QUALITY_PRESETS[this.currentPreset];
    return `
📊 Current Preset: ${preset.name.toUpperCase()}
${preset.description}

⏱️  Target Processing Time: ${preset.targetProcessingTime}s
📈 Expected Quality: ≥${preset.expectedMetrics.qualityScoreMin}
💾 Memory Limit: ${preset.expectedMetrics.memoryUsageMax}MB
🎯 Min Accuracy: ${(preset.expectedMetrics.accuracyMin * 100).toFixed(0)}%

🔧 Key Settings:
   - Transcription: ${preset.parameters.transcriptionModel}
   - Layout: ${preset.parameters.layoutQuality}
   - Video: ${preset.parameters.videoResolution} @ ${preset.parameters.videoFps}fps
   - Parallel: ${preset.parameters.enableParallelProcessing ? `Yes (${preset.parameters.maxConcurrency} concurrent)` : 'No'}
`;
  }
}

// Export singleton instance
export const adaptiveQualityPresets = new AdaptiveQualityPresetsManager();
