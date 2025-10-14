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
import { LLMCache } from "./llm-cache";
import { ComplexityDetector, ComplexityAnalysis } from "./complexity-detector";
import { parseJsonFromLLMText } from "./llm-utils";

/**
 * LLM Request configuration
 */
export interface LLMRequest<T = any> {
  prompt: string;
  context: string; // For caching and complexity analysis
  options?: {
    temperature?: number;
    maxOutputTokens?: number;
    forceModel?: 'gemini-2.5-flash' | 'gemini-2.5-pro';
    timeout?: number;
    maxRetries?: number;
    cacheKey?: string;
  };
  parser?: (text: string) => T; // Custom parser function
}

/**
 * LLM Response with metadata
 */
export interface LLMResponse<T = any> {
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
  private cache: LLMCache<any>;
  private complexityDetector: ComplexityDetector;

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

  // Rate limiting configuration
  private readonly MIN_REQUEST_INTERVAL = 500; // 500ms between requests

  constructor(apiKey?: string, options?: {
    cacheSize?: number;
    cacheTTL?: number;
    cachePersistPath?: string;
  }) {
    const key = apiKey || process.env.GOOGLE_API_KEY;
    if (key) {
      this.genAI = new GoogleGenerativeAI(key);
    }

    this.cache = new LLMCache<any>({
      maxSize: options?.cacheSize || 200,
      ttlMinutes: options?.cacheTTL || 120,
      persistPath: options?.cachePersistPath || '.cache/llm/unified-cache.json'
    });

    this.complexityDetector = new ComplexityDetector();
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
  async execute<T = any>(request: LLMRequest<T>): Promise<LLMResponse<T>> {
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
      console.log('✨ LLMService: Using cached result');
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

    // Analyze complexity to select optimal model
    const complexity = this.complexityDetector.analyze(request.context);
    console.log(`🔍 LLMService: Complexity ${complexity.level} (${(complexity.score * 100).toFixed(1)}%)`);
    console.log(`📊 LLMService: Recommended model: ${complexity.recommendedModel}`);

    // Determine models to use
    const primaryModel = request.options?.forceModel || complexity.recommendedModel;
    const fallbackModel = primaryModel === 'gemini-2.5-pro'
      ? 'gemini-2.5-flash'
      : 'gemini-2.5-pro';

    console.log(`🎯 LLMService: Primary=${primaryModel}, Fallback=${fallbackModel}`);

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
    let lastError: any = null;

    // Try primary model with retries
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await this.executeRequest(
          primaryModel,
          request.prompt,
          {
            temperature: request.options?.temperature || 0.1,
            maxOutputTokens: request.options?.maxOutputTokens || 2048
          },
          timeout,
          attempt
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
          parsedData = request.parser(result);
        } else {
          parsedData = parseJsonFromLLMText<T>(result);
        }

        // Cache successful result
        this.cache.set(cacheKey, parsedData, 'unified-llm-service');
        this.modelMetrics.successCount++;

        console.log(`✅ LLMService: Success with ${primaryModel} (${responseTime}ms, attempt ${attempt + 1})`);

        return {
          success: true,
          data: parsedData,
          metadata: {
            model: primaryModel,
            responseTime,
            fromCache: false,
            complexity,
            retryCount: attempt,
            fallbackUsed: false
          }
        };

      } catch (err: any) {
        lastError = err;
        retryCount = attempt + 1;
        this.modelMetrics.totalRetries++;

        const isRateLimit = err.status === 429 ||
          (err.errorDetails && err.errorDetails.some((d: any) => d['@type']?.includes('QuotaFailure')));
        const isTimeout = err.message === 'Request timeout';

        if (isRateLimit || isTimeout) {
          const reason = isRateLimit ? 'Rate limit' : 'Timeout';
          console.warn(`${reason} with ${primaryModel} (attempt ${attempt + 1}/${maxRetries})`);

          if (attempt < maxRetries - 1) {
            continue; // Retry with backoff
          } else {
            // Exhausted retries, try fallback
            console.warn(`⚠️  LLMService: Switching to fallback ${fallbackModel}`);
            break;
          }
        }

        // For other errors, fail immediately
        console.error(`❌ LLMService: ${primaryModel} failed:`, err.message || err);
        this.modelMetrics.failureCount++;

        return {
          success: false,
          error: err.message || 'LLM request failed',
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
    console.log(`🔄 LLMService: Attempting fallback with ${fallbackModel}`);

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await this.executeRequest(
          fallbackModel,
          request.prompt,
          {
            temperature: request.options?.temperature || 0.1,
            maxOutputTokens: request.options?.maxOutputTokens || 2048
          },
          timeout,
          attempt
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
          parsedData = request.parser(result);
        } else {
          parsedData = parseJsonFromLLMText<T>(result);
        }

        // Cache successful result
        this.cache.set(cacheKey, parsedData, 'unified-llm-service');
        this.modelMetrics.successCount++;

        console.log(`✅ LLMService: Success with fallback ${fallbackModel} (${responseTime}ms, attempt ${attempt + 1})`);

        return {
          success: true,
          data: parsedData,
          metadata: {
            model: fallbackModel,
            responseTime,
            fromCache: false,
            complexity,
            retryCount: retryCount + attempt,
            fallbackUsed: true
          }
        };

      } catch (err: any) {
        lastError = err;
        this.modelMetrics.totalRetries++;
        console.warn(`❌ LLMService: Fallback ${fallbackModel} failed (attempt ${attempt + 1}/${maxRetries}):`, err.message);

        if (attempt < maxRetries - 1) {
          continue; // Retry with backoff
        }
      }
    }

    // All retries exhausted
    this.modelMetrics.failureCount++;
    console.error('❌ LLMService: All retry attempts exhausted. Last error:', lastError?.message || lastError);

    return {
      success: false,
      error: `All retries exhausted. Last error: ${lastError?.message || 'Unknown error'}`,
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
   */
  private async executeRequest(
    modelName: string,
    prompt: string,
    generationConfig: { temperature: number; maxOutputTokens: number },
    timeout: number,
    attempt: number
  ): Promise<string> {
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

    // Add timeout wrapper
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeout)
    );

    const result = await Promise.race([
      model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }] }),
      timeoutPromise
    ]);

    const response = await result.response;
    const responseText = response.text();

    if (!responseText || responseText.trim().length === 0) {
      throw new Error('Empty response from LLM');
    }

    return responseText;
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

    const baseDelay = 1000; // 1 second
    const maxDelay = 32000; // 32 seconds
    const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.3 * delay;
    const finalDelay = delay + jitter;

    console.log(`⏳ LLMService: Waiting ${(finalDelay / 1000).toFixed(1)}s before retry (attempt ${attempt})...`);
    await new Promise(resolve => setTimeout(resolve, finalDelay));
  }

  /**
   * Calculate adaptive timeout based on historical response times
   * Uses P95 (95th percentile) for robust timeout estimation
   */
  private getAdaptiveTimeout(): number {
    const DEFAULT_TIMEOUT = 30000; // 30 seconds
    const MIN_TIMEOUT = 15000; // 15 seconds
    const MAX_TIMEOUT = 60000; // 60 seconds

    if (this.responseTimeHistory.length === 0) {
      return DEFAULT_TIMEOUT;
    }

    // Calculate P95
    const sorted = [...this.responseTimeHistory].sort((a, b) => a - b);
    const p95Index = Math.ceil(sorted.length * 0.95) - 1;
    const p95ResponseTime = sorted[Math.max(0, p95Index)];

    // Use P95 + 50% buffer as timeout
    const adaptiveTimeout = Math.max(MIN_TIMEOUT, Math.min(MAX_TIMEOUT, p95ResponseTime * 1.5));

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
    const cacheHitRate = cacheStats.hits + cacheStats.misses > 0
      ? (cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100
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
      cacheHits: cacheStats.hits,
      cacheMisses: cacheStats.misses,
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
   * Clear cache
   */
  clearCache(): void {
    this.cache = new LLMCache<any>({ maxSize: 200, ttlMinutes: 120 });
    console.log('✅ LLMService: Cache cleared');
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
    console.log('✅ LLMService: Metrics reset');
  }
}

// Export singleton instance for easy use
export const llmService = new LLMService();
