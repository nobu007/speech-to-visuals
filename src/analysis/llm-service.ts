/**
 * Phase 22: Unified LLM Service
 * Centralized service for all LLM operations across the application
 *
 * Features:
 * - Adaptive model selection (Flash vs Pro)
 * - Unified caching with semantic similarity
 * - Centralized rate limiting and retry logic
 * - Comprehensive performance monitoring
 * - Exponential backoff with jitter
 * - Dual-fallback architecture
 *
 * Benefits:
 * - Eliminates code duplication between ContentAnalyzer and GeminiAnalyzer
 * - Shared cache across all LLM operations
 * - Consistent retry and error handling
 * - Unified performance metrics
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { LLMResponseError } from "./analysis-errors";
import { LLMCache } from "./llm-cache";
import { ComplexityDetector, ComplexityAnalysis } from "./complexity-detector";
import { parseJsonFromLLMText } from "./llm-utils";
import { logger } from '../utils/logger';
import { TokenUsageTracker, type ModelType, type StageType, type TokenUsageSummary } from './token-usage-tracker';
import { calculateModelCost, estimateCost, type CostBreakdown, type CostEstimate } from './cost-estimator';
import { BudgetAlertSystem, type BudgetAlert } from './budget-alert';
import { CacheWarmupManager, type WarmupStats, type HitRateReport } from '@/optimization/cache-warmup';
import { isDiagramType } from '@/types/diagram';

/**
 * Phase 33: Streaming progress callback
 * Called with partial results as they stream in
 */
export type StreamingCallback = (partialText: string, progress: number) => void;

/**
 * LLM Request configuration
 */
export interface LLMRequest<T = unknown> {
  prompt: string;
  context: string; // For caching and complexity analysis
  stage?: StageType; // Pipeline stage for monitoring (defaults to 'analysis')
  options?: {
    temperature?: number;
    maxOutputTokens?: number;
    forceModel?: 'gemini-2.5-flash' | 'gemini-2.5-pro';
    timeout?: number;
    maxRetries?: number;
    cacheKey?: string;
    // Phase 33: Enable streaming responses
    enableStreaming?: boolean;
    onStream?: StreamingCallback;
  };
  parser?: (text: string) => T; // Custom parser function
}

/**
 * LLM Response with metadata
 */
export interface LLMResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  metadata: {
    model: string;
    responseTime: number;
    fromCache: boolean;
    complexity?: ComplexityAnalysis;
    retryCount: number;
    fallbackUsed: boolean;
    // REQ-098: Token usage and cost tracking
    tokenUsage?: { inputTokens: number; outputTokens: number; totalTokens: number };
    estimatedCost?: CostBreakdown;
  };
}

/**
 * LLM Service Statistics
 */
export interface LLMServiceStats {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
  modelUsage: {
    flash: number;
    pro: number;
    flashPercent: number;
  };
  performance: {
    avgResponseTime: number;
    avgFlashTime: number;
    avgProTime: number;
    p50: number;
    p95: number;
    p99: number;
  };
  reliability: {
    successRate: number;
    fallbackRate: number;
    totalRetries: number;
  };
  timeSavings: string;
}

/**
 * Unified LLM Service
 * Handles all LLM operations with adaptive model selection
 */
export class LLMService {
  private genAI?: GoogleGenerativeAI;
  private cache: LLMCache<unknown>;
  private complexityDetector: ComplexityDetector;
  private cacheWarmupManager: CacheWarmupManager<unknown>;

  // Request tracking
  private requestCount: number = 0;
  private lastRequestTime: number = 0;

  // Performance tracking
  private responseTimeHistory: number[] = [];
  private readonly MAX_HISTORY_SIZE = 20;

  // Model selection metrics
  private modelMetrics = {
    totalRequests: 0,
    flashRequests: 0,
    proRequests: 0,
    fallbackUsed: 0,
    totalRetries: 0,
    successCount: 0,
    failureCount: 0,
    flashResponseTimes: [] as number[],
    proResponseTimes: [] as number[]
  };

  // REQ-098: LLM cost & token monitoring
  private tokenTracker: TokenUsageTracker;
  private budgetAlert: BudgetAlertSystem;

