/**
 * TASK-0018: Three-Layer Fallback Chain
 *
 * Orchestrates analysis across three layers:
 * Layer 1 (Primary LLM): Complexity-based model selection (Flash/Pro)
 * Layer 2 (Fallback LLM): Alternative model (Flash↔Pro)
 * Layer 3 (Rule-Based V1): Guaranteed success via rule-based analysis
 *
 * Guarantees 100% success rate.
 */

import { DiagramType } from '@stv/core/types/diagram';
import { RuleBasedAnalysisResult, SceneSegment, isDisabledGemini } from './rule-based-analyzer';
import { executeWithRetry, isRetryable, DEFAULT_RETRY_OPTIONS, type RetryOptions } from './retry-strategy';
import { logger } from '@stv/core/utils/logger';

/**
 * Analysis request for the fallback chain
 */
export interface AnalysisRequest {
  text: string;
  segments?: SceneSegment[];
  preferredModel?: 'gemini-2.5-flash' | 'gemini-2.5-pro';
  timeout?: number;
}

/**
 * Analysis result from the fallback chain
 */
export interface AnalysisResult {
  diagramType: DiagramType;
  entities: { id: string; label: string }[];
  relations: { from: string; to: string; id?: string }[];
  summary: string;
  confidence: number;
  metadata: {
    layer: 'primary' | 'fallback' | 'rule-based';
    model?: string;
    responseTime: number;
    retriesUsed: number;
  };
}

/**
 * Fallback statistics tracking
 */
export interface FallbackStats {
  totalRequests: number;
  primarySuccess: number;
  fallbackSuccess: number;
  ruleBasedSuccess: number;
  successRate: number;
}

/**
 * Layer executor function type
 */
type LayerExecutor = (request: AnalysisRequest) => Promise<AnalysisResult>;

/**
 * FallbackChain - orchestrates 3-layer fallback for analysis
 */
export class FallbackChain {
  private stats: FallbackStats = {
    totalRequests: 0,
    primarySuccess: 0,
    fallbackSuccess: 0,
    ruleBasedSuccess: 0,
    successRate: 0,
  };

  private retryOptions: RetryOptions;
  private primaryExecutor: LayerExecutor;
  private fallbackExecutor: LayerExecutor;
  private ruleBasedExecutor: LayerExecutor;

  constructor(
    primaryExecutor: LayerExecutor,
    fallbackExecutor: LayerExecutor,
    ruleBasedExecutor: LayerExecutor,
    retryOptions?: RetryOptions
  ) {
    this.primaryExecutor = primaryExecutor;
    this.fallbackExecutor = fallbackExecutor;
    this.ruleBasedExecutor = ruleBasedExecutor;
    this.retryOptions = retryOptions || { ...DEFAULT_RETRY_OPTIONS };
  }

  /**
   * Execute the fallback chain
   * Tries each layer in order until one succeeds
   */
  async execute(request: AnalysisRequest): Promise<AnalysisResult> {
    const startTime = Date.now();
    this.stats.totalRequests++;

    // If Gemini is disabled, go directly to rule-based
    if (isDisabledGemini()) {
      logger.info('[FallbackChain] DISABLE_GEMINI=1, using rule-based analyzer directly');
      const result = await this.executeLayer(request, this.ruleBasedExecutor, 'rule-based');
      this.stats.ruleBasedSuccess++;
      this.updateSuccessRate();
      return result;
    }

    // Layer 1: Primary LLM
    try {
      const result = await this.executeWithRetryLayer(request, this.primaryExecutor, 'primary');
      this.stats.primarySuccess++;
      this.updateSuccessRate();
      return result;
    } catch (error) {
      logger.warn(
        `[FallbackChain] Layer 1 (Primary) failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Layer 2: Fallback LLM
    try {
      const result = await this.executeWithRetryLayer(request, this.fallbackExecutor, 'fallback');
      this.stats.fallbackSuccess++;
      this.updateSuccessRate();
      return result;
    } catch (error) {
      logger.warn(
        `[FallbackChain] Layer 2 (Fallback) failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Layer 3: Rule-based (always succeeds)
    logger.error('[FallbackChain] All LLM layers failed, falling back to rule-based V1');
    const result = await this.executeLayer(request, this.ruleBasedExecutor, 'rule-based');
    this.stats.ruleBasedSuccess++;
    this.updateSuccessRate();
    return result;
  }

  /**
   * Execute a layer with retry strategy
   */
  private async executeWithRetryLayer(
    request: AnalysisRequest,
    executor: LayerExecutor,
    layer: 'primary' | 'fallback'
  ): Promise<AnalysisResult> {
    let retriesUsed = 0;

    const result = await executeWithRetry(
      async () => {
        retriesUsed++;
        return executor(request);
      },
      this.retryOptions
    );

    result.metadata.retriesUsed = retriesUsed - 1;
    result.metadata.layer = layer;
    return result;
  }

  /**
   * Execute a layer without retry (for rule-based)
   */
  private async executeLayer(
    request: AnalysisRequest,
    executor: LayerExecutor,
    layer: 'primary' | 'fallback' | 'rule-based'
  ): Promise<AnalysisResult> {
    const startTime = Date.now();
    const result = await executor(request);
    result.metadata.responseTime = Date.now() - startTime;
    result.metadata.layer = layer;
    result.metadata.retriesUsed = 0;
    return result;
  }

  /**
   * Get fallback statistics
   */
  getStats(): FallbackStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      primarySuccess: 0,
      fallbackSuccess: 0,
      ruleBasedSuccess: 0,
      successRate: 0,
    };
  }

  private updateSuccessRate(): void {
    const total = this.stats.primarySuccess + this.stats.fallbackSuccess + this.stats.ruleBasedSuccess;
    this.stats.successRate = this.stats.totalRequests > 0 && Number.isFinite(total)
      ? (total / this.stats.totalRequests) * 100
      : 0;
  }
}
