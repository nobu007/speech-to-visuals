import { GoogleGenerativeAI } from "@google/generative-ai";

// Local JSON shape for diagram content exchange


import { DiagramData } from "./types";
import { parseJsonFromLLMText } from "./llm-utils";
import { LLMCache } from "./llm-cache";
import { ComplexityDetector } from "./complexity-detector";

/**
 * Phase 21: Content Analyzer with Adaptive Model Selection
 * Unified with GeminiAnalyzer's Phase 19 adaptive model selection capabilities
 *
 * Enhancements:
 * - Adaptive model selection based on content complexity
 * - Performance tracking and optimization
 * - Automatic fallback mechanisms
 * - Real-time performance metrics
 */
export class ContentAnalyzer {
  private genAI?: GoogleGenerativeAI;
  private cache: LLMCache<DiagramData>;
  private complexityDetector: ComplexityDetector;
  private responseTimeHistory: number[] = [];
  private readonly MAX_HISTORY_SIZE = 20;

  // Phase 21: Adaptive model selection metrics
  private modelSelectionMetrics = {
    totalRequests: 0,
    flashRequests: 0,
    proRequests: 0,
    avgFlashResponseTime: [] as number[],
    avgProResponseTime: [] as number[]
  };

  constructor(apiKey?: string) {
    const key = apiKey || process.env.GOOGLE_API_KEY;
    if (key) {
      this.genAI = new GoogleGenerativeAI(key);
    }
    this.cache = new LLMCache<DiagramData>({ maxSize: 100, ttlMinutes: 90 });
    this.complexityDetector = new ComplexityDetector();
  }

  // Iteration 1: simple rule-based baseline using sentence splitting
  analyzeV1(text: string): DiagramData {
    const sentences = text
      .split(/[。.!?\n]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 10);

    const MAX_SENTENCE_LENGTH = 60;
    const nodes = sentences.map((s, i) => ({
      id: `n${i + 1}`,
      label: s.length > MAX_SENTENCE_LENGTH ? s.slice(0, MAX_SENTENCE_LENGTH - 3) + "…" : s,
    }));
    const edges = nodes.slice(1).map((_, i) => ({ from: `n${i + 1}`, to: `n${i + 2}` }));

    return {
      title: "Auto-generated (rule-based)",
      type: "flowchart",
      nodes,
      edges,
    };
  }