  // Rate limiting configuration (Phase 30: Optimized for faster processing)
  private readonly MIN_REQUEST_INTERVAL = 200; // 200ms between requests (reduced from 500ms for 60% speed improvement)

  // Retry backoff configuration
  private readonly BACKOFF_BASE_DELAY_MS = 1000;    // 1 second base delay
  private readonly BACKOFF_MAX_DELAY_MS = 32000;    // 32 seconds max delay
  private readonly BACKOFF_JITTER_FACTOR = 0.3;     // 30% random jitter

  // Adaptive timeout configuration
  private readonly TIMEOUT_DEFAULT_MS = 30000;       // 30 seconds default timeout
  private readonly TIMEOUT_MIN_MS = 15000;           // 15 seconds minimum timeout
  private readonly TIMEOUT_MAX_MS = 60000;           // 60 seconds maximum timeout
  private readonly TIMEOUT_P95_BUFFER = 1.5;         // P95 + 50% buffer

  constructor(apiKey?: string, options?: {
    cacheSize?: number;
    cacheTTL?: number;
    cachePersistPath?: string;
  }) {
    const key = apiKey || process.env.GOOGLE_API_KEY;
    if (key) {
      this.genAI = new GoogleGenerativeAI(key);
    }

    this.cache = new LLMCache<unknown>({
      maxSize: options?.cacheSize || 200,
      ttlMinutes: options?.cacheTTL || 120,
      persistPath: options?.cachePersistPath || '.cache/llm/unified-cache.json'
    });

    this.complexityDetector = new ComplexityDetector();

    // REQ-202: Initialize cache warmup manager
    this.cacheWarmupManager = new CacheWarmupManager<unknown>(this.cache);

    // REQ-098: Initialize monitoring
    this.tokenTracker = new TokenUsageTracker();
    this.budgetAlert = new BudgetAlertSystem();
  }

  /**
   * REQ-202: Warm up the LLM cache if it is in a cold-start state.
   *
   * Pre-populates the cache with common query patterns so that subsequent
   * requests can benefit from cache hits immediately.  The resolver
   * performs a lightweight analysis of each warmup text so the cached
   * result is usable by the semantic-similarity layer.
   *
   * @param resolver - Optional custom resolver; defaults to a simple
   *   pass-through that returns the text as-is (sufficient for semantic
   *   warm-up).
   * @returns true if warmup was executed, false if skipped (cache warm)
   */
  async warmupCache(
    resolver?: (text: string) => Promise<unknown>
  ): Promise<boolean> {
    const defaultResolver = async (text: string): Promise<unknown> => text;
    return this.cacheWarmupManager.warmupIfCold(resolver ?? defaultResolver);
  }

  /**
   * Get cache warmup statistics.
   */
  getCacheWarmupStats(): WarmupStats {
    return this.cacheWarmupManager.getWarmupStats();
  }

  /**
   * Get cache hit-rate report showing warmup effectiveness.
   */
  getCacheHitRateReport(): HitRateReport {
    return this.cacheWarmupManager.getHitRateReport();
  }

  /**
   * Record a query result for hit-rate tracking after warmup.
   */
  recordCacheQuery(wasHit: boolean): void {
    this.cacheWarmupManager.recordQuery(wasHit);
  }

  /**
   * Check if LLM service is enabled
   */
  isEnabled(): boolean {
    if (process.env.ANALYSIS_DISABLE_GEMINI === "1") return false;
    return Boolean(this.genAI);
  }

