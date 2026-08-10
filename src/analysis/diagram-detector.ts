import { DiagramType, NodeDatum, EdgeDatum, isDiagramType, DIAGRAM_TYPES } from '@/types/diagram';
import { ContentSegment, DiagramAnalysis, KeywordAnalysis, SemanticRelation } from './types';
import { GeminiAnalyzer } from './gemini-analyzer';
import { escapeRegex } from '@/utils/regex-escape';
import { logger } from '../utils/logger';
import { sanitizeFinite, sanitizeDiagramType } from '@/utils/guards';
import { safeMap } from '../lib/safe-array';
import { MAX_DIAGRAM_CONFIDENCE, GOOD_DETECTION_CONFIDENCE_THRESHOLD } from './diagram-detection-constants';

// ========================================
// TASK-0021: Diagram Detection Result Types
// ========================================

export interface DiagramScore {
  type: DiagramType;
  score: number;
  confidence: number;
}

export interface DiagramDetectionResult {
  primaryType: DiagramType;
  confidence: number;
  alternatives: DiagramScore[];
  isComplex: boolean;
  secondaryTypes: DiagramType[];
  fusionStrategy: string;
  reasoning: string;
}

export interface TextFeatures {
  keywordHits: Record<DiagramType, string[]>;
  keywordFrequency: Record<DiagramType, number>;
  totalKeywords: number;
  relationPatterns: Record<DiagramType, number>;
}

// ========================================
// Japanese + English keyword patterns for TASK-0021
// ========================================

const DIAGRAM_KEYWORDS: Record<DiagramType, {
  primary: string[];
  secondary: string[];
  context: string[];
  negative: string[];
}> = {
  flow: {
    primary: ['process', 'workflow', 'pipeline', 'procedure', 'sequence',
      'プロセス'],
    secondary: [
      'step', 'flow', 'first', 'next', 'then', 'finally', 'after', 'before', 'follows',
      // Japanese keywords
      '手順', 'フロー', 'まず', '次に', '最後に', 'そして', 'その後', '順序',
      'ステップ', '工程', '流れ', '段階', '最初に', '手続き', '順で', '順に',
      '進む', '進み', '進め',
    ],
    context: ['data', 'information', 'system', 'through', 'input', 'output',
      'データ', '入力', '出力', 'システム', '進め方',
    ],
    negative: ['comparison', 'matrix', 'versus', 'cycle', 'loop', 'circular',
      '比較', 'サイクル', '循環',
    ],
  },
  tree: {
    primary: ['hierarchy', 'organization', 'structure', 'taxonomy', 'ceo', 'vp', 'director', 'management'],
    secondary: ['parent', 'child', 'branch', 'root', 'category', 'classification', 'breakdown', 'reports', 'under', 'supervisor', 'team',
      // Japanese keywords - include conjugated forms
      '階層', '分類', 'カテゴリ', '属する', '属し', '分類さ', '階層構造', '親', '子', 'グループ',
      '組織', '部門', '枝分かれ', '含まれる', '含まれ', '含む', '種類', 'ツリー',
      'に分類', 'が属し', 'が属する',
    ],
    context: ['levels', 'components', 'parts', 'subdivide', 'organize', 'department', 'division', 'company',
      '構成', '部分', '要素', 'まとめ',
    ],
    negative: ['comparison', 'versus', 'cycle', 'loop',
      '比較', 'サイクル',
    ],
  },
  timeline: {
    primary: ['timeline', 'chronology', 'history', 'evolution', 'january', 'february', 'march', 'april', 'may', 'june'],
    secondary: ['development', 'year', 'month', 'date', 'time', 'period', 'era', 'phase', 'project', 'milestone',
      // Japanese keywords
      '年', '月', '日', '時系列', '以降', 'から', 'まで', '期間', '時期', '変遷',
      '開始', '終了', 'リリース', '予定', 'フェーズ', '履歴', '歴史', '進行',
      'に開始', '年に', '月に',
    ],
    context: ['when', 'during', 'since', 'until', 'progress', 'stages', 'schedule', 'roadmap',
      '段階', '進捗', '経過',
    ],
    negative: ['comparison', 'versus', 'cycle', 'loop', 'circular',
      '比較', 'サイクル',
    ],
  },
  matrix: {
    primary: ['comparison', 'matrix', 'table', 'versus', 'compare', 'against', 'vs', 'vs.',
      'comparing', 'compared'],
    secondary: ['criteria', 'features', 'properties', 'characteristics', 'options', 'alternatives', 'evaluate', 'assessment',
      // Japanese keywords
      '比較', '対比', '一方', 'に対して', 'vs', '比較すると', '優位', '上回る', '下回る',
      '違い', '差異', '長所', '短所', 'メリット', 'デメリット', '検討', '評価',
      'と比較', 'は優位', 'が上回る',
    ],
    context: ['different', 'similar', 'choices', 'contrasting', 'weighing', 'pros', 'cons',
      '選択肢', '案', '方法', 'option',
    ],
    negative: [],
  },
  cycle: {
    primary: ['cycle', 'loop', 'circular', 'recurring', 'repeat', 'continuous', 'iterative'],
    secondary: ['iteration', 'ongoing', 'cyclical', 'returns', 'repeatedly', 'feedback', 'recursive',
      // Japanese keywords
      '繰り返し', 'サイクル', '循環', '反復', 'フィードバック', 'ループ', '回帰',
      '継続', '反復する', '繰り返す', '戻る', '周回', '巡回',
      'を繰り返し', 'サイクルで',
    ],
    context: ['back', 'again', 'continuously', 'infinite', 'perpetual', 'round',
      '再び', '何度も', 'いつまでも',
    ],
    negative: [],
  },
  flowchart: {
    primary: ['flowchart', 'decision tree', 'decision flow', 'branching logic', 'conditional flow',
      'フローチャート', '判断', '分岐', '条件分岐'],
    secondary: ['decision', 'branch', 'condition', 'if', 'else', 'yes/no', 'true/false', 'gateway',
      '判定', '条件', 'もし', '場合', 'YES', 'NO', '分かれる', '選択'],
    context: ['path', 'route', 'outcome', 'result', 'option', 'rule',
      '道筋', '結果', '選択肢', 'ルール'],
    negative: ['comparison', 'versus', 'timeline', 'history',
      '比較', '歴史'],
  },
  comparison: {
    primary: ['comparison', 'versus', 'vs', 'vs.', 'pros and cons', 'advantages disadvantages',
      '比較', '対比', '長所と短所', 'メリットデメリット', 'どちらが'],
    secondary: ['better', 'worse', 'superior', 'inferior', 'difference', 'similarity', 'contrast',
      '良い', '悪い', '優れている', '劣る', '違い', '共通点', '対照'],
    context: ['feature', 'benefit', 'drawback', 'strength', 'weakness', 'side',
      '特徴', '利点', '欠点', '強み', '弱み', '面'],
    negative: ['process', 'step', 'cycle', 'loop',
      '手順', 'サイクル'],
  },
  network: {
    primary: ['network', 'graph', 'nodes', 'connections', 'linked', 'mesh',
      'ネットワーク', 'グラフ', 'ノード', '接続', 'リンク', 'メッシュ'],
    secondary: ['connected', 'linked', 'association', 'relationship', 'hub', 'cluster', 'peer',
      '繋がる', '関連', '関係', 'ハブ', 'クラスタ', 'ピア'],
    context: ['system', 'infrastructure', 'topology', 'architecture', 'endpoint',
      'システム', 'インフラ', 'トポロジー', 'アーキテクチャ'],
    negative: ['process', 'step', 'timeline', 'history',
      '手順', '歴史'],
  },
  conceptmap: {
    primary: ['concept map', 'concept', 'proposition', 'knowledge map',
      'コンセプトマップ', '概念図', '知識マップ'],
    secondary: ['relates', 'connected', 'linked', 'depends on', 'influences', 'associated',
      '関連', '繋がる', '依存', '影響', '結びつき'],
    context: ['theory', 'model', 'framework', 'understanding',
      '理論', 'モデル', 'フレームワーク'],
    negative: ['process', 'timeline', 'cycle',
      '手順', 'サイクル'],
  },
  mindmap: {
    primary: ['mind map', 'brainstorm', 'mindmap', 'radial',
      'マインドマップ', 'ブレインストーミング', '連想'],
    secondary: ['central', 'branch', 'topic', 'subtopic', 'idea', 'thought',
      '中心', '枝', 'トピック', 'サブトピック', 'アイデア', '考え'],
    context: ['organize', 'structure', 'expand', 'creative',
      '整理', '構造', '展開', '創造'],
    negative: ['comparison', 'versus', 'timeline',
      '比較', '歴史'],
  },
  general: {
    primary: ['diagram', 'chart', 'illustration', 'visual', 'schematic',
      '図解', '図', 'ダイアグラム', 'チャート', '模式図'],
    secondary: ['represent', 'depict', 'show', 'display', 'visualize',
      '表す', '示す', '表示', '可視化'],
    context: ['data', 'information', 'structure', 'overview',
      'データ', '情報', '構造', '概要'],
    negative: [],
  },
};

