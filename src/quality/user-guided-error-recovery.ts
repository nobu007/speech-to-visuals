/**
 * Phase 37: User-Guided Error Recovery System
 *
 * Provides actionable error guidance and automatic recovery strategies:
 * - Intelligent error categorization
 * - Step-by-step recovery instructions
 * - Automatic retry with fallback strategies
 * - User-friendly error messages
 *
 * Custom Instructions Alignment:
 * - Section 8: Troubleshooting Protocol - Error handling
 * - Section 3: Execution Protocol - Error recovery
 * - Section 9.2: Continuous Improvement - User experience
 */

export type ErrorCategory =
  | 'file_format'
  | 'file_size'
  | 'transcription'
  | 'analysis'
  | 'layout'
  | 'rendering'
  | 'api'
  | 'network'
  | 'memory'
  | 'timeout'
  | 'unknown';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface RecoveryStrategy {
  id: string;
  name: string;
  description: string;
  automated: boolean;
  steps: string[];
  estimatedTime: number; // seconds
  successRate: number; // 0-1
}

export interface ErrorGuidance {
  error: Error;
  category: ErrorCategory;
  severity: ErrorSeverity;
  userMessage: string;
  technicalDetails: string;
  recoveryStrategies: RecoveryStrategy[];
  preventionTips: string[];
  documentationLinks: string[];
}

/**
 * User-Guided Error Recovery Manager
 */
export class UserGuidedErrorRecovery {
  private errorHistory: Array<{
    timestamp: string;
    category: ErrorCategory;
    message: string;
    recovered: boolean;
  }> = [];

  /**
   * Analyze error and provide guidance
   */
  analyzeError(error: Error, context?: Record<string, any>): ErrorGuidance {
    console.log(`🔍 Phase 37: Analyzing error for user guidance`);

    const category = this.categorizeError(error, context);
    const severity = this.assessSeverity(category, error);

    // Record in history
    this.errorHistory.push({
      timestamp: new Date().toISOString(),
      category,
      message: error.message,
      recovered: false,
    });

    const guidance: ErrorGuidance = {
      error,
      category,
      severity,
      userMessage: this.generateUserMessage(category, error),
      technicalDetails: this.generateTechnicalDetails(error, context),
      recoveryStrategies: this.getRecoveryStrategies(category),
      preventionTips: this.getPreventionTips(category),
      documentationLinks: this.getDocumentationLinks(category),
    };

    console.log(`   Category: ${category} (${severity} severity)`);
    console.log(`   Recovery strategies: ${guidance.recoveryStrategies.length} available`);

    return guidance;
  }

  /**
   * Attempt automatic recovery
   */
  async attemptRecovery(
    guidance: ErrorGuidance,
    retryFunction: () => Promise<any>
  ): Promise<{ success: boolean; result?: any; error?: Error }> {
    console.log(`🔄 Phase 37: Attempting automatic error recovery`);

    const automatedStrategies = guidance.recoveryStrategies.filter((s) => s.automated);

    if (automatedStrategies.length === 0) {
      console.log(`   ⚠️  No automated recovery strategies available`);
      return { success: false, error: guidance.error };
    }

    // Sort by success rate (highest first)
    automatedStrategies.sort((a, b) => b.successRate - a.successRate);

    for (const strategy of automatedStrategies) {
      console.log(`   🔧 Trying strategy: ${strategy.name}`);

      try {
        // Apply strategy (simplified for Phase 37)
        await this.applyStrategy(strategy);

        // Retry operation
        const result = await retryFunction();

        console.log(`   ✅ Recovery successful with strategy: ${strategy.name}`);

        // Mark as recovered in history
        const lastError = this.errorHistory[this.errorHistory.length - 1];
        if (lastError) {
          lastError.recovered = true;
        }

        return { success: true, result };
      } catch (error) {
        console.log(`   ❌ Strategy failed: ${strategy.name}`);
        continue;
      }
    }

    console.log(`   ❌ All automated recovery strategies failed`);
    return { success: false, error: guidance.error };
  }