  /**
   * Execute LLM request with adaptive model selection
   */
  async execute<T = unknown>(request: LLMRequest<T>): Promise<LLMResponse<T>> {
    const startTime = Date.now();
    this.modelMetrics.totalRequests++;

    // Check if LLM is enabled
    if (!this.isEnabled()) {
      return {
        success: false,
        error: 'LLM service not enabled (API key missing or disabled)',
        metadata: {
          model: 'none',
          responseTime: Date.now() - startTime,
          fromCache: false,
          retryCount: 0,
          fallbackUsed: false
        }
      };
    }

    // Check cache first
    const cacheKey = request.options?.cacheKey || request.context;
    const cached = this.cache.get(cacheKey, 'unified-llm-service');
    if (cached) {
      // REQ-202: Track cache hit for warmup effectiveness reporting
      this.cacheWarmupManager.recordQuery(true);
      return {
        success: true,
        data: cached as T,
        metadata: {
          model: 'cache',
          responseTime: Date.now() - startTime,
          fromCache: true,
          retryCount: 0,
          fallbackUsed: false
        }
      };
    }

    // REQ-202: Track cache miss for warmup effectiveness reporting
    this.cacheWarmupManager.recordQuery(false);

    // Analyze complexity to select optimal model
    const complexity = this.complexityDetector.analyze(request.context);

    // Determine models to use
    const primaryModel = request.options?.forceModel || complexity.recommendedModel;
    const fallbackModel = primaryModel === 'gemini-2.5-pro'
      ? 'gemini-2.5-flash'
      : 'gemini-2.5-pro';


    // Track model selection
    if (primaryModel === 'gemini-2.5-flash') {
      this.modelMetrics.flashRequests++;
    } else {
      this.modelMetrics.proRequests++;
    }

    // Get adaptive timeout
    const timeout = request.options?.timeout || this.getAdaptiveTimeout();
    const maxRetries = request.options?.maxRetries || 3;

    let retryCount = 0;
    let lastError: unknown = null;

    // Try primary model with retries
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const { text: resultText, usage } = await this.executeRequest(
          primaryModel,
          request.prompt,
          {
            // `?? 0.1` not `|| 0.1`: temperature 0 is a legit deterministic
            // value and must not be replaced with the default.
            temperature: request.options?.temperature ?? 0.1,
            maxOutputTokens: request.options?.maxOutputTokens || 2048
          },
          timeout,
          attempt,
          // Phase 33: Pass streaming callback if enabled
          request.options?.enableStreaming ? request.options.onStream : undefined
        );

        const responseTime = Date.now() - startTime;
        this.recordResponseTime(responseTime);

        // Track by model
        if (primaryModel === 'gemini-2.5-flash') {
          this.modelMetrics.flashResponseTimes.push(responseTime);
        } else {
          this.modelMetrics.proResponseTimes.push(responseTime);
        }

        // Parse result
        let parsedData: T;
        if (request.parser) {
          parsedData = request.parser(resultText);
        } else {
          parsedData = parseJsonFromLLMText<T>(resultText);
        }

        // Cache successful result
        this.cache.set(cacheKey, parsedData, 'unified-llm-service');
        this.modelMetrics.successCount++;

        // REQ-098: Record token usage and cost for monitoring
        const modelType = toModelType(primaryModel);
        const inputTokens = usage?.promptTokenCount ?? 0;
        const outputTokens = usage?.candidatesTokenCount ?? 0;
        const stage = request.stage ?? 'analysis';
        if (usage) {
          this.recordApiCallMetrics(modelType, inputTokens, outputTokens, stage);
        }

        return {
          success: true,
          data: parsedData,
          metadata: {
            model: primaryModel,
            responseTime,
            fromCache: false,
            complexity,
            retryCount: attempt,
            fallbackUsed: false,
            tokenUsage: usage ? { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens } : undefined,
            estimatedCost: usage ? calculateModelCost(modelType, inputTokens, outputTokens) : undefined,
          }
        };

      } catch (err: unknown) {
        lastError = err;
        retryCount = attempt + 1;
        this.modelMetrics.totalRetries++;

        const errObj = err as Record<string, unknown>;
        const errMessage = err instanceof Error ? err.message : String(err);
        const isRateLimit = (errObj as Record<string, unknown>).status === 429 ||
          (Array.isArray((errObj as Record<string, unknown>).errorDetails) &&
            ((errObj as Record<string, unknown>).errorDetails as Record<string, unknown>[]).some((d: Record<string, unknown>) => String(d['@type'] ?? '').includes('QuotaFailure')));
        const isTimeout = errMessage === 'Request timeout';

        if (isRateLimit || isTimeout) {
          const reason = isRateLimit ? 'Rate limit' : 'Timeout';
          logger.warn(`${reason} with ${primaryModel} (attempt ${attempt + 1}/${maxRetries})`);

          if (attempt < maxRetries - 1) {
            continue; // Retry with backoff
          } else {
            // Exhausted retries, try fallback
            logger.warn(`LLMService: Switching to fallback ${fallbackModel}`);
            break;
          }
        }

        // For other errors, fail immediately
        logger.error(`LLMService: ${primaryModel} failed:`, errMessage);
        this.modelMetrics.failureCount++;

        return {
          success: false,
          error: errMessage || 'LLM request failed',
          metadata: {
            model: primaryModel,
            responseTime: Date.now() - startTime,
            fromCache: false,
            complexity,
            retryCount: attempt,
            fallbackUsed: false
          }
        };
      }
    }

    // Try fallback model
    this.modelMetrics.fallbackUsed++;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const { text: resultText, usage } = await this.executeRequest(
          fallbackModel,
          request.prompt,
          {
            // `?? 0.1` not `|| 0.1`: temperature 0 is a legit deterministic
            // value and must not be replaced with the default.
            temperature: request.options?.temperature ?? 0.1,
            maxOutputTokens: request.options?.maxOutputTokens || 2048
          },
          timeout,
          attempt,
          // Phase 33: Pass streaming callback if enabled (fallback also supports streaming)
          request.options?.enableStreaming ? request.options.onStream : undefined
        );

        const responseTime = Date.now() - startTime;
        this.recordResponseTime(responseTime);

        // Track by model
        if (fallbackModel === 'gemini-2.5-flash') {
          this.modelMetrics.flashResponseTimes.push(responseTime);
        } else {
          this.modelMetrics.proResponseTimes.push(responseTime);
        }

        // Parse result
        let parsedData: T;
        if (request.parser) {
          parsedData = request.parser(resultText);
        } else {
          parsedData = parseJsonFromLLMText<T>(resultText);
        }

        // Cache successful result
        this.cache.set(cacheKey, parsedData, 'unified-llm-service');
        this.modelMetrics.successCount++;

        // REQ-098: Record token usage and cost for monitoring (fallback stage)
        const fallbackModelType = toModelType(fallbackModel);
        const inputTokens = usage?.promptTokenCount ?? 0;
        const outputTokens = usage?.candidatesTokenCount ?? 0;
        if (usage) {
          this.recordApiCallMetrics(fallbackModelType, inputTokens, outputTokens, 'fallback');
        }

        return {
          success: true,
          data: parsedData,
          metadata: {
            model: fallbackModel,
            responseTime,
            fromCache: false,
            complexity,
            retryCount: retryCount + attempt,
            fallbackUsed: true,
            tokenUsage: usage ? { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens } : undefined,
            estimatedCost: usage ? calculateModelCost(fallbackModelType, inputTokens, outputTokens) : undefined,
          }
        };

      } catch (err: unknown) {
        lastError = err;
        this.modelMetrics.totalRetries++;
        const errMessage = err instanceof Error ? err.message : String(err);
        logger.warn(`LLMService: Fallback ${fallbackModel} failed (attempt ${attempt + 1}/${maxRetries}):`, errMessage);

        if (attempt < maxRetries - 1) {
          continue; // Retry with backoff
        }
      }
    }

    // All retries exhausted
    this.modelMetrics.failureCount++;
    const lastErrorMessage = lastError instanceof Error ? lastError.message : (lastError ? String(lastError) : 'Unknown error');
    logger.error('LLMService: All retry attempts exhausted. Last error:', lastErrorMessage);

    return {
      success: false,
      error: `All retries exhausted. Last error: ${lastErrorMessage}`,
      metadata: {
        model: `${primaryModel}+${fallbackModel}`,
        responseTime: Date.now() - startTime,
        fromCache: false,
        complexity,
        retryCount: retryCount + maxRetries,
        fallbackUsed: true
      }
    };
  }

  /**
   * Execute a single LLM request to a specific model
   * Phase 33: Enhanced with streaming support
   * REQ-098: Returns usage metadata for token/cost tracking
   */
  private async executeRequest(
    modelName: string,
    prompt: string,
    generationConfig: { temperature: number; maxOutputTokens: number },
    timeout: number,
    attempt: number,
    streamingCallback?: StreamingCallback
  ): Promise<{ text: string; usage?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } }> {
    // Apply rate limiting
    await this.checkRateLimit();

    // Apply exponential backoff if retry
    await this.waitForBackoff(attempt);

    const model = this.genAI!.getGenerativeModel({
      model: modelName,
      generationConfig: {
        ...generationConfig,
        topP: 0.95,
        topK: 40
      }
    });

    // Phase 33: Use streaming API if callback provided
    if (streamingCallback) {
      return this.executeStreamingRequest(model, prompt, timeout, streamingCallback);
    }

    // Add timeout wrapper
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new LLMResponseError('Request timeout')), timeout)
    );

    const result = await Promise.race([
      model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }] }),
      timeoutPromise
    ]);

    const response = await result.response;
    const responseText = response.text();

    if (!responseText || responseText.trim().length === 0) {
      throw new LLMResponseError('Empty response from LLM');
    }

    // REQ-098: Extract token usage metadata from Gemini API response
    const usage = response.usageMetadata
      ? {
          promptTokenCount: response.usageMetadata.promptTokenCount,
          candidatesTokenCount: response.usageMetadata.candidatesTokenCount,
          totalTokenCount: response.usageMetadata.totalTokenCount,
        }
      : undefined;

    return { text: responseText, usage };
  }

  /**
   * Phase 33: Execute streaming LLM request with real-time progress updates
   * Provides partial results as they arrive for better perceived performance
   * REQ-098: Returns usage metadata from final streaming response
   */
  private async executeStreamingRequest(
    model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>,
    prompt: string,
    timeout: number,
    onStream: StreamingCallback
  ): Promise<{ text: string; usage?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } }> {

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new LLMResponseError('Request timeout')), timeout)
    );

    let fullText = '';
    let lastProgress = 0;

    const streamingPromise = (async () => {
      const streamResult = await model.generateContentStream({
        contents: [{ role: "user", parts: [{ text: prompt }] }]
      });

      for await (const chunk of streamResult.stream) {
        const chunkText = chunk.text();
        fullText += chunkText;

        // Calculate progress (estimate based on max tokens)
        const progress = Math.min(95, (fullText.length / 2048) * 100);

        // Only call callback if progress has meaningfully changed (reduce noise)
        if (progress - lastProgress > 5 || fullText.length < 100) {
          onStream(fullText, progress);
          lastProgress = progress;
        }
      }

      // Final progress update
      onStream(fullText, 100);

      // REQ-098: Extract usage metadata from final streaming response
      let usage: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } | undefined;
      try {
        const finalResponse = await streamResult.response;
        const meta = finalResponse.usageMetadata;
        usage = meta
          ? {
              promptTokenCount: meta.promptTokenCount,
              candidatesTokenCount: meta.candidatesTokenCount,
              totalTokenCount: meta.totalTokenCount,
            }
          : undefined;
      } catch (err) {
        logger.debug('[LLMService] Usage metadata not available for streaming response:', err instanceof Error ? err.message : err);
      }

      return { text: fullText, usage };
    })();

    const result = await Promise.race([streamingPromise, timeoutPromise]);

    if (!result.text || result.text.trim().length === 0) {
      throw new LLMResponseError('Empty response from streaming LLM');
    }

    return result;
  }

  /**
   * Rate limit check and throttle
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
      const waitTime = this.MIN_REQUEST_INTERVAL - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  /**
   * Exponential backoff delay calculation
   */
  private async waitForBackoff(attempt: number): Promise<void> {
    if (attempt === 0) return;

    const delay = Math.min(
      this.BACKOFF_BASE_DELAY_MS * Math.pow(2, attempt - 1),
      this.BACKOFF_MAX_DELAY_MS,
    );

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * this.BACKOFF_JITTER_FACTOR * delay;
    const finalDelay = delay + jitter;

    await new Promise(resolve => setTimeout(resolve, finalDelay));
  }

  /**
   * Calculate adaptive timeout based on historical response times
   * Uses P95 (95th percentile) for robust timeout estimation
   */
  private getAdaptiveTimeout(): number {
    if (this.responseTimeHistory.length === 0) {
      return this.TIMEOUT_DEFAULT_MS;
    }

    // Calculate P95
    const sorted = [...this.responseTimeHistory].sort((a, b) => a - b);
    const p95Index = Math.ceil(sorted.length * 0.95) - 1;
    const p95ResponseTime = sorted[Math.max(0, p95Index)];

    // Use P95 + buffer as timeout
    const adaptiveTimeout = Math.max(
      this.TIMEOUT_MIN_MS,
      Math.min(this.TIMEOUT_MAX_MS, p95ResponseTime * this.TIMEOUT_P95_BUFFER),
    );

    return Math.round(adaptiveTimeout);
  }

  /**
   * Record response time for adaptive timeout calculation
   */
  private recordResponseTime(timeMs: number): void {
    this.responseTimeHistory.push(timeMs);

    if (this.responseTimeHistory.length > this.MAX_HISTORY_SIZE) {
      this.responseTimeHistory.shift();
    }
  }

  /**
   * Get comprehensive service statistics
   */
  getStats(): LLMServiceStats {
    const cacheStats = this.cache.getStats();
    const cacheHitRate = cacheStats.totalHits + cacheStats.semantic.misses > 0
      ? (cacheStats.totalHits / (cacheStats.totalHits + cacheStats.semantic.misses)) * 100
      : 0;

    const avgFlashTime = this.modelMetrics.flashResponseTimes.length > 0
      ? this.modelMetrics.flashResponseTimes.reduce((a, b) => a + b, 0) / this.modelMetrics.flashResponseTimes.length
      : 0;

    const avgProTime = this.modelMetrics.proResponseTimes.length > 0
      ? this.modelMetrics.proResponseTimes.reduce((a, b) => a + b, 0) / this.modelMetrics.proResponseTimes.length
      : 0;

    const avgResponseTime = this.responseTimeHistory.length > 0
      ? this.responseTimeHistory.reduce((a, b) => a + b, 0) / this.responseTimeHistory.length
      : 0;

    // Calculate percentiles
    let p50 = 0, p95 = 0, p99 = 0;
    if (this.responseTimeHistory.length > 0) {
      const sorted = [...this.responseTimeHistory].sort((a, b) => a - b);
      p50 = sorted[Math.floor(sorted.length * 0.5)] || 0;
      p95 = sorted[Math.ceil(sorted.length * 0.95) - 1] || 0;
      p99 = sorted[Math.ceil(sorted.length * 0.99) - 1] || 0;
    }

    const flashPercent = this.modelMetrics.totalRequests > 0
      ? (this.modelMetrics.flashRequests / this.modelMetrics.totalRequests) * 100
      : 0;

    const successRate = this.modelMetrics.totalRequests > 0
      ? (this.modelMetrics.successCount / this.modelMetrics.totalRequests) * 100
      : 0;

    const fallbackRate = this.modelMetrics.totalRequests > 0
      ? (this.modelMetrics.fallbackUsed / this.modelMetrics.totalRequests) * 100
      : 0;

    return {
      totalRequests: this.modelMetrics.totalRequests,
      cacheHits: cacheStats.totalHits,
      cacheMisses: cacheStats.semantic.misses,
      cacheHitRate: Math.round(cacheHitRate * 10) / 10,
      modelUsage: {
        flash: this.modelMetrics.flashRequests,
        pro: this.modelMetrics.proRequests,
        flashPercent: Math.round(flashPercent * 10) / 10
      },
      performance: {
        avgResponseTime: Math.round(avgResponseTime),
        avgFlashTime: Math.round(avgFlashTime),
        avgProTime: Math.round(avgProTime),
        p50: Math.round(p50),
        p95: Math.round(p95),
        p99: Math.round(p99)
      },
      reliability: {
        successRate: Math.round(successRate * 10) / 10,
        fallbackRate: Math.round(fallbackRate * 10) / 10,
        totalRetries: this.modelMetrics.totalRetries
      },
      timeSavings: this.calculateTimeSavings()
    };
  }

  /**
   * Calculate estimated time savings from adaptive model selection
   */
  private calculateTimeSavings(): string {
    const { flashRequests, flashResponseTimes, proResponseTimes } = this.modelMetrics;

    if (flashRequests === 0 || flashResponseTimes.length === 0 || proResponseTimes.length === 0) {
      return '0s (insufficient data)';
    }

    const avgFlash = flashResponseTimes.reduce((a, b) => a + b, 0) / flashResponseTimes.length;
    const avgPro = proResponseTimes.reduce((a, b) => a + b, 0) / proResponseTimes.length;

    // Calculate time saved by using Flash instead of Pro for simple content
    const timeSavedMs = flashRequests * (avgPro - avgFlash);
    const timeSavedSec = timeSavedMs / 1000;

    if (timeSavedSec < 0) {
      return '0s (Flash slower in this sample)';
    }

    const reductionPercent = avgPro > 0 ? (timeSavedSec / (flashRequests * avgPro / 1000)) * 100 : 0;
    return `${timeSavedSec.toFixed(1)}s (${reductionPercent.toFixed(1)}% reduction)`;
  }

  /**
   * Clear cache and re-create warmup manager
   */
  clearCache(): void {
    this.cache = new LLMCache<unknown>({ maxSize: 200, ttlMinutes: 120 });
    this.cacheWarmupManager = new CacheWarmupManager<unknown>(this.cache);
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.modelMetrics = {
      totalRequests: 0,
      flashRequests: 0,
      proRequests: 0,
      fallbackUsed: 0,
      totalRetries: 0,
      successCount: 0,
      failureCount: 0,
      flashResponseTimes: [],
      proResponseTimes: []
    };
    this.responseTimeHistory = [];
    // REQ-098: Reset monitoring state
    this.tokenTracker.reset();
    this.budgetAlert.resetSession();
  }

  // =========================================================================
  // REQ-098: Token usage & cost monitoring accessors
  // =========================================================================

  /**
   * Get token usage summary across all recorded API calls.
   */
  getTokenSummary(): TokenUsageSummary {
    return this.tokenTracker.getSummary();
  }

  /**
   * Get cost estimate for current session.
   */
  getCostEstimate(): CostEstimate {
    return estimateCost(this.tokenTracker.getRecords());
  }

  /**
   * Register a callback for budget alert notifications.
   */
  onBudgetAlert(callback: (alert: BudgetAlert) => void): void {
    this.budgetAlert.onAlert(callback);
  }

  /**
   * Get all budget alerts fired in this session.
   */
  getBudgetAlerts(): { session: ReadonlyArray<BudgetAlert>; daily: ReadonlyArray<BudgetAlert> } {
    return {
      session: this.budgetAlert.getSessionAlerts(),
      daily: this.budgetAlert.getDailyAlerts(),
    };
  }

  /**
   * Get current accumulated cost totals.
   */
  getCostTotals(): { session: number; daily: number } {
    return {
      session: this.budgetAlert.getSessionCost(),
      daily: this.budgetAlert.getDailyCost(),
    };
  }

  /**
   * REQ-098: Record API call metrics (token usage, cost, budget alert).
   * Called internally after each successful Gemini API call.
   */
  private recordApiCallMetrics(
    model: ModelType,
    inputTokens: number,
    outputTokens: number,
    stage: StageType
  ): void {
    // Record token usage
    this.tokenTracker.recordTokenUsage({ model, inputTokens, outputTokens, stage });

    // Calculate cost and feed to budget alert system
    const cost = calculateModelCost(model, inputTokens, outputTokens);
    const alerts = this.budgetAlert.addCost(cost.totalCost);

    // Log budget warnings
    for (const alert of alerts) {
      logger.warn(`Budget alert: ${alert.message}`);
    }
  }
}

