/**
 * Phase 32 / Phase 44: Multilingual Prompt Templates for LLM Analyzers
 *
 * Provides context-appropriate prompts in Japanese, English, and Chinese
 * for better analysis accuracy across different languages.
 * Latin-script languages (ES/FR/DE) use English prompts as base;
 * the LLM naturally adapts output language to match input.
 */

import { Language, detectLanguage } from './language-detector';

export type { Language };

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
  "type": "flowchart" | "mindmap" | "timeline" | "orgchart" | "matrix" | "cycle",
  "nodes": [
    {"id": "n1", "label": "ノード名（60文字以内）"},
    {"id": "n2", "label": "別のノード"}
  ],
  "edges": [
    {"from": "n1", "to": "n2", "label": "関係性のラベル（省略可）"}
  ]
}

## 図解タイプの選択ガイド:
- **flowchart**: プロセス・手順・ワークフロー（A→B→C の順次処理）
- **mindmap**: 階層構造・分類・ツリー（中心から放射状）
- **timeline**: 時系列・歴史・進化（時間軸に沿った配置）
- **orgchart**: 組織図・役職階層（CEO→VP→マネージャー）
- **matrix**: 比較表・対比分析（複数選択肢の評価）
- **cycle**: 循環・ループ・繰り返し（最後が最初に戻る）

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
  "type": "flowchart" | "mindmap" | "timeline" | "orgchart" | "matrix" | "cycle",
  "nodes": [
    {"id": "n1", "label": "Node name (max 60 chars)"},
    {"id": "n2", "label": "Another node"}
  ],
  "edges": [
    {"from": "n1", "to": "n2", "label": "Relationship label (optional)"}
  ]
}

## Diagram Type Selection Guide:
- **flowchart**: Process/procedure/workflow (A→B→C sequential processing)
- **mindmap**: Hierarchy/classification/tree (radiating from center)
- **timeline**: Chronological/history/evolution (arranged along time axis)
- **orgchart**: Organizational chart/role hierarchy (CEO→VP→Manager)
- **matrix**: Comparison table/contrast analysis (evaluating multiple options)
- **cycle**: Circular/loop/iterative (final state returns to initial)

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
 * Chinese prompt for GeminiAnalyzer (Phase 44)
 */
const GEMINI_ANALYZER_PROMPT_ZH = (text: string) => `你是结构化数据提取专家。请从以下文本中提取图表数据，特别注重**准确提取节点之间的关系**。

## 第一步：推理过程（内部处理，无需输出）
1. 理解文本的主题和核心内容
2. 列出关键实体（概念、人物、事件）
3. 识别实体之间的关系模式：
   - 因果关系：A→B（A导致B发生）
   - 时序关系：A→B（B在A之后发生）
   - 层级关系：A→B（A包含B，A在B之上）
   - 依赖关系：A→B（A影响B）
   - 转换关系：A→B（A转化为B）

## 第二步：关系提取的重要规则
- **不要遗漏明确的连接词**："然后"、"之后"、"由于"、"因此"、"从而"、"导致"、"经过"
- **推理隐含关系**：从上下文中推断可读的顺序和依赖关系
- **双向关系**：对于相互作用的情形，创建双向边
- **中间步骤**：当存在A→C时，验证是否存在A→B→C这样的中间过程

## 第三步：输出格式（仅输出此部分）
请按以下JSON格式输出（无需说明文字或代码块）：

{
  "title": "文本主题（最多30个字符）",
  "type": "flowchart" | "mindmap" | "timeline" | "orgchart" | "matrix" | "cycle",
  "nodes": [
    {"id": "n1", "label": "节点名称（最多60个字符）"},
    {"id": "n2", "label": "另一个节点"}
  ],
  "edges": [
    {"from": "n1", "to": "n2", "label": "关系标签（可选）"}
  ]
}

## 图表类型选择指南：
- **flowchart**：流程/步骤/工作流（A→B→C顺序处理）
- **mindmap**：层级结构/分类/树形（从中心向外辐射）
- **timeline**：时间线/历史/演变（沿时间轴排列）
- **orgchart**：组织架构图/职位层级（CEO→VP→经理）
- **matrix**：对比表/分析对比（评估多个选项）
- **cycle**：循环/迭代（最终状态回到初始状态）

## 输出约束：
- 节点数量：最多10个
- 标签：最多60个字符
- edges数组：**必需**（即使为空也必须包含）
- 仅输出纯JSON（不要Markdown）

## 关系提取示例：
输入："研究开发了新技术，然后将其商业化并转化为产品"
输出edges：[
  {"from": "研究", "to": "新技术", "label": "开发"},
  {"from": "新技术", "to": "商业化", "label": "应用于"},
  {"from": "商业化", "to": "产品", "label": "转化为"}
]

## 待分析文本：
${text.slice(0, 1000)}

JSON:`;