  /**
   * Categorize error
   */
  private categorizeError(error: Error, context?: Record<string, any>): ErrorCategory {
    const message = error.message.toLowerCase();

    // File-related errors
    if (message.includes('file') || message.includes('format') || message.includes('unsupported')) {
      return 'file_format';
    }
    if (message.includes('too large') || message.includes('size limit')) {
      return 'file_size';
    }

    // Processing errors
    if (message.includes('transcription') || message.includes('whisper')) {
      return 'transcription';
    }
    if (message.includes('analysis') || message.includes('llm') || message.includes('gemini')) {
      return 'analysis';
    }
    if (message.includes('layout') || message.includes('overlap')) {
      return 'layout';
    }
    if (message.includes('render') || message.includes('video')) {
      return 'rendering';
    }

    // System errors
    if (message.includes('api') || message.includes('key') || message.includes('quota')) {
      return 'api';
    }
    if (message.includes('network') || message.includes('connection') || message.includes('fetch')) {
      return 'network';
    }
    if (message.includes('memory') || message.includes('heap')) {
      return 'memory';
    }
    if (message.includes('timeout') || message.includes('timed out')) {
      return 'timeout';
    }

    return 'unknown';
  }

  /**
   * Assess error severity
   */
  private assessSeverity(category: ErrorCategory, error: Error): ErrorSeverity {
    // Critical errors that block core functionality
    if (category === 'api' || category === 'memory') {
      return 'critical';
    }

    // High severity errors that significantly impact quality
    if (category === 'transcription' || category === 'analysis') {
      return 'high';
    }

    // Medium severity errors with workarounds
    if (category === 'layout' || category === 'rendering' || category === 'timeout') {
      return 'medium';
    }

    // Low severity errors with easy fixes
    return 'low';
  }

  /**
   * Generate user-friendly message
   */
  private generateUserMessage(category: ErrorCategory, error: Error): string {
    const messages: Record<ErrorCategory, string> = {
      file_format: '❌ Unsupported file format. Please upload an MP3, WAV, OGG, or M4A file.',
      file_size: '❌ File is too large. Please upload a file smaller than 50MB.',
      transcription: '❌ Audio transcription failed. The audio quality may be too low or the format may be corrupted.',
      analysis: '❌ Content analysis failed. This might be due to API rate limits or complex content.',
      layout: '❌ Diagram layout generation failed. The content structure may be too complex.',
      rendering: '❌ Video rendering failed. This might be due to insufficient system resources.',
      api: '❌ API connection failed. Please check your API key and internet connection.',
      network: '❌ Network error. Please check your internet connection and try again.',
      memory: '❌ Insufficient memory. Please try processing a smaller file.',
      timeout: '❌ Processing timed out. Please try again with a shorter audio file or "fast" preset.',
      unknown: `❌ An unexpected error occurred: ${error.message}`,
    };

    return messages[category];
  }

  /**
   * Generate technical details
   */
  private generateTechnicalDetails(error: Error, context?: Record<string, any>): string {
    let details = `Error: ${error.message}\n`;
    if (error.stack) {
      details += `\nStack Trace:\n${error.stack.split('\n').slice(0, 3).join('\n')}\n`;
    }
    if (context) {
      details += `\nContext:\n${JSON.stringify(context, null, 2)}`;
    }
    return details;
  }

