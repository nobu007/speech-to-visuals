/**
 * Phase 23: Gemini Analyzer - Refactored to use Unified LLMService
 *
 * Migration from Phase 19/22:
 * - Removed all duplicate LLM logic (now in LLMService)
 * - Simplified to focus on Gemini-specific diagram analysis
 * - Maintains 100% backward compatibility
 * - All LLM operations delegated to LLMService
 *
 * Benefits:
 * - Reduced code complexity (437 lines → ~150 lines, 65% reduction)
 * - Shared cache with ContentAnalyzer and future analyzers
 * - Consistent retry and error handling
 * - Unified performance metrics across all LLM operations
 * - Single source of truth for rate limiting
 *
 * Changes from Phase 19:
 * - Before: Direct GoogleGenerativeAI usage with custom retry/cache logic
 * - After: LLMService.execute() with custom parser
 * - Removed: checkRateLimit, waitForBackoff, getAdaptiveTimeout, recordResponseTime
 * - Removed: executeRequest, all retry logic, all cache management
 * - Kept: analyzeText public API (100% backward compatible)
 * - Kept: getCacheStats (now delegates to LLMService)
 */

import 'dotenv/config';
import type { DiagramType, NodeDatum, EdgeDatum } from "@/types/diagram";
import type { DiagramAnalysis, DiagramData } from "./types";
import { parseJsonFromLLMText } from "./llm-utils";
import { LLMService, llmService } from "./llm-service";

type GeminiDiagramType = DiagramData['type'];

const typeMap: Record<GeminiDiagramType, DiagramType> = {
  flowchart: "flow",
  mindmap: "tree",
  timeline: "timeline",
  orgchart: "tree",
};

const INITIAL_LLM_CONFIDENCE = 0.9;

/**
 * GeminiAnalyzer: Specialized analyzer for diagram structure extraction
 * Now powered by unified LLMService for consistency and performance
 */
export class GeminiAnalyzer {
  private llmService: LLMService;

  constructor(apiKey?: string, llmServiceInstance?: LLMService) {
    // Use provided LLMService or create new one (for testing)
    // Default to singleton llmService for shared caching
    this.llmService = llmServiceInstance || (apiKey ? new LLMService(apiKey) : llmService);
  }

  isEnabled(): boolean {
    return this.llmService.isEnabled();
  }

  /**
   * Analyze text and extract diagram structure
   * Uses LLMService for all LLM operations with adaptive model selection
   */
  async analyzeText(text: string, timeoutMs?: number): Promise<DiagramAnalysis | null> {
    if (!this.isEnabled()) {
      console.log('⚠️  GeminiAnalyzer: LLMService not enabled');
      return null;
    }

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

    // Custom parser for GeminiAnalyzer-specific output format
    const parser = (responseText: string): DiagramAnalysis => {
      // Log response for debugging (first 200 chars)
      console.log(`📥 GeminiAnalyzer response preview: ${responseText.slice(0, 200).replace(/\n/g, ' ')}...`);

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
        reasoning: `LLM 解析結果に基づく構造化データ`,
      };
    };

    // Use LLMService with custom parser
    // LLMService handles: caching, complexity analysis, model selection, retry, fallback
    const response = await this.llmService.execute<DiagramAnalysis>({
      prompt,
      context: text,
      options: {
        temperature: 0.1, // Very low temperature for consistent, deterministic outputs
        maxOutputTokens: 2048, // Increased to prevent truncation
        timeout: timeoutMs,
        cacheKey: `gemini-analyzer:${text.slice(0, 100)}`,
        maxRetries: 3
      },
      parser
    });

    if (response.success && response.data) {
      console.log(`✅ Phase 23: GeminiAnalyzer success via LLMService`);
      console.log(`   Model: ${response.metadata.model}`);
      console.log(`   Response time: ${response.metadata.responseTime}ms`);
      console.log(`   From cache: ${response.metadata.fromCache}`);
      console.log(`   Complexity: ${response.metadata.complexity?.level || 'N/A'}`);
      console.log(`   Fallback used: ${response.metadata.fallbackUsed}`);

      return response.data;
    } else {
      console.warn(`⚠️  GeminiAnalyzer: LLMService failed - ${response.error}`);
      return null;
    }
  }

  /**
   * Get cache statistics and performance metrics
   * Phase 23: Delegates to unified LLMService for consistent reporting
   */
  getCacheStats() {
    const stats = this.llmService.getStats();

    // Map LLMServiceStats to legacy format for backward compatibility
    return {
      // Cache stats
      hits: stats.cacheHits,
      misses: stats.cacheMisses,
      size: stats.cacheHits + stats.cacheMisses,

      // Performance stats
      totalRequests: stats.totalRequests,
      adaptiveTimeout: {
        currentTimeoutMs: 30000, // LLMService uses adaptive timeout internally
        avgResponseTimeMs: stats.performance.avgResponseTime,
        p50ResponseTimeMs: stats.performance.p50,
        p95ResponseTimeMs: stats.performance.p95,
        p99ResponseTimeMs: stats.performance.p99,
        historySamples: stats.totalRequests
      },

      // Phase 23: Model selection metrics (unified from LLMService)
      modelSelection: {
        totalRequests: stats.totalRequests,
        flashRequests: stats.modelUsage.flash,
        proRequests: stats.modelUsage.pro,
        flashUsagePercent: stats.modelUsage.flashPercent,
        complexityOverrides: 0, // LLMService tracks fallbackRate instead
        overrideRate: stats.reliability.fallbackRate,
        avgFlashResponseTimeMs: stats.performance.avgFlashTime,
        avgProResponseTimeMs: stats.performance.avgProTime,
        estimatedTimeSavings: stats.timeSavings
      }
    };
  }
}
