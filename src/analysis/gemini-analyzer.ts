import 'dotenv/config';
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { DiagramType, NodeDatum, EdgeDatum } from "@/types/diagram";
import type { DiagramAnalysis, DiagramData } from "./types";
import { parseJsonFromLLMText } from "./llm-utils";
import { LLMCache } from "./llm-cache";
import { ComplexityDetector, ComplexityAnalysis } from "./complexity-detector";

type GeminiDiagramType = DiagramData['type'];

const typeMap: Record<GeminiDiagramType, DiagramType> = {
  flowchart: "flow",
  mindmap: "tree",
  timeline: "timeline",
  orgchart: "tree",
};

const INITIAL_LLM_CONFIDENCE = 0.9;

export class GeminiAnalyzer {
  private apiKey?: string;
  private cache: LLMCache<DiagramAnalysis>;
  private complexityDetector: ComplexityDetector;
  private requestCount: number = 0;
  private lastRequestTime: number = 0;
  private responseTimeHistory: number[] = [];
  private readonly MAX_HISTORY_SIZE = 20;

  // Phase 19: Adaptive model selection metrics
  private modelSelectionMetrics = {
    totalRequests: 0,
    flashRequests: 0,
    proRequests: 0,
    complexityOverrides: 0,
    avgFlashResponseTime: [] as number[],
    avgProResponseTime: [] as number[]
  };

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GOOGLE_API_KEY;
    this.cache = new LLMCache<DiagramAnalysis>({
      maxSize: 200,
      ttlMinutes: 120,
      persistPath: '.cache/llm/gemini-cache.json'
    });
    this.complexityDetector = new ComplexityDetector();
  }

  isEnabled(): boolean {
    if (process.env.ANALYSIS_DISABLE_GEMINI === "1") return false;
    return Boolean(this.apiKey);
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

    console.log(`⏳ Waiting ${(finalDelay / 1000).toFixed(1)}s before retry (attempt ${attempt})...`);
    await new Promise(resolve => setTimeout(resolve, finalDelay));
  }

  /**
   * Rate limit check and throttle
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    // Enforce minimum 500ms between requests
    const minInterval = 500;
    if (timeSinceLastRequest < minInterval) {
      const waitTime = minInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  /**
   * Calculate adaptive timeout based on historical response times
   * Uses P95 (95th percentile) for more robust timeout estimation
   */
  private getAdaptiveTimeout(): number {
    const DEFAULT_TIMEOUT = 30000; // 30 seconds
    const MIN_TIMEOUT = 15000; // 15 seconds minimum
    const MAX_TIMEOUT = 60000; // 60 seconds maximum

    if (this.responseTimeHistory.length === 0) {
      return DEFAULT_TIMEOUT;
    }

    // Calculate P95 (95th percentile) for more robust estimation
    const sorted = [...this.responseTimeHistory].sort((a, b) => a - b);
    const p95Index = Math.ceil(sorted.length * 0.95) - 1;
    const p95ResponseTime = sorted[Math.max(0, p95Index)];

    // Also calculate average for logging
    const avgResponseTime = this.responseTimeHistory.reduce((sum, time) => sum + time, 0) / this.responseTimeHistory.length;

    // Use P95 + 50% buffer as timeout (with min/max bounds)
    // This ensures 95% of requests complete within timeout while providing safety margin
    const adaptiveTimeout = Math.max(MIN_TIMEOUT, Math.min(MAX_TIMEOUT, p95ResponseTime * 1.5));

    return Math.round(adaptiveTimeout);
  }

  /**
   * Record response time for adaptive timeout calculation
   */
  private recordResponseTime(timeMs: number): void {
    this.responseTimeHistory.push(timeMs);

    // Keep only recent history
    if (this.responseTimeHistory.length > this.MAX_HISTORY_SIZE) {
      this.responseTimeHistory.shift();
    }
  }

  async analyzeText(text: string, timeoutMs?: number): Promise<DiagramAnalysis | null> {
    if (!this.isEnabled()) return null;

    // Check cache first
    const cached = this.cache.get(text, 'gemini');
    if (cached) {
      console.log('✨ Using cached LLM analysis');
      return cached;
    }

    // Phase 19: Analyze content complexity to select optimal model
    const complexityAnalysis = this.complexityDetector.analyze(text);
    console.log(`🔍 Phase 19: Complexity detected - ${complexityAnalysis.level} (score: ${(complexityAnalysis.score * 100).toFixed(1)}%)`);
    console.log(`📊 Recommended model: ${complexityAnalysis.recommendedModel}`);
    console.log(`💡 Reasoning: ${complexityAnalysis.reasoning}`);

    // Track model selection metrics
    this.modelSelectionMetrics.totalRequests++;

    // Use adaptive timeout if not explicitly specified
    const effectiveTimeout = timeoutMs ?? this.getAdaptiveTimeout();
    if (!timeoutMs && this.responseTimeHistory.length > 0) {
      console.log(`⏱️  Using adaptive timeout: ${(effectiveTimeout / 1000).toFixed(1)}s (based on ${this.responseTimeHistory.length} historical samples)`);
    }

    const genAI = new GoogleGenerativeAI(this.apiKey!);

    const executeRequest = async (modelName: string, attempt: number = 0): Promise<DiagramAnalysis | null> => {
      const requestStartTime = Date.now();

      // Apply rate limiting
      await this.checkRateLimit();

      // Apply exponential backoff if retry
      await this.waitForBackoff(attempt);

      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0.1, // Very low temperature for consistent, deterministic outputs
          maxOutputTokens: 2048, // Increased to prevent truncation
          topP: 0.95,
          topK: 40,
        }
      });

      // Optimize prompt for faster processing and more reliable JSON output with emphasis on relationship extraction
      const prompt = `あなたはデータアナリストです。以下のテキストを分析し、図解データをJSON形式で出力してください。

必須フィールド:
- title: 文字列（タイトル）
- type: "flowchart" | "mindmap" | "timeline" | "orgchart" のいずれか
- nodes: 配列 [{id: 文字列, label: 文字列}, ...]
- edges: 配列 [{from: 文字列, to: 文字列, label?: 文字列}, ...]

重要な指示:
1. 説明文は一切不要です
2. コードブロックも不要です
3. 有効なJSON形式のみを返してください
4. ノードは最大10個まで
5. ラベルは60文字以内
6. **関係性を正確に抽出してください**: テキスト中の「次に」「その後」「から」「により」「を経て」「によって」などの接続語に注目し、ノード間の依存関係を edges で正確に表現してください
7. **順序を保持**: 時系列や手順がある場合、edges で順序関係を必ず表現してください
8. **階層を表現**: 組織図や分類の場合、上位→下位の関係を edges で明確に表現してください

テキスト:
${text.slice(0, 1000)}

JSON:`; // Limit input text to 1000 chars for faster processing

      // Add timeout wrapper
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), effectiveTimeout)
      );

      const result = await Promise.race([
        model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }] }),
        timeoutPromise
      ]);

      // Record response time for adaptive timeout
      const responseTime = Date.now() - requestStartTime;
      this.recordResponseTime(responseTime);

      const response = await result.response;
      let responseText: string;

      try {
        responseText = response.text();
      } catch (textErr) {
        console.error(`Failed to extract text from ${modelName} response:`, textErr);
        throw new Error(`Failed to get text from LLM response: ${textErr}`);
      }

      // Check for empty or invalid response
      if (!responseText || responseText.trim().length === 0) {
        console.error(`${modelName} returned empty response`);
        throw new Error('Empty response from LLM');
      }

      // Log response for debugging (first 200 chars)
      console.log(`📥 ${modelName} response preview: ${responseText.slice(0, 200).replace(/\n/g, ' ')}...`);

      const parsed = parseJsonFromLLMText<DiagramData>(responseText);

      // Validate parsed data structure (edges may be missing in truncated responses)
      if (!parsed || !parsed.type || !Array.isArray(parsed.nodes)) {
        throw new Error('Invalid diagram data structure from LLM');
      }

      // Normalize missing or invalid edges array
      if (!parsed.edges || !Array.isArray(parsed.edges)) {
        console.warn('⚠️  Missing edges field in LLM response, defaulting to empty array');
        parsed.edges = [];
      }

      const mappedType: DiagramType = typeMap[parsed.type] ?? "flow";

      const nodes: NodeDatum[] = (parsed.nodes || []).map((n) => ({ id: n.id, label: n.label }));
      const edges: EdgeDatum[] = (parsed.edges || []).map((e) => ({ from: e.from, to: e.to, label: e.label }));

      return {
        type: mappedType,
        confidence: INITIAL_LLM_CONFIDENCE,
        nodes,
        edges,
        reasoning: `LLM (${modelName}) 解析結果に基づく構造化データ`,
      };
    };

    const maxRetries = 3;
    let lastError: any = null;

    // Phase 19: Adaptive model selection based on complexity
    const primaryModel = complexityAnalysis.recommendedModel;
    const fallbackModel = primaryModel === 'gemini-2.5-pro' ? 'gemini-2.5-flash' : 'gemini-2.5-pro';

    console.log(`🎯 Phase 19: Primary model: ${primaryModel}, Fallback: ${fallbackModel}`);

    // Track model usage
    if (primaryModel === 'gemini-2.5-flash') {
      this.modelSelectionMetrics.flashRequests++;
    } else {
      this.modelSelectionMetrics.proRequests++;
    }

    // Try primary model (complexity-based) with retries
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await executeRequest(primaryModel, attempt);

        // Track response time by model
        const responseTime = Date.now() - Date.now(); // Will be tracked in executeRequest
        if (primaryModel === 'gemini-2.5-flash') {
          this.modelSelectionMetrics.avgFlashResponseTime.push(responseTime);
        } else {
          this.modelSelectionMetrics.avgProResponseTime.push(responseTime);
        }

        // Cache successful result
        if (result) {
          this.cache.set(text, result, 'gemini');
          console.log(`✅ Phase 19: Success with ${primaryModel} (attempt ${attempt + 1})`);
        }
        return result;
      } catch (err: any) {
        lastError = err;
        const isRateLimit = err.status === 429 || (err.errorDetails && err.errorDetails.some((d: any) => d['@type']?.includes('QuotaFailure')));
        const isTimeout = err.message === 'Request timeout';

        if (isRateLimit || isTimeout) {
          const reason = isRateLimit ? 'Rate limit' : 'Timeout';
          console.warn(`${reason} with ${primaryModel} (attempt ${attempt + 1}/${maxRetries})`);

          if (attempt < maxRetries - 1) {
            continue; // Retry with backoff
          } else {
            // Exhausted retries, try fallback model
            console.warn(`⚠️  Phase 19: Switching to fallback model ${fallbackModel}...`);
            this.modelSelectionMetrics.complexityOverrides++;
            break;
          }
        }

        // For other errors, fail immediately
        console.warn("Gemini analysis failed with error:", err.message || err);
        return null;
      }
    }

    // Try fallback model with retries
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await executeRequest(fallbackModel, attempt);

        // Track response time by model
        const responseTime = Date.now() - Date.now(); // Will be tracked in executeRequest
        if (fallbackModel === 'gemini-2.5-flash') {
          this.modelSelectionMetrics.avgFlashResponseTime.push(responseTime);
        } else {
          this.modelSelectionMetrics.avgProResponseTime.push(responseTime);
        }

        // Cache successful result
        if (result) {
          this.cache.set(text, result, 'gemini');
          console.log(`✅ Phase 19: Success with fallback ${fallbackModel} (attempt ${attempt + 1})`);
        }
        return result;
      } catch (err: any) {
        lastError = err;
        console.warn(`Fallback model ${fallbackModel} failed (attempt ${attempt + 1}/${maxRetries}):`, err.message || err);

        if (attempt < maxRetries - 1) {
          continue; // Retry with backoff
        }
      }
    }

    // All retries exhausted
    console.warn("All Gemini retry attempts exhausted. Last error:", lastError?.message || lastError);
    return null;
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats() {
    const avgResponseTime = this.responseTimeHistory.length > 0
      ? this.responseTimeHistory.reduce((sum, time) => sum + time, 0) / this.responseTimeHistory.length
      : 0;

    // Calculate P50, P95, P99 for comprehensive monitoring
    let p50 = 0, p95 = 0, p99 = 0;
    if (this.responseTimeHistory.length > 0) {
      const sorted = [...this.responseTimeHistory].sort((a, b) => a - b);
      p50 = sorted[Math.floor(sorted.length * 0.5)] || 0;
      p95 = sorted[Math.ceil(sorted.length * 0.95) - 1] || 0;
      p99 = sorted[Math.ceil(sorted.length * 0.99) - 1] || 0;
    }

    // Phase 19: Calculate model selection metrics
    const avgFlashTime = this.modelSelectionMetrics.avgFlashResponseTime.length > 0
      ? this.modelSelectionMetrics.avgFlashResponseTime.reduce((a, b) => a + b, 0) / this.modelSelectionMetrics.avgFlashResponseTime.length
      : 0;

    const avgProTime = this.modelSelectionMetrics.avgProResponseTime.length > 0
      ? this.modelSelectionMetrics.avgProResponseTime.reduce((a, b) => a + b, 0) / this.modelSelectionMetrics.avgProResponseTime.length
      : 0;

    const flashUsagePercent = this.modelSelectionMetrics.totalRequests > 0
      ? (this.modelSelectionMetrics.flashRequests / this.modelSelectionMetrics.totalRequests) * 100
      : 0;

    const overrideRate = this.modelSelectionMetrics.totalRequests > 0
      ? (this.modelSelectionMetrics.complexityOverrides / this.modelSelectionMetrics.totalRequests) * 100
      : 0;

    return {
      ...this.cache.getStats(),
      totalRequests: this.requestCount,
      adaptiveTimeout: {
        currentTimeoutMs: this.getAdaptiveTimeout(),
        avgResponseTimeMs: Math.round(avgResponseTime),
        p50ResponseTimeMs: Math.round(p50),
        p95ResponseTimeMs: Math.round(p95),
        p99ResponseTimeMs: Math.round(p99),
        historySamples: this.responseTimeHistory.length,
      },
      // Phase 19: Adaptive model selection metrics
      modelSelection: {
        totalRequests: this.modelSelectionMetrics.totalRequests,
        flashRequests: this.modelSelectionMetrics.flashRequests,
        proRequests: this.modelSelectionMetrics.proRequests,
        flashUsagePercent: Math.round(flashUsagePercent * 10) / 10,
        complexityOverrides: this.modelSelectionMetrics.complexityOverrides,
        overrideRate: Math.round(overrideRate * 10) / 10,
        avgFlashResponseTimeMs: Math.round(avgFlashTime),
        avgProResponseTimeMs: Math.round(avgProTime),
        estimatedTimeSavings: this.calculateTimeSavings()
      }
    };
  }

  /**
   * Phase 19: Calculate estimated time savings from adaptive model selection
   */
  private calculateTimeSavings(): string {
    const { flashRequests, avgFlashResponseTime, avgProResponseTime } = this.modelSelectionMetrics;

    if (flashRequests === 0 || avgFlashResponseTime.length === 0 || avgProResponseTime.length === 0) {
      return '0s (insufficient data)';
    }

    const avgFlash = avgFlashResponseTime.reduce((a, b) => a + b, 0) / avgFlashResponseTime.length;
    const avgPro = avgProResponseTime.reduce((a, b) => a + b, 0) / avgProResponseTime.length;

    // Calculate time saved by using Flash instead of Pro for simple content
    const timeSavedMs = flashRequests * (avgPro - avgFlash);
    const timeSavedSec = timeSavedMs / 1000;

    if (timeSavedSec < 0) {
      return '0s (Flash slower in this sample)';
    }

    return `${timeSavedSec.toFixed(1)}s (${((timeSavedSec / avgPro) * 100).toFixed(1)}% reduction)`;
  }
}
