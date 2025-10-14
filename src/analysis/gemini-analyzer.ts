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
          temperature: 0.3, // Lower temperature for more consistent outputs
          maxOutputTokens: 1024, // Limit output size for faster responses
        }
      });

      // Optimize prompt for faster processing
      const prompt = `以下のテキストを分析し、内容を最もよく表す図解を生成するためのJSONデータを作成してください。\n` +
        `JSON形式: {title, type, nodes, edges}\n` +
        `- typeは flowchart | mindmap | timeline | orgchart のいずれか\n` +
        `- nodes: {id, label}[]\n` +
        `- edges: {from, to, label?}[]\n` +
        `JSONのみを返してください。コードブロックは不要です。\n\n` +
        `テキスト:\n${text.slice(0, 1000)}`; // Limit input text to 1000 chars for faster processing

      // Add timeout wrapper
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
      );

      const result = await Promise.race([
        model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }] }),
        timeoutPromise
      ]);

      const response = await result.response;
      const responseText = response.text();

      // Check for empty or invalid response
      if (!responseText || responseText.trim().length === 0) {
        throw new Error('Empty response from LLM');
      }

      const parsed = parseJsonFromLLMText<DiagramData>(responseText);

      // Validate parsed data structure
      if (!parsed || !parsed.type || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
        throw new Error('Invalid diagram data structure from LLM');
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