  /**
   * Get recovery strategies for category
   */
  private getRecoveryStrategies(category: ErrorCategory): RecoveryStrategy[] {
    const strategies: Record<ErrorCategory, RecoveryStrategy[]> = {
      file_format: [
        {
          id: 'convert_format',
          name: 'Convert to Supported Format',
          description: 'Use online audio converter to convert to MP3 or WAV',
          automated: false,
          steps: [
            'Visit an online audio converter (e.g., CloudConvert)',
            'Upload your audio file',
            'Select MP3 or WAV as output format',
            'Download converted file',
            'Upload converted file to this system',
          ],
          estimatedTime: 120,
          successRate: 0.95,
        },
      ],
      file_size: [
        {
          id: 'compress_audio',
          name: 'Compress Audio File',
          description: 'Reduce file size by lowering bitrate or trimming duration',
          automated: false,
          steps: [
            'Use audio editing software (e.g., Audacity)',
            'Reduce bitrate to 128kbps or lower',
            'Trim unnecessary silence or sections',
            'Export with reduced quality',
            'Retry upload',
          ],
          estimatedTime: 180,
          successRate: 0.90,
        },
        {
          id: 'split_audio',
          name: 'Split Into Smaller Files',
          description: 'Split audio into multiple smaller files and process separately',
          automated: false,
          steps: [
            'Use audio editing software to split file',
            'Create files under 50MB each',
            'Process files individually',
            'Combine results manually',
          ],
          estimatedTime: 300,
          successRate: 0.85,
        },
      ],
      transcription: [
        {
          id: 'retry_transcription',
          name: 'Retry with Different Model',
          description: 'Automatically retry with alternative transcription settings',
          automated: true,
          steps: ['Switch to alternative transcription model', 'Adjust audio preprocessing', 'Retry'],
          estimatedTime: 30,
          successRate: 0.70,
        },
        {
          id: 'improve_audio_quality',
          name: 'Improve Audio Quality',
          description: 'Enhance audio clarity before transcription',
          automated: false,
          steps: [
            'Use audio editing software',
            'Apply noise reduction',
            'Normalize volume levels',
            'Enhance speech frequencies',
            'Retry upload',
          ],
          estimatedTime: 180,
          successRate: 0.80,
        },
      ],
      analysis: [
        {
          id: 'retry_with_cache_clear',
          name: 'Retry with Fresh Analysis',
          description: 'Clear cache and retry analysis',
          automated: true,
          steps: ['Clear LLM cache', 'Reset analysis parameters', 'Retry analysis'],
          estimatedTime: 20,
          successRate: 0.65,
        },
        {
          id: 'use_simpler_content',
          name: 'Simplify Content',
          description: 'Process shorter or simpler audio segments',
          automated: false,
          steps: [
            'Identify complex sections',
            'Trim audio to key segments',
            'Process simplified version',
          ],
          estimatedTime: 120,
          successRate: 0.75,
        },
      ],
      layout: [
        {
          id: 'fallback_layout',
          name: 'Use Fallback Layout Engine',
          description: 'Automatically switch to simpler layout algorithm',
          automated: true,
          steps: ['Switch to standard layout engine', 'Reduce layout complexity', 'Retry'],
          estimatedTime: 10,
          successRate: 0.85,
        },
      ],
      rendering: [
        {
          id: 'reduce_quality',
          name: 'Reduce Video Quality',
          description: 'Lower video resolution or frame rate',
          automated: true,
          steps: ['Switch to 720p resolution', 'Reduce to 24fps', 'Retry rendering'],
          estimatedTime: 30,
          successRate: 0.80,
        },
      ],
      api: [
        {
          id: 'check_api_key',
          name: 'Verify API Configuration',
          description: 'Check API key and quota',
          automated: false,
          steps: [
            'Verify GOOGLE_API_KEY in .env file',
            'Check API quota in Google Cloud Console',
            'Enable required APIs',
            'Retry operation',
          ],
          estimatedTime: 120,
          successRate: 0.90,
        },
      ],
      network: [
        {
          id: 'retry_with_backoff',
          name: 'Retry with Exponential Backoff',
          description: 'Automatically retry with increasing delays',
          automated: true,
          steps: ['Wait 2 seconds', 'Retry operation', 'Wait 4 seconds if failed', 'Retry again'],
          estimatedTime: 15,
          successRate: 0.75,
        },
      ],
      memory: [
        {
          id: 'use_fast_preset',
          name: 'Switch to Fast Preset',
          description: 'Use memory-efficient processing settings',
          automated: true,
          steps: ['Switch to "fast" quality preset', 'Clear cache', 'Retry processing'],
          estimatedTime: 20,
          successRate: 0.70,
        },
      ],
      timeout: [
        {
          id: 'extend_timeout',
          name: 'Extend Processing Timeout',
          description: 'Allow more time for processing',
          automated: true,
          steps: ['Increase timeout to 60 seconds', 'Retry operation'],
          estimatedTime: 10,
          successRate: 0.80,
        },
      ],
      unknown: [
        {
          id: 'general_retry',
          name: 'General Retry',
          description: 'Retry operation with default settings',
          automated: true,
          steps: ['Reset all settings', 'Clear cache', 'Retry operation'],
          estimatedTime: 15,
          successRate: 0.50,
        },
      ],
    };

    return strategies[category] || strategies.unknown;
  }

