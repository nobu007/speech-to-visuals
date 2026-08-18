/**
 * Recovery strategy table for the enhanced error-recovery system.
 *
 * Moved verbatim from enhanced-error-recovery.ts (initializeRecoveryStrategies):
 * the strategy objects and their execute closures, expressed against a host
 * interface so the orchestrator's private helpers stay private.
 */

import { globalCache } from '../../performance/intelligent-cache';
import { logger } from '@stv/core/utils/logger';
import { QualityGateError } from '@/pipeline/pipeline-errors';
import type { ErrorContext, RecoveryStrategy } from './types';

/** The orchestrator capabilities the strategy closures invoke. */
export interface RecoveryStrategyHost {
  analyzeFailurePattern(context: ErrorContext): {
    pattern: string;
    frequency: number;
    lastOccurrence: number;
    commonCauses: string[];
  };
  adaptParametersForRetry(
    context: ErrorContext,
    failurePattern: { frequency?: number; [key: string]: unknown },
  ): Promise<Record<string, unknown>>;
  executeWithAdaptedParams(
    context: ErrorContext,
    adaptedParams: Record<string, unknown>,
  ): Promise<unknown>;
  generateDegradedParams(context: ErrorContext): Record<string, unknown>;
  executeWithDegradedQuality(
    context: ErrorContext,
    degradedParams: Record<string, unknown>,
  ): Promise<unknown>;
  adaptCachedResult(cachedData: unknown, context: ErrorContext): Promise<unknown>;
  executeAlternativeAlgorithm(context: ErrorContext): Promise<unknown>;
  generateMinimalOutput(context: ErrorContext): Promise<unknown>;
  executeSimplifiedExport(context: ErrorContext): Promise<unknown>;
  executeReSegmentation(context: ErrorContext): Promise<unknown>;
  executeStaticFallback(context: ErrorContext): Promise<unknown>;
}

  /**
   * Build the recovery strategy table.
   *
   * The strategy closures call back into the orchestrator through `host`
   * (private methods cannot satisfy an external interface directly).
   */
