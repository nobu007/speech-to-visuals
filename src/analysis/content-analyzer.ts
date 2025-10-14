import { DiagramData } from "./types";
import { LLMService, llmService } from "./llm-service";
import { getContentAnalyzerPrompt, type Language } from "./prompt-templates";

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
  private preferredLanguage: Language;

  constructor(apiKey?: string, llmServiceInstance?: LLMService, preferredLanguage: Language = 'auto') {
    // Use provided LLMService or create new one (for testing)
    this.llmService = llmServiceInstance || (apiKey ? new LLMService(apiKey) : llmService);
    this.preferredLanguage = preferredLanguage;
  }

  /**
   * Phase 32: Set preferred language for prompts
   */
  setLanguage(language: Language): void {
    this.preferredLanguage = language;
    console.log(`🌐 ContentAnalyzer language preference set to: ${language}`);
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

    // Phase 32: Use adaptive multilingual prompts
    const prompt = getContentAnalyzerPrompt(text, this.preferredLanguage);

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
