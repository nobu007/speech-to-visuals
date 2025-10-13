import 'dotenv/config';
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { DiagramType, NodeDatum, EdgeDatum } from "@/types/diagram";
import type { DiagramAnalysis, DiagramData } from "./types";

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

  async analyzeText(text: string): Promise<DiagramAnalysis | null> {
    if (!this.isEnabled()) return null;

    try {
      const genAI = new GoogleGenerativeAI(this.apiKey!);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });

      const prompt = `以下のテキストを分析し、内容を最もよく表す図解を生成するためのJSONデータを作成してください。\n` +
        `JSON形式: {title, type, nodes, edges}\n` +
        `- typeは flowchart | mindmap | timeline | orgchart のいずれか\n` +
        `- nodes: {id, label}[]\n` +
        `- edges: {from, to, label?}[]\n` +
        `JSONのみを返してください。コードブロックは不要です。\n\n` +
        `テキスト:\n${text}`;

      const result = await model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }] });
      const response = await result.response;
      let jsonText = response.text().trim();

      // Cleanup potential code fences
      jsonText = jsonText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

      const parsed = JSON.parse(jsonText) as DiagramData;
      const mappedType: DiagramType = typeMap[parsed.type] ?? "flow";

      const nodes: NodeDatum[] = (parsed.nodes || []).map((n) => ({ id: n.id, label: n.label }));
      const edges: EdgeDatum[] = (parsed.edges || []).map((e) => ({ from: e.from, to: e.to, label: e.label }));

      const analysis: DiagramAnalysis = {
        type: mappedType,
        confidence: INITIAL_LLM_CONFIDENCE, // LLM結果の初期信頼度（必要に応じて後段で再評価）
        nodes,
        edges,
        reasoning: "LLM (Gemini) 解析結果に基づく構造化データ",
      };

      return analysis;
    } catch (err) {
      // 解析失敗時はフォールバックのためにnullを返却
      console.warn("Gemini analysis failed, falling back to rule-based detection", err);
      return null;
    }
  }
}