// =========================================================================
// TASK-0017: Response Parser (standalone export)
// =========================================================================

/** Default AnalysisResult returned when parsing fails entirely */
const DEFAULT_ANALYSIS_RESULT: AnalysisResult = {
  entities: [],
  relations: [],
  diagramType: { type: 'flow', confidence: 0.0 },
  summary: '',
};

/** Parsed analysis result from LLM response */
export interface AnalysisResult {
  entities: Array<{ id: string; label: string; type: string }>;
  relations: Array<{ from: string; to: string; label: string; type: string }>;
  diagramType: { type: string; confidence: number };
  summary: string;
}

/**
 * TASK-0017: Parse raw LLM response string into a typed AnalysisResult.
 *
 * Features:
 * - Extracts JSON from markdown code blocks (```json ... ```)
 * - Validates required fields (entities, relations, diagramType)
 * - Falls back to default values on parse failure (no error thrown)
 * - Validates entity format (id, label, type)
 * - Validates relation format (from, to, label, type)
 * - Validates diagram type against known types
 */
export function parseResponse(rawResponse: string): AnalysisResult {
  // Handle empty or null-ish input
  if (!rawResponse || typeof rawResponse !== 'string' || rawResponse.trim().length === 0) {
    return { ...DEFAULT_ANALYSIS_RESULT };
  }

  try {
    // Use the existing JSON extraction utility
    const parsed = parseJsonFromLLMText<Record<string, unknown>>(rawResponse);

    if (!parsed || typeof parsed !== 'object') {
      return { ...DEFAULT_ANALYSIS_RESULT };
    }

    // Build result with defaults for each field
    const result: AnalysisResult = {
      entities: extractEntities(parsed),
      relations: extractRelations(parsed),
      diagramType: extractDiagramType(parsed),
      summary: extractSummary(parsed),
    };

    return result;
  } catch (err) {
    logger.warn('[LLMService] Failed to parse analysis result, returning defaults:', err instanceof Error ? err.message : err);
    return { ...DEFAULT_ANALYSIS_RESULT };
  }
}

