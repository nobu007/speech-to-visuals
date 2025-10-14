import 'dotenv/config';
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { DiagramType, NodeDatum, EdgeDatum } from "@/types/diagram";
import type { DiagramAnalysis, DiagramData } from "./types";
import { parseJsonFromLLMText } from "./llm-utils";

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

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GOOGLE_API_KEY;
  }

  isEnabled(): boolean {
    if (process.env.ANALYSIS_DISABLE_GEMINI === "1") return false;
    return Boolean(this.apiKey);
  }

  async analyzeText(text: string, timeoutMs: number = 30000): Promise<DiagramAnalysis | null> {
    if (!this.isEnabled()) return null;

    const genAI = new GoogleGenerativeAI(this.apiKey!);

    const executeRequest = async (modelName: string): Promise<DiagramAnalysis | null> => {
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
      const parsed = parseJsonFromLLMText<DiagramData>(response.text());
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

    try {
      // 1. Primary model: gemini-2.5-pro
      return await executeRequest("gemini-2.5-pro");
    } catch (err: any) {
      const isRateLimit = err.status === 429 || (err.errorDetails && err.errorDetails.some((d: any) => d['@type']?.includes('QuotaFailure')));
      const isTimeout = err.message === 'Request timeout';

      // 2. Fallback on rate limit or timeout error
      if (isRateLimit || isTimeout) {
        const reason = isRateLimit ? 'Rate limit' : 'Timeout';
        console.warn(`${reason} hit with primary model. Retrying with flash model...`);
        try {
          // 2a. Retry with faster flash model and shorter timeout
          return await executeRequest("gemini-2.5-flash");
        } catch (retryErr: any) {
          console.warn("Gemini analysis failed on retry with flash model.", retryErr.message || retryErr);
          return null;
        }
      }

      // 3. Handle other errors
      console.warn("Gemini analysis failed with a non-recoverable error.", err.message || err);
      return null;
    }
  }
}