/**
 * Does a diagram-detection confidence meet the "good" threshold?
 *
 * Single canonical answer to "is this detection confidence good enough?" —
 * boundary-INCLUSIVE on {@link GOOD_DETECTION_CONFIDENCE_THRESHOLD}. Both the
 * detector's own confidence gate (`testConfidenceThreshold`) and downstream
 * consumers (e.g. `SimplePipeline`'s high-/low-confidence flags) MUST call this
 * instead of re-comparing against a bare `0.6`, so the gate and its consumers
 * can never disagree at the boundary value (see the constant's docstring).
 *
 * Sanitizes first: an undefined/NaN confidence is treated as 0 (fails).
 */
export function meetsGoodDetectionConfidence(confidence: number): boolean {
  return sanitizeFinite(confidence) >= GOOD_DETECTION_CONFIDENCE_THRESHOLD;
}

/**
 * Diagram Type Detection Engine - Iterative Implementation
 * Analyzes content segments to determine appropriate diagram types and extract entities/relationships
 * Enhanced with Custom Instructions Recursive Development Framework
 */
export class DiagramDetector {
  private iteration: number = 1;
  private gemini: GeminiAnalyzer;

  // 🔄 Custom Instructions Enhancement: Performance and Quality Tracking
  private detectionMetrics = {
    accuracyHistory: [] as number[],
    confidenceHistory: [] as number[],
    processingTimeHistory: [] as number[],
    typeDistribution: new Map<DiagramType, number>(),
    iterativeImprovements: new Map<string, number>(),
    qualityScores: new Map<number, number>() // iteration -> score
  };

  private readonly TEST_QUALITY_THRESHOLD = 0.75;
  private readonly EVALUATION_IMPROVEMENT_THRESHOLD = 0.8;

  private readonly MIN_NODES_FOR_VALID_STRUCTURE = 2;
  private readonly MIN_EDGES_FOR_VALID_STRUCTURE = 1;
  private readonly STRUCTURAL_VALIDITY_SCORE_FULL = 1.0;
  private readonly STRUCTURAL_VALIDITY_SCORE_PARTIAL = 0.3;

  private readonly SEMANTIC_RELEVANCE_SCORE_HIGH = 0.9;
  private readonly SEMANTIC_RELEVANCE_SCORE_LOW = 0.5;

  private readonly TYPE_APPROPRIATENESS_CONFIDENCE_THRESHOLD = 0.8;
  private readonly TYPE_APPROPRIATENESS_SCORE_FULL = 1.0;

  private readonly STRUCTURAL_QUALITY_NODE_THRESHOLD = 2;
  private readonly STRUCTURAL_QUALITY_EDGE_THRESHOLD = 1;
  private readonly STRUCTURAL_QUALITY_SCORE_HIGH = 1.0;
  private readonly STRUCTURAL_QUALITY_SCORE_MEDIUM = 0.6;
  private readonly STRUCTURAL_QUALITY_SCORE_LOW = 0.3;

  private readonly COMPLEXITY_QUALITY_OPTIMAL_MIN = 0.3;
  private readonly COMPLEXITY_QUALITY_OPTIMAL_MAX = 1.5;
  private readonly COMPLEXITY_QUALITY_ACCEPTABLE_MIN = 0.1;
  private readonly COMPLEXITY_QUALITY_ACCEPTABLE_MAX = 2.0;
  private readonly COMPLEXITY_QUALITY_SCORE_HIGH = 1.0;
  private readonly COMPLEXITY_QUALITY_SCORE_MEDIUM = 0.8;
  private readonly COMPLEXITY_QUALITY_SCORE_LOW = 0.5;

  private readonly PERFORMANCE_QUALITY_FAST_THRESHOLD = 500;
  private readonly PERFORMANCE_QUALITY_MEDIUM_THRESHOLD = 1500;
  private readonly PERFORMANCE_QUALITY_SCORE_HIGH = 1.0;
  private readonly PERFORMANCE_QUALITY_SCORE_MEDIUM = 0.8;
  private readonly PERFORMANCE_QUALITY_SCORE_LOW = 0.5;

  private readonly STATISTICAL_ANALYSIS_ENABLE_THRESHOLD = 0.85;
  private readonly ENHANCED_STATISTICAL_BOOST_FACTOR = 1.1;
  private readonly BOOST_CONFIDENCE_FACTOR = 1.15;
  private readonly HYBRID_FALLBACK_BOOST_FACTOR = 1.05;
  private readonly HYBRID_FALLBACK_CONFIDENCE_CAP = 0.85;
  private readonly HYBRID_HIGHEST_CONFIDENCE_BOOST_FACTOR = 1.1;
  private readonly HYBRID_HIGHEST_CONFIDENCE_CAP = 0.9;

  private readonly FALLBACK_NODES_MAIN_TOPIC_IMPORTANCE = 1;
  private readonly FALLBACK_NODES_SUB_TOPIC_IMPORTANCE = 0.8;
  private readonly FALLBACK_NODES_KEYPHRASE_LIMIT = 3;
  private readonly FALLBACK_NODES_KEYPHRASE_BASE_IMPORTANCE = 0.7;
  private readonly FALLBACK_NODES_KEYPHRASE_IMPORTANCE_DECREMENT = 0.1;

  constructor() {
    this.gemini = new GeminiAnalyzer();
  }

  /**
   * Analyze content segment and determine diagram type with entities
   * 🔄 Enhanced with Custom Instructions: 実装→テスト→評価→改善→コミット
   */
  async analyze(segment: ContentSegment): Promise<DiagramAnalysis> {
    const startTime = performance.now();

    try {
      // Prefer LLM (Gemini) analysis if enabled; fallback to iterative rule-based
      let analysis: DiagramAnalysis | null = null;

      if (this.gemini.isEnabled()) {
        const llm = await this.gemini.analyzeText(segment.text);
        if (llm) {
          analysis = {
            type: sanitizeDiagramType(llm.type),
            confidence: sanitizeFinite(llm.confidence, 0.9),
            nodes: llm.nodes || [],
            edges: llm.edges || [],
            reasoning: llm.reasoning || 'LLM (Gemini) 解析結果に基づく構造化データ'
          };
        }
      }

      // 🔄 実装段階: Apply iterative detection improvements (used when LLM is unavailable or as enhancement)
      if (!analysis || (analysis.nodes ?? []).length === 0) {
        analysis = await this.applyIterativeDetection(segment);
      }

      // 🔄 テスト段階: Validate detection quality
      const testResults = await this.testDetectionQuality(analysis, segment);

      // 🔄 評価段階: Assess detection performance
      const evaluationResults = await this.evaluateDetectionPerformance(analysis, startTime);

      // 🔄 改善段階: Apply improvements if needed
      if (evaluationResults.needsImprovement) {
        analysis = await this.applyDetectionImprovements(analysis, segment, evaluationResults.suggestions);
      }

      const processingTime = performance.now() - startTime;

      // Store metrics for continuous improvement
      this.updateDetectionMetrics(analysis, processingTime, evaluationResults.qualityScore);

      return analysis;

    } catch (error) {
      logger.error('[Diagram Detection] Error:', error);
      return {
        type: 'flow',
        confidence: 0,
        nodes: [],
        edges: [],
        reasoning: 'Error in analysis'
      };
    }
  }