/**
 * Extract and validate entities from parsed JSON.
 */
function extractEntities(parsed: Record<string, unknown>): AnalysisResult['entities'] {
  if (!Array.isArray(parsed.entities)) {
    return [];
  }

  return parsed.entities
    .filter((e: unknown) => e && typeof e === 'object')
    .map((e: unknown, i: number) => {
      const entity = e as Record<string, unknown>;
      return {
        id: typeof entity.id === 'string' ? entity.id : `entity_${i}`,
        label: typeof entity.label === 'string' ? entity.label : String(entity.label || ''),
        type: typeof entity.type === 'string' ? entity.type : 'unknown',
      };
    });
}

/**
 * Extract and validate relations from parsed JSON.
 */
function extractRelations(parsed: Record<string, unknown>): AnalysisResult['relations'] {
  if (!Array.isArray(parsed.relations)) {
    return [];
  }

  return parsed.relations
    .filter((r: unknown) => r && typeof r === 'object')
    .map((r: unknown) => {
      const rel = r as Record<string, unknown>;
      return {
        from: typeof rel.from === 'string' ? rel.from : '',
        to: typeof rel.to === 'string' ? rel.to : '',
        label: typeof rel.label === 'string' ? rel.label : '',
        type: typeof rel.type === 'string' ? rel.type : 'unknown',
      };
    });
}

