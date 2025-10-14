import { DiagramData } from "./types";
import { LLMService, llmService } from "./llm-service";

/**
 * Phase 22: Content Analyzer - Refactored to use Unified LLMService
 *
 * Changes from Phase 21:
 * - Removed duplicate LLM logic (now in LLMService)
 * - Simplified to focus on diagram-specific analysis
 * - Maintains backward compatibility
 * - All LLM operations delegated to LLMService
 *
 * Benefits:
 * - Reduced code complexity (280 lines → ~120 lines)
 * - Shared cache with other analyzers
 * - Consistent retry and error handling
 * - Unified performance metrics
 */
export class ContentAnalyzer {
  private llmService: LLMService;

  constructor(apiKey?: string, llmServiceInstance?: LLMService) {
    // Use provided LLMService or create new one (for testing)
    this.llmService = llmServiceInstance || (apiKey ? new LLMService(apiKey) : llmService);
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

  // Iteration 2: LLM-based structural extraction using Phase 22 Unified LLMService
  async analyzeV2(text: string): Promise<DiagramData> {
    if (!this.llmService.isEnabled()) {
      console.log('⚠️  LLMService not enabled, falling back to rule-based');
      return this.analyzeV1(text);
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

    // Use LLMService for execution (handles caching, retry, fallback automatically)
    const response = await this.llmService.execute<DiagramData>({
      prompt,
      context: text,
      options: {
        temperature: 0.1,
        maxOutputTokens: 2048,
        cacheKey: `content-analyzer:${text.substring(0, 100)}`
      }
    });

    if (response.success && response.data) {
      // Validate structure
      if (!response.data.nodes || !Array.isArray(response.data.nodes)) {
        console.warn('⚠️  Invalid nodes structure, falling back to rule-based');
        return this.analyzeV1(text);
      }
      if (!response.data.edges || !Array.isArray(response.data.edges)) {
        console.warn('⚠️  Missing edges array, adding empty array');
        response.data.edges = [];
      }

      console.log(`✅ Phase 22: ContentAnalyzer success via LLMService (${response.metadata.model}, ${response.metadata.responseTime}ms)`);
      return response.data;
    } else {
      console.warn(`⚠️  LLMService failed: ${response.error}, falling back to rule-based`);
      return this.analyzeV1(text);
    }
  }

  /**
   * Phase 22: Get performance statistics (delegated to LLMService)
   */
  getStats() {
    return this.llmService.getStats();
  }

  async execute(text: string): Promise<DiagramData> {
    return this.analyzeV2(text);
  }
}