  /**
   * Get prevention tips
   */
  private getPreventionTips(category: ErrorCategory): string[] {
    const tips: Record<ErrorCategory, string[]> = {
      file_format: [
        'Use MP3, WAV, OGG, or M4A formats',
        'Verify file is not corrupted before upload',
        'Avoid proprietary or DRM-protected files',
      ],
      file_size: [
        'Keep files under 50MB',
        'Use lower bitrates (128-192kbps) for speech',
        'Remove unnecessary silence before/after speech',
      ],
      transcription: [
        'Use high-quality audio recordings',
        'Minimize background noise',
        'Ensure clear speech with good pronunciation',
        'Avoid overlapping speakers',
      ],
      analysis: [
        'Keep content focused and structured',
        'Avoid overly complex or abstract topics',
        'Use clear, logical relationships in speech',
      ],
      layout: [
        'Limit number of concepts per scene',
        'Use clear hierarchical relationships',
        'Avoid creating circular dependencies',
      ],
      rendering: [
        'Close other applications before processing',
        'Use "balanced" or "fast" preset for testing',
        'Keep total duration under 10 minutes',
      ],
      api: [
        'Verify API key is valid and has quota',
        'Monitor API usage in Google Cloud Console',
        'Enable billing if using free tier',
      ],
      network: [
        'Ensure stable internet connection',
        'Avoid VPNs that block API access',
        'Check firewall settings',
      ],
      memory: [
        'Close unused browser tabs',
        'Use "fast" preset for large files',
        'Process shorter audio segments',
      ],
      timeout: [
        'Use appropriate quality preset for file size',
        'Process shorter audio files',
        'Avoid peak usage times',
      ],
      unknown: [
        'Check browser console for detailed errors',
        'Try in different browser',
        'Clear browser cache and retry',
      ],
    };

    return tips[category] || tips.unknown;
  }

  /**
   * Get documentation links
   */
  private getDocumentationLinks(category: ErrorCategory): string[] {
    const baseUrl = '/docs';
    return [
      `${baseUrl}/troubleshooting/${category}`,
      `${baseUrl}/faq`,
      `${baseUrl}/getting-started`,
    ];
  }

  /**
   * Apply recovery strategy
   */
  private async applyStrategy(strategy: RecoveryStrategy): Promise<void> {
    console.log(`🔧 Phase 37: Applying strategy "${strategy.name}"`);

    // Simulate strategy application
    // In production, implement actual recovery logic for each strategy
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Strategy-specific logic would go here
    switch (strategy.id) {
      case 'retry_with_cache_clear':
        // Clear cache logic
        break;
      case 'fallback_layout':
        // Switch layout engine logic
        break;
      case 'reduce_quality':
        // Reduce video quality logic
        break;
      // ... other strategies
    }
  }

  /**
   * Get error statistics
   */
  getErrorStatistics(): {
    total: number;
    byCategory: Record<ErrorCategory, number>;
    recoveryRate: number;
    mostCommon: ErrorCategory;
  } {
    const total = this.errorHistory.length;
    const byCategory: Record<string, number> = {};

    for (const error of this.errorHistory) {
      byCategory[error.category] = (byCategory[error.category] || 0) + 1;
    }

    const recovered = this.errorHistory.filter((e) => e.recovered).length;
    const recoveryRate = total > 0 ? recovered / total : 0;

    const mostCommon = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]?.[0] as ErrorCategory || 'unknown';

    return {
      total,
      byCategory: byCategory as Record<ErrorCategory, number>,
      recoveryRate,
      mostCommon,
    };
  }
}

// Export singleton instance
export const userGuidedErrorRecovery = new UserGuidedErrorRecovery();