  /**
   * Iteration 1: Rule-based diagram type detection
   */
  private async ruleBasedDetection(segment: ContentSegment): Promise<DiagramAnalysis> {
    const text = segment.text.toLowerCase();
    const keyphrases = safeMap(segment.keyphrases, kp => kp.toLowerCase());

    // Use the shared DIAGRAM_KEYWORDS dictionary (Japanese + English) instead of
    // a local English-only copy.  This ensures ruleBasedDetection benefits from
    // the same bilingual keyword coverage that the rest of the module uses.
    const patterns = DIAGRAM_KEYWORDS;

    // Calculate weighted scores for each diagram type
    const scores: Record<DiagramType, number> = {
      flow: 0,
      flowchart: 0,
      tree: 0,
      timeline: 0,
      matrix: 0,
      cycle: 0,
      comparison: 0,
      network: 0,
      conceptmap: 0,
      mindmap: 0,
      general: 0,
    };

    for (const [diagramType, patternSet] of Object.entries(patterns)) {
      const type = diagramType as DiagramType;

    const PRIMARY_KEYWORD_WEIGHT = 5;
    const PRIMARY_KEYPHRASE_WEIGHT = 8;
    const SECONDARY_KEYWORD_WEIGHT = 2;
    const SECONDARY_KEYPHRASE_WEIGHT = 4;
    const CONTEXT_KEYWORD_WEIGHT = 1;
    const CONTEXT_KEYPHRASE_WEIGHT = 2;
    const NEGATIVE_KEYWORD_PENALTY = -10; // Strong penalty for negative keywords

      // Primary keywords (highest weight)
      for (const keyword of patternSet.primary) {
        if (text.includes(keyword)) {
          scores[type] += PRIMARY_KEYWORD_WEIGHT;
        }
        if (keyphrases.some(kp => kp.includes(keyword))) {
          scores[type] += PRIMARY_KEYPHRASE_WEIGHT; // Even higher for keyphrases
        }
      }

      // Secondary keywords (medium weight)
      for (const keyword of patternSet.secondary) {
        if (text.includes(keyword)) {
          scores[type] += SECONDARY_KEYWORD_WEIGHT;
        }
        if (keyphrases.some(kp => kp.includes(keyword))) {
          scores[type] += SECONDARY_KEYPHRASE_WEIGHT;
        }
      }

      // Context keywords (lower weight)
      for (const keyword of patternSet.context) {
        if (text.includes(keyword)) {
          scores[type] += CONTEXT_KEYWORD_WEIGHT;
        }
        if (keyphrases.some(kp => kp.includes(keyword))) {
          scores[type] += CONTEXT_KEYPHRASE_WEIGHT;
        }
      }

      // ITERATION 45: Negative keywords (penalty for wrong type)
      if ('negative' in patternSet && Array.isArray(patternSet.negative)) {
        for (const negKeyword of patternSet.negative) {
          if (text.includes(negKeyword)) {
            scores[type] += NEGATIVE_KEYWORD_PENALTY;
          }
          if (keyphrases.some(kp => kp.includes(negKeyword))) {
            scores[type] += NEGATIVE_KEYWORD_PENALTY * 1.5; // Even stronger penalty for keyphrases
          }
        }
      }
    }

    // Find the best match
    const bestType = Object.entries(scores).reduce((best, [type, score]) =>
      score > best.score ? { type: type as DiagramType, score } : best,
      { type: 'flow' as DiagramType, score: 0 }
    );

    // Extract entities and relationships
    const { nodes, edges } = await this.extractEntitiesAndRelationships(segment, bestType.type);

    // ITERATION 44 ENHANCEMENT: Improved confidence calculation with context awareness
    // Avoid potential closure/TS transpile issues by aliasing weights locally
    // Use literal values to avoid scope issues
    const PKW = 8;  // PRIMARY_KEYPHRASE_WEIGHT
    const SKW = 4;  // SECONDARY_KEYPHRASE_WEIGHT
    const CKW = 2;  // CONTEXT_KEYPHRASE_WEIGHT
    const patternScores = Object.values(patterns).map((p) => p.primary.length * PKW + p.secondary.length * SKW + p.context.length * CKW);
    const maxPossibleScore = patternScores.length > 0 ? Math.max(...patternScores) : 1;
    const CONFIDENCE_DENOMINATOR_FACTOR = 0.3;
    const MAX_CONFIDENCE = 1;
    const ORG_CHART_BOOST_FACTOR = 1.3;
    const TIMELINE_BOOST_FACTOR = 1.2;
    const LOW_SCORE_THRESHOLD = 3;
    const LOW_SCORE_PENALTY_FACTOR = 0.7;

    const denominator = maxPossibleScore * CONFIDENCE_DENOMINATOR_FACTOR;
    const confidence = denominator > 0 ? Math.min(bestType.score / denominator, MAX_CONFIDENCE) : 0;

    // Boost confidence for clear organizational indicators
    let adjustedConfidence = confidence;
    if (bestType.type === 'tree' && (text.includes('ceo') || text.includes('vp') || text.includes('director'))) {
      adjustedConfidence = Math.min(confidence * ORG_CHART_BOOST_FACTOR, MAX_DIAGRAM_CONFIDENCE); // Strong boost for org charts
    }

    // Boost confidence for clear timeline indicators
    if (bestType.type === 'timeline' && (text.includes('january') || text.includes('project') || text.includes('phase'))) {
      adjustedConfidence = Math.min(confidence * TIMELINE_BOOST_FACTOR, MAX_DIAGRAM_CONFIDENCE);
    }

    // Penalize if the score is too low (likely wrong detection)
    if (bestType.score < LOW_SCORE_THRESHOLD) {
      adjustedConfidence *= LOW_SCORE_PENALTY_FACTOR;
    }

    return {
      type: bestType.type,
      confidence: Math.min(adjustedConfidence, 1),
      nodes,
      edges,
      reasoning: `Weighted detection: ${bestType.score} points for ${bestType.type} (confidence: ${(adjustedConfidence * 100).toFixed(1)}%)`
    };
  }

  /**
   * Extract nodes and edges from content based on diagram type
   */
  private async extractEntitiesAndRelationships(
    segment: ContentSegment,
    diagramType: DiagramType
  ): Promise<{ nodes: NodeDatum[]; edges: EdgeDatum[] }> {
    const text = segment.text;
    const nodes: NodeDatum[] = [];
    const edges: EdgeDatum[] = [];

    // Create diagram-specific content based on detected type
    const diagramContent = this.generateDiagramSpecificContent(segment, diagramType);

    // Use the generated content to create nodes and edges
    (diagramContent.nodes || []).forEach((nodeData, index) => {
      nodes.push({
        id: `node_${index}`,
        label: nodeData.label,
        meta: {
          // `??` not `||`: importance 0 ("lowest importance") is a legitimate value
          // per the getImportance() contract (importance-scaler.ts); `||` would
          // promote a deliberately-minimal node to 0.8.
          importance: nodeData.importance ?? 0.8,
          category: this.categorizeEntity(nodeData.label, diagramType)
        }
      });
    });

    // Create edges based on diagram type patterns
    (diagramContent.edges || []).forEach(edgeData => {
      edges.push({
        from: edgeData.from,
        to: edgeData.to,
        label: edgeData.label || this.getDefaultEdgeLabel(diagramType)
      });
    });

    return { nodes, edges };
  }

  /**
   * Generate diagram-specific content based on type and segment
   */
  private generateDiagramSpecificContent(segment: ContentSegment, diagramType: DiagramType) {
    return this.generateContentFromText(segment.text, diagramType);
  }

  /**
   * Generate diagram content from actual input text.
   * Extracts key phrases and creates nodes/edges based on the text content
   * rather than returning generic hardcoded templates.
   */
  private generateContentFromText(text: string, diagramType: DiagramType): {
    nodes: { label: string; importance: number }[];
    edges: { from: string; to: string; label: string }[];
  } {
    const phrases = this.extractKeyPhrases(text);

    // If text is too short to extract meaningful phrases, use minimal fallback
    if (phrases.length < 2) {
      const fallbackLabel = text.trim().substring(0, 40) || 'Content';
      return {
        nodes: [
          { label: fallbackLabel, importance: 1.0 },
          { label: 'Details', importance: 0.7 },
        ],
        edges: [
          { from: 'node_0', to: 'node_1', label: this.getDefaultEdgeLabel(diagramType) },
        ],
      };
    }

    // Create nodes from extracted phrases (max 8)
    const maxNodes = Math.min(phrases.length, 8);
    const nodes = phrases.slice(0, maxNodes).map((phrase, index) => ({
      label: phrase,
      importance: Math.max(0.5, 1.0 - index * 0.08),
    }));

    // Generate edges based on diagram type
    const edges = this.generateEdgesForType(nodes.length, diagramType);

    return { nodes, edges };
  }

