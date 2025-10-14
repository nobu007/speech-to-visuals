/**
 * Phase 32: Bilingual Prompt Templates for LLM Analyzers
 *
 * Provides context-appropriate prompts in Japanese and English
 * for better analysis accuracy across different languages.
 */

import { Language, detectLanguage } from './language-detector';

export interface PromptTemplate {
  systemMessage: string;
  userMessage: (text: string) => string;
  outputFormat: string;
}

/**
 * Japanese prompt for GeminiAnalyzer (Phase 26 enhanced)
 */
const GEMINI_ANALYZER_PROMPT_JA = (text: string) => `あなたは構造化データ抽出の専門家です。以下のテキストから図解データを抽出し、特に**ノード間の関係性を高精度で抽出**してください。

## ステップ1: 思考プロセス（内部処理、出力不要）
1. テキストの主題とメインテーマを理解する
2. キーとなるエンティティ（概念・人物・イベント）を列挙する
3. エンティティ間の関係性パターンを特定する:
   - 因果関係: A→B（Aが原因でBが発生）
   - 時系列: A→B（AのあとにBが起こる）
   - 階層: A→B（AがBを含む、AがBの上位）
   - 依存: A→B（AがBに影響を与える）
   - 変換: A→B（AがBに変化する）

## ステップ2: 関係性抽出の重要ルール
- **明示的な接続語を見逃さない**: 「次に」「その後」「から」「により」「によって」「を経て」「結果として」「そのため」「したがって」
- **暗黙的な関係も推論**: 文脈から読み取れる順序・依存関係も含める
- **双方向関係**: 相互作用がある場合は両方向のedgeを作成
- **中間ステップ**: A→C とある場合、A→B→C のような中間プロセスが存在しないか検証

## ステップ3: 出力形式（この部分のみ出力）
以下のJSON形式で出力してください（説明文・コードブロック不要）:

{
  "title": "テキストの主題（30文字以内）",
  "type": "flowchart" | "mindmap" | "timeline" | "orgchart",
  "nodes": [
    {"id": "n1", "label": "ノード名（60文字以内）"},
    {"id": "n2", "label": "別のノード"}
  ],
  "edges": [
    {"from": "n1", "to": "n2", "label": "関係性のラベル（省略可）"}
  ]
}

## 出力制約:
- ノード数: 最大10個
- ラベル: 60文字以内
- edges配列: **必須**（空配列でも必ず含める）
- 純粋なJSONのみ（Markdown不要）

## 関係性抽出の例:
入力: "研究により新技術が開発され、それを実用化して製品化する"
出力edges: [
  {"from": "研究", "to": "新技術", "label": "開発"},
  {"from": "新技術", "to": "実用化", "label": "適用"},
  {"from": "実用化", "to": "製品化", "label": "変換"}
]

## 分析対象テキスト:
${text.slice(0, 1000)}

JSON:`;

/**
 * English prompt for GeminiAnalyzer (Phase 26 enhanced)
 */
const GEMINI_ANALYZER_PROMPT_EN = (text: string) => `You are an expert in structured data extraction. Extract diagram data from the following text, with a special focus on **accurately extracting relationships between nodes**.

## Step 1: Reasoning Process (internal processing, no output required)
1. Understand the main topic and theme of the text
2. List key entities (concepts, people, events)
3. Identify relationship patterns between entities:
   - Causal: A→B (A causes B to occur)
   - Sequential: A→B (B happens after A)
   - Hierarchical: A→B (A contains B, A is above B)
   - Dependency: A→B (A influences B)
   - Transformation: A→B (A transforms into B)

## Step 2: Important Rules for Relationship Extraction
- **Don't miss explicit connectors**: "then", "after", "from", "by", "through", "resulting in", "therefore", "thus"
- **Infer implicit relationships**: Include order/dependencies readable from context
- **Bidirectional relationships**: Create edges in both directions for mutual interactions
- **Intermediate steps**: When A→C exists, verify if intermediate processes like A→B→C exist

## Step 3: Output Format (only output this section)
Output in the following JSON format (no explanatory text or code blocks):

{
  "title": "Main topic (max 30 chars)",
  "type": "flowchart" | "mindmap" | "timeline" | "orgchart",
  "nodes": [
    {"id": "n1", "label": "Node name (max 60 chars)"},
    {"id": "n2", "label": "Another node"}
  ],
  "edges": [
    {"from": "n1", "to": "n2", "label": "Relationship label (optional)"}
  ]
}

## Output Constraints:
- Node count: Maximum 10
- Labels: Max 60 characters
- edges array: **Required** (include even if empty)
- Pure JSON only (no Markdown)

## Relationship Extraction Example:
Input: "Research develops new technology, which is then commercialized and turned into products"
Output edges: [
  {"from": "Research", "to": "New Technology", "label": "develops"},
  {"from": "New Technology", "to": "Commercialization", "label": "applied to"},
  {"from": "Commercialization", "to": "Products", "label": "transforms into"}
]

## Text to analyze:
${text.slice(0, 1000)}

JSON:`;

/**
 * Japanese prompt for ContentAnalyzer
 */
const CONTENT_ANALYZER_PROMPT_JA = (text: string) => `以下のテキストを分析し、内容を最もよく表す図解を生成するためのJSONデータを作成してください。

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

/**
 * English prompt for ContentAnalyzer
 */
const CONTENT_ANALYZER_PROMPT_EN = (text: string) => `Analyze the following text and create JSON data to generate a diagram that best represents the content.

JSON format: {title, type, nodes, edges}.
- type: 'flowchart' | 'mindmap' | 'timeline' | 'orgchart'
- nodes: array of {id, label}
- edges: array of {from, to, label?}

Important instructions:
1. Return JSON only (no code blocks)
2. **Extract relationships accurately**: From connectors like "then", "after", "from", "by", "through", "under" in the text, accurately represent dependencies between nodes in edges
3. **Preserve order**: For sequences or procedures, include order relationships in edges
4. **Express hierarchy**: For org charts or classifications, clearly express top→down relationships in edges
5. Create at least one connection (edge) for every important node

Text:
"${text}"`;

/**
 * Get appropriate prompt based on detected language
 */
export function getGeminiAnalyzerPrompt(text: string, preferredLanguage?: Language): string {
  const detected = preferredLanguage === 'auto' || !preferredLanguage
    ? detectLanguage(text)
    : { language: preferredLanguage, confidence: 1.0 };

  if (detected.language === 'ja') {
    console.log('📝 Using Japanese prompt for GeminiAnalyzer');
    return GEMINI_ANALYZER_PROMPT_JA(text);
  } else {
    console.log('📝 Using English prompt for GeminiAnalyzer');
    return GEMINI_ANALYZER_PROMPT_EN(text);
  }
}

/**
 * Get appropriate prompt based on detected language for ContentAnalyzer
 */
export function getContentAnalyzerPrompt(text: string, preferredLanguage?: Language): string {
  const detected = preferredLanguage === 'auto' || !preferredLanguage
    ? detectLanguage(text)
    : { language: preferredLanguage, confidence: 1.0 };

  if (detected.language === 'ja') {
    console.log('📝 Using Japanese prompt for ContentAnalyzer');
    return CONTENT_ANALYZER_PROMPT_JA(text);
  } else {
    console.log('📝 Using English prompt for ContentAnalyzer');
    return CONTENT_ANALYZER_PROMPT_EN(text);
  }
}