/**
 * Extract and validate diagram type from parsed JSON.
 */
function extractDiagramType(parsed: Record<string, unknown>): AnalysisResult['diagramType'] {
  const defaultDiagram = { type: 'flow', confidence: 0.5 };

  if (!parsed.diagramType || typeof parsed.diagramType !== 'object') {
    return defaultDiagram;
  }

  const dt = parsed.diagramType as Record<string, unknown>;
  const type = typeof dt.type === 'string' ? dt.type : 'flow';
  const confidence = typeof dt.confidence === 'number' ? dt.confidence : 0.5;

  // Validate diagram type using shared type guard (eliminates duplicate type list)
  if (!isDiagramType(type)) {
    return defaultDiagram;
  }

  return { type, confidence: Math.max(0, Math.min(1, confidence)) };
}

/**
 * Extract summary from parsed JSON.
 */
function extractSummary(parsed: Record<string, unknown>): string {
  if (typeof parsed.summary === 'string') {
    return parsed.summary;
  }
  return '';
}

// =========================================================================
// REQ-098: Model type helper
// =========================================================================

/** Safely cast a model name string to ModelType. Defaults to flash for unknown models. */
function toModelType(modelName: string): ModelType {
  if (modelName === 'gemini-2.5-flash' || modelName === 'gemini-2.5-pro') {
    return modelName;
  }
  return 'gemini-2.5-flash';
}

// Export singleton instance for easy use
export const llmService = new LLMService();