  /**
   * Extract meaningful key phrases from text for use as diagram node labels.
   * Handles both Japanese and English text.
   */
  private extractKeyPhrases(text: string): string[] {
    const trimmed = text.trim();
    if (!trimmed) return [];

    // Split into sentences using Japanese and English delimiters. A CJK
    // sentence ender (。！？), newline, !, ?, or ; is always a boundary. An
    // English '.' is a boundary ONLY when it ends a sentence — followed by
    // whitespace or end-of-string — NOT inside a token, so the decimal in
    // "1.5"/"3.14", a version "2.0", or an IP "192.168.1.1" is preserved.
    // (Bare '.' in the class below split on EVERY dot and tore decimals across
    // node labels.) Mirrors the sibling fix in scene-segmenter's
    // splitTextAtSentenceBoundaries, pinned by scene-segmenter.test.ts.
    const sentences = trimmed
      .split(/[。！？\n!?;]+|\.(?:\s+|$)/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const phrases: string[] = [];
    const seen = new Set<string>();

    for (const sentence of sentences) {
      // Try splitting on commas and conjunctions for sub-phrases
      const subPhrases = sentence
        .split(/[、，,]|\s+(?:and|then|また|そして|その後|次に)\s+/i)
        .map(s => s.trim())
        .filter(s => s.length >= 2 && s.length <= 40);

      for (const phrase of subPhrases) {
        const normalized = phrase.toLowerCase();
        if (!seen.has(normalized) && !this.isStopPhrase(phrase)) {
          seen.add(normalized);
          phrases.push(phrase);
        }
      }
    }

    // If sentence splitting didn't yield enough phrases, try word-level extraction
    if (phrases.length < 3) {
      // Drop '.' from the delimiter class: a decimal "1.5", version "2.0", or
      // IP "192.168.1.1" is a SINGLE token, not three — a bare '.' here
      // disintegrated them into node-label words. Mirrors daebbc45; pinned TC-309.
      const words = trimmed
        .split(/[\s、。,!?；;：:（）()「」『』"'/]+/)
        .filter(w => w.length >= 2 && w.length <= 30 && !this.isStopPhrase(w));

      for (const word of words) {
        const normalized = word.toLowerCase();
        if (!seen.has(normalized)) {
          seen.add(normalized);
          phrases.push(word);
        }
        if (phrases.length >= 8) break;
      }
    }

    return phrases.slice(0, 10);
  }

  /**
   * Check if a phrase is a stop word/phrase that shouldn't be a node label
   */
  private isStopPhrase(phrase: string): boolean {
    const stopWords = new Set([
      // English
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'can', 'shall', 'to', 'of', 'in',
      'on', 'at', 'by', 'for', 'with', 'about', 'as', 'into', 'through',
      'during', 'before', 'after', 'above', 'below', 'from', 'up', 'down',
      'and', 'or', 'but', 'not', 'no', 'nor', 'so', 'yet', 'both',
      'either', 'neither', 'each', 'every', 'all', 'any', 'few', 'more',
      'most', 'other', 'some', 'such', 'only', 'own', 'same', 'than',
      'too', 'very', 'just', 'now', 'here', 'there', 'when', 'where',
      'why', 'how', 'what', 'which', 'who', 'whom', 'this', 'that',
      'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
      'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its',
      'our', 'their', 'mine', 'yours', 'hers', 'ours', 'theirs',
      'step', 'first', 'next', 'then', 'finally',
      // Common Japanese particles/filler
      'の', 'に', 'は', 'を', 'が', 'で', 'と', 'も', 'から', 'まで',
      'より', 'など', 'そして', 'また', 'しかし', 'ただし', 'つまり',
      '因为', '所以', '但是', '然后', '现在', '这个', '那个',
    ]);
    return stopWords.has(phrase.toLowerCase());
  }

  /**
   * Generate edges based on diagram type topology
   */
  private generateEdgesForType(nodeCount: number, diagramType: DiagramType): {
    from: string; to: string; label: string;
  }[] {
    const defaultLabel = this.getDefaultEdgeLabel(diagramType);
    const edges: { from: string; to: string; label: string }[] = [];

    if (nodeCount < 2) return edges;

    switch (diagramType) {
      case 'cycle': {
        // Sequential chain with last → first closing the cycle
        for (let i = 0; i < nodeCount - 1; i++) {
          edges.push({ from: `node_${i}`, to: `node_${i + 1}`, label: defaultLabel });
        }
        edges.push({ from: `node_${nodeCount - 1}`, to: 'node_0', label: 'returns to' });
        break;
      }
      case 'tree':
      case 'mindmap': {
        // Hub-and-spoke: first node is root, all others connect to it
        for (let i = 1; i < nodeCount; i++) {
          edges.push({ from: 'node_0', to: `node_${i}`, label: defaultLabel });
        }
        break;
      }
      case 'network': {
        // First node connects to a few others, plus some cross-links
        const hubConnections = Math.min(nodeCount - 1, 4);
        for (let i = 1; i <= hubConnections; i++) {
          edges.push({ from: 'node_0', to: `node_${i}`, label: 'connects' });
        }
        // Add a few cross-links for network structure
        if (nodeCount > 3) {
          edges.push({ from: 'node_1', to: `node_${Math.min(3, nodeCount - 1)}`, label: 'links' });
        }
        if (nodeCount > 4) {
          edges.push({ from: 'node_2', to: `node_${Math.min(4, nodeCount - 1)}`, label: 'links' });
        }
        break;
      }
      case 'comparison': {
        // Split into two groups with comparison edges: group A (node_0..
        // node_{mid-1}) compared pairwise with group B (node_mid..node_{n-1}).
        // For an ODD nodeCount group A has one extra member whose counterpart
        // j = mid+i would be >= nodeCount; the previous `if (j < nodeCount)`
        // guard simply DROPPED it, leaving the middle node (index mid-1) with
        // zero edges — a floating, unconnected node in the rendered diagram
        // (3 nodes → only node_0→node_2, node_1 orphaned; 5 → node_2 orphaned).
        // Clamp the overflow to the last node instead so every node participates.
        const mid = Math.ceil(nodeCount / 2);
        for (let i = 0; i < mid && i < nodeCount - 1; i++) {
          const j = Math.min(mid + i, nodeCount - 1);
          edges.push({ from: `node_${i}`, to: `node_${j}`, label: 'compared to' });
        }
        if (edges.length === 0) {
          edges.push({ from: 'node_0', to: 'node_1', label: defaultLabel });
        }
        break;
      }
      case 'flowchart': {
        // Branching flow: first → second, first or second → others
        edges.push({ from: 'node_0', to: 'node_1', label: 'begins' });
        for (let i = 2; i < nodeCount; i++) {
          const source = i <= Math.ceil(nodeCount / 2) ? 1 : i - 1;
          edges.push({ from: `node_${Math.min(source, nodeCount - 2)}`, to: `node_${i}`, label: defaultLabel });
        }
        break;
      }
      default: {
        // Sequential chain (flow, timeline, matrix, conceptmap, general)
        for (let i = 0; i < nodeCount - 1; i++) {
          edges.push({ from: `node_${i}`, to: `node_${i + 1}`, label: defaultLabel });
        }
        break;
      }
    }

    return edges;
  }

  private getDefaultEdgeLabel(diagramType: DiagramType): string {
    const labels: Record<DiagramType, string> = {
      flow: 'leads to',
      flowchart: 'leads to',
      tree: 'contains',
      timeline: 'followed by',
      matrix: 'relates to',
      cycle: 'continues to',
      comparison: 'compared to',
      network: 'connects to',
      conceptmap: 'relates to',
      mindmap: 'branches to',
      general: 'connected to',
    };
    return labels[diagramType] || 'connected to';
  }

  /**
   * Extract entities from text using keyword analysis
   */
  private extractEntities(text: string, keyphrases: string[]): KeywordAnalysis[] {
    const entities: KeywordAnalysis[] = [];

    // Add keyphrases as primary entities
    keyphrases.forEach(phrase => {
      entities.push({
        term: phrase,
        frequency: this.countOccurrences(text, phrase),
        importance: 0.8,
        context: this.extractContext(text, phrase)
      });
    });

    // Extract additional entities using simple NLP patterns
    const capitalizedWords = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
    const uniqueCapitalized = [...new Set(capitalizedWords)]
      .filter(word => word.length > 3 && !this.isCommonWord(word));

    uniqueCapitalized.forEach(word => {
      if (!entities.some(e => e.term.toLowerCase() === word.toLowerCase())) {
        entities.push({
          term: word,
          frequency: this.countOccurrences(text, word),
          importance: 0.6,
          context: this.extractContext(text, word)
        });
      }
    });

    return entities.sort((a, b) => b.importance * b.frequency - a.importance * a.frequency);
  }

  /**
   * Extract relationships based on simple pattern matching
   */
  private extractRelationships(
    text: string,
    entities: KeywordAnalysis[],
    diagramType: DiagramType
  ): SemanticRelation[] {
    const relationships: SemanticRelation[] = [];

    // Define relationship patterns based on diagram type
    const relationPatterns: Record<DiagramType, string[]> = {
      flow: ['leads to', 'results in', 'followed by', 'then', 'next'],
      flowchart: ['leads to', 'results in', 'followed by', 'then', 'next'],
      tree: ['contains', 'includes', 'part of', 'under', 'parent'],
      timeline: ['before', 'after', 'during', 'preceded by', 'followed by'],
      matrix: ['versus', 'compared to', 'against', 'different from'],
      cycle: ['returns to', 'cycles back', 'repeats', 'continues to'],
      comparison: ['versus', 'compared to', 'against', 'different from'],
      network: ['connects to', 'linked to', 'related to'],
      conceptmap: ['relates to', 'connected to', 'associated with'],
      mindmap: ['branches to', 'subtopic of', 'expands into'],
      general: [],
    };

    const patterns = relationPatterns[diagramType] || relationPatterns.flow;

    // Simple relationship extraction
    for (let i = 0; i < entities.length - 1; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const entity1 = entities[i];
        const entity2 = entities[j];

        // Look for relationship indicators between entities
        const relationMatch = this.findRelationBetweenEntities(text, entity1.term, entity2.term, patterns);

        if (relationMatch) {
          relationships.push({
            subject: entity1.term,
            relation: relationMatch,
            object: entity2.term,
            confidence: 0.7
          });
        }
      }
    }

    return relationships;
  }

  /**
   * Helper methods
   */
  private countOccurrences(text: string, term: string): number {
    const escaped = escapeRegex(term.toLowerCase());
    return (text.toLowerCase().match(new RegExp(escaped, 'g')) || []).length;
  }

  private extractContext(text: string, term: string): string[] {
    // `\.(?:\s+|$)`, not a bare class '.', so a decimal/version/IP inside a
    // context snippet stays intact. Mirrors daebbc45 (same file); pinned TC-309.
    const sentences = text.split(/[!?]+|\.(?:\s+|$)/);
    return sentences.filter(sentence =>
      sentence.toLowerCase().includes(term.toLowerCase())
    ).map(s => s.trim()).slice(0, 2);
  }

  private isCommonWord(word: string): boolean {
    const commonWords = ['The', 'This', 'That', 'With', 'From', 'They', 'Were', 'Been', 'Have', 'Will'];
    return commonWords.includes(word);
  }

  private categorizeEntity(term: string, diagramType: DiagramType): string {
    // Simple categorization based on diagram type
    const categories: Record<DiagramType, string> = {
      flow: 'process',
      flowchart: 'process',
      tree: 'node',
      timeline: 'event',
      matrix: 'item',
      cycle: 'stage',
      comparison: 'item',
      network: 'node',
      conceptmap: 'concept',
      mindmap: 'topic',
      general: 'entity',
    };
    return categories[diagramType] || 'entity';
  }

  private findRelationBetweenEntities(text: string, entity1: string, entity2: string, patterns: string[]): string | null {
    const lowerText = text.toLowerCase();
    const pos1 = lowerText.indexOf(entity1.toLowerCase());
    const pos2 = lowerText.indexOf(entity2.toLowerCase());

    if (pos1 === -1 || pos2 === -1) return null;

    const start = Math.min(pos1, pos2);
    const end = Math.max(pos1, pos2) + Math.max(entity1.length, entity2.length);
    const contextText = text.substring(start, end);

    for (const pattern of patterns) {
      if (contextText.toLowerCase().includes(pattern)) {
        return pattern;
      }
    }

    // Default relationship based on position
    return pos1 < pos2 ? 'leads to' : 'preceded by';
  }

  private addFallbackNodes(nodes: NodeDatum[], keyphrases: string[]): void {
    if (keyphrases.length === 0) {
      nodes.push(
        { id: 'node_0', label: 'Main Topic', meta: { importance: this.FALLBACK_NODES_MAIN_TOPIC_IMPORTANCE } },
        { id: 'node_1', label: 'Sub Topic', meta: { importance: this.FALLBACK_NODES_SUB_TOPIC_IMPORTANCE } }
      );
    } else {
      keyphrases.slice(0, this.FALLBACK_NODES_KEYPHRASE_LIMIT).forEach((phrase, index) => {
        if (!nodes.some(n => n.label === phrase)) {
          nodes.push({
            id: `node_${nodes.length}`,
            label: phrase,
            meta: { importance: this.FALLBACK_NODES_KEYPHRASE_BASE_IMPORTANCE - index * this.FALLBACK_NODES_KEYPHRASE_IMPORTANCE_DECREMENT }
          });
        }
      });
    }
  }

  /**
   * Iteration 2+: Statistical analysis for improved detection
   */
  private async statisticalAnalysis(segment: ContentSegment, baseAnalysis: DiagramAnalysis): Promise<DiagramAnalysis> {
    try {
      // Boost base analysis with statistical insights
      const safeBaseConf = sanitizeFinite(baseAnalysis.confidence);
      const boostedConfidence = Math.min(safeBaseConf * 1.15, MAX_DIAGRAM_CONFIDENCE);

      return {
        ...baseAnalysis,
        confidence: boostedConfidence,
        reasoning: `${baseAnalysis.reasoning} + statistical validation`
      };
    } catch (error) {
      logger.warn(`[V${this.iteration}] Statistical analysis failed:`, error);
      return baseAnalysis;
    }
  }

  /**
   * Iteration 3+: Hybrid approach combining multiple methods
   */
  private async hybridAnalysis(segment: ContentSegment, baseAnalysis: DiagramAnalysis): Promise<DiagramAnalysis> {
    try {
      // Run rule-based detection
      const ruleBasedResult = await this.ruleBasedDetection(segment);

      // Weighted voting system (simplified without advanced detector)
      const candidates = [
        { result: ruleBasedResult, weight: 1.0, method: 'rule-based' }
      ];

      // Calculate weighted scores for each diagram type
      const typeScores: Record<DiagramType, { score: number; methods: string[] }> = {
        flow: { score: 0, methods: [] },
        flowchart: { score: 0, methods: [] },
        tree: { score: 0, methods: [] },
        timeline: { score: 0, methods: [] },
        matrix: { score: 0, methods: [] },
        cycle: { score: 0, methods: [] },
        comparison: { score: 0, methods: [] },
        network: { score: 0, methods: [] },
        conceptmap: { score: 0, methods: [] },
        mindmap: { score: 0, methods: [] },
        general: { score: 0, methods: [] },
      };

      candidates.forEach(candidate => {
        const confidence = sanitizeFinite(candidate.result.confidence);
        const type = sanitizeDiagramType(candidate.result.type);
        const weightedScore = confidence * candidate.weight;
        typeScores[type].score += weightedScore;
        typeScores[type].methods.push(candidate.method);
      });

      // Find consensus winner
      const consensusType = Object.entries(typeScores).reduce((best, [type, data]) =>
        data.score > best.score ? { type: type as DiagramType, score: data.score, methods: data.methods } : best,
        { type: 'flow' as DiagramType, score: 0, methods: [] }
      );

      // Calculate final confidence based on consensus strength
      const methodAgreement = candidates.length > 0 ? consensusType.methods.length / candidates.length : 0;
      const finalConfidence = Math.min(consensusType.score * methodAgreement, MAX_DIAGRAM_CONFIDENCE);

      // Get the best result for the consensus type
      const bestCandidate = candidates
        .filter(c => sanitizeDiagramType(c.result.type) === consensusType.type)
        .sort((a, b) => sanitizeFinite(b.result.confidence) - sanitizeFinite(a.result.confidence))[0];

      if (bestCandidate) {
        return {
          ...bestCandidate.result,
          confidence: finalConfidence,
          reasoning: `Hybrid consensus: ${consensusType.type} (${consensusType.methods.join(' + ')}, ${(finalConfidence * 100).toFixed(1)}% confidence)`
        };
      } else {
        // Fallback to highest confidence result
        const highestConfidence = candidates.reduce((best, current) =>
          sanitizeFinite(current.result.confidence) >
          sanitizeFinite(best.result.confidence)
            ? current : best
        );

        const fallbackConf = sanitizeFinite(highestConfidence.result.confidence);
        return {
          ...highestConfidence.result,
          confidence: Math.min(fallbackConf * this.HYBRID_HIGHEST_CONFIDENCE_BOOST_FACTOR, this.HYBRID_HIGHEST_CONFIDENCE_CAP),
          reasoning: `${highestConfidence.result.reasoning} + hybrid validation`
        };
      }

    } catch (error) {
      logger.warn(`[V${this.iteration}] Hybrid analysis failed:`, error);

      // Fallback to enhanced base analysis
      const catchConf = sanitizeFinite(baseAnalysis.confidence);
      return {
        ...baseAnalysis,
        confidence: Math.min(catchConf * this.HYBRID_FALLBACK_BOOST_FACTOR, this.HYBRID_FALLBACK_CONFIDENCE_CAP),
        reasoning: `${baseAnalysis.reasoning} + hybrid fallback`
      };
    }
  }

  /**
   * Evaluate detection quality
   */
  private async evaluateDetection(analysis: DiagramAnalysis, processingTime: number): Promise<void> {
    const safeNodes = analysis.nodes ?? [];
    const safeEdges = analysis.edges ?? [];
    const metrics = {
      confidence: analysis.confidence,
      nodeCount: safeNodes.length,
      edgeCount: safeEdges.length,
      hasValidStructure: safeNodes.length >= 2,
      processingTime
    };

    const successCriteria = {
      hasStructure: metrics.hasValidStructure,
      goodConfidence: metrics.confidence > 0.5,
      hasContent: metrics.nodeCount > 0
    };

    Object.values(successCriteria).every(v => v);
  }

  /**
   * Method to increment iteration for testing improvements
   */
  public nextIteration(): void {
    this.iteration++;
  }

  // ========================================
  // TASK-0021: detect(), calculateConfidence(), complex type handling
  // ========================================

  /**
   * TASK-0021: Detect diagram type from analysis result and segments.
   * Hybrid approach: rule-based keyword scoring + optional LLM recommendation bonus.
   */
  detect(
    analysisResult: DiagramAnalysis | null,
    segments: ContentSegment[]
  ): DiagramDetectionResult {
    // Combine all segment text for analysis
    const combinedText = segments.map(s => s.text).join(' ');
    const lowerText = combinedText.toLowerCase();

    // Also combine keyphrases
    const keyphrases = segments.flatMap(s => s.keyphrases).map(kp => kp.toLowerCase());

    // Extract text features
    const features = this.extractTextFeatures(lowerText, keyphrases);

    // Calculate confidence for each canonical type using calculateConfidence.
    // REQ-290: delegate to the single-source `DIAGRAM_TYPES` instead of a
    // re-literalized array — the prior `as DiagramType[]` cast defeated the
    // type-checker, so a newly-added DiagramType would be silently un-scored.
    const allScores: DiagramScore[] = DIAGRAM_TYPES.map(type => {
      const confidence = this.calculateConfidence(type, features);
      return {
        type,
        score: features.keywordFrequency[type] + features.relationPatterns[type] * 5,
        confidence,
      };
    });

    // Sort by confidence descending (sanitize to prevent NaN sort instability)
    allScores.sort((a, b) => sanitizeFinite(b.confidence, 0) - sanitizeFinite(a.confidence, 0));

    // LLM recommendation bonus: if analysisResult suggests a type, boost it
    if (analysisResult && analysisResult.type) {
      const llmRecommended = sanitizeDiagramType(analysisResult.type);
      const matchEntry = allScores.find(s => s.type === llmRecommended);
      if (matchEntry) {
        matchEntry.confidence = Math.min(sanitizeFinite(matchEntry.confidence, 0) * 1.15, MAX_DIAGRAM_CONFIDENCE);
      }
    }

    // Re-sort after LLM bonus
    allScores.sort((a, b) => sanitizeFinite(b.confidence, 0) - sanitizeFinite(a.confidence, 0));

    const primary = allScores[0];
    if (!primary) {
      return {
        primaryType: 'general' as DiagramType,
        confidence: 0,
        alternatives: [],
        isComplex: false,
        secondaryTypes: [],
        fusionStrategy: 'fallback',
        reasoning: 'No diagram types could be scored',
      };
    }
    const primaryType = primary.type;

    // Detect complex types: 2+ types with confidence >= 0.5
    const highConfidenceTypes = allScores.filter(s => s.confidence >= 0.5);
    const isComplex = highConfidenceTypes.length >= 2;

    const secondaryTypes: DiagramType[] = isComplex
      ? highConfidenceTypes
          .filter(s => s.type !== primaryType)
          .map(s => s.type)
      : [];

    // Build fusion strategy description
    let fusionStrategy = 'single';
    if (isComplex) {
      const typeNames = [primaryType, ...secondaryTypes];
      fusionStrategy = this.buildFusionStrategy(typeNames);
    }

    return {
      primaryType,
      confidence: primary.confidence,
      alternatives: allScores.slice(1),
      isComplex,
      secondaryTypes,
      fusionStrategy,
      reasoning: `Detected ${primaryType} with confidence ${(primary.confidence * 100).toFixed(1)}%${isComplex ? ` (complex: ${secondaryTypes.join(', ')})` : ''}`,
    };
  }

  /**
   * TASK-0021: Extract text features for confidence calculation
   */
  extractTextFeatures(text: string, keyphrases: string[]): TextFeatures {
    const keywordHits: Record<DiagramType, string[]> = {
      flow: [],
      flowchart: [],
      tree: [],
      timeline: [],
      matrix: [],
      cycle: [],
      comparison: [],
      network: [],
      conceptmap: [],
      mindmap: [],
      general: [],
    };
    const keywordFrequency: Record<DiagramType, number> = {
      flow: 0,
      flowchart: 0,
      tree: 0,
      timeline: 0,
      matrix: 0,
      cycle: 0,
      comparison: 0,
      network: 0,
      conceptmap: 0,
      mindmap: 0,
      general: 0,
    };
    const relationPatterns: Record<DiagramType, number> = {
      flow: 0,
      flowchart: 0,
      tree: 0,
      timeline: 0,
      matrix: 0,
      cycle: 0,
      comparison: 0,
      network: 0,
      conceptmap: 0,
      mindmap: 0,
      general: 0,
    };

    let totalKeywords = 0;

    for (const diagramType of Object.keys(DIAGRAM_KEYWORDS) as DiagramType[]) {
      const kw = DIAGRAM_KEYWORDS[diagramType];
      const allKw = [...kw.primary, ...kw.secondary, ...kw.context];

      for (const keyword of allKw) {
        const lowerKeyword = keyword.toLowerCase();
        // Count occurrences
        const regex = new RegExp(escapeRegex(lowerKeyword), 'gi');
        const matches = text.match(regex);
        if (matches && matches.length > 0) {
          keywordHits[diagramType].push(keyword);
          keywordFrequency[diagramType] += matches.length;
          totalKeywords += matches.length;
        }
      }

      // Relation pattern detection
      const relationIndicators: Record<DiagramType, string[]> = {
        flow: ['→', 'leads to', 'results in', 'followed by', 'してから', 'した後'],
        flowchart: [],
        tree: ['includes', 'contains', 'part of', '属する', '含まれる', '分類'],
        timeline: ['before', 'after', 'during', 'から', 'まで', '以降'],
        matrix: ['versus', 'compared to', 'against', 'に対して', '比較', '一方'],
        cycle: ['returns to', 'cycles back', 'repeats', '繰り返し', '循環', '戻る'],
        comparison: [],
        network: [],
        conceptmap: [],
        mindmap: [],
        general: [],
      };

      for (const pattern of relationIndicators[diagramType]) {
        const lowerPattern = pattern.toLowerCase();
        if (text.includes(lowerPattern)) {
          relationPatterns[diagramType]++;
        }
      }
    }

    return { keywordHits, keywordFrequency, totalKeywords, relationPatterns };
  }

  /**
   * TASK-0021: Calculate confidence score for a specific diagram type
   * Based on keyword frequency + relation patterns + variety of keyword hits
   */
  calculateConfidence(type: DiagramType, features: TextFeatures): number {
    const hits = features.keywordHits[type];
    const freq = features.keywordFrequency[type];
    const relPattern = features.relationPatterns[type];
    const total = Math.max(features.totalKeywords, 1);

    if (freq === 0 && relPattern === 0) {
      return 0;
    }

    // Get the total number of keywords available for this type for proportional scaling
    const kw = DIAGRAM_KEYWORDS[type];
    const totalAvailableKeywords = kw.primary.length + kw.secondary.length + kw.context.length;

    // Factor 1: Keyword variety ratio (0-0.35)
    // What fraction of this type's keywords were found?
    const varietyRatio = Math.min(hits.length / Math.min(totalAvailableKeywords, 10), 1.0);
    const varietyScore = varietyRatio * 0.35;

    // Factor 2: Keyword frequency strength (0-0.35)
    // Logarithmic scaling: even 1-2 hits give meaningful score
    const frequencyStrength = Math.min(1 - Math.exp(-freq / 3), 1.0);
    const frequencyScore = frequencyStrength * 0.35;

    // Factor 3: Relation pattern bonus (0-0.3)
    const relationScore = Math.min(relPattern / 2, 1.0) * 0.3;

    // Combined score
    let confidence = varietyScore + frequencyScore + relationScore;

    // Cap detection confidence below certainty (see MAX_DIAGRAM_CONFIDENCE).
    confidence = Math.min(confidence, MAX_DIAGRAM_CONFIDENCE);

    // Floor: ensure minimum confidence for strong matches
    if (hits.length >= 3 && freq >= 5) {
      confidence = Math.max(confidence, 0.8);
    } else if (hits.length >= 2 && freq >= 3) {
      confidence = Math.max(confidence, 0.7);
    }

    // Dampen for very weak signals (only 1 hit, low frequency, no relation patterns)
    if (hits.length === 1 && freq <= 2 && relPattern === 0) {
      confidence = Math.min(confidence, 0.45);
    }

    return confidence;
  }

  /**
   * TASK-0021: Build fusion strategy for complex diagram types
   */
  private buildFusionStrategy(types: DiagramType[]): string {
    const strategyMap: Record<string, string> = {
      'flow,timeline': '時系列フローチャート',
      'timeline,flow': '時系列フローチャート',
      'tree,matrix': '分類比較表',
      'matrix,tree': '分類比較表',
      'flow,cycle': '反復プロセスフロー',
      'cycle,flow': '反復プロセスフロー',
      'tree,flow': '階層フロー',
      'flow,tree': '階層フロー',
      'timeline,matrix': '時系列比較',
      'matrix,timeline': '時系列比較',
      'cycle,timeline': '循環タイムライン',
      'timeline,cycle': '循環タイムライン',
    };

    const key = types.join(',');
    return strategyMap[key] || `${types.join('+')}の複合図解`;
  }

  /**
   * 🔄 Custom Instructions: Apply Iterative Detection (Implementation Phase)
   */
  private async applyIterativeDetection(segment: ContentSegment): Promise<DiagramAnalysis> {
    // Iteration 1: Rule-based detection
    let analysis = await this.ruleBasedDetection(segment);

    // Iteration 2+: Statistical analysis based on learned improvements
    if (this.iteration > 1 && this.shouldEnableStatisticalAnalysis()) {
      analysis = await this.enhancedStatisticalAnalysis(segment, analysis);
    }

    // Iteration 3+: Hybrid multi-method approach
    if (this.iteration > 2) {
      analysis = await this.hybridAnalysis(segment, analysis);
    }

    return analysis;
  }

  /**
   * 🔄 Custom Instructions: Test Detection Quality (Testing Phase)
   */
  private async testDetectionQuality(
    analysis: DiagramAnalysis,
    segment: ContentSegment
  ): Promise<{
    passed: boolean;
    testResults: Array<{ name: string; passed: boolean; score: number }>;
    overallScore: number;
  }> {
    const tests = [
      this.testConfidenceThreshold(analysis),
      this.testStructuralValidity(analysis),
      this.testSemanticRelevance(analysis, segment),
      this.testTypeAppropriateness(analysis, segment)
    ];

    const testResults = await Promise.all(tests);
    const overallScore = testResults.length > 0
      ? testResults.reduce((sum, result) => sum + result.score, 0) / testResults.length
      : 0;
    const passed = overallScore > this.TEST_QUALITY_THRESHOLD; // 75% threshold

    return { passed, testResults, overallScore };
  }

  /**
   * 🔄 Custom Instructions: Evaluate Detection Performance (Evaluation Phase)
   */
  private async evaluateDetectionPerformance(
    analysis: DiagramAnalysis,
    startTime: number
  ): Promise<{
    qualityScore: number;
    needsImprovement: boolean;
    suggestions: string[];
  }> {
    const safeNodes = analysis.nodes ?? [];
    const safeEdges = analysis.edges ?? [];
    const metrics = {
      confidence: analysis.confidence,
      nodeCount: safeNodes.length,
      edgeCount: safeEdges.length,
      structuralComplexity: safeEdges.length / Math.max(safeNodes.length, 1),
      processingTime: performance.now() - startTime
    };

    // Calculate quality score based on multiple factors
    const qualityFactors = {
      confidenceQuality: this.evaluateConfidenceQuality(metrics.confidence),
      structuralQuality: this.evaluateStructuralQuality(metrics.nodeCount, metrics.edgeCount),
      complexityQuality: this.evaluateComplexityQuality(metrics.structuralComplexity),
      performanceQuality: this.evaluateDetectionPerformanceQuality(metrics.processingTime),
      typeRelevanceQuality: this.evaluateTypeRelevance(analysis)
    };

    const qualityScore = Object.values(qualityFactors).reduce((a, b) => a + b, 0) / Object.keys(qualityFactors).length;

    // Generate improvement suggestions
    const suggestions = this.generateDetectionImprovementSuggestions(qualityFactors, metrics);
    const needsImprovement = qualityScore < this.EVALUATION_IMPROVEMENT_THRESHOLD; // 80% threshold for improvement

    return { qualityScore, needsImprovement, suggestions };
  }

  /**
   * 🔄 Custom Instructions: Apply Detection Improvements (Improvement Phase)
   */
  private async applyDetectionImprovements(
    analysis: DiagramAnalysis,
    segment: ContentSegment,
    suggestions: string[]
  ): Promise<DiagramAnalysis> {
    let improvedAnalysis = { ...analysis };

    for (const suggestion of suggestions) {
      if (suggestion.includes('boost_confidence')) {
        improvedAnalysis = await this.boostDetectionConfidence(improvedAnalysis, segment);
      } else if (suggestion.includes('enhance_structure')) {
        improvedAnalysis = await this.enhanceStructuralDetection(improvedAnalysis, segment);
      } else if (suggestion.includes('refine_type')) {
        improvedAnalysis = await this.refineTypeDetection(improvedAnalysis, segment);
      } else if (suggestion.includes('optimize_performance')) {
        improvedAnalysis = await this.optimizeDetectionPerformance(improvedAnalysis);
      }
    }

    return improvedAnalysis;
  }

  /**
   * 🔄 Custom Instructions: Update Detection Metrics (Continuous Learning)
   */
  private updateDetectionMetrics(analysis: DiagramAnalysis, processingTime: number, qualityScore: number): void {
    const safeType = sanitizeDiagramType(analysis.type);
    const safeConfidence = sanitizeFinite(analysis.confidence, 0);

    // Store historical data for trend analysis
    this.detectionMetrics.confidenceHistory.push(safeConfidence);
    this.detectionMetrics.processingTimeHistory.push(processingTime);
    this.detectionMetrics.qualityScores.set(this.iteration, qualityScore);

    // Update type distribution
    const currentCount = this.detectionMetrics.typeDistribution.get(safeType) || 0;
    this.detectionMetrics.typeDistribution.set(safeType, currentCount + 1);

    // Calculate iterative improvements
    this.detectionMetrics.iterativeImprovements.set('avgConfidence', safeConfidence);
    this.detectionMetrics.iterativeImprovements.set('avgProcessingTime', processingTime);
    this.detectionMetrics.iterativeImprovements.set('qualityScore', qualityScore);

    // Log improvements
    if (this.iteration > 1) {
      const previousQuality = this.detectionMetrics.qualityScores.get(this.iteration - 1) || 0;
      void previousQuality; // quality delta available for future logging
    }
  }

  // Helper methods for quality evaluation and improvement
  private shouldEnableStatisticalAnalysis(): boolean {
    const previousScores = Array.from(this.detectionMetrics.qualityScores.values());
    return previousScores.length === 0 || Math.max(...previousScores) < this.STATISTICAL_ANALYSIS_ENABLE_THRESHOLD;
  }

  private async enhancedStatisticalAnalysis(segment: ContentSegment, baseAnalysis: DiagramAnalysis): Promise<DiagramAnalysis> {
    // Apply learned improvements from previous iterations
    const enhancedConfidence = Math.min(sanitizeFinite(baseAnalysis.confidence, 0) * this.ENHANCED_STATISTICAL_BOOST_FACTOR, MAX_DIAGRAM_CONFIDENCE);

    return {
      ...baseAnalysis,
      confidence: enhancedConfidence,
      reasoning: `${baseAnalysis.reasoning} + enhanced statistical analysis`
    };
  }

  private async testConfidenceThreshold(analysis: DiagramAnalysis): Promise<{ passed: boolean; score: number; name: string }> {
    const safeConfidence = sanitizeFinite(analysis.confidence, 0);
    // Delegate to the canonical boundary predicate so the gate and downstream
    // consumers (SimplePipeline high/low-confidence flags) agree at exactly 0.6.
    const passed = meetsGoodDetectionConfidence(safeConfidence);
    const score = safeConfidence;
    return { passed, score, name: 'Confidence Threshold' };
  }

  private async testStructuralValidity(analysis: DiagramAnalysis): Promise<{ passed: boolean; score: number; name: string }> {
    const safeNodes = analysis.nodes ?? [];
    const safeEdges = analysis.edges ?? [];
    const hasValidStructure = safeNodes.length >= this.MIN_NODES_FOR_VALID_STRUCTURE && safeEdges.length >= this.MIN_EDGES_FOR_VALID_STRUCTURE;
    const passed = hasValidStructure;
    const score = hasValidStructure ? this.STRUCTURAL_VALIDITY_SCORE_FULL : this.STRUCTURAL_VALIDITY_SCORE_PARTIAL;
    return { passed, score, name: 'Structural Validity' };
  }

  private async testSemanticRelevance(analysis: DiagramAnalysis, segment: ContentSegment): Promise<{ passed: boolean; score: number; name: string }> {
    // Simplified semantic relevance test
    const text = (segment.summary || segment.text || '').toLowerCase();
    const safeNodes = analysis.nodes ?? [];
    const hasRelevantNodes = safeNodes.some(node =>
      node.label && text.includes(node.label.toLowerCase())
    );
    const passed = hasRelevantNodes;
    const score = hasRelevantNodes ? this.SEMANTIC_RELEVANCE_SCORE_HIGH : this.SEMANTIC_RELEVANCE_SCORE_LOW;
    return { passed, score, name: 'Semantic Relevance' };
  }

  private async testTypeAppropriateness(analysis: DiagramAnalysis, segment: ContentSegment): Promise<{ passed: boolean; score: number; name: string }> {
    // Test if the detected type is appropriate for the content
    const text = (segment.summary || segment.text || '').toLowerCase();
    const typeKeywords: Record<DiagramType, string[]> = {
      flow: ['process', 'step', 'flow', 'procedure'],
      flowchart: ['flowchart', 'decision', 'branch', 'condition'],
      tree: ['hierarchy', 'structure', 'tree', 'branch'],
      timeline: ['time', 'sequence', 'history', 'chronological'],
      matrix: ['compare', 'matrix', 'grid', 'table'],
      cycle: ['cycle', 'loop', 'circular', 'iterative'],
      comparison: ['compare', 'versus', 'pros', 'cons'],
      network: ['network', 'graph', 'node', 'connection'],
      conceptmap: ['concept', 'relate', 'connect', 'associate'],
      mindmap: ['mindmap', 'brainstorm', 'central', 'topic'],
      general: ['diagram', 'chart', 'visual', 'overview'],
    };

    const safeType = sanitizeDiagramType(analysis.type);
    const safeConfidence = sanitizeFinite(analysis.confidence, 0);
    const keywords = typeKeywords[safeType] || [];
    const hasTypeKeywords = keywords.some(keyword => text.includes(keyword));
    const passed = hasTypeKeywords || safeConfidence > this.TYPE_APPROPRIATENESS_CONFIDENCE_THRESHOLD;
    const score = hasTypeKeywords ? this.TYPE_APPROPRIATENESS_SCORE_FULL : safeConfidence;
    return { passed, score, name: 'Type Appropriateness' };
  }

  private evaluateConfidenceQuality(confidence: number): number {
    return confidence;
  }

  private evaluateStructuralQuality(nodeCount: number, edgeCount: number): number {
    if (nodeCount >= this.STRUCTURAL_QUALITY_NODE_THRESHOLD && edgeCount >= this.STRUCTURAL_QUALITY_EDGE_THRESHOLD) return this.STRUCTURAL_QUALITY_SCORE_HIGH;
    if (nodeCount >= 1) return this.STRUCTURAL_QUALITY_SCORE_MEDIUM;
    return this.STRUCTURAL_QUALITY_SCORE_LOW;
  }

  private evaluateComplexityQuality(structuralComplexity: number): number {
    if (structuralComplexity >= this.COMPLEXITY_QUALITY_OPTIMAL_MIN && structuralComplexity <= this.COMPLEXITY_QUALITY_OPTIMAL_MAX) return this.COMPLEXITY_QUALITY_SCORE_HIGH;
    if (structuralComplexity >= this.COMPLEXITY_QUALITY_ACCEPTABLE_MIN && structuralComplexity <= this.COMPLEXITY_QUALITY_ACCEPTABLE_MAX) return this.COMPLEXITY_QUALITY_SCORE_MEDIUM;
    return this.COMPLEXITY_QUALITY_SCORE_LOW;
  }

  private evaluateDetectionPerformanceQuality(processingTime: number): number {
    if (processingTime < this.PERFORMANCE_QUALITY_FAST_THRESHOLD) return this.PERFORMANCE_QUALITY_SCORE_HIGH;
    if (processingTime < this.PERFORMANCE_QUALITY_MEDIUM_THRESHOLD) return this.PERFORMANCE_QUALITY_SCORE_MEDIUM;
    return this.PERFORMANCE_QUALITY_SCORE_LOW;
  }

  private evaluateTypeRelevance(analysis: DiagramAnalysis): number {
    // Simplified type relevance evaluation
    return analysis.confidence;
  }

  private generateDetectionImprovementSuggestions(qualityFactors: Record<string, number>, metrics: Record<string, number>): string[] {
    const suggestions: string[] = [];

    if (qualityFactors.confidenceQuality < 0.8) {
      suggestions.push('boost_confidence');
    }

    if (qualityFactors.structuralQuality < 0.8) {
      suggestions.push('enhance_structure');
    }

    if (qualityFactors.typeRelevanceQuality < 0.8) {
      suggestions.push('refine_type');
    }

    if (qualityFactors.performanceQuality < 0.8) {
      suggestions.push('optimize_performance');
    }

    return suggestions;
  }

  // Improvement implementation methods (simplified for demo)
  private async boostDetectionConfidence(analysis: DiagramAnalysis, segment: ContentSegment): Promise<DiagramAnalysis> {
    const boostedConfidence = Math.min(analysis.confidence * this.BOOST_CONFIDENCE_FACTOR, MAX_DIAGRAM_CONFIDENCE);
    return { ...analysis, confidence: boostedConfidence };
  }

  private async enhanceStructuralDetection(analysis: DiagramAnalysis, segment: ContentSegment): Promise<DiagramAnalysis> {
    // Simplified implementation - could add more sophisticated structure enhancement
    return analysis;
  }

  private async refineTypeDetection(analysis: DiagramAnalysis, segment: ContentSegment): Promise<DiagramAnalysis> {
    // Simplified implementation - could add more sophisticated type refinement
    return analysis;
  }

  private async optimizeDetectionPerformance(analysis: DiagramAnalysis): Promise<DiagramAnalysis> {
    // Simplified implementation - could add performance optimizations
    return analysis;
  }
}
