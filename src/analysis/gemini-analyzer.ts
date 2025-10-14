import 'dotenv/config';
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { DiagramType, NodeDatum, EdgeDatum } from "@/types/diagram";
import type { DiagramAnalysis, DiagramData } from "./types";
import { parseJsonFromLLMText } from "./llm-utils";
import { LLMCache } from "./llm-cache";

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
  private requestCount: number = 0;
  private lastRequestTime: number = 0;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GOOGLE_API_KEY;
    this.cache = new LLMCache<DiagramAnalysis>({ maxSize: 200, ttlMinutes: 120 });
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

  async analyzeText(text: string, timeoutMs: number = 30000): Promise<DiagramAnalysis | null> {
    if (!this.isEnabled()) return null;

    // Check cache first
    const cached = this.cache.get(text, 'gemini');
    if (cached) {
      console.log('✨ Using cached LLM analysis');
      return cached;
    }

    const genAI = new GoogleGenerativeAI(this.apiKey!);

    const executeRequest = async (modelName: string, attempt: number = 0): Promise<DiagramAnalysis | null> => {
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

      // Optimize prompt for faster processing and more reliable JSON output
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

テキスト:
${text.slice(0, 1000)}

JSON:`; // Limit input text to 1000 chars for faster processing

      // Add timeout wrapper
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
      );

      const result = await Promise.race([
        model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }] }),
        timeoutPromise
      ]);

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

    // Try primary model with retries
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await executeRequest("gemini-2.5-pro", attempt);
        // Cache successful result
        if (result) {
          this.cache.set(text, result, 'gemini');
        }
        return result;
      } catch (err: any) {
        lastError = err;
        const isRateLimit = err.status === 429 || (err.errorDetails && err.errorDetails.some((d: any) => d['@type']?.includes('QuotaFailure')));
        const isTimeout = err.message === 'Request timeout';

        if (isRateLimit || isTimeout) {
          const reason = isRateLimit ? 'Rate limit' : 'Timeout';
          console.warn(`${reason} with gemini-2.5-pro (attempt ${attempt + 1}/${maxRetries})`);

          if (attempt < maxRetries - 1) {
            continue; // Retry with backoff
          } else {
            // Exhausted retries, try flash model
            console.warn('Switching to gemini-2.5-flash...');
            break;
          }
        }

        // For other errors, fail immediately
        console.warn("Gemini analysis failed with error:", err.message || err);
        return null;
      }
    }

    // Try flash model as final fallback with retries
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await executeRequest("gemini-2.5-flash", attempt);
        // Cache successful result
        if (result) {
          this.cache.set(text, result, 'gemini');
        }
        return result;
      } catch (err: any) {
        lastError = err;
        console.warn(`Flash model failed (attempt ${attempt + 1}/${maxRetries}):`, err.message || err);

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
    return {
      ...this.cache.getStats(),
      totalRequests: this.requestCount,
    };
  }
}