export function createRecoveryStrategies(host: RecoveryStrategyHost): RecoveryStrategy[] {
  const strategies: RecoveryStrategy[] = [
      {
        id: 'intelligent_retry',
        name: 'Intelligent Retry with Adaptation',
        description: 'Retry with automatically adjusted parameters',
        applicableStages: ['transcription', 'analysis', 'diagram_detection'],
        priority: 1,
        preventionScore: 0.7,
        execute: async (context: ErrorContext) => {
          const startTime = performance.now();

          // Analyze failure pattern
          const failurePattern = host.analyzeFailurePattern(context);

          // Adapt parameters based on failure
          const adaptedParams = await host.adaptParametersForRetry(context, failurePattern);

          try {
            // Attempt retry with adapted parameters
            const result = await host.executeWithAdaptedParams(context, adaptedParams);

            return {
              success: true,
              result,
              fallbackUsed: false,
              timeSpent: performance.now() - startTime,
              strategy: 'intelligent_retry',
              confidence: 0.85,
              improvements: [`Adapted ${Object.keys(adaptedParams).length} parameters`],
              nextAction: 'retry' as const
            };
          } catch (error) {
            logger.error('[EnhancedErrorRecovery] intelligent_retry strategy failed:', error);
            return {
              success: false,
              fallbackUsed: false,
              timeSpent: performance.now() - startTime,
              strategy: 'intelligent_retry',
              confidence: 0.3,
              improvements: [],
              nextAction: 'fallback' as const
            };
          }
        }
      },
      {
        id: 'degraded_quality_fallback',
        name: 'Degraded Quality Fallback',
        description: 'Reduce quality to ensure completion',
        applicableStages: ['layout_generation', 'animation', 'rendering'],
        priority: 2,
        preventionScore: 0.5,
        execute: async (context: ErrorContext) => {
          const startTime = performance.now();

          try {
            // Reduce quality parameters
            const degradedParams = host.generateDegradedParams(context);
            const result = await host.executeWithDegradedQuality(context, degradedParams);

            return {
              success: true,
              result,
              fallbackUsed: true,
              timeSpent: performance.now() - startTime,
              strategy: 'degraded_quality_fallback',
              confidence: 0.7,
              improvements: ['Reduced quality for stability'],
              nextAction: 'retry' as const
            };
          } catch (error) {
            logger.error('[EnhancedErrorRecovery] degraded_quality_fallback strategy failed:', error);
            return {
              success: false,
              fallbackUsed: true,
              timeSpent: performance.now() - startTime,
              strategy: 'degraded_quality_fallback',
              confidence: 0.2,
              improvements: [],
              nextAction: 'escalate' as const
            };
          }
        }
      },
      {
        id: 'cache_recovery',
        name: 'Cache-Based Recovery',
        description: 'Use cached results from similar content',
        applicableStages: ['analysis', 'diagram_detection', 'layout_generation'],
        priority: 3,
        preventionScore: 0.8,
        execute: async (context: ErrorContext) => {
          const startTime = performance.now();

          try {
            // Look for similar cached results
            const similarContent = await globalCache.findSimilar(JSON.stringify(context.input));

            if (similarContent) {
              // Adapt cached result to current context
              const adaptedResult = await host.adaptCachedResult(similarContent.data, context);

              return {
                success: true,
                result: adaptedResult,
                fallbackUsed: true,
                timeSpent: performance.now() - startTime,
                strategy: 'cache_recovery',
                confidence: 0.75,
                improvements: ['Used cached similar result'],
                nextAction: 'retry' as const
              };
            }

            throw new QualityGateError('cache-recovery', 'No suitable cached content found');
          } catch (error) {
            logger.error('[EnhancedErrorRecovery] cache_recovery strategy failed:', error);
            return {
              success: false,
              fallbackUsed: true,
              timeSpent: performance.now() - startTime,
              strategy: 'cache_recovery',
              confidence: 0.1,
              improvements: [],
              nextAction: 'fallback' as const
            };
          }
        }
      },
      {
        id: 'alternative_algorithm',
        name: 'Alternative Algorithm Fallback',
        description: 'Switch to alternative processing algorithm',
        applicableStages: ['diagram_detection', 'layout_generation'],
        priority: 4,
        preventionScore: 0.6,
        execute: async (context: ErrorContext) => {
          const startTime = performance.now();

          try {
            const alternativeResult = await host.executeAlternativeAlgorithm(context);

            return {
              success: true,
              result: alternativeResult,
              fallbackUsed: true,
              timeSpent: performance.now() - startTime,
              strategy: 'alternative_algorithm',
              confidence: 0.65,
              improvements: ['Used alternative algorithm'],
              nextAction: 'retry' as const
            };
          } catch (error) {
            logger.error('[EnhancedErrorRecovery] alternative_algorithm strategy failed:', error);
            return {
              success: false,
              fallbackUsed: true,
              timeSpent: performance.now() - startTime,
              strategy: 'alternative_algorithm',
              confidence: 0.15,
              improvements: [],
              nextAction: 'escalate' as const
            };
          }
        }
      },
      {
        id: 'minimal_viable_output',
        name: 'Minimal Viable Output',
        description: 'Generate basic output to avoid complete failure',
        applicableStages: ['analysis', 'diagram_detection', 'layout_generation', 'rendering'],
        priority: 5,
        preventionScore: 0.3,
        execute: async (context: ErrorContext) => {
          const startTime = performance.now();

          try {
            const minimalResult = await host.generateMinimalOutput(context);

            return {
              success: true,
              result: minimalResult,
              fallbackUsed: true,
              timeSpent: performance.now() - startTime,
              strategy: 'minimal_viable_output',
              confidence: 0.5,
              improvements: ['Generated minimal viable output'],
              nextAction: 'retry' as const
            };
          } catch (error) {
            logger.error('[EnhancedErrorRecovery] minimal_viable_output strategy failed:', error);
            return {
              success: false,
              fallbackUsed: true,
              timeSpent: performance.now() - startTime,
              strategy: 'minimal_viable_output',
              confidence: 0.05,
              improvements: [],
              nextAction: 'abort' as const
            };
          }
        }
      },
      {
        id: 'simplified_export',
        name: 'Simplified Export Fallback',
        description: 'Retry export with reduced format options and lower quality',
        applicableStages: ['export'],
        priority: 2,
        preventionScore: 0.6,
        execute: async (context: ErrorContext) => {
          const startTime = performance.now();
          try {
            const result = await host.executeSimplifiedExport(context);
            return {
              success: true,
              result,
              fallbackUsed: true,
              timeSpent: performance.now() - startTime,
              strategy: 'simplified_export',
              confidence: 0.7,
              improvements: ['Exported with simplified parameters'],
              nextAction: 'retry' as const,
            };
          } catch (err) {
            logger.error('[Recovery] simplified_export strategy failed:', err);
            return {
              success: false,
              fallbackUsed: true,
              timeSpent: performance.now() - startTime,
              strategy: 'simplified_export',
              confidence: 0.1,
              improvements: [],
              nextAction: 'abort' as const,
            };
          }
        }
      },
      {
        id: 're_segmentation',
        name: 'Re-segmentation with Different Parameters',
        description: 'Retry segmentation with adjusted chunk size and overlap',
        applicableStages: ['segmentation'],
        priority: 1,
        preventionScore: 0.7,
        execute: async (context: ErrorContext) => {
          const startTime = performance.now();
          try {
            const result = await host.executeReSegmentation(context);
            return {
              success: true,
              result,
              fallbackUsed: false,
              timeSpent: performance.now() - startTime,
              strategy: 're_segmentation',
              confidence: 0.8,
              improvements: ['Re-segmented with adjusted parameters'],
              nextAction: 'retry' as const,
            };
          } catch (err) {
            logger.error('[Recovery] re_segmentation strategy failed:', err);
            return {
              success: false,
              fallbackUsed: false,
              timeSpent: performance.now() - startTime,
              strategy: 're_segmentation',
              confidence: 0.2,
              improvements: [],
              nextAction: 'fallback' as const,
            };
          }
        }
      },
      {
        id: 'skip_animation',
        name: 'Skip Animation Fallback',
        description: 'Skip animation step and proceed with static output',
        applicableStages: ['animation'],
        priority: 3,
        preventionScore: 0.5,
        execute: async (context: ErrorContext) => {
          const startTime = performance.now();
          try {
            const result = await host.executeStaticFallback(context);
            return {
              success: true,
              result,
              fallbackUsed: true,
              timeSpent: performance.now() - startTime,
              strategy: 'skip_animation',
              confidence: 0.75,
              improvements: ['Skipped animation, generated static output'],
              nextAction: 'retry' as const,
            };
          } catch (err) {
            logger.error('[Recovery] skip_animation strategy failed:', err);
            return {
              success: false,
              fallbackUsed: true,
              timeSpent: performance.now() - startTime,
              strategy: 'skip_animation',
              confidence: 0.1,
              improvements: [],
              nextAction: 'escalate' as const,
            };
          }
        }
      }
    ];

  // Sort strategies by priority
  strategies.sort((a, b) => a.priority - b.priority);
  return strategies;
}