/**
 * Japanese prompt for ContentAnalyzer
 */
const CONTENT_ANALYZER_PROMPT_JA = (text: string) => `以下のテキストを分析し、内容を最もよく表す図解を生成するためのJSONデータを作成してください。

JSONの形式は {title, type, nodes, edges}。
- type は 'flowchart' | 'mindmap' | 'timeline' | 'orgchart' | 'matrix' | 'cycle' のいずれか
- nodes は {id, label} の配列
- edges は {from, to, label?} の配列

図解タイプの選択:
- flowchart: プロセス・手順
- mindmap: 階層・ツリー
- timeline: 時系列・歴史
- orgchart: 組織図
- matrix: 比較・対比
- cycle: 循環・ループ

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
- type: 'flowchart' | 'mindmap' | 'timeline' | 'orgchart' | 'matrix' | 'cycle'
- nodes: array of {id, label}
- edges: array of {from, to, label?}

Diagram type selection:
- flowchart: Process/procedure
- mindmap: Hierarchy/tree
- timeline: Chronological/history
- orgchart: Organizational chart
- matrix: Comparison/contrast
- cycle: Circular/loop

Important instructions:
1. Return JSON only (no code blocks)
2. **Extract relationships accurately**: From connectors like "then", "after", "from", "by", "through", "under" in the text, accurately represent dependencies between nodes in edges
3. **Preserve order**: For sequences or procedures, include order relationships in edges
4. **Express hierarchy**: For org charts or classifications, clearly express top→down relationships in edges
5. Create at least one connection (edge) for every important node

Text:
"${text}"`;

/**
 * Chinese prompt for ContentAnalyzer (Phase 44)
 */
const CONTENT_ANALYZER_PROMPT_ZH = (text: string) => `请分析以下文本，并创建最能表达内容的图表JSON数据。

JSON格式：{title, type, nodes, edges}。
- type: 'flowchart' | 'mindmap' | 'timeline' | 'orgchart' | 'matrix' | 'cycle'
- nodes: {id, label} 数组
- edges: {from, to, label?} 数组

图表类型选择：
- flowchart：流程/步骤
- mindmap：层级/树形
- timeline：时间线/历史
- orgchart：组织架构图
- matrix：比较/对比
- cycle：循环

重要指示：
1. 仅返回JSON（不要代码块）
2. **准确提取关系**：从文本中的"然后"、"之后"、"由于"、"导致"、"经过"等连接词中，准确表达节点间的依赖关系
3. **保持顺序**：对于时序或步骤，请在edges中包含顺序关系
4. **表达层级**：对于组织架构或分类，在edges中清晰表达上下级关系
5. 为每个重要节点至少创建一个连接（edge）

文本：
"${text}"`;

/**
 * Get appropriate prompt based on detected language.
 * Phase 44: Extended to support Chinese (zh) and Latin-script languages (es/fr/de).
 */
export function getGeminiAnalyzerPrompt(text: string, preferredLanguage?: Language): string {
  const detected = preferredLanguage === 'auto' || !preferredLanguage
    ? detectLanguage(text)
    : { language: preferredLanguage, confidence: 1.0 };

  switch (detected.language) {
    case 'ja':
      return GEMINI_ANALYZER_PROMPT_JA(text);
    case 'zh':
      return GEMINI_ANALYZER_PROMPT_ZH(text);
    default:
      // 'en', 'es', 'fr', 'de' all use English prompt base
      // LLM naturally adapts output language to match input
      return GEMINI_ANALYZER_PROMPT_EN(text);
  }
}

/**
 * Get appropriate prompt based on detected language for ContentAnalyzer.
 * Phase 44: Extended to support Chinese (zh) and Latin-script languages (es/fr/de).
 */
export function getContentAnalyzerPrompt(text: string, preferredLanguage?: Language): string {
  const detected = preferredLanguage === 'auto' || !preferredLanguage
    ? detectLanguage(text)
    : { language: preferredLanguage, confidence: 1.0 };

  switch (detected.language) {
    case 'ja':
      return CONTENT_ANALYZER_PROMPT_JA(text);
    case 'zh':
      return CONTENT_ANALYZER_PROMPT_ZH(text);
    default:
      // 'en', 'es', 'fr', 'de' all use English prompt base
      return CONTENT_ANALYZER_PROMPT_EN(text);
  }
}
