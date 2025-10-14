import { GoogleGenerativeAI } from "@google/generative-ai";

// Local JSON shape for diagram content exchange


import { DiagramData } from "./types";
import { parseJsonFromLLMText } from "./llm-utils";
import { LLMCache } from "./llm-cache";

export class ContentAnalyzer {
  private genAI?: GoogleGenerativeAI;
  private cache: LLMCache<DiagramData>;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.GOOGLE_API_KEY;
    if (key) {
      this.genAI = new GoogleGenerativeAI(key);
    }
    this.cache = new LLMCache<DiagramData>({ maxSize: 100, ttlMinutes: 90 });
  }

  // Iteration 1: simple rule-based baseline using sentence splitting
  analyzeV1(text: string): DiagramData {
    const sentences = text
      .split(/[。.!?\n]+/)      .map((s) => s.trim())
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

  // Iteration 2: LLM-based structural extraction with robust parsing and fallback
  async analyzeV2(text: string): Promise<DiagramData> {
    if (!this.genAI) {
      return this.analyzeV1(text);
    }

    // Check cache first
    const cached = this.cache.get(text, 'content-analyzer');
    if (cached) {
      console.log('✨ Using cached content analysis');
      return cached;
    }

    const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });
    const prompt = `以下のテキストを分析し、内容を最もよく表す図解を生成するためのJSONデータを作成してください。
JSONの形式は {title, type, nodes, edges}。
- type は 'flowchart' | 'mindmap' | 'timeline' | 'orgchart' のいずれか
- nodes は {id, label} の配列
- edges は {from, to, label?} の配列
JSONのみを返してください。コードブロックは不要です。

テキスト:
"${text}"`;

    try {
      const result = await model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }] });
      const response = await result.response;
      const responseText = response.text();

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

      return parsed;
    } catch (error) {
      console.error("LLM analysis failed, falling back to rule-based:", error);
      return this.analyzeV1(text);
    }
  }

  async execute(text: string): Promise<DiagramData> {
    return this.analyzeV2(text);
  }
}