  // Iteration 2: LLM-based structural extraction with Phase 21 adaptive model selection
  async analyzeV2(text: string): Promise<DiagramData> {
    if (!this.genAI) {
      console.log('⚠️  Gemini API not configured, falling back to rule-based');
      return this.analyzeV1(text);
    }

    // Check cache first
    const cached = this.cache.get(text, 'content-analyzer');
    if (cached) {
      console.log('✨ Using cached content analysis');
      return cached;
    }

    // Phase 21: Analyze content complexity to select optimal model
    const complexityAnalysis = this.complexityDetector.analyze(text);
    console.log(`🔍 Phase 21: ContentAnalyzer - Complexity: ${complexityAnalysis.level} (score: ${(complexityAnalysis.score * 100).toFixed(1)}%)`);
    console.log(`📊 Recommended model: ${complexityAnalysis.recommendedModel}`);
    console.log(`💡 Reasoning: ${complexityAnalysis.reasoning}`);

    // Track model selection metrics
    this.modelSelectionMetrics.totalRequests++;

    // Select model based on complexity
    const primaryModel = complexityAnalysis.recommendedModel;
    const fallbackModel = primaryModel === 'gemini-2.5-pro' ? 'gemini-2.5-flash' : 'gemini-2.5-pro';

    // Track model usage
    if (primaryModel === 'gemini-2.5-flash') {
      this.modelSelectionMetrics.flashRequests++;
    } else {
      this.modelSelectionMetrics.proRequests++;
    }

    const prompt = `以下のテキストを分析し、内容を最もよく表す図解を生成するためのJSONデータを作成してください。

JSONの形式は {title, type, nodes, edges}。
- type は 'flowchart' | 'mindmap' | 'timeline' | 'orgchart' のいずれか
- nodes は {id, label} の配列
- edges は {from, to, label?} の配列

重要な指示:
1. JSONのみを返してください（コードブロック不要）
2. **関係性を正確に抽出**: テキスト中の「次に」「その後」「から」「により」「を経て」「その下に」などの接続語から、ノード間の依存関係を edges で正確に表現してください
3. **順序を保持**: 時系列や手順がある場合、edges で順序関係を必ず含めてください
4. **階層を表現**: 組織図や分類の場合、上位→下位の関係を edges で明確に表現してください
5. すべての重要なノードに少なくとも1つの接続（edge）を作成してください

テキスト:
"${text}"`;

    // Try primary model first
    const requestStartTime = Date.now();

    try {
      const model = this.genAI.getGenerativeModel({
        model: primaryModel,
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
        }
      });

      const result = await model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }] });
      const response = await result.response;
      const responseText = response.text();

      const responseTime = Date.now() - requestStartTime;
      this.recordResponseTime(responseTime);

      // Track response time by model
      if (primaryModel === 'gemini-2.5-flash') {
        this.modelSelectionMetrics.avgFlashResponseTime.push(responseTime);
      } else {
        this.modelSelectionMetrics.avgProResponseTime.push(responseTime);
      }

      console.log(`⏱️  ${primaryModel} response time: ${(responseTime / 1000).toFixed(2)}s`);

      // Check for empty response
      if (!responseText || responseText.trim().length === 0) {
        throw new Error("Empty response from LLM");
      }

      const parsed = parseJsonFromLLMText<DiagramData>(responseText);

      // Shallow validation
      if (!parsed || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
        throw new Error("Invalid JSON structure from LLM");
      }

      // Cache successful result
      this.cache.set(text, parsed, 'content-analyzer');
      console.log(`✅ Phase 21: Success with ${primaryModel}`);

      return parsed;
    } catch (primaryError) {
      console.error(`❌ ${primaryModel} failed, trying fallback ${fallbackModel}:`, primaryError);

      // Try fallback model
      try {
        const fallbackModelInstance = this.genAI.getGenerativeModel({
          model: fallbackModel,
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048,
          }
        });

        const fallbackResult = await fallbackModelInstance.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }]
        });
        const fallbackResponse = await fallbackResult.response;
        const fallbackText = fallbackResponse.text();

        const fallbackResponseTime = Date.now() - requestStartTime;
        this.recordResponseTime(fallbackResponseTime);

        // Track response time by model
        if (fallbackModel === 'gemini-2.5-flash') {
          this.modelSelectionMetrics.avgFlashResponseTime.push(fallbackResponseTime);
        } else {
          this.modelSelectionMetrics.avgProResponseTime.push(fallbackResponseTime);
        }

        console.log(`✅ Fallback ${fallbackModel} succeeded in ${(fallbackResponseTime / 1000).toFixed(2)}s`);

        const parsed = parseJsonFromLLMText<DiagramData>(fallbackText);

        // Shallow validation
        if (!parsed || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
          throw new Error("Invalid JSON structure from fallback LLM");
        }

        this.cache.set(text, parsed, 'content-analyzer');
        return parsed;
      } catch (fallbackError) {
        console.error("❌ Fallback LLM also failed, using rule-based:", fallbackError);
        return this.analyzeV1(text);
      }
    }
  }

  /**
   * Record response time for performance tracking
   */
  private recordResponseTime(timeMs: number): void {
    this.responseTimeHistory.push(timeMs);
    if (this.responseTimeHistory.length > this.MAX_HISTORY_SIZE) {
      this.responseTimeHistory.shift();
    }
  }

  /**
   * Get comprehensive performance statistics
   */
  getStats() {
    const avgFlashTime = this.modelSelectionMetrics.avgFlashResponseTime.length > 0
      ? this.modelSelectionMetrics.avgFlashResponseTime.reduce((a, b) => a + b, 0) / this.modelSelectionMetrics.avgFlashResponseTime.length
      : 0;

    const avgProTime = this.modelSelectionMetrics.avgProResponseTime.length > 0
      ? this.modelSelectionMetrics.avgProResponseTime.reduce((a, b) => a + b, 0) / this.modelSelectionMetrics.avgProResponseTime.length
      : 0;

    const flashUsagePercent = this.modelSelectionMetrics.totalRequests > 0
      ? (this.modelSelectionMetrics.flashRequests / this.modelSelectionMetrics.totalRequests) * 100
      : 0;

    return {
      ...this.cache.getStats(),
      modelSelection: {
        totalRequests: this.modelSelectionMetrics.totalRequests,
        flashRequests: this.modelSelectionMetrics.flashRequests,
        proRequests: this.modelSelectionMetrics.proRequests,
        flashUsagePercent: Math.round(flashUsagePercent * 10) / 10,
        avgFlashResponseTimeMs: Math.round(avgFlashTime),
        avgProResponseTimeMs: Math.round(avgProTime),
        estimatedTimeSavings: this.calculateTimeSavings()
      }
    };
  }

  /**
   * Phase 21: Calculate estimated time savings from adaptive model selection
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

    const reductionPercent = avgPro > 0 ? (timeSavedSec / (flashRequests * avgPro / 1000)) * 100 : 0;
    return `${timeSavedSec.toFixed(1)}s (${reductionPercent.toFixed(1)}% reduction)`;
  }

  async execute(text: string): Promise<DiagramData> {
    return this.analyzeV2(text);
  }
}
